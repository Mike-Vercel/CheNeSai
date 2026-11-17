import cacciaAllaCapolista from "./caccia-alla-capolista";
import contrattacco from "./contrattacco";
import furtoConDestrezza from "./furto-con-destrezza";
import laTrappola from "./la-trappola";
import scambioDiPosta from "./scambio-di-posta";
import tagliaIlTempo from "./taglia-il-tempo";

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
  "la-trappola": laTrappola,
  "scambio-di-posta": scambioDiPosta,
};
