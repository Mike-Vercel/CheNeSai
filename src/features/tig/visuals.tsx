"use client";

import { clsx } from "clsx";
import { useEffect, useRef, type CSSProperties } from "react";
import type { ArenaHost, ArenaProps, ArenaTeam, MascotProps, VisualQuality } from "./arena-contract";

/**
 * TAVOLI IN GUERRA! — VERSIONI 2D DI RISERVA della scena («arena») e della mascotte, con ESATTAMENTE le props
 * del contratto `arena-contract.ts`. Il ramo 3D implementa `src/features/tig/three/`; al merge questo file diventa
 * `export * from "./three"` e nient'altro cambia nelle pagine.
 *
 * La riserva è comunque da show: luci di scena, pavimento dell'arena in prospettiva, ledwall con il titolo,
 * i tavoli come «postazioni» con colore, mascotte (segnaposto dichiarato «MASCOTTE IN ARRIVO»), punteggio,
 * posizione condivisa ed Energia Caos; i presentatori come sagome con la bocca che segue la voce.
 */

export type { ArenaProps, MascotProps, VisualQuality };

const HOST_NAME: Record<string, string> = {
  professore: "Professor Smoke",
  regina: "Regina",
  palmino: "Palmino",
  investigatore: "Victor",
  "don-patrizio": "Don Patrizio",
  zafira: "Zafira",
  nek: "Nek",
  ciccio: "Ciccio",
  franca: "Franca",
  piroletto: "Piroletto",
  minu: "Minù",
  chicca: "Chicca",
  bumbaru: "Bumbaru",
  mordicchio: "Mordicchio",
  mammusss: "Mammusss",
  rumpo: "Rumpo",
};

/** Qualità visiva (nel browser): `?q=high|low|2d` la forza; senza WebGL o con movimento ridotto → "2d". */
export function detectVisualQuality(): VisualQuality {
  if (typeof window === "undefined") return "2d";
  try {
    const forced = new URLSearchParams(window.location.search).get("q");
    if (forced === "high" || forced === "low" || forced === "2d") return forced;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "2d";
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return "2d";
    const nav = navigator as Navigator & { deviceMemory?: number };
    return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 3 ? "low" : "high";
  } catch {
    return "2d";
  }
}

// ---------------------------------------------------------------------------
// Mascotte (segnaposto dichiaratamente provvisorio: i 12 modelli arrivano dopo)
// ---------------------------------------------------------------------------
const ACTION_CLASS: Record<MascotProps["action"], string> = {
  idle: "tig-float",
  cheer: "tig-pulse",
  sad: "opacity-70 grayscale-[.4]",
  attack: "tig-pulse",
  hit: "tig-strobe",
  evolve: "tig-pulse",
  win: "tig-pulse",
};

