import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { CmsError } from "@/lib/server/audit";
import { addRandomQuestionsToRound, composeAndCreateSession, loadCandidates, previewQuickSession } from "@/lib/server/cms/compose";
import { createRound, createSession, getSessionDetail, publishSession } from "@/lib/server/cms/sessions";
import { cleanupSession, cmd, makeQuestion, TEST_ACTOR } from "../support/fixtures";

/**
 * Serata rapida contro il database locale, su un archivio isolato:
 * le domande di questo test hanno un tag univoco e il composer lavora solo su quelle.
 */
const sql = getSql();
const TAG = `compose-${randomUUID().slice(0, 8)}`;
const only = { onlyTag: TAG };
const CATS = ["Storia", "Geografia", "Cinema", "Musica", "Sport"];
const questionIds: string[] = [];
const created: string[] = [];

async function sessionQuestionIds(sessionId: string) {
  const d = await getSessionDetail(sql, sessionId);
  return d!.roundsDetail.flatMap((r) => r.questions.map((q) => ({ questionId: q.questionId!, isReserve: q.isReserve, roundId: r.id })));
}

async function showFirstQuestion(sessionId: string) {
  await publishSession(sessionId, TEST_ACTOR);
  await cmd(sessionId, "OPEN_LOBBY");
  await cmd(sessionId, "START_INTRO");
  await cmd(sessionId, "SKIP_INTRO");
  await cmd(sessionId, "START_ROUND");
  const r = await cmd(sessionId, "SHOW_QUESTION");
  expect(r.state.phase).toBe("QUESTION_VISIBLE");
  const [sq] = await sql<{ question_id: string }[]>`
    select question_id from session_questions where session_id = ${sessionId} and shown_at is not null`;
  return sq.question_id;
}

beforeAll(async () => {
  for (let i = 0; i < 10; i++) {
    questionIds.push(
      await makeQuestion(`Domanda composta ${TAG} n. ${i}?`, ["Uno", "Due", "Tre", "Quattro"], [i % 4], {
        category: CATS[i % CATS.length],
        difficulty: (i % 5) + 1,
        tags: ["test-automatico", TAG],
      }),
    );
  }
});

afterAll(async () => {
  for (const id of created) await cleanupSession(id);
  await sql`delete from question_bank where ${TAG} = any(tags)`;
  await sql.end();
});

