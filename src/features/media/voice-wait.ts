/**
 * Attesa della clip della voce professionale (ElevenLabs) prima di parlare.
 *
 * Una battuta non ancora in archivio si genera al volo sul server: può volerci qualche secondo.
 * Con ElevenLabs attivo il TV NON passa alla voce del browser solo perché la clip è lenta:
 * aspetta fino a CLIP_WAIT_MS (in silenzio, nessun segno sullo schermo) e ripiega sulla voce del
 * browser solo per un guasto vero (errore, budget mensile esaurito 503 TTS_BUDGET, voce spenta),
 * cioè quando la richiesta risponde senza URL, oppure se l'attesa supera il tetto.
 * Funzioni pure (niente DOM): testate in tests/unit/voice-wait.test.ts.
 */

/** Tetto di attesa di una battuta in diretta (nickname, punteggi: modello veloce). */
export const CLIP_WAIT_LIVE_MS = 12_000;
/** Tetto di attesa delle battute fisse (domande, risposte: di solito già preparate in lobby). */
export const CLIP_WAIT_MS = 12_000;

/** Quanto aspettare la clip prima di usare la voce del browser. */
export function clipWaitMs(live: boolean): number {
  return live ? CLIP_WAIT_LIVE_MS : CLIP_WAIT_MS;
}

/**
 * Aspetta l'URL della clip al massimo `timeoutMs`: null = guasto vero (la richiesta ha risposto
 * senza URL) oppure attesa scaduta. Il timer viene sempre ripulito.
 */
export function waitForClip(prefetch: Promise<string | null>, timeoutMs: number): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([prefetch.catch(() => null), timeout]).finally(() => clearTimeout(timer));
}
