import { describe, expect, it } from "vitest";
import { applyDelta, evaluateAnswer, resolveQuestionRules, scoreAnswer, wrongPenaltyFor, wrongPenaltyRange } from "@/lib/game-engine/scoring";
import { aggregateStandings, rankParticipants } from "@/lib/game-engine/ranking";
import { tallyVotes } from "@/lib/game-engine/voting";
import { validateNickname, nicknameKey } from "@/lib/game-engine/nickname";
import { allowedCommands, isCommandAllowed, suggestNextCommand } from "@/lib/game-engine/transitions";
import { GameError } from "@/lib/game-engine/types";
import { csvToImportPayload, validateImport } from "@/lib/server/cms/questions";

const snap = { type: "single" as const, correctPoints: 1000, wrongPenalty: 400, noAnswerPenalty: 0, durationSeconds: 20, partialScoring: false };
const round = { title: "Round 1", pointsMultiplier: 1, penaltyMultiplier: 1, noPenalty: false, speedBonusMax: 0 };

describe("regole e punteggi", () => {
  it("valori iniziali: +1000 / da -200 a -600 / 0", () => {
    const rules = resolveQuestionRules(snap, round, [], true);
    expect(scoreAnswer(rules, [0], { selectedPositions: [0], responseMs: 3000 }).delta).toBe(1000);
    expect(scoreAnswer(rules, [0], { selectedPositions: [2], responseMs: 3000 }).delta).toBe(-600); // errore nella prima fascia di tempo
    const none = scoreAnswer(rules, [0], null);
    expect(none.delta === 0).toBe(true);
    expect(none.kind).toBe("no_answer");
  });

  it("PUNTI DOPPI raddoppia sia la risposta corretta sia l'errore", () => {
    const rules = resolveQuestionRules(snap, round, [{ type: "double_points", title: "PUNTI DOPPI", params: { correctMultiplier: 2 } }], true);
    expect(rules.correctPoints).toBe(2000);
    expect(rules.wrongPenalty).toBe(800);
    expect(rules.modifiers).toContain("PUNTI DOPPI");
  });

  it("NESSUNA PENALITÀ azzera errori e mancate risposte", () => {
    const rules = resolveQuestionRules({ ...snap, noAnswerPenalty: 100 }, round, [{ type: "no_penalty", title: "NESSUNA PENALITÀ", params: {} }], true);
    expect(scoreAnswer(rules, [1], { selectedPositions: [0], responseMs: 1 }).delta === 0).toBe(true);
    expect(scoreAnswer(rules, [1], null).delta === 0).toBe(true);
  });

  it("SFIDA LAMPO riduce il tempo, SUPER BONUS aggiunge punti", () => {
    const rules = resolveQuestionRules(snap, round, [
      { type: "lightning", title: "SFIDA LAMPO", params: { durationSeconds: 6 } },
      { type: "super_bonus", title: "SUPER BONUS", params: { bonusPoints: 500 } },
    ], true);
    expect(rules.durationSeconds).toBe(6);
    expect(scoreAnswer(rules, [0], { selectedPositions: [0], responseMs: 1000 }).delta).toBe(1500);
  });

  it("round con moltiplicatori e round senza penalità", () => {
    const r = resolveQuestionRules(snap, { ...round, pointsMultiplier: 2, penaltyMultiplier: 1.5 }, [], true);
    expect(r.correctPoints).toBe(2000);
    expect(r.wrongPenalty).toBe(600);
    const np = resolveQuestionRules(snap, { ...round, noPenalty: true }, [], true);
    expect(np.wrongPenalty).toBe(0);
  });

  it("bonus velocità proporzionale al tempo", () => {
    const rules = resolveQuestionRules(snap, { ...round, speedBonusMax: 200 }, [], true);
    expect(scoreAnswer(rules, [0], { selectedPositions: [0], responseMs: 0 }).delta).toBe(1200);
    expect(scoreAnswer(rules, [0], { selectedPositions: [0], responseMs: 10000 }).delta).toBe(1100);
    expect(scoreAnswer(rules, [0], { selectedPositions: [0], responseMs: 25000 }).delta).toBe(1000);
  });

  it("selezione multipla: pieno solo con combinazione esatta", () => {
    const multi = { ...snap, type: "multiple" as const };
    const rules = resolveQuestionRules(multi, round, [], true);
    expect(scoreAnswer(rules, [0, 2], { selectedPositions: [2, 0], responseMs: 1 }).delta).toBe(1000);
    expect(scoreAnswer(rules, [0, 2], { selectedPositions: [0], responseMs: 1 }).delta).toBe(-600);
    expect(scoreAnswer(rules, [0, 2], { selectedPositions: [0, 1, 2], responseMs: 1 }).delta).toBe(-600);
  });

  it("selezione multipla con punteggio parziale", () => {
    const rules = resolveQuestionRules({ ...snap, type: "multiple", partialScoring: true }, round, [], true);
    const out = scoreAnswer(rules, [0, 1, 2], { selectedPositions: [0, 1], responseMs: 1 });
    expect(out.partial).toBe(true);
    expect(out.delta).toBe(667);
    expect(scoreAnswer(rules, [0, 1, 2], { selectedPositions: [0, 3], responseMs: 1 }).delta).toBe(-600);
  });

  it("evaluateAnswer conta corrette ed errate", () => {
    expect(evaluateAnswer([0, 3], [0, 1])).toEqual({ isCorrect: false, partial: false, correctHits: 1, wrongHits: 1 });
  });

  it("punteggio non negativo quando configurato", () => {
    expect(applyDelta(100, -400, false)).toEqual({ delta: -100, after: 0 });
    expect(applyDelta(100, -400, true)).toEqual({ delta: -400, after: -300 });
  });
});

