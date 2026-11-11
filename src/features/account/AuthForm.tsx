"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { UsernameField, type UsernameStatus } from "./UsernameField";

type Mode = "signup" | "login" | "reset";

const inputCls = "h-13 w-full rounded-2xl border-[3px] border-transparent bg-white px-4 py-3 text-lg font-bold text-ink placeholder:text-ink/35 focus:border-cyan focus:outline-none";

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-6 w-6">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Registrazione (username + email + password), accesso, password dimenticata e "Continua con Google". */
export function AuthForm({ next, initialMode, error: initialError }: { next: string; initialMode: Mode; error: string | null }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [uStatus, setUStatus] = useState<UsernameStatus>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  if (sent) {
    return (
      <section aria-labelledby="sent-title" className="flex flex-col gap-4">
        <h1 id="sent-title" className="font-display text-4xl leading-tight">
          Controlla la tua email
        </h1>
        <p className="text-lg font-bold text-white/90">
          {sent === "confirm" ? (
            <>
              Ti abbiamo mandato un link a <strong className="text-gold">{email}</strong>. Aprilo da questo dispositivo per confermare l&apos;account e iniziare a giocare.
            </>
          ) : (
            <>
              Se esiste un account con <strong className="text-gold">{email}</strong>, riceverai un link per scegliere una nuova password.
            </>
          )}
        </p>
        <p className="text-base font-semibold text-white/75">Non arriva? Guarda nello spam, oppure aspetta un minuto e richiedila.</p>
        {sent === "confirm" && (
          <button type="button" onClick={() => void resend()} className="w-fit rounded-full bg-white/10 px-5 py-2.5 font-bold hover:bg-white/20">
            {resent ? "Email inviata di nuovo" : "Invia di nuovo l'email"}
          </button>
        )}
        <button type="button" onClick={() => { setSent(null); setMode("login"); }} className="w-fit font-bold text-white/80 underline underline-offset-4">
          Ho confermato: accedi
        </button>
      </section>
    );
  }

  const title = mode === "signup" ? "Crea il tuo account" : mode === "login" ? "Bentornato" : "Password dimenticata";
  return (
    <section aria-labelledby="auth-title" className="flex flex-col gap-5">
      <div>
        <h1 id="auth-title" className="font-display text-4xl leading-tight md:text-5xl">
          {title}
        </h1>
        <p className="mt-2 text-base font-bold text-white/85">
          {mode === "signup"
            ? "Serve solo a chi ospita la partita: così il sito ricorda le domande che hai già visto. Chi gioca dal telefono entra senza account."
            : mode === "login"
              ? "Accedi per creare una nuova partita."
              : "Scrivi l'email dell'account: ti mandiamo un link per sceglierne una nuova."}
        </p>
      </div>

      {mode !== "reset" && (
        <div role="tablist" aria-label="Accesso" className="grid grid-cols-2 rounded-full bg-night-3 p-1">
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
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={clsx("rounded-full py-2.5 text-base font-black transition", mode === m ? "bg-white text-ink" : "text-white/80 hover:text-white")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode !== "reset" && (
        <>
          <a
            href={`/auth/google?next=${encodeURIComponent(next)}`}
            className="flex h-14 items-center justify-center gap-3 rounded-full bg-white text-lg font-black text-ink transition hover:bg-cream active:scale-[0.98]"
          >
            <GoogleLogo />
            Continua con Google
          </a>
          <p className="flex items-center gap-3 text-sm font-bold text-white/60" aria-hidden>
            <span className="h-0.5 flex-1 bg-white/10" />
            oppure con l&apos;email
            <span className="h-0.5 flex-1 bg-white/10" />
          </p>
        </>
      )}

      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        {mode === "signup" && <UsernameField value={username} onChange={setUsername} onStatus={setUStatus} />}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-extrabold">
            Email
          </label>
          <input id="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="nome@esempio.it" />
        </div>
        {mode !== "reset" && (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="password" className="block text-sm font-extrabold">
                Password
              </label>
              {mode === "login" && (
                <button type="button" onClick={() => { setMode("reset"); setError(null); }} className="text-sm font-bold text-white/75 underline underline-offset-4 hover:text-white">
                  Password dimenticata?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={mode === "signup" ? "password-help" : undefined}
              className={inputCls}
            />
            {mode === "signup" && (
              <p id="password-help" className="mt-1.5 text-sm font-bold text-white/70">
                Almeno 8 caratteri.
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-flame/20 px-4 py-3 text-base font-bold text-[#ffd0d9]">
            {error}
            {needsConfirm && mode === "login" && (
              <button type="button" onClick={() => void resend()} className="mt-1 block font-black text-white underline underline-offset-4">
                {resent ? "Email inviata di nuovo" : "Invia di nuovo l'email di conferma"}
              </button>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="qz-play mt-1 h-15 rounded-full bg-gold py-4 font-display text-2xl text-ink transition hover:bg-white disabled:opacity-60"
        >
          {busy ? "Un attimo…" : mode === "signup" ? "CREA ACCOUNT E GIOCA" : mode === "login" ? "ACCEDI" : "MANDAMI IL LINK"}
        </button>
        {mode === "signup" && (
          <p className="text-sm font-semibold text-white/75">
            Creando l&apos;account accetti i{" "}
            <a href="/termini" target="_blank" className="font-bold text-white underline underline-offset-2">
              Termini di servizio
            </a>{" "}
            e l&apos;
            <a href="/privacy" target="_blank" className="font-bold text-white underline underline-offset-2">
              informativa sulla privacy
            </a>
            .
          </p>
        )}
        {mode === "reset" && (
          <button type="button" onClick={() => { setMode("login"); setError(null); }} className="font-bold text-white/80 underline underline-offset-4">
            Torna all&apos;accesso
          </button>
        )}
      </form>
    </section>
  );
}
