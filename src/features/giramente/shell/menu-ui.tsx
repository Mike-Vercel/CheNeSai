"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getSoundEngine, type CueName } from "@/features/media/audio-engine";
import { loadPrefs } from "../audio";

/**
 * Pezzi del MENU da videogioco di GIRAMENTE!: lista di voci da scegliere con ↑↓ e Invio (o mouse/tocco, con
 * evidenziazione al passaggio), cornice dei pannelli con «‹ INDIETRO» (Esc), suoni dell'interfaccia.
 */
const SOUND: Record<"move" | "ok" | "back", { cue: CueName }> = {
  move: { cue: "wheelTick" },
  ok: { cue: "whoosh" },
  back: { cue: "tick" },
};

/** Suono dell'interfaccia (rispetta «Effetti» nelle impostazioni; il primo gesto sblocca l'audio). */
export function uiSound(kind: keyof typeof SOUND) {
  if (!loadPrefs().sfx) return;
  const e = getSoundEngine();
  if (e.unlocked) e.play(SOUND[kind].cue);
  else void e.unlock().then((ok) => ok && e.play(SOUND[kind].cue));
}

export interface MenuItem {
  id: string;
  label: string;
  /** riga di spiegazione (si vede sotto la voce scelta) */
  sub?: string;
  tone?: "green" | "red";
  /** testo a destra (es. il codice della partita) */
  badge?: string;
}

