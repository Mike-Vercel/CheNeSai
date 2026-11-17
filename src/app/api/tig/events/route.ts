import { ok, route } from "@/lib/http";
import { requireTigUser } from "@/lib/server/tig/auth";
import { TigError } from "@/lib/server/tig/errors";
import { createEvent, listMyEvents } from "@/lib/server/tig/events";

/** Le serate aperte dell'account (organizzate o giocate), per «Riprendi». */
export const GET = route(async () => {
  const user = await requireTigUser();
  return ok({ events: await listMyEvents(user.userId) });
});

/** Nuova serata (wizard della regia): locale, tavoli, durata, modalità d'accesso. Solo account registrati. */
export const POST = route(async (req: Request) => {
  const user = await requireTigUser();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new TigError("VALIDATION", "Dati non validi");
  }
  return ok(await createEvent(user, body), { status: 201 });
});
