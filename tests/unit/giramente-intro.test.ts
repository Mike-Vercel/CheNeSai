import { afterEach, describe, expect, it, vi } from "vitest";
import { INTRO_2D_T, INTRO_LINE, INTRO_SAFETY_MS, INTRO_T, introCanEnd, introDirection, introLed, introLights, introRevealed, introStep2d } from "@/features/giramente/intro/intro-script";
import { isRoomWelcomed, markCreateIntroSeen, markRoomWelcomed, shouldShowCreateIntro } from "@/features/giramente/intro/flags";
import { SHOTS } from "@/features/giramente/three/studio/studio-camera";
import { MARKS } from "@/features/giramente/three/studio/studio-layout";
import { isDynamic, LINE_BY_ID } from "@/lib/giramente/lines";

/** INTRO DI GIRAMENTE! («Nuova partita»): copione puro e regole di quando si vede. */
describe("intro di GIRAMENTE!: copione", () => {
  it("dura al massimo ~15 s e la fine sicura arriva comunque", () => {
    expect(INTRO_T.maxEnd).toBeLessThanOrEqual(15);
    expect(INTRO_2D_T.normal.maxEnd).toBeLessThanOrEqual(15);
    expect(INTRO_SAFETY_MS).toBeGreaterThan(INTRO_T.maxEnd * 1000);
    expect(introCanEnd(INTRO_T.maxEnd, false)).toBe(true);
    expect(introCanEnd(INTRO_T.maxEnd - 0.1, false)).toBe(false);
  });

  it("la battuta del benvenuto è fissa (clip registrato) e di Don Patrizio", () => {
    const line = LINE_BY_ID[INTRO_LINE];
    expect(line?.who).toBe("dontralla");
    expect(isDynamic(line!)).toBe(false);
  });

  it("luci: dal buio alla piena luce", () => {
    expect(introLights(0)).toBeLessThan(0.2);
    expect(introLights(INTRO_T.lightsTo)).toBeCloseTo(1);
    for (let t = 0; t < 4; t += 0.25) expect(introLights(t + 0.25)).toBeGreaterThanOrEqual(introLights(t));
  });

  it("regia: campo lungo → ingresso camminando → saluto → mezza figura → titolo", () => {
    const at = (t: number, speaking = false) => introDirection(t * 1000, speaking);
    expect(at(0)).toMatchObject({ shot: "establish", ease: 0, mark: "offstage" });
    expect(at(1)).toMatchObject({ shot: "establish", mark: "center" });
    expect(at(3)).toMatchObject({ shot: "presenterFull", mark: "center" });
    expect(at(5, true)).toMatchObject({ action: "saluto" });
    expect(at(8, true)).toMatchObject({ shot: "host", action: "presentazione" });
    // il titolo aspetta la fine della voce, ma non oltre revealLatest
    expect(at(10.5, true).shot).toBe("host");
    expect(at(10.5, false).shot).toBe("title");
    expect(at(INTRO_T.revealLatest, true).shot).toBe("title");
    for (let t = 0; t < 16; t += 0.5) {
      const d = at(t, t > 5 && t < 11);
      expect(SHOTS[d.shot], `${t}`).toBeDefined();
      expect(MARKS[d.mark], `${t}`).toBeDefined();
      expect(d.zafira).toBe(false);
    }
  });

  it("LED: IN ONDA, poi GIRAMENTE!", () => {
    expect(introLed(false)).toMatchObject({ kind: "title", title: "IN ONDA" });
    expect(introLed(true)).toEqual({ kind: "logo" });
    expect(introRevealed(INTRO_T.reveal - 0.1, false)).toBe(false);
  });

  it("fine: titolo in scena per `hold` secondi a voce finita", () => {
    const r = 11.2;
    expect(introCanEnd(r + INTRO_T.hold - 0.1, true, "3d", r)).toBe(false);
    expect(introCanEnd(r + INTRO_T.hold, true, "3d", r)).toBe(true);
    expect(introCanEnd(r + INTRO_T.hold, false, "3d", r)).toBe(false);
    expect(introCanEnd(13, true, "3d", null)).toBe(false);
    // 2D e versione ferma
    expect(introCanEnd(INTRO_2D_T.normal.minEnd, true, "2d")).toBe(true);
    expect(introCanEnd(INTRO_2D_T.normal.minEnd, false, "2d")).toBe(false);
    expect(introCanEnd(INTRO_2D_T.still.minEnd, true, "still")).toBe(true);
    expect(introStep2d(0, false)).toBe(0);
    expect(introStep2d(INTRO_2D_T.normal.reveal, false)).toBe(2);
    expect(introStep2d(0, true)).toBe(2);
  });
});

describe("intro di GIRAMENTE!: quando si vede", () => {
  const store = new Map<string, string>();
  const stubWindow = (search: string, webdriver = false) => {
    vi.stubGlobal("window", { location: { search } });
    vi.stubGlobal("navigator", { webdriver });
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });

  it("una volta per scheda; ?intro=1 la forza, ?intro=0 la spegne; nei test automatici solo se chiesta", () => {
    stubWindow("");
    expect(shouldShowCreateIntro()).toBe(true);
    markCreateIntroSeen();
    expect(shouldShowCreateIntro()).toBe(false);
    stubWindow("?intro=1");
    expect(shouldShowCreateIntro()).toBe(true);
    store.clear();
    stubWindow("?intro=0");
    expect(shouldShowCreateIntro()).toBe(false);
    stubWindow("", true);
    expect(shouldShowCreateIntro()).toBe(false);
    stubWindow("?modo=squadre&intro=1", true);
    expect(shouldShowCreateIntro()).toBe(true);
  });

  it("la stanza creata dopo l'intro è già salutata", () => {
    stubWindow("");
    expect(isRoomWelcomed("r1")).toBe(false);
    markRoomWelcomed("r1");
    expect(isRoomWelcomed("r1")).toBe(true);
    expect(isRoomWelcomed("r2")).toBe(false);
  });
});
