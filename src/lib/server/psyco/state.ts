import "server-only";
import { iso, type Db } from "@/lib/database/db";
import {
  DEFAULT_SETTINGS,
  MIN_PLAYERS,
  settingsSchema,
  type Difficulty,
  type PsycoEvent,
  type PsycoPhase,
  type PsycoPrivateView,
  type PsycoPublicState,
  type PsycoSettings,
  type InvestigatorMessage,
  type PublicVote,
  type Role,
  type RoomMode,
  type RoundOutcome,
  type RuleCategory,
  type RuleMode,
  type SecretRule,
  type VoteKind,
} from "@/lib/psyco/types";

/**
 * Costruzione dello stato di una stanza PSYCO.
 *
 *  - `buildPublicState`: quello che possono vedere TUTTI (telefoni, TV, canale realtime).
 *    Non legge MAI rule_text/rule_title/testo dei candidati finché la manche non è finita.
 *  - `buildPrivateView`: quello che vede UN partecipante; i segreti solo a chi conosce la regola
 *    (doppio controllo: mai allo PSYCO della manche).
 *
 * Funzionano sia col collegamento principale sia dentro una transazione (`db`): dentro una
 * transazione si deve passare SEMPRE la transazione (mai il pool: vedi engine.ts del quiz).
 */

/** Un partecipante è "in linea" se si è fatto sentire negli ultimi 40 s (i client interrogano ogni ~10 s). */
export const ONLINE_MS = 40_000;
/** Lo schermo TV si fa sentire ogni ~10 s. */
const DISPLAY_ONLINE_MS = 30_000;
const HISTORY_LIMIT = 12;

export interface RoomRow {
  id: string;
  code: string;
  display_key: string;
  mode: RoomMode;
  /** creata da un PC come schermo pubblico (colonna aggiunta: può mancare su righe vecchie lette prima della migrazione) */
  screen_mode?: boolean | null;
  owner_user_id: string;
  host_user_id: string | null;
  status: "open" | "closed";
  phase: PsycoPhase;
  version: number;
  secret_rev: number;
  settings: unknown;
  round_no: number;
  current_round_id: string | null;
  event: PsycoEvent | null;
  host_seen_at: Date;
  display_seen_at: Date | null;
  broadcast_at: Date | null;
  last_activity_at: Date;
  db_now: Date;
}

export interface RoundVoteMeta {
  kind: VoteKind;
  ballot: string;
  options: string[];
  runoff: string[] | null;
  cycle: number;
}

export interface RoundRow {
  id: string;
  room_id: string;
  round_no: number;
  psyco_participant_id: string | null;
  psyco_nickname: string;
  rule_mode: RuleMode;
  difficulty: Difficulty | null;
  rule_source: "archive" | "custom" | null;
  rule_id: string | null;
  rule_title: string | null;
  rule_text: string | null;
  /** regola libera: categoria e indizio della proposta vincente (SEGRETI) */
  rule_category: RuleCategory | null;
  rule_hint: string | null;
  /** chiamate all'Investigatore permesse / usate nella manche */
  calls_max: number;
  calls_used: number;
  timer_ms: number | null;
  countdown_ms: number;
  vote: RoundVoteMeta | null;
  candidate_id: string | null;
  candidates_shown: number;
  started_at: Date | null;
  paused_at: Date | null;
  paused_ms: number;
  paused_by_guess: boolean;
  ended_at: Date | null;
  outcome: RoundOutcome | null;
  elapsed_ms: number | null;
  attempts: number;
}

export interface ParticipantRow {
  id: string;
  kind: "account" | "local";
  user_id: string | null;
  owner_user_id: string | null;
  nickname: string;
  seat: number;
  status: "active" | "left" | "kicked";
  psyco_count: number;
  last_psyco_round: number | null;
  last_seen_at: Date;
}

export interface MemberRow {
  participant_id: string;
  role: Role;
  seen_at: Date | null;
  ready_at: Date | null;
}

export function parseSettings(raw: unknown): PsycoSettings {
  const r = settingsSchema.safeParse(raw);
  return r.success ? r.data : DEFAULT_SETTINGS;
}

export async function loadRoom(db: Db, roomId: string, forUpdate = false): Promise<RoomRow | null> {
  const [r] = forUpdate
    ? await db<RoomRow[]>`select r.*, now() as db_now from psyco_rooms r where r.id = ${roomId} for update`
    : await db<RoomRow[]>`select r.*, now() as db_now from psyco_rooms r where r.id = ${roomId}`;
  return r ?? null;
}

export async function loadRound(db: Db, roundId: string | null): Promise<RoundRow | null> {
  if (!roundId) return null;
  const [r] = await db<RoundRow[]>`select * from psyco_rounds where id = ${roundId}`;
  return r ?? null;
}

