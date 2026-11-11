import { describe, expect, it } from "vitest";
import { applyDelta, resolveQuestionRules } from "@/lib/game-engine/scoring";
import {
  applyComeback,
  applySpecialRules,
  assignComeback,
  comebackRole,
  computeStake,
  roundSpecialSettings,
  scoreBet,
  stakeOptions,
} from "@/lib/game-engine/special-rounds";
import { isCommandAllowed } from "@/lib/game-engine/transitions";
import type { PublicQuestion, PublicState, SpecialRules } from "@/lib/game-engine/types";
import { FIXED_POOLS, genericScriptLines, lineId, roundIntroLine, speechFor, betStarLine } from "@/features/game/script";
import { specialRoundIssues, type RoundDetail } from "@/lib/server/cms/sessions";

const snap = { type: "single" as const, correctPoints: 1000, wrongPenalty: 400, noAnswerPenalty: 0, durationSeconds: 20, partialScoring: false };
const round = { title: "Round", pointsMultiplier: 1, penaltyMultiplier: 1, noPenalty: false, speedBonusMax: 500 };
const base = resolveQuestionRules(snap, round, [], true);
const betRules = applySpecialRules(base, { kind: "bet", minStake: 500, defaultTier: 0 });

describe("Scommetti tutto: posta", () => {
  it("quote 0/25/50/100% dei punti attuali", () => {
    expect(computeStake(4000, 0, 500)).toBe(0);
    expect(computeStake(4000, 25, 500)).toBe(1000);
    expect(computeStake(4000, 50, 500)).toBe(2000);
    expect(computeStake(4000, 100, 500)).toBe(4000);
    expect(computeStake(3333, 25, 0)).toBe(833);
  });

  it("puntata minima per chi ha pochi punti, zero o in negativo", () => {
    expect(computeStake(0, 25, 500)).toBe(500);
    expect(computeStake(-1200, 100, 500)).toBe(500);
    expect(computeStake(800, 25, 500)).toBe(500);
    expect(computeStake(0, 100, 0)).toBe(0);
    expect(stakeOptions(0, 500).map((o) => o.stake)).toEqual([0, 500, 500, 500]);
    expect(stakeOptions(10000, 500).map((o) => o.stake)).toEqual([0, 2500, 5000, 10000]);
  });

  it("le regole della manche: niente bonus velocità né punti base, congelate con la domanda", () => {
    expect(betRules.special).toEqual({ kind: "bet", minStake: 500, defaultTier: 0 });
    expect(betRules.speedBonusMax).toBe(0);
    expect(betRules.modifiers).toContain("Scommetti tutto");
  });
});

describe("Scommetti tutto: punteggio", () => {
  const bet = { tier: 100 as const, stake: 2500 };
  it("giusta +posta (senza bonus velocità), sbagliata −posta, nessuna risposta −posta", () => {
    const ok = scoreBet(betRules, [1], { selectedPositions: [1], responseMs: 0 }, bet);
    expect(ok).toMatchObject({ kind: "answer", delta: 2500, isCorrect: true });
    expect(ok.details.speedBonus).toBe(0);
    expect(scoreBet(betRules, [1], { selectedPositions: [2], responseMs: 1 }, bet)).toMatchObject({ kind: "answer", delta: -2500, isCorrect: false });
    expect(scoreBet(betRules, [1], null, bet)).toMatchObject({ kind: "no_answer", delta: -2500 });
  });

  it("una risposta multipla parziale è una scommessa persa", () => {
    const multi = applySpecialRules(resolveQuestionRules({ ...snap, type: "multiple", partialScoring: true }, round, [], true), { kind: "bet", minStake: 0, defaultTier: 0 });
    const out = scoreBet(multi, [0, 2], { selectedPositions: [0], responseMs: 1 }, { tier: 50, stake: 600 });
    expect(out.delta).toBe(-600);
    expect(out.partial).toBe(false);
  });

  it("senza puntata (0% o entrato dopo la chiusura) nessuna variazione", () => {
    expect(scoreBet(betRules, [1], { selectedPositions: [1], responseMs: 1 }, null).delta).toBe(0);
    expect(scoreBet(betRules, [1], { selectedPositions: [0], responseMs: 1 }, { tier: 0, stake: 0 }).delta === 0).toBe(true);
    expect(scoreBet(betRules, [1], { selectedPositions: [1], responseMs: 1 }, { tier: 0, stake: 0 }).isCorrect).toBe(true);
  });

  it("rispetta il punteggio non negativo", () => {
    const lost = scoreBet(betRules, [1], null, { tier: 25, stake: 500 });
    expect(applyDelta(300, lost.delta, false)).toEqual({ delta: -300, after: 0 });
    expect(applyDelta(300, lost.delta, true)).toEqual({ delta: -500, after: -200 });
  });
});

