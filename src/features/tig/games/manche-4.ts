import type { MechanicUi } from "./ui-contract";
import { ultimoIndizioUi } from "./mechanics/ultimo-indizio";
import { ilMessaggioInterrottoUi } from "./mechanics/il-messaggio-interrotto";
import { laFintaProvaUi } from "./mechanics/la-finta-prova";
import { archivioManomessoUi } from "./mechanics/archivio-manomesso";
import { chiCambiaVersioneUi } from "./mechanics/chi-cambia-versione";
import { compraUnIndizioUi } from "./mechanics/compra-un-indizio";
import { negozioDiSospettiUi } from "./mechanics/negozio-di-sospetti";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 4, per `code`. Vedi src/lib/tig/games/mechanics/manche-4.ts. */
export const UI_MANCHE_4: Record<string, MechanicUi> = {
  "archivio-manomesso": archivioManomessoUi,
  "chi-cambia-versione": chiCambiaVersioneUi,
  "compra-un-indizio": compraUnIndizioUi,
  "il-messaggio-interrotto": ilMessaggioInterrottoUi,
  "la-finta-prova": laFintaProvaUi,
  "negozio-di-sospetti": negozioDiSospettiUi,
  "ultimo-indizio": ultimoIndizioUi,
};
