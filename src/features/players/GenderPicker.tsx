"use client";

import { clsx } from "clsx";

/** Scelta del genere all'ingresso: "m", "f", "n" (preferisco non dirlo); null = non scelto (= non detto). */
export type GenderChoice = "m" | "f" | "n" | null;

const OPTIONS: { value: Exclude<GenderChoice, null>; label: string }[] = [
  { value: "m", label: "Maschio" },
  { value: "f", label: "Femmina" },
  { value: "n", label: "Preferisco non dirlo" },
];

/**
 * Tre pulsanti grandi, facoltativi: servono solo ai presentatori per dire "Bravo!" o "Brava!".
 * Un secondo tocco sulla stessa scelta la toglie.
 */
export function GenderPicker({ value, onChange, compact = false }: { value: GenderChoice; onChange: (v: GenderChoice) => void; compact?: boolean }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={clsx("mb-1.5 font-bold text-white/85", compact ? "text-xs" : "text-sm")}>
        Come ti chiamano i presentatori? <span className="font-normal text-white/60">(facoltativo)</span>
      </legend>
      <div className="grid grid-cols-3 gap-2" role="radiogroup">
        {OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : o.value)}
              className={clsx(
                "rounded-xl border-2 px-1 font-extrabold leading-tight transition active:scale-95",
                compact ? "min-h-10 text-[13px]" : "min-h-12 text-[15px]",
                on ? "border-cyan bg-cyan/25 text-white" : "border-white/25 bg-black/30 text-white/85",
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
