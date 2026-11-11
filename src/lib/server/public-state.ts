import type { Db } from "@/lib/database/db";
import { iso, num } from "@/lib/database/db";
import type {
  BetTier,
  GamePhase,
  LeaderboardEntry,
  PublicBets,
  PublicEvent,
  PublicQuestion,
  PublicRound,
  PublicState,
  PublicVote,
  PublicWheel,
  PublicOption,
  Presenter,
  QuestionType,
  RoundKind,
  MediaKind,
  SpecialEventParams,
  SpecialEventType,
  TieBreakMethod,
} from "@/lib/game-engine/types";
import type { SessionSettings } from "@/lib/validation/schemas";
import { effectiveSettings, loadGlobalSettings, type EffectiveSessionSettings } from "./settings";
import { rulesForQuestion } from "./rules";
import { showLinesForPhase } from "@/lib/show/moments";
import { loadPublicTeams, loadTeamLeaderboard } from "./teams";
import { roundSpecialSettings } from "@/lib/game-engine/special-rounds";
import { BET_TIERS } from "@/lib/game-engine/types";

export const QUESTION_PHASES: readonly GamePhase[] = [
  "QUESTION_VISIBLE",
  "OPTIONS_VISIBLE",
  "ANSWERS_LOCKED",
  "ANSWER_REVEAL",
  "SCORE_REVEAL",
];
const OPTION_PHASES: readonly GamePhase[] = ["OPTIONS_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL", "SCORE_REVEAL"];
const REVEAL_PHASES: readonly GamePhase[] = ["ANSWER_REVEAL", "SCORE_REVEAL"];
const VOTE_PHASES: readonly GamePhase[] = ["ROUND_INTRO", "CATEGORY_VOTING", "CATEGORY_RESULT"];
const WHEEL_PHASES: readonly GamePhase[] = ["ROUND_INTRO", "WHEEL_SPIN"];
const LEADERBOARD_PHASES: readonly GamePhase[] = ["SCORE_REVEAL", "LEADERBOARD", "FINISHED"];
const LOBBY_PHASES: readonly GamePhase[] = ["READY", "LOBBY", "INTRO"];

export interface StateRow {
  session_id: string;
  code: string;
  title: string;
  is_test: boolean;
  status: string;
  settings: SessionSettings;
  phase: GamePhase;
  version: number;
  current_round_id: string | null;
  current_session_question_id: string | null;
  forced_next_sq_id: string | null;
  questions_played: number;
  phase_started_at: Date;
  intro_started_at: Date | null;
  paused_from_phase: GamePhase | null;
  paused_remaining_ms: number | null;
  paused_at: Date | null;
  active_event_id: string | null;
  show_lines: PublicState["showLines"];
  /** scorrimento automatico (vedi lib/game-engine/autoplay e server/autoplay) */
  auto_mode: boolean | null;
  auto_next_at: Date | null;
  auto_command: string | null;
  auto_version: number | null;
  auto_waiting: string | null;
  /** gioco libero: rivincita che ha preso il posto di questa partita */
  next_session_id: string | null;
  server_now: Date;
}

export async function loadStateRow(db: Db, sessionId: string, lock: "update" | "share" | null = null): Promise<StateRow | null> {
  const lockClause = lock === "update" ? db`for update of gs` : lock === "share" ? db`for share of gs` : db``;
  const [row] = await db<StateRow[]>`
    select gs.session_id, s.code, s.title, s.is_test, s.status, s.settings, gs.phase, gs.version,
           gs.current_round_id, gs.current_session_question_id, gs.forced_next_sq_id, gs.questions_played,
           gs.phase_started_at, gs.intro_started_at, gs.paused_from_phase, gs.paused_remaining_ms, gs.paused_at,
           gs.active_event_id, gs.show_lines,
           gs.auto_mode, gs.auto_next_at, gs.auto_command, gs.auto_version, gs.auto_waiting,
           s.next_session_id,
           clock_timestamp() as server_now
    from game_state gs
    join game_sessions s on s.id = gs.session_id
    where gs.session_id = ${sessionId}
    ${lockClause}`;
  return row ?? null;
}

/** La fase "visiva": durante la pausa si continua a mostrare la schermata precedente. */
export function visualPhase(row: Pick<StateRow, "phase" | "paused_from_phase">): GamePhase {
  return row.phase === "PAUSED" && row.paused_from_phase ? row.paused_from_phase : row.phase;
}

