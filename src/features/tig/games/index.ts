import type { MechanicUi } from "./ui-contract";
import { alibiImpossibileUi } from "./mechanics/alibi-impossibile";
import { astaAlBuioUi } from "./mechanics/asta-al-buio";
import { catenaDiCodiciUi } from "./mechanics/catena-di-codici";
import { cifraImprobabileUi } from "./mechanics/cifra-improbabile";
import { crediciONoUi } from "./mechanics/credici-o-no";
import { dilemmaPubblicoUi } from "./mechanics/dilemma-pubblico";
import { doppioRischioUi } from "./mechanics/doppio-rischio";
import { indizioDopoIndizioUi } from "./mechanics/indizio-dopo-indizio";
import { laContraddizioneUi } from "./mechanics/la-contraddizione";
import { memoriaLampoUi } from "./mechanics/memoria-lampo";
import { ordineNelCaosUi } from "./mechanics/ordine-nel-caos";
import { prevediLaMaggioranzaUi } from "./mechanics/prevedi-la-maggioranza";
import { puntataNascostaUi } from "./mechanics/puntata-nascosta";
import { scegliIlBersaglioUi } from "./mechanics/scegli-il-bersaglio";
import { screenshotTraditoreUi } from "./mechanics/screenshot-traditore";
import { scudoRapidoUi } from "./mechanics/scudo-rapido";
import { sicuroORischioUi } from "./mechanics/sicuro-o-rischio";
import { sincronizzatiUi } from "./mechanics/sincronizzati";
import { sogliaDiRischioUi } from "./mechanics/soglia-di-rischio";
import { tempoFantasmaUi } from "./mechanics/tempo-fantasma";
import { treVersioniUi } from "./mechanics/tre-versioni";
import { UI_MANCHE_1 } from "./manche-1";
import { UI_MANCHE_2 } from "./manche-2";
import { UI_MANCHE_3 } from "./manche-3";
import { UI_MANCHE_4 } from "./manche-4";
import { UI_MANCHE_5 } from "./manche-5";

/**
 * TAVOLI IN GUERRA! — schermate dei minigiochi (telefono/PC e TV) per `code` di meccanica.
 * Nessun contenuto né soluzione qui: arrivano solo dalle viste del server.
 * I componenti vanno montati dentro un elemento con `TIG_FONT_VARS` (./kit/fonts) per i caratteri;
 * la TV si adatta al proprio contenitore (posizionato, a tutto schermo sopra l'arena).
 */
export const MECHANIC_UIS: Record<string, MechanicUi> = {
  "memoria-lampo": memoriaLampoUi,
  "screenshot-traditore": screenshotTraditoreUi,
  "tempo-fantasma": tempoFantasmaUi,
  "ordine-nel-caos": ordineNelCaosUi,
  "cifra-improbabile": cifraImprobabileUi,
  "indizio-dopo-indizio": indizioDopoIndizioUi,
  "scegli-il-bersaglio": scegliIlBersaglioUi,
  "scudo-rapido": scudoRapidoUi,
  "asta-al-buio": astaAlBuioUi,
  "doppio-rischio": doppioRischioUi,
  "prevedi-la-maggioranza": prevediLaMaggioranzaUi,
  sincronizzati: sincronizzatiUi,
  "dilemma-pubblico": dilemmaPubblicoUi,
  "catena-di-codici": catenaDiCodiciUi,
  "credici-o-no": crediciONoUi,
  "tre-versioni": treVersioniUi,
  "la-contraddizione": laContraddizioneUi,
  "alibi-impossibile": alibiImpossibileUi,
  "puntata-nascosta": puntataNascostaUi,
  "soglia-di-rischio": sogliaDiRischioUi,
  "sicuro-o-rischio": sicuroORischioUi,
  ...UI_MANCHE_1,
  ...UI_MANCHE_2,
  ...UI_MANCHE_3,
  ...UI_MANCHE_4,
  ...UI_MANCHE_5,
};

export type { MechanicUi } from "./ui-contract";
