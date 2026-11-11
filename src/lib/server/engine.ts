import { randomBytes, randomInt } from "node:crypto";
import { getSql, num, type Tx } from "@/lib/database/db";
import { isCommandAllowed } from "@/lib/game-engine/transitions";
import { applyDelta, evaluateAnswer, scoreAnswer } from "@/lib/game-engine/scoring";
import { rankParticipants } from "@/lib/game-engine/ranking";
import { tallyVotes } from "@/lib/game-engine/voting";
import { balanceTeams, MIN_TEAMS, teamsEnabled } from "@/lib/game-engine/teams";
import { buildSpinPlan, WHEEL_DURATION_MS, WHEEL_LANDING, WHEEL_LEAD_MS, WHEEL_TURNS } from "@/lib/game-engine/wheel";
import {
  eventRoundKind,
  GameError,
  isCategoryRound,
  type GameCommand,
  type GamePhase,
  type PublicState,
  type QuestionRules,
  type QuestionType,
  type RoundKind,
  type SpecialEventParams,
  type SpecialEventType,
  type TieBreakMethod,
} from "@/lib/game-engine/types";
import type { CommandInput } from "@/lib/validation/schemas";
import { buildPublicState, loadStateRow, type StateRow } from "./public-state";
import { broadcastState } from "./realtime";
import { effectiveSettings, loadGlobalSettings, type EffectiveSessionSettings } from "./settings";
import { rulesForQuestion } from "./rules";
import { optionsReadMs } from "./read-time";
import { directAfterScore, directFinalRoundStart } from "./show";
import { computeSessionTeamStandings, rerankTeams } from "./teams";
import { scheduleSessionPrep, schedulePrewarm } from "./tts-prewarm";
import { PALMINO_DECIDES_PREFIX } from "@/features/game/script";

export interface Actor {
  userId: string | null;
  email: string | null;
  ip?: string | null;
}

export interface CommandResult {
  state: PublicState;
  duplicate: boolean;
  result: Record<string, unknown> | null;
}

interface Ctx {
  tx: Tx;
  st: StateRow;
  settings: EffectiveSessionSettings;
  actor: Actor;
  args: CommandInput["args"];
  sessionId: string;
}

interface HandlerOutput {
  to: GamePhase;
  /** Campi di game_state da aggiornare (oltre a fase e versione). */
  patch?: Partial<{
    current_round_id: string | null;
    current_session_question_id: string | null;
    forced_next_sq_id: string | null;
    questions_played: number;
    active_event_id: string | null;
    paused_from_phase: GamePhase | null;
    paused_remaining_ms: number | null;
    paused_at: null;
  }>;
  result?: Record<string, unknown>;
}

type Handler = (ctx: Ctx) => Promise<HandlerOutput>;

const randomUnit = () => randomInt(0, 2 ** 32) / 2 ** 32;

// ===========================================================================
// Esecuzione di un comando di regia
// ===========================================================================
export async function executeCommand(sessionId: string, actor: Actor, input: CommandInput): Promise<CommandResult> {
  const from: { phase: GamePhase | null } = { phase: null };
  const res = await runCommand(sessionId, actor, input, (p) => {
    from.phase = p;
  });
  // Dopo il commit: voci delle battute live in background (mai bloccante).
  if (!res.duplicate && from.phase) schedulePrewarm(from.phase, res.state);
  // Apertura della lobby: "Prepara voci" automatico mentre la gente entra.
  if (!res.duplicate && input.command === "OPEN_LOBBY") scheduleSessionPrep(sessionId);
  return res;
}

async function runCommand(sessionId: string, actor: Actor, input: CommandInput, onFrom: (phase: GamePhase) => void): Promise<CommandResult> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const st = await loadStateRow(tx, sessionId, "update");
    if (!st) throw new GameError("NOT_FOUND", "Sessione non trovata o non pubblicata");
    onFrom(st.phase);

    // Idempotenza: lo stesso comando (stesso commandId) non viene mai rieseguito.
    const dup = await tx<{ version: number }[]>`
      select version from game_events where session_id = ${sessionId} and command_id = ${input.commandId}`;
    if (dup.length > 0) {
      const state = await buildPublicState(tx, sessionId);
      return { state: state!, duplicate: true, result: null };
    }
    if (input.expectedVersion !== undefined && input.expectedVersion !== num(st.version)) {
      throw new GameError("VERSION_CONFLICT", "Lo stato è cambiato nel frattempo: aggiorna la regia e riprova", {
        currentVersion: num(st.version),
      });
    }
    if (!isCommandAllowed(st.phase, input.command, st.is_test)) {
      throw new GameError("INVALID_TRANSITION", `Comando ${input.command} non consentito nella fase ${st.phase}`, {
        phase: st.phase,
      });
    }
    if (st.phase === "WHEEL_SPIN" && LEAVE_WHEEL_COMMANDS.includes(input.command) && !input.args?.force) {
      await assertWheelStopped(tx, st);
    }

    const settings = effectiveSettings(await loadGlobalSettings(tx), st.settings);
    const ctx: Ctx = { tx, st, settings, actor, args: input.args ?? {}, sessionId };
    const out = await HANDLERS[input.command](ctx);

    const patch = { ...out.patch, phase: out.to };
    const changed = out.to !== st.phase;
    await tx`
      update game_state set ${tx(patch)},
        version = version + 1,
        last_command_id = ${input.commandId},
        updated_at = clock_timestamp(),
        phase_started_at = case when ${changed}::boolean then clock_timestamp() else phase_started_at end
      where session_id = ${sessionId}`;

    await tx`
      insert into game_events (session_id, version, command, from_phase, to_phase, payload, command_id, actor)
      values (${sessionId}, ${num(st.version) + 1}, ${input.command}, ${st.phase}, ${out.to},
              ${tx.json(JSON.parse(JSON.stringify({ args: ctx.args, result: out.result ?? null })))},
              ${input.commandId}, ${actor.userId})`;

    await tx`
      insert into admin_audit_logs (actor, actor_email, action, session_id, target_type, target_id, details, ip)
      values (${actor.userId}, ${actor.email}, ${"live." + input.command.toLowerCase()}, ${sessionId}, 'game_state', ${sessionId},
              ${tx.json(JSON.parse(JSON.stringify({ from: st.phase, to: out.to, args: ctx.args })))}, ${actor.ip ?? null})`;

    const state = await buildPublicState(tx, sessionId);
    if (!state) throw new GameError("NOT_FOUND", "Stato non disponibile");
    await broadcastState(tx, state);
    return { state, duplicate: false, result: out.result ?? null };
  });
}

