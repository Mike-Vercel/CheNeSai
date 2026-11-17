import effettoDomino from "./effetto-domino";
import laSequenzaSporca from "./la-sequenza-sporca";
import sottoLaSuperficie from "./sotto-la-superficie";
import titoliTagliati from "./titoli-tagliati";

/**
 * Contenuti (CON LE SOLUZIONI, solo server) delle meccaniche nuove della MANCHE 1: `codice -> varianti`.
 * Ogni meccanica ha il suo file `content/tig/minigiochi/<codice>.ts` (come le prime 21) e si aggiunge qui.
 * Un indice per manche: chi lavora su una manche tocca solo questo file. Mai importare questi file dal client.
 */
export const CONTENUTI_MANCHE_1: Record<string, readonly unknown[]> = {
  "titoli-tagliati": titoliTagliati,
  "la-sequenza-sporca": laSequenzaSporca,
  "effetto-domino": effettoDomino,
  "sotto-la-superficie": sottoLaSuperficie,
};
