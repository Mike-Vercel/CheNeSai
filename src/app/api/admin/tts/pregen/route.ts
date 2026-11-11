import { z } from "zod";
import { adminRoute } from "@/lib/admin-route";
import { getSql } from "@/lib/database/db";
import { ok, readJson } from "@/lib/http";
import { estimateScope, pregenScopeSchema, runScopeBatch } from "@/lib/server/tts-pregen";

// Ogni richiesta genera un piccolo lotto: il client ripete finché non manca più nulla.
export const maxDuration = 60;

const bodySchema = z.object({
  action: z.enum(["estimate", "run"]),
  scope: pregenScopeSchema,
  batch: z.number().int().min(1).max(10).optional(),
});

/**
 * POST { action: "estimate", scope } → battute pronte/mancanti e caratteri stimati (nessuna spesa)
 * POST { action: "run", scope, batch } → genera fino a `batch` battute mancanti e restituisce l'avanzamento
 */
export const POST = adminRoute("admin", async ({ req }) => {
  const body = await readJson(req, bodySchema);
  const sql = getSql();
  if (body.action === "estimate") return ok(await estimateScope(sql, body.scope));
  return ok(await runScopeBatch(sql, body.scope, body.batch ?? 4));
});
