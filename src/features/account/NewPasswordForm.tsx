"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

/** Dopo il link "password dimenticata" (/auth/callback ha già aperto la sessione): nuova password. */
export function NewPasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Almeno 8 caratteri");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.code === "same_password" ? "È uguale a quella di prima: scegline un'altra" : err.code === "session_not_found" || /session/i.test(err.message) ? "Il link è scaduto: richiedine uno nuovo." : "Salvataggio non riuscito, riprova");
      return;
    }
    // navigazione completa voluta: la sessione aggiornata deve valere subito per tutte le pagine
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/gioca");
  }

  return (
    <section aria-labelledby="np-title" className="flex flex-col gap-5">
      <h1 id="np-title" className="font-display text-4xl">
        Scegli una nuova password
      </h1>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-extrabold">
            Nuova password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="np-help"
            className="qz-field rounded-2xl h-14 w-full px-4 text-[17px]"
          />
          <p id="np-help" className="mt-1.5 text-sm font-bold text-white/70">
            Almeno 8 caratteri.
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-2xl bg-[#2a0a12] px-4 py-3 font-bold text-[#ffd0d9] ring-1 ring-inset ring-[#ff5470]/45">
            {error} {error.includes("scaduto") && <Link href="/accedi?modo=password" className="underline">Richiedi un nuovo link</Link>}
          </p>
        )}
        <button type="submit" disabled={busy} className="qz-play rounded-full bg-gold py-4 font-display text-2xl text-ink transition hover:bg-[#ffe066] disabled:opacity-60">
          {busy ? "Un attimo…" : "SALVA E GIOCA"}
        </button>
      </form>
    </section>
  );
}
