import { z } from "zod";
import { ok, route } from "@/lib/http";
import { actionSchema } from "@/lib/psyco/types";
import { requirePsycoUser } from "@/lib/server/psyco/auth";
import { runAction } from "@/lib/server/psyco/engine";
import { PsycoError } from "@/lib/server/psyco/errors";
import { getRoomView } from "@/lib/server/psyco/rooms";

const asSchema = z.object({ as: z.uuid().nullish() });

/**
 * Un'azione di gioco (voto, «visto», «HO CAPITO!», pausa…): validata e applicata dal server in una
 * transazione. Risponde con la vista aggiornata di chi ha agito.
 * `as`: SOLO nel dispositivo condiviso, il giocatore locale che sta usando il telefono.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requirePsycoUser();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new PsycoError("VALIDATION", "Dati non validi");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) throw new PsycoError("VALIDATION", "Azione non valida", parsed.error.issues);
  const as = asSchema.safeParse(body).data?.as ?? null;
  await runAction(id, { userId: user.userId, ip: user.ip, asParticipantId: as }, parsed.data);
  if (parsed.data.action === "leave" || parsed.data.action === "close_room") return ok({ done: true });
  return ok(await getRoomView(user, id, as));
});
