import { randomInt } from "node:crypto";
import { getSql, iso, num, type Db, type Tx } from "@/lib/database/db";
import { eventRoundKind, isCategoryRound, maxCategories, MIN_CATEGORIES, type BetTier, type GamePhase, type Presenter, type QuestionType, type RoundKind, type SessionStatus } from "@/lib/game-engine/types";
import {
  roundInputSchema,
  sessionInputSchema,
  sessionSettingsSchema,
  specialEventScheduleSchema,
  type RoundInput,
  type SessionSettings,
} from "@/lib/validation/schemas";
import type { z } from "zod";
import { audit, CmsError } from "../audit";
import type { Actor } from "../engine";
import { effectiveSettings, loadGlobalSettings, teamSettingsOf } from "../settings";
import { MAX_TEAMS, MIN_TEAMS, teamsEnabled } from "@/lib/game-engine/teams";
import { rebroadcast } from "../engine";
import { copyTeams } from "./teams";

type SessionInput = z.output<typeof sessionInputSchema>;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateSessionCode(len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return s;
}

async function uniqueCode(db: Db): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateSessionCode();
    const [r] = await db`select 1 from game_sessions where code = ${code}`;
    if (!r) return code;
  }
  throw new CmsError("Impossibile generare un codice sessione", 500);
}

// ---------------------------------------------------------------------------
// Tipi restituiti al pannello
// ---------------------------------------------------------------------------
export interface SessionSummary {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  status: SessionStatus;
  code: string;
  isTest: boolean;
  phase: GamePhase | null;
  rounds: number;
  questions: number;
  participants: number;
  online: number;
  publishedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface SessionQuestionItem {
  id: string;
  position: number;
  questionId: string | null;
  voteOptionId: string | null;
  isReserve: boolean;
  text: string;
  category: string;
  type: QuestionType;
  difficulty: number;
  presenter: Presenter;
  status: string | null;
  answerConfirmed: boolean;
  mediaKind: string | null;
  mediaId: string | null;
  options: { position: number; text: string; isCorrect: boolean }[];
  durationSeconds: number | null;
  shownAt: string | null;
  scoredAt: string | null;
  scheduledEvent: { id: string; key: string; title: string; status: string } | null;
  fromSnapshot: boolean;
}

export interface RoundDetail {
  id: string;
  position: number;
  title: string;
  kind: RoundKind;
  presenter: Presenter;
  description: string | null;
  pointsMultiplier: number;
  penaltyMultiplier: number;
  noPenalty: boolean;
  correctPoints: number | null;
  wrongPenalty: number | null;
  durationSeconds: number | null;
  speedBonusMax: number;
  voteDurationSeconds: number;
  voteTieBreak: "random" | "admin" | "first";
  voteLiveResults: boolean;
  voteOptions: { id: string; position: number; label: string; questions: number }[];
  /** Scommetti tutto: puntata minima e quota predefinita per chi non sceglie. */
  betMinStake: number;
  betDefaultTier: BetTier;
  /** Grande ribaltone: BOOST di chi insegue e penalità del capolista (1 = spento). */
  comebackMultiplier: number;
  comebackLeaderPenalty: number;
  winningOptionId: string | null;
  startedAt: string | null;
  questions: SessionQuestionItem[];
}

export interface SessionDetail extends SessionSummary {
  settings: SessionSettings;
  displayKey: string;
  seasonId: string | null;
  roundsDetail: RoundDetail[];
}

export async function listSessions(opts: { status?: string; includeArchived?: boolean } = {}): Promise<SessionSummary[]> {
  const sql = getSql();
  const rows = await sql<
    {
      id: string;
      title: string;
      description: string | null;
      scheduled_at: Date | null;
      status: SessionStatus;
      code: string;
      is_test: boolean;
      phase: GamePhase | null;
      rounds: number;
      questions: number;
      participants: number;
      online: number;
      published_at: Date | null;
      started_at: Date | null;
      finished_at: Date | null;
      created_at: Date;
    }[]
  >`
    select s.id, s.title, s.description, s.scheduled_at, s.status, s.code, s.is_test, gs.phase,
      (select count(*)::int from game_rounds r where r.session_id = s.id) as rounds,
      (select count(*)::int from session_questions q where q.session_id = s.id and not q.is_reserve) as questions,
      (select count(*)::int from participants p where p.session_id = s.id and p.status = 'active' and not p.is_bot) as participants,
      (select count(*)::int from participants p where p.session_id = s.id and p.status = 'active' and not p.is_bot
         and p.last_seen_at > now() - interval '60 seconds') as online,
      s.published_at, s.started_at, s.finished_at, s.created_at
    from game_sessions s left join game_state gs on gs.session_id = s.id
    where ${opts.status ? sql`s.status = ${opts.status}::session_status` : opts.includeArchived ? sql`true` : sql`s.status <> 'archived'`}
    order by coalesce(s.scheduled_at, s.created_at) desc`;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    scheduledAt: iso(r.scheduled_at),
    status: r.status,
    code: r.code,
    isTest: r.is_test,
    phase: r.phase,
    rounds: r.rounds,
    questions: r.questions,
    participants: r.participants,
    online: r.online,
    publishedAt: iso(r.published_at),
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
    createdAt: iso(r.created_at)!,
  }));
}

