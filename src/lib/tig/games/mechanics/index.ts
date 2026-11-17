import type { MechanicModule } from "../extras";
import { alibiImpossibile } from "./alibi-impossibile";
import { astaAlBuio } from "./asta-al-buio";
import { catenaDiCodici } from "./catena-di-codici";
import { cifraImprobabile } from "./cifra-improbabile";
import { crediciONo } from "./credici-o-no";
import { dilemmaPubblico } from "./dilemma-pubblico";
import { doppioRischio } from "./doppio-rischio";
import { indizioDopoIndizio } from "./indizio-dopo-indizio";
import { laContraddizione } from "./la-contraddizione";
import { memoriaLampo } from "./memoria-lampo";
import { ordineNelCaos } from "./ordine-nel-caos";
import { prevediLaMaggioranza } from "./prevedi-la-maggioranza";
import { puntataNascosta } from "./puntata-nascosta";
import { scegliIlBersaglio } from "./scegli-il-bersaglio";
import { screenshotTraditore } from "./screenshot-traditore";
import { scudoRapido } from "./scudo-rapido";
import { sicuroORischio } from "./sicuro-o-rischio";
import { sincronizzati } from "./sincronizzati";
import { sogliaDiRischio } from "./soglia-di-rischio";
import { tempoFantasma } from "./tempo-fantasma";
import { treVersioni } from "./tre-versioni";
import { NUOVE_MANCHE_1 } from "./manche-1";
import { NUOVE_MANCHE_2 } from "./manche-2";
import { NUOVE_MANCHE_3 } from "./manche-3";
import { NUOVE_MANCHE_4 } from "./manche-4";
import { NUOVE_MANCHE_5 } from "./manche-5";

/** Prime 21 meccaniche (ramo dei minigiochi). */
const PRIME_21 = [
  memoriaLampo,
  screenshotTraditore,
  tempoFantasma,
  ordineNelCaos,
  cifraImprobabile,
  indizioDopoIndizio,
  scegliIlBersaglio,
  scudoRapido,
  astaAlBuio,
  doppioRischio,
  prevediLaMaggioranza,
  sincronizzati,
  dilemmaPubblico,
  catenaDiCodici,
  crediciONo,
  treVersioni,
  laContraddizione,
  alibiImpossibile,
  puntataNascosta,
  sogliaDiRischio,
  sicuroORischio,
] as unknown as MechanicModule[];

/** Moduli delle meccaniche IMPLEMENTATE, in ordine di catalogo. Nessun contenuto qui (resta sul server). */
export const MECHANIC_MODULES: MechanicModule[] = [...PRIME_21, ...NUOVE_MANCHE_1, ...NUOVE_MANCHE_2, ...NUOVE_MANCHE_3, ...NUOVE_MANCHE_4, ...NUOVE_MANCHE_5].sort(
  (a, b) => a.def.number - b.def.number,
);
