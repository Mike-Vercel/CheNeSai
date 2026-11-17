import "server-only";
import { iso, type Db } from "@/lib/database/db";
import type { PhaseCtx, MemberCtx, ScoreOutput, TeamRef, TeamOutcome } from "@/lib/tig/games/contract";
import { mechanicOf, tigRegistry } from "./registry";
import {
  betCap,
  caosTargetCheck,
  caosWindowOpen,
  CAOS_MANCHES,
  chaosProgress,
  computeRanks,
  isLobby,
  isTerminal,
  levelFor,
  nextThreshold,
  POINTS,
  runOfShow,
} from "@/lib/tig/rules";
import {
  eventConfigSchema,
  MANCHE_TAGLINES,
  MANCHE_TITLES,
  type AccessMode,
  type CaosTarget,
  type EventConfig,
  type EventState,
  type GameKind,
  type GameStage,
  type LobbyTable,
  type PlanManche,
  type PlayerView,
  type PublicGame,
  type PublicTeam,
  type RegiaView,
  type Spotlight,
  type TigEventNote,
  type TigPublicState,
} from "@/lib/tig/types";

/**
 * Lettura dello stato di una serata e costruzione delle viste:
 *  - stato PUBBLICO (TV, realtime): squadre approvate, classifica, prova in corso con la sola `publicView`;
 *  - vista del GIOCATORE (autenticata): la propria squadra, memberView, poteri, Bottone del Caos;
 *  - vista della REGIA (solo organizzatore): tavoli con QR/codici/PIN, roster, registro, giochi.
 * Le soluzioni non escono MAI prima del reveal (le scrive solo `reveal()` della meccanica a prova chiusa).
 */

export const ONLINE_MS = 40_000;

export interface EventRow {
  id: string;
  owner_user_id: string;
  venue: string;
  venue_key: string;
  display_key: string;
  access_mode: AccessMode;
  config: unknown;
  status: "open" | "closed";
  state: EventState;
  paused_from: EventState | null;
  version: number;
  secret_rev: number;
  late_join: boolean;
  manche_no: number;
  game_index: number;
  manche_started_at: Date | null;
  manche_paused_ms: number;
  current_game_id: string | null;
  plan: PlanManche[];
  phase_started_at: Date | null;
  phase_deadline_at: Date | null;
  phase_total_ms: number | null;
  paused_at: Date | null;
  paused_ms: number;
  spotlight: Spotlight | null;
  event: TigEventNote | null;
  awards: { order: string[] } | null;
  host_seen_at: Date;
  display_seen_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  last_activity_at: Date;
  close_reason: string | null;
  db_now: Date;
}

export interface TableRow {
  id: string;
  event_id: string;
  table_no: number;
  qr_token: string;
  join_code: string;
  pin: string | null;
}

export interface TeamRow {
  id: string;
  event_id: string;
  table_id: string;
  table_no: number;
  name: string;
  name_key: string;
  color: string;
  status: "active" | "kicked";
  approved: boolean;
  captain_member_id: string | null;
  mascot_slot: number | null;
  mascot_exclusive: boolean;
  mascot_confirmed: boolean;
  score: number;
  energy: number;
  mascot_level: number;
  wins: number;
  acc_sum: number;
  acc_n: number;
  tiebreak_rank: number | null;
  caos_used: boolean;
  created_at: Date;
}

export interface MemberRow {
  id: string;
  event_id: string;
  team_id: string;
  user_id: string;
  nickname: string;
  status: "active" | "left" | "kicked";
  joined_at: Date;
  last_seen_at: Date;
}

export interface GameRow {
  id: string;
  event_id: string;
  manche_no: number;
  slot_no: number;
  kind: GameKind;
  attempt: number;
  mechanic_code: string;
  variant_key: string;
  difficulty: string | null;
  content: unknown;
  seed: string;
  teams: TeamRef[];
  participants: string[];
  bet_enabled: boolean;
  status: "active" | "scored" | "voided";
  starts_at: Date;
  deadline_at: Date;
  timer_ms: number;
  closed_at: Date | null;
  outcome: (ScoreOutput & { stats?: Record<string, { win: number; acc: number | null }> }) | null;
  reveal: unknown;
  caos_source: string | null;
  caos_target: string | null;
  winner_team_id: string | null;
  created_at: Date;
}

