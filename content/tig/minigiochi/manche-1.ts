import effettoDomino from "./effetto-domino";
import feedIn5Secondi from "./feed-in-5-secondi";
import ilDettaglioDa100 from "./il-dettaglio-da-100";
import laSequenzaSporca from "./la-sequenza-sporca";
import nonEQuelloCheSembra from "./non-e-quello-che-sembra";
import pixelKiller from "./pixel-killer";
import rumoreDiFondo from "./rumore-di-fondo";
import sottoLaSuperficie from "./sotto-la-superficie";
import titoliTagliati from "./titoli-tagliati";
import unSecondoPrima from "./un-secondo-prima";

/**
 * Contenuti (CON LE SOLUZIONI, solo server) delle meccaniche nuove della MANCHE 1: `codice -> varianti`.
 * Ogni meccanica ha il suo file `content/tig/minigiochi/<codice>.ts` (come le prime 21) e si aggiunge qui.
 * Un indice per manche: chi lavora su una manche tocca solo questo file. Mai importare questi file dal client.
 */
export const CONTENUTI_MANCHE_1: Record<string, readonly unknown[]> = {
  "pixel-killer": pixelKiller,
  "un-secondo-prima": unSecondoPrima,
  "titoli-tagliati": titoliTagliati,
  "non-e-quello-che-sembra": nonEQuelloCheSembra,
  "la-sequenza-sporca": laSequenzaSporca,
  "il-dettaglio-da-100": ilDettaglioDa100,
  "rumore-di-fondo": rumoreDiFondo,
  "feed-in-5-secondi": feedIn5Secondi,
  "effetto-domino": effettoDomino,
  "sotto-la-superficie": sottoLaSuperficie,
};
