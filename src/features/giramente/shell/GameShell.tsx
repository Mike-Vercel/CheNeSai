"use client";

import { clsx } from "clsx";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { getGiramenteVoice, loadPrefs, THEME, type SpeechState } from "../audio";
import { IntroOverlay, Studio2DBackdrop, THEME_MENU_VOLUME, useIntroTimeline, type IntroMode } from "../intro/GiramenteIntro";
import { markCreateIntroSeen, noteIntroPlayed, shouldShowCreateIntro } from "../intro/flags";
import { introDirection, introLed, introLights } from "../intro/intro-script";
import { Portrait2D } from "../three/Portrait2D";
import { detectVisualQuality, prefersReducedMotion } from "../three/quality";
import { WHEEL_SEGMENTS_STANDARD } from "../three/segments";
import type { Studio3DProps, StudioSpeech, StudioWheelInput } from "../three/studio/Studio3D";
import type { StudioCue } from "../three/studio/studio-director";
import { setStudioWindow } from "../three/studio/studio-window";
import type { VisualQuality } from "../three/types";
import { Logo } from "../ui";
import { ProgressBar } from "./LoadProgress";
import { menuDirection, menuLed, type MenuPanel, type SetupStep } from "./menu-script";
import { MainMenu, ModesPanel, ResumePanel, SettingsPanel } from "./panels";
import { roomHref, type ShellRoom } from "./shell-rooms";
import { SetupWizard, type SetupInit } from "./SetupWizard";

/**
 * LA SHELL DI GIRAMENTE!: aprire il gioco = giocare. Una sola pagina a tutto schermo con lo STUDIO 3D sempre acceso
 * (un solo canvas: intro, menu e impostazioni della partita ci stanno sopra):
 *   1. caricamento animato (studio disegnato, logo, avanzamento vero dei modelli) — mai uno schermo nero;
 *   2. l'INTRO (una volta per scheda; `?intro=1|0`; mai nei test automatici se non chiesta);
 *   3. il MENU da videogioco sopra lo studio vivo (Don Patrizio accanto alla ruota, LED, luci): RIPRENDI, NUOVA
 *      PARTITA, ENTRA CON UN CODICE, MODALITÀ DI GIOCO, IMPOSTAZIONI, REGOLAMENTO — ↑↓/Invio, mouse, tocco;
 *   4. NUOVA PARTITA come pannelli di gioco a passi (SetupWizard), «‹ INDIETRO»/Esc, poi la sala.
 * Senza 3D (WebGL assente o software, movimento ridotto, scelta «2D») resta tutto uguale sopra lo studio disegnato.
 */
const Studio3D = dynamic<Studio3DProps>(() => import("../three/studio/Studio3D"), { ssr: false, loading: () => null });
const LoadProgress = dynamic(() => import("./LoadProgress"), { ssr: false, loading: () => <ProgressBar pct={null} label="Si accendono le luci" /> });

export interface GameShellProps {
  username: string | null;
  loggedIn: boolean;
  rooms: ShellRoom[];
  /** "setup" = si apre direttamente su NUOVA PARTITA (/giramente/nuova), senza intro salvo ?intro=1 */
  start: "menu" | "setup";
  setup?: SetupInit;
}

const noop = () => () => {};
const CUE: StudioCue = { phase: "INTRO", key: "INTRO|shell", since: 0, sector: null, correct: null, stage: null, spinMs: null, finale: false };
const JOLLY_INDEX = Math.max(
  0,
  WHEEL_SEGMENTS_STANDARD.findIndex((s) => s.kind === "jolly"),
);
const INTRO_LOAD_TIMEOUT_MS = 9_000;
const SILENT: SpeechState = { who: null, caption: null, audible: false };

function introForced(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("intro") === "1";
  } catch {
    return false;
  }
}

export function GameShell(props: GameShellProps) {
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return (
    <div className="gm-shell-root fixed inset-0 overflow-hidden bg-[#040607]">
      <Studio2DBackdrop />
      {/* per chi non vede la scena e per i motori di ricerca */}
      <h1 className="sr-only">GIRAMENTE! · La ruota gira. La mente decide.</h1>
      <p className="sr-only">Il game show con la ruota: cinque manche, enigmi di logica, Verde o Rosso, i Jolly di Zafira e il Giro Decisivo. La fortuna sceglie la sfida, la tua mente decide come finisce.</p>
      {client ? (
        <ShellClient {...props} />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="flex w-[min(80vw,24rem)] flex-col items-center gap-5">
            <Logo size="lg" tagline className="gm-breathe" />
            <ProgressBar pct={null} label="Si accendono le luci" />
          </div>
        </div>
      )}
    </div>
  );
}

