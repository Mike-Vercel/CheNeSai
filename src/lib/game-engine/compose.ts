/**
 * Composizione automatica di una serata (parte pura, senza database).
 *
 * Dato un elenco di domande candidate (già filtrate: approvate, risposta
 * confermata, niente demo/test) sceglie le domande per ogni round:
 *  1. prima le domande MAI giocate in una serata reale e non prenotate in
 *     altre serate in programma;
 *  2. poi quelle giocate meno di recente (finestra delle più vecchie);
 *  3. poi quelle già inserite in un'altra serata reale in programma;
 *  4. per ultime (solo partite libere) quelle che l'account host ha già visto
 *     in una sua partita precedente;
 * a parità di freschezza: niente stessa categoria due volte di fila,
 * difficoltà secondo il mix scelto (il round finale è più difficile),
 * categorie distribuite tra i round. Deterministica a parità di `seed`.
 */

export type DifficultyBand = "facile" | "media" | "difficile";
export const DIFFICULTY_BANDS: readonly DifficultyBand[] = ["facile", "media", "difficile"];

export const DIFFICULTY_MIXES = ["bilanciata", "facile", "difficile"] as const;
export type DifficultyMix = (typeof DIFFICULTY_MIXES)[number];

export const DIFFICULTY_MIX_LABEL: Record<DifficultyMix, string> = {
  bilanciata: "Bilanciata",
  facile: "Più facile",
  difficile: "Più difficile",
};

/** Sequenza ciclica delle fasce di difficoltà dentro ogni round. */
const PATTERNS: Record<DifficultyMix, DifficultyBand[]> = {
  bilanciata: ["facile", "media", "difficile"],
  facile: ["facile", "facile", "media"],
  difficile: ["media", "difficile", "difficile"],
};

/** Difficoltà 1–5 dell'archivio → fascia: 1–2 facile, 3 media, 4–5 difficile. */
export function bandOf(difficulty: number): DifficultyBand {
  if (difficulty <= 2) return "facile";
  if (difficulty === 3) return "media";
  return "difficile";
}

const BAND_INDEX: Record<DifficultyBand, number> = { facile: 0, media: 1, difficile: 2 };

/** Fasce obiettivo per un round di `count` domande; `harder` alza tutto di una fascia. */
export function roundBands(mix: DifficultyMix, count: number, harder = false): DifficultyBand[] {
  const pattern = PATTERNS[mix];
  const out: DifficultyBand[] = [];
  for (let i = 0; i < count; i++) {
    const b = pattern[i % pattern.length];
    out.push(harder ? DIFFICULTY_BANDS[Math.min(2, BAND_INDEX[b] + 1)] : b);
  }
  return out;
}

/** Ripartisce `total` domande su `rounds` round (le eccedenze ai primi round). */
export function splitQuestions(total: number, rounds: number): number[] {
  if (rounds <= 0) return [];
  const base = Math.floor(total / rounds);
  const extra = total % rounds;
  return Array.from({ length: rounds }, (_, i) => base + (i < extra ? 1 : 0));
}

export interface ComposeCandidate {
  id: string;
  category: string;
  difficulty: number;
  /** Ultima volta mostrata in una serata reale (registro), ISO; null = mai giocata. */
  lastPlayedAt: string | null;
  /** Già inserita in un'altra serata reale in programma (non ancora mostrata). */
  plannedElsewhere: boolean;
  /** Partite libere: già uscita in una partita precedente dello stesso account host. */
  seenByHost?: boolean;
}

export type Freshness = "nuova" | "giocata" | "prenotata" | "vista";

export function freshnessOf(c: Pick<ComposeCandidate, "lastPlayedAt" | "plannedElsewhere" | "seenByHost">): Freshness {
  if (c.seenByHost) return "vista";
  if (c.plannedElsewhere) return "prenotata";
  return c.lastPlayedAt ? "giocata" : "nuova";
}

const TIER: Record<Freshness, number> = { nuova: 0, giocata: 1, prenotata: 2, vista: 3 };

export interface ComposeRoundSpec {
  /** Quante domande servono in questo gruppo. */
  count: number;
  /** Round più difficile (es. il finale). */
  harder?: boolean;
  /** Categoria dell'ultima domanda già presente nel round (per non ripeterla subito). */
  previousCategory?: string | null;
}

export interface ComposeInput {
  candidates: ComposeCandidate[];
  rounds: ComposeRoundSpec[];
  mix: DifficultyMix;
  seed: number | string;
  /** Domande da non usare (es. già presenti nella serata). */
  excludeIds?: Iterable<string>;
  /** Categorie già presenti nella serata (per distribuire meglio). */
  sessionCategoryCounts?: Record<string, number>;
}

export interface ComposedPick {
  questionId: string;
  category: string;
  difficulty: number;
  band: DifficultyBand;
  targetBand: DifficultyBand;
  freshness: Freshness;
  lastPlayedAt: string | null;
}

export interface ComposeSummary {
  requested: number;
  picked: number;
  /** Domande che mancano perché l'archivio (con questi filtri) non basta. */
  missing: number;
  fresh: number;
  /** Domande già giocate in passato (ripetute). */
  repeats: number;
  /** Domande già inserite in un'altra serata in programma. */
  planned: number;
  /** Partite libere: domande già viste dall'account host (ultima scelta possibile). */
  seen: number;
  /** Domande scelte fuori dalla fascia di difficoltà richiesta. */
  offBand: number;
}

