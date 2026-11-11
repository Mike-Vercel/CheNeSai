import { describe, expect, it } from "vitest";
import {
  computeLiveTiming,
  delayLabel,
  ESTIMATE,
  estimateQuestionSeconds,
  estimateRound,
  formatClock,
  formatMinutes,
  planFromRounds,
  planSegments,
  resolvePlan,
  type EstimateQuestion,
  type EstimateRound,
  type LiveTimingInput,
  type ResolvedPlan,
} from "@/lib/show/running-order";
import { runningOrderSchema, sessionSettingsSchema } from "@/lib/validation/schemas";

const MIN = 60_000;

function q(over: Partial<EstimateQuestion> = {}): EstimateQuestion {
  return {
    isReserve: false,
    voteOptionId: null,
    text: "x".repeat(65), // 5 s di lettura
    options: [{ text: "a".repeat(13) }, { text: "b".repeat(13) }, { text: "c".repeat(13) }, { text: "d".repeat(13) }], // 4 s
    durationSeconds: null,
    mediaKind: null,
    ...over,
  };
}

function round(over: Partial<EstimateRound> = {}): EstimateRound {
  return { kind: "standard", durationSeconds: null, voteDurationSeconds: 15, voteOptions: [], questions: [], ...over };
}

describe("stima dei tempi", () => {
  it("domanda = lettura + tempo per rispondere + soluzione", () => {
    // lettura: 117 caratteri / 13 = 9 s + 4 × 0,35 + 3 di pausa = 13,4 s
    const reading = 117 / ESTIMATE.charsPerSecond + 4 * ESTIMATE.perOptionSeconds + ESTIMATE.readingPauseSeconds;
    expect(estimateQuestionSeconds(q(), null, 15)).toBeCloseTo(reading + 15 + ESTIMATE.revealSeconds, 5);
    // la durata della domanda vince su quella del round, che vince sul predefinito
    expect(estimateQuestionSeconds(q({ durationSeconds: 30 }), 20, 15)).toBeCloseTo(reading + 30 + ESTIMATE.revealSeconds, 5);
    expect(estimateQuestionSeconds(q(), 20, 15)).toBeCloseTo(reading + 20 + ESTIMATE.revealSeconds, 5);
    // audio/video: tempo di ascolto in più
    expect(estimateQuestionSeconds(q({ mediaKind: "audio" }), null, 15) - estimateQuestionSeconds(q(), null, 15)).toBe(ESTIMATE.mediaExtraSeconds);
  });

  it("round standard: somma delle domande (senza riserve) + intro e classifica", () => {
    const one = estimateQuestionSeconds(q(), null, 15);
    const r = estimateRound(round({ questions: [q(), q(), q(), q({ isReserve: true })] }), 15);
    expect(r.questions).toBe(3);
    expect(r.seconds).toBe(Math.round(3 * one + ESTIMATE.roundIntroSeconds + ESTIMATE.leaderboardSeconds));
  });

  it("10 domande da 15 s stanno in circa 10 minuti", () => {
    const r = estimateRound(round({ questions: Array.from({ length: 10 }, () => q()) }), 15);
    expect(r.seconds / 60).toBeGreaterThan(8);
    expect(r.seconds / 60).toBeLessThan(10);
  });

  it("voto di categoria: votazione + media delle domande per categoria", () => {
    const one = estimateQuestionSeconds(q(), null, 15);
    const r = estimateRound(
      round({
        kind: "category_vote",
        voteDurationSeconds: 20,
        voteOptions: [{ id: "a" }, { id: "b" }],
        questions: [q({ voteOptionId: "a" }), q({ voteOptionId: "a" }), q({ voteOptionId: "a" }), q({ voteOptionId: "b" })],
      }),
      15,
    );
    expect(r.questions).toBe(2);
    expect(r.seconds).toBe(Math.round(2 * one + 20 + ESTIMATE.voteResultSeconds + ESTIMATE.roundIntroSeconds + ESTIMATE.leaderboardSeconds));
  });

  it("round vuoto: solo intro e classifica", () => {
    expect(estimateRound(round()).seconds).toBe(ESTIMATE.roundIntroSeconds + ESTIMATE.leaderboardSeconds);
  });
});

