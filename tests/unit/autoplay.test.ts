import { describe, expect, it } from "vitest";
import {
  AUTO_BET_WINDOW_MS,
  AUTO_BREATH_MS,
  AUTO_INTRO_MS,
  AUTO_MIN_PHASE_MS,
  AUTO_MIN_STEP_MS,
  AUTO_SWITCH_DELAY_MS,
  AUTO_TIMER_MARGIN_MS,
  AUTO_WAIT_REASONS,
  estimateSpeechMs,
  planAutoplay,
  type AutoplayContext,
} from "@/lib/game-engine/autoplay";
import { isCommandAllowed } from "@/lib/game-engine/transitions";
import type { GamePhase } from "@/lib/game-engine/types";

const T0 = 1_000_000;

function ctx(over: Partial<AutoplayContext>): AutoplayContext {
  return {
    phase: "QUESTION_VISIBLE",
    roundKind: "standard",
    voteDone: false,
    hasNextQuestion: true,
    hasNextRound: true,
    now: T0,
    phaseStartedAt: T0,
    speechMs: 0,
    introStartedAt: null,
    answersCloseAt: null,
    voteClosesAt: null,
    wheelStopsAt: null,
    wheelStopSpeechMs: 0,
    media: null,
    betRound: false,
    ...over,
  };
}

function step(over: Partial<AutoplayContext>) {
  const p = planAutoplay(ctx(over));
  if (p.kind !== "step") throw new Error(`atteso un passo, trovato ${p.kind}`);
  return p;
}