export async function getSessionDetail(db: Db, id: string): Promise<SessionDetail | null> {
  const [s] = await db<
    {
      id: string;
      title: string;
      description: string | null;
      scheduled_at: Date | null;
      status: SessionStatus;
      code: string;
      is_test: boolean;
      display_key: string;
      season_id: string | null;
      settings: SessionSettings;
      phase: GamePhase | null;
      published_at: Date | null;
      started_at: Date | null;
      finished_at: Date | null;
      created_at: Date;
      participants: number;
      online: number;
    }[]
  >`
    select s.*, gs.phase,
      (select count(*)::int from participants p where p.session_id = s.id and p.status = 'active' and not p.is_bot) as participants,
      (select count(*)::int from participants p where p.session_id = s.id and p.status = 'active' and not p.is_bot
         and p.last_seen_at > now() - interval '60 seconds') as online
    from game_sessions s left join game_state gs on gs.session_id = s.id where s.id = ${id}`;
  if (!s) return null;

  const rounds = await db<
    {
      id: string;
      position: number;
      title: string;
      kind: RoundKind;
      presenter: Presenter;
      description: string | null;
      points_multiplier: string;
      penalty_multiplier: string;
      no_penalty: boolean;
      correct_points: number | null;
      wrong_penalty: number | null;
      duration_seconds: number | null;
      speed_bonus_max: number;
      vote_duration_seconds: number;
      vote_tie_break: "random" | "admin" | "first";
      vote_live_results: boolean;
      bet_min_stake: number;
      bet_default_tier: BetTier;
      comeback_multiplier: string;
      comeback_leader_penalty: string;
      winning_option_id: string | null;
      started_at: Date | null;
    }[]
  >`select * from game_rounds where session_id = ${id} order by position`;

  const voteOptions = await db<{ id: string; round_id: string; position: number; label: string; questions: number }[]>`
    select o.id, o.round_id, o.position, o.label,
      (select count(*)::int from session_questions q where q.vote_option_id = o.id) as questions
    from category_vote_options o join game_rounds r on r.id = o.round_id
    where r.session_id = ${id} order by o.position`;

  // Per le sessioni pubblicate si mostra lo snapshot congelato, non il template.
  const questions = await db<
    {
      id: string;
      round_id: string;
      position: number;
      question_id: string | null;
      vote_option_id: string | null;
      is_reserve: boolean;
      shown_at: Date | null;
      scored_at: Date | null;
      text: string | null;
      category: string | null;
      type: QuestionType | null;
      difficulty: number | null;
      presenter: Presenter | null;
      status: string | null;
      answer_confirmed: boolean | null;
      media_kind: string | null;
      media_id: string | null;
      duration_seconds: number | null;
      options: { position: number; text: string; isCorrect: boolean }[] | null;
      from_snapshot: boolean;
      ev_id: string | null;
      ev_key: string | null;
      ev_title: string | null;
      ev_status: string | null;
    }[]
  >`
    select sq.id, sq.round_id, sq.position, sq.question_id, sq.vote_option_id, sq.is_reserve, sq.shown_at, sq.scored_at,
      coalesce(qs.text, qb.text) as text, coalesce(qs.category, qb.category) as category,
      coalesce(qs.type, qb.type) as type, coalesce(qs.difficulty, qb.difficulty) as difficulty,
      coalesce(qs.presenter, qb.presenter) as presenter, qb.status::text as status, qb.answer_confirmed,
      coalesce(qs.media_kind, m.kind)::text as media_kind, coalesce(qs.media_id, qb.media_id) as media_id,
      coalesce(qs.duration_seconds, qb.duration_seconds) as duration_seconds,
      case when qs.session_question_id is not null then
        (select json_agg(json_build_object('position', (o->>'position')::int, 'text', o->>'text',
                 'isCorrect', ((o->>'position')::smallint = any(qs.correct_positions))) order by (o->>'position')::int)
         from jsonb_array_elements(qs.options) o)
      else
        (select json_agg(json_build_object('position', o.position, 'text', o.text, 'isCorrect', o.is_correct) order by o.position)
         from question_options o where o.question_id = qb.id)
      end as options,
      qs.session_question_id is not null as from_snapshot,
      ev.id as ev_id, d.key as ev_key, ev.title as ev_title, ev.status as ev_status
    from session_questions sq
    left join question_snapshots qs on qs.session_question_id = sq.id
    left join question_bank qb on qb.id = sq.question_id
    left join media_assets m on m.id = qb.media_id
    left join lateral (select * from special_events e where e.target_session_question_id = sq.id and e.source = 'scheduled'
                       order by e.created_at limit 1) ev on true
    left join special_event_definitions d on d.id = ev.definition_id
    where sq.session_id = ${id}
    order by sq.position`;

  const roundsDetail: RoundDetail[] = rounds.map((r) => ({
    id: r.id,
    position: r.position,
    title: r.title,
    kind: r.kind,
    presenter: r.presenter,
    description: r.description,
    pointsMultiplier: num(r.points_multiplier),
    penaltyMultiplier: num(r.penalty_multiplier),
    noPenalty: r.no_penalty,
    correctPoints: r.correct_points,
    wrongPenalty: r.wrong_penalty,
    durationSeconds: r.duration_seconds,
    speedBonusMax: r.speed_bonus_max,
    voteDurationSeconds: r.vote_duration_seconds,
    voteTieBreak: r.vote_tie_break,
    voteLiveResults: r.vote_live_results,
    voteOptions: voteOptions.filter((o) => o.round_id === r.id).map((o) => ({ id: o.id, position: o.position, label: o.label, questions: o.questions })),
    betMinStake: r.bet_min_stake,
    betDefaultTier: r.bet_default_tier,
    comebackMultiplier: num(r.comeback_multiplier),
    comebackLeaderPenalty: num(r.comeback_leader_penalty),
    winningOptionId: r.winning_option_id,
    startedAt: iso(r.started_at),
    questions: questions
      .filter((q) => q.round_id === r.id)
      .map((q) => ({
        id: q.id,
        position: q.position,
        questionId: q.question_id,
        voteOptionId: q.vote_option_id,
        isReserve: q.is_reserve,
        text: q.text ?? "(domanda eliminata dall'archivio)",
        category: q.category ?? "-",
        type: q.type ?? "single",
        difficulty: q.difficulty ?? 0,
        presenter: q.presenter ?? "professore",
        status: q.status,
        answerConfirmed: q.answer_confirmed ?? false,
        mediaKind: q.media_kind,
        mediaId: q.media_id,
        options: q.options ?? [],
        durationSeconds: q.duration_seconds,
        shownAt: iso(q.shown_at),
        scoredAt: iso(q.scored_at),
        scheduledEvent: q.ev_id ? { id: q.ev_id, key: q.ev_key ?? "", title: q.ev_title ?? "", status: q.ev_status ?? "" } : null,
        fromSnapshot: q.from_snapshot,
      })),
  }));

  return {
    id: s.id,
    title: s.title,
    description: s.description,
    scheduledAt: iso(s.scheduled_at),
    status: s.status,
    code: s.code,
    isTest: s.is_test,
    phase: s.phase,
    rounds: rounds.length,
    questions: questions.filter((q) => !q.is_reserve).length,
    participants: s.participants,
    online: s.online,
    publishedAt: iso(s.published_at),
    startedAt: iso(s.started_at),
    finishedAt: iso(s.finished_at),
    createdAt: iso(s.created_at)!,
    settings: s.settings,
    displayKey: s.display_key,
    seasonId: s.season_id,
    roundsDetail,
  };
}

