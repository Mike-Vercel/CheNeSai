import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db, Tx } from "@/lib/database/db";
import type { Presenter } from "@/lib/game-engine/types";
import { aggregatePoints, teamsEnabled } from "@/lib/game-engine/teams";
import type { SessionSettings } from "@/lib/validation/schemas";
import { combineShowEvents, detectShowEvents, detectTeamEvents, type ShowPlayer, type ShowTeam } from "@/lib/show/events";
import { teamSettingsOf } from "./settings";
import { directShow, validateTemplate } from "@/lib/show/director";
import { finalRoundStartEvent, lobbyGreetingEvent } from "@/lib/show/moments";
import { loadRoundStandingRows } from "./round-standings";
import {
  DEFAULT_DIRECTOR_CONFIG,
  isRetortEvent,
  SHOW_EVENT_TYPES,
  type CharacterAnimationName,
  type DialogueTemplate,
  type DirectorConfig,
  type ShowEvent,
  type ShowEventType,
  type ShowLine,
} from "@/lib/show/types";

/**
 * Regista automatico lato server: dopo i punti di una domanda (stessa transazione del SCORE)
 * ricostruisce la classifica prima/dopo dai dati ufficiali, rileva gli eventi reali, sceglie
 * le battute con i nomi veri, le registra (cooldown, menzioni) e le mette nello stato del TV.
 */

/** Battuta pronta per il TV (senza id dei concorrenti). */
export interface PublicShowLine {
  who: Presenter;
  text: string;
  animation: CharacterAnimationName | null;
  event: ShowEventType;
  /** id della riga nel registro (il TV riconosce i saluti nuovi della lobby senza ripeterli) */
  id?: string;
}

// ---------------------------------------------------------------------------
// Configurazione (application_settings, chiave "show")
// ---------------------------------------------------------------------------
export async function loadDirectorConfig(db: Db | Tx): Promise<DirectorConfig> {
  const [row] = await db<{ value: Partial<DirectorConfig> }[]>`select value from application_settings where key = 'show'`;
  const v = row?.value ?? {};
  const events = Array.isArray(v.events) ? v.events.filter((e): e is ShowEventType => (SHOW_EVENT_TYPES as readonly string[]).includes(e)) : [];
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_DIRECTOR_CONFIG.enabled,
    maxLines: clampInt(v.maxLines, 0, 3, DEFAULT_DIRECTOR_CONFIG.maxLines),
    maxMentionsPerPlayerPerRound: clampInt(v.maxMentionsPerPlayerPerRound, 1, 20, DEFAULT_DIRECTOR_CONFIG.maxMentionsPerPlayerPerRound),
    events,
    banterPercent: clampInt(v.banterPercent, 0, 100, DEFAULT_DIRECTOR_CONFIG.banterPercent),
  };
}

export async function saveDirectorConfig(db: Db, patch: Partial<DirectorConfig>): Promise<DirectorConfig> {
  const cur = await loadDirectorConfig(db);
  const next: DirectorConfig = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : cur.enabled,
    maxLines: clampInt(patch.maxLines, 0, 3, cur.maxLines),
    maxMentionsPerPlayerPerRound: clampInt(patch.maxMentionsPerPlayerPerRound, 1, 20, cur.maxMentionsPerPlayerPerRound),
    events: Array.isArray(patch.events) ? patch.events.filter((e) => (SHOW_EVENT_TYPES as readonly string[]).includes(e)) : cur.events,
    banterPercent: clampInt(patch.banterPercent, 0, 100, cur.banterPercent),
  };
  await db`
    insert into application_settings (key, value) values ('show', ${db.json(JSON.parse(JSON.stringify(next)))})
    on conflict (key) do update set value = excluded.value`;
  return next;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

// ---------------------------------------------------------------------------
// Libreria delle battute
// ---------------------------------------------------------------------------
interface LibraryFileLine {
  id: string;
  character: Presenter;
  event: ShowEventType;
  text: string;
  tone?: string;
  intensity?: number;
  priority?: number;
  weight?: number;
  cooldownSec?: number;
  animation?: CharacterAnimationName | null;
}

