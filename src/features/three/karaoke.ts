"use client";

/**
 * Sottotitoli "karaoke" dell'intro: tempi parola per parola delle battute registrate.
 *
 * I tempi sono calcolati OFFLINE da scripts/intro-word-timings.py (faster-whisper locale +
 * inviluppo di energia, allineati al testo del copione) e salvati accanto alle clip:
 *   public/audio/intro/<clip>.words.json, public/audio/regole/regola-NN.words.json
 *   = [{ w, start, end }] in secondi dall'inizio della clip.
 * Se il file manca (o il testo è cambiato) si ripiega su una distribuzione per sillabe sulla
 * durata della battuta. Tutto è funzione del tempo trascorso: una TV che ricarica riprende
 * dalla parola giusta.
 */

export interface KaraokeWord {
  w: string;
  start: number;
  end: number;
}

const cache = new Map<string, KaraokeWord[] | null>();
const pending = new Map<string, Promise<KaraokeWord[] | null>>();

/** URL del file dei tempi accanto alla clip (".mp3" → ".words.json"). */
export function wordsUrl(clipUrl: string): string {
  return clipUrl.replace(/\.mp3$/, ".words.json");
}

export function cachedWords(url: string): KaraokeWord[] | null | undefined {
  return cache.get(url);
}

export function loadWords(url: string): Promise<KaraokeWord[] | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url) ?? null);
  const p =
    pending.get(url) ??
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
      .then((j) => {
        const ok = Array.isArray(j) && j.every((x) => x && typeof x.w === "string" && Number.isFinite(x.start) && Number.isFinite(x.end));
        const words = ok ? (j as KaraokeWord[]) : null;
        cache.set(url, words);
        return words;
      })
      .catch(() => {
        cache.set(url, null);
        return null;
      });
  pending.set(url, p);
  return p;
}

function syllables(w: string): number {
  return Math.max(1, (w.toLowerCase().match(/[aeiouyàèéìòóù]+/g) ?? []).length);
}

/** Ripiego: parole distribuite per sillabe su [0.1 s, durata − 0.2 s]. */
export function estimateWords(text: string, duration: number): KaraokeWord[] {
  const toks = text.split(/\s+/).filter(Boolean);
  const weights = toks.map((t) => syllables(t) + 0.3);
  const tot = weights.reduce((a, b) => a + b, 0) || 1;
  const t0 = 0.1;
  const span = Math.max(0.5, duration - 0.3);
  let t = t0;
  return toks.map((w, i) => {
    const d = (span * weights[i]) / tot;
    const word = { w, start: t, end: t + d };
    t += d;
    return word;
  });
}

/** Parole della battuta: dal file se combacia col testo mostrato, altrimenti stimate. */
export function wordsFor(text: string, duration: number, loaded: KaraokeWord[] | null | undefined): KaraokeWord[] {
  const toks = text.split(/\s+/).filter(Boolean);
  if (loaded && loaded.length === toks.length) return loaded.map((x, i) => ({ ...x, w: toks[i] }));
  return estimateWords(text, duration);
}

/** Indice della parola in corso a `t` secondi dall'inizio della clip (−1 prima della prima). */
export function wordIndexAt(words: KaraokeWord[], t: number): number {
  let idx = -1;
  for (let i = 0; i < words.length; i++) if (words[i].start <= t) idx = i;
  return idx;
}

/**
 * Spezza la battuta in blocchi da al massimo ~`maxChars` caratteri (2–3 righe sul TV),
 * preferendo andare a capo dopo la punteggiatura. Restituisce gli indici di inizio dei blocchi.
 */
export function chunkStarts(words: KaraokeWord[], maxChars = 54): number[] {
  const starts = [0];
  let len = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i].w;
    const add = (len ? 1 : 0) + w.length;
    if (len + add > maxChars && len > 0) {
      // torna indietro fino all'ultima punteggiatura del blocco, se non troppo lontana
      let cut = i;
      for (let k = i - 1; k > starts[starts.length - 1] + 2 && i - k <= 4; k--) {
        if (/[.,;:!?]$/.test(words[k].w)) {
          cut = k + 1;
          break;
        }
      }
      starts.push(cut);
      len = words.slice(cut, i + 1).reduce((a, x, j) => a + (j ? 1 : 0) + x.w.length, 0);
    } else {
      len += add;
    }
  }
  return starts;
}
