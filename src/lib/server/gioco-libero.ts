import "server-only";
import { randomUUID } from "node:crypto";
import { getSql, iso, type Db } from "@/lib/database/db";
import { computeQuota, publicGameSchema, validateUsername, type PublicGamesSettings, type QuotaInfo } from "@/lib/game-engine/public-game";
import type { GameCommand, GamePhase, SessionStatus } from "@/lib/game-engine/types";
import type { AdminRole } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CmsError } from "./audit";
import { composeAndCreateSessionTx } from "./cms/compose";
import { publishSessionTx } from "./cms/sessions";
import { executeCommand, type Actor } from "./engine";
import { GiocoError } from "./gioco-errors";
import { checkRateLimit } from "./players";
import { loadGlobalSettings } from "./settings";

/**
 * Gioco libero: partite create dal pubblico con un account "host".
 *
 * - L'account host è un normale utente Supabase Auth con un profilo in `host_profiles`
 *   (username univoco). NON è un admin: l'area /admin resta protetta da `admin_users`.
 * - La partita nasce già composta (domande scelte dal sito, prima quelle che l'host non ha
 *   mai visto), con scorrimento automatico, pubblicata e con la lobby aperta.
 * - L'host può solo: aprire la lobby, iniziare, mettere in pausa, riprendere, terminare
 *   (e solo per le partite di cui è proprietario).
 */

export interface HostProfile {
  username: string;
  displayName: string | null;
  gamesCreated: number;
  createdAt: string;
}

export interface HostUser {
  userId: string;
  email: string | null;
  /** null = deve ancora scegliere lo username (es. primo accesso con Google) */
  profile: HostProfile | null;
  /** ruolo admin attivo, se l'account è anche admin (nessun limite di partite) */
  adminRole: AdminRole | null;
  ip?: string | null;
}

async function loadProfile(db: Db, userId: string): Promise<HostProfile | null> {
  const [p] = await db<{ username: string; display_name: string | null; games_created: number; created_at: Date }[]>`
    select username, display_name, games_created, created_at from host_profiles where user_id = ${userId}`;
  return p ? { username: p.username, displayName: p.display_name, gamesCreated: p.games_created, createdAt: iso(p.created_at)! } : null;
}

/** Account host della richiesta corrente (sessione Supabase verificata col server Auth). */
export async function getHostUser(ip: string | null = null): Promise<HostUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return loadHostUser(getSql(), data.user.id, data.user.email ?? null, ip);
}

export async function loadHostUser(db: Db, userId: string, email: string | null, ip: string | null = null): Promise<HostUser> {
  const [admin] = await db<{ role: AdminRole; active: boolean }[]>`select role, active from admin_users where user_id = ${userId}`;
  return {
    userId,
    email,
    profile: await loadProfile(db, userId),
    adminRole: admin?.active ? admin.role : null,
    ip,
  };
}

export async function requireHostUser(ip: string | null = null): Promise<HostUser> {
  const host = await getHostUser(ip);
  if (!host) throw new GiocoError("UNAUTHENTICATED", "Accedi per continuare");
  return host;
}

/** Solo admin e super admin sono illimitati (gli operatori sono account di regia, non di gioco). */
function isUnlimited(host: HostUser): boolean {
  return host.adminRole === "admin" || host.adminRole === "super_admin";
}

function actorOf(host: HostUser): Actor {
  return { userId: host.userId, email: host.email ?? `@${host.profile?.username ?? "host"}`, ip: host.ip ?? null };
}

// ---------------------------------------------------------------------------
// Username
// ---------------------------------------------------------------------------
export async function isUsernameAvailable(db: Db, raw: string, exceptUserId: string | null = null): Promise<{ available: boolean; message: string | null }> {
  const v = validateUsername(raw);
  if (!v.ok) return { available: false, message: v.message };
  const [row] = await db<{ user_id: string }[]>`select user_id from host_profiles where lower(username) = ${v.key}`;
  if (row && row.user_id !== exceptUserId) return { available: false, message: "Questo username è già preso" };
  return { available: true, message: null };
}

/** Crea il profilo host (scelta dello username). Lo username è univoco senza distinzione di maiuscole. */
export async function createHostProfile(db: Db, userId: string, rawUsername: string, displayName: string | null = null): Promise<HostProfile> {
  const v = validateUsername(rawUsername);
  if (!v.ok) throw new GiocoError("USERNAME_INVALID", v.message, { issue: v.issue });
  const name = displayName?.trim().slice(0, 60) || null;
  try {
    const rows = await db`
      insert into host_profiles (user_id, username, display_name) values (${userId}, ${v.username}, ${name})
      on conflict (user_id) do nothing returning user_id`;
    if (rows.length === 0) throw new GiocoError("PROFILE_EXISTS", "Hai già scelto il tuo username");
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new GiocoError("USERNAME_TAKEN", "Questo username è già preso: scegline un altro");
    throw e;
  }
  return (await loadProfile(db, userId))!;
}

