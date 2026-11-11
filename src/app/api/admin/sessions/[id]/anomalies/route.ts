import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { listAnomalies } from "@/lib/server/cms/admin";

export const GET = adminRoute<{ id: string }>("operator", async ({ params }) => ok({ anomalies: await listAnomalies(params.id) }), {
  sessionParam: "id",
});
