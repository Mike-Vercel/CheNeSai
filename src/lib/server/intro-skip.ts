import { createHash } from "node:crypto";
import { getSql, num, type Db, type Tx } from "@/lib/database/db";
import { INTRO_SKIP_REASON, introSkipUnanimous } from "@/lib/game-engine/intro-skip";
import { GameError, type GamePhase, type PublicIntroSkip } from "@/lib/game-engine/types";
import { checkRateLimit, PlayerError, type PlayerAuth } from "./players";

/**
 * "Salta intro" a votazione, lato server.
 * - Il voto (e il ritiro) lo registra il giocatore dal telefono, solo durante l'intro.
 * - Contano tutti i giocatori attivi, bot esclusi (l'host solo se è entrato come giocatore);
 *   chi entra a intro in corso si aggiunge al conteggio.
 * - Quando votano tutti, il server esegue START_ROUND (stesso comando della regia e dello
 *   scorrimento automatico) con un commandId deterministico: idempotente anche con voti
 *   contemporanei, sotto il lucchetto e i limiti di tempo dei comandi.
 */
const MAX_NAMES = 12;

export async function loadIntroSkip(db: Db | Tx, sessionId: string): Promise<PublicIntroSkip> {
  const rows = await db<{ nickname: string; voted: boolean }[]>`
    select p.nickname, (v.participant_id is not null) as voted
    from participants p left join intro_skip_votes v on v.session_id = p.session_id and v.participant_id = p.id
    where p.session_id = ${sessionId} and p.status = 'active' and not p.is_bot
    order by v.created_at nulls last, p.joined_at`;
  const voters = rows.filter((r) => r.voted);
  return { votes: voters.length, needed: rows.length, names: voters.slice(0, MAX_NAMES).map((r) => r.nickname) };
}

/** Il giocatore ha già chiesto di saltare l'intro? (per il telefono dopo un ricaricamento) */
export async function hasIntroSkipVote(db: Db | Tx, sessionId: string, participantId: string): Promise<boolean> {
  const [r] = await db<{ ok: boolean }[]>`
    select exists (select 1 from intro_skip_votes where session_id = ${sessionId} and participant_id = ${participantId}) as ok`;
  return !!r?.ok;
}

export interface IntroSkipVoteResult {
  voted: boolean;
  skip: PublicIntroSkip;
  /** questo voto ha fatto partire il primo round */
  skipped: boolean;
}

/** Voto (skip = true) o ritiro del voto (skip = false) di un giocatore. */
export async function voteIntroSkip(auth: PlayerAuth, skip: boolean): Promise<IntroSkipVoteResult> {
  const sql = getSql();
  const skipState = await sql.begin(async (tx) => {
    await tx`select set_config('lock_timeout', '3s', true), set_config('statement_timeout', '10s', true)`;
    if (!(await checkRateLimit(tx, `intro-skip:${auth.participantId}`, 12, 10))) throw new PlayerError("RATE_LIMITED", "Troppe richieste");
    const [g] = await tx<{ phase: GamePhase }[]>`select phase from game_state where session_id = ${auth.sessionId} for share`;
    if (g?.phase !== "INTRO") throw new PlayerError("NOT_OPEN", "L'intro è già finita");
    if (skip) {
      await tx`insert into intro_skip_votes (session_id, participant_id) values (${auth.sessionId}, ${auth.participantId}) on conflict do nothing`;
    } else {
      await tx`delete from intro_skip_votes where session_id = ${auth.sessionId} and participant_id = ${auth.participantId}`;
    }
    return loadIntroSkip(tx, auth.sessionId);
  });
  const skipped = skip && introSkipUnanimous(skipState.votes, skipState.needed) ? await skipIntroIfUnanimous(auth.sessionId) : false;
  // il contatore sul TV si aggiorna subito (se si è saltato, lo stato nuovo è già stato trasmesso)
  if (!skipped) {
    const { rebroadcast } = await import("./engine");
    await rebroadcast(auth.sessionId).catch(() => undefined);
  }
  return { voted: skip, skip: skipState, skipped };
}

/**
 * Se tutti i giocatori hanno votato, fa partire il primo round. Mai un errore per chi vota:
 * fase cambiata, comando concorrente o lucchetto occupato → false (ci pensa l'altro voto o la regia).
 */
export async function skipIntroIfUnanimous(sessionId: string): Promise<boolean> {
  const sql = getSql();
  const [g] = await sql<{ phase: GamePhase; version: number; intro_started_at: Date | null }[]>`
    select phase, version, intro_started_at from game_state where session_id = ${sessionId}`;
  if (!g || g.phase !== "INTRO") return false;
  const s = await loadIntroSkip(sql, sessionId);
  if (!introSkipUnanimous(s.votes, s.needed)) return false;
  const h = createHash("sha256").update(`qz-intro-skip|${sessionId}|${g.intro_started_at?.toISOString() ?? ""}`).digest("hex");
  const commandId = `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-b${h.slice(17, 20)}-${h.slice(20, 32)}`;
  const { AUTO_ACTOR, executeCommand, isTransientDbError } = await import("./engine");
  try {
    const res = await executeCommand(sessionId, AUTO_ACTOR, { command: "START_ROUND", commandId, expectedVersion: num(g.version), args: { reason: INTRO_SKIP_REASON } });
    return !res.duplicate;
  } catch (e) {
    if (e instanceof GameError || isTransientDbError(e)) return false;
    throw e;
  }
}