// ---------------------------------------------------------------------------
// Impostazioni e quota
// ---------------------------------------------------------------------------
export async function loadPublicGamesSettings(db: Db): Promise<PublicGamesSettings> {
  return (await loadGlobalSettings(db)).publicGames;
}

export function quotaOf(host: HostUser, settings: PublicGamesSettings): QuotaInfo {
  return computeQuota(settings, host.profile?.gamesCreated ?? 0, isUnlimited(host));
}

/** true se la sessione è una partita libera (creata da un account host). Per la TTS "nomi salvati". */
export async function isPublicSession(sessionId: string, db: Db = getSql()): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return false;
  const [s] = await db<{ public: boolean }[]>`select host_user_id is not null as public from game_sessions where id = ${sessionId}`;
  return s?.public ?? false;
}

// ---------------------------------------------------------------------------
// Creazione della partita
// ---------------------------------------------------------------------------
export interface PublicGameCreated {
  sessionId: string;
  code: string;
  displayKey: string;
  warnings: string[];
  quota: QuotaInfo;
  lobbyOpen: boolean;
}

/** Limiti di creazione: per account e per indirizzo IP. */
export const CREATE_LIMITS = { perUser: { limit: 6, windowSeconds: 600 }, perIp: { limit: 20, windowSeconds: 3600 } };

export async function createPublicGame(host: HostUser, raw: unknown, opts: { onlyTag?: string } = {}): Promise<PublicGameCreated> {
  const sql = getSql();
  if (!host.profile) throw new GiocoError("PROFILE_REQUIRED", "Scegli prima il tuo username");
  const parsed = publicGameSchema.safeParse(raw);
  if (!parsed.success) throw new GiocoError("ACTION_NOT_ALLOWED", parsed.error.issues[0]?.message ?? "Impostazioni della partita non valide", parsed.error.issues);
  const o = parsed.data;
  // limiti di frequenza (contati anche se poi la creazione fallisce)
  if (!(await checkRateLimit(sql, `public-game:${host.userId}`, CREATE_LIMITS.perUser.limit, CREATE_LIMITS.perUser.windowSeconds))) {
    throw new GiocoError("RATE_LIMITED", "Hai creato troppe partite di fila: riprova tra qualche minuto");
  }
  if (host.ip && !(await checkRateLimit(sql, `public-game-ip:${host.ip}`, CREATE_LIMITS.perIp.limit, CREATE_LIMITS.perIp.windowSeconds))) {
    throw new GiocoError("RATE_LIMITED", "Troppe partite create da questa rete: riprova più tardi");
  }
  const actor = actorOf(host);

  const created = await sql.begin(async (tx) => {
    // la riga del profilo fa da lucchetto: due creazioni insieme non superano la quota
    const [p] = await tx<{ username: string; games_created: number }[]>`
      select username, games_created from host_profiles where user_id = ${host.userId} for update`;
    if (!p) throw new GiocoError("PROFILE_REQUIRED", "Scegli prima il tuo username");
    const settings = await loadPublicGamesSettings(tx);
    if (!settings.enabled && !isUnlimited(host)) throw new GiocoError("GIOCO_CHIUSO", "Il gioco libero è momentaneamente chiuso: riprova più tardi");
    const quota = computeQuota(settings, p.games_created, isUnlimited(host));
    if (!quota.canCreate) {
      throw new GiocoError("QUOTA_EXHAUSTED", `Hai usato tutte le partite del tuo account (${quota.limit})`, { quota });
    }
    let res;
    try {
      res = await composeAndCreateSessionTx(
        tx,
        {
          title: `Partita di ${p.username}`,
          rounds: o.rounds,
          totalQuestions: o.totalQuestions,
          mix: o.mix,
          finalRound: o.rounds > 1,
          reserves: 0,
          isTest: false,
          categories: [],
          includeMedia: false,
        },
        actor,
        {
          hostUserId: host.userId,
          onlyTag: opts.onlyTag,
          settings: { advanceMode: "auto", maxPlayers: settings.maxPlayers, allowLateJoin: true },
        },
      );
    } catch (e) {
      if (e instanceof CmsError && e.status === 422) {
        throw new GiocoError("ARCHIVE_TOO_SMALL", "Non ci sono abbastanza domande per questa partita: scegli meno domande", e.details);
      }
      throw e;
    }
    const sessionId = res.sessionId!;
    await publishSessionTx(tx, sessionId, actor);
    await tx`update host_profiles set games_created = games_created + 1, updated_at = now() where user_id = ${host.userId}`;
    const [s] = await tx<{ code: string; display_key: string }[]>`select code, display_key from game_sessions where id = ${sessionId}`;
    return {
      sessionId,
      code: s.code,
      displayKey: s.display_key,
      warnings: res.warnings,
      quota: computeQuota(settings, p.games_created + 1, isUnlimited(host)),
    };
  });

  // Lobby aperta subito: i telefoni possono entrare appena il TV mostra il QR.
  let lobbyOpen = false;
  try {
    await executeCommand(created.sessionId, actor, { command: "OPEN_LOBBY", commandId: randomUUID(), args: {} });
    lobbyOpen = true;
  } catch (e) {
    console.error("[gioco-libero] apertura lobby non riuscita", e);
  }
  return { ...created, lobbyOpen };
}