type Script = { kind: "intro"; at: number } | { kind: "menu"; at: number; panel: MenuPanel };

function ShellClient({ username, loggedIn, rooms: initialRooms, start, setup }: GameShellProps) {
  // ------------------------------------------------------------------ qualità e studio
  const [quality, setQuality] = useState<VisualQuality>(detectVisualQuality);
  const [reduced] = useState(prefersReducedMotion);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [studioKey, setStudioKey] = useState(0);
  const studioOn = quality !== "2d" && !failed;

  // orologio della shell (ms): lo studio e il copione contano da qui
  const [t0] = useState(() => performance.now());
  const clock = useCallback(() => performance.now() - t0, [t0]);

  // ------------------------------------------------------------------ intro
  const [introWanted] = useState(() => shouldShowCreateIntro() && (start === "menu" || introForced()));
  const [introRun, setIntroRun] = useState(introWanted ? 1 : 0);
  const [stage, setStage] = useState<"intro" | "menu">(introWanted ? "intro" : "menu");
  // l'intro resta sopra il menu finché non ha finito di dissolversi
  const [introShown, setIntroShown] = useState(introWanted);
  const [introTimedOut, setIntroTimedOut] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const introMode: IntroMode = reduced ? "still" : studioOn && !introTimedOut ? "3d" : "2d";

  // ------------------------------------------------------------------ menu
  const [panel, setPanel] = useState<MenuPanel>(start === "setup" ? "setup" : "main");
  const [setupInit, setSetupInit] = useState<SetupInit>(setup ?? {});
  const [setupStep, setSetupStep] = useState<SetupStep>(setup?.skipMode ? 1 : 0);
  const [rooms, setRooms] = useState(initialRooms);
  // voce del menu su cui si è mossi (il LED la mostra); null = appena aperto, si vede il logo
  const [focus, setFocus] = useState<string | null>(null);

  // regia dello studio: il copione dell'intro, poi quello del menu (stesso canvas, stessa scena)
  const script = useRef<Script>(stage === "intro" ? { kind: "intro", at: Number.POSITIVE_INFINITY } : { kind: "menu", at: 0, panel });
  useEffect(() => {
    if (script.current.kind === "menu" && script.current.panel !== panel) script.current = { ...script.current, panel };
  }, [panel]);
  const direct = useCallback((ms: number, speaking: boolean) => {
    const s = script.current;
    return s.kind === "intro" ? introDirection(ms - s.at, speaking) : menuDirection(ms - s.at, speaking, s.panel);
  }, []);
  const lights = useCallback(() => {
    const s = script.current;
    return s.kind === "intro" ? introLights((clock() - s.at) / 1000) : 1;
  }, [clock]);

  // la ruota: gira da sola quando si accende lo studio (nell'intro o all'apertura del menu)
  const [wheel, setWheel] = useState<StudioWheelInput>({ segments: WHEEL_SEGMENTS_STANDARD, spin: null, restIndex: JOLLY_INDEX, highlight: false });
  const spinWheel = useCallback((at: number, durationMs = 7_000) => setWheel((w) => ({ ...w, spin: { spinId: `shell-${Math.round(at)}`, targetIndex: JOLLY_INDEX, startedAt: at, durationMs } })), []);

  // voce (sottotitoli, bocca di Don Patrizio)
  const [speech, setSpeech] = useState<SpeechState>(SILENT);
  useEffect(() => getGiramenteVoice().onState(setSpeech), []);
  const mouth = getGiramenteVoice().mouth as RefObject<number>;
  const studioSpeech = useMemo<StudioSpeech>(() => ({ who: "dontralla", speaking: !!speech.caption, mouthRef: speech.audible ? mouth : undefined }), [speech.caption, speech.audible, mouth]);

  const led = useMemo(() => (stage === "intro" ? introLed(revealed) : menuLed(panel, setupStep, focus)), [stage, revealed, panel, setupStep, focus]);
  const ledKey = JSON.stringify(led);
  const stableLed = useMemo(() => JSON.parse(ledKey) as typeof led, [ledKey]);

  // modelli dello studio scaricati subito (in parallelo al codice del 3D)
  useEffect(() => {
    if (!studioOn) return;
    void import("../three/studio/Studio3D").then((m) => m.preloadStudio(quality === "low" ? "low" : "high")).catch(() => undefined);
  }, [studioOn, quality]);

  // intro: caricamento troppo lungo → versione 2D (lo studio continua a caricarsi e arriva nel menu)
  useEffect(() => {
    if (stage !== "intro" || introMode !== "3d" || ready) return;
    const id = setTimeout(() => setIntroTimedOut(true), INTRO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [stage, introMode, ready]);

  const onReady = useCallback(() => {
    setReady(true);
    // senza intro: all'accensione la ruota fa un giro di benvenuto
    if (script.current.kind === "menu") spinWheel(clock() + 400, 6_000);
  }, [clock, spinWheel]);

  // musica del menu: la sigla piano (con l'intro ci pensa l'intro); parte al primo gesto se il browser blocca l'audio
  useEffect(() => {
    if (stage !== "menu") return;
    const e = getSoundEngine();
    const play = () => {
      if (loadPrefs().music) e.playTheme({ url: THEME, loop: true, volume: THEME_MENU_VOLUME, fadeMs: 1500 });
    };
    let alive = true;
    void Promise.race([e.unlock(), new Promise<boolean>((r) => setTimeout(() => r(false), 700))]).then((ok) => alive && ok && play());
    const onGesture = () => void e.unlock().then((ok) => ok && alive && play());
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    const onPrefs = (ev: Event) => ((ev as CustomEvent<{ music: boolean }>).detail.music ? play() : e.stopTheme(600));
    window.addEventListener("giramente-audio", onPrefs);
    return () => {
      alive = false;
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("giramente-audio", onPrefs);
    };
  }, [stage]);
  useEffect(() => () => getSoundEngine().stopTheme(400), []);

  // ------------------------------------------------------------------ azioni del menu
  const goLogin = (next: string) => window.location.assign(`/accedi?next=${encodeURIComponent(next)}`);
  const openSetup = (init: SetupInit) => {
    if (!loggedIn) return goLogin(init.mode === "teams" ? "/giramente/nuova?modo=squadre" : "/giramente/nuova");
    setSetupInit(init);
    setSetupStep(init.skipMode ? 1 : 0);
    setPanel("setup");
  };
  const toMain = () => {
    // aperta da /giramente/nuova: tornando al menu l'indirizzo torna quello del gioco (un ricaricamento riapre il menu)
    if (window.location.pathname !== "/giramente") window.history.replaceState(window.history.state, "", "/giramente");
    setPanel("main");
  };
  const select = (id: string) => {
    switch (id) {
      case "riprendi":
        if (rooms.length === 1) window.location.assign(roomHref(rooms[0]));
        else setPanel("resume");
        return;
      case "nuova":
        return openSetup({});
      case "entra":
        return window.location.assign("/giramente/entra");
      case "modalita":
        return setPanel("modes");
      case "impostazioni":
        return setPanel("settings");
      case "regolamento":
        return window.location.assign("/giramente/regolamento");
    }
  };
  // la scelta è già salvata: si rilegge (vale anche «Automatica») e lo studio si rimonta
  const changeQuality = () => {
    setQuality(detectVisualQuality());
    setFailed(false);
    setReady(false);
    setStudioKey((k) => k + 1);
  };
  const replayIntro = () => {
    script.current = { kind: "intro", at: Number.POSITIVE_INFINITY };
    setRevealed(false);
    setIntroTimedOut(false);
    setIntroRun((r) => r + 1);
    setIntroShown(true);
    setStage("intro");
    getSoundEngine().stopTheme(300);
  };

  const showCanvas = studioOn && ready;
  const loadingLabel = "Si accendono le luci";

  return (
    <>
      {studioOn && (
        <div aria-hidden className={clsx("pointer-events-none absolute inset-0 transition-opacity duration-[900ms] ease-out", showCanvas ? "opacity-100" : "opacity-0")}>
          <Studio3D
            key={studioKey}
            quality={quality === "low" ? "low" : "high"}
            cue={CUE}
            wheel={wheel}
            led={stableLed}
            speech={studioSpeech}
            now={clock}
            script={direct}
            lights={lights}
            onReady={onReady}
            onFail={(r) => {
              console.warn(`[giramente] studio 3D → 2D: ${r}`);
              setFailed(true);
            }}
            className="!absolute inset-0"
          />
        </div>
      )}

      {introShown && introRun > 0 && (
        <IntroController
          key={introRun}
          mode={introMode}
          ready={introMode !== "3d" || ready}
          clock={clock}
          speech={speech}
          mouthRef={speech.audible ? mouth : undefined}
          progress={studioOn ? <LoadProgress label={loadingLabel} /> : null}
          onStart={(at) => {
            script.current = { kind: "intro", at };
            spinWheel(at + 150);
          }}
          onStep={(s) => setRevealed(s >= 1)}
          onOut={() => {
            noteIntroPlayed();
            script.current = { kind: "menu", at: clock(), panel };
            setStage("menu");
          }}
          onDone={() => {
            markCreateIntroSeen();
            setIntroShown(false);
          }}
        />
      )}

      {stage === "menu" && (
        <div className="gm-shell" data-panel={panel}>
          <ShellWindow>
            {!studioOn && <Portrait2D who="dontralla" speaking={!!speech.caption} mouthRef={speech.audible ? mouth : undefined} className="h-full max-h-[22rem] w-full" />}
            {studioOn && !ready && (
              <div className="flex h-full w-full items-end justify-center pb-[8%]">
                <div className="w-[min(70%,18rem)]">
                  <LoadProgress label={loadingLabel} />
                </div>
              </div>
            )}
          </ShellWindow>
          <div className="gm-shell-panel">
            {panel === "main" && <MainMenu rooms={rooms} loggedIn={loggedIn} onSelect={select} onActive={setFocus} />}
            {panel === "setup" && <SetupWizard key={JSON.stringify(setupInit)} username={username} init={setupInit} onExit={toMain} onStep={setSetupStep} />}
            {panel === "modes" && <ModesPanel onBack={toMain} onPlay={(mode) => openSetup({ mode, skipMode: true })} />}
            {panel === "settings" && <SettingsPanel onBack={toMain} onQuality={changeQuality} onReplayIntro={replayIntro} />}
            {panel === "resume" && <ResumePanel rooms={rooms} onBack={toMain} onClosed={(id) => setRooms((l) => l.filter((r) => r.roomId !== id))} />}
          </div>
          <TopBar username={username} loggedIn={loggedIn} />
        </div>
      )}
    </>
  );
}

/** L'intro come componente (si rimonta per «Rivedi l'intro»). */
function IntroController({
  mode,
  ready,
  clock,
  speech,
  mouthRef,
  progress,
  onStart,
  onStep,
  onOut,
  onDone,
}: {
  mode: IntroMode;
  ready: boolean;
  clock: () => number;
  speech: SpeechState;
  mouthRef?: RefObject<number>;
  progress: React.ReactNode;
  onStart: (at: number) => void;
  onStep: (s: number) => void;
  onOut: () => void;
  onDone: () => void;
}) {
  const intro = useIntroTimeline({ enabled: true, ready, mode, clock, onStart, onOut, onDone });
  const step = intro.step;
  const stepCb = useRef(onStep);
  useEffect(() => {
    stepCb.current = onStep;
  });
  useEffect(() => stepCb.current(step), [step]);
  return <IntroOverlay intro={intro} mode={mode} speech={speech} mouthRef={mouthRef} progress={progress} />;
}

/** La parte di schermo lasciata libera dal menu: lo studio inquadra lì Don Patrizio e la ruota. */
function ShellWindow({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setStudioWindow(ref.current);
    return () => setStudioWindow(null);
  }, []);
  return (
    <div ref={ref} data-gm-studio-window className="gm-shell-window pointer-events-none flex items-center justify-center">
      {children}
    </div>
  );
}

function TopBar({ username, loggedIn }: { username: string | null; loggedIn: boolean }) {
  return (
    <div className="gm-shell-top pointer-events-none flex items-center gap-2">
      <Link href="/" prefetch={false} className="gm-chip pointer-events-auto !bg-black/55 text-sm backdrop-blur hover:border-white/50" aria-label="Esci dal gioco: torna a CheNeSai">
        ‹ CheNeSai
      </Link>
      <span className="flex-1" />
      {loggedIn ? (
        <a href="/profilo" className="gm-chip pointer-events-auto max-w-[11rem] truncate !bg-black/55 text-sm backdrop-blur hover:border-white/50">
          {username ? `@${username}` : "Il mio profilo"}
        </a>
      ) : (
        <a href={`/accedi?next=${encodeURIComponent("/giramente")}`} className="gm-chip pointer-events-auto !border-[#39ff14]/70 !bg-black/55 text-sm backdrop-blur">
          ACCEDI
        </a>
      )}
    </div>
  );
}
