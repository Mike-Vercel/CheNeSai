import ultimoIndizio from "./ultimo-indizio";
import ilMessaggioInterrotto from "./il-messaggio-interrotto";
import laFintaProva from "./la-finta-prova";
import archivioManomesso from "./archivio-manomesso";
import chiCambiaVersione from "./chi-cambia-versione";
import compraUnIndizio from "./compra-un-indizio";
import negozioDiSospetti from "./negozio-di-sospetti";

/**
 * Contenuti (CON LE SOLUZIONI, solo server) delle meccaniche nuove della MANCHE 4: `codice -> varianti`.
 * Ogni meccanica ha il suo file `content/tig/minigiochi/<codice>.ts` (come le prime 21) e si aggiunge qui.
 * Un indice per manche: chi lavora su una manche tocca solo questo file. Mai importare questi file dal client.
 */
export const CONTENUTI_MANCHE_4: Record<string, readonly unknown[]> = {
  "archivio-manomesso": archivioManomesso,
  "chi-cambia-versione": chiCambiaVersione,
  "compra-un-indizio": compraUnIndizio,
  "il-messaggio-interrotto": ilMessaggioInterrotto,
  "la-finta-prova": laFintaProva,
  "negozio-di-sospetti": negozioDiSospetti,
  "ultimo-indizio": ultimoIndizio,
};
