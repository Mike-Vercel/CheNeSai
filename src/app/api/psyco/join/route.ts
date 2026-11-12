import { z } from "zod";
import { ok, readJson, route } from "@/lib/http";
import { requirePsycoUser } from "@/lib/server/psyco/auth";
import { joinRoom, previewRoom } from "@/lib/server/psyco/rooms";

/** Anteprima della stanza dal codice (QR, link, codice scritto): solo utenti autenticati, con limiti di frequenza. */
export const GET = route(async (req: Request) => {
  const user = await requirePsycoUser({ withProfile: true });
  const code = new URL(req.url).searchParams.get("code") ?? "";
  return ok({ room: await previewRoom(user, code), suggestedNickname: user.username });
});

const schema = z.object({ code: z.string().max(20), nickname: z.string().max(60) });

/** Ingresso nella stanza con il proprio account (un solo posto per account). */
export const POST = route(async (req: Request) => {
  const user = await requirePsycoUser();
  const body = await readJson(req, schema);
  return ok(await joinRoom(user, body.code, body.nickname));
});
