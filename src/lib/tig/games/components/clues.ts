import { POINTS } from "./scoring";

/**
 * COMPONENTE BASE 4 — INDIZI PROGRESSIVI CON BLOCCO.
 * Gli indizi si aprono a orari fissi della prova (tempo del server); il valore della risposta dipende
 * dall'ultimo indizio aperto quando la squadra blocca: 100 / 70 / 40 (PDF §04).
 */

/** Orari di apertura (ms dall'inizio) per `count` indizi distribuiti nella prova. */
export function clueSchedule(count: number, stepMs: number): number[] {
  return Array.from({ length: count }, (_, i) => i * stepMs);
}

/** Indice (0-based) dell'ultimo indizio aperto all'istante `elapsedMs`. */
export function clueIndexAt(elapsedMs: number, schedule: readonly number[]): number {
  let idx = 0;
  for (let i = 0; i < schedule.length; i++) if (elapsedMs >= schedule[i]) idx = i;
  return idx;
}

/** Punti per una risposta giusta bloccata con l'indizio `index` aperto. */
export function cluePoints(index: number): number {
  const table = POINTS.clues;
  return table[Math.min(Math.max(0, index), table.length - 1)];
}
