"use client";

import { clsx } from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import type { Phase, PublicState } from "@/lib/giramente/types";
import { getGiramenteVoice, useAudioPrefs, useSpeech } from "./audio";
import { segmentsFor } from "./stage";
import { cueKey, ledFor, serverPhaseStart } from "./studio-cue";
import type { LedContent } from "./three/studio/led-texture";
import type { StudioCue } from "./three/studio/studio-director";
import { setStudioWindow } from "./three/studio/studio-window";
import type { Studio3DProps } from "./three/studio/Studio3D";
import { useQuality } from "./ui";
import type { VisualQuality } from "./visuals";

/**
 * Collegamento tra la partita e lo STUDIO 3D: quando il dispositivo regge il 3D (qualità "high" o "low") la pagina
 * del gioco diventa uno studio televisivo (canvas unico, fisso, sotto l'interfaccia) e le schermate delle fasi
 * diventano un HUD sopra la scena. Con qualità "2d" (niente WebGL, renderer software, movimento ridotto) o se il
 * 3D si rompe, resta l'impaginazione 2D di sempre. `?studio=0` nell'URL la forza (diagnostica).
 */
const Studio3D = dynamic<Studio3DProps>(() => import("./three/studio/Studio3D"), { ssr: false, loading: () => null });

export interface StudioMode {
  /** lo studio 3D è attivo (layout HUD) */
  on: boolean;
  quality: VisualQuality;
  fail: (reason: string) => void;
}

export function useStudio(): StudioMode {
  const quality = useQuality();
  const [failed, setFailed] = useState(false);
  const [off, setOff] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setOff(new URLSearchParams(window.location.search).get("studio") === "0");
      } catch {
        /* URL non leggibile: studio attivo */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const fail = useCallback((reason: string) => {
    console.warn(`[giramente] studio 3D → interfaccia 2D: ${reason}`);
    setFailed(true);
  }, []);
  return { on: quality !== "2d" && !failed && !off, quality, fail };
}

/** Regia dalla partita: fase, chiave della fase e inizio secondo il server (la regia nel canvas lo affina). */
function useCue(state: PublicState): StudioCue {
  const key = cueKey(state);
  const since = serverPhaseStart(state);
  const sector = state.turn?.sector ?? null;
  const correct = state.result ? state.result.correct : null;
  const spinMs = state.wheel.spin?.durationMs ?? null;
  const finale = state.roundNo === 5 || state.stage === "tiebreak";
  return useMemo(() => ({ phase: state.phase, key, since, sector, correct, stage: state.stage, spinMs, finale }), [state.phase, key, since, sector, correct, state.stage, spinMs, finale]);
}

// ---------------------------------------------------------------------------
// Il canvas dello studio (fisso, sotto l'HUD)
// ---------------------------------------------------------------------------
export function StudioBackdrop({ state, now, quality, onFail }: { state: PublicState; now: () => number; quality: VisualQuality; onFail: (r: string) => void }) {
  const prefs = useAudioPrefs();
  const speech = useSpeech();
  const cue = useCue(state);
  const led = useMemo(() => ledFor(state), [state]);
  const ledKey = JSON.stringify(led);
  const stableLed = useMemo(() => JSON.parse(ledKey) as LedContent, [ledKey]);
  const finale = state.wheel.finale;
  const segments = useMemo(() => segmentsFor({ wheel: { finale } } as PublicState), [finale]);
  const spin = state.wheel.spin;
  const wheel = useMemo(
    () => ({
      segments,
      spin: spin ? { spinId: spin.spinId, targetIndex: spin.targetIndex, startedAt: Date.parse(spin.startedAt), durationMs: spin.durationMs } : null,
      restIndex: state.wheel.restIndex,
      highlight: state.phase !== "SPINNING" && !!state.turn?.sector,
    }),
    [segments, spin, state.wheel.restIndex, state.phase, state.turn?.sector],
  );
  const mouth = getGiramenteVoice().mouth as RefObject<number>;
  const speak = useMemo(() => ({ who: speech.who, speaking: !!speech.caption, mouthRef: speech.audible ? mouth : undefined }), [speech.who, speech.caption, speech.audible, mouth]);
  const sfx = prefs.sfx;
  const onTick = useCallback(() => {
    if (sfx) getSoundEngine().play("wheelTick");
  }, [sfx]);
  if (quality === "2d") return null;
  return (
    <div aria-hidden className="gm-studio-canvas pointer-events-none fixed inset-0 z-0">
      <Studio3D quality={quality} cue={cue} wheel={wheel} led={stableLed} speech={speak} now={now} onTick={onTick} onFail={onFail} className="!absolute inset-0" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// La finestra libera per la scena (l'HUD la lascia vuota; lo studio ci inquadra i soggetti)
// ---------------------------------------------------------------------------
export function StudioWindow({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setStudioWindow(ref.current);
    return () => setStudioWindow(null);
  }, []);
  return (
    <div ref={ref} data-gm-studio-window className={clsx("pointer-events-none", className)} style={style}>
      {children}
    </div>
  );
}

/** Sottopancia del presentatore (o di Zafira) nella scena: chi parla e cosa dice. */
export function StudioCaption({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const speech = useSpeech();
  if (!speech.caption) return null;
  const zafira = speech.who === "zafira";
  return (
    <div className={clsx("gm-pop pointer-events-none flex max-w-3xl flex-col items-start", className)} aria-live="polite">
      <span className={clsx("gm-display -mb-1 ml-3 rounded-t-lg px-3 py-0.5 text-[#080b0d]", zafira ? "bg-[#ff253a] text-white" : "bg-[#39ff14]", size === "lg" ? "text-xl" : size === "sm" ? "text-[11px]" : "text-sm")}>{zafira ? "ZAFIRA" : "DON PATRIZIO"}</span>
      <p className={clsx("gm-caption rounded-2xl font-bold", size === "lg" ? "px-4 py-2 text-2xl" : size === "sm" ? "line-clamp-2 px-3 py-1.5 text-[13px] leading-snug" : "px-4 py-2 text-base md:text-lg")}>{speech.caption}</p>
    </div>
  );
}

/** Larghezza del pannello laterale (PC e TV) per fase: stretto mentre la ruota è protagonista, nascosto durante il giro. */
export function sidePanelWidth(phase: Phase, tv: boolean): string {
  switch (phase) {
    case "SPINNING":
      return "0px";
    case "SPIN":
      return tv ? "clamp(20rem, 24vw, 30rem)" : "clamp(19rem, 26vw, 25rem)";
    case "CHOICE":
    case "WHEEL_RESULT":
      return tv ? "clamp(24rem, 30vw, 36rem)" : "clamp(24rem, 32vw, 30rem)";
    case "LOBBY":
      return tv ? "clamp(28rem, 40vw, 46rem)" : "clamp(28rem, 44vw, 42rem)";
    default:
      return tv ? "clamp(30rem, 44vw, 52rem)" : "clamp(28rem, 44vw, 42rem)";
  }
}

/** Altezza della finestra della scena sul telefono (il resto è HUD, che scorre sopra la scena). */
export function phoneWindowHeight(phase: Phase): string {
  switch (phase) {
    case "SPIN":
    case "SPINNING":
      return "56svh";
    case "WHEEL_RESULT":
    case "FINAL":
      return "40svh";
    case "CHOICE":
    case "INTRO":
    case "ROUND_INTRO":
    case "TURN_READY":
      return "36svh";
    case "LOBBY":
    case "ROUND_RESULTS":
    case "REVEAL":
      return "30svh";
    case "PLAY":
      return "25svh";
    default:
      return "27svh";
  }
}
