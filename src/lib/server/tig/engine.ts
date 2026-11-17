import "server-only";
import { getSql, type Tx } from "@/lib/database/db";
import type { AcceptedSubmission, MechanicDef, ScoreOutput, TeamOutcome } from "@/lib/tig/games/contract";
import {
  applyFloor,
  assignMascots,
  awardsOrder,
  betCap,
  canTransition,
  capOwnPoints,
  caosTargetCheck,
  caosWindowOpen,
  CAOS_ALARM_MS,
  CAOS_DUEL_MS,
  CAOS_MANCHES,
  checkTeamName,
  checkTransfer,
  computeRanks,
  duelWinner,
  ENERGY,
  energyForGame,
  fitsInManche,
  gameNeedMs,
  isLobby,
  isTerminal,
  leaderboardMs,
  levelFor,
  PAUSABLE,
  PHASE_MS,
  pickMascotSlot,
  POINTS,
  runOfShow,
  topTie,
  BREAK_AFTER_MANCHE,
  type MascotVote,
} from "@/lib/tig/rules";
import { pickVariant, seededRandom, selectGame } from "@/lib/tig/selection";
import { segmentsSchema, MANCHE_TITLES, SEGMENT_KEYS, type EventConfig, type EventState, type GameKind, type Spotlight, type TigAction, type TigEventNote, type TigPublicState } from "@/lib/tig/types";
import { TigError, tigFail } from "./errors";
import { broadcastTig } from "./realtime";
import {
  accuracyOf,
  buildPublicState,
  canActForTeam,
  inGame,
  loadEvent,
  loadGame,
  loadMembers,
  loadTeams,
  parseConfig,
  phaseCtx,
  teamRefs,
  thresholds,
  type EventRow,
  type GameRow,
  type MemberRow,
  type TeamRow,
} from "./state";
import { forcedCode, mechanicOf, tigRegistry } from "./registry";
import { newSeed } from "./tokens";

/**
 * MOTORE di TAVOLI IN GUERRA!: macchina a stati AUTOREVOLE sul server.
 *
 * Ogni azione è UNA transazione con il lucchetto sulla riga della serata (FOR UPDATE): richieste simultanee in
 * fila, niente doppie transizioni, niente poteri usati due volte. Dentro si usa SOLO `tx`. Alla fine: versione +1
 * e stato PUBBLICO sul canale realtime (solo se la transazione va a buon fine).
 *
 * - Scadenze salvate nel database e controllate a ogni azione e a ogni lettura (avanzamento «pigro»):
 *   la serata va avanti anche se nessuno tocca nulla; la pausa le sposta in avanti alla ripresa.
 * - Punti SOLO dal registro `tig_score_ledger` (motivo, fonte, riferimento, chiave di idempotenza UNICA),
 *   con i limiti anti-valanga applicati qui (saldo ≥ 0, trasferimenti ≤ 40, ≤ 80 persi per manche, max 2
 *   attacchi sullo stesso tavolo in 10', scudo, puntata ≤ min(25%, 250)).
 * - Invii validati con lo schema della meccanica, chiave di idempotenza, uno valido per squadra (team/pub/duel)
 *   o per membro (vote/coop), solo dai partecipanti, solo dentro la finestra della prova.
 * - Regia: skip/rollback/pausa/durate con AUDIT (motivo, stato prima/dopo).
 */

export interface TigActor {
  userId: string;
  ip: string | null;
}
export const SYSTEM_ACTOR: TigActor = { userId: "00000000-0000-0000-0000-000000000000", ip: null };

const LOCK_TIMEOUT = "4s";
const STATEMENT_TIMEOUT = "10s";
const UUID = /^[0-9a-f-]{36}$/i;

interface Ctx {
  tx: Tx;
  ev: EventRow;
  actor: TigActor;
  system: boolean;
  isOrganizer: boolean;
  member: MemberRow | null;
  teams: TeamRow[];
  members: MemberRow[];
  config: EventConfig;
  changed: boolean;
  secretChanged: boolean;
  note: TigEventNote | null | undefined;
  /** risposta dell'azione (es. invio accettato) */
  result: Record<string, unknown>;
}

export interface ActionResult {
  state: TigPublicState;
  changed: boolean;
  result: Record<string, unknown>;
}

const nowMs = (ctx: Ctx) => ctx.ev.db_now.getTime();
const at = (ctx: Ctx, plusMs: number) => new Date(nowMs(ctx) + plusMs);