export function TigMascot({ slot, level, color, action, className }: MascotProps) {
  const ring = level === 3 ? "conic-gradient(from 0deg, #ffd15c, #ff2d3d, #9b5cff, #39e0ff, #ffd15c)" : level === 2 ? "conic-gradient(from 0deg, #9b5cff, #39e0ff, #9b5cff)" : `conic-gradient(from 0deg, ${color}, ${color}88, ${color})`;
  return (
    <div className={clsx("relative flex aspect-square flex-col items-center justify-center", className)} role="img" aria-label={slot ? `Mascotte ${slot}, livello ${level}: in arrivo` : "Mascotte da scegliere"}>
      <div className={clsx("relative grid aspect-square w-[78%] place-items-center rounded-full p-[6%]", ACTION_CLASS[action])} style={{ background: ring, boxShadow: `0 0 ${level * 14}px ${color}66` }}>
        <div className="grid h-full w-full place-items-center rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${color}55, #0b0d16 70%)` }}>
          <span className="tig-display text-[clamp(1rem,32cqw,4.5rem)] leading-none text-white/90 [container-type:inline-size]" style={{ textShadow: `0 0 18px ${color}` }}>
            {slot ?? "?"}
          </span>
        </div>
        {level > 1 && (
          <span aria-hidden className="absolute -top-[6%] left-1/2 -translate-x-1/2 text-[clamp(.7rem,9cqw,1.4rem)] leading-none">
            {level === 3 ? "★★★" : "★★"}
          </span>
        )}
      </div>
      <span className="mt-[4%] whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[clamp(.5rem,2.2vmin,.75rem)] font-black uppercase tracking-[0.12em] text-white/75">Mascotte in arrivo</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------------
function HostSilhouette({ host }: { host: ArenaHost }) {
  const mouth = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!host.speaking) return;
    let raf = 0;
    const tick = () => {
      const v = host.mouthRef?.current ?? 0;
      if (mouth.current) mouth.current.style.transform = `scaleY(${0.15 + Math.min(1, v) * 0.85})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [host.speaking, host.mouthRef]);
  return (
    <div className={clsx("flex flex-col items-center gap-1 transition-transform duration-300", host.speaking && "scale-110")}>
      <div className={clsx("relative grid h-16 w-16 place-items-center rounded-full border-2 bg-gradient-to-b from-[#2a2f45] to-[#0c0e16] sm:h-20 sm:w-20", host.speaking ? "border-[#ffb020] shadow-[0_0_30px_rgba(255,176,32,.6)]" : "border-white/20")}>
        <span aria-hidden className="absolute top-[34%] flex gap-3">
          <i className="block h-1.5 w-1.5 rounded-full bg-white/80" />
          <i className="block h-1.5 w-1.5 rounded-full bg-white/80" />
        </span>
        <span ref={mouth} aria-hidden className="absolute top-[58%] block h-3 w-5 origin-top rounded-b-full bg-[#ff2d3d]" style={{ transform: "scaleY(.15)" }} />
      </div>
      <span className="rounded bg-black/60 px-1.5 text-[10px] font-black uppercase tracking-widest text-white/80">{HOST_NAME[host.who] ?? host.who}</span>
    </div>
  );
}

function Pod({ team, highlight, dim, compact }: { team: ArenaTeam; highlight: boolean; dim: boolean; compact: boolean }) {
  return (
    <div
      className={clsx(
        "relative flex min-w-0 flex-col items-center rounded-2xl border px-1.5 pb-1.5 pt-1 transition-all duration-500",
        highlight ? "z-10 scale-110 border-white/70 bg-black/70" : "border-white/10 bg-black/45",
        dim && "opacity-45",
      )}
      style={{ boxShadow: highlight ? `0 0 40px ${team.color}aa, inset 0 0 0 2px ${team.color}` : `inset 0 -3px 0 ${team.color}` } as CSSProperties}
    >
      {!compact && <TigMascot slot={team.mascotSlot} level={team.mascotLevel} color={team.color} action={highlight ? "cheer" : "idle"} quality="2d" className="w-[min(9vmin,5.5rem)] [&>span]:hidden" />}
      <div className="flex w-full items-center justify-center gap-1">
        <span className="tig-display text-[clamp(.75rem,2.1vmin,1.15rem)] text-white/70">T{team.tableNo}</span>
        <span className={clsx("h-1.5 w-1.5 rounded-full", team.online ? "bg-[#7cff4f]" : "bg-white/25")} aria-label={team.online ? "online" : "offline"} />
      </div>
      <span className="tig-display tabular-nums text-[clamp(.9rem,2.8vmin,1.6rem)] text-white">{team.score.toLocaleString("it-IT")}</span>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div className="tig-energy h-full rounded-full" style={{ width: `${Math.round(team.chaosProgress * 100)}%` }} />
      </div>
    </div>
  );
}

export function TigArena({ phase, teams, mancheNo, title, subtitle, spotlight, hosts, safeArea, className, onReady }: ArenaProps) {
  const readyCb = useRef(onReady);
  useEffect(() => {
    readyCb.current = onReady;
  });
  useEffect(() => {
    const t = setTimeout(() => readyCb.current?.(), 60);
    return () => clearTimeout(t);
  }, []);
  const sa = safeArea ?? { left: 0, top: 0, right: 0, bottom: 0 };
  const spot = new Set(spotlight?.teamIds ?? []);
  const sorted = [...teams].sort((a, b) => a.tableNo - b.tableNo);
  const compact = sorted.length > 10;
  const showPods = phase !== "awards" && sorted.length > 0;
  return (
    <div className={clsx("tig-arena", className)} data-phase={phase} aria-hidden>
      <div className="tig-arena-beam left-[6%]" style={{ animationDelay: "-2s" }} />
      <div className="tig-arena-beam left-[38%]" style={{ animationDelay: "-5s", background: "linear-gradient(180deg, rgba(255,45,61,.14), transparent 75%)" }} />
      <div className="tig-arena-beam right-[6%]" style={{ animationDelay: "-7s", background: "linear-gradient(180deg, rgba(155,92,255,.16), transparent 75%)" }} />
      <div className="tig-arena-floor" />
      {/* ledwall in alto */}
      <div className="absolute inset-x-0 flex flex-col items-center px-4 text-center" style={{ top: `calc(${sa.top * 100}% + 1.2vmin)` }}>
        {mancheNo ? <span className="tig-chip mb-1 !border-[#ffb020]/50 !text-[#ffd15c]">MANCHE {mancheNo}</span> : null}
        {title && <p className={clsx("tig-led max-w-[92vw] text-[clamp(1.6rem,6vmin,4.6rem)] leading-none", phase === "chaos" && "tig-strobe !text-[#ff8a95]")}>{title}</p>}
        {subtitle && <p className="mt-1 max-w-[80vw] text-[clamp(.8rem,2.2vmin,1.3rem)] font-bold text-white/70">{subtitle}</p>}
      </div>
      {/* presentatori */}
      {hosts.length > 0 && (
        <div className="absolute flex gap-3" style={{ left: `calc(${sa.left * 100}% + 1.5vmin)`, bottom: `calc(${sa.bottom * 100}% + ${showPods ? "13vmin" : "2vmin"})` }}>
          {hosts.map((h) => (
            <HostSilhouette key={h.who} host={h} />
          ))}
        </div>
      )}
      {/* le postazioni dei tavoli */}
      {showPods && (
        <div
          className="absolute grid gap-[1vmin]"
          style={{
            left: `calc(${sa.left * 100}% + 1.5vmin)`,
            right: `calc(${sa.right * 100}% + 1.5vmin)`,
            bottom: `calc(${sa.bottom * 100}% + 1.5vmin)`,
            gridTemplateColumns: `repeat(${Math.min(sorted.length, compact ? 12 : 8)}, minmax(0, 1fr))`,
          }}
        >
          {sorted.map((t) => (
            <Pod key={t.teamId} team={t} highlight={spot.has(t.teamId)} dim={spot.size > 0 && !spot.has(t.teamId) && (phase === "chaos" || phase === "duel")} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}
