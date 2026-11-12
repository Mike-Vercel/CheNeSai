import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db, Tx } from "@/lib/database/db";
import type { Presenter } from "@/lib/game-engine/types";
import { aggregatePoints, teamsEnabled } from "@/lib/game-engine/teams";
import type { SessionSettings } from "@/lib/validation/schemas";
import { combineShowEvents, detectShowEvents, detectTeamEvents, type ShowPlayer, type ShowTeam } from "@/lib/show/events";
import { teamSettingsOf } from "./settings";
import { directShow, renderFor, validateTemplate } from "@/lib/show/director";
import { finalRoundStartEvent, lobbyGreetingEvent } from "@/lib/show/moments";
import {
  chance,
  DISCONNECTED_AFTER_MS,
  isComedyLevel,
  nextNoAnswerStreak,
  noAnswerEvent,
  pickMomentLines,
  pickWheelLines,
  revealChoice,
  TIME_LINE_PERCENT,
  type LineContext,
  type NoAnswerPlayer,
} from "@/lib/show/library";
import type { MomentContext } from "@/features/game/moment";
import { loadRoundStandingRows } from "./round-standings";
import { computeSessionTeamStandings } from "./teams";
import {
  COMEDY_LEVELS,
  DEFAULT_DIRECTOR_CONFIG,
  isRetortEvent,
  NO_ANSWER_EVENT_TYPES,
  SHOW_EVENT_TYPES,
  TEMPLATE_ORIGINS,
  type CharacterAnimationName,
  type ComedyLevel,
  type DialogueTemplate,
  type DirectorConfig,
  type ShowEvent,
  type ShowEventType,
  type ShowLine,
  type TemplateOrigin,
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
  /** libreria ufficiale: testo da mostrare, frase fissa o live, battuta saltabile, scenetta */
  display?: string;
  live?: boolean;
  optional?: boolean;
  group?: string;
  tags?: string[];
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
    comedyLevel: isComedyLevel(v.comedyLevel) ? v.comedyLevel : DEFAULT_DIRECTOR_CONFIG.comedyLevel,
    noAnswerLines: typeof v.noAnswerLines === "boolean" ? v.noAnswerLines : DEFAULT_DIRECTOR_CONFIG.noAnswerLines,
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
    comedyLevel: isComedyLevel(patch.comedyLevel) ? patch.comedyLevel : cur.comedyLevel,
    noAnswerLines: typeof patch.noAnswerLines === "boolean" ? patch.noAnswerLines : cur.noAnswerLines,
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
  level?: ComedyLevel;
  tags?: string[];
  scene?: { key: string; step: number };
  origin?: TemplateOrigin;
  /** varianti per genere (femminile / neutra) */
  textF?: string;
  textN?: string;
}

/** File della libreria: quella iniziale di sempre e la libreria ufficiale scritta dall'utente. */
export const LIBRARY_FILES = { base: "battute.json", ufficiale: "libreria-ufficiale.json" } as const;

/** Legge un file della libreria (content/show) e scarta le battute non valide. */
export function readLibraryFile(file: string = LIBRARY_FILES.base): LibraryFileLine[] {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "content", "show", file), "utf8")) as { lines?: LibraryFileLine[]; origin?: string };
    const origin: TemplateOrigin = (TEMPLATE_ORIGINS as readonly string[]).includes(raw.origin ?? "") ? (raw.origin as TemplateOrigin) : "base";
    const ok = (event: ShowEventType, text: string | undefined) => text === undefined || validateTemplate({ event, text }).length === 0;
    return (raw.lines ?? [])
      .filter((l) => l && typeof l.id === "string" && ok(l.event, l.text) && ok(l.event, l.textF) && ok(l.event, l.textN))
      .map((l) => ({ ...l, origin }));
  } catch {
    return [];
  }
}

/** Libreria ufficiale (content/show/libreria-ufficiale.json). */
export const readOfficialLibrary = () => readLibraryFile(LIBRARY_FILES.ufficiale);

