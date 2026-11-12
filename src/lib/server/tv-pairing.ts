import "server-only";
import { setDisplayMode } from "./display-mode";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { getSql, iso, type Db } from "@/lib/database/db";
import { remotePrefsSchema, type RemotePrefs } from "@/lib/validation/tv-remote";
import { verifyDisplayKey } from "./display";
import { getOwnedGame, type HostUser } from "./gioco-libero";
import { GiocoError } from "./gioco-errors";
import { checkRateLimit } from "./players";

/**
 * Partita avviata dal telefono → il televisore come schermo (gioco libero).
 *
 * Abbinamento con un codice di 4 cifre, pensato per qualsiasi browser di smart TV, Chromecast con
 * Google TV, Fire TV o PC:
 *  1. il TV apre /tv e chiede un codice (`createPairing`): riceve anche un gettone segreto che
 *     resta solo sul TV (nel database c'è il suo hash);
 *  2. l'host, dal telefono e col suo account, scrive il codice (`claimPairing`): solo il
 *     proprietario della partita può abbinarla, con limiti di frequenza (4 cifre = 10 000
 *     combinazioni: i tentativi sono pochi e contati per account e per rete);
 *  3. il TV, che interroga col gettone (`pollPairing`), riceve UNA volta sola id della partita e
 *     chiave dello schermo; poi l'abbinamento è consumato (monouso). I codici scadono in ~10 minuti.
 * Ogni passo è una sola istruzione SQL (niente transazioni, niente lucchetti lunghi).
 */

export const PAIRING_TTL_SECONDS = 600;
/** Dopo l'abbinamento il TV ha ancora questo tempo per ritirare la partita. */
const CLAIM_GRACE_SECONDS = 120;
/** Il TV abbinato si fa sentire ogni ~3 s: oltre questo tempo lo si considera spento. */
export const TV_ONLINE_MS = 10_000;

export const PAIRING_LIMITS = {
  /** codici chiesti da una stessa rete (un TV ne chiede uno ogni 10 minuti) */
  createPerIp: { limit: 20, windowSeconds: 600 },
  /** codici provati da un account e da una rete */
  claimPerUser: { limit: 10, windowSeconds: 600 },
  claimPerIp: { limit: 30, windowSeconds: 600 },
} as const;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function newCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

const UUID = /^[0-9a-f-]{36}$/i;

export interface PairingCreated {
  pairingId: string;
  code: string;
  /** gettone segreto del TV (solo qui: nel database c'è l'hash) */
  token: string;
  expiresAt: string;
}

/** Il TV chiede un codice nuovo. */
export async function createPairing(ip: string | null, db: Db = getSql()): Promise<PairingCreated> {
  if (ip && !(await checkRateLimit(db, `tv-pair:${ip}`, PAIRING_LIMITS.createPerIp.limit, PAIRING_LIMITS.createPerIp.windowSeconds))) {
    throw new GiocoError("RATE_LIMITED", "Troppi codici chiesti da questa rete: riprova tra qualche minuto");
  }
  // pulizia: codici scaduti liberati, abbinamenti vecchi eliminati
  await db`update tv_pairings set status = 'expired' where status in ('waiting', 'claimed') and expires_at < now()`;
  await db`delete from tv_pairings where created_at < now() - interval '1 day'`;
  const token = newToken();
  for (let i = 0; i < 25; i++) {
    const code = newCode();
    try {
      const [r] = await db<{ id: string; expires_at: Date }[]>`
        insert into tv_pairings (code, token_hash, created_ip, expires_at)
        values (${code}, ${hashToken(token)}, ${ip}, now() + make_interval(secs => ${PAIRING_TTL_SECONDS}))
        returning id, expires_at`;
      return { pairingId: r.id, code, token, expiresAt: iso(r.expires_at)! };
    } catch (e) {
      if ((e as { code?: string }).code === "23505") continue; // codice già in attesa su un altro TV
      throw e;
    }
  }
  throw new GiocoError("RATE_LIMITED", "Troppi televisori in attesa in questo momento: riprova tra poco");
}

export type PairingPoll =
  | { status: "waiting"; code: string; expiresAt: string }
  | { status: "paired"; sessionId: string; displayKey: string; kind?: "psyco" }
  | { status: "expired" }
  | { status: "used" };

