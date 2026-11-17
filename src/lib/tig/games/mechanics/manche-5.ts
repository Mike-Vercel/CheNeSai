import type { MechanicModule } from "../extras";
import { classificaBuia } from "./classifica-buia";
import { duelloSilenzioso } from "./duello-silenzioso";
import { falsoFinale } from "./falso-finale";
import { ilFiloRosso } from "./il-filo-rosso";
import { ilMercatoFinale } from "./il-mercato-finale";
import { lImboscata } from "./l-imboscata";
import { lUltimaDecisione } from "./l-ultima-decisione";
import { laCassaChiusa } from "./la-cassa-chiusa";
import { laPenultimaMossa } from "./la-penultima-mossa";
import { puntoDiRottura } from "./punto-di-rottura";
import { soloUnDettaglio } from "./solo-un-dettaglio";
import { treCarteUnDestino } from "./tre-carte-un-destino";
import { ultimaChiamata } from "./ultima-chiamata";

/**
 * Meccaniche della MANCHE 5 aggiunte dopo le prime 21 (un file per manche: chi lavora su una manche tocca solo
 * questo registro, niente conflitti). Ordine libero: il registro centrale le ordina per numero di catalogo.
 */
export const NUOVE_MANCHE_5 = [
  ultimaChiamata,
  laCassaChiusa,
  // soloUnDettaglio, (in corso: contenuti da completare)
  // puntoDiRottura, (in corso: contenuti da completare)
  // duelloSilenzioso, (in corso: contenuti da completare)
  lImboscata,
  treCarteUnDestino,
  ilMercatoFinale,
  ilFiloRosso,
  classificaBuia,
  laPenultimaMossa,
  falsoFinale,
  lUltimaDecisione,
] as unknown as MechanicModule[];

/** In corso (contenuti da completare): fuori dal registro finché non sono pronte. */
export const IN_CORSO_MANCHE_5 = [soloUnDettaglio, puntoDiRottura, duelloSilenzioso] as unknown as MechanicModule[];
