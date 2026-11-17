"use client";

import { clsx } from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import { isTypingTarget } from "@/features/shared/keyboard";
import type { TvGameProps } from "../ui-contract";
import { Icon, type IconName } from "../kit/icons";
import { Eyebrow, Panel } from "../kit/ui";

/**
 * Pezzi comuni delle schermate della MANCHE 3 «IL PUB DECIDE!» (solo per le meccaniche nuove di questa manche).
 * Stessi colori e caratteri del kit: lime #c6ff3d, rosso #ff3b4e, notte #0b0d12.
 */

export type TvTeams = TvGameProps["teams"];

/** Tavoli per id (numero, colore, nome scritto dai giocatori: in TV si usa solo il numero). */
export function teamMap(teams: TvTeams) {
  return new Map(teams.map((t) => [t.teamId, t]));
}

/** Tessera del tavolo: numero su colore del tavolo. */
export function TableChip({ tableNo, color, tv = false, className }: { tableNo: number | string; color?: string; tv?: boolean; className?: string }) {
  return (
    <span
      className={clsx("tg-num inline-grid shrink-0 place-items-center text-[#0b0d12]", tv ? "h-[2.4cqw] min-w-[2.4cqw] rounded-[0.5cqw] px-[0.3cqw] text-[1.4cqw]" : "h-8 min-w-8 rounded-lg px-1 text-lg", className)}
      style={{ background: color ?? "#eef2f6" }}
      aria-label={`Tavolo ${tableNo}`}
    >
      {tableNo}
    </span>
  );
}

/** Passo numerato di una scelta in più tempi (con spunta quando è fatto). */
export function Step({ n, title, done, children, className }: { n: number; title: ReactNode; done?: boolean; children: ReactNode; className?: string }) {
  return (
    <Panel className={clsx("flex flex-col gap-2", className)}>
      <Eyebrow className={clsx("flex items-center gap-2", done && "text-[#c6ff3d]")}>
        <span className={clsx("tg-num grid h-5 w-5 place-items-center rounded text-xs", done ? "bg-[#c6ff3d] text-[#0b0d12]" : "bg-white/15 text-white")}>{done ? <Icon name="check" className="h-3.5 w-3.5" /> : n}</span>
        {title}
      </Eyebrow>
      {children}
    </Panel>
  );
}

/** Domanda/proposta grande in testa alla schermata del telefono. */
export function PromptCard({ eyebrow, children, icon }: { eyebrow?: ReactNode; children: ReactNode; icon?: IconName }) {
  return (
    <Panel className="flex items-start gap-3">
      {icon && <Icon name={icon} className="mt-0.5 h-7 w-7 shrink-0 text-[#c6ff3d]" />}
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
        <p className="text-xl font-extrabold leading-snug">{children}</p>
      </div>
    </Panel>
  );
}

/**
 * Cursore di percentuale 0–100 (telefono e PC): pulsanti ±5, scorciatoie (frecce ±1, Pagina su/giù ±10).
 * Il valore è sempre scritto in grande: il colore non è mai l'unico segnale.
 */
