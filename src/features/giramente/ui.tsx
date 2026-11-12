"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import { formatPoints } from "@/lib/giramente/rules";
import type { PublicCompetitor, PublicState, PublicTimer, Standing } from "@/lib/giramente/types";
import { getSoundEngine } from "@/features/media/audio-engine";
import { getGiramenteVoice, savePrefs, useAudioPrefs, useSpeech } from "./audio";
import { detectVisualQuality, GiramenteCharacter, type VisualQuality } from "./visuals";
import { useTick } from "./use-giramente";

// ---------------------------------------------------------------------------
// Logo e intestazioni
// ---------------------------------------------------------------------------
export function Logo({ size = "md", tagline = false, className }: { size?: "sm" | "md" | "lg" | "xl"; tagline?: boolean; className?: string }) {
  const cls = { sm: "text-3xl", md: "text-5xl", lg: "text-7xl", xl: "text-[clamp(4rem,11vw,8.5rem)]" }[size];
  return (
    <div className={clsx("inline-flex flex-col items-center", className)}>
      <span className={clsx("gm-logo -skew-x-6 whitespace-nowrap", cls)}>
        GIRAMENTE<span className="gm-logo-bang">!</span>
      </span>
      {tagline && (
        <span className="mt-2 -rotate-2 rounded-md bg-[#f4f6f7] px-3 py-1 text-sm font-black italic text-[#080b0d] shadow-[0_6px_18px_rgba(0,0,0,.6)] sm:text-base">
          La ruota gira. La <span className="text-[#0f7a2a] underline decoration-[#39ff14] decoration-2">mente</span> decide.
        </span>
      )}
    </div>
  );
}

/** «MANCHE 1 di 5» con i pallini. */
export function RoundBadge({ roundNo, className }: { roundNo: number; className?: string }) {
  return (
    <div className={clsx("gm-panel inline-flex flex-col items-start gap-1 rounded-2xl px-3 py-1.5", className)} aria-label={`Manche ${roundNo} di 5`}>
      <span className="gm-display text-sm leading-none sm:text-base">
        MANCHE <span className="text-[#39ff14]">{roundNo}</span> di 5
      </span>
      <span className="flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={clsx("h-2.5 w-2.5 rounded-full border", n <= roundNo ? "border-[#39ff14] bg-[#39ff14] shadow-[0_0_8px_#39ff14]" : "border-white/40")} />
        ))}
      </span>
    </div>
  );
}

export function RoundTitle({ name, subtitle, className }: { name: string; subtitle?: string; className?: string }) {
  return (
    <div className={clsx("gm-panel gm-panel-green inline-flex items-center gap-3 rounded-2xl px-4 py-2", className)}>
      <BrainIcon className="h-8 w-8 shrink-0 text-[#39ff14]" />
      <div className="min-w-0">
        <p className="gm-display text-xl leading-none sm:text-2xl">{name}</p>
        {subtitle && <p className="mt-0.5 text-xs font-bold text-white/80 sm:text-sm">{subtitle}</p>}
      </div>
    </div>
  );
}

export function BrainIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4.5a3 3 0 0 0-5.6-1.2A3 3 0 0 0 3 6.2a3 3 0 0 0-.6 5.3A3.2 3.2 0 0 0 5.2 17a3 3 0 0 0 5.6 1.2A2.9 2.9 0 0 0 12 18V4.5z" />
      <path d="M12 4.5a3 3 0 0 1 5.6-1.2A3 3 0 0 1 21 6.2a3 3 0 0 1 .6 5.3A3.2 3.2 0 0 1 18.8 17a3 3 0 0 1-5.6 1.2A2.9 2.9 0 0 1 12 18" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Timer (ora del server; fermo in pausa)
// ---------------------------------------------------------------------------
export function timeLeft(timer: PublicTimer, now: number, pausedAt: string | null): number | null {
  if (!timer.deadlineAt) return null;
  const ref = pausedAt ? Date.parse(pausedAt) : now;
  return Math.max(0, Date.parse(timer.deadlineAt) - ref);
}

