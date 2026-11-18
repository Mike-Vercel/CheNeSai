"use client";

import { clsx } from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import { isTypingTarget } from "@/features/shared/keyboard";
import type { TvGameProps } from "../ui-contract";
import { Icon, type IconName } from "../kit/icons";
import { CrewFlag } from "../kit/ornaments";
import { Eyebrow, Panel } from "../kit/ui";

/**
 * Pezzi comuni delle schermate della MANCHE 3 «IL PUB DECIDE!» (solo per le meccaniche nuove di questa manche),
 * nello stile TAVERNA DEI PIRATI: oro = scelte, vincitori e punti; turchese = accento; rosso bandiera = errori;
 * pergamena con inchiostro scuro = titoli e spiegazioni. Titoli in Pirata One (`tg-title`, mai in maiuscolo),
 * etichette e numeri in Grenze (`tg-display`/`tg-num`), testi in Manrope.
 */

export type TvTeams = TvGameProps["teams"];

/**
 * Fondo «alla luce della lanterna» per ciò che vince o è confermato: l'oro trasparente sopra il blu del mare
 * diventerebbe verde oliva, quindi si usa l'oro scuro e caldo del tema con il bordo d'oro.
 */
export const LIT = "border-(--tg-gold) bg-(--tg-gold-dark)/85";

/** Bandiera della ciurma (colore del tavolo, numero inciso) per le righe della TV. */
export function CrewTag({ tableNo, color, className }: { tableNo: number | string; color?: string; className?: string }) {
  return (
    <span className={clsx("inline-flex shrink-0", className)} aria-label={`Tavolo ${tableNo}`} role="img">
      <CrewFlag color={color ?? "var(--tg-cream)"} n={tableNo} className="h-full w-auto" />
    </span>
  );
}

/**
 * Cartiglio di pergamena con un titolo in Pirata One (temi, situazioni, cose da aprire): stesso materiale
 * dell'intestazione della prova. `eyebrow` è la riga piccola sopra, `aside` sta a destra (es. «Codice di 4 cifre»).
 */
