import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { getSql, iso, type Db } from "@/lib/database/db";
import { checkNickname, checkTeamName, isRoomCode, normalizeRoomCode } from "@/lib/giramente/rules";
import {
  createRoomSchema,
  MAX_PLAYERS,
  MAX_TEAM_MEMBERS,
  MIN_PLAYERS,
  MIN_TEAM_MEMBERS,
  MIN_TEAMS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  settingsSchema,
  type DeviceMode,
  type GameMode,
  type GiramenteView,
  type Phase,
  type PublicState,
} from "@/lib/giramente/types";
import { checkRateLimit } from "@/lib/server/players";
import type { GiramenteUser } from "./auth";
import { runAction, SYSTEM_ACTOR } from "./engine";
import { GiramenteError } from "./errors";
import { broadcastGiramente } from "./realtime";
import { buildPrivateView, buildPublicStateFrom, loadRoom, type ParticipantRow, type RoomRow } from "./state";

/**
 * Partite GIRAMENTE!: creazione, ingresso con codice/QR/link, lettura dello stato, schermo TV.
 *
 * Regole degli account (come PSYCO):
 *  - chi crea è SEMPRE un utente registrato;
 *  - un dispositivo a testa: ogni partecipante entra col PROPRIO account (un posto per account);
 *  - un solo dispositivo: un account (chi crea) e i nomi degli altri; la stanza non accetta ingressi;
 *  - schermo TV/PC: nessun account, solo stato pubblico con una chiave lunga e casuale.
 * Lo stesso account funziona dal PC e dal telefono (stessa sessione del sito).
 */

export const CREATE_LIMITS = { perUser: { limit: 10, windowSeconds: 600 }, perIp: { limit: 40, windowSeconds: 3600 } };
export const JOIN_LIMITS = { perUser: { limit: 40, windowSeconds: 600 }, perIp: { limit: 120, windowSeconds: 600 } };
export const STALE_HOURS = 24;
const HEARTBEAT_MS = 15_000;
const UUID = /^[0-9a-f-]{36}$/i;

function newCode(): string {
  let s = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) s += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
  return s;
}

async function limit(bucket: string, l: { limit: number; windowSeconds: number }, message: string) {
  if (!(await checkRateLimit(getSql(), bucket, l.limit, l.windowSeconds))) throw new GiramenteError("RATE_LIMITED", message);
}

