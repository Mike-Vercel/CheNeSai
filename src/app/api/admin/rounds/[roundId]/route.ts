import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { deleteRound, updateRound } from "@/lib/server/cms/sessions";

type P = { roundId: string };

export const PATCH = adminRoute<P>("admin", async ({ req, admin, params }) => {
  await updateRound(params.roundId, await req.json(), admin);
  return ok({ ok: true });
});

export const DELETE = adminRoute<P>("admin", async ({ admin, params }) => {
  await deleteRound(params.roundId, admin);
  return ok({ ok: true });
});
