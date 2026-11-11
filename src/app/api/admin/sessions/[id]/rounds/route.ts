import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { z } from "zod";
import { createRound, reorderRounds } from "@/lib/server/cms/sessions";

type P = { id: string };

export const POST = adminRoute<P>("admin", async ({ req, admin, params }) =>
  ok({ id: await createRound(params.id, await req.json(), admin) }, { status: 201 }),
);

export const PUT = adminRoute<P>("admin", async ({ req, admin, params }) => {
  const { order } = z.object({ order: z.array(z.uuid()).max(100) }).parse(await req.json());
  await reorderRounds(params.id, order, admin);
  return ok({ ok: true });
});
