import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { getSql } from "@/lib/database/db";
import { fail } from "@/lib/http";
import { deleteQuestion, getQuestion, updateQuestion } from "@/lib/server/cms/questions";

type P = { id: string };

export const GET = adminRoute<P>("admin", async ({ params }) => {
  const q = await getQuestion(getSql(), params.id);
  return q ? ok({ question: q }) : fail(404, "NOT_FOUND", "Domanda non trovata");
});

export const PUT = adminRoute<P>("admin", async ({ req, admin, params }) =>
  ok({ question: await updateQuestion(params.id, await req.json(), admin) }),
);

export const DELETE = adminRoute<P>("admin", async ({ admin, params }) => {
  await deleteQuestion(params.id, admin);
  return ok({ ok: true });
});
