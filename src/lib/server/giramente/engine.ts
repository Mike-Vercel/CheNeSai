import "server-only";
import { randomInt } from "node:crypto";
import { getSql, type Tx } from "@/lib/database/db";
import {
  applyFloor,
  canRevealLetter,
  collegamentoPoints,
  computeStandings,
  FALSA_POINTS,
  FALSA_SOLUTION_POINTS,
  finalePoints,
  hiddenLetters,
  initialLetters,
  JOLLY_DUPLICATE_POINTS,
  matchAnswer,
  matchPhrase,
  maskBoard,
  puzzleKindFor,
  resolveTiebreak,
  scoreWheelTurn,
  tabellonePoints,
  tiedLeaders,
  WHEEL_LABEL,
  type ScoreLine,
} from "@/lib/giramente/rules";
import {
  MAX_TEAM_MEMBERS,
  MIN_PLAYERS,
  MIN_TEAM_MEMBERS,
  MIN_TEAMS,
  settingsSchema,
  type GiramenteAction,
  type GiramenteEvent,
  type GiramenteEventKind,
  type JollyPower,
  type Phase,
  type PublicReveal,
  type PublicState,
  type PuzzleKind,
  type PuzzlePool,
  type RevealItem,
  type Risk,
  type Settings,
  type Stage,
  type TurnResult,
} from "@/lib/giramente/types";
import { GiramenteError, type GiramenteErrorCode } from "./errors";
import { broadcastGiramente } from "./realtime";
import {
  actsFor,
  buildPublicStateFrom,
  loadCompetitors,
  loadParticipants,
  loadPlay,
  loadPuzzles,
  loadRoom,
  loadSpin,
  loadStagePlays,
  parseSettings,
  wheelFor,
  type CompetitorRow,
  type ParticipantRow,
  type PlayAids,
  type PlayRow,
  type PuzzleRow,
  type RoomRow,
} from "./state";

/**
 * Motore di GIRAMENTE!: macchina a stati AUTOREVOLE sul server.
 *
 * Ogni azione è UNA transazione con il lucchetto sulla riga della stanza (FOR UPDATE): richieste
 * simultanee in fila, niente doppie transizioni. Dentro si usa SOLO `tx`. Alla fine: versione +1 e
 * stato PUBBLICO sul canale realtime (solo se la transazione va a buon fine).
 *
 * - Ruota: lo spicchio lo decide il server (node:crypto.randomInt), registrato in giramente_spins;
 *   un secondo «GIRA» restituisce lo stesso giro (idempotente).
 * - Timer: scadenze salvate nel database; risposte oltre la scadenza (+1,5 s di tolleranza per la rete)
 *   rifiutate. Le scadenze si controllano a ogni azione e a ogni lettura (avanzamento «pigro»).
 * - Punteggi: solo qui, con il minimo a zero e una transazione di registro per (giocata, voce).
 * - Risposte: una sola per giocata, con id della richiesta (un doppio invio identico non cambia nulla).
 */

export interface GiramenteActor {
  userId: string;
  ip: string | null;
}
/** Attore di sistema (scadenze lette da uno schermo pubblico o da un telefono qualsiasi). */
export const SYSTEM_ACTOR: GiramenteActor = { userId: "00000000-0000-0000-0000-000000000000", ip: null };

const LOCK_TIMEOUT = "4s";
const STATEMENT_TIMEOUT = "10s";
/** tolleranza di rete sulle risposte */
export const ANSWER_GRACE_MS = 1500;
export const SPIN_DURATION_MS = 6000;
const SPIN_LEAD_MS = 250;
const UUID = /^[0-9a-f-]{36}$/i;

/** Durate delle fasi di passaggio (le prove hanno i tempi delle impostazioni). */
export function phaseDurations(s: Settings) {
  const q = s.quickIntros;
  return {
    intro: q ? 6000 : 15000,
    roundIntro: q ? 6000 : 12000,
    choice: 25000,
    spin: 20000,
    sector: 4500,
    offer: 20000,
    afterChoice: 3000,
    turnResult: q ? 5000 : 8000,
    reveal: q ? 8000 : 14000,
    roundResults: q ? 8000 : 14000,
  };
}

interface Ctx {
  tx: Tx;
  room: RoomRow;
  actor: GiramenteActor;
  system: boolean;
  participant: ParticipantRow | null;
  isHost: boolean;
  isOwner: boolean;
  competitors: CompetitorRow[];
  participants: ParticipantRow[];
  settings: Settings;
  changed: boolean;
  secretChanged: boolean;
  event: GiramenteEvent | null | undefined;
}

export interface ActionResult {
  state: PublicState;
  changed: boolean;
}

function fail(code: GiramenteErrorCode, message: string): never {
  throw new GiramenteError(code, message);
}

const nowMs = (ctx: Ctx) => ctx.room.db_now.getTime();
const at = (ctx: Ctx, plusMs: number) => new Date(nowMs(ctx) + plusMs);

