import type { MechanicUi } from "./ui-contract";
import { effettoDominoUi } from "./mechanics/effetto-domino";
import { feedIn5SecondiUi } from "./mechanics/feed-in-5-secondi";
import { ilDettaglioDa100Ui } from "./mechanics/il-dettaglio-da-100";
import { laSequenzaSporcaUi } from "./mechanics/la-sequenza-sporca";
import { nonEQuelloCheSembraUi } from "./mechanics/non-e-quello-che-sembra";
import { sottoLaSuperficieUi } from "./mechanics/sotto-la-superficie";
import { titoliTagliatiUi } from "./mechanics/titoli-tagliati";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 1, per `code`. Vedi src/lib/tig/games/mechanics/manche-1.ts. */
export const UI_MANCHE_1: Record<string, MechanicUi> = {
  "titoli-tagliati": titoliTagliatiUi,
  "non-e-quello-che-sembra": nonEQuelloCheSembraUi,
  "la-sequenza-sporca": laSequenzaSporcaUi,
  "il-dettaglio-da-100": ilDettaglioDa100Ui,
  "feed-in-5-secondi": feedIn5SecondiUi,
  "effetto-domino": effettoDominoUi,
  "sotto-la-superficie": sottoLaSuperficieUi,
};
