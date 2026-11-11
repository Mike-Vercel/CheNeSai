import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { z } from "zod";
import { addQuestionsToRound, reorderRoundQuestions } from "@/lib/server/cms/sessions";

type P = { roundId: string };

export const POST = adminRoute<P>("admin", async ({ req, admin, params }) => {
  const body = z
    .object({ questionIds: z.array(z.uuid()).min(1).max(100), voteOptionId: z.uuid().nullable().optional(), isReserve: z.boolean().optional() })
    .parse(await req.json());
  await addQuestionsToRound(params.roundId, body.questionIds, { voteOptionId: body.voteOptionId ?? null, isReserve: body.isReserve }, admin);
  return ok({ ok: true }, { status: 201 });
});

/** Riordino / spostamento: lista completa degli id nel nuovo ordine. */
export const PUT = adminRoute<P>("admin", async ({ req, admin, params }) => {
  const { order } = z.object({ order: z.array(z.uuid()).max(200) }).parse(await req.json());
  await reorderRoundQuestions(params.roundId, order, admin);
  return ok({ ok: true });
});