/** Importa nella tabella le battute della libreria che non ci sono ancora (non sovrascrive le modifiche). */
export async function importLibrary(db: Db | Tx, lines: LibraryFileLine[] = readLibraryFile()): Promise<number> {
  let added = 0;
  for (const l of lines) {
    const level = l.level && (COMEDY_LEVELS as readonly string[]).includes(l.level) ? l.level : "leggero";
    const r = await db`
      insert into dialogue_templates (id, character, event_type, text, tone, intensity, priority, weight, cooldown_sec, animation,
                                      level, origin, tags, scene_key, scene_step, text_f, text_n)
      values (${l.id}, ${l.character}, ${l.event}, ${l.text}, ${l.tone ?? "comico"}, ${l.intensity ?? 2}, ${l.priority ?? 50},
              ${l.weight ?? 1}, ${l.cooldownSec ?? 120}, ${l.animation ?? null},
              ${level}, ${l.origin ?? "base"}, ${db.array(l.tags ?? [])}::text[], ${l.scene?.key ?? null}, ${l.scene?.step ?? null},
              ${l.textF ?? null}, ${l.textN ?? null})
      on conflict (id) do nothing returning id`;
    added += r.length;
  }
  return added;
}

/** Libreria iniziale + libreria ufficiale: solo le battute che mancano (e le varianti per genere). */
export async function importAllLibraries(db: Db | Tx): Promise<number> {
  const added = (await importLibrary(db, readLibraryFile())) + (await importLibrary(db, readOfficialLibrary()));
  await syncGenderVariants(db);
  return added;
}

/** Versione delle varianti per genere già portate nell'archivio (application_settings). */
const VARIANTS_KEY = "show_gender_variants";
// 2: Palmino in italiano (varianti riscritte)
const VARIANTS_VERSION = 2;

/**
 * Varianti per genere delle battute già in archivio (importate prima che esistessero): si aggiungono
 * solo dove il testo è ancora quello del file e non ci sono varianti scritte dal pannello. Una volta
 * per versione (segnata in application_settings), così non costa nulla durante il gioco.
 */
export async function syncGenderVariants(db: Db | Tx, force = false): Promise<number> {
  if (!force) {
    const [row] = await db<{ v: number | null }[]>`select (value->>'version')::int as v from application_settings where key = ${VARIANTS_KEY}`;
    if ((row?.v ?? 0) >= VARIANTS_VERSION) return 0;
  }
  let updated = 0;
  for (const l of [...readLibraryFile(), ...readOfficialLibrary()]) {
    if (!l.textF && !l.textN) continue;
    const r = await db`
      update dialogue_templates set text_f = ${l.textF ?? null}, text_n = ${l.textN ?? null}, updated_at = now()
      where id = ${l.id} and text = ${l.text} and text_f is null and text_n is null returning id`;
    updated += r.length;
  }
  await db`
    insert into application_settings (key, value) values (${VARIANTS_KEY}, ${db.json({ version: VARIANTS_VERSION })})
    on conflict (key) do update set value = excluded.value`;
  return updated;
}

export async function loadTemplates(db: Db | Tx): Promise<DialogueTemplate[]> {
  const rows = await db<
    {
      id: string;
      character: Presenter;
      event_type: ShowEventType;
      text: string;
      tone: string;
      intensity: number;
      priority: number;
      weight: string;
      cooldown_sec: number;
      animation: CharacterAnimationName | null;
      enabled: boolean;
      level: ComedyLevel;
      origin: TemplateOrigin;
      tags: string[];
      scene_key: string | null;
      scene_step: number | null;
      text_f: string | null;
      text_n: string | null;
    }[]
  >`select id, character, event_type, text, tone, intensity, priority, weight, cooldown_sec, animation, enabled, level, origin, tags, scene_key, scene_step,
           text_f, text_n
    from dialogue_templates where enabled order by id`;
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
    level: r.level,
    origin: r.origin,
    tags: r.tags ?? [],
    sceneKey: r.scene_key,
    sceneStep: r.scene_step,
    textF: r.text_f,
    textN: r.text_n,
  }));
}

/**
 * Battute della libreria pronte (archivio creato prima di battibecchi o libreria ufficiale: si
 * importano una volta sola, senza toccare quelle modificate dal pannello).
 */
async function ensureLibrary(tx: Tx): Promise<DialogueTemplate[]> {
  let templates = await loadTemplates(tx);
  if (templates.length === 0 && (await importLibrary(tx)) > 0) templates = await loadTemplates(tx);
  const [{ retorts, official }] = await tx<{ retorts: number; official: number }[]>`
    select count(*) filter (where starts_with(event_type, 'RETORT_'))::int as retorts,
           count(*) filter (where origin = 'ufficiale')::int as official
    from dialogue_templates`;
  let added = 0;
  if (retorts === 0) added += await importLibrary(tx, readLibraryFile().filter((l) => isRetortEvent(l.event)));
  if (official === 0) added += await importLibrary(tx, readOfficialLibrary());
  // varianti per genere delle battute già in archivio (una volta sola)
  added += await syncGenderVariants(tx);
  return added > 0 ? loadTemplates(tx) : templates;
}

