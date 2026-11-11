import { z } from "zod";
import { clientIp } from "@/lib/auth/admin";
import { isLocalSupabaseUrl, safeNextPath } from "@/lib/auth/next-path";
import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { GiocoError } from "@/lib/server/gioco-errors";
import { createHostProfile, isUsernameAvailable } from "@/lib/server/gioco-libero";
import { checkRateLimit } from "@/lib/server/players";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email("Email non valida").max(200),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri").max(72),
  username: z.string().max(40),
  next: z.string().max(300).optional(),
});

/**
 * Registrazione di un account host (email + password + username univoco).
 * - Se il progetto Supabase chiede la conferma dell'email, risponde { status: "confirm_email" }:
 *   il link nell'email torna su /auth/callback e da lì al gioco.
 * - Altrimenti l'account è già collegato (cookie di sessione) e risponde { status: "logged_in" }.
 * Lo username viene riservato subito (profilo creato anche prima della conferma).
 */
export const POST = route(async (req: Request) => {
  const body = await readJson(req, schema);
  const sql = getSql();
  const ip = await clientIp();
  if (!(await checkRateLimit(sql, `signup:${ip ?? "unknown"}`, 10, 3600))) {
    throw new GiocoError("RATE_LIMITED", "Troppe registrazioni da questa rete: riprova più tardi");
  }
  const avail = await isUsernameAvailable(sql, body.username);
  if (!avail.available) throw new GiocoError(avail.message?.includes("già preso") ? "USERNAME_TAKEN" : "USERNAME_INVALID", avail.message ?? "Username non valido");

  const email = body.email.trim().toLowerCase();
  const origin = new URL(req.url).origin;
  const next = safeNextPath(body.next);
  const supabase = await createSupabaseServerClient();
  let { data, error } = await supabase.auth.signUp({
    email,
    password: body.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { username: body.username.trim() },
    },
  });

  // Supabase locale (CLI) con le registrazioni chiuse in config.toml: in sviluppo l'account si crea
  // con la chiave di servizio (email già confermata). Mai in produzione.
  if (error?.code === "signup_disabled" && isLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    const created = await getSupabaseAdmin().auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { username: body.username.trim() } });
    if (created.error) {
      error = created.error;
    } else {
      const signedIn = await supabase.auth.signInWithPassword({ email, password: body.password });
      data = { user: signedIn.data.user, session: signedIn.data.session };
      error = signedIn.error;
    }
  }

  if (error) {
    const code = error.code ?? "";
    if (code === "user_already_exists" || code === "email_exists" || /already (been )?registered/i.test(error.message)) {
      throw new GiocoError("EMAIL_TAKEN", "Esiste già un account con questa email: accedi");
    }
    if (code === "weak_password") throw new GiocoError("WEAK_PASSWORD", "Password troppo debole: usa almeno 8 caratteri con lettere e numeri");
    if (code === "signup_disabled") throw new GiocoError("SIGNUP_CLOSED", "Le registrazioni sono chiuse in questo momento");
    if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
      throw new GiocoError("EMAIL_LIMIT", "Troppe email di conferma inviate nell'ultima ora: riprova più tardi o entra con Google");
    }
    if (code === "email_address_invalid") throw new GiocoError("WEAK_PASSWORD", "Questa email non è accettata: usane un'altra");
    if (code === "email_address_not_authorized") {
      throw new GiocoError("AUTH_FAILED", "L'invio delle email di conferma non è ancora configurato: entra con Google o riprova più tardi");
    }
    console.error("[account] registrazione non riuscita", code, error.message);
    throw new GiocoError("AUTH_FAILED", "Registrazione non riuscita, riprova tra poco");
  }
  // Email già registrata ma non confermata: Supabase risponde senza identità (per non rivelarlo).
  if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
    throw new GiocoError("EMAIL_TAKEN", "Esiste già un account con questa email: accedi (o controlla l'email di conferma)");
  }
  try {
    await createHostProfile(sql, data.user.id, body.username);
  } catch (e) {
    // username preso un attimo prima da qualcun altro: lo sceglierà al primo accesso
    if (!(e instanceof GiocoError)) throw e;
  }
  return ok({ status: data.session ? "logged_in" : "confirm_email", next }, { status: 201 });
});