/**
 * Costruisce lo stato PUBBLICO della partita: è esattamente ciò che può
 * vedere chiunque guardi il TV. Non contiene mai la soluzione prima della
 * rivelazione né domande future.
 */
export async function buildPublicState(db: Db, sessionId: string, preloaded?: StateRow): Promise<PublicState | null> {
  const st = preloaded ?? (await loadStateRow(db, sessionId));
  if (!st) return null;
  const settings = effectiveSettings(await loadGlobalSettings(db), st.settings);
  const vp = visualPhase(st);

  const [{ players }] = await db<{ players: number }[]>`
    select count(*)::int as players from participants where session_id = ${sessionId} and status = 'active'`;

  const [{ total_questions }] = await db<{ total_questions: number }[]>`
    select coalesce(sum(case
        when r.kind::text in ('category_vote', 'category_wheel') then (
          select count(*) from session_questions q
          where q.round_id = r.id and not q.is_reserve
            and q.vote_option_id = coalesce(r.winning_option_id,
              (select o.id from category_vote_options o where o.round_id = r.id order by o.position limit 1)))
        else (select count(*) from session_questions q where q.round_id = r.id and not q.is_reserve)
      end), 0)::int as total_questions
    from game_rounds r where r.session_id = ${sessionId}`;

  const round = st.current_round_id ? await loadPublicRound(db, sessionId, st.current_round_id) : null;
  const question =
    st.current_session_question_id && QUESTION_PHASES.includes(vp)
      ? await loadPublicQuestion(db, st.current_session_question_id, vp, settings)
      : null;
  const event = st.active_event_id ? await loadPublicEvent(db, st.active_event_id) : null;
  const showEvent = event && (vp === "SPECIAL_EVENT" || (question && event.targetQuestionId === question.id));
  const vote =
    round && round.kind === "category_vote" && VOTE_PHASES.includes(vp) ? await loadPublicVote(db, round.id, vp) : null;
  const wheel =
    round && round.kind === "category_wheel" && WHEEL_PHASES.includes(vp)
      ? await loadPublicWheel(db, round.id, st.phase === "PAUSED" ? st.paused_at : null)
      : null;
  const leaderboard = LEADERBOARD_PHASES.includes(vp) ? await loadLeaderboard(db, sessionId, vp === "SCORE_REVEAL" || vp === "FINISHED" ? 40 : 10) : null;
  // modalità squadre: elenco squadre sempre, classifica a squadre nelle stesse fasi di quella individuale
  const teams = await loadPublicTeams(db, sessionId, settings.teams);
  const teamLeaderboard = teams && LEADERBOARD_PHASES.includes(vp) ? await loadTeamLeaderboard(db, sessionId, settings.teams.aggregation) : null;

  let recentPlayers: string[] | null = null;
  if (LOBBY_PHASES.includes(vp)) {
    const rows = await db<{ nickname: string }[]>`
      select nickname from participants where session_id = ${sessionId} and status = 'active' and not is_bot
      order by joined_at desc limit 24`;
    recentPlayers = rows.map((r) => r.nickname);
  }

  return {
    sessionId,
    code: st.code,
    title: st.title,
    isTest: st.is_test,
    phase: st.phase,
    version: num(st.version),
    serverNow: iso(st.server_now)!,
    phaseStartedAt: iso(st.phase_started_at)!,
    joinLocked: settings.joinLocked,
    allowLateJoin: settings.allowLateJoin,
    playerCount: players,
    questionsPlayed: st.questions_played,
    totalQuestions: total_questions,
    intro: st.intro_started_at
      ? {
          startedAt: iso(st.intro_started_at)!,
          scoring: { correct: settings.correctPoints, wrong: settings.wrongPenalty, noAnswer: settings.noAnswerPenalty },
        }
      : null,
    round,
    question,
    event: showEvent ? event : null,
    vote,
    wheel,
    leaderboard,
    teams,
    teamLeaderboard,
    pausedFrom: st.phase === "PAUSED" ? st.paused_from_phase : null,
    recentPlayers,
    showLines: showLinesForPhase(vp, st.show_lines),
    auto: publicAuto(st),
    rematch: st.next_session_id ? { sessionId: st.next_session_id } : null,
  };
}

/** Scorrimento automatico attivo? (scelta della regia in diretta, altrimenti impostazione della serata) */
export function autoplayEnabled(st: Pick<StateRow, "auto_mode" | "settings">): boolean {
  return st.auto_mode ?? st.settings?.advanceMode === "auto";
}

