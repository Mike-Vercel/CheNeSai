import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { getSql, iso, type Db } from "@/lib/database/db";
import { checkNickname, isExpired, isRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/lib/psyco/logic";
import { createRoomSchema, type PsycoAction, type PsycoPhase, type PsycoPublicState, type PsycoView, type RoomMode } from "@/lib/psyco/types";
import { checkRateLimit } from "@/lib/server/players";
import { runAction, SYSTEM_ACTOR } from "./engine";
import { PsycoError } from "./errors";
import { broadcastPsyco } from "./realtime";
import { buildPrivateView, buildPublicStateFrom, loadRoom, type ParticipantRow, type RoomRow } from "./state";

/**
 * Stanze PSYCO: creazione, ingresso con codice/QR, lettura dello stato (pubblico + privato), schermo TV.
 *
 * Autenticazione (riuso dell'account del sito, nessun secondo login):
 *  - chi crea è SEMPRE un utente registrato;
 *  - dispositivi personali: ogni partecipante è un account (un solo posto per account e stanza);
 *  - dispositivo condiviso: i partecipanti sono nickname locali posseduti dall'account che ha creato
 *    la stanza (nessun account finto); la stanza NON accetta ingressi da altri dispositivi;
 *  - schermo TV/PC: nessun account, legge solo lo stato pubblico con una chiave lunga e casuale.
 */

export interface PsycoUser {
  userId: string;
  ip: string | null;
  /** username del sito (nickname proposto) */
  username: string | null;
}

export const CREATE_LIMITS = { perUser: { limit: 10, windowSeconds: 600 }, perIp: { limit: 40, windowSeconds: 3600 } };
export const JOIN_LIMITS = { perUser: { limit: 40, windowSeconds: 600 }, perIp: { limit: 120, windowSeconds: 600 } };
/** Stanze senza attività da 24 ore: chiuse (pigramente e dal cron giornaliero). */
export const STALE_HOURS = 24;
/** Battito dei partecipanti/host/schermo scritto al massimo ogni 15 s. */
const HEARTBEAT_MS = 15_000;
const UUID = /^[0-9a-f-]{36}$/i;

function newCode(): string {
  let s = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) s += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
  return s;
}

async function limit(bucket: string, l: { limit: number; windowSeconds: number }, message: string) {
  if (!(await checkRateLimit(getSql(), bucket, l.limit, l.windowSeconds))) throw new PsycoError("RATE_LIMITED", message);
}

