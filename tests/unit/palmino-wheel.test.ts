import { describe, expect, it } from "vitest";
import {
  maxWheelsPerGame,
  pickWheelSegments,
  planPalminoWheels,
  PALMINO_WHEEL_MIN_NUMBER,
  type WheelPlanRound,
} from "@/lib/game-engine/palmino-wheel";
import type { ComposeCandidate } from "@/lib/game-engine/compose";
import type { RoundKind } from "@/lib/game-engine/types";
import { palminoWheelResultLine, speechFor, wheelStopLine } from "@/features/game/script";
import { wheelStageAt } from "@/lib/game-engine/wheel";
import type { PublicState, PublicWheel } from "@/lib/game-engine/types";

/** Serata finta: round con `sizes[i]` domande (id "r<i>q<j>"). */
function rounds(sizes: number[], kinds: RoundKind[] = []): WheelPlanRound[] {
  return sizes.map((n, i) => ({
    id: `r${i}`,
    kind: kinds[i] ?? "standard",
    questions: Array.from({ length: n }, (_, j) => ({ sqId: `r${i}q${j}` })),
  }));
}

/** Tutti i posti ammessi (probabilità 1, senza il tetto per serata). */
function numberOf(rs: WheelPlanRound[], sqId: string): number {
  let n = 0;
  for (const r of rs)
    for (const q of r.questions) {
      n++;
      if (q.sqId === sqId) return n;
    }
  return -1;
}

describe("Ruota di Palmino: piano della serata", () => {
  it("mai prima della 5ª domanda, mai sulla prima di un round né sull'ultima della serata", () => {
    const rs = rounds([6, 6, 6]);
    for (let seed = 0; seed < 300; seed++) {
      for (const s of planPalminoWheels(rs, `s${seed}`, { probability: 1 })) {
        expect(s.number).toBeGreaterThanOrEqual(PALMINO_WHEEL_MIN_NUMBER);
        expect(s.number).toBeLessThan(18);
        expect(s.sqId.endsWith("q0")).toBe(false);
        expect(numberOf(rs, s.sqId)).toBe(s.number);
      }
    }
    // serata corta: la 5ª è l'ultima → nessuna ruota
    expect(planPalminoWheels(rounds([5]), "x", { probability: 1 })).toEqual([]);
    // la 4ª domanda non è mai ammessa, la 5ª sì
    expect(planPalminoWheels(rounds([10]), "x", { force: [4] })).toEqual([]);
    expect(planPalminoWheels(rounds([10]), "x", { force: [5] }).map((s) => s.number)).toEqual([5]);
  });

  it("al massimo una per round e 2 per serata (3 dalle 20 domande), mai due di fila", () => {
    for (let seed = 0; seed < 300; seed++) {
      const short = planPalminoWheels(rounds([4, 4, 4, 4]), `a${seed}`, { probability: 1 });
      expect(short.length).toBeLessThanOrEqual(2);
      const long = planPalminoWheels(rounds([5, 5, 5, 5, 5]), `b${seed}`, { probability: 0.6 });
      expect(long.length).toBeLessThanOrEqual(3);
      for (const plan of [short, long]) {
        expect(new Set(plan.map((s) => s.roundId)).size).toBe(plan.length);
        for (let i = 1; i < plan.length; i++) expect(plan[i].number - plan[i - 1].number).toBeGreaterThan(1);
      }
    }
    expect(maxWheelsPerGame(19)).toBe(2);
    expect(maxWheelsPerGame(20)).toBe(3);
    // forzando due domande vicine dello stesso round passa solo la prima
    expect(planPalminoWheels(rounds([12]), "x", { force: [6, 7] }).map((s) => s.number)).toEqual([6]);
  });

  it("deterministico: stesso seme, stesso piano; semi diversi, piani diversi", () => {
    const rs = rounds([5, 5, 5]);
    expect(planPalminoWheels(rs, "sessione-1")).toEqual(planPalminoWheels(rs, "sessione-1"));
    const plans = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(planPalminoWheels(rs, `sessione-${i}`))));
    expect(plans.size).toBeGreaterThan(3);
  });

  it("circa una domanda ammessa su quattro (e 'ogni tanto' anche nessuna)", () => {
    // 15 domande in 3 round: 8 posti ammessi, 1 per round → in media ~1,8 ruote, a volte nessuna
    const rs = rounds([5, 5, 5]);
    let total = 0;
    let none = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const p = planPalminoWheels(rs, `m${i}`);
      total += p.length;
      if (p.length === 0) none++;
    }
    expect(total / N).toBeGreaterThan(1.1);
    expect(total / N).toBeLessThan(2);
    expect(none).toBeGreaterThan(0);
  });

  it("solo nei round normali (niente categorie già scelte né manche con media)", () => {
    const rs = rounds([6, 6, 6, 6], ["music", "category_vote", "image", "video"]);
    expect(planPalminoWheels(rs, "x", { probability: 1 })).toEqual([]);
    // round con categorie: la numerazione conta la categoria più corta (stima prudente)
    const mixed: WheelPlanRound[] = [{ id: "v", kind: "category_wheel", questions: [], playedCount: 3 }, ...rounds([4])];
    expect(planPalminoWheels(mixed, "x", { force: [5] }).map((s) => s.sqId)).toEqual(["r0q1"]);
  });
});

