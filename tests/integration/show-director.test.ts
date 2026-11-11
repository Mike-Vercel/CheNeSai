import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { buildPublicState } from "@/lib/server/public-state";
import { authenticatePlayer, joinSession, submitAnswer, type PlayerAuth } from "@/lib/server/players";
import { importLibrary } from "@/lib/server/show";
import { buildPublishedSession, cleanupSession, cmd, type Fixture } from "../support/fixtures";

// rispondono subito dopo SHOW_OPTIONS
process.env.QZ_OPTIONS_READ_DELAY = "0";

const sql = getSql();
let fx: Fixture;
const players: Record<string, PlayerAuth> = {};
const NAMES = ["Vodka", "Gigi Bomba", "Lalla", "Tano"];

async function join(nickname: string) {
  const r = await joinSession({ code: fx.code, nickname }, { ip: "10.0.0.9", deviceToken: null });
  players[nickname] = await authenticatePlayer(sql, fx.code, r.participantToken);
}
const answer = (name: string, sqId: string, positions: number[]) => submitAnswer(players[name], { sessionQuestionId: sqId, positions, requestId: randomUUID() }, "10.0.0.9");

beforeAll(async () => {
  await importLibrary(sql); // libreria delle battute (se il database di test non l'ha ancora)
  fx = await buildPublishedSession({ isTest: true });
  await cmd(fx.sessionId, "OPEN_LOBBY");
  for (const n of NAMES) await join(n);
  await cmd(fx.sessionId, "START_ROUND");
});

afterAll(async () => {
  await cleanupSession(fx.sessionId);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
});

describe("regista automatico: battute con i nomi veri dagli eventi reali", () => {
  it("dopo i punti i presentatori nominano chi ha davvero fatto qualcosa", async () => {
    await cmd(fx.sessionId, "SHOW_QUESTION");
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    // solo Vodka risponde giusto (Tirana), gli altri sbagliano
    await answer("Vodka", fx.sessionQuestions.q1, [0]);
    await answer("Gigi Bomba", fx.sessionQuestions.q1, [1]);
    await answer("Lalla", fx.sessionQuestions.q1, [2]);
    await answer("Tano", fx.sessionQuestions.q1, [3]);
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await cmd(fx.sessionId, "REVEAL");
    const r = await cmd(fx.sessionId, "SCORE");
    expect(r.result?.showLines).toBeGreaterThan(0);

    const st = await buildPublicState(sql, fx.sessionId);
    const lines = st?.showLines ?? [];
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(2);
    // nessun segnaposto rimasto e nessun nome inventato: chi viene nominato ha davvero risposto giusto (unico)
    for (const l of lines) expect(l.text).not.toMatch(/\{[a-z_]+\}/);
    const named = NAMES.filter((n) => lines.some((l) => l.text.includes(n)));
    expect(named).toEqual(["Vodka"]);
    expect(lines.map((l) => l.event)).toEqual(expect.arrayContaining(["ONLY_ONE_CORRECT"]));

    // registrate per cooldown e limiti di menzioni
    // (la reazione alla soluzione della libreria ufficiale ha il suo momento: si contano solo quelle dei punti)
    const log = await sql<{ n: number }[]>`
      select count(*)::int as n from show_dialogue_log
      where session_id = ${fx.sessionId} and event_type <> all(${sql.array(["ANSWER_WRONG", "EASY_WRONG", "ANSWER_CORRECT", "LOSE_PATIENCE", "TIME_RUNNING_OUT"])}::text[])`;
    expect(log[0].n).toBe(lines.length);
  });

  it("le battute valgono solo per il momento dei punti", async () => {
    await cmd(fx.sessionId, "SHOW_QUESTION");
    const st = await buildPublicState(sql, fx.sessionId);
    expect(st?.showLines).toBeNull();
  });
});
