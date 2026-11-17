import type { MechanicUi } from "./ui-contract";
import { cacciaAllaCapolistaUi } from "./mechanics/caccia-alla-capolista";
import { contrattaccoUi } from "./mechanics/contrattacco";
import { furtoConDestrezzaUi } from "./mechanics/furto-con-destrezza";
import { laTrappolaUi } from "./mechanics/la-trappola";
import { scambioDiPostaUi } from "./mechanics/scambio-di-posta";
import { tagliaIlTempoUi } from "./mechanics/taglia-il-tempo";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 2, per `code`. Vedi src/lib/tig/games/mechanics/manche-2.ts. */
export const UI_MANCHE_2: Record<string, MechanicUi> = {
  "taglia-il-tempo": tagliaIlTempoUi,
  contrattacco: contrattaccoUi,
  "caccia-alla-capolista": cacciaAllaCapolistaUi,
  "furto-con-destrezza": furtoConDestrezzaUi,
  "la-trappola": laTrappolaUi,
  "scambio-di-posta": scambioDiPostaUi,
};