// ---------------------------------------------------------------------------
// Ingresso
// ---------------------------------------------------------------------------
export async function runAction(roomId: string, actor: GiramenteActor, action: GiramenteAction): Promise<ActionResult> {
  if (!UUID.test(roomId)) fail("NOT_FOUND", "Partita non trovata");
  const system = actor === SYSTEM_ACTOR;
  try {
    return await getSql().begin(async (tx) => {
      await tx`select set_config('lock_timeout', ${LOCK_TIMEOUT}, true), set_config('statement_timeout', ${STATEMENT_TIMEOUT}, true)`;
      const room = await loadRoom(tx, roomId, true);
      if (!room) fail("NOT_FOUND", "Partita non trovata");
      if (room.status === "closed") fail("ROOM_CLOSED", "Questa partita è terminata");
      const ctx = await makeCtx(tx, room, actor, system);
      await checkDeadline(ctx);
      await apply(ctx, action);
      return commit(ctx);
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "55P03" || code === "57014") throw new GiramenteError("BUSY", "Troppe richieste nello stesso momento: riprova");
    throw e;
  }
}

async function makeCtx(tx: Tx, room: RoomRow, actor: GiramenteActor, system: boolean): Promise<Ctx> {
  const [competitors, participants] = await Promise.all([loadCompetitors(tx, room.id), loadParticipants(tx, room.id)]);
  const isOwner = !system && room.owner_user_id === actor.userId;
  let participant: ParticipantRow | null = null;
  let isHost = false;
  if (!system) {
    if (room.devices === "shared") {
      isHost = isOwner;
    } else {
      isHost = room.host_user_id === actor.userId;
      const [p] = await tx<ParticipantRow[]>`
        select id, kind, user_id, owner_user_id, nickname, seat, status, competitor_id, captain, last_seen_at
        from giramente_participants where room_id = ${room.id} and user_id = ${actor.userId}`;
      if (p?.status === "kicked") fail("KICKED", "Sei stato tolto da questa partita");
      participant = p?.status === "active" ? p : null;
    }
    if (!participant && !isHost && !isOwner) fail("NOT_MEMBER", "Non fai parte di questa partita");
  }
  return {
    tx,
    room,
    actor,
    system,
    participant,
    isHost,
    isOwner,
    competitors,
    participants,
    settings: parseSettings(room.settings),
    changed: false,
    secretChanged: false,
    event: undefined,
  };
}

function requireHost(ctx: Ctx) {
  if (!ctx.isHost) fail("FORBIDDEN", "Solo chi gestisce la partita può farlo");
}
function requirePhase(ctx: Ctx, ...phases: Phase[]) {
  if (!phases.includes(ctx.room.phase)) fail("WRONG_PHASE", "Questa azione non è possibile in questo momento");
}
function requireNotPaused(ctx: Ctx) {
  if (ctx.room.paused_at) fail("PAUSED", "La partita è in pausa");
}
function requireActorFor(ctx: Ctx, competitorId: string) {
  if (ctx.system || !actsFor(ctx.room, ctx.actor.userId, ctx.participant, competitorId)) {
    const team = ctx.room.mode === "teams" && ctx.participant?.competitor_id === competitorId;
    fail("NOT_YOUR_TURN", team ? "Conferma il capitano della squadra" : "Non è il tuo turno");
  }
}
function competitor(ctx: Ctx, id: string): CompetitorRow {
  const c = ctx.competitors.find((x) => x.id === id);
  if (!c) fail("NOT_FOUND", "Concorrente non trovato");
  return c;
}

async function setPhase(ctx: Ctx, phase: Phase, durationMs: number | null) {
  ctx.room.phase = phase;
  ctx.room.phase_started_at = ctx.room.db_now;
  ctx.room.phase_deadline_at = durationMs === null ? null : at(ctx, durationMs);
  ctx.room.phase_total_ms = durationMs;
  ctx.changed = true;
  ctx.secretChanged = true;
}

async function emit(ctx: Ctx, kind: GiramenteEventKind, data?: GiramenteEvent["data"]) {
  ctx.event = { kind, at: ctx.room.db_now.toISOString(), ...(data ? { data } : {}) };
  ctx.changed = true;
  await ctx.tx`insert into giramente_events (room_id, kind, data) values (${ctx.room.id}, ${kind}, ${data ? ctx.tx.json(data as never) : null})`;
}

async function saveRoom(ctx: Ctx) {
  const r = ctx.room;
  await ctx.tx`
    update giramente_rooms set
      phase = ${r.phase}, round_no = ${r.round_no}, stage = ${r.stage}, tiebreak_no = ${r.tiebreak_no},
      tiebreak_ids = ${ctx.tx.array(r.tiebreak_ids)}::uuid[], turn_order = ${ctx.tx.array(r.turn_order)}::uuid[], turn_index = ${r.turn_index},
      current_play_id = ${r.current_play_id}, phase_started_at = ${r.phase_started_at}, phase_deadline_at = ${r.phase_deadline_at},
      phase_total_ms = ${r.phase_total_ms}, paused_at = ${r.paused_at}, paused_ms = ${r.paused_ms},
      result = ${r.result ? ctx.tx.json(r.result as never) : null}, reveal = ${r.reveal ? ctx.tx.json(r.reveal as never) : null},
      winners = ${ctx.tx.array(r.winners)}::uuid[], started_at = ${r.started_at}, finished_at = ${r.finished_at}
    where id = ${r.id}`;
}

// ---------------------------------------------------------------------------
// Punteggi
// ---------------------------------------------------------------------------
/** Una voce di punteggio: applicata UNA volta per (giocata, voce), mai sotto zero, registrata. */
async function applyScore(ctx: Ctx, competitorId: string, playId: string | null, kind: string, label: string, delta: number): Promise<number> {
  const c = competitor(ctx, competitorId);
  const { score, applied } = applyFloor(c.score, delta);
  const [row] = await ctx.tx<{ id: number }[]>`
    insert into giramente_score_log (room_id, competitor_id, play_id, round_no, kind, label, requested, applied, score_after)
    values (${ctx.room.id}, ${competitorId}, ${playId}, ${ctx.room.round_no}, ${kind}, ${label}, ${delta}, ${applied}, ${score})
    on conflict (play_id, kind) where play_id is not null do nothing
    returning id`;
  if (!row) return 0; // già registrata: niente doppio premio
  if (applied !== 0) await ctx.tx`update giramente_competitors set score = ${score} where id = ${competitorId}`;
  c.score = score;
  ctx.changed = true;
  return applied;
}

async function setJolly(ctx: Ctx, competitorId: string, power: JollyPower | null, action: "granted" | "used" | "expired" | "duplicate", playId: string | null, logged: JollyPower | null) {
  const c = competitor(ctx, competitorId);
  if (action !== "duplicate") {
    await ctx.tx`update giramente_competitors set jolly = ${power} where id = ${competitorId}`;
    c.jolly = power;
  }
  await ctx.tx`insert into giramente_jolly_log (room_id, competitor_id, play_id, round_no, power, action) values (${ctx.room.id}, ${competitorId}, ${playId}, ${ctx.room.round_no}, ${logged}, ${action})`;
  ctx.changed = true;
}

// ---------------------------------------------------------------------------
// Enigmi
// ---------------------------------------------------------------------------
/** Difficoltà preferita per archivio e manche (si ripiega sulle altre se l'archivio è esaurito). */
function preferredDifficulty(ctx: Ctx, pool: PuzzlePool): string | null {
  const d = ctx.settings.difficulty;
  if (pool === "ruota") {
    if (ctx.room.round_no === 1) return d === "difficile" ? "difficile" : "facile";
    return d === "facile" ? "facile" : "difficile";
  }
  if (pool === "tabellone") return d;
  if (pool === "finale") return d === "difficile" ? "difficile" : "media";
  return d === "difficile" ? "difficile" : d === "facile" ? "facile" : null;
}

/** Enigma pubblicato non ancora usato in questa partita (niente ripetizioni), a caso. */
async function pickPuzzle(ctx: Ctx, pool: PuzzlePool, kind: PuzzleKind | null, exclude: string[] = []): Promise<PuzzleRow> {
  const { tx } = ctx;
  const diff = preferredDifficulty(ctx, pool);
  const used = tx`select puzzle_id from giramente_plays where room_id = ${ctx.room.id} and puzzle_id is not null`;
  const tries: { kind: PuzzleKind | null; fresh: boolean }[] = [
    { kind, fresh: true },
    ...(kind ? [{ kind: null, fresh: true }] : []),
    { kind, fresh: false },
    ...(kind ? [{ kind: null, fresh: false }] : []),
  ];
  for (const t of tries) {
    const [p] = await tx<PuzzleRow[]>`
      select * from giramente_puzzles
      where status = 'published' and pool = ${pool}
        ${t.kind ? tx`and kind = ${t.kind}` : tx``}
        ${t.fresh ? tx`and id not in (${used})` : tx``}
        and not (id = any(${tx.array(exclude)}::uuid[]))
      order by ${diff ? tx`(difficulty = ${diff}) desc,` : tx``} ${t.fresh ? tx`` : tx`(select count(*) from giramente_plays x where x.room_id = ${ctx.room.id} and x.puzzle_id = giramente_puzzles.id),`} random()
      limit 1`;
    if (p) return p;
  }
  fail("NOT_AVAILABLE", "Non ci sono enigmi pubblicati per questa prova: avvisa l'amministratore");
}

async function puzzleStats(ctx: Ctx, puzzleId: string | null, correct: boolean) {
  if (!puzzleId) return;
  await ctx.tx`update giramente_puzzles set times_played = times_played + 1, times_correct = times_correct + ${correct ? 1 : 0} where id = ${puzzleId}`;
}

async function updatePlay(ctx: Ctx, play: PlayRow, patch: Partial<PlayRow>) {
  Object.assign(play, patch);
  await ctx.tx`
    update giramente_plays set
      puzzle_id = ${play.puzzle_id}, puzzle_kind = ${play.puzzle_kind}, risk = ${play.risk}, sector = ${play.sector}, bonus = ${play.bonus}, lampo = ${play.lampo},
      jolly_offer = ${play.jolly_offer}, jolly_duplicate = ${play.jolly_duplicate}, jolly_chosen = ${play.jolly_chosen},
      colpo_offered = ${play.colpo_offered}, colpo_accepted = ${play.colpo_accepted}, status = ${play.status},
      started_at = ${play.started_at}, deadline_at = ${play.deadline_at}, total_ms = ${play.total_ms}, answered_at = ${play.answered_at},
      request_id = ${play.request_id}, answer = ${play.answer ? ctx.tx.json(play.answer as never) : null}, correct = ${play.correct},
      points = ${play.points}, applied = ${play.applied}, aids = ${ctx.tx.json(play.aids as never)},
      board = ${play.board ? ctx.tx.json(play.board as never) : null}, result = ${play.result ? ctx.tx.json(play.result as never) : null}
    where id = ${play.id}`;
  ctx.changed = true;
  ctx.secretChanged = true;
}

async function insertPlay(ctx: Ctx, p: { stage: Stage; series?: number; turnNo: number; competitorId: string; puzzle?: PuzzleRow | null; open?: boolean; durationMs?: number; aids?: PlayAids; board?: { initial: string[] } | null }): Promise<PlayRow> {
  const open = !!p.open;
  const [row] = await ctx.tx<PlayRow[]>`
    insert into giramente_plays (room_id, round_no, stage, series, turn_no, competitor_id, puzzle_id, puzzle_kind, status, started_at, deadline_at, total_ms, aids, board)
    values (${ctx.room.id}, ${ctx.room.round_no}, ${p.stage}, ${p.series ?? 0}, ${p.turnNo}, ${p.competitorId}, ${p.puzzle?.id ?? null}, ${p.puzzle?.kind ?? null},
      ${open ? "open" : "pending"}, ${open ? ctx.room.db_now : null}, ${open && p.durationMs ? at(ctx, p.durationMs) : null}, ${open ? (p.durationMs ?? null) : null},
      ${ctx.tx.json((p.aids ?? {}) as never)}, ${p.board ? ctx.tx.json(p.board as never) : null})
    returning *`;
  ctx.changed = true;
  ctx.secretChanged = true;
  return row;
}

// ---------------------------------------------------------------------------
// Azioni
// ---------------------------------------------------------------------------
async function apply(ctx: Ctx, a: GiramenteAction): Promise<void> {
  const { tx } = ctx;
  switch (a.action) {
    case "tick":
      return; // le scadenze sono già state controllate (checkDeadline)

    case "start_game": {
      requireHost(ctx);
      requirePhase(ctx, "LOBBY");
      return startGame(ctx);
    }

    case "skip": {
      requireHost(ctx);
      requireNotPaused(ctx);
      const r = ctx.room;
      if (r.phase === "WHEEL_RESULT") {
        const play = await loadPlay(tx, r.current_play_id);
        if (play && ((play.jolly_offer && !play.jolly_chosen) || (play.colpo_offered && play.colpo_accepted === null))) fail("WRONG_PHASE", "Il concorrente deve ancora scegliere");
      }
      if (!["INTRO", "ROUND_INTRO", "WHEEL_RESULT", "TURN_RESULT", "REVEAL", "ROUND_RESULTS"].includes(r.phase)) fail("WRONG_PHASE", "Non si può saltare questo momento");
      return onDeadline(ctx);
    }

    case "pause": {
      requireHost(ctx);
      if (ctx.room.paused_at) return;
      if (["LOBBY", "FINAL", "SPINNING"].includes(ctx.room.phase)) fail("WRONG_PHASE", ctx.room.phase === "SPINNING" ? "Aspetta che la ruota si fermi" : "Non c'è niente da mettere in pausa");
      ctx.room.paused_at = ctx.room.db_now;
      await emit(ctx, "pause");
      return;
    }

    case "resume": {
      requireHost(ctx);
      if (!ctx.room.paused_at) return;
      const shift = nowMs(ctx) - ctx.room.paused_at.getTime();
      if (ctx.room.phase_deadline_at) ctx.room.phase_deadline_at = new Date(ctx.room.phase_deadline_at.getTime() + shift);
      // i timer delle prove riprendono da dove erano
      await tx`update giramente_plays set deadline_at = deadline_at + make_interval(secs => ${shift / 1000}) where room_id = ${ctx.room.id} and status = 'open' and deadline_at is not null`;
      ctx.room.paused_ms = Number(ctx.room.paused_ms) + shift;
      ctx.room.paused_at = null;
      ctx.secretChanged = true;
      await emit(ctx, "resume");
      return;
    }

    case "choose_risk": {
      requireNotPaused(ctx);
      requirePhase(ctx, "CHOICE");
      const play = await currentPlay(ctx);
      requireActorFor(ctx, play.competitor_id);
      return chooseRisk(ctx, play, a.choice);
    }

    case "spin": {
      const play = await loadPlay(tx, ctx.room.current_play_id);
      // doppio clic su GIRA (o rete lenta): il giro esiste già → nessun cambiamento
      if (play && ["SPINNING", "WHEEL_RESULT", "QUESTION", "TURN_RESULT"].includes(ctx.room.phase) && (await loadSpin(tx, play.id))) return;
      requireNotPaused(ctx);
      requirePhase(ctx, "SPIN");
      if (!play) fail("WRONG_PHASE", "Nessun turno in corso");
      requireActorFor(ctx, play.competitor_id);
      return doSpin(ctx, play, a.requestId);
    }

    case "choose_jolly": {
      requireNotPaused(ctx);
      requirePhase(ctx, "WHEEL_RESULT");
      const play = await currentPlay(ctx);
      requireActorFor(ctx, play.competitor_id);
      if (!play.jolly_offer || play.jolly_chosen) fail("WRONG_PHASE", "Nessun potere da scegliere");
      return grantJolly(ctx, play, a.power);
    }

    case "colpo": {
      requireNotPaused(ctx);
      requirePhase(ctx, "WHEEL_RESULT");
      const play = await currentPlay(ctx);
      requireActorFor(ctx, play.competitor_id);
      if (!play.colpo_offered || play.colpo_accepted !== null) fail("WRONG_PHASE", "Nessuna sfida da accettare");
      await updatePlay(ctx, play, { colpo_accepted: a.accept, lampo: a.accept });
      await emit(ctx, "colpo", { accepted: a.accept, competitorId: play.competitor_id });
      return openQuestion(ctx, play);
    }

    case "start_turn": {
      requireNotPaused(ctx);
      requirePhase(ctx, "TURN_READY");
      if (!ctx.isOwner) fail("FORBIDDEN", "Il telefono è di chi ha creato la partita");
      return startPrivateTurn(ctx);
    }

    case "use_occhio":
      requireNotPaused(ctx);
      return applyOcchio(ctx, a.playId);

    case "next_clue":
      requireNotPaused(ctx);
      return nextClue(ctx, a.playId);

    case "reveal_letter":
    case "board_hint":
      requireNotPaused(ctx);
      return boardAid(ctx, a.playId, a.action === "reveal_letter" ? "letter" : "hint");

    case "answer":
      requireNotPaused(ctx);
      return answer(ctx, a);

    case "join_team": {
      requirePhase(ctx, "LOBBY");
      const p = ctx.participant;
      if (!p || ctx.room.mode !== "teams" || ctx.room.devices !== "personal") fail("FORBIDDEN", "Azione non disponibile");
      return moveToTeam(ctx, p, a.competitorId);
    }

    case "set_team": {
      requireHost(ctx);
      requirePhase(ctx, "LOBBY");
      const p = ctx.participants.find((x) => x.id === a.participantId);
      if (!p || ctx.room.mode !== "teams") fail("NOT_FOUND", "Giocatore non trovato");
      return moveToTeam(ctx, p, a.competitorId);
    }

    case "set_captain": {
      requireHost(ctx);
      const p = ctx.participants.find((x) => x.id === a.participantId);
      if (!p || !p.competitor_id || ctx.room.mode !== "teams") fail("NOT_FOUND", "Giocatore non trovato");
      await tx`update giramente_participants set captain = (id = ${p.id}) where room_id = ${ctx.room.id} and competitor_id = ${p.competitor_id}`;
      for (const x of ctx.participants) if (x.competitor_id === p.competitor_id) x.captain = x.id === p.id;
      ctx.changed = true;
      ctx.secretChanged = true;
      return;
    }

    case "kick": {
      requireHost(ctx);
      const p = ctx.participants.find((x) => x.id === a.participantId);
      if (!p) fail("NOT_FOUND", "Giocatore non trovato");
      if (p.user_id && p.user_id === ctx.room.host_user_id) fail("FORBIDDEN", "Non puoi togliere te stesso");
      return removeParticipant(ctx, p, "kicked");
    }

    case "update_settings": {
      requireHost(ctx);
      requirePhase(ctx, "LOBBY");
      const merged = settingsSchema.safeParse({ ...ctx.settings, ...a.settings });
      if (!merged.success) fail("VALIDATION", "Impostazioni non valide");
      ctx.settings = merged.data;
      await tx`update giramente_rooms set settings = ${tx.json(merged.data as never)} where id = ${ctx.room.id}`;
      ctx.changed = true;
      return;
    }

    case "leave": {
      const p = ctx.participant;
      if (!p) return;
      return removeParticipant(ctx, p, "left");
    }

    case "close_room": {
      requireHost(ctx);
      await tx`update giramente_rooms set status = 'closed', closed_at = now(), close_reason = 'host' where id = ${ctx.room.id}`;
      ctx.room.status = "closed";
      ctx.changed = true;
      return;
    }
  }
}

async function currentPlay(ctx: Ctx): Promise<PlayRow> {
  const p = await loadPlay(ctx.tx, ctx.room.current_play_id);
  if (!p) fail("WRONG_PHASE", "Nessun turno in corso");
  return p;
}

// ---------------------------------------------------------------------------
// Sala d'attesa
// ---------------------------------------------------------------------------
async function moveToTeam(ctx: Ctx, p: ParticipantRow, competitorId: string) {
  const team = ctx.competitors.find((c) => c.id === competitorId && c.kind === "team");
  if (!team) fail("NOT_FOUND", "Squadra non trovata");
  if (p.competitor_id === team.id) return;
  const members = ctx.participants.filter((x) => x.competitor_id === team.id);
  if (members.length >= MAX_TEAM_MEMBERS) fail("ROOM_FULL", `Una squadra può avere al massimo ${MAX_TEAM_MEMBERS} componenti`);
  const old = p.competitor_id;
  const captain = members.length === 0;
  await ctx.tx`update giramente_participants set competitor_id = ${team.id}, captain = ${captain} where id = ${p.id}`;
  p.competitor_id = team.id;
  p.captain = captain;
  if (old) await promoteCaptain(ctx, old);
  ctx.changed = true;
  ctx.secretChanged = true;
}

/** La squadra è rimasta senza capitano: lo diventa il primo componente rimasto. */
async function promoteCaptain(ctx: Ctx, teamId: string) {
  const left = ctx.participants.filter((x) => x.competitor_id === teamId && x.status === "active");
  if (left.length === 0 || left.some((x) => x.captain)) return;
  await ctx.tx`update giramente_participants set captain = true where id = ${left[0].id}`;
  left[0].captain = true;
}

async function removeParticipant(ctx: Ctx, p: ParticipantRow, status: "left" | "kicked") {
  const { tx } = ctx;
  await tx`update giramente_participants set status = ${status}, left_at = now(), captain = false where id = ${p.id}`;
  p.status = status;
  ctx.participants = ctx.participants.filter((x) => x.id !== p.id);
  if (p.competitor_id) {
    const comp = ctx.competitors.find((c) => c.id === p.competitor_id);
    if (comp?.kind === "player" && ctx.room.phase === "LOBBY") {
      // in sala d'attesa il concorrente individuale sparisce con il giocatore
      await tx`update giramente_competitors set active = false where id = ${comp.id}`;
      ctx.competitors = ctx.competitors.filter((c) => c.id !== comp.id);
    } else if (comp?.kind === "team") {
      await promoteCaptain(ctx, comp.id);
    }
  }
  if (status === "left" && ctx.participant?.id === p.id) ctx.participant = null;
  ctx.changed = true;
  ctx.secretChanged = true;
}

// ---------------------------------------------------------------------------
// Avvio e manche
// ---------------------------------------------------------------------------
async function startGame(ctx: Ctx) {
  const comps = ctx.competitors;
  if (ctx.room.mode === "individual") {
    if (comps.length < MIN_PLAYERS) fail("NOT_ENOUGH_PLAYERS", `Servono almeno ${MIN_PLAYERS} giocatori`);
  } else {
    // squadre vuote (nessun componente) non partecipano; le altre devono avere 2–6 componenti
    const withMembers = comps.filter((c) => ctx.participants.some((p) => p.competitor_id === c.id));
    if (withMembers.length < MIN_TEAMS) fail("NOT_ENOUGH_PLAYERS", `Servono almeno ${MIN_TEAMS} squadre con dei componenti`);
    for (const c of withMembers) {
      const n = ctx.participants.filter((p) => p.competitor_id === c.id).length;
      if (n < MIN_TEAM_MEMBERS) fail("NOT_ENOUGH_PLAYERS", `La squadra «${c.name}» ha bisogno di almeno ${MIN_TEAM_MEMBERS} componenti`);
    }
    const empty = comps.filter((c) => !withMembers.includes(c));
    if (empty.length) {
      await ctx.tx`update giramente_competitors set active = false where id = any(${ctx.tx.array(empty.map((c) => c.id))}::uuid[])`;
      ctx.competitors = withMembers;
    }
    if (ctx.room.devices === "personal") for (const c of ctx.competitors) await promoteCaptain(ctx, c.id);
  }
  const unassigned = ctx.participants.filter((p) => !p.competitor_id);
  if (ctx.room.mode === "teams" && unassigned.length) fail("NOT_ENOUGH_PLAYERS", `${unassigned[0].nickname} non ha ancora scelto una squadra`);
  ctx.room.started_at = ctx.room.db_now;
  await setPhase(ctx, "INTRO", phaseDurations(ctx.settings).intro);
  await emit(ctx, "game_start", { competitors: ctx.competitors.length });
}

async function startRound(ctx: Ctx, n: number) {
  const r = ctx.room;
  r.round_no = n;
  r.stage = n === 2 ? "falsa" : n === 4 ? "collegamento" : n === 5 ? "finale" : "wheel";
  r.turn_order = [];
  r.turn_index = 0;
  r.current_play_id = null;
  r.result = null;
  r.reveal = null;
  await ctx.tx`insert into giramente_rounds (room_id, round_no) values (${r.id}, ${n}) on conflict (room_id, round_no) do nothing`;
  await setPhase(ctx, "ROUND_INTRO", phaseDurations(ctx.settings).roundIntro);
  await emit(ctx, "round_start", { round: n });
}

async function beginRoundBody(ctx: Ctx) {
  const r = ctx.room;
  if (r.stage === "tiebreak") return beginStage(ctx, "tiebreak");
  if (r.stage === "wheel" || r.stage === "finale") {
    const comps = [...ctx.competitors];
    // Giro Decisivo: si parte da chi ha meno punti (suspense fino all'ultimo)
    if (r.round_no === 5) comps.sort((a, b) => a.score - b.score || a.seat - b.seat);
    r.turn_order = comps.map((c) => c.id);
    r.turn_index = 0;
    return beginWheelTurn(ctx);
  }
  return beginStage(ctx, r.stage!);
}

async function endRound(ctx: Ctx) {
  const r = ctx.room;
  await ctx.tx`update giramente_rounds set ended_at = now() where room_id = ${r.id} and round_no = ${r.round_no}`;
  // i Jolly non usati scadono alla fine della manche 4 (vietati nel Giro Decisivo)
  if (r.round_no === 4) for (const c of ctx.competitors.filter((x) => x.jolly)) await setJolly(ctx, c.id, null, "expired", null, c.jolly);
  r.current_play_id = null;
  r.result = null;
  await setPhase(ctx, "ROUND_RESULTS", phaseDurations(ctx.settings).roundResults);
  await emit(ctx, "round_end", { round: r.round_no });
}

async function afterRoundResults(ctx: Ctx) {
  const r = ctx.room;
  if (r.round_no < 5) return startRound(ctx, r.round_no + 1);
  const tied = tiedLeaders(computeStandings(ctx.competitors));
  if (tied.length > 1) return startTiebreak(ctx, tied);
  return finish(ctx, computeStandings(ctx.competitors).filter((s) => s.position === 1).map((s) => s.competitorId));
}

async function startTiebreak(ctx: Ctx, ids: string[]) {
  const r = ctx.room;
  r.stage = "tiebreak";
  r.tiebreak_no += 1;
  r.tiebreak_ids = ids;
  r.turn_order = [];
  r.turn_index = 0;
  r.reveal = null;
  r.result = null;
  // archivio dello spareggio esaurito (caso estremo): vittoria condivisa
  const [{ n }] = await ctx.tx<{ n: number }[]>`
    select count(*)::int as n from giramente_puzzles where status = 'published' and pool = 'finale'
      and id not in (select puzzle_id from giramente_plays where room_id = ${r.id} and puzzle_id is not null)`;
  if (n < (r.devices === "shared" ? ids.length : 1)) return finish(ctx, ids);
  await setPhase(ctx, "ROUND_INTRO", phaseDurations(ctx.settings).roundIntro);
  await emit(ctx, "tiebreak", { no: r.tiebreak_no, count: ids.length });
}

async function finish(ctx: Ctx, winners: string[]) {
  const r = ctx.room;
  r.winners = winners;
  r.finished_at = r.db_now;
  r.current_play_id = null;
  r.result = null;
  await setPhase(ctx, "FINAL", null);
  const w = ctx.competitors.find((c) => c.id === winners[0]);
  await emit(ctx, "winner", { name: w?.name ?? null, score: w?.score ?? 0, count: winners.length });
}

// ---------------------------------------------------------------------------
// Turni alla ruota (manche 1, 3 e Giro Decisivo)
// ---------------------------------------------------------------------------
async function beginWheelTurn(ctx: Ctx) {
  const r = ctx.room;
  const cid = r.turn_order[r.turn_index];
  if (!cid) return endRound(ctx);
  const play = await insertPlay(ctx, { stage: r.round_no === 5 ? "finale" : "wheel", turnNo: r.turn_index + 1, competitorId: cid });
  r.current_play_id = play.id;
  r.result = null;
  const d = phaseDurations(ctx.settings);
  if (r.round_no === 5) await setPhase(ctx, "SPIN", d.spin);
  else await setPhase(ctx, "CHOICE", d.choice);
  await emit(ctx, "turn", { competitorId: cid, name: competitor(ctx, cid).name, no: r.turn_index + 1 });
}

async function chooseRisk(ctx: Ctx, play: PlayRow, choice: Risk) {
  // VERDE/ROSSO si sceglie PRIMA del giro e non si cambia più
  await updatePlay(ctx, play, { risk: choice });
  await setPhase(ctx, "SPIN", phaseDurations(ctx.settings).spin);
  await emit(ctx, "risk", { competitorId: play.competitor_id, risk: choice });
}

async function doSpin(ctx: Ctx, play: PlayRow, requestId: string | null) {
  const segments = wheelFor(ctx.room.round_no);
  const target = randomInt(0, segments.length);
  const sector = segments[target];
  const startedAt = at(ctx, SPIN_LEAD_MS);
  await ctx.tx`
    insert into giramente_spins (room_id, play_id, round_no, competitor_id, segments, target_index, sector, request_id, started_at, duration_ms)
    values (${ctx.room.id}, ${play.id}, ${ctx.room.round_no}, ${play.competitor_id}, ${ctx.tx.array(segments)}::text[], ${target}, ${sector}, ${requestId}, ${startedAt}, ${SPIN_DURATION_MS})
    on conflict (play_id) do nothing`;
  // il turno ha sempre un rischio: senza scelta (tempo scaduto) vale VERDE
  await updatePlay(ctx, play, { sector, risk: ctx.room.round_no === 5 ? null : (play.risk ?? "verde") });
  await setPhase(ctx, "SPINNING", SPIN_LEAD_MS + SPIN_DURATION_MS + 300);
  await emit(ctx, "spin", { competitorId: play.competitor_id });
}

async function afterSpin(ctx: Ctx) {
  const play = await currentPlay(ctx);
  const d = phaseDurations(ctx.settings);
  const sector = play.sector!;
  let ms = d.sector;
  if (sector === "jolly") {
    const c = competitor(ctx, play.competitor_id);
    if (c.jolly) {
      // ha già un potere: niente doppioni, +50 punti
      await updatePlay(ctx, play, { jolly_duplicate: true });
      await applyScore(ctx, c.id, play.id, "jolly_dup", "Jolly doppione", JOLLY_DUPLICATE_POINTS);
      await setJolly(ctx, c.id, c.jolly, "duplicate", play.id, c.jolly);
      ms = d.sector + 2500;
    } else {
      await updatePlay(ctx, play, { jolly_offer: true });
      ms = d.offer;
    }
  } else if (sector === "colpo") {
    await updatePlay(ctx, play, { colpo_offered: true });
    ms = d.offer;
  } else if (sector === "bonus") {
    await updatePlay(ctx, play, { bonus: true });
  }
  await setPhase(ctx, "WHEEL_RESULT", ms);
  await emit(ctx, "sector", { sector, label: WHEEL_LABEL[sector], competitorId: play.competitor_id, duplicate: play.jolly_duplicate });
}

async function grantJolly(ctx: Ctx, play: PlayRow, power: JollyPower) {
  await updatePlay(ctx, play, { jolly_chosen: power });
  await setJolly(ctx, play.competitor_id, power, "granted", play.id, power);
  // breve reazione di Zafira, poi l'enigma
  await setPhase(ctx, "WHEEL_RESULT", phaseDurations(ctx.settings).afterChoice);
  await emit(ctx, "jolly_power", { power, competitorId: play.competitor_id });
}

async function openQuestion(ctx: Ctx, play: PlayRow) {
  const r = ctx.room;
  const finale = r.round_no === 5;
  const kind = puzzleKindFor(play.sector ?? "mistero", (n) => randomInt(0, n));
  const puzzle = await pickPuzzle(ctx, finale ? "finale" : "ruota", kind);
  const s = ctx.settings;
  const sec = play.lampo ? s.lampoSec : finale ? s.finaleSec : (puzzle.time_limit_sec ?? s.answerSec);
  const ms = sec * 1000;
  await updatePlay(ctx, play, {
    puzzle_id: puzzle.id,
    puzzle_kind: puzzle.kind,
    status: "open",
    started_at: r.db_now,
    deadline_at: at(ctx, ms),
    total_ms: ms,
    aids: { ...play.aids, ...(finale ? { clueLevel: 1 } : {}) },
  });
  await setPhase(ctx, "QUESTION", ms + ANSWER_GRACE_MS);
  await emit(ctx, "question", { competitorId: play.competitor_id, kind: puzzle.kind ?? null });
}

/** Esito della giocata alla ruota: punteggio (con Scudo e minimo a zero), risultato pubblico. */
async function resolveWheelPlay(ctx: Ctx, play: PlayRow, puzzle: PuzzleRow, o: { correct: boolean; given: string | null; timeout: boolean; text?: string | null; choice?: number | null; requestId?: string | null }) {
  const r = ctx.room;
  const c = competitor(ctx, play.competitor_id);
  let lines: ScoreLine[];
  let shieldUsed = false;
  if (r.round_no === 5) {
    const level = play.aids.clueLevel ?? 1;
    lines = o.correct ? [{ kind: "award", label: `Risposta giusta al ${level}° indizio`, delta: finalePoints(level) }] : [];
  } else {
    const s = scoreWheelTurn({ roundNo: r.round_no, risk: play.risk ?? "verde", correct: o.correct, bonus: play.bonus, lampo: play.lampo, jolly: c.jolly });
    lines = s.lines;
    shieldUsed = s.shieldUsed;
  }
  let total = 0;
  const applied: { label: string; delta: number }[] = [];
  for (const l of lines) {
    const kind = r.round_no === 5 ? "finale" : l.kind;
    const v = await applyScore(ctx, c.id, play.id, kind, l.label, l.delta);
    total += v;
    applied.push({ label: l.label, delta: l.kind === "shield" ? 0 : v });
  }
  if (shieldUsed) await setJolly(ctx, c.id, null, "used", play.id, "scudo");
  const result: TurnResult = {
    playId: play.id,
    competitorId: c.id,
    correct: o.correct,
    timeout: o.timeout,
    given: o.given,
    solution: puzzle.solution,
    explanation: puzzle.explanation,
    lines: applied,
    delta: total,
    shieldUsed,
  };
  await updatePlay(ctx, play, {
    status: o.timeout ? "timeout" : "answered",
    answered_at: o.timeout ? null : r.db_now,
    request_id: o.requestId ?? null,
    answer: o.timeout ? null : { choice: o.choice ?? null, text: o.text ?? null },
    correct: o.correct,
    points: total,
    applied: true,
    result,
  });
  await puzzleStats(ctx, puzzle.id, o.correct);
  r.result = result;
  await setPhase(ctx, "TURN_RESULT", phaseDurations(ctx.settings).turnResult);
  const penalty = lines.find((l) => l.kind === "penalty");
  await emit(ctx, shieldUsed ? "shield" : penalty ? "penalty" : "result", {
    competitorId: c.id,
    name: c.name,
    correct: o.correct,
    timeout: o.timeout,
    points: total,
    bonus: play.bonus && o.correct,
    lampo: play.lampo && o.correct,
  });
}

async function nextWheelTurn(ctx: Ctx) {
  ctx.room.turn_index += 1;
  if (ctx.room.turn_index >= ctx.room.turn_order.length) return endRound(ctx);
  return beginWheelTurn(ctx);
}

// ---------------------------------------------------------------------------
// Prove contemporanee (dispositivi personali) o a turno (dispositivo condiviso)
// ---------------------------------------------------------------------------
const STAGE_POOL: Record<"falsa" | "collegamento" | "tabellone" | "tiebreak", PuzzlePool> = {
  falsa: "falsa_pista",
  collegamento: "collegamento",
  tabellone: "tabellone",
  tiebreak: "finale",
};

function stageSeconds(ctx: Ctx, stage: Stage): number {
  const s = ctx.settings;
  return stage === "falsa" ? s.falsaSec : stage === "collegamento" ? s.collegamentoSec : stage === "tabellone" ? s.tabelloneSec : s.finaleSec;
}

function stageCompetitors(ctx: Ctx, stage: Stage): string[] {
  return stage === "tiebreak" ? ctx.room.tiebreak_ids : ctx.competitors.map((c) => c.id);
}

/** Enigmi di una prova per UN concorrente (o per tutti, nelle prove contemporanee). */
async function stagePuzzles(ctx: Ctx, stage: Stage): Promise<PuzzleRow[]> {
  const pool = STAGE_POOL[stage as keyof typeof STAGE_POOL];
  if (stage === "falsa") {
    const a = await pickPuzzle(ctx, pool, null);
    const b = await pickPuzzle(ctx, pool, null, [a.id]);
    return [a, b];
  }
  return [await pickPuzzle(ctx, pool, null)];
}

async function createStagePlays(ctx: Ctx, stage: Stage, competitorIds: string[], puzzles: PuzzleRow[]) {
  const ms = stageSeconds(ctx, stage) * 1000;
  const series = stage === "tiebreak" ? ctx.room.tiebreak_no : 0;
  const board = stage === "tabellone" ? { initial: initialLetters(puzzles[0].solution, (n) => randomInt(0, n)) } : null;
  for (const cid of competitorIds) {
    for (let i = 0; i < puzzles.length; i++) {
      await insertPlay(ctx, {
        stage,
        series,
        turnNo: i + 1,
        competitorId: cid,
        puzzle: puzzles[i],
        open: true,
        durationMs: ms,
        aids: stage === "tiebreak" ? { clueLevel: 1 } : {},
        board,
      });
    }
  }
  await setPhase(ctx, "PLAY", ms + ANSWER_GRACE_MS);
}

async function beginStage(ctx: Ctx, stage: Stage) {
  const r = ctx.room;
  r.stage = stage;
  r.current_play_id = null;
  r.reveal = null;
  const ids = stageCompetitors(ctx, stage);
  if (r.devices === "personal") {
    // tutti insieme, stesso enigma, ognuno sul proprio dispositivo
    await createStagePlays(ctx, stage, ids, await stagePuzzles(ctx, stage));
  } else {
    // un solo telefono: a turno, un enigma diverso per ciascuno (equivalente per difficoltà)
    r.turn_order = ids;
    r.turn_index = 0;
    await setPhase(ctx, "TURN_READY", null);
  }
  await emit(ctx, "stage_start", { stage, round: r.round_no });
}

async function startPrivateTurn(ctx: Ctx) {
  const cid = ctx.room.turn_order[ctx.room.turn_index];
  if (!cid) return closeStage(ctx);
  await createStagePlays(ctx, ctx.room.stage!, [cid], await stagePuzzles(ctx, ctx.room.stage!));
  await emit(ctx, "turn", { competitorId: cid, name: competitor(ctx, cid).name, no: ctx.room.turn_index + 1 });
}

/** Una prova è finita per tutti (o per chi ha il telefono in mano)? Allora si va avanti. */
async function maybeAdvanceStage(ctx: Ctx) {
  const plays = await loadStagePlays(ctx.tx, ctx.room);
  if (ctx.room.devices === "personal") {
    if (plays.length && plays.every((p) => p.status !== "open")) await closeStage(ctx);
    return;
  }
  const cid = ctx.room.turn_order[ctx.room.turn_index];
  const mine = plays.filter((p) => p.competitor_id === cid);
  if (mine.length && mine.every((p) => p.status !== "open")) await nextPrivateTurn(ctx);
}

async function nextPrivateTurn(ctx: Ctx) {
  ctx.room.turn_index += 1;
  if (ctx.room.turn_index >= ctx.room.turn_order.length) return closeStage(ctx);
  await setPhase(ctx, "TURN_READY", null);
}

/** Tempo scaduto o tutti hanno consegnato: le giocate aperte valgono 0, punti applicati, rivelazione. */
async function closeStage(ctx: Ctx) {
  const r = ctx.room;
  const plays = await loadStagePlays(ctx.tx, r);
  for (const p of plays.filter((x) => x.status === "open" || x.status === "pending")) {
    await updatePlay(ctx, p, { status: "timeout", correct: false, points: 0 });
  }
  const puzzles = await loadPuzzles(ctx.tx, plays.map((p) => p.puzzle_id));
  const results: RevealItem[] = [];
  const tiebreak: { competitorId: string; points: number; elapsedMs: number | null }[] = [];
  for (const cid of stageCompetitors(ctx, r.stage!)) {
    const mine = plays.filter((p) => p.competitor_id === cid).sort((a, b) => a.turn_no - b.turn_no);
    const item: RevealItem = { competitorId: cid, items: [], points: 0 };
    for (const p of mine) {
      const pz = puzzles.get(p.puzzle_id ?? "");
      if (!pz) continue;
      const detail = revealDetail(p, pz);
      // i punti della prova si applicano TUTTI ORA (prima nessuno poteva dedurre gli esiti dalla classifica)
      let pts = 0;
      if (!p.applied && r.stage !== "tiebreak") {
        for (const l of stageScoreLines(p, pz)) pts += await applyScore(ctx, cid, p.id, l.kind, l.label, l.delta);
        await updatePlay(ctx, p, { applied: true });
        await puzzleStats(ctx, pz.id, !!p.correct);
      } else pts = p.points;
      if (r.stage === "tiebreak") {
        await puzzleStats(ctx, pz.id, !!p.correct);
        tiebreak.push({ competitorId: cid, points: p.points, elapsedMs: p.correct && p.answered_at && p.started_at ? p.answered_at.getTime() - p.started_at.getTime() : null });
      }
      item.items.push({
        playId: p.id,
        title: r.stage === "falsa" ? `Enigma ${p.turn_no}` : r.stage === "collegamento" ? pz.clues.join(" · ") : r.stage === "tabellone" ? pz.category : "Spareggio",
        solution: r.stage === "falsa" ? `${pz.solution} · falsa pista: «${pz.clues[pz.false_index ?? 0] ?? ""}»` : pz.solution,
        given: givenText(p, pz),
        correct: !!p.correct,
        detail,
        points: pts,
      });
      item.points += pts;
    }
    results.push(item);
  }
  const first = plays[0] ? puzzles.get(plays[0].puzzle_id ?? "") : undefined;
  const reveal: PublicReveal = {
    stage: r.stage!,
    solutions: r.devices === "personal" ? [...new Set(plays.map((p) => puzzles.get(p.puzzle_id ?? "")?.solution).filter((x): x is string => !!x))] : [],
    results,
    board: r.stage === "tabellone" && r.devices === "personal" && first ? { category: first.category, rows: maskBoard(first.solution, [...first.solution].filter((ch) => /\p{L}/u.test(ch))) } : null,
    tiebreakWinner: r.stage === "tiebreak" ? resolveTiebreak(tiebreak, r.tiebreak_no) : null,
  };
  r.reveal = reveal;
  await setPhase(ctx, "REVEAL", phaseDurations(ctx.settings).reveal);
  await emit(ctx, "reveal", { stage: r.stage });
}

function givenText(p: PlayRow, pz: PuzzleRow): string | null {
  if (!p.answer) return null;
  if (p.stage === "falsa") {
    const f = p.answer.falseIndex;
    const fl = f === null || f === undefined ? "—" : String.fromCharCode(65 + f);
    return `Falsa pista: ${fl} · Soluzione: ${p.answer.text || "—"}`;
  }
  void pz;
  return p.answer.text ?? null;
}

function revealDetail(p: PlayRow, pz: PuzzleRow): string | null {
  const a = p.aids ?? {};
  if (p.stage === "collegamento") return a.extra ? (a.occhio ? "Quarto indizio gratis con l'Occhio Furbo" : "Con il quarto indizio") : null;
  if (p.stage === "tabellone") {
    const bits = [`${a.letters?.length ?? 0} lettere svelate`, a.hints ? "indizio usato" : null, a.freeHint ? "indizio gratis (Occhio Furbo)" : null].filter(Boolean);
    return bits.join(" · ");
  }
  if (p.stage === "tiebreak") return `${a.clueLevel ?? 1}° indizio`;
  if (p.stage === "falsa") {
    const ans = p.answer ?? {};
    const fOk = ans.falseIndex === pz.false_index;
    const sOk = matchAnswer(ans.text ?? "", pz.solution, pz.accepted);
    return `${fOk ? "✓" : "✗"} falsa pista · ${sOk ? "✓" : "✗"} soluzione`;
  }
  return null;
}

/** Punteggio di una prova contemporanea/a turno (calcolato alla risposta, applicato alla rivelazione). */
function stageScoreLines(p: PlayRow, pz: PuzzleRow): { kind: string; label: string; delta: number }[] {
  if (!p.answer) return [];
  const a = p.aids ?? {};
  switch (p.stage) {
    case "falsa": {
      const out = [];
      if (p.answer.falseIndex === pz.false_index) out.push({ kind: "falsa", label: "Falsa pista trovata", delta: FALSA_POINTS });
      if (matchAnswer(p.answer.text ?? "", pz.solution, pz.accepted)) out.push({ kind: "soluzione", label: "Soluzione giusta", delta: FALSA_SOLUTION_POINTS });
      return out;
    }
    case "collegamento":
      return p.correct ? [{ kind: "collegamento", label: "Collegamento trovato", delta: collegamentoPoints(!!a.extra && !a.occhio) }] : [];
    case "tabellone":
      return p.correct ? [{ kind: "tabellone", label: "Frase indovinata", delta: tabellonePoints(a.letters?.length ?? 0, a.hints ?? 0) }] : [];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Risposte
// ---------------------------------------------------------------------------
async function answer(ctx: Ctx, a: Extract<GiramenteAction, { action: "answer" }>) {
  const { tx } = ctx;
  const play = await loadPlay(tx, a.playId);
  if (!play || play.room_id !== ctx.room.id) fail("NOT_FOUND", "Enigma non trovato");
  // doppio invio della stessa risposta (rete lenta, doppio tocco): nessun cambiamento
  if (play.status === "answered" && play.request_id === a.requestId) return;
  if (play.status !== "open") fail(play.status === "answered" ? "ALREADY_ANSWERED" : "TOO_LATE", play.status === "answered" ? "Hai già risposto" : "Tempo scaduto");
  requireActorFor(ctx, play.competitor_id);
  if (play.deadline_at && nowMs(ctx) > play.deadline_at.getTime() + ANSWER_GRACE_MS) fail("TOO_LATE", "Tempo scaduto: la risposta non vale");
  const puzzle = (await loadPuzzles(tx, [play.puzzle_id])).get(play.puzzle_id ?? "");
  if (!puzzle) fail("NOT_FOUND", "Enigma non trovato");

  if (play.stage === "wheel" || play.stage === "finale") {
    if (ctx.room.phase !== "QUESTION" || ctx.room.current_play_id !== play.id) fail("WRONG_PHASE", "La domanda è chiusa");
    if (play.stage === "wheel") {
      if (a.choice === undefined || !puzzle.options) fail("VALIDATION", "Scegli una risposta");
      return resolveWheelPlay(ctx, play, puzzle, { correct: a.choice === puzzle.answer_index, given: puzzle.options[a.choice] ?? null, timeout: false, choice: a.choice, requestId: a.requestId });
    }
    const text = String(a.text ?? "").trim();
    if (!text) fail("VALIDATION", "Scrivi la risposta");
    return resolveWheelPlay(ctx, play, puzzle, { correct: matchAnswer(text, puzzle.solution, puzzle.accepted), given: text, timeout: false, text, requestId: a.requestId });
  }

  if (ctx.room.phase !== "PLAY") fail("WRONG_PHASE", "La prova è chiusa");
  const text = String(a.text ?? "").trim().slice(0, 120);
  let correct = false;
  let points = 0;
  const aids = play.aids ?? {};
  switch (play.stage) {
    case "falsa": {
      if (a.falseIndex === undefined) fail("VALIDATION", "Scegli la falsa pista");
      const fOk = a.falseIndex === puzzle.false_index;
      const sOk = !!text && matchAnswer(text, puzzle.solution, puzzle.accepted);
      correct = fOk && sOk;
      points = (fOk ? FALSA_POINTS : 0) + (sOk ? FALSA_SOLUTION_POINTS : 0);
      break;
    }
    case "collegamento":
      if (!text) fail("VALIDATION", "Scrivi il collegamento");
      correct = matchAnswer(text, puzzle.solution, puzzle.accepted);
      points = correct ? collegamentoPoints(!!aids.extra && !aids.occhio) : 0;
      break;
    case "tabellone":
      if (!text) fail("VALIDATION", "Scrivi la frase");
      correct = matchPhrase(text, puzzle.solution, puzzle.accepted);
      points = correct ? tabellonePoints(aids.letters?.length ?? 0, aids.hints ?? 0) : 0;
      break;
    case "tiebreak":
      if (!text) fail("VALIDATION", "Scrivi la risposta");
      correct = matchAnswer(text, puzzle.solution, puzzle.accepted);
      points = correct ? finalePoints(aids.clueLevel ?? 1) : 0;
      break;
  }
  await updatePlay(ctx, play, {
    status: "answered",
    answered_at: ctx.room.db_now,
    request_id: a.requestId,
    answer: { falseIndex: a.falseIndex ?? null, text: text || null },
    correct,
    points,
  });
  // nessun evento con l'esito: si scopre alla rivelazione
  ctx.event = { kind: "result", at: ctx.room.db_now.toISOString(), data: { competitorId: play.competitor_id, hidden: true } };
  await maybeAdvanceStage(ctx);
}

// ---------------------------------------------------------------------------
// Aiuti: Occhio Furbo, indizi, lettere
// ---------------------------------------------------------------------------
async function ownOpenPlay(ctx: Ctx, playId: string): Promise<PlayRow> {
  const play = await loadPlay(ctx.tx, playId);
  if (!play || play.room_id !== ctx.room.id) fail("NOT_FOUND", "Enigma non trovato");
  if (play.status !== "open") fail("WRONG_PHASE", "Questo enigma è chiuso");
  requireActorFor(ctx, play.competitor_id);
  if (play.deadline_at && nowMs(ctx) > play.deadline_at.getTime()) fail("TOO_LATE", "Tempo scaduto");
  return play;
}

async function applyOcchio(ctx: Ctx, playId: string) {
  const play = await ownOpenPlay(ctx, playId);
  const c = competitor(ctx, play.competitor_id);
  if (c.jolly !== "occhio") fail("NOT_AVAILABLE", "Non hai l'Occhio Furbo");
  if (ctx.room.round_no === 5 || play.stage === "finale" || play.stage === "tiebreak") fail("NOT_AVAILABLE", "I Jolly non valgono nel Giro Decisivo");
  const puzzle = (await loadPuzzles(ctx.tx, [play.puzzle_id])).get(play.puzzle_id ?? "");
  if (!puzzle?.extra_clue) fail("NOT_AVAILABLE", "Questo enigma non ha un indizio extra");
  const aids = { ...play.aids };
  if (play.stage === "wheel") {
    if (aids.occhio) fail("NOT_AVAILABLE", "Indizio già mostrato");
    aids.occhio = true;
  } else if (play.stage === "collegamento") {
    if (aids.extra) fail("NOT_AVAILABLE", "Il quarto indizio è già visibile");
    aids.extra = true;
    aids.occhio = true;
  } else if (play.stage === "tabellone") {
    if (aids.hints || aids.freeHint) fail("NOT_AVAILABLE", "L'indizio è già visibile");
    aids.freeHint = true;
    aids.occhio = true;
  } else fail("NOT_AVAILABLE", "L'Occhio Furbo non serve in questa prova");
  // consumato SOLO ora che l'effetto si applica davvero
  await updatePlay(ctx, play, { aids });
  await setJolly(ctx, c.id, null, "used", play.id, "occhio");
  await emit(ctx, "occhio", { competitorId: c.id, name: c.name, public: play.stage === "wheel" });
}

async function nextClue(ctx: Ctx, playId: string) {
  const play = await ownOpenPlay(ctx, playId);
  const aids = { ...play.aids };
  if (play.stage === "finale" || play.stage === "tiebreak") {
    const puzzle = (await loadPuzzles(ctx.tx, [play.puzzle_id])).get(play.puzzle_id ?? "");
    const max = Math.min(3, puzzle?.clues.length ?? 3);
    if ((aids.clueLevel ?? 1) >= max) fail("NOT_AVAILABLE", "Hai già tutti gli indizi");
    aids.clueLevel = (aids.clueLevel ?? 1) + 1;
  } else if (play.stage === "collegamento") {
    if (aids.extra) return;
    aids.extra = true;
  } else fail("NOT_AVAILABLE", "Nessun indizio per questa prova");
  await updatePlay(ctx, play, { aids });
  if (play.stage === "finale") await emit(ctx, "question", { competitorId: play.competitor_id, clue: aids.clueLevel ?? 1 });
}

async function boardAid(ctx: Ctx, playId: string, kind: "letter" | "hint") {
  const play = await ownOpenPlay(ctx, playId);
  if (play.stage !== "tabellone") fail("NOT_AVAILABLE", "Aiuto solo per il Tabellone");
  const puzzle = (await loadPuzzles(ctx.tx, [play.puzzle_id])).get(play.puzzle_id ?? "");
  if (!puzzle) fail("NOT_FOUND", "Enigma non trovato");
  const aids = { ...play.aids };
  if (kind === "hint") {
    if (aids.hints || aids.freeHint) fail("NOT_AVAILABLE", "L'indizio è già visibile");
    if (!puzzle.extra_clue) fail("NOT_AVAILABLE", "Nessun indizio per questa frase");
    aids.hints = 1;
  } else {
    const revealed = [...(play.board?.initial ?? []), ...(aids.letters ?? [])];
    if (!canRevealLetter(puzzle.solution, revealed, aids.letters?.length ?? 0)) fail("NOT_AVAILABLE", "Non puoi svelare altre lettere");
    const hidden = hiddenLetters(puzzle.solution, revealed);
    const letter = hidden[randomInt(0, hidden.length)];
    aids.letters = [...(aids.letters ?? []), letter];
    aids.lastLetter = letter;
  }
  await updatePlay(ctx, play, { aids });
}

// ---------------------------------------------------------------------------
// Scadenze
// ---------------------------------------------------------------------------
async function checkDeadline(ctx: Ctx) {
  const r = ctx.room;
  if (r.paused_at || r.status !== "open") return;
  // prove: giocate scadute (anche prima della scadenza della fase, per le prove a turno)
  if (r.phase === "PLAY") {
    const plays = await loadStagePlays(ctx.tx, r);
    const expired = plays.filter((p) => p.status === "open" && p.deadline_at && nowMs(ctx) > p.deadline_at.getTime() + ANSWER_GRACE_MS);
    if (expired.length) {
      for (const p of expired) await updatePlay(ctx, p, { status: "timeout", correct: false, points: 0 });
      await maybeAdvanceStage(ctx);
      return;
    }
  }
  if (r.phase_deadline_at && nowMs(ctx) >= r.phase_deadline_at.getTime()) await onDeadline(ctx);
}

async function onDeadline(ctx: Ctx) {
  const r = ctx.room;
  switch (r.phase) {
    case "INTRO":
      return startRound(ctx, 1);
    case "ROUND_INTRO":
      return beginRoundBody(ctx);
    case "CHOICE": {
      const play = await currentPlay(ctx);
      return chooseRisk(ctx, play, "verde");
    }
    case "SPIN": {
      const play = await currentPlay(ctx);
      return doSpin(ctx, play, null);
    }
    case "SPINNING":
      return afterSpin(ctx);
    case "WHEEL_RESULT": {
      const play = await currentPlay(ctx);
      if (play.jolly_offer && !play.jolly_chosen) {
        // nessuna scelta in tempo: la Jolly decide per te
        return grantJolly(ctx, play, randomInt(0, 2) === 0 ? "occhio" : "scudo");
      }
      if (play.colpo_offered && play.colpo_accepted === null) await updatePlay(ctx, play, { colpo_accepted: false });
      return openQuestion(ctx, play);
    }
    case "QUESTION": {
      const play = await currentPlay(ctx);
      if (play.status !== "open") return;
      const puzzle = (await loadPuzzles(ctx.tx, [play.puzzle_id])).get(play.puzzle_id ?? "");
      if (!puzzle) return nextWheelTurn(ctx);
      return resolveWheelPlay(ctx, play, puzzle, { correct: false, given: null, timeout: true });
    }
    case "TURN_RESULT":
      return nextWheelTurn(ctx);
    case "PLAY":
      return closeStage(ctx);
    case "REVEAL": {
      if (r.stage === "collegamento") return beginStage(ctx, "tabellone");
      if (r.stage === "tiebreak") {
        const w = r.reveal?.tiebreakWinner;
        if (w) return finish(ctx, [w]);
        return startTiebreak(ctx, r.tiebreak_ids);
      }
      return endRound(ctx);
    }
    case "ROUND_RESULTS":
      return afterRoundResults(ctx);
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Fine transazione
// ---------------------------------------------------------------------------
async function commit(ctx: Ctx): Promise<ActionResult> {
  const { tx, room } = ctx;
  if (!ctx.changed) return { state: await buildPublicStateFrom(tx, room), changed: false };
  await saveRoom(ctx);
  const [u] = await tx<{ version: number; secret_rev: number }[]>`
    update giramente_rooms set
      version = version + 1,
      secret_rev = secret_rev + ${ctx.secretChanged ? 1 : 0},
      event = ${ctx.event === undefined ? tx`event` : ctx.event === null ? null : tx.json(ctx.event as never)},
      updated_at = now(), last_activity_at = now(), broadcast_at = now()
      ${ctx.isHost && !ctx.system ? tx`, host_seen_at = now()` : tx``}
    where id = ${room.id}
    returning version, secret_rev`;
  room.version = u.version;
  room.secret_rev = u.secret_rev;
  const fresh = (await loadRoom(tx, room.id))!;
  const state = await buildPublicStateFrom(tx, fresh);
  await broadcastGiramente(tx, state);
  return { state, changed: true };
}