// ---------------------------------------------------------------------------
// Storia della serata (cooldown, menzioni, scenette, altre serate dello stesso host)
// ---------------------------------------------------------------------------
interface History {
  lastUsed: Map<string, number>;
  mentionsThisRound: Map<string, number>;
  nowMs: number;
  lastSceneMs: number | null;
  /** battute dette nelle ultime serate dello stesso host */
  elsewhere: Set<string>;
}

/** Ultime serate dello stesso host considerate per non ripetere le battute. */
const HOST_SESSIONS = 5;

async function loadHistory(tx: Tx, sessionId: string, roundId: string | null): Promise<History> {
  const used = await tx<{ template_id: string; at: Date }[]>`
    select template_id, max(created_at) as at from show_dialogue_log where session_id = ${sessionId} group by template_id`;
  const mentions = await tx<{ pid: string; n: number }[]>`
    select pid, count(*)::int as n from show_dialogue_log, unnest(participant_ids) as pid
    where session_id = ${sessionId} and round_id is not distinct from ${roundId}
    group by pid`;
  const [{ now, scene }] = await tx<{ now: Date; scene: Date | null }[]>`
    select clock_timestamp() as now,
      (select max(l.created_at) from show_dialogue_log l join dialogue_templates t on t.id = l.template_id
       where l.session_id = ${sessionId} and t.scene_key is not null) as scene`;
  const elsewhere = await tx<{ template_id: string }[]>`
    select distinct l.template_id from show_dialogue_log l
    where l.session_id in (
      select s2.id from game_sessions s1
      join game_sessions s2 on coalesce(s2.host_user_id, s2.created_by) = coalesce(s1.host_user_id, s1.created_by)
      where s1.id = ${sessionId} and s2.id <> s1.id and coalesce(s1.host_user_id, s1.created_by) is not null
      order by s2.created_at desc limit ${HOST_SESSIONS})`;
  return {
    lastUsed: new Map(used.map((u) => [u.template_id, u.at.getTime()])),
    mentionsThisRound: new Map(mentions.map((m) => [m.pid, m.n])),
    nowMs: now.getTime(),
    lastSceneMs: scene ? scene.getTime() : null,
    elsewhere: new Set(elsewhere.map((e) => e.template_id)),
  };
}

/** Posizione della domanda nel round e momento (ultima del round / della serata). */
async function questionPosition(tx: Tx, sessionId: string, sqId: string): Promise<{ roundId: string | null; endOfRound: boolean; moment: MomentContext }> {
  const [pos] = await tx<{ round_id: string; pos: number; tot: number }[]>`
    select sq.round_id,
      (select count(*)::int from session_questions x where x.round_id = sq.round_id and not x.is_reserve and x.shown_at is not null and x.shown_at <= coalesce(sq.shown_at, clock_timestamp())) as pos,
      (select count(*)::int from session_questions x join game_rounds xr on xr.id = x.round_id
             where x.round_id = sq.round_id and not x.is_reserve
               -- round con le categorie: le comuni (senza materia) + quelle della materia scelta (prima del voto: la prima)
               and (x.vote_option_id is null or x.vote_option_id = coalesce(xr.winning_option_id, sq.vote_option_id,
                 (select o.id from category_vote_options o where o.round_id = sq.round_id order by o.position limit 1)))) as tot
    from session_questions sq where sq.id = ${sqId}`;
  const endOfRound = !!pos && pos.pos >= pos.tot;
  const [{ more }] = pos
    ? await tx<{ more: boolean }[]>`
        select exists (
          select 1 from game_rounds r where r.session_id = ${sessionId} and r.started_at is null
            and r.position > (select position from game_rounds where id = ${pos.round_id})
        ) as more`
    : [{ more: true }];
  return { roundId: pos?.round_id ?? null, endOfRound, moment: { lastOfRound: endOfRound, lastOfGame: endOfRound && !more } };
}

