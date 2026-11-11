import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { readJson } from "@/lib/http";
import { executeCommand } from "@/lib/server/engine";
import { commandSchema } from "@/lib/validation/schemas";

/** Comandi di regia: validati, autorizzati, idempotenti (commandId) e registrati. */
export const POST = adminRoute<{ id: string }>(
  "operator",
  async ({ req, admin, params }) => {
    const input = await readJson(req, commandSchema);
    return ok(await executeCommand(params.id, admin, input));
  },
  { sessionParam: "id" },
);
