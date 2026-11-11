import { ok, route } from "@/lib/http";
import { followRematch } from "@/lib/server/tv-pairing";

/** RIVINCITA sul TV abbinato: con la chiave della partita finita, id e chiave della nuova (o null). */
export const POST = route(async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  return ok({ next: await followRematch(sessionId, new URL(req.url).searchParams.get("k")) });
});