export async function loadParticipants(db: Db, roomId: string, onlyActive = true): Promise<ParticipantRow[]> {
  return onlyActive
    ? db<ParticipantRow[]>`
        select id, kind, user_id, owner_user_id, nickname, seat, status, psyco_count, last_psyco_round, last_seen_at
        from psyco_participants where room_id = ${roomId} and status = 'active' order by seat`
    : db<ParticipantRow[]>`
        select id, kind, user_id, owner_user_id, nickname, seat, status, psyco_count, last_psyco_round, last_seen_at
        from psyco_participants where room_id = ${roomId} order by seat`;
}

export async function loadMembers(db: Db, roundId: string): Promise<MemberRow[]> {
  return db<MemberRow[]>`select participant_id, role, seen_at, ready_at from psyco_round_members where round_id = ${roundId}`;
}

/** Voti della votazione in corso, solo di chi ha ancora diritto (conosce la regola ed è in stanza). */
export async function loadBallot(db: Db, roundId: string, ballot: string): Promise<{ participant_id: string; choice: string }[]> {
  return db<{ participant_id: string; choice: string }[]>`
    select v.participant_id, v.choice
    from psyco_votes v
    join psyco_round_members m on m.round_id = v.round_id and m.participant_id = v.participant_id and m.role = 'knower'
    join psyco_participants p on p.id = v.participant_id and p.status = 'active'
    where v.round_id = ${roundId} and v.ballot = ${ballot}`;
}

export function passBallot(round: Pick<RoundRow, "vote">): string {
  // le rinunce della fase di proposta valgono per il «giro» di proposte corrente
  return `pass#${round.vote?.cycle ?? 1}`;
}

/** Aventi diritto di voto: chi conosce la regola ed è ancora in stanza. */
export function eligibleKnowers(members: MemberRow[], active: Set<string>): string[] {
  return members.filter((m) => m.role === "knower" && active.has(m.participant_id)).map((m) => m.participant_id);
}

function tallyOf(votes: { choice: string }[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const v of votes) t[v.choice] = (t[v.choice] ?? 0) + 1;
  return t;
}

export async function buildPublicState(db: Db, roomId: string): Promise<PsycoPublicState | null> {
  const room = await loadRoom(db, roomId);
  if (!room) return null;
  return buildPublicStateFrom(db, room);
}

