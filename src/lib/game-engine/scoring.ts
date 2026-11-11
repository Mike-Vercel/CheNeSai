import type { QuestionRules, QuestionType, SpecialEventParams, SpecialEventType } from "./types";

export interface SnapshotScoring {
  type: QuestionType;
  correctPoints: number;
  wrongPenalty: number;
  noAnswerPenalty: number;
  durationSeconds: number;
  partialScoring: boolean;
}

export interface RoundScoring {
  title: string;
  pointsMultiplier: number;
  penaltyMultiplier: number;
  noPenalty: boolean;
  speedBonusMax: number;
}

export interface AppliedEvent {
  type: SpecialEventType;
  title: string;
  params: SpecialEventParams;
}

const EVENT_DEFAULTS: Partial<Record<SpecialEventType, SpecialEventParams>> = {
  double_points: { correctMultiplier: 2, wrongMultiplier: 2 },
  lightning: { durationSeconds: 6 },
  super_bonus: { bonusPoints: 500 },
  impossible_comeback: { correctMultiplier: 3 },
  finalissima: { correctMultiplier: 5, wrongMultiplier: 2 },
};

/**
 * Calcola le regole effettive di una domanda combinando, nell'ordine:
 * snapshot congelato (già risolto domanda → round → sessione → globale),
 * moltiplicatori del round ed eventi speciali annunciati.
 * Funzione pura: usata sia per mostrare le regole sia per assegnare i punti.
 */
export function resolveQuestionRules(
  snapshot: SnapshotScoring,
  round: RoundScoring,
  events: AppliedEvent[],
  allowNegative: boolean,
): QuestionRules {
  let correctMul = round.pointsMultiplier;
  let wrongMul = round.penaltyMultiplier;
  let bonus = 0;
  let duration = snapshot.durationSeconds;
  let noPenalty = round.noPenalty;
  const modifiers: string[] = [];

  if (round.pointsMultiplier !== 1) modifiers.push(`Round ×${formatNum(round.pointsMultiplier)}`);
  if (round.penaltyMultiplier !== 1 && !round.noPenalty) modifiers.push(`Penalità round ×${formatNum(round.penaltyMultiplier)}`);
  if (round.noPenalty) modifiers.push("Round senza penalità");

  for (const ev of events) {
    const p = { ...EVENT_DEFAULTS[ev.type], ...ev.params };
    if (ev.type === "no_penalty") noPenalty = true;
    if (p.correctMultiplier && p.correctMultiplier > 0) correctMul *= p.correctMultiplier;
    if (p.wrongMultiplier && p.wrongMultiplier >= 0) wrongMul *= p.wrongMultiplier;
    if (p.bonusPoints && p.bonusPoints > 0) bonus += Math.round(p.bonusPoints);
    if (p.durationSeconds && p.durationSeconds > 0) duration = Math.min(duration, Math.round(p.durationSeconds));
    modifiers.push(ev.title);
  }

  return {
    correctPoints: Math.round(snapshot.correctPoints * correctMul),
    wrongPenalty: noPenalty ? 0 : Math.round(snapshot.wrongPenalty * wrongMul),
    noAnswerPenalty: noPenalty ? 0 : Math.round(snapshot.noAnswerPenalty * round.penaltyMultiplier),
    bonusPoints: bonus,
    durationSeconds: Math.max(3, duration),
    partialScoring: snapshot.type === "multiple" && snapshot.partialScoring,
    speedBonusMax: round.speedBonusMax,
    allowNegative,
    modifiers,
  };
}

export interface AnswerInput {
  selectedPositions: number[];
  responseMs: number;
}

/**
 * Penalità variabile per una risposta sbagliata (la base è `wrongPenalty`, già moltiplicata da
 * punti doppi, penalità di round ecc.):
 * - fretta: il tempo per rispondere è diviso in 5 fasce uguali; chi sbaglia nella prima perde di
 *   più (×1,5), poi ×1,25, ×1, ×0,75 e ×0,5 nell'ultima (numeri pochi e sempre uguali);
 * - serie di errori: 2° errore di fila ×1,25, dal 3° in poi ×1,5 (tetto).
 * Arrotondata alla decina (numeri "puliti", anche per l'archivio delle voci).
 */
export const PENALTY_SPEED_BANDS = [1.5, 1.25, 1, 0.75, 0.5] as const;
export const PENALTY_SPEED_MAX = PENALTY_SPEED_BANDS[0];
export const PENALTY_SPEED_MIN = PENALTY_SPEED_BANDS[PENALTY_SPEED_BANDS.length - 1];
export const PENALTY_STREAK = [1, 1.25, 1.5] as const;

export function wrongPenaltyFor(base: number, responseMs: number, durationMs: number, priorWrongStreak = 0): { penalty: number; speedFactor: number; streakFactor: number } {
  if (base <= 0) return { penalty: 0, speedFactor: 1, streakFactor: 1 };
  const frac = durationMs > 0 ? Math.min(1, Math.max(0, responseMs / durationMs)) : 0.5;
  const speedFactor = PENALTY_SPEED_BANDS[Math.min(PENALTY_SPEED_BANDS.length - 1, Math.floor(frac * PENALTY_SPEED_BANDS.length))];
  const streakFactor = PENALTY_STREAK[Math.min(PENALTY_STREAK.length - 1, Math.max(0, Math.floor(priorWrongStreak)))];
  return { penalty: roundTen(base * speedFactor * streakFactor), speedFactor, streakFactor };
}

