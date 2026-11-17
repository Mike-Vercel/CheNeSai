import type { MechanicModule } from "../extras";
import { chiHaVotatoCosa } from "./chi-ha-votato-cosa";
import { ilCapitanoCiConosce } from "./il-capitano-ci-conosce";
import { quantoSietePrevedibili } from "./quanto-siete-prevedibili";

/**
 * Meccaniche della MANCHE 3 aggiunte dopo le prime 21 (un file per manche: chi lavora su una manche tocca solo
 * questo registro, niente conflitti). Ordine libero: il registro centrale le ordina per numero di catalogo.
 */
export const NUOVE_MANCHE_3 = [chiHaVotatoCosa, ilCapitanoCiConosce, quantoSietePrevedibili] as unknown as MechanicModule[];
