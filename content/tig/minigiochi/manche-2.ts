import cacciaAllaCapolista from "./caccia-alla-capolista";
import furtoConDestrezza from "./furto-con-destrezza";
import scambioDiPosta from "./scambio-di-posta";

/**
 * Contenuti (CON LE SOLUZIONI, solo server) delle meccaniche nuove della MANCHE 2: `codice -> varianti`.
 * Ogni meccanica ha il suo file `content/tig/minigiochi/<codice>.ts` (come le prime 21) e si aggiunge qui.
 * Un indice per manche: chi lavora su una manche tocca solo questo file. Mai importare questi file dal client.
 */
export const CONTENUTI_MANCHE_2: Record<string, readonly unknown[]> = {
  "caccia-alla-capolista": cacciaAllaCapolista,
  "furto-con-destrezza": furtoConDestrezza,
  "scambio-di-posta": scambioDiPosta,
};
