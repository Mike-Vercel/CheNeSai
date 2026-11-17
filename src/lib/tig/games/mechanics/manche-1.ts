import type { MechanicModule } from "../extras";
import { effettoDomino } from "./effetto-domino";
import { feedIn5Secondi } from "./feed-in-5-secondi";
import { ilDettaglioDa100 } from "./il-dettaglio-da-100";
import { laSequenzaSporca } from "./la-sequenza-sporca";
import { nonEQuelloCheSembra } from "./non-e-quello-che-sembra";
import { pixelKiller } from "./pixel-killer";
import { rumoreDiFondo } from "./rumore-di-fondo";
import { sottoLaSuperficie } from "./sotto-la-superficie";
import { titoliTagliati } from "./titoli-tagliati";
import { unSecondoPrima } from "./un-secondo-prima";

/**
 * Meccaniche della MANCHE 1 aggiunte dopo le prime 21 (un file per manche: chi lavora su una manche tocca solo
 * questo registro, niente conflitti). Ordine libero: il registro centrale le ordina per numero di catalogo.
 */
export const NUOVE_MANCHE_1 = [
  pixelKiller,
  unSecondoPrima,
  titoliTagliati,
  nonEQuelloCheSembra,
  laSequenzaSporca,
  ilDettaglioDa100,
  rumoreDiFondo,
  feedIn5Secondi,
  effettoDomino,
  sottoLaSuperficie,
] as unknown as MechanicModule[];