describe("scorrimento automatico: quale passo", () => {
  it("lobby, pronta e pausa aspettano la regia; bozza e fine non fanno nulla", () => {
    expect(planAutoplay(ctx({ phase: "READY" }))).toEqual({ kind: "wait", reason: AUTO_WAIT_REASONS.ready });
    expect(planAutoplay(ctx({ phase: "LOBBY" }))).toEqual({ kind: "wait", reason: AUTO_WAIT_REASONS.lobby });
    expect(planAutoplay(ctx({ phase: "PAUSED" }))).toEqual({ kind: "wait", reason: AUTO_WAIT_REASONS.paused });
    expect(planAutoplay(ctx({ phase: "DRAFT" }))).toEqual({ kind: "idle" });
    expect(planAutoplay(ctx({ phase: "FINISHED" }))).toEqual({ kind: "idle" });
  });

  it("segue la stessa sequenza della regia, domanda per domanda", () => {
    expect(step({ phase: "INTRO", introStartedAt: T0 }).command).toBe("START_ROUND");
    expect(step({ phase: "ROUND_INTRO" }).command).toBe("SHOW_QUESTION");
    expect(step({ phase: "QUESTION_VISIBLE" }).command).toBe("SHOW_OPTIONS");
    expect(step({ phase: "OPTIONS_VISIBLE", answersCloseAt: T0 + 15_000 }).command).toBe("REVEAL");
    expect(step({ phase: "ANSWERS_LOCKED" }).command).toBe("REVEAL");
    expect(step({ phase: "ANSWER_REVEAL" }).command).toBe("SCORE");
    expect(step({ phase: "SPECIAL_EVENT" }).command).toBe("SHOW_QUESTION");
  });

  it("classifica solo a fine round, poi round successivo o podio", () => {
    expect(step({ phase: "SCORE_REVEAL", hasNextQuestion: true }).command).toBe("SHOW_QUESTION");
    expect(step({ phase: "SCORE_REVEAL", hasNextQuestion: false }).command).toBe("SHOW_LEADERBOARD");
    expect(step({ phase: "LEADERBOARD", hasNextQuestion: false, hasNextRound: true }).command).toBe("START_ROUND");
    expect(step({ phase: "LEADERBOARD", hasNextQuestion: false, hasNextRound: false }).command).toBe("FINISH");
    // domanda forzata (es. domanda misteriosa) dopo la classifica
    expect(step({ phase: "LEADERBOARD", hasNextQuestion: true }).command).toBe("SHOW_QUESTION");
    // round senza domande
    expect(step({ phase: "ROUND_INTRO", hasNextQuestion: false, hasNextRound: true }).command).toBe("START_ROUND");
    expect(step({ phase: "ROUND_INTRO", hasNextQuestion: false, hasNextRound: false }).command).toBe("FINISH");
    expect(step({ phase: "INTRO", hasNextRound: false }).command).toBe("FINISH");
  });

  it("round con votazione e con la ruota", () => {
    expect(step({ phase: "ROUND_INTRO", roundKind: "category_vote", hasNextQuestion: false }).command).toBe("START_VOTE");
    expect(step({ phase: "CATEGORY_VOTING", roundKind: "category_vote", voteClosesAt: T0 + 15_000 }).command).toBe("CLOSE_VOTE");
    expect(step({ phase: "CATEGORY_RESULT", voteDone: true }).command).toBe("SHOW_QUESTION");
    expect(step({ phase: "CATEGORY_RESULT", voteDone: true, hasNextQuestion: false }).command).toBe("SHOW_LEADERBOARD");
    expect(step({ phase: "ROUND_INTRO", roundKind: "category_wheel", hasNextQuestion: false }).command).toBe("SPIN_WHEEL");
    expect(step({ phase: "ROUND_INTRO", roundKind: "category_wheel", voteDone: true }).command).toBe("SHOW_QUESTION");
    expect(step({ phase: "WHEEL_SPIN", voteDone: true, wheelStopsAt: T0 + 9000 }).command).toBe("SHOW_QUESTION");
  });

  it("ogni passo è un comando consentito nella fase (come lo premerebbe la regia)", () => {
    const phases: GamePhase[] = ["INTRO", "ROUND_INTRO", "CATEGORY_VOTING", "CATEGORY_RESULT", "WHEEL_SPIN", "SPECIAL_EVENT", "QUESTION_VISIBLE", "OPTIONS_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL", "SCORE_REVEAL", "LEADERBOARD"];
    for (const phase of phases) {
      for (const [hasNextQuestion, hasNextRound, voteDone] of [
        [true, true, true],
        [false, true, false],
        [false, false, true],
        [true, false, false],
      ] as const) {
        for (const roundKind of ["standard", "category_vote", "category_wheel"] as const) {
          const p = planAutoplay(ctx({ phase, roundKind, hasNextQuestion, hasNextRound, voteDone, answersCloseAt: T0, voteClosesAt: T0 }));
          if (p.kind !== "step") throw new Error(phase);
          expect(isCommandAllowed(phase, p.command, false), `${phase} → ${p.command}`).toBe(true);
        }
      }
    }
  });
});

