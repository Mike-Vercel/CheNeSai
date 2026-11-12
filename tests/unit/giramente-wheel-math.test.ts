import { describe, expect, it } from "vitest";
import {
  ACTIVATION_BLEND_MS,
  TAU,
  activationOffset,
  hash01,
  planSpin,
  restAngle,
  segmentAtAngle,
  spinAngleAt,
  spinDone,
  spinProgress,
  spinSpeedAt,
  wrap,
} from "@/features/giramente/three/wheel-math";
import { WHEEL_SEGMENTS_FINALE, WHEEL_SEGMENTS_STANDARD } from "@/features/giramente/three/segments";

const N = 8;
const cmd = (targetIndex: number, spinId = `giro-${targetIndex}`, startedAt = 1_700_000_000_000, durationMs = 6500) => ({ spinId, targetIndex, startedAt, durationMs });

describe("GIRAMENTE! ruota: spicchi", () => {
  it("8 caselle del brief e finale con 4 categorie ripetute due volte, mai due colori uguali vicini", () => {
    expect(WHEEL_SEGMENTS_STANDARD.map((s) => s.kind)).toEqual(["intruso", "sequenza", "indizi", "prospettiva", "mistero", "jolly", "bonus", "colpo"]);
    expect(WHEEL_SEGMENTS_FINALE.map((s) => s.kind)).toEqual(["intruso", "sequenza", "indizi", "prospettiva", "intruso", "sequenza", "indizi", "prospettiva"]);
    for (const list of [WHEEL_SEGMENTS_STANDARD, WHEEL_SEGMENTS_FINALE]) {
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
      list.forEach((s, i) => expect(s.color).not.toBe(list[(i + 1) % list.length].color));
    }
  });

  it("restAngle mette lo spicchio giusto sotto il puntatore, per ognuno degli 8", () => {
    for (let i = 0; i < N; i++) {
      const a = restAngle(i, N);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(TAU);
      expect(segmentAtAngle(a, N)).toBe(i);
      // con qualsiasi numero di giri in più
      expect(segmentAtAngle(a + 5 * TAU, N)).toBe(i);
      expect(segmentAtAngle(a - 3 * TAU, N)).toBe(i);
    }
  });
});

