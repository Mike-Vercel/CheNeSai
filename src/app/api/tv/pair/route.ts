import { clientIp } from "@/lib/auth/admin";
import { ok, route } from "@/lib/http";
import { createPairing } from "@/lib/server/tv-pairing";

/** Il televisore (pagina /tv, nessun account) chiede un codice di 4 cifre da scrivere sul telefono. */
export const POST = route(async () => ok(await createPairing(await clientIp())));
