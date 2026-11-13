"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { captionOf, LINE_BY_ID, lineAudioUrl } from "@/lib/giramente/lines";
import { getGiramenteVoice, loadPrefs, THEME, type SpeechState } from "../audio";
import { Portrait2D } from "../three/Portrait2D";
import { Logo } from "../ui";
import { INTRO_2D_T, INTRO_LINE, INTRO_SAFETY_MS, INTRO_T, introCanEnd, introRevealed, introStep2d } from "./intro-script";

/**
 * INTRO DI GIRAMENTE! all'apertura del gioco (prima del menu), come in PSYCO. Lo studio 3D è quello del gioco
 * (un solo canvas, nella shell): qui ci sono l'orologio del copione (intro-script.ts), voce, sigla e l'interfaccia
 * sopra la scena — buio che si dirada, «SALTA INTRO ⏭», «▶ INIZIA» se l'audio è bloccato, sottotitoli.
 *
 *  - 3D se il dispositivo lo regge; altrimenti — niente WebGL vero, errore, caricamento oltre 9 s — la versione 2D
 *    (fasci di luce, ritratto, logo); movimento ridotto: versione ferma e corta. Lo decide la shell (`mode`).
 *  - Mai bloccante: «SALTA INTRO» (o Esc) sempre disponibile, fine sicura a 22 s dall'apertura.
 *  - Audio bloccato dal browser: «▶ INIZIA»; senza tocco parte da sola, muta, dopo 5 s.
 *  - Alla fine la sigla non si ferma: scende al volume del menu (come nei videogiochi).
 */
export type IntroPhase = "loading" | "gate" | "play" | "out" | "done";
export type IntroMode = "3d" | "2d" | "still";

const GATE_AUTOSTART_MS = 5_000;
const UNLOCK_WAIT_MS = 700;
export const THEME_INTRO_VOLUME = 0.5;
export const THEME_MENU_VOLUME = 0.2;
export const WELCOME = captionOf(LINE_BY_ID[INTRO_LINE]?.text ?? "");

const voiceAtFor = (m: IntroMode) => (m === "3d" ? INTRO_T.voiceAt : INTRO_2D_T[m === "still" ? "still" : "normal"].voiceAt);
/** 3D: 0 prima del titolo, 1 titolo acceso; 2D: 0 buio, 1 ritratto, 2 logo */
const stepAt = (t: number, m: IntroMode, talking: boolean) => (m === "3d" ? (introRevealed(t, talking) ? 1 : 0) : introStep2d(t, m === "still"));

export interface IntroTimeline {
  phase: IntroPhase;
  step: number;
  /** avvio dal tasto «▶ INIZIA» (gesto: sblocca l'audio) */
  start: () => void;
  skip: () => void;
}

/**
 * L'orologio dell'intro. `ready` = studio disegnato (o versione 2D); `clock` = orologio della shell (ms);
 * `onStart(at)` = istante di partenza sull'orologio della shell (il copione 3D conta da lì).
 */
