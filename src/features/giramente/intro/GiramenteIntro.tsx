"use client";

import { clsx } from "clsx";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { captionOf, LINE_BY_ID, lineAudioUrl } from "@/lib/giramente/lines";
import { getGiramenteVoice, loadPrefs, THEME, type SpeechState } from "../audio";
import { Portrait2D } from "../three/Portrait2D";
import { detectVisualQuality, prefersReducedMotion } from "../three/quality";
import { WHEEL_SEGMENTS_STANDARD } from "../three/segments";
import type { Studio3DProps, StudioSpeech, StudioWheelInput } from "../three/studio/Studio3D";
import type { StudioCue } from "../three/studio/studio-director";
import { Logo } from "../ui";
import { markCreateIntroSeen, noteIntroPlayed, shouldShowCreateIntro } from "./flags";
import { INTRO_2D_T, INTRO_LINE, INTRO_SAFETY_MS, INTRO_T, introCanEnd, introDirection, introLed, introLights, introRevealed, introStep2d } from "./intro-script";

/**
 * INTRO DI GIRAMENTE! all'apertura di «Nuova partita» (prima delle impostazioni), come in PSYCO:
 * lo STUDIO 3D del gioco (lo stesso della partita, con un copione suo: vedi intro-script.ts) — buio, sigla, luci che
 * salgono, Don Patrizio che entra e saluta, il benvenuto con la sua voce, GIRAMENTE! che si accende sul LED — poi
 * dissolvenza sulle impostazioni. Circa 12–14 secondi.
 *
 *  - 3D se il dispositivo lo regge (qualità "high"/"low", come in partita); altrimenti — niente WebGL vero, errore,
 *    caricamento oltre 9 s — la versione 2D (fasci di luce, ritratto, logo); movimento ridotto: versione ferma e corta.
 *  - Mai bloccante: «SALTA INTRO ⏭» (o Esc) sempre disponibile, fine sicura a 22 s dall'apertura.
 *  - Audio bloccato dal browser: tasto «▶ INIZIA» al centro; senza tocco parte da sola, muta, dopo 5 s.
 *  - Intanto si scaricano modelli dello studio, sigla e voce: la sala d'attesa dopo li trova già pronti.
 */
const Studio3D = dynamic<Studio3DProps>(() => import("../three/studio/Studio3D"), { ssr: false, loading: () => null });

type Phase = "loading" | "gate" | "play" | "out";
type Mode = "3d" | "2d" | "still";

const LOAD_TIMEOUT_MS = 9_000;
const GATE_AUTOSTART_MS = 5_000;
const UNLOCK_WAIT_MS = 700;
const THEME_VOLUME = 0.5;
const WELCOME = captionOf(LINE_BY_ID[INTRO_LINE]?.text ?? "");
/** durata del clip del benvenuto (s, circa): serve solo alle anteprime ferme */
const WELCOME_SEC = 7;

const CUE: StudioCue = { phase: "INTRO", key: "INTRO|nuova-partita", since: 0, sector: null, correct: null, stage: null, spinMs: null, finale: false };
const JOLLY_INDEX = Math.max(
  0,
  WHEEL_SEGMENTS_STANDARD.findIndex((s) => s.kind === "jolly"),
);
/** la ruota gira da sola all'accensione dello studio (stesso orologio dell'intro) */
const WHEEL: StudioWheelInput = { segments: WHEEL_SEGMENTS_STANDARD, spin: { spinId: "intro", targetIndex: JOLLY_INDEX, startedAt: 150, durationMs: 7_000 }, restIndex: null, highlight: false };
const SILENT: SpeechState = { who: null, caption: null, audible: false };

const voiceAtFor = (m: Mode) => (m === "3d" ? INTRO_T.voiceAt : INTRO_2D_T[m === "still" ? "still" : "normal"].voiceAt);
/** anteprime ferme: il fotogramma cade durante il benvenuto? */
const frozenTalking = (t: number | null, m: Mode) => t !== null && t >= voiceAtFor(m) && t < voiceAtFor(m) + WELCOME_SEC;
/** 3D: 0 prima del titolo, 1 titolo acceso; 2D: 0 buio, 1 ritratto, 2 logo */
const stepAt = (t: number, m: Mode, talking: boolean) => (m === "3d" ? (introRevealed(t, talking) ? 1 : 0) : introStep2d(t, m === "still"));

