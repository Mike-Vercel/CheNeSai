import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { listAudit } from "@/lib/server/cms/admin";

export const GET = adminRoute("admin", async ({ url }) => {
  const p = url.searchParams;
  return ok({
    entries: await listAudit({
      sessionId: p.get("sessionId") || undefined,
      limit: p.get("limit") ? Number(p.get("limit")) : 100,
      before: p.get("before") ? Number(p.get("before")) : undefined,
    }),
  });
});
