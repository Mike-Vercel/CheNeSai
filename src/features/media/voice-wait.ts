/**
 * Attesa della clip della voce professionale (ElevenLabs) prima di parlare.
 *
 * Una battuta non ancora in archivio si genera al volo sul server: può volerci qualche secondo.
 * Con ElevenLabs attivo il TV NON usa mai la voce del browser: aspetta la clip fino a CLIP_WAIT_MS
 * (in silenzio, con qualche nuovo tentativo per gli errori passeggeri) e, se proprio non arriva
 * (guasto ripetuto, budget mensile esaurito 503 TTS_BUDGET), la battuta compare come sottotitolo
 * con il personaggio che parla, senza voce sintetica.
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

/** Pause fra un tentativo e l'altro della stessa clip (sempre dentro l'attesa massima). */
export const CLIP_RETRY_DELAYS_MS: readonly number[] = [700, 1600];

/**
 * Risposte di /api/tts dopo le quali NON si riprova: voce spenta (404), accesso negato (403),
 * richiesta non valida (422) o budget mensile esaurito (503). Gli altri errori (502, 504, 429,
 * rete) sono passeggeri: si riprova.
 */
export function isFinalTtsFailure(status: number): boolean {
  return status === 403 || status === 404 || status === 422 || status === 503;
}

/** Quanto resta a schermo una battuta senza voce (sottotitolo): il tempo che servirebbe a dirla. */
export function silentLineMs(text: string): number {
  const clean = text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  return Math.min(12_000, Math.max(1500, Math.round((clean.length / 13) * 1000 + 400)));
}
