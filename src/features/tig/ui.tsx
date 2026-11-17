"use client";

/* eslint-disable @next/next/no-img-element -- QR generato al volo (data URL) */
import { clsx } from "clsx";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { useEffect, useState, type ReactNode } from "react";
import type { PublicTeam } from "@/lib/tig/types";
import { useTick } from "./use-tig";

/**
 * Pezzi d'interfaccia di TAVOLI IN GUERRA! condivisi da shell, regia, telefono e TV.
 */

export function Logo({ size = "md", className, tagline = false }: { size?: "sm" | "md" | "lg" | "xl"; className?: string; tagline?: boolean }) {
  const cls = { sm: "text-2xl", md: "text-4xl", lg: "text-[clamp(2.6rem,7vw,4.6rem)]", xl: "text-[clamp(3.4rem,9vmin,7.5rem)]" }[size];
  return (
    <div className={clsx("flex flex-col items-center", className)}>
      <p className={clsx("tig-logo relative -rotate-2 text-center", cls)} aria-label="TAVOLI IN GUERRA!">
        <span className="block text-[0.62em] tracking-[0.06em]">Tavoli in</span>
        <span className="tig-logo-war block">Guerra</span>
        <span className="tig-logo-bang absolute -right-[0.18em] bottom-[0.02em] text-[1.1em]" aria-hidden>
          !
        </span>
      </p>
      {tagline && <p className="mt-2 text-center text-[clamp(.8rem,1.6vw,1.05rem)] font-extrabold uppercase tracking-[0.22em] text-white/70">Il game show che trasforma ogni tavolo in una squadra</p>}
    </div>
  );
}

export function QrCode({ text, className, label = "QR per entrare" }: { text: string; className?: string; label?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: 520, color: { dark: "#06070c", light: "#ffffff" } })
      .then((u) => alive && setSrc(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [text]);
  if (!src) return <div className={clsx("aspect-square rounded-xl bg-white/10", className)} />;
  return <img src={src} alt={label} className={clsx("aspect-square rounded-xl bg-white p-1", className)} />;
}

/** Secondi che restano (orologio del server). */
export function useSecondsLeft(deadlineAt: string | null | undefined, now: () => number, active = true): number | null {
  useTick(active && !!deadlineAt, 200);
  if (!deadlineAt) return null;
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - now()) / 1000));
}

export function Countdown({ deadlineAt, totalMs, now, size = "md", paused = false, className }: { deadlineAt: string | null; totalMs: number | null; now: () => number; size?: "sm" | "md" | "lg" | "xl"; paused?: boolean; className?: string }) {
  const left = useSecondsLeft(deadlineAt, now, !paused);
  if (left === null) return null;
  const frac = totalMs ? Math.max(0, Math.min(1, (Date.parse(deadlineAt!) - now()) / totalMs)) : 1;
  const dim = { sm: 56, md: 84, lg: 120, xl: 168 }[size];
  const r = dim / 2 - 6;
  const c = 2 * Math.PI * r;
  const hot = left <= 5;
  return (
    <div className={clsx("relative grid place-items-center", hot && !paused && "tig-pulse", className)} style={{ width: dim, height: dim }} role="timer" aria-label={`${left} secondi`}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim / 2} cy={dim / 2} r={r} stroke="rgba(255,255,255,.12)" strokeWidth={6} fill="rgba(0,0,0,.55)" />
        <circle cx={dim / 2} cy={dim / 2} r={r} stroke={hot ? "#ff2d3d" : "#ffb020"} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset .2s linear" }} />
      </svg>
      <span className={clsx("tig-display absolute tabular-nums", hot ? "text-[#ff8a95]" : "text-white")} style={{ fontSize: dim * 0.42 }}>
        {left}
      </span>
    </div>
  );
}

export function EnergyBar({ progress, level, energy, next, className, compact = false }: { progress: number; level: number; energy: number; next: number | null; className?: string; compact?: boolean }) {
  return (
    <div className={clsx("w-full", className)}>
      {!compact && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
          <span className="text-[#c9a8ff]">Energia Caos</span>
          <span className="text-white/60">{next ? `${energy} / ${next}` : `${energy} · leggendaria`}</span>
        </div>
      )}
      <div className="relative h-3 overflow-hidden rounded-full border border-white/10 bg-black/50">
        <div className="tig-energy h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between text-[10px] font-black uppercase tracking-widest text-white/45">
          <span className={level >= 1 ? "text-white/80" : ""}>Base</span>
          <span className={level >= 2 ? "text-[#c9a8ff]" : ""}>Potenziata</span>
          <span className={level >= 3 ? "text-[#ffd15c]" : ""}>Leggendaria</span>
        </div>
      )}
    </div>
  );
}

