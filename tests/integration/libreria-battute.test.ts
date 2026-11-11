import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { buildPublicState } from "@/lib/server/public-state";
import { authenticatePlayer, joinSession, submitAnswer, type PlayerAuth } from "@/lib/server/players";
import { importAllLibraries } from "@/lib/server/show";
import { speechFor } from "@/features/game/script";
import { buildPublishedSession, cleanupSession, cmd, type Fixture } from "../support/fixtures";

// rispondono subito dopo SHOW_OPTIONS
process.env.QZ_OPTIONS_READ_DELAY = "0";

const sql = getSql();
let fx: Fixture;
const players: Record<string, PlayerAuth> = {};
const NAMES = ["Vodka", "Gigi Bomba", "Lalla", "Tano"];
const REVEAL_EVENTS = ["ANSWER_WRONG", "EASY_WRONG", "ANSWER_CORRECT", "LOSE_PATIENCE"];

async function join(nickname: string) {
  const r = await joinSession({ code: fx.code, nickname }, { ip: "10.0.0.10", deviceToken: null });
  players[nickname] = await authenticatePlayer(sql, fx.code, r.participantToken);
}
const answer = (name: string, sqId: string, positions: number[]) => submitAnswer(players[name], { sessionQuestionId: sqId, positions, requestId: randomUUID() }, "10.0.0.10");
const streakOf = async (name: string) => (await sql<{ n: number }[]>`select no_answer_streak as n from participants where id = ${players[name].participantId}`)[0].n;
const setSeen = (name: string, agoSec: number) => sql`update participants set last_seen_at = now() - make_interval(secs => ${agoSec}) where id = ${players[name].participantId}`;

beforeAll(async () => {
  await importAllLibraries(sql); // libreria iniziale + libreria ufficiale (se mancano)
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

describe("libreria ufficiale in una partita vera", () => {
  it("alla soluzione: reazione all'esito vero, con il testo dell'utente da mostrare e la voce saltabile", async () => {
    await cmd(fx.sessionId, "SHOW_QUESTION");
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    // tutti sbagliano, Tano non risponde e ha il telefono spento da 5 minuti (disconnesso)
    await answer("Vodka", fx.sessionQuestions.q1, [1]);
    await answer("Gigi Bomba", fx.sessionQuestions.q1, [2]);
    await answer("Lalla", fx.sessionQuestions.q1, [3]);
    await setSeen("Tano", 300);
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await cmd(fx.sessionId, "REVEAL");
    const st = await buildPublicState(sql, fx.sessionId);
    const lines = st?.showLines ?? [];
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(REVEAL_EVENTS).toContain(l.event);
      expect(l.optional).toBe(true);
      expect(l.display).toBeTruthy();
      expect(l.text).not.toMatch(/\{[a-z_]+\}/);
      // reazione senza nomi: frase fissa, pre-generabile
      expect(l.live).toBe(false);
    }
    // nessuno ha indovinato: mai "indovinato"
    expect(lines.some((l) => l.event === "ANSWER_CORRECT")).toBe(false);
    // il copione del TV la dice al posto della battuta di sempre
    const said = speechFor(st!, { phase: "ANSWERS_LOCKED" }, { readOptions: false });
    expect(said.some((l) => l.text === lines[0].text && l.optional)).toBe(true);
  });

  it("chi è disconnesso non viene mai preso in giro e il suo contatore riparte da zero", async () => {
    await cmd(fx.sessionId, "SCORE");
    const st = await buildPublicState(sql, fx.sessionId);
    for (const l of st?.showLines ?? []) {
      expect(l.text).not.toContain("Tano");
      expect(["PLAYER_NO_ANSWER", "NO_ANSWER_LEADER", "NO_ANSWER_LAST", "NO_ANSWER_STREAK"]).not.toContain(l.event);
    }
    expect(await streakOf("Tano")).toBe(0);
    expect(await streakOf("Vodka")).toBe(0);
  });

  it("contatore delle mancate risposte: +1 da collegato, torna a 0 quando risponde", async () => {
    await cmd(fx.sessionId, "SHOW_QUESTION");
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    await setSeen("Tano", 0);
    await answer("Vodka", fx.sessionQuestions.q2, [0, 2]);
    await answer("Gigi Bomba", fx.sessionQuestions.q2, [0, 2]);
    await answer("Lalla", fx.sessionQuestions.q2, [1]);
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await cmd(fx.sessionId, "REVEAL");
    await cmd(fx.sessionId, "SCORE");
    expect(await streakOf("Tano")).toBe(1);
    // al massimo una battuta (o una scenetta) sulle mancate risposte, e se c'è nomina Tano
    const st = await buildPublicState(sql, fx.sessionId);
    const silence = (st?.showLines ?? []).filter((l) => /NO_ANSWER/.test(l.event));
    expect(new Set(silence.map((l) => l.group ?? l.id)).size).toBeLessThanOrEqual(1);
    for (const l of silence.filter((x) => x.event !== "MANY_NO_ANSWER")) {
      if (/\bTano\b/.test(l.display ?? "")) expect(l.text).toContain("Tano");
    }

    await cmd(fx.sessionId, "SHOW_QUESTION");
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    for (const n of NAMES) await answer(n, fx.sessionQuestions.q3, [1]);
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await cmd(fx.sessionId, "REVEAL");
    await cmd(fx.sessionId, "SCORE");
    expect(await streakOf("Tano")).toBe(0);
  });

  it("il vincitore della serata solo al podio (mai prima), con il nome vero", async () => {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from show_dialogue_log where session_id = ${fx.sessionId} and event_type = 'GAME_WINNER'`;
    expect(n).toBe(0);
    await cmd(fx.sessionId, "FINISH");
    const st = await buildPublicState(sql, fx.sessionId);
    const lines = st?.showLines ?? [];
    for (const l of lines) expect(["GAME_WINNER", "GAME_END"]).toContain(l.event);
    const top = (st?.leaderboard ?? []).filter((e) => e.rank === 1);
    const winner = lines.filter((l) => l.event === "GAME_WINNER");
    if (top.length === 1) expect(winner.every((l) => l.text.includes(top[0].nickname))).toBe(true);
    else expect(winner).toHaveLength(0);
  });
});
