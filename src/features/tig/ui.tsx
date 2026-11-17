"use client";

/* eslint-disable @next/next/no-img-element -- QR generato al volo (data URL) */
import { clsx } from "clsx";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { useEffect, useState, type ReactNode } from "react";
import type { PublicTeam } from "@/lib/tig/types";
import { CrewFlag, Doubloon, WaxSeal } from "./games/kit/ornaments";
import { useTick } from "./use-tig";

/**
 * Pezzi d'interfaccia di TAVERNA DEI PIRATI (ex TAVOLI IN GUERRA!) condivisi da shell, regia, telefono e TV.
 * Ornamenti disegnati in codice in `./games/kit/ornaments` (dobloni, bandiere delle ciurme, ceralacca, rosa dei venti).
 */

export { CompassRose, CrewFlag, Doubloon, SkullMark, WaxSeal } from "./games/kit/ornaments";

/** Nome del gioco come appare nelle scritte (rotte e identificatori interni restano «tig»). */
export const GAME_NAME = "TAVERNA DEI PIRATI";

/** Logo «TAVERNA DEI PIRATI»: «Taverna dei» in crema tra due fili d'ottone, «Pirati» in foglia d'oro con lo spessore del legno. */
export function Logo({ size = "md", className, tagline = false, align = "center" }: { size?: "sm" | "md" | "lg" | "xl"; className?: string; tagline?: boolean; align?: "center" | "left" }) {
  const cls = { sm: "text-2xl", md: "text-[2.6rem]", lg: "text-[clamp(3.4rem,7.4vw,5rem)]", xl: "text-[clamp(3.6rem,10vmin,8rem)]" }[size];
  return (
    <div className={clsx("flex flex-col", align === "left" ? "items-start" : "items-center", className)}>
      <p className={clsx("tig-logo relative -rotate-2", align === "left" ? "tig-logo-left text-left" : "text-center", cls)} aria-label={GAME_NAME}>
        <span className={clsx("tig-logo-top", align === "left" ? "justify-start" : "justify-center")}>Taverna dei</span>
        <span className="tig-logo-main">Pirati</span>
      </p>
      {tagline && <p className={clsx("tig-logo-tagline mt-2.5 text-[clamp(.76rem,1.45vw,.98rem)]", align === "left" ? "text-left" : "text-center")}>Il game show dove ogni tavolo è una ciurma</p>}
    </div>
  );
}

export function QrCode({ text, className, label = "QR per entrare" }: { text: string; className?: string; label?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: 520, color: { dark: "#1b1410", light: "#fffaf0" } })
      .then((u) => alive && setSrc(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [text]);
  if (!src) return <div className={clsx("aspect-square rounded-xl bg-[#fffaf0]/15", className)} />;
  return <img src={src} alt={label} className={clsx("aspect-square rounded-xl bg-[#fffaf0] p-1 shadow-[0_0_0_2px_rgba(122,74,26,.55),0_6px_16px_-6px_rgba(0,0,0,.6)]", className)} />;
}

/** Secondi che restano (orologio del server). */
export function useSecondsLeft(deadlineAt: string | null | undefined, now: () => number, active = true): number | null {
  useTick(active && !!deadlineAt, 200);
  if (!deadlineAt) return null;
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - now()) / 1000));
}

const DIAL_TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

