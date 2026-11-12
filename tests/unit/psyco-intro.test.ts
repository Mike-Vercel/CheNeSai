import { describe, expect, it, vi } from "vitest";
import { cameraAt, characterAt, fitDistance, INTRO_T, introCanEnd, lampAt, PATH } from "@/features/psyco/intro/timeline";
import { levelToMouth } from "@/features/psyco/investigatore/lipsync";
import { INVESTIGATORE_FILES, INVESTIGATORE_VARIANT, investigatoreUrl } from "@/features/three/characters/investigatore";

describe("intro 3D di PSYCO: copione", () => {
  it("l'Investigatore entra camminando, si gira e si siede", () => {
    const before = characterAt(0);
    expect(before.x).toBeCloseTo(PATH.startX);
    expect(before.walk).toBe(0);
    const mid = characterAt((INTRO_T.walkStart + INTRO_T.walkEnd) / 2);
    expect(mid.walk).toBe(1);
    expect(mid.speed).toBeGreaterThan(0.5);
    expect(mid.rotY).toBeCloseTo(Math.PI / 2);
    expect(mid.x).toBeGreaterThan(PATH.startX);
    expect(mid.x).toBeLessThan(PATH.endX);
    const seated = characterAt(INTRO_T.sitEnd + 0.5);
    expect(seated.x).toBeCloseTo(PATH.endX);
    expect(seated.rotY).toBeCloseTo(0);
    expect(seated.walk).toBe(0);
    expect(seated.sit).toBe(1);
    expect(seated.z).toBeCloseTo(PATH.seatZ);
  });

  it("la camminata va solo avanti e la seduta cresce senza scatti", () => {
    let x = -Infinity;
    let sit = 0;
    for (let t = 0; t <= INTRO_T.maxEnd; t += 0.05) {
      const c = characterAt(t);
      expect(c.x).toBeGreaterThanOrEqual(x - 1e-9);
      expect(c.sit).toBeGreaterThanOrEqual(sit - 1e-9);
      expect(c.sit - sit).toBeLessThan(0.1);
      x = c.x;
      sit = c.sit;
    }
  });

  it("lampada: spenta, sfarfallio, accesa", () => {
    expect(lampAt(0.5)).toBe(0);
    const flicker = [1.03, 1.12, 1.2, 1.35].map(lampAt);
    expect(new Set(flicker).size).toBeGreaterThan(2);
    expect(lampAt(INTRO_T.lampOn + 0.5)).toBeGreaterThan(0.9);
  });

  it("camera: verticale e orizzontale tengono il soggetto in quadro e si avvicinano per la voce", () => {
    for (const [layout, aspect] of [
      ["landscape", 16 / 9],
      ["portrait", 390 / 844],
    ] as const) {
      const wide = cameraAt(0.5, layout, aspect);
      const close = cameraAt(INTRO_T.voiceAt + 1, layout, aspect, [0, 1.0, -0.7]);
      const dWide = Math.hypot(...wide.pos.map((p, i) => p - wide.target[i]));
      const dClose = Math.hypot(...close.pos.map((p, i) => p - close.target[i]));
      expect(dClose).toBeLessThan(dWide / 2);
      expect(close.pos[2]).toBeGreaterThan(0.4); // sopra il bordo davanti della scrivania (z = 0.425), mai dietro
    }
    // in verticale serve più distanza per la stessa larghezza
    expect(fitDistance({ w: 2, h: 1 }, 40, 0.46)).toBeGreaterThan(fitDistance({ w: 2, h: 1 }, 40, 1.78));
  });

  it("fine: dopo la voce e non prima di minEnd, sempre entro maxEnd", () => {
    expect(introCanEnd(INTRO_T.minEnd - 1, true)).toBe(false);
    expect(introCanEnd(INTRO_T.minEnd + 0.1, false)).toBe(false);
    expect(introCanEnd(INTRO_T.minEnd + 0.1, true)).toBe(true);
    expect(introCanEnd(INTRO_T.maxEnd, false)).toBe(true);
  });
});

describe("Investigatore: bocca e variante", () => {
  it("volume della voce → apertura della bocca", () => {
    expect(levelToMouth(0)).toBe(0);
    expect(levelToMouth(0.01)).toBe(0);
    expect(levelToMouth(0.08)).toBeGreaterThan(0.3);
    expect(levelToMouth(1)).toBe(1);
  });

  it("variante configurabile in un punto, A di default", () => {
    expect(INVESTIGATORE_VARIANT).toBe("a");
    expect(investigatoreUrl()).toBe("/models/investigatore.glb");
    expect(investigatoreUrl("b")).toBe(INVESTIGATORE_FILES.b);
  });
});

describe("narratore: l'intro trattiene e libera le frasi", () => {
  it("hold accoda senza parlare, release dice prima la frase dell'intro (senza doppioni)", async () => {
    vi.resetModules();
    vi.doMock("@/features/media/audio-engine", () => ({
      getSoundEngine: () => ({ context: null, loadBuffer: async () => null, playVoiceClip: () => null }),
    }));
    vi.doMock("@/features/psyco/audio-prefs", () => ({ getAudioPrefs: () => ({ voice: false }) }));
    const { getNarrator } = await import("@/features/psyco/narrator");
    const n = getNarrator();
    const ids: (string | null)[] = [];
    n.onState((s) => ids.push(s.id));
    n.hold();
    n.say(["benvenuti", "lobby-attesa"]);
    await new Promise((r) => setTimeout(r, 30));
    expect(n.state.speaking).toBe(false);
    n.release(["benvenuti"]);
    await new Promise((r) => setTimeout(r, 30));
    expect(n.state.id).toBe("benvenuti");
    n.stop();
    expect(ids.filter((x) => x === "benvenuti").length).toBe(1);
    vi.doUnmock("@/features/media/audio-engine");
    vi.doUnmock("@/features/psyco/audio-prefs");
  });
});
