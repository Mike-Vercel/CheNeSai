import { z } from "zod";
import { seededShuffle } from "./rng";

/**
 * COMPONENTE BASE 1 — SCELTA (singola, multipla o tocco su una regione di un'immagine).
 * Opzioni con id stabile; l'ordine mostrato è mescolato con il seme della prova (uguale per tutti i tavoli),
 * la soluzione resta nel contenuto (`solution`) e non entra mai nella vista pubblica.
 */

export const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "id: minuscole, cifre e trattini");
export const optionSchema = z.object({ id: idSchema, text: z.string().min(1).max(120) });
export type Option = z.infer<typeof optionSchema>;

/** Opzioni pubbliche (solo id e testo) nell'ordine del seme. */
export function publicOptions(options: readonly Option[], seed: string): Option[] {
  return seededShuffle(
    options.map((o) => ({ id: o.id, text: o.text })),
    seed,
  );
}

/** Stesso insieme di id, senza badare all'ordine né ai doppioni. */
export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

/** Controllo editoriale: id unici e soluzione tra le opzioni (usato dagli schemi con superRefine). */
export function checkOptions(options: readonly Option[], solution: readonly string[], ctx: z.RefinementCtx, path: (string | number)[] = []) {
  const ids = options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "id delle opzioni duplicati", path });
  const texts = options.map((o) => o.text.trim().toLowerCase());
  if (new Set(texts).size !== texts.length) ctx.addIssue({ code: "custom", message: "testi delle opzioni duplicati", path });
  for (const s of solution) if (!ids.includes(s)) ctx.addIssue({ code: "custom", message: `soluzione «${s}» non tra le opzioni`, path });
}
