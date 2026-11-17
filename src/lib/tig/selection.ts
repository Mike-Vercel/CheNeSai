import type { MechanicDef } from "./games/contract";
import { validVariants, type ContentVariant } from "./games/variants";
import { gameNeedMs } from "./rules";
import type { Difficulty, GameKind } from "./types";

/**
 * TAVOLI IN GUERRA! — MOTORE DI SELEZIONE DEI MINIGIOCHI (puro e deterministico dato il seme).
 *
 * Vincoli (PDF §07):
 *  - non ripetizione: mai la stessa meccanica nella stessa serata; varianti viste di recente dallo stesso
 *    organizzatore/locale evitate;
 *  - difficoltà distribuita (facile → difficile dentro la manche, finale non solo «trivia» difficile);
 *  - solo meccaniche con contenuti pronti (almeno una variante valida);
 *  - compatibilità: se un tavolo gioca con un solo telefono, solo meccaniche `oneDeviceOk`;
 *  - tempo residuo: mai una prova che non può concludersi nel tempo della manche.
 * Se il catalogo non basta (es. registro di sviluppo con una sola meccanica) si riusa la meccanica meno usata
 * con una variante diversa e lo si DICHIARA (`repeated: true`): niente finta varietà.
 */

export interface SelectionInput {
  mechanics: MechanicDef[];
  mancheNo: number;
  slotNo: number;
  gamesInManche: number;
  kind: GameKind;
  /** meccaniche già usate in questa serata (anche più volte) */
  usedCodes: string[];
  /** varianti già usate in questa serata: "code:key" */
  usedVariants: Set<string>;
  /** varianti viste di recente dallo stesso organizzatore/locale: "code:key" */
  recentVariants: Set<string>;
  /** almeno un tavolo partecipante ha un solo telefono */
  oneDevice: boolean;
  /** tempo che resta nella manche (null = nessun limite, es. duello del Caos/spareggio) */
  remainingMs: number | null;
  seed: string;
  /** varianti di contenuto della meccanica (predefinito: proprietà facoltativa `variants`, vedi games/variants.ts) */
  variantsOf?: (def: MechanicDef) => ContentVariant[];
}

export interface Selection {
  def: MechanicDef;
  variant: ContentVariant;
  repeated: boolean;
  difficulty: Difficulty | null;
}

/** RNG deterministico (mulberry32) da una stringa. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Difficoltà desiderata per posizione: si sale dentro la manche; la prima manche resta più leggera. */
export function difficultyFor(mancheNo: number, slotNo: number, gamesInManche: number): Difficulty {
  const f = gamesInManche <= 1 ? 0 : (slotNo - 1) / (gamesInManche - 1);
  if (mancheNo === 1) return f < 0.5 ? "facile" : "media";
  if (mancheNo === 5) return f < 0.34 ? "media" : f < 0.99 ? "media" : "difficile";
  return f < 0.25 ? "facile" : f < 0.75 ? "media" : "difficile";
}

function pick<T>(list: T[], rnd: () => number): T {
  return list[Math.floor(rnd() * list.length) % list.length];
}

/** Duello del Caos: prima la sua meccanica (stessa sfida per i due tavoli, +50 a chi vince). */
export const CAOS_MECHANIC = "bottone-del-caos";

/**
 * Duelli che NON vanno bene per il Caos né per lo spareggio, dove serve una sfida IDENTICA e alla pari:
 * cooperativi (si vince o si perde insieme), con ruoli diversi (attaccante/bersaglio) o di bluff tra i due tavoli.
 * Restano normali prove della manche.
 */
export const NOT_FOR_CAOS = new Set([
  "il-patto-di-60-secondi",
  "caccia-alla-capolista",
  "contrattacco",
  "furto-con-destrezza",
  "la-trappola",
  "scambio-di-posta",
  "alleanza-espressa",
  "credici-o-no",
  "fiducia-cieca",
  "la-bugia-piu-credibile",
  "doppio-gioco",
  "la-frase-a-meta",
  "l-imboscata",
]);

/** La meccanica è adatta al tipo di prova? */
export function fitsKind(def: MechanicDef, kind: GameKind): boolean {
  if (kind === "caos") return def.input === "duel" && !NOT_FOR_CAOS.has(def.code);
  if (kind === "tiebreak") return (def.input === "team" || def.input === "duel") && def.oneDeviceOk && !NOT_FOR_CAOS.has(def.code);
  return true;
}

