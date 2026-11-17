import type { MechanicUi } from "./ui-contract";
import { effettoDominoUi } from "./mechanics/effetto-domino";
import { feedIn5SecondiUi } from "./mechanics/feed-in-5-secondi";
import { ilDettaglioDa100Ui } from "./mechanics/il-dettaglio-da-100";
import { laSequenzaSporcaUi } from "./mechanics/la-sequenza-sporca";
import { nonEQuelloCheSembraUi } from "./mechanics/non-e-quello-che-sembra";
import { pixelKillerUi } from "./mechanics/pixel-killer";
import { rumoreDiFondoUi } from "./mechanics/rumore-di-fondo";
import { sottoLaSuperficieUi } from "./mechanics/sotto-la-superficie";
import { titoliTagliatiUi } from "./mechanics/titoli-tagliati";
import { unSecondoPrimaUi } from "./mechanics/un-secondo-prima";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 1, per `code`. Vedi src/lib/tig/games/mechanics/manche-1.ts. */
export const UI_MANCHE_1: Record<string, MechanicUi> = {
  "pixel-killer": pixelKillerUi,
  "un-secondo-prima": unSecondoPrimaUi,
  "titoli-tagliati": titoliTagliatiUi,
  "non-e-quello-che-sembra": nonEQuelloCheSembraUi,
  "la-sequenza-sporca": laSequenzaSporcaUi,
  "il-dettaglio-da-100": ilDettaglioDa100Ui,
  "rumore-di-fondo": rumoreDiFondoUi,
  "feed-in-5-secondi": feedIn5SecondiUi,
  "effetto-domino": effettoDominoUi,
  "sotto-la-superficie": sottoLaSuperficieUi,
};