describe("serata rapida (database)", () => {
  it("le domande demo e dei test automatici non entrano mai nell'archivio normale del composer", async () => {
    const normal = await loadCandidates(sql, {});
    expect(normal.some((c) => questionIds.includes(c.id))).toBe(false);
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from question_bank
      where id = any(${sql.array(normal.map((c) => c.id))}::uuid[]) and (tags && array['demo','test-automatico'])`;
    expect(n).toBe(0);
  });

  let realId: string;
  it("crea serata + round + domande in un colpo solo, con audit", async () => {
    const r = await composeAndCreateSession(sql, { title: `Rapida ${TAG}`, rounds: 2, totalQuestions: 4, reserves: 0, seed: "uno" }, TEST_ACTOR, only);
    realId = r.sessionId!;
    created.push(realId);
    expect(r.summary).toMatchObject({ requested: 4, picked: 4, missing: 0, fresh: 4, repeats: 0 });
    expect(r.pool).toMatchObject({ usable: 10, fresh: 10 });
    const d = await getSessionDetail(sql, realId);
    expect(d!.status).toBe("draft");
    expect(d!.isTest).toBe(false);
    expect(d!.roundsDetail.map((x) => [x.kind, x.questions.length])).toEqual([
      ["standard", 2],
      ["final", 2],
    ]);
    expect(d!.roundsDetail[1].pointsMultiplier).toBe(2);
    const qs = await sessionQuestionIds(realId);
    expect(new Set(qs.map((q) => q.questionId)).size).toBe(4);
    const [log] = await sql<{ n: number }[]>`
      select count(*)::int as n from admin_audit_logs where session_id = ${realId} and action = 'session.quick_create'`;
    expect(log.n).toBe(1);
  });

  it("stesso seme → stessa scelta (anteprima deterministica)", async () => {
    const a = await previewQuickSession({ rounds: 1, totalQuestions: 3, reserves: 0, seed: "fisso" }, only);
    const b = await previewQuickSession({ rounds: 1, totalQuestions: 3, reserves: 0, seed: "fisso" }, only);
    expect(a.rounds[0].questions.map((q) => q.questionId)).toEqual(b.rounds[0].questions.map((q) => q.questionId));
    expect(a.sessionId).toBeNull();
  });

  let playedId: string;
  it("registro: una domanda mostrata in una serata reale diventa «giocata»", async () => {
    playedId = await showFirstQuestion(realId);
    const plays = await sql<{ session_id: string }[]>`select session_id from question_plays where question_id = ${playedId}`;
    expect(plays.map((p) => p.session_id)).toEqual([realId]);
    const cands = await loadCandidates(sql, only);
    const c = cands.find((x) => x.id === playedId)!;
    expect(c.lastPlayedAt).not.toBeNull();
    // le altre 3 della serata non ancora mostrate risultano "prenotate"
    const planned = cands.filter((x) => x.plannedElsewhere).map((x) => x.id);
    expect(planned).toHaveLength(3);
  });

  it("la nuova serata usa prima le mai giocate; poi le giocate, poi le prenotate", async () => {
    const p6 = await previewQuickSession({ rounds: 2, totalQuestions: 6, reserves: 0, seed: "due" }, only);
    // 1 mostrata (giocata) + 3 ancora da mostrare nella serata reale (prenotate)
    expect(p6.pool).toMatchObject({ usable: 10, fresh: 6, played: 1, planned: 3 });
    expect(p6.summary).toMatchObject({ fresh: 6, repeats: 0, planned: 0 });
    // al massimo l'avviso sulla fascia di difficoltà (archivio di prova piccolo), mai ripetute
    expect(p6.warnings.join(" ")).not.toMatch(/giocat|programma|non basta/);
    const picked = p6.rounds.flatMap((r) => r.questions.map((q) => q.questionId));
    expect(picked).not.toContain(playedId);

    const p7 = await previewQuickSession({ rounds: 1, totalQuestions: 7, reserves: 0, seed: "tre" }, only);
    expect(p7.summary).toMatchObject({ fresh: 6, repeats: 1, planned: 0, missing: 0 });
    expect(p7.rounds[0].questions.map((q) => q.questionId)).toContain(playedId);
    expect(p7.warnings.join(" ")).toMatch(/già stata giocata/);

    const p8 = await previewQuickSession({ rounds: 1, totalQuestions: 8, reserves: 0, seed: "tre" }, only);
    expect(p8.summary).toMatchObject({ fresh: 6, repeats: 1, planned: 1 });
    expect(p8.warnings.join(" ")).toMatch(/altra serata in programma/);
  });

  it("archivio insufficiente: la creazione è rifiutata e non scrive nulla", async () => {
    const before = await sql<{ n: number }[]>`select count(*)::int as n from game_sessions`;
    const err = await composeAndCreateSession(sql, { title: `Troppe ${TAG}`, rounds: 2, totalQuestions: 12, seed: "x" }, TEST_ACTOR, only).catch((e) => e);
    expect(err).toBeInstanceOf(CmsError);
    expect((err as CmsError).status).toBe(422);
    const after = await sql<{ n: number }[]>`select count(*)::int as n from game_sessions`;
    expect(after[0].n).toBe(before[0].n);
  });

  it("le serate di prova non consumano le domande né le prenotano", async () => {
    const r = await composeAndCreateSession(sql, { title: `Prova ${TAG}`, rounds: 1, totalQuestions: 2, reserves: 0, isTest: true, seed: "prova" }, TEST_ACTOR, only);
    created.push(r.sessionId!);
    const shown = await showFirstQuestion(r.sessionId!);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from question_plays where question_id = ${shown}`;
    expect(n).toBe(0);
    const p = await previewQuickSession({ rounds: 1, totalQuestions: 1, reserves: 0, seed: "q" }, only);
    expect(p.pool).toMatchObject({ fresh: 6, played: 1, planned: 3 });
  });

  it("riserve della serata rapida nel primo round", async () => {
    const r = await composeAndCreateSession(sql, { title: `Riserve ${TAG}`, rounds: 1, totalQuestions: 1, reserves: 1, isTest: true, seed: "r" }, TEST_ACTOR, only);
    created.push(r.sessionId!);
    expect(r.reserves).toEqual({ requested: 1, picked: 1 });
    const qs = await sessionQuestionIds(r.sessionId!);
    expect(qs.filter((q) => q.isReserve)).toHaveLength(1);
    expect(qs.filter((q) => !q.isReserve)).toHaveLength(1);
  });

  it("«Aggiungi domande casuali»: niente doppioni nella serata, prima le mai giocate", async () => {
    const sessionId = await createSession({ title: `Casuali ${TAG}`, isTest: false, settings: {} }, TEST_ACTOR);
    created.push(sessionId);
    const roundId = await createRound(sessionId, { title: "Round casuale", kind: "standard" }, TEST_ACTOR);
    const first = await addRandomQuestionsToRound(roundId, { count: 4, seed: "a" }, TEST_ACTOR, only);
    expect(first).toMatchObject({ added: 4 });
    expect(first.summary).toMatchObject({ fresh: 4, repeats: 0 });
    const second = await addRandomQuestionsToRound(roundId, { count: 4, seed: "b" }, TEST_ACTOR, only);
    // 6 fresche in tutto, 4 già prese: 2 fresche + 1 giocata (la più vecchia) + 1 prenotata altrove
    expect(second.summary).toMatchObject({ picked: 4, fresh: 2, repeats: 1, planned: 1 });
    const qs = await sessionQuestionIds(sessionId);
    expect(qs).toHaveLength(8);
    expect(new Set(qs.map((q) => q.questionId)).size).toBe(8);
    // categoria mai uguale a quella precedente nel round
    const cats = await sql<{ category: string }[]>`
      select q.category from session_questions sq join question_bank q on q.id = sq.question_id
      where sq.round_id = ${roundId} order by sq.position`;
    for (let i = 1; i < cats.length; i++) expect(cats[i].category).not.toBe(cats[i - 1].category);
  });

});
