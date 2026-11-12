import "server-only";
import { clientIp } from "@/lib/auth/admin";
import { getHostUser } from "@/lib/server/gioco-libero";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PsycoError } from "./errors";
import type { PsycoUser } from "./rooms";

/**
 * Utente della richiesta per PSYCO: lo STESSO account del sito (Supabase Auth, verificato dal server
 * Auth a ogni richiesta con getUser). Nessun login separato, nessun giocatore anonimo.
 * `withProfile`: carica anche lo username (serve solo per proporre il nickname).
 */
export async function requirePsycoUser(opts: { withProfile?: boolean } = {}): Promise<PsycoUser> {
  const ip = await clientIp();
  if (opts.withProfile) {
    const h = await getHostUser(ip);
    if (!h) throw new PsycoError("UNAUTHENTICATED", "Accedi per giocare a PSYCO");
    return { userId: h.userId, ip, username: h.profile?.username ?? null };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new PsycoError("UNAUTHENTICATED", "Accedi per giocare a PSYCO");
  return { userId: data.user.id, ip, username: null };
}