export function selectGame(i: SelectionInput): Selection | null {
  const rnd = seededRandom(`${i.seed}|${i.mancheNo}|${i.slotNo}|${i.kind}`);
  const target = i.kind === "regular" ? difficultyFor(i.mancheNo, i.slotNo, i.gamesInManche) : "media";
  const variantsOf = i.variantsOf ?? validVariants;
  const ready = i.mechanics.map((def) => ({ def, variants: variantsOf(def) })).filter((m) => m.variants.length > 0);
  const compatible = ready.filter((m) => (!i.oneDevice || m.def.oneDeviceOk) && (i.remainingMs === null || gameNeedMs(m.def.timerSec) <= i.remainingMs + 90_000));
  // duello del Caos: meccaniche «duel»; se non ce ne sono, una prova di squadra giocabile con un telefono
  let pool = compatible.filter((m) => fitsKind(m.def, i.kind));
  if (!pool.length && i.kind !== "regular") pool = compatible.filter((m) => m.def.input === "team" && m.def.oneDeviceOk);
  if (!pool.length && i.kind !== "regular") pool = ready;
  if (!pool.length) return null;

  const usedCount = (code: string) => i.usedCodes.filter((c) => c === code).length;
  const fresh = pool.filter((m) => usedCount(m.def.code) === 0);
  let candidates: typeof pool;
  let repeated = false;
  const caosOwn = i.kind === "caos" ? pool.find((m) => m.def.code === CAOS_MECHANIC) : undefined;
  if (caosOwn) {
    // il Bottone del Caos ha la sua prova: si ripete volentieri (variante sempre nuova), senza dichiararla «ripetuta»
    return { def: caosOwn.def, variant: pickVariant(caosOwn.def.code, caosOwn.variants, i, target, rnd), repeated: false, difficulty: target };
  }
  if (i.kind === "regular") {
    const sameManche = fresh.filter((m) => m.def.manche === i.mancheNo);
    candidates = sameManche.length ? sameManche : fresh;
  } else {
    candidates = fresh;
  }
  if (!candidates.length) {
    // catalogo esaurito: la meccanica meno usata, dichiarata come ripetuta
    const min = Math.min(...pool.map((m) => usedCount(m.def.code)));
    candidates = pool.filter((m) => usedCount(m.def.code) === min);
    repeated = true;
  }
  // a parità, meglio le meccaniche con varianti della difficoltà giusta e mai viste qui
  const scoreOf = (m: (typeof pool)[number]) => {
    const unseen = m.variants.filter((v) => !i.usedVariants.has(`${m.def.code}:${v.key}`));
    const fresher = unseen.filter((v) => !i.recentVariants.has(`${m.def.code}:${v.key}`));
    const onTarget = fresher.filter((v) => !v.difficulty || v.difficulty === target);
    return (unseen.length ? 1 : 0) + (fresher.length ? 1 : 0) + (onTarget.length ? 1 : 0);
  };
  const best = Math.max(...candidates.map(scoreOf));
  const chosen = pick(
    candidates.filter((m) => scoreOf(m) === best),
    rnd,
  );
  return { def: chosen.def, variant: pickVariant(chosen.def.code, chosen.variants, i, target, rnd), repeated, difficulty: target };
}

/** Variante: mai vista in serata → mai vista di recente dal locale → difficoltà giusta; altrimenti la meno usata. */
export function pickVariant(code: string, variants: ContentVariant[], i: Pick<SelectionInput, "usedVariants" | "recentVariants">, target: Difficulty, rnd: () => number): ContentVariant {
  const k = (v: ContentVariant) => `${code}:${v.key}`;
  const tiers = [
    variants.filter((v) => !i.usedVariants.has(k(v)) && !i.recentVariants.has(k(v)) && (!v.difficulty || v.difficulty === target)),
    variants.filter((v) => !i.usedVariants.has(k(v)) && !i.recentVariants.has(k(v))),
    variants.filter((v) => !i.usedVariants.has(k(v)) && (!v.difficulty || v.difficulty === target)),
    variants.filter((v) => !i.usedVariants.has(k(v))),
    variants,
  ];
  for (const t of tiers) if (t.length) return pick(t, rnd);
  return variants[0];
}
