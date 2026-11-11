import { ok, route } from "@/lib/http";
import { aggregatedLeaderboard, monthRange } from "@/lib/server/cms/admin";

/** Classifica mensile pubblica (solo nickname e punti). */
export const GET = route(async (req: Request) => {
  const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const data = await aggregatedLeaderboard(monthRange(month));
  return ok({ month, ...data, standings: data.standings.slice(0, 50) });
});