/** Ripubblica lo stato corrente (es. dopo una modifica collaterale). */
export async function rebroadcast(sessionId: string): Promise<PublicState | null> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const state = await buildPublicState(tx, sessionId);
    if (state) await broadcastState(tx, state);
    return state;
  });
}

// ===========================================================================
// Helper
// ===========================================================================
interface RoundRow {
  id: string;
  position: number;
  kind: RoundKind;
  title: string;
  vote_duration_seconds: number;
  vote_tie_break: TieBreakMethod;
  vote_opened_at: Date | null;
  vote_closed_at: Date | null;
  winning_option_id: string | null;
  wheel_spun_at: Date | null;
}

async function getRound(tx: Tx, roundId: string | null): Promise<RoundRow | null> {
  if (!roundId) return null;
  const [r] = await tx<RoundRow[]>`
    select id, position, kind, title, vote_duration_seconds, vote_tie_break, vote_opened_at, vote_closed_at, winning_option_id, wheel_spun_at
    from game_rounds where id = ${roundId}`;
  return r ?? null;
}

type NextQuestion = { id: string; source: "current" | "forced" | "sequence" };

/** Determina la prossima domanda da mostrare senza modificare nulla. */
export async function resolveNextQuestion(tx: Tx, st: StateRow): Promise<NextQuestion | { blocked: "VOTE_PENDING" } | null> {
  if (st.current_session_question_id) {
    const [c] = await tx<{ options_opened_at: Date | null }[]>`
      select options_opened_at from session_questions where id = ${st.current_session_question_id}`;
    if (c && c.options_opened_at === null) return { id: st.current_session_question_id, source: "current" };
  }
  if (st.forced_next_sq_id) return { id: st.forced_next_sq_id, source: "forced" };
  const round = await getRound(tx, st.current_round_id);
  if (!round) return null;
  if (isCategoryRound(round.kind) && !round.winning_option_id) return { blocked: "VOTE_PENDING" };
  const [q] = await tx<{ id: string }[]>`
    select id from session_questions
    where round_id = ${round.id} and not is_reserve and shown_at is null and options_opened_at is null
      and (vote_option_id is null or vote_option_id = ${round.winning_option_id})
    order by position limit 1`;
  return q ? { id: q.id, source: "sequence" } : null;
}

/** Comandi che fanno uscire dalla ruota: rifiutati finché gira (salvo conferma esplicita con "force"). */
const LEAVE_WHEEL_COMMANDS: readonly GameCommand[] = ["SHOW_QUESTION", "ACTIVATE_EVENT", "SHOW_LEADERBOARD"];

async function assertWheelStopped(tx: Tx, st: StateRow) {
  if (!st.current_round_id) return;
  const [r] = await tx<{ ms: number }[]>`
    select greatest(0, ceil(extract(epoch from (
      wheel_spun_at + make_interval(secs => coalesce((wheel_spin->>'durationMs')::float8, 0) / 1000) - clock_timestamp())) * 1000))::int as ms
    from game_rounds where id = ${st.current_round_id} and wheel_spun_at is not null`;
  if (r && r.ms > 0) {
    throw new GameError("WHEEL_SPINNING", "La ruota sta ancora girando: aspetta che si fermi", { remainingMs: r.ms });
  }
}

async function requireCurrentQuestion(ctx: Ctx) {
  const id = ctx.st.current_session_question_id;
  if (!id) throw new GameError("INVALID_TRANSITION", "Nessuna domanda corrente");
  const [q] = await ctx.tx<
    {
      id: string;
      shown_at: Date | null;
      options_opened_at: Date | null;
      answers_close_at: Date | null;
      answers_closed_at: Date | null;
      revealed_at: Date | null;
      scored_at: Date | null;
      rules: QuestionRules | null;
      correct_positions: number[];
      type: QuestionType;
      timer_running: boolean;
    }[]
  >`
    select sq.id, sq.shown_at, sq.options_opened_at, sq.answers_close_at, sq.answers_closed_at, sq.revealed_at,
           sq.scored_at, sq.rules, qs.correct_positions, qs.type,
           coalesce(sq.answers_close_at > clock_timestamp(), false) as timer_running
    from session_questions sq join question_snapshots qs on qs.session_question_id = sq.id
    where sq.id = ${id}`;
  if (!q) throw new GameError("NOT_FOUND", "Domanda corrente non trovata");
  return q;
}

async function lockAnswers(tx: Tx, sqId: string) {
  await tx`
    update session_questions
    set answers_closed_at = coalesce(answers_closed_at, clock_timestamp()),
        answers_close_at = least(answers_close_at, clock_timestamp())
    where id = ${sqId}`;
}

/** Ricalcola le posizioni in classifica (criteri deterministici). */
export async function rerank(tx: Tx, sessionId: string): Promise<void> {
  const rows = await tx<
    {
      participantId: string;
      nickname: string;
      joinedAt: Date;
      points: number;
      correctCount: number;
      correctResponseMs: number;
    }[]
  >`
    select p.id as "participantId", p.nickname, p.joined_at as "joinedAt", t.points, t.correct_count as "correctCount",
           t.correct_response_ms as "correctResponseMs"
    from participants p join score_totals t on t.participant_id = p.id
    where p.session_id = ${sessionId} and p.status = 'active'`;
  if (rows.length > 0) {
    const ranked = rankParticipants(
      rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString(), correctResponseMs: num(r.correctResponseMs) })),
    );
    await tx`
      update score_totals t
      set previous_rank = case when t.rank is distinct from v.rank then t.rank else t.previous_rank end,
          rank = v.rank, updated_at = now()
      from (select unnest(${tx.array(ranked.map((r) => r.participantId))}::uuid[]) as pid,
                   unnest(${tx.array(ranked.map((r) => r.rank))}::int[]) as rank) v
      where t.participant_id = v.pid`;
  }
  await tx`
    update score_totals t set rank = null
    from participants p where p.id = t.participant_id and p.session_id = ${sessionId} and p.status <> 'active'`;
  // classifica a squadre (solo se la serata è a squadre)
  await rerankTeams(tx, sessionId);
}

