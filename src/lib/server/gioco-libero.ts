import "server-only";
import { randomUUID } from "node:crypto";
import { getSql, iso, num, type Db, type Tx } from "@/lib/database/db";
import { computeQuota, publicGameSchema, publicMaxPlayers, validateUsername, type PublicGameOptions, type PublicGamesSettings, type QuotaInfo } from "@/lib/game-engine/public-game";
import type { GameCommand, GamePhase, SessionStatus } from "@/lib/game-engine/types";
import type { AdminRole } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CmsError } from "./audit";
import { composeFreeGameTx } from "./cms/compose";
import { generateSessionCode, publishSessionTx } from "./cms/sessions";
import { computeAutoplayPlan } from "./autoplay";
import { closeStaleFreeGames } from "./auto-close";
import { executeCommand, rebroadcast, resolveNextQuestion, type Actor } from "./engine";
import { GiocoError } from "./gioco-errors";
import { checkRateLimit } from "./players";
import { autoplayEnabled, buildPublicState, loadStateRow } from "./public-state";
import { loadGlobalSettings } from "./settings";

/**
 * Gioco libero: partite create dal pubblico con un account "host".
 *
 * - L'account host è un normale utente Supabase Auth con un profilo in `host_profiles`
 *   (username univoco). NON è un admin: l'area /admin resta protetta da `admin_users`.
 * - La partita nasce già composta (domande scelte dal sito, prima quelle che l'host non ha
 *   mai visto), con scorrimento automatico, pubblicata e con la lobby aperta.
 * - L'host può solo: aprire la lobby, iniziare, mettere in pausa, riprendere, terminare,
 *   passare al passo successivo (solo quando è sicuro), espellere un giocatore e scegliere
 *   lo scorrimento automatico o manuale (e solo per le partite di cui è proprietario).
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

export { isPublicSession } from "./public-session";

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

/** Limiti di creazione: per account e per indirizzo IP (valgono anche per la rivincita). */
export const CREATE_LIMITS = { perUser: { limit: 6, windowSeconds: 600 }, perIp: { limit: 20, windowSeconds: 3600 } };

function parseOptions(raw: unknown): PublicGameOptions {
  const parsed = publicGameSchema.safeParse(raw);
  if (!parsed.success) throw new GiocoError("ACTION_NOT_ALLOWED", parsed.error.issues[0]?.message ?? "Impostazioni della partita non valide", parsed.error.issues);
  return parsed.data;
}

async function assertCreateRate(host: HostUser): Promise<void> {
  const sql = getSql();
  // limiti di frequenza (contati anche se poi la creazione fallisce)
  if (!(await checkRateLimit(sql, `public-game:${host.userId}`, CREATE_LIMITS.perUser.limit, CREATE_LIMITS.perUser.windowSeconds))) {
    throw new GiocoError("RATE_LIMITED", "Hai creato troppe partite di fila: riprova tra qualche minuto");
  }
  if (host.ip && !(await checkRateLimit(sql, `public-game-ip:${host.ip}`, CREATE_LIMITS.perIp.limit, CREATE_LIMITS.perIp.windowSeconds))) {
    throw new GiocoError("RATE_LIMITED", "Troppe partite create da questa rete: riprova più tardi");
  }
}

/**
 * Nella transazione: profilo bloccato (fa da lucchetto sulla quota), interruttore generale, quota,
 * composizione (prima le domande mai viste da questo host) e pubblicazione.
 * `countsAsGame`: la partita consuma la quota (la rivincita solo se è impostato un limite).
 */
