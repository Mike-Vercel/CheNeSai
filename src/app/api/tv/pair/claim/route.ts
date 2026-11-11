import { z } from "zod";
import { clientIp } from "@/lib/auth/admin";
import { ok, readJson, route } from "@/lib/http";
import { requireHostUser } from "@/lib/server/gioco-libero";
import { claimPairing } from "@/lib/server/tv-pairing";

const schema = z.object({ code: z.string().max(12), sessionId: z.uuid() });

/** L'host (dal telefono) scrive il codice del TV: il TV diventa lo schermo della sua partita. */
export const POST = route(async (req: Request) => {
  const host = await requireHostUser(await clientIp());
  const body = await readJson(req, schema);
  return ok(await claimPairing(host, body.code, body.sessionId));
});
