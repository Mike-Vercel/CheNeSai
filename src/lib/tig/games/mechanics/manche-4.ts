import type { MechanicModule } from "../extras";
import { ultimoIndizio } from "./ultimo-indizio";
import { ilMessaggioInterrotto } from "./il-messaggio-interrotto";
import { laFintaProva } from "./la-finta-prova";
import { archivioManomesso } from "./archivio-manomesso";
import { chiCambiaVersione } from "./chi-cambia-versione";
import { compraUnIndizio } from "./compra-un-indizio";
import { negozioDiSospetti } from "./negozio-di-sospetti";
import { fiduciaCieca } from "./fiducia-cieca";
import { doppioGioco } from "./doppio-gioco";
import { laBugiaPiuCredibile } from "./la-bugia-piu-credibile";
import { laFraseAMeta } from "./la-frase-a-meta";
import { ilTestimone } from "./il-testimone";

/**
 * Meccaniche della MANCHE 4 aggiunte dopo le prime 21 (un file per manche: chi lavora su una manche tocca solo
 * questo registro, niente conflitti). Ordine libero: il registro centrale le ordina per numero di catalogo.
 */
export const NUOVE_MANCHE_4 = [archivioManomesso, chiCambiaVersione, compraUnIndizio, doppioGioco, fiduciaCieca, ilMessaggioInterrotto, ilTestimone, laBugiaPiuCredibile, laFintaProva, laFraseAMeta, negozioDiSospetti, ultimoIndizio] as unknown as MechanicModule[];
