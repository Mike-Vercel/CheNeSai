import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { publicSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * "Continua con Google": controlla che il provider Google sia attivo nel progetto Supabase
 * (altrimenti torna su /accedi con un messaggio chiaro, invece della pagina di errore di Supabase),
 * poi avvia l'accesso OAuth (PKCE: il verificatore resta in un cookie) e reindirizza a Google.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const back = (reason: string) => {
    const to = new URL("/accedi", url.origin);
    to.searchParams.set("errore", reason);
    if (next !== "/gioca") to.searchParams.set("next", next);
    return NextResponse.redirect(to, { status: 303 });
  };

  if (!(await googleEnabled())) return back("google");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return back("google");
  return NextResponse.redirect(data.url, { status: 303 });
}

/** Impostazioni pubbliche di Supabase Auth: external.google = provider attivo. */
async function googleEnabled(): Promise<boolean> {
  try {
    const { url, key } = publicSupabaseEnv();
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) return true; // non si sa: si prova comunque (eventuale errore gestito da /auth/callback)
    const s = (await r.json()) as { external?: { google?: boolean } };
    return s.external?.google === true;
  } catch {
    return true;
  }
}
