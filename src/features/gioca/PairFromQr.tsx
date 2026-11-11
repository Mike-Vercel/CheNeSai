"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/realtime/api-client";

export interface PairableGame {
  id: string;
  code: string;
  label: string;
  players: number;
}

/** QR del televisore inquadrato col telefono: si sceglie la partita e il TV si collega. */
export function PairFromQr({ code, games }: { code: string; games: PairableGame[] }) {
  const router = useRouter();
  const [pick, setPick] = useState(games[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pair() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/tv/pair/claim", { method: "POST", json: { code, sessionId: pick } });
      router.push(`/gioca/telecomando/${pick}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Connessione assente, riprova");
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Partita da mostrare sul TV" className="flex flex-col gap-2">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={pick === g.id}
            onClick={() => setPick(g.id)}
            className={clsx("flex items-center gap-3 rounded-2xl px-4 py-3 text-left ring-2 transition", pick === g.id ? "bg-gold/15 ring-gold" : "bg-coal-2 ring-transparent")}
          >
            <span className="font-display text-xl tracking-widest text-gold">{g.code}</span>
            <span className="min-w-0 flex-1 text-sm font-bold text-white/80">
              {g.label} · {g.players} {g.players === 1 ? "giocatore" : "giocatori"}
            </span>
          </button>
        ))}
      </div>
      <button type="button" disabled={busy || !pick} onClick={() => void pair()} className="h-16 rounded-full bg-gold font-display text-2xl text-ink transition active:scale-[0.98] disabled:opacity-40">
        {busy ? "COLLEGO…" : "📺 COLLEGA IL TV"}
      </button>
      {error && (
        <p role="alert" className="rounded-xl bg-flame/20 px-3 py-2 text-sm font-bold text-[#ffd0d9]">
          {error}
        </p>
      )}
    </div>
  );
}
