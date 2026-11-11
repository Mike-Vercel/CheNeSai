import { describe, expect, it } from "vitest";
import { presenterBubble } from "@/features/game/lines";
import type { GamePhase, LeaderboardEntry, PublicEvent, PublicQuestion, PublicRound, PublicState, PublicVote, QuestionRules } from "@/lib/game-engine/types";
import {
  categoryResultLine,
  cleanSpeech,
  eventDefinitionScriptLines,
  FIXED_POOLS,
  podiumLines,
  spellRomanNumerals,
  PALMINO_DECIDES_PREFIX,
  stripAudioTags,
  genericScriptLines,
  lineId,
  questionScriptLines,
  roundIntroLine,
  scriptQuestionFromCms,
  speechFor,
  ttsText,
  type SpokenLine,
  lobbyGreetingLines,
} from "@/features/game/script";

/**
 * Il server pre-genera le voci con le stesse funzioni pure del TV: qui si verifica
 * che OGNI battuta non-live che il TV può chiedere sia già nell'insieme pre-generato
 * (testo identico carattere per carattere, stessa voce, stesso modello), e che le
 * battute con nickname siano marcate "live".
 */

const rules: QuestionRules = { correctPoints: 1000, wrongPenalty: 400, noAnswerPenalty: 0, bonusPoints: 0, durationSeconds: 20, partialScoring: false, speedBonusMax: 0, allowNegative: true, modifiers: [] };

/** Domanda come la vede il CMS (risposte in ordine qualsiasi, con isCorrect). */
interface CmsQuestion {
  id: string;
  type: "single" | "multiple";
  text: string;
  presenter: "professore" | "regina" | "palmino";
  mediaKind: "audio" | "image" | null;
  options: { position: number; text: string; isCorrect: boolean }[];
}

const QUESTIONS: CmsQuestion[] = [
  {
    id: "7d4c1f8e-0000-4000-8000-000000000001",
    type: "single",
    text: "Qual è la capitale d'Italia?!  ",
    presenter: "professore",
    mediaKind: null,
    options: [
      { position: 2, text: "Milano", isCorrect: false },
      { position: 0, text: "Roma", isCorrect: true },
      { position: 3, text: "Torino", isCorrect: false },
      { position: 1, text: "Napoli", isCorrect: false },
    ],
  },
  {
    id: "7d4c1f8e-0000-4000-8000-000000000002",
    type: "multiple",
    text: "Quali di questi sono pianeti × davvero?",
    presenter: "regina",
    mediaKind: "image",
    options: [
      { position: 0, text: "Marte", isCorrect: true },
      { position: 1, text: "Plutone", isCorrect: false },
      { position: 2, text: "Venere", isCorrect: true },
      { position: 3, text: "Luna", isCorrect: false },
    ],
  },
  {
    id: "7d4c1f8e-0000-4000-8000-000000000003",
    type: "single",
    text: "Chi canta questa canzone?",
    presenter: "palmino",
    mediaKind: "audio",
    options: [
      { position: 0, text: "Mina", isCorrect: false },
      { position: 1, text: "Lucio Battisti", isCorrect: true },
    ],
  },
];

const EVENT_DEFS = [
  { title: "PUNTI DOPPI", tagline: "Questa domanda vale il doppio!" },
  { title: "NESSUNA PENALITÀ", tagline: "Se sbagli non perdi punti!" },
  { title: "SFIDA LAMPO", tagline: "Hai pochissimi secondi!" },
  { title: "SUPER BONUS", tagline: "Punti extra in palio!" },
  { title: "DOMANDA MISTERIOSA", tagline: "Una domanda fuori programma!" },
  { title: "RECUPERO IMPOSSIBILE", tagline: "Chi è indietro può rimontare!" },
  { title: "PALMINO DECIDE", tagline: "Palmino sceglie la sorpresa!" },
  { title: "FINALISSIMA", tagline: "La domanda che decide tutto!" },
];

