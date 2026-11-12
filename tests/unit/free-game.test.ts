import { describe, expect, it } from "vitest";
import { splitQuestions, type ComposeCandidate } from "@/lib/game-engine/compose";
import {
  FREE_SINGLE_ROUND_VOTED,
  freeGameHighlights,
  freeVoteRoundIndex,
  pickMusicQuestion,
  pickVoteCategories,
  planFreeGame,
  type FreeRoundShape,
  type MusicCandidate,
} from "@/lib/game-engine/free-game";
import { palminoWheelEligible, planPalminoWheels, type WheelPlanRound } from "@/lib/game-engine/palmino-wheel";
import { maxRoundsFor, PUBLIC_TOTAL_OPTIONS } from "@/lib/game-engine/public-game";

/** Round della partita libera come li fa la serata rapida (ultimo = finale con più round). */
function shapes(total: number, rounds: number): FreeRoundShape[] {
  return splitQuestions(total, rounds).map((count, i) => ({ kind: rounds > 1 && i === rounds - 1 ? "final" : "standard", count }));
}

/** Tutte le combinazioni ammesse dal wizard (10/15/20/30 domande, 1..5 round). */
const COMBOS: [number, number][] = PUBLIC_TOTAL_OPTIONS.flatMap((t) => Array.from({ length: maxRoundsFor(t) }, (_, i) => [t, i + 1] as [number, number]));

/**
 * Piano della ruota come lo costruisce la pubblicazione: round votato con le domande della materia
 * (non note prima) seguite dalle comuni; la canzone segnata come media.
 */
function wheelRounds(total: number, rounds: number, seed: string): WheelPlanRound[] {
  const sh = shapes(total, rounds);
  const plan = planFreeGame(sh, seed);
  return sh.map((s, i) => {
    const kind = i === plan.voteRound ? "category_vote" : s.kind;
    if (i === plan.voteRound) {
      const common = Array.from({ length: plan.common }, (_, j) => ({ sqId: `r${i}c${j}`, common: true, media: plan.music.round === i && plan.music.index === j }));
      return { id: `r${i}`, kind, questions: [...Array.from({ length: plan.voted }, () => ({ sqId: "" })), ...common], playedCount: plan.voted + plan.common };
    }
    return { id: `r${i}`, kind, questions: Array.from({ length: s.count }, (_, j) => ({ sqId: `r${i}q${j}`, media: plan.music.round === i && plan.music.index === j })) };
  });
}

describe("partita libera: dove stanno votazione e canzone", () => {
  it("votazione: round intermedio con 3+ round, il primo con 2, il round stesso con 1", () => {
    expect([1, 2, 3, 4, 5].map(freeVoteRoundIndex)).toEqual([0, 0, 1, 1, 2]);
    for (const [t, r] of COMBOS) {
      const p = planFreeGame(shapes(t, r), `s-${t}-${r}`);
      if (r >= 2) expect(p.voteRound).toBeLessThan(r - 1); // mai la finale
      if (r >= 3) expect(p.voteRound).toBeGreaterThan(0); // mai il primo
      if (r === 1) {
        expect(p.voted).toBe(Math.min(FREE_SINGLE_ROUND_VOTED, Math.floor(t / 2)));
        expect(p.voted + p.common).toBe(t);
        expect(p.common).toBeGreaterThanOrEqual(5);
      } else {
        expect(p.common).toBe(0);
        expect(p.voted).toBe(shapes(t, r)[p.voteRound].count);
      }
    }
  });

  it("canzone: mai nel round votato (salvo le comuni del round unico), mai prima del round, mai ultima", () => {
    for (const [t, r] of COMBOS) {
      for (let k = 0; k < 60; k++) {
        const sh = shapes(t, r);
        const p = planFreeGame(sh, `m${k}`);
        if (r === 1) {
          expect(p.music.round).toBe(0);
          expect(p.music.index).toBeGreaterThanOrEqual(0);
          expect(p.music.index).toBeLessThan(p.common - 1); // mai l'ultima della partita
          continue;
        }
        expect(p.music.round).not.toBe(p.voteRound);
        expect(p.music.index).toBeGreaterThanOrEqual(1);
        const last = p.music.round === r - 1;
        expect(p.music.index).toBeLessThan(sh[p.music.round].count - (last ? 1 : 0));
        // con un round normale disponibile non va in finale
        if (sh.some((s, i) => i !== p.voteRound && s.kind === "standard")) expect(sh[p.music.round].kind).toBe("standard");
      }
    }
  });

  it("deterministico con lo stesso seme", () => {
    expect(planFreeGame(shapes(15, 5), "abc")).toEqual(planFreeGame(shapes(15, 5), "abc"));
  });

  it("la Ruota di Palmino ha sempre almeno un posto e non cade su votazione o canzone", () => {
    for (const [t, r] of COMBOS) {
      for (let k = 0; k < 80; k++) {
        const seed = `w${t}-${r}-${k}`;
        const rs = wheelRounds(t, r, seed);
        expect(palminoWheelEligible(rs).length).toBeGreaterThan(0);
        const plan = planPalminoWheels(rs, seed, { atLeastOne: true });
        expect(plan.length).toBeGreaterThanOrEqual(1);
        for (const s of plan) {
          const round = rs.find((x) => x.id === s.roundId)!;
          const q = round.questions.find((x) => x.sqId === s.sqId)!;
          expect(q.media).toBeFalsy();
          if (round.kind === "category_vote") expect(q.common).toBe(true);
          expect(s.number).toBeGreaterThanOrEqual(5);
          expect(s.number).toBeLessThan(t);
        }
        // stesso seme: stesso piano
        expect(planPalminoWheels(rs, seed, { atLeastOne: true })).toEqual(plan);
      }
    }
  });

  it("senza `atLeastOne` (serate della regia) il piano resta quello di prima", () => {
    const rs = wheelRounds(15, 3, "x");
    let none = 0;
    for (let k = 0; k < 400; k++) {
      const base = planPalminoWheels(rs, `r${k}`);
      const sure = planPalminoWheels(rs, `r${k}`, { atLeastOne: true });
      if (base.length > 0) expect(sure).toEqual(base);
      else {
        none++;
        expect(sure).toHaveLength(1);
      }
    }
    expect(none).toBeGreaterThan(0);
  });

  it("partite troppo corte: nessun posto ammesso, nessuna ruota (anche con atLeastOne)", () => {
    const tiny: WheelPlanRound[] = [{ id: "a", kind: "standard", questions: Array.from({ length: 5 }, (_, j) => ({ sqId: `q${j}` })) }];
    expect(planPalminoWheels(tiny, "x", { atLeastOne: true })).toEqual([]);
    const six: WheelPlanRound[] = [{ id: "a", kind: "standard", questions: Array.from({ length: 6 }, (_, j) => ({ sqId: `q${j}` })) }];
    expect(planPalminoWheels(six, "x", { atLeastOne: true }).map((s) => s.number)).toEqual([5]);
  });

  it("riga del wizard", () => {
    expect(freeGameHighlights(1, 10)).toContain("prime 5 domande");
    expect(freeGameHighlights(3, 15)).toContain("2° round");
    expect(freeGameHighlights(5, 30)).toContain("3° round");
    expect(freeGameHighlights(2, 10)).toMatch(/Ruota di Palmino.*canzone/);
  });
});