/** Il TV interroga col suo gettone: in attesa, abbinato (consegna UNA volta sola), scaduto, già usato. */
export async function pollPairing(pairingId: string, token: string, db: Db = getSql()): Promise<PairingPoll> {
  if (!UUID.test(pairingId) || !token) throw new GiocoError("PAIRING_INVALID", "Abbinamento non trovato");
  const hash = hashToken(token);
  // consegna atomica: solo la prima richiesta dopo l'abbinamento riceve la chiave dello schermo
  // (partita del quiz oppure stanza PSYCO: psyco_room_id, vedi migrazione 20261112130000_psyco)
  const [delivered] = await db<{ session_id: string | null; display_key: string | null; psyco_room_id: string | null; psyco_key: string | null }[]>`
    with d as (
      update tv_pairings set status = 'delivered', delivered_at = now()
      where id = ${pairingId} and token_hash = ${hash} and status = 'claimed' and expires_at > now()
      returning session_id, psyco_room_id
    )
    select d.session_id, s.display_key, d.psyco_room_id, r.display_key as psyco_key
    from d left join game_sessions s on s.id = d.session_id left join psyco_rooms r on r.id = d.psyco_room_id`;
  if (delivered?.psyco_room_id && delivered.psyco_key) return { status: "paired", kind: "psyco", sessionId: delivered.psyco_room_id, displayKey: delivered.psyco_key };
  if (delivered?.session_id && delivered.display_key) return { status: "paired", sessionId: delivered.session_id, displayKey: delivered.display_key };
  const [p] = await db<{ code: string; status: string; expires_at: Date }[]>`
    select code, status, expires_at from tv_pairings where id = ${pairingId} and token_hash = ${hash}`;
  if (!p) throw new GiocoError("PAIRING_INVALID", "Abbinamento non trovato");
  if (p.status === "delivered") return { status: "used" };
  if (p.status === "expired" || p.expires_at.getTime() <= Date.now()) return { status: "expired" };
  return { status: "waiting", code: p.code, expiresAt: iso(p.expires_at)! };
}

/** Partita dell'host abbinabile a un TV (sua, non archiviata). */
async function ownedPlayableGame(host: HostUser, sessionId: string, db: Db) {
  if (!UUID.test(sessionId)) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  const game = await getOwnedGame(db, host.userId, sessionId);
  if (!game) throw new GiocoError("NOT_OWNER", "Questa partita non è tua");
  if (game.status === "archived") throw new GiocoError("ACTION_NOT_ALLOWED", "Questa partita è archiviata");
  return game;
}

/** L'host scrive sul telefono il codice mostrato dal TV: il TV diventa lo schermo della SUA partita. */
export async function claimPairing(host: HostUser, rawCode: string, sessionId: string, db: Db = getSql()): Promise<{ sessionId: string }> {
  const code = String(rawCode ?? "").trim();
  if (!(await checkRateLimit(db, `tv-claim:${host.userId}`, PAIRING_LIMITS.claimPerUser.limit, PAIRING_LIMITS.claimPerUser.windowSeconds))) {
    throw new GiocoError("RATE_LIMITED", "Troppi codici provati: aspetta qualche minuto e riprova");
  }
  if (host.ip && !(await checkRateLimit(db, `tv-claim-ip:${host.ip}`, PAIRING_LIMITS.claimPerIp.limit, PAIRING_LIMITS.claimPerIp.windowSeconds))) {
    throw new GiocoError("RATE_LIMITED", "Troppi codici provati da questa rete: riprova tra qualche minuto");
  }
  await ownedPlayableGame(host, sessionId, db);
  if (!/^[0-9]{4}$/.test(code)) throw new GiocoError("PAIRING_INVALID", "Il codice del TV è di 4 cifre");
  const [r] = await db<{ id: string }[]>`
    update tv_pairings
    set status = 'claimed', session_id = ${sessionId}, claimed_by = ${host.userId}, claimed_at = now(),
        expires_at = now() + make_interval(secs => ${CLAIM_GRACE_SECONDS})
    where code = ${code} and status = 'waiting' and expires_at > now()
    returning id`;
  if (!r) throw new GiocoError("PAIRING_INVALID", "Codice non valido o scaduto: controlla il numero sul televisore");
  // lo show passa sul televisore: i telefoni dei giocatori tornano a "Guarda il TV"
  await setDisplayMode(sessionId, "tv", db).catch(() => false);
  return { sessionId };
}

/**
 * «Trasmetti» (Presentation API): il telefono apre direttamente la pagina del TV su un dispositivo
 * Cast. Abbinamento già fatto (nessun codice da scrivere), monouso e di breve durata come gli altri.
 */
