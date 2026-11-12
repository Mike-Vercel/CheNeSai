import "server-only";
import { clientIp } from "@/lib/auth/admin";
import { getHostUser } from "@/lib/server/gioco-libero";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GiramenteError } from "./errors";

export interface GiramenteUser {
  userId: string;
  ip: string | null;
  /** username del sito (nickname proposto) */
  username: string | null;
}

/**
 * Utente della richiesta: lo STESSO account del sito (Supabase Auth, verificato a ogni richiesta).
 * Nessun login separato e nessun giocatore anonimo: almeno un account per giocare.
 */
export async function requireGiramenteUser(opts: { withProfile?: boolean } = {}): Promise<GiramenteUser> {
  const ip = await clientIp();
  if (opts.withProfile) {
    const h = await getHostUser(ip);
    if (!h) throw new GiramenteError("UNAUTHENTICATED", "Accedi per giocare a GIRAMENTE!");
    return { userId: h.userId, ip, username: h.profile?.username ?? null };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new GiramenteError("UNAUTHENTICATED", "Accedi per giocare a GIRAMENTE!");
  return { userId: data.user.id, ip, username: null };
}

/** Utente se collegato, altrimenti null (schermo pubblico: solo per sapere se chi guarda è l'host). */
export async function optionalGiramenteUser(): Promise<GiramenteUser | null> {
  try {
    return await requireGiramenteUser();
  } catch {
    return null;
  }
}