// ---------------------------------------------------------------------------
// Creazione
// ---------------------------------------------------------------------------
export async function createRoom(user: PsycoUser, raw: unknown): Promise<{ roomId: string; code: string; mode: RoomMode }> {
  const parsed = createRoomSchema.safeParse(raw);
  if (!parsed.success) throw new PsycoError("VALIDATION", parsed.error.issues[0]?.message ?? "Impostazioni non valide", parsed.error.issues);
  const input = parsed.data;

  // nickname del dispositivo condiviso: validi e senza doppioni
  const locals: string[] = [];
  if (input.mode === "shared") {
    const seen = new Set<string>();
    for (const n of input.nicknames ?? []) {
      if (!String(n ?? "").trim()) continue;
      const c = checkNickname(n);
      if (!c.ok) throw new PsycoError("VALIDATION", c.message);
      const key = c.value.toLowerCase();
      if (seen.has(key)) throw new PsycoError("NICKNAME_TAKEN", `Il nome «${c.value}» è ripetuto: ognuno deve avere un nome diverso`);
      seen.add(key);
      locals.push(c.value);
    }
  }
  let hostNick: string | null = null;
  if (input.mode === "personal" && input.hostPlays !== false) {
    const c = checkNickname(input.hostNickname || user.username || "Host");
    if (!c.ok) throw new PsycoError("VALIDATION", c.message);
    hostNick = c.value;
  }

  await limit(`psyco-create:${user.userId}`, CREATE_LIMITS.perUser, "Hai creato troppe partite di fila: riprova tra qualche minuto");
  if (user.ip) await limit(`psyco-create-ip:${user.ip}`, CREATE_LIMITS.perIp, "Troppe partite create da questa rete: riprova più tardi");
  // pulizia pigra: le stanze abbandonate di questo account
  await closeStaleRooms({ userId: user.userId }).catch(() => undefined);

  const sql = getSql();
  for (let i = 0; i < 8; i++) {
    const code = newCode();
    try {
      return await sql.begin(async (tx) => {
        const [room] = await tx<{ id: string }[]>`
          insert into psyco_rooms (code, display_key, mode, owner_user_id, host_user_id, settings, screen_mode)
          values (${code}, ${randomBytes(24).toString("base64url")}, ${input.mode}, ${user.userId}, ${user.userId}, ${tx.json(input.settings as never)},
            ${input.mode === "personal" && input.screen === true})
          returning id`;
        if (input.mode === "shared" && locals.length > 0) {
          const seats = locals.map((_, i) => i + 1);
          await tx`
            insert into psyco_participants (room_id, kind, owner_user_id, nickname, seat)
            select ${room.id}, 'local', ${user.userId}, x.nick, x.seat from unnest(${tx.array(locals)}::text[], ${tx.array(seats)}::int[]) as x(nick, seat)`;
        }
        if (hostNick) {
          await tx`insert into psyco_participants (room_id, kind, user_id, nickname, seat) values (${room.id}, 'account', ${user.userId}, ${hostNick}, 1)`;
        }
        return { roomId: room.id, code, mode: input.mode };
      });
    } catch (e) {
      if ((e as { code?: string; constraint_name?: string }).code === "23505" && String((e as { constraint_name?: string }).constraint_name ?? "").includes("code")) continue;
      throw e;
    }
  }
  throw new PsycoError("BUSY", "Non riesco a generare un codice: riprova");
}

// ---------------------------------------------------------------------------
// Ingresso con codice / QR (solo dispositivi personali, solo account)
// ---------------------------------------------------------------------------
export interface RoomPreview {
  roomId: string;
  code: string;
  mode: RoomMode;
  phase: PsycoPhase;
  status: "open" | "closed";
  activeCount: number;
  hostNickname: string | null;
  /** stato di questo account nella stanza */
  member: "active" | "left" | "kicked" | null;
  memberNickname: string | null;
}

async function findByCode(db: Db, rawCode: string): Promise<RoomRow | null> {
  const code = normalizeRoomCode(rawCode);
  if (!isRoomCode(code)) return null;
  const [r] = await db<RoomRow[]>`select r.*, now() as db_now from psyco_rooms r where r.code = ${code}`;
  return r ?? null;
}

export async function previewRoom(user: PsycoUser, rawCode: string): Promise<RoomPreview> {
  await limit(`psyco-join:${user.userId}`, JOIN_LIMITS.perUser, "Troppi codici provati: aspetta qualche minuto");
  if (user.ip) await limit(`psyco-join-ip:${user.ip}`, JOIN_LIMITS.perIp, "Troppi codici provati da questa rete: aspetta qualche minuto");
  const sql = getSql();
  const room = await findByCode(sql, rawCode);
  if (!room) throw new PsycoError("NOT_FOUND", "Codice non valido: controlla le lettere sullo schermo");
  const [[count], [host], [me]] = await Promise.all([
    sql<{ n: number }[]>`select count(*)::int as n from psyco_participants where room_id = ${room.id} and status = 'active'`,
    sql<{ nickname: string }[]>`select nickname from psyco_participants where room_id = ${room.id} and user_id = ${room.host_user_id} and status = 'active'`,
    sql<{ status: "active" | "left" | "kicked"; nickname: string }[]>`select status, nickname from psyco_participants where room_id = ${room.id} and user_id = ${user.userId}`,
  ]);
  return {
    roomId: room.id,
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    status: room.status,
    activeCount: count.n,
    hostNickname: host?.nickname ?? null,
    member: me?.status ?? null,
    memberNickname: me?.nickname ?? null,
  };
}

