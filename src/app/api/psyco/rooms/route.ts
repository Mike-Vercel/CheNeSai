import { ok, route } from "@/lib/http";
import { requirePsycoUser } from "@/lib/server/psyco/auth";
import { PsycoError } from "@/lib/server/psyco/errors";
import { createRoom, listMyRooms } from "@/lib/server/psyco/rooms";

/** Le partite PSYCO aperte dell'account (per «Riprendi»). */
export const GET = route(async () => {
  const user = await requirePsycoUser();
  return ok({ rooms: await listMyRooms(user.userId) });
});

/** Nuova stanza PSYCO (solo account registrati): dispositivo condiviso o dispositivi personali. */
export const POST = route(async (req: Request) => {
  const user = await requirePsycoUser({ withProfile: true });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new PsycoError("VALIDATION", "Dati non validi");
  }
  return ok(await createRoom(user, body), { status: 201 });
});