// ---------------------------------------------------------------------------
// Ingresso
// ---------------------------------------------------------------------------
export async function runAction(eventId: string, actor: TigActor, action: TigAction): Promise<ActionResult> {
  if (!UUID.test(eventId)) tigFail("NOT_FOUND", "Serata non trovata");
  const system = actor === SYSTEM_ACTOR || actor.userId === SYSTEM_ACTOR.userId;
  try {
    return await getSql().begin(async (tx) => {
      await tx`select set_config('lock_timeout', ${LOCK_TIMEOUT}, true), set_config('statement_timeout', ${STATEMENT_TIMEOUT}, true)`;
      const ev = await loadEvent(tx, eventId, true);
      if (!ev) tigFail("NOT_FOUND", "Serata non trovata");
      if (ev.status === "closed" && action.action !== "tick") tigFail("CLOSED", "Questa serata è chiusa");
      const ctx = await makeCtx(tx, ev, actor, system);
      if (ev.status === "open") await catchUp(ctx);
      await apply(ctx, action);
      return commit(ctx);
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "55P03" || code === "57014") throw new TigError("BUSY", "Troppe richieste nello stesso momento: riprova");
    throw e;
  }
}

async function makeCtx(tx: Tx, ev: EventRow, actor: TigActor, system: boolean): Promise<Ctx> {
  const [teams, members] = await Promise.all([loadTeams(tx, ev.id), loadMembers(tx, ev.id)]);
  const isOrganizer = !system && ev.owner_user_id === actor.userId;
  const member = system ? null : (members.find((m) => m.user_id === actor.userId) ?? null);
  if (!system && !isOrganizer) {
    if (!member) tigFail("NOT_MEMBER", "Non fai parte di questa serata");
    if (member.status === "kicked") tigFail("KICKED", "Lo staff ti ha tolto da questa serata");
  }
  return { tx, ev, actor, system, isOrganizer, member, teams, members, config: parseConfig(ev.config), changed: false, secretChanged: false, note: undefined, result: {} };
}

function requireOrganizer(ctx: Ctx) {
  if (!ctx.isOrganizer) tigFail("FORBIDDEN", "Solo l'organizzatore della serata può farlo");
}
function requireState(ctx: Ctx, ...states: EventState[]) {
  if (!states.includes(ctx.ev.state)) tigFail("WRONG_PHASE", "Questa azione non è possibile in questo momento");
}
function requireNotPaused(ctx: Ctx) {
  if (ctx.ev.state === "PAUSED" || ctx.ev.paused_at) tigFail("PAUSED", "La serata è in pausa");
}
function activeMember(ctx: Ctx): MemberRow {
  const m = ctx.member;
  if (!m || m.status !== "active") tigFail("NOT_MEMBER", "Non sei in una squadra di questa serata");
  return m;
}
function team(ctx: Ctx, id: string): TeamRow {
  const t = ctx.teams.find((x) => x.id === id);
  if (!t) tigFail("NOT_FOUND", "Squadra non trovata");
  return t;
}
function myTeam(ctx: Ctx): TeamRow {
  const m = activeMember(ctx);
  const t = team(ctx, m.team_id);
  if (t.status !== "active") tigFail("KICKED", "Il tuo tavolo è stato escluso dallo staff");
  return t;
}
function requireTeamDecision(ctx: Ctx, t: TeamRow) {
  if (!canActForTeam(t, activeMember(ctx), ctx.members, nowMs(ctx))) tigFail("FORBIDDEN", "Questa scelta la conferma il capitano del tavolo");
}

/** Cambio di stato con controllo della macchina a stati. */
function setState(ctx: Ctx, to: EventState, durationMs: number | null) {
  const from = ctx.ev.state;
  if (from !== to && !canTransition(from, to)) tigFail("WRONG_PHASE", `Passaggio non consentito: ${from} → ${to}`);
  ctx.ev.state = to;
  ctx.ev.phase_started_at = ctx.ev.db_now;
  ctx.ev.phase_deadline_at = durationMs === null ? null : at(ctx, durationMs);
  ctx.ev.phase_total_ms = durationMs;
  ctx.changed = true;
  ctx.secretChanged = true;
}

async function log(ctx: Ctx, kind: string, o: { audit?: boolean; reason?: string | null; from?: string | null; to?: string | null; data?: Record<string, unknown> } = {}) {
  await ctx.tx`
    insert into tig_log (event_id, kind, audit, actor_user_id, reason, from_state, to_state, data)
    values (${ctx.ev.id}, ${kind}, ${!!o.audit}, ${ctx.system ? null : ctx.actor.userId}, ${o.reason ?? null}, ${o.from ?? null}, ${o.to ?? null}, ${o.data ? ctx.tx.json(o.data as never) : null})`;
}

function note(ctx: Ctx, kind: string, data?: Record<string, unknown>) {
  ctx.note = { kind, at: ctx.ev.db_now.toISOString(), ...(data ? { data } : {}) };
  ctx.changed = true;
}

async function saveEvent(ctx: Ctx) {
  const e = ctx.ev;
  await ctx.tx`
    update tig_events set
      state = ${e.state}, paused_from = ${e.paused_from}, late_join = ${e.late_join}, manche_no = ${e.manche_no}, game_index = ${e.game_index},
      manche_started_at = ${e.manche_started_at}, manche_paused_ms = ${e.manche_paused_ms}, current_game_id = ${e.current_game_id},
      plan = ${ctx.tx.json(e.plan as never)}, phase_started_at = ${e.phase_started_at}, phase_deadline_at = ${e.phase_deadline_at},
      phase_total_ms = ${e.phase_total_ms}, paused_at = ${e.paused_at}, paused_ms = ${e.paused_ms},
      spotlight = ${e.spotlight ? ctx.tx.json(e.spotlight as never) : null}, awards = ${e.awards ? ctx.tx.json(e.awards as never) : null},
      started_at = ${e.started_at}, completed_at = ${e.completed_at}, status = ${e.status}, close_reason = ${e.close_reason},
      config = ${ctx.tx.json(ctx.config as never)}
    where id = ${e.id}`;
}

async function commit(ctx: Ctx): Promise<ActionResult> {
  const { tx, ev } = ctx;
  if (!ctx.changed) return { state: await buildPublicState(tx, ev), changed: false, result: ctx.result };
  await saveEvent(ctx);
  await tx`
    update tig_events set
      version = version + 1,
      secret_rev = secret_rev + ${ctx.secretChanged ? 1 : 0},
      event = ${ctx.note === undefined ? tx`event` : ctx.note === null ? null : tx.json(ctx.note as never)},
      updated_at = now(), last_activity_at = now()
      ${ctx.isOrganizer && !ctx.system ? tx`, host_seen_at = now()` : tx``}
    where id = ${ev.id}`;
  const fresh = (await loadEvent(tx, ev.id))!;
  const state = await buildPublicState(tx, fresh);
  await broadcastTig(tx, state);
  return { state, changed: true, result: ctx.result };
}

// ---------------------------------------------------------------------------
// Scadenze (anche più passi se nessuno ha letto per un po')
// ---------------------------------------------------------------------------
async function catchUp(ctx: Ctx) {
  for (let i = 0; i < 6; i++) {
    const e = ctx.ev;
    if (e.state === "PAUSED" || isTerminal(e.state) || isLobby(e.state)) return;
    if (!e.phase_deadline_at || nowMs(ctx) < e.phase_deadline_at.getTime()) return;
    const before = `${e.state}|${e.phase_deadline_at.getTime()}`;
    await onDeadline(ctx);
    if (`${ctx.ev.state}|${ctx.ev.phase_deadline_at?.getTime()}` === before) return;
  }
}

async function onDeadline(ctx: Ctx) {
  switch (ctx.ev.state) {
    case "INTRO":
      return startManche(ctx, 1);
    case "ROUND_INTRO":
      return startNextGame(ctx);
    case "GAME_ACTIVE":
      return closeGame(ctx);
    case "GAME_RESULTS":
      return afterResults(ctx);
    case "LEADERBOARD":
      return afterLeaderboard(ctx);
    case "BREAK":
      return startManche(ctx, BREAK_AFTER_MANCHE + 1);
    case "FINAL":
      return afterFinal(ctx);
    case "AWARDS":
      return complete(ctx);
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Scaletta
// ---------------------------------------------------------------------------
function segments(ctx: Ctx) {
  return runOfShow(ctx.config.durationMin, ctx.config.segments);
}
function mancheBudgetMs(ctx: Ctx, n: number) {
  return (segments(ctx).find((s) => s.mancheNo === n)?.minutes ?? 15) * 60_000;
}
function mancheElapsedMs(ctx: Ctx) {
  const e = ctx.ev;
  if (!e.manche_started_at) return 0;
  return Math.max(0, nowMs(ctx) - e.manche_started_at.getTime() - Number(e.manche_paused_ms));
}
function gamesInManche(ctx: Ctx, n: number) {
  return ctx.ev.plan.find((p) => p.mancheNo === n)?.games ?? segments(ctx).find((s) => s.mancheNo === n)?.games ?? 4;
}

async function startEvent(ctx: Ctx) {
  const playing = ctx.teams.filter(inGame);
  if (playing.length < 2) tigFail("NOT_AVAILABLE", "Servono almeno 2 tavoli convalidati dallo staff per partire");
  const reg = tigRegistry();
  if (!reg.mechanics.some((m) => reg.variantsOf(m).length > 0)) tigFail("NOT_AVAILABLE", "Nessun minigioco con contenuti pronti: impossibile partire");
  await finalizeMascots(ctx);
  ctx.ev.plan = segments(ctx)
    .filter((s) => s.mancheNo)
    .map((s) => ({ mancheNo: s.mancheNo!, title: MANCHE_TITLES[s.mancheNo!], games: s.games ?? 0, minutes: s.minutes, played: 0 }));
  ctx.ev.started_at = ctx.ev.db_now;
  ctx.ev.late_join = false;
  setState(ctx, "INTRO", PHASE_MS.intro);
  note(ctx, "start");
}

async function startManche(ctx: Ctx, n: number) {
  // gli scudi della manche precedente scadono
  await ctx.tx`update tig_powers set status = 'expired' where event_id = ${ctx.ev.id} and kind = 'shield' and status = 'active' and manche_no < ${n}`;
  ctx.ev.manche_no = n;
  ctx.ev.game_index = 0;
  ctx.ev.manche_started_at = ctx.ev.db_now;
  ctx.ev.manche_paused_ms = 0;
  ctx.ev.spotlight = null;
  ctx.ev.current_game_id = null;
  setState(ctx, "ROUND_INTRO", PHASE_MS.roundIntro);
  note(ctx, "manche", { mancheNo: n });
}

async function usedHistory(ctx: Ctx) {
  const [usedRows, recentRows] = await Promise.all([
    ctx.tx<{ mechanic_code: string; variant_key: string }[]>`select mechanic_code, variant_key from tig_games where event_id = ${ctx.ev.id} and status <> 'voided'`,
    // varianti viste di recente dallo stesso organizzatore o nello stesso locale (ultimi 60 giorni)
    ctx.tx<{ mechanic_code: string; variant_key: string }[]>`
      select distinct g.mechanic_code, g.variant_key from tig_games g join tig_events e on e.id = g.event_id
      where e.id <> ${ctx.ev.id} and (e.owner_user_id = ${ctx.ev.owner_user_id} or e.venue_key = ${ctx.ev.venue_key})
        and g.created_at > now() - interval '60 days'
      limit 2000`,
  ]);
  return {
    usedCodes: usedRows.map((r) => r.mechanic_code),
    usedVariants: new Set(usedRows.map((r) => `${r.mechanic_code}:${r.variant_key}`)),
    recentVariants: new Set(recentRows.map((r) => `${r.mechanic_code}:${r.variant_key}`)),
  };
}

async function startNextGame(ctx: Ctx) {
  const e = ctx.ev;
  const total = gamesInManche(ctx, e.manche_no);
  const elapsed = mancheElapsedMs(ctx);
  const budget = mancheBudgetMs(ctx, e.manche_no);
  if (e.game_index >= total) return endManche(ctx);
  const refs = teamRefs(ctx.teams, ctx.members);
  if (refs.length < 1) return endManche(ctx);
  const hist = await usedHistory(ctx);
  const slot = e.game_index + 1;
  const reg = tigRegistry();
  // solo sviluppo/test e2e: prove imposte in ordine (TIG_TEST_FORCE_CODES)
  const [{ played }] = await ctx.tx<{ played: number }[]>`select count(*)::int as played from tig_games where event_id = ${e.id} and kind = 'regular' and status <> 'voided'`;
  const forced = forcedCode(played);
  const forcedDef = forced ? mechanicOf(forced) : undefined;
  const forcedSel = forcedDef && reg.variantsOf(forcedDef).length ? { def: forcedDef, variant: pickVariant(forcedDef.code, reg.variantsOf(forcedDef), hist, "media", seededRandom(`${e.id}|${slot}`)), repeated: false, difficulty: null } : null;
  const sel = forcedSel ?? selectGame({
    mechanics: reg.mechanics,
    variantsOf: reg.variantsOf,
    mancheNo: e.manche_no,
    slotNo: slot,
    gamesInManche: total,
    kind: "regular",
    ...hist,
    oneDevice: refs.some((r) => r.members.length <= 1),
    remainingMs: Math.max(0, budget - elapsed),
    seed: `${e.id}|${newSeed()}`,
  });
  if (!sel || !fitsInManche({ mancheBudgetMs: budget, mancheElapsedMs: elapsed, timerSec: sel.def.timerSec })) {
    await log(ctx, "manche_short", { data: { mancheNo: e.manche_no, played: e.game_index, reason: sel ? "tempo" : "catalogo" } });
    return endManche(ctx);
  }
  e.game_index = slot;
  const isLast = slot === total;
  await createGame(ctx, { def: sel.def, variantKey: sel.variant.key, difficulty: sel.difficulty, content: sel.variant.content, kind: "regular", slotNo: slot, participants: refs.map((r) => r.teamId), timerMs: sel.def.timerSec * 1000, leadMs: PHASE_MS.ruleLead, betEnabled: e.manche_no === 5 && isLast, repeated: sel.repeated });
  e.plan = e.plan.map((p) => (p.mancheNo === e.manche_no ? { ...p, played: slot } : p));
}

async function createGame(
  ctx: Ctx,
  g: { def: MechanicDef; variantKey: string; difficulty: string | null; content: unknown; kind: GameKind; slotNo: number; participants: string[]; timerMs: number; leadMs: number; betEnabled?: boolean; repeated?: boolean; caos?: { source: string; target: string }; attempt?: number },
): Promise<GameRow> {
  const startsAt = at(ctx, g.leadMs);
  const deadlineAt = new Date(startsAt.getTime() + g.timerMs);
  const refs = teamRefs(ctx.teams, ctx.members);
  // contenuto congelato: chi lo prevede riceve i saldi dei tavoli (es. la puntata nascosta: tetto del 25%)
  if (g.content && typeof g.content === "object" && !Array.isArray(g.content)) {
    const balances = Object.fromEntries(ctx.teams.filter((t) => g.participants.includes(t.id)).map((t) => [t.id, t.score]));
    const withBalances = g.def.contentSchema.safeParse({ ...(g.content as Record<string, unknown>), balances });
    if (withBalances.success && (withBalances.data as Record<string, unknown>).balances) g.content = withBalances.data;
  }
  const [row] = await ctx.tx<GameRow[]>`
    insert into tig_games (event_id, manche_no, slot_no, kind, attempt, mechanic_code, variant_key, difficulty, content, seed, teams, participants, bet_enabled, status, starts_at, deadline_at, timer_ms, caos_source, caos_target)
    values (${ctx.ev.id}, ${ctx.ev.manche_no}, ${g.slotNo}, ${g.kind}, ${g.attempt ?? 1}, ${g.def.code}, ${g.variantKey}, ${g.difficulty}, ${ctx.tx.json(g.content as never)}, ${newSeed()},
      ${ctx.tx.json(refs as never)}, ${ctx.tx.array(g.participants)}::uuid[], ${!!g.betEnabled}, 'active', ${startsAt}, ${deadlineAt}, ${g.timerMs}, ${g.caos?.source ?? null}, ${g.caos?.target ?? null})
    returning *`;
  ctx.ev.current_game_id = row.id;
  setState(ctx, "GAME_ACTIVE", g.leadMs + g.timerMs + PHASE_MS.grace);
  await log(ctx, "game_started", { data: { gameId: row.id, code: g.def.code, variant: g.variantKey, kind: g.kind, mancheNo: ctx.ev.manche_no, slotNo: g.slotNo, repeated: !!g.repeated } });
  if (g.kind === "regular") ctx.ev.spotlight = null;
  note(ctx, g.kind === "caos" ? "caos" : g.kind === "tiebreak" ? "tiebreak" : "game", { gameId: row.id, code: g.def.code });
  return row;
}

async function endManche(ctx: Ctx) {
  const e = ctx.ev;
  // anche l'ultimo può evolvere: spinta di Energia Caos a chi chiude la manche in fondo
  const ranked = computeRanks(ctx.teams.filter(inGame).map((t) => ({ teamId: t.id, score: t.score, wins: t.wins, accuracy: accuracyOf(t), tableNo: t.table_no })));
  const worst = Math.max(0, ...ranked.map((r) => r.rank));
  if (ranked.length > 1) for (const r of ranked.filter((x) => x.rank === worst && x.rank > 1)) await addEnergy(ctx, r.teamId, ENERGY.lastPlaceBoost, "spinta di fine manche", `manche:${e.manche_no}`, `elast:${e.id}:${e.manche_no}:${r.teamId}`);
  if (e.manche_no === BREAK_AFTER_MANCHE) {
    const breakMin = segments(ctx).find((s) => s.key === "break")?.minutes ?? 10;
    if (breakMin > 0) {
      e.current_game_id = null;
      e.spotlight = null;
      setState(ctx, "BREAK", breakMin * 60_000);
      note(ctx, "break");
      return;
    }
  }
  if (e.manche_no < 5) return startManche(ctx, e.manche_no + 1);
  return enterFinal(ctx);
}

async function afterResults(ctx: Ctx) {
  const game = await loadGame(ctx.tx, ctx.ev.current_game_id);
  if (game?.kind === "tiebreak") return enterFinal(ctx, true);
  const e = ctx.ev;
  const total = gamesInManche(ctx, e.manche_no);
  const end = e.game_index >= total;
  const ms = leaderboardMs({ mancheBudgetMs: mancheBudgetMs(ctx, e.manche_no), mancheElapsedMs: mancheElapsedMs(ctx), gamesLeft: Math.max(0, total - e.game_index), avgGameNeedMs: gameNeedMs(45), endOfManche: end });
  setState(ctx, "LEADERBOARD", ms);
  note(ctx, "leaderboard", { end });
}

async function afterLeaderboard(ctx: Ctx) {
  const e = ctx.ev;
  e.spotlight = null;
  if (e.game_index >= gamesInManche(ctx, e.manche_no)) return endManche(ctx);
  return startNextGame(ctx);
}

async function enterFinal(ctx: Ctx, afterTiebreak = false) {
  ctx.ev.current_game_id = afterTiebreak ? ctx.ev.current_game_id : null;
  ctx.ev.spotlight = null;
  setState(ctx, "FINAL", PHASE_MS.final);
  note(ctx, "final");
}

async function afterFinal(ctx: Ctx) {
  const playing = ctx.teams.filter(inGame);
  const tied = topTie(playing.map((t) => ({ teamId: t.id, score: t.score, wins: t.wins, accuracy: accuracyOf(t), tableNo: t.table_no })));
  const decided = playing.some((t) => t.tiebreak_rank !== null);
  const [{ n }] = await ctx.tx<{ n: number }[]>`select count(*)::int as n from tig_games where event_id = ${ctx.ev.id} and kind = 'tiebreak' and status = 'scored'`;
  if (tied.length > 1 && !decided && n < 2) return startTiebreak(ctx, tied, n + 1);
  return startAwards(ctx);
}

async function startTiebreak(ctx: Ctx, ids: string[], n: number) {
  const hist = await usedHistory(ctx);
  const sel = selectGame({ mechanics: tigRegistry().mechanics, variantsOf: tigRegistry().variantsOf, mancheNo: 5, slotNo: 100 + n, gamesInManche: 1, kind: "tiebreak", ...hist, oneDevice: true, remainingMs: null, seed: `${ctx.ev.id}|tb|${newSeed()}` });
  if (!sel) return startAwards(ctx);
  await createGame(ctx, { def: sel.def, variantKey: sel.variant.key, difficulty: sel.difficulty, content: sel.variant.content, kind: "tiebreak", slotNo: 100 + n, participants: ids, timerMs: CAOS_DUEL_MS, leadMs: PHASE_MS.ruleLead });
  ctx.ev.spotlight = { kind: "duel", teamIds: ids, eventId: ctx.ev.current_game_id! };
}

async function startAwards(ctx: Ctx) {
  const playing = ctx.teams.filter(inGame);
  ctx.ev.awards = { order: awardsOrder(playing.map((t) => ({ teamId: t.id, score: t.score, wins: t.wins, accuracy: accuracyOf(t), tableNo: t.table_no, tiebreakRank: t.tiebreak_rank }))) };
  const awardsMin = segments(ctx).find((s) => s.key === "awards")?.minutes ?? 5;
  const winner = ctx.ev.awards.order.at(-1);
  ctx.ev.spotlight = winner ? { kind: "winner", teamIds: [winner], eventId: `awards-${ctx.ev.id}` } : null;
  setState(ctx, "AWARDS", Math.max(PHASE_MS.awardsMin, awardsMin * 60_000));
  note(ctx, "awards");
}

async function complete(ctx: Ctx) {
  ctx.ev.completed_at = ctx.ev.db_now;
  setState(ctx, "COMPLETED", null);
  note(ctx, "completed");
}

// ---------------------------------------------------------------------------
// Registro dei punti, Energia Caos, attacchi
// ---------------------------------------------------------------------------
/** Una voce del registro: applicata UNA volta (chiave unica), mai sotto zero. Restituisce il valore applicato. */
async function ledger(ctx: Ctx, teamId: string, requested: number, o: { source: "game" | "transfer" | "caos" | "bet" | "admin" | "rollback"; reason: string; ref: string | null; key: string; counterpart?: string | null }): Promise<number> {
  const t = team(ctx, teamId);
  const { balance, applied } = applyFloor(t.score, requested);
  const [row] = await ctx.tx<{ id: number }[]>`
    insert into tig_score_ledger (event_id, team_id, manche_no, source, reason, ref, counterpart_team_id, requested, applied, balance_after, idempotency_key)
    values (${ctx.ev.id}, ${teamId}, ${ctx.ev.manche_no}, ${o.source}, ${o.reason.slice(0, 200)}, ${o.ref}, ${o.counterpart ?? null}, ${Math.round(requested)}, ${applied}, ${balance}, ${o.key})
    on conflict (idempotency_key) do nothing
    returning id`;
  if (!row) return 0;
  if (applied !== 0) await ctx.tx`update tig_teams set score = ${balance} where id = ${teamId}`;
  t.score = balance;
  ctx.changed = true;
  return applied;
}

/** Energia Caos (solo estetica): registrata una volta, con l'evoluzione della mascotte quando supera una soglia. */
async function addEnergy(ctx: Ctx, teamId: string, amount: number, reason: string, ref: string | null, key: string): Promise<{ evolved: 2 | 3 | null }> {
  if (amount <= 0) return { evolved: null };
  const t = team(ctx, teamId);
  const before = levelFor(t.energy, thresholds(ctx.config));
  const energy = t.energy + Math.round(amount);
  const after = levelFor(energy, thresholds(ctx.config));
  const [row] = await ctx.tx<{ id: number }[]>`
    insert into tig_energy_log (event_id, team_id, amount, reason, ref, level_after, idempotency_key)
    values (${ctx.ev.id}, ${teamId}, ${Math.round(amount)}, ${reason}, ${ref}, ${after}, ${key})
    on conflict (idempotency_key) do nothing returning id`;
  if (!row) return { evolved: null };
  await ctx.tx`update tig_teams set energy = ${energy}, mascot_level = ${after} where id = ${teamId}`;
  t.energy = energy;
  t.mascot_level = after;
  ctx.changed = true;
  if (after > before) {
    await log(ctx, "evolve", { data: { teamId, level: after } });
    return { evolved: after as 2 | 3 };
  }
  return { evolved: null };
}

async function recentAttacksOn(ctx: Ctx, targetId: string): Promise<number> {
  const [r] = await ctx.tx<{ n: number }[]>`
    select count(*)::int as n from tig_attacks
    where event_id = ${ctx.ev.id} and target_team_id = ${targetId} and outcome <> 'refused'
      and created_at > now() - make_interval(secs => ${POINTS.attackWindowMs / 1000})`;
  return r.n;
}

async function lostToOthersThisManche(ctx: Ctx, teamId: string): Promise<number> {
  const [r] = await ctx.tx<{ lost: number }[]>`
    select coalesce(-sum(applied), 0)::int as lost from tig_score_ledger
    where event_id = ${ctx.ev.id} and team_id = ${teamId} and manche_no = ${ctx.ev.manche_no} and source = 'transfer' and applied < 0`;
  return r.lost;
}

/**
 * Azione di una squadra contro un'altra, proposta da una meccanica in `TeamOutcome.transfers`.
 * Interpretazione del contratto: la voce sta nell'esito di CHI AGISCE (`source`) ed è diretta a `toTeamId`;
 * punti > 0 = furto (il bersaglio perde, chi agisce guadagna esattamente quanto tolto); punti < 0 = penalità
 * (il bersaglio perde, nessuno guadagna). Tetti, scudi e finestra anti-accanimento li applica il runtime.
 */
export async function applyTransfer(ctx: Ctx, gameId: string | null, sourceId: string, targetId: string, points: number, reason: string, key: string): Promise<{ amount: number; outcome: "applied" | "blocked" | "refused" }> {
  const target = ctx.teams.find((t) => t.id === targetId);
  if (!target || !inGame(target) || targetId === sourceId) return { amount: 0, outcome: "refused" };
  const [done] = await ctx.tx<{ id: number }[]>`select id from tig_score_ledger where idempotency_key = ${`${key}:loss`}`;
  if (done) return { amount: 0, outcome: "refused" };
  const [shield] = await ctx.tx<{ id: string }[]>`
    select id from tig_powers where event_id = ${ctx.ev.id} and team_id = ${targetId} and kind = 'shield' and status = 'active' and manche_no = ${ctx.ev.manche_no} for update`;
  const check = checkTransfer({ requested: points, recentAttacksOnTarget: await recentAttacksOn(ctx, targetId), targetShield: !!shield, lostThisManche: await lostToOthersThisManche(ctx, targetId), targetBalance: target.score });
  const kind = points > 0 ? "transfer" : "penalty";
  if (check.outcome === "blocked" && shield) {
    await ctx.tx`update tig_powers set status = 'consumed', consumed_at = now(), consumed_ref = ${gameId} where id = ${shield.id}`;
    ctx.ev.spotlight = { kind: "shield", teamIds: [targetId, sourceId], eventId: `shield-${shield.id}` };
  }
  await ctx.tx`
    insert into tig_attacks (event_id, source_team_id, target_team_id, kind, game_id, manche_no, outcome, amount)
    values (${ctx.ev.id}, ${sourceId}, ${targetId}, ${kind}, ${gameId}, ${ctx.ev.manche_no}, ${check.outcome}, ${check.amount})`;
  if (check.outcome !== "applied" || check.amount <= 0) {
    await log(ctx, "attack_" + check.outcome, { data: { sourceId, targetId, requested: points, why: check.why } });
    return { amount: 0, outcome: check.outcome };
  }
  const lost = -(await ledger(ctx, targetId, -check.amount, { source: "transfer", reason: `${reason} (tavolo ${team(ctx, sourceId).table_no})`, ref: gameId, key: `${key}:loss`, counterpart: sourceId }));
  if (points > 0 && lost > 0) await ledger(ctx, sourceId, lost, { source: "transfer", reason: `${reason} (dal tavolo ${target.table_no})`, ref: gameId, key: `${key}:gain`, counterpart: targetId });
  return { amount: lost, outcome: "applied" };
}

// ---------------------------------------------------------------------------
// Chiusura e punteggio di una prova
// ---------------------------------------------------------------------------
async function closeGame(ctx: Ctx) {
  const game = await loadGame(ctx.tx, ctx.ev.current_game_id);
  if (!game || game.status !== "active") {
    setState(ctx, "GAME_RESULTS", PHASE_MS.reveal);
    return;
  }
  const def = mechanicOf(game.mechanic_code);
  const subs = await ctx.tx<{ team_id: string; member_id: string; elapsed_ms: number; payload: unknown }[]>`
    select team_id, member_id, elapsed_ms, payload from tig_submissions where game_id = ${game.id} and not void order by created_at`;
  const accepted: AcceptedSubmission<unknown>[] = subs.map((s) => ({ teamId: s.team_id, memberId: s.member_id, elapsedMs: s.elapsed_ms, payload: s.payload }));
  let proposed: ScoreOutput = { outcomes: [] };
  if (def) {
    try {
      proposed = def.score({ content: game.content as never, ctx: phaseCtx(game), submissions: accepted });
    } catch (e) {
      console.error("[tig] score() non riuscita", game.mechanic_code, e);
      await log(ctx, "score_error", { data: { gameId: game.id, code: game.mechanic_code } });
    }
  }
  const byTeam = new Map(proposed.outcomes.map((o) => [o.teamId, o]));
  const participants = game.participants.filter((id) => ctx.teams.some((t) => t.id === id && inGame(t)));
  const submittedTeams = new Set(subs.map((s) => s.team_id));
  const applied: TeamOutcome[] = [];
  const stats: Record<string, { win: number; acc: number | null }> = {};
  const evolutions: { teamId: string; level: number }[] = [];
  let winner: string | null = null;

  if (game.kind === "caos" || game.kind === "tiebreak") {
    const firstCorrect = new Map<string, number>();
    for (const s of subs) if (!firstCorrect.has(s.team_id)) firstCorrect.set(s.team_id, s.elapsed_ms);
    winner = duelWinner(participants.map((id) => ({ teamId: id, points: byTeam.get(id)?.points ?? 0, correct: byTeam.get(id)?.correct ?? null, elapsedMs: firstCorrect.get(id) ?? null })));
  }

  for (const id of participants) {
    const o = byTeam.get(id) ?? { teamId: id, points: 0, chaos: 0, correct: null, accuracy: null, label: submittedTeams.has(id) ? "Esito non disponibile" : "Nessuna risposta" };
    const t = team(ctx, id);
    let got = 0;
    if (game.kind === "regular") {
      const capped = capOwnPoints(o.points, game.manche_no, t.score);
      if (capped !== 0) got = await ledger(ctx, id, capped, { source: "game", reason: def?.title ?? game.mechanic_code, ref: game.id, key: `g:${game.id}:${id}` });
    } else if (game.kind === "caos" && winner === id) {
      got = await ledger(ctx, id, POINTS.caosWin, { source: "caos", reason: "Bottone del Caos: duello vinto", ref: game.id, key: `caos:${game.id}` });
    }
    const win = game.kind === "regular" ? (o.correct === true ? 1 : 0) : winner === id ? 1 : 0;
    const acc = game.kind === "regular" && typeof o.accuracy === "number" && Number.isFinite(o.accuracy) ? Math.max(0, Math.min(1, o.accuracy)) : null;
    stats[id] = { win, acc };
    if (win || acc !== null) {
      await ctx.tx`update tig_teams set wins = wins + ${win}, acc_sum = acc_sum + ${acc ?? 0}, acc_n = acc_n + ${acc === null ? 0 : 1} where id = ${id}`;
      t.wins += win;
      t.acc_sum += acc ?? 0;
      t.acc_n += acc === null ? 0 : 1;
    }
    // Energia Caos
    let energy = energyForGame({ submitted: submittedTeams.has(id), correct: o.correct, mechanicChaos: o.chaos });
    if (game.kind === "caos") energy = (id === game.caos_target ? ENERGY.caosAccepted : 0) + (winner === id ? ENERGY.caosWin : ENERGY.caosLose);
    if (game.kind === "tiebreak") energy = ENERGY.tiebreak;
    const ev = await addEnergy(ctx, id, energy, game.kind === "regular" ? "prova" : game.kind === "caos" ? "duello del Caos" : "spareggio", game.id, `e:${game.id}:${id}`);
    if (ev.evolved) evolutions.push({ teamId: id, level: ev.evolved });
    applied.push({ ...o, teamId: id, points: game.kind === "regular" ? got : winner === id && game.kind === "caos" ? got : 0 });
  }

  // furti e penalità proposti dalla meccanica (solo prove normali)
  if (game.kind === "regular") {
    for (const o of proposed.outcomes) {
      if (!participants.includes(o.teamId) || !o.transfers?.length) continue;
      let i = 0;
      for (const tr of o.transfers) {
        const r = await applyTransfer(ctx, game.id, o.teamId, tr.toTeamId, tr.points, tr.reason || "Attacco", `t:${game.id}:${o.teamId}:${tr.toTeamId}:${i++}`);
        const mine = applied.find((a) => a.teamId === o.teamId);
        if (mine) mine.transfers = [...(mine.transfers ?? []), { toTeamId: tr.toTeamId, points: tr.points > 0 ? r.amount : -r.amount, reason: r.outcome === "applied" ? tr.reason : r.outcome === "blocked" ? "Bloccato dallo scudo" : "Respinto (anti-accanimento)" }];
      }
    }
    // puntata finale
    if (game.bet_enabled) {
      const bets = await ctx.tx<{ team_id: string; amount: number }[]>`select team_id, amount from tig_bets where game_id = ${game.id} and not resolved`;
      for (const b of bets) {
        const o = byTeam.get(b.team_id);
        const won = o?.correct === true;
        if (b.amount > 0) await ledger(ctx, b.team_id, won ? b.amount : -b.amount, { source: "bet", reason: won ? "Puntata vinta" : "Puntata persa", ref: game.id, key: `bet:${game.id}:${b.team_id}` });
      }
      await ctx.tx`update tig_bets set resolved = true where game_id = ${game.id}`;
    }
  }
  if (game.kind === "tiebreak") {
    if (winner) {
      for (const id of participants) {
        const rank = id === winner ? 1 : 2;
        await ctx.tx`update tig_teams set tiebreak_rank = ${rank} where id = ${id}`;
        team(ctx, id).tiebreak_rank = rank;
      }
    }
  }

  // effetti non in punti dichiarati dalla meccanica: lo scudo (uno per manche, non cumulabile, scade a fine manche)
  const effect = tigRegistry().extras(game.mechanic_code)?.effect;
  if (game.kind === "regular" && effect?.kind === "scudo") {
    for (const o of applied) {
      if (o.correct !== true || !(CAOS_MANCHES as readonly number[]).includes(ctx.ev.manche_no)) continue;
      const [ins] = await ctx.tx<{ id: string }[]>`
        insert into tig_powers (event_id, team_id, kind, manche_no, status, idempotency_key)
        values (${ctx.ev.id}, ${o.teamId}, 'shield', ${ctx.ev.manche_no}, 'active', ${`scudo:${game.id}:${o.teamId}`})
        on conflict do nothing returning id`;
      if (ins) {
        o.label = `${o.label ? `${o.label} · ` : ""}scudo attivo fino a fine manche`;
        await log(ctx, "shield", { data: { teamId: o.teamId, from: game.mechanic_code } });
      }
    }
  }
  // l'esito pubblico conserva i campi in più di score() (es. `summary`), con i punti effettivamente applicati
  const outcome = { ...proposed, outcomes: applied, stats };
  let reveal: unknown = null;
  if (def) {
    try {
      reveal = def.reveal(game.content as never, proposed);
    } catch {
      reveal = null;
    }
  }
  await ctx.tx`update tig_games set status = 'scored', closed_at = now(), outcome = ${ctx.tx.json(outcome as never)}, reveal = ${reveal === null ? null : ctx.tx.json(reveal as never)}, winner_team_id = ${winner} where id = ${game.id}`;
  let spotlight: Spotlight | null = ctx.ev.spotlight?.kind === "shield" ? ctx.ev.spotlight : null;
  if (evolutions.length) spotlight = { kind: "evolve", teamIds: evolutions.map((x) => x.teamId), eventId: `evolve-${game.id}`, level: Math.max(...evolutions.map((x) => x.level)) };
  else if (game.kind !== "regular" && winner) spotlight = { kind: "winner", teamIds: [winner], eventId: `win-${game.id}` };
  ctx.ev.spotlight = spotlight;
  setState(ctx, "GAME_RESULTS", PHASE_MS.reveal);
  note(ctx, "results", { gameId: game.id, winner, evolutions });
  await log(ctx, "game_scored", { data: { gameId: game.id, code: game.mechanic_code, kind: game.kind, winner } });
}

// ---------------------------------------------------------------------------
// Mascotte
// ---------------------------------------------------------------------------
async function mascotVotes(ctx: Ctx): Promise<MascotVote[]> {
  const rows = await ctx.tx<{ team_id: string; slot: number; created_at: Date }[]>`
    select v.team_id, v.slot, v.created_at from tig_mascot_votes v join tig_members m on m.id = v.member_id
    where v.event_id = ${ctx.ev.id} and m.status = 'active'`;
  return rows.map((r) => ({ teamId: r.team_id, slot: r.slot, at: r.created_at.getTime() }));
}

async function setMascot(ctx: Ctx, t: TeamRow, slot: number) {
  const exclusive = ctx.config.mascotUnique;
  if (exclusive && ctx.teams.some((x) => x.id !== t.id && x.status === "active" && x.mascot_slot === slot && x.mascot_exclusive)) tigFail("NOT_AVAILABLE", "Questa mascotte è già di un altro tavolo");
  await ctx.tx`update tig_teams set mascot_slot = ${slot}, mascot_exclusive = ${exclusive}, mascot_confirmed = true where id = ${t.id}`;
  t.mascot_slot = slot;
  t.mascot_exclusive = exclusive;
  t.mascot_confirmed = true;
  ctx.changed = true;
  ctx.secretChanged = true;
}

/** Al via: chi non ha confermato riceve la mascotte più votata ancora libera (deterministico). */
async function finalizeMascots(ctx: Ctx) {
  const pending = ctx.teams.filter((t) => t.status === "active" && !t.mascot_confirmed);
  if (!pending.length) return;
  const votes = await mascotVotes(ctx);
  const map = assignMascots(
    ctx.teams.filter((t) => t.status === "active").map((t) => ({ teamId: t.id, tableNo: t.table_no, slot: t.mascot_confirmed ? t.mascot_slot : null })),
    votes,
    ctx.config.mascotUnique,
  );
  for (const t of pending) {
    const slot = map.get(t.id);
    if (slot) await setMascot(ctx, t, slot);
  }
}

// ---------------------------------------------------------------------------
// Azioni
// ---------------------------------------------------------------------------
async function apply(ctx: Ctx, a: TigAction): Promise<void> {
  const { tx } = ctx;
  const e = ctx.ev;
  switch (a.action) {
    case "tick":
      return;

    // ------------------------------------------------------------ lobby
    case "open_lobby":
      requireOrganizer(ctx);
      requireState(ctx, "DRAFT");
      setState(ctx, "LOBBY_OPEN", null);
      note(ctx, "lobby_open");
      return log(ctx, "lobby_open", { audit: true, from: "DRAFT", to: "LOBBY_OPEN" });
    case "lock_lobby":
      requireOrganizer(ctx);
      requireState(ctx, "LOBBY_OPEN");
      setState(ctx, "LOBBY_LOCKED", null);
      e.late_join = false;
      note(ctx, "lobby_locked");
      return log(ctx, "lobby_locked", { audit: true, from: "LOBBY_OPEN", to: "LOBBY_LOCKED" });
    case "unlock_lobby":
      requireOrganizer(ctx);
      requireState(ctx, "LOBBY_LOCKED");
      setState(ctx, "LOBBY_OPEN", null);
      return log(ctx, "lobby_unlocked", { audit: true, from: "LOBBY_LOCKED", to: "LOBBY_OPEN" });
    case "late_join":
      requireOrganizer(ctx);
      if (isTerminal(e.state)) tigFail("WRONG_PHASE", "La serata è finita");
      e.late_join = a.open;
      ctx.changed = true;
      return log(ctx, a.open ? "late_join_open" : "late_join_closed", { audit: true });

    case "approve_team": {
      requireOrganizer(ctx);
      const t = team(ctx, a.teamId);
      if (t.status !== "active") tigFail("WRONG_PHASE", "Tavolo escluso");
      await tx`update tig_teams set approved = ${a.approved}, approved_at = ${a.approved ? e.db_now : null} where id = ${t.id}`;
      t.approved = a.approved;
      ctx.changed = true;
      ctx.secretChanged = true;
      if (a.approved) note(ctx, "team_approved", { tableNo: t.table_no });
      return log(ctx, a.approved ? "team_approved" : "team_unapproved", { audit: true, data: { teamId: t.id, tableNo: t.table_no } });
    }
    case "rename_team": {
      requireOrganizer(ctx);
      const t = team(ctx, a.teamId);
      const c = checkTeamName(a.name);
      if (!c.ok) tigFail("VALIDATION", c.message);
      await tx`update tig_teams set name = ${c.value}, name_key = ${c.key} where id = ${t.id}`;
      t.name = c.value;
      ctx.changed = true;
      ctx.secretChanged = true;
      return log(ctx, "team_renamed", { audit: true, data: { teamId: t.id, tableNo: t.table_no } });
    }
    case "captain_rename": {
      const t = myTeam(ctx);
      if (t.captain_member_id !== activeMember(ctx).id) tigFail("FORBIDDEN", "Il nome lo cambia il capitano");
      if (t.approved) tigFail("WRONG_PHASE", "Il nome è già stato convalidato dallo staff");
      const c = checkTeamName(a.name);
      if (!c.ok) tigFail("VALIDATION", c.message);
      await tx`update tig_teams set name = ${c.value}, name_key = ${c.key} where id = ${t.id}`;
      t.name = c.value;
      ctx.changed = true;
      ctx.secretChanged = true;
      return;
    }
    case "kick_team": {
      requireOrganizer(ctx);
      const t = team(ctx, a.teamId);
      await tx`update tig_teams set status = 'kicked', approved = false, mascot_slot = null, mascot_exclusive = false, mascot_confirmed = false where id = ${t.id}`;
      await tx`update tig_members set status = 'kicked' where team_id = ${t.id} and status = 'active'`;
      t.status = "kicked";
      t.approved = false;
      t.mascot_slot = null;
      for (const m of ctx.members) if (m.team_id === t.id && m.status === "active") m.status = "kicked";
      ctx.changed = true;
      ctx.secretChanged = true;
      return log(ctx, "team_kicked", { audit: true, reason: a.reason ?? null, data: { teamId: t.id, tableNo: t.table_no } });
    }
    case "kick_member": {
      requireOrganizer(ctx);
      const m = ctx.members.find((x) => x.id === a.memberId);
      if (!m) tigFail("NOT_FOUND", "Giocatore non trovato");
      await removeMember(ctx, m, "kicked");
      return log(ctx, "member_kicked", { audit: true, data: { memberId: m.id, teamId: m.team_id } });
    }
    case "set_captain": {
      requireOrganizer(ctx);
      const m = ctx.members.find((x) => x.id === a.memberId && x.status === "active");
      if (!m) tigFail("NOT_FOUND", "Giocatore non trovato");
      await tx`update tig_teams set captain_member_id = ${m.id} where id = ${m.team_id}`;
      team(ctx, m.team_id).captain_member_id = m.id;
      ctx.changed = true;
      ctx.secretChanged = true;
      return log(ctx, "captain_changed", { audit: true, data: { memberId: m.id, teamId: m.team_id } });
    }
    case "leave": {
      const m = ctx.member;
      if (!m || m.status !== "active") return;
      return removeMember(ctx, m, "left");
    }

    // ------------------------------------------------------------ mascotte
    case "vote_mascot": {
      const m = activeMember(ctx);
      const t = myTeam(ctx);
      if (t.mascot_confirmed || isTerminal(e.state)) tigFail("WRONG_PHASE", "La mascotte del tavolo è già stata scelta");
      await tx`
        insert into tig_mascot_votes (event_id, team_id, member_id, slot) values (${e.id}, ${t.id}, ${m.id}, ${a.slot})
        on conflict (event_id, member_id) do update set slot = excluded.slot, team_id = excluded.team_id, updated_at = now()`;
      ctx.changed = true;
      ctx.secretChanged = true;
      return;
    }
    case "confirm_mascot": {
      const t = myTeam(ctx);
      requireTeamDecision(ctx, t);
      if (t.mascot_confirmed) return;
      const taken = new Set(ctx.teams.filter((x) => x.id !== t.id && x.status === "active" && x.mascot_confirmed && x.mascot_slot && x.mascot_exclusive).map((x) => x.mascot_slot!));
      const slot = pickMascotSlot(t.id, await mascotVotes(ctx), taken, ctx.config.mascotUnique);
      await setMascot(ctx, t, slot);
      ctx.result = { slot };
      return log(ctx, "mascot_confirmed", { data: { teamId: t.id, slot } });
    }
    case "assign_mascot": {
      requireOrganizer(ctx);
      const t = team(ctx, a.teamId);
      const taken = new Set(ctx.teams.filter((x) => x.id !== t.id && x.status === "active" && x.mascot_confirmed && x.mascot_slot && x.mascot_exclusive).map((x) => x.mascot_slot!));
      const slot = a.slot ?? pickMascotSlot(t.id, await mascotVotes(ctx), taken, ctx.config.mascotUnique);
      await setMascot(ctx, t, slot);
      return log(ctx, "mascot_assigned", { audit: true, data: { teamId: t.id, slot } });
    }

    // ------------------------------------------------------------ regia: ritmo
    case "start": {
      requireOrganizer(ctx);
      requireState(ctx, "LOBBY_OPEN", "LOBBY_LOCKED");
      const from = e.state;
      await startEvent(ctx);
      return log(ctx, "start", { audit: true, from, to: "INTRO" });
    }
    case "pause": {
      requireOrganizer(ctx);
      if (e.state === "PAUSED") return;
      if (!PAUSABLE.includes(e.state)) tigFail("WRONG_PHASE", "Non c'è niente da mettere in pausa");
      const from = e.state;
      e.paused_from = e.state;
      e.paused_at = e.db_now;
      ctx.ev.state = "PAUSED";
      ctx.changed = true;
      ctx.secretChanged = true;
      note(ctx, "pause", { reason: a.reason ?? null });
      return log(ctx, "pause", { audit: true, reason: a.reason ?? "Pausa tecnica", from, to: "PAUSED" });
    }
    case "resume": {
      requireOrganizer(ctx);
      if (e.state !== "PAUSED" || !e.paused_at) return;
      const shift = nowMs(ctx) - e.paused_at.getTime();
      if (e.phase_deadline_at) e.phase_deadline_at = new Date(e.phase_deadline_at.getTime() + shift);
      if (e.phase_started_at) e.phase_started_at = new Date(e.phase_started_at.getTime() + shift);
      // la prova riprende da dove era: si spostano partenza e scadenza (anche dentro la finestra della regola)
      await tx`update tig_games set starts_at = starts_at + make_interval(secs => ${shift / 1000}), deadline_at = deadline_at + make_interval(secs => ${shift / 1000}) where event_id = ${e.id} and status = 'active'`;
      e.manche_paused_ms = Number(e.manche_paused_ms) + shift;
      e.paused_ms = Number(e.paused_ms) + shift;
      const to = e.paused_from ?? "LOBBY_OPEN";
      e.state = to;
      e.paused_from = null;
      e.paused_at = null;
      ctx.changed = true;
      ctx.secretChanged = true;
      note(ctx, "resume");
      return log(ctx, "resume", { audit: true, from: "PAUSED", to, data: { shiftMs: shift } });
    }
    case "skip": {
      requireOrganizer(ctx);
      requireNotPaused(ctx);
      const from = e.state;
      const reason = a.reason?.trim() || "Avanti dalla regia";
      if (e.state === "GAME_ACTIVE") {
        const g = await loadGame(tx, e.current_game_id);
        if (g && g.status === "active" && nowMs(ctx) < g.starts_at.getTime()) {
          // ancora nella regola: si parte subito, timer pieno
          const startsAt = e.db_now;
          const deadlineAt = new Date(startsAt.getTime() + g.timer_ms);
          await tx`update tig_games set starts_at = ${startsAt}, deadline_at = ${deadlineAt} where id = ${g.id}`;
          e.phase_deadline_at = new Date(deadlineAt.getTime() + PHASE_MS.grace);
          ctx.changed = true;
          ctx.secretChanged = true;
        } else await closeGame(ctx);
      } else if (["INTRO", "ROUND_INTRO", "GAME_RESULTS", "LEADERBOARD", "BREAK", "FINAL", "AWARDS"].includes(e.state)) {
        await onDeadline(ctx);
      } else tigFail("WRONG_PHASE", "Non si può saltare questo momento");
      return log(ctx, "skip", { audit: true, reason, from, to: e.state });
    }
    case "rollback":
      requireOrganizer(ctx);
      requireNotPaused(ctx);
      if (String(a.reason ?? "").trim().length < 3) tigFail("VALIDATION", "Scrivi il motivo dell'annullamento");
      return rollback(ctx, a.reason.trim());
    case "set_segments": {
      requireOrganizer(ctx);
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(a.segments)) if ((SEGMENT_KEYS as readonly string[]).includes(k)) clean[k] = v;
      const parsed = segmentsSchema.safeParse({ ...ctx.config.segments, ...clean });
      if (!parsed.success) tigFail("VALIDATION", "Durate non valide", parsed.error.issues);
      ctx.config = { ...ctx.config, segments: parsed.data };
      e.plan = e.plan.map((p) => ({ ...p, minutes: runOfShow(ctx.config.durationMin, ctx.config.segments).find((s) => s.mancheNo === p.mancheNo)?.minutes ?? p.minutes }));
      if (e.state === "BREAK" && typeof clean.break === "number" && e.phase_started_at) {
        e.phase_deadline_at = new Date(e.phase_started_at.getTime() + clean.break * 60_000);
        e.phase_total_ms = clean.break * 60_000;
      }
      ctx.changed = true;
      return log(ctx, "segments", { audit: true, data: clean });
    }
    case "end_event": {
      requireOrganizer(ctx);
      const from = e.state;
      if (isTerminal(e.state)) return;
      if (isLobby(e.state)) {
        e.status = "closed";
        e.close_reason = "host";
        setState(ctx, "CANCELLED", null);
      } else if (e.state === "AWARDS") {
        await complete(ctx);
      } else {
        if (e.state === "PAUSED") {
          e.state = e.paused_from ?? "LEADERBOARD";
          e.paused_from = null;
          e.paused_at = null;
        }
        if (e.state === "GAME_ACTIVE") await closeGame(ctx);
        if (e.state !== "FINAL") {
          ctx.ev.state = "LEADERBOARD"; // passaggio interno: si va al finale da una classifica
          await enterFinal(ctx);
        }
      }
      return log(ctx, "end_event", { audit: true, reason: a.reason ?? "Fine serata dalla regia", from, to: e.state });
    }
    case "cancel_event": {
      requireOrganizer(ctx);
      if (isTerminal(e.state)) return;
      if (String(a.reason ?? "").trim().length < 3) tigFail("VALIDATION", "Scrivi il motivo dell'annullamento");
      const from = e.state;
      e.paused_at = null;
      e.paused_from = null;
      ctx.ev.state = from === "PAUSED" ? "INTRO" : from; // annullare è sempre consentito
      setState(ctx, "CANCELLED", null);
      e.status = "closed";
      e.close_reason = "cancelled";
      note(ctx, "cancelled", { reason: a.reason });
      return log(ctx, "cancel", { audit: true, reason: a.reason, from, to: "CANCELLED" });
    }

    // ------------------------------------------------------------ giocatori in gara
    case "submit":
      requireNotPaused(ctx);
      return submit(ctx, a.gameId, a.payload, a.idempotencyKey);
    case "bet":
      requireNotPaused(ctx);
      return placeBet(ctx, a.gameId, a.amount, a.idempotencyKey);
    case "caos":
      requireNotPaused(ctx);
      return pressCaos(ctx, a.targetTeamId, a.idempotencyKey);
    case "shield":
      requireNotPaused(ctx);
      return activateShield(ctx, a.idempotencyKey);
  }
}

async function removeMember(ctx: Ctx, m: MemberRow, status: "left" | "kicked") {
  await ctx.tx`update tig_members set status = ${status} where id = ${m.id}`;
  m.status = status;
  const t = ctx.teams.find((x) => x.id === m.team_id);
  if (t && t.captain_member_id === m.id) {
    const next = ctx.members.find((x) => x.team_id === t.id && x.status === "active");
    await ctx.tx`update tig_teams set captain_member_id = ${next?.id ?? null} where id = ${t.id}`;
    t.captain_member_id = next?.id ?? null;
  }
  ctx.changed = true;
  ctx.secretChanged = true;
}

// ---------------------------------------------------------------------------
// Invii
// ---------------------------------------------------------------------------
async function submit(ctx: Ctx, gameId: string, payload: unknown, key: string) {
  const m = activeMember(ctx);
  const t = myTeam(ctx);
  const game = await loadGame(ctx.tx, ctx.ev.current_game_id);
  if (!game || game.id !== gameId) tigFail("TOO_LATE", "Questa prova è già finita");
  // doppio clic, rete lenta, refresh: stessa chiave = stesso invio, nessun cambiamento
  const [dup] = await ctx.tx<{ member_id: string }[]>`select member_id from tig_submissions where game_id = ${game.id} and idempotency_key = ${key}`;
  if (dup) {
    ctx.result = { accepted: true, duplicate: true };
    return;
  }
  if (ctx.ev.state !== "GAME_ACTIVE" || game.status !== "active") tigFail("TOO_LATE", "Tempo scaduto: le risposte sono chiuse");
  const def = mechanicOf(game.mechanic_code);
  if (!def) tigFail("NOT_AVAILABLE", "Minigioco non disponibile");
  if (!game.participants.includes(t.id)) tigFail("FORBIDDEN", "Il tuo tavolo non partecipa a questa sfida");
  if (!t.approved) tigFail("FORBIDDEN", "Aspetta la convalida dello staff");
  const now = nowMs(ctx);
  if (now < game.starts_at.getTime()) tigFail("TOO_LATE", "La prova non è ancora partita");
  if (now > game.deadline_at.getTime() + PHASE_MS.grace) tigFail("TOO_LATE", "Tempo scaduto: le risposte sono chiuse");
  const perMember = def.input === "vote" || def.input === "coop";
  if (!perMember && !canActForTeam(t, m, ctx.members, now)) tigFail("FORBIDDEN", "La risposta della squadra la invia il capitano");
  if (perMember && !game.teams.find((x) => x.teamId === t.id)?.members.includes(m.id)) tigFail("FORBIDDEN", "Sei entrato a prova iniziata: giochi dalla prossima");
  const parsed = def.submissionSchema.safeParse(payload);
  if (!parsed.success) tigFail("VALIDATION", "Risposta non valida", parsed.error.issues);
  const scope = perMember ? m.id : t.id;
  const [taken] = await ctx.tx<{ id: string }[]>`select id from tig_submissions where game_id = ${game.id} and scope_key = ${scope} and not void`;
  if (taken) tigFail("ALREADY_SUBMITTED", perMember ? "Hai già votato" : "La tua squadra ha già risposto");
  const elapsed = Math.max(0, Math.min(game.timer_ms, now - game.starts_at.getTime()));
  await ctx.tx`
    insert into tig_submissions (event_id, game_id, team_id, member_id, scope_key, idempotency_key, payload, elapsed_ms)
    values (${ctx.ev.id}, ${game.id}, ${t.id}, ${m.id}, ${scope}, ${key}, ${ctx.tx.json(parsed.data as never)}, ${elapsed})`;
  ctx.result = { accepted: true };
  ctx.changed = true;
  ctx.secretChanged = true;
  // tutti hanno inviato: la prova si chiude subito
  const [{ n }] = await ctx.tx<{ n: number }[]>`select count(distinct scope_key)::int as n from tig_submissions where game_id = ${game.id} and not void`;
  const live = game.participants.filter((id) => ctx.teams.some((x) => x.id === id && inGame(x)));
  const expected = perMember ? game.teams.filter((x) => live.includes(x.teamId)).reduce((s, x) => s + x.members.filter((id) => ctx.members.some((mm) => mm.id === id && mm.status === "active")).length, 0) : live.length;
  if (n >= expected) await closeGame(ctx);
}

async function placeBet(ctx: Ctx, gameId: string, amount: number, key: string) {
  const t = myTeam(ctx);
  const m = activeMember(ctx);
  const game = await loadGame(ctx.tx, ctx.ev.current_game_id);
  if (!game || game.id !== gameId || !game.bet_enabled) tigFail("WRONG_PHASE", "Qui non si punta");
  const [existing] = await ctx.tx<{ idempotency_key: string; amount: number }[]>`select idempotency_key, amount from tig_bets where game_id = ${game.id} and team_id = ${t.id}`;
  if (existing) {
    // stessa richiesta ripetuta: nessun cambiamento; un'altra puntata: irrevocabile
    if (existing.idempotency_key === key) {
      ctx.result = { accepted: true, amount: existing.amount, duplicate: true };
      return;
    }
    tigFail("ALREADY_SUBMITTED", "La puntata del tavolo è già fatta (irrevocabile)");
  }
  if (game.status !== "active" || ctx.ev.state !== "GAME_ACTIVE" || nowMs(ctx) > game.deadline_at.getTime()) tigFail("TOO_LATE", "Puntate chiuse");
  if (!game.participants.includes(t.id)) tigFail("FORBIDDEN", "Il tuo tavolo non partecipa");
  requireTeamDecision(ctx, t);
  const cap = betCap(t.score);
  if (amount > cap) tigFail("LIMIT", `Puntata massima: ${cap} punti (25% del saldo, al massimo ${POINTS.betMaxAbs})`);
  await ctx.tx`insert into tig_bets (event_id, game_id, team_id, member_id, amount, cap, idempotency_key) values (${ctx.ev.id}, ${game.id}, ${t.id}, ${m.id}, ${amount}, ${cap}, ${key})`;
  ctx.result = { accepted: true, amount };
  ctx.changed = true;
  ctx.secretChanged = true;
  await log(ctx, "bet", { data: { teamId: t.id, amount, cap } });
}

// ---------------------------------------------------------------------------
// Poteri: scudo e Bottone del Caos
// ---------------------------------------------------------------------------
async function activateShield(ctx: Ctx, key: string) {
  const t = myTeam(ctx);
  const [dup] = await ctx.tx<{ id: string }[]>`select id from tig_powers where event_id = ${ctx.ev.id} and idempotency_key = ${key}`;
  if (dup) {
    ctx.result = { accepted: true, duplicate: true };
    return;
  }
  if (!(CAOS_MANCHES as readonly number[]).includes(ctx.ev.manche_no) || isLobby(ctx.ev.state) || isTerminal(ctx.ev.state) || ctx.ev.state === "BREAK") tigFail("WRONG_PHASE", "Gli scudi si attivano durante le manche 2, 3 e 4");
  if (!t.approved) tigFail("FORBIDDEN", "Aspetta la convalida dello staff");
  requireTeamDecision(ctx, t);
  const [used] = await ctx.tx<{ id: string }[]>`select id from tig_powers where event_id = ${ctx.ev.id} and team_id = ${t.id} and kind = 'shield' and manche_no = ${ctx.ev.manche_no}`;
  if (used) tigFail("ALREADY_SUBMITTED", "Scudo già usato in questa manche (non cumulabile)");
  await ctx.tx`insert into tig_powers (event_id, team_id, kind, manche_no, status, idempotency_key) values (${ctx.ev.id}, ${t.id}, 'shield', ${ctx.ev.manche_no}, 'active', ${key})`;
  ctx.ev.spotlight = { kind: "shield", teamIds: [t.id], eventId: `shield-on-${t.id}-${ctx.ev.manche_no}` };
  ctx.result = { accepted: true };
  ctx.changed = true;
  ctx.secretChanged = true;
  note(ctx, "shield", { teamId: t.id });
  await log(ctx, "shield", { data: { teamId: t.id } });
}

async function pressCaos(ctx: Ctx, targetId: string, key: string) {
  const t = myTeam(ctx);
  const [dup] = await ctx.tx<{ id: string }[]>`select id from tig_powers where event_id = ${ctx.ev.id} and idempotency_key = ${key}`;
  if (dup) {
    ctx.result = { accepted: true, duplicate: true };
    return;
  }
  if (t.caos_used) tigFail("ALREADY_SUBMITTED", "Il Bottone del Caos del tavolo è già stato usato stasera");
  if (!t.approved) tigFail("FORBIDDEN", "Aspetta la convalida dello staff");
  requireTeamDecision(ctx, t);
  const current = await loadGame(ctx.tx, ctx.ev.current_game_id);
  if (!caosWindowOpen({ state: ctx.ev.state, mancheNo: ctx.ev.manche_no, paused: !!ctx.ev.paused_at, lastGameKind: current?.kind ?? null, caosInProgress: false, hasNextStep: true })) tigFail("WRONG_PHASE", "Il Bottone del Caos si preme solo tra una prova e l'altra delle manche 2, 3 e 4");
  const target = ctx.teams.find((x) => x.id === targetId);
  const why = caosTargetCheck({ sourceTeamId: t.id, targetTeamId: targetId, targetActive: target?.status === "active", targetApproved: !!target?.approved, recentAttacksOnTarget: target ? await recentAttacksOn(ctx, targetId) : 0 });
  if (why || !target) tigFail("LIMIT", why ?? "Bersaglio non valido");
  try {
    await ctx.tx`insert into tig_powers (event_id, team_id, kind, manche_no, status, idempotency_key, target_team_id, consumed_at) values (${ctx.ev.id}, ${t.id}, 'caos', ${ctx.ev.manche_no}, 'consumed', ${key}, ${targetId}, now())`;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") tigFail("ALREADY_SUBMITTED", "Il Bottone del Caos del tavolo è già stato usato stasera");
    throw e;
  }
  await ctx.tx`update tig_teams set caos_used = true where id = ${t.id}`;
  t.caos_used = true;
  // il duello: una meccanica da duello registrata; altrimenti una prova di squadra giocabile con un telefono
  const hist = await usedHistory(ctx);
  const sel = selectGame({ mechanics: tigRegistry().mechanics, variantsOf: tigRegistry().variantsOf, mancheNo: ctx.ev.manche_no, slotNo: 200 + ctx.ev.game_index, gamesInManche: 1, kind: "caos", ...hist, oneDevice: true, remainingMs: null, seed: `${ctx.ev.id}|caos|${newSeed()}` });
  if (!sel) tigFail("NOT_AVAILABLE", "Nessun duello disponibile");
  await ctx.tx`
    insert into tig_attacks (event_id, source_team_id, target_team_id, kind, game_id, manche_no, outcome, amount)
    values (${ctx.ev.id}, ${t.id}, ${targetId}, 'caos', null, ${ctx.ev.manche_no}, 'applied', 0)`;
  const [{ n }] = await ctx.tx<{ n: number }[]>`select count(*)::int as n from tig_games where event_id = ${ctx.ev.id} and kind = 'caos'`;
  const g = await createGame(ctx, {
    def: sel.def,
    variantKey: sel.variant.key,
    difficulty: sel.difficulty,
    content: sel.variant.content,
    kind: "caos",
    slotNo: 200 + n + 1,
    participants: [t.id, targetId],
    timerMs: CAOS_DUEL_MS,
    leadMs: CAOS_ALARM_MS,
    caos: { source: t.id, target: targetId },
  });
  ctx.ev.spotlight = { kind: "chaos", teamIds: [t.id, targetId], eventId: g.id };
  ctx.result = { accepted: true, gameId: g.id };
  await log(ctx, "caos", { data: { source: t.id, target: targetId, gameId: g.id, code: sel.def.code } });
}

// ---------------------------------------------------------------------------
// Rollback della regia (con audit)
// ---------------------------------------------------------------------------
async function rollback(ctx: Ctx, reason: string) {
  const e = ctx.ev;
  const from = e.state;
  const game = await loadGame(ctx.tx, e.current_game_id);
  if (!game || game.status === "voided" || !["GAME_ACTIVE", "GAME_RESULTS", "LEADERBOARD"].includes(e.state)) tigFail("WRONG_PHASE", "Si può annullare solo la prova in corso o appena giocata");
  // 1. invii annullati, puntate cancellate
  await ctx.tx`update tig_submissions set void = true where game_id = ${game.id}`;
  await ctx.tx`delete from tig_bets where game_id = ${game.id}`;
  // 2. punti stornati con voci compensative (chiave unica: un doppio rollback non storna due volte)
  if (game.status === "scored") {
    const entries = await ctx.tx<{ id: number; team_id: string; applied: number }[]>`select id, team_id, applied from tig_score_ledger where event_id = ${e.id} and ref = ${game.id} and source <> 'rollback'`;
    for (const x of entries) if (x.applied !== 0) await ledger(ctx, x.team_id, -x.applied, { source: "rollback", reason: `Annullata dalla regia: ${reason}`, ref: `rb:${game.id}`, key: `rb:${x.id}` });
    for (const [teamId, s] of Object.entries(game.outcome?.stats ?? {})) {
      if (!s.win && s.acc === null) continue;
      await ctx.tx`update tig_teams set wins = greatest(0, wins - ${s.win}), acc_sum = greatest(0, acc_sum - ${s.acc ?? 0}), acc_n = greatest(0, acc_n - ${s.acc === null ? 0 : 1}) where id = ${teamId}`;
      const t = ctx.teams.find((x) => x.id === teamId);
      if (t) {
        t.wins = Math.max(0, t.wins - s.win);
        t.acc_sum = Math.max(0, t.acc_sum - (s.acc ?? 0));
        t.acc_n = Math.max(0, t.acc_n - (s.acc === null ? 0 : 1));
      }
    }
    if (game.kind === "tiebreak") await ctx.tx`update tig_teams set tiebreak_rank = null where event_id = ${e.id}`;
  }
  // 3. attacchi e scudi della prova tornano com'erano
  await ctx.tx`delete from tig_attacks where game_id = ${game.id}`;
  await ctx.tx`update tig_powers set status = 'active', consumed_at = null, consumed_ref = null where event_id = ${e.id} and kind = 'shield' and consumed_ref = ${game.id} and manche_no = ${e.manche_no}`;
  await ctx.tx`update tig_games set status = 'voided' where id = ${game.id}`;
  e.spotlight = null;
  if (game.kind === "caos") {
    // duello annullato: il Bottone torna disponibile, si riprende dalla classifica
    await ctx.tx`delete from tig_powers where event_id = ${e.id} and kind = 'caos' and team_id = ${game.caos_source}`;
    await ctx.tx`delete from tig_attacks where event_id = ${e.id} and kind = 'caos' and source_team_id = ${game.caos_source} and target_team_id = ${game.caos_target}`;
    await ctx.tx`update tig_teams set caos_used = false where id = ${game.caos_source}`;
    const src = ctx.teams.find((x) => x.id === game.caos_source);
    if (src) src.caos_used = false;
    e.current_game_id = null;
    ctx.ev.state = ctx.ev.state === "GAME_ACTIVE" ? "GAME_RESULTS" : ctx.ev.state;
    setState(ctx, "LEADERBOARD", PHASE_MS.leaderboardMin);
  } else {
    // stessa prova, stesso contenuto, timer pieno (nuovo tentativo)
    const def = mechanicOf(game.mechanic_code);
    if (!def) tigFail("NOT_AVAILABLE", "Minigioco non disponibile");
    if (ctx.ev.state === "LEADERBOARD") ctx.ev.state = "GAME_RESULTS";
    await createGame(ctx, { def, variantKey: game.variant_key, difficulty: game.difficulty, content: game.content, kind: game.kind, slotNo: game.slot_no, participants: game.participants.filter((id) => ctx.teams.some((t) => t.id === id && inGame(t))), timerMs: game.timer_ms, leadMs: PHASE_MS.ruleLead, betEnabled: game.bet_enabled, attempt: game.attempt + 1 });
  }
  note(ctx, "rollback", { reason });
  await log(ctx, "rollback", { audit: true, reason, from, to: ctx.ev.state, data: { gameId: game.id, code: game.mechanic_code } });
}

/**
 * Solo per i test d'integrazione: un'azione tra tavoli come la proporrebbe una meccanica (stessa transazione,
 * stessi limiti). Il registro di sviluppo non ha meccaniche con furti: così i limiti si provano davvero.
 */
async function testTransfer(eventId: string, sourceId: string, targetId: string, points: number) {
  return getSql().begin(async (tx) => {
    const ev = (await loadEvent(tx, eventId, true))!;
    const ctx = await makeCtx(tx, ev, SYSTEM_ACTOR, true);
    const r = await applyTransfer(ctx, null, sourceId, targetId, points, "Furto di prova", `test:${sourceId}:${targetId}:${Date.now()}:${Math.random()}`);
    await commit(ctx);
    return r;
  });
}

export const _testing = { seededRandom, transfer: testTransfer };
