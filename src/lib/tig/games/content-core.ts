import alibiImpossibile from "../../../../content/tig/minigiochi/alibi-impossibile";
import astaAlBuio from "../../../../content/tig/minigiochi/asta-al-buio";
import catenaDiCodici from "../../../../content/tig/minigiochi/catena-di-codici";
import cifraImprobabile from "../../../../content/tig/minigiochi/cifra-improbabile";
import crediciONo from "../../../../content/tig/minigiochi/credici-o-no";
import dilemmaPubblico from "../../../../content/tig/minigiochi/dilemma-pubblico";
import doppioRischio from "../../../../content/tig/minigiochi/doppio-rischio";
import indizioDopoIndizio from "../../../../content/tig/minigiochi/indizio-dopo-indizio";
import laContraddizione from "../../../../content/tig/minigiochi/la-contraddizione";
import memoriaLampo from "../../../../content/tig/minigiochi/memoria-lampo";
import ordineNelCaos from "../../../../content/tig/minigiochi/ordine-nel-caos";
import prevediLaMaggioranza from "../../../../content/tig/minigiochi/prevedi-la-maggioranza";
import puntataNascosta from "../../../../content/tig/minigiochi/puntata-nascosta";
import scegliIlBersaglio from "../../../../content/tig/minigiochi/scegli-il-bersaglio";
import screenshotTraditore from "../../../../content/tig/minigiochi/screenshot-traditore";
import scudoRapido from "../../../../content/tig/minigiochi/scudo-rapido";
import sicuroORischio from "../../../../content/tig/minigiochi/sicuro-o-rischio";
import sincronizzati from "../../../../content/tig/minigiochi/sincronizzati";
import sogliaDiRischio from "../../../../content/tig/minigiochi/soglia-di-rischio";
import tempoFantasma from "../../../../content/tig/minigiochi/tempo-fantasma";
import treVersioni from "../../../../content/tig/minigiochi/tre-versioni";
import { MECHANIC_MODULES } from "./mechanics";

/**
 * Lettura e validazione dei contenuti (`content/tig/minigiochi/<codice>.ts`). Senza "server-only" solo
 * perché la usano anche i test e gli script; nel sito passa da `./content` (solo server).
 */

/** Variante validata: forma del `contentSchema` della meccanica, sempre con un `id` stabile. */
export type ContentVariant = { id: string } & Record<string, unknown>;

export const RAW_CONTENT: Record<string, readonly unknown[]> = {
  "memoria-lampo": memoriaLampo,
  "screenshot-traditore": screenshotTraditore,
  "tempo-fantasma": tempoFantasma,
  "ordine-nel-caos": ordineNelCaos,
  "cifra-improbabile": cifraImprobabile,
  "indizio-dopo-indizio": indizioDopoIndizio,
  "scegli-il-bersaglio": scegliIlBersaglio,
  "scudo-rapido": scudoRapido,
  "asta-al-buio": astaAlBuio,
  "doppio-rischio": doppioRischio,
  "prevedi-la-maggioranza": prevediLaMaggioranza,
  sincronizzati,
  "dilemma-pubblico": dilemmaPubblico,
  "catena-di-codici": catenaDiCodici,
  "credici-o-no": crediciONo,
  "tre-versioni": treVersioni,
  "la-contraddizione": laContraddizione,
  "alibi-impossibile": alibiImpossibile,
  "puntata-nascosta": puntataNascosta,
  "soglia-di-rischio": sogliaDiRischio,
  "sicuro-o-rischio": sicuroORischio,
};

export function loadVariants(): Record<string, readonly ContentVariant[]> {
  const out: Record<string, readonly ContentVariant[]> = {};
  for (const m of MECHANIC_MODULES) {
    const raw = RAW_CONTENT[m.def.code] ?? [];
    out[m.def.code] = raw.map((v, i) => {
      const r = m.def.contentSchema.safeParse(v);
      if (!r.success) throw new Error(`Contenuto non valido: ${m.def.code}[${i}] → ${r.error.message}`);
      return r.data as ContentVariant;
    });
  }
  return out;
}
