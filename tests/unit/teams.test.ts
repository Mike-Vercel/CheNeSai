import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aggregatePoints, balanceTeams, computeTeamStandings, type TeamDef, type TeamMemberScore } from "@/lib/game-engine/teams";
import { combineShowEvents, detectTeamEvents, eventPlayers, type ShowTeam } from "@/lib/show/events";
import { directShow, resolveTemplate, validateTemplate, type DirectorHistory } from "@/lib/show/director";
import { DEFAULT_DIRECTOR_CONFIG, type DialogueTemplate, type ShowEvent } from "@/lib/show/types";
import { standingsForShow } from "@/features/game/teams-view";

const TEAMS: TeamDef[] = [
  { id: "t-rossi", name: "Rossi", color: "#ff3d6e", position: 0 },
  { id: "t-blu", name: "Blu", color: "#2fd3ff", position: 1 },
  { id: "t-gialli", name: "Gialli", color: "#ffc83d", position: 2 },
  { id: "t-vuota", name: "Vuota", color: "#5dffab", position: 3 },
];
const M = (teamId: string | null, points: number, lastDelta = 0, correctCount = 0): TeamMemberScore => ({ teamId, points, lastDelta, correctCount });

describe("punteggio di squadra", () => {
  it("somma e media arrotondata", () => {
    expect(aggregatePoints([1000, 400, -200], "sum")).toBe(1200);
    expect(aggregatePoints([1000, 500], "average")).toBe(750);
    expect(aggregatePoints([1000, 0, 0], "average")).toBe(333);
    expect(aggregatePoints([], "sum")).toBe(0);
    expect(aggregatePoints([], "average")).toBe(0);
  });

  it("classifica a somma: le squadre senza giocatori non sono in classifica, chi è senza squadra non conta", () => {
    const st = computeTeamStandings(TEAMS, [M("t-rossi", 1000), M("t-rossi", 500), M("t-blu", 3000), M("t-gialli", 200), M(null, 99999)], "sum");
    expect(st.map((t) => [t.name, t.points, t.rank, t.members])).toEqual([
      ["Blu", 3000, 1, 1],
      ["Rossi", 1500, 2, 2],
      ["Gialli", 200, 3, 1],
    ]);
  });

  it("classifica a media: una squadra piccola non è svantaggiata", () => {
    const st = computeTeamStandings(TEAMS, [M("t-rossi", 1000), M("t-rossi", 1000), M("t-rossi", 1000), M("t-blu", 2000)], "average");
    expect(st.map((t) => [t.name, t.points])).toEqual([
      ["Blu", 2000],
      ["Rossi", 1000],
    ]);
  });

  it("pari merito: stessa posizione (1, 1, 3) e ordine stabile", () => {
    const st = computeTeamStandings(TEAMS, [M("t-gialli", 1000), M("t-rossi", 1000), M("t-blu", 400)], "sum");
    expect(st.map((t) => [t.name, t.rank])).toEqual([
      ["Rossi", 1],
      ["Gialli", 1],
      ["Blu", 3],
    ]);
  });

  it("variazione dell'ultima domanda con la stessa aggregazione", () => {
    const sum = computeTeamStandings(TEAMS, [M("t-rossi", 2000, 1000), M("t-rossi", 600, -400)], "sum");
    expect(sum[0].lastDelta).toBe(600);
    const avg = computeTeamStandings(TEAMS, [M("t-rossi", 2000, 1000), M("t-rossi", 600, -400)], "average");
    expect(avg[0]).toMatchObject({ points: 1300, lastDelta: 300 });
  });
});