export const LEVEL_NAME = { 1: "Base", 2: "Potenziata", 3: "Leggendaria" } as const;

/** Classifica animata (posizioni condivise; le righe scivolano quando cambia l'ordine). */
export function Leaderboard({ teams, highlight, max = 12, size = "md", hideScores = false, className }: { teams: PublicTeam[]; highlight?: string | null; max?: number; size?: "md" | "lg"; hideScores?: boolean; className?: string }) {
  const sorted = [...teams].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.tableNo - b.tableNo).slice(0, max);
  const big = size === "lg";
  return (
    <ol className={clsx("flex w-full flex-col", big ? "gap-[0.9vmin]" : "gap-1.5", className)} aria-label="Classifica">
      {sorted.map((t) => (
        <motion.li
          key={t.teamId}
          layout
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className={clsx("tig-panel flex items-center gap-3 overflow-hidden rounded-2xl", big ? "px-[1.6vmin] py-[1vmin]" : "px-3 py-2", highlight === t.teamId && "tig-panel-hot")}
          style={{ boxShadow: `inset 6px 0 0 ${t.color}` }}
        >
          <span className={clsx("tig-display w-[2.2ch] shrink-0 text-center tabular-nums", big ? "text-[4.4vmin]" : "text-2xl", t.rank === 1 ? "text-[#ffd15c]" : "text-white/70")}>{hideScores ? "?" : (t.rank ?? "–")}</span>
          <span className={clsx("tig-display shrink-0 rounded-md bg-black/50 px-1.5 text-white/75", big ? "text-[2.4vmin]" : "text-sm")}>T{t.tableNo}</span>
          <span className={clsx("min-w-0 flex-1 truncate font-extrabold", big ? "text-[3.1vmin]" : "text-lg")}>{t.name}</span>
          {t.shield && (
            <span className={clsx("shrink-0", big ? "text-[2.6vmin]" : "text-base")} title="Scudo attivo" aria-label="Scudo attivo">
              🛡️
            </span>
          )}
          {!hideScores && t.delta ? <span className={clsx("tig-rise shrink-0 font-black tabular-nums", big ? "text-[2.4vmin]" : "text-sm", t.delta > 0 ? "text-[#7cff4f]" : "text-[#ff8a95]")}>{t.delta > 0 ? `+${t.delta}` : t.delta}</span> : null}
          <span className={clsx("tig-display shrink-0 tabular-nums", big ? "text-[4vmin]" : "text-2xl")}>{hideScores || t.score === null ? "•••" : t.score.toLocaleString("it-IT")}</span>
        </motion.li>
      ))}
    </ol>
  );
}

export function StatusPill({ status }: { status: "connecting" | "live" | "reconnecting" | "offline" }) {
  if (status === "live") return null;
  return (
    <div className="tig-chip fixed left-1/2 top-2 z-50 -translate-x-1/2 !border-[#ffb020]/60 !bg-black/80" role="status">
      <span className="h-2 w-2 animate-pulse rounded-full bg-[#ffb020]" />
      {status === "offline" ? "Rete assente: riprovo…" : status === "reconnecting" ? "Riconnessione…" : "Collegamento…"}
    </div>
  );
}

export function Toast({ message, tone = "info", onDone }: { message: string | null; tone?: "info" | "error" | "ok"; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3800);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div role="alert" className={clsx("tig-pop fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-2xl border px-4 py-3 text-center text-base font-extrabold shadow-2xl", tone === "error" ? "border-[#ff2d3d]/70 bg-[#2a0509]/95 text-[#ffd5d9]" : tone === "ok" ? "border-[#7cff4f]/60 bg-[#0b1f08]/95 text-[#dfffd2]" : "border-white/20 bg-black/90 text-white")}>
      {message}
    </div>
  );
}

export function SectionTitle({ kicker, children, className }: { kicker?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {kicker && <p className="tig-label">{kicker}</p>}
      <h2 className="tig-display text-3xl leading-none sm:text-4xl">{children}</h2>
    </div>
  );
}

/** Banner di pausa (stesso aspetto su TV, telefono e regia). */
export function PausedBanner({ big = false }: { big?: boolean }) {
  return (
    <div role="status" className={clsx("tig-panel tig-panel-hot tig-pop flex flex-col items-center gap-2 rounded-3xl text-center", big ? "px-[5vmin] py-[3vmin]" : "px-6 py-5")}>
      <span className={clsx("tig-led", big ? "text-[9vmin]" : "text-5xl")}>PAUSA</span>
      <span className={clsx("font-bold text-white/75", big ? "text-[2.6vmin]" : "text-base")}>Pausa tecnica della regia: il tempo è fermo, si riprende da dove eravamo.</span>
    </div>
  );
}
