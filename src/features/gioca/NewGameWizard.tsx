"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScreenChoiceField } from "@/features/display/TvScreenControls";
import { defaultRoundsFor, maxRoundsFor, PUBLIC_MAX_ROUNDS, PUBLIC_TOTAL_OPTIONS, type QuotaInfo } from "@/lib/game-engine/public-game";

const MIXES = [
  { value: "facile", label: "Facile" },
  { value: "bilanciata", label: "Bilanciata" },
  { value: "difficile", label: "Difficile" },
] as const;
type Mix = (typeof MIXES)[number]["value"];

/** Stima prudente: ~50 s a domanda (lettura, risposte, soluzione, punti) + 2 minuti di intro. */
export function estimateMinutes(total: number): number {
  return Math.round((total * 50 + 120) / 60 / 5) * 5;
}

function Choice<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  disabled,
  hint,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: (v: T) => boolean;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="text-lg font-black text-white">{legend}</legend>
      {hint && <p className="mt-0.5 text-sm font-bold text-white/70">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2.5">
        {options.map((o) => {
          const off = disabled?.(o.value) ?? false;
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              disabled={off}
              onClick={() => onChange(o.value)}
              className={clsx(
                "min-w-16 rounded-2xl px-5 py-3.5 font-display text-2xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30",
                on ? "bg-gold text-ink" : "bg-coal-3 text-white hover:bg-coal-4",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function NewGameWizard({ quota }: { quota: QuotaInfo }) {
  const router = useRouter();
  const [total, setTotal] = useState<number>(15);
  const [rounds, setRounds] = useState<number>(defaultRoundsFor(15));
  const [mix, setMix] = useState<Mix>("bilanciata");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxR = maxRoundsFor(total);

  function pickTotal(t: number) {
    setTotal(t);
    setRounds((r) => Math.min(r, maxRoundsFor(t)));
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/gioca/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ totalQuestions: total, rounds, mix }) });
      const d = (await r.json().catch(() => null)) as { sessionId?: string; error?: { message?: string } } | null;
      if (!r.ok || !d?.sessionId) {
        setError(d?.error?.message ?? "Creazione non riuscita, riprova");
        setBusy(false);
        return;
      }
      router.push(`/gioca/partita/${d.sessionId}`);
    } catch {
      setError("Connessione assente, riprova");
      setBusy(false);
    }
  }

  const perRound = Math.floor(total / rounds);
  return (
    <form
      className="mt-8 flex flex-col gap-8 rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8 md:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <Choice legend="Quante domande?" options={PUBLIC_TOTAL_OPTIONS.map((n) => ({ value: n, label: String(n) }))} value={total} onChange={pickTotal} />
      <Choice
        legend="Quanti round?"
        hint={`Almeno 3 domande per round: con ${total} domande al massimo ${maxR} ${maxR === 1 ? "round" : "round"}.${rounds > 1 ? " L'ultimo è la finale a punti doppi." : ""}`}
        options={Array.from({ length: PUBLIC_MAX_ROUNDS }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
        value={rounds}
        onChange={setRounds}
        disabled={(v) => v > maxR}
      />
      <Choice legend="Difficoltà" options={MIXES} value={mix} onChange={setMix} />
      <ScreenChoiceField tone="public" />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-base font-bold text-white/85">
          {rounds} {rounds === 1 ? "round" : "round"} da {perRound}
          {total % rounds ? "–" + (perRound + 1) : ""} domande · circa {estimateMinutes(total)} minuti
          {quota.remaining !== null && (
            <span className="block text-sm text-white/70">
              {quota.remaining === 1 ? "Ti resta 1 partita" : `Ti restano ${quota.remaining} partite`}
            </span>
          )}
        </p>
        <button type="submit" disabled={busy} className="qz-play h-16 shrink-0 whitespace-nowrap rounded-full bg-gold px-10 font-display text-3xl text-ink transition hover:bg-white disabled:opacity-60">
          {busy ? "PREPARO…" : "CREA PARTITA"}
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-flame/20 px-4 py-3 font-bold text-[#ffd0d9]">
          {error}
        </p>
      )}
    </form>
  );
}