describe("piano della serata", () => {
  const rounds = [
    { id: "r1", title: "Classico", estimateSeconds: 19 * 60 + 10, questions: 12 },
    { id: "r2", title: "Musica", estimateSeconds: 15 * 60, questions: 10 },
    { id: "r3", title: "Finale", estimateSeconds: 10 * 60, questions: 6 },
  ];

  it("senza scelte usa le stime (per eccesso) e i valori predefiniti", () => {
    const p = resolvePlan(undefined, rounds);
    expect(p.rounds.map((r) => r.minutes)).toEqual([20, 15, 10]);
    expect(p.rounds.every((r) => !r.manual)).toBe(true);
    expect(p.targetMinutes).toBe(120);
    expect(p.totalMinutes).toBe(ESTIMATE.introMinutes + 45 + ESTIMATE.outroMinutes);
    expect(p.overMinutes).toBe(p.totalMinutes - 120);
  });

  it("minuti scelti, intervalli e durata prevista; mai intervallo dopo l'ultimo round", () => {
    const p = resolvePlan(
      {
        targetMinutes: 90,
        introMinutes: 10,
        outroMinutes: 0,
        rounds: { r1: { minutes: 30, breakAfterMinutes: 15 }, r3: { breakAfterMinutes: 20 } },
      },
      rounds,
    );
    expect(p.rounds[0]).toMatchObject({ minutes: 30, manual: true, estimateMinutes: 20, breakAfterMinutes: 15 });
    expect(p.rounds[2].breakAfterMinutes).toBe(0);
    expect(p.breaksMinutes).toBe(15);
    expect(p.totalMinutes).toBe(10 + 30 + 15 + 15 + 10 + 0);
    expect(p.overMinutes).toBe(80 - 90);
    // id di round che non esistono più vengono ignorati
    expect(resolvePlan({ rounds: { vecchio: { minutes: 99 } } }, rounds).totalMinutes).toBe(resolvePlan(undefined, rounds).totalMinutes);
  });

  it("segmenti con orario di inizio, intervalli a zero omessi", () => {
    const p = resolvePlan({ introMinutes: 5, outroMinutes: 5, rounds: { r1: { breakAfterMinutes: 10 } } }, rounds);
    const segs = planSegments(p);
    expect(segs.map((s) => s.kind)).toEqual(["intro", "round", "break", "round", "round", "outro"]);
    expect(segs.map((s) => s.startMinute)).toEqual([0, 5, 25, 35, 50, 60]);
    expect(segs[segs.length - 1].startMinute + segs[segs.length - 1].minutes).toBe(p.totalMinutes);
  });

  it("planFromRounds stima direttamente dai round dell'editor", () => {
    const p = planFromRounds(undefined, [{ id: "a", title: "A", ...round({ questions: Array.from({ length: 10 }, () => q()) }) }], 15);
    expect(p.rounds[0].questions).toBe(10);
    expect(p.rounds[0].minutes).toBe(Math.ceil(estimateRound(round({ questions: Array.from({ length: 10 }, () => q()) }), 15).seconds / 60));
  });

  it("schema: scaletta valida accettata, valori fuori scala rifiutati", () => {
    const id = "6f1c2f4e-8a2b-4c3d-9e4f-0a1b2c3d4e5f";
    expect(runningOrderSchema.safeParse({ targetMinutes: 120, rounds: { [id]: { minutes: 20, breakAfterMinutes: 10 } } }).success).toBe(true);
    expect(runningOrderSchema.safeParse({ rounds: { "non-un-id": { minutes: 20 } } }).success).toBe(false);
    expect(runningOrderSchema.safeParse({ targetMinutes: 5 }).success).toBe(false);
    expect(runningOrderSchema.safeParse({ rounds: { [id]: { minutes: 0 } } }).success).toBe(false);
    expect(sessionSettingsSchema.safeParse({ runningOrder: null }).success).toBe(true);
  });
});

