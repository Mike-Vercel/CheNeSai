import type { TieBreakMethod } from "./types";
import { GameError } from "./types";

export interface VoteOptionInput {
  id: string;
  position: number;
  label: string;
}

export interface VoteTally {
  counts: Record<string, number>;
  total: number;
  winnerOptionId: string;
  tied: string[];
  method: TieBreakMethod | "majority";
  randomPick: number | null;
}

/**
 * Determina la categoria vincente.
 * In caso di parità applica la regola configurata nel round:
 * - "first": vince l'opzione con posizione più bassa (A prima di B...)
 * - "random": estrazione casuale (il numero estratto viene registrato)
 * - "admin": decide la regia; senza scelta viene sollevato TIE_NEEDS_ADMIN
 * Se nessuno vota, tutte le opzioni sono a pari merito (0 voti).
 */
export function tallyVotes(
  options: VoteOptionInput[],
  votes: { optionId: string }[],
  method: TieBreakMethod,
  adminChoice: string | null,
  random: () => number,
): VoteTally {
  if (options.length === 0) throw new GameError("VALIDATION", "Nessuna opzione di voto configurata");
  const counts: Record<string, number> = {};
  for (const o of options) counts[o.id] = 0;
  for (const v of votes) if (v.optionId in counts) counts[v.optionId] += 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const max = Math.max(...Object.values(counts));
  const sorted = [...options].sort((a, b) => a.position - b.position);
  const tied = sorted.filter((o) => counts[o.id] === max).map((o) => o.id);

  if (tied.length === 1) {
    return { counts, total, winnerOptionId: tied[0], tied: [], method: "majority", randomPick: null };
  }
  if (adminChoice) {
    if (!tied.includes(adminChoice)) {
      throw new GameError("VALIDATION", "La scelta della regia deve essere una delle categorie a pari merito", { tied });
    }
    return { counts, total, winnerOptionId: adminChoice, tied, method: "admin", randomPick: null };
  }
  if (method === "admin") {
    throw new GameError("TIE_NEEDS_ADMIN", "Parità: serve il voto decisivo della regia", { tied });
  }
  if (method === "first") {
    return { counts, total, winnerOptionId: tied[0], tied, method: "first", randomPick: null };
  }
  const r = random();
  const idx = Math.min(tied.length - 1, Math.floor(r * tied.length));
  return { counts, total, winnerOptionId: tied[idx], tied, method: "random", randomPick: r };
}
