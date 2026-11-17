import classificaBuia from "./classifica-buia";
import duelloSilenzioso from "./duello-silenzioso";
import falsoFinale from "./falso-finale";
import ilFiloRosso from "./il-filo-rosso";
import ilMercatoFinale from "./il-mercato-finale";
import lImboscata from "./l-imboscata";
import lUltimaDecisione from "./l-ultima-decisione";
import laCassaChiusa from "./la-cassa-chiusa";
import laPenultimaMossa from "./la-penultima-mossa";
import puntoDiRottura from "./punto-di-rottura";
import soloUnDettaglio from "./solo-un-dettaglio";
import treCarteUnDestino from "./tre-carte-un-destino";
import ultimaChiamata from "./ultima-chiamata";

/**
 * Contenuti (CON LE SOLUZIONI, solo server) delle meccaniche nuove della MANCHE 5: `codice -> varianti`.
 * Ogni meccanica ha il suo file `content/tig/minigiochi/<codice>.ts` (come le prime 21) e si aggiunge qui.
 * Un indice per manche: chi lavora su una manche tocca solo questo file. Mai importare questi file dal client.
 */
export const CONTENUTI_MANCHE_5: Record<string, readonly unknown[]> = {
  "ultima-chiamata": ultimaChiamata,
  "la-cassa-chiusa": laCassaChiusa,
  "solo-un-dettaglio": soloUnDettaglio,
  "punto-di-rottura": puntoDiRottura,
  "duello-silenzioso": duelloSilenzioso,
  "l-imboscata": lImboscata,
  "tre-carte-un-destino": treCarteUnDestino,
  "il-mercato-finale": ilMercatoFinale,
  "il-filo-rosso": ilFiloRosso,
  "classifica-buia": classificaBuia,
  "la-penultima-mossa": laPenultimaMossa,
  "falso-finale": falsoFinale,
  "l-ultima-decisione": lUltimaDecisione,
};
