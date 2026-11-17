import ultimoIndizio from "./ultimo-indizio";
import ilMessaggioInterrotto from "./il-messaggio-interrotto";
import laFintaProva from "./la-finta-prova";
import archivioManomesso from "./archivio-manomesso";
import chiCambiaVersione from "./chi-cambia-versione";
import compraUnIndizio from "./compra-un-indizio";
import negozioDiSospetti from "./negozio-di-sospetti";
import fiduciaCieca from "./fiducia-cieca";
import doppioGioco from "./doppio-gioco";
import laBugiaPiuCredibile from "./la-bugia-piu-credibile";
import laFraseAMeta from "./la-frase-a-meta";
import ilTestimone from "./il-testimone";

/**
 * Contenuti (CON LE SOLUZIONI, solo server) delle meccaniche nuove della MANCHE 4: `codice -> varianti`.
 * Ogni meccanica ha il suo file `content/tig/minigiochi/<codice>.ts` (come le prime 21) e si aggiunge qui.
 * Un indice per manche: chi lavora su una manche tocca solo questo file. Mai importare questi file dal client.
 */
export const CONTENUTI_MANCHE_4: Record<string, readonly unknown[]> = {
  "archivio-manomesso": archivioManomesso,
  "chi-cambia-versione": chiCambiaVersione,
  "compra-un-indizio": compraUnIndizio,
  "doppio-gioco": doppioGioco,
  "fiducia-cieca": fiduciaCieca,
  "il-messaggio-interrotto": ilMessaggioInterrotto,
  "il-testimone": ilTestimone,
  "la-bugia-piu-credibile": laBugiaPiuCredibile,
  "la-finta-prova": laFintaProva,
  "la-frase-a-meta": laFraseAMeta,
  "negozio-di-sospetti": negozioDiSospetti,
  "ultimo-indizio": ultimoIndizio,
};
