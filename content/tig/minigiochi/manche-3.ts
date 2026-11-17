import chiHaVotatoCosa from "./chi-ha-votato-cosa";
import ilCapitanoCiConosce from "./il-capitano-ci-conosce";
import quantoSietePrevedibili from "./quanto-siete-prevedibili";
import pubControTavolo from "./pub-contro-tavolo";
import parolaCheGira from "./parola-che-gira";
import indovinaIlPreferito from "./indovina-il-preferito";

/**
 * Contenuti (CON LE SOLUZIONI, solo server) delle meccaniche nuove della MANCHE 3: `codice -> varianti`.
 * Ogni meccanica ha il suo file `content/tig/minigiochi/<codice>.ts` (come le prime 21) e si aggiunge qui.
 * Un indice per manche: chi lavora su una manche tocca solo questo file. Mai importare questi file dal client.
 */
export const CONTENUTI_MANCHE_3: Record<string, readonly unknown[]> = {
  "chi-ha-votato-cosa": chiHaVotatoCosa,
  "il-capitano-ci-conosce": ilCapitanoCiConosce,
  "quanto-siete-prevedibili": quantoSietePrevedibili,
  "pub-contro-tavolo": pubControTavolo,
  "parola-che-gira": parolaCheGira,
  "indovina-il-preferito": indovinaIlPreferito,
};