/** Unisce le impostazioni: un valore null rimuove l'override (torna al valore globale). */
function mergeSettings(current: SessionSettings, patch: Record<string, unknown>): SessionSettings {
  const out: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else if (v !== undefined) out[k] = v;
  }
  return out as SessionSettings;
}

async function requireDraft(db: Db, sessionId: string) {
  const [s] = await db<{ status: SessionStatus }[]>`select status from game_sessions where id = ${sessionId}`;
  if (!s) throw new CmsError("Sessione non trovata", 404);
  if (s.status !== "draft") throw new CmsError("La sessione è pubblicata: per modificarla annulla prima la pubblicazione", 409);
}

// ---------------------------------------------------------------------------
// Sessioni
// ---------------------------------------------------------------------------
export async function createSession(raw: unknown, actor: Actor): Promise<string> {
  const p = sessionInputSchema.safeParse(raw);
  if (!p.success) throw new CmsError("Dati sessione non validi", 422, p.error.issues);
  const sql = getSql();
  return sql.begin((tx) => insertSession(tx, p.data, actor));
}

/** Crea la sessione dentro una transazione già aperta (usato anche dalla serata rapida). */
export async function insertSession(tx: Tx, data: SessionInput, actor: Actor, details?: Record<string, unknown>): Promise<string> {
  const code = await uniqueCode(tx);
  const [row] = await tx<{ id: string }[]>`
    insert into game_sessions (title, description, scheduled_at, is_test, season_id, settings, code, created_by)
    values (${data.title}, ${data.description ?? null}, ${data.scheduledAt ?? null}, ${data.isTest},
            ${data.seasonId ?? null}, ${tx.json(mergeSettings({}, data.settings))}, ${code}, ${actor.userId})
    returning id`;
  await audit(tx, actor, "session.create", { sessionId: row.id, type: "session", id: row.id, details });
  return row.id;
}