export async function createCastPairing(host: HostUser, sessionId: string, db: Db = getSql()): Promise<{ pairingId: string; token: string }> {
  if (!(await checkRateLimit(db, `tv-claim:${host.userId}`, PAIRING_LIMITS.claimPerUser.limit, PAIRING_LIMITS.claimPerUser.windowSeconds))) {
    throw new GiocoError("RATE_LIMITED", "Troppi tentativi: aspetta qualche minuto e riprova");
  }
  await ownedPlayableGame(host, sessionId, db);
  const token = newToken();
  const [r] = await db<{ id: string }[]>`
    insert into tv_pairings (code, token_hash, status, session_id, claimed_by, claimed_at, created_ip, expires_at)
    values (${newCode()}, ${hashToken(token)}, 'claimed', ${sessionId}, ${host.userId}, now(), ${host.ip ?? null}, now() + make_interval(secs => ${CLAIM_GRACE_SECONDS}))
    returning id`;
  await setDisplayMode(sessionId, "tv", db).catch(() => false);
  return { pairingId: r.id, token };
}

// ---------------------------------------------------------------------------
// Telecomando: presenza del TV e audio
// ---------------------------------------------------------------------------
export interface RemoteState {
  prefs: RemotePrefs;
  rev: number;
}

function parsePrefs(raw: unknown): RemotePrefs {
  const r = remotePrefsSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

/** Il TV abbinato si fa sentire (chiave schermo già verificata): risponde con le preferenze del telefono. */
export async function tvHeartbeat(sessionId: string, audioOn: boolean, db: Db = getSql()): Promise<RemoteState> {
  const [r] = await db<{ prefs: unknown; prefs_rev: number }[]>`
    insert into tv_remote (session_id, tv_seen_at, tv_audio) values (${sessionId}, now(), ${audioOn})
    on conflict (session_id) do update set tv_seen_at = now(), tv_audio = excluded.tv_audio
    returning prefs, prefs_rev`;
  return { prefs: parsePrefs(r.prefs), rev: r.prefs_rev };
}

export interface RemoteStatus extends RemoteState {
  tv: { online: boolean; audioOn: boolean | null; seenAt: string } | null;
}

/** Il telefono dell'host: il TV è collegato? con l'audio? e le preferenze attuali. */
export async function remoteStatus(host: HostUser, sessionId: string, db: Db = getSql()): Promise<RemoteStatus> {
  if (!UUID.test(sessionId) || !(await getOwnedGame(db, host.userId, sessionId))) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  const [r] = await db<{ prefs: unknown; prefs_rev: number; tv_seen_at: Date | null; tv_audio: boolean | null; db_now: Date }[]>`
    select prefs, prefs_rev, tv_seen_at, tv_audio, now() as db_now from tv_remote where session_id = ${sessionId}`;
  if (!r) return { prefs: {}, rev: 0, tv: null };
  const seen = r.tv_seen_at;
  return {
    prefs: parsePrefs(r.prefs),
    rev: r.prefs_rev,
    tv: seen ? { online: r.db_now.getTime() - seen.getTime() < TV_ONLINE_MS, audioOn: r.tv_audio, seenAt: iso(seen)! } : null,
  };
}

/** Il telefono cambia l'audio del TV (volume, musica, voci, muto…). */
export async function setRemotePrefs(host: HostUser, sessionId: string, raw: unknown, db: Db = getSql()): Promise<RemoteState> {
  if (!UUID.test(sessionId) || !(await getOwnedGame(db, host.userId, sessionId))) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  const parsed = remotePrefsSchema.safeParse(raw);
  if (!parsed.success) throw new GiocoError("ACTION_NOT_ALLOWED", "Impostazioni non valide", parsed.error.issues);
  const [r] = await db<{ prefs: unknown; prefs_rev: number }[]>`
    insert into tv_remote (session_id, prefs, prefs_rev) values (${sessionId}, ${db.json(parsed.data)}, 1)
    on conflict (session_id) do update set prefs = tv_remote.prefs || excluded.prefs, prefs_rev = tv_remote.prefs_rev + 1, updated_at = now()
    returning prefs, prefs_rev`;
  return { prefs: parsePrefs(r.prefs), rev: r.prefs_rev };
}

/**
 * RIVINCITA vista dal TV abbinato (che non ha un account): con la chiave della partita finita
 * ottiene id e chiave della nuova (stesso host, stesso codice). Solo partite del gioco libero.
 */
export async function followRematch(sessionId: string, displayKey: string | null, db: Db = getSql()): Promise<{ sessionId: string; displayKey: string } | null> {
  if (!(await verifyDisplayKey(db, sessionId, displayKey))) throw new GiocoError("NOT_OWNER", "Chiave schermo non valida");
  const [n] = await db<{ id: string; display_key: string }[]>`
    select n.id, n.display_key from game_sessions s join game_sessions n on n.id = s.next_session_id
    where s.id = ${sessionId} and s.host_user_id is not null and n.host_user_id = s.host_user_id`;
  return n ? { sessionId: n.id, displayKey: n.display_key } : null;
}