describe("partita libera: materie della votazione", () => {
  const cands: ComposeCandidate[] = [];
  const cats = ["Cinema", "Musica", "Sport", "Storia", "Geografia"];
  cats.forEach((c, ci) => {
    for (let k = 0; k < 6; k++) {
      // Storia: tutte già viste da questo host; Sport: solo 2 domande
      if (c === "Sport" && k >= 2) continue;
      cands.push({ id: `${c}-${k}`, category: c, difficulty: (k % 5) + 1, lastPlayedAt: null, plannedElsewhere: false, seenByHost: c === "Storia" || (ci === 4 && k < 3) });
    }
  });

  it("3 materie con abbastanza domande, prima le fresche; domande della materia giusta", () => {
    const v = pickVoteCategories({ candidates: cands, count: 4, mix: "bilanciata", seed: "s" });
    expect(v).toHaveLength(3);
    const labels = v.map((x) => x.label);
    expect(labels).not.toContain("Sport"); // solo 2 domande
    expect(labels).not.toContain("Storia"); // tutte già viste (ci sono materie più fresche)
    for (const o of v) {
      expect(o.picks).toHaveLength(4);
      expect(new Set(o.picks.map((p) => p.category))).toEqual(new Set([o.label]));
    }
    expect(pickVoteCategories({ candidates: cands, count: 4, mix: "bilanciata", seed: "s" })).toEqual(v);
  });

  it("meno di 2 materie possibili: niente votazione", () => {
    expect(pickVoteCategories({ candidates: cands.filter((c) => c.category === "Cinema"), count: 3, mix: "bilanciata", seed: "s" })).toEqual([]);
    expect(pickVoteCategories({ candidates: cands, count: 7, mix: "bilanciata", seed: "s" })).toEqual([]);
  });

  it("esclude le domande già usate nella partita", () => {
    const used = cands.filter((c) => c.category === "Cinema").map((c) => c.id);
    const v = pickVoteCategories({ candidates: cands, count: 3, mix: "bilanciata", seed: "q", excludeIds: used });
    expect(v.map((x) => x.label)).not.toContain("Cinema");
  });
});

describe("partita libera: la canzone", () => {
  const m = (id: string, hostSeenAt: string | null, lastPlayedAt: string | null = null): MusicCandidate => ({ id, category: "Musica", difficulty: 2, hostSeenAt, lastPlayedAt });

  it("prima quelle mai sentite da questo host (la giocata meno di recente)", () => {
    const list = [m("a", "2026-11-01T00:00:00Z"), m("b", null, "2026-11-05T00:00:00Z"), m("c", null, "2026-10-01T00:00:00Z")];
    expect(pickMusicQuestion(list, "x")?.id).toBe("c");
  });

  it("se le ha sentite tutte: la meno recente, piuttosto che niente", () => {
    const list = [m("a", "2026-11-03T00:00:00Z"), m("b", "2026-10-02T00:00:00Z"), m("c", "2026-11-01T00:00:00Z")];
    expect(pickMusicQuestion(list, "x")?.id).toBe("b");
  });

  it("archivio senza canzoni: null", () => {
    expect(pickMusicQuestion([], "x")).toBeNull();
    expect(pickMusicQuestion([m("a", null)], "x", ["a"])).toBeNull();
  });

  it("fra canzoni mai sentite e mai giocate sceglie con il seme (deterministico)", () => {
    const list = ["a", "b", "c", "d", "e"].map((id) => m(id, null));
    expect(pickMusicQuestion(list, "seme")).toEqual(pickMusicQuestion(list, "seme"));
    const picks = new Set(Array.from({ length: 40 }, (_, i) => pickMusicQuestion(list, `s${i}`)?.id));
    expect(picks.size).toBeGreaterThan(2);
  });
});