const ROUNDS: PublicRound[] = [
  { id: "r1", index: 1, total: 3, title: "Cultura generale", kind: "standard", presenter: "professore", description: "Si parte piano.", pointsMultiplier: 1, penaltyMultiplier: 1, noPenalty: false },
  { id: "r2", index: 2, total: 3, title: "Scegliete voi?!", kind: "category_vote", presenter: "palmino", description: null, pointsMultiplier: 1, penaltyMultiplier: 1, noPenalty: false },
  { id: "r3", index: 3, total: 3, title: "Gran finale", kind: "final", presenter: "regina", description: null, pointsMultiplier: 2, penaltyMultiplier: 1, noPenalty: false },
  { id: "r4", index: 4, total: 4, title: "Senza paura", kind: "bonus", presenter: "regina", description: "Rischiate!", pointsMultiplier: 1, penaltyMultiplier: 1, noPenalty: true },
];

const VOTE_LABELS = ["Cinema", "Sport × tutti", "Musica anni '80"];

function baseState(phase: GamePhase, extra: Partial<PublicState> = {}): PublicState {
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
    round: ROUNDS[0],
    question: null,
    event: null,
    vote: null,
    leaderboard: null,
    teams: null,
    teamLeaderboard: null,
    pausedFrom: null,
    recentPlayers: null,
    showLines: null,
    ...extra,
  };
}

/** Domanda pubblica come la costruisce buildPublicState nella fase indicata. */
function publicQuestion(q: CmsQuestion, number: number, phase: GamePhase, distribution: number[] | null = null): PublicQuestion {
  const showOptions = ["OPTIONS_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL", "SCORE_REVEAL"].includes(phase);
  const revealed = ["ANSWER_REVEAL", "SCORE_REVEAL"].includes(phase);
  return {
    id: q.id,
    number,
    totalInRound: 5,
    positionInRound: 1,
    type: q.type,
    text: q.text,
    category: "Test",
    difficulty: 2,
    presenter: q.presenter,
    media: q.mediaKind ? { id: "m", kind: q.mediaKind, audioStartMs: 0, audioDurationMs: null, audioPlays: 1 } : null,
    options: showOptions ? q.options.map((o) => ({ position: o.position, text: o.text })).sort((a, b) => a.position - b.position) : null,
    rules,
    openedAt: null,
    closesAt: null,
    closedAt: null,
    correctPositions: revealed ? q.options.filter((o) => o.isCorrect).map((o) => o.position).sort() : null,
    distribution: revealed ? distribution : null,
    answeredCount: null,
    animation: null,
  };
}

const ids = (lines: SpokenLine[]) => new Set(lines.map(lineId));

/** Insieme pre-generato per una serata con le domande, i round e gli eventi di prova. */
function pregenSet(): Set<string> {
  const lines: SpokenLine[] = [...genericScriptLines()];
  for (const q of QUESTIONS) lines.push(...questionScriptLines(scriptQuestionFromCms(q)));
  for (const r of ROUNDS) lines.push(roundIntroLine(r));
  for (const l of VOTE_LABELS) lines.push(categoryResultLine(l));
  for (const e of EVENT_DEFS) lines.push(...eventDefinitionScriptLines(e));
  return ids(lines);
}

function expectAllPregenerated(spoken: SpokenLine[], set: Set<string>) {
  for (const l of spoken) {
    expect(l.live ?? false, `"${l.text}" non dovrebbe essere live`).toBe(false);
    expect(set.has(lineId(l)), `manca nella pre-generazione: [${l.who}] "${l.text}"`).toBe(true);
  }
}

const leaderboard: LeaderboardEntry[] = [
  { participantId: "a", rank: 1, previousRank: null, nickname: "Pippo?!", points: 4200, lastDelta: 1000, correctCount: 4 },
  { participantId: "b", rank: 2, previousRank: null, nickname: "Lulù", points: 3000, lastDelta: 0, correctCount: 3 },
  { participantId: "c", rank: 3, previousRank: null, nickname: "Zed", points: 1200, lastDelta: -400, correctCount: 1 },
];

