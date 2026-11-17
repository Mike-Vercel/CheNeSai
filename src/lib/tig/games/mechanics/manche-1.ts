import type { MechanicModule } from "../extras";
import { effettoDomino } from "./effetto-domino";
import { laSequenzaSporca } from "./la-sequenza-sporca";
import { sottoLaSuperficie } from "./sotto-la-superficie";
import { titoliTagliati } from "./titoli-tagliati";

/**
 * Meccaniche della MANCHE 1 aggiunte dopo le prime 21 (un file per manche: chi lavora su una manche tocca solo
 * questo registro, niente conflitti). Ordine libero: il registro centrale le ordina per numero di catalogo.
 */
export const NUOVE_MANCHE_1 = [titoliTagliati, laSequenzaSporca, effettoDomino, sottoLaSuperficie] as unknown as MechanicModule[];
