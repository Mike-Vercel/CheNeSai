import { createHash, randomBytes, randomInt } from "node:crypto";
import { getSql, iso, type Db } from "@/lib/database/db";
import { EARLY_JOIN_PHASES } from "@/lib/game-engine/transitions";
import { validateNickname } from "@/lib/game-engine/nickname";
import type { GamePhase, QuestionType } from "@/lib/game-engine/types";
import type { SessionSettings } from "@/lib/validation/schemas";
import { effectiveSettings, loadGlobalSettings } from "./settings";

export type PlayerErrorCode =
  | "NOT_FOUND"
  | "LOBBY_CLOSED"
  | "JOIN_LOCKED"
  | "GAME_FINISHED"
  | "NICKNAME_INVALID"
  | "NICKNAME_TAKEN"
  | "RECOVERY_INVALID"
  | "KICKED"
  | "NOT_JOINED"
  | "NOT_OPEN"
  | "WRONG_QUESTION"
  | "TOO_LATE"
  | "ALREADY_ANSWERED"
  | "INVALID_ANSWER"
  | "RATE_LIMITED";

export class PlayerError extends Error {
  readonly code: PlayerErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: PlayerErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "PlayerError";
    this.code = code;
    this.details = details;
  }
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const token = (bytes = 32) => randomBytes(bytes).toString("base64url");

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateRecoveryCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
  return `QZ-${s.slice(0, 4)}-${s.slice(4)}`;
}
export function normalizeRecoveryCode(c: string): string {
  const s = c.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 10 && s.startsWith("QZ") ? s.slice(2) : s;
}

export function playerCookieName(code: string, slot?: string | null): string {
  return `qz_p_${code.toUpperCase()}${slot ? `_${slot}` : ""}`;
}
export const IDENTITY_COOKIE = "qz_id";

export async function checkRateLimit(db: Db, bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [r] = await db<{ ok: boolean }[]>`select qz_rate_limit(${bucket}, ${limit}, ${windowSeconds}) as ok`;
  return r.ok;
}

interface SecurityLog {
  kind: string;
  sessionId: string | null;
  participantId: string | null;
  details: Record<string, unknown>;
}

/**
 * Le anomalie (risposte tardive, doppie...) vanno registrate anche se la
 * transazione viene annullata dall'errore: si raccolgono e si scrivono dopo.
 */
function deferredSecurityLog(ip: string | null) {
  const logs: SecurityLog[] = [];
  return {
    defer: (kind: string, sessionId: string | null, participantId: string | null, details: Record<string, unknown>, _ip?: string | null) => {
      logs.push({ kind, sessionId, participantId, details });
    },
    flush: async () => {
      if (logs.length === 0) return;
      const sql = getSql();
      for (const l of logs.splice(0)) {
        await sql`
          insert into security_events (session_id, participant_id, kind, details, ip)
          values (${l.sessionId}, ${l.participantId}, ${l.kind}, ${sql.json(JSON.parse(JSON.stringify(l.details)))}, ${ip})`;
      }
    },
  };
}

async function withSecurityLog<T>(flush: () => Promise<void>, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    await flush().catch(() => undefined);
  }
}

// ===========================================================================
// Ingresso nella sessione
// ===========================================================================
export interface JoinInput {
  code: string;
  nickname: string;
  recoveryCode?: string | null;
  slot?: string | null;
}

export interface JoinResult {
  participantId: string;
  nickname: string;
  sessionId: string;
  participantToken: string;
  /** Presente solo se è stata creata/ruotata l'identità del dispositivo. */
  deviceToken: string | null;
  /** Presente solo alla creazione dell'identità: va mostrato al giocatore. */
  recoveryCode: string | null;
  rejoined: boolean;
}