/** Titolo, descrizione, data e impostazioni sono modificabili anche dopo la pubblicazione (registrato). */
export async function updateSession(id: string, raw: unknown, actor: Actor): Promise<void> {
  const p = sessionInputSchema.partial().safeParse(raw);
  if (!p.success) throw new CmsError("Dati sessione non validi", 422, p.error.issues);
  // con .partial() zod applica comunque i valori predefiniti (isTest: false, settings: {}):
  // si considerano solo i campi davvero inviati
  const sent = raw && typeof raw === "object" ? new Set(Object.keys(raw)) : new Set<string>();
  const d = Object.fromEntries(Object.entries(p.data).filter(([k]) => sent.has(k))) as typeof p.data;
  const sql = getSql();
  const status = await sql.begin(async (tx) => {
    const [s] = await tx<{ status: SessionStatus; settings: SessionSettings; is_test: boolean }[]>`
      select status, settings, is_test from game_sessions where id = ${id} for update`;
    if (!s) throw new CmsError("Sessione non trovata", 404);
    if (s.status === "archived") throw new CmsError("Sessione archiviata", 409);
    if (d.isTest !== undefined && d.isTest !== s.is_test && s.status !== "draft") throw new CmsError("La modalità prova si sceglie prima della pubblicazione", 409);
    if (d.settings && s.status !== "draft") {
      const scoringKeys = ["correctPoints", "wrongPenalty", "noAnswerPenalty", "durationSeconds"] as const;
      if (scoringKeys.some((k) => d.settings?.[k] !== undefined && d.settings[k] !== s.settings[k])) {
        throw new CmsError("Punteggi e tempi sono congelati alla pubblicazione", 409);
      }
    }
    // modalità squadre su una serata già pubblicata: le squadre devono esserci già (2–8)
    if (d.settings?.teams && teamsEnabled(d.settings.teams.mode) && s.status !== "draft") {
      if (s.status === "finished") throw new CmsError("La serata è conclusa: la modalità squadre non si cambia più", 409);
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from teams where session_id = ${id}`;
      if (n < MIN_TEAMS || n > MAX_TEAMS) throw new CmsError(`Per giocare a squadre servono da ${MIN_TEAMS} a ${MAX_TEAMS} squadre`, 409);
    }
    await tx`
      update game_sessions set
        title = coalesce(${d.title ?? null}, title),
        description = ${d.description === undefined ? tx`description` : d.description},
        scheduled_at = ${d.scheduledAt === undefined ? tx`scheduled_at` : d.scheduledAt},
        season_id = ${d.seasonId === undefined ? tx`season_id` : d.seasonId},
        is_test = coalesce(${d.isTest ?? null}::boolean, is_test),
        settings = ${d.settings ? tx.json(mergeSettings(s.settings, d.settings)) : tx`settings`}
      where id = ${id}`;
    await audit(tx, actor, "session.update", { sessionId: id, type: "session", id, details: d as Record<string, unknown> });
    return s.status;
  });
  // cambio della modalità squadre a serata pubblicata: TV e telefoni si aggiornano subito
  if (d.settings?.teams !== undefined && status !== "draft") {
    try {
      await rebroadcast(id);
    } catch (e) {
      console.warn("[quizzone] aggiornamento modalità squadre non trasmesso", e instanceof Error ? e.message : e);
    }
  }
}

export async function deleteSession(id: string, actor: Actor): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [s] = await tx<{ status: SessionStatus; is_test: boolean }[]>`select status, is_test from game_sessions where id = ${id}`;
    if (!s) throw new CmsError("Sessione non trovata", 404);
    if (s.status !== "draft" && !s.is_test) {
      throw new CmsError("Le sessioni reali pubblicate non si eliminano: archiviale", 409);
    }
    await tx`select set_config('qz.allow_reset', 'on', true)`;
    await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
    await audit(tx, actor, "session.delete", { type: "session", id });
    await tx`delete from game_sessions where id = ${id}`;
  });
}

export async function duplicateSession(id: string, actor: Actor, opts: { title?: string; isTest?: boolean } = {}): Promise<string> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [s] = await tx<{ title: string; description: string | null; is_test: boolean; season_id: string | null; settings: SessionSettings }[]>`
      select title, description, is_test, season_id, settings from game_sessions where id = ${id}`;
    if (!s) throw new CmsError("Sessione non trovata", 404);
    const code = await uniqueCode(tx);
    const settings = { ...s.settings };
    delete settings.joinLocked;
    const [n] = await tx<{ id: string }[]>`
      insert into game_sessions (title, description, is_test, season_id, settings, code, source_session_id, created_by)
      values (${(opts.title ?? `${s.title} (copia)`).slice(0, 120)}, ${s.description}, ${opts.isTest ?? s.is_test},
              ${s.season_id}, ${tx.json(settings)}, ${code}, ${id}, ${actor.userId})
      returning id`;
    const roundMap = new Map<string, string>();
    const optMap = new Map<string, string>();
    const sqMap = new Map<string, string>();
    const rounds = await tx<{ id: string }[]>`select id from game_rounds where session_id = ${id} order by position`;
    for (const r of rounds) {
      const [nr] = await tx<{ id: string }[]>`
        insert into game_rounds (session_id, position, title, kind, presenter, description, points_multiplier, penalty_multiplier,
          no_penalty, correct_points, wrong_penalty, duration_seconds, speed_bonus_max, vote_duration_seconds, vote_tie_break, vote_live_results,
          bet_min_stake, bet_default_tier, comeback_multiplier, comeback_leader_penalty)
        select ${n.id}, position, title, kind, presenter, description, points_multiplier, penalty_multiplier, no_penalty,
          correct_points, wrong_penalty, duration_seconds, speed_bonus_max, vote_duration_seconds, vote_tie_break, vote_live_results,
          bet_min_stake, bet_default_tier, comeback_multiplier, comeback_leader_penalty
        from game_rounds where id = ${r.id} returning id`;
      roundMap.set(r.id, nr.id);
      const opts2 = await tx<{ id: string; position: number; label: string }[]>`select id, position, label from category_vote_options where round_id = ${r.id}`;
      for (const o of opts2) {
        const [no] = await tx<{ id: string }[]>`
          insert into category_vote_options (round_id, position, label) values (${nr.id}, ${o.position}, ${o.label}) returning id`;
        optMap.set(o.id, no.id);
      }
    }
    // la scaletta a tempo è indicizzata per id round: si riporta sui round copiati
    const ro = settings.runningOrder;
    if (ro?.rounds) {
      const rounds2: NonNullable<typeof ro.rounds> = {};
      for (const [oldId, v] of Object.entries(ro.rounds)) {
        const nid = roundMap.get(oldId);
        if (nid) rounds2[nid] = v;
      }
      await tx`update game_sessions set settings = ${tx.json({ ...settings, runningOrder: { ...ro, rounds: rounds2 } })} where id = ${n.id}`;
    }
    const sqs = await tx<{ id: string; round_id: string; position: number; question_id: string | null; vote_option_id: string | null; is_reserve: boolean }[]>`
      select id, round_id, position, question_id, vote_option_id, is_reserve from session_questions where session_id = ${id}`;
    for (const q of sqs) {
      if (!q.question_id) continue; // domanda eliminata dall'archivio: non duplicabile
      const [nq] = await tx<{ id: string }[]>`
        insert into session_questions (session_id, round_id, position, question_id, vote_option_id, is_reserve)
        values (${n.id}, ${roundMap.get(q.round_id)!}, ${q.position}, ${q.question_id},
                ${q.vote_option_id ? (optMap.get(q.vote_option_id) ?? null) : null}, ${q.is_reserve})
        returning id`;
      sqMap.set(q.id, nq.id);
    }
    const evs = await tx<{ definition_id: string; type: string; title: string; tagline: string; params: Record<string, number>; target: string | null }[]>`
      select definition_id, type::text, title, tagline, params, target_session_question_id as target
      from special_events where session_id = ${id} and source = 'scheduled'`;
    for (const e of evs) {
      const t = e.target ? sqMap.get(e.target) : undefined;
      if (!t) continue;
      await tx`
        insert into special_events (session_id, definition_id, type, title, tagline, params, target_session_question_id, status, source, created_by)
        values (${n.id}, ${e.definition_id}, ${e.type}::special_event_type, ${e.title}, ${e.tagline}, ${tx.json(e.params)}, ${t}, 'scheduled', 'scheduled', ${actor.userId})`;
    }
    await copyTeams(tx, id, n.id);
    await audit(tx, actor, "session.duplicate", { sessionId: n.id, type: "session", id: n.id, details: { from: id } });
    return n.id;
  });
}

// ---------------------------------------------------------------------------
// Pubblicazione: validazione + snapshot congelato
// ---------------------------------------------------------------------------
export interface PublishIssue {
  level: "error" | "warning";
  message: string;
  roundId?: string;
  sessionQuestionId?: string;
}

export async function validateForPublish(db: Db, sessionId: string): Promise<PublishIssue[]> {
  const detail = await getSessionDetail(db, sessionId);
  if (!detail) throw new CmsError("Sessione non trovata", 404);
  const issues: PublishIssue[] = [];
  if (detail.roundsDetail.length === 0) issues.push({ level: "error", message: "Aggiungi almeno un round" });
  for (const r of detail.roundsDetail) {
    const playable = r.questions.filter((q) => !q.isReserve);
    if (isCategoryRound(r.kind)) {
      const what = r.kind === "category_wheel" ? "sulla ruota" : "votabili";
      if (r.voteOptions.length < MIN_CATEGORIES) issues.push({ level: "error", roundId: r.id, message: `Round "${r.title}": servono almeno ${MIN_CATEGORIES} categorie ${what}` });
      if (r.voteOptions.length > maxCategories(r.kind)) issues.push({ level: "error", roundId: r.id, message: `Round "${r.title}": al massimo ${maxCategories(r.kind)} categorie ${what}` });
      for (const o of r.voteOptions) {
        const n = playable.filter((q) => q.voteOptionId === o.id).length;
        if (n === 0) issues.push({ level: "error", roundId: r.id, message: `Round "${r.title}": la categoria "${o.label}" non ha domande pronte` });
      }
      const orphan = playable.filter((q) => !q.voteOptionId);
      if (orphan.length > 0) issues.push({ level: "error", roundId: r.id, message: `Round "${r.title}": ${orphan.length} domande non sono assegnate a una categoria` });
    } else if (playable.length === 0) {
      issues.push({ level: "error", roundId: r.id, message: `Round "${r.title}": nessuna domanda` });
    }
    issues.push(...specialRoundIssues(r, detail.roundsDetail[0]?.id === r.id));
    for (const q of r.questions) {
      if (!q.questionId) {
        issues.push({ level: "error", sessionQuestionId: q.id, message: `Round "${r.title}": una domanda è stata eliminata dall'archivio` });
        continue;
      }
      if (!q.answerConfirmed) issues.push({ level: "error", sessionQuestionId: q.id, message: `"${q.text.slice(0, 60)}": risposta corretta non confermata` });
      if (q.status !== "approved") issues.push({ level: "error", sessionQuestionId: q.id, message: `"${q.text.slice(0, 60)}": domanda non approvata` });
      if (r.kind === "music" && q.mediaKind !== "audio") issues.push({ level: "warning", sessionQuestionId: q.id, message: `"${q.text.slice(0, 60)}": round musicale senza audio` });
    }
  }
  const ts = teamSettingsOf(detail.settings);
  if (teamsEnabled(ts.mode)) {
    const [{ n }] = await db<{ n: number }[]>`select count(*)::int as n from teams where session_id = ${sessionId}`;
    if (n < MIN_TEAMS) issues.push({ level: "error", message: `Serata a squadre: crea almeno ${MIN_TEAMS} squadre (ora ${n})` });
    if (n > MAX_TEAMS) issues.push({ level: "error", message: `Serata a squadre: al massimo ${MAX_TEAMS} squadre (ora ${n})` });
  }
  return issues;
}

