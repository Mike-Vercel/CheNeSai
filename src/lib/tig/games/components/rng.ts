/**
 * Casualità DETERMINISTICA per le meccaniche (stesso seme → stesso risultato, su server e client).
 * Niente Math.random: le meccaniche sono pure e i test devono poter ripetere ogni esito.
 */

/** FNV-1a a 32 bit: hash stabile di una stringa. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generatore mulberry32: numeri in [0, 1) da un seme intero. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generatore da un seme testuale (es. `ctx.seed + ":opzioni"`). */
export function rngFrom(seed: string): () => number {
  return mulberry32(hashString(seed));
}

/** Mescola (Fisher–Yates) senza toccare l'array originale. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = items.slice();
  const rnd = rngFrom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Mescola garantendo un ordine DIVERSO da quello di partenza (per i riordini: la vista non deve
 * coincidere con la soluzione). Con 0–1 elementi restituisce la copia.
 */
export function shuffleNotIdentity<T>(items: readonly T[], seed: string): T[] {
  if (items.length < 2) return items.slice();
  const out = seededShuffle(items, seed);
  if (out.every((v, i) => v === items[i])) {
    // rotazione di un passo: sicuramente diversa
    out.push(out.shift() as T);
  }
  return out;
}

/** Intero in [min, max] dal generatore. */
export function randInt(rnd: () => number, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}
