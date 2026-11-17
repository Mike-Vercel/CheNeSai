import { seededShuffle } from "./rng";

/**
 * COMPONENTE BASE 7 — TRA TAVOLI: DUELLI, ACCOPPIAMENTI, FIDUCIA E BLUFF.
 * Gli accoppiamenti sono deterministici (seme della prova) e circolari: ogni tavolo «parla» al successivo e
 * «ascolta» il precedente, così funziona con qualunque numero di tavoli (anche dispari) senza esclusi.
 */

export interface RingLink {
  teamId: string;
  /** a chi questo tavolo manda il suggerimento */
  tellsTo: string | null;
  /** da chi lo riceve */
  hearsFrom: string | null;
  /** posizione nel giro (0-based) */
  index: number;
}

/** Giro dei tavoli mescolato con il seme. Con un solo tavolo non ci sono collegamenti. */
export function ring(teamIds: readonly string[], seed: string): RingLink[] {
  const order = seededShuffle(teamIds.slice().sort(), `${seed}:giro`);
  const n = order.length;
  return order.map((teamId, i) => ({
    teamId,
    index: i,
    tellsTo: n > 1 ? order[(i + 1) % n] : null,
    hearsFrom: n > 1 ? order[(i - 1 + n) % n] : null,
  }));
}

/**
 * Colora il giro con `k ≥ 3` colori (casi diversi) in modo che due tavoli consecutivi non ricevano mai
 * lo stesso caso: chi suggerisce non conosce mai la risposta del proprio caso. Con 2 tavoli bastano 2 colori.
 */
export function ringColors(n: number, k: number): number[] {
  if (n <= 0) return [];
  if (k < 2 || (k < 3 && n > 2 && n % 2 === 1)) throw new Error("servono almeno 3 casi per un giro dispari");
  const out = Array.from({ length: n }, (_, i) => i % k);
  if (n > 1 && out[n - 1] === out[0]) {
    // l'ultimo tocca il primo: scegli un colore diverso da entrambi i vicini
    for (let c = 0; c < k; c++) {
      if (c !== out[0] && c !== out[n - 2]) {
        out[n - 1] = c;
        break;
      }
    }
  }
  return out;
}

export interface DuelSide {
  teamId: string;
  tableNo: number;
  correct: boolean;
  elapsedMs: number;
}

/**
 * Vincitore di un duello sullo stesso contenuto: vince chi ha risposto giusto; se entrambi, il più rapido
 * (tempo del server); a pari millisecondo nessun vincitore (pareggio). Se nessuno è giusto, nessun vincitore.
 */
export function duelWinner(a: DuelSide | null, b: DuelSide | null): string | null {
  const okA = !!a?.correct;
  const okB = !!b?.correct;
  if (okA && !okB) return a!.teamId;
  if (okB && !okA) return b!.teamId;
  if (!okA && !okB) return null;
  if (a!.elapsedMs === b!.elapsedMs) return null;
  return a!.elapsedMs < b!.elapsedMs ? a!.teamId : b!.teamId;
}
