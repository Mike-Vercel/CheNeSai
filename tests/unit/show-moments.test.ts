import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { directShow, placeholderValues, validateTemplate, type DirectorHistory } from "@/lib/show/director";
import { DEFAULT_LOBBY_GREETING, finalRoundStartEvent, lobbyGreetingEvent, showLinesForPhase, type LobbyPlayer } from "@/lib/show/moments";
import { DEFAULT_DIRECTOR_CONFIG, SHOW_EVENT_TYPES, type DialogueTemplate, type ShowEvent } from "@/lib/show/types";

const NOW = 1_000_000;
const P = (id: string, nickname: string, agoMs: number): LobbyPlayer => ({ id, nickname, joinedAtMs: NOW - agoMs });
const greet = (players: LobbyPlayer[], extra: Partial<Parameters<typeof lobbyGreetingEvent>[0]> = {}) =>
  lobbyGreetingEvent({ players, greetedIds: new Set(), lastGreetingMs: null, greetingsSoFar: 0, nowMs: NOW, ...extra });

describe("lobby: saluti ai nuovi arrivati", () => {
  it("saluta a gruppi, nell'ordine di arrivo", () => {
    const e = greet([P("b", "Gigi", 8000), P("a", "Vodka", 9000), P("c", "Lalla", 6000)]);
    expect(e?.named.map((p) => p.nickname)).toEqual(["Vodka", "Gigi", "Lalla"]);
    expect(e?.others).toBe(0);
    expect(placeholderValues(e!)).toEqual({ nomi: "Vodka, Gigi e Lalla" });
  });

  it("aspetta qualche secondo dopo l'ultimo ingresso (chi arriva insieme viene salutato insieme)", () => {
    expect(greet([P("a", "Vodka", 9000), P("b", "Gigi", 1000)])).toBeNull();
    // ma chi aspetta da più di un cooldown viene salutato comunque (ingressi continui)
    const e = greet([P("a", "Vodka", DEFAULT_LOBBY_GREETING.cooldownMs + 1000), P("b", "Gigi", 1000)]);
    expect(e?.greeted.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("rispetta il cooldown e non ripete mai un nome", () => {
    const players = [P("a", "Vodka", 60_000), P("b", "Gigi", 50_000)];
    expect(greet(players, { lastGreetingMs: NOW - 10_000 })).toBeNull();
    const e = greet(players, { lastGreetingMs: NOW - 30_000, greetedIds: new Set(["a"]) });
    expect(e?.named.map((p) => p.id)).toEqual(["b"]);
    expect(greet(players, { greetedIds: new Set(["a", "b"]) })).toBeNull();
  });

  it("al massimo 4 nomi per battuta, gli altri contati", () => {
    const players = ["Anna", "Bruno", "Carla", "Dario", "Elio", "Fede", "Gina"].map((n, i) => P(n.toLowerCase(), n, 20_000 - i * 1000));
    const e = greet(players)!;
    expect(e.named).toHaveLength(3);
    expect(e.others).toBe(4);
    expect(e.greeted).toHaveLength(7); // tutti risultano salutati: nessuno verrà nominato dopo
    expect(placeholderValues(e).nomi).toBe("Anna, Bruno, Carla e altri 4");
    const five = greet(players.slice(0, 5))!;
    expect(placeholderValues(five).nomi).toBe("Anna, Bruno, Carla e altri 2");
    expect(placeholderValues(greet(players.slice(0, 4))!).nomi).toBe("Anna, Bruno, Carla e Dario");
  });

  it("tetto di saluti per serata (costo della voce)", () => {
    expect(greet([P("a", "Vodka", 9000)], { greetingsSoFar: DEFAULT_LOBBY_GREETING.maxGreetings })).toBeNull();
  });

  it("i nomi vengono ripuliti: un nickname non diventa mai un audio tag", () => {
    const e = greet([P("a", "[laughs] Gigi", 9000), P("b", "Lalla", 8000)])!;
    expect(placeholderValues(e).nomi).toBe("(laughs) Gigi e Lalla");
  });
});

describe("inizio della finale", () => {
  it("nomina primo e secondo della classifica ufficiale", () => {
    const e = finalRoundStartEvent([
      { id: "c", nickname: "Carla", points: 800, rank: 3 },
      { id: "a", nickname: "Anna", points: 2000, rank: 1 },
      { id: "b", nickname: "Bruno", points: 1500, rank: 2 },
    ]);
    expect(e).toMatchObject({ leader: { id: "a" }, runnerUp: { id: "b" }, gap: 500 });
    expect(placeholderValues(e!)).toEqual({ nome_primo: "Anna", nome_secondo: "Bruno" });
  });

  it("niente battuta senza un primo con punti o senza un inseguitore", () => {
    expect(finalRoundStartEvent([{ id: "a", nickname: "Anna", points: 2000, rank: 1 }])).toBeNull();
    expect(
      finalRoundStartEvent([
        { id: "a", nickname: "Anna", points: 0, rank: 1 },
        { id: "b", nickname: "Bruno", points: 0, rank: 1 },
      ]),
    ).toBeNull();
  });
});

const T = (id: string, character: DialogueTemplate["character"], event: DialogueTemplate["event"], text: string, cooldownSec = 120): DialogueTemplate => ({
  id,
  character,
  event,
  text,
  tone: "comico",
  intensity: 2,
  priority: 40,
  weight: 1,
  cooldownSec,
  animation: "wave",
  enabled: true,
});
const empty = (): DirectorHistory => ({ lastUsed: new Map(), mentionsThisRound: new Map() });

describe("nuovi eventi con le stesse regole del regista", () => {
  const lib = [
    T("j1", "regina", "PLAYERS_JOINED", "AMOOOORE! Che entrata, {nomi}!"),
    T("j2", "palmino", "PLAYERS_JOINED", "MIIII, ciao {nomi}!"),
    T("f1", "professore", "FINAL_ROUND_START", "In testa {nome_primo}, insegue {nome_secondo}."),
  ];

  it("segnaposto ammessi solo per il loro evento", () => {
    expect(validateTemplate({ event: "PLAYERS_JOINED", text: "Ciao {nomi}!" })).toHaveLength(0);
    expect(validateTemplate({ event: "PLAYERS_JOINED", text: "Ciao {nome_primo}!" })).not.toHaveLength(0);
    expect(validateTemplate({ event: "FINAL_ROUND_START", text: "{nome_primo} e {nome_secondo}" })).toHaveLength(0);
    expect(validateTemplate({ event: "FINAL_ROUND_START", text: "{nomi}" })).not.toHaveLength(0);
  });

  it("saluto con i nomi veri, cooldown delle battute rispettato", () => {
    const e: ShowEvent = { type: "PLAYERS_JOINED", named: [{ id: "a", nickname: "Vodka" }, { id: "b", nickname: "Gigi" }], others: 0, greeted: [{ id: "a", nickname: "Vodka" }, { id: "b", nickname: "Gigi" }] };
    const [line] = directShow({ events: [e], templates: lib, history: empty(), config: { ...DEFAULT_DIRECTOR_CONFIG, maxLines: 1 }, nowMs: 0, seed: "lobby|0" });
    expect(line.text).toMatch(/Vodka e Gigi!$/);
    expect(line.mentions).toEqual(["a", "b"]);
    const h = empty();
    h.lastUsed.set("j1", 0);
    h.lastUsed.set("j2", 0);
    expect(directShow({ events: [e], templates: lib, history: h, config: DEFAULT_DIRECTOR_CONFIG, nowMs: 60_000, seed: "x" })).toHaveLength(0);
    // evento disattivato in regia
    expect(directShow({ events: [e], templates: lib, history: empty(), config: { ...DEFAULT_DIRECTOR_CONFIG, events: ["ALL_WRONG"] }, nowMs: 0, seed: "x" })).toHaveLength(0);
  });

  it("ogni battuta vale solo nel suo momento", () => {
    const lines = [
      { event: "ALL_WRONG", who: "palmino", text: "a" },
      { event: "FINAL_ROUND_START", who: "regina", text: "b" },
      { event: "PLAYERS_JOINED", who: "professore", text: "c" },
    ];
    expect(showLinesForPhase("SCORE_REVEAL", lines)?.map((l) => l.text)).toEqual(["a"]);
    expect(showLinesForPhase("ROUND_INTRO", lines)?.map((l) => l.text)).toEqual(["b"]);
    expect(showLinesForPhase("LOBBY", lines)?.map((l) => l.text)).toEqual(["c"]);
    expect(showLinesForPhase("QUESTION_VISIBLE", lines)).toBeNull();
    expect(showLinesForPhase("SCORE_REVEAL", null)).toBeNull();
  });
});

describe("libreria content/show/battute.json", () => {
  const lib = JSON.parse(readFileSync(join(process.cwd(), "content", "show", "battute.json"), "utf8")) as { lines: DialogueTemplate[] };

  it("4 battute valide per personaggio per ogni nuovo evento, nel tono dei personaggi", () => {
    for (const event of ["PLAYERS_JOINED", "FINAL_ROUND_START"] as const) {
      for (const who of ["professore", "regina", "palmino"] as const) {
        const lines = lib.lines.filter((l) => l.event === event && l.character === who);
        expect(lines, `${event}/${who}`).toHaveLength(4);
        for (const l of lines) expect(validateTemplate(l), l.id).toEqual([]);
      }
    }
    const all = lib.lines.filter((l) => l.event === "PLAYERS_JOINED" || l.event === "FINAL_ROUND_START");
    expect(all.some((l) => l.character === "regina" && l.text.includes("AMOOOORE"))).toBe(true);
    expect(all.some((l) => l.character === "palmino" && l.text.includes("MIIII"))).toBe(true);
    expect(all.filter((l) => l.event === "PLAYERS_JOINED").every((l) => l.text.includes("{nomi}"))).toBe(true);
    expect(all.filter((l) => l.event === "FINAL_ROUND_START").every((l) => l.text.includes("{nome_primo}") && l.text.includes("{nome_secondo}"))).toBe(true);
  });

  it("tutte le battute della libreria sono valide e mai con 'tesori'", () => {
    const ids = new Set<string>();
    for (const l of lib.lines) {
      expect((SHOW_EVENT_TYPES as readonly string[]).includes(l.event), l.id).toBe(true);
      expect(validateTemplate(l), l.id).toEqual([]);
      expect(l.text.toLowerCase()).not.toContain("tesor");
      expect(ids.has(l.id), `id duplicato ${l.id}`).toBe(false);
      ids.add(l.id);
    }
  });
});
