"use client";

import { clsx } from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import type { Option } from "@/lib/tig/games/components/choice";
import { isTypingTarget, useAnswerKeys } from "@/features/shared/keyboard";
import { Icon } from "./icons";
import { OptionButton, revealState, type OptionState } from "./ui";

/**
 * Componenti d'ingresso riutilizzabili dai minigiochi (telefono e PC): scelta singola/multipla con i tasti
 * 1–9 e Invio, tastierino di cifre (anche da tastiera), numero libero, riordino, puntata, interruttori.
 */

// ---------------------------------------------------------------------------
// Scelta
// ---------------------------------------------------------------------------

export function ChoiceList({
  options,
  picked,
  onToggle,
  multi = false,
  disabled = false,
  keys = true,
  onConfirm,
  reveal,
  big = false,
  label,
}: {
  options: readonly Option[];
  picked: readonly string[];
  onToggle: (id: string) => void;
  multi?: boolean;
  disabled?: boolean;
  /** scorciatoie 1–9 attive (una sola lista per schermata) */
  keys?: boolean;
  onConfirm?: (() => void) | null;
  reveal?: { solution: readonly string[] } | null;
  big?: boolean;
  label?: string;
}) {
  useAnswerKeys({ enabled: keys && !disabled && !reveal, count: Math.min(9, options.length), onPick: (i) => onToggle(options[i].id), onConfirm: onConfirm ?? null });
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      {options.map((o, i) => {
        const state: OptionState = reveal ? revealState(o.id, reveal.solution, picked) : picked.includes(o.id) ? "picked" : "idle";
        return <OptionButton key={o.id} index={i} text={o.text} state={state} multi={multi} big={big} disabled={disabled || !!reveal} onClick={() => onToggle(o.id)} />;
      })}
    </div>
  );
}