describe("classifica deterministica", () => {
  it("spareggi: punti, corrette, tempo, ingresso", () => {
    const base = { joinedAt: "2026-11-13T20:00:00Z", correctResponseMs: 0, correctCount: 0 };
    const ranked = rankParticipants([
      { ...base, participantId: "a", nickname: "Anna", points: 1000, correctCount: 1, correctResponseMs: 5000 },
      { ...base, participantId: "b", nickname: "Bruno", points: 1000, correctCount: 1, correctResponseMs: 3000 },
      { ...base, participantId: "c", nickname: "Carla", points: 2000 },
      { ...base, participantId: "d", nickname: "Dario", points: 1000, correctCount: 2 },
      { ...base, participantId: "e", nickname: "Elio", points: 1000, correctCount: 1, correctResponseMs: 3000, joinedAt: "2026-11-13T20:01:00Z" },
    ]);
    expect(ranked.map((r) => r.participantId)).toEqual(["c", "d", "b", "e", "a"]);
    // stessi punti = pari merito: stessa posizione per d, b, e, a
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 2, 2]);
  });

  it("pari merito in testa: nessun primo unico", () => {
    const base = { joinedAt: "2026-11-13T20:00:00Z", correctResponseMs: 0, correctCount: 1 };
    const ranked = rankParticipants([
      { ...base, participantId: "a", nickname: "Anna", points: 3000 },
      { ...base, participantId: "b", nickname: "Bruno", points: 3000 },
      { ...base, participantId: "c", nickname: "Carla", points: 1000 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("aggregazione mensile per punti e per piazzamento", () => {
    const rows = [
      { identityKey: "x", nickname: "X", points: 5000, finalRank: 1, sessionDate: "2026-11-06" },
      { identityKey: "y", nickname: "Y", points: 9000, finalRank: 2, sessionDate: "2026-11-06" },
      { identityKey: "x", nickname: "X2", points: 3000, finalRank: 1, sessionDate: "2026-11-13" },
    ];
    expect(aggregateStandings(rows, "sum_points", [])[0]).toMatchObject({ identityKey: "y", total: 9000 });
    const p = aggregateStandings(rows, "placement_points", [25, 18]);
    expect(p[0]).toMatchObject({ identityKey: "x", total: 50, wins: 2, nickname: "X2" });
  });
});

describe("votazione categoria", () => {
  const opts = [
    { id: "cin", position: 0, label: "CINEMA" },
    { id: "mus", position: 1, label: "MUSICA" },
    { id: "spo", position: 2, label: "SPORT" },
  ];
  it("maggioranza semplice", () => {
    const t = tallyVotes(opts, [{ optionId: "mus" }, { optionId: "mus" }, { optionId: "cin" }], "random", null, () => 0);
    expect(t.winnerOptionId).toBe("mus");
    expect(t.method).toBe("majority");
  });
  it("parità con estrazione casuale registrata", () => {
    const t = tallyVotes(opts, [{ optionId: "mus" }, { optionId: "spo" }], "random", null, () => 0.75);
    expect(t.tied).toEqual(["mus", "spo"]);
    expect(t.winnerOptionId).toBe("spo");
    expect(t.randomPick).toBe(0.75);
  });
  it("parità: prima in ordine", () => {
    expect(tallyVotes(opts, [{ optionId: "spo" }, { optionId: "cin" }], "first", null, () => 0.9).winnerOptionId).toBe("cin");
  });
  it("parità: serve la regia", () => {
    expect(() => tallyVotes(opts, [], "admin", null, () => 0)).toThrow(GameError);
    expect(tallyVotes(opts, [], "admin", "spo", () => 0).winnerOptionId).toBe("spo");
    expect(() => tallyVotes(opts, [{ optionId: "cin" }], "admin", "spo", () => 0)).not.toThrow();
  });
});

describe("nickname", () => {
  const o = { minLength: 2, maxLength: 16 };
  it("normalizza e rende univoco", () => {
    expect(nicknameKey("Màrio  Rossi")).toBe(nicknameKey("mario rossi"));
    expect(nicknameKey("M4R10")).toBe("mario");
    const v = validateNickname("  Sara   M ", o);
    expect(v.ok && v.display).toBe("Sara M");
  });
  it("blocca parole inappropriate anche camuffate", () => {
    expect(validateNickname("str0nz0", o).ok).toBe(false);
    expect(validateNickname("C a z z o", o).ok).toBe(false);
  });
  it("non blocca nomi comuni", () => {
    for (const n of ["Negroni", "Dickens", "Raperonzolo", "Checca"]) expect(validateNickname(n, o).ok).toBe(true);
  });
  it("lunghezza e caratteri", () => {
    expect(validateNickname("A", o).ok).toBe(false);
    expect(validateNickname("x".repeat(17), o).ok).toBe(false);
    expect(validateNickname("<script>", o).ok).toBe(false);
    expect(validateNickname("Palmino", o).ok).toBe(false);
  });
});

describe("macchina a stati", () => {
  it("transizioni consentite e protette", () => {
    expect(isCommandAllowed("QUESTION_VISIBLE", "SHOW_OPTIONS", false)).toBe(true);
    expect(isCommandAllowed("QUESTION_VISIBLE", "REVEAL", false)).toBe(false);
    expect(isCommandAllowed("OPTIONS_VISIBLE", "ACTIVATE_EVENT", false)).toBe(false);
    expect(isCommandAllowed("ANSWER_REVEAL", "SHOW_QUESTION", false)).toBe(false);
    expect(isCommandAllowed("LOBBY", "RESET_TEST", false)).toBe(false);
    expect(isCommandAllowed("LOBBY", "RESET_TEST", true)).toBe(true);
    expect(allowedCommands("FINISHED", false)).toEqual([]);
  });
  it("prossima azione suggerita", () => {
    const ctx = { roundKind: "standard", voteDone: false, hasNextQuestion: true, hasNextRound: true, timerExpired: false };
    expect(suggestNextCommand({ ...ctx, phase: "ROUND_INTRO", roundKind: "category_vote" })).toBe("START_VOTE");
    expect(suggestNextCommand({ ...ctx, phase: "OPTIONS_VISIBLE", timerExpired: true })).toBe("REVEAL");
    expect(suggestNextCommand({ ...ctx, phase: "LEADERBOARD", hasNextQuestion: false, hasNextRound: false })).toBe("FINISH");
  });
});

describe("importazione domande", () => {
  it("valida il JSON generato da assistenti esterni", () => {
    const { valid, errors } = validateImport({
      questions: [
        { text: "Qual è la capitale dell'Albania?", category: "Geografia", answers: ["Tirana", "Durazzo", "Valona", "Scutari"], correct: [0] },
        { type: "multiple", text: "Quali sono pianeti?", category: "Scienza", answers: ["Marte", "Luna", "Venere", "Sole"], correct: [0, 2] },
        { text: "Rotta", category: "X", answers: ["a", "b", "c"], correct: [5] },
      ],
    });
    expect(valid).toHaveLength(2);
    expect(valid[0].status).toBe("draft");
    expect(valid[0].answerConfirmed).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0].index).toBe(2);
  });
  it("legge il CSV con lettere per le corrette", () => {
    const csv = "tipo;testo;categoria;difficolta;presentatore;A;B;C;D;corrette;durata;tag\nsingola;\"Capitale; Albania?\";Geografia;2;regina;Tirana;Durazzo;Valona;Scutari;A;15;europa|capitali";
    const payload = csvToImportPayload(csv);
    const { valid, errors } = validateImport(payload);
    expect(errors).toEqual([]);
    expect(valid[0].text).toBe("Capitale; Albania?");
    expect(valid[0].options[0].isCorrect).toBe(true);
    expect(valid[0].durationSeconds).toBe(15);
    expect(valid[0].tags).toEqual(["europa", "capitali"]);
  });
});

describe("penalità variabile per le risposte sbagliate", () => {
  it("chi sbaglia di fretta perde di più: 5 fasce di tempo", () => {
    const d = 15000;
    expect([0, 2999, 3000, 6000, 9000, 12000, 14999, 15000].map((ms) => wrongPenaltyFor(400, ms, d).penalty)).toEqual([600, 600, 500, 400, 300, 200, 200, 200]);
  });
  it("errori di fila: x1,25 al secondo, x1,5 dal terzo (tetto)", () => {
    expect([0, 1, 2, 3, 9].map((n) => wrongPenaltyFor(400, 0, 15000, n).penalty)).toEqual([600, 750, 900, 900, 900]);
    expect(wrongPenaltyFor(400, 14000, 15000, 1).penalty).toBe(250);
  });
  it("senza penalità resta zero; intervallo per le scritte", () => {
    expect(wrongPenaltyFor(0, 0, 15000, 5).penalty).toBe(0);
    expect(wrongPenaltyRange(400)).toEqual({ min: 200, max: 600 });
    expect(wrongPenaltyRange(800)).toEqual({ min: 400, max: 1200 });
  });
  it("la serie passa da scoreAnswer e finisce nei dettagli", () => {
    const rules = resolveQuestionRules(snap, round, [], true);
    const o = scoreAnswer(rules, [0], { selectedPositions: [1], responseMs: 19000 }, { priorWrongStreak: 1 });
    expect(o.delta).toBe(-250);
    expect(o.details.penalty).toEqual({ penalty: 250, speedFactor: 0.5, streakFactor: 1.25 });
    expect(o.reason).toContain("errori di fila");
  });
  it("bonus velocità arrotondato alla decina", () => {
    const rules = resolveQuestionRules(snap, { ...round, speedBonusMax: 500 }, [], true);
    expect(scoreAnswer(rules, [0], { selectedPositions: [0], responseMs: 1234 }).details.speedBonus % 10).toBe(0);
  });
});
