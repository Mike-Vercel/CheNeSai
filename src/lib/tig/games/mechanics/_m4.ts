import { z } from "zod";
import type { MemberCtx, PhaseCtx, TeamRef } from "../contract";
import { ring, ringColors } from "../components/pairing";
import { seededShuffle } from "../components/rng";
import { scopeTeams } from "../components/submissions";
import type { Difficulty } from "../../types";

/**
 * Aiuti comuni alle meccaniche della MANCHE 4 «IL GRANDE INGANNO» (solo questa manche li usa).
 * Funzioni pure: giro dei tavoli con casi diversi tra vicini, coppie con il «banco», eliminazioni
 * verificabili (i casi si validano da soli: dopo tutti gli indizi resta UN solo sospettato).
 */

export const difficultySchema = z.enum(["facile", "media", "difficile"]) satisfies z.ZodType<Difficulty>;

/** Tipi di documento dei fascicoli (disegnati in codice in `features/tig/games/mechanics/m4/docs.tsx`). */
export const DOC_KINDS = ["scontrino", "biglietto", "messaggio", "nota", "tessera", "verbale", "agenda", "foto"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const docKindSchema = z.enum(DOC_KINDS);

/** Parole che non devono comparire negli id pubblici (darebbero la soluzione). */
export const TELLTALE_ID = /(fals|vero|vera|giust|sbagl|fint|fake|true|manom|alter|tarocc|colpev)/;

// ---------------------------------------------------------------------------
// Eliminazioni: ogni indizio toglie dei sospettati; il caso è valido se alla fine ne resta uno
// ---------------------------------------------------------------------------

/** Sospettati ancora possibili dopo le eliminazioni indicate (ordine originale). */
export function remainingAfter(optionIds: readonly string[], eliminations: readonly (readonly string[])[]): string[] {
  const out = new Set<string>();
  for (const e of eliminations) for (const id of e) out.add(id);
  return optionIds.filter((id) => !out.has(id));
}

/** Controlli editoriali comuni: id esistenti, mai eliminare la soluzione. */
export function checkEliminations(optionIds: readonly string[], solution: string, eliminations: readonly (readonly string[])[], ctx: z.RefinementCtx, path: (string | number)[]) {
  eliminations.forEach((e, i) => {
    for (const id of e) {
      if (!optionIds.includes(id)) ctx.addIssue({ code: "custom", message: `elimina «${id}» che non esiste`, path: [...path, i] });
      if (id === solution) ctx.addIssue({ code: "custom", message: "un indizio elimina la soluzione", path: [...path, i] });
    }
  });
}

// ---------------------------------------------------------------------------
// Giro dei tavoli (duelli «a catena»): ognuno parla al successivo e ascolta il precedente
// ---------------------------------------------------------------------------

export interface Seat {
  teamId: string;
  tableNo: number;
  index: number;
  tellsTo: string | null;
  hearsFrom: string | null;
  /** caso assegnato (0..k-1): due tavoli vicini non hanno mai lo stesso caso */
  color: number;
}

/** Giro mescolato con il seme; con `k` casi (≥ 3) i vicini non condividono il caso. */
export function seatsOf(ctx: PhaseCtx, k = 1): Seat[] {
  const teams = scopeTeams(ctx);
  const table = new Map(teams.map((t) => [t.teamId, t.tableNo]));
  const links = ring(
    teams.map((t) => t.teamId),
    ctx.seed,
  );
  const colors = k > 1 ? ringColors(links.length, k) : links.map(() => 0);
  return links.map((l) => ({ teamId: l.teamId, tableNo: table.get(l.teamId) ?? 0, index: l.index, tellsTo: l.tellsTo, hearsFrom: l.hearsFrom, color: colors[l.index] ?? 0 }));
}

export function seatMap(seats: readonly Seat[]): Map<string, Seat> {
  return new Map(seats.map((s) => [s.teamId, s]));
}

// ---------------------------------------------------------------------------
// Coppie (testa a testa): con un numero dispari di tavoli l'ultimo gioca contro il «banco»
// ---------------------------------------------------------------------------

export interface Pair {
  index: number;
  /** primo lato (es. chi vede l'inizio) */
  a: { teamId: string; tableNo: number };
  /** secondo lato, oppure null = il banco (scelta automatica dal seme, non prende punti) */
  b: { teamId: string; tableNo: number } | null;
}

export function pairsOf(ctx: PhaseCtx): Pair[] {
  const teams = scopeTeams(ctx);
  const order = seededShuffle(
    teams.map((t) => ({ teamId: t.teamId, tableNo: t.tableNo })),
    `${ctx.seed}:coppie`,
  );
  const out: Pair[] = [];
  for (let i = 0; i < order.length; i += 2) out.push({ index: out.length, a: order[i], b: order[i + 1] ?? null });
  return out;
}

// ---------------------------------------------------------------------------
// Chi riceve i dati riservati del tavolo (acquisti): il capitano, o il primo telefono attivo
// ---------------------------------------------------------------------------

export function isBuyer(ctx: MemberCtx): boolean {
  const team: TeamRef | undefined = ctx.teams.find((t) => t.teamId === ctx.teamId);
  if (!team) return false;
  const captainActive = !!team.captainId && team.members.includes(team.captainId);
  return captainActive ? ctx.memberId === team.captainId : ctx.memberIndex === 0;
}

/** Testo normalizzato per i confronti editoriali (maiuscole, spazi). */
export function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
