import type { MechanicUi } from "./ui-contract";
import { bottoneDelCaosUi } from "./mechanics/bottone-del-caos";
import { cacciaAllaCapolistaUi } from "./mechanics/caccia-alla-capolista";
import { contrattaccoUi } from "./mechanics/contrattacco";
import { falsoVantaggioUi } from "./mechanics/falso-vantaggio";
import { furtoConDestrezzaUi } from "./mechanics/furto-con-destrezza";
import { ilPattoDi60SecondiUi } from "./mechanics/il-patto-di-60-secondi";
import { laSfidaIncrociataUi } from "./mechanics/la-sfida-incrociata";
import { laTrappolaUi } from "./mechanics/la-trappola";
import { scambioDiPostaUi } from "./mechanics/scambio-di-posta";
import { scegliIlTerrenoUi } from "./mechanics/scegli-il-terreno";
import { tagliaIlTempoUi } from "./mechanics/taglia-il-tempo";
import { ultimaParolaUi } from "./mechanics/ultima-parola";

/** Schermate (telefono/PC e TV) delle meccaniche nuove della MANCHE 2, per `code`. Vedi src/lib/tig/games/mechanics/manche-2.ts. */
export const UI_MANCHE_2: Record<string, MechanicUi> = {
  "taglia-il-tempo": tagliaIlTempoUi,
  contrattacco: contrattaccoUi,
  "caccia-alla-capolista": cacciaAllaCapolistaUi,
  "furto-con-destrezza": furtoConDestrezzaUi,
  "scegli-il-terreno": scegliIlTerrenoUi,
  "la-trappola": laTrappolaUi,
  "il-patto-di-60-secondi": ilPattoDi60SecondiUi,
  "la-sfida-incrociata": laSfidaIncrociataUi,
  "bottone-del-caos": bottoneDelCaosUi,
  "scambio-di-posta": scambioDiPostaUi,
  "falso-vantaggio": falsoVantaggioUi,
  "ultima-parola": ultimaParolaUi,
};
