import "server-only";
import { getSql } from "@/lib/database/db";
import { GameError } from "@/lib/game-engine/types";
import { autoTick, type AutoTickResult } from "./engine";

/**
 * Ritardo minimo (oltre l'orario previsto) prima che un GIOCATORE possa far eseguire il passo
 * automatico di una partita online. Di solito il dispositivo dell'host lo esegue prima (aspettando
 * la fine delle battute dei presentatori): i giocatori intervengono solo se l'host non c'è più
 * (scheda chiusa, connessione persa), così la partita non si ferma e le voci non vengono tagliate.
 */
export const FALLBACK_GRACE_MS = 6000;

/**
 * Passo automatico di riserva chiesto dal dispositivo di un giocatore (partite online, display_mode
 * "phone"). Lo stesso passo in programma e con gli stessi controlli di autoTick (idempotente, sicuro
 * con l'host e con molti giocatori che chiamano insieme: lucchetto, versione attesa e commandId
 * deterministico); in più si esegue SOLO se è in ritardo di almeno FALLBACK_GRACE_MS.
 * In salotto (TV) non serve: lo guida sempre lo schermo dell'host.
 */
export async function fallbackTick(sessionId: string): Promise<AutoTickResult> {
  const sql = getSql();
  const [g] = await sql<
    { display_mode: string | null; phase: string; auto_next_at: Date | null; auto_version: number | null; auto_waiting: string | null; enabled: boolean; overdue: boolean }[]
  >`
    select s.display_mode, gs.phase, gs.auto_next_at, gs.auto_version, gs.auto_waiting,
           coalesce(gs.auto_mode, s.settings->>'advanceMode' = 'auto') as enabled,
           coalesce(gs.auto_next_at <= clock_timestamp() - make_interval(secs => ${FALLBACK_GRACE_MS / 1000}::float8), false) as overdue
    from game_state gs join game_sessions s on s.id = gs.session_id
    where gs.session_id = ${sessionId}`;
  if (!g) throw new GameError("NOT_FOUND", "Sessione non trovata o non pubblicata");
  if (g.display_mode !== "phone") throw new GameError("FORBIDDEN", "In questa partita lo scorrimento lo guida lo schermo dell'host");
  if (!g.enabled || !g.overdue || g.phase === "PAUSED") {
    return {
      advanced: false,
      command: null,
      nextAt: g.enabled && g.auto_next_at ? g.auto_next_at.toISOString() : null,
      version: g.enabled && g.auto_version !== null ? Number(g.auto_version) : null,
      waiting: g.enabled ? g.auto_waiting : null,
    };
  }
  return autoTick(sessionId);
}