describe("bilancia squadre", () => {
  const two = TEAMS.slice(0, 2);
  it("stesso numero di giocatori (±1) e punti simili", () => {
    const players = [
      { id: "a", points: 5000, teamId: null },
      { id: "b", points: 4000, teamId: null },
      { id: "c", points: 3000, teamId: null },
      { id: "d", points: 2000, teamId: null },
      { id: "e", points: 1000, teamId: null },
    ];
    const moves = balanceTeams(two, players);
    const by = new Map(moves.map((m) => [m.participantId, m.teamId]));
    const sizes = two.map((t) => players.filter((p) => by.get(p.id) === t.id).length);
    expect(Math.abs(sizes[0] - sizes[1])).toBeLessThanOrEqual(1);
    const sums = two.map((t) => players.filter((p) => by.get(p.id) === t.id).reduce((a, p) => a + p.points, 0));
    expect(Math.abs(sums[0] - sums[1])).toBeLessThanOrEqual(3000);
    // il più forte e il secondo più forte non finiscono insieme
    expect(by.get("a")).not.toBe(by.get("b"));
  });

  it("solo i senza squadra: chi ha già una squadra resta dov'è", () => {
    const players = [
      { id: "a", points: 0, teamId: "t-rossi" },
      { id: "b", points: 0, teamId: "t-rossi" },
      { id: "c", points: 0, teamId: null },
      { id: "d", points: 0, teamId: null },
    ];
    const moves = balanceTeams(two, players, { onlyUnassigned: true });
    expect(moves.map((m) => m.participantId).sort()).toEqual(["c", "d"]);
    expect(moves.every((m) => m.teamId === "t-blu")).toBe(true);
  });

  it("restituisce solo i cambi ed è deterministico", () => {
    const players = [
      { id: "a", points: 10, teamId: "t-rossi" },
      { id: "b", points: 5, teamId: "t-blu" },
    ];
    expect(balanceTeams(two, players)).toEqual([]);
    expect(balanceTeams(two, players)).toEqual(balanceTeams(two, players));
    expect(balanceTeams([], players)).toEqual([]);
  });
});

const ST = (id: string, prevPoints: number, points: number, members = 2): ShowTeam => ({ id, name: id.toUpperCase(), prevPoints, points, members });

describe("eventi delle squadre per il regista", () => {
  it("niente eventi di squadra in modalità individuale", () => {
    expect(detectTeamEvents({ mode: "individual", teams: [ST("a", 1000, 1000), ST("b", 0, 3000)], endOfRound: true })).toEqual([]);
  });

  it("nuova squadra in testa", () => {
    const ev = detectTeamEvents({ mode: "teams", teams: [ST("a", 1000, 1000), ST("b", 500, 3000), ST("c", 0, 0)], endOfRound: false });
    expect(ev).toEqual([{ type: "TEAM_LEADER_CHANGED", team: { id: "b", name: "B" }, previous: { id: "a", name: "A" }, points: 3000 }]);
  });

  it("nessun cambio se la testa è a pari merito, se prima era a pari merito o se prima erano tutti a zero", () => {
    expect(detectTeamEvents({ mode: "both", teams: [ST("a", 1000, 2000), ST("b", 500, 2000)], endOfRound: false })).toEqual([]);
    expect(detectTeamEvents({ mode: "both", teams: [ST("a", 1000, 1000), ST("b", 1000, 2000)], endOfRound: false })).toEqual([]);
    expect(detectTeamEvents({ mode: "both", teams: [ST("a", 0, 0), ST("b", 0, 1000)], endOfRound: false })).toEqual([]);
  });

  it("squadra vincitrice del round (anche a pari merito), mai con zero punti", () => {
    const one = detectTeamEvents({ mode: "teams", teams: [ST("a", 2000, 2400), ST("b", 1000, 1000)], endOfRound: true });
    expect(one).toEqual([{ type: "TEAM_ROUND_WINNER", teams: [{ id: "a", name: "A" }], points: 2400 }]);
    const tie = detectTeamEvents({ mode: "teams", teams: [ST("a", 2000, 2400), ST("b", 2400, 2400)], endOfRound: true });
    expect(tie.find((e) => e.type === "TEAM_ROUND_WINNER")).toMatchObject({ teams: [{ id: "a" }, { id: "b" }] });
    expect(detectTeamEvents({ mode: "teams", teams: [ST("a", 0, 0), ST("b", 0, -400)], endOfRound: true })).toEqual([]);
  });

  it("le squadre senza giocatori non contano; con una sola squadra non c'è gara", () => {
    expect(detectTeamEvents({ mode: "teams", teams: [ST("a", 0, 1000), ST("b", 2000, 2000, 0)], endOfRound: true })).toEqual([]);
  });

  it("modalità: in 'teams' il round lo vince la squadra, in 'both' si annunciano entrambi", () => {
    const individual: ShowEvent[] = [{ type: "ROUND_WINNER", leaders: [{ id: "p", nickname: "Pino" }], points: 3000 }, { type: "ALL_WRONG" }];
    const team: ShowEvent[] = [{ type: "TEAM_ROUND_WINNER", teams: [{ id: "a", name: "A" }], points: 5000 }];
    expect(combineShowEvents("teams", individual, team).map((e) => e.type)).toEqual(["ALL_WRONG", "TEAM_ROUND_WINNER"]);
    expect(combineShowEvents("both", individual, team).map((e) => e.type)).toEqual(["ROUND_WINNER", "ALL_WRONG", "TEAM_ROUND_WINNER"]);
    expect(combineShowEvents("individual", individual, team).map((e) => e.type)).toEqual(["ROUND_WINNER", "ALL_WRONG"]);
  });

  it("gli eventi di squadra non nominano nessun giocatore", () => {
    expect(eventPlayers({ type: "TEAM_LEADER_CHANGED", team: { id: "a", name: "A" }, previous: { id: "b", name: "B" }, points: 1 })).toEqual([]);
  });
});

