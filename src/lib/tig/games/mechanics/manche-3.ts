import type { MechanicModule } from "../extras";
import { chiHaVotatoCosa } from "./chi-ha-votato-cosa";
import { ilCapitanoCiConosce } from "./il-capitano-ci-conosce";
import { quantoSietePrevedibili } from "./quanto-siete-prevedibili";
import { pubControTavolo } from "./pub-contro-tavolo";
import { parolaCheGira } from "./parola-che-gira";
import { indovinaIlPreferito } from "./indovina-il-preferito";
import { questioneDiIstinto } from "./questione-di-istinto";
import { allineamentoPerfetto } from "./allineamento-perfetto";
import { ilPubHaTorto } from "./il-pub-ha-torto";

/**
 * Meccaniche della MANCHE 3 aggiunte dopo le prime 21 (un file per manche: chi lavora su una manche tocca solo
 * questo registro, niente conflitti). Ordine libero: il registro centrale le ordina per numero di catalogo.
 */
export const NUOVE_MANCHE_3 = [chiHaVotatoCosa, ilCapitanoCiConosce, quantoSietePrevedibili, pubControTavolo, parolaCheGira, indovinaIlPreferito, questioneDiIstinto, allineamentoPerfetto, ilPubHaTorto] as unknown as MechanicModule[];