export function parseConfig(raw: unknown): EventConfig {
  const p = eventConfigSchema.safeParse(raw ?? {});
  if (p.success) return p.data;
  // configurazione vecchia o parziale: valori predefiniti senza far cadere la serata
  return eventConfigSchema.parse({ venue: "Serata", tables: 2 });
}

export async function loadEvent(db: Db, id: string, forUpdate = false): Promise<EventRow | null> {
  const [r] = forUpdate
    ? await db<EventRow[]>`select e.*, now() as db_now from tig_events e where e.id = ${id} for update`
    : await db<EventRow[]>`select e.*, now() as db_now from tig_events e where e.id = ${id}`;
  return r ?? null;
}

export const loadTables = (db: Db, eventId: string) => db<TableRow[]>`select * from tig_tables where event_id = ${eventId} order by table_no`;
export const loadTeams = (db: Db, eventId: string) => db<TeamRow[]>`select * from tig_teams where event_id = ${eventId} order by table_no`;
export const loadMembers = (db: Db, eventId: string) => db<MemberRow[]>`select * from tig_members where event_id = ${eventId} order by joined_at`;
export async function loadGame(db: Db, id: string | null): Promise<GameRow | null> {
  if (!id) return null;
  const [g] = await db<GameRow[]>`select * from tig_games where id = ${id}`;
  return g ?? null;
}

export const isOnline = (m: MemberRow, nowMs: number) => m.status === "active" && nowMs - m.last_seen_at.getTime() <= ONLINE_MS;
export const accuracyOf = (t: TeamRow) => (t.acc_n > 0 ? t.acc_sum / t.acc_n : null);
export const inGame = (t: TeamRow) => t.status === "active" && t.approved;

export function thresholds(c: EventConfig) {
  return { level2: c.chaosLevel2, level3: c.chaosLevel3 };
}

/** Riferimenti delle squadre per il contesto della prova (membri attivi, capitano). */
export function teamRefs(teams: TeamRow[], members: MemberRow[]): TeamRef[] {
  return teams.filter(inGame).map((t) => ({
    teamId: t.id,
    tableNo: t.table_no,
    members: members.filter((m) => m.team_id === t.id && m.status === "active").map((m) => m.id),
    captainId: t.captain_member_id,
  }));
}

export function phaseCtx(g: GameRow): PhaseCtx {
  return { gameInstanceId: g.id, startsAt: g.starts_at.getTime(), deadlineAt: g.deadline_at.getTime(), teams: g.teams, participants: g.participants, seed: g.seed };
}

export function memberCtx(g: GameRow, teamId: string, memberId: string): MemberCtx | null {
  const t = g.teams.find((x) => x.teamId === teamId);
  if (!t) return null;
  const idx = t.members.indexOf(memberId);
  return { ...phaseCtx(g), teamId, memberId, memberIndex: Math.max(0, idx) };
}

export function gameStage(g: GameRow, nowMs: number): GameStage {
  if (g.status === "scored") return "reveal";
  if (nowMs < g.starts_at.getTime()) return "rule";
  if (nowMs <= g.deadline_at.getTime()) return "play";
  return "locked";
}

