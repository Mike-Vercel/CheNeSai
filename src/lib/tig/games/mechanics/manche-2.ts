import type { MechanicModule } from "../extras";
import { cacciaAllaCapolista } from "./caccia-alla-capolista";
import { contrattacco } from "./contrattacco";
import { furtoConDestrezza } from "./furto-con-destrezza";
import { laTrappola } from "./la-trappola";
import { scambioDiPosta } from "./scambio-di-posta";
import { tagliaIlTempo } from "./taglia-il-tempo";

/**
 * Meccaniche della MANCHE 2 aggiunte dopo le prime 21 (un file per manche: chi lavora su una manche tocca solo
 * questo registro, niente conflitti). Ordine libero: il registro centrale le ordina per numero di catalogo.
 */
export const NUOVE_MANCHE_2 = [tagliaIlTempo, contrattacco, cacciaAllaCapolista, furtoConDestrezza, laTrappola, scambioDiPosta] as unknown as MechanicModule[];
