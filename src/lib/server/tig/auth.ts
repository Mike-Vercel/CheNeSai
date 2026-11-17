import "server-only";
import { clientIp } from "@/lib/auth/admin";
import { getHostUser } from "@/lib/server/gioco-libero";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TigError } from "./errors";

export interface TigUser {
  userId: string;
  ip: string | null;
  /** username del sito (nickname proposto) */
  username: string | null;
}

/**
 * Utente della richiesta: lo STESSO account del sito (Supabase Auth, verificato a ogni richiesta).
 * Account obbligatorio per organizzare e per giocare (un telefono può rappresentare tutto il tavolo).
 */
export async function requireTigUser(opts: { withProfile?: boolean } = {}): Promise<TigUser> {
  const ip = await clientIp();
  if (opts.withProfile) {
    const h = await getHostUser(ip);
    if (!h) throw new TigError("UNAUTHENTICATED", "Accedi per giocare a TAVOLI IN GUERRA!");
    return { userId: h.userId, ip, username: h.profile?.username ?? null };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new TigError("UNAUTHENTICATED", "Accedi per giocare a TAVOLI IN GUERRA!");
  return { userId: data.user.id, ip, username: null };
}

export async function optionalTigUser(): Promise<TigUser | null> {
  try {
    return await requireTigUser();
  } catch {
    return null;
  }
}