// ===========================================================================
// Handler dei comandi
// ===========================================================================
const HANDLERS: Record<GameCommand, Handler> = {
  async OPEN_LOBBY({ tx, sessionId }) {
    await tx`update game_sessions set status = 'live' where id = ${sessionId}`;
    return { to: "LOBBY" };
  },

  async START_INTRO({ tx, sessionId }) {
    await tx`update game_state set intro_started_at = clock_timestamp() where session_id = ${sessionId}`;
    await tx`update game_sessions set started_at = coalesce(started_at, clock_timestamp()) where id = ${sessionId}`;
    return { to: "INTRO" };
  },

  async SKIP_INTRO({ tx, sessionId }) {
    // Il TV salta direttamente al fotogramma finale (logo + personaggi).
    await tx`update game_state set intro_started_at = clock_timestamp() - interval '10 minutes' where session_id = ${sessionId}`;
    return { to: "INTRO", result: { skipped: true } };
  },

  async START_ROUND({ tx, st, args, sessionId }) {
    let round: RoundRow | undefined;
    if (args.roundId) {
      [round] = await tx<RoundRow[]>`
        select id, position, kind, title, vote_duration_seconds, vote_tie_break, vote_opened_at, vote_closed_at, winning_option_id, wheel_spun_at
        from game_rounds where id = ${args.roundId} and session_id = ${sessionId} and started_at is null`;
      if (!round) throw new GameError("NOT_FOUND", "Round non trovato o già giocato");
    } else {
      [round] = await tx<RoundRow[]>`
        select id, position, kind, title, vote_duration_seconds, vote_tie_break, vote_opened_at, vote_closed_at, winning_option_id, wheel_spun_at
        from game_rounds
        where session_id = ${sessionId} and started_at is null
          and position > coalesce((select position from game_rounds where id = ${st.current_round_id}), -1)
        order by position limit 1`;
      if (!round) throw new GameError("NO_MORE_ROUNDS", "Non ci sono altri round: puoi terminare la partita");
    }
    await tx`update game_rounds set started_at = clock_timestamp() where id = ${round.id}`;
    await tx`update game_sessions set started_at = coalesce(started_at, clock_timestamp()) where id = ${sessionId}`;
    // Regia automatica: all'inizio della finale un presentatore nomina primo e secondo.
    await tx`update game_state set show_lines = null where session_id = ${sessionId}`;
    let showLines = 0;
    if (round.kind === "final") {
      try {
        const r = round;
        showLines = (await tx.savepoint((sp) => directFinalRoundStart(sp, sessionId, r.id))).length;
      } catch (e) {
        console.warn("[quizzone] regia automatica della finale non riuscita", e instanceof Error ? e.message : e);
      }
    }
    return {
      to: "ROUND_INTRO",
      patch: { current_round_id: round.id, current_session_question_id: null, forced_next_sq_id: null, active_event_id: null },
      result: { roundId: round.id, title: round.title, showLines },
    };
  },

  async START_VOTE({ tx, st }) {
    const round = await getRound(tx, st.current_round_id);
    if (!round || round.kind !== "category_vote") throw new GameError("INVALID_TRANSITION", "Il round corrente non prevede una votazione");
    if (round.vote_opened_at) throw new GameError("INVALID_TRANSITION", "La votazione di questo round è già stata svolta");
    const [{ c }] = await tx<{ c: number }[]>`select count(*)::int as c from category_vote_options where round_id = ${round.id}`;
    if (c < 2) throw new GameError("VALIDATION", "Servono almeno 2 categorie votabili");
    await tx`
      update game_rounds set vote_opened_at = clock_timestamp(),
        vote_closes_at = clock_timestamp() + make_interval(secs => ${round.vote_duration_seconds}::int)
      where id = ${round.id}`;
    return { to: "CATEGORY_VOTING", result: { roundId: round.id } };
  },

  async CLOSE_VOTE({ tx, st, args }) {
    const round = await getRound(tx, st.current_round_id);
    if (!round) throw new GameError("NOT_FOUND", "Round non trovato");
    const options = await tx<{ id: string; position: number; label: string }[]>`
      select id, position, label from category_vote_options where round_id = ${round.id} order by position`;
    const votes = await tx<{ optionId: string }[]>`select option_id as "optionId" from category_votes where round_id = ${round.id}`;
    const tally = tallyVotes(options, votes, round.vote_tie_break, args.adminChoice ?? null, randomUnit);
    await tx`
      update game_rounds set vote_closed_at = clock_timestamp(),
        vote_closes_at = least(vote_closes_at, clock_timestamp()),
        winning_option_id = ${tally.winnerOptionId},
        vote_result = ${tx.json(JSON.parse(JSON.stringify(tally)))}
      where id = ${round.id}`;
    const winner = options.find((o) => o.id === tally.winnerOptionId);
    return { to: "CATEGORY_RESULT", result: { winner: winner?.label, ...tally } };
  },

  async SPIN_WHEEL({ tx, st }) {
    const round = await getRound(tx, st.current_round_id);
    if (!round || round.kind !== "category_wheel") throw new GameError("INVALID_TRANSITION", "Il round corrente non prevede la ruota");
    if (round.wheel_spun_at || round.winning_option_id) throw new GameError("INVALID_TRANSITION", "La ruota di questo round è già stata girata");
    const options = await tx<{ id: string; position: number; label: string }[]>`
      select id, position, label from category_vote_options where round_id = ${round.id} order by position`;
    if (options.length < 2) throw new GameError("VALIDATION", "Servono almeno 2 categorie sulla ruota");
    // Estrazione con casualità crittografica: decide il server, i TV disegnano soltanto.
    const winnerIndex = randomInt(0, options.length);
    const plan = buildSpinPlan(options.length, winnerIndex, {
      turns: randomInt(WHEEL_TURNS.min, WHEEL_TURNS.max + 1),
      landing: WHEEL_LANDING.min + (randomInt(0, 1001) / 1000) * (WHEEL_LANDING.max - WHEEL_LANDING.min),
      durationMs: randomInt(WHEEL_DURATION_MS.min, WHEEL_DURATION_MS.max + 1),
    });
    const winner = options[winnerIndex];
    const stored = { ...plan, winnerOptionId: winner.id, optionIds: options.map((o) => o.id) };
    await tx`
      update game_rounds set wheel_spun_at = clock_timestamp() + make_interval(secs => ${WHEEL_LEAD_MS / 1000}::float8),
        wheel_spin = ${tx.json(stored)}, winning_option_id = ${winner.id}
      where id = ${round.id}`;
    return { to: "WHEEL_SPIN", result: { roundId: round.id, winner: winner.label, winnerOptionId: winner.id, plan } };
  },

  async SHOW_QUESTION(ctx) {
    const { tx, st, settings } = ctx;
    const next = await resolveNextQuestion(tx, st);
    if (next && "blocked" in next) {
      const round = await getRound(tx, st.current_round_id);
      throw new GameError("INVALID_TRANSITION", round?.kind === "category_wheel" ? "Prima gira la ruota" : "Prima completa la votazione della categoria");
    }
    if (!next) throw new GameError("NO_MORE_QUESTIONS", "Domande del round terminate: inizia il prossimo round o termina");

    // Evento programmato su questa domanda: Palmino lo annuncia PRIMA della domanda.
    if (settings.autoEvents && st.phase !== "SPECIAL_EVENT") {
      const [ev] = await tx<{ id: string }[]>`
        select id from special_events
        where target_session_question_id = ${next.id} and status = 'scheduled' and source = 'scheduled'
        order by created_at limit 1`;
      if (ev) {
        await tx`update special_events set status = 'announced', announced_at = clock_timestamp() where id = ${ev.id}`;
        return {
          to: "SPECIAL_EVENT",
          patch: {
            current_session_question_id: next.id,
            forced_next_sq_id: next.source === "forced" ? null : st.forced_next_sq_id,
            active_event_id: ev.id,
          },
          result: { eventId: ev.id, scheduled: true },
        };
      }
    }

    const [cur] = await tx<{ shown_at: Date | null }[]>`select shown_at from session_questions where id = ${next.id}`;
    const newlyShown = !cur?.shown_at;
    await tx`
      update session_questions set shown_at = coalesce(shown_at, clock_timestamp()),
        play_order = coalesce(play_order, ${st.questions_played + 1}::int)
      where id = ${next.id}`;
    const [ev] = await tx<{ id: string }[]>`
      select id from special_events where target_session_question_id = ${next.id} and status = 'announced'
      order by created_at desc limit 1`;
    return {
      to: "QUESTION_VISIBLE",
      patch: {
        current_session_question_id: next.id,
        forced_next_sq_id: next.source === "forced" ? null : st.forced_next_sq_id,
        questions_played: st.questions_played + (newlyShown ? 1 : 0),
        active_event_id: ev?.id ?? null,
      },
      result: { sessionQuestionId: next.id },
    };
  },

  async SHOW_OPTIONS(ctx) {
    const q = await requireCurrentQuestion(ctx);
    if (q.options_opened_at) throw new GameError("INVALID_TRANSITION", "Le risposte sono già state mostrate");
    const rules = await rulesForQuestion(ctx.tx, q.id, ctx.settings.allowNegative);
    if (!rules) throw new GameError("NOT_FOUND", "Regole della domanda non disponibili");
    // Le risposte compaiono subito, ma il tempo parte quando il presentatore ha finito di leggerle.
    const readSec = (await optionsReadMs(q.id)) / 1000;
    await ctx.tx`
      update session_questions set rules = ${ctx.tx.json(JSON.parse(JSON.stringify(rules)))},
        options_opened_at = clock_timestamp() + make_interval(secs => ${readSec}::float8),
        answers_close_at = clock_timestamp() + make_interval(secs => ${readSec + rules.durationSeconds}::float8)
      where id = ${q.id}`;
    await ctx.tx`update special_events set status = 'applied' where target_session_question_id = ${q.id} and status = 'announced'`;
    return { to: "OPTIONS_VISIBLE", result: { durationSeconds: rules.durationSeconds } };
  },

  async CLOSE_ANSWERS(ctx) {
    const q = await requireCurrentQuestion(ctx);
    await lockAnswers(ctx.tx, q.id);
    return { to: "ANSWERS_LOCKED" };
  },

  async REVEAL(ctx) {
    const { tx, st, args } = ctx;
    const q = await requireCurrentQuestion(ctx);
    if (st.phase === "OPTIONS_VISIBLE" && q.timer_running && !args.force && !st.is_test) {
      throw new GameError("TIMER_RUNNING", "Il tempo non è ancora scaduto: conferma per rivelare comunque la soluzione");
    }
    await lockAnswers(tx, q.id);
    const subs = await tx<{ id: string; selected_positions: number[] }[]>`
      select id, selected_positions from answer_submissions where session_question_id = ${q.id}`;
    if (subs.length > 0) {
      const evals = subs.map((s) => ({ id: s.id, ...evaluateAnswer(s.selected_positions, q.correct_positions) }));
      await tx`
        update answer_submissions a set is_correct = v.ok, correct_hits = v.ch, wrong_hits = v.wh
        from (select unnest(${tx.array(evals.map((e) => e.id))}::uuid[]) as id,
                     unnest(${tx.array(evals.map((e) => e.isCorrect))}::boolean[]) as ok,
                     unnest(${tx.array(evals.map((e) => e.correctHits))}::smallint[]) as ch,
                     unnest(${tx.array(evals.map((e) => e.wrongHits))}::smallint[]) as wh) v
        where a.id = v.id`;
    }
    await tx`update session_questions set revealed_at = coalesce(revealed_at, clock_timestamp()) where id = ${q.id}`;
    return { to: "ANSWER_REVEAL", result: { answers: subs.length } };
  },

  async SCORE(ctx) {
    const { tx, sessionId, actor } = ctx;
    const q = await requireCurrentQuestion(ctx);
    if (q.scored_at) return { to: "SCORE_REVEAL", result: { alreadyScored: true } };
    if (!q.rules) throw new GameError("INVALID_TRANSITION", "Regole non congelate: le risposte non sono mai state aperte");
    const rules = q.rules;

    // Partecipano alla domanda i giocatori attivi entrati prima della chiusura.
    const players = await tx<{ id: string; points: number }[]>`
      select p.id, t.points
      from participants p join score_totals t on t.participant_id = p.id
      where p.session_id = ${sessionId} and p.status = 'active'
        and p.joined_at <= coalesce(${q.answers_closed_at}::timestamptz, ${q.answers_close_at}::timestamptz, clock_timestamp())
      order by p.id
      for update of t`;
    const answers = await tx<{ participant_id: string; selected_positions: number[]; response_ms: number }[]>`
      select participant_id, selected_positions, response_ms from answer_submissions where session_question_id = ${q.id}`;
    const byPlayer = new Map(answers.map((a) => [a.participant_id, a]));

    const ev = { pid: [] as string[], kind: [] as string[], before: [] as number[], delta: [] as number[], after: [] as number[], reason: [] as string[], details: [] as string[] };
    const tot = { pid: [] as string[], points: [] as number[], correct: [] as number[], answered: [] as number[], ms: [] as number[], last: [] as number[] };
    let correctCount = 0;
    for (const p of players) {
      const a = byPlayer.get(p.id);
      const outcome = scoreAnswer(rules, q.correct_positions, a ? { selectedPositions: a.selected_positions, responseMs: a.response_ms } : null);
      const applied = applyDelta(p.points, outcome.delta, rules.allowNegative);
      ev.pid.push(p.id);
      ev.kind.push(outcome.kind);
      ev.before.push(p.points);
      ev.delta.push(applied.delta);
      ev.after.push(applied.after);
      ev.reason.push(outcome.reason);
      ev.details.push(
        JSON.stringify({
          base: outcome.details.base,
          bonus: outcome.details.bonus,
          speedBonus: outcome.details.speedBonus,
          correctHits: outcome.details.correctHits,
          wrongHits: outcome.details.wrongHits,
          totalCorrect: outcome.details.totalCorrect,
          partial: outcome.partial,
          clamped: applied.delta !== outcome.delta,
          modifiers: rules.modifiers,
        }),
      );
      tot.pid.push(p.id);
      tot.points.push(applied.after);
      tot.correct.push(outcome.isCorrect ? 1 : 0);
      tot.answered.push(a ? 1 : 0);
      tot.ms.push(outcome.isCorrect && a ? a.response_ms : 0);
      tot.last.push(applied.delta);
      if (outcome.isCorrect) correctCount++;
    }
    if (players.length > 0) {
      await tx`
        insert into score_events (session_id, participant_id, session_question_id, kind, points_before, delta, points_after, reason, details, created_by)
        select ${sessionId}, v.pid, ${q.id}, v.kind::score_event_kind, v.before, v.delta, v.after, v.reason, v.details::jsonb, ${actor.userId}
        from unnest(${tx.array(ev.pid)}::uuid[], ${tx.array(ev.kind)}::text[], ${tx.array(ev.before)}::int[],
                    ${tx.array(ev.delta)}::int[], ${tx.array(ev.after)}::int[], ${tx.array(ev.reason)}::text[], ${tx.array(ev.details)}::text[])
             as v(pid, kind, before, delta, after, reason, details)
        on conflict do nothing`;
      await tx`
        update score_totals t set points = v.points, correct_count = t.correct_count + v.correct,
          answered_count = t.answered_count + v.answered, correct_response_ms = t.correct_response_ms + v.ms,
          last_delta = v.last, updated_at = now()
        from unnest(${tx.array(tot.pid)}::uuid[], ${tx.array(tot.points)}::int[], ${tx.array(tot.correct)}::int[],
                    ${tx.array(tot.answered)}::int[], ${tx.array(tot.ms)}::bigint[], ${tx.array(tot.last)}::int[])
             as v(pid, points, correct, answered, ms, last)
        where t.participant_id = v.pid`;
    }
    // Chi è entrato dopo la chiusura non riceve variazioni su questa domanda.
    await tx`
      update score_totals t set last_delta = 0
      from participants p
      where p.id = t.participant_id and p.session_id = ${sessionId}
        and not (p.id = any(${tx.array(tot.pid.length ? tot.pid : ["00000000-0000-0000-0000-000000000000"])}::uuid[]))`;
    await tx`update session_questions set scored_at = clock_timestamp() where id = ${q.id}`;
    await rerank(tx, sessionId);
    // Regia automatica: battute con i nomi veri, dagli eventi reali della classifica.
    await tx`update game_state set show_lines = null where session_id = ${sessionId}`;
    let showLines = 0;
    try {
      showLines = (await tx.savepoint((sp) => directAfterScore(sp, sessionId, q.id))).length;
    } catch (e) {
      console.warn("[quizzone] regia automatica non riuscita (i punti sono salvi)", e instanceof Error ? e.message : e);
    }
    return { to: "SCORE_REVEAL", result: { scored: players.length, correct: correctCount, showLines } };
  },

  async SHOW_LEADERBOARD() {
    return { to: "LEADERBOARD" };
  },

  async ACTIVATE_EVENT(ctx) {
    const { tx, st, args, settings, sessionId, actor } = ctx;
    if (!args.definitionKey) throw new GameError("VALIDATION", "Specifica quale evento attivare");
    const [def] = await tx<DefRow[]>`
      select id, key, type, title, tagline, params, max_per_session, allowed_round_kinds::text[] as allowed_round_kinds
      from special_event_definitions where key = ${args.definitionKey} and enabled`;
    if (!def) throw new GameError("NOT_FOUND", "Evento non trovato o disattivato");
    if (def.type !== "palmino_decides") {
      const [{ used }] = await tx<{ used: number }[]>`
        select count(*)::int as used from special_events
        where session_id = ${sessionId} and definition_id = ${def.id} and status <> 'cancelled' and source <> 'scheduled'`;
      if (used >= def.max_per_session) {
        throw new GameError("EVENT_LIMIT", `Limite raggiunto: ${def.title} può essere usato al massimo ${def.max_per_session} volte`);
      }
    }

    let target: string | null = null;
    if (def.type === "mystery_question") {
      if (st.phase === "QUESTION_VISIBLE") throw new GameError("EVENT_NOT_ALLOWED", "La domanda è già visibile: attiva la domanda misteriosa tra una domanda e l'altra");
      const [reserve] = args.reserveQuestionId
        ? await tx<{ id: string }[]>`
            select id from session_questions where id = ${args.reserveQuestionId} and session_id = ${sessionId} and is_reserve and shown_at is null`
        : await tx<{ id: string }[]>`
            select sq.id from session_questions sq join game_rounds r on r.id = sq.round_id
            where sq.session_id = ${sessionId} and sq.is_reserve and sq.shown_at is null
            order by r.position, sq.position limit 1`;
      if (!reserve) throw new GameError("EVENT_NOT_ALLOWED", "Nessuna domanda di riserva disponibile (preparala nella sessione)");
      target = reserve.id;
    } else if (st.phase === "QUESTION_VISIBLE") {
      target = st.current_session_question_id;
    } else {
      const next = await resolveNextQuestion(tx, st);
      target = next && !("blocked" in next) ? next.id : null;
    }
    if (!target) throw new GameError("EVENT_NOT_ALLOWED", "Non c'è una domanda successiva a cui applicare l'evento");

    const [{ kind: targetKind }] = await tx<{ kind: RoundKind }[]>`
      select r.kind from session_questions sq join game_rounds r on r.id = sq.round_id where sq.id = ${target}`;

    let chosen = def;
    let source: "manual" | "palmino_decides" = "manual";
    let decidedFrom: Record<string, unknown> | null = null;
    const usage = async (defId: string) => {
      const [{ c }] = await tx<{ c: number }[]>`
        select count(*)::int as c from special_events
        where session_id = ${sessionId} and definition_id = ${defId} and status <> 'cancelled' and source <> 'scheduled'`;
      return c;
    };

    if (def.type === "palmino_decides") {
      const [{ c }] = await tx<{ c: number }[]>`
        select count(*)::int as c from special_events where session_id = ${sessionId} and source = 'palmino_decides'`;
      if (c >= def.max_per_session) throw new GameError("EVENT_LIMIT", "Palmino ha già deciso abbastanza per stasera");
      const pool = await tx<DefRow[]>`
        select id, key, type, title, tagline, params, max_per_session, allowed_round_kinds::text[] as allowed_round_kinds
        from special_event_definitions
        where key = any(${tx.array(settings.palminoPool)}::text[]) and enabled
          and type not in ('palmino_decides', 'mystery_question')
        order by key`;
      const eligible: DefRow[] = [];
      for (const p of pool) {
        if (!p.allowed_round_kinds.includes(eventRoundKind(targetKind))) continue;
        if ((await usage(p.id)) >= p.max_per_session) continue;
        eligible.push(p);
      }
      if (eligible.length === 0) throw new GameError("EVENT_LIMIT", "Nessun evento disponibile nel mazzo di Palmino");
      const r = randomUnit();
      chosen = eligible[Math.min(eligible.length - 1, Math.floor(r * eligible.length))];
      source = "palmino_decides";
      decidedFrom = { pool: eligible.map((e) => e.key), chosen: chosen.key, random: r };
    } else {
      if (!def.allowed_round_kinds.includes(eventRoundKind(targetKind))) {
        throw new GameError("EVENT_NOT_ALLOWED", `L'evento ${def.title} non è previsto per questo tipo di round`);
      }
      if ((await usage(def.id)) >= def.max_per_session) {
        throw new GameError("EVENT_LIMIT", `Limite raggiunto: ${def.title} può essere usato al massimo ${def.max_per_session} volte`);
      }
    }

    const [existing] = await tx<{ id: string }[]>`
      select id from special_events
      where target_session_question_id = ${target} and type = ${chosen.type} and status in ('announced', 'applied')`;
    if (existing) throw new GameError("EVENT_NOT_ALLOWED", "Questo evento è già attivo sulla domanda");

    const tagline = source === "palmino_decides" ? `${PALMINO_DECIDES_PREFIX}${chosen.tagline}` : chosen.tagline;
    const [created] = await tx<{ id: string }[]>`
      insert into special_events (session_id, definition_id, type, title, tagline, params, target_session_question_id,
                                  status, source, decided_from, announced_at, created_by)
      values (${sessionId}, ${chosen.id}, ${chosen.type}, ${chosen.title}, ${tagline}, ${tx.json(chosen.params as Record<string, number>)},
              ${target}, 'announced', ${source}, ${decidedFrom ? tx.json(JSON.parse(JSON.stringify(decidedFrom))) : null},
              clock_timestamp(), ${actor.userId})
      returning id`;
    return {
      to: "SPECIAL_EVENT",
      patch: {
        active_event_id: created.id,
        current_session_question_id: target,
        forced_next_sq_id: def.type === "mystery_question" ? null : st.forced_next_sq_id,
      },
      result: { eventId: created.id, type: chosen.type, title: chosen.title, decidedFrom },
    };
  },

  async PAUSE({ tx, st, sessionId }) {
    let remaining: number | null = null;
    if (st.phase === "OPTIONS_VISIBLE" && st.current_session_question_id) {
      const [r] = await tx<{ ms: number }[]>`
        select greatest(0, floor(extract(epoch from (answers_close_at - clock_timestamp())) * 1000))::int as ms
        from session_questions where id = ${st.current_session_question_id}`;
      remaining = r?.ms ?? 0;
    } else if (st.phase === "CATEGORY_VOTING" && st.current_round_id) {
      const [r] = await tx<{ ms: number }[]>`
        select greatest(0, floor(extract(epoch from (vote_closes_at - clock_timestamp())) * 1000))::int as ms
        from game_rounds where id = ${st.current_round_id}`;
      remaining = r?.ms ?? 0;
    }
    await tx`update game_state set paused_at = clock_timestamp() where session_id = ${sessionId}`;
    return { to: "PAUSED", patch: { paused_from_phase: st.phase, paused_remaining_ms: remaining } };
  },

  async RESUME({ tx, st, sessionId }) {
    const from = st.paused_from_phase;
    if (!from) throw new GameError("INVALID_TRANSITION", "Stato di pausa non valido");
    const remaining = st.paused_remaining_ms;
    if (from === "OPTIONS_VISIBLE" && st.current_session_question_id && remaining && remaining > 0) {
      await tx`
        update session_questions set answers_close_at = clock_timestamp() + make_interval(secs => ${remaining / 1000}::float8)
        where id = ${st.current_session_question_id}`;
      // pausa durante la lettura delle risposte: anche la partenza del tempo slitta della durata della pausa
      await tx`
        update session_questions sq set options_opened_at = sq.options_opened_at + (clock_timestamp() - gs.paused_at)
        from game_state gs
        where sq.id = ${st.current_session_question_id} and gs.session_id = ${sessionId}
          and gs.paused_at is not null and sq.options_opened_at > gs.paused_at`;
    }
    if (from === "CATEGORY_VOTING" && st.current_round_id && remaining && remaining > 0) {
      await tx`
        update game_rounds set vote_closes_at = clock_timestamp() + make_interval(secs => ${remaining / 1000}::float8)
        where id = ${st.current_round_id}`;
    }
    if (from === "INTRO") {
      await tx`
        update game_state set intro_started_at = intro_started_at + (clock_timestamp() - paused_at)
        where session_id = ${sessionId} and paused_at is not null and intro_started_at is not null`;
    }
    if (from === "WHEEL_SPIN" && st.current_round_id) {
      // la ruota riparte da dove si era fermata: l'inizio del giro slitta della durata della pausa
      await tx`
        update game_rounds r set wheel_spun_at = r.wheel_spun_at + (clock_timestamp() - gs.paused_at)
        from game_state gs
        where r.id = ${st.current_round_id} and gs.session_id = ${sessionId} and gs.paused_at is not null
          and r.wheel_spun_at is not null
          and gs.paused_at < r.wheel_spun_at + make_interval(secs => coalesce((r.wheel_spin->>'durationMs')::float8, 0) / 1000)`;
    }
    return { to: from, patch: { paused_from_phase: null, paused_remaining_ms: null, paused_at: null } };
  },

  async FINISH({ tx, st, sessionId, settings }) {
    if (st.current_session_question_id) {
      await tx`
        update session_questions set answers_closed_at = coalesce(answers_closed_at, clock_timestamp()),
          answers_close_at = least(answers_close_at, clock_timestamp())
        where id = ${st.current_session_question_id} and options_opened_at is not null`;
    }
    await rerank(tx, sessionId);
    await tx`
      insert into leaderboards (session_id, participant_id, identity_id, nickname, final_rank, points, correct_count, is_test, session_date)
      select ${sessionId}, p.id, p.identity_id, p.nickname, t.rank, t.points, t.correct_count, s.is_test,
             (coalesce(s.scheduled_at, s.started_at, now()) at time zone 'Europe/Rome')::date
      from participants p
      join score_totals t on t.participant_id = p.id
      join game_sessions s on s.id = p.session_id
      where p.session_id = ${sessionId} and p.status = 'active' and not p.is_bot and t.rank is not null
      on conflict do nothing`;
    await tx`update game_sessions set status = 'finished', finished_at = clock_timestamp() where id = ${sessionId}`;
    // classifica finale a squadre registrata nel log della partita (le squadre non entrano nelle classifiche mensili)
    const teams = teamsEnabled(settings.teams.mode)
      ? (await computeSessionTeamStandings(tx, sessionId, settings.teams.aggregation)).standings.map((t) => ({ teamId: t.teamId, name: t.name, rank: t.rank, points: t.points, members: t.members }))
      : null;
    return {
      to: "FINISHED",
      patch: { paused_from_phase: null, paused_remaining_ms: null, paused_at: null, active_event_id: null },
      result: teams ? { teams, aggregation: settings.teams.aggregation } : undefined,
    };
  },

  async SET_JOIN({ tx, st, args, sessionId }) {
    const patch: Record<string, boolean> = {};
    if (args.joinLocked !== undefined) patch.joinLocked = args.joinLocked;
    if (args.allowLateJoin !== undefined) patch.allowLateJoin = args.allowLateJoin;
    if (Object.keys(patch).length === 0) throw new GameError("VALIDATION", "Nessuna impostazione da modificare");
    await tx`update game_sessions set settings = settings || ${tx.json(patch)} where id = ${sessionId}`;
    return { to: st.phase, result: patch };
  },

  async KICK({ tx, st, args, sessionId }) {
    if (!args.participantId) throw new GameError("VALIDATION", "Giocatore non specificato");
    const rows = await tx`
      update participants set status = 'kicked', kicked_at = clock_timestamp(), kick_reason = ${args.reason ?? null}
      where id = ${args.participantId} and session_id = ${sessionId} and status = 'active' returning id`;
    if (rows.length === 0) throw new GameError("NOT_FOUND", "Giocatore non trovato o già espulso");
    await rerank(tx, sessionId);
    return { to: st.phase, result: { participantId: args.participantId } };
  },

  async ADJUST_SCORE({ tx, st, args, sessionId, actor, settings }) {
    if (!args.participantId || !args.delta) throw new GameError("VALIDATION", "Indica giocatore e variazione di punti");
    if (!args.reason || args.reason.length < 3) throw new GameError("VALIDATION", "Indica il motivo della rettifica");
    const [t] = await tx<{ points: number }[]>`
      select t.points from score_totals t join participants p on p.id = t.participant_id
      where t.participant_id = ${args.participantId} and p.session_id = ${sessionId} for update of t`;
    if (!t) throw new GameError("NOT_FOUND", "Giocatore non trovato");
    const applied = applyDelta(t.points, args.delta, settings.allowNegative);
    await tx`
      insert into score_events (session_id, participant_id, kind, points_before, delta, points_after, reason, details, created_by)
      values (${sessionId}, ${args.participantId}, 'manual', ${t.points}, ${applied.delta}, ${applied.after},
              ${"Rettifica regia: " + args.reason}, ${tx.json({ requested: args.delta })}, ${actor.userId})`;
    await tx`update score_totals set points = ${applied.after}, last_delta = ${applied.delta}, updated_at = now() where participant_id = ${args.participantId}`;
    await rerank(tx, sessionId);
    return { to: st.phase, result: { delta: applied.delta, points: applied.after } };
  },

  async ASSIGN_TEAM({ tx, st, args, sessionId }) {
    if (!args.participantId) throw new GameError("VALIDATION", "Giocatore non specificato");
    if (args.teamId === undefined) throw new GameError("VALIDATION", "Squadra non specificata");
    const [p] = await tx<{ id: string; team_id: string | null }[]>`
      select id, team_id from participants
      where id = ${args.participantId} and session_id = ${sessionId} and status = 'active' for update`;
    if (!p) throw new GameError("NOT_FOUND", "Giocatore non trovato o espulso");
    let teamName: string | null = null;
    if (args.teamId) {
      const [t] = await tx<{ name: string }[]>`select name from teams where id = ${args.teamId} and session_id = ${sessionId}`;
      if (!t) throw new GameError("NOT_FOUND", "Squadra non trovata in questa serata");
      teamName = t.name;
    }
    await tx`update participants set team_id = ${args.teamId} where id = ${p.id}`;
    await rerankTeams(tx, sessionId);
    return { to: st.phase, result: { participantId: p.id, from: p.team_id, teamId: args.teamId, team: teamName } };
  },

  async BALANCE_TEAMS({ tx, st, args, sessionId }) {
    const teams = await tx<{ id: string; position: number }[]>`select id, position from teams where session_id = ${sessionId} order by position`;
    if (teams.length < MIN_TEAMS) throw new GameError("VALIDATION", `Servono almeno ${MIN_TEAMS} squadre per bilanciare`);
    const players = await tx<{ id: string; points: number; teamId: string | null }[]>`
      select p.id, coalesce(t.points, 0) as points, p.team_id as "teamId"
      from participants p left join score_totals t on t.participant_id = p.id
      where p.session_id = ${sessionId} and p.status = 'active'
      order by p.id
      for update of p`;
    const moves = balanceTeams(teams, players, { onlyUnassigned: args.onlyUnassigned ?? false });
    if (moves.length > 0) {
      await tx`
        update participants p set team_id = v.team
        from (select unnest(${tx.array(moves.map((m) => m.participantId))}::uuid[]) as pid,
                     unnest(${tx.array(moves.map((m) => m.teamId))}::uuid[]) as team) v
        where p.id = v.pid and p.session_id = ${sessionId}`;
    }
    await rerankTeams(tx, sessionId);
    return { to: st.phase, result: { moved: moves.length, players: players.length, onlyUnassigned: args.onlyUnassigned ?? false } };
  },

  async RESET_TEST({ tx, sessionId }) {
    await tx`select set_config('qz.allow_reset', 'on', true)`;
    await tx`delete from leaderboards where session_id = ${sessionId}`;
    await tx`delete from category_votes where session_id = ${sessionId}`;
    await tx`delete from score_events where session_id = ${sessionId}`;
    await tx`delete from participants where session_id = ${sessionId}`;
    await tx`delete from special_events where session_id = ${sessionId} and source <> 'scheduled'`;
    await tx`update special_events set status = 'scheduled', announced_at = null where session_id = ${sessionId}`;
    await tx`
      update session_questions set shown_at = null, options_opened_at = null, answers_close_at = null,
        answers_closed_at = null, revealed_at = null, scored_at = null, play_order = null, rules = null
      where session_id = ${sessionId}`;
    await tx`
      update game_rounds set started_at = null, vote_opened_at = null, vote_closes_at = null, vote_closed_at = null,
        winning_option_id = null, vote_result = null, wheel_spun_at = null, wheel_spin = null
      where session_id = ${sessionId}`;
    await tx`update game_state set intro_started_at = null where session_id = ${sessionId}`;
    await tx`update teams set rank = null, previous_rank = null where session_id = ${sessionId}`;
    await tx`update game_sessions set status = 'live', finished_at = null where id = ${sessionId}`;
    await tx`select set_config('qz.allow_reset', 'off', true)`;
    return {
      to: "LOBBY",
      patch: {
        current_round_id: null,
        current_session_question_id: null,
        forced_next_sq_id: null,
        questions_played: 0,
        active_event_id: null,
        paused_from_phase: null,
        paused_remaining_ms: null,
        paused_at: null,
      },
      result: { reset: true },
    };
  },

  async SIM_ADD_BOTS({ tx, st, args, sessionId }) {
    const count = args.count ?? 5;
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from participants where session_id = ${sessionId} and is_bot`;
    const ids: string[] = [];
    for (let i = 1; i <= count; i++) {
      const idx = n + i;
      const [p] = await tx<{ id: string }[]>`
        insert into participants (session_id, nickname, nickname_key, token_hash, is_bot)
        values (${sessionId}, ${"Bot " + idx}, ${"__bot_" + idx}, ${"bot:" + randomBytes(16).toString("hex")}, true)
        returning id`;
      ids.push(p.id);
    }
    await tx`insert into score_totals (participant_id, session_id) select unnest(${tx.array(ids)}::uuid[]), ${sessionId}`;
    return { to: st.phase, result: { added: count } };
  },

  async SIM_BOTS_ANSWER(ctx) {
    const { tx, sessionId } = ctx;
    const q = await requireCurrentQuestion(ctx);
    const bots = await tx<{ id: string }[]>`
      select p.id from participants p
      where p.session_id = ${sessionId} and p.is_bot and p.status = 'active'
        and not exists (select 1 from answer_submissions a where a.participant_id = p.id and a.session_question_id = ${q.id})`;
    const [{ elapsed }] = await tx<{ elapsed: number }[]>`
      select greatest(200, floor(extract(epoch from (clock_timestamp() - options_opened_at)) * 1000))::int as elapsed
      from session_questions where id = ${q.id}`;
    for (const b of bots) {
      let positions: number[];
      if (q.type === "single") positions = [randomInt(0, 4)];
      else {
        const shuffled = [0, 1, 2, 3].sort(() => randomUnit() - 0.5);
        positions = shuffled.slice(0, randomInt(1, 5)).sort();
      }
      const [s] = await tx<{ id: string }[]>`
        insert into answer_submissions (session_id, session_question_id, participant_id, selected_positions, client_request_id, response_ms)
        values (${sessionId}, ${q.id}, ${b.id}, ${tx.array(positions)}::smallint[], gen_random_uuid(), ${randomInt(150, Math.max(151, elapsed))})
        on conflict do nothing returning id`;
      if (s) {
        await tx`
          insert into answer_selected_options (submission_id, session_question_id, position)
          select ${s.id}, ${q.id}, unnest(${tx.array(positions)}::smallint[])`;
      }
    }
    return { to: ctx.st.phase, result: { answered: bots.length } };
  },

  async SIM_BOTS_VOTE({ tx, st, sessionId }) {
    if (!st.current_round_id) throw new GameError("INVALID_TRANSITION", "Nessun round corrente");
    const options = await tx<{ id: string }[]>`select id from category_vote_options where round_id = ${st.current_round_id}`;
    const bots = await tx<{ id: string }[]>`
      select id from participants where session_id = ${sessionId} and is_bot and status = 'active'`;
    for (const b of bots) {
      await tx`
        insert into category_votes (session_id, round_id, participant_id, option_id)
        values (${sessionId}, ${st.current_round_id}, ${b.id}, ${options[randomInt(0, options.length)].id})
        on conflict do nothing`;
    }
    return { to: st.phase, result: { voted: bots.length } };
  },
};

interface DefRow {
  id: string;
  key: string;
  type: SpecialEventType;
  title: string;
  tagline: string;
  params: SpecialEventParams;
  max_per_session: number;
  allowed_round_kinds: RoundKind[];
}