/** Aggiorna una selezione singola o multipla. */
export function toggleId(list: readonly string[], id: string, multi: boolean): string[] {
  if (!multi) return [id];
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

// ---------------------------------------------------------------------------
// Tastierino di cifre (codici)
// ---------------------------------------------------------------------------

export function DigitPad({
  value,
  length,
  onChange,
  disabled = false,
  onEnter,
  reveal,
}: {
  value: string;
  length: number;
  onChange: (v: string) => void;
  disabled?: boolean;
  onEnter?: () => void;
  /** al reveal: cifre giuste */
  reveal?: string | null;
}) {
  const valueRef = useRef(value);
  const cbRef = useRef({ onChange, onEnter });
  useEffect(() => {
    valueRef.current = value;
    cbRef.current = { onChange, onEnter };
  });
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || isTypingTarget(e.target)) return;
      const v = valueRef.current;
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code) ?? (/^\d$/.test(e.key) ? [e.key, e.key] : null);
      if (m) {
        e.preventDefault();
        if (v.length < length) cbRef.current.onChange(v + m[1]);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        cbRef.current.onChange(v.slice(0, -1));
      } else if (e.key === "Enter" && !(e.target as HTMLElement)?.closest?.("button")) {
        e.preventDefault();
        cbRef.current.onEnter?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, length]);

  const press = (d: string) => {
    if (disabled) return;
    if (d === "del") onChange(value.slice(0, -1));
    else if (value.length < length) onChange(value + d);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center gap-2" aria-label={`Codice: ${value.split("").join(" ") || "vuoto"}`} role="status">
        {Array.from({ length }, (_, i) => {
          const ch = value[i];
          const ok = reveal ? ch === reveal[i] : null;
          return (
            <div
              key={i}
              className={clsx(
                "tg-num grid h-16 w-12 place-items-center rounded-xl border-2 text-4xl sm:h-20 sm:w-16 sm:text-5xl",
                reveal ? (ok ? "border-(--tg-gold) bg-(--tg-gold)/15 text-(--tg-gold-hi)" : "tg-stripes-red border-(--tg-red-hi)") : ch ? "border-(--tg-gold) bg-(--tg-night-2) text-(--tg-cream)" : i === value.length && !disabled ? "border-(--tg-cream)/55 bg-(--tg-night-2)/60" : "border-(--tg-cream)/14 bg-(--tg-night-2)/60",
              )}
            >
              {ch ?? ""}
              {reveal && ch !== reveal[i] && <span className="sr-only">(giusta {reveal[i]})</span>}
            </div>
          );
        })}
      </div>
      {!disabled && (
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(d)}
              className={clsx(
                "tg-num flex h-14 items-center justify-center rounded-xl border border-(--tg-brass)/35 bg-[linear-gradient(180deg,rgba(26,67,84,.75),rgba(11,31,42,.9))] text-3xl text-(--tg-cream) shadow-[inset_0_1px_0_rgba(255,228,160,.12),0_3px_0_rgba(0,0,0,.45)] transition-transform active:scale-95 sm:h-16",
                d === "0" && "col-start-2",
              )}
              aria-label={d === "del" ? "Cancella" : d}
            >
              {d === "del" ? <Icon name="back" className="h-7 w-7" /> : d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Numero libero
// ---------------------------------------------------------------------------

export function NumberField({
  value,
  onChange,
  maxDigits = 4,
  unit,
  disabled = false,
  onEnter,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  maxDigits?: number;
  unit?: string;
  disabled?: boolean;
  onEnter?: () => void;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-(--tg-mute)">{label}</span>
      <span className="flex items-center gap-3 rounded-2xl border-2 border-(--tg-cream)/16 bg-(--tg-night-2)/80 px-4 shadow-[inset_0_2px_8px_rgba(0,0,0,.45)] focus-within:border-(--tg-gold)">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxDigits))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter?.();
          }}
          placeholder="0"
          className="tg-num h-20 min-w-0 flex-1 bg-transparent text-6xl text-(--tg-cream) outline-none placeholder:text-(--tg-cream)/20"
        />
        {unit && <span className="tg-display text-2xl text-(--tg-cream)/65">{unit}</span>}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Riordino
// ---------------------------------------------------------------------------

export function ReorderList({
  items,
  order,
  onChange,
  disabled = false,
  reveal,
}: {
  items: readonly Option[];
  order: readonly string[];
  onChange: (o: string[]) => void;
  disabled?: boolean;
  /** al reveal: ordine giusto */
  reveal?: readonly string[] | null;
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const o = order.slice();
    const [x] = o.splice(from, 1);
    o.splice(to, 0, x);
    onChange(o);
  };
  return (
    <ol className="flex flex-col gap-2" aria-label="Ordine scelto, dal primo all'ultimo">
      {order.map((id, i) => {
        const ok = reveal ? reveal[i] === id : null;
        return (
          <li
            key={id}
            className={clsx(
              "flex items-center gap-2 rounded-2xl border-2 py-2 pl-2 pr-1 transition-[border-color,background-color] duration-200",
              ok === true && "border-(--tg-gold) bg-(--tg-gold)/10",
              ok === false && "tg-stripes-red border-(--tg-red-hi)",
              ok === null && "border-(--tg-cream)/14 bg-(--tg-cream)/[0.05]",
            )}
          >
            <span className="tg-num grid h-10 w-10 shrink-0 place-items-center rounded-full border border-(--tg-brass)/50 bg-(--tg-night-2) text-2xl text-(--tg-gold-hi)">{i + 1}</span>
            <span className="min-w-0 flex-1 text-base font-bold leading-snug sm:text-lg">{byId.get(id)?.text}</span>
            {ok !== null && <Icon name={ok ? "check" : "x"} className={clsx("h-6 w-6 shrink-0", ok ? "text-(--tg-gold-hi)" : "text-(--tg-red-hi)")} />}
            {!disabled && !reveal && (
              <span className="flex shrink-0 flex-col gap-1">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="grid h-9 w-11 place-items-center rounded-lg border border-(--tg-brass)/35 bg-(--tg-raised) disabled:opacity-25" aria-label={`Sposta su: ${byId.get(id)?.text}`}>
                  <Icon name="up" className="h-6 w-6" />
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} className="grid h-9 w-11 place-items-center rounded-lg border border-(--tg-brass)/35 bg-(--tg-raised) disabled:opacity-25" aria-label={`Sposta giù: ${byId.get(id)?.text}`}>
                  <Icon name="down" className="h-6 w-6" />
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Puntata / offerta
// ---------------------------------------------------------------------------

export function AmountPicker({
  value,
  max,
  step,
  onChange,
  disabled = false,
  unit = "punti",
  presets,
  label,
}: {
  value: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  unit?: string;
  presets?: number[];
  label: string;
}) {
  const fill = max > 0 ? (value / max) * 100 : 0;
  const set = (v: number) => onChange(Math.max(0, Math.min(max, Math.round(v / step) * step)));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-(--tg-mute)">{label}</span>
        <span className="text-sm font-bold text-(--tg-cream)/65">max {max}</span>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={disabled || value <= 0} onClick={() => set(value - step)} className="tg-num grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-(--tg-brass)/60 bg-(--tg-raised) text-4xl text-(--tg-gold-hi) disabled:opacity-30" aria-label={`Meno ${step}`}>
          −
        </button>
        <div className="flex-1 text-center" aria-live="polite">
          <span className="tg-num text-7xl leading-none text-(--tg-gold-hi)">{value}</span>
          <span className="tg-display ml-2 text-2xl text-(--tg-cream)/65">{unit}</span>
        </div>
        <button type="button" disabled={disabled || value >= max} onClick={() => set(value + step)} className="tg-num grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-(--tg-brass)/60 bg-(--tg-raised) text-4xl text-(--tg-gold-hi) disabled:opacity-30" aria-label={`Più ${step}`}>
          +
        </button>
      </div>
      <input
        type="range"
        className="tg-range"
        min={0}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
        style={{ ["--tg-fill" as string]: `${fill}%` }}
      />
      {presets && (
        <div className="grid grid-cols-4 gap-2">
          {presets.map((p) => (
            <button key={p} type="button" disabled={disabled} onClick={() => set(p)} className={clsx("tg-num h-11 rounded-lg border text-xl", value === p ? "border-(--tg-gold) bg-(--tg-gold)/10 text-(--tg-gold-hi)" : "border-(--tg-cream)/14 text-(--tg-cream)/85")}>
              {p === 0 ? "Zero" : p === max ? "Max" : p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interruttore a due/tre opzioni grandi (rischio, ramo, coopera/compete)
// ---------------------------------------------------------------------------

export function BigToggle<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  label,
}: {
  options: { id: T; title: string; sub?: ReactNode; tone?: "lime" | "red" | "ice"; icon?: Parameters<typeof Icon>[0]["name"] }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx("grid gap-2", options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {options.map((o) => {
        const on = value === o.id;
        const accent = o.tone === "red" ? "var(--tg-red-hi)" : o.tone === "ice" ? "var(--tg-cream)" : "var(--tg-gold)";
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={clsx("relative flex min-h-24 flex-col items-start justify-between gap-1 rounded-2xl border-2 p-3 text-left transition-transform active:scale-[0.98]", on ? "tg-picked" : "border-(--tg-cream)/14 bg-(--tg-cream)/[0.05]")}
            style={on ? { borderColor: accent } : undefined}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className={clsx("tg-display leading-[0.95]", o.title.length > 12 ? "text-[1.55rem]" : "text-3xl")} style={on ? { color: accent } : undefined}>
                {o.title}
              </span>
              {o.icon && <Icon name={o.icon} className="h-7 w-7 opacity-80" />}
            </span>
            {o.sub && <span className="text-sm font-bold leading-snug text-(--tg-cream)/85">{o.sub}</span>}
            {on && <Icon name="check" className="absolute bottom-2 right-2 h-6 w-6" />}
            <span className="sr-only">{on ? " · selezionato" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}
