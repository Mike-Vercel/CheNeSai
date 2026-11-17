import { z } from "zod";
import type { PhaseCtx, TeamRef } from "../contract";
import { betLimit } from "../components/bid";
import { hashString, seededShuffle } from "../components/rng";
import { scopeTeams } from "../components/submissions";

/**
 * Utilità comuni alle meccaniche della MANCHE 5 «TUTTO O NIENTE!» (file della manche 5: nessun altro lo usa).
 *
 * - difficoltà dichiarata nella variante (il registro del server la legge per distribuire facile/media/difficile);
 * - saldi iniettati dal runtime al congelamento (`balances`: tavolo → saldo) e perdite dichiarate entro
 *   min(25% del saldo, 250): il runtime riapplica comunque il tetto sul saldo vero;
 * - impronta di un seme (sorteggi verificabili) e gruppi di duello deterministici.
 */

export const difficultySchema = z.enum(["facile", "media", "difficile"]);

/** Saldi dei tavoli all'inizio della prova (iniettati dal runtime, mai nella vista pubblica). */
export const balancesSchema = z.record(z.string(), z.number().min(0)).optional();

export function balanceOf(balances: Record<string, number> | undefined, teamId: string): number | null {
  const b = balances?.[teamId];
  return typeof b === "number" && Number.isFinite(b) ? b : null;
}

/**
 * Perdita dichiarata di un rischio: `nominal` se il saldo non è noto, altrimenti al massimo la puntata
 * consentita (25% del saldo, max 250). Mai negativa: chi ha saldo zero non può perdere nulla.
 */
export function riskLoss(balance: number | null, nominal: number): number {
  if (balance === null) return nominal;
  return Math.max(0, Math.min(nominal, betLimit(balance)));
}

/** Impronta esadecimale (8 cifre) di un testo: si mostra PRIMA del sorteggio, il seme si svela al reveal. */
export function fingerprint(text: string): string {
  return hashString(text).toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Gruppi di duello deterministici: i tavoli della prova mescolati col seme e divisi a coppie;
 * con un numero dispari l'ultimo gruppo è da tre (nessuno resta fuori). Un tavolo solo: gruppo da uno.
 */
export function duelGroups(ctx: PhaseCtx, salt = "duelli"): TeamRef[][] {
  const teams = scopeTeams(ctx);
  const order = seededShuffle(teams, `${ctx.seed}:${salt}`);
  if (order.length <= 2) return order.length ? [order] : [];
  const groups: TeamRef[][] = [];
  for (let i = 0; i < order.length; i += 2) groups.push(order.slice(i, i + 2));
  if (groups[groups.length - 1].length === 1) {
    const [last] = groups.pop()!;
    groups[groups.length - 1].push(last);
  }
  return groups.map((g) => g.slice().sort((a, b) => a.tableNo - b.tableNo));
}

/** Secondi con una cifra decimale, alla italiana («41,2 s»). */
export function secLabel(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1).replace(".", ",")} s`;
}