/** Condizioni della domanda per le battute della libreria (timer, difficoltà, opzioni). */
async function questionFacts(tx: Tx, sqId: string): Promise<{ timerSeconds: number | null; difficulty: number; fourOptions: boolean; media: string | null }> {
  const [q] = await tx<{ duration: number | null; difficulty: number; type: string; options: number; media: string | null }[]>`
    select (sq.rules->>'durationSeconds')::int as duration, qs.difficulty, qs.type::text as type,
           jsonb_array_length(qs.options)::int as options, qs.media_kind::text as media
    from session_questions sq join question_snapshots qs on qs.session_question_id = sq.id
    where sq.id = ${sqId}`;
  return { timerSeconds: q?.duration ?? null, difficulty: q?.difficulty ?? 2, fourOptions: q?.type === "single" && q.options === 4, media: q?.media ?? null };
}

async function teamModeOf(tx: Tx, sessionId: string) {
  const [sess] = await tx<{ settings: SessionSettings }[]>`select settings from game_sessions where id = ${sessionId}`;
  return teamSettingsOf(sess?.settings);
}

const eventAllowed = (config: DirectorConfig, type: ShowEventType) => config.events.length === 0 || config.events.includes(type);

/** Una battuta (o una scenetta) per un momento a sé: soluzione, timer, classifica, podio. */
function momentLines(
  config: DirectorConfig,
  templates: DialogueTemplate[],
  h: History,
  event: ShowEvent,
  seed: string,
  ctx: LineContext,
  opts: { scenes?: boolean; prefer?: Presenter | null; mentions?: string[]; filter?: (t: DialogueTemplate) => boolean } = {},
): ShowLine[] {
  if (!eventAllowed(config, event.type)) return [];
  return pickMomentLines({
    templates: opts.filter ? templates.filter(opts.filter) : templates,
    event,
    render: (t) => renderFor(t, event),
    comedyLevel: config.comedyLevel,
    ctx,
    lastUsed: h.lastUsed,
    nowMs: h.nowMs,
    seed,
    lastSceneMs: h.lastSceneMs,
    elsewhere: h.elsewhere,
    scenes: opts.scenes,
    prefer: opts.prefer,
    mentions: opts.mentions,
  });
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

/**
 * Contatore delle mancate risposte consecutive (lato server, dentro la transazione dei punti):
 * risponde → 0; non risponde con il telefono collegato → +1; non risponde da disconnesso → 0
 * (al rientro si riparte da zero). Restituisce, per chi era in gioco, contatore e collegamento.
 */
export async function updateNoAnswerStreaks(tx: Tx, sessionId: string, sqId: string): Promise<Map<string, { streak: number; connected: boolean }>> {
  const rows = await tx<{ id: string; streak: number; kind: string; connected: boolean }[]>`
    select p.id, p.no_answer_streak as streak, se.kind::text as kind,
           p.last_seen_at > clock_timestamp() - make_interval(secs => ${DISCONNECTED_AFTER_MS / 1000}::float8) as connected
    from participants p join score_events se on se.participant_id = p.id and se.session_question_id = ${sqId} and se.kind in ('answer', 'no_answer')
    where p.session_id = ${sessionId}`;
  const out = new Map<string, { streak: number; connected: boolean }>();
  for (const r of rows) out.set(r.id, { streak: nextNoAnswerStreak(r.streak, { answered: r.kind === "answer", connected: r.connected }), connected: r.connected });
  if (rows.length > 0) {
    await tx`
      update participants p set no_answer_streak = v.streak
      from unnest(${tx.array(rows.map((r) => r.id))}::uuid[], ${tx.array(rows.map((r) => out.get(r.id)!.streak))}::int[]) as v(id, streak)
      where p.id = v.id`;
  }
  return out;
}

/** Riempitivo (tormentoni, scenette): raro, mai sull'ultima domanda del round, distanza minima. */
const FILLER_PERCENT = 25;
const FILLER_GAP_MS = 240_000;

export async function directAfterScore(tx: Tx, sessionId: string, sqId: string): Promise<ShowLine[]> {
  // il contatore delle mancate risposte vale anche con i commenti spenti
  const silence = await updateNoAnswerStreaks(tx, sessionId, sqId);
  const config = await loadDirectorConfig(tx);
  if (!config.enabled) {
    await tx`update game_state set show_lines = '[]'::jsonb where session_id = ${sessionId}`;
    return [];
  }
  const templates = await ensureLibrary(tx);

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

  const people = await tx<{ id: string; nickname: string; points: number; team_id: string | null; rank: number | null; gender: "m" | "f" | null }[]>`
    select p.id, p.nickname, t.points, p.team_id, t.rank, p.gender from participants p join score_totals t on t.participant_id = p.id
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
      gender: p.gender,
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

  // ultima domanda del round / della serata (nessun round ancora da giocare dopo questo)
  const { roundId, endOfRound, moment } = await questionPosition(tx, sessionId, sqId);
  const pos = roundId ? { round_id: roundId } : null;
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
  const h = await loadHistory(tx, sessionId, pos?.round_id ?? null);

  // mancate risposte (verificate dal server a tempo scaduto): al massimo un evento per domanda
  if (config.noAnswerLines) {
    const mocked = await tx<{ pid: string; at: Date }[]>`
      select pid, max(created_at) as at from show_dialogue_log, unnest(participant_ids) as pid
      where session_id = ${sessionId} and event_type = any(${tx.array([...NO_ANSWER_EVENT_TYPES])}::text[])
      group by pid`;
    const teamRows = teamsEnabled(ts.mode) ? await tx<{ id: string; name: string }[]>`select id, name from teams where session_id = ${sessionId} order by position` : [];
    const ev = noAnswerEvent({
      players: people.map(
        (p): NoAnswerPlayer => ({
          id: p.id,
          nickname: p.nickname,
          gender: p.gender,
          inPlay: current.has(p.id),
          answered: current.get(p.id)?.kind === "answer",
          connected: silence.get(p.id)?.connected ?? false,
          rank: p.rank,
          points: p.points,
          streak: silence.get(p.id)?.streak ?? 0,
          teamId: p.team_id,
        }),
      ),
      mode: ts.mode,
      teams: teamRows,
      lastMocked: new Map(mocked.map((m) => [m.pid, m.at.getTime()])),
      nowMs: h.nowMs,
      seed: sqId,
    });
    if (ev) events.push(ev);
  }
  // riempitivo raro nei momenti tranquilli (mai sull'ultima domanda del round)
  if (!endOfRound) {
    const [{ last }] = await tx<{ last: Date | null }[]>`
      select max(created_at) as last from show_dialogue_log where session_id = ${sessionId} and event_type = 'FILLER'`;
    if ((!last || h.nowMs - last.getTime() >= FILLER_GAP_MS) && chance(`${sqId}|riempitivo`, FILLER_PERCENT)) events.push({ type: "FILLER" });
  }
  const facts = await questionFacts(tx, sqId);

  const lines = directShow({
    events,
    templates,
    history: { lastUsed: h.lastUsed, mentionsThisRound: h.mentionsThisRound },
    config,
    nowMs: h.nowMs,
    seed: sqId,
    moment,
    ctx: { mode: ts.mode, timerSeconds: facts.timerSeconds, difficulty: facts.difficulty, fourOptions: facts.fourOptions, moment },
    elsewhere: h.elsewhere,
    lastSceneMs: h.lastSceneMs,
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
    const pub: PublicShowLine = { who: l.who, text: l.text, animation: l.animation, event: l.event, id: String(row.id) };
    if (l.display !== undefined) pub.display = l.display;
    if (l.live !== undefined) pub.live = l.live;
    if (l.optional) pub.optional = true;
    if (l.group) pub.group = l.group;
    if (l.tags?.length) pub.tags = l.tags;
    out.push(pub);
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
  const templates = await ensureLibrary(tx);
  const h = await loadHistory(tx, sessionId, at.roundId);
  const lines = directShow({
    events: [event],
    templates,
    history: { lastUsed: h.lastUsed, mentionsThisRound: h.mentionsThisRound },
    // un momento = una battuta sola (voce breve, costo contenuto)
    config: { ...config, maxLines: Math.min(1, config.maxLines) },
    nowMs: h.nowMs,
    seed: at.seed,
    elsewhere: h.elsewhere,
    // saluti e inizio finale: mai una scenetta
    lastSceneMs: h.nowMs,
  });
  return logLines(tx, sessionId, lines, { sqId: null, roundId: at.roundId });
}

// ---------------------------------------------------------------------------
// Libreria ufficiale: momenti a sé (dentro la transazione del comando, in un savepoint)
// ---------------------------------------------------------------------------
/** Prepara la regia di un momento: configurazione, libreria e storia (null = regia spenta). */
async function prepareMoment(tx: Tx, sessionId: string, roundId: string | null) {
  const config = await loadDirectorConfig(tx);
  if (!config.enabled) return null;
  const templates = await ensureLibrary(tx);
  const h = await loadHistory(tx, sessionId, roundId);
  return { config, templates, h };
}

/**
 * Risposte aperte (SHOW_OPTIONS): a volte (raramente) una battuta sul tempo che scade. Il TV la dice
 * solo negli ultimi secondi, solo se non hanno risposto tutti e mai sopra un'altra voce
 * (timeLineDue); mai sulle domande con audio o video. "Trenta secondi" solo con il timer da 30.
 */
export async function directOptionsOpen(tx: Tx, sessionId: string, sqId: string): Promise<PublicShowLine[]> {
  const facts = await questionFacts(tx, sqId);
  let pub: PublicShowLine[] = [];
  if (!facts.media && chance(`${sqId}|tempo`, TIME_LINE_PERCENT)) {
    const { roundId, moment } = await questionPosition(tx, sessionId, sqId);
    const m = await prepareMoment(tx, sessionId, roundId);
    if (m) {
      const ts = await teamModeOf(tx, sessionId);
      const lines = momentLines(m.config, m.templates, m.h, { type: "TIME_RUNNING_OUT", durationSeconds: facts.timerSeconds ?? 0 }, sqId, {
        mode: ts.mode,
        timerSeconds: facts.timerSeconds,
        difficulty: facts.difficulty,
        fourOptions: facts.fourOptions,
        moment,
        // chi non ha ancora risposto: non si sa ancora, la battuta vale per il gruppo
        group: null,
      }, { scenes: false });
      pub = await logLines(tx, sessionId, lines, { sqId, roundId });
    }
  }
  await publishLines(tx, sessionId, pub.length ? pub : null);
  return pub;
}

/**
 * Soluzione (REVEAL): reazione all'esito VERO della domanda (sbagliata, sbagliata su una domanda
 * facilissima, indovinata, perdere la pazienza), al posto della battuta di sempre. Niente nomi.
 */
export async function directAfterReveal(tx: Tx, sessionId: string, sqId: string): Promise<PublicShowLine[]> {
  const [q] = await tx<{ players: number; answered: number; right: number; close: Date | null }[]>`
    select
      (select count(*)::int from participants p where p.session_id = ${sessionId} and p.status = 'active'
         and p.joined_at <= coalesce(sq.answers_closed_at, sq.answers_close_at, clock_timestamp())) as players,
      (select count(*)::int from answer_submissions a where a.session_question_id = sq.id) as answered,
      (select count(*)::int from answer_submissions a where a.session_question_id = sq.id and a.is_correct) as right,
      sq.answers_close_at as close
    from session_questions sq where sq.id = ${sqId}`;
  const facts = await questionFacts(tx, sqId);
  const choice = q ? revealChoice({ players: q.players, answered: q.answered, right: q.right, difficulty: facts.difficulty, fourOptions: facts.fourOptions }, sqId) : null;
  let pub: PublicShowLine[] = [];
  if (choice) {
    const { roundId, moment } = await questionPosition(tx, sessionId, sqId);
    const m = await prepareMoment(tx, sessionId, roundId);
    if (m) {
      const ts = await teamModeOf(tx, sessionId);
      const lines = momentLines(m.config, m.templates, m.h, choice.event, sqId, { ...choice.ctx, mode: ts.mode, timerSeconds: facts.timerSeconds, moment });
      pub = await logLines(tx, sessionId, lines, { sqId, roundId });
    }
  }
  await publishLines(tx, sessionId, pub.length ? pub : null);
  return pub;
}

/** Probabilità della battuta di Palmino sulla classifica generale. */
const LEADERBOARD_QUIP_PERCENT = 50;

/** Classifica generale (SHOW_LEADERBOARD): a volte Palmino commenta (dopo la lettura della Regina). */
export async function directLeaderboard(tx: Tx, sessionId: string, roundId: string | null, seed: string): Promise<PublicShowLine[]> {
  let pub: PublicShowLine[] = [];
  if (chance(`${seed}|classifica`, LEADERBOARD_QUIP_PERCENT)) {
    const m = await prepareMoment(tx, sessionId, roundId);
    if (m) {
      const ts = await teamModeOf(tx, sessionId);
      const [{ comeback }] = await tx<{ comeback: boolean }[]>`
        select exists (select 1 from show_dialogue_log where session_id = ${sessionId} and round_id is not distinct from ${roundId}
                         and event_type in ('COMEBACK', 'OVERTAKE')) as comeback`;
      const lines = momentLines(m.config, m.templates, m.h, { type: "LEADERBOARD_QUIP" }, `${seed}|classifica`, { mode: ts.mode, comeback }, { scenes: false, prefer: "palmino" });
      pub = await logLines(tx, sessionId, lines, { sqId: null, roundId });
    }
  }
  await publishLines(tx, sessionId, pub.length ? pub : null);
  return pub;
}

/**
 * Ruota di Palmino (SHOW_QUESTION → WHEEL_SPIN): una battuta "Durante la ruota" di UN presentatore,
 * pesata e senza ripetizioni come le altre. Il TV la dice dopo l'arrivo di Palmino e SOLO se finisce
 * prima che la ruota si fermi (mai sopra "Tocca a… X!"); se la voce non è pronta si salta.
 */
export async function directPalminoWheel(tx: Tx, sessionId: string, roundId: string, seed: string): Promise<PublicShowLine[]> {
  const m = await prepareMoment(tx, sessionId, roundId);
  let pub: PublicShowLine[] = [];
  if (m && eventAllowed(m.config, "WHEEL_SPIN")) {
    const ts = await teamModeOf(tx, sessionId);
    const lines = pickWheelLines({
      templates: m.templates,
      comedyLevel: m.config.comedyLevel,
      seed,
      nowMs: m.h.nowMs,
      lastUsed: m.h.lastUsed,
      elsewhere: m.h.elsewhere,
      mode: ts.mode,
      // qualsiasi presentatore (Palmino ha già detto la sua arrivando)
      first: null,
      max: 1,
    });
    pub = await logLines(tx, sessionId, lines, { sqId: null, roundId });
  }
  await publishLines(tx, sessionId, pub.length ? pub : null);
  return pub;
}

/** Probabilità della scenetta di chiusura al podio. */
const GAME_END_SCENE_PERCENT = 70;

/**
 * Podio (FINISH): la battuta sul vincitore della serata e la scenetta finale. Il TV le dice SOLO dopo
 * che il nome del vincitore è stato rivelato col rullo (vedi podiumPlan): mai prima.
 * Squadre ("teams"): il vincitore è la squadra. Pari merito: niente battuta sul vincitore (sono al singolare).
 */
export async function directFinish(tx: Tx, sessionId: string): Promise<PublicShowLine[]> {
  const m = await prepareMoment(tx, sessionId, null);
  let pub: PublicShowLine[] = [];
  if (m) {
    const ts = await teamModeOf(tx, sessionId);
    let top: { id: string; name: string; points: number; gender?: "m" | "f" | null }[];
    if (ts.mode === "teams") {
      const { standings } = await computeSessionTeamStandings(tx, sessionId, ts.aggregation);
      top = standings.filter((t) => t.rank === 1).map((t) => ({ id: t.teamId, name: t.name, points: t.points }));
    } else {
      top = await tx<{ id: string; name: string; points: number }[]>`
        select p.id, p.nickname as name, t.points, p.gender from participants p join score_totals t on t.participant_id = p.id
        where p.session_id = ${sessionId} and p.status = 'active' and t.rank = 1`;
    }
    const ctx: LineContext = { mode: ts.mode, moment: { lastOfRound: true, lastOfGame: true } };
    const end = chance(`${sessionId}|finale`, GAME_END_SCENE_PERCENT) ? momentLines(m.config, m.templates, m.h, { type: "GAME_END" }, sessionId, ctx, { scenes: true }) : [];
    let winner: ShowLine[] = [];
    if (top.length === 1 && top[0].points > 0) {
      const w = top[0];
      // squadra: gender null → variante neutra (mai "sei stato" a una squadra)
      winner = momentLines(m.config, m.templates, m.h, { type: "GAME_WINNER", winner: { id: w.id, name: w.name, gender: w.gender ?? null } }, sessionId, ctx, {
        scenes: false,
        mentions: ts.mode === "teams" ? [] : [w.id],
        // la scenetta finale dice già "La conoscenza ha trionfato!": niente doppione
        filter: end.length ? (t) => !/conoscenza ha/i.test(t.text) : undefined,
      });
    }
    pub = await logLines(tx, sessionId, [...winner, ...end], { sqId: null, roundId: null });
  }
  await publishLines(tx, sessionId, pub.length ? pub : null);
  return pub;
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