export function IntroPlayer({ onDone, onOut, contained = false, force = null, freezeAt = null }: { onDone: () => void; onOut?: () => void; contained?: boolean; force?: "2d" | "still" | null; freezeAt?: number | null }) {
  const [quality] = useState(detectVisualQuality);
  const [mode, setMode] = useState<Mode>(() => (force === "still" || prefersReducedMotion() ? "still" : force !== "2d" && quality !== "2d" ? "3d" : "2d"));
  const [phase, setPhase] = useState<Phase>("loading");
  const [step, setStep] = useState(() => (freezeAt === null ? 0 : stepAt(freezeAt, mode, frozenTalking(freezeAt, mode))));
  const [speech, setSpeech] = useState<SpeechState>(SILENT);
  const clock = useRef(freezeAt === null ? 0 : freezeAt * 1000);
  const startWall = useRef(0);
  const started = useRef(false);
  const readied = useRef(false);
  const finished = useRef(false);
  const cues = useRef({ voice: false, seen: false, done: false, revealAt: null as number | null });

  // callback del genitore in un ref: la fine sicura e il copione non ripartono a ogni nuovo disegno del genitore
  const cbs = useRef({ onDone, onOut });
  useEffect(() => {
    cbs.current = { onDone, onOut };
  });

  const now = useCallback(() => clock.current, []);
  const lights = useCallback(() => introLights(clock.current / 1000), []);

  // voce di Don Patrizio: sottotitolo, bocca, fine della battuta
  useEffect(
    () =>
      getGiramenteVoice().onState((s) => {
        setSpeech(s);
        const c = cues.current;
        if (!c.voice) return;
        if (s.caption) c.seen = true;
        else if (c.seen) c.done = true;
      }),
    [],
  );

  // intanto si scaricano sigla e benvenuto (il modello lo scarica lo studio)
  useEffect(() => {
    const e = getSoundEngine();
    void e.loadBuffer(THEME);
    void e.loadBuffer(lineAudioUrl(INTRO_LINE));
  }, []);

  const finish = useCallback(
    (fadeMs: number, skipped = false) => {
      if (finished.current) return;
      finished.current = true;
      const e = getSoundEngine();
      const v = getGiramenteVoice();
      const talking = v.state.audible;
      v.stop();
      // saltata a metà frase: si taglia subito tutto (la voce non continua sopra le impostazioni)
      if (skipped && talking) e.silenceAll();
      else e.stopTheme(skipped ? 400 : 1600);
      setPhase("out");
      cbs.current.onOut?.();
      setTimeout(() => cbs.current.onDone(), fadeMs);
    },
    [],
  );

  const start = useCallback(() => {
    if (started.current || finished.current || freezeAt !== null) return;
    started.current = true;
    startWall.current = performance.now();
    const prefs = loadPrefs();
    getGiramenteVoice().enabled = prefs.voice;
    if (prefs.music) getSoundEngine().playTheme({ url: THEME, from: 0, loop: true, volume: THEME_VOLUME, fadeMs: 900 });
    setPhase("play");
  }, [freezeAt]);

  // pronta (studio disegnato o versione 2D): parte subito se l'audio è sbloccato, altrimenti il tasto INIZIA
  const ready = useCallback(() => {
    if (readied.current) return;
    readied.current = true;
    if (freezeAt !== null) {
      setPhase("play");
      return;
    }
    const unlocked = Promise.race([getSoundEngine().unlock(), new Promise<boolean>((r) => setTimeout(() => r(false), UNLOCK_WAIT_MS))]);
    void unlocked.then((ok) => {
      if (finished.current) return;
      if (ok) start();
      else setPhase((p) => (p === "loading" ? "gate" : p));
    });
  }, [freezeAt, start]);

  useEffect(() => {
    if (mode === "3d") return;
    const id = setTimeout(ready, 0);
    return () => clearTimeout(id);
  }, [mode, ready]);

  // caricamento troppo lungo → 2D; INIZIA non premuto → parte muta; sicurezza assoluta → fine
  useEffect(() => {
    if (phase !== "loading" || mode !== "3d") return;
    const id = setTimeout(() => setMode("2d"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase, mode]);
  useEffect(() => {
    if (phase !== "gate") return;
    const id = setTimeout(start, GATE_AUTOSTART_MS);
    return () => clearTimeout(id);
  }, [phase, start]);
  useEffect(() => {
    if (freezeAt !== null) return;
    const id = setTimeout(() => finish(400), INTRO_SAFETY_MS);
    return () => clearTimeout(id);
  }, [finish, freezeAt]);

  // Esc = salta
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(250, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // uscita dalla pagina a metà: niente sigla o voce che continuano
  useEffect(
    () => () => {
      if (finished.current) return;
      getGiramenteVoice().stop();
      getSoundEngine().stopTheme(300);
    },
    [],
  );

  // copione: voce, accensione del titolo, fine (l'orologio dell'intro avanza qui)
  useEffect(() => {
    if (phase !== "play" || freezeAt !== null) return;
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - startWall.current) / 1000;
      clock.current = t * 1000;
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
  }, [phase, mode, finish, freezeAt]);

  // anteprime ferme: il sottotitolo del benvenuto se il fotogramma cade durante la voce
  const shown: SpeechState = frozenTalking(freezeAt, mode) ? { who: "dontralla", caption: WELCOME, audible: false } : speech;
  const mouth = getGiramenteVoice().mouth as RefObject<number>;
  const studioSpeech = useMemo<StudioSpeech>(() => ({ who: "dontralla", speaking: !!shown.caption, mouthRef: shown.audible ? mouth : undefined }), [shown.caption, shown.audible, mouth]);
  const led = useMemo(() => introLed(step >= 1), [step]);
  const playing = phase === "play" || phase === "out";

  return (
    <div
      data-testid="giramente-intro"
      data-phase={phase}
      data-mode={mode}
      data-step={step}
      role="region"
      aria-label="Introduzione di GIRAMENTE!"
      className={clsx("z-[70] overflow-hidden bg-[#040607] text-[#f4f6f7] transition-opacity", contained ? "absolute inset-0" : "fixed inset-0", phase === "out" ? "pointer-events-none opacity-0 duration-[900ms]" : "opacity-100 duration-300")}
    >
      {/* la scena, tra le bande da cinema (in orizzontale) */}
      <div className="absolute inset-0 landscape:bottom-[5vh] landscape:top-[5vh]">
        {mode === "3d" ? (
          <Studio3D
            quality={quality === "low" ? "low" : "high"}
            cue={CUE}
            wheel={WHEEL}
            led={led}
            speech={studioSpeech}
            now={now}
            script={introDirection}
            lights={lights}
            onReady={ready}
            onFail={() => setMode("2d")}
            className={clsx("!absolute inset-0 transition-opacity duration-700", phase === "loading" ? "opacity-0" : "opacity-100")}
          />
        ) : (
          <Intro2D step={step} still={mode === "still"} speaking={!!shown.caption} mouthRef={shown.audible ? mouth : undefined} />
        )}
        {/* dal buio */}
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute inset-0 bg-black transition-opacity",
            // le luci salgono piano (insieme all'esposizione dello studio)
            playing ? (mode === "3d" ? "opacity-0 duration-[2600ms] ease-in" : "opacity-0 duration-[1200ms] ease-out") : phase === "gate" ? "opacity-55 duration-500" : mode === "3d" ? "opacity-100 duration-0" : "opacity-0 duration-0",
          )}
        />
      </div>
      {!contained && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-[5vh] bg-black landscape:block" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[5vh] bg-black landscape:block" />
        </>
      )}

      {phase === "loading" && mode === "3d" && (
        <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <Logo size="md" className="animate-pulse" />
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/55">Si accendono le luci dello studio…</p>
          </div>
        </div>
      )}

      {phase === "gate" && (
        <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center">
          <div className="gm-pop flex flex-col items-center gap-5">
            <Logo size="lg" tagline />
            <button type="button" className="gm-btn gm-pulse mt-2 h-16 px-10 text-3xl" autoFocus onClick={() => void getSoundEngine().unlock().then(start)}>
              ▶ INIZIA
            </button>
            <p className="text-sm font-bold text-white/60">Con l&apos;audio. Parte da sola tra pochi secondi.</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => finish(250, true)}
        className="gm-chip absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-20 !bg-black/65 font-black tracking-widest backdrop-blur-sm hover:border-[#39ff14]/70 landscape:top-[max(0.5rem,calc(2.5vh-1.125rem))]"
      >
        SALTA INTRO ⏭
      </button>

      {shown.caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(9vh,calc(env(safe-area-inset-bottom)+2rem))] z-10 flex justify-center px-4 landscape:bottom-[9vh]" aria-live="polite">
          <div className="gm-pop flex max-w-3xl flex-col items-start">
            <span className="gm-display -mb-1 ml-3 rounded-t-lg bg-[#39ff14] px-3 py-0.5 text-sm text-[#080b0d] md:text-base">DON PATRIZIO</span>
            <p className="gm-caption rounded-2xl px-4 py-2 text-lg font-bold leading-snug md:px-5 md:text-2xl">{shown.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Versione 2D (niente 3D): lo studio disegnato — buio, fasci di luce verdi e rossi che oscillano, il ritratto di
 * Don Patrizio con la voce, il logo che si accende. `still` (movimento ridotto): tutto fermo, subito visibile.
 */
function Intro2D({ step, still, speaking, mouthRef }: { step: number; still: boolean; speaking: boolean; mouthRef?: RefObject<number> }) {
  const shown = still ? 2 : step;
  return (
    <div className={clsx("absolute inset-0 overflow-hidden", still && "gm-intro-still")}>
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_42%,rgba(32,38,43,.85),#040607_75%)]" />
      <div aria-hidden className="gm-intro-beam gm-intro-beam-l" />
      <div aria-hidden className="gm-intro-beam gm-intro-beam-r" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[42%] bg-[radial-gradient(ellipse_55%_60%_at_50%_100%,rgba(57,255,20,.2),transparent_70%)]" />
      <div aria-hidden className="absolute bottom-[9%] left-1/2 h-[7vh] w-[min(80vw,560px)] -translate-x-1/2 rounded-[50%] border-2 border-[#39ff14]/45 shadow-[0_0_40px_rgba(57,255,20,.35),inset_0_0_30px_rgba(57,255,20,.2)]" />
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
      <span className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(0.85rem,env(safe-area-inset-top))] flex items-center gap-2 rounded-md bg-[#8f0d1c]/85 px-2.5 py-1 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_0_18px_rgba(255,37,58,.45)] landscape:top-[max(0.5rem,calc(2.5vh-0.8rem))]">
        <span aria-hidden className={clsx("h-2 w-2 rounded-full bg-white", !still && "animate-pulse")} />
        In onda
      </span>
    </div>
  );
}

const noop = () => () => {};

/**
 * «Nuova partita» nell'ordine voluto: 1. l'INTRO subito (una volta per scheda); 2. le impostazioni (modalità, nomi,
 * tempi); 3. «INIZIA PARTITA» → la sala d'attesa, che non ripete il benvenuto. Le impostazioni compaiono mentre
 * l'intro si dissolve (già impaginate sotto: nessun salto).
 */
export function NuovaIntroGate({ children }: { children: ReactNode }) {
  // null sul server e al primo disegno: schermo dello studio finché non si sa se parte l'intro
  const wanted = useSyncExternalStore(noop, shouldShowCreateIntro, () => null);
  const [stage, setStage] = useState<"intro" | "out" | "done">("intro");
  if (wanted === null) return <div aria-hidden className="fixed inset-0 z-[70] bg-[#040607]" />;
  const intro = wanted && stage !== "done";
  return (
    <>
      {intro && (
        <IntroPlayer
          onOut={() => {
            noteIntroPlayed();
            setStage("out");
          }}
          onDone={() => {
            markCreateIntroSeen();
            setStage("done");
          }}
        />
      )}
      <div className={clsx("w-full", wanted && stage === "intro" ? "hidden" : wanted && "gm-intro-reveal")}>{children}</div>
    </>
  );
}

/** Anteprima (/preview/giramente/intro?mode=3d|2d|still&t=…&q=high|low): riparte da capo a ogni fine. */
export function GiramenteIntroPreview({ force = null, freezeAt = null }: { force?: "2d" | "still" | null; freezeAt?: number | null }) {
  const [run, setRun] = useState(0);
  return <IntroPlayer key={run} force={force} freezeAt={freezeAt} onDone={() => setTimeout(() => setRun((r) => r + 1), 1500)} />;
}
