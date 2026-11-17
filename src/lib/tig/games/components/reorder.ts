import { POINTS } from "./scoring";

/**
 * COMPONENTE BASE 2 — RIORDINO.
 * Punti per ogni posizione giusta + bonus per la sequenza perfetta (PDF n. 05).
 * Con 4 elementi: 20 a posizione (max 80) + 20 di bonus = 100.
 */
export const REORDER_PERFECT_BONUS = 20;

export function correctPositions(submitted: readonly string[], solution: readonly string[]): number {
  let n = 0;
  for (let i = 0; i < solution.length; i++) if (submitted[i] === solution[i]) n++;
  return n;
}

/** È una permutazione degli stessi id (nessun doppione, nessun id estraneo)? */
export function isPermutation(submitted: readonly string[], ids: readonly string[]): boolean {
  if (submitted.length !== ids.length) return false;
  const set = new Set(submitted);
  return set.size === ids.length && ids.every((id) => set.has(id));
}

export function reorderPoints(correct: number, total: number): number {
  if (total <= 0) return 0;
  const perPosition = (POINTS.standard - REORDER_PERFECT_BONUS) / total;
  return Math.round(correct * perPosition) + (correct === total ? REORDER_PERFECT_BONUS : 0);
}
