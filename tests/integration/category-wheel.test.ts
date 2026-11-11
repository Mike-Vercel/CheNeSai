import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { buildPublicState } from "@/lib/server/public-state";
import { addQuestionsToRound, createRound, createSession, getSessionDetail, publishSession, validateForPublish } from "@/lib/server/cms/sessions";
import { authenticatePlayer, joinSession, submitAnswer } from "@/lib/server/players";
import { GameError } from "@/lib/game-engine/types";
import { segmentAtPointer, wheelRotationAt, WHEEL_LEAD_MS } from "@/lib/game-engine/wheel";
import { cleanupSession, cmd, makeQuestion, TEST_ACTOR } from "../support/fixtures";

process.env.QZ_OPTIONS_READ_DELAY = "0";

const sql = getSql();
const created: string[] = [];
const LABELS = ["CINEMA", "MUSICA", "SPORT"];
let sessionId = "";
let code = "";
let wheelRoundId = "";
/** id opzione → id domande di sessione assegnate */
const byOption = new Map<string, string[]>();

async function expectGameError(p: Promise<unknown>, codeName: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof GameError && e.code === codeName);
}

beforeAll(async () => {
  sessionId = await createSession({ title: `Ruota ${randomUUID().slice(0, 8)}`, isTest: true, settings: {} }, TEST_ACTOR);
  created.push(sessionId);
  wheelRoundId = await createRound(
    sessionId,
    { title: "Ruota impazzita", kind: "category_wheel", presenter: "palmino", voteOptions: LABELS, speedBonusMax: 0 },
    TEST_ACTOR,
  );
  const detail = await getSessionDetail(sql, sessionId);
  const round = detail!.roundsDetail.find((r) => r.id === wheelRoundId)!;
  expect(round.voteOptions.map((o) => o.label)).toEqual(LABELS);
  // due domande per categoria, ma all'inizio la terza categoria resta vuota (la pubblicazione deve rifiutare)
  for (const o of round.voteOptions.slice(0, 2)) {
    const ids = [
      await makeQuestion(`Ruota ${o.label} 1?`, ["a", "b", "c", "d"], [0], { category: o.label }),
      await makeQuestion(`Ruota ${o.label} 2?`, ["e", "f", "g", "h"], [1], { category: o.label }),
    ];
    await addQuestionsToRound(wheelRoundId, ids, { voteOptionId: o.id }, TEST_ACTOR);
  }
});

afterAll(async () => {
  for (const id of created) await cleanupSession(id);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
});