/** Legge content/show/battute.json (libreria iniziale) e scarta le battute non valide. */
export function readLibraryFile(): LibraryFileLine[] {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "content", "show", "battute.json"), "utf8")) as { lines?: LibraryFileLine[] };
    return (raw.lines ?? []).filter((l) => l && typeof l.id === "string" && validateTemplate({ event: l.event, text: l.text }).length === 0);
  } catch {
    return [];
  }
}

/** Importa nella tabella le battute della libreria che non ci sono ancora (non sovrascrive le modifiche). */
export async function importLibrary(db: Db | Tx, lines: LibraryFileLine[] = readLibraryFile()): Promise<number> {
  let added = 0;
  for (const l of lines) {
    const r = await db`
      insert into dialogue_templates (id, character, event_type, text, tone, intensity, priority, weight, cooldown_sec, animation)
      values (${l.id}, ${l.character}, ${l.event}, ${l.text}, ${l.tone ?? "comico"}, ${l.intensity ?? 2}, ${l.priority ?? 50},
              ${l.weight ?? 1}, ${l.cooldownSec ?? 120}, ${l.animation ?? null})
      on conflict (id) do nothing returning id`;
    added += r.length;
  }
  return added;
}

export async function loadTemplates(db: Db | Tx): Promise<DialogueTemplate[]> {
  const rows = await db<
    { id: string; character: Presenter; event_type: ShowEventType; text: string; tone: string; intensity: number; priority: number; weight: string; cooldown_sec: number; animation: CharacterAnimationName | null; enabled: boolean }[]
  >`select id, character, event_type, text, tone, intensity, priority, weight, cooldown_sec, animation, enabled from dialogue_templates where enabled`;
  return rows.map((r) => ({
    id: r.id,
    character: r.character,
    event: r.event_type,
    text: r.text,
    tone: r.tone,
    intensity: r.intensity,
    priority: r.priority,
    weight: Number(r.weight),
    cooldownSec: r.cooldown_sec,
    animation: r.animation,
    enabled: r.enabled,
  }));
}

// ---------------------------------------------------------------------------
// Dopo i punti di una domanda
// ---------------------------------------------------------------------------
interface HistRow {
  sq_id: string;
  participant_id: string;
  kind: "answer" | "no_answer";
  points_after: number;
  delta: number;
  correct: boolean;
}