/** Controlli delle manche speciali (Scommetti tutto, Grande ribaltone). */
export function specialRoundIssues(r: RoundDetail, isFirstRound: boolean): PublishIssue[] {
  const out: PublishIssue[] = [];
  if (r.kind === "bet") {
    if (isFirstRound && r.betMinStake === 0) {
      out.push({ level: "error", roundId: r.id, message: `Round "${r.title}": è il primo round e tutti hanno 0 punti, con puntata minima 0 nessuno potrebbe puntare` });
    } else if (isFirstRound) {
      out.push({ level: "warning", roundId: r.id, message: `Round "${r.title}": è il primo round, all'inizio si potrà puntare solo la puntata minima (${r.betMinStake})` });
    }
    if (r.betMinStake === 0) out.push({ level: "warning", roundId: r.id, message: `Round "${r.title}": puntata minima 0, chi ha 0 punti o meno non potrà puntare` });
    const withEvents = r.questions.filter((q) => q.scheduledEvent);
    if (withEvents.length > 0) {
      out.push({ level: "error", roundId: r.id, message: `Round "${r.title}": niente eventi speciali nella manche Scommetti tutto (${withEvents.length} programmati)` });
    }
  }
  if (r.kind === "comeback") {
    if (r.comebackMultiplier <= 1 && r.comebackLeaderPenalty <= 1) {
      out.push({ level: "error", roundId: r.id, message: `Round "${r.title}": Grande ribaltone senza BOOST né penalità del capolista, imposta almeno uno dei due` });
    }
    if (isFirstRound) out.push({ level: "warning", roundId: r.id, message: `Round "${r.title}": è il primo round, alla prima domanda sono tutti a pari punti e il BOOST non scatta` });
  }
  return out;
}

