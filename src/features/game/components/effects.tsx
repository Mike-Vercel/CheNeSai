"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";

/** Timer circolare (TV). `remainingMs` calcolato con l'orologio del server. */
export function TimerRing({ remainingMs, totalMs, size = 220, label = "secondi" }: { remainingMs: number; totalMs: number; size?: number | string; label?: string }) {
  const dim = typeof size === "number" ? `${size}px` : size;
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const r = 44;
  const c = 2 * Math.PI * r;
  const color = frac > 0.5 ? "#00d46a" : frac > 0.25 ? "#ffd43b" : "#f72545";
  const urgent = secs <= 5 && secs > 0;
  return (
    // livello proprio (will-change): l'anello si ridisegna a ogni frame durante la transizione e così
    // non trascina con sé il cartiglio della domanda e il suo grande bagliore
    <div className={clsx("relative grid place-items-center [will-change:transform]", urgent && "animate-pulse")} style={{ width: dim, height: dim }} role="timer" aria-live="off">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r="49" fill="#170824" stroke="#ffd43b" strokeWidth="2" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 200ms linear, stroke 300ms" }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <span className="font-display text-white" style={{ fontSize: `calc(${dim} * 0.38)` }}>
          {secs}
        </span>
        <span className="font-extrabold text-white/85" style={{ fontSize: `calc(${dim} * 0.1)` }}>
          {secs === 0 ? "STOP" : label}
        </span>
      </div>
    </div>
  );
}

/** Barra del tempo (smartphone). */
export function TimerBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const color = frac > 0.5 ? "#00d46a" : frac > 0.25 ? "#ffd43b" : "#f72545";
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-gold/60 bg-black/40 px-3 py-2" role="timer">
      <span className="w-14 text-center font-display text-2xl text-white">{secs}s</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full" style={{ width: `${frac * 100}%`, background: color, transition: "width 200ms linear" }} />
      </div>
    </div>
  );
}

/**
 * Coriandoli digitali su canvas (leggeri: nessuna allocazione per frame dopo
 * l'avvio, si fermano da soli). `fire` cambia valore per lanciare una raffica.
 */
export function Confetti({ fire, intensity = 1, className }: { fire: number; intensity?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    const colors = ["#ffd43b", "#ff1493", "#00d9ff", "#00d46a", "#832bff", "#f72545", "#ffffff"];
    const n = Math.round(160 * intensity);
    const W = canvas.width;
    const H = canvas.height;
    const p = Array.from({ length: n }, () => ({
      x: W * (0.1 + Math.random() * 0.8),
      y: H * (0.55 + Math.random() * 0.2),
      vx: (Math.random() - 0.5) * 18 * dpr,
      vy: -(14 + Math.random() * 18) * dpr,
      w: (6 + Math.random() * 8) * dpr,
      h: (8 + Math.random() * 12) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, W, H);
      for (const q of p) {
        q.vy += 0.55 * dpr;
        q.vx *= 0.99;
        q.x += q.vx;
        q.y += q.vy;
        q.r += q.vr;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.r);
        ctx.fillStyle = q.c;
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 4200);
        ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h * Math.abs(Math.cos(q.r * 2)));
        ctx.restore();
      }
      if (elapsed < 4200) raf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fire, intensity]);
  return <canvas ref={ref} aria-hidden className={clsx("pointer-events-none absolute inset-0 h-full w-full", className)} />;
}

/** Fumetto del presentatore. */
export function SpeechBubble({ children, className, tail = "left" }: { children: React.ReactNode; className?: string; tail?: "left" | "right" | "none" }) {
  return (
    <div className={clsx(!className?.includes("absolute") && "relative", "rounded-3xl border-4 border-gold bg-cream px-6 py-4 font-display text-ink shadow-[0_8px_0_#9a5d00]", className)}>
      {children}
      {tail !== "none" && (
        <span
          aria-hidden
          className={clsx("absolute -bottom-4 h-8 w-8 rotate-45 border-b-4 border-r-4 border-gold bg-cream", tail === "left" ? "left-10" : "right-10")}
        />
      )}
    </div>
  );
}
