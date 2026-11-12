import { z } from "zod";
import { ok, readJson, route } from "@/lib/http";
import { requireGiramenteUser } from "@/lib/server/giramente/auth";
import { joinRoom, previewRoom } from "@/lib/server/giramente/rooms";

/** Anteprima della partita dal codice (QR, link, codice scritto): solo utenti autenticati, con limiti di frequenza. */
export const GET = route(async (req: Request) => {
  const user = await requireGiramenteUser({ withProfile: true });
  const code = new URL(req.url).searchParams.get("code") ?? "";
  return ok({ room: await previewRoom(user, code), suggestedNickname: user.username });
});

const schema = z.object({ code: z.string().max(20), nickname: z.string().max(60), teamId: z.uuid().nullish() });

/** Ingresso con il proprio account (un solo posto per account). */
export const POST = route(async (req: Request) => {
  const user = await requireGiramenteUser();
  const body = await readJson(req, schema);
  return ok(await joinRoom(user, body.code, body.nickname, body.teamId ?? null));
});
