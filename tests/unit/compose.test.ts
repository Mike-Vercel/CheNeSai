import { describe, expect, it } from "vitest";
import {
  bandOf,
  composeQuestions,
  freshnessOf,
  poolStats,
  roundBands,
  seededRandom,
  splitQuestions,
  type ComposeCandidate,
} from "@/lib/game-engine/compose";
import { planQuickRounds, quickSessionSchema } from "@/lib/server/cms/compose";

const CATS = ["Storia", "Geografia", "Cinema", "Musica", "Sport", "Scienza"];

/** Archivio sintetico: `n` domande, categorie e difficoltà a rotazione. */
function bank(n: number, prefix = "q", extra: (i: number) => Partial<ComposeCandidate> = () => ({})): ComposeCandidate[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${String(i).padStart(4, "0")}`,
    category: CATS[i % CATS.length],
    difficulty: (i % 5) + 1,
    lastPlayedAt: null,
    plannedElsewhere: false,
    ...extra(i),
  }));
}

const ids = (r: ReturnType<typeof composeQuestions>) => r.rounds.flat().map((p) => p.questionId);

describe("composer: helper", () => {
  it("fasce di difficoltà", () => {
    expect([1, 2, 3, 4, 5].map(bandOf)).toEqual(["facile", "facile", "media", "difficile", "difficile"]);
    expect(roundBands("bilanciata", 5)).toEqual(["facile", "media", "difficile", "facile", "media"]);
    expect(roundBands("bilanciata", 3, true)).toEqual(["media", "difficile", "difficile"]);
    expect(roundBands("difficile", 3, true)).toEqual(["difficile", "difficile", "difficile"]);
    expect(roundBands("facile", 3)).toEqual(["facile", "facile", "media"]);
  });

  it("ripartizione delle domande sui round", () => {
    expect(splitQuestions(20, 4)).toEqual([5, 5, 5, 5]);
    expect(splitQuestions(22, 4)).toEqual([6, 6, 5, 5]);
    expect(splitQuestions(3, 1)).toEqual([3]);
    expect(splitQuestions(5, 0)).toEqual([]);
  });

  it("freschezza: prenotata > giocata > nuova", () => {
    expect(freshnessOf({ lastPlayedAt: null, plannedElsewhere: false })).toBe("nuova");
    expect(freshnessOf({ lastPlayedAt: "2026-01-01T20:00:00Z", plannedElsewhere: false })).toBe("giocata");
    expect(freshnessOf({ lastPlayedAt: null, plannedElsewhere: true })).toBe("prenotata");
  });

  it("PRNG deterministico", () => {
    const a = seededRandom("x");
    const b = seededRandom("x");
    const c = seededRandom("y");
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe("composer: scelta delle domande", () => {
  it("stesso seme → stessa serata, indipendentemente dall'ordine dei candidati", () => {
    const cands = bank(200);
    const a = composeQuestions({ candidates: cands, rounds: [{ count: 5 }, { count: 5 }], mix: "bilanciata", seed: 42 });
    const b = composeQuestions({ candidates: [...cands].reverse(), rounds: [{ count: 5 }, { count: 5 }], mix: "bilanciata", seed: 42 });
    const c = composeQuestions({ candidates: cands, rounds: [{ count: 5 }, { count: 5 }], mix: "bilanciata", seed: 43 });
    expect(ids(a)).toEqual(ids(b));
    expect(ids(a)).not.toEqual(ids(c));
  });

  it("nessun doppione, nemmeno se il candidato è ripetuto in ingresso", () => {
    const cands = bank(60);
    const r = composeQuestions({ candidates: [...cands, ...cands], rounds: [{ count: 10 }, { count: 10 }, { count: 10 }], mix: "bilanciata", seed: "dup" });
    expect(ids(r)).toHaveLength(30);
    expect(new Set(ids(r)).size).toBe(30);
  });

  it("prima le mai giocate, poi le giocate meno di recente, per ultime le prenotate", () => {
    const fresh = bank(4, "fresh");
    const old = bank(3, "old", (i) => ({ lastPlayedAt: `2025-0${i + 1}-01T20:00:00Z` }));
    const recent = bank(3, "recent", (i) => ({ lastPlayedAt: `2026-11-0${i + 1}T20:00:00Z` }));
    const planned = bank(3, "planned", () => ({ plannedElsewhere: true }));
    const cands = [...planned, ...recent, ...old, ...fresh];

    const r1 = composeQuestions({ candidates: cands, rounds: [{ count: 4 }], mix: "bilanciata", seed: 1 });
    expect(ids(r1).every((id) => id.startsWith("fresh"))).toBe(true);
    expect(r1.summary).toMatchObject({ fresh: 4, repeats: 0, planned: 0, missing: 0 });

    const r2 = composeQuestions({ candidates: cands, rounds: [{ count: 7 }], mix: "bilanciata", seed: 1 });
    const picked = new Set(ids(r2));
    expect([...picked].filter((id) => id.startsWith("fresh"))).toHaveLength(4);
    expect([...picked].filter((id) => id.startsWith("old"))).toHaveLength(3);
    expect(r2.summary).toMatchObject({ fresh: 4, repeats: 3, planned: 0 });

    const r3 = composeQuestions({ candidates: cands, rounds: [{ count: 12 }], mix: "bilanciata", seed: 1 });
    expect(r3.summary).toMatchObject({ fresh: 4, repeats: 6, planned: 2, missing: 0 });
  });

  it("tra le giocate pesca dalla finestra delle meno recenti, anche a costo della difficoltà", () => {
    // 40 vecchie tutte facili e 40 recenti tutte difficili: un round difficile non deve ripescare le recenti
    const old = bank(40, "old", (i) => ({ difficulty: 1, lastPlayedAt: new Date(Date.UTC(2024, 0, 1 + i)).toISOString() }));
    const recent = bank(40, "recent", (i) => ({ difficulty: 5, lastPlayedAt: new Date(Date.UTC(2026, 10, 1, i)).toISOString() }));
    const r = composeQuestions({ candidates: [...recent, ...old], rounds: [{ count: 3, harder: true }], mix: "difficile", seed: 5 });
    expect(ids(r).every((id) => id.startsWith("old"))).toBe(true);
    expect(r.summary.offBand).toBe(3);
  });

  it("le domande delle serate di prova non contano: il chiamante passa lastPlayedAt solo dalle serate reali", () => {
    // stessa domanda vista solo in prova = candidato "nuova": deve essere scelta come le altre fresche
    const cands = bank(3);
    const r = composeQuestions({ candidates: cands, rounds: [{ count: 3 }], mix: "bilanciata", seed: 9 });
    expect(r.summary).toMatchObject({ fresh: 3, repeats: 0 });
  });

  it("esclude le domande già presenti nella serata", () => {
    const cands = bank(10);
    const exclude = cands.slice(0, 7).map((c) => c.id);
    const r = composeQuestions({ candidates: cands, rounds: [{ count: 5 }], mix: "bilanciata", seed: 3, excludeIds: exclude });
    expect(ids(r).some((id) => exclude.includes(id))).toBe(false);
    expect(r.summary).toMatchObject({ requested: 5, picked: 3, missing: 2 });
  });

  it("archivio insufficiente: segnala quante mancano", () => {
    const r = composeQuestions({ candidates: bank(7), rounds: [{ count: 5 }, { count: 5 }], mix: "bilanciata", seed: 2 });
    expect(r.summary).toMatchObject({ requested: 10, picked: 7, missing: 3 });
    expect(r.rounds[0]).toHaveLength(5);
    expect(r.rounds[1]).toHaveLength(2);
  });

  it("mai la stessa categoria due volte di fila, categorie distribuite tra i round", () => {
    const cands = bank(300);
    const r = composeQuestions({ candidates: cands, rounds: [{ count: 6 }, { count: 6 }, { count: 6 }, { count: 6, harder: true }], mix: "bilanciata", seed: "cat" });
    for (const round of r.rounds) {
      for (let i = 1; i < round.length; i++) expect(round[i].category).not.toBe(round[i - 1].category);
      // 6 domande e 6 categorie: ognuna una volta per round
      expect(new Set(round.map((p) => p.category)).size).toBe(6);
    }
    const perCat = new Map<string, number>();
    for (const p of r.rounds.flat()) perCat.set(p.category, (perCat.get(p.category) ?? 0) + 1);
    expect([...perCat.values()].every((n) => n === 4)).toBe(true);
  });

  it("evita la categoria dell'ultima domanda già nel round", () => {
    const cands = bank(60);
    const r = composeQuestions({ candidates: cands, rounds: [{ count: 1, previousCategory: "Storia" }], mix: "bilanciata", seed: 11 });
    expect(r.rounds[0][0].category).not.toBe("Storia");
  });

  it("difficoltà: segue il mix e la finale è più difficile", () => {
    const cands = bank(500);
    const r = composeQuestions({ candidates: cands, rounds: [{ count: 6 }, { count: 6, harder: true }], mix: "bilanciata", seed: "diff" });
    expect(r.rounds[0].map((p) => p.band)).toEqual(["facile", "media", "difficile", "facile", "media", "difficile"]);
    expect(r.rounds[1].map((p) => p.band)).toEqual(["media", "difficile", "difficile", "media", "difficile", "difficile"]);
    const avg = (a: { difficulty: number }[]) => a.reduce((s, p) => s + p.difficulty, 0) / a.length;
    expect(avg(r.rounds[1])).toBeGreaterThan(avg(r.rounds[0]));
    expect(r.summary.offBand).toBe(0);

    const easy = composeQuestions({ candidates: cands, rounds: [{ count: 9 }], mix: "facile", seed: "e" });
    const hard = composeQuestions({ candidates: cands, rounds: [{ count: 9 }], mix: "difficile", seed: "e" });
    expect(avg(easy.rounds[0])).toBeLessThan(avg(hard.rounds[0]));
  });

  it("freschezza prima della difficoltà: se mancano difficili fresche usa fresche di altra fascia", () => {
    const fresh = bank(10, "fresh", () => ({ difficulty: 2 }));
    const playedHard = bank(10, "played", () => ({ difficulty: 5, lastPlayedAt: "2025-01-01T20:00:00Z" }));
    const r = composeQuestions({ candidates: [...fresh, ...playedHard], rounds: [{ count: 3, harder: true }], mix: "difficile", seed: 4 });
    expect(ids(r).every((id) => id.startsWith("fresh"))).toBe(true);
    expect(r.summary).toMatchObject({ fresh: 3, repeats: 0, offBand: 3 });
  });

  it("conteggi dell'archivio", () => {
    const cands = [...bank(5, "a"), ...bank(2, "b", () => ({ lastPlayedAt: "2025-01-01T00:00:00Z" })), ...bank(1, "c", () => ({ plannedElsewhere: true }))];
    const s = poolStats(cands, ["a-0000"]);
    expect(s).toMatchObject({ usable: 7, fresh: 4, played: 2, planned: 1 });
    expect(s.byBand.facile.usable + s.byBand.media.usable + s.byBand.difficile.usable).toBe(7);
  });
});

describe("serata rapida: struttura", () => {
  it("valori predefiniti: 4 round × 5 domande, ultimo round Finale", () => {
    const o = quickSessionSchema.parse({});
    expect(o).toMatchObject({ rounds: 4, totalQuestions: 20, mix: "bilanciata", finalRound: true, isTest: false, reserves: 1 });
    const plan = planQuickRounds(o);
    expect(plan.map((r) => r.count)).toEqual([5, 5, 5, 5]);
    expect(plan.map((r) => r.kind)).toEqual(["standard", "standard", "standard", "final"]);
    expect(plan[3]).toMatchObject({ harder: true, pointsMultiplier: 2, title: "Gran finale" });
    expect(plan[0].title).toBe("Primo round");
  });

  it("un solo round non diventa finale; validazione dei limiti", () => {
    expect(planQuickRounds({ rounds: 1, totalQuestions: 8, finalRound: true })[0].kind).toBe("standard");
    expect(quickSessionSchema.safeParse({ rounds: 5, totalQuestions: 4 }).success).toBe(false);
    expect(quickSessionSchema.safeParse({ rounds: 1, totalQuestions: 31 }).success).toBe(false);
    expect(quickSessionSchema.safeParse({ rounds: 11 }).success).toBe(false);
    expect(quickSessionSchema.safeParse({ mix: "impossibile" }).success).toBe(false);
  });
});
