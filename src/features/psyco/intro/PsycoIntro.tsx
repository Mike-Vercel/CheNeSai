"use client";

import { clsx } from "clsx";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { getNarrator } from "../narrator";
import { deviceCaps, setIntroActive } from "../investigatore/device";
import { Silhouette } from "../ui";
import { characterAt, INTRO_T, introCanEnd } from "./timeline";

const IntroScene3D = lazy(() => import("./IntroScene3D"));

/**
 * INTRODUZIONE DI PSYCO (una volta per stanza, all'apertura della sala d'attesa).
 *
 * Dove: schermo TV/PC, dispositivo condiviso, telefono di chi gestisce senza TV (cioè dove suona la voce).
 * 3D (IntroScene3D) se il dispositivo regge; altrimenti — WebGL assente/software, lowPower, movimento
 * ridotto, errore, caricamento oltre 9 s — la versione illustrata 2D con la stessa voce.
 * Mai bloccante: «SALTA INTRO» sempre visibile, fine sicura a 25 s anche se la scheda è in pausa,
 * e le frasi del gioco trattenute durante l'intro (narrator.hold) ripartono sempre (release).
 * Audio bloccato (TV appena aperta): tasto «▶ INIZIA» al centro, parte da sola muta dopo 6 s.
 * Test automatici (navigator.webdriver): niente intro, salvo ?intro=1. ?intro=0 la spegne.
 */
const SFX = {
  passo: "/audio/psyco/sfx/passo.mp3",
  sedia: "/audio/psyco/sfx/sedia.mp3",
  lampada: "/audio/psyco/sfx/lampada.mp3",
  pioggia: "/audio/psyco/sfx/pioggia.mp3",
} as const;
const SAFETY_MS = 25_000;
const LOAD_TIMEOUT_MS = 9_000;
const GATE_AUTOSTART_MS = 6_000;
const seenKey = (roomId: string) => `psyco.intro.v1:${roomId}`;

/** Va mostrata? (lettura soltanto: la stanza si segna come vista quando l'intro parte davvero). */
export function shouldShowIntro(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search).get("intro");
  if (p === "0") return false;
  if (p === "1") return true;
  if (navigator.webdriver) return false;
  try {
    return localStorage.getItem(seenKey(roomId)) !== "1";
  } catch {
    return true;
  }
}

function markSeen(roomId: string) {
  try {
    localStorage.setItem(seenKey(roomId), "1");
  } catch {
    /* modalità privata: pazienza */
  }
}

/** Da mettere nelle schermate con voce: `eligible` = sala d'attesa aperta su un dispositivo che parla. */
export function PsycoIntro({ roomId, eligible }: { roomId: string; eligible: boolean }) {
  const [show, setShow] = useState(() => eligible && shouldShowIntro(roomId));
  if (!show) return null;
  return <IntroPlayer roomId={roomId} onDone={() => setShow(false)} />;
}

type Phase = "loading" | "gate" | "play" | "out";