/** Lista di voci con navigazione da tastiera (↑↓, Invio, Home/Fine), mouse e tocco. */
export function MenuList({ items, onSelect, onActive, label, initial = 0, size = "lg", autoFocus = true }: { items: MenuItem[]; onSelect: (id: string) => void; onActive?: (id: string) => void; label: string; initial?: number; size?: "lg" | "md"; autoFocus?: boolean }) {
  const [active, setActive] = useState(Math.min(initial, items.length - 1));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!autoFocus) return;
    // il primo tasto premuto agisce subito sul menu (senza rubare la tastiera dei telefoni)
    if (window.matchMedia?.("(pointer: fine)").matches) refs.current[active]?.focus({ preventScroll: true });
    // solo all'apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const move = (to: number) => {
    const n = items.length;
    const i = (to + n) % n;
    setActive(i);
    onActive?.(items[i].id);
    refs.current[i]?.focus({ preventScroll: true });
    uiSound("move");
  };
  return (
    <div
      role="menu"
      aria-label={label}
      className="flex w-full flex-col gap-1"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") move(active + 1);
        else if (e.key === "ArrowUp") move(active - 1);
        else if (e.key === "Home") move(0);
        else if (e.key === "End") move(items.length - 1);
        else return;
        e.preventDefault();
      }}
    >
      {items.map((it, i) => {
        const on = i === active;
        const red = it.tone === "red";
        return (
          <button
            key={it.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="menuitem"
            tabIndex={on ? 0 : -1}
            data-active={on || undefined}
            onMouseEnter={() => {
              if (!on) {
                setActive(i);
                onActive?.(it.id);
                // una sola voce accesa: il mouse porta con sé anche la tastiera
                if (document.activeElement && refs.current.includes(document.activeElement as HTMLButtonElement)) refs.current[i]?.focus({ preventScroll: true });
                uiSound("move");
              }
            }}
            onFocus={() => setActive(i)}
            onClick={() => {
              uiSound("ok");
              onSelect(it.id);
            }}
            className={clsx("gm-menu-item group relative flex w-full flex-col items-start text-left outline-none", size === "lg" ? "px-5 py-2 sm:py-2.5" : "px-4 py-1.5", on ? "text-white" : "text-white/62 hover:text-white")}
          >
            <span aria-hidden className={clsx("gm-menu-bar absolute inset-y-0 left-0 right-0 -skew-x-12 rounded-md transition-all duration-200", on ? "opacity-100" : "opacity-0", red ? "gm-menu-bar-red" : "")} />
            <span className="relative flex w-full items-center gap-3">
              <span aria-hidden className={clsx("w-5 shrink-0 text-lg transition-transform duration-200", red ? "text-[#ff8a95]" : "text-[#39ff14]", on ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0")}>
                ▶
              </span>
              <span className={clsx("gm-display min-w-0 flex-1 leading-[0.95] drop-shadow-[0_2px_0_rgba(0,0,0,.85)]", size === "lg" ? "text-[clamp(1.55rem,min(3vw,5.4vh),2.6rem)]" : "text-[clamp(1.25rem,min(2.4vw,4.2vh),1.9rem)]")}>{it.label}</span>
              {it.badge && <span className="relative shrink-0 rounded-md bg-black/55 px-2 py-0.5 font-mono text-sm font-bold tracking-[0.2em] text-white/90">{it.badge}</span>}
            </span>
            {it.sub && (
              <span className={clsx("relative ml-8 overflow-hidden text-sm font-bold text-white/80 transition-all duration-200", on ? "mt-0.5 max-h-10 opacity-100" : "max-h-0 opacity-0")}>
                {it.sub}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Esc = indietro (i dati già scritti restano: si torna solo al passo o al pannello precedente). */
export function useBack(onBack: (() => void) | null) {
  const ref = useRef(onBack);
  useEffect(() => {
    ref.current = onBack;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !ref.current || e.defaultPrevented) return;
      e.preventDefault();
      uiSound("back");
      ref.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Cornice di un pannello del menu: titolino, titolo grande, contenuto che scorre dentro, piede con i comandi. */
export function PanelFrame({ kicker, title, onBack, backButton = true, children, footer, progress, className }: { kicker?: string; title: string; onBack?: () => void; backButton?: boolean; children: ReactNode; footer?: ReactNode; progress?: ReactNode; className?: string }) {
  useBack(onBack ?? null);
  return (
    <section aria-label={title} className={clsx("gm-menu-panel gm-pop flex max-h-full min-h-0 w-full flex-col", className)}>
      <header className="flex shrink-0 items-start gap-3 px-5 pt-4 sm:px-6 sm:pt-5">
        {onBack && backButton && (
          <button
            type="button"
            onClick={() => {
              uiSound("back");
              onBack();
            }}
            aria-label="Indietro"
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 bg-black/40 text-2xl font-black text-white/85 transition hover:border-[#39ff14]/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#39ff14]"
          >
            ‹
          </button>
        )}
        <div className="min-w-0 flex-1">
          {kicker && <p className="text-xs font-black uppercase tracking-[0.25em] text-[#39ff14]/90">{kicker}</p>}
          <h2 className="gm-display text-[clamp(1.9rem,min(3.4vw,6vh),3rem)] leading-[0.95]">{title}</h2>
          {progress}
        </div>
      </header>
      <div className="gm-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-3 sm:px-6">{children}</div>
      {footer && <footer className="flex shrink-0 items-center gap-3 border-t border-white/10 px-5 py-3 sm:px-6">{footer}</footer>}
    </section>
  );
}

/** Pallini di avanzamento dei passi (1 di 4…). */
export function StepDots({ steps, current }: { steps: readonly { title: string }[]; current: number }) {
  return (
    <ol className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1" aria-label={`Passo ${current + 1} di ${steps.length}`}>
      {steps.map((s, i) => (
        <li key={s.title} className={clsx("flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em]", i === current ? "text-white" : i < current ? "text-[#39ff14]/85" : "text-white/35")}>
          <span className={clsx("grid h-5 w-5 place-items-center rounded-full border text-[10px]", i === current ? "border-[#39ff14] bg-[#39ff14] text-[#06140a]" : i < current ? "border-[#39ff14]/70" : "border-white/30")}>{i < current ? "✓" : i + 1}</span>
          {i === current && <span>{s.title}</span>}
          {i < steps.length - 1 && <span aria-hidden className="mx-0.5 h-px w-3 bg-white/25" />}
        </li>
      ))}
    </ol>
  );
}

/** Suggerimento dei tasti (solo con tastiera e mouse). */
export function KeyHints({ items }: { items: [string, string][] }) {
  return (
    <p className="hidden items-center gap-3 text-[11px] font-bold uppercase tracking-[0.15em] text-white/45 [@media(pointer:fine)]:flex">
      {items.map(([k, v]) => (
        <span key={k} className="flex items-center gap-1.5">
          <kbd className="rounded border border-white/25 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] text-white/70">{k}</kbd>
          {v}
        </span>
      ))}
    </p>
  );
}