function uniqueNames(list: string[], what: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (!String(raw ?? "").trim()) continue;
    const c = what === "squadra" ? checkTeamName(raw) : checkNickname(raw);
    if (!c.ok) throw new GiramenteError("VALIDATION", c.message);
    const key = c.value.toLowerCase();
    if (seen.has(key)) throw new GiramenteError("NICKNAME_TAKEN", `Il nome «${c.value}» è ripetuto: ognuno deve avere un nome diverso`);
    seen.add(key);
    out.push(c.value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Creazione
// ---------------------------------------------------------------------------
export async function createRoom(user: GiramenteUser, raw: unknown): Promise<{ roomId: string; code: string; devices: DeviceMode }> {
  const parsed = createRoomSchema.safeParse(raw);
  if (!parsed.success) throw new GiramenteError("VALIDATION", parsed.error.issues[0]?.message ?? "Impostazioni non valide", parsed.error.issues);
  const input = parsed.data;
  const settings = settingsSchema.parse(input.settings ?? {});

  // concorrenti iniziali
  let players: string[] = [];
  let teams: { name: string; members: string[] }[] = [];
  if (input.mode === "teams") {
    const given = (input.teams ?? []).filter((t) => String(t.name ?? "").trim());
    uniqueNames(given.map((t) => t.name), "squadra"); // nomi validi e senza doppioni
    teams = given.map((t) => {
      const c = checkTeamName(t.name);
      if (!c.ok) throw new GiramenteError("VALIDATION", c.message);
      return { name: c.value, members: input.devices === "shared" ? uniqueNames(t.members ?? [], "giocatore") : [] };
    });
    if (teams.length < MIN_TEAMS) throw new GiramenteError("VALIDATION", `Servono almeno ${MIN_TEAMS} squadre`);
    if (input.devices === "shared") {
      uniqueNames(teams.flatMap((t) => t.members), "giocatore"); // nessun nome ripetuto tra le squadre
      for (const t of teams) {
        if (t.members.length < MIN_TEAM_MEMBERS) throw new GiramenteError("VALIDATION", `La squadra «${t.name}» ha bisogno di almeno ${MIN_TEAM_MEMBERS} componenti`);
        if (t.members.length > MAX_TEAM_MEMBERS) throw new GiramenteError("VALIDATION", `Al massimo ${MAX_TEAM_MEMBERS} componenti per squadra`);
      }
    }
  } else if (input.devices === "shared") {
    players = uniqueNames(input.players ?? [], "giocatore");
    if (players.length < MIN_PLAYERS) throw new GiramenteError("VALIDATION", `Servono almeno ${MIN_PLAYERS} giocatori`);
    if (players.length > MAX_PLAYERS) throw new GiramenteError("VALIDATION", `Al massimo ${MAX_PLAYERS} giocatori`);
  }
  let hostNick: string | null = null;
  if (input.devices === "personal") {
    const c = checkNickname(input.hostNickname || user.username || "Host");
    if (!c.ok) throw new GiramenteError("VALIDATION", c.message);
    hostNick = c.value;
  }

  await limit(`giramente-create:${user.userId}`, CREATE_LIMITS.perUser, "Hai creato troppe partite di fila: riprova tra qualche minuto");
  if (user.ip) await limit(`giramente-create-ip:${user.ip}`, CREATE_LIMITS.perIp, "Troppe partite create da questa rete: riprova più tardi");
  await closeStaleRooms({ userId: user.userId }).catch(() => undefined);

  const sql = getSql();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode();
    try {
      return await sql.begin(async (tx) => {
        const [room] = await tx<{ id: string }[]>`
          insert into giramente_rooms (code, display_key, devices, mode, owner_user_id, host_user_id, settings)
          values (${code}, ${randomBytes(24).toString("base64url")}, ${input.devices}, ${input.mode}, ${user.userId}, ${user.userId}, ${tx.json(settings as never)})
          returning id`;
        let seat = 0;
        let pseat = 0;
        if (input.mode === "teams") {
          for (const t of teams) {
            const [c] = await tx<{ id: string }[]>`insert into giramente_competitors (room_id, kind, name, seat) values (${room.id}, 'team', ${t.name}, ${++seat}) returning id`;
            let first = true;
            for (const m of t.members) {
              await tx`insert into giramente_participants (room_id, kind, owner_user_id, nickname, seat, competitor_id, captain) values (${room.id}, 'local', ${user.userId}, ${m}, ${++pseat}, ${c.id}, ${first})`;
              first = false;
            }
            // dispositivi personali: chi crea entra nella prima squadra (capitano)
            if (hostNick && seat === 1) {
              await tx`insert into giramente_participants (room_id, kind, user_id, nickname, seat, competitor_id, captain) values (${room.id}, 'account', ${user.userId}, ${hostNick}, ${++pseat}, ${c.id}, true)`;
            }
          }
        } else if (input.devices === "shared") {
          for (const p of players) {
            const [c] = await tx<{ id: string }[]>`insert into giramente_competitors (room_id, kind, name, seat) values (${room.id}, 'player', ${p}, ${++seat}) returning id`;
            await tx`insert into giramente_participants (room_id, kind, owner_user_id, nickname, seat, competitor_id, captain) values (${room.id}, 'local', ${user.userId}, ${p}, ${++pseat}, ${c.id}, true)`;
          }
        } else if (hostNick) {
          const [c] = await tx<{ id: string }[]>`insert into giramente_competitors (room_id, kind, name, seat) values (${room.id}, 'player', ${hostNick}, 1) returning id`;
          await tx`insert into giramente_participants (room_id, kind, user_id, nickname, seat, competitor_id, captain) values (${room.id}, 'account', ${user.userId}, ${hostNick}, 1, ${c.id}, true)`;
        }
        await tx`insert into giramente_events (room_id, kind, data) values (${room.id}, 'room_created', ${tx.json({ devices: input.devices, mode: input.mode } as never)})`;
        return { roomId: room.id, code, devices: input.devices };
      });
    } catch (e) {
      if ((e as { code?: string; constraint_name?: string }).code === "23505" && String((e as { constraint_name?: string }).constraint_name ?? "").includes("code")) continue;
      throw e;
    }
  }
  throw new GiramenteError("BUSY", "Non riesco a generare un codice: riprova");
}

// ---------------------------------------------------------------------------
// Ingresso con codice / QR / link (solo dispositivi personali, solo account)
// ---------------------------------------------------------------------------
export interface RoomPreview {
  roomId: string;
  code: string;
  devices: DeviceMode;
  mode: GameMode;
  phase: Phase;
  status: "open" | "closed";
  activeCount: number;
  hostNickname: string | null;
  teams: { id: string; name: string; members: number }[];
  member: "active" | "left" | "kicked" | null;
  memberNickname: string | null;
}

async function findByCode(db: Db, rawCode: string): Promise<RoomRow | null> {
  const code = normalizeRoomCode(rawCode);
  if (!isRoomCode(code)) return null;
  const [r] = await db<RoomRow[]>`select r.*, now() as db_now from giramente_rooms r where r.code = ${code}`;
  return r ?? null;
}

export async function previewRoom(user: GiramenteUser, rawCode: string): Promise<RoomPreview> {
  await limit(`giramente-join:${user.userId}`, JOIN_LIMITS.perUser, "Troppi codici provati: aspetta qualche minuto");
  if (user.ip) await limit(`giramente-join-ip:${user.ip}`, JOIN_LIMITS.perIp, "Troppi codici provati da questa rete: aspetta qualche minuto");
  const sql = getSql();
  const room = await findByCode(sql, rawCode);
  if (!room) throw new GiramenteError("NOT_FOUND", "Codice non valido: controlla le lettere sullo schermo");
  const [[count], [host], [me], teams] = await Promise.all([
    sql<{ n: number }[]>`select count(*)::int as n from giramente_participants where room_id = ${room.id} and status = 'active'`,
    sql<{ nickname: string }[]>`select nickname from giramente_participants where room_id = ${room.id} and user_id = ${room.host_user_id} and status = 'active'`,
    sql<{ status: "active" | "left" | "kicked"; nickname: string }[]>`select status, nickname from giramente_participants where room_id = ${room.id} and user_id = ${user.userId}`,
    sql<{ id: string; name: string; members: number }[]>`
      select c.id, c.name, (select count(*)::int from giramente_participants p where p.competitor_id = c.id and p.status = 'active') as members
      from giramente_competitors c where c.room_id = ${room.id} and c.kind = 'team' and c.active order by c.seat`,
  ]);
  return {
    roomId: room.id,
    code: room.code,
    devices: room.devices,
    mode: room.mode,
    phase: room.phase,
    status: room.status,
    activeCount: count.n,
    hostNickname: host?.nickname ?? null,
    teams,
    member: me?.status ?? null,
    memberNickname: me?.nickname ?? null,
  };
}

export async function joinRoom(user: GiramenteUser, rawCode: string, rawNickname: string, teamId: string | null = null): Promise<{ roomId: string }> {
  await limit(`giramente-join:${user.userId}`, JOIN_LIMITS.perUser, "Troppi tentativi: aspetta qualche minuto");
  if (user.ip) await limit(`giramente-join-ip:${user.ip}`, JOIN_LIMITS.perIp, "Troppi tentativi da questa rete: aspetta qualche minuto");
  const nick = checkNickname(rawNickname);
  if (!nick.ok) throw new GiramenteError("VALIDATION", nick.message);
  const sql = getSql();
  const found = await findByCode(sql, rawCode);
  if (!found) throw new GiramenteError("NOT_FOUND", "Codice non valido: controlla le lettere sullo schermo");
  if (found.status === "closed") throw new GiramenteError("ROOM_CLOSED", "Questa partita è terminata");
  if (found.devices === "shared") throw new GiramenteError("SHARED_ROOM", "Questa partita si gioca su un solo dispositivo: non serve entrare dal telefono");
  try {
    return await sql.begin(async (tx) => {
      await tx`select set_config('lock_timeout', '4s', true), set_config('statement_timeout', '10s', true)`;
      const room = (await loadRoom(tx, found.id, true))!;
      if (room.status === "closed") throw new GiramenteError("ROOM_CLOSED", "Questa partita è terminata");
      const [me] = await tx<ParticipantRow[]>`select * from giramente_participants where room_id = ${room.id} and user_id = ${user.userId}`;
      if (me?.status === "kicked") throw new GiramenteError("KICKED", "Sei stato tolto da questa partita");
      if (me?.status === "active") return { roomId: room.id };
      // a partita iniziata rientra solo chi c'era già (riconnessione); niente nuovi concorrenti a metà
      if (room.phase !== "LOBBY" && !me) throw new GiramenteError("WRONG_PHASE", "La partita è già cominciata: aspetta la prossima");
      const [clash] = await tx`
        select 1 from giramente_participants where room_id = ${room.id} and status = 'active' and lower(nickname) = lower(${nick.value}) and (user_id is distinct from ${user.userId})`;
      if (clash) throw new GiramenteError("NICKNAME_TAKEN", "C'è già un giocatore con questo nome: scegline un altro");

      let competitorId: string | null = me?.competitor_id ?? null;
      let captain = false;
      if (room.mode === "individual") {
        const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from giramente_competitors where room_id = ${room.id} and active`;
        if (!competitorId || room.phase === "LOBBY") {
          if (n >= MAX_PLAYERS) throw new GiramenteError("ROOM_FULL", `La partita è piena (massimo ${MAX_PLAYERS} giocatori)`);
          const [{ seat }] = await tx<{ seat: number }[]>`select coalesce(max(seat), 0) + 1 as seat from giramente_competitors where room_id = ${room.id}`;
          const [c] = await tx<{ id: string }[]>`insert into giramente_competitors (room_id, kind, name, seat) values (${room.id}, 'player', ${nick.value}, ${seat}) returning id`;
          competitorId = c.id;
        }
        captain = true;
      } else if (room.phase === "LOBBY") {
        // squadra scelta (o quella con meno componenti)
        const teams = await tx<{ id: string; members: number }[]>`
          select c.id, (select count(*)::int from giramente_participants p where p.competitor_id = c.id and p.status = 'active') as members
          from giramente_competitors c where c.room_id = ${room.id} and c.kind = 'team' and c.active order by c.seat`;
        const pick = (teamId ? teams.find((t) => t.id === teamId) : null) ?? [...teams].sort((a, b) => a.members - b.members)[0];
        if (!pick) throw new GiramenteError("NOT_FOUND", "Squadra non trovata");
        if (pick.members >= MAX_TEAM_MEMBERS) throw new GiramenteError("ROOM_FULL", `La squadra è piena (massimo ${MAX_TEAM_MEMBERS} componenti)`);
        competitorId = pick.id;
        captain = pick.members === 0;
      }
      if (me) {
        await tx`update giramente_participants set status = 'active', nickname = ${nick.value}, left_at = null, last_seen_at = now(), competitor_id = ${competitorId}, captain = ${captain} where id = ${me.id}`;
      } else {
        const [{ seat }] = await tx<{ seat: number }[]>`select coalesce(max(seat), 0) + 1 as seat from giramente_participants where room_id = ${room.id}`;
        await tx`insert into giramente_participants (room_id, kind, user_id, nickname, seat, competitor_id, captain) values (${room.id}, 'account', ${user.userId}, ${nick.value}, ${seat}, ${competitorId}, ${captain})`;
      }
      await tx`insert into giramente_events (room_id, kind, data) values (${room.id}, 'joined', ${tx.json({ nickname: nick.value } as never)})`;
      await tx`update giramente_rooms set version = version + 1, updated_at = now(), last_activity_at = now(), broadcast_at = now(),
        event = ${tx.json({ kind: "joined", at: room.db_now.toISOString(), data: { name: nick.value } } as never)} where id = ${room.id}`;
      const fresh = (await loadRoom(tx, room.id))!;
      await broadcastGiramente(tx, await buildPublicStateFrom(tx, fresh));
      return { roomId: room.id };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new GiramenteError("NICKNAME_TAKEN", "C'è già un giocatore con questo nome: scegline un altro");
    const code = (e as { code?: string }).code;
    if (code === "55P03" || code === "57014") throw new GiramenteError("BUSY", "Troppe richieste nello stesso momento: riprova");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Lettura dello stato
// ---------------------------------------------------------------------------
/** Scadenza passata senza che nessuno abbia agito: la fase avanza (idempotente). */
async function settleDeadline(room: RoomRow): Promise<boolean> {
  if (room.status !== "open" || room.paused_at) return false;
  const now = room.db_now.getTime();
  let due = !!room.phase_deadline_at && now >= room.phase_deadline_at.getTime();
  if (!due && room.phase === "PLAY") {
    const [r] = await getSql()<{ n: number }[]>`
      select count(*)::int as n from giramente_plays where room_id = ${room.id} and status = 'open' and deadline_at < now() - interval '1500 milliseconds'`;
    due = r.n > 0;
  }
  if (!due) return false;
  await runAction(room.id, SYSTEM_ACTOR, { action: "tick" }).catch(() => undefined);
  return true;
}

export async function getRoomView(user: GiramenteUser, roomId: string): Promise<GiramenteView> {
  if (!UUID.test(roomId)) throw new GiramenteError("NOT_FOUND", "Partita non trovata");
  const sql = getSql();
  let room = await loadRoom(sql, roomId);
  if (!room) throw new GiramenteError("NOT_FOUND", "Partita non trovata");
  const isOwner = room.owner_user_id === user.userId;
  let participant: ParticipantRow | null = null;
  if (room.devices === "shared") {
    if (!isOwner) throw new GiramenteError("NOT_MEMBER", "Questa partita si gioca sul dispositivo di chi l'ha creata");
  } else {
    const [p] = await sql<ParticipantRow[]>`select * from giramente_participants where room_id = ${roomId} and user_id = ${user.userId}`;
    if (p?.status === "kicked") throw new GiramenteError("KICKED", "Sei stato tolto da questa partita");
    participant = p?.status === "active" ? p : null;
    if (!participant && room.host_user_id !== user.userId) {
      throw new GiramenteError("NOT_MEMBER", p ? "Sei uscito da questa partita: rientra con il codice" : "Non fai parte di questa partita");
    }
  }
  const isHost = room.devices === "shared" ? isOwner : room.host_user_id === user.userId;
  if (await settleDeadline(room)) room = (await loadRoom(sql, roomId))!;
  const now = room.db_now.getTime();
  if (room.status === "open") {
    if (participant?.kind === "account" && now - participant.last_seen_at.getTime() > HEARTBEAT_MS) {
      await sql`update giramente_participants set last_seen_at = now() where id = ${participant.id}`;
      participant.last_seen_at = room.db_now;
    }
    if (isHost && now - room.host_seen_at.getTime() > HEARTBEAT_MS) {
      await sql`update giramente_rooms set host_seen_at = now() where id = ${roomId}`;
      room.host_seen_at = room.db_now;
    }
  }
  const [state, view] = await Promise.all([buildPublicStateFrom(sql, room), buildPrivateView(sql, room, participant, { userId: user.userId, isHost, isOwner })]);
  return { state, view };
}

const DISPLAY_KEY = /^[A-Za-z0-9_-]{24,64}$/;

/** Schermo pubblico (TV/PC): nessun account, chiave lunga e casuale, SOLO stato pubblico. */
export async function getDisplayState(displayKey: string): Promise<PublicState> {
  if (!DISPLAY_KEY.test(displayKey)) throw new GiramenteError("NOT_FOUND", "Schermo non valido");
  const sql = getSql();
  const [found] = await sql<{ id: string }[]>`select id from giramente_rooms where display_key = ${displayKey}`;
  if (!found) throw new GiramenteError("NOT_FOUND", "Schermo non valido");
  let room = (await loadRoom(sql, found.id))!;
  if (await settleDeadline(room)) room = (await loadRoom(sql, found.id))!;
  if (room.status === "open" && (!room.display_seen_at || room.db_now.getTime() - room.display_seen_at.getTime() > HEARTBEAT_MS)) {
    await sql`update giramente_rooms set display_seen_at = now() where id = ${room.id}`;
    room.display_seen_at = room.db_now;
  }
  return buildPublicStateFrom(sql, room);
}

/** Comandi dallo schermo pubblico (solo l'host autenticato): mai nulla che riveli soluzioni. */
export const SCREEN_ACTIONS = ["start_game", "skip", "pause", "resume"] as const;
const screenActionSchema = z.object({ action: z.enum(SCREEN_ACTIONS) });

async function roomByKey(displayKey: string): Promise<{ id: string; host_user_id: string | null }> {
  if (!DISPLAY_KEY.test(displayKey)) throw new GiramenteError("NOT_FOUND", "Schermo non valido");
  const [found] = await getSql()<{ id: string; host_user_id: string | null }[]>`select id, host_user_id from giramente_rooms where display_key = ${displayKey}`;
  if (!found) throw new GiramenteError("NOT_FOUND", "Schermo non valido");
  return found;
}

export async function screenControl(user: GiramenteUser | null, displayKey: string): Promise<{ host: boolean }> {
  const room = await roomByKey(displayKey);
  return { host: !!user && room.host_user_id === user.userId };
}

export async function runScreenAction(user: GiramenteUser, displayKey: string, raw: unknown): Promise<PublicState> {
  const parsed = screenActionSchema.safeParse(raw);
  if (!parsed.success) throw new GiramenteError("FORBIDDEN", "Questo comando si dà dal telefono");
  const room = await roomByKey(displayKey);
  if (room.host_user_id !== user.userId) throw new GiramenteError("FORBIDDEN", "Solo chi gestisce la partita può dare comandi dallo schermo");
  await runAction(room.id, { userId: user.userId, ip: user.ip }, { action: parsed.data.action });
  return getDisplayState(displayKey);
}

/** Chiave dello schermo: solo per chi gestisce la partita. */
export async function getDisplayKey(user: GiramenteUser, roomId: string): Promise<string> {
  if (!UUID.test(roomId)) throw new GiramenteError("NOT_FOUND", "Partita non trovata");
  const [r] = await getSql()<{ display_key: string }[]>`select display_key from giramente_rooms where id = ${roomId} and host_user_id = ${user.userId}`;
  if (!r) throw new GiramenteError("FORBIDDEN", "Solo chi gestisce la partita può aprire lo schermo");
  return r.display_key;
}

// ---------------------------------------------------------------------------
// Partite dell'account («Riprendi») e pulizia
// ---------------------------------------------------------------------------
export interface MyRoom {
  roomId: string;
  code: string;
  devices: DeviceMode;
  mode: GameMode;
  phase: Phase;
  players: number;
  roundNo: number;
  isHost: boolean;
  updatedAt: string;
}

export async function listMyRooms(userId: string, limitN = 5): Promise<MyRoom[]> {
  const rows = await getSql()<{ id: string; code: string; devices: DeviceMode; mode: GameMode; phase: Phase; round_no: number; host_user_id: string | null; last_activity_at: Date; players: number }[]>`
    select r.id, r.code, r.devices, r.mode, r.phase, r.round_no, r.host_user_id, r.last_activity_at,
      (select count(*)::int from giramente_competitors c where c.room_id = r.id and c.active) as players
    from giramente_rooms r
    where r.status = 'open' and r.phase <> 'FINAL' and r.last_activity_at > now() - make_interval(hours => ${STALE_HOURS})
      and (r.owner_user_id = ${userId} or exists (select 1 from giramente_participants p where p.room_id = r.id and p.user_id = ${userId} and p.status = 'active'))
    order by r.last_activity_at desc limit ${limitN}`;
  return rows.map((r) => ({
    roomId: r.id,
    code: r.code,
    devices: r.devices,
    mode: r.mode,
    phase: r.phase,
    players: r.players,
    roundNo: r.round_no,
    isHost: r.host_user_id === userId,
    updatedAt: iso(r.last_activity_at)!,
  }));
}

export async function closeStaleRooms(f: { userId?: string; olderThanHours?: number; limit?: number } = {}): Promise<number> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    update giramente_rooms set status = 'closed', closed_at = now(), close_reason = 'inactive', version = version + 1
    where id in (
      select id from giramente_rooms
      where status = 'open' and last_activity_at < now() - make_interval(hours => ${f.olderThanHours ?? STALE_HOURS})
        ${f.userId ? sql`and owner_user_id = ${f.userId}` : sql``}
      order by last_activity_at limit ${f.limit ?? 200}
    )
    returning id`;
  return rows.length;
}
