import { describe, expect, it } from "vitest";
import type { GamePhase, LeaderboardEntry, PublicQuestion, PublicRound, PublicState, QuestionRules } from "@/lib/game-engine/types";
import { assumesGameGoesOn, lineFitsMoment, mentionsNextQuestion, questionMoment } from "@/features/game/moment";
import { isQuestionQuip, REVEAL_QUIPS, revealOutcome, stripAudioTags } from "@/features/game/lines";
import {
  FIXED_POOLS,
  findScriptLine,
  genericScriptLines,
  lastQuestionSuspenseLine,
  lineId,
  podiumLines,
  podiumPlan,
  revealQuip,
  roundWinnerLine,
  sessionLinesFor,
  speechFor,
} from "@/features/game/script";
import { questionIntroMaxMs, questionIntroMs, questionIntroVisible } from "@/features/game/question-intro";
import { rankRoundStandings } from "@/lib/game-engine/ranking";
import { introSkipUnanimous } from "@/lib/game-engine/intro-skip";
import { detectShowEvents, detectTeamEvents, type ShowPlayer } from "@/lib/show/events";
import { directShow } from "@/lib/show/director";
import { DEFAULT_DIRECTOR_CONFIG, type DialogueTemplate } from "@/lib/show/types";
import { planAutoplay, type AutoplayContext } from "@/lib/game-engine/autoplay";
import { suggestNextCommand } from "@/lib/game-engine/transitions";
import { roundStandingsForShow } from "@/features/game/teams-view";

const rules: QuestionRules = { correctPoints: 1000, wrongPenalty: 400, noAnswerPenalty: 0, bonusPoints: 0, durationSeconds: 20, partialScoring: false, speedBonusMax: 0, allowNegative: true, modifiers: [] };

function round(index: number, total: number): PublicRound {
  return { id: `r${index}`, index, total, title: "Cultura generale", kind: "standard", presenter: "professore", description: null, pointsMultiplier: 1, penaltyMultiplier: 1, noPenalty: false };
}

function question(id: string, pos: number, tot: number, phase: GamePhase, distribution: number[] | null = null): PublicQuestion {
  const opts = ["OPTIONS_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL", "SCORE_REVEAL"].includes(phase);
  const revealed = ["ANSWER_REVEAL", "SCORE_REVEAL"].includes(phase);
  return {
    id,
    number: 7,
    totalInRound: tot,
    positionInRound: pos,
    type: "single",
    text: "Qual è la capitale d'Italia?",
    category: "Test",
    difficulty: 2,
    presenter: "professore",
    media: null,
    options: opts
      ? [
          { position: 0, text: "Roma" },
          { position: 1, text: "Milano" },
          { position: 2, text: "Napoli" },
          { position: 3, text: "Torino" },
        ]
      : null,
    rules,
    openedAt: null,
    closesAt: null,
    closedAt: null,
    correctPositions: revealed ? [0] : null,
    distribution: revealed ? distribution : null,
    answeredCount: null,
    animation: null,
  };
}

function state(phase: GamePhase, extra: Partial<PublicState> = {}): PublicState {
  return {
    sessionId: "s",
    code: "ABC123",
    title: "Serata",
    isTest: false,
    phase,
    version: 1,
    serverNow: "2026-11-10T20:00:00.000Z",
    phaseStartedAt: "2026-11-10T20:00:00.000Z",
    joinLocked: false,
    allowLateJoin: true,
    playerCount: 10,
    questionsPlayed: 0,
    totalQuestions: 10,
    intro: null,
    round: round(1, 3),
    question: null,
    event: null,
    vote: null,
    wheel: null,
    leaderboard: null,
    teams: null,
    teamLeaderboard: null,
    pausedFrom: null,
    recentPlayers: null,
    showLines: null,
    ...extra,
  };
}

const lb = (rows: [string, number, number][]): LeaderboardEntry[] =>
  rows.map(([nickname, points, rank], i) => ({ participantId: `p${i}`, rank, previousRank: null, nickname, points, lastDelta: 0, correctCount: 0 }));