export async function joinSession(input: JoinInput, ctx: { ip: string | null; deviceToken: string | null }): Promise<JoinResult> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    if (!(await checkRateLimit(tx, `join:${ctx.ip ?? "unknown"}`, 240, 60))) {
      throw new PlayerError("RATE_LIMITED", "Troppi tentativi, riprova tra qualche secondo");
    }
    const [s] = await tx<{ id: string; status: string; is_test: boolean; settings: SessionSettings; phase: GamePhase }[]>`
      select s.id, s.status, s.is_test, s.settings, gs.phase
      from game_sessions s join game_state gs on gs.session_id = s.id
      where s.code = ${input.code.toUpperCase()}`;
    if (!s) throw new PlayerError("NOT_FOUND", "Codice sessione non valido");
    if (s.phase === "FINISHED" || s.status === "finished" || s.status === "archived") {
      throw new PlayerError("GAME_FINISHED", "Questa partita è terminata");
    }
    if (s.status !== "live") throw new PlayerError("LOBBY_CLOSED", "La lobby non è ancora aperta: attendi il via dalla regia");
    const settings = effectiveSettings(await loadGlobalSettings(tx), s.settings);
    const slot = s.is_test ? (input.slot ?? null) : null;

    // --- identità persistente (classifiche mensili/stagionali) ---
    let identityId: string | null = null;
    let newDeviceToken: string | null = null;
    let newRecoveryCode: string | null = null;
    if (!slot) {
      if (input.recoveryCode) {
        const [idt] = await tx<{ id: string }[]>`
          select id from player_identities where recovery_code_hash = ${sha256(normalizeRecoveryCode(input.recoveryCode))}`;
        if (!idt) throw new PlayerError("RECOVERY_INVALID", "Codice giocatore non riconosciuto");
        identityId = idt.id;
        newDeviceToken = token();
        await tx`update player_identities set device_token_hash = ${sha256(newDeviceToken)}, last_seen_at = now() where id = ${idt.id}`;
      } else if (ctx.deviceToken) {
        const [idt] = await tx<{ id: string }[]>`select id from player_identities where device_token_hash = ${sha256(ctx.deviceToken)}`;
        identityId = idt?.id ?? null;
      }
      if (!identityId) {
        newDeviceToken = token();
        newRecoveryCode = generateRecoveryCode();
        const [idt] = await tx<{ id: string }[]>`
          insert into player_identities (device_token_hash, recovery_code_hash)
          values (${sha256(newDeviceToken)}, ${sha256(normalizeRecoveryCode(newRecoveryCode))}) returning id`;
        identityId = idt.id;
      }
    }

    const participantSecret = token();

    // --- rientro: stesso dispositivo/identità nella stessa sessione ---
    if (identityId) {
      const [existing] = await tx<{ id: string; nickname: string; status: string }[]>`
        select id, nickname, status from participants where session_id = ${s.id} and identity_id = ${identityId}`;
      if (existing) {
        if (existing.status !== "active") throw new PlayerError("KICKED", "Sei stato escluso da questa partita dalla regia");
        const full = `${existing.id}.${participantSecret}`;
        await tx`update participants set token_hash = ${sha256(full)}, last_seen_at = now() where id = ${existing.id}`;
        return {
          participantId: existing.id,
          nickname: existing.nickname,
          sessionId: s.id,
          participantToken: full,
          deviceToken: newDeviceToken,
          recoveryCode: newRecoveryCode,
          rejoined: true,
        };
      }
    }

    if (settings.joinLocked) throw new PlayerError("JOIN_LOCKED", "Gli ingressi sono chiusi in questo momento");
    if (!EARLY_JOIN_PHASES.includes(s.phase) && !settings.allowLateJoin) {
      throw new PlayerError("JOIN_LOCKED", "La partita è già iniziata e gli ingressi tardivi non sono consentiti");
    }

    const v = validateNickname(input.nickname, { minLength: settings.nicknameMinLength, maxLength: settings.nicknameMaxLength });
    if (!v.ok) throw new PlayerError("NICKNAME_INVALID", v.message, { issue: v.issue });

    const [p] = await tx<{ id: string }[]>`
      insert into participants (session_id, identity_id, nickname, nickname_key, token_hash)
      values (${s.id}, ${identityId}, ${v.display}, ${v.key}, ${"pending:" + participantSecret})
      on conflict (session_id, nickname_key) do nothing
      returning id`;
    if (!p) throw new PlayerError("NICKNAME_TAKEN", "Questo nickname è già in uso in questa partita: scegline un altro");
    const full = `${p.id}.${participantSecret}`;
    await tx`update participants set token_hash = ${sha256(full)} where id = ${p.id}`;
    await tx`insert into score_totals (participant_id, session_id) values (${p.id}, ${s.id})`;
    if (identityId) await tx`update player_identities set last_nickname = ${v.display}, last_seen_at = now() where id = ${identityId}`;
    return {
      participantId: p.id,
      nickname: v.display,
      sessionId: s.id,
      participantToken: full,
      deviceToken: newDeviceToken,
      recoveryCode: newRecoveryCode,
      rejoined: false,
    };
  });
}

