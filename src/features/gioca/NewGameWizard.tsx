"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScreenChoiceField } from "@/features/display/TvScreenControls";
import { defaultRoundsFor, maxRoundsFor, PUBLIC_MAX_ROUNDS, PUBLIC_TOTAL_OPTIONS, type QuotaInfo } from "@/lib/game-engine/public-game";
import { freeGameHighlights } from "@/lib/game-engine/free-game";
import { beginTvLaunch, cancelTvLaunch, completeTvLaunch } from "./launch";
import { useDeviceKind } from "./use-device";

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
  // dal telefono (o tablet) si sceglie DOPO dove giocare: televisore o questo telefono
  const handheld = useDeviceKind() === "handheld";
  // dal PC: in salotto col TV (predefinito) oppure ONLINE, ognuno dal suo dispositivo
  const [where, setWhere] = useState<"tv" | "online">("tv");

  function pickTotal(t: number) {
    setTotal(t);
    setRounds((r) => Math.min(r, maxRoundsFor(t)));
  }

  async function create() {
    setBusy(true);
    setError(null);
    if (handheld) {
      await createFromPhone();
      return;
    }
    if (where === "online") {
      await createOnline();
      return;
    }
    // TV dritto dopo la creazione: finestra sull'altro schermo o schermo intero qui (serve questo clic)
    const launch = await beginTvLaunch();
    try {
      const r = await fetch("/api/gioca/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ totalQuestions: total, rounds, mix }) });
      const d = (await r.json().catch(() => null)) as { sessionId?: string; error?: { message?: string } } | null;
      if (!r.ok || !d?.sessionId) {
        cancelTvLaunch(launch);
        setError(d?.error?.message ?? "Creazione non riuscita, riprova");
        setBusy(false);
        return;
      }
      router.push(completeTvLaunch(launch, d.sessionId));
    } catch {
      cancelTvLaunch(launch);
      setError("Connessione assente, riprova");
      setBusy(false);
    }
  }

  /** ONLINE dal PC: niente TV; lo show (orizzontale) si apre qui e l'host gioca da questa finestra. */
  async function createOnline() {
    try {
      const r = await fetch("/api/gioca/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ totalQuestions: total, rounds, mix }) });
      const d = (await r.json().catch(() => null)) as { sessionId?: string; error?: { message?: string } } | null;
      if (!r.ok || !d?.sessionId) {
        setError(d?.error?.message ?? "Creazione non riuscita, riprova");
        setBusy(false);
        return;
      }
      router.push(`/gioca/online/${d.sessionId}`);
    } catch {
      setError("Connessione assente, riprova");
      setBusy(false);
    }
  }

  /** Telefono: niente finestre né schermo intero adesso; dopo la creazione la scelta TV / telefono. */
  async function createFromPhone() {
    try {
      const r = await fetch("/api/gioca/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ totalQuestions: total, rounds, mix }) });
      const d = (await r.json().catch(() => null)) as { sessionId?: string; error?: { message?: string } } | null;
      if (!r.ok || !d?.sessionId) {
        setError(d?.error?.message ?? "Creazione non riuscita, riprova");
        setBusy(false);
        return;
      }
      router.push(`/gioca/schermo/${d.sessionId}`);
    } catch {
      setError("Connessione assente, riprova");
      setBusy(false);
    }
  }

  const perRound = Math.floor(total / rounds);
  return (
    <form
      className="flex flex-col gap-8 rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8 sm:p-8"
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
      {handheld ? (
        <p className="rounded-2xl bg-white/6 px-4 py-3 text-sm font-bold text-white/80">
          📺 Dopo scegli dove giocare: sul <span className="text-white">televisore</span> (il telefono fa da telecomando) oppure tutto su <span className="text-white">questo telefono</span>.
        </p>
      ) : (
        <>
          <fieldset>
            <legend className="text-lg font-black text-white">Dove si gioca?</legend>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {(
                [
                  ["tv", "📺 Sul TV, in salotto", "Lo show va sul televisore (o su questo schermo), gli amici rispondono dal telefono con un nickname."],
                  ["online", "🌐 ONLINE — ognuno gioca dal suo dispositivo", "PC, telefono o tablet, anche a distanza: lo show è su ogni schermo e tu giochi da qui. Ognuno entra con il suo account."],
                ] as const
              ).map(([v, title, hint]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={where === v}
                  onClick={() => setWhere(v)}
                  className={clsx(
                    "flex flex-col gap-1 rounded-2xl p-4 text-left ring-2 transition outline-none focus-visible:ring-4 focus-visible:ring-cyan",
                    where === v ? "bg-gold/15 ring-gold" : "bg-coal-3 ring-transparent hover:bg-coal-4",
                  )}
                >
                  <span className="font-display text-2xl leading-tight text-white">{title}</span>
                  <span className="text-sm font-bold text-white/75">{hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {where === "tv" ? (
            <ScreenChoiceField tone="public" />
          ) : (
            <p className="rounded-2xl bg-white/6 px-4 py-3 text-sm font-bold text-white/80">
              🎥 Fai una diretta? Dalla partita apri la <span className="text-white">Vista per la LIVE</span>: lo show pulito da catturare con OBS o TikTok LIVE Studio, senza codice né risposte in anticipo.
            </p>
          )}
        </>
      )}
      <div className="flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base font-bold text-white/85">
          {rounds} {rounds === 1 ? "round" : "round"} da {perRound}
          {total % rounds ? "–" + (perRound + 1) : ""} domande · circa {estimateMinutes(total)} minuti
          <span className="block text-sm text-white/70">{freeGameHighlights(rounds)}</span>
          {quota.remaining !== null && (
            <span className="block text-sm text-white/70">
              {quota.remaining === 1 ? "Ti resta 1 partita" : `Ti restano ${quota.remaining} partite`}
            </span>
          )}
        </p>
        <button type="submit" disabled={busy} className="qz-play h-16 w-full shrink-0 whitespace-nowrap rounded-full bg-gold px-10 font-display text-3xl text-ink transition hover:bg-white disabled:opacity-60 sm:w-auto">
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
