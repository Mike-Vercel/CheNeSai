import type { MechanicUi } from "./ui-contract";
import { effettoDominoUi } from "./mechanics/effetto-domino";
import { laSequenzaSporcaUi } from "./mechanics/la-sequenza-sporca";
import { sottoLaSuperficieUi } from "./mechanics/sotto-la-superficie";
import { titoliTagliatiUi } from "./mechanics/titoli-tagliati";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 1, per `code`. Vedi src/lib/tig/games/mechanics/manche-1.ts. */
export const UI_MANCHE_1: Record<string, MechanicUi> = {
  "titoli-tagliati": titoliTagliatiUi,
  "la-sequenza-sporca": laSequenzaSporcaUi,
  "effetto-domino": effettoDominoUi,
  "sotto-la-superficie": sottoLaSuperficieUi,
};
