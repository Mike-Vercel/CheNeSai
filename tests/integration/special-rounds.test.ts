import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { buildPublicState } from "@/lib/server/public-state";
import { authenticatePlayer, getPlayerSelf, joinSession, PlayerError, submitAnswer, submitBet, type PlayerAuth } from "@/lib/server/players";
import { addQuestionsToRound, createRound, createSession, getSessionDetail, publishSession, scheduleEvent } from "@/lib/server/cms/sessions";
import { CmsError } from "@/lib/server/audit";
import { GameError, type BetTier, type QuestionRules } from "@/lib/game-engine/types";
import { cleanupSession, cmd, makeQuestion, TEST_ACTOR } from "../support/fixtures";

// Questi test rispondono subito dopo SHOW_OPTIONS: niente attesa per la lettura delle risposte.
process.env.QZ_OPTIONS_READ_DELAY = "0";

const sql = getSql();
let sessionId = "";
let code = "";
const sq: Record<string, string> = {};
const players: Record<string, PlayerAuth> = {};

async function answer(name: string, sqId: string, positions: number[]) {
  return submitAnswer(players[name], { sessionQuestionId: sqId, positions, requestId: randomUUID() }, "10.0.0.2");
}
async function bet(name: string, sqId: string, tier: BetTier, requestId = randomUUID()) {
  return submitBet(players[name], { sessionQuestionId: sqId, tier, requestId }, "10.0.0.2");
}
async function points(name: string) {
  return (await getPlayerSelf(sql, players[name])).points;
}
async function expectPlayerError(p: Promise<unknown>, c: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof PlayerError && e.code === c);
}
async function expectGameError(p: Promise<unknown>, c: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof GameError && e.code === c);
}
async function playQuestion(answers: Record<string, number[]>, sqId: string) {
  await cmd(sessionId, "SHOW_OPTIONS");
  for (const [name, pos] of Object.entries(answers)) await answer(name, sqId, pos);
  await cmd(sessionId, "CLOSE_ANSWERS");
  await cmd(sessionId, "REVEAL");
  return cmd(sessionId, "SCORE");
}

beforeAll(async () => {
  const q1 = await makeQuestion("Riscaldamento: capitale della Francia?", ["Parigi", "Lione", "Nizza", "Lille"], [0]);
  const b1 = await makeQuestion("Scommessa: quanti continenti ci sono?", ["5", "6", "7", "8"], [2]);
  const b2 = await makeQuestion("Scommessa: di che colore è il cielo sereno?", ["Verde", "Azzurro", "Rosso", "Giallo"], [1]);
  const c1 = await makeQuestion("Ribaltone: quante gambe ha un tavolo classico?", ["2", "3", "4", "5"], [2]);
  sessionId = await createSession({ title: `Manche speciali ${randomUUID().slice(0, 8)}`, isTest: false, settings: {} }, TEST_ACTOR);
  const r1 = await createRound(sessionId, { title: "Riscaldamento", kind: "standard", speedBonusMax: 0 }, TEST_ACTOR);
  await addQuestionsToRound(r1, [q1], {}, TEST_ACTOR);
  const rb = await createRound(sessionId, { title: "Scommetti tutto", kind: "bet", betMinStake: 500, betDefaultTier: 0, speedBonusMax: 500 }, TEST_ACTOR);
  await addQuestionsToRound(rb, [b1, b2], {}, TEST_ACTOR);
  const rc = await createRound(sessionId, { title: "Grande ribaltone", kind: "comeback", comebackMultiplier: 2, comebackLeaderPenalty: 2, speedBonusMax: 0 }, TEST_ACTOR);
  await addQuestionsToRound(rc, [c1], {}, TEST_ACTOR);
  const detail = await getSessionDetail(sql, sessionId);
  const names: Record<string, string> = { [q1]: "q1", [b1]: "b1", [b2]: "b2", [c1]: "c1" };
  for (const r of detail!.roundsDetail) for (const q of r.questions) sq[names[q.questionId!]] = q.id;
  // niente eventi programmati nella manche Scommetti tutto
  await expect(scheduleEvent(sessionId, { definitionKey: "double-points", targetSessionQuestionId: sq.b1 }, TEST_ACTOR)).rejects.toBeInstanceOf(CmsError);
  const bet = detail!.roundsDetail.find((r) => r.kind === "bet")!;
  expect(bet).toMatchObject({ betMinStake: 500, betDefaultTier: 0 });
  expect(detail!.roundsDetail.find((r) => r.kind === "comeback")).toMatchObject({ comebackMultiplier: 2, comebackLeaderPenalty: 2 });
  await publishSession(sessionId, TEST_ACTOR);
  code = detail!.code;
});

afterAll(async () => {
  if (sessionId) await cleanupSession(sessionId);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
});

