import { describe, expect, it } from "vitest";
import { effectiveAnimation, GESTURE_MS } from "@/features/three/characters/gesture";

describe("gesti dei personaggi sul TV: una volta sola, poi riposo", () => {
  it("il gesto richiesto si vede finché non è stato fatto", () => {
    for (const g of ["wave", "point", "celebrate", "surprised", "intro"] as const) {
      expect(GESTURE_MS[g]).toBeGreaterThan(0);
      expect(effectiveAnimation(g, false, false)).toBe(g);
    }
  });

  it("a gesto finito si torna a riposo (niente braccio alzato per tutta la schermata)", () => {
    for (const g of ["wave", "point", "celebrate", "surprised", "intro"] as const) expect(effectiveAnimation(g, true, false)).toBe("idle");
  });

  it("a gesto finito, se parla, torna alla parlata", () => {
    expect(effectiveAnimation("celebrate", true, true)).toBe("talk");
    expect(effectiveAnimation("wave", true, true)).toBe("talk");
  });

  it("mentre parla: riposo e indicare diventano parlata, gli altri gesti restano finché durano", () => {
    expect(effectiveAnimation("idle", false, true)).toBe("talk");
    expect(effectiveAnimation("point", false, true)).toBe("talk");
    expect(effectiveAnimation("celebrate", false, true)).toBe("celebrate");
  });

  it("riposo e parlata non scadono", () => {
    expect(effectiveAnimation("idle", true, false)).toBe("idle");
    expect(effectiveAnimation("talk", true, false)).toBe("talk");
  });
});
