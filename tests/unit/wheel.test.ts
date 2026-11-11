import { describe, expect, it } from "vitest";
import {
  buildSpinPlan,
  segmentAngle,
  segmentAtPointer,
  spinElapsedMs,
  spinEndsAtMs,
  tickCount,
  WHEEL_DURATION_MS,
  WHEEL_LANDING,
  WHEEL_MAX_SEGMENTS,
  WHEEL_MIN_SEGMENTS,
  WHEEL_TURNS,
  wheelEase,
  wheelRotationAt,
} from "@/lib/game-engine/wheel";
import { allowedCommands, COMMAND_LABELS, isCommandAllowed, PHASE_LABELS, suggestNextCommand } from "@/lib/game-engine/transitions";
import { eventRoundKind, GameError, isCategoryRound, maxCategories } from "@/lib/game-engine/types";
import { roundInputSchema } from "@/lib/validation/schemas";
import { labelLayout, wrapLabel } from "@/features/game/components/wheel";

const inputs = { turns: 6, landing: 0.5, durationMs: 8000 };

describe("ruota: piano del giro", () => {
  it("è deterministico: stesso input, stesso piano", () => {
    const a = buildSpinPlan(5, 3, { turns: 7, landing: 0.31, durationMs: 8123 });
    const b = buildSpinPlan(5, 3, { turns: 7, landing: 0.31, durationMs: 8123 });
    expect(a).toEqual(b);
    expect(a).toEqual({ segments: 5, winnerIndex: 3, turns: 7, landing: 0.31, rotationDeg: a.rotationDeg, durationMs: 8123 });
  });

  it("si ferma SEMPRE sullo spicchio deciso dal server (ogni n, ogni vincitore, ogni arrivo)", () => {
    const landings = [WHEEL_LANDING.min, 0.27, 0.5, 0.73, WHEEL_LANDING.max];
    let checked = 0;
    for (let n = WHEEL_MIN_SEGMENTS; n <= WHEEL_MAX_SEGMENTS; n++) {
      for (let w = 0; w < n; w++) {
        for (let turns = WHEEL_TURNS.min; turns <= WHEEL_TURNS.max; turns++) {
          for (const landing of landings) {
            const plan = buildSpinPlan(n, w, { turns, landing, durationMs: WHEEL_DURATION_MS.min });
            const end = wheelRotationAt(plan, plan.durationMs);
            expect(end).toBe(plan.rotationDeg);
            expect(segmentAtPointer(end, n)).toBe(w);
            // giri completi rispettati: la rotazione finale è nell'intervallo [turns, turns+1) giri
            expect(plan.rotationDeg).toBeGreaterThanOrEqual(turns * 360);
            expect(plan.rotationDeg).toBeLessThan((turns + 1) * 360);
            // il puntatore cade dentro lo spicchio, lontano dai bordi
            const local = (((-end % 360) + 360) % 360) / segmentAngle(n) - w;
            expect(local).toBeCloseTo(landing, 6);
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(35 * 3 * 5);
  });

  it("anche oltre la fine e prima dell'inizio la rotazione è ferma e coerente", () => {
    const plan = buildSpinPlan(8, 6, inputs);
    expect(wheelRotationAt(plan, -500)).toBe(0);
    expect(wheelRotationAt(plan, 0)).toBe(0);
    expect(wheelRotationAt(plan, plan.durationMs + 60_000)).toBe(plan.rotationDeg);
    expect(segmentAtPointer(wheelRotationAt(plan, 0), 8)).toBe(0);
  });

  it("rifiuta input non validi", () => {
    const bad: [number, number, typeof inputs][] = [
      [1, 0, inputs],
      [9, 0, inputs],
      [4, 4, inputs],
      [4, -1, inputs],
      [4, 1, { ...inputs, turns: 2 }],
      [4, 1, { ...inputs, turns: 6.5 }],
      [4, 1, { ...inputs, landing: 0.01 }],
      [4, 1, { ...inputs, landing: 0.99 }],
      [4, 1, { ...inputs, durationMs: 1000 }],
    ];
    for (const [n, w, i] of bad) expect(() => buildSpinPlan(n, w, i)).toThrow(GameError);
  });
});

describe("ruota: animazione", () => {
  it("l'andamento parte da 0, arriva a 1 ed è monotono (accelera e poi frena)", () => {
    expect(wheelEase(0)).toBe(0);
    expect(wheelEase(1)).toBe(1);
    expect(wheelEase(-1)).toBe(0);
    expect(wheelEase(2)).toBe(1);
    let prev = 0;
    for (let i = 1; i <= 1000; i++) {
      const v = wheelEase(i / 1000);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("velocità continua: niente scatti all'inizio della frenata, ferma alla fine", () => {
    const h = 1e-4;
    const speed = (u: number) => (wheelEase(u + h) - wheelEase(u - h)) / (2 * h);
    // accelerazione: velocità crescente; poi decrescente
    expect(speed(0.05)).toBeLessThan(speed(0.11));
    expect(speed(0.5)).toBeLessThan(speed(0.2));
    // continuità al cambio di fase (u = 0.12)
    expect(Math.abs(speed(0.1199) - speed(0.1201))).toBeLessThan(0.01);
    // arrivo morbido: velocità quasi nulla nell'ultimo 2%
    expect(speed(0.99)).toBeLessThan(0.001);
    // la frenata è lunga: a metà tempo la ruota ha già fatto gran parte del giro, ma non tutto
    expect(wheelEase(0.5)).toBeGreaterThan(0.75);
    expect(wheelEase(0.5)).toBeLessThan(0.99);
  });

  it("il 'tic' conta gli spicchi passati sotto il puntatore", () => {
    const plan = buildSpinPlan(6, 2, inputs);
    expect(tickCount(0, 6)).toBe(0);
    expect(tickCount(59.9, 6)).toBe(0);
    expect(tickCount(60, 6)).toBe(1);
    expect(tickCount(plan.rotationDeg, 6)).toBe(Math.floor(plan.rotationDeg / 60));
    // a ogni tic cambia lo spicchio sotto il puntatore
    for (let k = 1; k < 30; k++) {
      expect(segmentAtPointer(k * 60 - 0.01, 6)).not.toBe(segmentAtPointer(k * 60 + 0.01, 6));
    }
  });

  it("tempo del giro dall'ora del server, fermo durante la pausa", () => {
    const spin = { startedAt: "2026-11-11T21:00:00.000Z", durationMs: 8000, frozenElapsedMs: null };
    const t0 = Date.parse(spin.startedAt);
    expect(spinElapsedMs(spin, t0 - 1200)).toBe(-1200);
    expect(spinElapsedMs(spin, t0 + 2500)).toBe(2500);
    expect(spinElapsedMs({ ...spin, frozenElapsedMs: 3100 }, t0 + 99_000)).toBe(3100);
    expect(spinEndsAtMs(spin)).toBe(t0 + 8000);
  });
});

describe("ruota: macchina a stati", () => {
  it("GIRA LA RUOTA solo nella presentazione del round", () => {
    expect(isCommandAllowed("ROUND_INTRO", "SPIN_WHEEL", false)).toBe(true);
    for (const p of ["LOBBY", "CATEGORY_VOTING", "CATEGORY_RESULT", "WHEEL_SPIN", "QUESTION_VISIBLE", "LEADERBOARD", "PAUSED"] as const) {
      expect(isCommandAllowed(p, "SPIN_WHEEL", false)).toBe(false);
    }
  });

  it("dalla ruota si va alla domanda (o evento/classifica), si mette in pausa o si termina", () => {
    const cmds = allowedCommands("WHEEL_SPIN", false);
    expect(cmds).toEqual(expect.arrayContaining(["SHOW_QUESTION", "ACTIVATE_EVENT", "SHOW_LEADERBOARD", "PAUSE", "FINISH"]));
    expect(cmds).not.toContain("SPIN_WHEEL");
    expect(cmds).not.toContain("START_ROUND");
    expect(cmds).not.toContain("CLOSE_VOTE");
    expect(isCommandAllowed("WHEEL_SPIN", "SHOW_OPTIONS", false)).toBe(false);
  });

  it("prossima azione suggerita", () => {
    const ctx = { roundKind: "category_wheel", voteDone: false, hasNextQuestion: false, hasNextRound: true, timerExpired: false };
    expect(suggestNextCommand({ ...ctx, phase: "ROUND_INTRO" })).toBe("SPIN_WHEEL");
    expect(suggestNextCommand({ ...ctx, phase: "ROUND_INTRO", voteDone: true, hasNextQuestion: true })).toBe("SHOW_QUESTION");
    expect(suggestNextCommand({ ...ctx, phase: "WHEEL_SPIN", voteDone: true, hasNextQuestion: true })).toBe("SHOW_QUESTION");
  });

  it("etichette italiane per comando e fase", () => {
    expect(COMMAND_LABELS.SPIN_WHEEL).toBe("GIRA LA RUOTA");
    expect(PHASE_LABELS.WHEEL_SPIN).toBe("Ruota impazzita");
  });
});

describe("ruota: configurazione del round", () => {
  it("da 2 a 8 categorie per la ruota, al massimo 4 per il voto", () => {
    expect(isCategoryRound("category_wheel")).toBe(true);
    expect(isCategoryRound("category_vote")).toBe(true);
    expect(isCategoryRound("standard")).toBe(false);
    expect(maxCategories("category_wheel")).toBe(8);
    expect(maxCategories("category_vote")).toBe(4);
    const eight = ["Cinema", "Sport", "Musica", "Storia", "Cucina", "Scienza", "Arte", "Tv"];
    expect(roundInputSchema.safeParse({ title: "Ruota", kind: "category_wheel", voteOptions: eight }).success).toBe(true);
    expect(roundInputSchema.safeParse({ title: "Ruota", kind: "category_wheel", voteOptions: [...eight, "Altro"] }).success).toBe(false);
    expect(roundInputSchema.safeParse({ title: "Voto", kind: "category_vote", voteOptions: eight.slice(0, 5) }).success).toBe(false);
    expect(roundInputSchema.safeParse({ title: "Voto", kind: "category_vote", voteOptions: eight.slice(0, 4) }).success).toBe(true);
    expect(roundInputSchema.safeParse({ title: "Ruota", kind: "category_wheel", voteOptions: ["Cinema", "cinema"] }).success).toBe(false);
  });

  it("gli eventi speciali seguono le regole del voto di categoria", () => {
    expect(eventRoundKind("category_wheel")).toBe("category_vote");
    expect(eventRoundKind("music")).toBe("music");
  });

  it("le etichette degli spicchi vanno a capo e si rimpiccioliscono, mai fuori dallo spicchio", () => {
    expect(wrapLabel("Cinema", 3)).toEqual(["Cinema"]);
    expect(wrapLabel("Musica anni ottanta e novanta", 2)).toHaveLength(2);
    const short = labelLayout("Tv", 8);
    const long = labelLayout("Grandi classici della musica italiana", 8);
    expect(long.lines.length).toBeGreaterThan(1);
    expect(long.fontSize).toBeLessThan(short.fontSize);
    expect(long.fontSize).toBeGreaterThan(3);
  });
});
