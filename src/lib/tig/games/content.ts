import "server-only";
import { loadVariants, type ContentVariant } from "./content-core";

/**
 * Contenuti dei minigiochi (CON LE SOLUZIONI): solo server. Il runtime sceglie una variante con
 * `contentVariants(code)`, la congela nella partita e da lì usa la meccanica.
 * Ogni variante è già validata con il `contentSchema` della sua meccanica (errore all'avvio se no).
 */
export const MECHANIC_CONTENT: Record<string, readonly ContentVariant[]> = loadVariants();

export function contentVariants(code: string): readonly ContentVariant[] {
  return MECHANIC_CONTENT[code] ?? [];
}

export type { ContentVariant } from "./content-core";