export async function directAfterScore(tx: Tx, sessionId: string, sqId: string): Promise<ShowLine[]> {
  const config = await loadDirectorConfig(tx);
  if (!config.enabled) {
    await tx`update game_state set show_lines = '[]'::jsonb where session_id = ${sessionId}`;
    return [];
  }
  let templates = await loadTemplates(tx);
  if (templates.length === 0 && (await importLibrary(tx)) > 0) templates = await loadTemplates(tx);
  // archivio creato prima dei battibecchi: si aggiungono solo quelle battute (una volta sola)
  const [{ n: retorts }] = await tx<{ n: number }[]>`select count(*)::int as n from dialogue_templates where starts_with(event_type, 'RETORT_')`;
  if (retorts === 0 && (await importLibrary(tx, readLibraryFile().filter((l) => isRetortEvent(l.event)))) > 0) templates = await loadTemplates(tx);

  // storia ufficiale dei punti, domanda per domanda (ordine di assegnazione)
  const hist = await tx<HistRow[]>`
    select se.session_question_id as sq_id, se.participant_id, se.kind::text as kind, se.points_after, se.delta,
           (se.kind = 'answer' and coalesce((se.details->>'wrongHits')::int, 1) = 0
             and coalesce((se.details->>'correctHits')::int, 0) = coalesce((se.details->>'totalCorrect')::int, -1)) as correct
    from score_events se join session_questions sq on sq.id = se.session_question_id
    where se.session_id = ${sessionId} and se.kind in ('answer', 'no_answer') and sq.scored_at is not null
    order by sq.scored_at, se.id`;
  const order: string[] = [];
  const byQ = new Map<string, Map<string, HistRow>>();
  for (const h of hist) {
    if (!byQ.has(h.sq_id)) {
      byQ.set(h.sq_id, new Map());
      order.push(h.sq_id);
    }
    byQ.get(h.sq_id)!.set(h.participant_id, h);
  }
  const current = byQ.get(sqId) ?? new Map<string, HistRow>();

  const people = await tx<{ id: string; nickname: string; points: number; team_id: string | null }[]>`
    select p.id, p.nickname, t.points, p.team_id from participants p join score_totals t on t.participant_id = p.id
    where p.session_id = ${sessionId} and p.status = 'active'`;
  const answers = await tx<{ participant_id: string; response_ms: number }[]>`
    select participant_id, response_ms from answer_submissions where session_question_id = ${sqId}`;
  const ms = new Map(answers.map((a) => [a.participant_id, a.response_ms]));

  const streak = (pid: string, want: "correct" | "wrong") => {
    let n = 0;
    for (let i = order.length - 1; i >= 0; i--) {
      const r = byQ.get(order[i])!.get(pid);
      if (!r) break;
      const ok = want === "correct" ? r.correct : r.kind === "answer" && !r.correct;
      if (!ok) break;
      n++;
    }
    return n;
  };

  const players: ShowPlayer[] = people.map((p) => {
    const r = current.get(p.id);
    return {
      id: p.id,
      nickname: p.nickname,
      points: p.points,
      prevPoints: r ? p.points - r.delta : p.points,
      inPlay: !!r,
      answered: r?.kind === "answer",
      correct: !!r?.correct,
      responseMs: r?.correct ? (ms.get(p.id) ?? null) : null,
      correctStreak: streak(p.id, "correct"),
      wrongStreak: streak(p.id, "wrong"),
    };
  });

  // da quante domande lo stesso giocatore è primo da solo
  const running = new Map<string, number>();
  const leaders: (string | null)[] = [];
  for (const q of order) {
    for (const [pid, r] of byQ.get(q)!) running.set(pid, r.points_after);
    let top = -Infinity;
    let who: string | null = null;
    let tie = false;
    for (const [pid, pts] of running) {
      if (pts > top) {
        top = pts;
        who = pid;
        tie = false;
      } else if (pts === top) tie = true;
    }
    leaders.push(tie ? null : who);
  }
  let leaderStreak = 0;
  const lastLeader = leaders[leaders.length - 1] ?? null;
  for (let i = leaders.length - 1; i >= 0 && lastLeader && leaders[i] === lastLeader; i--) leaderStreak++;

  const [pos] = await tx<{ round_id: string; pos: number; tot: number }[]>`
    select sq.round_id,
      (select count(*)::int from session_questions x where x.round_id = sq.round_id and not x.is_reserve and x.shown_at is not null and x.shown_at <= coalesce(sq.shown_at, clock_timestamp())) as pos,
      (select count(*)::int from session_questions x where x.round_id = sq.round_id and not x.is_reserve
         and (sq.vote_option_id is null or x.vote_option_id = sq.vote_option_id)) as tot
    from session_questions sq where sq.id = ${sqId}`;
  const endOfRound = !!pos && pos.pos >= pos.tot;
  // ultima domanda della serata: nessun round ancora da giocare dopo questo
  const [{ more }] = pos
    ? await tx<{ more: boolean }[]>`
        select exists (
          select 1 from game_rounds r where r.session_id = ${sessionId} and r.started_at is null
            and r.position > (select position from game_rounds where id = ${pos.round_id})
        ) as more`
    : [{ more: true }];
  const moment = { lastOfRound: endOfRound, lastOfGame: endOfRound && !more };
  // fine round: punti fatti NEL ROUND (il vincitore del round è chi ne ha fatti di più)
  const roundRows = endOfRound && pos ? await loadRoundStandingRows(tx, sessionId, pos.round_id) : null;
  const roundPoints = roundRows ? new Map(roundRows.map((r) => [r.participantId, r.points])) : undefined;

  // modalità squadre: punteggi di squadra prima/dopo (stessa aggregazione della classifica a squadre)
  const [sess] = await tx<{ settings: SessionSettings }[]>`select settings from game_sessions where id = ${sessionId}`;
  const ts = teamSettingsOf(sess?.settings);
  let teamEvents: ReturnType<typeof detectTeamEvents> = [];
  if (teamsEnabled(ts.mode)) {
    const teamRows = await tx<{ id: string; name: string }[]>`select id, name from teams where session_id = ${sessionId} order by position`;
    const showTeams: ShowTeam[] = teamRows.map((t) => {
      const members = players.filter((p) => people.find((x) => x.id === p.id)?.team_id === t.id);
      return {
        id: t.id,
        name: t.name,
        points: aggregatePoints(members.map((m) => m.points), ts.aggregation),
        prevPoints: aggregatePoints(members.map((m) => m.prevPoints), ts.aggregation),
        members: members.length,
      };
    });
    const teamRoundPoints = roundRows
      ? new Map(teamRows.map((t) => [t.id, aggregatePoints(roundRows.filter((r) => r.teamId === t.id).map((r) => r.points), ts.aggregation)]))
      : undefined;
    teamEvents = detectTeamEvents({ mode: ts.mode, teams: showTeams, endOfRound, roundPoints: teamRoundPoints });
  }

  const events = combineShowEvents(ts.mode, detectShowEvents({ players, leaderStreak, endOfRound, roundPoints }), teamEvents);

  const used = await tx<{ template_id: string; at: Date }[]>`
    select template_id, max(created_at) as at from show_dialogue_log where session_id = ${sessionId} group by template_id`;
  const mentions = await tx<{ pid: string; n: number }[]>`
    select pid, count(*)::int as n from show_dialogue_log, unnest(participant_ids) as pid
    where session_id = ${sessionId} and round_id is not distinct from ${pos?.round_id ?? null}
    group by pid`;
  const [{ now }] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;

  const lines = directShow({
    events,
    templates,
    history: { lastUsed: new Map(used.map((u) => [u.template_id, u.at.getTime()])), mentionsThisRound: new Map(mentions.map((m) => [m.pid, m.n])) },
    config,
    nowMs: now.getTime(),
    seed: sqId,
    moment,
  });

  await publishLines(tx, sessionId, await logLines(tx, sessionId, lines, { sqId, roundId: pos?.round_id ?? null }));
  return lines;
}

