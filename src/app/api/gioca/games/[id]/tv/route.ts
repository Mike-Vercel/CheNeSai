import { ok, readJson, route } from "@/lib/http";
import { requireHostUser } from "@/lib/server/gioco-libero";
import { remoteStatus, setRemotePrefs } from "@/lib/server/tv-pairing";
import { remotePrefsSchema } from "@/lib/validation/tv-remote";

/** Telecomando: il TV abbinato è collegato? Con l'audio attivo? E le preferenze audio scelte dal telefono. */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return ok(await remoteStatus(await requireHostUser(), id));
});

/** Telecomando: cambia l'audio del TV (il TV lo applica entro pochi secondi). */
export const PUT = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const host = await requireHostUser();
  return ok(await setRemotePrefs(host, id, await readJson(req, remotePrefsSchema)));
});
