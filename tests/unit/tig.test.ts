import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { MechanicDef } from "@/lib/tig/games/contract";
import { provaRapida } from "../support/tig-fixture";
import {
  applyFloor,
  assignMascots,
  awardsOrder,
  betCap,
  canTransition,
  capOwnPoints,
  caosTargetCheck,
  caosWindowOpen,
  chaosProgress,
  checkTeamName,
  checkTransfer,
  computeRanks,
  duelWinner,
  energyForGame,
  fitsInManche,
  gamesPerManche,
  leaderboardMs,
  levelFor,
  nextThreshold,
  pickMascotSlot,
  POINTS,
  runOfShow,
  topTie,
  totalMinutes,
  TRANSITIONS,
} from "@/lib/tig/rules";
import { CATALOG_ROWS } from "@/lib/tig/games/catalog";
import { CAOS_MECHANIC, difficultyFor, NOT_FOR_CAOS, seededRandom, selectGame, type SelectionInput } from "@/lib/tig/selection";
import { EVENT_STATES, eventConfigSchema } from "@/lib/tig/types";
import { fillVoiceText, pickLine } from "@/lib/tig/voices/fill";
import type { VoiceFile } from "@/lib/tig/voices/schema";

describe("TAVOLI IN GUERRA! · macchina a stati", () => {
  it("ogni stato ha le sue transizioni e i terminali non ne hanno", () => {
    for (const s of EVENT_STATES) expect(TRANSITIONS[s]).toBeDefined();
    expect(TRANSITIONS.COMPLETED).toEqual([]);
    expect(TRANSITIONS.CANCELLED).toEqual([]);
  });
  it("percorso standard consentito, scorciatoie vietate", () => {
    const path = ["DRAFT", "LOBBY_OPEN", "LOBBY_LOCKED", "INTRO", "ROUND_INTRO", "GAME_ACTIVE", "GAME_RESULTS", "LEADERBOARD", "BREAK", "ROUND_INTRO", "GAME_ACTIVE", "GAME_RESULTS", "FINAL", "AWARDS", "COMPLETED"] as const;
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1], path[i]), `${path[i - 1]} → ${path[i]}`).toBe(true);
    expect(canTransition("DRAFT", "GAME_ACTIVE")).toBe(false);
    expect(canTransition("LOBBY_OPEN", "AWARDS")).toBe(false);
    expect(canTransition("COMPLETED", "LOBBY_OPEN")).toBe(false);
    expect(canTransition("CANCELLED", "INTRO")).toBe(false);
  });
  it("pausa da ogni stato in gioco e ripresa verso lo stato di prima", () => {
    for (const s of ["INTRO", "ROUND_INTRO", "GAME_ACTIVE", "GAME_RESULTS", "LEADERBOARD", "BREAK", "FINAL", "AWARDS"] as const) {
      expect(canTransition(s, "PAUSED")).toBe(true);
      expect(canTransition("PAUSED", s)).toBe(true);
    }
    expect(canTransition("LOBBY_OPEN", "PAUSED")).toBe(false);
  });
});

describe("TAVOLI IN GUERRA! · limiti e tetti dei punti", () => {
  it("saldo mai sotto zero", () => {
    expect(applyFloor(30, -50)).toEqual({ balance: 0, applied: -30 });
    expect(applyFloor(0, -10)).toEqual({ balance: 0, applied: 0 });
    expect(applyFloor(10, 25)).toEqual({ balance: 35, applied: 25 });
  });
  it("puntata finale ≤ min(25% saldo, 250)", () => {
    expect(betCap(0)).toBe(0);
    expect(betCap(400)).toBe(100);
    expect(betCap(999)).toBe(249);
    expect(betCap(5000)).toBe(250);
    expect(betCap(-50)).toBe(0);
  });
  it("punti propri: +120 di norma, 250 nel finale; perdite -40 o la puntata consentita", () => {
    expect(capOwnPoints(150, 2, 500)).toBe(120);
    expect(capOwnPoints(240, 5, 500)).toBe(240);
    expect(capOwnPoints(400, 5, 500)).toBe(250);
    expect(capOwnPoints(-100, 3, 500)).toBe(-40);
    expect(capOwnPoints(-300, 5, 800)).toBe(-200);
    expect(capOwnPoints(-300, 5, 4000)).toBe(-250);
    expect(capOwnPoints(Number.NaN, 1, 0)).toBe(0);
  });
  it("trasferimenti: ≤ 40, ≤ 80 persi per manche, saldo, scudo, terzo attacco respinto", () => {
    expect(checkTransfer({ requested: 100, recentAttacksOnTarget: 0, targetShield: false, lostThisManche: 0, targetBalance: 500 })).toMatchObject({ amount: 40, outcome: "applied" });
    expect(checkTransfer({ requested: 40, recentAttacksOnTarget: 1, targetShield: false, lostThisManche: 60, targetBalance: 500 })).toMatchObject({ amount: 20, outcome: "applied" });
    expect(checkTransfer({ requested: 40, recentAttacksOnTarget: 1, targetShield: false, lostThisManche: 80, targetBalance: 500 })).toMatchObject({ amount: 0 });
    expect(checkTransfer({ requested: 40, recentAttacksOnTarget: 0, targetShield: false, lostThisManche: 0, targetBalance: 15 })).toMatchObject({ amount: 15 });
    expect(checkTransfer({ requested: 40, recentAttacksOnTarget: 0, targetShield: true, lostThisManche: 0, targetBalance: 500 })).toMatchObject({ amount: 0, outcome: "blocked" });
    expect(checkTransfer({ requested: 40, recentAttacksOnTarget: 2, targetShield: false, lostThisManche: 0, targetBalance: 500 })).toMatchObject({ amount: 0, outcome: "refused" });
    expect(POINTS.attacksPerWindow).toBe(2);
    expect(POINTS.attackWindowMs).toBe(600_000);
  });
});