// ---------------------------------------------------------------------------
// Registro e stato del TV (comuni a tutti i momenti)
// ---------------------------------------------------------------------------
/** Registra le battute (cooldown, menzioni, saluti già fatti) e le restituisce pronte per il TV. */
async function logLines(tx: Tx, sessionId: string, lines: ShowLine[], at: { sqId: string | null; roundId: string | null }): Promise<PublicShowLine[]> {
  const out: PublicShowLine[] = [];
  for (const l of lines) {
    const [row] = await tx<{ id: number }[]>`
      insert into show_dialogue_log (session_id, session_question_id, round_id, template_id, character, event_type, text, participant_ids)
      values (${sessionId}, ${at.sqId}, ${at.roundId}, ${l.templateId}, ${l.who}, ${l.event}, ${l.text}, ${tx.array(l.mentions)}::uuid[])
      returning id`;
    out.push({ who: l.who, text: l.text, animation: l.animation, event: l.event, id: String(row.id) });
  }
  return out;
}

async function publishLines(tx: Tx, sessionId: string, pub: PublicShowLine[] | null): Promise<void> {
  if (pub === null) {
    await tx`update game_state set show_lines = null where session_id = ${sessionId}`;
    return;
  }
  await tx`update game_state set show_lines = ${tx.json(JSON.parse(JSON.stringify(pub)))} where session_id = ${sessionId}`;
}

/**
 * Una battuta per un momento fuori dai punti (lobby, inizio finale), con le stesse regole del
 * regista: libreria, cooldown delle battute, eventi abilitati in regia, limiti di menzioni.
 */