// ===========================================================================
// Autenticazione del giocatore (token nel cookie httpOnly)
// ===========================================================================
export interface PlayerAuth {
  participantId: string;
  sessionId: string;
  nickname: string;
  isTest: boolean;
}

export async function authenticatePlayer(db: Db, code: string, rawToken: string | null | undefined): Promise<PlayerAuth> {
  if (!rawToken || !/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{20,}$/.test(rawToken)) {
    throw new PlayerError("NOT_JOINED", "Non sei ancora entrato in questa partita");
  }
  const [p] = await db<{ id: string; session_id: string; nickname: string; status: string; code: string; is_test: boolean }[]>`
    select p.id, p.session_id, p.nickname, p.status, s.code, s.is_test
    from participants p join game_sessions s on s.id = p.session_id
    where p.token_hash = ${sha256(rawToken)}`;
  if (!p || p.code !== code.toUpperCase()) throw new PlayerError("NOT_JOINED", "Sessione di gioco non valida: rientra con il tuo nickname");
  if (p.status !== "active") throw new PlayerError("KICKED", "Sei stato escluso da questa partita dalla regia");
  return { participantId: p.id, sessionId: p.session_id, nickname: p.nickname, isTest: p.is_test };
}

// ===========================================================================
// Invio risposta (autorità del server su tempo e validità)
// ===========================================================================
export interface AnswerResult {
  status: "recorded" | "duplicate";
  sessionQuestionId: string;
  positions: number[];
  submittedAt: string;
}