describe("TAVOLI IN GUERRA! · classifica condivisa e spareggi", () => {
  const t = (teamId: string, score: number, wins: number, accuracy: number | null, tableNo: number, tiebreakRank: number | null = null) => ({ teamId, score, wins, accuracy, tableNo, tiebreakRank });
  it("parità: sfide vinte, poi precisione, poi posizione condivisa", () => {
    const r = computeRanks([t("a", 300, 2, 0.5, 1), t("b", 300, 3, 0.4, 2), t("c", 300, 3, 0.9, 3), t("d", 100, 1, 1, 4), t("e", 100, 1, 1, 5)]);
    expect(r.map((x) => [x.teamId, x.rank])).toEqual([
      ["c", 1],
      ["b", 2],
      ["a", 3],
      ["d", 4],
      ["e", 4],
    ]);
  });
  it("spareggio necessario solo per il primo posto ancora pari", () => {
    expect(topTie([t("a", 300, 2, 0.5, 1), t("b", 300, 2, 0.5, 2), t("c", 100, 0, 0, 3)]).sort()).toEqual(["a", "b"]);
    expect(topTie([t("a", 300, 3, 0.5, 1), t("b", 300, 2, 0.5, 2)])).toEqual([]);
    // lo spareggio decide
    const r = computeRanks([t("a", 300, 2, 0.5, 1, 2), t("b", 300, 2, 0.5, 2, 1)]);
    expect(r[0].teamId).toBe("b");
    expect(r[1].rank).toBe(2);
  });
  it("premiazione dal fondo alla vetta", () => {
    expect(awardsOrder([t("a", 300, 0, null, 1), t("b", 500, 0, null, 2), t("c", 100, 0, null, 3)])).toEqual(["c", "a", "b"]);
  });
  it("duello simmetrico: più punti, poi il più rapido tra chi ha risposto giusto", () => {
    expect(duelWinner([{ teamId: "a", points: 100, correct: true, elapsedMs: 9000 }, { teamId: "b", points: 0, correct: false, elapsedMs: 3000 }])).toBe("a");
    expect(duelWinner([{ teamId: "a", points: 100, correct: true, elapsedMs: 9000 }, { teamId: "b", points: 100, correct: true, elapsedMs: 3000 }])).toBe("b");
    expect(duelWinner([{ teamId: "a", points: 0, correct: false, elapsedMs: 9000 }, { teamId: "b", points: 0, correct: null, elapsedMs: null }])).toBe(null);
  });
});