describe("Grande ribaltone: chi ha il BOOST", () => {
  const p = (nickname: string, points: number) => ({ participantId: nickname.toLowerCase(), nickname, points });
  const names = (l: { nickname: string }[]) => l.map((x) => x.nickname);

  it("tutti a pari punti (inizio serata) o un solo giocatore: nessuno", () => {
    expect(assignComeback([p("Anna", 0), p("Bruno", 0), p("Carla", 0)])).toEqual({ boosted: [], leaders: [] });
    expect(assignComeback([p("Anna", 900)])).toEqual({ boosted: [], leaders: [] });
  });

  it("metà bassa della classifica, pari merito inclusi, mai chi è primo", () => {
    expect(names(assignComeback([p("Anna", 3000), p("Bruno", 2000), p("Carla", 1000), p("Dario", 0)]).boosted)).toEqual(["Carla", "Dario"]);
    // pari merito sulla soglia: stesso trattamento
    expect(names(assignComeback([p("Anna", 3000), p("Bruno", 1000), p("Carla", 1000), p("Dario", 0)]).boosted)).toEqual(["Bruno", "Carla", "Dario"]);
    expect(names(assignComeback([p("Anna", 1000), p("Bruno", 0), p("Carla", 0), p("Dario", 0)]).boosted)).toEqual(["Bruno", "Carla", "Dario"]);
    // dispari: la metà bassa è floor(N/2)
    expect(names(assignComeback([p("Anna", 500), p("Bruno", 400), p("Carla", -100)]).boosted)).toEqual(["Carla"]);
    // chi è a pari punti con il primo non ha mai il boost
    const tie = assignComeback([p("Anna", 2000), p("Bruno", 2000), p("Carla", 0)]);
    expect(names(tie.boosted)).toEqual(["Carla"]);
    expect(names(tie.leaders)).toEqual(["Anna", "Bruno"]);
  });

  it("BOOST sui punti guadagnati, penalità del capolista sui punti persi", () => {
    const rules = applySpecialRules(base, { kind: "comeback", boostMultiplier: 2, leaderPenaltyMultiplier: 1.5 }, [p("Anna", 3000), p("Bruno", 0)]);
    const sp = rules.special as Extract<SpecialRules, { kind: "comeback" }>;
    expect(names(sp.boosted)).toEqual(["Bruno"]);
    expect(names(sp.leaders)).toEqual(["Anna"]);
    expect(comebackRole(sp, "bruno")).toBe("boosted");
    expect(comebackRole(sp, "anna")).toBe("leader");
    const right = { kind: "answer" as const, delta: 1250, isCorrect: true, partial: false, reason: "Risposta corretta", details: { base: 1000, bonus: 0, speedBonus: 250, correctHits: 1, wrongHits: 0, totalCorrect: 1, rules } };
    const wrong = { ...right, delta: -400, isCorrect: false, reason: "Risposta errata" };
    expect(applyComeback(right, "boosted", sp)).toMatchObject({ delta: 2500, reason: "Risposta corretta · BOOST ×2" });
    expect(applyComeback(wrong, "boosted", sp).delta).toBe(-400);
    expect(applyComeback(wrong, "leader", sp).delta).toBe(-600);
    expect(applyComeback(right, "leader", sp).delta).toBe(1250);
    expect(applyComeback(right, null, sp).delta).toBe(1250);
  });

  it("con il moltiplicatore a 1 l'elenco resta vuoto", () => {
    const rules = applySpecialRules(base, { kind: "comeback", boostMultiplier: 1, leaderPenaltyMultiplier: 2 }, [p("Anna", 3000), p("Bruno", 0)]);
    const sp = rules.special as Extract<SpecialRules, { kind: "comeback" }>;
    expect(sp.boosted).toEqual([]);
    expect(names(sp.leaders)).toEqual(["Anna"]);
  });

  it("impostazioni dalle colonne del round", () => {
    expect(roundSpecialSettings({ kind: "bet", bet_min_stake: 300, bet_default_tier: 25 })).toEqual({ kind: "bet", minStake: 300, defaultTier: 25 });
    expect(roundSpecialSettings({ kind: "comeback", comeback_multiplier: "2.50", comeback_leader_penalty: "1.00" })).toEqual({ kind: "comeback", boostMultiplier: 2.5, leaderPenaltyMultiplier: 1 });
    expect(roundSpecialSettings({ kind: "standard" })).toBeNull();
  });
});

