import { describe, expect, it } from "vitest";
import { detectShowEvents, type ShowPlayer } from "@/lib/show/events";
import { directShow, resolveTemplate, validateTemplate, type DirectorHistory } from "@/lib/show/director";
import { DEFAULT_DIRECTOR_CONFIG, type DialogueTemplate, type ShowEvent } from "@/lib/show/types";

const P = (id: string, prevPoints: number, points: number, extra: Partial<ShowPlayer> = {}): ShowPlayer => ({
  id,
  nickname: id.toUpperCase(),
  points,
  prevPoints,
  inPlay: true,
  answered: true,
  correct: points > prevPoints,
  responseMs: points > prevPoints ? 3000 : null,
  correctStreak: points > prevPoints ? 1 : 0,
  wrongStreak: points > prevPoints ? 0 : 1,
  ...extra,
});
const types = (e: ShowEvent[]) => e.map((x) => x.type);

describe("rilevamento eventi dalla classifica reale", () => {
  it("nuovo primo e sorpasso", () => {
    const ev = detectShowEvents({ players: [P("anna", 1000, 1000), P("bruno", 900, 2400), P("carla", 500, 500)], leaderStreak: 1, endOfRound: false });
    const leader = ev.find((e) => e.type === "LEADER_CHANGED");
    expect(leader).toMatchObject({ leader: { id: "bruno" }, previous: { id: "anna" } });
    // bruno è il nuovo primo: il suo sorpasso è già raccontato dal cambio di leader
    expect(ev.some((e) => e.type === "OVERTAKE" && e.who.id === "bruno")).toBe(false);
  });

  it("sorpasso a metà classifica, ma non per un abbandono", () => {
    const ev = detectShowEvents({
      players: [P("anna", 3000, 3000), P("bruno", 1000, 2200), P("carla", 2000, 2000), P("dario", 1500, 1500, { inPlay: false })],
      leaderStreak: 1,
      endOfRound: false,
    });
    expect(ev.find((e) => e.type === "OVERTAKE")).toMatchObject({ who: { id: "bruno" }, overtaken: { id: "carla" } });
    expect(JSON.stringify(ev)).not.toContain("dario");
  });

  it("pari merito in testa, nessuno primo da solo", () => {
    const ev = detectShowEvents({ players: [P("anna", 1000, 2000), P("bruno", 1500, 2000), P("carla", 0, 0)], leaderStreak: 1, endOfRound: false });
    expect(types(ev)).toContain("LEADER_TIE");
    expect(types(ev)).not.toContain("LEADER_CHANGED");
  });

  it("tutti sbagliano / uno solo giusto / più veloce", () => {
    const allWrong = detectShowEvents({ players: [P("a", 100, 100), P("b", 200, 200), P("c", 50, 50)], leaderStreak: 2, endOfRound: false });
    expect(types(allWrong)).toContain("ALL_WRONG");
    const one = detectShowEvents({ players: [P("a", 100, 1100), P("b", 200, 200), P("c", 50, 50)], leaderStreak: 1, endOfRound: false });
    expect(one.find((e) => e.type === "ONLY_ONE_CORRECT")).toMatchObject({ who: { id: "a" } });
    const fast = detectShowEvents({
      players: [P("a", 0, 1400, { responseMs: 2300 }), P("b", 0, 1300, { responseMs: 4100 }), P("c", 0, 0)],
      leaderStreak: 1,
      endOfRound: false,
    });
    expect(fast.find((e) => e.type === "FASTEST_CORRECT")).toMatchObject({ who: { id: "a" }, ms: 2300 });
  });

  it("serie, nuovo ultimo, rimonta, soglia e fine round", () => {
    const ev = detectShowEvents({
      players: [
        P("a", 9500, 10500, { correctStreak: 3 }),
        P("b", 9000, 9000),
        P("c", 8000, 8000),
        P("d", 7000, 7000),
        P("e", 1000, 1000),
        P("f", 900, 9800, { correctStreak: 1 }),
      ],
      leaderStreak: 1,
      endOfRound: true,
    });
    expect(types(ev)).toEqual(expect.arrayContaining(["CORRECT_STREAK", "POINTS_MILESTONE", "COMEBACK", "NEW_LAST", "ROUND_WINNER"]));
    expect(ev.find((e) => e.type === "COMEBACK")).toMatchObject({ who: { id: "f" }, positions: 4 });
    expect(ev.find((e) => e.type === "NEW_LAST")).toMatchObject({ who: { id: "e" } });
  });
});

