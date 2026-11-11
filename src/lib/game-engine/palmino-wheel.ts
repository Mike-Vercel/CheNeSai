import { bandOf, freshnessOf, seededRandom, type ComposeCandidate, type DifficultyBand } from "./compose";
import { isCategoryRound, type RoundKind } from "./types";

/**
 * RUOTA DI PALMINO (funzioni PURE, nessun database).
 *
 * Ogni tanto, prima di una domanda, Palmino gira una ruota che sceglie la categoria della domanda
 * successiva. Il piano si decide UNA volta, alla pubblicazione della serata, con un seme della
 * serata (stesso input → stesso piano): tutti gli schermi vedono la stessa cosa e un ricaricamento
 * non cambia nulla. Il risultato del giro lo estrae il server al momento (come la Ruota impazzita).
 *
 * Regole del piano:
 *  - mai prima della 5ª domanda (almeno 4 domande giocate prima);
 *  - mai sulla prima domanda di un round (la ruota arriva dopo i punti di una domanda) né
 *    sull'ultima domanda della serata;
 *  - al massimo una per round e 2 per serata (3 dalle 20 domande in su);
 *  - mai due volte di fila;
 *  - ogni domanda ammessa ha ~25% di probabilità;
 *  - solo nei round "normali" (niente categorie già scelte, manche musicali/immagini/video).
 */

/** La ruota compare al più presto prima di questa domanda (numero d'ordine nella serata, da 1). */
export const PALMINO_WHEEL_MIN_NUMBER = 5;
/** Probabilità per ogni domanda ammessa. */
export const PALMINO_WHEEL_PROBABILITY = 0.25;
/** Spicchi: da 6 a 8 categorie (meno solo se l'archivio non ne ha abbastanza, mai sotto 3). */
export const PALMINO_WHEEL_SEGMENTS = { min: 6, max: 8, floor: 3 } as const;
/** Anticipo fra il comando e la partenza della ruota: Palmino arriva, parla e la spinge. */
export const PALMINO_WHEEL_LEAD_MS = 4200;
/** Il gesto di Palmino tocca la ruota tanto prima della partenza (il braccio "la lancia"). */
export const PALMINO_SWING_CONTACT_MS = 450;

/** Round in cui la ruota può comparire (la domanda scelta è di solo testo). */
const WHEEL_ROUND_KINDS: readonly RoundKind[] = ["standard", "bonus", "final", "bet", "comeback"];

export function palminoWheelRoundKind(kind: RoundKind): boolean {
  return WHEEL_ROUND_KINDS.includes(kind) && !isCategoryRound(kind);
}

/** Ruote al massimo per serata. */
export function maxWheelsPerGame(totalQuestions: number): number {
  return totalQuestions >= 20 ? 3 : 2;
}

export interface WheelPlanRound {
  id: string;
  kind: RoundKind;
  /** domande giocabili del round in ordine (riserve escluse) */
  questions: { sqId: string }[];
  /**
   * Round con categorie: si gioca una sola categoria, quante domande non si sa prima.
   * Si conta il minimo (stima prudente della numerazione).
   */
  playedCount?: number;
}

export interface WheelSlot {
  roundId: string;
  /** domanda segnaposto: al giro la sostituisce la candidata dello spicchio vincente */
  sqId: string;
  /** numero d'ordine (prudente) della domanda nella serata, da 1 */
  number: number;
}

export interface WheelPlanOptions {
  probability?: number;
  /** test: numeri di domanda in cui la ruota compare di sicuro (se ammessi dalle regole) */
  force?: readonly number[];
}