export function PercentPicker({ value, onChange, disabled = false, label, onEnter }: { value: number | null; onChange: (v: number) => void; disabled?: boolean; label: string; onEnter?: () => void }) {
  const ref = useRef({ value, onChange, onEnter });
  useEffect(() => {
    ref.current = { value, onChange, onEnter };
  });
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || isTypingTarget(e.target)) return;
      const v = ref.current.value ?? 50;
      const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "PageUp" ? 10 : e.key === "PageDown" ? -10 : 0;
      if (step) {
        e.preventDefault();
        ref.current.onChange(Math.max(0, Math.min(100, v + step)));
      } else if (e.key === "Enter" && !(e.target as HTMLElement)?.closest?.("button")) {
        ref.current.onEnter?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled]);
  const v = value ?? 50;
  const set = (n: number) => onChange(Math.max(0, Math.min(100, Math.round(n))));
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#9aa4b2]">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" disabled={disabled || v <= 0} onClick={() => set(v - 5)} className="tg-num grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/10 text-3xl disabled:opacity-30" aria-label="Meno 5">
          −5
        </button>
        <div className="flex-1 text-center" aria-live="polite">
          <span className={clsx("tg-num text-7xl leading-none", value === null ? "text-white/30" : "text-[#c6ff3d]")}>{value === null ? "?" : v}</span>
          <span className="tg-display ml-1 text-3xl text-white/60">%</span>
        </div>
        <button type="button" disabled={disabled || v >= 100} onClick={() => set(v + 5)} className="tg-num grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/10 text-3xl disabled:opacity-30" aria-label="Più 5">
          +5
        </button>
      </div>
      <input
        type="range"
        className="tg-range"
        min={0}
        max={100}
        step={1}
        value={v}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={`${v} per cento`}
        style={{ ["--tg-fill" as string]: `${v}%` }}
      />
      <div className="grid grid-cols-5 gap-2">
        {[0, 25, 50, 75, 100].map((p) => (
          <button key={p} type="button" disabled={disabled} onClick={() => set(p)} className={clsx("tg-num h-11 rounded-lg border text-xl", value === p ? "border-[#c6ff3d] text-[#c6ff3d]" : "border-white/12 text-white/80")}>
            {p}%
          </button>
        ))}
      </div>
      <p className="hidden text-center text-xs font-semibold text-[#9aa4b2] lg:block">Frecce: ±1 · Pagina su/giù: ±10 · Invio: conferma</p>
    </div>
  );
}

/** Timbro grande del reveal in TV (es. «IL PUB HA TORTO!»). */
export function TvStamp({ children, tone = "lime", sub, size = "lg" }: { children: ReactNode; tone?: "lime" | "red" | "ice"; sub?: ReactNode; size?: "sm" | "lg" }) {
  const color = tone === "red" ? "#ff3b4e" : tone === "ice" ? "#eef2f6" : "#c6ff3d";
  return (
    <div className="tg-pop flex flex-col items-center gap-[0.4cqw] text-center">
      <p className={clsx("tg-display -rotate-2 rounded-[0.8cqw] border-[0.35cqw] leading-none", size === "sm" ? "px-[1.1cqw] py-[0.4cqw] text-[2.7cqw]" : "px-[1.6cqw] py-[0.6cqw] text-[4.4cqw]")} style={{ borderColor: color, color }}>
        {children}
      </p>
      {sub && <p className="text-[1.5cqw] font-bold text-white/80">{sub}</p>}
    </div>
  );
}

/** Spiegazione del reveal in TV in formato compatto (per colonne strette). */
export function TvExplainCompact({ text, className, title = "Perché" }: { text: string; className?: string; title?: string }) {
  return (
    <div className={clsx("tg-glass tg-rise min-h-0 overflow-hidden rounded-[1.6cqw] p-[1.4cqw]", className)}>
      <p className="mb-[0.3cqw] text-[0.95cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">{title}</p>
      <p className="text-[1.3cqw] font-semibold leading-snug text-white/90">{text}</p>
    </div>
  );
}

/** Messaggio centrale della TV durante la prova (niente soluzioni). */
export function TvWaiting({ icon, title, children }: { icon: IconName; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1cqw] text-center">
      <Icon name={icon} className="h-[7cqw] w-[7cqw] text-[#c6ff3d]" />
      <p className="tg-display text-[3.6cqw]">{title}</p>
      {children && <div className="max-w-[60cqw] text-[1.6cqw] font-bold leading-snug text-white/75">{children}</div>}
    </div>
  );
}

/** Barra orizzontale semplice (percentuale scritta accanto). */
export function MiniBar({ pct, win = false, tv = false, label }: { pct: number; win?: boolean; tv?: boolean; label?: ReactNode }) {
  return (
    <div className={clsx("relative overflow-hidden", tv ? "h-[2.4cqw] rounded-[0.5cqw]" : "h-8 rounded-lg", "bg-white/[0.07]")}>
      <div className={clsx("absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out", win ? "bg-[#c6ff3d]/40" : "bg-white/15")} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} aria-hidden />
      <div className={clsx("relative flex h-full items-center justify-between gap-2", tv ? "px-[0.7cqw] text-[1.2cqw]" : "px-2.5 text-sm")}>
        <span className="min-w-0 truncate font-extrabold">{label}</span>
        <span className={clsx("tg-num shrink-0", tv ? "text-[1.5cqw]" : "text-lg", win && "text-[#c6ff3d]")}>{pct}%</span>
      </div>
    </div>
  );
}
