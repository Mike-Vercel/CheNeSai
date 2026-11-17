import { buildCatalog } from "./catalog";
import type { CatalogEntry, MechanicDef } from "./contract";
import type { MechanicExtras } from "./extras";
import { MECHANIC_MODULES } from "./mechanics";

/**
 * TAVOLI IN GUERRA! — REGISTRO DEI MINIGIOCHI.
 *
 * - `MECHANICS`: le meccaniche IMPLEMENTATE (pure, server autoritativo).
 * - `CATALOG`: tutte le 80 voci del PDF con lo stato reale.
 * - `mechanicByCode(code)`.
 * - `MECHANIC_EXTRAS`: estensioni facoltative (vista a tempo, invii finti, effetti come lo scudo): vedi extras.ts.
 *
 * I CONTENUTI (con le soluzioni) NON sono importati qui: stanno in `./content` (solo server).
 */
export const MECHANICS: MechanicDef[] = MECHANIC_MODULES.map((m) => m.def);

export const CATALOG: CatalogEntry[] = buildCatalog(MECHANICS);

const BY_CODE = new Map(MECHANICS.map((m) => [m.code, m]));

export function mechanicByCode(code: string): MechanicDef | undefined {
  return BY_CODE.get(code);
}

export const MECHANIC_EXTRAS: Record<string, MechanicExtras> = Object.fromEntries(MECHANIC_MODULES.map((m) => [m.def.code, m.extras]));

export type { CatalogEntry, MechanicDef } from "./contract";
