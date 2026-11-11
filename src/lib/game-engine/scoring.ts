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
  };
}

/**
 * Punti per una singola risposta (o mancata risposta).
 * - Corretta: punti pieni + bonus evento + eventuale bonus velocità.
 * - Multipla con punteggio parziale: quota proporzionale se nessuna opzione
 *   errata è selezionata, altrimenti penalità.
 * - Errata: -penalità.  Nessuna risposta: -penalità mancata risposta.
 */
export function scoreAnswer(rules: QuestionRules, correct: number[], answer: AnswerInput | null): ScoreOutcome {
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
        ? Math.round(rules.speedBonusMax * Math.max(0, 1 - Math.min(answer.responseMs, durationMs) / durationMs))
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
  return {
    kind: "answer",
    delta: -rules.wrongPenalty,
    isCorrect: false,
    partial: false,
    reason: rules.wrongPenalty > 0 ? "Risposta errata (penalità)" : "Risposta errata",
    details: { base: -rules.wrongPenalty, bonus: 0, speedBonus: 0, correctHits: ev.correctHits, wrongHits: ev.wrongHits, totalCorrect, rules },
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