export interface ComposeResult {
  rounds: ComposedPick[][];
  summary: ComposeSummary;
}

/** PRNG deterministico (mulberry32) con seme numerico o testuale. */
export function seededRandom(seed: number | string): () => number {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let a = h || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Cand extends ComposeCandidate {
  tier: number;
  band: DifficultyBand;
  rand: number;
  playedMs: number; // 0 = mai giocata
  used: boolean;
}

/** Confronto lessicografico tra chiavi numeriche. */
function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

export function composeQuestions(input: ComposeInput): ComposeResult {
  const exclude = new Set(input.excludeIds ?? []);
  const rand = seededRandom(input.seed);
  const seen = new Set<string>();
  const pool: Cand[] = [...input.candidates]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) // ordine stabile: il risultato dipende solo dal seme
    .filter((c) => {
      if (exclude.has(c.id) || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })
    .map((c) => ({
      ...c,
      tier: TIER[freshnessOf(c)],
      band: bandOf(c.difficulty),
      rand: rand(),
      playedMs: c.lastPlayedAt ? Date.parse(c.lastPlayedAt) || 0 : 0,
      used: false,
    }));

  // Per ogni livello di freschezza, candidati ordinati dal giocato meno di recente.
  const tiers: Cand[][] = [[], [], [], []];
  for (const c of pool) tiers[c.tier].push(c);
  for (const t of tiers) t.sort((a, b) => a.playedMs - b.playedMs || a.rand - b.rand);

  const sessionCats = new Map<string, number>(Object.entries(input.sessionCategoryCounts ?? {}));
  const requested = input.rounds.reduce((s, r) => s + Math.max(0, r.count), 0);
  let remainingSlots = requested;
  const summary: ComposeSummary = { requested, picked: 0, missing: 0, fresh: 0, repeats: 0, planned: 0, seen: 0, offBand: 0 };

  const rounds: ComposedPick[][] = input.rounds.map((spec) => {
    const bands = roundBands(input.mix, Math.max(0, spec.count), spec.harder);
    const roundCats = new Map<string, number>();
    let prev = spec.previousCategory ?? null;
    const picks: ComposedPick[] = [];
    for (const target of bands) {
      const tierIdx = tiers.findIndex((t) => t.some((c) => !c.used));
      if (tierIdx < 0) {
        summary.missing++;
        remainingSlots--;
        continue;
      }
      // Tra le già giocate si guarda solo una finestra delle più vecchie:
      // la difficoltà e le categorie non devono far ripescare una domanda appena vista.
      let window = tiers[tierIdx].filter((c) => !c.used);
      if (tierIdx > 0) window = window.slice(0, Math.max(remainingSlots * 3, 24));
      let best: Cand | null = null;
      let bestKey: number[] = [];
      for (const c of window) {
        const key = [
          c.category === prev ? 1 : 0,
          Math.abs(BAND_INDEX[c.band] - BAND_INDEX[target]),
          roundCats.get(c.category) ?? 0,
          sessionCats.get(c.category) ?? 0,
          spec.harder ? -c.difficulty : 0,
          c.playedMs,
          c.rand,
        ];
        if (!best || lexLess(key, bestKey)) {
          best = c;
          bestKey = key;
        }
      }
      const c = best!;
      c.used = true;
      remainingSlots--;
      roundCats.set(c.category, (roundCats.get(c.category) ?? 0) + 1);
      sessionCats.set(c.category, (sessionCats.get(c.category) ?? 0) + 1);
      prev = c.category;
      const freshness = freshnessOf(c);
      if (freshness === "nuova") summary.fresh++;
      else if (freshness === "giocata") summary.repeats++;
      else if (freshness === "prenotata") summary.planned++;
      else summary.seen++;
      if (c.band !== target) summary.offBand++;
      summary.picked++;
      picks.push({
        questionId: c.id,
        category: c.category,
        difficulty: c.difficulty,
        band: c.band,
        targetBand: target,
        freshness,
        lastPlayedAt: c.lastPlayedAt,
      });
    }
    return picks;
  });

  return { rounds, summary };
}

/** Conteggi dell'archivio utilizzabile, per gli avvisi all'admin. */
export interface PoolStats {
  usable: number;
  fresh: number;
  played: number;
  planned: number;
  /** Partite libere: già viste dall'account host. */
  seen: number;
  byBand: Record<DifficultyBand, { usable: number; fresh: number }>;
}

export function poolStats(candidates: ComposeCandidate[], excludeIds: Iterable<string> = []): PoolStats {
  const ex = new Set(excludeIds);
  const out: PoolStats = {
    usable: 0,
    fresh: 0,
    played: 0,
    planned: 0,
    seen: 0,
    byBand: { facile: { usable: 0, fresh: 0 }, media: { usable: 0, fresh: 0 }, difficile: { usable: 0, fresh: 0 } },
  };
  for (const c of candidates) {
    if (ex.has(c.id)) continue;
    const f = freshnessOf(c);
    const b = out.byBand[bandOf(c.difficulty)];
    out.usable++;
    b.usable++;
    if (f === "nuova") {
      out.fresh++;
      b.fresh++;
    } else if (f === "giocata") out.played++;
    else if (f === "prenotata") out.planned++;
    else out.seen++;
  }
  return out;
}
