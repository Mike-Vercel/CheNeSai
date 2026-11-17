import { ok, readJson, route } from "@/lib/http";
import { requireTigUser } from "@/lib/server/tig/auth";
import { joinEvent, previewJoin } from "@/lib/server/tig/events";
import { joinSchema } from "@/lib/tig/types";

/** Anteprima dal QR del tavolo (`?token=`) o dal codice squadra (`?code=`): solo utenti autenticati, con limiti. */
export const GET = route(async (req: Request) => {
  const user = await requireTigUser({ withProfile: true });
  const sp = new URL(req.url).searchParams;
  return ok(await previewJoin(user, { token: sp.get("token") ?? undefined, code: sp.get("code") ?? undefined }));
});

/** Ingresso: il primo telefono crea la squadra del tavolo, gli altri entrano in quella. */
export const POST = route(async (req: Request) => {
  const user = await requireTigUser();
  const body = await readJson(req, joinSchema);
  return ok(await joinEvent(user, body));
});