export function useIntroTimeline({
  enabled,
  ready,
  mode,
  clock,
  onStart,
  onOut,
  onDone,
}: {
  enabled: boolean;
  ready: boolean;
  mode: IntroMode;
  clock: () => number;
  onStart: (atMs: number) => void;
  onOut: (skipped: boolean) => void;
  onDone: () => void;
}): IntroTimeline {
  const [phase, setPhase] = useState<IntroPhase>(enabled ? "loading" : "done");
  const [step, setStep] = useState(0);
  const started = useRef(false);
  const readied = useRef(false);
  const finished = useRef(!enabled);
  const startAt = useRef(0);
  const cues = useRef({ voice: false, seen: false, done: false, revealAt: null as number | null });
  const cbs = useRef({ onStart, onOut, onDone, clock });
  useEffect(() => {
    cbs.current = { onStart, onOut, onDone, clock };
  });

  // fine della battuta del benvenuto
  useEffect(
    () =>
      getGiramenteVoice().onState((s) => {
        const c = cues.current;
        if (!c.voice) return;
        if (s.caption) c.seen = true;
        else if (c.seen) c.done = true;
      }),
    [],
  );

  // intanto si scaricano sigla e benvenuto (i modelli li scarica lo studio)
  useEffect(() => {
    if (!enabled) return;
    const e = getSoundEngine();
    void e.loadBuffer(THEME);
    void e.loadBuffer(lineAudioUrl(INTRO_LINE));
  }, [enabled]);

  const finish = useCallback((fadeMs: number, skipped = false) => {
    if (finished.current) return;
    finished.current = true;
    const e = getSoundEngine();
    const v = getGiramenteVoice();
    v.stop();
    // saltata a metà frase: la voce si taglia subito (la sigla resta, al volume del menu)
    if (skipped) e.stopVoices();
    if (loadPrefs().music && started.current) e.playTheme({ url: THEME, loop: true, volume: THEME_MENU_VOLUME, fadeMs: 1400 });
    else if (!started.current) e.stopTheme(300);
    setPhase("out");
    cbs.current.onOut(skipped);
    setTimeout(() => {
      setPhase("done");
      cbs.current.onDone();
    }, fadeMs);
  }, []);

  const start = useCallback(() => {
    if (started.current || finished.current) return;
    started.current = true;
    startAt.current = cbs.current.clock();
    cbs.current.onStart(startAt.current);
    const prefs = loadPrefs();
    getGiramenteVoice().enabled = prefs.voice;
    if (prefs.music) getSoundEngine().playTheme({ url: THEME, from: 0, loop: true, volume: THEME_INTRO_VOLUME, fadeMs: 900 });
    setPhase("play");
  }, []);

  // pronta: parte subito se l'audio è sbloccato, altrimenti il tasto INIZIA
  useEffect(() => {
    if (!enabled || !ready || readied.current) return;
    readied.current = true;
    const unlocked = Promise.race([getSoundEngine().unlock(), new Promise<boolean>((r) => setTimeout(() => r(false), UNLOCK_WAIT_MS))]);
    void unlocked.then((ok) => {
      if (finished.current) return;
      if (ok) start();
      else setPhase((p) => (p === "loading" ? "gate" : p));
    });
  }, [enabled, ready, start]);

  // INIZIA non premuto → parte muta; sicurezza assoluta → fine
  useEffect(() => {
    if (phase !== "gate") return;
    const id = setTimeout(start, GATE_AUTOSTART_MS);
    return () => clearTimeout(id);
  }, [phase, start]);
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => finish(400), INTRO_SAFETY_MS);
    return () => clearTimeout(id);
  }, [enabled, finish]);

  // Esc = salta
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(250, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, finish]);

  // uscita dalla pagina a metà: niente voce che continua
  useEffect(
    () => () => {
      if (finished.current) return;
      getGiramenteVoice().stop();
      getSoundEngine().stopVoices();
    },
    [],
  );

  // copione: voce, accensione del titolo, fine
  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    const loop = () => {
      const t = (cbs.current.clock() - startAt.current) / 1000;
      const c = cues.current;
      const v = getGiramenteVoice();
      if (!c.voice && t >= voiceAtFor(mode)) {
        c.voice = true;
        v.say([{ cue: { line: INTRO_LINE }, caption: WELCOME }], true);
      }
      const s = stepAt(t, mode, !!v.state.caption);
      if (mode === "3d" && s === 1 && c.revealAt === null) {
        // si accende il titolo: applauso
        c.revealAt = t;
        if (loadPrefs().sfx) getSoundEngine().applause("medium");
      }
      setStep((prev) => (prev === s ? prev : s));
      if (introCanEnd(t, c.done, mode, c.revealAt)) {
        finish(900);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, mode, finish]);

  return { phase, step, start, skip: () => finish(250, true) };
}

/**
 * L'interfaccia dell'intro sopra lo studio: buio che si dirada, bande da cinema, caricamento, «▶ INIZIA»,
 * «SALTA INTRO», sottotitolo; in 2D anche la scena disegnata.
 */
