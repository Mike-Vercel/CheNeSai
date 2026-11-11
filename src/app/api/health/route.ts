import { getSql } from "@/lib/database/db";
import { ok } from "@/lib/http";

/** Health check: database raggiungibile e orologio del server. */
export async function GET() {
  const started = Date.now();
  try {
    const [r] = await getSql()<{ now: Date }[]>`select clock_timestamp() as now`;
    return ok({ status: "ok", db: "ok", dbLatencyMs: Date.now() - started, serverNow: r.now.toISOString() });
  } catch {
    return ok({ status: "degraded", db: "unreachable" }, { status: 503 });
  }
}
