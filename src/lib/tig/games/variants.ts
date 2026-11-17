import type { MechanicDef } from "./contract";
import type { Difficulty } from "../types";

/**
 * TAVOLI IN GUERRA! — VARIANTI DI CONTENUTO (estensione facoltativa del contratto, file del ramo core).
 *
 * ATTENZIONE: i contenuti VERI dei minigiochi NON stanno nella definizione (finirebbero nel bundle del browser):
 * stanno in `content/tig/minigiochi/<codice>.ts`, registrati negli indici per manche e letti SOLO dal server tramite
 * `content-core.ts` → `registry.variantsOf`. La proprietà facoltativa `variants` qui sotto la usano solo i test
 * (meccaniche di prova) e la selezione come ripiego:
 *
 *   const provaRapida: MechanicDef<C, S> & { variants: ContentVariant<C>[] } = { ...def, variants: [...] };
 *
 * Ogni variante ha una chiave stabile (per non ripeterla nella stessa serata e nei locali che l'hanno già vista),
 * una difficoltà (per distribuire facile/media/difficile) e il contenuto (validato con `contentSchema` prima
 * di essere congelato). Una meccanica senza varianti valide NON viene mai scelta («solo giochi con contenuti pronti»).
 */
export interface ContentVariant<C = unknown> {
  key: string;
  difficulty?: Difficulty;
  content: C;
}

export type MechanicWithVariants<C = unknown, S = unknown> = MechanicDef<C, S> & { variants?: ContentVariant<C>[] };

/** Varianti della meccanica che passano lo schema del contenuto (le altre si scartano in silenzio). */
export function validVariants(def: MechanicDef): ContentVariant[] {
  const raw = (def as MechanicWithVariants).variants;
  if (!Array.isArray(raw)) return [];
  const out: ContentVariant[] = [];
  for (const v of raw) {
    if (!v || typeof v.key !== "string" || !v.key) continue;
    const parsed = def.contentSchema.safeParse(v.content);
    if (parsed.success) out.push({ key: v.key, difficulty: v.difficulty, content: parsed.data });
  }
  return out;
}
