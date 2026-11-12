import { describe, expect, it } from "vitest";
import { direct } from "@/features/giramente/director";
import { captionOf, fillLine, isDynamic, LINE_BY_ID, LINES, pickVariant, VARIANT_LINES, variantsOf } from "@/lib/giramente/lines";
import { DEFAULT_SETTINGS, type PublicState } from "@/lib/giramente/types";

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
  competitors: [{ id: "c1", kind: "player", name: "Sara", seat: 1, score: 300, jolly: null, members: [], online: true, done: false }],
  participants: [],
  standings: [{ competitorId: "c1", position: 1, score: 300 }],
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

const turn = (over: Partial<NonNullable<PublicState["turn"]>> = {}): NonNullable<PublicState["turn"]> => ({
  competitorId: "c1",
  playId: "p1",
  no: 1,
  of: 2,
  risk: null,
  sector: null,
  jolly: null,
  colpo: null,
  bonus: false,
  lampo: false,
  ...over,
});

describe("GIRAMENTE! – regia delle battute", () => {
  it("benvenuto in sala d'attesa, introduzione della manche, turno con il nome", () => {
    expect(direct(null, base()).cues.map((c) => c.line)).toEqual(["benvenuti", "sala-attesa"]);
    const intro = direct(base(), base({ phase: "ROUND_INTRO", roundNo: 3, version: 2 }));
    expect(intro.cues[0].line).toBe("manche-3");
    expect(intro.replace).toBe(true);
    const choice = direct(base({ phase: "ROUND_INTRO", roundNo: 1 }), base({ phase: "CHOICE", roundNo: 1, version: 3, turn: turn() }));
    expect(choice.cues[0]).toEqual({ line: "turno-giocatore", competitorId: "c1" });
  });
  it("ruota ferma sulla Jolly: Zafira entra e offre i poteri (o +50 se doppione)", () => {
    const prev = base({ phase: "SPINNING", roundNo: 1, turn: turn({ risk: "verde" }) });
    const d = direct(prev, base({ phase: "WHEEL_RESULT", roundNo: 1, version: 5, turn: turn({ risk: "verde", sector: "jolly", jolly: { offer: true, duplicate: false, chosen: null } }) }));
    expect(d.cues.map((c) => c.line)).toEqual(["settore-jolly", "zafira-ingresso", "zafira-offerta"]);
    expect(d.sfx).toContain("jolly");
    const dup = direct(prev, base({ phase: "WHEEL_RESULT", roundNo: 1, version: 5, turn: turn({ risk: "verde", sector: "jolly", jolly: { offer: false, duplicate: true, chosen: null } }) }));
    expect(dup.cues.map((c) => c.line)).toContain("zafira-doppione");
  });
  it("esiti: giusta, penalità, scudo, tempo scaduto; vincitore col nome", () => {
    const prev = base({ phase: "QUESTION", roundNo: 1, turn: turn({ risk: "rosso", sector: "indizi" }) });
    const res = (r: Partial<NonNullable<PublicState["result"]>>) =>
      direct(prev, base({ phase: "TURN_RESULT", roundNo: 1, version: 9, turn: turn({ risk: "rosso", sector: "indizi" }), result: { playId: "p1", competitorId: "c1", correct: false, timeout: false, given: null, solution: "X", explanation: null, lines: [], delta: 0, shieldUsed: false, ...r } }));
    expect(res({ correct: true, delta: 300, lines: [{ label: "Risposta giusta in ROSSO", delta: 300 }] }).cues[0].line).toBe("giusta");
    expect(res({ delta: -100, lines: [{ label: "Penalità del ROSSO", delta: -100 }] }).cues[0].line).toBe("penalita");
    expect(res({ shieldUsed: true }).cues[0].line).toBe("zafira-usa-scudo");
    expect(res({ timeout: true }).cues[0].line).toBe("tempo-scaduto");
    const fin = direct(base({ phase: "ROUND_RESULTS", roundNo: 5 }), base({ phase: "FINAL", roundNo: 5, version: 20, winners: ["c1"] }));
    expect(fin.cues).toContainEqual({ line: "vincitore-nome", competitorId: "c1", points: 300 });
    expect(fin.sfx).toContain("victory");
  });
  it("ogni battuta chiesta dalla regia esiste nel catalogo (o come famiglia di varianti)", () => {
    const ids = ["benvenuti", "sala-attesa", "inizio-partita", "presentazione", "manche-1", "manche-2", "manche-3", "manche-4", "manche-5", "tabellone", "spareggio", "scegli", "scelta-verde", "scelta-rosso", "gira", "domanda", "giusta", "sbagliata", "penalita", "tempo-scaduto", "bonus-preso", "tutti-insieme", "passa-telefono", "rivelazione", "classifica", "pausa", "ripresa", "vincitore", "vincitore-nome", "saluti", "zafira-ingresso", "zafira-offerta", "zafira-doppione", "zafira-occhio", "zafira-scudo", "zafira-usa-occhio", "zafira-usa-scudo", "zafira-uscita", "zafira-scadenza", "turno-giocatore", "turno-squadra", "punti-giocatore"];
    for (const s of ["intruso", "sequenza", "indizi", "prospettiva", "mistero", "bonus", "colpo", "jolly"]) ids.push(`settore-${s}`);
    for (const id of ids) expect(variantsOf(id).length, id).toBeGreaterThan(0);
  });
});

describe("GIRAMENTE! – battute e varianti", () => {
  it("id unici, segnaposto riempiti, sottotitoli senza audio tag", () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
    expect(VARIANT_LINES.length).toBe(59);
    const l = LINE_BY_ID["vincitore-nome"];
    expect(isDynamic(l)).toBe(true);
    const text = fillLine(l, { playerName: "Sara", points: 2050 });
    expect(captionOf(text)).toBe("Il vincitore di GIRAMENTE è… Sara! Con 2.050 punti!");
    expect(captionOf("[excited] Ciao [pause] a tutti")).toBe("Ciao a tutti");
  });
  it("varianti: solo suffissi numerici, mai la stessa due volte di fila, preferite quelle registrate", () => {
    expect(variantsOf("vincitore")).not.toContain("vincitore-nome");
    expect(variantsOf("giusta")[0]).toBe("giusta-1");
    const fam = variantsOf("gira");
    expect(fam.length).toBeGreaterThan(1);
    let last: string | null = null;
    for (let i = 0; i < 50; i++) {
      const id = pickVariant("gira", null, last);
      expect(id).not.toBe(last);
      expect(fam).toContain(id);
      last = id;
    }
    // con un solo clip registrato si usa quello (anche due volte di fila: è l'unico con la voce vera)
    expect(pickVariant("gira", new Set(["gira-2"]), "gira-2")).toBe("gira-2");
    // nessun clip registrato: comunque una variante (si mostra il sottotitolo)
    expect(fam).toContain(pickVariant("gira", new Set(), null));
    expect(pickVariant("manche-3", null, "manche-3")).toBe("manche-3");
  });
});
