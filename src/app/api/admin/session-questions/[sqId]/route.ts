import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { z } from "zod";
import { removeSessionQuestion, updateSessionQuestion } from "@/lib/server/cms/sessions";

type P = { sqId: string };

export const PATCH = adminRoute<P>("admin", async ({ req, admin, params }) => {
  const body = z.object({ voteOptionId: z.uuid().nullable().optional(), isReserve: z.boolean().optional() }).parse(await req.json());
  await updateSessionQuestion(params.sqId, body, admin);
  return ok({ ok: true });
});

export const DELETE = adminRoute<P>("admin", async ({ admin, params }) => {
  await removeSessionQuestion(params.sqId, admin);
  return ok({ ok: true });
});