/** "prossima" che non sia un saluto ("la prossima volta/sfida") */
const NEXT = /\bprossim[ao]\b(?!\s+(volta|serata|sfida|settimana))/i;

describe("ultima domanda: il momento", () => {
  it("riconosce l'ultima del round e l'ultima della serata", () => {
    expect(questionMoment({ question: question("q", 2, 5, "QUESTION_VISIBLE"), round: round(1, 3) })).toEqual({ lastOfRound: false, lastOfGame: false });
    expect(questionMoment({ question: question("q", 5, 5, "QUESTION_VISIBLE"), round: round(1, 3) })).toEqual({ lastOfRound: true, lastOfGame: false });
    expect(questionMoment({ question: question("q", 5, 5, "QUESTION_VISIBLE"), round: round(3, 3) })).toEqual({ lastOfRound: true, lastOfGame: true });
    expect(questionMoment({ question: null, round: round(3, 3) })).toEqual({ lastOfRound: false, lastOfGame: false });
  });

  it("filtra le battute sulla prossima domanda e sul gioco che continua", () => {
    expect(mentionsNextQuestion("Troppo facile per voi! La prossima la scelgo più cattiva.")).toBe(true);
    expect(mentionsNextQuestion("Punteggi aggiornati. Prendete appunti: alla prossima interrogo a sorpresa!")).toBe(true);
    expect(mentionsNextQuestion("Il prossimo quesito deciderà.")).toBe(true);
    expect(mentionsNextQuestion("Troppo facile per voi, eh? Allora alziamo il livello!")).toBe(true);
    expect(mentionsNextQuestion("Grazie a tutti! Alla prossima sfida!")).toBe(false);
    expect(mentionsNextQuestion("la prossima volta lascia parlare chi ha la corona")).toBe(false);
    expect(assumesGameGoesOn("Gli altri, forza, che c'è ancora tempo!")).toBe(true);
    expect(assumesGameGoesOn("O almeno fino al prossimo round.")).toBe(true);
    expect(assumesGameGoesOn("Chi ha sbagliato si rifarà. Forse.")).toBe(true);

    const mid = { lastOfRound: false, lastOfGame: false };
    const endRound = { lastOfRound: true, lastOfGame: false };
    const endGame = { lastOfRound: true, lastOfGame: true };
    expect(lineFitsMoment("La prossima la scelgo più cattiva.", mid)).toBe(true);
    expect(lineFitsMoment("La prossima la scelgo più cattiva.", endRound)).toBe(false);
    expect(lineFitsMoment("Gli altri, forza, che c'è ancora tempo!", endRound)).toBe(true);
    expect(lineFitsMoment("Gli altri, forza, che c'è ancora tempo!", endGame)).toBe(false);
  });

  it("sull'ultima domanda (del round o della serata) nessuno parla della prossima, in nessuna fase", () => {
    for (const [r, tot] of [
      [round(1, 3), 5],
      [round(3, 3), 5],
    ] as const) {
      for (let i = 0; i < 60; i++) {
        const id = `q-${i}`;
        for (const dist of [[10, 0, 0, 0], [0, 4, 3, 3], [1, 5, 2, 2], [5, 3, 1, 1], [9, 1, 0, 0]]) {
          for (const phase of ["QUESTION_VISIBLE", "OPTIONS_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL", "SCORE_REVEAL"] as GamePhase[]) {
            const s = state(phase, { round: r, question: question(id, tot, tot, phase, dist), leaderboard: lb([["Anna", 3000, 1], ["Bruno", 2000, 2]]) });
            for (const l of speechFor(s, { phase: "DRAFT" }, { readOptions: true })) {
              expect(l.text, `${phase} ${l.text}`).not.toMatch(NEXT);
              if (r.index === r.total) expect(assumesGameGoesOn(l.text) && !l.beforeCard, `${phase} ${l.text}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it("ultima della serata: annuncio e suspense con i nomi (prima del cartello), niente 'Domanda numero'", () => {
    const s = state("QUESTION_VISIBLE", {
      round: round(3, 3),
      question: question("q-last", 5, 5, "QUESTION_VISIBLE"),
      contenders: [
        { name: "Anna", points: 5000 },
        { name: "Bruno", points: 4200 },
      ],
    });
    const lines = speechFor(s, { phase: "SCORE_REVEAL" }, { readOptions: true });
    expect(lines[0]).toMatchObject({ who: "annunciatore", beforeCard: true });
    expect(FIXED_POOLS.lastOfGameCall.texts).toContain(lines[0].text);
    expect(lines[1]).toMatchObject({ who: "regina", live: true, beforeCard: true });
    expect(lines[1].text).toContain("Anna");
    expect(lines[1].text).toContain("800 punti");
    expect(lines.some((l) => /Domanda numero/.test(l.text))).toBe(false);
    expect(lines[2].beforeCard).toBeUndefined();
  });

  it("ultima del round: 'Domanda numero N' e poi 'ultima del round'", () => {
    const s = state("QUESTION_VISIBLE", { round: round(1, 3), question: question("q5", 5, 5, "QUESTION_VISIBLE") });
    const lines = speechFor(s, { phase: "SCORE_REVEAL" }, { readOptions: true });
    expect(lines[0].text).toBe("[excited] Domanda numero 7!");
    expect(FIXED_POOLS.lastOfRoundCall.texts).toContain(lines[1].text);
    expect(lines.slice(0, 2).every((l) => l.beforeCard)).toBe(true);
  });

  it("suspense senza nomi (un solo giocatore o nessun punto): battuta fissa pre-generata", () => {
    const fixed = lastQuestionSuspenseLine([{ name: "Anna", points: 100 }], "x");
    expect(fixed.live).toBeUndefined();
    expect(FIXED_POOLS.lastOfGameSuspense.texts).toContain(fixed.text);
    const tie = lastQuestionSuspenseLine(
      [
        { name: "Anna", points: 3000 },
        { name: "Bruno", points: 3000 },
      ],
      "x",
    );
    expect(tie.text).toContain("Anna e Bruno");
    expect(tie.text).toContain("appaiati");
  });

  it("ultima soluzione della serata: un attimo di silenzio prima della risposta giusta", () => {
    const s = state("ANSWER_REVEAL", { round: round(3, 3), question: question("q", 5, 5, "ANSWER_REVEAL", [4, 3, 2, 1]) });
    const lines = speechFor(s, { phase: "ANSWERS_LOCKED" }, { readOptions: true });
    expect(FIXED_POOLS.lastReveal.texts).toContain(lines[0].text);
    expect(lines[1].text).toMatch(/La risposta giusta è/);
  });

  it("le battute nuove sono nell'insieme pre-generato (voci pronte)", () => {
    const ids = new Set(genericScriptLines().map(lineId));
    for (const pool of [FIXED_POOLS.lastOfRoundCall, FIXED_POOLS.lastOfGameCall, FIXED_POOLS.lastOfGameSuspense, FIXED_POOLS.lastReveal, FIXED_POOLS.introSkipped, FIXED_POOLS.podiumWinnerCall]) {
      for (const text of pool.texts) expect(ids.has(lineId({ who: pool.who, text }))).toBe(true);
    }
    for (const pools of Object.values(REVEAL_QUIPS)) for (const pool of Object.values(pools)) for (const text of pool) expect([...ids].some((id) => id.endsWith(`|pregen|${text}`))).toBe(true);
  });
});

describe("commento alla soluzione: dice il vero", () => {
  it("esiti ai confini", () => {
    expect(revealOutcome(0, 0, 0)).toBeNull();
    expect(revealOutcome(0, 0, 5)).toBe("none"); // nessuno ha risposto, ma c'era chi giocava
    expect(revealOutcome(0, 6, 6)).toBe("none");
    expect(revealOutcome(1, 10, 10)).toBe("few");
    expect(revealOutcome(10, 10, 10)).toBe("all");
    expect(revealOutcome(9, 10, 10)).toBe("most"); // tutti meno uno
    expect(revealOutcome(9, 9, 10)).toBe("most"); // tutti quelli che hanno risposto, ma uno non ha risposto
    expect(revealOutcome(5, 10, 10)).toBe("split");
  });

  it("'nessuno' solo con zero giusti; 'pochissimi' mai con zero; 'tutti giusti' solo con tutti", () => {
    for (const p of ["professore", "regina", "palmino"] as const) {
      for (let i = 0; i < 40; i++) {
        const none = stripAudioTags(revealQuip(p, `s${i}`, "none").text);
        expect(none).toMatch(/nessuno|zero|tutti/i);
        expect(none).not.toMatch(/pochissimi|quasi/i);
        const few = stripAudioTags(revealQuip(p, `s${i}`, "few").text);
        expect(few).not.toMatch(/nessuno|zero/i);
        // "quasi tutti" non usa mai le frasi da "tutti giusti"
        expect(REVEAL_QUIPS[p].all).not.toContain(revealQuip(p, `s${i}`, "most").text);
        expect(REVEAL_QUIPS[p].all).not.toContain(revealQuip(p, `s${i}`, "split").text);
      }
    }
  });

  it("speechFor: zero giusti → battuta 'nessuno'", () => {
    const s = state("ANSWER_REVEAL", { question: question("q", 1, 5, "ANSWER_REVEAL", [0, 4, 3, 3]) });
    const lines = speechFor(s, { phase: "ANSWERS_LOCKED" }, { readOptions: true });
    expect(REVEAL_QUIPS.professore.none).toContain(lines[1].text);
  });

  it("fumetto della domanda: solo i commenti, mai la domanda o le risposte", () => {
    expect(isQuestionQuip("[excited] Bravissimi! Quasi tutti! Si vede che vi ho insegnato bene.")).toBe(true);
    expect(isQuestionQuip("Il tempo vola, io resto bellissima. Voi rispondete!")).toBe(true);
    expect(isQuestionQuip("[curious] Qual è la capitale d'Italia?")).toBe(false);
    expect(isQuestionQuip("A: Roma. B: Milano.")).toBe(false);
  });
});

describe("classifica del round", () => {
  it("ordina per punti del round (pari merito: stessa posizione), poi per totale", () => {
    const r = rankRoundStandings([
      { participantId: "a", nickname: "Anna", points: 2000, total: 9000, joinedAt: "2026-11-10T20:00:00Z" },
      { participantId: "b", nickname: "Bruno", points: 3000, total: 3000, joinedAt: "2026-11-10T20:00:00Z" },
      { participantId: "c", nickname: "Carla", points: 2000, total: 2500, joinedAt: "2026-11-10T20:00:00Z" },
      { participantId: "d", nickname: "Dino", points: -400, total: 100, joinedAt: "2026-11-10T20:00:00Z" },
    ]);
    expect(r.map((x) => [x.nickname, x.rank])).toEqual([
      ["Bruno", 1],
      ["Anna", 2],
      ["Carla", 2],
      ["Dino", 4],
    ]);
  });

  it("il vincitore del round è chi ha fatto più punti NEL round, non il primo in classifica", () => {
    const players: ShowPlayer[] = [
      { id: "a", nickname: "Anna", points: 9000, prevPoints: 9000, inPlay: true, answered: true, correct: false, responseMs: null, correctStreak: 0, wrongStreak: 1 },
      { id: "b", nickname: "Bruno", points: 4000, prevPoints: 3000, inPlay: true, answered: true, correct: true, responseMs: 900, correctStreak: 1, wrongStreak: 0 },
    ];
    const ev = detectShowEvents({ players, leaderStreak: 1, endOfRound: true, roundPoints: new Map([["a", 1000], ["b", 3000]]) });
    expect(ev.find((e) => e.type === "ROUND_WINNER")).toEqual({ type: "ROUND_WINNER", leaders: [{ id: "b", nickname: "Bruno" }], points: 3000 });
    const team = detectTeamEvents({
      mode: "teams",
      endOfRound: true,
      teams: [
        { id: "t1", name: "Rossi", points: 9000, prevPoints: 9000, members: 2 },
        { id: "t2", name: "Blu", points: 5000, prevPoints: 4000, members: 2 },
      ],
      roundPoints: new Map([["t1", 500], ["t2", 2500]]),
    });
    expect(team.find((e) => e.type === "TEAM_ROUND_WINNER")).toMatchObject({ teams: [{ id: "t2", name: "Blu" }], points: 2500 });
  });

  it("la voce di fine round annuncia il vincitore del round (punti del round)", () => {
    const s = state("SCORE_REVEAL", {
      question: question("q", 5, 5, "SCORE_REVEAL", [3, 2, 0, 0]),
      leaderboard: lb([["Anna", 9000, 1], ["Bruno", 4000, 2]]),
      roundLeaderboard: [
        { participantId: "p1", rank: 1, nickname: "Bruno", points: 3000, total: 4000 },
        { participantId: "p0", rank: 2, nickname: "Anna", points: 1000, total: 9000 },
      ],
    });
    expect(roundStandingsForShow(s)?.[0].nickname).toBe("Bruno");
    const lines = speechFor(s, { phase: "ANSWER_REVEAL" }, { readOptions: true });
    expect(lines.some((l) => l.text.includes("Il round 1 lo vince Bruno, con 3000 punti nel round"))).toBe(true);
    expect(roundWinnerLine([], 1)).toBeNull();
  });

  it("il regista scarta le battute sulla prossima domanda all'ultima del round", () => {
    const t = (id: string, text: string): DialogueTemplate => ({ id, character: "palmino", event: "ALL_WRONG", text, tone: "comico", intensity: 1, priority: 50, weight: 1, cooldownSec: 0, animation: null, enabled: true });
    const templates = [t("a", "Ma che, avete lasciato il cervello in vacanza? Dai, che la prossima la prendete!"), t("b", "Nessuno! Che disastro!")];
    const input = { events: [{ type: "ALL_WRONG" as const }], templates, history: { lastUsed: new Map(), mentionsThisRound: new Map() }, config: { ...DEFAULT_DIRECTOR_CONFIG, banterPercent: 0 }, nowMs: 0 };
    for (let i = 0; i < 30; i++) {
      const lines = directShow({ ...input, seed: `s${i}`, moment: { lastOfRound: true, lastOfGame: false } });
      expect(lines.map((l) => l.templateId)).toEqual(["b"]);
    }
  });
});

describe("cartello DOMANDA N. X e scorrimento automatico", () => {
  it("durate del cartello", () => {
    expect(questionIntroMs({ lastOfRound: false, lastOfGame: false })).toBeGreaterThanOrEqual(1200);
    expect(questionIntroMs({ lastOfRound: false, lastOfGame: false })).toBeLessThanOrEqual(1800);
    expect(questionIntroMs({ lastOfRound: true, lastOfGame: true })).toBeGreaterThan(questionIntroMs({ lastOfRound: true, lastOfGame: false }));
    expect(questionIntroVisible(500, { lastOfRound: false, lastOfGame: false }, false)).toBe(true);
    expect(questionIntroVisible(500, { lastOfRound: false, lastOfGame: false }, true)).toBe(false);
    expect(questionIntroVisible(questionIntroMaxMs({ lastOfRound: false, lastOfGame: false }) + 1, { lastOfRound: false, lastOfGame: false }, false)).toBe(false);
  });

  const base: AutoplayContext = {
    phase: "QUESTION_VISIBLE",
    roundKind: "standard",
    voteDone: false,
    hasNextQuestion: true,
    hasNextRound: true,
    now: 0,
    phaseStartedAt: 0,
    speechMs: 5000,
    introStartedAt: null,
    answersCloseAt: null,
    voteClosesAt: null,
    wheelStopsAt: null,
    wheelStopSpeechMs: 0,
    media: null,
    betRound: false,
  };

  it("il cartello allunga la lettura prima delle risposte", () => {
    const a = planAutoplay(base);
    const b = planAutoplay({ ...base, questionIntroMs: 1500 });
    expect(a.kind === "step" && b.kind === "step" && b.dueAt - a.dueAt).toBe(1500);
  });

  it("all'ultimo round, dopo i punti dell'ultima domanda, si va dritti al podio", () => {
    const p = planAutoplay({ ...base, phase: "SCORE_REVEAL", hasNextQuestion: false, hasNextRound: false });
    expect(p.kind === "step" && p.command).toBe("FINISH");
    const q = planAutoplay({ ...base, phase: "SCORE_REVEAL", hasNextQuestion: false, hasNextRound: true });
    expect(q.kind === "step" && q.command).toBe("SHOW_LEADERBOARD");
    expect(suggestNextCommand({ phase: "SCORE_REVEAL", roundKind: "standard", voteDone: false, hasNextQuestion: false, hasNextRound: false, timerExpired: false })).toBe("FINISH");
  });
});

describe("salta intro a votazione", () => {
  it("si salta solo con il voto di tutti", () => {
    expect(introSkipUnanimous(0, 0)).toBe(false);
    expect(introSkipUnanimous(2, 3)).toBe(false);
    expect(introSkipUnanimous(3, 3)).toBe(true);
    expect(introSkipUnanimous(1, 1)).toBe(true);
  });

  it("la battuta del salto è detta all'inizio del primo round", () => {
    const s = state("ROUND_INTRO", { introSkipped: true });
    const lines = speechFor(s, { phase: "INTRO" }, { readOptions: true });
    expect(FIXED_POOLS.introSkipped.texts).toContain(lines[0].text);
  });
});

describe("podio: Palmino annuncia PRIMA, il nome arriva con il vincitore", () => {
  const standings = lb([
    ["Anna", 9000, 1],
    ["Bruno", 7000, 2],
    ["Carla", 5000, 3],
    ["Dino", 1000, 4],
  ]);
  it("annuncio, rullo e nome nell'ordine giusto", () => {
    const plan = podiumPlan(standings, "seed");
    expect(plan.winnerCall?.who).toBe("palmino");
    expect(FIXED_POOLS.podiumWinnerCall.texts).toContain(plan.winnerCall?.text);
    const win = plan.steps.find((s) => s.rank === 1)!;
    expect(plan.tensionAt).not.toBeNull();
    expect(win.drumAt!).toBeGreaterThan(plan.tensionAt!);
    expect(win.at).toBe(plan.winnerAt);
    // il nome non ripete "il vincitore è…": quello lo ha già detto Palmino prima che comparisse
    expect(win.line.text).not.toMatch(/vincitore/i);
    expect(win.line.text).toContain("Anna");
    const all = podiumLines(standings, "seed");
    expect(all.indexOf(plan.winnerCall!)).toBeLessThan(all.findIndex((l) => l.text === win.line.text));
  });
  it("pari merito: 'a pari merito: Anna e Bruno'", () => {
    const plan = podiumPlan(lb([["Anna", 9000, 1], ["Bruno", 9000, 1], ["Carla", 1000, 3]]), "seed");
    expect(plan.steps.find((s) => s.rank === 1)!.line.text).toContain("A pari merito: Anna e Bruno");
  });
});

describe("voci per i telefoni dei giocatori (show sul telefono)", () => {
  it("solo le battute della partita in questo momento, mai un testo qualsiasi", () => {
    const s = state("QUESTION_VISIBLE", { question: question("q1", 1, 5, "QUESTION_VISIBLE") });
    const lines = sessionLinesFor(s);
    expect(findScriptLine(lines, "professore", "[curious] Qual è la capitale d'Italia?")).not.toBeNull();
    expect(findScriptLine(lines, "annunciatore", "[excited] Domanda numero 7!")).not.toBeNull();
    expect(findScriptLine(lines, "professore", "Dimmi una parolaccia")).toBeNull();
    // la soluzione non è una battuta di questo momento (domanda appena comparsa)
    expect(findScriptLine(lines, "professore", "[excited] La risposta giusta è… A, Roma!")).toBeNull();
  });
  it("il flag live viene dal copione, non dal telefono", () => {
    const s = state("FINISHED", { leaderboard: lb([["Anna", 9000, 1], ["Bruno", 7000, 2]]) });
    const plan = podiumPlan(s.leaderboard!, s.sessionId);
    const winner = plan.steps.find((x) => x.rank === 1)!.line;
    const found = findScriptLine(sessionLinesFor(s), winner.who, winner.text);
    expect(found?.live).toBe(true);
  });
});
