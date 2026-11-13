import { describe, expect, it } from "vitest";
import { cueKey, ledFor, serverPhaseStart } from "@/features/giramente/studio-cue";
import { cameraPosition, fitDistance, FULL_WINDOW, lensShift, SHOTS, smoothDamp } from "@/features/giramente/three/studio/studio-camera";
import { directStudio, effectiveSince, PUSH_MS, WALK_IN_MS, type StudioCue } from "@/features/giramente/three/studio/studio-director";
import { DEFAULT_SETTINGS, type Phase, type PublicState } from "@/lib/giramente/types";

const base = (over: Partial<PublicState> = {}): PublicState => ({
  roomId: "r",
  code: "ABCDEF",
  devices: "personal",
  mode: "individual",
  status: "open",
  phase: "LOBBY",
  version: 1,
  secretRev: 0,
  serverNow: new Date(0).toISOString(),
  settings: DEFAULT_SETTINGS,
  roundNo: 0,
  roundName: null,
  stage: null,
  tiebreakNo: 0,
  phaseTimer: { startedAt: null, deadlineAt: null, totalMs: null },
  pausedAt: null,
  hostOnline: true,
  displayOnline: false,
  competitors: [
    { id: "c1", kind: "player", name: "Sara", seat: 1, score: 300, jolly: null, members: [], online: true, done: false },
    { id: "c2", kind: "player", name: "Luca", seat: 2, score: 900, jolly: null, members: [], online: true, done: false },
  ],
  participants: [],
  standings: [
    { competitorId: "c2", position: 1, score: 900 },
    { competitorId: "c1", position: 2, score: 300 },
  ],
  wheel: { finale: false, spin: null, restIndex: null },
  turn: null,
  question: null,
  result: null,
  stagePlay: null,
  reveal: null,
  winners: [],
  event: null,
  estimate: { min: 20, max: 30 },
  ...over,
});

const cue = (phase: Phase, over: Partial<StudioCue> = {}): StudioCue => ({ phase, key: `${phase}|1`, since: 0, sector: null, correct: null, stage: null, spinMs: 7000, finale: false, ...over });

describe("GIRAMENTE! – regia dello studio 3D", () => {
  it("ogni fase ha inquadratura, azione e segno di Don Patrizio", () => {
    const phases: Phase[] = ["LOBBY", "INTRO", "ROUND_INTRO", "TURN_READY", "CHOICE", "SPIN", "SPINNING", "WHEEL_RESULT", "QUESTION", "TURN_RESULT", "PLAY", "REVEAL", "ROUND_RESULTS", "FINAL"];
    for (const p of phases) {
      const d = directStudio(cue(p), 500, false);
      expect(SHOTS[d.shot], p).toBeDefined();
      expect(d.action, p).toBeTruthy();
    }
    expect(directStudio(cue("LOBBY"), 5000, false).shot).toBe("wide");
    expect(directStudio(cue("FINAL"), 1000, false)).toMatchObject({ shot: "winner", action: "vittoria", mood: "victory" });
  });

  it("il giro: si avvicina e indica, spinge all'inizio del giro, poi carrellata sulla ruota", () => {
    expect(directStudio(cue("SPIN"), 300, false)).toMatchObject({ action: "indica", mark: "push" });
    const push = directStudio(cue("SPINNING"), 200, false);
    expect(push).toMatchObject({ shot: "wheel", action: "spinta", mood: "spin" });
    expect(directStudio(cue("SPINNING"), PUSH_MS + 100, false).action).toBe("pensiero");
    // carrellata lenta, proporzionale alla durata del giro
    expect(push.ease).toBeGreaterThan(1);
  });

  it("esito: primo piano sullo spicchio, poi la scena; la Jolly porta Zafira sul palco", () => {
    expect(directStudio(cue("WHEEL_RESULT", { sector: "bonus" }), 500, false).shot).toBe("sector");
    expect(directStudio(cue("WHEEL_RESULT", { sector: "bonus" }), 5000, false)).toMatchObject({ shot: "duo", action: "indica", zafira: false });
    expect(directStudio(cue("WHEEL_RESULT", { sector: "jolly" }), 500, false)).toMatchObject({ action: "sorpresa", zafira: true });
    expect(directStudio(cue("WHEEL_RESULT", { sector: "jolly" }), 5000, false)).toMatchObject({ shot: "jolly", zafira: true });
    expect(directStudio(cue("QUESTION"), 500, false).zafira).toBe(false);
  });

  it("reazioni: applauso sul giusto, delusione sullo sbagliato; parla = presentazione", () => {
    expect(directStudio(cue("TURN_RESULT", { correct: true }), 500, false)).toMatchObject({ action: "applauso", mood: "correct", shot: "presenter" });
    expect(directStudio(cue("TURN_RESULT", { correct: false }), 500, false)).toMatchObject({ action: "delusione", mood: "wrong" });
    expect(directStudio(cue("CHOICE"), 500, true).action).toBe("presentazione");
    expect(directStudio(cue("PLAY", { stage: "tabellone" }), 500, false).shot).toBe("board");
  });

  it("ingresso: si fa avanti e saluta, poi torna accanto alla ruota", () => {
    expect(directStudio(cue("INTRO"), 500, false)).toMatchObject({ mark: "center", shot: "presenterFull" });
    expect(directStudio(cue("INTRO"), WALK_IN_MS + 500, false).action).toBe("saluto");
    expect(directStudio(cue("INTRO"), WALK_IN_MS + 6000, false).mark).toBe("home");
  });

  it("inizio della fase: dal server al primo fotogramma (ricollegamento), poi dall'ora del cambio", () => {
    const c = cue("QUESTION", { since: 10_000 });
    expect(effectiveSince(c, null, 15_000)).toBe(10_000);
    expect(effectiveSince(c, { key: "CHOICE|1", since: 1 }, 15_000)).toBe(15_000);
    expect(effectiveSince(c, { key: c.key, since: 12_000 }, 15_000)).toBe(12_000);
    // il giro usa sempre l'inizio del server (come la ruota)
    expect(effectiveSince(cue("SPINNING", { since: 14_000 }), { key: "SPIN|1", since: 1 }, 15_000)).toBe(14_000);
    expect(effectiveSince(cue("LOBBY", { since: NaN }), null, 15_000)).toBe(15_000);
  });
});

