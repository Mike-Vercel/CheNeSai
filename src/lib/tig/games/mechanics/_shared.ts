import { z } from "zod";
import { idSchema, optionSchema } from "../components/choice";

/**
 * Convenzioni comuni dei contenuti:
 * - ogni variante ha un `id` stabile (per non riproporre varianti già viste dallo stesso locale);
 * - la soluzione sta SEMPRE nel campo `solution` e la spiegazione in `explain`: nessuno dei due entra
 *   mai nella vista pubblica (i test lo verificano in profondità).
 */
export const variantId = idSchema;
export const text = (max: number) => z.string().trim().min(1).max(max);
export const explainSchema = z.string().trim().min(10).max(420);
export const optionsSchema = (min: number, max: number) => z.array(optionSchema).min(min).max(max);

/** Chiavi vietate in qualsiasi vista pubblica (controllo profondo nei test). */
export const FORBIDDEN_PUBLIC_KEYS = ["solution", "explain", "correct", "answer", "answers", "truth", "isTrue", "value", "count", "code", "why"] as const;
