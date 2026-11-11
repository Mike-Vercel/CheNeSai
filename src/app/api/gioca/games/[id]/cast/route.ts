import { clientIp } from "@/lib/auth/admin";
import { ok, route } from "@/lib/http";
import { requireHostUser } from "@/lib/server/gioco-libero";
import { createCastPairing } from "@/lib/server/tv-pairing";

/** «Trasmetti»: indirizzo monouso della pagina del TV già abbinata (aperto con la Presentation API). */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const host = await requireHostUser(await clientIp());
  const p = await createCastPairing(host, id);
  return ok({ path: `/tv?p=${p.pairingId}&t=${encodeURIComponent(p.token)}` });
});
