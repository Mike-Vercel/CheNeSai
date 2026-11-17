import type { MechanicModule } from "../extras";
import { bottoneDelCaos } from "./bottone-del-caos";
import { cacciaAllaCapolista } from "./caccia-alla-capolista";
import { contrattacco } from "./contrattacco";
import { falsoVantaggio } from "./falso-vantaggio";
import { furtoConDestrezza } from "./furto-con-destrezza";
import { ilPattoDi60Secondi } from "./il-patto-di-60-secondi";
import { laSfidaIncrociata } from "./la-sfida-incrociata";
import { laTrappola } from "./la-trappola";
import { scambioDiPosta } from "./scambio-di-posta";
import { scegliIlTerreno } from "./scegli-il-terreno";
import { tagliaIlTempo } from "./taglia-il-tempo";
import { ultimaParola } from "./ultima-parola";

/**
 * Meccaniche della MANCHE 2 aggiunte dopo le prime 21 (un file per manche: chi lavora su una manche tocca solo
 * questo registro, niente conflitti). Ordine libero: il registro centrale le ordina per numero di catalogo.
 */
export const NUOVE_MANCHE_2 = [
  tagliaIlTempo,
  contrattacco,
  cacciaAllaCapolista,
  furtoConDestrezza,
  scegliIlTerreno,
  laTrappola,
  ilPattoDi60Secondi,
  laSfidaIncrociata,
  bottoneDelCaos,
  scambioDiPosta,
  falsoVantaggio,
  ultimaParola,
] as unknown as MechanicModule[];