/** Cronometro a bussola: quadrante di notte, ghiera d'ottone, arco d'oro che si consuma (rosso negli ultimi 5 s). */
export function Countdown({ deadlineAt, totalMs, now, size = "md", paused = false, className }: { deadlineAt: string | null; totalMs: number | null; now: () => number; size?: "sm" | "md" | "lg" | "xl"; paused?: boolean; className?: string }) {
  const left = useSecondsLeft(deadlineAt, now, !paused);
  if (left === null) return null;
  const frac = totalMs ? Math.max(0, Math.min(1, (Date.parse(deadlineAt!) - now()) / totalMs)) : 1;
  const dim = { sm: 56, md: 84, lg: 120, xl: 168 }[size];
  const r = 37;
  const c = 2 * Math.PI * r;
  const hot = left <= 5;
  return (
    <div className={clsx("relative grid shrink-0 place-items-center", hot && !paused && "tig-pulse", className)} style={{ width: dim, height: dim }} role="timer" aria-label={`${left} secondi`}>
      <svg viewBox="0 0 100 100" width={dim} height={dim} className="absolute inset-0 drop-shadow-[0_6px_10px_rgba(0,0,0,.6)]" aria-hidden>
        <circle cx={50} cy={50} r={48} fill="#0b1f2a" stroke="#c9a24a" strokeWidth={2.4} />
        <circle cx={50} cy={50} r={45} fill="none" stroke="#5a3a22" strokeWidth={1.4} />
        {DIAL_TICKS.map((a) => (
          <line key={a} x1={50} y1={7} x2={50} y2={a % 90 === 0 ? 13 : 10.5} stroke="#c9a24a" strokeWidth={a % 90 === 0 ? 2 : 1.1} opacity={0.85} transform={`rotate(${a} 50 50)`} />
        ))}
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(246,234,210,.12)" strokeWidth={6} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={hot ? "#e0483f" : "#f2b134"} strokeWidth={6} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 50 50)" style={{ transition: "stroke-dashoffset .2s linear" }} />
      </svg>
      <span className={clsx("tig-display relative tabular-nums", hot ? "text-[#ff8a7a]" : "text-[#ffd56b]")} style={{ fontSize: dim * 0.4 }}>
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
          <span className="text-[#62d9cc]">Energia Caos</span>
          <span className="text-[#f6ead2]/70">{next ? `${energy} / ${next}` : `${energy} · leggendaria`}</span>
        </div>
      )}
      <div className="relative h-3 overflow-hidden rounded-full border border-[#c9a24a]/45 bg-black/55 shadow-[inset_0_1px_3px_rgba(0,0,0,.7)]">
        <div className="tig-energy h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between text-[10px] font-black uppercase tracking-widest text-[#f6ead2]/50">
          <span className={level >= 1 ? "text-[#f6ead2]/85" : ""}>Base</span>
          <span className={level >= 2 ? "text-[#62d9cc]" : ""}>Potenziata</span>
          <span className={level >= 3 ? "text-[#ffd56b]" : ""}>Leggendaria</span>
        </div>
      )}
    </div>
  );
}

export const LEVEL_NAME = { 1: "Base", 2: "Potenziata", 3: "Leggendaria" } as const;

/**
 * Classifica animata come una mappa del tesoro: pergamena, una «tacca» per tavolo con la bandiera della ciurma,
 * il doblone al primo posto. Le righe scivolano quando cambia l'ordine.
 */