describe("copione delle voci: pre-generazione === speechFor", () => {
  const set = pregenSet();

  it("le battute di ogni domanda, in ogni fase e con ogni distribuzione, sono già pre-generate", () => {
    const distributions = [
      [9, 1, 0, 0], // facile
      [1, 9, 3, 2], // difficile
      [5, 4, 1, 0], // media
      [0, 0, 0, 0], // nessuna risposta
    ];
    let spokenCount = 0;
    for (const q of QUESTIONS) {
      for (const number of [1, 7, 60]) {
        const flow: [GamePhase, GamePhase][] = [
          ["ROUND_INTRO", "QUESTION_VISIBLE"],
          ["QUESTION_VISIBLE", "OPTIONS_VISIBLE"],
          ["OPTIONS_VISIBLE", "ANSWERS_LOCKED"],
        ];
        for (const [from, to] of flow) {
          for (const readOptions of [true, false]) {
            const spoken = speechFor(baseState(to, { question: publicQuestion(q, number, to) }), { phase: from }, { readOptions });
            spokenCount += spoken.length;
            expectAllPregenerated(spoken, set);
          }
        }
        for (const d of distributions) {
          const spoken = speechFor(baseState("ANSWER_REVEAL", { question: publicQuestion(q, number, "ANSWER_REVEAL", d) }), { phase: "ANSWERS_LOCKED" }, { readOptions: true });
          spokenCount += spoken.length;
          expectAllPregenerated(spoken, set);
        }
      }
    }
    expect(spokenCount).toBeGreaterThan(50);
  });

  it("il testo della domanda è separato da 'Domanda numero N' (riutilizzabile in ogni serata)", () => {
    const q = QUESTIONS[0];
    const a = speechFor(baseState("QUESTION_VISIBLE", { question: publicQuestion(q, 3, "QUESTION_VISIBLE") }), { phase: "ROUND_INTRO" }, { readOptions: true });
    const b = speechFor(baseState("QUESTION_VISIBLE", { question: publicQuestion(q, 12, "QUESTION_VISIBLE") }), { phase: "ROUND_INTRO" }, { readOptions: true });
    expect(a[0]).toEqual({ who: "annunciatore", text: "[excited] Domanda numero 3!" });
    expect(b[0]).toEqual({ who: "annunciatore", text: "[excited] Domanda numero 12!" });
    expect(a[1]).toEqual(b[1]);
    expect(a[1].text).not.toMatch(/Domanda numero/);
  });

  it("round, voto di categoria ed eventi speciali coincidono", () => {
    for (const r of ROUNDS) {
      expectAllPregenerated(speechFor(baseState("ROUND_INTRO", { round: r }), { phase: "LEADERBOARD" }, { readOptions: true }), set);
    }
    const vote: PublicVote = {
      roundId: "r2",
      options: VOTE_LABELS.map((label, i) => ({ id: `o${i}`, position: i, label, votes: 3 })),
      openedAt: null,
      closesAt: null,
      closedAt: "x",
      liveResults: true,
      totalVotes: 9,
      winnerOptionId: "o1",
      tieBreak: null,
    };
    expectAllPregenerated(speechFor(baseState("CATEGORY_RESULT", { round: ROUNDS[1], vote }), { phase: "CATEGORY_VOTING" }, { readOptions: true }), set);
    for (const def of EVENT_DEFS) {
      const event: PublicEvent = { id: "e", type: "double_points", title: def.title, tagline: def.tagline, params: {}, source: "manual", animation: "a", sound: "s", targetQuestionId: null };
      const spoken = speechFor(baseState("SPECIAL_EVENT", { event }), { phase: "LEADERBOARD" }, { readOptions: true });
      expect(spoken.map((l) => l.who)).toEqual(["annunciatore", "palmino"]);
      expectAllPregenerated(spoken, set);
    }
  });

  it("frasi fisse di lobby, voto, pausa e ripresa sono generiche", () => {
    expectAllPregenerated(speechFor(baseState("LOBBY"), { phase: "READY" }, { readOptions: true }), set);
    expectAllPregenerated(speechFor(baseState("CATEGORY_VOTING", { round: ROUNDS[1] }), { phase: "ROUND_INTRO" }, { readOptions: true }), set);
    expectAllPregenerated(speechFor(baseState("PAUSED"), { phase: "OPTIONS_VISIBLE" }, { readOptions: true }), set);
    expectAllPregenerated(speechFor(baseState("OPTIONS_VISIBLE"), { phase: "PAUSED" }, { readOptions: true }), set);
  });

  it("le battute con nickname e punti sono live, le frasi fisse del finale no", () => {
    // fine round (qui senza domanda corrente): si annuncia chi è in testa
    const score = speechFor(baseState("SCORE_REVEAL", { leaderboard }), { phase: "ANSWER_REVEAL" }, { readOptions: true });
    expect(score).toEqual([{ who: "professore", text: "[excited] In testa c'è Pippo?, con 4200 punti! Applausi, prego.", live: true }]);
    // a metà round (domanda 1 di 5): una battuta fissa (pre-generata), niente classifica a voce
    const mid = speechFor(baseState("SCORE_REVEAL", { leaderboard, question: publicQuestion(QUESTIONS[0], 1, "SCORE_REVEAL") }), { phase: "ANSWER_REVEAL" }, { readOptions: true });
    expect(mid).toHaveLength(2);
    expectAllPregenerated(mid.filter((l) => !l.live), set);
    expect(mid[mid.length - 1].live).toBeFalsy();
    const lb = speechFor(baseState("LEADERBOARD", { leaderboard }), { phase: "SCORE_REVEAL" }, { readOptions: true });
    expect(lb.every((l) => l.live)).toBe(true);
    // a FINISHED il TV dice solo l'apertura: podio e saluti li scandisce la rivelazione (podiumLines)
    const fin = speechFor(baseState("FINISHED", { leaderboard }), { phase: "LEADERBOARD" }, { readOptions: true });
    expect(fin).toHaveLength(1);
    expect(FIXED_POOLS.finishedOpen.texts as readonly string[]).toContain(fin[0].text);
    const podium = podiumLines(leaderboard, "s1");
    expect(FIXED_POOLS.finishedClose.texts as readonly string[]).toContain(podium[podium.length - 1].text);
    expectAllPregenerated(podium.filter((l) => !l.live), set);
    expect(podium.filter((l) => l.live)).toHaveLength(3);
  });

  it("le varianti di pausa, ripresa, lobby, voto e finale sono tutte pre-generate", () => {
    for (let i = 0; i < 40; i++) {
      const at = `2026-11-10T20:${String(i).padStart(2, "0")}:07.${i}00Z`;
      const sid = `sess-${i}`;
      expectAllPregenerated(speechFor(baseState("PAUSED", { phaseStartedAt: at }), { phase: "LEADERBOARD" }, { readOptions: true }), set);
      expectAllPregenerated(speechFor(baseState("ROUND_INTRO", { phaseStartedAt: at, round: ROUNDS[0] }), { phase: "PAUSED" }, { readOptions: true }), set);
      expectAllPregenerated(speechFor(baseState("LOBBY", { sessionId: sid }), { phase: "READY" }, { readOptions: true }), set);
      expectAllPregenerated(speechFor(baseState("CATEGORY_VOTING", { round: { ...ROUNDS[1], id: `r-${i}` } }), { phase: "ROUND_INTRO" }, { readOptions: true }), set);
      expectAllPregenerated(speechFor(baseState("FINISHED", { sessionId: sid, leaderboard }), { phase: "LEADERBOARD" }, { readOptions: true }).filter((l) => !l.live), set);
    }
  });

  it("'Palmino decide' (slogan con prefisso) è pre-generato", () => {
    const def = EVENT_DEFS[0];
    const event: PublicEvent = { id: "e", type: "double_points", title: def.title, tagline: PALMINO_DECIDES_PREFIX + def.tagline, params: {}, source: "palmino_decides", animation: "a", sound: "s", targetQuestionId: null };
    expectAllPregenerated(speechFor(baseState("SPECIAL_EVENT", { event }), { phase: "LEADERBOARD" }, { readOptions: true }), set);
  });

  it("gli audio tag non arrivano mai allo schermo né alla voce del browser", () => {
    for (const l of genericScriptLines()) {
      const shown = stripAudioTags(l.text);
      expect(shown, l.text).not.toMatch(/[[\]]/);
      expect(shown.length).toBeGreaterThan(0);
    }
    for (const phase of ["QUESTION_VISIBLE", "OPTIONS_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL"] as GamePhase[]) {
      for (const p of ["professore", "regina", "palmino"] as const) {
        for (let i = 0; i < 30; i++) expect(presenterBubble(phase, p, `q-${i}`) ?? "").not.toMatch(/[[\]]/);
      }
    }
    expect(stripAudioTags("[giggles] Eccomi! [shouts] Sorpresaaa!")).toBe("Eccomi! Sorpresaaa!");
  });

  it("un nickname o un testo con parentesi quadre non diventa un audio tag", () => {
    expect(cleanSpeech("[shouts] Bob")).toBe("(shouts) Bob");
    const score = speechFor(baseState("SCORE_REVEAL", { leaderboard: [{ ...leaderboard[0], nickname: "[whispers]Ugo" }] }), { phase: "ANSWER_REVEAL" }, { readOptions: true });
    expect(score[0].text).toContain("(whispers)Ugo");
    expect(score[0].text.match(/\[[^\]]+\]/g)).toEqual(["[excited]"]);
  });

  it("i tag usati nel copione sono quelli previsti", () => {
    const allowed = new Set(["[excited]", "[shouts]", "[laughs]", "[giggles]", "[whispers]", "[sighs]", "[sarcastic]", "[curious]", "[clears throat]"]);
    for (const l of genericScriptLines()) for (const t of l.text.match(/\[[^\]]+\]/g) ?? []) expect(allowed.has(t), `${t} in "${l.text}"`).toBe(true);
  });

  it("l'insieme generico è finito, senza duplicati e già nella forma canonica", () => {
    const g = genericScriptLines();
    expect(new Set(g.map(lineId)).size).toBe(g.length);
    expect(g.every((l) => ttsText(l.text) === l.text && !l.live)).toBe(true);
    expect(g.filter((l) => l.text.includes("Domanda numero"))).toHaveLength(60);
  });
});