async function composePublicTx(
  tx: Tx,
  host: HostUser,
  o: PublicGameOptions,
  opts: { onlyTag?: string; title: (username: string) => string; countsAsGame: (quota: QuotaInfo) => boolean },
): Promise<{ sessionId: string; warnings: string[]; quota: QuotaInfo }> {
  const actor = actorOf(host);
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
    // partita libera: sempre una votazione delle materie, una canzone (se l'archivio ne ha) e, alla
    // pubblicazione, almeno una Ruota di Palmino (vedi game-engine/free-game.ts)
    res = await composeFreeGameTx(
      tx,
      { title: opts.title(p.username), rounds: o.rounds, totalQuestions: o.totalQuestions, mix: o.mix },
      actor,
      {
        hostUserId: host.userId,
        onlyTag: opts.onlyTag,
        // nessun limite di giocatori se l'impostazione è 0 ("finché regge")
        // Ruota di Palmino: dalla 5ª domanda, almeno una per partita, sceglie la categoria della domanda successiva
        settings: { advanceMode: "auto", allowLateJoin: true, palminoWheel: true, ...(publicMaxPlayers(settings) ? { maxPlayers: publicMaxPlayers(settings)! } : {}) },
      },
    );
  } catch (e) {
    if (e instanceof CmsError && e.status === 422) {
      throw new GiocoError("ARCHIVE_TOO_SMALL", "Non ci sono abbastanza domande per questa partita: scegli meno domande", e.details);
    }
    throw e;
  }
  const sessionId = res.sessionId;
  // candidate della ruota dallo stesso archivio, prima quelle che questo host non ha mai visto
  await publishSessionTx(tx, sessionId, actor, { palminoWheel: { onlyTag: opts.onlyTag, hostUserId: host.userId, atLeastOne: true } });
  await tx`update game_sessions set public_options = ${tx.json({ totalQuestions: o.totalQuestions, rounds: o.rounds, mix: o.mix })} where id = ${sessionId}`;
  const counts = opts.countsAsGame(quota);
  if (counts) await tx`update host_profiles set games_created = games_created + 1, updated_at = now() where user_id = ${host.userId}`;
  return { sessionId, warnings: res.warnings, quota: computeQuota(settings, p.games_created + (counts ? 1 : 0), isUnlimited(host)) };
}

/** Lobby aperta subito: i telefoni possono entrare appena il TV mostra il QR. */
async function openLobby(sessionId: string, host: HostUser): Promise<boolean> {
  try {
    await executeCommand(sessionId, actorOf(host), { command: "OPEN_LOBBY", commandId: randomUUID(), args: {} });
    return true;
  } catch (e) {
    console.error("[gioco-libero] apertura lobby non riuscita", e);
    return false;
  }
}

export async function createPublicGame(host: HostUser, raw: unknown, opts: { onlyTag?: string } = {}): Promise<PublicGameCreated> {
  const sql = getSql();
  if (!host.profile) throw new GiocoError("PROFILE_REQUIRED", "Scegli prima il tuo username");
  const o = parseOptions(raw);
  await assertCreateRate(host);
  const created = await sql.begin(async (tx) => {
    const r = await composePublicTx(tx, host, o, { onlyTag: opts.onlyTag, title: (u) => `Partita di ${u}`, countsAsGame: () => true });
    const [s] = await tx<{ code: string; display_key: string }[]>`select code, display_key from game_sessions where id = ${r.sessionId}`;
    return { ...r, code: s.code, displayKey: s.display_key };
  });
  return { ...created, lobbyOpen: await openLobby(created.sessionId, host) };
}

// ---------------------------------------------------------------------------
// Rivincita
// ---------------------------------------------------------------------------
/**
 * RIVINCITA: a partita finita l'host ne fa partire un'altra SENZA cambiare codice né QR.
 *
 * Una nuova sessione (classifica, punteggi, storico delle domande e scorrimento separati), creata
 * in UNA transazione insieme al passaggio di consegne:
 *  - domande nuove: il compositore esclude quelle già viste da questo host (question_plays per
 *    account, comprese quelle appena giocate) e, come sempre, prima le mai giocate;
 *  - la vecchia partita riceve un codice d'archivio e viene archiviata, la nuova prende il suo
 *    codice (il QR sui telefoni e sul TV continua a funzionare) e la vecchia punta alla nuova
 *    (next_session_id → `rematch` nello stato pubblico: TV e telefoni la seguono da soli);
 *  - i giocatori attivi passano nella nuova lobby con lo stesso nickname e punti a zero: il loro
 *    token (cookie del telefono, legato al codice) passa al nuovo partecipante, quindi nessuno si
 *    scollega né deve rientrare;
 *  - quota: la rivincita conta come partita solo se l'account ha un limite.
 * Idempotente: se la rivincita esiste già si restituisce quella (doppio clic, due schermi).
 */
export interface RematchResult {
  sessionId: string;
  code: string;
  /** giocatori passati nella nuova partita */
  carried: number;
  warnings: string[];
  quota: QuotaInfo | null;
  lobbyOpen: boolean;
  /** la rivincita esisteva già */
  existing: boolean;
}

async function archiveCode(tx: Tx): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateSessionCode(8);
    const [r] = await tx`select 1 from game_sessions where code = ${code}`;
    if (!r) return code;
  }
  throw new Error("Impossibile generare un codice d'archivio");
}

