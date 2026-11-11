"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { maxRoundsFor, PUBLIC_MAX_ROUNDS, PUBLIC_TOTAL_OPTIONS } from "@/lib/game-engine/public-game";
import { api, ApiError } from "@/lib/realtime/api-client";

const MIXES = [
  { value: "facile", label: "Facile" },
  { value: "bilanciata", label: "Bilanciata" },
  { value: "difficile", label: "Difficile" },
] as const;

interface Options {
  totalQuestions: number;
  rounds: number;
  mix: (typeof MIXES)[number]["value"];
}

function Pills<T extends string | number>({ label, values, value, onChange, disabled }: { label: string; values: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: (v: T) => boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 text-sm font-bold text-white/70">{label}</span>
      {values.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled?.(o.value)}
          onClick={() => onChange(o.value)}
          className={clsx("min-w-10 rounded-full px-3 py-1 text-sm font-black transition disabled:opacity-30", o.value === value ? "bg-gold text-ink" : "bg-white/10 text-white hover:bg-white/20")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * RIVINCITA (a partita finita): stessa lobby, stesso codice e QR, giocatori già dentro,
 * domande nuove. Con un clic con le stesse impostazioni, oppure cambiandole al volo.
 */
export function RematchControls({ sessionId, onStarted, size = "lg" }: { sessionId: string; onStarted: (newSessionId: string) => void; size?: "lg" | "tv" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [opts, setOpts] = useState<Options | null>(null);

  async function openEdit() {
    setEdit((e) => !e);
    if (opts) return;
    try {
      const r = await api<{ options: Options | null }>(`/api/gioca/games/${sessionId}/rivincita`);
      setOpts(r.options ?? { totalQuestions: 15, rounds: 3, mix: "bilanciata" });
    } catch {
      setOpts({ totalQuestions: 15, rounds: 3, mix: "bilanciata" });
    }
  }

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ sessionId: string }>(`/api/gioca/games/${sessionId}/rivincita`, { method: "POST", json: edit && opts ? opts : {}, timeoutMs: 30000 });
      onStarted(r.sessionId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Rivincita non riuscita, riprova");
      setBusy(false);
    }
  }

  const maxR = opts ? maxRoundsFor(opts.totalQuestions) : PUBLIC_MAX_ROUNDS;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void go()}
          className={clsx("qz-play rounded-full bg-gold font-display text-ink transition hover:bg-white disabled:opacity-60", size === "tv" ? "px-9 py-4 text-3xl" : "px-8 py-4 text-2xl")}
        >
          {busy ? "PREPARO…" : "↻ RIVINCITA"}
        </button>
        <button type="button" aria-expanded={edit} onClick={() => void openEdit()} className="rounded-full px-3 py-2 text-sm font-bold text-white/80 underline-offset-4 hover:text-white hover:underline">
          {edit ? "Stesse impostazioni" : "Cambia impostazioni"}
        </button>
      </div>
      <p className="text-sm font-bold text-white/75">Stesso QR e stesso codice: chi è collegato resta dentro. Domande nuove.</p>
      {edit && opts && (
        <div className="flex flex-col gap-2 rounded-2xl bg-black/30 p-3">
          <Pills
            label="Domande"
            values={PUBLIC_TOTAL_OPTIONS.map((n) => ({ value: n as number, label: String(n) }))}
            value={opts.totalQuestions}
            onChange={(n) => setOpts({ ...opts, totalQuestions: n, rounds: Math.min(opts.rounds, maxRoundsFor(n)) })}
          />
          <Pills
            label="Round"
            values={Array.from({ length: PUBLIC_MAX_ROUNDS }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
            value={opts.rounds}
            onChange={(n) => setOpts({ ...opts, rounds: n })}
            disabled={(n) => n > maxR}
          />
          <Pills label="Difficoltà" values={MIXES} value={opts.mix} onChange={(m) => setOpts({ ...opts, mix: m })} />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-[#ffb3c1]">
          {error}
        </p>
      )}
    </div>
  );
}