describe("Ruota di Palmino: spicchi e candidate", () => {
  const cands: ComposeCandidate[] = [];
  const cats = ["Cinema", "Musica", "Sport", "Storia", "Geografia", "Scienza", "Arte", "Cucina", "Natura", "Fumetti"];
  cats.forEach((c) => {
    for (let k = 0; k < 4; k++) {
      cands.push({ id: `${c}-${k}`, category: c, difficulty: (k % 5) + 1, lastPlayedAt: null, plannedElsewhere: false, seenByHost: false });
    }
  });

  it("da 6 a 8 categorie diverse, una candidata ciascuna, deterministico", () => {
    for (let i = 0; i < 50; i++) {
      const segs = pickWheelSegments({ candidates: cands, band: "media", seed: `q${i}` });
      expect(segs.length).toBeGreaterThanOrEqual(6);
      expect(segs.length).toBeLessThanOrEqual(8);
      expect(new Set(segs.map((s) => s.label)).size).toBe(segs.length);
      for (const s of segs) expect(s.questionId.startsWith(s.label)).toBe(true);
      expect(pickWheelSegments({ candidates: cands, band: "media", seed: `q${i}` })).toEqual(segs);
    }
  });

  it("prima le domande mai viste dall'host: una categoria tutta vista finisce fuori dalla ruota", () => {
    const seen = cands.map((c) => (c.category === "Sport" || c.id === "Cinema-0" || c.id === "Cinema-1" || c.id === "Cinema-2" ? { ...c, seenByHost: true } : c));
    for (let i = 0; i < 50; i++) {
      const segs = pickWheelSegments({ candidates: seen, band: "facile", seed: `h${i}` });
      expect(segs.map((s) => s.label)).not.toContain("Sport");
      const cinema = segs.find((s) => s.label === "Cinema");
      if (cinema) expect(cinema.questionId).toBe("Cinema-3");
      expect(segs.every((s) => s.freshness === "nuova")).toBe(true);
    }
  });

  it("rispetta la fascia di difficoltà del segnaposto quando può, esclude le domande già usate", () => {
    const segs = pickWheelSegments({ candidates: cands, band: "difficile", seed: "d", excludeIds: ["Arte-3"] });
    // k=3 → difficoltà 4 (difficile) in ogni categoria; Arte-3 è esclusa
    for (const s of segs) {
      if (s.label === "Arte") expect(s.difficulty).not.toBe(4);
      else expect(s.difficulty).toBe(4);
    }
  });

  it("archivio con meno di 3 categorie: nessuna ruota", () => {
    expect(pickWheelSegments({ candidates: cands.filter((c) => c.category === "Cinema" || c.category === "Arte"), band: "media", seed: "x" })).toEqual([]);
    expect(pickWheelSegments({ candidates: cands.filter((c) => ["Cinema", "Arte", "Sport"].includes(c.category)), band: "media", seed: "x" })).toHaveLength(3);
  });
});

describe("Ruota di Palmino: copione e tempi del colpo", () => {
  const wheel: PublicWheel = {
    roundId: "r",
    kind: "palmino",
    questionNumber: 7,
    segments: ["Cinema", "Sport", "Storia"].map((label, i) => ({ id: `palmino-${i}`, position: i, label })),
    spin: { startedAt: new Date(10_000).toISOString(), durationMs: 8000, turns: 5, landing: 0.5, rotationDeg: 2000, winnerIndex: 1, winnerOptionId: "palmino-1", frozenElapsedMs: null },
  };

  it("all'arrivo Palmino dice la categoria ('Tocca a… SPORT!'), una frase fissa per categoria", () => {
    expect(wheelStopLine({ wheel })).toEqual(palminoWheelResultLine("Sport"));
    expect(palminoWheelResultLine("Sport").text).toBe("[shouts] Tocca a… Sport!");
    // la Ruota impazzita resta com'era
    expect(wheelStopLine({ wheel: { ...wheel, kind: undefined } })?.text).toContain("La ruota si è fermata su: Sport");
  });

  it("entrando nella ruota Palmino dice una battuta fissa (stessa su ogni schermo)", () => {
    const s = { phase: "WHEEL_SPIN", sessionId: "s1", questionsPlayed: 6, wheel, round: null, question: null, phaseStartedAt: "x" } as unknown as PublicState;
    const a = speechFor(s, { phase: "SCORE_REVEAL" }, { readOptions: true });
    expect(a).toHaveLength(1);
    expect(a[0].who).toBe("palmino");
    expect(speechFor(s, { phase: "SCORE_REVEAL" }, { readOptions: true })).toEqual(a);
  });

  it("fasi del giro: carica, colpo (prima della partenza), giro, arrivo", () => {
    const sp = wheel.spin!;
    expect(wheelStageAt(sp, -2000, 450)).toBe("ready");
    expect(wheelStageAt(sp, -300, 450)).toBe("swing");
    expect(wheelStageAt(sp, 100, 450)).toBe("spinning");
    expect(wheelStageAt(sp, 8000, 450)).toBe("stopped");
    // Ruota impazzita: nessun colpo
    expect(wheelStageAt(sp, -300)).toBe("ready");
  });
});
