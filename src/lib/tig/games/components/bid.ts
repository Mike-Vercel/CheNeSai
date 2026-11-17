import { POINTS } from "./scoring";

/**
 * COMPONENTE BASE 5 — OFFERTA SIGILLATA E PUNTATA.
 * Nessuno vede le offerte altrui; il server decide. Parità: prima l'offerta più alta, poi chi ha
 * inviato prima (tempo del server), poi il numero di tavolo più basso: sempre un solo vincitore.
 */

export interface SealedBid {
  teamId: string;
  tableNo: number;
  amount: number;
  elapsedMs: number;
}

export function resolveSealedBid(bids: readonly SealedBid[]): SealedBid | null {
  const valid = bids.filter((b) => b.amount > 0);
  if (!valid.length) return null;
  return valid.slice().sort((a, b) => b.amount - a.amount || a.elapsedMs - b.elapsedMs || a.tableNo - b.tableNo)[0];
}

/**
 * Tetto della puntata finale: min(25% del saldo, 250), mai negativa (PDF §04).
 * Senza saldo noto vale solo il tetto assoluto: il runtime riapplica comunque il limite sul saldo vero.
 */
export function betLimit(balance: number | null | undefined): number {
  if (balance === null || balance === undefined || !Number.isFinite(balance)) return POINTS.betCap;
  return Math.max(0, Math.min(Math.floor(Math.max(0, balance) * POINTS.betShare), POINTS.betCap));
}

export function capBet(amount: number, balance: number | null | undefined): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.min(Math.floor(amount), betLimit(balance)));
}
