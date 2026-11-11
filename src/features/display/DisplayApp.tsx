"use client";

import dynamic from "next/dynamic";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GamePhase, PublicState } from "@/lib/game-engine/types";
import { api } from "@/lib/realtime/api-client";
import { useGameState, useTicker } from "@/lib/realtime/use-game-state";
import { useAutoReload } from "@/lib/realtime/use-auto-reload";
import { useAutoTick, type AutoTickResponse } from "@/lib/realtime/use-auto-tick";
import { getSoundEngine, type CueName } from "@/features/media/audio-engine";
import { Confetti } from "@/features/game/components/effects";
import { Logo } from "@/features/game/components/brand";
import { getVoice, useSilentLine } from "@/features/media/voice";
import { speechFor } from "@/features/game/speech";
import { lobbyGreetingLines, MIC_TEST_LINES, WELCOME_LINE } from "@/features/game/script";
import { TvPauseOverlay } from "./TvScreens";
import { TvStage } from "./TvStage";
import { CharacterModeProvider } from "@/features/three/characters/character-mode";
import { TvScreenAgent } from "./TvScreenControls";
import { useTvPrefs, type TvPrefs } from "./tv-prefs";

const IntroSequence = dynamic(() => import("@/features/three/IntroSequence").then((m) => m.IntroSequence), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-black" />,
});

interface DisplayResponse {
  state: PublicState;
  nextMedia: { id: string; kind: string }[];
}

type MediaControl =
  | { action: "play"; mediaId: string; startMs: number; durationMs: number | null; plays: number; at: number }
  | { action: "stop"; at: number }
  | { action: "test-tone"; at: number };

/** Sigla per fase: in sottofondo in lobby e classifica, piena al finale, spenta durante le domande. */
function themeFor(phase: GamePhase): { volume: number; loop: boolean } | null {
  if (phase === "READY" || phase === "LOBBY") return { volume: 0.4, loop: true };
  if (phase === "LEADERBOARD" || phase === "SCORE_REVEAL") return { volume: 0.35, loop: true };
  // finale: sigla bassa durante la suspense del podio (la fanfara arriva col vincitore)
  if (phase === "FINISHED") return { volume: 0.35, loop: true };
  return null;
}

/** Elemento audio riutilizzato per gli estratti musicali (fuori dal componente: mutabile). */
function prepareAudio(ref: { current: HTMLAudioElement | null }, src: string, volume: number): HTMLAudioElement {
  const el = ref.current ?? new Audio();
  ref.current = el;
  el.preload = "auto";
  el.volume = volume;
  if (el.src !== new URL(src, window.location.href).href) el.src = src;
  return el;
}

const PHASE_CUES: Partial<Record<GamePhase, CueName>> = {
  ROUND_INTRO: "roundStart",
  QUESTION_VISIBLE: "questionAppear",
  OPTIONS_VISIBLE: "optionsAppear",
  ANSWERS_LOCKED: "answerLocked",
  ANSWER_REVEAL: "reveal",
  SCORE_REVEAL: "score",
  LEADERBOARD: "leaderboard",
  SPECIAL_EVENT: "palmino",
  CATEGORY_VOTING: "whoosh",
  CATEGORY_RESULT: "voteResult",
  WHEEL_SPIN: "whoosh",
  FINISHED: "leaderboard",
  PAUSED: "pause",
};

/** Richiesta di attivare l'audio dai comandi dell'host (un clic: regola dei browser). */
const ACTIVATE_EVENT = "qz:tv-activate-audio";

/** Quello che il TV passa ai comandi sovrapposti dell'host (gioco libero). */
export interface TvOverlayContext {
  qrDataUrl: string | null;
  joinUrl: string;
  /** audio e voce attivi (serve un clic sul TV, regola del browser) */
  audioOn: boolean;
  activateAudio: () => void;
  testVoices: () => void;
}

const SPEAKER_NAMES: Record<string, string> = { professore: "Professore", regina: "Regina", palmino: "Palmino", annunciatore: "" };

/**
 * Battuta senza voce (clip non arrivata, voce professionale non disponibile): il personaggio parla
 * e il testo compare qui, come sottotitolo, al posto di una voce sintetica.
 */
function SilentSubtitle() {
  const line = useSilentLine();
  if (!line) return null;
  const who = SPEAKER_NAMES[line.who] ?? "";
  return (
    <div className="pointer-events-none absolute inset-x-[12cqw] bottom-[4cqh] z-[45] flex justify-center" aria-live="polite">
      <p className="rounded-[2cqh] bg-black/75 px-[2.6cqh] py-[1.4cqh] text-center text-[3.2cqh] font-extrabold leading-snug text-white shadow-2xl">
        {who && <span className="mr-[1cqh] text-gold">{who}:</span>}
        {line.text}
      </p>
    </div>
  );
}