describe("TAVOLI IN GUERRA! · Energia Caos ed evoluzione", () => {
  const th = { level2: 60, level3: 150 };
  it("livelli e avanzamento", () => {
    expect(levelFor(0, th)).toBe(1);
    expect(levelFor(60, th)).toBe(2);
    expect(levelFor(149, th)).toBe(2);
    expect(levelFor(150, th)).toBe(3);
    expect(chaosProgress(30, th)).toBeCloseTo(0.5);
    expect(chaosProgress(105, th)).toBeCloseTo(0.5);
    expect(chaosProgress(500, th)).toBe(1);
    expect(nextThreshold(10, th)).toBe(60);
    expect(nextThreshold(70, th)).toBe(150);
    expect(nextThreshold(200, th)).toBe(null);
  });
  it("si guadagna partecipando, con gli esiti e con l'energia della meccanica (con tetto); niente effetto sui punti", () => {
    expect(energyForGame({ submitted: false, correct: null, mechanicChaos: 0 })).toBe(0);
    expect(energyForGame({ submitted: true, correct: false, mechanicChaos: 0 })).toBe(10);
    expect(energyForGame({ submitted: true, correct: true, mechanicChaos: 99 })).toBe(40);
    expect(energyForGame({ submitted: true, correct: true, mechanicChaos: -5 })).toBe(20);
  });
});

describe("TAVOLI IN GUERRA! · Bottone del Caos", () => {
  const base = { paused: false, lastGameKind: "regular", caosInProgress: false, hasNextStep: true };
  it("finestre: solo tra una prova e l'altra delle manche 2–4", () => {
    expect(caosWindowOpen({ ...base, state: "LEADERBOARD", mancheNo: 2 })).toBe(true);
    expect(caosWindowOpen({ ...base, state: "GAME_RESULTS", mancheNo: 4 })).toBe(true);
    expect(caosWindowOpen({ ...base, state: "LEADERBOARD", mancheNo: 1 })).toBe(false);
    expect(caosWindowOpen({ ...base, state: "LEADERBOARD", mancheNo: 5 })).toBe(false);
    expect(caosWindowOpen({ ...base, state: "GAME_ACTIVE", mancheNo: 2 })).toBe(false);
    expect(caosWindowOpen({ ...base, state: "LEADERBOARD", mancheNo: 2, paused: true })).toBe(false);
    expect(caosWindowOpen({ ...base, state: "LEADERBOARD", mancheNo: 2, lastGameKind: "caos" })).toBe(false);
  });
  it("bersaglio: mai se stessi, mai fuori gara, max 2 sfide in 10 minuti", () => {
    expect(caosTargetCheck({ sourceTeamId: "a", targetTeamId: "a", targetActive: true, targetApproved: true, recentAttacksOnTarget: 0 })).toMatch(/tuo tavolo/);
    expect(caosTargetCheck({ sourceTeamId: "a", targetTeamId: "b", targetActive: true, targetApproved: false, recentAttacksOnTarget: 0 })).toMatch(/non è in gara/);
    expect(caosTargetCheck({ sourceTeamId: "a", targetTeamId: "b", targetActive: true, targetApproved: true, recentAttacksOnTarget: 2 })).toMatch(/due volte/);
    expect(caosTargetCheck({ sourceTeamId: "a", targetTeamId: "b", targetActive: true, targetApproved: true, recentAttacksOnTarget: 1 })).toBe(null);
  });
});

describe("TAVOLI IN GUERRA! · mascotte", () => {
  const v = (teamId: string, slot: number, at: number) => ({ teamId, slot, at });
  it("la più votata dal tavolo; parità → voto più vecchio, poi slot più basso", () => {
    expect(pickMascotSlot("a", [v("a", 3, 10), v("a", 3, 11), v("a", 5, 1)], new Set(), true)).toBe(3);
    expect(pickMascotSlot("a", [v("a", 7, 10), v("a", 5, 20)], new Set(), true)).toBe(7);
    expect(pickMascotSlot("a", [v("a", 7, 10)], new Set([7]), true)).toBe(1);
    expect(pickMascotSlot("a", [v("a", 7, 10)], new Set([7]), false)).toBe(7);
  });
  it("modalità standard: ogni slot a UN tavolo, conteso vinto da chi lo ha votato di più (deterministico)", () => {
    const teams = [
      { teamId: "a", tableNo: 1, slot: null },
      { teamId: "b", tableNo: 2, slot: null },
      { teamId: "c", tableNo: 3, slot: 4 },
    ];
    const votes = [v("a", 2, 5), v("b", 2, 1), v("b", 2, 2), v("a", 9, 6), v("c", 2, 0)];
    const m = assignMascots(teams, votes, true);
    expect(m.get("b")).toBe(2);
    expect(m.get("a")).toBe(9);
    expect(m.get("c")).toBe(4);
    expect(new Set(m.values()).size).toBe(3);
    // stesso input → stesso risultato
    expect([...assignMascots(teams, votes, true).entries()]).toEqual([...m.entries()]);
  });
  it("parità perfetta: vince il tavolo con il numero più basso", () => {
    const m = assignMascots(
      [
        { teamId: "x", tableNo: 5, slot: null },
        { teamId: "y", tableNo: 2, slot: null },
      ],
      [v("x", 6, 100), v("y", 6, 100)],
      true,
    );
    expect(m.get("y")).toBe(6);
    expect(m.get("x")).not.toBe(6);
  });
  it("12 tavoli senza voti: 12 mascotte diverse", () => {
    const teams = Array.from({ length: 12 }, (_, i) => ({ teamId: `t${i}`, tableNo: i + 1, slot: null }));
    expect(new Set(assignMascots(teams, [], true).values()).size).toBe(12);
  });
});