/** Prossimo passo automatico per TV e regia (solo l'orario: il comando resta lato server). */
export function publicAuto(st: Pick<StateRow, "auto_mode" | "settings" | "auto_next_at" | "auto_version">): PublicState["auto"] {
  if (!autoplayEnabled(st) || !st.auto_next_at || st.auto_version === null) return null;
  return { nextAt: iso(st.auto_next_at)!, version: num(st.auto_version) };
}

async function loadPublicRound(db: Db, sessionId: string, roundId: string): Promise<PublicRound | null> {
  const [r] = await db<
    {
      id: string;
      idx: number;
      total: number;
      title: string;
      kind: RoundKind;
      presenter: Presenter;
      description: string | null;
      points_multiplier: string;
      penalty_multiplier: string;
      no_penalty: boolean;
      bet_min_stake: number;
      bet_default_tier: number;
      comeback_multiplier: string;
      comeback_leader_penalty: string;
    }[]
  >`
    select r.id, r.title, r.kind, r.presenter, r.description, r.points_multiplier, r.penalty_multiplier, r.no_penalty,
           r.bet_min_stake, r.bet_default_tier, r.comeback_multiplier, r.comeback_leader_penalty,
           (select count(*)::int from game_rounds x where x.session_id = r.session_id and x.position <= r.position) as idx,
           (select count(*)::int from game_rounds x where x.session_id = r.session_id) as total
    from game_rounds r where r.id = ${roundId} and r.session_id = ${sessionId}`;
  if (!r) return null;
  return {
    id: r.id,
    index: r.idx,
    total: r.total,
    title: r.title,
    kind: r.kind,
    presenter: r.presenter,
    description: r.description,
    pointsMultiplier: num(r.points_multiplier),
    penaltyMultiplier: num(r.penalty_multiplier),
    noPenalty: r.no_penalty,
    special: roundSpecialSettings(r),
  };
}

async function loadPublicQuestion(
  db: Db,
  sqId: string,
  vp: GamePhase,
  settings: EffectiveSessionSettings,
): Promise<PublicQuestion | null> {
  const [q] = await db<
    {
      id: string;
      round_id: string;
      play_order: number | null;
      is_reserve: boolean;
      vote_option_id: string | null;
      type: QuestionType;
      text: string;
      category: string;
      difficulty: number;
      presenter: Presenter;
      options: PublicOption[];
      correct_positions: number[];
      media_id: string | null;
      media_kind: MediaKind | null;
      audio_start_ms: number;
      audio_duration_ms: number | null;
      audio_plays: number;
      animation: string | null;
      options_opened_at: Date | null;
      answers_close_at: Date | null;
      answers_closed_at: Date | null;
      revealed_at: Date | null;
      position_in_round: number;
      total_in_round: number;
    }[]
  >`
    select sq.id, sq.round_id, sq.play_order, sq.is_reserve, sq.vote_option_id,
           qs.type, qs.text, qs.category, qs.difficulty, qs.presenter, qs.options, qs.correct_positions,
           qs.media_id, qs.media_kind, qs.audio_start_ms, qs.audio_duration_ms, qs.audio_plays, qs.animation,
           sq.options_opened_at, sq.answers_close_at, sq.answers_closed_at, sq.revealed_at,
           (select count(*)::int from session_questions x
             where x.round_id = sq.round_id and not x.is_reserve and x.shown_at is not null and x.shown_at <= coalesce(sq.shown_at, clock_timestamp())) as position_in_round,
           (select count(*)::int from session_questions x
             where x.round_id = sq.round_id and not x.is_reserve
               and (sq.vote_option_id is null or x.vote_option_id = sq.vote_option_id)) as total_in_round
    from session_questions sq
    join question_snapshots qs on qs.session_question_id = sq.id
    where sq.id = ${sqId}`;
  if (!q) return null;
  const rules = await rulesForQuestion(db, sqId, settings.allowNegative);
  if (!rules) return null;
  const showOptions = OPTION_PHASES.includes(vp) && q.options_opened_at !== null;
  const revealed = REVEAL_PHASES.includes(vp) && q.revealed_at !== null;

  let distribution: number[] | null = null;
  let answeredCount: number | null = null;
  if (showOptions) {
    const [{ c }] = await db<{ c: number }[]>`select count(*)::int as c from answer_submissions where session_question_id = ${sqId}`;
    answeredCount = c;
  }
  if (revealed) {
    const rows = await db<{ position: number; c: number }[]>`
      select position, count(*)::int as c from answer_selected_options where session_question_id = ${sqId} group by position`;
    distribution = [0, 0, 0, 0];
    for (const r of rows) distribution[r.position] = r.c;
  }
  const bets = rules.special?.kind === "bet" ? await loadPublicBets(db, sqId, vp) : null;

  return {
    id: q.id,
    number: q.play_order ?? 0,
    totalInRound: q.total_in_round,
    positionInRound: Math.max(1, q.position_in_round),
    type: q.type,
    text: q.text,
    category: q.category,
    difficulty: q.difficulty,
    presenter: q.presenter,
    media:
      q.media_id && q.media_kind
        ? {
            id: q.media_id,
            kind: q.media_kind,
            audioStartMs: q.audio_start_ms,
            audioDurationMs: q.audio_duration_ms,
            audioPlays: q.audio_plays,
          }
        : null,
    options: showOptions ? [...q.options].sort((a, b) => a.position - b.position) : null,
    rules,
    openedAt: iso(q.options_opened_at),
    closesAt: iso(q.answers_close_at),
    closedAt: iso(q.answers_closed_at),
    correctPositions: revealed ? [...q.correct_positions].sort() : null,
    distribution,
    answeredCount,
    animation: q.animation,
    bets,
  };
}