// ---------------------------------------------------------------------------
// Le partite dell'host
// ---------------------------------------------------------------------------
export interface HostGameSummary {
  id: string;
  code: string;
  title: string;
  status: SessionStatus;
  phase: GamePhase | null;
  players: number;
  createdAt: string;
  finishedAt: string | null;
}

export async function listHostGames(db: Db, userId: string, limit = 10): Promise<HostGameSummary[]> {
  const rows = await db<{ id: string; code: string; title: string; status: SessionStatus; phase: GamePhase | null; players: number; created_at: Date; finished_at: Date | null }[]>`
    select s.id, s.code, s.title, s.status, gs.phase, s.created_at, s.finished_at,
      (select count(*)::int from participants p where p.session_id = s.id and p.status = 'active' and not p.is_bot) as players
    from game_sessions s left join game_state gs on gs.session_id = s.id
    where s.host_user_id = ${userId}
    order by s.created_at desc limit ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    status: r.status,
    phase: r.phase,
    players: r.players,
    createdAt: iso(r.created_at)!,
    finishedAt: iso(r.finished_at),
  }));
}

export interface HostGame {
  id: string;
  code: string;
  title: string;
  displayKey: string;
  status: SessionStatus;
}

/** Partita dell'host (null se non esiste o non è sua). */
export async function getOwnedGame(db: Db, userId: string, sessionId: string): Promise<HostGame | null> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const [s] = await db<{ id: string; code: string; title: string; display_key: string; status: SessionStatus }[]>`
    select id, code, title, display_key, status from game_sessions where id = ${sessionId} and host_user_id = ${userId}`;
  return s ? { id: s.id, code: s.code, title: s.title, displayKey: s.display_key, status: s.status } : null;
}

// ---------------------------------------------------------------------------
// Comandi dell'host (solo questi: niente regia completa)
// ---------------------------------------------------------------------------
export const HOST_ACTIONS = ["open", "start", "pause", "resume", "finish"] as const;
export type HostAction = (typeof HOST_ACTIONS)[number];

const ACTION_COMMAND: Record<HostAction, GameCommand> = {
  open: "OPEN_LOBBY",
  // l'intro con le regole, poi lo scorrimento automatico porta avanti la partita
  start: "START_INTRO",
  pause: "PAUSE",
  resume: "RESUME",
  finish: "FINISH",
};

export async function hostCommand(host: HostUser, sessionId: string, action: HostAction, commandId: string = randomUUID()) {
  const sql = getSql();
  if (!(HOST_ACTIONS as readonly string[]).includes(action)) throw new GiocoError("ACTION_NOT_ALLOWED", "Comando non consentito");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  const [s] = await sql<{ host_user_id: string | null; phase: GamePhase | null; players: number }[]>`
    select s.host_user_id, gs.phase,
      (select count(*)::int from participants p where p.session_id = s.id and p.status = 'active' and not p.is_bot) as players
    from game_sessions s left join game_state gs on gs.session_id = s.id where s.id = ${sessionId}`;
  if (!s) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  if (s.host_user_id !== host.userId) throw new GiocoError("NOT_OWNER", "Questa partita non è tua");
  if (action === "start") {
    if (s.phase !== "LOBBY") throw new GiocoError("ACTION_NOT_ALLOWED", "La partita è già iniziata");
    if (s.players < 1) throw new GiocoError("NO_PLAYERS", "Aspetta che entri almeno un giocatore");
  }
  return executeCommand(sessionId, actorOf(host), { command: ACTION_COMMAND[action], commandId, args: {} });
}
