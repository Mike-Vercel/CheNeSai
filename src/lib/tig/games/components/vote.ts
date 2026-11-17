/**
 * COMPONENTE BASE 6 — VOTO, PREVISIONE E MATRICE DEL DILEMMA.
 * Equità (PDF §04): nel voto interno il tavolo conta come PERCENTUALE dei membri attivi, mai come somma;
 * nei sondaggi del locale ogni tavolo vale UN voto, qualunque sia il numero di telefoni.
 */

export interface ShareResult {
  /** voti per opzione (solo membri attivi che hanno votato) */
  counts: Record<string, number>;
  /** opzioni più votate (più di una in caso di parità) */
  top: string[];
  /** quota del gruppo più numeroso sul totale dei membri ATTIVI (chi non vota conta come disaccordo) */
  share: number;
  voters: number;
  members: number;
}

/** Concordanza interna di un tavolo: `choices` = scelta di ogni membro che ha votato. */
export function agreementShare(choices: readonly string[], activeMembers: number): ShareResult {
  const counts: Record<string, number> = {};
  for (const c of choices) counts[c] = (counts[c] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts)
    .filter((k) => counts[k] === max && max > 0)
    .sort();
  const members = Math.max(activeMembers, choices.length);
  return { counts, top, share: members > 0 ? max / members : 0, voters: choices.length, members };
}

export interface PubTally {
  counts: Record<string, number>;
  /** opzioni con più voti di tavolo (parità = più vincitrici) */
  winners: string[];
  /** tavoli che hanno votato */
  tables: number;
}

/** Sondaggio del locale: un voto per tavolo. `votes` = mappa tavolo → opzione. */
export function pubTally(votes: ReadonlyMap<string, string>, optionIds: readonly string[]): PubTally {
  const counts: Record<string, number> = Object.fromEntries(optionIds.map((id) => [id, 0]));
  for (const v of votes.values()) if (v in counts) counts[v] += 1;
  const max = Math.max(0, ...Object.values(counts));
  const winners = max > 0 ? optionIds.filter((id) => counts[id] === max) : [];
  return { counts, winners, tables: [...votes.values()].filter((v) => v in counts).length };
}

/** Percentuali intere che sommano a 100 (metodo dei resti maggiori), per la TV. */
export function percentages(counts: Record<string, number>, order: readonly string[]): Record<string, number> {
  const total = order.reduce((s, k) => s + (counts[k] ?? 0), 0);
  if (!total) return Object.fromEntries(order.map((k) => [k, 0]));
  const raw = order.map((k) => ({ k, v: ((counts[k] ?? 0) * 100) / total }));
  const out: Record<string, number> = Object.fromEntries(raw.map((r) => [r.k, Math.floor(r.v)]));
  let rest = 100 - Object.values(out).reduce((s, v) => s + v, 0);
  for (const r of raw.slice().sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)) || order.indexOf(a.k) - order.indexOf(b.k))) {
    if (rest <= 0) break;
    out[r.k] += 1;
    rest -= 1;
  }
  return out;
}

export interface DilemmaMatrix {
  /** quota minima di tavoli che cooperano (0..1) perché scatti lo scenario «insieme» */
  threshold: number;
  /** punti se la soglia è raggiunta */
  reached: { coop: number; compete: number };
  /** punti se la soglia NON è raggiunta */
  missed: { coop: number; compete: number };
}

/** Esito del dilemma: quota di cooperazione tra i tavoli che hanno scelto. */
export function dilemmaResult(choices: ReadonlyMap<string, "coopera" | "compete">, m: DilemmaMatrix) {
  const total = choices.size;
  const coop = [...choices.values()].filter((c) => c === "coopera").length;
  const share = total ? coop / total : 0;
  const reached = total > 0 && share >= m.threshold - 1e-9;
  const pay = reached ? m.reached : m.missed;
  return { total, coop, share, reached, pay };
}