/** Impostazioni della partita precedente (per proporle uguali). */
export async function previousOptions(db: Db, sessionId: string): Promise<PublicGameOptions> {
  const [s] = await db<{ public_options: Partial<PublicGameOptions> | null; rounds: number; questions: number }[]>`
    select s.public_options,
      (select count(*)::int from game_rounds r where r.session_id = s.id) as rounds,
      (select count(*)::int from session_questions q where q.session_id = s.id and not q.is_reserve) as questions
    from game_sessions s where s.id = ${sessionId}`;
  const fallback = { totalQuestions: s?.questions ?? 15, rounds: s?.rounds ?? 3, mix: "bilanciata" };
  const parsed = publicGameSchema.safeParse({ ...fallback, ...(s?.public_options ?? {}) });
  return parsed.success ? parsed.data : publicGameSchema.parse({ totalQuestions: 15, rounds: 3, mix: "bilanciata" });
}

export async function rematchPublicGame(host: HostUser, oldSessionId: string, raw: unknown = null, opts: { onlyTag?: string } = {}): Promise<RematchResult> {
  const sql = getSql();
  if (!host.profile) throw new GiocoError("PROFILE_REQUIRED", "Scegli prima il tuo username");
  if (!/^[0-9a-f-]{36}$/i.test(oldSessionId)) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  const [own] = await sql<{ host_user_id: string | null; next_session_id: string | null; code: string }[]>`
    select host_user_id, next_session_id, code from game_sessions where id = ${oldSessionId}`;
  if (!own) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  if (own.host_user_id !== host.userId) throw new GiocoError("NOT_OWNER", "Questa partita non è tua");
  const existing = async (id: string): Promise<RematchResult> => {
    const [n] = await sql<{ code: string }[]>`select code from game_sessions where id = ${id}`;
    return { sessionId: id, code: n?.code ?? "", carried: 0, warnings: [], quota: null, lobbyOpen: true, existing: true };
  };
  if (own.next_session_id) return existing(own.next_session_id);
  const o = raw === null || raw === undefined ? await previousOptions(sql, oldSessionId) : parseOptions(raw);
  await assertCreateRate(host);

  const created = await sql.begin(async (tx) => {
    // la riga della vecchia partita fa da lucchetto: due rivincite insieme ne creano una sola
    const [old] = await tx<{ code: string; next_session_id: string | null; phase: GamePhase | null }[]>`
      select s.code, s.next_session_id, gs.phase
      from game_sessions s left join game_state gs on gs.session_id = s.id
      where s.id = ${oldSessionId} and s.host_user_id = ${host.userId}
      for update of s`;
    if (!old) throw new GiocoError("NOT_FOUND", "Partita non trovata");
    if (old.next_session_id) return { sessionId: old.next_session_id, existing: true as const };
    if (old.phase !== "FINISHED") throw new GiocoError("ACTION_NOT_ALLOWED", "La rivincita si fa a partita finita");

    const r = await composePublicTx(tx, host, o, {
      onlyTag: opts.onlyTag,
      title: (u) => `Rivincita di ${u}`,
      countsAsGame: (q) => q.limit !== null,
    });
    // passaggio del codice: la vecchia riceve un codice d'archivio, la nuova eredita quello del QR
    await tx`
      update game_sessions set code = ${await archiveCode(tx)}, next_session_id = ${r.sessionId},
        status = case when status = 'finished' then 'archived'::session_status else status end,
        archived_at = case when status = 'finished' then now() else archived_at end
      where id = ${oldSessionId}`;
    await tx`update game_sessions set code = ${old.code} where id = ${r.sessionId}`;
    // la rivincita si guarda dove si guardava la partita (TV o telefoni)
    await tx`update game_sessions set display_mode = (select display_mode from game_sessions where id = ${oldSessionId}) where id = ${r.sessionId}`;

    // giocatori: stesso nickname, punti a zero; il token del telefono passa al nuovo partecipante
    const players = await tx<{ id: string; identity_id: string | null; nickname: string; nickname_key: string; token_hash: string; gender: string | null }[]>`
      select id, identity_id, nickname, nickname_key, token_hash, gender from participants
      where session_id = ${oldSessionId} and status = 'active' and not is_bot
      order by joined_at`;
    if (players.length > 0) {
      await tx`update participants set token_hash = 'rivincita:' || id::text where id = any(${players.map((p) => p.id)}::uuid[])`;
      const inserted = await tx<{ id: string }[]>`
        insert into participants (session_id, identity_id, nickname, nickname_key, token_hash, gender)
        select ${r.sessionId}::uuid, o.identity_id, o.nickname, o.nickname_key, o.token_hash, o.gender
        from unnest(${players.map((p) => p.identity_id)}::uuid[], ${players.map((p) => p.nickname)}::text[],
                    ${players.map((p) => p.nickname_key)}::text[], ${players.map((p) => p.token_hash)}::text[],
                    ${players.map((p) => p.gender)}::text[])
          as o(identity_id, nickname, nickname_key, token_hash, gender)
        returning id`;
      await tx`insert into score_totals (participant_id, session_id) select unnest(${inserted.map((x) => x.id)}::uuid[]), ${r.sessionId}::uuid`;
    }
    return { ...r, code: old.code, carried: players.length, existing: false as const };
  });

  if (created.existing) return existing(created.sessionId);
  const lobbyOpen = await openLobby(created.sessionId, host);
  // TV e telefoni della vecchia partita: lo stato pubblico ora dice dove andare
  await rebroadcast(oldSessionId).catch((e) => console.error("[gioco-libero] avviso rivincita non riuscito", e));
  return { sessionId: created.sessionId, code: created.code, carried: created.carried, warnings: created.warnings, quota: created.quota, lobbyOpen, existing: false };
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

/** Partita ancora aperta (in lobby o in gioco)? */
export function isOpenGame(g: Pick<HostGameSummary, "status" | "phase">): boolean {
  return g.status !== "finished" && g.status !== "archived" && g.phase !== "FINISHED" && g.phase !== null && g.phase !== "DRAFT";
}

/**
 * Partite dell'host dopo la chiusura automatica di quelle abbandonate da 24 ore (auto-close.ts):
 * per la pagina /gioca (partita in corso) e per il profilo (storico).
 */
export async function hostGamesFresh(userId: string, limit = 10): Promise<HostGameSummary[]> {
  await closeStaleFreeGames({ userId, limit: 10 }).catch(() => undefined);
  return listHostGames(getSql(), userId, limit);
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

/** Apertura di una partita dall'host (TV, pannello, telefono): prima la chiude se abbandonata da 24 ore. */
export async function openOwnedGame(userId: string, sessionId: string): Promise<HostGame | null> {
  const sql = getSql();
  const game = await getOwnedGame(sql, userId, sessionId);
  if (!game || game.status === "finished" || game.status === "archived") return game;
  const r = await closeStaleFreeGames({ sessionId, limit: 1 }).catch(() => null);
  return r?.closed.length ? getOwnedGame(sql, userId, sessionId) : game;
}

// ---------------------------------------------------------------------------
// Comandi dell'host (solo questi: niente regia completa)
// ---------------------------------------------------------------------------
export const HOST_ACTIONS = ["open", "start", "pause", "resume", "finish", "next", "kick", "auto"] as const;
export type HostAction = (typeof HOST_ACTIONS)[number];

/** Argomenti dei comandi che ne hanno bisogno: kick (giocatore) e auto (on/off). */
export interface HostCommandArgs {
  participantId?: string;
  autoplay?: boolean;
}

const ACTION_COMMAND: Record<Exclude<HostAction, "next">, GameCommand> = {
  open: "OPEN_LOBBY",
  // l'intro con le regole, poi lo scorrimento automatico porta avanti la partita
  start: "START_INTRO",
  pause: "PAUSE",
  resume: "RESUME",
  finish: "FINISH",
  kick: "KICK",
  auto: "SET_AUTOPLAY",
};

/** Fasi in cui "Avanti" è sempre sicuro: si salta solo il parlato o un'animazione. */
const NEXT_SAFE_PHASES: readonly GamePhase[] = [
  "INTRO",
  "ROUND_INTRO",
  "CATEGORY_RESULT",
  "WHEEL_SPIN",
  "SPECIAL_EVENT",
  "QUESTION_VISIBLE",
  "ANSWERS_LOCKED",
  "ANSWER_REVEAL",
  "SCORE_REVEAL",
  "LEADERBOARD",
];
/** Fasi a tempo (risposte, votazione): "Avanti" solo a tempo scaduto, mai tagliando i giocatori. */
const NEXT_TIMED_PHASES: readonly GamePhase[] = ["OPTIONS_VISIBLE", "CATEGORY_VOTING"];

/**
 * "Avanti": lo stesso passo che farebbe lo scorrimento automatico (vale anche in manuale),
 * eseguito subito. Solo nelle fasi sicure; nelle fasi a tempo solo a tempo scaduto.
 */
async function plannedNextStep(sessionId: string): Promise<{ command: GameCommand; version: number }> {
  return getSql().begin(async (tx) => {
    const st = await loadStateRow(tx, sessionId);
    if (!st) throw new GiocoError("NOT_FOUND", "Partita non trovata");
    const timed = NEXT_TIMED_PHASES.includes(st.phase);
    if (!NEXT_SAFE_PHASES.includes(st.phase) && !timed) throw new GiocoError("ACTION_NOT_ALLOWED", "Adesso non si può andare avanti");
    const state = await buildPublicState(tx, sessionId, st);
    if (!state) throw new GiocoError("NOT_FOUND", "Partita non trovata");
    if (timed) {
      const closesAt = st.phase === "CATEGORY_VOTING" ? state.vote?.closesAt : state.question?.closesAt;
      if (!closesAt || Date.parse(closesAt) > st.server_now.getTime()) {
        throw new GiocoError("ACTION_NOT_ALLOWED", "Aspetta la fine del tempo: i giocatori stanno ancora rispondendo");
      }
    }
    const plan = await computeAutoplayPlan(tx, st, state, resolveNextQuestion);
    if (plan.kind !== "step") throw new GiocoError("ACTION_NOT_ALLOWED", "Adesso non si può andare avanti");
    return { command: plan.command, version: num(st.version) };
  });
}

export async function hostCommand(host: HostUser, sessionId: string, action: HostAction, commandId: string = randomUUID(), args: HostCommandArgs = {}) {
  const sql = getSql();
  if (!(HOST_ACTIONS as readonly string[]).includes(action)) throw new GiocoError("ACTION_NOT_ALLOWED", "Comando non consentito");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  const [s] = await sql<{ host_user_id: string | null; phase: GamePhase | null; players: number }[]>`
    select s.host_user_id, gs.phase,
      (select count(*)::int from participants p where p.session_id = s.id and p.status = 'active' and not p.is_bot) as players
    from game_sessions s left join game_state gs on gs.session_id = s.id where s.id = ${sessionId}`;
  if (!s) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  if (s.host_user_id !== host.userId) throw new GiocoError("NOT_OWNER", "Questa partita non è tua");
  const actor = actorOf(host);
  if (action === "start") {
    if (s.phase !== "LOBBY") throw new GiocoError("ACTION_NOT_ALLOWED", "La partita è già iniziata");
    if (s.players < 1) throw new GiocoError("NO_PLAYERS", "Aspetta che entri almeno un giocatore");
  }
  if (action === "next") {
    const step = await plannedNextStep(sessionId);
    return executeCommand(sessionId, actor, { command: step.command, commandId, expectedVersion: step.version, args: {} });
  }
  if (action === "kick") {
    if (!args.participantId || !/^[0-9a-f-]{36}$/i.test(args.participantId)) throw new GiocoError("ACTION_NOT_ALLOWED", "Giocatore non indicato");
    return executeCommand(sessionId, actor, { command: "KICK", commandId, args: { participantId: args.participantId, reason: "Espulso dall'host" } });
  }
  if (action === "auto") {
    if (typeof args.autoplay !== "boolean") throw new GiocoError("ACTION_NOT_ALLOWED", "Indica automatico o manuale");
    return executeCommand(sessionId, actor, { command: "SET_AUTOPLAY", commandId, args: { autoplay: args.autoplay } });
  }
  return executeCommand(sessionId, actor, { command: ACTION_COMMAND[action], commandId, args: {} });
}

// ---------------------------------------------------------------------------
// Giocatori e scorrimento (pannello dell'host)
// ---------------------------------------------------------------------------
export interface HostPlayer {
  id: string;
  nickname: string;
  points: number;
}

export interface HostGameStatus {
  players: HostPlayer[];
  /** scorrimento automatico attivo */
  autoplay: boolean;
}

/** Giocatori attivi (per l'espulsione) e modalità di scorrimento: solo per il proprietario. */
export async function hostGameStatus(host: HostUser, sessionId: string): Promise<HostGameStatus> {
  const sql = getSql();
  const game = await getOwnedGame(sql, host.userId, sessionId);
  if (!game) throw new GiocoError("NOT_FOUND", "Partita non trovata");
  const players = await sql<{ id: string; nickname: string; points: number | null }[]>`
    select p.id, p.nickname, t.points
    from participants p left join score_totals t on t.participant_id = p.id
    where p.session_id = ${sessionId} and p.status = 'active' and not p.is_bot
    order by p.joined_at asc`;
  const st = await loadStateRow(sql, sessionId);
  return {
    players: players.map((p) => ({ id: p.id, nickname: p.nickname, points: p.points ?? 0 })),
    autoplay: st ? autoplayEnabled(st) : true,
  };
}