/** Intervallo della penalità senza serie (per le scritte "errore da −200 a −600"). */
export function wrongPenaltyRange(base: number): { min: number; max: number } {
  return { min: roundTen(base * PENALTY_SPEED_MIN), max: roundTen(base * PENALTY_SPEED_MAX) };
}

const roundTen = (n: number) => Math.round(n / 10) * 10;

export interface AnswerEvaluation {
  isCorrect: boolean;
  partial: boolean;
  correctHits: number;
  wrongHits: number;
}

/** Valuta una risposta rispetto alla soluzione (indipendente dai punti). */
export function evaluateAnswer(selected: number[], correct: number[]): AnswerEvaluation {
  const sel = new Set(selected);
  const cor = new Set(correct);
  let correctHits = 0;
  let wrongHits = 0;
  for (const s of sel) {
    if (cor.has(s)) correctHits++;
    else wrongHits++;
  }
  const isCorrect = wrongHits === 0 && correctHits === cor.size;
  return { isCorrect, partial: !isCorrect && wrongHits === 0 && correctHits > 0, correctHits, wrongHits };
}

export interface ScoreOutcome {
  kind: "answer" | "no_answer";
  delta: number;
  isCorrect: boolean;
  partial: boolean;
  reason: string;
  details: {
    base: number;
    bonus: number;
    speedBonus: number;
    correctHits: number;
    wrongHits: number;
    totalCorrect: number;
    rules: QuestionRules;
    /** risposta sbagliata: fattori della penalità variabile */
    penalty?: { penalty: number; speedFactor: number; streakFactor: number };
  };
}

/**
 * Punti per una singola risposta (o mancata risposta).
 * - Corretta: punti pieni + bonus evento + eventuale bonus velocità.
 * - Multipla con punteggio parziale: quota proporzionale se nessuna opzione
 *   errata è selezionata, altrimenti penalità.
 * - Errata: -penalità.  Nessuna risposta: -penalità mancata risposta.
 */
export function scoreAnswer(rules: QuestionRules, correct: number[], answer: AnswerInput | null, opts: { priorWrongStreak?: number } = {}): ScoreOutcome {
  const totalCorrect = correct.length;
  if (!answer) {
    return {
      kind: "no_answer",
      delta: -rules.noAnswerPenalty,
      isCorrect: false,
      partial: false,
      reason: rules.noAnswerPenalty > 0 ? "Nessuna risposta (penalità)" : "Nessuna risposta",
      details: { base: -rules.noAnswerPenalty, bonus: 0, speedBonus: 0, correctHits: 0, wrongHits: 0, totalCorrect, rules },
    };
  }
  const ev = evaluateAnswer(answer.selectedPositions, correct);
  if (ev.isCorrect) {
    const durationMs = rules.durationSeconds * 1000;
    const speedBonus =
      rules.speedBonusMax > 0
        ? roundTen(rules.speedBonusMax * Math.max(0, 1 - Math.min(answer.responseMs, durationMs) / durationMs))
        : 0;
    const delta = rules.correctPoints + rules.bonusPoints + speedBonus;
    return {
      kind: "answer",
      delta,
      isCorrect: true,
      partial: false,
      reason: "Risposta corretta",
      details: { base: rules.correctPoints, bonus: rules.bonusPoints, speedBonus, correctHits: ev.correctHits, wrongHits: 0, totalCorrect, rules },
    };
  }
  if (rules.partialScoring && ev.partial) {
    const base = Math.round((rules.correctPoints * ev.correctHits) / totalCorrect);
    return {
      kind: "answer",
      delta: base,
      isCorrect: false,
      partial: true,
      reason: `Risposta parziale (${ev.correctHits}/${totalCorrect})`,
      details: { base, bonus: 0, speedBonus: 0, correctHits: ev.correctHits, wrongHits: 0, totalCorrect, rules },
    };
  }
  const wp = wrongPenaltyFor(rules.wrongPenalty, answer.responseMs, rules.durationSeconds * 1000, opts.priorWrongStreak ?? 0);
  return {
    kind: "answer",
    delta: -wp.penalty,
    isCorrect: false,
    partial: false,
    reason: wp.penalty > 0 ? (wp.streakFactor > 1 ? "Risposta errata (penalità, errori di fila)" : "Risposta errata (penalità)") : "Risposta errata",
    details: { base: -wp.penalty, bonus: 0, speedBonus: 0, correctHits: ev.correctHits, wrongHits: ev.wrongHits, totalCorrect, rules, penalty: wp },
  };
}

/** Applica il vincolo "punteggio non negativo" se configurato. */
export function applyDelta(pointsBefore: number, delta: number, allowNegative: boolean): { delta: number; after: number } {
  const raw = pointsBefore + delta;
  if (allowNegative || raw >= 0) return { delta, after: raw };
  return { delta: -pointsBefore, after: 0 };
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}
