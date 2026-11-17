import type { MechanicUi } from "./ui-contract";
import { chiHaVotatoCosaUi } from "./mechanics/chi-ha-votato-cosa";
import { ilCapitanoCiConosceUi } from "./mechanics/il-capitano-ci-conosce";
import { quantoSietePrevedibiliUi } from "./mechanics/quanto-siete-prevedibili";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 3, per `code`. Vedi src/lib/tig/games/mechanics/manche-3.ts. */
export const UI_MANCHE_3: Record<string, MechanicUi> = {
  "chi-ha-votato-cosa": chiHaVotatoCosaUi,
  "il-capitano-ci-conosce": ilCapitanoCiConosceUi,
  "quanto-siete-prevedibili": quantoSietePrevedibiliUi,
};
