import type { MechanicModule } from "../extras";
import { cacciaAllaCapolista } from "./caccia-alla-capolista";
import { furtoConDestrezza } from "./furto-con-destrezza";
import { scambioDiPosta } from "./scambio-di-posta";

/**
 * Meccaniche della MANCHE 2 aggiunte dopo le prime 21 (un file per manche: chi lavora su una manche tocca solo
 * questo registro, niente conflitti). Ordine libero: il registro centrale le ordina per numero di catalogo.
 */
export const NUOVE_MANCHE_2 = [cacciaAllaCapolista, furtoConDestrezza, scambioDiPosta] as unknown as MechanicModule[];
