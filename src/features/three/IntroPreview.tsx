"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getSoundEngine } from "../media/audio-engine";
import { INTRO_DURATION_MS } from "./timeline";
import { preloadIntroAssets } from "./assets";

/** Caricata solo nel browser: niente SSR per WebGL/Web Audio. */
const IntroSequenceView = dynamic(() => import("./IntroSequence").then((m) => m.IntroSequenceView), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#07020d]" />,
});

export interface IntroPreviewOptions {
  /** Secondi di partenza (offset su startedAt), es. ?t=15 */
  startAt: number;
  /** Congela il tempo a startAt (screenshot deterministici), es. ?freeze=1 */
  freeze: boolean;
  fallback: boolean;
  reducedMotion: boolean;
  lowPower: boolean;
  muted: boolean;
  /** Segmento regole (?rules=0 per saltarlo). */
  rules: boolean;
  /** Nasconde i controlli (?ui=0). */
  showUi: boolean;
}

/**
 * Anteprima a tutto schermo dell'intro (utile anche agli admin):
 * "Riavvia" riparte da 0, "Salta" simula SALTA INTRO (startedAt molto nel passato).
 */
export function IntroPreview(opts: IntroPreviewOptions) {
  const [startedAtMs, setStartedAtMs] = useState(() => Date.now() - opts.startAt * 1000);
  const [frozenAt, setFrozenAt] = useState<number | null>(() => (opts.freeze ? Date.now() : null));
  const [reducedMotion, setReducedMotion] = useState(opts.reducedMotion);
  const [lowPower, setLowPower] = useState(opts.lowPower);
  const [rules, setRules] = useState(opts.rules);
  const [muted, setMuted] = useState(opts.muted);
  const [fallback, setFallback] = useState(opts.fallback);
  const [finishedCount, setFinishedCount] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    preloadIntroAssets();
    return getSoundEngine().subscribe(({ unlocked }) => setAudioOn(unlocked));
  }, []);

  // il "server" qui è l'orologio locale (eventualmente congelato)
  const now = () => (frozenAt !== null ? frozenAt : Date.now());

  useEffect(() => {
    const iv = window.setInterval(() => setElapsed(((frozenAt ?? Date.now()) - startedAtMs) / 1000), 200);
    return () => window.clearInterval(iv);
  }, [startedAtMs, frozenAt]);

  const restart = () => {
    setFrozenAt(null);
    setFinishedCount(0);
    setStartedAtMs(Date.now());
  };
  const skip = () => {
    setFrozenAt(null);
    setFinishedCount(0);
    // come "SALTA INTRO" lato admin: startedAt molto nel passato
    setStartedAtMs(Date.now() - INTRO_DURATION_MS - 600_000);
  };

  const btn = "rounded-full border border-white/25 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/15 active:scale-95 transition";
  const chip = (on: boolean) => `${btn} ${on ? "!bg-[#FFD43B] !text-[#170824] !border-[#FFD43B]" : ""}`;

  return (
    <div className="fixed inset-0 bg-black">
      <IntroSequenceView
        key={`${fallback}-${lowPower}-${rules}`}
        startedAtMs={startedAtMs}
        now={now}
        reducedMotion={reducedMotion}
        lowPower={lowPower}
        muted={muted}
        forceFallback={fallback}
        explainRules={rules}
        onFinished={() => setFinishedCount((c) => c + 1)}
      />
      {opts.showUi && (
        <div className="group fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-black/40 p-2 opacity-30 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" className={btn} onClick={restart}>
              Riavvia
            </button>
            <button type="button" className={btn} onClick={skip}>
              Salta
            </button>
            {!audioOn && (
              <button type="button" className={`${btn} !bg-[#FF1493]`} onClick={() => void getSoundEngine().unlock()}>
                Attiva audio
              </button>
            )}
            <button type="button" className={chip(muted)} onClick={() => setMuted((v) => !v)}>
              Muto
            </button>
            <button type="button" className={chip(reducedMotion)} onClick={() => setReducedMotion((v) => !v)}>
              Movimento ridotto
            </button>
            <button type="button" className={chip(rules)} onClick={() => setRules((v) => !v)}>
              Regole
            </button>
            <button type="button" className={chip(lowPower)} onClick={() => setLowPower((v) => !v)}>
              Low power
            </button>
            <button type="button" className={chip(fallback)} onClick={() => setFallback((v) => !v)}>
              Fallback 2D
            </button>
            <span className="px-2 font-mono text-xs tabular-nums text-white/80">
              t={elapsed.toFixed(1)}s / {(INTRO_DURATION_MS / 1000).toFixed(1)}s{finishedCount > 0 ? " · finita" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
