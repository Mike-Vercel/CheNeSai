import "server-only";
import type { Db } from "@/lib/database/db";
import type { GamePhase } from "@/lib/game-engine/types";
import { verifyDisplayKey } from "./display";
import { GiocoError } from "./gioco-errors";
import { checkRateLimit } from "./players";
import { isPublicSession } from "./public-session";
import { loadVoiceConfig, ttsConfigured } from "./tts";
import { pendingLiveParts, prewarmNameClips, prewarmNumberClips } from "./tts-names";
import { estimateScope, runScopeBatch, type PregenProgress } from "./tts-pregen";

/**
 * "Voci della serata" guidate dal TV (e dal pannello dell'host): stessa logica e stessi limiti
 * della preparazione voci della regia (tts-pregen), ma autorizzata dalla chiave dello schermo e
 * SOLO per le battute di quella serata. A piccoli lotti (Vercel: richieste brevi), con il budget
 * mensile controllato dal server a ogni clip (TTS_BUDGET → blocked).
 */

/** Richieste al minuto per serata (stima + lotti): un lotto dura qualche secondo, il TV ne fa ~10 al minuto. */
export const DISPLAY_VOICES_RATE = { limit: 30, windowSeconds: 60 };
/** Battute al massimo per lotto (come la regia). */
export const DISPLAY_VOICES_MAX_BATCH = 4;

export type DisplayVoicesAction = "estimate" | "run";

/** Avanzamento mostrato al TV/host: niente dati del budget dell'app (chi ha la chiave TV è il pubblico). */
export interface DisplayVoicesProgress {
  configured: boolean;
  total: number;
  ready: number;
  missing: number;
  /** solo "run" */
  generated?: number;
  /** il budget mensile ha fermato la preparazione: il resto userà la voce del browser */
  blocked?: boolean;
  /** la partita è finita: niente da preparare */
  finished?: boolean;
  /**
   * "Nomi salvati" ancora da preparare (nickname dei giocatori collegati e numeri piccoli): servono
   * alle battute in diretta (punti, classifica, fine round), così il TV le trova già pronte.
   */
  liveParts?: number;
}

export class DisplayVoicesError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function slim(p: PregenProgress): DisplayVoicesProgress {
  return { configured: p.configured, total: p.total, ready: p.ready, missing: p.missing };
}

export async function displayVoices(db: Db, sessionId: string, key: string | null, action: DisplayVoicesAction, batch = DISPLAY_VOICES_MAX_BATCH): Promise<DisplayVoicesProgress> {
  if (!(await verifyDisplayKey(db, sessionId, key))) throw new DisplayVoicesError(403, "BAD_DISPLAY_KEY", "Chiave schermo non valida");
  const [g] = await db<{ phase: GamePhase | null }[]>`select phase from game_state where session_id = ${sessionId}`;
  if (!g) throw new DisplayVoicesError(404, "NOT_FOUND", "Partita non trovata o non pubblicata");
  if (!(await checkRateLimit(db, `tts-voices:${sessionId}`, DISPLAY_VOICES_RATE.limit, DISPLAY_VOICES_RATE.windowSeconds))) {
    throw new GiocoError("RATE_LIMITED", "Troppe richieste: riprova tra poco");
  }
  const scope = { kind: "session" as const, sessionId };
  if (!ttsConfigured()) return { configured: false, total: 0, ready: 0, missing: 0 };
  const cfg = await loadVoiceConfig(db);
  // partite libere: sempre "nomi salvati"; serate: l'impostazione del pannello Voci
  const namesMode = (await isPublicSession(sessionId, db)) ? ("spliced" as const) : undefined;
  const parts = async () => {
    const p = await pendingLiveParts(db, cfg, sessionId, namesMode);
    return { ...p, count: p.names.length + (p.numbers ? 1 : 0) };
  };
  if (action === "estimate") return { ...slim(await estimateScope(db, scope)), liveParts: (await parts()).count };
  if (g.phase === "FINISHED" || g.phase === "DRAFT") return { ...slim(await estimateScope(db, scope)), finished: true, liveParts: 0 };
  // priorità bassa: le battute chieste dal TV in diretta passano prima
  const r = await runScopeBatch(db, scope, Math.max(1, Math.min(DISPLAY_VOICES_MAX_BATCH, batch)), { priority: "low" });
  if (r.blocked || r.missing > 0) return { ...slim(r), generated: r.generated, blocked: r.blocked };
  // battute della serata pronte: ora le parti dei nomi (numeri piccoli, poi due giocatori per lotto)
  const p = await parts();
  let generated = r.generated;
  if (p.numbers) generated += (await prewarmNumberClips(db, cfg, { namesMode, priority: "normal" })).generated;
  else for (const name of p.names.slice(0, 2)) generated += (await prewarmNameClips(db, cfg, name, { namesMode, priority: "normal" })).generated;
  return { ...slim(r), generated, blocked: false, liveParts: (await parts()).count };
}
