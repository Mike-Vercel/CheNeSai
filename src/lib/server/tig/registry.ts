import "server-only";
import type { MechanicDef } from "@/lib/tig/games/contract";
import { contentVariants } from "@/lib/tig/games/content";
import type { MechanicExtras } from "@/lib/tig/games/extras";
import { CATALOG, MECHANIC_EXTRAS, MECHANICS } from "@/lib/tig/games/index";
import type { ContentVariant } from "@/lib/tig/games/variants";
import type { CatalogEntry } from "@/lib/tig/games/contract";

/**
 * Il registro dei minigiochi visto dal runtime del server: meccaniche implementate (ramo GIOCHI), contenuti
 * CON le soluzioni (`contentVariants`, solo server), estensioni (`MECHANIC_EXTRAS`: vista a tempo, effetti
 * come lo scudo). Le varianti diventano `{ key: id, content }` per il motore di selezione.
 *
 * Per i test d'integrazione il registro si può sostituire (`setTigRegistryForTests`) con una meccanica di prova
 * deterministica; nel sito si usa sempre quello vero.
 */
export interface TigRegistry {
  mechanics: MechanicDef[];
  catalog: CatalogEntry[];
  variantsOf: (def: MechanicDef) => ContentVariant[];
  extras: (code: string) => MechanicExtras | undefined;
}

const cache = new Map<string, ContentVariant[]>();
const REAL: TigRegistry = {
  mechanics: MECHANICS,
  catalog: CATALOG,
  variantsOf: (def) => {
    let v = cache.get(def.code);
    if (!v) {
      v = contentVariants(def.code).map((c) => ({ key: String(c.id), content: c, difficulty: (["facile", "media", "difficile"] as const).find((d) => d === (c as { difficulty?: unknown }).difficulty) }));
      cache.set(def.code, v);
    }
    return v;
  },
  extras: (code) => MECHANIC_EXTRAS[code],
};

let override: TigRegistry | null = null;

export function tigRegistry(): TigRegistry {
  return override ?? REAL;
}

export function mechanicOf(code: string): MechanicDef | undefined {
  return tigRegistry().mechanics.find((m) => m.code === code);
}

/** Solo test: registro sostituito (null = quello vero). */
export function setTigRegistryForTests(r: TigRegistry | null) {
  override = r;
}

/**
 * Solo sviluppo/test end-to-end: `TIG_TEST_FORCE_CODES=codice1,codice2,…` impone le prime prove normali della
 * serata nell'ordine indicato (per provare dall'interfaccia meccaniche precise). Ignorato in produzione.
 */
export function forcedCode(n: number): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const list = (process.env.TIG_TEST_FORCE_CODES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list[n] ?? null;
}