describe("scorrimento automatico: quando", () => {
  it("aspetta che il presentatore finisca di parlare più una pausa di respiro", () => {
    expect(step({ phase: "ANSWER_REVEAL", speechMs: 9000 }).dueAt).toBe(T0 + 9000 + AUTO_BREATH_MS);
    // battuta breve: resta comunque il tempo minimo della schermata
    expect(step({ phase: "ANSWER_REVEAL", speechMs: 500 }).dueAt).toBe(T0 + AUTO_MIN_PHASE_MS.ANSWER_REVEAL! + AUTO_BREATH_MS);
    expect(step({ phase: "LEADERBOARD", speechMs: 0, hasNextQuestion: false }).dueAt).toBe(T0 + AUTO_MIN_PHASE_MS.LEADERBOARD! + AUTO_BREATH_MS);
  });

  it("il conto parte dall'inizio della fase (un comando laterale non sposta il passo)", () => {
    const a = step({ phase: "SCORE_REVEAL", speechMs: 8000, now: T0 }).dueAt;
    const b = step({ phase: "SCORE_REVEAL", speechMs: 8000, now: T0 + 3000 }).dueAt;
    expect(b).toBe(a);
  });

  it("mai prima di un minimo da adesso, e un attimo di respiro quando si attiva a fase in corso", () => {
    // fase iniziata da tempo: il passo è già scaduto
    expect(step({ phase: "ANSWER_REVEAL", phaseStartedAt: T0 - 60_000 }).dueAt).toBe(T0 + AUTO_MIN_STEP_MS);
    expect(step({ phase: "ANSWER_REVEAL", phaseStartedAt: T0 - 60_000, minDelayMs: AUTO_SWITCH_DELAY_MS }).dueAt).toBe(T0 + AUTO_SWITCH_DELAY_MS);
  });

  it("risposte: il timer scorre per intero (lettura delle risposte compresa)", () => {
    const close = T0 + 4000 + 15_000; // 4 s di lettura + 15 s di tempo
    expect(step({ phase: "OPTIONS_VISIBLE", answersCloseAt: close, speechMs: 30_000 }).dueAt).toBe(close + AUTO_TIMER_MARGIN_MS + AUTO_BREATH_MS);
  });

  it("votazione: alla chiusura, ma non prima che Palmino abbia finito", () => {
    expect(step({ phase: "CATEGORY_VOTING", voteClosesAt: T0 + 15_000, speechMs: 3000 }).dueAt).toBe(T0 + 15_000 + AUTO_TIMER_MARGIN_MS);
    expect(step({ phase: "CATEGORY_VOTING", voteClosesAt: T0 + 2000, speechMs: 6000 }).dueAt).toBe(T0 + 6000 + AUTO_BREATH_MS);
  });

  it("ruota: aspetta che si fermi e la battuta d'arrivo", () => {
    expect(step({ phase: "WHEEL_SPIN", voteDone: true, wheelStopsAt: T0 + 10_000, speechMs: 4000, wheelStopSpeechMs: 3000 }).dueAt).toBe(
      T0 + 10_000 + 3000 + AUTO_BREATH_MS,
    );
  });

  it("intro: sigla completa con le regole", () => {
    expect(step({ phase: "INTRO", introStartedAt: T0 }).dueAt).toBe(T0 + AUTO_INTRO_MS + AUTO_BREATH_MS);
    // SALTA INTRO: la sigla risulta iniziata 10 minuti fa, si parte quasi subito
    expect(step({ phase: "INTRO", introStartedAt: T0 - 600_000, phaseStartedAt: T0 - 5000 }).dueAt).toBe(T0 + AUTO_MIN_STEP_MS);
  });

  it("domanda: audio dopo la lettura, video insieme, tempo per puntare nella manche Scommetti tutto", () => {
    expect(step({ phase: "QUESTION_VISIBLE", speechMs: 6000 }).dueAt).toBe(T0 + 6000 + AUTO_BREATH_MS);
    expect(step({ phase: "QUESTION_VISIBLE", speechMs: 6000, media: { kind: "audio", ms: 20_000 } }).dueAt).toBe(T0 + 26_000 + AUTO_BREATH_MS);
    expect(step({ phase: "QUESTION_VISIBLE", speechMs: 6000, media: { kind: "video", ms: 20_000 } }).dueAt).toBe(T0 + 20_000 + AUTO_BREATH_MS);
    expect(step({ phase: "QUESTION_VISIBLE", speechMs: 6000, betRound: true }).dueAt).toBe(T0 + 6000 + AUTO_BET_WINDOW_MS + AUTO_BREATH_MS);
  });
});

describe("stima della durata di una battuta senza clip", () => {
  it("ignora gli audio tag e cresce col testo", () => {
    expect(estimateSpeechMs("")).toBe(0);
    expect(estimateSpeechMs("[laughs]")).toBe(0);
    expect(estimateSpeechMs("[excited] Ciao a tutti!")).toBe(estimateSpeechMs("Ciao a tutti!"));
    const short = estimateSpeechMs("Punti assegnati!");
    const long = estimateSpeechMs("Punti assegnati! Chi ha sbagliato si inchini comunque alla sua regina, e offra da bere a tutto il pub.");
    expect(long).toBeGreaterThan(short * 3);
    // ~13 caratteri al secondo
    expect(estimateSpeechMs("a".repeat(130))).toBe(10_300);
  });
});
