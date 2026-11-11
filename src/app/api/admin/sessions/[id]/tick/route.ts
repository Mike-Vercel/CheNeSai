import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { autoTick } from "@/lib/server/engine";

export const maxDuration = 60;

/** Scorrimento automatico guidato dalla regia (se la scheda è aperta): stesso controllo del TV. */
export const POST = adminRoute<{ id: string }>("operator", async ({ params }) => ok(await autoTick(params.id)), { sessionParam: "id" });