describe("TAVOLI IN GUERRA! · scaletta e configurazione", () => {
  it("115 minuti = scaletta del PDF (4+4+4+4+3), il totale è sempre la durata scelta", () => {
    const s = runOfShow(115);
    expect(s.map((x) => x.minutes)).toEqual([10, 15, 20, 20, 10, 20, 15, 5]);
    expect(s.filter((x) => x.games).map((x) => x.games)).toEqual([4, 4, 4, 4, 3]);
    for (const d of [90, 95, 100, 103, 110, 115, 118, 120]) expect(totalMinutes(runOfShow(d))).toBe(d);
  });
  it("90 minuti: una prova in meno nelle manche centrali", () => {
    expect(gamesPerManche(90)).toEqual([4, 3, 3, 3, 3]);
    expect(gamesPerManche(110)).toEqual([4, 4, 4, 4, 3]);
  });
  it("durate modificate dalla regia", () => {
    expect(runOfShow(115, { break: 15 }).find((x) => x.key === "break")!.minutes).toBe(15);
  });
  it("tempo residuo: niente prove troncate; transizioni dentro i limiti", () => {
    expect(fitsInManche({ mancheBudgetMs: 900_000, mancheElapsedMs: 100_000, timerSec: 60 })).toBe(true);
    expect(fitsInManche({ mancheBudgetMs: 900_000, mancheElapsedMs: 960_000, timerSec: 60 })).toBe(false);
    const ms = leaderboardMs({ mancheBudgetMs: 1_200_000, mancheElapsedMs: 100_000, gamesLeft: 3, avgGameNeedMs: 80_000, endOfManche: false });
    expect(ms).toBeGreaterThanOrEqual(12_000);
    expect(ms).toBeLessThanOrEqual(40_000);
  });
  it("configurazione: tavoli (massimo 12, come le mascotte), soglie", () => {
    expect(eventConfigSchema.safeParse({ venue: "Pub", tables: 8 }).success).toBe(true);
    expect(eventConfigSchema.safeParse({ venue: "Pub", tables: 1 }).success).toBe(false);
    expect(eventConfigSchema.safeParse({ venue: "Pub", tables: 12, mascotUnique: true }).success).toBe(true);
    expect(eventConfigSchema.safeParse({ venue: "Pub", tables: 12, mascotUnique: false }).success).toBe(true);
    expect(eventConfigSchema.safeParse({ venue: "Pub", tables: 13, mascotUnique: false }).success).toBe(false);
    expect(eventConfigSchema.safeParse({ venue: "Pub", tables: 4, chaosLevel2: 100, chaosLevel3: 50 }).success).toBe(false);
    expect(eventConfigSchema.safeParse({ venue: "Pub", tables: 4, durationMin: 80 }).success).toBe(false);
  });
  it("nomi squadra filtrati (parole e lunghezza)", () => {
    expect(checkTeamName("I Ragazzi del 3").ok).toBe(true);
    expect(checkTeamName("x").ok).toBe(false);
    expect(checkTeamName("a".repeat(30)).ok).toBe(false);
    expect(checkTeamName("Str0nzi").ok).toBe(false);
  });
});