export function Leaderboard({ teams, highlight, max = 12, size = "md", hideScores = false, className }: { teams: PublicTeam[]; highlight?: string | null; max?: number; size?: "md" | "lg"; hideScores?: boolean; className?: string }) {
  const sorted = [...teams].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.tableNo - b.tableNo).slice(0, max);
  const big = size === "lg";
  return (
    <ol className={clsx("tg-parch flex w-full flex-col", big ? "px-[1.4vmin] py-[0.8vmin]" : "px-2 py-1.5", className)} aria-label="Classifica">
      {sorted.map((t) => {
        const mine = highlight === t.teamId;
        return (
          <motion.li
            key={t.teamId}
            layout
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={clsx("flex items-center gap-2.5 border-b border-dashed border-[#8a5a2b]/45 last:border-b-0", big ? "gap-[1.2vmin] px-[0.8vmin] py-[0.8vmin]" : "px-1.5 py-1.5", mine && "rounded-lg border-transparent bg-[#f2b134]/30 shadow-[inset_0_0_0_2px_rgba(160,106,20,.7)]")}
          >
            {!hideScores && t.rank === 1 ? (
              <Doubloon className={big ? "h-[4.6vmin] w-[4.6vmin] text-[2.6vmin]" : "h-8 w-8 text-lg"}>1</Doubloon>
            ) : (
              <span className={clsx("tig-display shrink-0 text-center tabular-nums text-[#6e4116]", big ? "w-[4.6vmin] text-[3.6vmin]" : "w-8 text-2xl")}>{hideScores ? "?" : (t.rank ?? "–")}</span>
            )}
            <CrewFlag color={t.color} n={t.tableNo} className={clsx("shrink-0", big ? "h-[4.2vmin] w-[5.6vmin]" : "h-7 w-9")} />
            <span className={clsx("min-w-0 flex-1 truncate font-extrabold text-[#1b1410]", big ? "text-[3vmin]" : "text-lg")}>{t.name}</span>
            {t.shield && (
              <span className={clsx("shrink-0", big ? "text-[2.6vmin]" : "text-base")} title="Scudo attivo" aria-label="Scudo attivo">
                🛡️
              </span>
            )}
            {!hideScores && t.delta ? <span className={clsx("tig-rise shrink-0 font-black tabular-nums", big ? "text-[2.4vmin]" : "text-sm", t.delta > 0 ? "text-[#0b6e66]" : "text-[#9c231e]")}>{t.delta > 0 ? `+${t.delta}` : t.delta}</span> : null}
            <span className={clsx("tig-display shrink-0 tabular-nums text-[#1b1410]", big ? "text-[3.8vmin]" : "text-2xl")}>{hideScores || t.score === null ? "•••" : t.score.toLocaleString("it-IT")}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function StatusPill({ status }: { status: "connecting" | "live" | "reconnecting" | "offline" }) {
  if (status === "live") return null;
  return (
    <div className="tig-chip fixed left-1/2 top-2 z-50 -translate-x-1/2 !border-[#f2b134]/70" role="status">
      <span className="h-2 w-2 animate-pulse rounded-full bg-[#f2b134]" />
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
    <div
      role="alert"
      className={clsx(
        "tig-pop fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl border-2 px-4 py-3 text-center text-base font-extrabold shadow-[0_18px_40px_-12px_rgba(0,0,0,.9)]",
        tone === "error" ? "border-[#e0483f] bg-[#2a0806]/95 text-[#ffd9d3]" : tone === "ok" ? "border-[#1fb5a8] bg-[#062a27]/95 text-[#d5fff8]" : "border-[#c9a24a]/70 bg-[#0b1f2a]/95 text-[#f6ead2]",
      )}
    >
      {tone === "ok" && <WaxSeal mark="check" tone="gold" className="h-8 w-8 shrink-0" />}
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

/** Banner di pausa (stesso aspetto su TV, telefono e regia): un avviso di pergamena col sigillo dell'ancora. */
export function PausedBanner({ big = false }: { big?: boolean }) {
  return (
    <div role="status" className={clsx("tg-parch tig-pop relative flex flex-col items-center gap-2 text-center", big ? "max-w-[80vw] px-[6vmin] pb-[3vmin] pt-[5vmin]" : "px-6 pb-5 pt-8")}>
      <WaxSeal mark="anchor" className={clsx("absolute left-1/2 -translate-x-1/2 drop-shadow-[0_4px_6px_rgba(0,0,0,.45)]", big ? "-top-[4.5vmin] h-[9vmin] w-[9vmin]" : "-top-7 h-14 w-14")} />
      <span className={clsx("tig-display text-[#7e1a14]", big ? "text-[10vmin]" : "text-5xl")}>PAUSA</span>
      <span className={clsx("font-bold text-[#3b2a1a]", big ? "text-[2.8vmin]" : "text-base")}>Pausa tecnica della regia: il tempo è fermo, si riprende da dove eravamo.</span>
    </div>
  );
}
