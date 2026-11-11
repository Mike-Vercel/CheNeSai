import { adminRoute } from "@/lib/admin-route";
import { getSql } from "@/lib/database/db";
import { ok } from "@/lib/http";
import { composeAndCreateSession, previewQuickSession } from "@/lib/server/cms/compose";

export const maxDuration = 30;

/**
 * Serata rapida: `{ ..., dryRun: true }` restituisce solo l'anteprima
 * (domande fresche disponibili, ripetute, avvisi) senza scrivere nulla.
 */
export const POST = adminRoute("admin", async ({ req, admin }) => {
  const raw: unknown = await req.json().catch(() => ({}));
  const { dryRun, ...options } = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (dryRun === true) return ok(await previewQuickSession(options));
  return ok(await composeAndCreateSession(getSql(), options, admin), { status: 201 });
});
