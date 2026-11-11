/**
 * Livelli di difficoltà delle domande (colonna `difficulty` 1–5 dell'archivio).
 * Un solo posto per i nomi, usati in archivio, editor, filtri e serata rapida.
 */
export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  1: "Facile",
  2: "Media",
  3: "Difficile",
  4: "Difficilissima",
  5: "Impossibile",
};

/** Nome del livello ("Difficile"); valori fuori scala vengono riportati nell'intervallo 1–5. */
export function difficultyLabel(value: number): string {
  const v = Math.min(5, Math.max(1, Math.round(value))) as DifficultyLevel;
  return DIFFICULTY_LABEL[v];
}