describe("TAVOLI IN GUERRA! · motore di selezione", () => {
  function mech(code: string, o: Partial<MechanicDef> & { variants?: { key: string; difficulty?: "facile" | "media" | "difficile"; content: unknown }[] } = {}): MechanicDef {
    return {
      code,
      number: 1,
      manche: 1,
      title: code,
      input: "team",
      timerSec: 30,
      oneDeviceOk: true,
      needs: [],
      rule: "",
      contentSchema: z.object({ q: z.string() }),
      submissionSchema: z.object({}),
      publicView: () => ({}),
      score: () => ({ outcomes: [] }),
      reveal: () => ({}),
      variants: [
        { key: "v1", difficulty: "facile", content: { q: "1" } },
        { key: "v2", difficulty: "media", content: { q: "2" } },
        { key: "v3", difficulty: "difficile", content: { q: "3" } },
      ],
      ...o,
    } as MechanicDef;
  }
  const base = (mechanics: MechanicDef[], o: Partial<SelectionInput> = {}): SelectionInput => ({ mechanics, mancheNo: 1, slotNo: 1, gamesInManche: 4, kind: "regular", usedCodes: [], usedVariants: new Set(), recentVariants: new Set(), oneDevice: false, remainingMs: 900_000, seed: "s", ...o });

  it("mai la stessa meccanica due volte se il catalogo basta", () => {
    const ms = ["a", "b", "c", "d"].map((c) => mech(c));
    const used: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const s = selectGame(base(ms, { slotNo: i, usedCodes: [...used], seed: `x${i}` }))!;
      expect(used).not.toContain(s.def.code);
      expect(s.repeated).toBe(false);
      used.push(s.def.code);
    }
  });
  it("preferisce le meccaniche della manche", () => {
    const ms = [mech("m1", { manche: 1 }), mech("m2", { manche: 2 })];
    expect(selectGame(base(ms, { mancheNo: 2 }))!.def.code).toBe("m2");
  });
  it("catalogo esaurito: riusa la meno usata e lo DICHIARA", () => {
    const s = selectGame(base([mech("solo")], { usedCodes: ["solo"], usedVariants: new Set(["solo:v1"]) }))!;
    expect(s.repeated).toBe(true);
    expect(s.variant.key).not.toBe("v1");
  });
  it("evita le varianti viste di recente nello stesso locale e segue la difficoltà", () => {
    const s = selectGame(base([mech("a")], { recentVariants: new Set(["a:v1"]), slotNo: 1 }))!;
    expect(s.variant.key).not.toBe("v1");
    expect(difficultyFor(2, 1, 4)).toBe("facile");
    expect(difficultyFor(2, 4, 4)).toBe("difficile");
    const hard = selectGame(base([mech("a")], { mancheNo: 2, slotNo: 4 }))!;
    expect(hard.variant.difficulty).toBe("difficile");
  });
  it("un solo telefono al tavolo: solo meccaniche oneDeviceOk", () => {
    const ms = [mech("multi", { oneDeviceOk: false }), mech("uno", { oneDeviceOk: true, manche: 2 })];
    expect(selectGame(base(ms, { oneDevice: true }))!.def.code).toBe("uno");
  });
  it("tempo residuo: niente prove che non finiscono", () => {
    const ms = [mech("lunga", { timerSec: 75 }), mech("corta", { timerSec: 25, manche: 3 })];
    expect(selectGame(base(ms, { remainingMs: 0 }))!.def.code).toBe("corta");
    expect(selectGame(base([mech("lunga", { timerSec: 75 })], { remainingMs: 0 }))).toBe(null);
  });
  it("senza varianti valide una meccanica non viene mai scelta", () => {
    expect(selectGame(base([mech("vuota", { variants: [{ key: "x", content: { wrong: 1 } }] } as never)]))).toBe(null);
  });
  it("duello del Caos: meccaniche «duel», altrimenti una prova di squadra giocabile con un telefono", () => {
    const ms = [mech("squadra"), mech("duello", { input: "duel", manche: 2 })];
    expect(selectGame(base(ms, { kind: "caos", remainingMs: null }))!.def.code).toBe("duello");
    expect(selectGame(base([mech("squadra")], { kind: "caos", remainingMs: null }))!.def.code).toBe("squadra");
  });
  it("duello del Caos: prima «bottone-del-caos» (anche ripetuto), mai duelli cooperativi o con ruoli diversi", () => {
    const ms = [mech("bottone-del-caos", { input: "duel", manche: 2 }), mech("duello-silenzioso", { input: "duel", manche: 5 }), mech("il-patto-di-60-secondi", { input: "duel", manche: 2 })];
    const s = selectGame(base(ms, { kind: "caos", remainingMs: null, usedCodes: ["bottone-del-caos"] }))!;
    expect(s.def.code).toBe("bottone-del-caos");
    expect(s.repeated).toBe(false);
    const senza = [mech("il-patto-di-60-secondi", { input: "duel" }), mech("duello-silenzioso", { input: "duel", manche: 5 })];
    for (const seed of ["a", "b", "c", "d"]) expect(selectGame(base(senza, { kind: "caos", remainingMs: null, seed }))!.def.code).toBe("duello-silenzioso");
    for (const seed of ["a", "b", "c", "d"]) expect(selectGame(base(senza, { kind: "tiebreak", remainingMs: null, seed }))!.def.code).toBe("duello-silenzioso");
    const codes = new Set(CATALOG_ROWS.map((r) => r[1]));
    for (const c of [CAOS_MECHANIC, ...NOT_FOR_CAOS]) expect(codes.has(c), c).toBe(true);
  });
  it("deterministico a parità di seme", () => {
    const ms = ["a", "b", "c", "d", "e"].map((c) => mech(c));
    expect(selectGame(base(ms, { seed: "uguale" }))!.def.code).toBe(selectGame(base(ms, { seed: "uguale" }))!.def.code);
    const r = seededRandom("abc");
    const r2 = seededRandom("abc");
    expect([r(), r(), r()]).toEqual([r2(), r2(), r2()]);
  });
  it("la fixture di sviluppo ha varianti valide e il punteggio non dipende dal numero di telefoni", () => {
    const content = provaRapida.variants![0].content;
    const ctx = { gameInstanceId: "g", startsAt: 0, deadlineAt: 30_000, seed: "s", participants: ["t2", "t8"], teams: [{ teamId: "t2", tableNo: 1, members: ["a", "b"], captainId: "a" }, { teamId: "t8", tableNo: 2, members: ["c", "d", "e", "f", "g", "h", "i", "j"], captainId: "c" }] };
    const out = provaRapida.score({ content, ctx, submissions: [{ teamId: "t2", memberId: "a", elapsedMs: 5000, payload: { choice: content.answer } }, { teamId: "t8", memberId: "c", elapsedMs: 5000, payload: { choice: content.answer } }] });
    expect(out.outcomes[0].points).toBe(out.outcomes[1].points);
    expect(JSON.stringify(provaRapida.publicView(content, ctx))).not.toContain(content.explain);
    expect((provaRapida.publicView(content, ctx) as Record<string, unknown>).answer).toBeUndefined();
  });
});