/**
 * Puntate di una domanda "Scommetti tutto". Prima della chiusura solo quante sono state fatte;
 * dopo, la distribuzione per quota e la posta totale; dopo i punti, le grandi vincite e perdite.
 */
async function loadPublicBets(db: Db, sqId: string, vp: GamePhase): Promise<PublicBets> {
  const rows = await db<{ tier: BetTier; is_default: boolean; c: number; stake: number; locked: boolean }[]>`
    select tier, is_default, count(*)::int as c, coalesce(sum(stake), 0)::int as stake, bool_and(locked_at is not null) as locked
    from bets where session_question_id = ${sqId} group by tier, is_default`;
  const placed = rows.filter((r) => !r.is_default).reduce((a, r) => a + r.c, 0);
  const locked = rows.length > 0 && rows.every((r) => r.locked);
  const out: PublicBets = { placed, locked, distribution: null, totalStake: null, wins: null, losses: null };
  if (!locked) return out;
  out.distribution = BET_TIERS.map((tier) => ({ tier, count: rows.filter((r) => r.tier === tier).reduce((a, r) => a + r.c, 0) }));
  out.totalStake = rows.reduce((a, r) => a + r.stake, 0);
  if (vp === "SCORE_REVEAL") {
    const hl = await db<{ participant_id: string; nickname: string; tier: BetTier; stake: number; delta: number }[]>`
      select e.participant_id, p.nickname, b.tier, b.stake, e.delta
      from score_events e
      join participants p on p.id = e.participant_id
      join bets b on b.session_question_id = e.session_question_id and b.participant_id = e.participant_id
      where e.session_question_id = ${sqId} and e.kind in ('answer', 'no_answer') and e.delta <> 0`;
    const map = (r: (typeof hl)[number]) => ({ participantId: r.participant_id, nickname: r.nickname, tier: r.tier, stake: r.stake, delta: r.delta });
    out.wins = hl.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta || a.nickname.localeCompare(b.nickname, "it")).slice(0, 5).map(map);
    out.losses = hl.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta || a.nickname.localeCompare(b.nickname, "it")).slice(0, 5).map(map);
  }
  return out;
}

async function loadPublicEvent(db: Db, eventId: string): Promise<PublicEvent | null> {
  const [e] = await db<
    {
      id: string;
      type: SpecialEventType;
      title: string;
      tagline: string;
      params: SpecialEventParams;
      source: PublicEvent["source"];
      animation: string;
      sound: string;
      target_session_question_id: string | null;
    }[]
  >`
    select e.id, e.type, e.title, e.tagline, e.params, e.source, d.animation, d.sound, e.target_session_question_id
    from special_events e join special_event_definitions d on d.id = e.definition_id
    where e.id = ${eventId} and e.status in ('announced', 'applied')`;
  if (!e) return null;
  return {
    id: e.id,
    type: e.type,
    title: e.title,
    tagline: e.tagline,
    params: e.params,
    source: e.source,
    animation: e.animation,
    sound: e.sound,
    targetQuestionId: e.target_session_question_id,
  };
}