describe("tempi live contro scaletta", () => {
  // apertura 5 · R1 20 + intervallo 10 · R2 20 · finale 5 = 60 min
  const plan: ResolvedPlan = resolvePlan({ introMinutes: 5, outroMinutes: 5, targetMinutes: 60, rounds: { r1: { minutes: 20, breakAfterMinutes: 10 }, r2: { minutes: 20 } } }, [
    { id: "r1", title: "Uno", estimateSeconds: 600, questions: 10 },
    { id: "r2", title: "Due", estimateSeconds: 600, questions: 10 },
  ]);
  const S = Date.UTC(2026, 10, 13, 19, 30);
  const at = (min: number) => S + min * MIN;
  const input = (rounds: LiveTimingInput["rounds"], finishedAt: number | null = null): LiveTimingInput => ({ startedAt: S, finishedAt, scheduledAt: S, rounds });

  it("piano coerente per i test", () => {
    expect(plan.totalMinutes).toBe(60);
  });

  it("non iniziata: fine prevista dall'orario in programma", () => {
    const t = computeLiveTiming(plan, { startedAt: null, finishedAt: null, scheduledAt: S, rounds: [] }, S - 10 * MIN);
    expect(t.phase).toBe("not_started");
    expect(t.plannedEndAt).toBe(at(60));
    expect(t.projectedEndAt).toBe(at(60));
    expect(t.rounds.every((r) => r.status === "pending")).toBe(true);
    // se si parte in ritardo, la fine prevista slitta
    expect(computeLiveTiming(plan, { startedAt: null, finishedAt: null, scheduledAt: S, rounds: [] }, at(7)).projectedEndAt).toBe(at(67));
  });

  it("durante l'intro in orario", () => {
    const t = computeLiveTiming(plan, input([{ id: "r1", startedAt: null, playEndedAt: null }, { id: "r2", startedAt: null, playEndedAt: null }]), at(3));
    expect(t.phase).toBe("intro");
    expect(t.delayMs).toBe(0);
    expect(t.projectedEndAt).toBe(at(60));
  });

  it("intro lunga: il ritardo si porta nel round e nella fine prevista", () => {
    const t = computeLiveTiming(plan, input([{ id: "r1", startedAt: at(8), playEndedAt: null }, { id: "r2", startedAt: null, playEndedAt: null }]), at(8));
    expect(t.phase).toBe("round");
    expect(t.delayMs).toBe(3 * MIN);
    expect(t.projectedEndAt).toBe(at(63));
    expect(delayLabel(t.delayMs).text).toBe("In ritardo di 3 min");
  });

  it("round che sfora: il ritardo cresce oltre il previsto", () => {
    const t = computeLiveTiming(plan, input([{ id: "r1", startedAt: at(8), playEndedAt: null }, { id: "r2", startedAt: null, playEndedAt: null }]), at(33));
    expect(t.delayMs).toBe(8 * MIN);
    expect(t.projectedEndAt).toBe(at(68));
    expect(t.rounds[0]).toMatchObject({ status: "running", actualMs: 25 * MIN, deltaMs: 5 * MIN });
  });

  it("intervallo dopo il round: conta il tempo previsto di pausa", () => {
    const t = computeLiveTiming(plan, input([{ id: "r1", startedAt: at(8), playEndedAt: at(33) }, { id: "r2", startedAt: null, playEndedAt: null }]), at(38));
    expect(t.phase).toBe("after_round");
    expect(t.delayMs).toBe(8 * MIN);
    expect(t.projectedEndAt).toBe(at(68));
    expect(t.rounds[0]).toMatchObject({ status: "after", actualMs: 25 * MIN, deltaMs: 5 * MIN, breakActualMs: 5 * MIN });
  });

  it("round successivo dopo un intervallo più lungo", () => {
    const t = computeLiveTiming(plan, input([{ id: "r1", startedAt: at(8), playEndedAt: at(33) }, { id: "r2", startedAt: at(45), playEndedAt: null }]), at(45));
    expect(t.delayMs).toBe(10 * MIN);
    expect(t.projectedEndAt).toBe(at(70));
    expect(t.rounds[0]).toMatchObject({ status: "done", breakActualMs: 12 * MIN });
    expect(t.rounds[1].status).toBe("running");
  });

  it("ultimo round più veloce: si recupera; poi il finale", () => {
    const t = computeLiveTiming(plan, input([{ id: "r1", startedAt: at(8), playEndedAt: at(33) }, { id: "r2", startedAt: at(45), playEndedAt: at(62) }]), at(64));
    expect(t.phase).toBe("outro");
    expect(t.delayMs).toBe(7 * MIN);
    expect(t.projectedEndAt).toBe(at(67));
    expect(t.rounds[1].deltaMs).toBe(-3 * MIN);
    expect(delayLabel(-3 * MIN)).toEqual({ text: "In anticipo di 3 min", tone: "early" });
  });

  it("serata finita: confronto con la durata prevista", () => {
    const t = computeLiveTiming(plan, input([{ id: "r1", startedAt: at(8), playEndedAt: at(33) }, { id: "r2", startedAt: at(45), playEndedAt: at(62) }], at(66)), at(90));
    expect(t.phase).toBe("finished");
    expect(t.elapsedMs).toBe(66 * MIN);
    expect(t.delayMs).toBe(6 * MIN);
    expect(t.projectedEndAt).toBe(at(66));
  });

  it("round avviati fuori ordine: conta l'ordine reale", () => {
    const t = computeLiveTiming(plan, input([{ id: "r1", startedAt: null, playEndedAt: null }, { id: "r2", startedAt: at(5), playEndedAt: null }]), at(15));
    expect(t.delayMs).toBe(0);
    expect(t.rounds[0].status).toBe("pending");
    // restano: 10 min di R2, il suo "dopo" (0), R1 con intervallo (30) e il finale (5)
    expect(t.projectedEndAt).toBe(at(15 + 10 + 30 + 5));
  });
});

describe("formattazione", () => {
  it("minuti e cronometro", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(125)).toBe("2 h 05");
    expect(formatMinutes(-75)).toBe("−1 h 15");
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(3_723_000)).toBe("1:02:03");
    expect(delayLabel(25_000).text).toBe("In orario");
  });
});
