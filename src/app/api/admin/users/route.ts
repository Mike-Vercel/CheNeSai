import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { createAdmin, listAdmins } from "@/lib/server/cms/admin";

export const GET = adminRoute("super_admin", async () => ok({ users: await listAdmins() }));
export const POST = adminRoute("super_admin", async ({ req, admin }) =>
  ok({ userId: await createAdmin(await req.json(), admin) }, { status: 201 }),
);
