"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UsernameField, type UsernameStatus } from "./UsernameField";

/** Primo accesso (es. con Google): si sceglie lo username una volta sola. */
export function ChooseUsername() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "error") return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/account/username", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: username.trim() }) });
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(d?.error?.message ?? "Salvataggio non riuscito");
        return;
      }
      router.refresh();
    } catch {
      setError("Connessione assente, riprova");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="choose-title" className="flex flex-col gap-5">
      <h1 id="choose-title" className="font-display text-4xl leading-tight md:text-5xl">
        Scegli il tuo username
      </h1>
      <p className="text-lg font-bold text-white/85">È il nome del tuo account, unico sul sito. In ogni partita puoi comunque giocare con il nome che vuoi.</p>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <UsernameField value={username} onChange={setUsername} onStatus={setStatus} id="choose-username" />
        {error && (
          <p role="alert" className="rounded-2xl bg-[#2a0a12] px-4 py-3 font-bold text-[#ffd0d9] ring-1 ring-inset ring-[#ff5470]/45">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || status !== "ok"} className="qz-play rounded-full bg-gold py-4 font-display text-2xl text-ink transition hover:bg-[#ffe066] disabled:opacity-60">
          {busy ? "Un attimo…" : "CONTINUA"}
        </button>
      </form>
    </section>
  );
}