/** Contenuto della prova a schermo: MAI prima del via (stessa partenza per tutti), mai la soluzione. */
function safePublicView(g: GameRow, stage: GameStage, nowMs: number): unknown {
  if (stage === "rule") return null;
  const def = mechanicOf(g.mechanic_code);
  if (!def) return null;
  try {
    // prove a tempo (indizi che si aprono, scena che sparisce): solo ciò che è già visibile a quest'istante
    const at = tigRegistry().extras(g.mechanic_code)?.publicViewAt;
    if (at && g.status !== "scored") return at(g.content as never, phaseCtx(g), Math.max(0, Math.min(g.timer_ms, nowMs - g.starts_at.getTime())));
    return def.publicView(g.content as never, phaseCtx(g));
  } catch (e) {
    console.warn("[tig] publicView non riuscita", g.mechanic_code, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Esito per la TV e i telefoni: l'uscita di score() (con `summary`) e i punti applicati, senza statistiche interne. */
function publicOutcome(o: NonNullable<GameRow["outcome"]>): ScoreOutput {
  const { stats: _stats, ...rest } = o;
  return rest;
}

/** Il capitano invia; con un solo telefono (o capitano assente da tempo) può inviare chiunque della squadra. */
export function canActForTeam(team: TeamRow, member: MemberRow, members: MemberRow[], nowMs: number): boolean {
  if (member.team_id !== team.id || member.status !== "active") return false;
  const active = members.filter((m) => m.team_id === team.id && m.status === "active");
  if (active.length <= 1) return true;
  if (team.captain_member_id === member.id) return true;
  const captain = active.find((m) => m.id === team.captain_member_id);
  return !captain || !isOnline(captain, nowMs);
}

// ---------------------------------------------------------------------------
// Stato pubblico
// ---------------------------------------------------------------------------
export async function buildPublicState(db: Db, ev: EventRow): Promise<TigPublicState> {
  const config = parseConfig(ev.config);
  const now = ev.db_now.getTime();
  const [teams, members, game] = await Promise.all([loadTeams(db, ev.id), loadMembers(db, ev.id), loadGame(db, ev.current_game_id)]);
  const [subs, shields, deltas] = await Promise.all([
    game ? db<{ team_id: string }[]>`select distinct team_id from tig_submissions where game_id = ${game.id} and not void` : Promise.resolve([]),
    db<{ team_id: string }[]>`select team_id from tig_powers where event_id = ${ev.id} and kind = 'shield' and status = 'active' and manche_no = ${ev.manche_no}`,
    game && game.status === "scored"
      ? db<{ team_id: string; d: number }[]>`select team_id, sum(applied)::int as d from tig_score_ledger where event_id = ${ev.id} and ref = ${game.id} group by team_id`
      : Promise.resolve([]),
  ]);
  const t = thresholds(config);
  const effective = ev.state === "PAUSED" ? (ev.paused_from ?? ev.state) : ev.state;
  const hideScores = config.hideScoresInFinal && ev.manche_no === 5 && ["ROUND_INTRO", "GAME_ACTIVE", "GAME_RESULTS", "LEADERBOARD"].includes(effective);
  const visible = teams.filter((x) => x.status === "active");
  const ranked = computeRanks(visible.filter((x) => x.approved).map((x) => ({ teamId: x.id, score: x.score, wins: x.wins, accuracy: accuracyOf(x), tableNo: x.table_no, tiebreakRank: x.tiebreak_rank })));
  const rankOf = new Map(ranked.map((r) => [r.teamId, r.rank]));
  const shieldSet = new Set(shields.map((s) => s.team_id));
  const deltaOf = new Map(deltas.map((d) => [d.team_id, d.d]));
  const publicTeams: PublicTeam[] = visible
    .filter((x) => x.approved)
    .map((x) => {
      const mine = members.filter((m) => m.team_id === x.id && m.status === "active");
      return {
        teamId: x.id,
        tableNo: x.table_no,
        name: x.name,
        approved: x.approved,
        color: x.color,
        mascotSlot: x.mascot_slot,
        mascotLevel: Math.min(3, Math.max(1, x.mascot_level)) as 1 | 2 | 3,
        score: hideScores ? null : x.score,
        rank: hideScores ? null : (rankOf.get(x.id) ?? null),
        delta: hideScores ? null : (deltaOf.get(x.id) ?? null),
        energy: x.energy,
        chaosProgress: chaosProgress(x.energy, t),
        online: mine.some((m) => isOnline(m, now)),
        members: mine.length,
        shield: shieldSet.has(x.id),
        caosUsed: x.caos_used,
        wins: x.wins,
      };
    });

  let publicGame: PublicGame | null = null;
  if (game && game.status !== "voided" && ["GAME_ACTIVE", "GAME_RESULTS", "LEADERBOARD", "FINAL", "PAUSED"].includes(ev.state)) {
    const def = mechanicOf(game.mechanic_code);
    const stage = gameStage(game, now);
    const submittedTeamIds = [...new Set(subs.map((s) => s.team_id))];
    publicGame = {
      id: game.id,
      code: game.mechanic_code,
      title: def?.title ?? game.mechanic_code,
      rule: def?.rule ?? "",
      input: def?.input ?? "team",
      kind: game.kind,
      mancheNo: game.manche_no,
      slotNo: game.slot_no,
      participants: game.participants,
      startsAt: game.starts_at.toISOString(),
      deadlineAt: game.deadline_at.toISOString(),
      timerMs: game.timer_ms,
      stage,
      view: safePublicView(game, stage, now),
      submittedTeamIds,
      reveal: game.status === "scored" ? (game.reveal ?? null) : null,
      outcome: game.status === "scored" && game.outcome ? publicOutcome(game.outcome) : null,
      winnerTeamId: game.winner_team_id,
      betEnabled: game.bet_enabled,
    };
  }

  const segs = runOfShow(config.durationMin, config.segments);
  const plan: PlanManche[] = ev.plan?.length
    ? ev.plan.map((p) => ({ ...p, minutes: segs.find((s) => s.mancheNo === p.mancheNo)?.minutes ?? p.minutes }))
    : segs.filter((s) => s.mancheNo).map((s) => ({ mancheNo: s.mancheNo!, title: MANCHE_TITLES[s.mancheNo!], games: s.games ?? 0, minutes: s.minutes, played: 0 }));
  const mancheInfo = ev.manche_no > 0 ? plan.find((p) => p.mancheNo === ev.manche_no) : null;
  const caosGameKind = game?.kind ?? null;
  return {
    eventId: ev.id,
    version: Number(ev.version),
    secretRev: ev.secret_rev,
    serverNow: ev.db_now.toISOString(),
    status: ev.status,
    closeReason: ev.close_reason,
    state: ev.state,
    pausedFrom: ev.paused_from,
    venue: ev.venue,
    accessMode: ev.access_mode,
    lateJoin: ev.late_join,
    manche: ev.manche_no > 0 ? { no: ev.manche_no, title: MANCHE_TITLES[ev.manche_no], tagline: MANCHE_TAGLINES[ev.manche_no], gameIndex: ev.game_index, gamesTotal: mancheInfo?.games ?? 0 } : null,
    timer: ev.phase_deadline_at || ev.phase_started_at ? { startedAt: iso(ev.phase_started_at), deadlineAt: iso(ev.phase_deadline_at), totalMs: ev.phase_total_ms } : null,
    teams: publicTeams,
    pendingTeams: visible.filter((x) => !x.approved).length,
    game: publicGame,
    spotlight: ev.spotlight,
    caosWindow: caosWindowOpen({ state: ev.state, mancheNo: ev.manche_no, paused: !!ev.paused_at, lastGameKind: caosGameKind, caosInProgress: false, hasNextStep: true }),
    hideScores,
    awards: ev.state === "AWARDS" || ev.state === "COMPLETED" ? ev.awards : null,
    event: ev.event,
    plan,
    breakEndsAt: ev.state === "BREAK" ? iso(ev.phase_deadline_at) : null,
    chaosThresholds: t,
  };
}

/** Tavoli per la lobby della TV (QR e codici): solo dall'endpoint della TV, mai nel realtime né in ?live=1. */
export async function buildLobbyTables(db: Db, ev: EventRow): Promise<LobbyTable[]> {
  const rows = await db<{ table_no: number; qr_token: string; join_code: string; name: string | null; approved: boolean | null; members: number }[]>`
    select tb.table_no, tb.qr_token, tb.join_code, tm.name, tm.approved,
      (select count(*)::int from tig_members m where m.team_id = tm.id and m.status = 'active') as members
    from tig_tables tb left join tig_teams tm on tm.table_id = tb.id and tm.status = 'active'
    where tb.event_id = ${ev.id} order by tb.table_no`;
  return rows.map((r) => ({ tableNo: r.table_no, token: r.qr_token, code: r.join_code, teamName: r.approved ? r.name : null, members: r.name ? r.members : 0, approved: !!r.approved }));
}

// ---------------------------------------------------------------------------
// Vista del giocatore
// ---------------------------------------------------------------------------
export async function buildPlayerView(db: Db, ev: EventRow, member: MemberRow): Promise<PlayerView> {
  const config = parseConfig(ev.config);
  const now = ev.db_now.getTime();
  const [teams, members, game, votes, attacks, shieldRows] = await Promise.all([
    loadTeams(db, ev.id),
    loadMembers(db, ev.id),
    loadGame(db, ev.current_game_id),
    db<{ member_id: string; team_id: string; slot: number }[]>`select member_id, team_id, slot from tig_mascot_votes where event_id = ${ev.id}`,
    db<{ target_team_id: string; n: number }[]>`
      select target_team_id, count(*)::int as n from tig_attacks
      where event_id = ${ev.id} and outcome <> 'refused' and created_at > now() - make_interval(secs => ${POINTS.attackWindowMs / 1000})
      group by target_team_id`,
    db<{ team_id: string; manche_no: number; status: string }[]>`select team_id, manche_no, status from tig_powers where event_id = ${ev.id} and kind = 'shield' and team_id = ${member.team_id}`,
  ]);
  const team = teams.find((t) => t.id === member.team_id)!;
  const t = thresholds(config);
  const ranked = computeRanks(teams.filter(inGame).map((x) => ({ teamId: x.id, score: x.score, wins: x.wins, accuracy: accuracyOf(x), tableNo: x.table_no, tiebreakRank: x.tiebreak_rank })));
  const myRank = ranked.find((r) => r.teamId === team.id)?.rank ?? null;
  const teamMembers = members.filter((m) => m.team_id === team.id && m.status === "active");
  const canAct = canActForTeam(team, member, members, now);
  const effective = ev.state === "PAUSED" ? ev.paused_from : ev.state;

  // mascotte
  const tally: Record<string, number> = {};
  for (const v of votes) if (v.team_id === team.id) tally[String(v.slot)] = (tally[String(v.slot)] ?? 0) + 1;
  const taken = config.mascotUnique ? teams.filter((x) => x.id !== team.id && x.status === "active" && x.mascot_slot && x.mascot_confirmed).map((x) => x.mascot_slot!) : [];
  const mascotOpen = !team.mascot_confirmed && !isTerminal(ev.state);

  // prova in corso
  let gameView: PlayerView["game"] = null;
  if (game && game.status !== "voided" && ["GAME_ACTIVE", "GAME_RESULTS", "LEADERBOARD", "PAUSED", "FINAL"].includes(ev.state)) {
    const def = mechanicOf(game.mechanic_code);
    const participant = game.participants.includes(team.id);
    const stage = gameStage(game, now);
    const scope = def && (def.input === "vote" || def.input === "coop") ? member.id : team.id;
    const [mine] = await db<{ n: number }[]>`select count(*)::int as n from tig_submissions where game_id = ${game.id} and scope_key = ${scope} and not void`;
    let memberView: unknown = null;
    if (participant && def?.memberView && stage !== "rule") {
      const mctx = memberCtx(game, team.id, member.id);
      try {
        memberView = mctx ? def.memberView(game.content as never, mctx) : null;
      } catch {
        memberView = null;
      }
    }
    const perMember = def?.input === "vote" || def?.input === "coop";
    const outcome: TeamOutcome | null = game.status === "scored" ? (game.outcome?.outcomes.find((o) => o.teamId === team.id) ?? null) : null;
    const [bet] = game.bet_enabled ? await db<{ amount: number }[]>`select amount from tig_bets where game_id = ${game.id} and team_id = ${team.id}` : [];
    gameView = {
      id: game.id,
      memberView,
      participant,
      canSubmit: participant && (perMember || canAct) && game.status === "active" && !ev.paused_at,
      submitted: mine.n > 0,
      outcome,
      bet: { allowed: game.bet_enabled && participant && canAct && game.status === "active" && !bet && stage !== "locked", cap: betCap(team.score), amount: bet?.amount ?? null },
    };
  }

  // Bottone del Caos
  const window = caosWindowOpen({ state: ev.state, mancheNo: ev.manche_no, paused: !!ev.paused_at, lastGameKind: game?.kind ?? null, caosInProgress: false, hasNextStep: true });
  const recent = new Map(attacks.map((a) => [a.target_team_id, a.n]));
  const targets: CaosTarget[] = teams
    .filter((x) => x.id !== team.id && x.status === "active" && x.approved)
    .map((x) => {
      const why = caosTargetCheck({ sourceTeamId: team.id, targetTeamId: x.id, targetActive: x.status === "active", targetApproved: x.approved, recentAttacksOnTarget: recent.get(x.id) ?? 0 });
      return { teamId: x.id, tableNo: x.table_no, name: x.name, allowed: !why, why };
    });
  let caosReason: string | null = null;
  if (team.caos_used) caosReason = "Bottone del Caos già usato stasera";
  else if (!team.approved) caosReason = "Aspetta la convalida dello staff";
  else if (!window) caosReason = (CAOS_MANCHES as readonly number[]).includes(ev.manche_no) ? "Si attiva tra una prova e l'altra" : "Disponibile nelle manche 2, 3 e 4";
  else if (!canAct) caosReason = "Lo attiva il capitano";

  // scudo
  const shieldActive = shieldRows.some((s) => s.status === "active" && s.manche_no === ev.manche_no);
  const shieldUsedThisManche = shieldRows.some((s) => s.manche_no === ev.manche_no);
  let shieldReason: string | null = null;
  if (!(CAOS_MANCHES as readonly number[]).includes(ev.manche_no) || isLobby(ev.state) || isTerminal(ev.state)) shieldReason = "Gli scudi si attivano nelle manche 2, 3 e 4";
  else if (shieldUsedThisManche) shieldReason = shieldActive ? "Scudo attivo fino a fine manche" : "Scudo già usato in questa manche";
  else if (!canAct) shieldReason = "Lo attiva il capitano";
  else if (effective === "BREAK") shieldReason = "In pausa";

  return {
    role: "player",
    me: { memberId: member.id, nickname: member.nickname, teamId: team.id, isCaptain: team.captain_member_id === member.id },
    team: {
      teamId: team.id,
      tableNo: team.table_no,
      name: team.name,
      approved: team.approved,
      color: team.color,
      score: team.score,
      rank: team.approved ? myRank : null,
      energy: team.energy,
      level: levelFor(team.energy, t),
      nextThreshold: nextThreshold(team.energy, t),
      chaosProgress: chaosProgress(team.energy, t),
      mascotSlot: team.mascot_slot,
      mascotConfirmed: team.mascot_confirmed,
      members: teamMembers.map((m) => ({ memberId: m.id, nickname: m.nickname, online: isOnline(m, now), isCaptain: team.captain_member_id === m.id, isMe: m.id === member.id })),
      shieldActive,
      caosUsed: team.caos_used,
      wins: team.wins,
    },
    mascot: { open: mascotOpen, myVote: votes.find((v) => v.member_id === member.id)?.slot ?? null, tally, taken, canConfirm: mascotOpen && canAct, unique: config.mascotUnique },
    game: gameView,
    caos: { available: !caosReason, windowOpen: window, reason: caosReason, targets },
    shield: { canActivate: !shieldReason, active: shieldActive, reason: shieldReason },
  };
}

// ---------------------------------------------------------------------------
// Vista della regia
// ---------------------------------------------------------------------------
export async function buildRegiaView(db: Db, ev: EventRow): Promise<RegiaView> {
  const config = parseConfig(ev.config);
  const now = ev.db_now.getTime();
  const [tables, teams, members, log, games] = await Promise.all([
    loadTables(db, ev.id),
    loadTeams(db, ev.id),
    loadMembers(db, ev.id),
    db<{ id: number; kind: string; audit: boolean; reason: string | null; from_state: string | null; to_state: string | null; created_at: Date; data: Record<string, unknown> | null }[]>`
      select id, kind, audit, reason, from_state, to_state, created_at, data from tig_log where event_id = ${ev.id} order by id desc limit 60`,
    db<{ id: string; manche_no: number; slot_no: number; kind: GameKind; mechanic_code: string; status: string; participants: string[]; teams: TeamRef[]; submissions: number }[]>`
      select g.id, g.manche_no, g.slot_no, g.kind, g.mechanic_code, g.status, g.participants, g.teams,
        (select count(*)::int from tig_submissions s where s.game_id = g.id and not s.void) as submissions
      from tig_games g where g.event_id = ${ev.id} order by g.created_at`,
  ]);
  const t = thresholds(config);
  const segs = runOfShow(config.durationMin, config.segments);
  const reg = tigRegistry();
  const implemented = reg.catalog.filter((c) => c.status === "implementata").length;
  const available = reg.mechanics.filter((m) => reg.variantsOf(m).length > 0).length;
  const game = games.find((g) => g.id === ev.current_game_id) ?? null;
  return {
    role: "organizer",
    config,
    displayKey: ev.display_key,
    tables: tables.map((tb) => {
      const team = teams.find((x) => x.table_id === tb.id) ?? null;
      const tm = team ? members.filter((m) => m.team_id === team.id && m.status !== "left") : [];
      return {
        tableId: tb.id,
        tableNo: tb.table_no,
        token: tb.qr_token,
        code: tb.join_code,
        pin: tb.pin,
        team: team
          ? {
              teamId: team.id,
              name: team.name,
              approved: team.approved,
              status: team.status,
              captainMemberId: team.captain_member_id,
              mascotSlot: team.mascot_slot,
              score: team.score,
              energy: team.energy,
              level: levelFor(team.energy, t),
              online: tm.filter((m) => isOnline(m, now)).length,
              members: tm.map((m) => ({ memberId: m.id, nickname: m.nickname, online: isOnline(m, now), isCaptain: team.captain_member_id === m.id, status: m.status, lastSeenAt: m.last_seen_at.toISOString() })),
            }
          : null,
      };
    }),
    log: log.map((l) => ({ id: Number(l.id), kind: l.kind, audit: l.audit, reason: l.reason, fromState: l.from_state, toState: l.to_state, at: l.created_at.toISOString(), data: l.data })),
    games: games.map((g) => {
      const def = mechanicOf(g.mechanic_code);
      const perMember = def?.input === "vote" || def?.input === "coop";
      const expected = perMember ? g.teams.filter((x) => g.participants.includes(x.teamId)).reduce((s, x) => s + x.members.length, 0) : g.participants.length;
      return { id: g.id, mancheNo: g.manche_no, slotNo: g.slot_no, kind: g.kind, code: g.mechanic_code, title: def?.title ?? g.mechanic_code, status: g.status, submissions: g.submissions, expected };
    }),
    segments: segs.map((s) => ({ key: s.key, label: s.label, minutes: s.minutes, games: s.games })),
    displayOnline: !!ev.display_seen_at && now - ev.display_seen_at.getTime() <= ONLINE_MS,
    canRollback: (ev.state === "GAME_ACTIVE" || ev.state === "GAME_RESULTS" || ev.state === "LEADERBOARD") && !!game && game.status !== "voided",
    canSkip: ["INTRO", "ROUND_INTRO", "GAME_ACTIVE", "GAME_RESULTS", "LEADERBOARD", "BREAK", "FINAL", "AWARDS"].includes(ev.state),
    catalog: { implemented, total: reg.catalog.length, available },
  };
}
