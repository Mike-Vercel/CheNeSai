import { ok, route } from "@/lib/http";
import { requireGiramenteUser } from "@/lib/server/giramente/auth";
import { GiramenteError } from "@/lib/server/giramente/errors";
import { createRoom, listMyRooms } from "@/lib/server/giramente/rooms";

/** Le partite GIRAMENTE! aperte dell'account (per «Riprendi»). */
export const GET = route(async () => {
  const user = await requireGiramenteUser();
  return ok({ rooms: await listMyRooms(user.userId) });
});

/** Nuova partita (solo account registrati): un dispositivo per tutti o uno a testa, individuale o a squadre. */
export const POST = route(async (req: Request) => {
  const user = await requireGiramenteUser({ withProfile: true });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new GiramenteError("VALIDATION", "Dati non validi");
  }
  return ok(await createRoom(user, body), { status: 201 });
});
