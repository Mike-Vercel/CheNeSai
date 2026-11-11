import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/database/db";
import { createQuestion, confirmAnswer } from "@/lib/server/cms/questions";
import {
  addQuestionsToRound,
  createRound,
  createSession,
  getSessionDetail,
  publishSession,
} from "@/lib/server/cms/sessions";
import { executeCommand, type Actor } from "@/lib/server/engine";
import type { GameCommand } from "@/lib/game-engine/types";
import type { CommandInput } from "@/lib/validation/schemas";

export const TEST_ACTOR: Actor = { userId: null, email: "test@quizzone.local", ip: "127.0.0.1" };

export async function makeQuestion(
  text: string,
  answers: [string, string, string, string],
  correct: number[],
  extra: Record<string, unknown> = {},
): Promise<string> {
  const q = await createQuestion(
    {
      type: correct.length > 1 ? "multiple" : "single",
      text,
      category: (extra.category as string) ?? "Test",
      difficulty: 2,
      tags: ["test-automatico"],
      presenter: "professore",
      options: answers.map((a, i) => ({ text: a, isCorrect: correct.includes(i) })),
      status: "draft",
      answerConfirmed: false,
      ...extra,
    },
    TEST_ACTOR,
  );
  await confirmAnswer(q.id, true, TEST_ACTOR);
  return q.id;
}

export interface Fixture {
  sessionId: string;
  code: string;
  rounds: { standardId: string; voteId: string; finalId: string };
  voteOptions: { id: string; label: string }[];
  sessionQuestions: Record<string, string>;
}

/**
 * Sessione completa: round standard (singola, multipla, breve), round con
 * votazione (2 categorie), round finale; una domanda di riserva.
 */
export async function buildPublishedSession(opts: { isTest?: boolean; title?: string } = {}): Promise<Fixture> {
  const q1 = await makeQuestion("Qual è la capitale dell'Albania?", ["Tirana", "Durazzo", "Valona", "Scutari"], [0], { category: "Geografia" });
  const q2 = await makeQuestion("Quali di questi sono pianeti?", ["Marte", "Luna", "Venere", "Sole"], [0, 2], { category: "Scienza" });
  const q3 = await makeQuestion("Quanto fa 7 x 8?", ["54", "56", "58", "64"], [1], { durationSeconds: 3 });
  const qc1 = await makeQuestion("Chi ha diretto 'La vita è bella'?", ["Benigni", "Tornatore", "Fellini", "Sorrentino"], [0], { category: "Cinema" });
  const qm1 = await makeQuestion("Chi canta 'Volare'?", ["Modugno", "Celentano", "Morandi", "Battisti"], [0], { category: "Musica" });
  const qr = await makeQuestion("Domanda misteriosa: quante zampe ha un ragno?", ["6", "8", "10", "12"], [1]);
  const qf = await makeQuestion("Finalissima: in che anno è caduto il muro di Berlino?", ["1987", "1989", "1991", "1993"], [1]);

  const sessionId = await createSession(
    { title: opts.title ?? `Test ${randomUUID().slice(0, 8)}`, isTest: opts.isTest ?? true, settings: {} },
    TEST_ACTOR,
  );
  // punti esatti nei test: bonus velocità spento (di default è attivo)
  const standardId = await createRound(sessionId, { title: "Cultura generale", kind: "standard", speedBonusMax: 0 }, TEST_ACTOR);
  await addQuestionsToRound(standardId, [q1, q2, q3], {}, TEST_ACTOR);
  await addQuestionsToRound(standardId, [qr], { isReserve: true }, TEST_ACTOR);
  const voteId = await createRound(
    sessionId,
    { title: "Decidete voi!", kind: "category_vote", presenter: "palmino", voteOptions: ["CINEMA", "MUSICA"], voteDurationSeconds: 5, voteTieBreak: "first", speedBonusMax: 0 },
    TEST_ACTOR,
  );
  let detail = await getSessionDetail(getSql(), sessionId);
  const vr = detail!.roundsDetail.find((r) => r.id === voteId)!;
  await addQuestionsToRound(voteId, [qc1], { voteOptionId: vr.voteOptions[0].id }, TEST_ACTOR);
  await addQuestionsToRound(voteId, [qm1], { voteOptionId: vr.voteOptions[1].id }, TEST_ACTOR);
  const finalId = await createRound(sessionId, { title: "Finale", kind: "final", pointsMultiplier: 2, speedBonusMax: 0 }, TEST_ACTOR);
  await addQuestionsToRound(finalId, [qf], {}, TEST_ACTOR);
  await publishSession(sessionId, TEST_ACTOR);

  detail = await getSessionDetail(getSql(), sessionId);
  const sessionQuestions: Record<string, string> = {};
  for (const r of detail!.roundsDetail) for (const q of r.questions) sessionQuestions[q.questionId!] = q.id;
  const map = { [q1]: "q1", [q2]: "q2", [q3]: "q3", [qc1]: "cinema", [qm1]: "musica", [qr]: "reserve", [qf]: "final" };
  const named: Record<string, string> = {};
  for (const [qid, sqid] of Object.entries(sessionQuestions)) named[map[qid]] = sqid;
  return {
    sessionId,
    code: detail!.code,
    rounds: { standardId, voteId, finalId },
    voteOptions: vr.voteOptions.map((o) => ({ id: o.id, label: o.label })),
    sessionQuestions: named,
  };
}

export function cmd(sessionId: string, command: GameCommand, args: CommandInput["args"] = {}) {
  return executeCommand(sessionId, TEST_ACTOR, { command, commandId: randomUUID(), args });
}

export async function cleanupSession(sessionId: string) {
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`select set_config('qz.allow_reset', 'on', true)`;
    await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
    await tx`delete from game_sessions where id = ${sessionId}`;
  });
}