export async function buildPublicStateFrom(db: Db, room: RoomRow): Promise<PsycoPublicState> {
  const nowMs = room.db_now.getTime();
  const [participants, round] = await Promise.all([loadParticipants(db, room.id), loadRound(db, room.current_round_id)]);
  const active = new Set(participants.map((p) => p.id));
  const members = round ? await loadMembers(db, round.id) : [];
  const memberIds = new Set(members.map((m) => m.participant_id));
  const hostP = participants.find((p) => p.kind === "account" && p.user_id === room.host_user_id) ?? null;

  let publicRound: PsycoPublicState["round"] = null;
  const hidePsyco = room.phase === "ROLE_REVEAL";
  const hiddenPsycoId = hidePsyco ? (round?.psyco_participant_id ?? null) : null;
  if (round && room.phase !== "LOBBY") {
    let vote: PublicVote | null = null;
    const eligible = eligibleKnowers(members, active);
    if (round.vote && ["DIFFICULTY_VOTE", "RULE_VOTE", "PROPOSAL_VOTE", "GUESS_VOTE"].includes(room.phase)) {
      const votes = await loadBallot(db, round.id, round.vote.ballot);
      vote = {
        kind: round.vote.kind,
        ballot: round.vote.ballot,
        eligible: eligible.length,
        voted: votes.map((v) => v.participant_id),
        tally: tallyOf(votes),
        runoff: round.vote.runoff,
      };
    }
    let proposed: string[] = [];
    let passed: string[] = [];
    let proposalsCount = 0;
    if (round.rule_mode === "free" && ["RULE_PROPOSALS", "PROPOSAL_VOTE"].includes(room.phase)) {
      // SOLO chi ha proposto (id), mai il testo
      const rows = await db<{ author_participant_id: string | null }[]>`
        select author_participant_id from psyco_candidates where round_id = ${round.id} and kind = 'custom'`;
      proposed = rows.map((r) => r.author_participant_id).filter((x): x is string => !!x && active.has(x));
      proposalsCount = rows.length;
      if (room.phase === "RULE_PROPOSALS") {
        const p = await db<{ participant_id: string }[]>`
          select participant_id from psyco_votes where round_id = ${round.id} and ballot = ${passBallot(round)}`;
        passed = p.map((r) => r.participant_id).filter((x) => active.has(x));
      }
    }
    const ended = room.phase === "ROUND_END";
    let lastCallAt: string | null = null;
    if (round.calls_used > 0) {
      const [c] = await db<{ at: Date | null }[]>`select max(answered_at) as at from psyco_calls where round_id = ${round.id}`;
      lastCallAt = iso(c?.at ?? null);
    }
    publicRound = {
      no: round.round_no,
      // durante la rivelazione dei ruoli nessuno schermo pubblico dice chi è lo PSYCO (ruoli privati)
      psycoId: hidePsyco ? null : round.psyco_participant_id,
      psycoNickname: hidePsyco ? "" : round.psyco_nickname,
      ruleMode: round.rule_mode,
      difficulty: round.difficulty,
      members: members.map((m) => m.participant_id).filter((x) => active.has(x)),
      seen: members.filter((m) => m.seen_at).map((m) => m.participant_id),
      ready: members.filter((m) => m.ready_at).map((m) => m.participant_id),
      timer: { totalMs: round.timer_ms, startedAt: iso(round.started_at), pausedAt: iso(round.paused_at), pausedMs: Number(round.paused_ms) },
      attempts: round.attempts,
      candidatesShown: round.candidates_shown,
      proposed,
      passed,
      proposalsCount,
      vote,
      outcome: round.outcome,
      endedAt: iso(round.ended_at),
      elapsedMs: round.elapsed_ms === null ? null : Number(round.elapsed_ms),
      // SOLO i numeri delle chiamate all'Investigatore: l'indizio non esce mai di qui
      calls: { max: round.calls_max ?? 0, used: round.calls_used ?? 0, lastAt: lastCallAt },
      // la regola diventa pubblica SOLO a manche finita
      revealedRule: ended && round.rule_text ? { title: round.rule_title, text: round.rule_text, source: round.rule_source } : null,
    };
  }

  const history = await db<{ round_no: number; psyco_nickname: string; outcome: RoundOutcome | null; elapsed_ms: number | null; attempts: number; difficulty: Difficulty | null }[]>`
    select round_no, psyco_nickname, outcome, elapsed_ms, attempts, difficulty
    from psyco_rounds where room_id = ${room.id} and ended_at is not null
    order by round_no desc limit ${HISTORY_LIMIT}`;

  return {
    roomId: room.id,
    code: room.code,
    mode: room.mode,
    screen: !!room.screen_mode,
    status: room.status,
    phase: room.phase,
    version: Number(room.version),
    secretRev: room.secret_rev,
    serverNow: room.db_now.toISOString(),
    settings: parseSettings(room.settings),
    minPlayers: MIN_PLAYERS,
    hostParticipantId: room.mode === "shared" ? null : (hostP?.id ?? null),
    hostOnline: nowMs - room.host_seen_at.getTime() < ONLINE_MS,
    displayOnline: !!room.display_seen_at && nowMs - room.display_seen_at.getTime() < DISPLAY_ONLINE_MS,
    participants: participants.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      kind: p.kind,
      online: p.kind === "local" ? true : nowMs - p.last_seen_at.getTime() < ONLINE_MS,
      isHost: room.mode === "personal" && p.user_id !== null && p.user_id === room.host_user_id,
      inRound: memberIds.has(p.id),
      // il conteggio del PSYCO appena scelto si vede solo dopo la rivelazione dei ruoli
      psycoCount: p.id === hiddenPsycoId ? Math.max(0, p.psyco_count - 1) : p.psyco_count,
    })),
    activeCount: participants.length,
    round: publicRound,
    history: history.map((h) => ({
      no: h.round_no,
      psycoNickname: h.psyco_nickname,
      outcome: h.outcome,
      elapsedMs: h.elapsed_ms === null ? null : Number(h.elapsed_ms),
      attempts: h.attempts,
      difficulty: h.difficulty,
    })),
    event: room.event,
  };
}

/** Fasi in cui lo PSYCO può rileggere i messaggi dell'Investigatore (per tutta la manche, anche a fine manche). */
const INVESTIGATOR_PHASES: PsycoPhase[] = ["PLAYING", "GUESS_VOTE", "ROUND_END"];

/** Fasi in cui chi conosce la regola può vederne i dettagli. */
const SECRET_PHASES: PsycoPhase[] = ["RULE_VOTE", "RULE_PROPOSALS", "PROPOSAL_VOTE", "RULE_CONFIRMED", "PLAYING", "GUESS_VOTE", "ROUND_END"];

