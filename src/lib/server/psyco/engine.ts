import "server-only";
import { getSql, type Tx } from "@/lib/database/db";
import { checkNickname, checkRuleText, drawOne, elapsedMs, isExpired, pickPsyco, resolvePlurality, resolveYesNo } from "@/lib/psyco/logic";
import {
  DIFFICULTIES,
  MIN_PLAYERS,
  type Difficulty,
  type PsycoAction,
  type PsycoEvent,
  type PsycoEventKind,
  type PsycoPhase,
  type PsycoPublicState,
  type PsycoSettings,
  type PublicTimer,
  type RoundOutcome,
} from "@/lib/psyco/types";
import { PsycoError } from "./errors";
import { broadcastPsyco } from "./realtime";
import {
  buildPublicStateFrom,
  eligibleKnowers,
  loadBallot,
  loadMembers,
  loadParticipants,
  loadRoom,
  loadRound,
  ONLINE_MS,
  parseSettings,
  passBallot,
  type MemberRow,
  type ParticipantRow,
  type RoomRow,
  type RoundRow,
  type RoundVoteMeta,
} from "./state";

/**
 * Motore di PSYCO: macchina a stati AUTOREVOLE sul server.
 *
 * Ogni azione è UNA transazione:
 *  - lucchetto sulla riga della stanza (FOR UPDATE) → richieste simultanee in fila, niente doppie
 *    transizioni; `lock_timeout`/`statement_timeout` locali per non restare mai appesi;
 *  - dentro la transazione si usa SOLO `tx` (mai il pool: era la causa dei blocchi del quiz);
 *  - transizione validata (fase, ruolo, diritto di voto) → versione +1 → stato PUBBLICO inviato sul
 *    canale realtime (nessun segreto) solo se la transazione va a buon fine.
 * Operazioni idempotenti: un voto è una riga per (manche, votazione, partecipante); azioni ripetute
 * (secondo «visto», secondo tick, secondo avvio) non cambiano nulla.
 */

export interface PsycoActor {
  userId: string;
  ip: string | null;
  /** dispositivo condiviso: il partecipante locale che sta usando il telefono in questo momento */
  asParticipantId?: string | null;
}

/** Attore di sistema (scadenza del timer letta da uno schermo pubblico, pulizia). */
export const SYSTEM_ACTOR: PsycoActor = { userId: "00000000-0000-0000-0000-000000000000", ip: null };

const LOCK_TIMEOUT = "4s";
const STATEMENT_TIMEOUT = "10s";
/** Oltre questo numero di partecipanti i voti intermedi non vengono trasmessi più di una volta ogni 1,5 s. */
const BIG_ROOM = 40;
const HOST_GONE_MS = 60_000;
const ROUND_PHASES: PsycoPhase[] = ["ROLE_REVEAL", "DIFFICULTY_VOTE", "RULE_VOTE", "RULE_PROPOSALS", "PROPOSAL_VOTE", "RULE_CONFIRMED", "PLAYING", "GUESS_VOTE"];
const DIFFICULTY_OPTIONS = [...DIFFICULTIES, "sorpresa"];

interface Ctx {
  tx: Tx;
  room: RoomRow;
  round: RoundRow | null;
  actor: PsycoActor;
  system: boolean;
  participant: ParticipantRow | null;
  isHost: boolean;
  isOwner: boolean;
  active: ParticipantRow[];
  members: MemberRow[];
  changed: boolean;
  secretChanged: boolean;
  /** solo un voto intermedio: in una stanza grande si può non trasmettere subito */
  minorChange: boolean;
  event: PsycoEvent | null | undefined;
  settings: PsycoSettings;
}

export interface ActionResult {
  /** null = aggiornamento minore in una stanza grande: stato non ricostruito (lo leggono i client al prossimo giro) */
  state: PsycoPublicState | null;
  changed: boolean;
}

function fail(code: ConstructorParameters<typeof PsycoError>[0], message: string): never {
  throw new PsycoError(code, message);
}

const UUID = /^[0-9a-f-]{36}$/i;

