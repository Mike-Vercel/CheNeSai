import { clamp, POINTS } from "./scoring";

/**
 * COMPONENTE BASE 3 — STIMA E TEMPO (numero stimato, timer da fermare).
 * Punti proporzionali alla vicinanza, con tetto a 100: mai premi per «quanti siamo», solo per quanto si è vicini.
 */

/**
 * Stima numerica: 100 se esatta, poi cala linearmente con l'errore RELATIVO fino a 0 quando
 * l'errore raggiunge `zeroAt` (0,5 = sbagliare della metà non vale nulla).
 */
export function proximityPoints(guess: number, truth: number, zeroAt = 0.5): { points: number; accuracy: number; errorRatio: number } {
  if (!(truth > 0) || !Number.isFinite(guess)) return { points: 0, accuracy: 0, errorRatio: 1 };
  const errorRatio = Math.abs(guess - truth) / truth;
  const accuracy = clamp(1 - errorRatio / zeroAt, 0, 1);
  return { points: Math.round(POINTS.standard * accuracy), accuracy: round3(accuracy), errorRatio: round3(errorRatio) };
}

/**
 * Timer da fermare: 100 con scarto zero, 0 quando lo scarto raggiunge `zeroAtMs`.
 * Lo scarto è assoluto (prima o dopo il bersaglio pesa uguale).
 */
export function stopPoints(deviationMs: number, zeroAtMs = 3000): { points: number; accuracy: number } {
  const accuracy = clamp(1 - Math.abs(deviationMs) / zeroAtMs, 0, 1);
  return { points: Math.round(POINTS.standard * accuracy), accuracy: round3(accuracy) };
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** «1,4 s» in italiano. */
export function formatSeconds(ms: number): string {
  return `${(Math.round(Math.abs(ms) / 100) / 10).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}
