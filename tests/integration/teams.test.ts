import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { buildPublicState } from "@/lib/server/public-state";
import { authenticatePlayer, joinSession, submitAnswer, PlayerError, type PlayerAuth } from "@/lib/server/players";
import { importLibrary, loadDirectorConfig, readLibraryFile } from "@/lib/server/show";
import { createTeam, deleteTeam, listTeams } from "@/lib/server/cms/teams";
import { updateSession, validateForPublish } from "@/lib/server/cms/sessions";
import { chooseTeam } from "@/lib/server/teams";
import { buildPublishedSession, cleanupSession, cmd, TEST_ACTOR, type Fixture } from "../support/fixtures";

// rispondono subito dopo SHOW_OPTIONS
process.env.QZ_OPTIONS_READ_DELAY = "0";

const sql = getSql();
let fx: Fixture;
let leoni: string;
let squali: string;
let insertedTemplates: string[] = [];
const players: Record<string, PlayerAuth> = {};
const NAMES = ["Vodka", "Gigi Bomba", "Lalla", "Tano"];

async function join(nickname: string) {
  const r = await joinSession({ code: fx.code, nickname }, { ip: "10.0.0.7", deviceToken: null });
  players[nickname] = await authenticatePlayer(sql, fx.code, r.participantToken);
}
const answer = (name: string, sqId: string, positions: number[]) =>
  submitAnswer(players[name], { sessionQuestionId: sqId, positions, requestId: randomUUID() }, "10.0.0.7");

async function playQuestion(sqId: string, picks: Record<string, number[]>) {
  await cmd(fx.sessionId, "SHOW_QUESTION");
  await cmd(fx.sessionId, "SHOW_OPTIONS");
  for (const [name, pos] of Object.entries(picks)) await answer(name, sqId, pos);
  await cmd(fx.sessionId, "CLOSE_ANSWERS");
  await cmd(fx.sessionId, "REVEAL");
  return cmd(fx.sessionId, "SCORE");
}

beforeAll(async () => {
  // battute di squadra nel database condiviso (solo quelle che mancano: rimosse alla fine)
  const before = new Set((await sql<{ id: string }[]>`select id from dialogue_templates`).map((r) => r.id));
  await importLibrary(sql);
  insertedTemplates = readLibraryFile()
    .map((l) => l.id)
    .filter((id) => !before.has(id));
  fx = await buildPublishedSession({ isTest: true });
});

afterAll(async () => {
  await cleanupSession(fx.sessionId);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  if (insertedTemplates.length > 0) await sql`delete from dialogue_templates where id = any(${sql.array(insertedTemplates)}::text[])`;
  await sql.end();
});