describe("GIRAMENTE! ruota: giro deterministico", () => {
  it("progresso: 0 all'inizio, 1 alla fine, sempre crescente", () => {
    expect(spinProgress(0)).toBe(0);
    expect(spinProgress(1)).toBe(1);
    let prev = 0;
    for (let k = 1; k <= 1000; k++) {
      const p = spinProgress(k / 1000);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = p;
    }
    expect(prev).toBeCloseTo(1, 12);
  });

  it("angolo di partenza e di arrivo; si ferma esattamente sullo spicchio deciso dal server (tutti gli 8)", () => {
    for (let i = 0; i < N; i++) {
      for (const id of ["a", "b", "zz-99", `giro-${i}`]) {
        const c = cmd(i, id);
        const plan = planSpin(c, N);
        expect(spinAngleAt(plan, c.startedAt - 5000)).toBe(plan.from);
        expect(spinAngleAt(plan, c.startedAt)).toBeCloseTo(plan.from, 12);
        expect(spinAngleAt(plan, c.startedAt + c.durationMs)).toBe(plan.to);
        expect(spinAngleAt(plan, c.startedAt + c.durationMs + 60_000)).toBe(plan.to);
        expect(plan.to).toBe(restAngle(i, N));
        expect(segmentAtAngle(spinAngleAt(plan, c.startedAt + c.durationMs), N)).toBe(i);
        expect(spinDone(plan, c.startedAt + c.durationMs)).toBe(true);
        expect(spinDone(plan, c.startedAt + c.durationMs - 1)).toBe(false);
        // almeno 2 giri completi
        expect(plan.to - plan.from).toBeGreaterThan(2 * TAU);
      }
    }
  });

  it("indici fuori intervallo normalizzati (−1 = ultimo, 9 = 1)", () => {
    expect(planSpin(cmd(-1), N).targetIndex).toBe(7);
    expect(planSpin(cmd(9), N).targetIndex).toBe(1);
  });

  it("due client (o un client che si riconnette) calcolano lo stesso angolo nello stesso istante", () => {
    const c = cmd(5, "giro-condiviso");
    const tv = planSpin(c, N);
    const telefono = planSpin({ ...c }, N); // piano rifatto da zero, come dopo una riconnessione
    for (let t = c.startedAt - 100; t <= c.startedAt + c.durationMs + 100; t += 37) {
      expect(spinAngleAt(telefono, t)).toBe(spinAngleAt(tv, t));
    }
  });

  it("entrare in ritardo: la curva è continua (niente salti) e la velocità è finita", () => {
    const c = cmd(3, "ritardatario");
    const plan = planSpin(c, N);
    const step = 4; // ms
    let maxJump = 0;
    for (let t = c.startedAt; t <= c.startedAt + c.durationMs; t += step) {
      const d = Math.abs(spinAngleAt(plan, t + step) - spinAngleAt(plan, t));
      maxJump = Math.max(maxJump, d);
    }
    // a velocità di punta (~3 giri/s) in 4 ms si percorrono meno di 0.1 rad
    expect(maxJump).toBeLessThan(0.1);
    // all'arrivo la ruota è ferma; a metà gira veloce
    expect(Math.abs(spinSpeedAt(plan, c.startedAt + c.durationMs - 1))).toBeLessThan(0.05);
    expect(spinSpeedAt(plan, c.startedAt + c.durationMs * 0.2)).toBeGreaterThan(5);
  });

  it("attivazione: piccolo strappo all'indietro, poi solo in avanti fino all'arresto", () => {
    const c = cmd(2, "strappo");
    const plan = planSpin(c, N);
    expect(spinAngleAt(plan, c.startedAt + 120)).toBeLessThan(plan.from);
    let prev = spinAngleAt(plan, c.startedAt + 400);
    for (let t = c.startedAt + 420; t <= c.startedAt + c.durationMs; t += 20) {
      const a = spinAngleAt(plan, t);
      expect(a).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = a;
    }
  });

  it("raccordo: chi mostrava un altro spicchio parte da lì e dopo ACTIVATION_BLEND_MS è sulla curva comune", () => {
    const c = cmd(6, "raccordo");
    const plan = planSpin(c, N);
    const shown = restAngle(1, N);
    const start = spinAngleAt(plan, c.startedAt) + activationOffset(plan, shown, c.startedAt);
    expect(wrap(start)).toBeCloseTo(wrap(shown), 9);
    expect(activationOffset(plan, shown, c.startedAt + ACTIVATION_BLEND_MS)).toBe(0);
    expect(activationOffset(plan, null, c.startedAt + 10)).toBe(0);
  });

  it("hash stabile (stesso giro → stessi giri completi su ogni dispositivo)", () => {
    expect(hash01("abc")).toBe(hash01("abc"));
    expect(hash01("abc", "x")).not.toBe(hash01("abc", "y"));
    const p1 = planSpin(cmd(4, "stabile"), N);
    const p2 = planSpin(cmd(4, "stabile"), N);
    expect(p1.from).toBe(p2.from);
  });
});

describe("GIRAMENTE! ruota: stato a schermo (WheelDriver)", () => {
  it("scatti durante il giro, fine giro una sola volta, poi ferma sullo spicchio deciso", async () => {
    const { WheelDriver } = await import("@/features/giramente/three/wheel-driver");
    const c = cmd(4, "driver-1");
    const d = new WheelDriver();
    let ticks = 0;
    let ends = 0;
    for (let t = c.startedAt - 200; t <= c.startedAt + c.durationMs + 500; t += 16) {
      const f = d.update(c, null, N, t);
      if (f.ticked) ticks++;
      if (f.ended) ends++;
    }
    expect(ticks).toBeGreaterThan(20);
    expect(ends).toBe(1);
    const last = d.update(c, null, N, c.startedAt + c.durationMs + 1000);
    expect(last.restingOn).toBe(4);
    expect(last.spinning).toBe(false);
    // un secondo schermo (es. la ruota rimontata) non ripete la fine dello stesso giro
    expect(new WheelDriver().update(c, null, N, c.startedAt + c.durationMs + 10).ended).toBeNull();
  });

  it("da ferma segue restIndex; chi arriva a metà giro è sulla curva comune", async () => {
    const { WheelDriver } = await import("@/features/giramente/three/wheel-driver");
    const d = new WheelDriver();
    expect(segmentAtAngle(d.update(null, 6, N, 0).angle, N)).toBe(6);
    const c = cmd(1, "driver-ritardo");
    const plan = planSpin(c, N);
    const t = c.startedAt + 2500;
    expect(new WheelDriver().update(c, null, N, t).angle).toBe(spinAngleAt(plan, t));
  });
});
