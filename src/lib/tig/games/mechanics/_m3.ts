import { z } from "zod";
import type { AcceptedSubmission, PhaseCtx, TeamRef } from "../contract";
import { percentages } from "../components/vote";

/**
 * Utilità comuni delle meccaniche nuove della MANCHE 3 «IL PUB DECIDE!» (solo questo gruppo di file le usa).
 * Regole di equità della manche (PDF §04/§05): nei sondaggi del locale un tavolo = UN voto; nel voto interno
 * conta la PERCENTUALE dei membri attivi; a schermo solo dati aggregati per tavolo, mai nomi di persone.
 */

/** Difficoltà facoltativa della variante (la legge il registro del server per distribuire facile/media/difficile). */
export const difficultySchema = z.enum(["facile", "media", "difficile"]).optional();

/** Conteggio per opzione (tutte le opzioni presenti, anche a zero). */
export function tally(values: Iterable<string>, ids: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const v of values) if (v in counts) counts[v] += 1;
  return counts;
}

/** Opzioni con il conteggio massimo (vuoto se nessun voto). */
export function topIds(counts: Record<string, number>, ids: readonly string[]): string[] {
  const max = Math.max(0, ...ids.map((id) => counts[id] ?? 0));
  return max > 0 ? ids.filter((id) => (counts[id] ?? 0) === max) : [];
}

/** Opzioni con il conteggio minimo (anche zero). Vuoto se nessun voto. */
export function bottomIds(counts: Record<string, number>, ids: readonly string[]): string[] {
  const total = ids.reduce((s, id) => s + (counts[id] ?? 0), 0);
  if (!total) return [];
  const min = Math.min(...ids.map((id) => counts[id] ?? 0));
  return ids.filter((id) => (counts[id] ?? 0) === min);
}

export interface PubPoll {
  counts: Record<string, number>;
  percent: Record<string, number>;
  winners: string[];
  tables: number;
}

/** Sondaggio del locale: un voto per tavolo (`votes` = tavolo → opzione già validata). */
export function pubPoll(votes: Iterable<string>, ids: readonly string[]): PubPoll {
  const list = [...votes].filter((v) => ids.includes(v));
  const counts = tally(list, ids);
  return { counts, percent: percentages(counts, ids), winners: topIds(counts, ids), tables: list.length };
}

/** Capitano della prova (fotografato all'avvio); senza capitano registrato, il primo membro attivo. */
export function captainOf(t: TeamRef): string | null {
  if (t.captainId && t.members.includes(t.captainId)) return t.captainId;
  return t.members[0] ?? null;
}

/** Il tavolo del contesto membro. */
export function teamOf(ctx: PhaseCtx & { teamId: string }): TeamRef | undefined {
  return ctx.teams.find((t) => t.teamId === ctx.teamId);
}

/** Primo invio per membro, già filtrato (il motore deduplica, qui restiamo robusti). */
export function payloads<S>(subs: readonly AcceptedSubmission<S>[]): S[] {
  return subs.map((s) => s.payload);
}

/** Numero con una cifra decimale all'italiana («2,7»). */
export function oneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
