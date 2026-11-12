import { ok, route } from "@/lib/http";
import { optionalGiramenteUser, requireGiramenteUser } from "@/lib/server/giramente/auth";
import { GiramenteError } from "@/lib/server/giramente/errors";
import { runScreenAction, screenControl } from "@/lib/server/giramente/rooms";

/** Chi guarda lo schermo è chi gestisce la partita? (solo sì/no, per mostrare i comandi) */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  return ok(await screenControl(await optionalGiramenteUser(), key));
});

/** Comandi dallo schermo (avvia, avanti, pausa, riprendi): solo per l'host autenticato. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  const user = await requireGiramenteUser();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new GiramenteError("VALIDATION", "Dati non validi");
  }
  return ok(await runScreenAction(user, key, body));
});