export async function submitAnswer(
  auth: PlayerAuth,
  input: { sessionQuestionId: string; positions: number[]; requestId: string },
  ip: string | null,
): Promise<AnswerResult> {
  const sql = getSql();
  const positions = [...new Set(input.positions)].sort((a, b) => a - b);
  const { defer, flush } = deferredSecurityLog(ip);
  return withSecurityLog(flush, () => sql.begin(async (tx) => {
    if (!(await checkRateLimit(tx, `ans:${auth.participantId}`, 20, 10))) {
      throw new PlayerError("RATE_LIMITED", "Troppe richieste");
    }
    const global = await loadGlobalSettings(tx);
    // FOR SHARE: serializza con i comandi di regia (che usano FOR UPDATE).
    const [g] = await tx<
      {
        phase: GamePhase;
        current_session_question_id: string | null;
        type: QuestionType | null;
        options_opened_at: Date | null;
        answers_close_at: Date | null;
        is_open: boolean | null;
        has_started: boolean | null;
        response_ms: number | null;
      }[]
    >`
      select gs.phase, gs.current_session_question_id, qs.type, sq.options_opened_at, sq.answers_close_at,
             clock_timestamp() <= sq.answers_close_at + make_interval(secs => ${global.timing.answerGraceMs / 1000}::float8) as is_open,
             clock_timestamp() >= sq.options_opened_at as has_started,
             greatest(0, floor(extract(epoch from (clock_timestamp() - sq.options_opened_at)) * 1000))::int as response_ms
      from game_state gs
      left join session_questions sq on sq.id = gs.current_session_question_id
      left join question_snapshots qs on qs.session_question_id = sq.id
      where gs.session_id = ${auth.sessionId}
      for share of gs`;

    // Risposta già registrata? (idempotenza: stesso requestId = stesso esito)
    const [existing] = await tx<{ client_request_id: string; selected_positions: number[]; submitted_at: Date }[]>`
      select client_request_id, selected_positions, submitted_at from answer_submissions
      where session_question_id = ${input.sessionQuestionId} and participant_id = ${auth.participantId}`;
    if (existing) {
      if (existing.client_request_id === input.requestId) {
        return {
          status: "duplicate",
          sessionQuestionId: input.sessionQuestionId,
          positions: existing.selected_positions,
          submittedAt: iso(existing.submitted_at)!,
        };
      }
      defer("double_answer", auth.sessionId, auth.participantId, { sessionQuestionId: input.sessionQuestionId }, ip);
      throw new PlayerError("ALREADY_ANSWERED", "Hai già confermato la tua risposta", { positions: existing.selected_positions });
    }

    if (!g || g.current_session_question_id !== input.sessionQuestionId) {
      throw new PlayerError("WRONG_QUESTION", "Questa domanda non è più attiva");
    }
    if (g.phase !== "OPTIONS_VISIBLE" || !g.options_opened_at) {
      if (g.phase === "ANSWERS_LOCKED" || g.phase === "ANSWER_REVEAL" || g.phase === "SCORE_REVEAL") {
        defer("late_answer", auth.sessionId, auth.participantId, { phase: g.phase }, ip);
        throw new PlayerError("TOO_LATE", "Tempo scaduto: le risposte sono chiuse");
      }
      throw new PlayerError("NOT_OPEN", g.phase === "PAUSED" ? "Gioco in pausa" : "Le risposte non sono aperte");
    }
    if (!g.has_started) {
      throw new PlayerError("NOT_OPEN", "Ascolta le risposte: il tempo parte tra un attimo");
    }
    if (!g.is_open) {
      defer("late_answer", auth.sessionId, auth.participantId, { closesAt: iso(g.answers_close_at) }, ip);
      throw new PlayerError("TOO_LATE", "Tempo scaduto: le risposte sono chiuse");
    }
    if (g.type === "single" && positions.length !== 1) {
      throw new PlayerError("INVALID_ANSWER", "Seleziona una sola risposta");
    }

    const [s] = await tx<{ id: string; submitted_at: Date }[]>`
      insert into answer_submissions (session_id, session_question_id, participant_id, selected_positions, client_request_id, response_ms)
      values (${auth.sessionId}, ${input.sessionQuestionId}, ${auth.participantId}, ${tx.array(positions)}::smallint[],
              ${input.requestId}, ${g.response_ms ?? 0})
      on conflict (session_question_id, participant_id) do nothing
      returning id, submitted_at`;
    if (!s) throw new PlayerError("ALREADY_ANSWERED", "Hai già confermato la tua risposta");
    await tx`
      insert into answer_selected_options (submission_id, session_question_id, position)
      select ${s.id}, ${input.sessionQuestionId}, unnest(${tx.array(positions)}::smallint[])`;
    await tx`update participants set last_seen_at = now() where id = ${auth.participantId} and last_seen_at < now() - interval '10 seconds'`;
    return { status: "recorded" as const, sessionQuestionId: input.sessionQuestionId, positions, submittedAt: iso(s.submitted_at)! };
  }));
}

