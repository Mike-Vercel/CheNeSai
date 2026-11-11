import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth/next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Ritorno da Supabase Auth:
 * - accesso con Google (?code=… PKCE)
 * - link di conferma email / recupero password (?code=… oppure ?token_hash=…&type=…)
 * Scambia il codice con la sessione (cookie) e prosegue verso `next`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;
  const type = p.get("type") as EmailOtpType | null;
  const recovery = type === "recovery" || p.get("flow") === "recovery";
  const next = recovery ? "/accedi/nuova-password" : safeNextPath(p.get("next"));
  const fail = (reason: string) => {
    const to = new URL("/accedi", url.origin);
    to.searchParams.set("errore", reason);
    if (next !== "/gioca") to.searchParams.set("next", next);
    return NextResponse.redirect(to, { status: 303 });
  };

  const err = p.get("error_code") ?? p.get("error");
  if (err) {
    const desc = (p.get("error_description") ?? "").toLowerCase();
    if (desc.includes("provider is not enabled") || desc.includes("unsupported provider")) return fail("google");
    if (err === "otp_expired" || desc.includes("expired")) return fail("link-scaduto");
    if (err === "access_denied") return fail("annullato");
    return fail("accesso");
  }

  const supabase = await createSupabaseServerClient();
  const code = p.get("code");
  const tokenHash = p.get("token_hash");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.code === "flow_state_not_found" || error.code === "bad_code_verifier" ? "altro-browser" : "link-scaduto");
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("link-scaduto");
  } else {
    return fail("accesso");
  }
  return NextResponse.redirect(new URL(next, url.origin), { status: 303 });
}
