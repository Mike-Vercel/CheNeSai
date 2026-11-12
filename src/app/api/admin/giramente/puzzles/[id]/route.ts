import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { updatePuzzle } from "@/lib/server/giramente/admin";

/** Modifica, pubblica o disattiva un enigma (pubblicazione bloccata se incompleto). Nessuna cancellazione. */
export const PATCH = adminRoute<{ id: string }>("admin", async ({ req, params }) => ok(await updatePuzzle(params.id, await req.json().catch(() => null))));
