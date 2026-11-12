import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { updateRule } from "@/lib/server/psyco/rules-admin";

/** Modifica una regola (testo, difficoltà) o la attiva/disattiva. Nessuna cancellazione: si disattiva. */
export const PATCH = adminRoute<{ id: string }>("admin", async ({ req, params }) => ok(await updateRule(params.id, await req.json().catch(() => null))));