const T = (id: string, character: DialogueTemplate["character"], event: DialogueTemplate["event"], text: string, extra: Partial<DialogueTemplate> = {}): DialogueTemplate => ({
  id,
  character,
  event,
  text,
  tone: "comico",
  intensity: 2,
  priority: 50,
  weight: 1,
  cooldownSec: 120,
  animation: "talk",
  enabled: true,
  ...extra,
});
const empty = (): DirectorHistory => ({ lastUsed: new Map(), mentionsThisRound: new Map() });

describe("regista e battute con i nomi veri", () => {
  const lib = [
    T("r1", "regina", "LEADER_CHANGED", "AMOOOORE, {nome_primo}! Hai superato {nome_ex_primo}!"),
    T("p1", "palmino", "ALL_WRONG", "[laughs] Zero per tutti!"),
    T("p2", "palmino", "OVERTAKE", "Mamma mia, {nome_sorpasso} supera {nome_superato}!"),
    T("x1", "professore", "OVERTAKE", "Sorpasso di {nome_sorpasso} su {nome_superato}."),
  ];

  it("inserisce il nome reale dell'evento", () => {
    const e: ShowEvent = { type: "LEADER_CHANGED", leader: { id: "1", nickname: "Vodka" }, previous: { id: "2", nickname: "Gigi" }, points: 3000 };
    const lines = directShow({ events: [e], templates: lib, history: empty(), config: DEFAULT_DIRECTOR_CONFIG, nowMs: 0, seed: "q1" });
    expect(lines).toEqual([expect.objectContaining({ who: "regina", text: "AMOOOORE, Vodka! Hai superato Gigi!", mentions: ["1", "2"] })]);
  });

  it("rifiuta segnaposto sconosciuti o fuori evento", () => {
    expect(validateTemplate({ event: "ALL_WRONG", text: "Bravo {nome}!" })).not.toHaveLength(0);
    expect(resolveTemplate({ event: "NEW_LAST", text: "Ciao {nome_primo}" }, { type: "NEW_LAST", who: { id: "1", nickname: "Ugo" } })).toBeNull();
  });

  it("massimo due battute, personaggi diversi, nessun nome ripetuto nello stesso momento", () => {
    const events: ShowEvent[] = [
      { type: "ALL_WRONG" },
      { type: "OVERTAKE", who: { id: "a", nickname: "Anna" }, overtaken: { id: "b", nickname: "Bruno" } },
      { type: "LEADER_CHANGED", leader: { id: "a", nickname: "Anna" }, previous: { id: "c", nickname: "Carla" }, points: 1 },
    ];
    const lines = directShow({ events, templates: lib, history: empty(), config: DEFAULT_DIRECTOR_CONFIG, nowMs: 0, seed: "q2" });
    expect(lines).toHaveLength(2);
    expect(lines[0].event).toBe("LEADER_CHANGED");
    expect(lines[1].event).toBe("ALL_WRONG"); // il sorpasso nomina di nuovo Anna: saltato
    expect(lines[0].who).not.toBe(lines[1].who);
  });

  it("rispetta cooldown, limite di menzioni e disattivazione", () => {
    const e: ShowEvent = { type: "OVERTAKE", who: { id: "a", nickname: "Anna" }, overtaken: { id: "b", nickname: "Bruno" } };
    const h = empty();
    h.lastUsed.set("p2", 1000);
    h.lastUsed.set("x1", 1000);
    expect(directShow({ events: [e], templates: lib, history: h, config: DEFAULT_DIRECTOR_CONFIG, nowMs: 5000, seed: "s" })).toHaveLength(0);
    const h2 = empty();
    h2.mentionsThisRound.set("a", 3);
    expect(directShow({ events: [e], templates: lib, history: h2, config: DEFAULT_DIRECTOR_CONFIG, nowMs: 0, seed: "s" })).toHaveLength(0);
    expect(directShow({ events: [e], templates: lib, history: empty(), config: { ...DEFAULT_DIRECTOR_CONFIG, enabled: false }, nowMs: 0, seed: "s" })).toHaveLength(0);
  });

  it("stesso seme, stessa scelta (TV che ricarica = stesse frasi)", () => {
    const e: ShowEvent = { type: "OVERTAKE", who: { id: "a", nickname: "Anna" }, overtaken: { id: "b", nickname: "Bruno" } };
    const a = directShow({ events: [e], templates: lib, history: empty(), config: DEFAULT_DIRECTOR_CONFIG, nowMs: 0, seed: "same" });
    const b = directShow({ events: [e], templates: lib, history: empty(), config: DEFAULT_DIRECTOR_CONFIG, nowMs: 0, seed: "same" });
    expect(a).toEqual(b);
  });
});