export async function publishSession(sessionId: string, actor: Actor): Promise<{ issues: PublishIssue[] }> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [s] = await tx<{ status: SessionStatus; settings: SessionSettings }[]>`select status, settings from game_sessions where id = ${sessionId} for update`;
    if (!s) throw new CmsError("Sessione non trovata", 404);
    if (s.status !== "draft") throw new CmsError("La sessione è già pubblicata", 409);
    const issues = await validateForPublish(tx, sessionId);
    if (issues.some((i) => i.level === "error")) throw new CmsError("La sessione non può essere pubblicata", 422, issues);
    const eff = effectiveSettings(await loadGlobalSettings(tx), s.settings);

    await tx`
      insert into question_snapshots (session_question_id, session_id, source_question_id, source_question_version, type, text,
        category, difficulty, presenter, options, correct_positions, correct_points, wrong_penalty, no_answer_penalty,
        duration_seconds, partial_scoring, media_id, media_kind, audio_start_ms, audio_duration_ms, audio_plays, animation)
      select sq.id, sq.session_id, qb.id, qb.version, qb.type, qb.text, qb.category, qb.difficulty, qb.presenter,
        (select jsonb_agg(jsonb_build_object('position', o.position, 'text', o.text) order by o.position)
           from question_options o where o.question_id = qb.id),
        (select array_agg(o.position order by o.position) from question_options o where o.question_id = qb.id and o.is_correct),
        coalesce(qb.correct_points, r.correct_points, ${eff.correctPoints}::int),
        coalesce(qb.wrong_penalty, r.wrong_penalty, ${eff.wrongPenalty}::int),
        coalesce(qb.no_answer_penalty, ${eff.noAnswerPenalty}::int),
        coalesce(qb.duration_seconds, r.duration_seconds, ${eff.durationSeconds}::int),
        qb.partial_scoring, qb.media_id, m.kind, qb.audio_start_ms, qb.audio_duration_ms, qb.audio_plays, qb.animation
      from session_questions sq
      join question_bank qb on qb.id = sq.question_id
      join game_rounds r on r.id = sq.round_id
      left join media_assets m on m.id = qb.media_id
      where sq.session_id = ${sessionId}`;

    // Congela anche le regole globali effettive usate dalla serata.
    await tx`
      update game_sessions set status = 'ready', published_at = now(),
        settings = settings || ${tx.json({ allowNegative: eff.allowNegative })}
      where id = ${sessionId}`;
    await tx`
      insert into game_state (session_id, phase) values (${sessionId}, 'READY')
      on conflict (session_id) do update set phase = 'READY', version = game_state.version + 1`;
    await audit(tx, actor, "session.publish", { sessionId, type: "session", id: sessionId, details: { warnings: issues.length } });
    return { issues };
  });
}

export async function unpublishSession(sessionId: string, actor: Actor): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [g] = await tx<{ phase: GamePhase; status: SessionStatus }[]>`
      select gs.phase, s.status from game_sessions s join game_state gs on gs.session_id = s.id where s.id = ${sessionId} for update of s`;
    if (!g || g.status !== "ready" || g.phase !== "READY") {
      throw new CmsError("Si può annullare la pubblicazione solo prima dell'apertura della lobby", 409);
    }
    await tx`update game_sessions set status = 'draft', published_at = null where id = ${sessionId}`;
    await tx`delete from question_snapshots where session_id = ${sessionId}`;
    await tx`delete from game_state where session_id = ${sessionId}`;
    await audit(tx, actor, "session.unpublish", { sessionId, type: "session", id: sessionId });
  });
}

export async function archiveSession(sessionId: string, actor: Actor): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const rows = await tx`
      update game_sessions set status = 'archived', archived_at = now() where id = ${sessionId} and status = 'finished' returning id`;
    if (rows.length === 0) throw new CmsError("Si possono archiviare solo le sessioni terminate", 409);
    await audit(tx, actor, "session.archive", { sessionId, type: "session", id: sessionId });
  });
}

export async function updateSessionSettings(sessionId: string, raw: unknown, actor: Actor) {
  const p = sessionSettingsSchema.safeParse(raw);
  if (!p.success) throw new CmsError("Impostazioni non valide", 422, p.error.issues);
  await updateSession(sessionId, { settings: p.data }, actor);
}

// ---------------------------------------------------------------------------
// Round
// ---------------------------------------------------------------------------
export async function createRound(sessionId: string, raw: unknown, actor: Actor): Promise<string> {
  const p = roundInputSchema.safeParse(raw);
  if (!p.success) throw new CmsError("Round non valido", 422, p.error.issues);
  const sql = getSql();
  return sql.begin((tx) => insertRound(tx, sessionId, p.data, actor));
}

/** Aggiunge un round in coda dentro una transazione già aperta. */
export async function insertRound(tx: Tx, sessionId: string, r: RoundInput, actor: Actor): Promise<string> {
  await requireDraft(tx, sessionId);
  const [{ pos }] = await tx<{ pos: number }[]>`select coalesce(max(position) + 1, 0)::int as pos from game_rounds where session_id = ${sessionId}`;
  const [row] = await tx<{ id: string }[]>`
    insert into game_rounds (session_id, position, title, kind, presenter, description, points_multiplier, penalty_multiplier, no_penalty,
      correct_points, wrong_penalty, duration_seconds, speed_bonus_max, vote_duration_seconds, vote_tie_break, vote_live_results,
      bet_min_stake, bet_default_tier, comeback_multiplier, comeback_leader_penalty)
    values (${sessionId}, ${pos}, ${r.title}, ${r.kind}, ${r.presenter}, ${r.description ?? null}, ${r.pointsMultiplier},
      ${r.penaltyMultiplier}, ${r.noPenalty}, ${r.correctPoints ?? null}, ${r.wrongPenalty ?? null}, ${r.durationSeconds ?? null},
      ${r.speedBonusMax}, ${r.voteDurationSeconds}, ${r.voteTieBreak}, ${r.voteLiveResults},
      ${r.betMinStake}, ${r.betDefaultTier}, ${r.comebackMultiplier}, ${r.comebackLeaderPenalty})
    returning id`;
  if (r.kind === "bet") await dropScheduledEvents(tx, row.id);
  if (isCategoryRound(r.kind)) await syncVoteOptions(tx, row.id, r.voteOptions);
  await audit(tx, actor, "round.create", { sessionId, type: "round", id: row.id });
  return row.id;
}

async function dropScheduledEvents(tx: Tx, roundId: string) {
  await tx`
    delete from special_events e using session_questions sq
    where sq.id = e.target_session_question_id and sq.round_id = ${roundId} and e.source = 'scheduled'`;
}