const T = (id: string, character: DialogueTemplate["character"], event: DialogueTemplate["event"], text: string): DialogueTemplate => ({
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
});
const empty = (): DirectorHistory => ({ lastUsed: new Map(), mentionsThisRound: new Map() });

describe("battute di squadra", () => {
  const lib = [
    T("tl", "regina", "TEAM_LEADER_CHANGED", "AMOOOORE! {nome_squadra} supera {nome_ex_squadra}!"),
    T("tw", "palmino", "TEAM_ROUND_WINNER", "Mamma mia! Round a {nome_squadra} con {punti_squadra} punti!"),
    T("rw", "professore", "ROUND_WINNER", "Round a {nome_primo}."),
  ];

  it("segnaposto ammessi solo per gli eventi di squadra", () => {
    expect(validateTemplate({ event: "TEAM_ROUND_WINNER", text: "Vince {nome_squadra}: {punti_squadra}" })).toEqual([]);
    expect(validateTemplate({ event: "TEAM_LEADER_CHANGED", text: "{nome_squadra} e {nome_primo}" })).not.toHaveLength(0);
    expect(validateTemplate({ event: "ROUND_WINNER", text: "Vince {nome_squadra}" })).not.toHaveLength(0);
  });

  it("nomi di squadra (anche a pari merito), nessun concorrente nominato, mai la stessa squadra due volte", () => {
    const events: ShowEvent[] = [
      { type: "TEAM_ROUND_WINNER", teams: [{ id: "a", name: "Leoni" }, { id: "b", name: "Squali" }], points: 4200 },
      { type: "TEAM_LEADER_CHANGED", team: { id: "a", name: "Leoni" }, previous: { id: "c", name: "Aquile" }, points: 4200 },
    ];
    const lines = directShow({ events, templates: lib, history: empty(), config: DEFAULT_DIRECTOR_CONFIG, nowMs: 0, seed: "q" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ event: "TEAM_ROUND_WINNER", text: "Mamma mia! Round a Leoni e Squali con 4200 punti!", mentions: [] });
    const leader = resolveTemplate(lib[0], events[1]);
    expect(leader).toBe("AMOOOORE! Leoni supera Aquile!");
  });

  it("la libreria contiene 4 battute di squadra per personaggio, valide e nel tono giusto", () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "content", "show", "battute.json"), "utf8")) as { lines: DialogueTemplate[] };
    const team = raw.lines.filter((l) => l.event === "TEAM_LEADER_CHANGED" || l.event === "TEAM_ROUND_WINNER");
    for (const who of ["professore", "regina", "palmino"] as const) expect(team.filter((l) => l.character === who)).toHaveLength(4);
    for (const l of team) {
      expect(validateTemplate(l)).toEqual([]);
      expect(l.text.toLowerCase()).not.toContain("tesori");
    }
    expect(team.filter((l) => l.character === "regina").every((l) => l.text.includes("AMOOOORE"))).toBe(true);
    expect(team.filter((l) => l.character === "palmino").every((l) => l.text.includes("Mamma mia"))).toBe(true);
    expect(new Set(raw.lines.map((l) => l.id)).size).toBe(raw.lines.length);
  });
});

describe("classifica raccontata da podio e voce", () => {
  const players = [{ participantId: "p1", rank: 1, previousRank: null, nickname: "Pino", points: 3000, lastDelta: 0, correctCount: 3 }];
  const teamBoard = [{ teamId: "t1", rank: 1, previousRank: 2, name: "Leoni", color: "#ff3d6e", members: 2, points: 5000, lastDelta: 1000 }];
  const info = (mode: "teams" | "both") => ({ mode, selfSelect: false, aggregation: "sum" as const, list: [] });

  it("in modalità 'teams' si raccontano le squadre, altrimenti i giocatori", () => {
    expect(standingsForShow({ teams: info("teams"), teamLeaderboard: teamBoard, leaderboard: players }).map((e) => e.nickname)).toEqual(["Leoni"]);
    expect(standingsForShow({ teams: info("both"), teamLeaderboard: teamBoard, leaderboard: players }).map((e) => e.nickname)).toEqual(["Pino"]);
    expect(standingsForShow({ teams: null, teamLeaderboard: null, leaderboard: players }).map((e) => e.nickname)).toEqual(["Pino"]);
  });
});