async function directMoment(tx: Tx, sessionId: string, event: ShowEvent, at: { seed: string; roundId: string | null }): Promise<PublicShowLine[]> {
  const config = await loadDirectorConfig(tx);
  if (!config.enabled) return [];
  // evento nuovo per un archivio già popolato: si importano dal file solo le sue battute
  const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from dialogue_templates where event_type = ${event.type}`;
  if (n === 0) await importLibrary(tx, readLibraryFile().filter((l) => l.event === event.type));
  const templates = await loadTemplates(tx);
  const used = await tx<{ template_id: string; at: Date }[]>`
    select template_id, max(created_at) as at from show_dialogue_log where session_id = ${sessionId} group by template_id`;
  const mentions = await tx<{ pid: string; n: number }[]>`
    select pid, count(*)::int as n from show_dialogue_log, unnest(participant_ids) as pid
    where session_id = ${sessionId} and round_id is not distinct from ${at.roundId}
    group by pid`;
  const [{ now }] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
  const lines = directShow({
    events: [event],
    templates,
    history: { lastUsed: new Map(used.map((u) => [u.template_id, u.at.getTime()])), mentionsThisRound: new Map(mentions.map((m) => [m.pid, m.n])) },
    // un momento = una battuta sola (voce breve, costo contenuto)
    config: { ...config, maxLines: Math.min(1, config.maxLines) },
    nowMs: now.getTime(),
    seed: at.seed,
  });
  return logLines(tx, sessionId, lines, { sqId: null, roundId: at.roundId });
}

// ---------------------------------------------------------------------------
// Inizio del round finale (dentro la transazione di START_ROUND)
// ---------------------------------------------------------------------------
export async function directFinalRoundStart(tx: Tx, sessionId: string, roundId: string): Promise<PublicShowLine[]> {
  const standings = await tx<{ id: string; nickname: string; points: number; rank: number | null }[]>`
    select p.id, p.nickname, t.points, t.rank from participants p join score_totals t on t.participant_id = p.id
    where p.session_id = ${sessionId} and p.status = 'active'`;
  const event = finalRoundStartEvent(standings);
  const pub = event ? await directMoment(tx, sessionId, event, { seed: `final|${roundId}`, roundId }) : [];
  await publishLines(tx, sessionId, pub.length ? pub : null);
  return pub;
}

// ---------------------------------------------------------------------------
// Saluti della lobby
// ---------------------------------------------------------------------------
/**
 * Saluta per nome i nuovi arrivati in lobby. Scelta lato server (non sul TV): i nomi arrivano dal
 * database (validati all'ingresso, poi ripuliti con cleanSpeech), il registro garantisce che
 * nessuno venga salutato due volte e che cooldown e tetto valgano anche con più TV o dopo un
 * ricaricamento, e la battuta si può pre-riscaldare. Lo innesca il polling del TV in lobby
 * (nessun timer sul server: senza TV acceso non c'è nessuno da salutare); il lock su game_state
 * evita due saluti contemporanei. Non cambia la versione dello stato, così la regia non riceve
 * conflitti di versione: i TV leggono il saluto al polling successivo.
 */
export async function directLobbyGreeting(db: Db, sessionId: string): Promise<PublicShowLine | null> {
  return db.begin(async (tx) => {
    const [st] = await tx<{ phase: string }[]>`select phase::text as phase from game_state where session_id = ${sessionId} for update`;
    if (st?.phase !== "LOBBY") return null;
    const [log] = await tx<{ n: number; last: Date | null }[]>`
      select count(*)::int as n, max(created_at) as last
      from show_dialogue_log where session_id = ${sessionId} and event_type = 'PLAYERS_JOINED'`;
    const greeted = await tx<{ pid: string }[]>`
      select distinct pid from show_dialogue_log, unnest(participant_ids) as pid
      where session_id = ${sessionId} and event_type = 'PLAYERS_JOINED'`;
    const players = await tx<{ id: string; nickname: string; joined_at: Date }[]>`
      select id, nickname, joined_at from participants where session_id = ${sessionId} and status = 'active' and not is_bot`;
    const [{ now }] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
    const n = log?.n ?? 0;
    const event = lobbyGreetingEvent({
      players: players.map((p) => ({ id: p.id, nickname: p.nickname, joinedAtMs: p.joined_at.getTime() })),
      greetedIds: new Set(greeted.map((g) => g.pid)),
      lastGreetingMs: log?.last ? log.last.getTime() : null,
      greetingsSoFar: n,
      nowMs: now.getTime(),
    });
    if (!event) return null;
    const [line] = await directMoment(tx, sessionId, event, { seed: `lobby|${sessionId}|${n}`, roundId: null });
    if (!line) return null;
    await publishLines(tx, sessionId, [line]);
    return line;
  });
}