/** Piano deterministico delle ruote di una serata. */
export function planPalminoWheels(rounds: readonly WheelPlanRound[], seed: string, opts: WheelPlanOptions = {}): WheelSlot[] {
  const probability = opts.probability ?? PALMINO_WHEEL_PROBABILITY;
  const force = new Set(opts.force ?? []);
  const rand = seededRandom(`palmino-wheel|${seed}`);
  // numerazione della serata e posti ammessi
  const eligible: { slot: WheelSlot; roundIndex: number }[] = [];
  let number = 0;
  let total = 0;
  for (const r of rounds) total += r.playedCount ?? r.questions.length;
  rounds.forEach((r, ri) => {
    const count = r.playedCount ?? r.questions.length;
    const ok = palminoWheelRoundKind(r.kind);
    for (let i = 0; i < count; i++) {
      number++;
      if (!ok) continue;
      const q = r.questions[i];
      if (!q || i === 0) continue; // mai sulla prima domanda di un round
      if (number < PALMINO_WHEEL_MIN_NUMBER) continue;
      if (number >= total) continue; // mai sull'ultima domanda della serata
      eligible.push({ slot: { roundId: r.id, sqId: q.sqId, number }, roundIndex: ri });
    }
  });
  const max = maxWheelsPerGame(total);
  const out: WheelSlot[] = [];
  const usedRounds = new Set<number>();
  let lastNumber = -10;
  for (const e of eligible) {
    // un numero casuale per ogni domanda ammessa, sempre: il piano non dipende dalle scelte precedenti
    const r = rand();
    const picked = force.size > 0 ? force.has(e.slot.number) : r < probability;
    if (!picked) continue;
    if (out.length >= max) continue;
    if (usedRounds.has(e.roundIndex)) continue;
    if (e.slot.number - lastNumber <= 1) continue; // mai due di fila
    out.push(e.slot);
    usedRounds.add(e.roundIndex);
    lastNumber = e.slot.number;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spicchi: categorie con domande davvero disponibili e una candidata per categoria
// ---------------------------------------------------------------------------
export interface WheelSegmentPick {
  label: string;
  questionId: string;
  difficulty: number;
  freshness: ReturnType<typeof freshnessOf>;
}

const TIER = { nuova: 0, giocata: 1, prenotata: 2, vista: 3 } as const;
const BAND_INDEX: Record<DifficultyBand, number> = { facile: 0, media: 1, difficile: 2 };

export interface PickSegmentsInput {
  candidates: readonly ComposeCandidate[];
  /** fascia di difficoltà della domanda segnaposto (la candidata la rispetta se può) */
  band: DifficultyBand;
  seed: string;
  /** domande da non usare (già nella serata o candidate di altre ruote) */
  excludeIds?: Iterable<string>;
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/**
 * Sceglie gli spicchi: le categorie (da 6 a 8) con una domanda candidata ciascuna, secondo le
 * regole del compositore: prima le domande mai viste da questo host / mai giocate, poi la fascia
 * di difficoltà del segnaposto, poi le giocate meno di recente. Ordine degli spicchi mescolato.
 * Restituisce [] se le categorie disponibili sono meno di 3 (niente ruota).
 */
export function pickWheelSegments(input: PickSegmentsInput): WheelSegmentPick[] {
  const exclude = new Set(input.excludeIds ?? []);
  const rand = seededRandom(`palmino-segments|${input.seed}`);
  const sorted = [...input.candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const best = new Map<string, { c: ComposeCandidate; key: number[] }>();
  for (const c of sorted) {
    const r = rand();
    if (exclude.has(c.id)) continue;
    const label = c.category.trim();
    if (label.length < 2) continue;
    const key = [TIER[freshnessOf(c)], Math.abs(BAND_INDEX[bandOf(c.difficulty)] - BAND_INDEX[input.band]), c.lastPlayedAt ? Date.parse(c.lastPlayedAt) || 0 : 0, r];
    const k = label.toLocaleLowerCase("it-IT");
    const cur = best.get(k);
    if (!cur || lexLess(key, cur.key)) best.set(k, { c: { ...c, category: label }, key });
  }
  const rank = (x: { key: number[] }) => [x.key[0], x.key[1], x.key[3]];
  const cats = [...best.values()].sort((a, b) => (lexLess(rank(a), rank(b)) ? -1 : lexLess(rank(b), rank(a)) ? 1 : 0));
  if (cats.length < PALMINO_WHEEL_SEGMENTS.floor) return [];
  const want = PALMINO_WHEEL_SEGMENTS.min + Math.floor(rand() * (PALMINO_WHEEL_SEGMENTS.max - PALMINO_WHEEL_SEGMENTS.min + 1));
  const chosen = cats.slice(0, Math.min(want, cats.length));
  // ordine degli spicchi mescolato (Fisher–Yates con il seme)
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen.map(({ c }) => ({ label: c.category.slice(0, 40), questionId: c.id, difficulty: c.difficulty, freshness: freshnessOf(c) }));
}

// ---------------------------------------------------------------------------
// Piano salvato nel round (game_rounds.palmino_wheel)
// ---------------------------------------------------------------------------
export interface StoredPalminoSegment {
  sqId: string;
  position: number;
  label: string;
}

export interface StoredPalminoWheel {
  slotSqId: string;
  slotPosition: number;
  /** numero (prudente) della domanda nella serata */
  number: number;
  segments: StoredPalminoSegment[];
  /** dopo il giro: candidata vincente (ha preso il posto del segnaposto) */
  winnerSqId?: string | null;
}

/** id pubblico di uno spicchio (mai l'id della domanda candidata) */
export function palminoSegmentId(index: number): string {
  return `palmino-${index}`;
}
