import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { buildPublicState } from "@/lib/server/public-state";
import { authenticatePlayer, joinSession, submitAnswer, type PlayerAuth } from "@/lib/server/players";
import { directLobbyGreeting, importLibrary } from "@/lib/server/show";
import { buildPublishedSession, cleanupSession, cmd, type Fixture } from "../support/fixtures";

// rispondono subito dopo SHOW_OPTIONS
process.env.QZ_OPTIONS_READ_DELAY = "0";

const sql = getSql();
let fx: Fixture;
const players: Record<string, PlayerAuth> = {};

async function join(nickname: string) {
  const r = await joinSession({ code: fx.code, nickname }, { ip: "10.0.0.7", deviceToken: null });
  players[nickname] = await authenticatePlayer(sql, fx.code, r.participantToken);
}
/** Ingressi "di qualche secondo fa" (il saluto aspetta che chi entra insieme sia entrato). */
const backdateJoins = () => sql`update participants set joined_at = joined_at - interval '10 seconds' where session_id = ${fx.sessionId}`;
/** Ultimo saluto "di mezzo minuto fa" (cooldown scaduto). */
const backdateGreetings = () =>
  sql`update show_dialogue_log set created_at = created_at - interval '30 seconds' where session_id = ${fx.sessionId} and event_type = 'PLAYERS_JOINED'`;
const answer = (name: string, sqId: string, positions: number[]) => submitAnswer(players[name], { sessionQuestionId: sqId, positions, requestId: randomUUID() }, "10.0.0.7");

beforeAll(async () => {
  await importLibrary(sql);
  fx = await buildPublishedSession({ isTest: true });
  await cmd(fx.sessionId, "OPEN_LOBBY");
});

afterAll(async () => {
  await cleanupSession(fx.sessionId);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
});

describe("momenti dei presentatori: saluti in lobby e inizio della finale", () => {
  it("in lobby salutano per nome i nuovi arrivati, a gruppi e senza ripetersi", async () => {
    await join("Vodka");
    await join("Gigi");
    // appena entrati: si aspetta ancora un attimo
    expect(await directLobbyGreeting(sql, fx.sessionId)).toBeNull();
    await backdateJoins();
    const first = await directLobbyGreeting(sql, fx.sessionId);
    expect(first?.event).toBe("PLAYERS_JOINED");
    expect(first?.text).toContain("Vodka e Gigi");
    expect(first?.text).not.toMatch(/\{[a-z_]+\}/);

    const st = await buildPublicState(sql, fx.sessionId);
    expect(st?.showLines).toEqual([expect.objectContaining({ id: first?.id, text: first?.text })]);

    // cooldown: nessun altro saluto subito dopo, anche con un nuovo arrivato
    await join("Lalla");
    await backdateJoins();
    expect(await directLobbyGreeting(sql, fx.sessionId)).toBeNull();

    // scaduto il cooldown: solo il nuovo arrivato
    await backdateGreetings();
    const second = await directLobbyGreeting(sql, fx.sessionId);
    expect(second?.text).toContain("Lalla");
    expect(second?.text).not.toContain("Vodka");
    expect(second?.text).not.toContain("Gigi");

    // nessun nuovo arrivato: silenzio
    await backdateGreetings();
    expect(await directLobbyGreeting(sql, fx.sessionId)).toBeNull();
  });

  it("fuori dalla lobby nessun saluto; un round normale non ha battute di inizio", async () => {
    await cmd(fx.sessionId, "START_ROUND");
    await join("Tano"); // ingresso tardivo
    await backdateJoins();
    await backdateGreetings();
    expect(await directLobbyGreeting(sql, fx.sessionId)).toBeNull();
    const st = await buildPublicState(sql, fx.sessionId);
    expect(st?.phase).toBe("ROUND_INTRO");
    expect(st?.showLines ?? []).toEqual([]);
  });

  it("all'inizio della finale un presentatore nomina primo e secondo veri", async () => {
    await cmd(fx.sessionId, "SHOW_QUESTION");
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    await answer("Vodka", fx.sessionQuestions.q1, [0]); // giusta
    await answer("Gigi", fx.sessionQuestions.q1, [1]);
    await answer("Lalla", fx.sessionQuestions.q1, [2]);
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await cmd(fx.sessionId, "REVEAL");
    await cmd(fx.sessionId, "SCORE");

    const r = await cmd(fx.sessionId, "START_ROUND", { roundId: fx.rounds.finalId });
    expect(r.result?.showLines).toBe(1);
    const st = await buildPublicState(sql, fx.sessionId);
    expect(st?.phase).toBe("ROUND_INTRO");
    const [line] = st?.showLines ?? [];
    expect(line?.event).toBe("FINAL_ROUND_START");
    const [top, second] = st?.leaderboard ?? (await sql<{ nickname: string }[]>`
      select p.nickname from score_totals t join participants p on p.id = t.participant_id
      where t.session_id = ${fx.sessionId} and p.status = 'active' order by t.rank nulls last, t.points desc`);
    expect(top.nickname).toBe("Vodka");
    expect(line.text).toContain("Vodka");
    expect(line.text).toContain(second.nickname);
    expect(line.text).not.toMatch(/\{[a-z_]+\}/);

    // la battuta vale solo per la presentazione della finale
    await cmd(fx.sessionId, "SHOW_QUESTION");
    expect((await buildPublicState(sql, fx.sessionId))?.showLines).toBeNull();
  });
});
