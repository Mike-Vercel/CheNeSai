import { describe, expect, it } from "vitest";
import type { PublicShowLine } from "@/lib/game-engine/types";
import { matchShowLine, presenterCue } from "@/features/display/presenter-cue";

const lines: PublicShowLine[] = [
  { who: "regina", text: "[excited] AMOOOORE, Vodka!  Primo posto!", animation: "celebrate", event: "LEADER_CHANGED" },
  { who: "palmino", text: "MIIII, tutti sbagliato!", animation: "bogus-anim", event: "ALL_WRONG" },
];

describe("personaggi guidati dalla battuta in corso", () => {
  it("riconosce la battuta del regista che il TV sta dicendo (stesso personaggio, stesso testo)", () => {
    expect(matchShowLine(lines, { who: "regina", text: "[excited] AMOOOORE, Vodka! Primo posto!" })).toBe(lines[0]);
    expect(matchShowLine(lines, { who: "professore", text: "[excited] AMOOOORE, Vodka! Primo posto!" })).toBeNull();
    expect(matchShowLine(lines, null)).toBeNull();
    expect(matchShowLine(null, { who: "regina", text: "x" })).toBeNull();
  });

  it("un ospite entra al posto del padrone di casa con l'animazione della battuta", () => {
    const cue = presenterCue("professore", "point", lines, { who: "regina", text: lines[0].text });
    expect(cue).toMatchObject({ who: "regina", animation: "celebrate", guest: true, line: lines[0] });
  });

  it("animazione non valida nei dati: si parla e basta", () => {
    expect(presenterCue("palmino", "point", lines, { who: "palmino", text: lines[1].text })).toMatchObject({ who: "palmino", animation: "talk", guest: false });
  });

  it("a battuta finita (o dopo un ricaricamento) torna il padrone di casa", () => {
    expect(presenterCue("professore", "point", lines, null)).toEqual({ who: "professore", animation: "point", line: null, guest: false });
    // il padrone di casa che dice una battuta di rito parla, senza ospiti
    expect(presenterCue("professore", "point", lines, { who: "professore", text: "Altra battuta" })).toMatchObject({ who: "professore", animation: "talk", guest: false });
    // un altro presentatore che dice altro (non del regista) non entra in scena
    expect(presenterCue("professore", "point", lines, { who: "regina", text: "fuori copione" })).toMatchObject({ who: "professore", animation: "point" });
  });
});