export function DisplayApp({
  sessionId,
  displayKey,
  renderOverlay,
  hostMode = false,
}: {
  sessionId: string;
  displayKey: string;
  /** comandi sovrapposti al TV (gioco libero: comandi e impostazioni dell'host) */
  renderOverlay?: (state: PublicState | null, ctx: TvOverlayContext) => ReactNode;
  /**
   * TV del gioco libero: lo schermo si vede subito (QR in lobby) senza la schermata "ATTIVA AUDIO";
   * se il browser lo consente l'audio parte da solo, altrimenti basta un clic ovunque.
   * Le impostazioni stanno nell'icona a ingranaggio dell'host (niente doppio clic).
   */
  hostMode?: boolean;
}) {
  useAutoReload();
  const [started, setStarted] = useState(false);
  const [prefs, updatePrefs] = useTvPrefs();
  const setPrefs = useCallback((p: TvPrefs) => updatePrefs(p), [updatePrefs]);
  const [showSettings, setShowSettings] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [confettiIntensity, setConfettiIntensity] = useState(1);
  // coriandoli quando il podio rivela il vincitore
  const celebrate = useCallback((intensity = 2) => {
    setConfettiIntensity(intensity);
    setConfetti((c) => c + 1);
  }, []);
  const [qr, setQr] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<"idle" | "playing" | "done" | "error">("idle");
  const [nextMedia, setNextMedia] = useState<DisplayResponse["nextMedia"]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTick = useRef<number>(-1);
  const sound = getSoundEngine();
  const voice = getVoice();
  useEffect(() => voice.setDisplayCredentials(sessionId, displayKey), [voice, sessionId, displayKey]);
  const prefsRef = useRef(prefs);
  const startedRef = useRef(false);

  useEffect(() => {
    sound.setSettings({ musicVolume: prefs.musicVolume, sfxVolume: prefs.sfxVolume, muted: prefs.muted, masterVolume: prefs.masterVolume });
    // voce del browser: mai con ElevenLabs attivo; senza, solo se scelta (serate della regia: come sempre)
    voice.configure({ enabled: prefs.voice && !prefs.muted, readOptions: prefs.readOptions, volume: prefs.masterVolume, browserVoice: hostMode ? prefs.browserVoice : true });
    prefsRef.current = prefs;
  }, [prefs, sound, voice, hostMode]);

  const mediaUrl = useCallback((id: string) => `/api/display/${sessionId}/media/${id}?k=${encodeURIComponent(displayKey)}`, [sessionId, displayKey]);

  // ---------------------------------------------------------------- audio clip
  const stopClip = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    audioRef.current?.pause();
  }, []);

  const playClip = useCallback(
    async (mediaId: string, startMs: number, durationMs: number | null, plays: number) => {
      stopClip();
      const el = prepareAudio(audioRef, mediaUrl(mediaId), prefs.muted ? 0 : prefs.musicVolume);
      let remaining = Math.max(1, plays);
      const once = async (): Promise<void> => {
        try {
          el.currentTime = startMs / 1000;
          setAudioState("playing");
          await el.play();
        } catch {
          setAudioState("error");
          return;
        }
        if (durationMs) {
          stopTimer.current = setTimeout(() => {
            el.pause();
            remaining -= 1;
            if (remaining > 0) stopTimer.current = setTimeout(() => void once(), 1500);
            else setAudioState("done");
          }, durationMs);
        } else {
          el.onended = () => {
            remaining -= 1;
            if (remaining > 0) setTimeout(() => void once(), 1500);
            else setAudioState("done");
          };
        }
      };
      await once();
    },
    [mediaUrl, prefs.musicVolume, prefs.muted, stopClip],
  );

  const onEvent = useCallback(
    (event: string, payload: unknown) => {
      if (event !== "media") return;
      const c = payload as MediaControl;
      if (c.action === "stop") {
        stopClip();
        setAudioState("done");
      } else if (c.action === "test-tone") {
        void sound.unlock().then(() => sound.play("fanfare"));
      } else if (c.action === "play") {
        void playClip(c.mediaId, c.startMs, c.durationMs, c.plays);
      }
    },
    [playClip, sound, stopClip],
  );

  // ---------------------------------------------------------------- transizioni
  const [pollMs, setPollMs] = useState(4000);
  const onState = useCallback(
    (s: PublicState, prev: PublicState | null) => {
      setPollMs(s.phase === "LOBBY" ? 2500 : s.phase === "CATEGORY_VOTING" || s.phase === "OPTIONS_VISIBLE" ? 1500 : 4000);
      if (!prev) return;
      const phaseChanged = s.phase !== prev.phase;
      const questionChanged = s.question?.id !== prev.question?.id;
      if (phaseChanged) {
        const cue = PHASE_CUES[s.phase];
        if (cue) sound.play(cue);
        if (s.phase === "ANSWER_REVEAL") {
          setConfettiIntensity(0.5);
          setConfetti((c) => c + 1);
        }
        if (s.phase === "CATEGORY_RESULT" || s.phase === "SPECIAL_EVENT") {
          setConfettiIntensity(0.8);
          setConfetti((c) => c + 1);
        }
        if (s.phase === "OPTIONS_VISIBLE" || s.phase === "ANSWER_REVEAL") stopClip();
      }
      if (questionChanged) setAudioState("idle");
      const p = prefsRef.current;
      // Sigla della serata
      if (phaseChanged && s.phase !== "PAUSED") {
        const th = themeFor(s.phase);
        if (th && p.theme) sound.playTheme({ loop: th.loop, volume: th.volume, from: s.phase === "FINISHED" ? 0 : undefined });
        else if (s.phase !== "INTRO") sound.stopTheme(900);
      }
      // Voce dei presentatori
      const lines = startedRef.current ? speechFor(s, prev, { readOptions: p.readOptions }) : [];
      // all'avvio dell'intro nessuna battuta rimasta in coda (es. un saluto della lobby in attesa della clip)
      if (phaseChanged && (lines.length > 0 || s.phase === "INTRO")) voice.stop();
      const spoken = Promise.all(lines.map((l) => voice.say(l.who, l.text, { live: l.live })));
      // Lobby: saluti ai nuovi arrivati decisi dal server (solo quelli nuovi, mai dopo un ricaricamento)
      if (startedRef.current) for (const l of lobbyGreetingLines(s, prev)) void voice.say(l.who, l.text, { live: l.live });
      // Manche musicale: il TV riproduce l'estratto dopo la presentazione (una sola volta).
      if (s.phase === "QUESTION_VISIBLE" && s.question?.media?.kind === "audio" && (phaseChanged || questionChanged)) {
        const key = "qz.played." + s.question.id;
        let already = false;
        try {
          already = sessionStorage.getItem(key) === "1";
          sessionStorage.setItem(key, "1");
        } catch {
          /* ignora */
        }
        if (!already) {
          const m = s.question.media;
          void spoken.then(() => playClip(m.id, m.audioStartMs, m.audioDurationMs, m.audioPlays));
        }
      }
    },
    [playClip, sound, stopClip, voice, startedRef],
  );

  const { state, status, now } = useGameState({
    fetchSnapshot: async () => {
      const r = await api<DisplayResponse>(`/api/display/${sessionId}/state?k=${encodeURIComponent(displayKey)}`);
      setNextMedia(r.nextMedia);
      return r.state;
    },
    // Polling più frequente solo dove serve (contatore lobby, grafico voti, risposte ricevute)
    safetyPollMs: pollMs,
    onState,
    onEvent,
    extraEvents: ["media"],
  });

  const view = state;
  const stateRef = useRef<PublicState | null>(null);
  useEffect(() => {
    stateRef.current = view;
  }, [view]);

  // Scorrimento automatico: il TV chiama /tick quando arriva l'orario del prossimo passo
  // (funziona anche con la regia chiusa; il server esegue il passo solo se è dovuto).
  const autoTickRequest = useCallback(
    () => api<AutoTickResponse>(`/api/display/${sessionId}/tick?k=${encodeURIComponent(displayKey)}`, { method: "POST", timeoutMs: 20000 }),
    [sessionId, displayKey],
  );
  // mentre il presentatore parla (o la sua clip sta arrivando) il TV non manda avanti la partita
  const voiceBusy = useCallback(() => voice.pending, [voice]);
  useAutoTick({ auto: state?.auto, now, tick: autoTickRequest, holdWhile: voiceBusy });

  // QR code per la lobby
  const joinUrl = useMemo(() => {
    if (!state) return "";
    const base = process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost") ? process.env.NEXT_PUBLIC_APP_URL : typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/play/${state.code}`;
  }, [state]);
  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 720, errorCorrectionLevel: "M", color: { dark: "#170824", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [joinUrl]);

  // Precaricamento intro 3D in lobby e media delle prossime domande
  useEffect(() => {
    if (state?.phase === "LOBBY" || state?.phase === "READY") {
      void import("@/features/three/IntroSequence").then((m) => m.preloadIntroAssets());
    }
  }, [state?.phase]);
  useEffect(() => {
    for (const m of nextMedia) {
      if (m.kind === "image") {
        const img = new Image();
        img.src = mediaUrl(m.id);
      } else if (m.kind === "audio") {
        const a = new Audio();
        a.preload = "auto";
        a.src = mediaUrl(m.id);
      }
    }
  }, [nextMedia, mediaUrl]);

  // Schermo sempre acceso
  useEffect(() => {
    if (!started || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const req = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* non supportato o negato */
      }
    };
    void req();
    const onVis = () => document.visibilityState === "visible" && void req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, [started]);

  // Countdown: tick negli ultimi 5 secondi
  const timerActive = view?.phase === "OPTIONS_VISIBLE" || view?.phase === "CATEGORY_VOTING";
  useTicker(timerActive, 200);
  const closesAt = view?.phase === "CATEGORY_VOTING" ? view.vote?.closesAt : view?.question?.closesAt;
  const remainingMs = closesAt ? Math.max(0, Date.parse(closesAt) - now()) : 0;
  useEffect(() => {
    if (!timerActive) return;
    const s = Math.ceil(remainingMs / 1000);
    if (s !== lastTick.current && s <= 5 && s >= 0) {
      lastTick.current = s;
      sound.play(s === 0 ? "tickFinal" : "tick");
    }
  }, [remainingMs, timerActive, sound]);

  async function start() {
    if (startedRef.current) return;
    await sound.unlock();
    sound.play("join");
    startedRef.current = true;
    const th = view ? themeFor(view.phase) : null;
    if (th && prefs.theme) sound.playTheme({ loop: th.loop, volume: th.volume });
    void voice.say(WELCOME_LINE.who, WELCOME_LINE.text);
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        /* fullscreen non disponibile */
      }
    }
    setStarted(true);
  }

  function startSilent() {
    startedRef.current = true;
    setStarted(true);
  }

  // TV del gioco libero: se la pagina ha già avuto un clic (es. "CREA PARTITA" appena premuto)
  // l'audio parte da solo; altrimenti il primo clic sul TV lo attiva.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!hostMode || autoStarted.current) return;
    autoStarted.current = true;
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (!ua?.hasBeenActive) return;
    const t = setTimeout(() => {
      void (async () => {
        if (!(await sound.unlock())) return;
        startedRef.current = true;
        sound.play("join");
        const p = prefsRef.current;
        const th = stateRef.current ? themeFor(stateRef.current.phase) : null;
        if (th && p.theme) sound.playTheme({ loop: th.loop, volume: th.volume });
        void voice.say(WELCOME_LINE.who, WELCOME_LINE.text);
        setStarted(true);
      })();
    }, 0);
    return () => clearTimeout(t);
  }, [hostMode, sound, voice]);
  useEffect(() => {
    if (!hostMode || started) return;
    const onTap = () => void start();
    window.addEventListener("pointerdown", onTap);
    window.addEventListener("keydown", onTap);
    window.addEventListener(ACTIVATE_EVENT, onTap);
    return () => {
      window.removeEventListener("pointerdown", onTap);
      window.removeEventListener("keydown", onTap);
      window.removeEventListener(ACTIVATE_EVENT, onTap);
    };
  });

  const overlayCtx: TvOverlayContext = {
    qrDataUrl: qr,
    joinUrl,
    audioOn: started,
    activateAudio: () => window.dispatchEvent(new Event(ACTIVATE_EVENT)),
    testVoices: () => void Promise.all(MIC_TEST_LINES.map((l) => voice.say(l.who, l.text))),
  };

  // ---------------------------------------------------------------- render
  const screen = (
    <CharacterModeProvider prefer3d={prefs.characters3d} lowPower={prefs.lowPower}>
    <TvStage
      state={view}
      now={now}
      live
      onCelebrate={celebrate}
      reducedMotion={prefs.reducedMotion}
      lowPower={prefs.lowPower}
      remainingMs={remainingMs}
      mediaUrl={mediaUrl}
      qrDataUrl={qr}
      joinUrl={joinUrl}
      audioState={audioState}
      intro={
        view?.intro ? (
          <IntroSequence
            startedAtMs={Date.parse(view.intro.startedAt)}
            now={now}
            muted={prefs.muted || view.phase === "PAUSED"}
            music={prefs.theme}
            voice={prefs.voice}
            explainRules={prefs.rules}
            scoring={view.intro.scoring}
            reducedMotion={prefs.reducedMotion}
            lowPower={prefs.lowPower}
          />
        ) : null
      }
    />
    </CharacterModeProvider>
  );

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-night [container-type:size]" data-motion={prefs.reducedMotion ? "reduced" : undefined} onDoubleClick={hostMode ? undefined : () => setShowSettings((s) => !s)}>
      {screen}
      {view?.phase === "PAUSED" && <TvPauseOverlay />}
      <SilentSubtitle />
      {(started || hostMode) && <TvScreenAgent sessionId={sessionId} showButton={!hostMode} audioOn={started} />}
      {(started || hostMode) && renderOverlay?.(view, overlayCtx)}
      <Confetti fire={prefs.reducedMotion ? 0 : confetti} intensity={prefs.lowPower ? confettiIntensity * 0.4 : confettiIntensity} className="z-40" />

      {status !== "live" && started && (
        <div className="absolute right-[1cqw] top-[1cqh] z-50 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white/80">
          {status === "offline" ? "Connessione assente…" : "Riconnessione…"}
        </div>
      )}

      {!started && !hostMode && (
        <div className="absolute inset-0 z-[60] grid place-items-center bg-night/85 backdrop-blur">
          <div className="flex flex-col items-center gap-6 text-center">
            <Logo size="lg" />
            <p className="max-w-xl text-lg font-bold text-white/80">
              Schermo TV di CHE NE SAI?!. Premi il pulsante per attivare l&apos;audio dell&apos;impianto e lo schermo intero (richiesto dal browser).
            </p>
            <button onClick={start} className="rounded-2xl border-4 border-[#b8770a] bg-gradient-to-b from-[#ffe680] to-gold-deep px-10 py-5 font-display text-3xl text-ink shadow-[0_6px_0_#9a5d00]">
              ATTIVA AUDIO E AVVIA SCHERMO
            </button>
            <button onClick={startSilent} className="text-sm font-bold text-white/60 underline">
              Continua senza audio
            </button>
          </div>
        </div>
      )}

      {showSettings && !hostMode && (
        <div className="absolute bottom-4 right-4 z-[70] w-80 rounded-2xl border-2 border-gold/60 bg-[#1d0c30] p-4 text-sm text-white shadow-2xl" onDoubleClick={(e) => e.stopPropagation()}>
          <p className="mb-2 font-display text-lg text-gold">Impostazioni schermo</p>
          <label className="flex items-center justify-between gap-2 py-1">
            Musica
            <input type="range" min={0} max={1} step={0.05} value={prefs.musicVolume} onChange={(e) => setPrefs({ ...prefs, musicVolume: Number(e.target.value) })} />
          </label>
          <label className="flex items-center justify-between gap-2 py-1">
            Effetti
            <input type="range" min={0} max={1} step={0.05} value={prefs.sfxVolume} onChange={(e) => setPrefs({ ...prefs, sfxVolume: Number(e.target.value) })} />
          </label>
          {(
            [
              ["muted", "Audio disattivato"],
              ["voice", "Voce dei presentatori"],
              ["readOptions", "Leggi anche le risposte"],
              ["theme", "Sigla della serata"],
              ["rules", "Spiega le regole"],
              ["characters3d", "Personaggi 3D (2D sui PC lenti)"],
              ["reducedMotion", "Movimento ridotto"],
              ["lowPower", "Prestazioni ridotte (3D leggero)"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between py-1">
              {label}
              <input type="checkbox" checked={prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} />
            </label>
          ))}
          <div className="mt-2 flex gap-2">
            <button className="rounded-lg bg-white/10 px-3 py-1 font-bold" onClick={() => void sound.unlock().then(() => sound.play("fanfare"))}>
              Prova audio
            </button>
            <button className="rounded-lg bg-white/10 px-3 py-1 font-bold" onClick={() => void Promise.all(MIC_TEST_LINES.map((l) => voice.say(l.who, l.text)))}>
              Prova voci
            </button>
            <button className="rounded-lg bg-white/10 px-3 py-1 font-bold" onClick={() => setShowSettings(false)}>
              Chiudi
            </button>
          </div>
          <p className="mt-2 text-xs text-white/50">Doppio clic sullo schermo per mostrare/nascondere.</p>
        </div>
      )}
    </div>
  );
}
