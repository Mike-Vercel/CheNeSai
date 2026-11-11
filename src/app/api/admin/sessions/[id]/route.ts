import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { getSql } from "@/lib/database/db";
import { fail } from "@/lib/http";
import { deleteSession, getSessionDetail, updateSession } from "@/lib/server/cms/sessions";

type P = { id: string };

export const GET = adminRoute<P>(
  "operator",
  async ({ params }) => {
    const s = await getSessionDetail(getSql(), params.id);
    return s ? ok({ session: s }) : fail(404, "NOT_FOUND", "Sessione non trovata");
  },
  { sessionParam: "id" },
);

export const PATCH = adminRoute<P>("admin", async ({ req, admin, params }) => {
  await updateSession(params.id, await req.json(), admin);
  return ok({ ok: true });
});

export const DELETE = adminRoute<P>("admin", async ({ admin, params }) => {
  await deleteSession(params.id, admin);
  return ok({ ok: true });
});
