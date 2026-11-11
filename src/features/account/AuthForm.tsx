"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { UsernameField, type UsernameStatus } from "./UsernameField";

type Mode = "signup" | "login" | "reset";

/** "G" ufficiale di Google (quattro colori), come nei pulsanti "Sign in with Google". */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={className}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 20 20 4" />}
    </svg>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={clsx("qz-spinner", className)} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Messaggio d'errore ben visibile (con un piccolo scossone a ogni nuovo errore). */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="qz-shake flex gap-3 rounded-2xl bg-[#2a0a12] px-4 py-3 text-[15px] font-bold leading-snug text-[#ffd0d9] ring-1 ring-inset ring-[#ff5470]/45">
      <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-[#ff5470]" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-.9-11.6a.9.9 0 1 1 1.8 0v4.2a.9.9 0 1 1-1.8 0V6.4zM10 14.8a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2z" clipRule="evenodd" />
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Registrazione (username + email + password), accesso, password dimenticata e "Continua con Google". */
export function AuthForm({ next, initialMode, error: initialError }: { next: string; initialMode: Mode; error: string | null }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [uStatus, setUStatus] = useState<UsernameStatus>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resent, setResent] = useState(false);

  const callback = (extra: string) => `${window.location.origin}/auth/callback?${extra}`;

  // navigazione completa: la sessione appena aperta vale subito per tutte le pagine (niente cache del router)
  function go() {
    window.location.assign(next);
  }

  async function signup() {
    const r = await fetch("/api/account/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, username: username.trim(), next }),
    });
    const data = (await r.json().catch(() => null)) as { status?: string; error?: { code?: string; message?: string; details?: { message?: string }[] } } | null;
    if (!r.ok) {
      const d = data?.error;
      setError(d?.code === "VALIDATION" ? (d.details?.[0]?.message ?? "Controlla i dati") : (d?.message ?? "Registrazione non riuscita"));
      if (d?.code === "EMAIL_TAKEN") setMode("login");
      return;
    }
    if (data?.status === "logged_in") go();
    else setSent("confirm");
  }

  async function login() {
    const { error: err } = await getSupabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (!err) return go();
    if (err.code === "email_not_confirmed" || /not confirmed/i.test(err.message)) {
      setNeedsConfirm(true);
      setError("Conferma prima l'email: apri il link che ti abbiamo mandato (guarda anche nello spam).");
    } else if (err.code === "invalid_credentials" || /invalid login/i.test(err.message)) {
      setError("Email o password non corretti");
    } else {
      setError("Accesso non riuscito, riprova tra poco");
    }
  }

  async function reset() {
    const { error: err } = await getSupabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: callback("flow=recovery") });
    if (err) setError(err.code === "over_email_send_rate_limit" ? "Troppe email inviate: riprova più tardi" : "Invio non riuscito, riprova tra poco");
    else setSent("reset");
  }

  async function resend() {
    const { error: err } = await getSupabaseBrowser().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: callback(`next=${encodeURIComponent(next)}`) } });
    setResent(!err);
    if (err) setError(err.code === "over_email_send_rate_limit" ? "Troppe email inviate: riprova più tardi" : "Invio non riuscito, riprova tra poco");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && uStatus === "error") {
      setError("Scegli uno username valido e libero");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") await signup();
      else if (mode === "login") await login();
      else await reset();
    } catch {
      setError("Connessione assente, riprova");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  if (sent) {
    return (
      <section aria-labelledby="sent-title" className="flex flex-col gap-4 text-center sm:text-left">
        <svg aria-hidden viewBox="0 0 48 48" className="mx-auto h-14 w-14 text-gold sm:mx-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="10" width="38" height="28" rx="5" />
          <path d="m7 13 17 13 17-13" />
        </svg>
        <h1 id="sent-title" className="font-display text-4xl leading-tight">
          Controlla la tua email
        </h1>
        <p className="text-lg font-bold text-white/90">
          {sent === "confirm" ? (
            <>
              Ti abbiamo mandato un link a <strong className="break-all text-gold">{email}</strong>. Aprilo da questo dispositivo per confermare l&apos;account e iniziare a giocare.
            </>
          ) : (
            <>
              Se esiste un account con <strong className="break-all text-gold">{email}</strong>, riceverai un link per scegliere una nuova password.
            </>
          )}
        </p>
        <p className="text-base font-semibold text-white/70">Non arriva? Guarda nello spam, oppure aspetta un minuto e richiedila.</p>
        <div className="mt-2 flex flex-col items-center gap-3 sm:items-start">
          {sent === "confirm" && (
            <button type="button" onClick={() => void resend()} className="rounded-full bg-coal-3 px-5 py-3 font-extrabold transition hover:bg-coal-4 active:scale-95">
              {resent ? "Email inviata di nuovo" : "Invia di nuovo l'email"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSent(null);
              setMode("login");
            }}
            className="font-bold text-white/80 underline underline-offset-4 hover:text-white"
          >
            Ho confermato: accedi
          </button>
        </div>
      </section>
    );
  }

  const title = mode === "signup" ? "Crea il tuo account" : mode === "login" ? "Bentornato" : "Password dimenticata";
  return (
    <section aria-labelledby="auth-title" className="flex flex-col gap-4">
      {mode !== "reset" && (
        <div role="tablist" aria-label="Accesso" className="relative grid grid-cols-2 rounded-full bg-coal-3 p-1">
          <span
            aria-hidden
            className={clsx(
              "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              mode === "login" && "translate-x-full",
            )}
          />
          {(
            [
              ["signup", "Crea account"],
              ["login", "Accedi"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={clsx("relative z-10 rounded-full py-2.5 text-base font-black transition-colors duration-300", mode === m ? "text-ink" : "text-white/75 hover:text-white")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div key={mode} className="animate-[qz-rise-in_0.35s_cubic-bezier(0.2,0.8,0.2,1)_both]">
        <h1 id="auth-title" className="font-display text-4xl leading-[1.05] md:text-[2.75rem]">
          {title}
        </h1>
        <p className="mt-2 text-[15px] font-bold leading-snug text-white/70">
          {mode === "signup"
            ? "Serve solo a chi ospita la partita: così il sito ricorda le domande che hai già visto. Chi gioca dal telefono entra senza account."
            : mode === "login"
              ? "Accedi per creare una nuova partita."
              : "Scrivi l'email dell'account: ti mandiamo un link per sceglierne una nuova."}
        </p>
      </div>

      {mode !== "reset" && (
        <>
          <a
            href={`/auth/google?next=${encodeURIComponent(next)}`}
            className="flex h-14 items-center justify-center gap-3 rounded-full bg-white px-6 text-[17px] font-extrabold text-[#1f1f1f] transition hover:bg-[#eef0f1] active:scale-[0.98] focus-visible:outline-offset-4"
          >
            <GoogleG className="h-[22px] w-[22px]" />
            Continua con Google
          </a>
          <p className="flex items-center gap-3 text-sm font-bold text-white/55" aria-hidden>
            <span className="h-px flex-1 bg-white/12" />
            oppure con l&apos;email
            <span className="h-px flex-1 bg-white/12" />
          </p>
        </>
      )}

      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3.5" noValidate>
        {mode === "signup" && <UsernameField value={username} onChange={setUsername} onStatus={setUStatus} />}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-extrabold">
            Email
          </label>
          <input id="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className="qz-field rounded-2xl h-14 w-full px-4 text-[17px]" placeholder="nome@esempio.it" />
        </div>
        {mode !== "reset" && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="password" className="block text-sm font-extrabold">
                Password
              </label>
              {mode === "login" && (
                <button type="button" onClick={() => switchMode("reset")} className="text-sm font-bold text-white/70 underline underline-offset-4 hover:text-white">
                  Password dimenticata?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={mode === "signup" ? "password-help" : undefined}
                className="qz-field rounded-2xl h-14 w-full pl-4 pr-14 text-[17px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                aria-pressed={showPassword}
                aria-controls="password"
                className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <EyeIcon open={!showPassword} />
              </button>
            </div>
            {mode === "signup" && (
              <p id="password-help" className={clsx("mt-1.5 text-sm font-bold transition-colors", password.length >= 8 ? "text-lime" : "text-white/65")}>
                Almeno 8 caratteri.
              </p>
            )}
          </div>
        )}
        {error && (
          <FormError key={error}>
            {error}
            {needsConfirm && mode === "login" && (
              <button type="button" onClick={() => void resend()} className="mt-1 block font-black text-white underline underline-offset-4">
                {resent ? "Email inviata di nuovo" : "Invia di nuovo l'email di conferma"}
              </button>
            )}
          </FormError>
        )}
        <button
          type="submit"
          disabled={busy}
          className="qz-play mt-1 inline-flex h-15 items-center justify-center gap-3 rounded-full bg-gold py-4 font-display text-2xl text-ink transition hover:bg-[#ffe066] active:scale-[0.99] disabled:opacity-70"
        >
          {busy && <Spinner className="h-6 w-6" />}
          {busy ? "Un attimo…" : mode === "signup" ? "CREA ACCOUNT E GIOCA" : mode === "login" ? "ACCEDI" : "MANDAMI IL LINK"}
        </button>
        {mode === "signup" && (
          <p className="text-center text-[13px] font-semibold leading-snug text-white/60">
            Creando l&apos;account accetti i{" "}
            <a href="/termini" target="_blank" className="font-bold text-white/90 underline underline-offset-2 hover:text-white">
              Termini di servizio
            </a>{" "}
            e l&apos;
            <a href="/privacy" target="_blank" className="font-bold text-white/90 underline underline-offset-2 hover:text-white">
              informativa sulla privacy
            </a>
            .
          </p>
        )}
        {mode === "reset" && (
          <button type="button" onClick={() => switchMode("login")} className="font-bold text-white/80 underline underline-offset-4 hover:text-white">
            Torna all&apos;accesso
          </button>
        )}
      </form>
    </section>
  );
}