async function syncVoteOptions(tx: Tx, roundId: string, labels: string[]) {
  const existing = await tx<{ id: string; position: number }[]>`select id, position from category_vote_options where round_id = ${roundId}`;
  for (let i = 0; i < labels.length; i++) {
    const ex = existing.find((e) => e.position === i);
    if (ex) await tx`update category_vote_options set label = ${labels[i]} where id = ${ex.id}`;
    else await tx`insert into category_vote_options (round_id, position, label) values (${roundId}, ${i}, ${labels[i]})`;
  }
  // Rimuovendo una categoria si scollegano (non si cancellano) le sue domande.
  for (const ex of existing.filter((e) => e.position >= labels.length)) {
    await tx`update session_questions set vote_option_id = null where vote_option_id = ${ex.id}`;
    await tx`delete from category_vote_options where id = ${ex.id}`;
  }
}

export async function updateRound(roundId: string, raw: unknown, actor: Actor): Promise<void> {
  const p = roundInputSchema.safeParse(raw);
  if (!p.success) throw new CmsError("Round non valido", 422, p.error.issues);
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [r0] = await tx<{ session_id: string }[]>`select session_id from game_rounds where id = ${roundId}`;
    if (!r0) throw new CmsError("Round non trovato", 404);
    await requireDraft(tx, r0.session_id);
    const r = p.data;
    await tx`
      update game_rounds set title = ${r.title}, kind = ${r.kind}, presenter = ${r.presenter}, description = ${r.description ?? null},
        points_multiplier = ${r.pointsMultiplier}, penalty_multiplier = ${r.penaltyMultiplier}, no_penalty = ${r.noPenalty},
        correct_points = ${r.correctPoints ?? null}, wrong_penalty = ${r.wrongPenalty ?? null}, duration_seconds = ${r.durationSeconds ?? null},
        speed_bonus_max = ${r.speedBonusMax}, vote_duration_seconds = ${r.voteDurationSeconds}, vote_tie_break = ${r.voteTieBreak},
        vote_live_results = ${r.voteLiveResults}, bet_min_stake = ${r.betMinStake}, bet_default_tier = ${r.betDefaultTier},
        comeback_multiplier = ${r.comebackMultiplier}, comeback_leader_penalty = ${r.comebackLeaderPenalty}
      where id = ${roundId}`;
    // Scommetti tutto non ammette eventi speciali: quelli programmati sulle sue domande si tolgono.
    if (r.kind === "bet") await dropScheduledEvents(tx, roundId);
    await syncVoteOptions(tx, roundId, isCategoryRound(r.kind) ? r.voteOptions : []);
    await audit(tx, actor, "round.update", { sessionId: r0.session_id, type: "round", id: roundId });
  });
}

export async function deleteRound(roundId: string, actor: Actor): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [r0] = await tx<{ session_id: string }[]>`select session_id from game_rounds where id = ${roundId}`;
    if (!r0) throw new CmsError("Round non trovato", 404);
    await requireDraft(tx, r0.session_id);
    await tx`delete from game_rounds where id = ${roundId}`;
    await renumber(tx, r0.session_id);
    await audit(tx, actor, "round.delete", { sessionId: r0.session_id, type: "round", id: roundId });
  });
}

async function renumber(tx: Tx, sessionId: string) {
  await tx`
    update game_rounds r set position = x.rn from (
      select id, (row_number() over (order by position) - 1)::int as rn from game_rounds where session_id = ${sessionId}) x
    where r.id = x.id`;
}

export async function reorderRounds(sessionId: string, orderedIds: string[], actor: Actor): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    await requireDraft(tx, sessionId);
    for (let i = 0; i < orderedIds.length; i++) {
      await tx`update game_rounds set position = ${i} where id = ${orderedIds[i]} and session_id = ${sessionId}`;
    }
    await audit(tx, actor, "round.reorder", { sessionId, type: "session", id: sessionId });
  });
}

// ---------------------------------------------------------------------------
// Domande nei round
// ---------------------------------------------------------------------------
export async function addQuestionsToRound(
  roundId: string,
  questionIds: string[],
  opts: { voteOptionId?: string | null; isReserve?: boolean },
  actor: Actor,
): Promise<void> {
  const sql = getSql();
  await sql.begin((tx) => insertRoundQuestions(tx, roundId, questionIds, opts, actor));
}

/** Inserisce domande in coda al round dentro una transazione già aperta. */
export async function insertRoundQuestions(
  tx: Tx,
  roundId: string,
  questionIds: string[],
  opts: { voteOptionId?: string | null; isReserve?: boolean },
  actor: Actor,
  details?: Record<string, unknown>,
): Promise<void> {
  const [r] = await tx<{ session_id: string; kind: RoundKind }[]>`select session_id, kind from game_rounds where id = ${roundId}`;
  if (!r) throw new CmsError("Round non trovato", 404);
  await requireDraft(tx, r.session_id);
  if (isCategoryRound(r.kind) && !opts.voteOptionId && !opts.isReserve) {
    throw new CmsError(r.kind === "category_wheel" ? "Nei round con la ruota ogni domanda va assegnata a una categoria" : "Nei round con votazione ogni domanda va assegnata a una categoria", 422);
  }
  if (opts.voteOptionId) {
    const [o] = await tx`select 1 from category_vote_options where id = ${opts.voteOptionId} and round_id = ${roundId}`;
    if (!o) throw new CmsError("Categoria non valida", 422);
  }
  let [{ pos }] = await tx<{ pos: number }[]>`select coalesce(max(position) + 1, 0)::int as pos from session_questions where round_id = ${roundId}`;
  for (const qid of questionIds) {
    const [q] = await tx`select 1 from question_bank where id = ${qid} and status <> 'archived'`;
    if (!q) throw new CmsError("Domanda non trovata o archiviata", 404);
    await tx`
      insert into session_questions (session_id, round_id, position, question_id, vote_option_id, is_reserve)
      values (${r.session_id}, ${roundId}, ${pos++}, ${qid}, ${opts.voteOptionId ?? null}, ${opts.isReserve ?? false})`;
  }
  await audit(tx, actor, "round.add_questions", { sessionId: r.session_id, type: "round", id: roundId, details: { count: questionIds.length, ...details } });
}

