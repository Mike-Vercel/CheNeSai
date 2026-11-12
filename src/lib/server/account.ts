import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Account del sito della richiesta corrente (Supabase Auth, verificato dal server Auth), o null se
 * non ha fatto l'accesso. Leggero: niente profilo né ruoli (per quelli c'è getHostUser).
 * Serve alle partite ONLINE: ogni giocatore entra con il suo account.
 */
export async function getAccountUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    return error || !data.user ? null : data.user.id;
  } catch {
    return null;
  }
}
