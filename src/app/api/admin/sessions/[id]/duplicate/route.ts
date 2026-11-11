import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { z } from "zod";
import { duplicateSession } from "@/lib/server/cms/sessions";

export const POST = adminRoute<{ id: string }>("admin", async ({ req, admin, params }) => {
  const body = z
    .object({ title: z.string().trim().min(3).max(120).optional(), isTest: z.boolean().optional() })
    .parse(await req.json().catch(() => ({})));
  return ok({ id: await duplicateSession(params.id, admin, body) }, { status: 201 });
});