describe("manche speciali (server-authoritative)", () => {
  it("riscaldamento: punteggi diversi per i quattro giocatori", async () => {
    await cmd(sessionId, "OPEN_LOBBY");
    for (const n of ["Anna", "Bruno", "Carla", "Dario"]) {
      const r = await joinSession({ code, nickname: n }, { ip: "10.0.0.2", deviceToken: null });
      players[n.toLowerCase()] = await authenticatePlayer(sql, code, r.participantToken);
    }
    await cmd(sessionId, "START_ROUND");
    await cmd(sessionId, "SHOW_QUESTION");
    await playQuestion({ anna: [0], bruno: [0], carla: [1] }, sq.q1);
    expect([await points("anna"), await points("bruno"), await points("carla"), await points("dario")]).toEqual([1000, 1000, -400, 0]);
  });

  it("Scommetti tutto: presentazione del round con le regole", async () => {
    const r = await cmd(sessionId, "START_ROUND");
    expect(r.state.round?.kind).toBe("bet");
    expect(r.state.round?.special).toEqual({ kind: "bet", minStake: 500, defaultTier: 0 });
  });

  it("puntate durante la domanda: posta calcolata sui punti del server, una sola per giocatore", async () => {
    const q = await cmd(sessionId, "SHOW_QUESTION");
    expect(q.state.question?.rules.special).toEqual({ kind: "bet", minStake: 500, defaultTier: 0 });
    expect(q.state.question?.rules.speedBonusMax).toBe(0);
    expect(q.state.question?.bets).toMatchObject({ placed: 0, locked: false, distribution: null });

    const reqId = randomUUID();
    const a = await bet("anna", sq.b1, 100, reqId);
    expect(a).toMatchObject({ status: "recorded", tier: 100, stake: 1000, points: 1000 });
    // stessa richiesta ripetuta (rete instabile): idempotente
    expect((await bet("anna", sq.b1, 100, reqId)).status).toBe("duplicate");
    // cambiare idea dopo la conferma non è possibile
    await expectPlayerError(bet("anna", sq.b1, 25), "ALREADY_BET");
    // 25% di 1000 = 250 → puntata minima 500
    expect((await bet("bruno", sq.b1, 25)).stake).toBe(500);
    // in negativo si punta la puntata minima
    expect((await bet("carla", sq.b1, 50)).stake).toBe(500);
    // puntata su una domanda non attiva
    await expectPlayerError(bet("dario", sq.b2, 100), "WRONG_QUESTION");
    // non si risponde prima delle risposte
    await expectPlayerError(answer("anna", sq.b1, [2]), "NOT_OPEN");

    const st = await buildPublicState(sql, sessionId);
    expect(st?.question?.bets).toMatchObject({ placed: 3, locked: false, distribution: null, totalStake: null });
    // nessuna posta individuale nello stato pubblico prima della chiusura
    expect(JSON.stringify(st?.question?.bets)).not.toContain("1000");
    const me = await getPlayerSelf(sql, players.anna);
    expect(me.currentBet).toMatchObject({ sessionQuestionId: sq.b1, tier: 100, stake: 1000, locked: false, isDefault: false });
  });

  it("MOSTRA RISPOSTE chiude le puntate: posta ricalcolata e quota predefinita a chi non ha scelto", async () => {
    // rettifica della regia prima della chiusura: la posta segue i punti veri
    await cmd(sessionId, "ADJUST_SCORE", { participantId: players.anna.participantId, delta: 200, reason: "Bonus simpatia" });
    const o = await cmd(sessionId, "SHOW_OPTIONS");
    expect(o.state.question?.bets?.locked).toBe(true);
    expect(o.state.question?.bets?.distribution).toEqual([
      { tier: 0, count: 1 },
      { tier: 25, count: 1 },
      { tier: 50, count: 1 },
      { tier: 100, count: 1 },
    ]);
    expect(o.state.question?.bets?.totalStake).toBe(1200 + 500 + 500);
    const rows = await sql<{ participant_id: string; tier: number; stake: number; is_default: boolean; locked: boolean }[]>`
      select participant_id, tier, stake, is_default, locked_at is not null as locked from bets where session_question_id = ${sq.b1}`;
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.locked)).toBe(true);
    expect(rows.find((r) => r.participant_id === players.anna.participantId)?.stake).toBe(1200);
    expect(rows.find((r) => r.participant_id === players.dario.participantId)).toMatchObject({ tier: 0, stake: 0, is_default: true });
    // puntate chiuse
    await expectPlayerError(bet("dario", sq.b1, 100), "TOO_LATE");
    const [late] = await sql<{ c: number }[]>`select count(*)::int as c from security_events where session_id = ${sessionId} and kind = 'late_bet'`;
    expect(late.c).toBeGreaterThan(0);
    expect((await getPlayerSelf(sql, players.anna)).currentBet).toMatchObject({ stake: 1200, locked: true });
  });

  it("punteggio: giusta +posta, sbagliata −posta, senza posta nessuna variazione", async () => {
    await answer("anna", sq.b1, [2]);
    await answer("bruno", sq.b1, [0]);
    await answer("carla", sq.b1, [2]);
    await answer("dario", sq.b1, [2]);
    await cmd(sessionId, "CLOSE_ANSWERS");
    await cmd(sessionId, "REVEAL");
    const s = await cmd(sessionId, "SCORE");
    expect([await points("anna"), await points("bruno"), await points("carla"), await points("dario")]).toEqual([2400, 500, 100, 0]);
    const evs = await sql<{ participant_id: string; delta: number; reason: string; details: { bet: { tier: number; stake: number; default: boolean } | null; speedBonus: number } }[]>`
      select participant_id, delta, reason, details from score_events where session_question_id = ${sq.b1}`;
    const anna = evs.find((e) => e.participant_id === players.anna.participantId)!;
    expect(anna).toMatchObject({ delta: 1200, reason: "Scommessa vinta: +1200" });
    expect(anna.details.bet).toEqual({ tier: 100, stake: 1200, default: false });
    expect(anna.details.speedBonus).toBe(0);
    expect(evs.find((e) => e.participant_id === players.dario.participantId)?.details.bet).toEqual({ tier: 0, stake: 0, default: true });
    // TV: grandi vincite e grandi perdite
    expect(s.state.question?.bets?.wins?.map((w) => [w.nickname, w.tier, w.delta])).toEqual([
      ["Anna", 100, 1200],
      ["Carla", 50, 500],
    ]);
    expect(s.state.question?.bets?.losses?.map((w) => [w.nickname, w.delta])).toEqual([["Bruno", -500]]);
    const me = await getPlayerSelf(sql, players.bruno);
    expect(me.currentResult).toMatchObject({ isCorrect: false, partial: false, delta: -500 });
  });

  it("niente eventi speciali nella manche; nessuna risposta = scommessa persa", async () => {
    await expectGameError(cmd(sessionId, "ACTIVATE_EVENT", { definitionKey: "double-points" }), "EVENT_NOT_ALLOWED");
    await cmd(sessionId, "SHOW_QUESTION");
    expect((await bet("bruno", sq.b2, 100)).stake).toBe(500);
    await playQuestion({ anna: [1] }, sq.b2);
    // Bruno ha puntato tutto e non ha risposto; Anna ha risposto giusto senza puntare
    expect(await points("bruno")).toBe(0);
    expect(await points("anna")).toBe(2400);
  });

  it("Grande ribaltone: BOOST a chi insegue e penalità al capolista, congelati a MOSTRA RISPOSTE", async () => {
    const r = await cmd(sessionId, "START_ROUND");
    expect(r.state.round?.special).toEqual({ kind: "comeback", boostMultiplier: 2, leaderPenaltyMultiplier: 2 });
    // classifica: Anna 2400, Carla 100, Bruno 0, Dario 0 → metà bassa: Bruno e Dario
    const q = await cmd(sessionId, "SHOW_QUESTION");
    const sp = q.state.question?.rules.special;
    expect(sp?.kind).toBe("comeback");
    if (sp?.kind !== "comeback") throw new Error("regole speciali mancanti");
    expect(sp.boosted.map((b) => b.nickname)).toEqual(["Bruno", "Dario"]);
    expect(sp.leaders.map((b) => b.nickname)).toEqual(["Anna"]);
    await cmd(sessionId, "SHOW_OPTIONS");
    const [frozen] = await sql<{ rules: QuestionRules }[]>`select rules from session_questions where id = ${sq.c1}`;
    expect(frozen.rules.special?.kind).toBe("comeback");
    // una rettifica dopo l'apertura non cambia più chi ha il boost
    await cmd(sessionId, "ADJUST_SCORE", { participantId: players.dario.participantId, delta: 5000, reason: "Prova congelamento" });
    const st = await buildPublicState(sql, sessionId);
    const sp2 = st?.question?.rules.special;
    expect(sp2?.kind === "comeback" && sp2.boosted.map((b) => b.nickname)).toEqual(["Bruno", "Dario"]);
    await answer("anna", sq.c1, [0]);
    await answer("bruno", sq.c1, [2]);
    await answer("carla", sq.c1, [2]);
    await answer("dario", sq.c1, [2]);
    await cmd(sessionId, "CLOSE_ANSWERS");
    await cmd(sessionId, "REVEAL");
    await cmd(sessionId, "SCORE");
    // Anna −400×2, Bruno +1000×2, Carla +1000 (nessun boost), Dario +1000×2 (sopra i 5000 della rettifica)
    expect([await points("anna"), await points("bruno"), await points("carla"), await points("dario")]).toEqual([1600, 2000, 1100, 7000]);
    const evs = await sql<{ participant_id: string; reason: string; details: { comeback?: string } }[]>`
      select participant_id, reason, details from score_events where session_question_id = ${sq.c1}`;
    expect(evs.find((e) => e.participant_id === players.bruno.participantId)?.details.comeback).toBe("boosted");
    expect(evs.find((e) => e.participant_id === players.anna.participantId)?.reason).toContain("penalità capolista ×2");
    expect(evs.find((e) => e.participant_id === players.carla.participantId)?.details.comeback).toBeUndefined();
  });
});