export function ThemeBanner({ eyebrow, title, aside, tv = false, size = "md", className }: { eyebrow?: ReactNode; title: ReactNode; aside?: ReactNode; tv?: boolean; size?: "sm" | "md"; className?: string }) {
  return (
    <div className={clsx("tg-parch flex items-center", tv ? "gap-[1.2cqw] px-[1.6cqw] py-[0.8cqw]" : "gap-3 px-4 py-3", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className={clsx("font-extrabold uppercase tracking-[0.18em] text-(--tg-burnt-ink)", tv ? "text-[0.95cqw]" : "text-[11px]")}>{eyebrow}</p>}
        <p className={clsx("tg-title text-(--tg-ink)", tv ? (size === "sm" ? "text-[2.4cqw]" : "text-[3cqw]") : size === "sm" ? "text-[1.6rem]" : "text-[1.9rem]")}>{title}</p>
      </div>
      {aside && <div className={clsx("shrink-0 text-right font-extrabold text-(--tg-burnt-ink)", tv ? "text-[1.2cqw]" : "text-xs")}>{aside}</div>}
    </div>
  );
}

/** «1 tavolo», «3 tavoli» (anche con un tavolo solo la frase resta giusta). */
export const nTavoli = (n: number) => `${n} ${n === 1 ? "tavolo" : "tavoli"}`;

/**
 * Due scelte grandi affiancate (sì/no, istinto/gregge…). L'icona sta in una riga sua con la spunta, così il titolo
 * ha tutta la larghezza; il corpo è lo stesso per entrambe e si adatta alla parola più lunga rispetto alla
 * larghezza vera del riquadro (unità cqi): il Grenze è largo e le parole non vanno mai spezzate a metà.
 */
export function DuoToggle<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  label,
}: {
  options: { id: T; title: string; sub?: ReactNode; tone?: "gold" | "red" | "teal"; icon?: IconName }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  const longest = Math.max(...options.map((o) => Math.max(...o.title.split(/\s+/).map((w) => w.length))));
  const total = Math.max(...options.map((o) => o.title.length));
  // maiuscole Grenze: al massimo ~0,75 em a lettera; frasi lunghe un po' più piccole per stare su due righe
  const cap = total > 16 ? 1.25 : total > 11 ? 1.45 : 1.6;
  const fontSize = `clamp(1rem, ${(100 / (0.75 * longest)).toFixed(2)}cqi, ${cap}rem)`;
  const icons = options.some((o) => o.icon);
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const on = value === o.id;
        const accent = o.tone === "red" ? "var(--tg-red-hi)" : o.tone === "teal" ? "var(--tg-teal-hi)" : "var(--tg-gold-hi)";
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={clsx(
              "relative flex min-h-[5.5rem] flex-col items-stretch justify-center gap-1 rounded-2xl border-2 px-3 py-2.5 text-left transition-[transform,border-color] active:scale-[0.98]",
              on ? "tg-picked shadow-[0_0_24px_-10px_rgba(242,177,52,.8)]" : "border-(--tg-cream)/14 bg-(--tg-cream)/[0.05]",
              disabled && !on && "opacity-60",
            )}
            style={on ? { borderColor: accent } : undefined}
          >
            {icons ? (
              <span className="flex h-6 items-center justify-between" style={on ? { color: accent } : undefined}>
                {o.icon ? <Icon name={o.icon} className="h-6 w-6 shrink-0" /> : <span />}
                {on && <Icon name="check" className="h-5 w-5 shrink-0" />}
              </span>
            ) : (
              on && <Icon name="check" className="absolute right-2 top-2 h-5 w-5" />
            )}
            <span className={clsx("@container block w-full", !icons && "pr-5")}>
              <span className="tg-display block break-words leading-[1.05]" style={{ fontSize, color: on ? accent : undefined }}>
                {o.title}
              </span>
            </span>
            {o.sub && <span className="text-[13px] font-bold leading-snug text-(--tg-cream)/80">{o.sub}</span>}
            <span className="sr-only">{on ? " · selezionato" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Tavoli per id (numero, colore, nome scritto dai giocatori: in TV si usa solo il numero). */
export function teamMap(teams: TvTeams) {
  return new Map(teams.map((t) => [t.teamId, t]));
}

/** Tessera del tavolo: numero su colore del tavolo. */
export function TableChip({ tableNo, color, tv = false, className }: { tableNo: number | string; color?: string; tv?: boolean; className?: string }) {
  return (
    <span
      className={clsx("tg-num inline-grid shrink-0 place-items-center text-(--tg-ink)", tv ? "h-[2.4cqw] min-w-[2.4cqw] rounded-[0.5cqw] px-[0.3cqw] text-[1.4cqw]" : "h-8 min-w-8 rounded-lg px-1 text-lg", className)}
      style={{ background: color ?? "var(--tg-cream)" }}
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
      <Eyebrow className={clsx("flex items-center gap-2", done && "text-(--tg-gold)")}>
        <span className={clsx("tg-num grid h-5 w-5 place-items-center rounded text-xs", done ? "bg-(--tg-gold) text-(--tg-ink)" : "bg-(--tg-cream)/15 text-(--tg-cream)")}>{done ? <Icon name="check" className="h-3.5 w-3.5" /> : n}</span>
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
      {icon && <Icon name={icon} className="mt-0.5 h-7 w-7 shrink-0 text-(--tg-gold)" />}
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
      <span className="text-sm font-extrabold uppercase tracking-[0.14em] text-(--tg-mute)">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" disabled={disabled || v <= 0} onClick={() => set(v - 5)} className="tg-num grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-(--tg-cream)/10 text-3xl disabled:opacity-30" aria-label="Meno 5">
          −5
        </button>
        <div className="flex-1 text-center" aria-live="polite">
          <span className={clsx("tg-num text-7xl leading-none", value === null ? "text-(--tg-cream)/30" : "text-(--tg-gold)")}>{value === null ? "?" : v}</span>
          <span className="tg-display ml-1 text-3xl text-(--tg-cream)/60">%</span>
        </div>
        <button type="button" disabled={disabled || v >= 100} onClick={() => set(v + 5)} className="tg-num grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-(--tg-cream)/10 text-3xl disabled:opacity-30" aria-label="Più 5">
          +5
        </button>
      </div>
      <input
        type="range"
        className={clsx("tg-range", value === null && "opacity-55")}
        min={0}
        max={100}
        step={1}
        value={v}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={value === null ? "nessuna previsione" : `${v} per cento`}
        // finché non si sceglie, il binario resta vuoto: il cursore a metà non è una risposta
        style={{ ["--tg-fill" as string]: value === null ? "0%" : `${v}%` }}
      />
      <div className="grid grid-cols-5 gap-2">
        {[0, 25, 50, 75, 100].map((p) => (
          <button key={p} type="button" disabled={disabled} onClick={() => set(p)} className={clsx("tg-num h-11 rounded-lg border text-xl", value === p ? "border-(--tg-gold) text-(--tg-gold)" : "border-(--tg-cream)/12 text-(--tg-cream)/80")}>
            {p}%
          </button>
        ))}
      </div>
      <p className="hidden text-center text-xs font-semibold text-(--tg-mute) lg:block">Frecce: ±1 · Pagina su/giù: ±10 · Invio: conferma</p>
    </div>
  );
}

/** Timbro grande del reveal in TV (es. «IL PUB HA TORTO!»). */
export function TvStamp({ children, tone = "lime", sub, size = "lg" }: { children: ReactNode; tone?: "lime" | "red" | "ice"; sub?: ReactNode; size?: "sm" | "lg" }) {
  const color = tone === "red" ? "var(--tg-red-hi)" : tone === "ice" ? "var(--tg-cream)" : "var(--tg-gold)";
  return (
    <div className="tg-pop flex flex-col items-center gap-[0.4cqw] text-center">
      <p className={clsx("tg-display -rotate-2 rounded-[0.8cqw] border-[0.35cqw] leading-none", size === "sm" ? "px-[1.1cqw] py-[0.4cqw] text-[2.7cqw]" : "px-[1.6cqw] py-[0.6cqw] text-[4.4cqw]")} style={{ borderColor: color, color }}>
        {children}
      </p>
      {sub && <p className="text-[1.5cqw] font-bold text-(--tg-cream)/80">{sub}</p>}
    </div>
  );
}

/** Spiegazione del reveal in TV in formato compatto (colonne strette, 12 tavoli): foglio di pergamena come quella del kit. */
export function TvExplainCompact({ text, className, title = "Perché" }: { text: string; className?: string; title?: string }) {
  return (
    <div className={clsx("tg-parch tg-rise min-h-0 overflow-hidden px-[1.4cqw] py-[1cqw]", className)}>
      <p className="mb-[0.2cqw] text-[0.9cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-burnt-ink)">{title}</p>
      <p className={clsx("font-semibold leading-snug text-(--tg-ink)", text.length > 190 ? "text-[1.2cqw]" : "text-[1.35cqw]")}>{text}</p>
    </div>
  );
}

/** Messaggio centrale della TV durante la prova (niente soluzioni). */
export function TvWaiting({ icon, title, children }: { icon: IconName; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1cqw] text-center">
      <Icon name={icon} className="h-[7cqw] w-[7cqw] text-(--tg-gold)" />
      <p className="tg-title text-[4.2cqw] text-(--tg-gold-hi)">{title}</p>
      {children && <div className="max-w-[60cqw] text-[1.6cqw] font-bold leading-snug text-(--tg-cream)/75">{children}</div>}
    </div>
  );
}

/** Barra orizzontale semplice (percentuale scritta accanto). */
export function MiniBar({ pct, win = false, tv = false, label }: { pct: number; win?: boolean; tv?: boolean; label?: ReactNode }) {
  return (
    <div className={clsx("relative overflow-hidden", tv ? "h-[2.4cqw] rounded-[0.5cqw]" : "h-8 rounded-lg", "bg-(--tg-cream)/[0.07]")}>
      <div className={clsx("absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out", win ? "bg-(--tg-gold-deep)/80" : "bg-(--tg-cream)/15")} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} aria-hidden />
      <div className={clsx("relative flex h-full items-center justify-between gap-2", tv ? "px-[0.7cqw] text-[1.2cqw]" : "px-2.5 text-sm")}>
        <span className="min-w-0 truncate font-extrabold">{label}</span>
        <span className={clsx("tg-num shrink-0", tv ? "text-[1.5cqw]" : "text-lg", win && "text-(--tg-gold)")}>{pct}%</span>
      </div>
    </div>
  );
}
