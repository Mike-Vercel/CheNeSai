import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { recentShowLines } from "@/lib/server/cms/dialogue";

type P = { id: string };

/** Ultime battute del regista automatico in questa serata. */
export const GET = adminRoute<P>("operator", async ({ params }) => ok({ lines: await recentShowLines(params.id) }), { sessionParam: "id" });
