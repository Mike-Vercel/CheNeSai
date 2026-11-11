import type { MomentContext } from "./moment";

/**
 * Cartello "DOMANDA N. X" prima di ogni domanda (TV, show sul telefono, /tv): parte con la fase
 * QUESTION_VISIBLE, resta almeno questo tempo (e finché l'annunciatore ha finito di dire il numero
 * o, sull'ultima domanda, la battuta di suspense), poi compare la domanda mentre il presentatore la legge.
 * Lo scorrimento automatico conta questo tempo prima di aprire le risposte (vedi autoplay.ts).
 */
export const QUESTION_INTRO_MS = { normal: 1500, lastOfRound: 2000, lastOfGame: 3000 } as const;

/** Tetto di sicurezza: anche se una clip non arriva, la domanda compare comunque entro questo tempo. */
export const QUESTION_INTRO_MAX_MS = { normal: 6000, lastOfGame: 12_000 } as const;

export function questionIntroMs(m: MomentContext): number {
  return m.lastOfGame ? QUESTION_INTRO_MS.lastOfGame : m.lastOfRound ? QUESTION_INTRO_MS.lastOfRound : QUESTION_INTRO_MS.normal;
}

export function questionIntroMaxMs(m: MomentContext): number {
  return m.lastOfGame ? QUESTION_INTRO_MAX_MS.lastOfGame : QUESTION_INTRO_MAX_MS.normal;
}

/**
 * Il cartello è ancora in scena? `elapsedMs` = tempo dall'inizio della fase (orologio del server),
 * `cardShown` = il TV ha già fatto comparire la domanda (fine del cartello e delle battute d'apertura).
 */
export function questionIntroVisible(elapsedMs: number, m: MomentContext, cardShown: boolean): boolean {
  if (cardShown) return false;
  return elapsedMs < questionIntroMaxMs(m);
}