export async function joinRoom(user: PsycoUser, rawCode: string, rawNickname: string): Promise<{ roomId: string }> {
  await limit(`psyco-join:${user.userId}`, JOIN_LIMITS.perUser, "Troppi tentativi: aspetta qualche minuto");
  if (user.ip) await limit(`psyco-join-ip:${user.ip}`, JOIN_LIMITS.perIp, "Troppi tentativi da questa rete: aspetta qualche minuto");
  const nick = checkNickname(rawNickname);
  if (!nick.ok) throw new PsycoError("VALIDATION", nick.message);
  const sql = getSql();
  const found = await findByCode(sql, rawCode);
  if (!found) throw new PsycoError("NOT_FOUND", "Codice non valido: controlla le lettere sullo schermo");
  if (found.status === "closed") throw new PsycoError("ROOM_CLOSED", "Questa partita è terminata");
  if (found.mode === "shared") throw new PsycoError("SHARED_ROOM", "Questa partita si gioca su un solo dispositivo: non serve entrare dal telefono");
  try {
    return await sql.begin(async (tx) => {
      await tx`select set_config('lock_timeout', '4s', true), set_config('statement_timeout', '10s', true)`;
      const room = (await loadRoom(tx, found.id, true))!;
      if (room.status === "closed") throw new PsycoError("ROOM_CLOSED", "Questa partita è terminata");
      const [me] = await tx<ParticipantRow[]>`select * from psyco_participants where room_id = ${room.id} and user_id = ${user.userId}`;
      if (me?.status === "kicked") throw new PsycoError("KICKED", "Sei stato tolto da questa partita");
      if (me?.status === "active") return { roomId: room.id };
      const [clash] = await tx`
        select 1 from psyco_participants where room_id = ${room.id} and status = 'active' and lower(nickname) = lower(${nick.value})
          and (user_id is distinct from ${user.userId})`;
      if (clash) throw new PsycoError("NICKNAME_TAKEN", "C'è già un giocatore con questo nickname: scegline un altro");
      if (me) {
        // rientro dopo un'uscita: stesso posto, nuovo nickname se cambiato
        await tx`update psyco_participants set status = 'active', nickname = ${nick.value}, left_at = null, last_seen_at = now() where id = ${me.id}`;
      } else {
        const [{ seat }] = await tx<{ seat: number }[]>`select coalesce(max(seat), 0) + 1 as seat from psyco_participants where room_id = ${room.id}`;
        await tx`insert into psyco_participants (room_id, kind, user_id, nickname, seat) values (${room.id}, 'account', ${user.userId}, ${nick.value}, ${seat})`;
      }
      await tx`update psyco_rooms set version = version + 1, updated_at = now(), last_activity_at = now(), broadcast_at = now() where id = ${room.id}`;
      const fresh = (await loadRoom(tx, room.id))!;
      await broadcastPsyco(tx, await buildPublicStateFrom(tx, fresh));
      return { roomId: room.id };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new PsycoError("NICKNAME_TAKEN", "C'è già un giocatore con questo nickname: scegline un altro");
    const code = (e as { code?: string }).code;
    if (code === "55P03" || code === "57014") throw new PsycoError("BUSY", "Troppe richieste nello stesso momento: riprova");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Lettura dello stato
// ---------------------------------------------------------------------------
/** Timer scaduto senza che nessuno abbia ancora agito: chiude la manche (idempotente). */
async function settleTimer(room: RoomRow): Promise<boolean> {
  if (room.phase !== "PLAYING" || !room.current_round_id) return false;
  const [r] = await getSql()<{ timer_ms: number | null; started_at: Date | null; paused_at: Date | null; paused_ms: number }[]>`
    select timer_ms, started_at, paused_at, paused_ms from psyco_rounds where id = ${room.current_round_id}`;
  if (!r) return false;
  const expired = isExpired(
    { totalMs: r.timer_ms, startedAt: iso(r.started_at), pausedAt: iso(r.paused_at), pausedMs: Number(r.paused_ms) },
    room.db_now.getTime(),
  );
  if (!expired) return false;
  await runAction(room.id, SYSTEM_ACTOR, { action: "tick" }).catch(() => undefined);
  return true;
}

/**
 * Stato per l'utente autenticato: pubblico + vista privata.
 * `asParticipantId` (solo dispositivo condiviso, solo il proprietario): la vista del giocatore locale
 * che ha in mano il telefono in questo momento («SONO LUCA — MOSTRA IL MIO RUOLO»).
 */
export async function getRoomView(user: PsycoUser, roomId: string, asParticipantId: string | null = null): Promise<PsycoView> {
  if (!UUID.test(roomId)) throw new PsycoError("NOT_FOUND", "Stanza non trovata");
  if (asParticipantId && !UUID.test(asParticipantId)) throw new PsycoError("NOT_FOUND", "Giocatore non trovato");
  const sql = getSql();
  let room = await loadRoom(sql, roomId);
  if (!room) throw new PsycoError("NOT_FOUND", "Stanza non trovata");
  const isOwner = room.owner_user_id === user.userId;
  let participant: ParticipantRow | null = null;
  if (room.mode === "shared") {
    if (!isOwner) throw new PsycoError("NOT_MEMBER", "Questa partita si gioca sul dispositivo di chi l'ha creata");
    if (asParticipantId) {
      const [p] = await sql<ParticipantRow[]>`
        select * from psyco_participants where id = ${asParticipantId} and room_id = ${roomId} and kind = 'local' and status = 'active'`;
      if (!p) throw new PsycoError("NOT_FOUND", "Giocatore non trovato");
      participant = p;
    }
  } else {
    const [p] = await sql<ParticipantRow[]>`select * from psyco_participants where room_id = ${roomId} and user_id = ${user.userId}`;
    if (p?.status === "kicked") throw new PsycoError("KICKED", "Sei stato tolto da questa partita");
    participant = p?.status === "active" ? p : null;
    if (!participant && room.host_user_id !== user.userId) {
      throw new PsycoError("NOT_MEMBER", p ? "Sei uscito da questa partita: rientra con il codice" : "Non fai parte di questa partita");
    }
  }
  const isHost = room.mode === "shared" ? isOwner : room.host_user_id === user.userId;

  if (room.status === "open" && (await settleTimer(room))) room = (await loadRoom(sql, roomId))!;
  // battito (al massimo ogni 15 s): presenza in lobby, host collegato
  const nowMs = room.db_now.getTime();
  if (room.status === "open") {
    if (participant && participant.kind === "account" && nowMs - participant.last_seen_at.getTime() > HEARTBEAT_MS) {
      await sql`update psyco_participants set last_seen_at = now() where id = ${participant.id}`;
      participant.last_seen_at = room.db_now;
    }
    if (isHost && nowMs - room.host_seen_at.getTime() > HEARTBEAT_MS) {
      await sql`update psyco_rooms set host_seen_at = now() where id = ${roomId}`;
      room.host_seen_at = room.db_now;
    }
  }
  const [state, view] = await Promise.all([buildPublicStateFrom(sql, room), buildPrivateView(sql, room, participant, { isHost, isOwner })]);
  return { state, view };
}

/** Schermo pubblico (TV/PC): nessun account, chiave lunga e casuale, SOLO stato pubblico. */
export async function getDisplayState(displayKey: string): Promise<PsycoPublicState> {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(displayKey)) throw new PsycoError("NOT_FOUND", "Schermo non valido");
  const sql = getSql();
  const [found] = await sql<{ id: string }[]>`select id from psyco_rooms where display_key = ${displayKey}`;
  if (!found) throw new PsycoError("NOT_FOUND", "Schermo non valido");
  let room = (await loadRoom(sql, found.id))!;
  if (room.status === "open" && (await settleTimer(room))) room = (await loadRoom(sql, found.id))!;
  if (room.status === "open" && (!room.display_seen_at || room.db_now.getTime() - room.display_seen_at.getTime() > HEARTBEAT_MS)) {
    await sql`update psyco_rooms set display_seen_at = now() where id = ${room.id}`;
    room.display_seen_at = room.db_now;
  }
  return buildPublicStateFrom(sql, room);
}

// ---------------------------------------------------------------------------
// PC come SCHERMO PUBBLICO con i comandi di chi gestisce la partita
// ---------------------------------------------------------------------------
/**
 * Comandi che lo schermo pubblico può dare (solo se chi lo guarda è l'host autenticato): NESSUNO
 * rivela qualcosa. Niente scelta manuale dello PSYCO, niente impostazioni, niente voti, niente
 * «HO CAPITO»: quelli si danno dal telefono. Lo schermo resta un NON-partecipante.
 */
export const SCREEN_ACTIONS = ["start_game", "start_round", "pause", "resume", "next_round"] as const;
export type ScreenAction = (typeof SCREEN_ACTIONS)[number];
const screenActionSchema = z.object({ action: z.enum(SCREEN_ACTIONS) });

async function roomIdByDisplayKey(displayKey: string): Promise<{ id: string; host_user_id: string | null; screen_mode: boolean | null }> {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(displayKey)) throw new PsycoError("NOT_FOUND", "Schermo non valido");
  const [found] = await getSql()<{ id: string; host_user_id: string | null; screen_mode: boolean | null }[]>`
    select id, host_user_id, screen_mode from psyco_rooms where display_key = ${displayKey}`;
  if (!found) throw new PsycoError("NOT_FOUND", "Schermo non valido");
  return found;
}

/**
 * Chi sta guardando lo schermo è l'host della stanza? (per mostrare i comandi). Solo un sì/no:
 * mai ruolo, regola o vista privata, nemmeno se l'host gioca ed è lo PSYCO.
 */
export async function screenControl(user: PsycoUser | null, displayKey: string): Promise<{ host: boolean; screenMode: boolean }> {
  const room = await roomIdByDisplayKey(displayKey);
  return { host: !!user && room.host_user_id === user.userId, screenMode: !!room.screen_mode };
}

/** Comando dato dallo schermo pubblico (host autenticato): risponde SOLO con lo stato pubblico. */
export async function runScreenAction(user: PsycoUser, displayKey: string, raw: unknown): Promise<PsycoPublicState> {
  const parsed = screenActionSchema.safeParse(raw);
  if (!parsed.success) throw new PsycoError("FORBIDDEN", "Questo comando si dà dal telefono");
  const room = await roomIdByDisplayKey(displayKey);
  if (room.host_user_id !== user.userId) throw new PsycoError("FORBIDDEN", "Solo chi gestisce la partita può dare comandi dallo schermo");
  // si ricostruisce l'azione da zero: niente psycoId, impostazioni o altri campi arrivati dal client
  await runAction(room.id, { userId: user.userId, ip: user.ip }, { action: parsed.data.action } as PsycoAction);
  return getDisplayState(displayKey);
}

/** Chiave dello schermo: solo per chi gestisce la stanza (host o proprietario). */
export async function getDisplayKey(user: PsycoUser, roomId: string): Promise<string> {
  if (!UUID.test(roomId)) throw new PsycoError("NOT_FOUND", "Stanza non trovata");
  const [r] = await getSql()<{ display_key: string }[]>`
    select display_key from psyco_rooms where id = ${roomId} and host_user_id = ${user.userId}`;
  if (!r) throw new PsycoError("FORBIDDEN", "Solo chi gestisce la partita può aprire lo schermo");
  return r.display_key;
}

// ---------------------------------------------------------------------------
// Partite dell'account (per «Riprendi» nella home del gioco)
// ---------------------------------------------------------------------------
export interface MyRoom {
  roomId: string;
  code: string;
  mode: RoomMode;
  phase: PsycoPhase;
  players: number;
  roundNo: number;
  isOwner: boolean;
  /** gestisce la partita (può aprire lo schermo pubblico) */
  isHost: boolean;
  /** creata da un PC come schermo pubblico */
  screen: boolean;
  updatedAt: string;
}

export async function listMyRooms(userId: string, limitN = 5): Promise<MyRoom[]> {
  const rows = await getSql()<{ id: string; code: string; mode: RoomMode; phase: PsycoPhase; round_no: number; owner_user_id: string; host_user_id: string | null; screen_mode: boolean | null; last_activity_at: Date; players: number }[]>`
    select r.id, r.code, r.mode, r.phase, r.round_no, r.owner_user_id, r.host_user_id, r.screen_mode, r.last_activity_at,
      (select count(*)::int from psyco_participants x where x.room_id = r.id and x.status = 'active') as players
    from psyco_rooms r
    where r.status = 'open' and r.last_activity_at > now() - make_interval(hours => ${STALE_HOURS})
      and (r.owner_user_id = ${userId} or r.host_user_id = ${userId}
           or exists (select 1 from psyco_participants p where p.room_id = r.id and p.user_id = ${userId} and p.status = 'active'))
    order by r.last_activity_at desc limit ${limitN}`;
  return rows.map((r) => ({
    roomId: r.id,
    code: r.code,
    mode: r.mode,
    phase: r.phase,
    players: r.players,
    roundNo: r.round_no,
    isOwner: r.owner_user_id === userId,
    isHost: r.host_user_id === userId,
    screen: !!r.screen_mode,
    updatedAt: iso(r.last_activity_at)!,
  }));
}

// ---------------------------------------------------------------------------
// Pulizia delle stanze inattive (pigra + cron giornaliero di Vercel)
// ---------------------------------------------------------------------------
export async function closeStaleRooms(f: { userId?: string; olderThanHours?: number; limit?: number } = {}): Promise<number> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    update psyco_rooms set status = 'closed', closed_at = now(), close_reason = 'inactive', version = version + 1
    where id in (
      select id from psyco_rooms
      where status = 'open' and last_activity_at < now() - make_interval(hours => ${f.olderThanHours ?? STALE_HOURS})
        ${f.userId ? sql`and owner_user_id = ${f.userId}` : sql``}
      order by last_activity_at limit ${f.limit ?? 200}
    )
    returning id`;
  return rows.length;
}

// ---------------------------------------------------------------------------
// TV abbinato col codice di 4 cifre di /tv (riuso di tv_pairings)
// ---------------------------------------------------------------------------
export async function claimTvForRoom(user: PsycoUser, roomId: string, rawCode: string): Promise<{ ok: true }> {
  const code = String(rawCode ?? "").trim();
  await limit(`tv-claim:${user.userId}`, { limit: 10, windowSeconds: 600 }, "Troppi codici provati: aspetta qualche minuto e riprova");
  if (user.ip) await limit(`tv-claim-ip:${user.ip}`, { limit: 30, windowSeconds: 600 }, "Troppi codici provati da questa rete: riprova tra qualche minuto");
  await getDisplayKey(user, roomId); // solo chi gestisce la stanza
  if (!/^[0-9]{4}$/.test(code)) throw new PsycoError("VALIDATION", "Il codice del TV è di 4 cifre");
  const [r] = await getSql()<{ id: string }[]>`
    update tv_pairings
    set status = 'claimed', psyco_room_id = ${roomId}, claimed_by = ${user.userId}, claimed_at = now(), expires_at = now() + interval '2 minutes'
    where code = ${code} and status = 'waiting' and expires_at > now()
    returning id`;
  if (!r) throw new PsycoError("NOT_FOUND", "Codice non valido o scaduto: controlla il numero sul televisore");
  return { ok: true };
}