export function IntroPlayer({ roomId, onDone, contained = false, force2d = false, freezeAt = null }: { roomId?: string; onDone: () => void; contained?: boolean; force2d?: boolean; freezeAt?: number | null }) {
  const caps = deviceCaps();
  const [mode, setMode] = useState<"3d" | "2d">(() => (!force2d && caps.webgl && !caps.lowPower && !caps.reducedMotion ? "3d" : "2d"));
  const [phase, setPhase] = useState<Phase>("loading");
  const [caption, setCaption] = useState<string | null>(null);
  const timeRef = useRef(freezeAt ?? 0);
  const runningRef = useRef(false);
  const started = useRef(false);
  const finished = useRef(false);
  const startWall = useRef(0);
  const bufs = useRef<Partial<Record<keyof typeof SFX, AudioBuffer | null>>>({});
  const rain = useRef<{ stop: (ms?: number) => void } | null>(null);
  const cues = useRef({ lamp: false, chair: false, voice: false, voiceSeen: false, voiceDone: false });

  // frasi del gioco trattenute finché l'intro non arriva alla voce (prima di qualsiasi effetto dei genitori)
  useLayoutEffect(() => {
    setIntroActive(true);
    if (freezeAt === null) getNarrator().hold();
    return () => {
      setIntroActive(false);
      getNarrator().release();
    };
  }, [freezeAt]);

  const finish = useCallback(
    (fadeMs: number) => {
      if (finished.current) return;
      finished.current = true;
      runningRef.current = false;
      // anche se saltata prima di partire: una volta per stanza
      if (roomId) markSeen(roomId);
      rain.current?.stop(fadeMs + 400);
      getNarrator().release(cues.current.voice ? [] : ["benvenuti"]);
      setPhase("out");
      setTimeout(onDone, fadeMs);
    },
    [onDone, roomId],
  );

  // effetti sonori: caricati subito (in parallelo al modello), mai indispensabili
  useEffect(() => {
    const e = getSoundEngine();
    for (const [k, url] of Object.entries(SFX) as [keyof typeof SFX, string][]) void e.loadBuffer(url).then((b) => (bufs.current[k] = b));
  }, []);
  const play = useCallback((k: keyof typeof SFX, opts: { gain?: number; rate?: number; loop?: boolean; fadeInMs?: number } = {}) => {
    const b = bufs.current[k];
    return b ? getSoundEngine().playBuffer(b, opts) : null;
  }, []);

  const start = useCallback(() => {
    if (started.current || freezeAt !== null) return;
    started.current = true;
    if (roomId) markSeen(roomId);
    startWall.current = performance.now();
    runningRef.current = true;
    rain.current = play("pioggia", { gain: 0.5, loop: true, fadeInMs: 1500 });
    setPhase("play");
  }, [freezeAt, play, roomId]);

  // pronto (modello caricato o versione 2D): parte subito se l'audio è sbloccato, altrimenti il tasto INIZIA
  const ready = useCallback(() => {
    if (freezeAt !== null) {
      setPhase("play");
      return;
    }
    void getSoundEngine()
      .unlock()
      .then((ok) => {
        if (ok) start();
        else setPhase((p) => (p === "loading" ? "gate" : p));
      });
  }, [freezeAt, start]);

  useEffect(() => {
    if (mode !== "2d") return;
    const id = setTimeout(ready, 0);
    return () => clearTimeout(id);
  }, [mode, ready]);

  // caricamento troppo lungo → 2D; tasto INIZIA non premuto → parte muta; sicurezza assoluta → fine
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
    const id = setTimeout(() => finish(400), SAFETY_MS);
    return () => clearTimeout(id);
  }, [finish, freezeAt]);

  // sottotitolo e fine della voce
  useEffect(
    () =>
      getNarrator().onState((s) => {
        setCaption(s.text);
        const c = cues.current;
        if (!c.voice) return;
        if (s.id === "benvenuti") c.voiceSeen = true;
        else if (c.voiceSeen || (!s.speaking && c.voice)) c.voiceDone = true;
      }),
    [],
  );

  // copione: lampada, sedia, voce, fine (il tempo lo avanza la scena 3D; in 2D l'orologio)
  useEffect(() => {
    if (phase !== "play" || freezeAt !== null) return;
    let raf = 0;
    const loop = () => {
      const t = mode === "3d" ? timeRef.current : (performance.now() - startWall.current) / 1000;
      if (mode === "2d") timeRef.current = t;
      const c = cues.current;
      const T2 = mode === "2d" ? { lampClick: 0.6, voiceAt: 2.4, minEnd: 6 } : INTRO_T;
      if (!c.lamp && t >= T2.lampClick) {
        c.lamp = true;
        play("lampada", { gain: 1.6 });
      }
      if (mode === "3d" && !c.chair && t >= INTRO_T.sitStart + 0.2) {
        c.chair = true;
        play("sedia", { gain: 0.9 });
      }
      if (!c.voice && t >= T2.voiceAt) {
        c.voice = true;
        getNarrator().release(["benvenuti"]);
      }
      const canEnd = mode === "3d" ? introCanEnd(t, c.voiceDone) : (t >= T2.minEnd && c.voiceDone) || t >= 14;
      if (canEnd) {
        finish(900);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, mode, play, finish, freezeAt]);

  const onStep = useCallback(
    (foot: "l" | "r") => {
      // più lontano (a sinistra, nel buio) = più piano; tono e volume variano di poco a ogni passo
      const x = characterAt(timeRef.current).x;
      const near = Math.min(1, Math.max(0, (x + 3.3) / 3.3));
      play("passo", { gain: (0.45 + 0.4 * near) * (0.9 + Math.random() * 0.2), rate: (foot === "l" ? 0.97 : 1.02) + (Math.random() - 0.5) * 0.08 });
    },
    [play],
  );

  return (
    <div
      data-testid="psyco-intro"
      data-phase={phase}
      data-mode={mode}
      className={clsx("z-[70] overflow-hidden bg-[#060505] transition-opacity", contained ? "absolute inset-0" : "fixed inset-0", phase === "out" ? "pointer-events-none opacity-0 duration-700" : "opacity-100 duration-300")}
    >
      {mode === "3d" ? (
        <Suspense fallback={null}>
          <IntroScene3D
            timeRef={timeRef}
            runningRef={runningRef}
            lowPower={caps.lowPower}
            onReady={ready}
            onFail={() => setMode("2d")}
            onStep={onStep}
            className={clsx("transition-opacity duration-700", phase === "loading" ? "opacity-0" : "opacity-100")}
          />
        </Suspense>
      ) : (
        <Intro2D running={phase === "play" || phase === "out"} />
      )}
      {/* barre da cinema in orizzontale */}
      {!contained && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-[6vh] bg-black landscape:block" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[6vh] bg-black landscape:block" />
        </>
      )}

      <button
        type="button"
        onClick={() => finish(250)}
        className="psy-chip absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 !bg-black/60 font-black tracking-widest"
      >
        SALTA INTRO ⏭
      </button>

      {phase === "gate" && (
        <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <p className="psy-type text-lg text-paper/80">Benvenuti nell&apos;ufficio dell&apos;Investigatore…</p>
            <button type="button" className="psy-btn psy-glow text-2xl" onClick={() => void getSoundEngine().unlock().then(start)}>
              ▶ INIZIA
            </button>
            <p className="text-xs font-bold text-paper/50">Con l&apos;audio. Parte da sola tra pochi secondi.</p>
          </div>
        </div>
      )}
      {phase === "loading" && mode === "3d" && <p className="psy-type absolute inset-x-0 bottom-[20vh] z-10 animate-pulse text-center text-paper/40">…</p>}

      {caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(8vh,calc(env(safe-area-inset-bottom)+1.5rem))] z-10 flex justify-center px-4">
          <p className="psy-type psy-caption max-w-3xl rounded-xl px-4 py-2 text-center text-lg text-paper md:text-2xl">{caption}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Versione illustrata (senza 3D): l'ufficio buio, la lampada che si accende, la sagoma dell'Investigatore
 * alla scrivania con la bocca che segue la voce, la finestra con la pioggia e l'insegna rossa.
 */
function Intro2D({ running }: { running: boolean }) {
  const [lamp, setLamp] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => getNarrator().onState((s) => setSpeaking(s.speaking)), []);
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setLamp(true), 600);
    return () => clearTimeout(id);
  }, [running]);
  return (
    <div className="absolute inset-0 grid place-items-center">
      {/* finestra con veneziane e insegna rossa */}
      <div className="absolute right-[8%] top-[14%] h-[34%] w-[26%] max-w-[22rem] rounded-sm bg-[radial-gradient(circle_at_70%_40%,rgba(224,22,31,.7),rgba(20,25,45,.9)_45%,#05060c)] shadow-[0_0_80px_rgba(224,22,31,.35)] ring-4 ring-[#2a160c]">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(60,50,40,.95)_0_7px,transparent_7px_16px)]" />
      </div>
      <div className={clsx("absolute inset-0 transition-opacity duration-300", lamp ? "psy-flicker opacity-100" : "opacity-0")}>
        <div className="absolute left-1/2 top-[38%] h-[70vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_50%_40%,rgba(255,181,71,.45),rgba(142,11,18,.18)_45%,transparent_70%)]" />
      </div>
      <svg viewBox="0 0 400 300" className="relative w-[min(92vw,820px)] drop-shadow-[0_20px_40px_rgba(0,0,0,.8)]" aria-hidden>
        {/* sagoma alla scrivania */}
        <g transform="translate(140 40) scale(1.0)">
          <Silhouette />
          <ellipse cx="60" cy="69" rx="3.4" ry={speaking ? 3 : 0.8} fill="#5a0a10" opacity={speaking ? 0.95 : 0} className="transition-all duration-100" />
          <circle cx="54" cy="60" r="1.5" fill="#ffb547" opacity={lamp ? 1 : 0.3} />
          <circle cx="66" cy="60" r="1.5" fill="#ffb547" opacity={lamp ? 1 : 0.3} />
        </g>
        {/* lampada */}
        <g opacity={lamp ? 1 : 0.4}>
          <rect x="70" y="196" width="40" height="6" rx="3" fill="#6b4a1f" />
          <rect x="88" y="150" width="4" height="48" fill="#8a6428" />
          <path d="M70 150 L110 150 L100 128 L80 128 Z" fill="#123222" />
          <ellipse cx="90" cy="151" rx="16" ry="3" fill={lamp ? "#ffd9a0" : "#333"} />
        </g>
        {/* scrivania e fascicolo */}
        <rect x="30" y="200" width="340" height="16" rx="3" fill="#3b1d12" />
        <rect x="45" y="216" width="310" height="84" fill="#24120b" />
        <g transform="translate(210 186) rotate(-6)">
          <rect width="96" height="14" rx="2" fill="#c9a96a" />
          <text x="48" y="10.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#be121a" fontFamily="'Courier New', monospace">
            REGOLA SEGRETA
          </text>
        </g>
      </svg>
    </div>
  );
}

/** Anteprima (/preview/investigatore?intro=1&layout=portrait|landscape&t=…): riparte da capo a ogni fine. */
export function PsycoIntroPreview({ layout, mode3d, freezeAt = null }: { layout: "portrait" | "landscape"; mode3d: boolean; freezeAt?: number | null }) {
  const [run, setRun] = useState(0);
  return (
    <main className="grid min-h-dvh place-items-center bg-black p-2">
      <div className={clsx("relative overflow-hidden", layout === "portrait" ? "h-[96dvh] w-[calc(96dvh*390/844)]" : "aspect-video w-[min(96vw,calc(96dvh*16/9))]")}>
        <IntroPlayer key={run} contained force2d={!mode3d} freezeAt={freezeAt} onDone={() => setTimeout(() => setRun((r) => r + 1), 1500)} />
      </div>
    </main>
  );
}