// ---------------------------------------------------------------------------
// Ingresso
// ---------------------------------------------------------------------------
export async function runAction(roomId: string, actor: PsycoActor, action: PsycoAction): Promise<ActionResult> {
  if (!UUID.test(roomId)) fail("NOT_FOUND", "Stanza non trovata");
  const system = actor === SYSTEM_ACTOR;
  try {
    return await getSql().begin(async (tx) => {
      await tx`select set_config('lock_timeout', ${LOCK_TIMEOUT}, true), set_config('statement_timeout', ${STATEMENT_TIMEOUT}, true)`;
      const room = await loadRoom(tx, roomId, true);
      if (!room) fail("NOT_FOUND", "Stanza non trovata");
      if (room.status === "closed") fail("ROOM_CLOSED", "Questa partita è terminata");
      const ctx = await makeCtx(tx, room, actor, system);
      await checkTimer(ctx);
      await apply(ctx, action);
      await checkRoundIntegrity(ctx);
      return commit(ctx);
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "55P03" || code === "57014") throw new PsycoError("BUSY", "Troppe richieste nello stesso momento: riprova");
    throw e;
  }
}

async function makeCtx(tx: Tx, room: RoomRow, actor: PsycoActor, system: boolean): Promise<Ctx> {
  const [active, round] = await Promise.all([loadParticipants(tx, room.id), loadRound(tx, room.current_round_id)]);
  const members = round ? await loadMembers(tx, round.id) : [];
  const isOwner = !system && room.owner_user_id === actor.userId;
  let participant: ParticipantRow | null = null;
  let isHost = false;
  if (!system) {
    if (room.mode === "shared") {
      isHost = isOwner;
      if (actor.asParticipantId) {
        if (!isOwner) fail("FORBIDDEN", "Solo chi ha creato la partita usa questo dispositivo");
        participant = active.find((p) => p.id === actor.asParticipantId && p.kind === "local") ?? null;
        if (!participant) fail("NOT_MEMBER", "Giocatore non trovato in questa partita");
      }
    } else {
      isHost = room.host_user_id === actor.userId;
      const [p] = await tx<ParticipantRow[]>`
        select id, kind, user_id, owner_user_id, nickname, seat, status, psyco_count, last_psyco_round, last_seen_at
        from psyco_participants where room_id = ${room.id} and user_id = ${actor.userId}`;
      if (p?.status === "kicked") fail("KICKED", "Sei stato tolto da questa partita");
      participant = p?.status === "active" ? p : null;
    }
    if (!participant && !isHost) fail("NOT_MEMBER", "Non fai parte di questa partita");
  }
  return {
    tx,
    room,
    round,
    actor,
    system,
    participant,
    isHost,
    isOwner,
    active,
    members,
    changed: false,
    secretChanged: false,
    minorChange: false,
    event: undefined,
    settings: parseSettings(room.settings),
  };
}

function requireHost(ctx: Ctx) {
  if (!ctx.isHost) fail("FORBIDDEN", "Solo chi gestisce la partita può farlo");
}
function requirePhase(ctx: Ctx, ...phases: PsycoPhase[]) {
  if (!phases.includes(ctx.room.phase)) fail("WRONG_PHASE", "Questa azione non è possibile in questo momento");
}
function requireParticipant(ctx: Ctx): ParticipantRow {
  if (!ctx.participant) fail("FORBIDDEN", "Questa azione è riservata ai giocatori");
  return ctx.participant;
}
function memberOf(ctx: Ctx, pid: string): MemberRow | undefined {
  return ctx.members.find((m) => m.participant_id === pid);
}
function activeIds(ctx: Ctx): Set<string> {
  return new Set(ctx.active.map((p) => p.id));
}
function eligible(ctx: Ctx): string[] {
  return eligibleKnowers(ctx.members, activeIds(ctx));
}
function setPhase(ctx: Ctx, phase: PsycoPhase) {
  ctx.room.phase = phase;
  ctx.changed = true;
}
function emit(ctx: Ctx, kind: PsycoEventKind, data?: PsycoEvent["data"]) {
  ctx.event = { kind, at: ctx.room.db_now.toISOString(), ...(data ? { data } : {}) };
  ctx.changed = true;
}
function round(ctx: Ctx): RoundRow {
  if (!ctx.round) fail("WRONG_PHASE", "Nessuna manche in corso");
  return ctx.round;
}
async function reloadRound(ctx: Ctx) {
  ctx.round = await loadRound(ctx.tx, ctx.room.current_round_id);
  ctx.members = ctx.round ? await loadMembers(ctx.tx, ctx.round.id) : [];
}
function timerOf(r: RoundRow): PublicTimer {
  return { totalMs: r.timer_ms, startedAt: r.started_at?.toISOString() ?? null, pausedAt: r.paused_at?.toISOString() ?? null, pausedMs: Number(r.paused_ms) };
}

// ---------------------------------------------------------------------------
// Azioni
// ---------------------------------------------------------------------------
async function apply(ctx: Ctx, a: PsycoAction): Promise<void> {
  const { tx } = ctx;
  switch (a.action) {
    case "tick":
      return; // la scadenza del timer è già stata controllata (checkTimer)

    case "start_game": {
      requireHost(ctx);
      requirePhase(ctx, "LOBBY");
      return newRound(ctx, a.psycoId ?? null);
    }

    case "next_round": {
      requireHost(ctx);
      requirePhase(ctx, "ROUND_END");
      if (a.settings) await saveSettings(ctx, a.settings);
      return newRound(ctx, a.psycoId ?? null);
    }

    case "update_settings": {
      requireHost(ctx);
      requirePhase(ctx, "LOBBY", "ROUND_END");
      return saveSettings(ctx, a.settings);
    }

    case "seen": {
      const p = requireParticipant(ctx);
      requirePhase(ctx, "ROLE_REVEAL");
      const m = memberOf(ctx, p.id);
      if (!m) fail("FORBIDDEN", "Entrerai nella prossima manche");
      if (m.seen_at) return;
      await tx`update psyco_round_members set seen_at = now() where round_id = ${round(ctx).id} and participant_id = ${p.id}`;
      m.seen_at = ctx.room.db_now;
      ctx.changed = true;
      ctx.minorChange = true;
      return advance(ctx, false);
    }

    case "vote": {
      const p = requireParticipant(ctx);
      // votazione già decisa (es. maggioranza raggiunta prima del tuo voto): niente errore di fase
      const v = ctx.round?.vote;
      const voting = ["DIFFICULTY_VOTE", "RULE_VOTE", "PROPOSAL_VOTE", "GUESS_VOTE"].includes(ctx.room.phase);
      if (!voting || !v || v.ballot !== a.ballot) fail("STALE_BALLOT", "Questa votazione è già chiusa");
      const r = round(ctx);
      if (!eligible(ctx).includes(p.id)) fail("FORBIDDEN", "Non puoi votare in questa votazione");
      const options = v.runoff ?? v.options;
      if (!options.includes(a.choice)) fail("VALIDATION", "Scelta non valida");
      const [prev] = await tx<{ choice: string }[]>`
        select choice from psyco_votes where round_id = ${r.id} and ballot = ${v.ballot} and participant_id = ${p.id}`;
      if (prev?.choice === a.choice) return;
      await tx`
        insert into psyco_votes (round_id, ballot, participant_id, choice) values (${r.id}, ${v.ballot}, ${p.id}, ${a.choice})
        on conflict (round_id, ballot, participant_id) do update set choice = excluded.choice, created_at = now()`;
      ctx.changed = true;
      ctx.minorChange = true;
      return advance(ctx, false);
    }

    case "close_vote": {
      requireHost(ctx);
      requirePhase(ctx, "ROLE_REVEAL", "DIFFICULTY_VOTE", "RULE_VOTE", "PROPOSAL_VOTE", "GUESS_VOTE");
      return advance(ctx, true);
    }

    case "propose": {
      const p = requireParticipant(ctx);
      requirePhase(ctx, "RULE_PROPOSALS");
      const r = round(ctx);
      if (!eligible(ctx).includes(p.id)) fail("FORBIDDEN", "Solo chi conosce la regola può proporla");
      const t = checkRuleText(a.text);
      if (!t.ok) fail("VALIDATION", t.message);
      await tx`
        insert into psyco_candidates (round_id, room_id, kind, text, author_participant_id)
        values (${r.id}, ${ctx.room.id}, 'custom', ${t.value}, ${p.id})
        on conflict (round_id, author_participant_id) where kind = 'custom'
        do update set text = excluded.text, updated_at = now()`;
      await tx`delete from psyco_votes where round_id = ${r.id} and ballot = ${passBallot(r)} and participant_id = ${p.id}`;
      ctx.changed = true;
      ctx.secretChanged = true;
      return advance(ctx, false);
    }

    case "pass": {
      const p = requireParticipant(ctx);
      requirePhase(ctx, "RULE_PROPOSALS");
      const r = round(ctx);
      if (!eligible(ctx).includes(p.id)) fail("FORBIDDEN", "Non partecipi alla scelta della regola");
      const [mine] = await tx`select 1 from psyco_candidates where round_id = ${r.id} and kind = 'custom' and author_participant_id = ${p.id}`;
      if (mine) fail("VALIDATION", "Hai già proposto una regola");
      await tx`
        insert into psyco_votes (round_id, ballot, participant_id, choice) values (${r.id}, ${passBallot(r)}, ${p.id}, 'pass')
        on conflict do nothing`;
      ctx.changed = true;
      return advance(ctx, false);
    }

    case "close_proposals": {
      requireHost(ctx);
      requirePhase(ctx, "RULE_PROPOSALS");
      return closeProposals(ctx);
    }

    case "use_archive": {
      requireHost(ctx);
      requirePhase(ctx, "RULE_PROPOSALS");
      const r = round(ctx);
      await tx`update psyco_rounds set rule_mode = 'auto' where id = ${r.id}`;
      r.rule_mode = "auto";
      return openDifficultyVote(ctx);
    }

    case "ready": {
      const p = requireParticipant(ctx);
      requirePhase(ctx, "RULE_CONFIRMED");
      const m = memberOf(ctx, p.id);
      if (!m) fail("FORBIDDEN", "Entrerai nella prossima manche");
      if (m.ready_at) return;
      await tx`update psyco_round_members set ready_at = now() where round_id = ${round(ctx).id} and participant_id = ${p.id}`;
      m.ready_at = ctx.room.db_now;
      ctx.changed = true;
      ctx.minorChange = true;
      return advance(ctx, false);
    }

    case "start_round": {
      requireHost(ctx);
      requirePhase(ctx, "RULE_CONFIRMED");
      return startRound(ctx);
    }

    case "pause": {
      requireHost(ctx);
      requirePhase(ctx, "PLAYING");
      const r = round(ctx);
      if (r.paused_at) return;
      if (!r.started_at || r.started_at.getTime() > ctx.room.db_now.getTime()) fail("WRONG_PHASE", "Aspetta il via");
      await tx`update psyco_rounds set paused_at = now(), paused_by_guess = false where id = ${r.id}`;
      ctx.changed = true;
      return;
    }

    case "resume": {
      requireHost(ctx);
      requirePhase(ctx, "PLAYING");
      const r = round(ctx);
      if (!r.paused_at) return;
      await resumeTimer(ctx);
      return;
    }

    case "guess": {
      requirePhase(ctx, "PLAYING");
      const r = round(ctx);
      // lo PSYCO dal suo telefono, l'host, oppure il dispositivo condiviso
      const isPsyco = ctx.participant?.id === r.psyco_participant_id;
      if (!isPsyco && !ctx.isHost) fail("FORBIDDEN", "Solo lo PSYCO può dire di aver capito");
      if (!r.started_at || r.started_at.getTime() > ctx.room.db_now.getTime()) fail("WRONG_PHASE", "Aspetta il via");
      const attempt = r.attempts + 1;
      await tx`insert into psyco_guesses (round_id, attempt_no) values (${r.id}, ${attempt}) on conflict do nothing`;
      const pauseNow = !r.paused_at;
      const vote: RoundVoteMeta = { kind: "guess", ballot: `guess#${attempt}#1`, options: ["yes", "no"], runoff: null, cycle: 1 };
      await tx`
        update psyco_rounds set attempts = ${attempt}, vote = ${tx.json(vote as never)},
          paused_at = ${pauseNow ? tx`now()` : tx`paused_at`}, paused_by_guess = ${pauseNow}
        where id = ${r.id}`;
      setPhase(ctx, "GUESS_VOTE");
      await reloadRound(ctx);
      return;
    }

    case "end_round": {
      requireHost(ctx);
      requirePhase(ctx, ...ROUND_PHASES);
      return endRound(ctx, "ended");
    }

    case "leave": {
      if (ctx.room.mode === "shared") fail("FORBIDDEN", "Nel dispositivo condiviso i giocatori si tolgono dalla lista");
      const p = ctx.participant;
      if (!p) {
        // host che non gioca: lascia la gestione solo chiudendo la partita
        if (ctx.isHost) return closeRoom(ctx, "host_left");
        return;
      }
      await removeParticipant(ctx, p, "left");
      if (ctx.isHost) await transferHost(ctx, p.id);
      return;
    }

    case "kick": {
      requireHost(ctx);
      if (ctx.room.mode !== "personal") fail("FORBIDDEN", "Azione non disponibile");
      const target = ctx.active.find((x) => x.id === a.participantId);
      if (!target) fail("NOT_FOUND", "Giocatore non trovato");
      if (target.user_id === ctx.actor.userId) fail("VALIDATION", "Per uscire usa «Esci dalla partita»");
      return removeParticipant(ctx, target, "kicked");
    }

    case "claim_host": {
      const p = requireParticipant(ctx);
      if (ctx.room.mode !== "personal" || p.kind !== "account") fail("FORBIDDEN", "Azione non disponibile");
      if (ctx.isHost) return;
      if (ctx.room.db_now.getTime() - ctx.room.host_seen_at.getTime() < HOST_GONE_MS) fail("FORBIDDEN", "Chi gestisce la partita è ancora collegato");
      await tx`update psyco_rooms set host_user_id = ${p.user_id}, host_seen_at = now() where id = ${ctx.room.id}`;
      ctx.room.host_user_id = p.user_id;
      emit(ctx, "host_changed", { nickname: p.nickname });
      return;
    }

    case "close_room": {
      if (!ctx.isHost) fail("FORBIDDEN", "Solo chi gestisce la partita può chiuderla");
      return closeRoom(ctx, "host");
    }

    case "add_local": {
      if (ctx.room.mode !== "shared" || !ctx.isOwner) fail("FORBIDDEN", "Azione non disponibile");
      const n = checkNickname(a.nickname);
      if (!n.ok) fail("VALIDATION", n.message);
      if (ctx.active.some((p) => p.nickname.toLowerCase() === n.value.toLowerCase())) fail("NICKNAME_TAKEN", "C'è già un giocatore con questo nome");
      const [{ seat }] = await tx<{ seat: number }[]>`select coalesce(max(seat), 0) + 1 as seat from psyco_participants where room_id = ${ctx.room.id}`;
      await tx`
        insert into psyco_participants (room_id, kind, owner_user_id, nickname, seat)
        values (${ctx.room.id}, 'local', ${ctx.room.owner_user_id}, ${n.value}, ${seat})`;
      ctx.active = await loadParticipants(tx, ctx.room.id);
      ctx.changed = true;
      return;
    }

    case "remove_local": {
      if (ctx.room.mode !== "shared" || !ctx.isOwner) fail("FORBIDDEN", "Azione non disponibile");
      const target = ctx.active.find((x) => x.id === a.participantId);
      if (!target) fail("NOT_FOUND", "Giocatore non trovato");
      return removeParticipant(ctx, target, "left");
    }
  }
}

// ---------------------------------------------------------------------------
// Manche
// ---------------------------------------------------------------------------
async function saveSettings(ctx: Ctx, s: PsycoSettings) {
  ctx.settings = s;
  await ctx.tx`update psyco_rooms set settings = ${ctx.tx.json(s as never)} where id = ${ctx.room.id}`;
  ctx.changed = true;
}

async function newRound(ctx: Ctx, chosen: string | null) {
  const { tx } = ctx;
  if (ctx.active.length < MIN_PLAYERS) fail("NOT_ENOUGH_PLAYERS", `Servono almeno ${MIN_PLAYERS} giocatori per cominciare`);
  let psycoId: string | null = null;
  if (chosen) {
    if (!ctx.active.some((p) => p.id === chosen)) fail("VALIDATION", "Giocatore non valido per il ruolo di PSYCO");
    psycoId = chosen;
  } else if (ctx.settings.psycoPick === "manual") {
    fail("VALIDATION", "Scegli chi sarà lo PSYCO di questa manche");
  } else {
    psycoId = pickPsyco(ctx.active.map((p) => ({ id: p.id, psycoCount: p.psyco_count, lastPsycoRound: p.last_psyco_round, seat: p.seat })));
  }
  const psyco = ctx.active.find((p) => p.id === psycoId)!;
  const no = ctx.room.round_no + 1;
  const [r] = await tx<{ id: string }[]>`
    insert into psyco_rounds (room_id, round_no, psyco_participant_id, psyco_nickname, rule_mode, timer_ms, participants_count)
    values (${ctx.room.id}, ${no}, ${psyco.id}, ${psyco.nickname}, ${ctx.settings.ruleMode}, ${ctx.settings.timerMs}, ${ctx.active.length})
    returning id`;
  const ids = ctx.active.map((p) => p.id);
  const roles = ctx.active.map((p) => (p.id === psyco.id ? "psyco" : "knower"));
  await tx`
    insert into psyco_round_members (round_id, participant_id, role)
    select ${r.id}, x.pid, x.role from unnest(${tx.array(ids)}::uuid[], ${tx.array(roles)}::text[]) as x(pid, role)`;
  await tx`update psyco_participants set psyco_count = psyco_count + 1, last_psyco_round = ${no} where id = ${psyco.id}`;
  await tx`update psyco_rooms set round_no = ${no}, current_round_id = ${r.id} where id = ${ctx.room.id}`;
  ctx.room.round_no = no;
  ctx.room.current_round_id = r.id;
  ctx.secretChanged = true;
  ctx.event = null;
  setPhase(ctx, "ROLE_REVEAL");
  await reloadRound(ctx);
}

async function openDifficultyVote(ctx: Ctx) {
  const r = round(ctx);
  const vote: RoundVoteMeta = { kind: "difficulty", ballot: `difficulty#${r.round_no}`, options: DIFFICULTY_OPTIONS, runoff: null, cycle: 1 };
  await ctx.tx`update psyco_rounds set vote = ${ctx.tx.json(vote as never)} where id = ${r.id}`;
  setPhase(ctx, "DIFFICULTY_VOTE");
  await reloadRound(ctx);
}

async function openProposals(ctx: Ctx, cycle: number) {
  const r = round(ctx);
  const vote: RoundVoteMeta = { kind: "proposals", ballot: `collect#${cycle}`, options: [], runoff: null, cycle };
  await ctx.tx`update psyco_rounds set vote = ${ctx.tx.json(vote as never)} where id = ${r.id}`;
  setPhase(ctx, "RULE_PROPOSALS");
  await reloadRound(ctx);
}

/** Propone una regola dell'archivio della difficoltà scelta, mai già uscita in questa stanza finché ce ne sono altre. */
async function proposeArchiveRule(ctx: Ctx, difficulty: Difficulty) {
  const { tx } = ctx;
  const r = round(ctx);
  type Pick = { id: string; title: string; description: string; difficulty: Difficulty };
  const tries = [
    () => tx<Pick[]>`
      select id, title, description, difficulty from psyco_rules
      where active and difficulty = ${difficulty}
        and id not in (select rule_id from psyco_candidates where room_id = ${ctx.room.id} and rule_id is not null)
      order by random() limit 1`,
    () => tx<Pick[]>`
      select id, title, description, difficulty from psyco_rules
      where active and difficulty = ${difficulty}
        and id not in (select rule_id from psyco_candidates where round_id = ${r.id} and rule_id is not null)
      order by random() limit 1`,
    () => tx<Pick[]>`
      select id, title, description, difficulty from psyco_rules
      where active and id not in (select rule_id from psyco_candidates where round_id = ${r.id} and rule_id is not null)
      order by random() limit 1`,
    () => tx<Pick[]>`select id, title, description, difficulty from psyco_rules where active order by random() limit 1`,
  ];
  let pick: Pick | undefined;
  for (const t of tries) {
    const rows = await t();
    if (rows[0]) {
      pick = rows[0];
      break;
    }
  }
  if (!pick) {
    // archivio vuoto (tutte disattivate): si passa alla modalità libera, il gioco non si blocca
    await tx`update psyco_rounds set rule_mode = 'free' where id = ${r.id}`;
    r.rule_mode = "free";
    emit(ctx, "no_proposals", { reason: "archivio" });
    return openProposals(ctx, 1);
  }
  const [c] = await tx<{ id: string }[]>`
    insert into psyco_candidates (round_id, room_id, kind, rule_id, title, text)
    values (${r.id}, ${ctx.room.id}, 'archive', ${pick.id}, ${pick.title}, ${pick.description})
    returning id`;
  const n = r.candidates_shown + 1;
  const vote: RoundVoteMeta = { kind: "candidate", ballot: `candidate#${n}`, options: ["yes", "no"], runoff: null, cycle: 1 };
  await tx`update psyco_rounds set candidate_id = ${c.id}, candidates_shown = ${n}, vote = ${tx.json(vote as never)} where id = ${r.id}`;
  ctx.secretChanged = true;
  setPhase(ctx, "RULE_VOTE");
  await reloadRound(ctx);
}

async function confirmRule(ctx: Ctx, candidateId: string) {
  const { tx } = ctx;
  const r = round(ctx);
  const [c] = await tx<{ id: string; kind: "archive" | "custom"; rule_id: string | null; title: string | null; text: string }[]>`
    select id, kind, rule_id, title, text from psyco_candidates where id = ${candidateId} and round_id = ${r.id}`;
  if (!c) fail("NOT_FOUND", "Regola non trovata");
  await tx`update psyco_candidates set status = 'winner', updated_at = now() where id = ${c.id}`;
  await tx`
    update psyco_rounds set rule_source = ${c.kind}, rule_id = ${c.rule_id}, rule_title = ${c.title}, rule_text = ${c.text}, vote = null
    where id = ${r.id}`;
  ctx.secretChanged = true;
  setPhase(ctx, "RULE_CONFIRMED");
  await reloadRound(ctx);
}

async function closeProposals(ctx: Ctx) {
  const { tx } = ctx;
  const r = round(ctx);
  const rows = await tx<{ id: string }[]>`
    select c.id from psyco_candidates c join psyco_participants p on p.id = c.author_participant_id and p.status = 'active'
    where c.round_id = ${r.id} and c.kind = 'custom' order by c.created_at, c.id`;
  if (rows.length === 0) {
    // nessuna proposta: nuovo giro di proposte (oppure l'host passa all'archivio)
    emit(ctx, "no_proposals");
    return openProposals(ctx, (r.vote?.cycle ?? 1) + 1);
  }
  if (rows.length === 1) return confirmRule(ctx, rows[0].id);
  const vote: RoundVoteMeta = { kind: "proposals", ballot: `proposals#1`, options: rows.map((x) => x.id), runoff: null, cycle: 1 };
  await tx`update psyco_rounds set vote = ${tx.json(vote as never)} where id = ${r.id}`;
  ctx.secretChanged = true;
  setPhase(ctx, "PROPOSAL_VOTE");
  await reloadRound(ctx);
}

async function startRound(ctx: Ctx) {
  const r = round(ctx);
  await ctx.tx`
    update psyco_rounds set started_at = now() + make_interval(secs => ${r.countdown_ms / 1000}), paused_at = null, paused_ms = 0, paused_by_guess = false
    where id = ${r.id}`;
  setPhase(ctx, "PLAYING");
  await reloadRound(ctx);
}

async function resumeTimer(ctx: Ctx) {
  const r = round(ctx);
  await ctx.tx`
    update psyco_rounds
    set paused_ms = paused_ms + greatest(0, floor(extract(epoch from (now() - paused_at)) * 1000))::bigint, paused_at = null, paused_by_guess = false
    where id = ${r.id} and paused_at is not null`;
  ctx.changed = true;
  await reloadRound(ctx);
}

async function endRound(ctx: Ctx, outcome: RoundOutcome) {
  const { tx } = ctx;
  const r = round(ctx);
  const elapsed = r.started_at ? Math.round(elapsedMs(timerOf(r), ctx.room.db_now.getTime())) : 0;
  const total = r.timer_ms;
  await tx`
    update psyco_rounds set ended_at = now(), outcome = ${outcome}, elapsed_ms = ${outcome === "time_up" && total ? total : elapsed}, vote = null
    where id = ${r.id}`;
  await tx`update psyco_guesses set resolved_at = now() where round_id = ${r.id} and resolved_at is null`;
  const kind: PsycoEventKind = outcome === "guessed" ? "guess_correct" : outcome === "time_up" ? "time_up" : outcome === "psyco_left" ? "psyco_left" : "round_ended";
  emit(ctx, kind, { psyco: r.psyco_nickname });
  ctx.secretChanged = true;
  setPhase(ctx, "ROUND_END");
  await reloadRound(ctx);
}

async function closeRoom(ctx: Ctx, reason: string) {
  await ctx.tx`update psyco_rooms set status = 'closed', closed_at = now(), close_reason = ${reason} where id = ${ctx.room.id}`;
  ctx.room.status = "closed";
  if (ctx.round && ROUND_PHASES.includes(ctx.room.phase)) await endRound(ctx, "ended");
  ctx.changed = true;
}

async function removeParticipant(ctx: Ctx, p: ParticipantRow, status: "left" | "kicked") {
  await ctx.tx`update psyco_participants set status = ${status}, left_at = now() where id = ${p.id}`;
  ctx.active = ctx.active.filter((x) => x.id !== p.id);
  if (ctx.participant?.id === p.id) ctx.participant = null;
  ctx.changed = true;
}

/** L'host lascia la stanza: la gestione passa al giocatore con account entrato prima. */
async function transferHost(ctx: Ctx, leavingId: string) {
  const next = ctx.active.filter((p) => p.kind === "account" && p.id !== leavingId).sort((a, b) => a.seat - b.seat)[0];
  if (!next) return closeRoom(ctx, "host_left");
  await ctx.tx`update psyco_rooms set host_user_id = ${next.user_id}, host_seen_at = now() where id = ${ctx.room.id}`;
  ctx.room.host_user_id = next.user_id;
  ctx.isHost = false;
  emit(ctx, "host_changed", { nickname: next.nickname });
}

// ---------------------------------------------------------------------------
// Avanzamento automatico (votazioni complete, tutti pronti…) e controlli
// ---------------------------------------------------------------------------
async function advance(ctx: Ctx, forced: boolean): Promise<void> {
  const { tx } = ctx;
  const r = ctx.round;
  if (!r) return;
  const act = activeIds(ctx);
  const voters = eligible(ctx);

  switch (ctx.room.phase) {
    case "ROLE_REVEAL": {
      const pending = ctx.members.filter((m) => act.has(m.participant_id) && !m.seen_at);
      if (!forced && pending.length > 0) return;
      ctx.minorChange = false;
      return r.rule_mode === "auto" ? openDifficultyVote(ctx) : openProposals(ctx, 1);
    }
    case "RULE_CONFIRMED": {
      const pending = ctx.members.filter((m) => act.has(m.participant_id) && !m.ready_at);
      if (pending.length > 0) return;
      return startRound(ctx);
    }
    case "RULE_PROPOSALS": {
      const [{ n }] = await tx<{ n: number }[]>`
        select count(*)::int as n from (
          select author_participant_id as pid from psyco_candidates where round_id = ${r.id} and kind = 'custom'
          union select participant_id from psyco_votes where round_id = ${r.id} and ballot = ${passBallot(r)}
        ) x where x.pid = any(${tx.array(voters)}::uuid[])`;
      if (n < voters.length) return;
      return closeProposals(ctx);
    }
    case "DIFFICULTY_VOTE":
    case "RULE_VOTE":
    case "PROPOSAL_VOTE":
    case "GUESS_VOTE":
      break;
    default:
      return;
  }

  const v = r.vote;
  if (!v) return;
  const votes = await loadBallot(tx, r.id, v.ballot);
  const tally: Record<string, number> = {};
  for (const x of votes) tally[x.choice] = (tally[x.choice] ?? 0) + 1;
  const complete = forced || votes.length >= voters.length;

  if (ctx.room.phase === "DIFFICULTY_VOTE") {
    const res = resolvePlurality(tally, v.options, voters.length, complete);
    if (!res) return;
    ctx.minorChange = false;
    let choice = "winner" in res ? res.winner : drawOne(res.tie);
    if ("tie" in res) emit(ctx, "draw", { what: "difficoltà" });
    if (choice === "sorpresa") choice = drawOne(DIFFICULTIES);
    await tx`update psyco_rounds set difficulty = ${choice} where id = ${r.id}`;
    r.difficulty = choice as Difficulty;
    return proposeArchiveRule(ctx, choice as Difficulty);
  }

  if (ctx.room.phase === "RULE_VOTE") {
    const res = resolveYesNo(tally.yes ?? 0, tally.no ?? 0, voters.length, complete);
    if (!res) return;
    ctx.minorChange = false;
    if (res === "yes") return confirmRule(ctx, r.candidate_id!);
    // bocciata (o parità: nessun consenso) → un'altra regola, nuova votazione
    if (r.candidate_id) await tx`update psyco_candidates set status = 'rejected', updated_at = now() where id = ${r.candidate_id}`;
    emit(ctx, "rule_rejected");
    return proposeArchiveRule(ctx, r.difficulty ?? drawOne(DIFFICULTIES));
  }

  if (ctx.room.phase === "PROPOSAL_VOTE") {
    const options = v.runoff ?? v.options;
    const res = resolvePlurality(tally, options, voters.length, complete);
    if (!res) return;
    ctx.minorChange = false;
    if ("winner" in res) return confirmRule(ctx, res.winner);
    if (!v.runoff) {
      // parità: spareggio tra le proposte pari merito
      const next: RoundVoteMeta = { kind: "proposals", ballot: `proposals#${v.cycle + 1}`, options: v.options, runoff: res.tie, cycle: v.cycle + 1 };
      await tx`update psyco_rounds set vote = ${tx.json(next as never)} where id = ${r.id}`;
      emit(ctx, "runoff", { what: "proposte" });
      ctx.secretChanged = true;
      await reloadRound(ctx);
      return;
    }
    // parità anche allo spareggio: sorteggio trasparente tra le pari merito
    emit(ctx, "draw", { what: "proposte" });
    return confirmRule(ctx, drawOne(res.tie));
  }

  if (ctx.room.phase === "GUESS_VOTE") {
    const res = resolveYesNo(tally.yes ?? 0, tally.no ?? 0, voters.length, complete);
    if (!res) return;
    ctx.minorChange = false;
    const attempt = r.attempts;
    if (res === "tie" && v.cycle === 1) {
      const next: RoundVoteMeta = { ...v, ballot: `guess#${attempt}#2`, cycle: 2 };
      await tx`update psyco_rounds set vote = ${tx.json(next as never)} where id = ${r.id}`;
      emit(ctx, "runoff", { what: "tentativo" });
      await reloadRound(ctx);
      return;
    }
    const correct = res === "yes";
    await tx`
      update psyco_guesses set resolved_at = now(), result = ${correct ? "correct" : "wrong"}, yes_votes = ${tally.yes ?? 0}, no_votes = ${tally.no ?? 0}
      where round_id = ${r.id} and attempt_no = ${attempt}`;
    if (correct) return endRound(ctx, "guessed");
    // sbagliato: si riprende da dove si era (il timer riparte dal tempo residuo)
    await tx`update psyco_rounds set vote = null where id = ${r.id}`;
    if (r.paused_by_guess) await resumeTimer(ctx);
    emit(ctx, "guess_wrong", { psyco: r.psyco_nickname });
    setPhase(ctx, "PLAYING");
    await reloadRound(ctx);
  }
}

/** Timer scaduto (controllo "pigro" a ogni azione e lettura): la manche finisce, vince il gruppo. */
async function checkTimer(ctx: Ctx) {
  const r = ctx.round;
  if (!r || ctx.room.phase !== "PLAYING") return;
  if (isExpired(timerOf(r), ctx.room.db_now.getTime())) await endRound(ctx, "time_up");
}

/** Dopo uscite ed espulsioni: lo PSYCO se n'è andato? Non è rimasto nessuno che conosce la regola? */
async function checkRoundIntegrity(ctx: Ctx) {
  const r = ctx.round;
  if (!r || !ROUND_PHASES.includes(ctx.room.phase) || ctx.room.status === "closed") return;
  const act = activeIds(ctx);
  if (r.psyco_participant_id && !act.has(r.psyco_participant_id)) return endRound(ctx, "psyco_left");
  if (eligible(ctx).length === 0) return endRound(ctx, "ended");
  // qualcuno è uscito durante una votazione o un'attesa: forse ora è completa
  if (ctx.changed) await advance(ctx, false);
}

async function commit(ctx: Ctx): Promise<ActionResult> {
  const { tx, room } = ctx;
  if (!ctx.changed) return { state: await buildPublicStateFrom(tx, room), changed: false };
  const throttle =
    ctx.minorChange && ctx.active.length > BIG_ROOM && !!room.broadcast_at && room.db_now.getTime() - room.broadcast_at.getTime() < 1500;
  const [u] = await tx<{ version: number; secret_rev: number }[]>`
    update psyco_rooms set
      phase = ${room.phase},
      version = version + 1,
      secret_rev = secret_rev + ${ctx.secretChanged ? 1 : 0},
      event = ${ctx.event === undefined ? tx`event` : ctx.event === null ? null : tx.json(ctx.event as never)},
      updated_at = now(),
      last_activity_at = now(),
      broadcast_at = ${throttle ? tx`broadcast_at` : tx`now()`}
      ${ctx.isHost && !ctx.system ? tx`, host_seen_at = now()` : tx``}
    where id = ${room.id}
    returning version, secret_rev`;
  room.version = u.version;
  room.secret_rev = u.secret_rev;
  if (ctx.event !== undefined) room.event = ctx.event;
  if (throttle) return { state: null, changed: true };
  const fresh = (await loadRoom(tx, room.id))!;
  const state = await buildPublicStateFrom(tx, fresh);
  await broadcastPsyco(tx, state);
  return { state, changed: true };
}
