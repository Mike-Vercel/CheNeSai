import type { MechanicUi } from "./ui-contract";
import { classificaBuiaUi } from "./mechanics/classifica-buia";
import { duelloSilenziosoUi } from "./mechanics/duello-silenzioso";
import { falsoFinaleUi } from "./mechanics/falso-finale";
import { ilFiloRossoUi } from "./mechanics/il-filo-rosso";
import { ilMercatoFinaleUi } from "./mechanics/il-mercato-finale";
import { lImboscataUi } from "./mechanics/l-imboscata";
import { lUltimaDecisioneUi } from "./mechanics/l-ultima-decisione";
import { laCassaChiusaUi } from "./mechanics/la-cassa-chiusa";
import { laPenultimaMossaUi } from "./mechanics/la-penultima-mossa";
import { puntoDiRotturaUi } from "./mechanics/punto-di-rottura";
import { soloUnDettaglioUi } from "./mechanics/solo-un-dettaglio";
import { treCarteUnDestinoUi } from "./mechanics/tre-carte-un-destino";
import { ultimaChiamataUi } from "./mechanics/ultima-chiamata";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 5, per `code`. Vedi src/lib/tig/games/mechanics/manche-5.ts. */
export const UI_MANCHE_5: Record<string, MechanicUi> = {
  "ultima-chiamata": ultimaChiamataUi,
  "la-cassa-chiusa": laCassaChiusaUi,
  "solo-un-dettaglio": soloUnDettaglioUi,
  "punto-di-rottura": puntoDiRotturaUi,
  "duello-silenzioso": duelloSilenziosoUi,
  "l-imboscata": lImboscataUi,
  "tre-carte-un-destino": treCarteUnDestinoUi,
  "il-mercato-finale": ilMercatoFinaleUi,
  "il-filo-rosso": ilFiloRossoUi,
  "classifica-buia": classificaBuiaUi,
  "la-penultima-mossa": laPenultimaMossaUi,
  "falso-finale": falsoFinaleUi,
  "l-ultima-decisione": lUltimaDecisioneUi,
};
