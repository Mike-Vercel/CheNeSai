import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { getSql, iso } from "@/lib/database/db";
import { fail } from "@/lib/http";
import { aggregatedLeaderboard, monthRange } from "@/lib/server/cms/admin";

/** ?month=AAAA-MM oppure ?seasonId=... oppure ?from=AAAA-MM-GG&to=AAAA-MM-GG */
export const GET = adminRoute("admin", async ({ url }) => {
  const p = url.searchParams;
  const modeParam = p.get("mode");
  const mode = modeParam === "sum_points" || modeParam === "placement_points" ? modeParam : undefined;
  const seasonId = p.get("seasonId");
  if (seasonId) {
    const [s] = await getSql()<{ name: string; starts_on: Date; ends_on: Date; aggregation: "sum_points" | "placement_points" }[]>`
      select name, starts_on, ends_on, aggregation from seasons where id = ${seasonId}`;
    if (!s) return fail(404, "NOT_FOUND", "Stagione non trovata");
    const range = { from: iso(s.starts_on)!.slice(0, 10), to: iso(s.ends_on)!.slice(0, 10) };
    return ok({ title: s.name, ...range, ...(await aggregatedLeaderboard({ ...range, mode: mode ?? s.aggregation, seasonId })) });
  }
  const from = p.get("from");
  const to = p.get("to");
  if (from && to) {
    return ok({ title: "Periodo personalizzato", from, to, ...(await aggregatedLeaderboard({ from, to, mode })) });
  }
  const month = p.get("month") ?? new Date().toISOString().slice(0, 7);
  const range = monthRange(month);
  return ok({ title: "Mese " + month, ...range, ...(await aggregatedLeaderboard({ ...range, mode })) });
});