describe("GIRAMENTE! – camera dello studio", () => {
  it("la distanza fa stare il soggetto nella finestra (più piccola = più lontano)", () => {
    const full = fitDistance([2, 2], 34, 16 / 9, FULL_WINDOW);
    const half = fitDistance([2, 2], 34, 16 / 9, { x0: 0, x1: 0.5, y0: 0, y1: 1 });
    expect(half).toBeGreaterThan(full);
    const t = Math.tan((34 * Math.PI) / 360);
    expect(2 / (full * t)).toBeLessThanOrEqual(1);
  });

  it("lens shift: centro della finestra in coordinate NDC", () => {
    expect(lensShift(FULL_WINDOW)).toEqual({ x: 0, y: 0 });
    const s = lensShift({ x0: 0, x1: 0.6, y0: 0.1, y1: 0.5 });
    expect(s.x).toBeCloseTo(-0.4);
    expect(s.y).toBeCloseTo(0.4);
  });

  it("posizione della camera e smorzamento senza oscillazioni", () => {
    expect(cameraPosition([0, 1, 0], 0, 0, 5)).toEqual([0, 1, 5]);
    const v = { v: 0 };
    let x = 0;
    for (let i = 0; i < 300; i++) {
      x = smoothDamp(x, 10, v, 0.5, 1 / 60);
      expect(x).toBeLessThanOrEqual(10);
    }
    expect(x).toBeCloseTo(10, 2);
    expect(smoothDamp(3, 7, { v: 0 }, 0, 1 / 60)).toBe(7);
  });
});

describe("GIRAMENTE! – dallo stato pubblico allo studio", () => {
  it("chiave di fase e inizio dal server", () => {
    expect(cueKey(base())).not.toBe(cueKey(base({ phase: "INTRO" })));
    const spin = base({ phase: "SPINNING", wheel: { finale: false, restIndex: null, spin: { spinId: "s", targetIndex: 2, startedAt: new Date(5000).toISOString(), durationMs: 7000 } } });
    expect(serverPhaseStart(spin)).toBe(5000);
    expect(serverPhaseStart(base({ phaseTimer: { startedAt: new Date(3000).toISOString(), deadlineAt: null, totalMs: null }, event: { kind: "turn", at: new Date(2000).toISOString() } }))).toBe(3000);
    expect(Number.isNaN(serverPhaseStart(base()))).toBe(true);
  });

  it("lo schermo LED non mostra MAI il codice della partita e mostra solo dati pubblici", () => {
    const phases: Phase[] = ["LOBBY", "INTRO", "ROUND_INTRO", "CHOICE", "SPIN", "SPINNING", "WHEEL_RESULT", "QUESTION", "TURN_RESULT", "PLAY", "REVEAL", "ROUND_RESULTS", "FINAL"];
    for (const phase of phases) expect(JSON.stringify(ledFor(base({ phase, roundNo: 1, roundName: "SI ACCENDE LA MENTE" })))).not.toContain("ABCDEF");
    expect(ledFor(base({ phase: "ROUND_RESULTS" }))).toEqual({ kind: "standings", rows: [{ name: "Luca", score: 900 }, { name: "Sara", score: 300 }] });
    expect(ledFor(base({ phase: "FINAL", winners: ["c2"] }))).toEqual({ kind: "winner", names: ["Luca"], score: 900 });
    expect(ledFor(base({ phase: "ROUND_INTRO", roundNo: 2, roundName: "LA FALSA PISTA" }))).toMatchObject({ kind: "title", title: "LA FALSA PISTA" });
  });
});