describe("Ruota impazzita (round category_wheel, server-authoritative)", () => {
  it("il CMS valida le categorie: massimo 8, domande assegnate, ogni spicchio con domande", async () => {
    await expect(
      createRound(sessionId, { title: "Troppi spicchi", kind: "category_wheel", voteOptions: ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8", "i9"] }, TEST_ACTOR),
    ).rejects.toThrow(/Round non valido/);
    const q = await makeQuestion("Ruota senza categoria?", ["a", "b", "c", "d"], [0]);
    await expect(addQuestionsToRound(wheelRoundId, [q], {}, TEST_ACTOR)).rejects.toThrow(/ruota/);
    const issues = await validateForPublish(sql, sessionId);
    expect(issues.some((i) => i.level === "error" && i.message.includes('"SPORT" non ha domande'))).toBe(true);

    const detail = await getSessionDetail(sql, sessionId);
    const sport = detail!.roundsDetail.find((r) => r.id === wheelRoundId)!.voteOptions[2];
    const ids = [
      await makeQuestion("Ruota SPORT 1?", ["a", "b", "c", "d"], [0], { category: "SPORT" }),
      await makeQuestion("Ruota SPORT 2?", ["e", "f", "g", "h"], [1], { category: "SPORT" }),
    ];
    await addQuestionsToRound(wheelRoundId, ids, { voteOptionId: sport.id }, TEST_ACTOR);
    expect((await validateForPublish(sql, sessionId)).filter((i) => i.level === "error")).toEqual([]);
    await publishSession(sessionId, TEST_ACTOR);

    const pub = await getSessionDetail(sql, sessionId);
    code = pub!.code;
    for (const q2 of pub!.roundsDetail.find((r) => r.id === wheelRoundId)!.questions) {
      if (!q2.voteOptionId) continue;
      byOption.set(q2.voteOptionId, [...(byOption.get(q2.voteOptionId) ?? []), q2.id]);
    }
    expect([...byOption.values()].map((v) => v.length)).toEqual([2, 2, 2]);
  });

  it("presentazione: la ruota ferma con gli spicchi, niente domande prima del giro", async () => {
    await cmd(sessionId, "OPEN_LOBBY");
    const r = await cmd(sessionId, "START_ROUND");
    expect(r.state.phase).toBe("ROUND_INTRO");
    expect(r.state.round?.kind).toBe("category_wheel");
    expect(r.state.wheel?.segments.map((s) => s.label)).toEqual(LABELS);
    expect(r.state.wheel?.spin).toBeNull();
    expect(r.state.vote).toBeNull();
    await expectGameError(cmd(sessionId, "SHOW_QUESTION"), "INVALID_TRANSITION");
    await expectGameError(cmd(sessionId, "START_VOTE"), "INVALID_TRANSITION");
  });

  it("GIRA LA RUOTA: il server estrae, salva e pubblica un piano che arriva sul vincitore", async () => {
    const before = Date.now();
    const r = await cmd(sessionId, "SPIN_WHEEL");
    expect(r.state.phase).toBe("WHEEL_SPIN");
    const [row] = await sql<{ winning_option_id: string; wheel_spun_at: Date; wheel_spin: Record<string, unknown> }[]>`
      select winning_option_id, wheel_spun_at, wheel_spin from game_rounds where id = ${wheelRoundId}`;
    expect(row.winning_option_id).toBeTruthy();
    expect(row.wheel_spin.winnerOptionId).toBe(row.winning_option_id);
    // la partenza è di poco nel futuro: tutti i TV ricevono lo stato prima che la ruota parta
    expect(row.wheel_spun_at.getTime()).toBeGreaterThan(before + WHEEL_LEAD_MS / 2);

    const spin = r.state.wheel!.spin!;
    const segments = r.state.wheel!.segments;
    expect(segments[spin.winnerIndex].id).toBe(row.winning_option_id);
    expect(spin.winnerOptionId).toBe(row.winning_option_id);
    expect(spin.frozenElapsedMs).toBeNull();
    // ogni TV calcola lo stesso arrivo dagli stessi numeri
    expect(segmentAtPointer(wheelRotationAt(spin, spin.durationMs), segments.length)).toBe(spin.winnerIndex);
    // nel totale domande conta solo la categoria estratta
    expect(r.state.totalQuestions).toBe(2);
    // il giro non si ripete
    await expectGameError(cmd(sessionId, "SPIN_WHEEL"), "INVALID_TRANSITION");
  });

  it("finché la ruota gira il server non va avanti (salvo conferma esplicita)", async () => {
    await expectGameError(cmd(sessionId, "SHOW_QUESTION"), "WHEEL_SPINNING");
    await expectGameError(cmd(sessionId, "SHOW_LEADERBOARD"), "WHEEL_SPINNING");
  });

  it("pausa: la ruota resta ferma e alla ripresa riparte da dove era", async () => {
    const before = (await buildPublicState(sql, sessionId))!.wheel!.spin!;
    const p = await cmd(sessionId, "PAUSE");
    expect(p.state.phase).toBe("PAUSED");
    expect(p.state.wheel?.spin?.frozenElapsedMs).not.toBeNull();
    await new Promise((res) => setTimeout(res, 120));
    const r = await cmd(sessionId, "RESUME");
    expect(r.state.phase).toBe("WHEEL_SPIN");
    const after = r.state.wheel!.spin!;
    expect(after.frozenElapsedMs).toBeNull();
    expect(Date.parse(after.startedAt) - Date.parse(before.startedAt)).toBeGreaterThanOrEqual(100);
    expect(after.winnerIndex).toBe(before.winnerIndex);
    expect(after.rotationDeg).toBe(before.rotationDeg);
  });

  it("le domande arrivano SOLO dalla categoria estratta", async () => {
    const [{ winning_option_id: winner }] = await sql<{ winning_option_id: string }[]>`select winning_option_id from game_rounds where id = ${wheelRoundId}`;
    const expected = byOption.get(winner)!;
    const shown: string[] = [];
    const nick = `Ruota${randomUUID().slice(0, 4)}`;
    const j = await joinSession({ code, nickname: nick }, { ip: "10.0.0.9", deviceToken: null });
    const player = await authenticatePlayer(sql, code, j.participantToken);

    for (let i = 0; i < expected.length; i++) {
      const s = await cmd(sessionId, "SHOW_QUESTION", i === 0 ? { force: true } : {});
      expect(s.state.phase).toBe("QUESTION_VISIBLE");
      const qid = s.state.question!.id;
      shown.push(qid);
      expect(s.state.question!.totalInRound).toBe(2);
      await cmd(sessionId, "SHOW_OPTIONS");
      await submitAnswer(player, { sessionQuestionId: qid, positions: [0], requestId: randomUUID() }, "10.0.0.9");
      await cmd(sessionId, "REVEAL", { force: true });
      await cmd(sessionId, "SCORE");
    }
    expect([...shown].sort()).toEqual([...expected].sort());
    await expectGameError(cmd(sessionId, "SHOW_QUESTION"), "NO_MORE_QUESTIONS");
    const others = await sql<{ c: number }[]>`
      select count(*)::int as c from session_questions
      where round_id = ${wheelRoundId} and shown_at is not null and vote_option_id <> ${winner}`;
    expect(others[0].c).toBe(0);
  });

  it("il reset della prova azzera anche la ruota", async () => {
    await cmd(sessionId, "RESET_TEST");
    const [row] = await sql<{ winning_option_id: string | null; wheel_spun_at: Date | null; wheel_spin: unknown }[]>`
      select winning_option_id, wheel_spun_at, wheel_spin from game_rounds where id = ${wheelRoundId}`;
    expect(row).toEqual({ winning_option_id: null, wheel_spun_at: null, wheel_spin: null });
  });
});
