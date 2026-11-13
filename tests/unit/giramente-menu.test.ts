import { describe, expect, it } from "vitest";
import { menuDirection, menuLed, SETUP_STEPS, type MenuPanel } from "@/features/giramente/shell/menu-script";
import { SHOTS } from "@/features/giramente/three/studio/studio-camera";
import { MARKS } from "@/features/giramente/three/studio/studio-layout";
import { HOST_GONE_MINUTES, hostGoneAfterMs, isHostGone } from "@/lib/giramente/rules";

/** MENU di GIRAMENTE! (regia dello studio sotto il menu) e chiusura delle partite abbandonate da chi le gestisce. */
describe("menu: regia dello studio", () => {
  const panels: MenuPanel[] = ["main", "setup", "modes", "settings", "resume"];

  it("Don Patrizio sta al suo posto accanto alla ruota, inquadrature e segni esistenti, mai Zafira", () => {
    for (const p of panels)
      for (let t = 0; t < 40_000; t += 700) {
        const d = menuDirection(t, false, p);
        expect(d.mark).toBe("home");
        expect(SHOTS[d.shot], `${p} ${t}`).toBeDefined();
        expect(MARKS[d.mark]).toBeDefined();
        expect(d.zafira).toBe(false);
      }
  });

  it("ogni tanto saluta; se parla, gesticola", () => {
    const actions = new Set(Array.from({ length: 60 }, (_, i) => menuDirection(i * 500, false, "main").action));
    expect(actions.has("saluto")).toBe(true);
    expect(actions.has("idle")).toBe(true);
    expect(menuDirection(5000, true, "main").action).toBe("presentazione");
  });

  it("LED: il logo all'apertura, la voce scelta, il passo delle impostazioni", () => {
    expect(menuLed("main")).toEqual({ kind: "logo" });
    expect(menuLed("main", 0, "nuova")).toMatchObject({ kind: "title", title: "NUOVA PARTITA" });
    expect(menuLed("main", 0, "sconosciuta")).toEqual({ kind: "logo" });
    SETUP_STEPS.forEach((s, i) => expect(menuLed("setup", i as 0 | 1 | 2 | 3)).toMatchObject({ kind: "title", title: s.title, over: `NUOVA PARTITA · ${i + 1} DI 4` }));
    for (const p of panels) expect(menuLed(p).kind).toMatch(/logo|title/);
  });
});

describe("partite abbandonate da chi le gestisce", () => {
  const MIN = 60_000;
  const now = 10_000_000_000;

  it("10 minuti in sala d'attesa, 15 a partita iniziata", () => {
    expect(HOST_GONE_MINUTES).toEqual({ lobby: 10, game: 15 });
    expect(hostGoneAfterMs("LOBBY")).toBe(10 * MIN);
    expect(hostGoneAfterMs("QUESTION")).toBe(15 * MIN);
  });

  it("un ricaricamento o una breve assenza non chiudono nulla", () => {
    expect(isHostGone({ status: "open", phase: "LOBBY", hostSeenAtMs: now - 9 * MIN }, now)).toBe(false);
    expect(isHostGone({ status: "open", phase: "SPIN", hostSeenAtMs: now - 14 * MIN }, now)).toBe(false);
  });

  it("oltre la soglia sì; mai se già chiusa o al podio", () => {
    expect(isHostGone({ status: "open", phase: "LOBBY", hostSeenAtMs: now - 11 * MIN }, now)).toBe(true);
    expect(isHostGone({ status: "open", phase: "PLAY", hostSeenAtMs: now - 16 * MIN }, now)).toBe(true);
    expect(isHostGone({ status: "closed", phase: "LOBBY", hostSeenAtMs: now - 60 * MIN }, now)).toBe(false);
    expect(isHostGone({ status: "open", phase: "FINAL", hostSeenAtMs: now - 60 * MIN }, now)).toBe(false);
  });
});