export async function buildPrivateView(
  db: Db,
  room: RoomRow,
  participant: ParticipantRow | null,
  flags: { isHost: boolean; isOwner: boolean },
): Promise<PsycoPrivateView> {
  const view: PsycoPrivateView = {
    me: participant ? { participantId: participant.id, nickname: participant.nickname, kind: participant.kind } : null,
    isHost: flags.isHost,
    isOwner: flags.isOwner,
    role: null,
    roleSeen: false,
    psycoNickname: null,
    ready: false,
    myVote: null,
    myProposal: null,
    myPassed: false,
    investigator: null,
    secret: null,
  };
  if (!participant || participant.status !== "active" || room.phase === "LOBBY") return view;
  const round = await loadRound(db, room.current_round_id);
  if (!round) return view;
  const [m] = await db<MemberRow[]>`
    select participant_id, role, seen_at, ready_at from psyco_round_members where round_id = ${round.id} and participant_id = ${participant.id}`;
  if (!m) return view;
  view.role = m.role;
  view.roleSeen = !!m.seen_at;
  // chi conosce la regola sa chi è lo PSYCO (e lo PSYCO sa di esserlo)
  view.psycoNickname = round.psyco_nickname;
  view.ready = !!m.ready_at;
  if (round.vote) {
    const [v] = await db<{ choice: string }[]>`
      select choice from psyco_votes where round_id = ${round.id} and ballot = ${round.vote.ballot} and participant_id = ${participant.id}`;
    view.myVote = v?.choice ?? null;
  }

  // ---------------- segreti: SOLO a chi conosce la regola, MAI allo PSYCO
  const isPsyco = m.role === "psyco" || round.psyco_participant_id === participant.id;
  if (isPsyco && round.psyco_participant_id === participant.id && INVESTIGATOR_PHASES.includes(room.phase)) {
    // i messaggi dell'Investigatore: SOLO allo PSYCO della manche (mai a chi conosce la regola, mai agli schermi)
    const rows = await db<{ call_no: number; level: number; hint_text: string; answered_at: Date }[]>`
      select call_no, level, hint_text, answered_at from psyco_calls where round_id = ${round.id} order by call_no`;
    const messages: InvestigatorMessage[] = rows.map((x) => ({ no: x.call_no, level: x.level, text: x.hint_text, at: iso(x.answered_at)! }));
    view.investigator = { messages };
  }
  if (isPsyco || m.role !== "knower" || !SECRET_PHASES.includes(room.phase)) return view;

  if (room.phase === "RULE_PROPOSALS") {
    const [mine] = await db<{ id: string; text: string; category: RuleCategory | null; hint: string | null }[]>`
      select id, text, category, hint from psyco_candidates where round_id = ${round.id} and kind = 'custom' and author_participant_id = ${participant.id}`;
    view.myProposal = mine ?? null;
    const [p] = await db`select 1 from psyco_votes where round_id = ${round.id} and ballot = ${passBallot(round)} and participant_id = ${participant.id}`;
    view.myPassed = !!p;
  }

  const secret: NonNullable<PsycoPrivateView["secret"]> = { candidate: null, proposals: [], rule: null };
  if (room.phase === "RULE_VOTE" && round.candidate_id) {
    const [c] = await db<{ id: string; title: string | null; text: string; difficulty: Difficulty | null; instructions: string | null; example: string | null }[]>`
      select c.id, c.title, c.text, r.difficulty, r.instructions, r.example
      from psyco_candidates c left join psyco_rules r on r.id = c.rule_id
      where c.id = ${round.candidate_id} and c.round_id = ${round.id}`;
    secret.candidate = c ? { id: c.id, title: c.title, text: c.text, difficulty: c.difficulty ?? round.difficulty, instructions: c.instructions, example: c.example } : null;
  }
  if (room.phase === "RULE_PROPOSALS" || room.phase === "PROPOSAL_VOTE") {
    const rows = await db<{ id: string; text: string; author_participant_id: string | null; category: RuleCategory | null }[]>`
      select id, text, author_participant_id, category from psyco_candidates
      where round_id = ${round.id} and kind = 'custom' order by created_at, id`;
    const allowed = room.phase === "PROPOSAL_VOTE" && round.vote?.runoff ? new Set(round.vote.runoff) : null;
    secret.proposals = rows
      .filter((r) => !allowed || allowed.has(r.id))
      .map((r) => ({ id: r.id, text: r.text, mine: r.author_participant_id === participant.id, category: r.category }));
  }
  if (round.rule_text && ["RULE_CONFIRMED", "PLAYING", "GUESS_VOTE", "ROUND_END"].includes(room.phase)) {
    let extra: { instructions: string | null; example: string | null } = { instructions: null, example: null };
    if (round.rule_id) {
      const [r] = await db<{ instructions: string | null; example: string | null }[]>`select instructions, example from psyco_rules where id = ${round.rule_id}`;
      if (r) extra = r;
    }
    const rule: SecretRule = { title: round.rule_title, text: round.rule_text, difficulty: round.difficulty, ...extra };
    secret.rule = rule;
  }
  view.secret = secret;
  return view;
}
