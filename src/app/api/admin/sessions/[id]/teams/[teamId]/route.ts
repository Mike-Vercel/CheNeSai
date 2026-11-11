import { z } from "zod";
import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { deleteTeam, updateTeam } from "@/lib/server/cms/teams";

type P = { id: string; teamId: string };
const ids = z.object({ id: z.uuid(), teamId: z.uuid() });

export const PATCH = adminRoute<P>("admin", async ({ req, admin, params }) => {
  const p = ids.parse(params);
  await updateTeam(p.id, p.teamId, await req.json(), admin);
  return ok({ ok: true });
});

export const DELETE = adminRoute<P>("admin", async ({ admin, params }) => {
  const p = ids.parse(params);
  await deleteTeam(p.id, p.teamId, admin);
  return ok({ ok: true });
});
