import type { MechanicUi } from "./ui-contract";
import { ultimoIndizioUi } from "./mechanics/ultimo-indizio";
import { ilMessaggioInterrottoUi } from "./mechanics/il-messaggio-interrotto";
import { laFintaProvaUi } from "./mechanics/la-finta-prova";
import { archivioManomessoUi } from "./mechanics/archivio-manomesso";
import { chiCambiaVersioneUi } from "./mechanics/chi-cambia-versione";
import { compraUnIndizioUi } from "./mechanics/compra-un-indizio";
import { negozioDiSospettiUi } from "./mechanics/negozio-di-sospetti";
import { fiduciaCiecaUi } from "./mechanics/fiducia-cieca";
import { doppioGiocoUi } from "./mechanics/doppio-gioco";
import { laBugiaPiuCredibileUi } from "./mechanics/la-bugia-piu-credibile";
import { laFraseAMetaUi } from "./mechanics/la-frase-a-meta";
import { ilTestimoneUi } from "./mechanics/il-testimone";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 4, per `code`. Vedi src/lib/tig/games/mechanics/manche-4.ts. */
export const UI_MANCHE_4: Record<string, MechanicUi> = {
  "archivio-manomesso": archivioManomessoUi,
  "chi-cambia-versione": chiCambiaVersioneUi,
  "compra-un-indizio": compraUnIndizioUi,
  "doppio-gioco": doppioGiocoUi,
  "fiducia-cieca": fiduciaCiecaUi,
  "il-messaggio-interrotto": ilMessaggioInterrottoUi,
  "il-testimone": ilTestimoneUi,
  "la-bugia-piu-credibile": laBugiaPiuCredibileUi,
  "la-finta-prova": laFintaProvaUi,
  "la-frase-a-meta": laFraseAMetaUi,
  "negozio-di-sospetti": negozioDiSospettiUi,
  "ultimo-indizio": ultimoIndizioUi,
};