describe("modalità squadre: partita breve", () => {
  it("la modalità squadre richiede almeno 2 squadre", async () => {
    await expect(updateSession(fx.sessionId, { settings: { teams: { mode: "teams", selfSelect: false, aggregation: "sum" } } }, TEST_ACTOR)).rejects.toThrow(/squadre/);
    leoni = await createTeam(fx.sessionId, { name: "I Leoni" }, TEST_ACTOR);
    await expect(createTeam(fx.sessionId, { name: "i leoni" }, TEST_ACTOR)).rejects.toThrow(/già una squadra/);
    squali = await createTeam(fx.sessionId, { name: "Gli Squali" }, TEST_ACTOR);
    await updateSession(fx.sessionId, { settings: { teams: { mode: "teams", selfSelect: false, aggregation: "sum" } } }, TEST_ACTOR);
    const teams = await listTeams(sql, fx.sessionId);
    expect(teams.map((t) => t.name)).toEqual(["I Leoni", "Gli Squali"]);
    expect(teams[0].color).not.toBe(teams[1].color);
    // a serata pubblicata e a squadre non si scende sotto le 2 squadre
    await expect(deleteTeam(fx.sessionId, squali, TEST_ACTOR)).rejects.toThrow(/almeno 2/);
    expect(await validateForPublish(sql, fx.sessionId)).not.toContainEqual(expect.objectContaining({ message: expect.stringMatching(/squadre/) }));
  });

  it("lobby: la regia assegna, il telefono sceglie solo se consentito", async () => {
    await cmd(fx.sessionId, "OPEN_LOBBY");
    for (const n of NAMES) await join(n);
    let st = await buildPublicState(sql, fx.sessionId);
    expect(st?.teams?.mode).toBe("teams");
    expect(st?.teams?.list.map((t) => t.members)).toEqual([0, 0]);
    expect(st?.teamLeaderboard).toBeNull();

    // scelta dal telefono non consentita: le squadre le assegna la regia
    await expect(chooseTeam(players.Vodka, leoni)).rejects.toBeInstanceOf(PlayerError);
    await cmd(fx.sessionId, "ASSIGN_TEAM", { participantId: players.Vodka.participantId, teamId: leoni });
    await cmd(fx.sessionId, "ASSIGN_TEAM", { participantId: players["Gigi Bomba"].participantId, teamId: leoni });
    // squadra di un'altra serata: rifiutata dal server
    await expect(cmd(fx.sessionId, "ASSIGN_TEAM", { participantId: players.Lalla.participantId, teamId: randomUUID() })).rejects.toThrow(/Squadra non trovata/);

    // ora i giocatori possono scegliere: Lalla sceglie gli Squali, gli altri li sistema "bilancia"
    await updateSession(fx.sessionId, { settings: { teams: { mode: "teams", selfSelect: true, aggregation: "sum" } } }, TEST_ACTOR);
    const chosen = await chooseTeam(players.Lalla, squali);
    expect(chosen.name).toBe("Gli Squali");
    const bal = await cmd(fx.sessionId, "BALANCE_TEAMS", { onlyUnassigned: true });
    expect(bal.result).toMatchObject({ moved: 1 });
    st = await buildPublicState(sql, fx.sessionId);
    expect(st?.teams?.list.map((t) => t.members)).toEqual([2, 2]);
    const tano = await sql<{ team_id: string }[]>`select team_id from participants where id = ${players.Tano.participantId}`;
    expect(tano[0].team_id).toBe(squali);
  });

  it("SCORE: classifica a squadre dai punti ufficiali, mai attribuita a un giocatore", async () => {
    await cmd(fx.sessionId, "START_ROUND");
    // a partita iniziata chi ha già una squadra non la cambia più
    await expect(chooseTeam(players.Lalla, leoni)).rejects.toThrow(/non si può più cambiare/);

    // q1 (Tirana = 0): Leoni entrambi giusti, Squali entrambi sbagliati
    await playQuestion(fx.sessionQuestions.q1, { Vodka: [0], "Gigi Bomba": [0], Lalla: [1], Tano: [2] });
    const st = await buildPublicState(sql, fx.sessionId);
    expect(st?.phase).toBe("SCORE_REVEAL");
    const lb = st!.leaderboard!;
    const pts = (n: string) => lb.find((e) => e.nickname === n)!.points;
    const board = st!.teamLeaderboard!;
    expect(board.map((t) => t.name)).toEqual(["I Leoni", "Gli Squali"]);
    expect(board[0]).toMatchObject({ rank: 1, members: 2, points: pts("Vodka") + pts("Gigi Bomba") });
    expect(board[1]).toMatchObject({ rank: 2, members: 2, points: pts("Lalla") + pts("Tano") });
    expect(board[0].lastDelta).toBe(lb.filter((e) => ["Vodka", "Gigi Bomba"].includes(e.nickname)).reduce((a, e) => a + e.lastDelta, 0));
    // la classifica a squadre non contiene dati personali
    const json = JSON.stringify(board);
    for (const n of NAMES) expect(json).not.toContain(n);
    for (const p of Object.values(players)) expect(json).not.toContain(p.participantId);
  });

  it("media dei punti e posizioni salvate (frecce di movimento)", async () => {
    await updateSession(fx.sessionId, { settings: { teams: { mode: "both", selfSelect: true, aggregation: "average" } } }, TEST_ACTOR);
    const st = await buildPublicState(sql, fx.sessionId);
    const lb = st!.leaderboard!;
    const pts = (n: string) => lb.find((e) => e.nickname === n)!.points;
    expect(st?.teams?.mode).toBe("both");
    expect(st!.teamLeaderboard![0].points).toBe(Math.round((pts("Vodka") + pts("Gigi Bomba")) / 2));
    const saved = await sql<{ name: string; rank: number | null }[]>`select name, rank from teams where session_id = ${fx.sessionId} order by name`;
    expect(saved).toEqual([
      { name: "Gli Squali", rank: 2 },
      { name: "I Leoni", rank: 1 },
    ]);
    await updateSession(fx.sessionId, { settings: { teams: { mode: "teams", selfSelect: true, aggregation: "sum" } } }, TEST_ACTOR);
  });

  it("fine round: battute di squadra con i nomi delle squadre, nessun nome di giocatore", async () => {
    // q2 (multipla: Marte + Venere) e q3 (56 = 1): ora vincono gli Squali
    await playQuestion(fx.sessionQuestions.q2, { Vodka: [1], "Gigi Bomba": [3], Lalla: [0, 2], Tano: [0, 2] });
    await playQuestion(fx.sessionQuestions.q3, { Vodka: [0], "Gigi Bomba": [2], Lalla: [1], Tano: [1] });
    const st = await buildPublicState(sql, fx.sessionId);
    const board = st!.teamLeaderboard!;
    expect(board[0].name).toBe("Gli Squali");
    expect(board[0].previousRank).toBe(2);

    const config = await loadDirectorConfig(sql);
    const teamEventsOn = config.enabled && config.maxLines > 0 && (config.events.length === 0 || config.events.includes("TEAM_ROUND_WINNER"));
    const lines = st?.showLines ?? [];
    const teamLines = lines.filter((l) => l.event === "TEAM_ROUND_WINNER" || l.event === "TEAM_LEADER_CHANGED");
    if (teamEventsOn) {
      // la vittoria del round è della squadra (in modalità "teams" niente ROUND_WINNER individuale)
      expect(lines[0].event).toBe("TEAM_ROUND_WINNER");
      expect(lines.some((l) => l.event === "ROUND_WINNER")).toBe(false);
      expect(teamLines[0].text).toContain("Gli Squali");
    }
    for (const l of teamLines) {
      expect(l.text).not.toMatch(/\{[a-z_]+\}/);
      for (const n of NAMES) expect(l.text).not.toContain(n);
    }
    // le battute di squadra non registrano menzioni di giocatori
    const log = await sql<{ n: number }[]>`
      select count(*)::int as n from show_dialogue_log
      where session_id = ${fx.sessionId} and event_type like 'TEAM_%' and cardinality(participant_ids) > 0`;
    expect(log[0].n).toBe(0);
  });

  it("classifica e podio a squadre nelle stesse fasi della classifica individuale", async () => {
    await cmd(fx.sessionId, "SHOW_LEADERBOARD");
    let st = await buildPublicState(sql, fx.sessionId);
    expect(st?.leaderboard).not.toBeNull();
    expect(st?.teamLeaderboard?.length).toBe(2);
    const fin = await cmd(fx.sessionId, "FINISH");
    expect(fin.result).toMatchObject({ teams: [expect.objectContaining({ name: "Gli Squali", rank: 1 }), expect.objectContaining({ name: "I Leoni", rank: 2 })] });
    st = await buildPublicState(sql, fx.sessionId);
    expect(st?.phase).toBe("FINISHED");
    expect(st?.teamLeaderboard?.[0].name).toBe("Gli Squali");
    // a serata conclusa le squadre non si toccano più
    await expect(createTeam(fx.sessionId, { name: "Ritardatari" }, TEST_ACTOR)).rejects.toThrow(/conclusa/);
  });
});