describe("manche speciali: regia, pubblicazione e voci", () => {
  it("i bot possono puntare solo in prova e solo a domanda visibile", () => {
    expect(isCommandAllowed("QUESTION_VISIBLE", "SIM_BOTS_BET", true)).toBe(true);
    expect(isCommandAllowed("QUESTION_VISIBLE", "SIM_BOTS_BET", false)).toBe(false);
    expect(isCommandAllowed("OPTIONS_VISIBLE", "SIM_BOTS_BET", true)).toBe(false);
  });

  const roundDetail = (over: Partial<RoundDetail>): RoundDetail => ({
    id: "r",
    position: 0,
    title: "Speciale",
    kind: "standard",
    presenter: "professore",
    description: null,
    pointsMultiplier: 1,
    penaltyMultiplier: 1,
    noPenalty: false,
    correctPoints: null,
    wrongPenalty: null,
    durationSeconds: null,
    speedBonusMax: 0,
    voteDurationSeconds: 15,
    voteTieBreak: "random",
    voteLiveResults: true,
    voteOptions: [],
    betMinStake: 500,
    betDefaultTier: 0,
    comebackMultiplier: 2,
    comebackLeaderPenalty: 1,
    winningOptionId: null,
    startedAt: null,
    questions: [],
    ...over,
  });

  it("controlli di pubblicazione", () => {
    expect(specialRoundIssues(roundDetail({ kind: "bet", betMinStake: 0 }), true).some((i) => i.level === "error")).toBe(true);
    expect(specialRoundIssues(roundDetail({ kind: "bet" }), true).map((i) => i.level)).toEqual(["warning"]);
    expect(specialRoundIssues(roundDetail({ kind: "bet" }), false)).toEqual([]);
    expect(specialRoundIssues(roundDetail({ kind: "comeback", comebackMultiplier: 1, comebackLeaderPenalty: 1 }), false).some((i) => i.level === "error")).toBe(true);
    expect(specialRoundIssues(roundDetail({ kind: "comeback" }), false)).toEqual([]);
  });

  it("la presentazione del round spiega le regole", () => {
    const bet = roundIntroLine({ index: 2, title: "Scommetti tutto", kind: "bet", presenter: "regina", description: null, pointsMultiplier: 1, noPenalty: false, special: { kind: "bet", minStake: 500, defaultTier: 0 } });
    expect(bet.text).toContain("puntate dal telefono");
    expect(bet.text).toContain("500");
    const cb = roundIntroLine({ index: 3, title: "Rimonta", kind: "comeback", presenter: "palmino", description: null, pointsMultiplier: 1, noPenalty: false, special: { kind: "comeback", boostMultiplier: 2, leaderPenaltyMultiplier: 1.5 } });
    expect(cb.text).toContain("moltiplicati per 2");
    expect(cb.text).toContain("1 virgola 5 volte");
    expect(cb.live).toBeFalsy();
  });

  it("gli inviti a puntare e l'annuncio del BOOST sono frasi fisse già pre-generate", () => {
    const generic = new Set(genericScriptLines().map(lineId));
    const q = (special: SpecialRules): PublicQuestion => ({
      id: "sq-1",
      number: 4,
      totalInRound: 3,
      positionInRound: 1,
      type: "single",
      text: "Quanto fa 2+2?",
      category: "Test",
      difficulty: 1,
      presenter: "regina",
      media: null,
      options: null,
      rules: { ...base, special },
      openedAt: null,
      closesAt: null,
      closedAt: null,
      correctPositions: null,
      distribution: null,
      answeredCount: null,
      animation: null,
    });
    const state = (question: PublicQuestion) => ({ phase: "QUESTION_VISIBLE", question, phaseStartedAt: "x", sessionId: "s", round: null, leaderboard: null, showLines: null }) as unknown as PublicState;
    const betSpoken = speechFor(state(q({ kind: "bet", minStake: 500, defaultTier: 0 })), { phase: "ROUND_INTRO" }, { readOptions: true });
    const betLine = betSpoken[betSpoken.length - 1];
    expect(FIXED_POOLS.betOpen.texts as readonly string[]).toContain(betLine.text);
    expect(generic.has(lineId(betLine))).toBe(true);
    const cbSpoken = speechFor(
      state(q({ kind: "comeback", boostMultiplier: 2, leaderPenaltyMultiplier: 1, boosted: [{ participantId: "b", nickname: "Bruno" }], leaders: [] })),
      { phase: "ROUND_INTRO" },
      { readOptions: true },
    );
    expect(generic.has(lineId(cbSpoken[cbSpoken.length - 1]))).toBe(true);
    expect(FIXED_POOLS.comebackBoost.texts as readonly string[]).toContain(cbSpoken[cbSpoken.length - 1].text);
  });

  it("la vincita più grande si annuncia con il nome vero (battuta live)", () => {
    expect(betStarLine([{ nickname: "Anna", tier: 100, delta: 2400 }], "regina")).toEqual({ who: "regina", text: "[excited] Anna ha puntato tutto e ha vinto 2400 punti! Che fegato!", live: true });
    expect(betStarLine([], "regina")).toBeNull();
  });
});