// ===========================================================================
// Voto categoria
// ===========================================================================
export async function submitVote(auth: PlayerAuth, input: { roundId: string; optionId: string }, ip: string | null) {
  const sql = getSql();
  const { defer, flush } = deferredSecurityLog(ip);
  return withSecurityLog(flush, () => sql.begin(async (tx) => {
    if (!(await checkRateLimit(tx, `vote:${auth.participantId}`, 10, 10))) throw new PlayerError("RATE_LIMITED", "Troppe richieste");
    const global = await loadGlobalSettings(tx);
    const [g] = await tx<{ phase: GamePhase; current_round_id: string | null; is_open: boolean | null; option_ok: boolean }[]>`
      select gs.phase, gs.current_round_id,
             clock_timestamp() <= r.vote_closes_at + make_interval(secs => ${global.timing.answerGraceMs / 1000}::float8) and r.vote_closed_at is null as is_open,
             exists (select 1 from category_vote_options o where o.id = ${input.optionId} and o.round_id = ${input.roundId}) as option_ok
      from game_state gs left join game_rounds r on r.id = gs.current_round_id
      where gs.session_id = ${auth.sessionId}
      for share of gs`;
    const [existing] = await tx<{ option_id: string }[]>`
      select option_id from category_votes where round_id = ${input.roundId} and participant_id = ${auth.participantId}`;
    if (existing) {
      if (existing.option_id === input.optionId) return { status: "duplicate" as const, optionId: existing.option_id };
      throw new PlayerError("ALREADY_ANSWERED", "Hai già votato", { optionId: existing.option_id });
    }
    if (!g || g.current_round_id !== input.roundId || !g.option_ok) throw new PlayerError("WRONG_QUESTION", "Votazione non valida");
    if (g.phase !== "CATEGORY_VOTING") throw new PlayerError("NOT_OPEN", "La votazione non è aperta");
    if (!g.is_open) {
      defer("late_vote", auth.sessionId, auth.participantId, {}, ip);
      throw new PlayerError("TOO_LATE", "Votazione chiusa");
    }
    await tx`
      insert into category_votes (session_id, round_id, participant_id, option_id)
      values (${auth.sessionId}, ${input.roundId}, ${auth.participantId}, ${input.optionId})
      on conflict do nothing`;
    return { status: "recorded" as const, optionId: input.optionId };
  }));
}

// ===========================================================================
// Stato personale del giocatore
// ===========================================================================
export interface PlayerSelf {
  participantId: string;
  nickname: string;
  points: number;
  rank: number | null;
  previousRank: number | null;
  lastDelta: number;
  totalPlayers: number;
  currentAnswer: { sessionQuestionId: string; positions: number[]; submittedAt: string } | null;
  currentResult: { sessionQuestionId: string; isCorrect: boolean; partial: boolean; delta: number | null } | null;
  vote: { roundId: string; optionId: string } | null;
  history: {
    sessionQuestionId: string;
    number: number;
    text: string;
    myPositions: number[] | null;
    correctPositions: number[];
    isCorrect: boolean;
    delta: number | null;
  }[];
}