describe("battibecchi tra presentatori", () => {
  const lib = [
    T("r1", "regina", "LEADER_CHANGED", "AMOOOORE, {nome_primo}!"),
    T("p1", "palmino", "ALL_WRONG", "[laughs] Zero per tutti!"),
    T("bp1", "professore", "RETORT_REGINA", "Regina, meno paillettes, più nozioni."),
    T("bp2", "palmino", "RETORT_REGINA", "Regina, a {nome} ci penso io!"),
    T("bx1", "regina", "RETORT_REGINA", "Mi rispondo da sola."),
    T("bq1", "regina", "RETORT_PALMINO", "Palmino, un po' di contegno!"),
  ];
  const leader: ShowEvent = { type: "LEADER_CHANGED", leader: { id: "1", nickname: "Vodka" }, previous: { id: "2", nickname: "Gigi" }, points: 3000 };
  const always = { ...DEFAULT_DIRECTOR_CONFIG, banterPercent: 100 };

  it("con battibecco sempre attivo un altro presentatore risponde alla prima battuta", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const lines = directShow({ events: [leader, { type: "ALL_WRONG" }], templates: lib, history: empty(), config: always, nowMs: 0, seed });
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({ who: "regina", event: "LEADER_CHANGED" });
      expect(lines[1].event).toBe("RETORT_REGINA");
      expect(lines[1].who).not.toBe("regina"); // mai una risposta a se stessi
      expect(lines[1].mentions).toEqual([]); // il nome era già stato detto
      if (lines[1].who === "palmino") expect(lines[1].text).toBe("Regina, a Vodka ci penso io!");
    }
  });

  it("i battibecchi non partono mai da soli e rispettano maxLines, probabilità ed eventi abilitati", () => {
    // nessun evento della classifica = nessun battibecco
    expect(directShow({ events: [], templates: lib, history: empty(), config: always, nowMs: 0, seed: "x" })).toHaveLength(0);
    // una sola battuta per momento: niente spazio per rispondere
    expect(directShow({ events: [leader], templates: lib, history: empty(), config: { ...always, maxLines: 1 }, nowMs: 0, seed: "x" })).toHaveLength(1);
    // probabilità zero: si torna alla seconda battuta normale
    const never = directShow({ events: [leader, { type: "ALL_WRONG" }], templates: lib, history: empty(), config: { ...always, banterPercent: 0 }, nowMs: 0, seed: "x" });
    expect(never.map((l) => l.event)).toEqual(["LEADER_CHANGED", "ALL_WRONG"]);
    // risposte alla Regina disattivate in regia
    const off = directShow({ events: [leader], templates: lib, history: empty(), config: { ...always, events: ["LEADER_CHANGED"] }, nowMs: 0, seed: "x" });
    expect(off).toHaveLength(1);
  });

  it("senza nomi nella battuta precedente si scartano le risposte che li usano", () => {
    const palminoFirst = [T("p1", "palmino", "ALL_WRONG", "Zero per tutti!"), ...lib.filter((t) => t.event === "RETORT_PALMINO")];
    const lines = directShow({ events: [{ type: "ALL_WRONG" }], templates: palminoFirst, history: empty(), config: always, nowMs: 0, seed: "y" });
    expect(lines.map((l) => l.text)).toEqual(["Zero per tutti!", "Palmino, un po' di contegno!"]);
  });

  it("la libreria ha risposte per ogni presentatore, valide e senza \"tesori\"", async () => {
    const { default: file } = await import("../../content/show/battute.json");
    const retorts = (file.lines as { character: string; event: string; text: string }[]).filter((l) => l.event.startsWith("RETORT_"));
    for (const to of ["PROFESSORE", "REGINA", "PALMINO"]) {
      const mine = retorts.filter((l) => l.event === `RETORT_${to}`);
      expect(mine.length).toBeGreaterThanOrEqual(8);
      expect(mine.every((l) => l.character.toUpperCase() !== to)).toBe(true);
    }
    for (const l of retorts) {
      expect(validateTemplate(l as Parameters<typeof validateTemplate>[0])).toEqual([]);
      expect(l.text.toLowerCase()).not.toContain("tesor");
    }
  });
});