describe("numeri romani nelle domande", () => {
  it("nelle domande sui numeri romani la voce li legge lettera per lettera", () => {
    expect(spellRomanNumerals("Quale anno si scrive in numeri romani MCMLXIX?")).toBe("Quale anno si scrive in numeri romani emme, ci, emme, elle, ics, i, ics?");
  });
  it("altrove restano come sono", () => {
    expect(spellRomanNumerals("In quale secolo, il XX, nacque il cinema sonoro?")).toBe("In quale secolo, il XX, nacque il cinema sonoro?");
  });
});

describe("battute del regista fuori dai punti", () => {
  const greeting = (id: string, text: string) => ({ who: "regina" as const, text, animation: "wave", event: "PLAYERS_JOINED", id });

  it("lobby: si dicono solo i saluti nuovi, mai dopo un ricaricamento o fuori dalla lobby", () => {
    const a = greeting("1", "AMOOOORE! Che entrata, Vodka e Gigi!");
    const b = greeting("2", "Un applauso per Lalla!");
    const s1 = baseState("LOBBY", { showLines: [a] });
    expect(lobbyGreetingLines(s1, baseState("LOBBY"))).toEqual([{ who: "regina", text: a.text, live: true }]);
    // stesso saluto al polling successivo: niente ripetizioni
    expect(lobbyGreetingLines(s1, s1)).toEqual([]);
    expect(lobbyGreetingLines(baseState("LOBBY", { showLines: [b] }), s1)).toEqual([{ who: "regina", text: b.text, live: true }]);
    // TV appena ricaricato: nessun saluto ripetuto
    expect(lobbyGreetingLines(s1, null)).toEqual([]);
    expect(lobbyGreetingLines(baseState("PAUSED", { showLines: [b] }), s1)).toEqual([]);
  });

  it("inizio della finale: dopo la presentazione del round, la battuta live con primo e secondo", () => {
    const final = ROUNDS.find((r) => r.kind === "final")!;
    const line = { who: "palmino" as const, text: "MIIII, siamo alla finale! Vodka davanti, Gigi col fiato sul collo.", animation: "point", event: "FINAL_ROUND_START" };
    const out = speechFor(baseState("ROUND_INTRO", { round: final, showLines: [line] }), { phase: "SCORE_REVEAL" }, { readOptions: true });
    expect(out[0]).toEqual(roundIntroLine(final));
    expect(out[1]).toEqual({ who: "palmino", text: line.text, live: true });
    // senza battute del regista: solo la presentazione
    expect(speechFor(baseState("ROUND_INTRO", { round: final }), { phase: "SCORE_REVEAL" }, { readOptions: true })).toEqual([roundIntroLine(final)]);
  });
});