export async function getPlayerSelf(db: Db, auth: PlayerAuth): Promise<PlayerSelf> {
  await db`update participants set last_seen_at = now() where id = ${auth.participantId} and last_seen_at < now() - interval '15 seconds'`;
  const [t] = await db<{ points: number; rank: number | null; previous_rank: number | null; last_delta: number }[]>`
    select points, rank, previous_rank, last_delta from score_totals where participant_id = ${auth.participantId}`;
  const [{ total }] = await db<{ total: number }[]>`
    select count(*)::int as total from participants where session_id = ${auth.sessionId} and status = 'active'`;
  const [gs] = await db<{ current_session_question_id: string | null; current_round_id: string | null }[]>`
    select current_session_question_id, current_round_id from game_state where session_id = ${auth.sessionId}`;

  let currentAnswer: PlayerSelf["currentAnswer"] = null;
  let currentResult: PlayerSelf["currentResult"] = null;
  if (gs?.current_session_question_id) {
    const [a] = await db<
      {
        selected_positions: number[];
        submitted_at: Date;
        is_correct: boolean | null;
        correct_hits: number | null;
        wrong_hits: number | null;
        revealed_at: Date | null;
      }[]
    >`
      select a.selected_positions, a.submitted_at, a.is_correct, a.correct_hits, a.wrong_hits, sq.revealed_at
      from answer_submissions a join session_questions sq on sq.id = a.session_question_id
      where a.session_question_id = ${gs.current_session_question_id} and a.participant_id = ${auth.participantId}`;
    if (a) {
      currentAnswer = {
        sessionQuestionId: gs.current_session_question_id,
        positions: a.selected_positions,
        submittedAt: iso(a.submitted_at)!,
      };
    }
    const [rev] = await db<{ revealed_at: Date | null }[]>`select revealed_at from session_questions where id = ${gs.current_session_question_id}`;
    if (rev?.revealed_at) {
      const [ev] = await db<{ delta: number }[]>`
        select delta from score_events where session_question_id = ${gs.current_session_question_id} and participant_id = ${auth.participantId}
          and kind in ('answer', 'no_answer')`;
      // chi è entrato dopo la chiusura non ha né risposta né punteggio: nessun esito da mostrare
      if (a || ev) currentResult = {
        sessionQuestionId: gs.current_session_question_id,
        isCorrect: a?.is_correct ?? false,
        partial: !!a && !a.is_correct && (a.wrong_hits ?? 1) === 0 && (a.correct_hits ?? 0) > 0,
        delta: ev ? ev.delta : null,
      };
    }
  }

  let vote: PlayerSelf["vote"] = null;
  if (gs?.current_round_id) {
    const [v] = await db<{ option_id: string }[]>`
      select option_id from category_votes where round_id = ${gs.current_round_id} and participant_id = ${auth.participantId}`;
    if (v) vote = { roundId: gs.current_round_id, optionId: v.option_id };
  }

  const history = await db<
    {
      id: string;
      play_order: number | null;
      text: string;
      selected_positions: number[] | null;
      correct_positions: number[];
      is_correct: boolean | null;
      delta: number | null;
    }[]
  >`
    select sq.id, sq.play_order, qs.text, a.selected_positions, qs.correct_positions, a.is_correct, e.delta
    from session_questions sq
    join question_snapshots qs on qs.session_question_id = sq.id
    left join answer_submissions a on a.session_question_id = sq.id and a.participant_id = ${auth.participantId}
    left join score_events e on e.session_question_id = sq.id and e.participant_id = ${auth.participantId} and e.kind in ('answer', 'no_answer')
    where sq.session_id = ${auth.sessionId} and sq.revealed_at is not null
    order by sq.revealed_at desc
    limit 60`;

  return {
    participantId: auth.participantId,
    nickname: auth.nickname,
    points: t?.points ?? 0,
    rank: t?.rank ?? null,
    previousRank: t?.previous_rank ?? null,
    lastDelta: t?.last_delta ?? 0,
    totalPlayers: total,
    currentAnswer,
    currentResult,
    vote,
    history: history.map((h) => ({
      sessionQuestionId: h.id,
      number: h.play_order ?? 0,
      text: h.text,
      myPositions: h.selected_positions,
      correctPositions: h.correct_positions,
      isCorrect: h.is_correct ?? false,
      delta: h.delta,
    })),
  };
}

/** Rigenera il codice di recupero dell'identità del dispositivo. */
export async function regenerateRecoveryCode(db: Db, deviceToken: string): Promise<string | null> {
  const code = generateRecoveryCode();
  const rows = await db`
    update player_identities set recovery_code_hash = ${sha256(normalizeRecoveryCode(code))}
    where device_token_hash = ${sha256(deviceToken)} returning id`;
  return rows.length > 0 ? code : null;
}