describe("TAVOLI IN GUERRA! · battute", () => {
  const file: VoiceFile = {
    character: { id: "x", name: "X", sex: "MASCHIO", voice: "", personality: "", role: "", tier: "presentatore", model: null, toConfirm: [] },
    lines: [
      { id: "L1", scene: "SORPASSO", tone: "", duration: "", text: "{TAVOLO_A} supera {TAVOLO_B}!", vars: ["TAVOLO_A", "TAVOLO_B"] },
      { id: "L2", scene: "SORPASSO", tone: "", duration: "", text: "Che sorpasso!", vars: [] },
      { id: "L3", scene: "EVOLUZIONE_LIV2", tone: "", duration: "", text: "{MASCOTTE_A} evolve: {TAVOLO_A} sale in posizione {POSIZIONE} con {PUNTI} punti nella manche {MANCHE}. {NOME_SQUADRA}", vars: ["MASCOTTE_A", "POSIZIONE", "PUNTI"] },
    ],
  };
  it("variabili: «il tavolo N», mascotte curata o «la mascotte del tavolo N», niente nomi degli utenti", () => {
    expect(fillVoiceText(file.lines[0].text, { tavoloA: 3, tavoloB: 8 })).toBe("Il tavolo 3 supera il tavolo 8!");
    expect(fillVoiceText(file.lines[2].text, { tavoloA: 5, mascotA: 2, posizione: 3, punti: 420, manche: 2 })).toBe("Mascotte 2 evolve: il tavolo 5 sale in posizione 3 con 420 punti nella manche 2.");
    expect(fillVoiceText("Ecco {MASCOTTE_A}!", { tavoloA: 4 })).toBe("Ecco la mascotte del tavolo 4!");
    expect(fillVoiceText("Il prossimo gioco è {MINIGIOCO}.", { minigioco: "MEMORIA LAMPO" })).toBe("Il prossimo gioco è Memoria Lampo.");
  });
  it("niente ripetizioni ravvicinate e niente battute con variabili mancanti", () => {
    expect(pickLine(file, "SORPASSO", {}, [])!.id).toBe("L2");
    expect(pickLine(file, "SORPASSO", { tavoloA: 1, tavoloB: 2 }, ["L1"])!.id).toBe("L2");
    expect(pickLine(file, "SORPASSO", { tavoloA: 1, tavoloB: 2 }, ["L2"])!.id).toBe("L1");
    expect(pickLine(file, "PAUSA", {}, [])).toBe(null);
  });
});
