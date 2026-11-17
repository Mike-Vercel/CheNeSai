import bottoneDelCaos from "./bottone-del-caos";
import cacciaAllaCapolista from "./caccia-alla-capolista";
import contrattacco from "./contrattacco";
import falsoVantaggio from "./falso-vantaggio";
import furtoConDestrezza from "./furto-con-destrezza";
import ilPattoDi60Secondi from "./il-patto-di-60-secondi";
import laSfidaIncrociata from "./la-sfida-incrociata";
import laTrappola from "./la-trappola";
import scambioDiPosta from "./scambio-di-posta";
import scegliIlTerreno from "./scegli-il-terreno";
import tagliaIlTempo from "./taglia-il-tempo";
import ultimaParola from "./ultima-parola";

/**
 * Contenuti (CON LE SOLUZIONI, solo server) delle meccaniche nuove della MANCHE 2: `codice -> varianti`.
 * Ogni meccanica ha il suo file `content/tig/minigiochi/<codice>.ts` (come le prime 21) e si aggiunge qui.
 * Un indice per manche: chi lavora su una manche tocca solo questo file. Mai importare questi file dal client.
 */
export const CONTENUTI_MANCHE_2: Record<string, readonly unknown[]> = {
  "taglia-il-tempo": tagliaIlTempo,
  contrattacco,
  "caccia-alla-capolista": cacciaAllaCapolista,
  "furto-con-destrezza": furtoConDestrezza,
  "scegli-il-terreno": scegliIlTerreno,
  "la-trappola": laTrappola,
  "il-patto-di-60-secondi": ilPattoDi60Secondi,
  "la-sfida-incrociata": laSfidaIncrociata,
  "bottone-del-caos": bottoneDelCaos,
  "scambio-di-posta": scambioDiPosta,
  "falso-vantaggio": falsoVantaggio,
  "ultima-parola": ultimaParola,
};
