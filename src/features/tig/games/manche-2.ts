import type { MechanicUi } from "./ui-contract";
import { cacciaAllaCapolistaUi } from "./mechanics/caccia-alla-capolista";
import { furtoConDestrezzaUi } from "./mechanics/furto-con-destrezza";
import { scambioDiPostaUi } from "./mechanics/scambio-di-posta";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 2, per `code`. Vedi src/lib/tig/games/mechanics/manche-2.ts. */
export const UI_MANCHE_2: Record<string, MechanicUi> = {
  "caccia-alla-capolista": cacciaAllaCapolistaUi,
  "furto-con-destrezza": furtoConDestrezzaUi,
  "scambio-di-posta": scambioDiPostaUi,
};