export function Timer({ timer, now, pausedAt, size = "md", className }: { timer: PublicTimer; now: () => number; pausedAt: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  useTick(!!timer.deadlineAt, 200);
  const left = timeLeft(timer, now(), pausedAt);
  if (left === null) return null;
  const total = timer.totalMs ?? left;
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  const sec = Math.ceil(left / 1000);
  const urgent = sec <= 5;
  const dim = { sm: 56, md: 76, lg: 120 }[size];
  const r = dim / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <div className={clsx("relative grid shrink-0 place-items-center", className)} style={{ width: dim, height: dim }} role="timer" aria-label={`${sec} secondi`}>
      <svg width={dim} height={dim} className="gm-timer-ring absolute inset-0">
        <circle cx={dim / 2} cy={dim / 2} r={r} stroke="rgba(255,255,255,.15)" strokeWidth={6} fill="rgba(8,11,13,.85)" />
        <circle cx={dim / 2} cy={dim / 2} r={r} stroke={urgent ? "#ff253a" : "#39ff14"} strokeWidth={6} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" />
      </svg>
      <span className={clsx("gm-display relative tabular-nums", size === "lg" ? "text-5xl" : size === "md" ? "text-3xl" : "text-xl", urgent && "text-[#ff253a]")}>{pausedAt ? "II" : sec}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Classifica
// ---------------------------------------------------------------------------
const MEDAL = ["#f5c542", "#d7dde1", "#d08a4b"];

export function Leaderboard({ state, highlight, compact = false, className, title = true }: { state: PublicState; highlight?: string | null; compact?: boolean; className?: string; title?: boolean }) {
  const byId = new Map(state.competitors.map((c) => [c.id, c]));
  return (
    <section className={clsx("gm-panel rounded-3xl p-3 text-left sm:p-4", className)} aria-label="Classifica">
      {title && (
        <h2 className="gm-display mb-2 flex items-center gap-2 text-2xl">
          <span aria-hidden className="text-[#39ff14]">▮▮▮</span> CLASSIFICA
        </h2>
      )}
      <ol className="flex flex-col gap-1.5">
        {state.standings.map((s: Standing) => {
          const c = byId.get(s.competitorId);
          if (!c) return null;
          return <StandingRow key={s.competitorId} s={s} c={c} me={highlight === c.id} compact={compact} turn={state.turn?.competitorId === c.id || state.stagePlay?.competitorId === c.id} />;
        })}
      </ol>
    </section>
  );
}

function StandingRow({ s, c, me, compact, turn }: { s: Standing; c: PublicCompetitor; me: boolean; compact: boolean; turn: boolean }) {
  const medal = s.position <= 3 ? MEDAL[s.position - 1] : null;
  return (
    <li
      className={clsx(
        "flex items-center gap-2 rounded-full border px-2 py-1 transition",
        me ? "border-[#39ff14] bg-[#0f3a14]/70" : s.position === 1 ? "border-[#f5c542]/70 bg-black/50" : "border-white/12 bg-black/45",
        turn && "ring-2 ring-[#39ff14]/70",
      )}
    >
      <span
        className={clsx("gm-display grid shrink-0 place-items-center rounded-full", compact ? "h-7 w-7 text-base" : "h-9 w-9 text-xl")}
        style={medal ? { background: `radial-gradient(circle at 35% 30%, #fff8, ${medal})`, color: "#1a1204" } : { background: "#20262b" }}
      >
        {s.position}
      </span>
      <span className={clsx("min-w-0 flex-1 truncate font-extrabold", compact ? "text-sm" : "text-lg")}>
        {c.kind === "team" ? "👥 " : ""}
        {c.name}
        {c.jolly && <span className="ml-1.5 rounded-full bg-[#ff253a]/20 px-1.5 text-xs font-black text-[#ff8a95]" title={c.jolly === "occhio" ? "Occhio Furbo" : "Scudo"}>♦ {c.jolly === "occhio" ? "OCCHIO" : "SCUDO"}</span>}
        {!c.online && <span className="ml-1.5 text-xs text-white/50">(offline)</span>}
      </span>
      <span className={clsx("gm-display tabular-nums", compact ? "text-lg" : "text-2xl", s.position === 1 ? "text-[#f5c542]" : "text-white")}>{formatPoints(c.score)}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Opzioni A–D (tasti 1–4 sul PC)
// ---------------------------------------------------------------------------
const LETTERS = ["A", "B", "C", "D"];

export function Options({
  options,
  enabled,
  onPick,
  picked,
  reveal,
  keyHints,
}: {
  options: string[];
  enabled: boolean;
  onPick: (i: number) => void;
  picked: number | null;
  /** dopo il risultato: indice giusto */
  reveal?: { correct: number | null; given: number | null } | null;
  keyHints: boolean;
}) {
  useAnswerKeys({ enabled, count: options.length, onPick });
  return (
    <div className="grid w-full gap-2 sm:grid-cols-2 sm:gap-3">
      {options.map((o, i) => {
        const state = reveal ? (reveal.correct === i ? "correct" : reveal.given === i ? "wrong" : undefined) : undefined;
        return (
          <button key={i} type="button" className="gm-option" disabled={!enabled} aria-pressed={picked === i} data-state={state} onClick={() => onPick(i)}>
            <span className="gm-letter">{LETTERS[i]}</span>
            <span className="min-w-0 flex-1">{o}</span>
            {keyHints && enabled && <kbd className="rounded border border-white/30 px-1.5 text-xs font-black text-white/60">{i + 1}</kbd>}
          </button>
        );
      })}
    </div>
  );
}

/** Blocco visivo degli enigmi di prospettiva (testo a larghezza fissa, alternativa accessibile). */
export function VisualBlock({ visual, className }: { visual: string; className?: string }) {
  return (
    <pre className={clsx("gm-visual mx-auto w-fit rounded-2xl border border-[#39ff14]/30 bg-black/70 px-5 py-3 text-center text-2xl sm:text-3xl", className)} aria-label={`Figura: ${visual.replace(/\n/g, " / ")}`}>
      {visual}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Presentatore, Jolly e sottotitoli
// ---------------------------------------------------------------------------
export function useQuality(): VisualQuality {
  const [q, setQ] = useState<VisualQuality>("2d");
  useEffect(() => {
    const t = setTimeout(() => setQ(detectVisualQuality()), 0);
    return () => clearTimeout(t);
  }, []);
  return q;
}

/** Don Patrizio (o Zafira quando parla lei) con il sottotitolo della battuta in corso. */
export function PresenterDock({ compact = false, className, fallbackAction = "idle" }: { compact?: boolean; className?: string; fallbackAction?: "idle" | "saluto" | "presentazione" | "indica" | "applauso" | "vittoria" | "pensiero" }) {
  const speech = useSpeech();
  const quality = useQuality();
  const mouthRef = useRef<number>(0);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      mouthRef.current = getGiramenteVoice().mouth.current;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const who = speech.who ?? "dontralla";
  return (
    <div className={clsx("flex items-end gap-3", className)}>
      <GiramenteCharacter who={who} action={speech.caption ? "presentazione" : fallbackAction} speaking={!!speech.caption} mouthRef={mouthRef} framing="bust" quality={quality} className={compact ? "h-24 w-20 shrink-0" : "h-40 w-32 shrink-0"} />
      {speech.caption && (
        <p aria-live="polite" className={clsx("gm-caption gm-pop mb-6 max-w-xl rounded-2xl rounded-bl-none px-4 py-2 font-bold", compact ? "text-sm" : "text-lg")}>
          <span className={clsx("mr-1 font-black", who === "zafira" ? "text-[#ff6b7a]" : "text-[#39ff14]")}>{who === "zafira" ? "Zafira:" : "Don Patrizio:"}</span>
          {speech.caption}
        </p>
      )}
    </div>
  );
}

/** Sottotitolo in sovrimpressione (telefoni dove la voce non suona: niente personaggio). */
export function CaptionBar({ className }: { className?: string }) {
  const speech = useSpeech();
  if (!speech.caption) return null;
  return (
    <div className={clsx("pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3", className)} aria-live="polite">
      <p className="gm-caption gm-pop max-w-2xl rounded-2xl px-4 py-2 text-center text-base font-bold md:text-lg">
        <span className={clsx("mr-1 font-black", speech.who === "zafira" ? "text-[#ff6b7a]" : "text-[#39ff14]")}>{speech.who === "zafira" ? "Zafira:" : "Don Patrizio:"}</span>
        {speech.caption}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio: pannello rapido
// ---------------------------------------------------------------------------
export function AudioMenu({ className }: { className?: string }) {
  const prefs = useAudioPrefs();
  const [muted, setMuted] = useState(false);
  useEffect(() => getSoundEngine().subscribe((s) => setMuted(s.settings.muted)), []);
  const row = (label: string, on: boolean, toggle: () => void) => (
    <button type="button" role="switch" aria-checked={on} onClick={toggle} className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left font-bold hover:bg-white/8">
      <span>{label}</span>
      <span className={clsx("relative h-6 w-11 rounded-full transition", on ? "bg-[#1f8f2a]" : "bg-white/20")}>
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[1.4rem]" : "left-0.5")} />
      </span>
    </button>
  );
  return (
    <details className={clsx("relative", className)}>
      <summary className="gm-chip cursor-pointer list-none [&::-webkit-details-marker]:hidden" aria-label="Audio">
        <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
        <span className="hidden sm:inline">Audio</span>
      </summary>
      <div className="gm-panel absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl p-2">
        {row("Audio attivo", !muted, () => {
          const e = getSoundEngine();
          void e.unlock();
          e.setSettings({ muted: !muted });
          if (!muted) getGiramenteVoice().stop();
        })}
        {row("Sigla e musica", prefs.music, () => savePrefs({ ...prefs, music: !prefs.music }))}
        {row("Voci", prefs.voice, () => savePrefs({ ...prefs, voice: !prefs.voice }))}
        {row("Effetti", prefs.sfx, () => savePrefs({ ...prefs, sfx: !prefs.sfx }))}
      </div>
    </details>
  );
}

export function ErrorNote({ error, onClose }: { error: string | null; onClose: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="gm-panel gm-panel-red flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl px-4 py-3 font-bold">
      <span>{error}</span>
      <button type="button" className="gm-chip" onClick={onClose} aria-label="Chiudi">
        ✕
      </button>
    </div>
  );
}

export function LinkBadge({ status }: { status: string }) {
  if (status === "live" || status === "connecting") return null;
  return (
    <p role="status" className="fixed left-1/2 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 -translate-x-1/2 rounded-full bg-[#8f0d1c] px-4 py-1.5 text-sm font-black shadow-lg">
      {status === "offline" ? "Connessione assente: riprovo…" : "Riconnessione…"}
    </p>
  );
}

export function nameOf(state: PublicState, id: string | null | undefined): string {
  return state.competitors.find((c) => c.id === id)?.name ?? "";
}
