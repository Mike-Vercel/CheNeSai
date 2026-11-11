import { describe, expect, it } from "vitest";
import { DIFFICULTY_LEVELS, difficultyLabel } from "@/lib/game-engine/difficulty";

describe("livelli di difficoltà", () => {
  it("nomi dei 5 livelli dell'archivio", () => {
    expect(DIFFICULTY_LEVELS.map(difficultyLabel)).toEqual(["Facile", "Media", "Difficile", "Difficilissima", "Impossibile"]);
  });
  it("valori fuori scala riportati nell'intervallo", () => {
    expect(difficultyLabel(0)).toBe("Facile");
    expect(difficultyLabel(9)).toBe("Impossibile");
  });
});
