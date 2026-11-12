import { describe, expect, it } from "vitest";
import type { PublicShowLine } from "@/lib/game-engine/types";
import { matchShowLine, presenterCue, trioCast } from "@/features/display/presenter-cue";

const lines: PublicShowLine[] = [
  { who: "regina", text: "[excited] AMOOOORE, Vodka!  Primo posto!", animation: "celebrate", event: "LEADER_CHANGED" },
  { who: "palmino", text: "Mamma mia, tutti sbagliato!", animation: "bogus-anim", event: "ALL_WRONG" },
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

describe("trio sul TV: tutti e tre in scena", () => {
  const roles = (m: ReturnType<typeof trioCast>["members"]) => Object.fromEntries(m.map((x) => [x.role, `${x.who}:${x.animation}`]));

  it("nessuno parla: davanti il padrone di casa col suo gesto, gli altri due ascoltano", () => {
    expect(roles(trioCast("regina", "point", null, null).members)).toEqual({ front: "regina:point", left: "professore:idle", right: "palmino:idle" });
  });

  it("chi parla passa davanti (anche se non è il padrone di casa) e gli altri restano ai loro posti", () => {
    expect(roles(trioCast("professore", "point", null, { who: "palmino", text: "Mamma mia" }).members)).toEqual({ front: "palmino:talk", left: "professore:idle", right: "regina:idle" });
  });

  it("battuta del regista: davanti chi la dice, con la sua animazione", () => {
    const t = trioCast("professore", "point", lines, { who: "regina", text: lines[0].text });
    expect(roles(t.members).front).toBe("regina:celebrate");
    expect(t.cue.guest).toBe(true);
  });

  it("festa e sorpresa sono di tutti: anche chi ascolta reagisce", () => {
    expect(roles(trioCast("professore", "celebrate", null, null).members)).toEqual({ front: "professore:celebrate", left: "regina:celebrate", right: "palmino:celebrate" });
  });

  it("sempre tre presentatori diversi", () => {
    for (const host of ["professore", "regina", "palmino"] as const)
      for (const who of ["professore", "regina", "palmino"] as const) {
        const ws = trioCast(host, "idle", null, { who, text: "x" }).members.map((m) => m.who);
        expect(new Set(ws).size).toBe(3);
      }
  });
});
