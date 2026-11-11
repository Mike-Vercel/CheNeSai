import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";

export const GET = adminRoute("operator", async ({ admin }) =>
  ok({ userId: admin.userId, email: admin.email, displayName: admin.displayName, role: admin.role }),
);
