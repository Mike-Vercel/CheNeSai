import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_NAME } from "@/lib/supabase/shared";

/**
 * Proxy (ex middleware): mantiene aggiornati i cookie di sessione Supabase
 * (area admin e account host del gioco libero) e reindirizza al login chi non è autenticato.
 * È solo un controllo "ottimistico": l'autorizzazione vera avviene in ogni
 * endpoint con requireAdmin() / requireHostUser().
 *
 * Il cookie dura 400 giorni (@supabase/ssr) e il refresh token di Supabase non scade:
 * finché l'account viene usato almeno ogni tanto, non serve rifare l'accesso.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAdminArea = path.startsWith("/admin") || path.startsWith("/api/admin");
  // Fuori dall'area admin: senza cookie di sessione non c'è nulla da rinnovare (i giocatori non hanno account).
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith(AUTH_COOKIE_NAME));
  // vista per la LIVE: si apre anche senza account (cookie del giocatore o gettone della Sorgente browser di OBS)
  const needsAccount = (path.startsWith("/gioca") && !path.startsWith("/gioca/live/")) || path.startsWith("/profilo");
  if (!isAdminArea && !hasSession) {
    if (needsAccount) return toLogin(request, "/accedi");
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const isLogin = path === "/admin/login";
  if (!data.user && path.startsWith("/api/admin")) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sessione scaduta: rifai il login" } }, { status: 401 });
  }
  if (!data.user && path.startsWith("/admin") && !isLogin) return toLogin(request, "/admin/login");
  if (!data.user && needsAccount) return toLogin(request, "/accedi");
  return response;
}

function toLogin(request: NextRequest, loginPath: string) {
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/admin/:path*", "/gioca/:path*", "/profilo/:path*", "/accedi/:path*", "/api/account/:path*", "/api/gioca/:path*", "/psyco/:path*", "/api/psyco/:path*"],
};
