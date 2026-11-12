"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import type { BoardCell, GiramenteCharacterProps, JollyPortalProps, SecretBoardProps, VisualQuality } from "./types";

/**
 * Segnaposto 2D dei personaggi (Don Patrizio, Zafira): sagoma + nome + «bocca» che segue la voce.
 * NON è un personaggio riggato e non finge di esserlo: in sviluppo porta la scritta «anteprima».
 * All'unione con il ramo 3D, visuals.tsx esporterà i modelli GLB veri con le stesse props.
 */
const DEV = process.env.NODE_ENV !== "production";

const LOOK = {
  dontralla: { name: "Don Patrizio", role: "Il presentatore", accent: "#39ff14", suit: "#3b0d16" },
  zafira: { name: "Zafira", role: "La Jolly", accent: "#ff253a", suit: "#111418" },
} as const;

/** Bocca: altezza che segue mouthRef (0–1) a ogni fotogramma, senza ridisegnare React. */
function useMouth(mouthRef: GiramenteCharacterProps["mouthRef"], speaking: boolean) {
  const el = useRef<SVGRectElement>(null);
  useEffect(() => {
    let raf = 0;
    let t = 0;
    const frame = () => {
      t += 1;
      const v = mouthRef?.current ?? (speaking ? 0.35 + 0.3 * Math.abs(Math.sin(t / 4)) : 0);
      const h = 1.5 + Math.max(0, Math.min(1, v)) * 9;
      el.current?.setAttribute("height", String(h));
      el.current?.setAttribute("y", String(63 - h / 2));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mouthRef, speaking]);
  return el;
}

export function GiramenteCharacter({ who, action, speaking, mouthRef, framing, onReady, className }: GiramenteCharacterProps) {
  const look = LOOK[who];
  const mouth = useMouth(mouthRef, speaking);
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  const bob = action === "vittoria" || action === "applauso" || action === "risata";
  return (
    <figure className={clsx("relative flex flex-col items-center", className)} aria-label={`${look.name}, ${look.role}`}>
      <svg viewBox="0 0 120 150" className={clsx("h-full max-h-full w-auto", bob && "gm-pop")} aria-hidden>
        <defs>
          <radialGradient id={`gm-ch-${who}`} cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#2c343a" />
            <stop offset="100%" stopColor="#0b0f12" />
          </radialGradient>
        </defs>
        {framing === "full" && <rect x="34" y="96" width="52" height="54" rx="10" fill={look.suit} stroke={look.accent} strokeWidth="1.5" />}
        <path d="M20 150 C 22 108, 98 108, 100 150 Z" fill={look.suit} stroke={look.accent} strokeWidth="1.5" />
        {who === "zafira" ? (
          <>
            <path d="M34 44 C 34 14, 86 14, 86 44 C 92 30, 70 4, 52 12 C 40 10, 30 24, 34 44 Z" fill="#f1ecd8" />
            <circle cx="60" cy="10" r="9" fill="#f1ecd8" />
            <rect x="38" y="24" width="44" height="7" rx="3" fill="#39ff14" opacity="0.85" />
          </>
        ) : null}
        <ellipse cx="60" cy="54" rx={who === "dontralla" ? 27 : 23} ry="29" fill={`url(#gm-ch-${who})`} stroke={look.accent} strokeWidth="2" />
        {who === "dontralla" && <path d="M36 62 C 40 90, 80 90, 84 62 C 76 74, 44 74, 36 62 Z" fill="#1b1410" opacity="0.9" />}
        <circle cx="50" cy="49" r="3" fill={look.accent} />
        <circle cx="70" cy="49" r="3" fill={look.accent} />
        {who === "zafira" && <path d="M76 58 l3 -4 l3 4 l-3 4 z" fill="#ff253a" />}
        <rect ref={mouth} x="52" y="62" width="16" height="2" rx="2" fill={look.accent} />
      </svg>
      <figcaption className="mt-1 text-center leading-tight">
        <span className="gm-display block text-lg" style={{ color: look.accent }}>
          {look.name}
        </span>
        {DEV && <span className="block text-[10px] font-black uppercase tracking-widest text-white/45">anteprima · {action}</span>}
      </figcaption>
    </figure>
  );
}

/** Ingresso della Jolly in 2D: portale verde e rosso, poi Zafira; chiama onDone dopo l'animazione. */
export function JollyPortal({ play, quality, speaking, mouthRef, onDone, className }: JollyPortalProps) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (!play) return;
    const t = setTimeout(() => done.current?.(), quality === "2d" ? 1200 : 2200);
    return () => clearTimeout(t);
  }, [play, quality]);
  if (!play) return null;
  return (
    <div className={clsx("relative grid place-items-center", className)} aria-label="Entra la Jolly">
      <div aria-hidden className="gm-portal absolute aspect-square w-[min(70vw,22rem)] rounded-full opacity-80" />
      <div aria-hidden className="absolute aspect-square w-[min(56vw,17rem)] rounded-full bg-[#080b0d]/85" />
      <GiramenteCharacter who="zafira" action="ingresso" speaking={speaking} mouthRef={mouthRef} framing="bust" quality={quality} className="relative h-48 gm-pop" />
    </div>
  );
}

/** Tabellone segreto in CSS: caselle con effetto 3D, categoria sopra, parole separate. */
export function SecretBoard({ category, rows, solved = false, className }: SecretBoardProps) {
  const width = Math.max(...rows.map((r) => r.length), 8);
  return (
    <div className={clsx("gm-panel gm-panel-green w-full rounded-2xl p-3 sm:p-4", solved && "gm-board-solved", className)}>
      <p className="gm-display mb-2 text-center text-lg text-[#39ff14] sm:text-2xl">{category}</p>
      <div className="flex flex-col gap-1.5" style={{ perspective: "600px" }}>
        {rows.map((row, ri) => (
          <div key={ri} className="mx-auto grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`, width: `${(row.length / width) * 100}%` }}>
            {row.map((c: BoardCell, ci) => {
              if (c.kind === "space") return <span key={ci} className="gm-cell gm-cell-space" aria-hidden />;
              if (c.kind === "punct")
                return (
                  <span key={ci} className="gm-cell gm-cell-punct text-[clamp(1rem,4.6vw,2.2rem)]">
                    {c.char}
                  </span>
                );
              return (
                <span key={ci} className={clsx("gm-cell text-[clamp(1rem,4.6vw,2.2rem)]", c.char && "gm-cell-on", c.justRevealed && "gm-cell-new")} aria-label={c.char ?? "lettera coperta"}>
                  {c.char ?? "·"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Qualità visiva: 2D con movimento ridotto o dispositivi molto deboli, bassa sui telefoni, alta altrove. */
export function detectVisualQuality(): VisualQuality {
  if (typeof window === "undefined") return "2d";
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "2d";
    const nav = navigator as Navigator & { deviceMemory?: number };
    const mem = nav.deviceMemory ?? 4;
    const cores = nav.hardwareConcurrency ?? 4;
    if (mem <= 2 || cores <= 2) return "2d";
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    return small || mem <= 4 ? "low" : "high";
  } catch {
    return "2d";
  }
}
