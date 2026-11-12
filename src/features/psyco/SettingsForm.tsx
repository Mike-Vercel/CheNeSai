"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { timerFromParts, timerParts } from "@/lib/psyco/logic";
import { callsOf, rulesOf, type PsycoSettings, type RuleFamily } from "@/lib/psyco/types";

/**
 * Impostazioni della manche: tempo LIBERO (minuti e secondi, o senza limite), modalità della regola
 * (automatica dall'archivio o libera, scritta dal gruppo), PSYCO a rotazione o scelto dall'host.
 * Gli esempi rapidi sono scorciatoie, non limiti.
 */
export function SettingsForm({
  initial,
  onChange,
  compact = false,
}: {
  initial: PsycoSettings;
  onChange: (s: PsycoSettings | null, error: string | null) => void;
  compact?: boolean;
}) {
  const p0 = timerParts(initial.timerMs);
  const [minutes, setMinutes] = useState(String(p0.unlimited ? 5 : p0.minutes));
  const [seconds, setSeconds] = useState(String(p0.unlimited ? 0 : p0.seconds).padStart(2, "0"));
  const [unlimited, setUnlimited] = useState(p0.unlimited);
  const [ruleMode, setRuleMode] = useState(initial.ruleMode);
  const [psycoPick, setPsycoPick] = useState(initial.psycoPick);
  const [calls, setCalls] = useState(callsOf(initial));
  const [rules, setRules] = useState<RuleFamily>(rulesOf(initial));
  const [error, setError] = useState<string | null>(null);

  function emit(next: {
    minutes?: string;
    seconds?: string;
    unlimited?: boolean;
    ruleMode?: PsycoSettings["ruleMode"];
    psycoPick?: PsycoSettings["psycoPick"];
    calls?: number;
    rules?: RuleFamily;
  }) {
    const m = next.minutes ?? minutes;
    const s = next.seconds ?? seconds;
    const u = next.unlimited ?? unlimited;
    const t = timerFromParts(m.trim() === "" ? "0" : m, s.trim() === "" ? "0" : s, u);
    const err = t.ok ? null : t.message;
    setError(err);
    onChange(
      t.ok ? { timerMs: t.ms, ruleMode: next.ruleMode ?? ruleMode, psycoPick: next.psycoPick ?? psycoPick, calls: next.calls ?? calls, rules: next.rules ?? rules } : null,
      err,
    );
  }

  const quick = [
    [1, 30],
    [3, 0],
    [5, 0],
    [7, 45],
    [12, 10],
  ] as const;

  return (
    <div className={clsx("flex flex-col", compact ? "gap-4" : "gap-6")}>
      <fieldset className="flex flex-col gap-3">
        <legend className="psy-display mb-2 text-2xl text-paper">Tempo della manche</legend>
        <div className={clsx("flex items-end gap-2", unlimited && "pointer-events-none opacity-40")} aria-disabled={unlimited}>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-paper/70">Minuti</span>
            <input
              inputMode="numeric"
              aria-label="Minuti"
              className="psy-input !w-24 text-center text-3xl"
              value={minutes}
              disabled={unlimited}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                setMinutes(v);
                emit({ minutes: v });
              }}
            />
          </label>
          <span className="psy-clock pb-3 text-4xl text-paper">:</span>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-paper/70">Secondi</span>
            <input
              inputMode="numeric"
              aria-label="Secondi"
              className="psy-input !w-24 text-center text-3xl"
              value={seconds}
              disabled={unlimited}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                setSeconds(v);
                emit({ seconds: v });
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Esempi">
          {quick.map(([m, s]) => (
            <button
              key={`${m}:${s}`}
              type="button"
              className="psy-chip"
              onClick={() => {
                setMinutes(String(m));
                setSeconds(String(s).padStart(2, "0"));
                setUnlimited(false);
                emit({ minutes: String(m), seconds: String(s), unlimited: false });
              }}
            >
              {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-3 font-extrabold text-paper">
          <input
            type="checkbox"
            className="h-6 w-6 accent-[#e0161f]"
            checked={unlimited}
            onChange={(e) => {
              setUnlimited(e.target.checked);
              emit({ unlimited: e.target.checked });
            }}
          />
          SENZA LIMITE DI TEMPO
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-blood/20 px-3 py-2 text-sm font-bold text-[#ffd0d3]">
            {error}
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="psy-display mb-2 text-2xl text-paper">Come si sceglie la regola</legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Modalità della regola">
          {(
            [
              ["auto", "AUTOMATICA", "Il sito propone regole pronte (facili, medie o difficili): il gruppo vota se tenerle o cambiarle."],
              ["free", "LIBERA", "Chi conosce la regola la inventa: ognuno propone, poi si vota la migliore."],
            ] as const
          ).map(([v, label, desc]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={ruleMode === v}
              onClick={() => {
                setRuleMode(v);
                emit({ ruleMode: v });
              }}
              className={clsx("rounded-2xl p-4 text-left transition", ruleMode === v ? "psy-paper" : "bg-white/6 ring-1 ring-white/15 hover:bg-white/10")}
            >
              <span className={clsx("psy-display block text-2xl", ruleMode === v ? "text-[#8e0b12]" : "text-paper")}>{label}</span>
              <span className={clsx("mt-1 block text-sm font-bold", ruleMode === v ? "text-[#4a3220]" : "text-paper/75")}>{desc}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="psy-display mb-2 text-2xl text-paper">Che regole</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Famiglia delle regole">
          {(
            [
              ["tutte", "TUTTE", "Classiche e di verità o falsità, mescolate."],
              ["classiche", "CLASSICHE", "Parole, gesti, lettere: come si risponde."],
              ["verita", "VERITÀ O FALSITÀ", "Quando si dice il vero e quando si mente: «chi dice la verità si gratta», «primo giro tutte bugie»…"],
            ] as const
          ).map(([v, label, desc]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={rules === v}
              onClick={() => {
                setRules(v);
                emit({ rules: v });
              }}
              className={clsx("relative rounded-2xl p-4 text-left transition", rules === v ? "psy-paper" : "bg-white/6 ring-1 ring-white/15 hover:bg-white/10")}
            >
              {v === "verita" && <span className="absolute right-3 top-3 rounded-full bg-blood px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-white">Nuovo</span>}
              <span className={clsx("psy-display block pr-10 text-xl", rules === v ? "text-[#8e0b12]" : "text-paper")}>{label}</span>
              <span className={clsx("mt-1 block text-sm font-bold", rules === v ? "text-[#4a3220]" : "text-paper/75")}>{desc}</span>
            </button>
          ))}
        </div>
        {ruleMode === "free" && rules === "verita" && (
          <p className="text-sm font-bold text-lamp">Con la regola LIBERA il gruppo la inventa: vi suggeriremo esempi di verità o falsità.</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="psy-display mb-2 text-2xl text-paper">Chi fa lo PSYCO</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Scelta dello PSYCO">
          {(
            [
              ["auto", "A rotazione (consigliato)"],
              ["manual", "Lo scelgo io a ogni manche"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={psycoPick === v}
              onClick={() => {
                setPsycoPick(v);
                emit({ psycoPick: v });
              }}
              className={clsx("psy-chip", psycoPick === v && "!bg-paper !text-[#2a1a10]")}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="psy-display mb-2 text-2xl text-paper">📞 Chiamate all&apos;Investigatore</legend>
        <p className="text-sm font-bold text-paper/70">Quante volte, in ogni manche, lo PSYCO può chiamare l&apos;Investigatore per un indizio (ogni chiamata è più chiara della precedente). Il timer non si ferma.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Chiamate all'Investigatore per manche">
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={calls === n}
              onClick={() => {
                setCalls(n);
                emit({ calls: n });
              }}
              className={clsx("psy-chip min-w-14 justify-center", calls === n && "!bg-paper !text-[#2a1a10]")}
            >
              {n === 0 ? "Nessuna" : n}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
