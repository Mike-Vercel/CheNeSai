import { z } from "zod";
import { clientIp } from "@/lib/auth/admin";
import { ok, readJson, route } from "@/lib/http";
import { HOST_ACTIONS, hostCommand, requireHostUser } from "@/lib/server/gioco-libero";

const schema = z.object({ action: z.enum(HOST_ACTIONS), commandId: z.uuid().optional() });

/**
 * Comandi dell'host sulla SUA partita libera: open, start (INIZIA PARTITA), pause, resume, finish.
 * Nessun altro comando di regia è raggiungibile da qui; chi non è il proprietario riceve 403.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const host = await requireHostUser(await clientIp());
  const body = await readJson(req, schema);
  const res = await hostCommand(host, id, body.action, body.commandId);
  return ok({ state: res.state, duplicate: res.duplicate });
});
