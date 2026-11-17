import { ok, route } from "@/lib/http";
import { getDisplayState } from "@/lib/server/tig/events";

/** TV del locale: solo stato pubblico con la chiave dello schermo. `?live=1` = niente QR né codici (diretta). */
export const GET = route(async (req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  const live = new URL(req.url).searchParams.get("live") === "1";
  return ok(await getDisplayState(decodeURIComponent(key), { live }));
});