export function IntroOverlay({ intro, mode, speech, mouthRef, progress }: { intro: IntroTimeline; mode: IntroMode; speech: SpeechState; mouthRef?: RefObject<number>; progress?: React.ReactNode }) {
  const { phase, step } = intro;
  const playing = phase === "play" || phase === "out";
  return (
    <div
      data-testid="giramente-intro"
      data-phase={phase}
      data-mode={mode}
      data-step={step}
      role="region"
      aria-label="Introduzione di GIRAMENTE!"
      className={clsx("fixed inset-0 z-[70] overflow-hidden text-[#f4f6f7] transition-opacity", phase === "out" ? "pointer-events-none opacity-0 duration-[900ms]" : "opacity-100 duration-300")}
    >
      <div className="absolute inset-0">
        {mode !== "3d" && <Intro2D step={step} still={mode === "still"} speaking={!!speech.caption} mouthRef={mouthRef} />}
        {/* «▶ INIZIA»: lo studio resta in penombra dietro il tasto */}
        <div aria-hidden className={clsx("pointer-events-none absolute inset-0 bg-black transition-opacity", !playing && phase === "gate" ? "opacity-55 duration-500" : "opacity-0 duration-[1200ms]")} />
      </div>
      <div aria-hidden className="gm-intro-bar pointer-events-none absolute inset-x-0 top-0 bg-black" />
      <div aria-hidden className="gm-intro-bar pointer-events-none absolute inset-x-0 bottom-0 bg-black" />

      {phase === "loading" && (
        <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center">
          <div className="flex w-[min(80vw,24rem)] flex-col items-center gap-5">
            <Logo size="lg" tagline className="gm-breathe" />
            {progress}
          </div>
        </div>
      )}

      {phase === "gate" && (
        <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center">
          <div className="gm-pop flex flex-col items-center gap-5">
            <Logo size="lg" tagline />
            <button type="button" className="gm-btn gm-pulse mt-2 h-16 px-10 text-3xl" autoFocus onClick={() => void getSoundEngine().unlock().then(intro.start)}>
              ▶ INIZIA
            </button>
            <p className="text-sm font-bold text-white/60">Con l&apos;audio. Parte da sola tra pochi secondi.</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={intro.skip}
        className="gm-chip absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-20 !bg-black/65 font-black tracking-widest backdrop-blur-sm hover:border-[#39ff14]/70"
      >
        SALTA INTRO ⏭
      </button>

      {speech.caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(9vh,calc(env(safe-area-inset-bottom)+2rem))] z-10 flex justify-center px-4" aria-live="polite">
          <div className="gm-pop flex max-w-3xl flex-col items-start">
            <span className="gm-display -mb-1 ml-3 rounded-t-lg bg-[#39ff14] px-3 py-0.5 text-sm text-[#080b0d] md:text-base">DON PATRIZIO</span>
            <p className="gm-caption rounded-2xl px-4 py-2 text-lg font-bold leading-snug md:px-5 md:text-2xl">{speech.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lo studio disegnato (niente 3D, o mentre il 3D si carica): buio, fasci di luce verdi e rossi che oscillano,
 * pavimento al neon. Fa da sfondo alla shell e alla versione 2D dell'intro. `still` = movimento ridotto.
 */
export function Studio2DBackdrop({ still = false, className }: { still?: boolean; className?: string }) {
  return (
    <div aria-hidden className={clsx("absolute inset-0 overflow-hidden bg-[#040607]", still && "gm-intro-still", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_42%,rgba(32,38,43,.85),#040607_75%)]" />
      <div className="gm-intro-beam gm-intro-beam-l" />
      <div className="gm-intro-beam gm-intro-beam-r" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[radial-gradient(ellipse_55%_60%_at_50%_100%,rgba(57,255,20,.2),transparent_70%)]" />
      <div className="absolute bottom-[9%] left-1/2 h-[7vh] w-[min(80vw,560px)] -translate-x-1/2 rounded-[50%] border-2 border-[#39ff14]/45 shadow-[0_0_40px_rgba(57,255,20,.35),inset_0_0_30px_rgba(57,255,20,.2)]" />
    </div>
  );
}

/** Versione 2D dell'intro: il ritratto di Don Patrizio con la voce, il logo che si accende, «IN ONDA». */
function Intro2D({ step, still, speaking, mouthRef }: { step: number; still: boolean; speaking: boolean; mouthRef?: RefObject<number> }) {
  const shown = still ? 2 : step;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Studio2DBackdrop still={still} />
      <div className="relative flex h-full flex-col items-center justify-center gap-[2.5vh] px-4 pb-[18vh] pt-[11vh]">
        <div className={clsx("transition-all duration-700 ease-out", shown >= 2 ? "scale-100 opacity-100 blur-0" : "scale-90 opacity-0 blur-sm")}>
          <Logo size="xl" tagline />
        </div>
        <Portrait2D
          who="dontralla"
          speaking={speaking}
          mouthRef={mouthRef}
          className={clsx("h-[min(36vh,320px)] w-[min(72vw,300px)] transition-all duration-700 ease-out", shown >= 1 ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0")}
        />
      </div>
      <span className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(0.85rem,env(safe-area-inset-top))] flex items-center gap-2 rounded-md bg-[#8f0d1c]/85 px-2.5 py-1 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_0_18px_rgba(255,37,58,.45)]">
        <span aria-hidden className={clsx("h-2 w-2 rounded-full bg-white", !still && "animate-pulse")} />
        In onda
      </span>
    </div>
  );
}