export async function loadPublicVote(db: Db, roundId: string, vp: GamePhase): Promise<PublicVote | null> {
  const [r] = await db<
    {
      vote_opened_at: Date | null;
      vote_closes_at: Date | null;
      vote_closed_at: Date | null;
      vote_live_results: boolean;
      winning_option_id: string | null;
      vote_result: { method?: string; tied?: string[] } | null;
    }[]
  >`select vote_opened_at, vote_closes_at, vote_closed_at, vote_live_results, winning_option_id, vote_result
    from game_rounds where id = ${roundId}`;
  if (!r) return null;
  const options = await db<{ id: string; position: number; label: string; votes: number }[]>`
    select o.id, o.position, o.label, (select count(*)::int from category_votes v where v.option_id = o.id) as votes
    from category_vote_options o where o.round_id = ${roundId} order by o.position`;
  const closed = r.vote_closed_at !== null;
  const showCounts = closed || (r.vote_live_results && vp === "CATEGORY_VOTING");
  const total = options.reduce((a, o) => a + o.votes, 0);
  const method = r.vote_result?.method;
  return {
    roundId,
    options: options.map((o) => ({ id: o.id, position: o.position, label: o.label, votes: showCounts ? o.votes : null })),
    openedAt: iso(r.vote_opened_at),
    closesAt: iso(r.vote_closes_at),
    closedAt: iso(r.vote_closed_at),
    liveResults: r.vote_live_results,
    totalVotes: showCounts ? total : null,
    winnerOptionId: closed ? r.winning_option_id : null,
    tieBreak:
      closed && method && method !== "majority"
        ? { method: method as TieBreakMethod, tiedOptionIds: r.vote_result?.tied ?? [] }
        : null,
  };
}

interface StoredWheelSpin {
  turns: number;
  landing: number;
  rotationDeg: number;
  durationMs: number;
  winnerIndex: number;
  winnerOptionId: string;
}

/** Ruota del round: spicchi (ordine per position) e, dopo il comando, il giro deciso dal server. */
export async function loadPublicWheel(db: Db, roundId: string, pausedAt: Date | null): Promise<PublicWheel | null> {
  const [r] = await db<{ wheel_spun_at: Date | null; wheel_spin: StoredWheelSpin | null; frozen_ms: number | null }[]>`
    select wheel_spun_at, wheel_spin,
      case when ${pausedAt}::timestamptz is not null and wheel_spun_at is not null
        then greatest(0, floor(extract(epoch from (${pausedAt}::timestamptz - wheel_spun_at)) * 1000))::int end as frozen_ms
    from game_rounds where id = ${roundId}`;
  if (!r) return null;
  const segments = await db<{ id: string; position: number; label: string }[]>`
    select id, position, label from category_vote_options where round_id = ${roundId} order by position`;
  const p = r.wheel_spin;
  return {
    roundId,
    segments: segments.map((o) => ({ id: o.id, position: o.position, label: o.label })),
    spin:
      r.wheel_spun_at && p
        ? {
            startedAt: iso(r.wheel_spun_at)!,
            durationMs: p.durationMs,
            turns: p.turns,
            landing: p.landing,
            rotationDeg: p.rotationDeg,
            winnerIndex: p.winnerIndex,
            winnerOptionId: p.winnerOptionId,
            frozenElapsedMs: r.frozen_ms === null ? null : Math.min(r.frozen_ms, p.durationMs),
          }
        : null,
  };
}

export async function loadLeaderboard(db: Db, sessionId: string, limit: number): Promise<LeaderboardEntry[]> {
  const rows = await db<
    {
      participant_id: string;
      rank: number | null;
      previous_rank: number | null;
      nickname: string;
      points: number;
      last_delta: number;
      correct_count: number;
    }[]
  >`
    select t.participant_id, t.rank, t.previous_rank, p.nickname, t.points, t.last_delta, t.correct_count
    from score_totals t join participants p on p.id = t.participant_id
    where t.session_id = ${sessionId} and p.status = 'active'
    order by t.rank nulls last, t.points desc, p.joined_at
    limit ${limit}`;
  return rows.map((r, i) => ({
    participantId: r.participant_id,
    rank: r.rank ?? i + 1,
    previousRank: r.previous_rank,
    nickname: r.nickname,
    points: r.points,
    lastDelta: r.last_delta,
    correctCount: r.correct_count,
  }));
}
