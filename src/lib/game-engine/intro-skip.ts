/**
 * "Salta intro" a votazione (funzioni pure): durante l'intro ogni giocatore può chiedere di
 * saltarla; si salta SOLO se votano tutti i giocatori attivi (bot esclusi). Chi entra a intro in
 * corso si aggiunge al conteggio; chi ritira il voto lo toglie.
 */

/** Motivo passato a START_ROUND quando l'intro si salta per voto unanime. */
export const INTRO_SKIP_REASON = "intro_skip";

/** Si salta? Serve almeno un giocatore e il voto di tutti. */
export function introSkipUnanimous(votes: number, needed: number): boolean {
  return needed > 0 && votes >= needed;
}