export async function updateSessionQuestion(sqId: string, patch: { voteOptionId?: string | null; isReserve?: boolean }, actor: Actor) {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [q] = await tx<{ session_id: string; round_id: string }[]>`select session_id, round_id from session_questions where id = ${sqId}`;
    if (!q) throw new CmsError("Domanda non trovata", 404);
    await requireDraft(tx, q.session_id);
    if (patch.voteOptionId) {
      const [o] = await tx`select 1 from category_vote_options where id = ${patch.voteOptionId} and round_id = ${q.round_id}`;
      if (!o) throw new CmsError("Categoria non valida", 422);
    }
    await tx`
      update session_questions set
        vote_option_id = ${patch.voteOptionId === undefined ? tx`vote_option_id` : patch.voteOptionId},
        is_reserve = coalesce(${patch.isReserve ?? null}::boolean, is_reserve)
      where id = ${sqId}`;
    await audit(tx, actor, "session_question.update", { sessionId: q.session_id, type: "session_question", id: sqId });
  });
}

export async function removeSessionQuestion(sqId: string, actor: Actor): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [q] = await tx<{ session_id: string; round_id: string }[]>`select session_id, round_id from session_questions where id = ${sqId}`;
    if (!q) throw new CmsError("Domanda non trovata", 404);
    await requireDraft(tx, q.session_id);
    await tx`delete from session_questions where id = ${sqId}`;
    await tx`
      update session_questions s set position = x.rn from (
        select id, (row_number() over (order by position) - 1)::int as rn from session_questions where round_id = ${q.round_id}) x
      where s.id = x.id`;
    await audit(tx, actor, "session_question.remove", { sessionId: q.session_id, type: "session_question", id: sqId });
  });
}

/** Riordina e/o sposta domande tra round (lista completa degli id nel nuovo ordine). */
export async function reorderRoundQuestions(roundId: string, orderedIds: string[], actor: Actor): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [r] = await tx<{ session_id: string }[]>`select session_id from game_rounds where id = ${roundId}`;
    if (!r) throw new CmsError("Round non trovato", 404);
    await requireDraft(tx, r.session_id);
    for (let i = 0; i < orderedIds.length; i++) {
      await tx`
        update session_questions set position = ${i}, round_id = ${roundId},
          vote_option_id = case when round_id = ${roundId} then vote_option_id else null end
        where id = ${orderedIds[i]} and session_id = ${r.session_id}`;
    }
    await audit(tx, actor, "round.reorder_questions", { sessionId: r.session_id, type: "round", id: roundId });
  });
}

// ---------------------------------------------------------------------------
// Eventi di Palmino programmati
// ---------------------------------------------------------------------------
export async function scheduleEvent(sessionId: string, raw: unknown, actor: Actor): Promise<string> {
  const p = specialEventScheduleSchema.safeParse(raw);
  if (!p.success) throw new CmsError("Evento non valido", 422, p.error.issues);
  const sql = getSql();
  return sql.begin(async (tx) => {
    await requireDraft(tx, sessionId);
    const [def] = await tx<{ id: string; type: string; title: string; tagline: string; params: Record<string, number>; allowed: string[] }[]>`
      select id, type::text, title, tagline, params, allowed_round_kinds::text[] as allowed
      from special_event_definitions where key = ${p.data.definitionKey} and enabled`;
    if (!def) throw new CmsError("Evento non trovato", 404);
    if (def.type === "mystery_question" || def.type === "palmino_decides") {
      throw new CmsError("Domanda misteriosa e Palmino decide si attivano dalla regia live", 422);
    }
    const [q] = await tx<{ kind: string }[]>`
      select r.kind::text from session_questions sq join game_rounds r on r.id = sq.round_id
      where sq.id = ${p.data.targetSessionQuestionId} and sq.session_id = ${sessionId}`;
    if (!q) throw new CmsError("Domanda non trovata nella sessione", 404);
    if (q.kind === "bet") throw new CmsError("Nella manche Scommetti tutto non sono previsti eventi speciali", 422);
    if (!def.allowed.includes(eventRoundKind(q.kind as RoundKind))) throw new CmsError("Evento non compatibile con il tipo di round", 422);
    await tx`delete from special_events where target_session_question_id = ${p.data.targetSessionQuestionId} and source = 'scheduled'`;
    const [e] = await tx<{ id: string }[]>`
      insert into special_events (session_id, definition_id, type, title, tagline, params, target_session_question_id, status, source, created_by)
      values (${sessionId}, ${def.id}, ${def.type}::special_event_type, ${def.title}, ${def.tagline},
              ${tx.json({ ...def.params, ...(p.data.params ?? {}) })}, ${p.data.targetSessionQuestionId}, 'scheduled', 'scheduled', ${actor.userId})
      returning id`;
    await audit(tx, actor, "event.schedule", { sessionId, type: "special_event", id: e.id, details: { key: p.data.definitionKey } });
    return e.id;
  });
}

export async function unscheduleEvent(eventId: string, actor: Actor): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [e] = await tx<{ session_id: string }[]>`select session_id from special_events where id = ${eventId} and source = 'scheduled'`;
    if (!e) throw new CmsError("Evento non trovato", 404);
    await requireDraft(tx, e.session_id);
    await tx`delete from special_events where id = ${eventId}`;
    await audit(tx, actor, "event.unschedule", { sessionId: e.session_id, type: "special_event", id: eventId });
  });
}
