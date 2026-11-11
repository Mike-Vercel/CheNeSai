import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { fail } from "@/lib/http";
import { getAdminLiveState } from "@/lib/server/admin-live";

export const GET = adminRoute<{ id: string }>(
  "operator",
  async ({ params }) => {
    const live = await getAdminLiveState(params.id);
    return live ? ok(live) : fail(409, "NOT_READY", "Sessione non pubblicata");
  },
  { sessionParam: "id" },
);
