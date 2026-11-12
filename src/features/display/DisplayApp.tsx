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
import { getVoice, useSilentLine, useVoicePreparing } from "@/features/media/voice";
import { speechFor } from "@/features/game/speech";
import { lobbyGreetingLines, MIC_TEST_LINES, WELCOME_LINE, type SpokenLine } from "@/features/game/script";
import { spokenMs, timeLineDue, timeLineStartMs, wheelLineFits } from "@/lib/show/library";
import { questionMoment } from "@/features/game/moment";
import { questionIntroMaxMs, questionIntroMs } from "@/features/game/question-intro";
import { TvPauseOverlay } from "./TvScreens";
import { TvStage } from "./TvStage";
import { PortraitStage } from "./PortraitStage";
import { CharacterModeProvider } from "@/features/three/characters/character-mode";
import { TvScreenAgent } from "./TvScreenControls";
import { useTvPrefs, type TvPrefs } from "./tv-prefs";
import { IntroSkipCounter } from "@/features/players/IntroSkip";
import { StageBoundary } from "./StageBoundary";
import { holdReveal } from "./reveal-hold";

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

/** Opzioni di voce di una battuta del copione (libreria ufficiale: testo mostrato, battuta saltabile, scenetta). */
const sayOpts = (l: SpokenLine) => ({ live: l.live, display: l.display, optional: l.optional, group: l.group });

/**
 * Ruota di Palmino: la battuta "Durante la ruota" si salta se, quando tocca a lei (o quando arriva la
 * sua voce), non c'è più il tempo di finirla prima che la ruota si fermi ("Tocca a… X!").
 */
function wheelSkip(s: PublicState, l: SpokenLine, stillSpinning: () => boolean): (() => boolean) | undefined {
  const spin = s.wheel?.kind === "palmino" ? s.wheel.spin : null;
  if (s.phase !== "WHEEL_SPIN" || !l.optional || !spin) return undefined;
  // fermata della ruota sull'orologio locale (ora del server dello stato → ora locale)
  const stopAt = Date.now() + (Date.parse(spin.startedAt) + spin.durationMs - Date.parse(s.serverNow));
  return () => !stillSpinning() || !wheelLineFits(stopAt - Date.now(), l.display ?? l.text);
}

/** Tempo che scade: attesa massima della clip (è pre-generata; se non c'è, la battuta si salta). */
const TIME_LINE_CLIP_WAIT_MS = 1200;

/** Respiro dopo l'ultima battuta prima di dire al server "ho finito" (il passo successivo parte subito dopo). */
const SPOKEN_BREATH_MS = 350;

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
function SilentSubtitle({ portrait = false }: { portrait?: boolean }) {
  const line = useSilentLine();
  if (!line) return null;
  const who = SPEAKER_NAMES[line.who] ?? "";
  return (
    <div className={portrait ? "pointer-events-none absolute inset-x-[4cqw] top-[19cqh] z-[45] flex justify-center" : "pointer-events-none absolute inset-x-[12cqw] bottom-[4cqh] z-[45] flex justify-center"} aria-live="polite">
      <p className={portrait ? "rounded-[3cqw] bg-black/80 px-[3.4cqw] py-[2cqw] text-center text-[4.4cqw] font-extrabold leading-snug text-white shadow-2xl" : "rounded-[2cqh] bg-black/75 px-[2.6cqh] py-[1.4cqh] text-center text-[3.2cqh] font-extrabold leading-snug text-white shadow-2xl"}>
        {who && <span className="mr-[1cqh] text-gold">{who}:</span>}
        {line.text}
      </p>
    </div>
  );
}

/** Voce ancora in preparazione (clip generata al momento, es. un nome nuovo): niente silenzio muto. */
function VoicePreparing({ portrait = false }: { portrait?: boolean }) {
  const on = useVoicePreparing();
  if (!on) return null;
  return (
    <div className={portrait ? "pointer-events-none absolute inset-x-0 top-[13cqh] z-[45] flex justify-center" : "pointer-events-none absolute inset-x-0 bottom-[3cqh] z-[45] flex justify-center"} role="status" aria-live="polite">
      <p className={portrait ? "flex items-center gap-[2cqw] rounded-full bg-black/75 px-[3.6cqw] py-[1.6cqw] text-[3.8cqw] font-extrabold text-white/90" : "flex items-center gap-[1.2cqh] rounded-full bg-black/70 px-[2.4cqh] py-[1cqh] text-[2.4cqh] font-extrabold text-white/90"}>
        <span className="qz-wave flex items-end gap-[0.3em]" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        Un attimo… sto preparando la voce
      </p>
    </div>
  );
}

export function DisplayApp({
  sessionId,
  displayKey,
  renderOverlay,
  hostMode = false,
  layout = "landscape",
  onViewState,
  viewer = null,
}: {
  /**
   * Telefono di un GIOCATORE con lo show sul telefono: stesso show (immagini e audio) ma lo stato
   * arriva con il cookie del giocatore, le voci solo per le battute della partita e mai lo
   * scorrimento automatico (lo guida solo il telefono dell'host).
   */
  viewer?: { code: string; slot: string | null } | null;
  /**
   * "portrait": lo show sul telefono in verticale (1080×1920, gioco libero modalità B): schermate
   * e intro ricomposte in colonna. Default "landscape": il TV 16:9 di sempre.
   */
  layout?: "landscape" | "portrait";
  /** lo stato mostrato (per chi avvolge lo show: es. l'host che gioca dallo stesso telefono) */
  onViewState?: (state: PublicState | null) => void;
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
  /** una schermata è andata in errore: da qui in poi personaggi 2D (più leggeri), mai schermo bianco */
  const [safe2d, setSafe2d] = useState(false);
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
  const viewerCode = viewer?.code ?? null;
  const viewerSlot = viewer?.slot ?? null;
  useEffect(() => {
    if (viewerCode) voice.setPlayerCredentials(viewerCode, viewerSlot);
    else voice.setDisplayCredentials(sessionId, displayKey);
  }, [voice, sessionId, displayKey, viewerCode, viewerSlot]);
  /** tocco sullo schermo per l'audio (niente schermata "ATTIVA AUDIO"): host del gioco libero e telefoni dei giocatori */
  const tapToStart = hostMode || !!viewerCode;
  const prefsRef = useRef(prefs);
  const startedRef = useRef(false);

  useEffect(() => {
    sound.setSettings({ musicVolume: prefs.musicVolume, sfxVolume: prefs.sfxVolume, muted: prefs.muted, masterVolume: prefs.masterVolume });
    // voce del browser: mai con ElevenLabs attivo; senza, solo se scelta (serate della regia: come sempre)
    voice.configure({ enabled: prefs.voice && !prefs.muted, readOptions: prefs.readOptions, volume: prefs.masterVolume, browserVoice: hostMode ? prefs.browserVoice : true });
    prefsRef.current = prefs;
  }, [prefs, sound, voice, hostMode]);

  const mediaUrl = useCallback(
    (id: string) => (viewerCode ? `/api/play/${viewerCode}/media/${id}` : `/api/display/${sessionId}/media/${id}?k=${encodeURIComponent(displayKey)}`),
    [sessionId, displayKey, viewerCode],
  );

  // ---------------------------------------------------------------- cartello "DOMANDA N. X"
  // La domanda compare quando finisce il cartello (tempo minimo e battute d'apertura dette):
  // `cardFor` = id della domanda già mostrata; `gateFor` = domanda il cui cartello aspetta la voce.
  const [cardFor, setCardFor] = useState<string | null>(null);
  const gateFor = useRef<string | null>(null);

  // ---------------------------------------------------------------- audio clip
  /**
   * Estratto musicale in arrivo o in riproduzione: per lo scorrimento automatico il TV "sta ancora
   * parlando" (il passo alle risposte non taglia la canzone; il server aspetta al massimo 15 s in più).
   */
  const clipBusy = useRef(false);
  const clipTurn = useRef(0);
  const clipSource = useRef<AudioBufferSourceNode | null>(null);
  const stopClip = useCallback(() => {
    clipTurn.current++;
    clipBusy.current = false;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    audioRef.current?.pause();
    try {
      clipSource.current?.stop();
    } catch {
      // già ferma
    }
    clipSource.current = null;
  }, []);

  const playClip = useCallback(
    async (mediaId: string, startMs: number, durationMs: number | null, plays: number) => {
      stopClip();
      const turn = clipTurn.current;
      const mine = () => turn === clipTurn.current;
      const finish = (st: "done" | "error") => {
        if (!mine()) return;
        clipBusy.current = false;
        clipSource.current = null;
        setAudioState(st);
      };
      clipBusy.current = true;
      let remaining = Math.max(1, plays);
      // Web Audio già sbloccato (tocco su "Attiva audio", "Su questo telefono"…): sui telefoni, iPhone
      // compreso, un elemento audio avviato senza un tocco verrebbe bloccato; da qui no.
      const ctx = sound.context;
      const bus = sound.music;
      if (ctx && bus && ctx.state === "running") {
        try {
          const res = await fetch(mediaUrl(mediaId), { cache: "force-cache", signal: AbortSignal.timeout(12_000) });
          if (!res.ok) throw new Error(String(res.status));
          const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          if (!mine()) return;
          const offset = Math.min(buffer.duration, Math.max(0, startMs / 1000));
          const length = durationMs ? Math.min(durationMs / 1000, buffer.duration - offset) : buffer.duration - offset;
          const once = () => {
            if (!mine()) return;
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(bus);
            src.onended = () => {
              if (!mine()) return;
              remaining -= 1;
              if (remaining > 0) stopTimer.current = setTimeout(once, 1500);
              else finish("done");
            };
            clipSource.current = src;
            setAudioState("playing");
            src.start(0, offset, Math.max(0.1, length));
          };
          once();
          return;
        } catch {
          if (!mine()) return;
          // rete o decodifica non riuscite: si prova con l'elemento audio
        }
      }
      const el = prepareAudio(audioRef, mediaUrl(mediaId), prefs.muted ? 0 : prefs.musicVolume);
      const once = async (): Promise<void> => {
        if (!mine()) return;
        try {
          el.currentTime = startMs / 1000;
          setAudioState("playing");
          await el.play();
        } catch {
          finish("error");
          return;
        }
        if (durationMs) {
          stopTimer.current = setTimeout(() => {
            el.pause();
            remaining -= 1;
            if (remaining > 0) stopTimer.current = setTimeout(() => void once(), 1500);
            else finish("done");
          }, durationMs);
        } else {
          el.onended = () => {
            remaining -= 1;
            if (remaining > 0) stopTimer.current = setTimeout(() => void once(), 1500);
            else finish("done");
          };
        }
      };
      await once();
    },
    [mediaUrl, prefs.musicVolume, prefs.muted, sound, stopClip],
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
  /** fase dell'ultimo stato ricevuto (per le battute che si saltano se la fase è cambiata) */
  const phaseRef = useRef<GamePhase | null>(null);
  /** domanda dell'ultimo stato ricevuto (l'estratto musicale parte solo se è ancora quella) */
  const questionRef = useRef<string | null>(null);
  const onState = useCallback(
    (s: PublicState, prev: PublicState | null) => {
      phaseRef.current = s.phase;
      questionRef.current = s.question?.id ?? null;
      setPollMs(s.phase === "LOBBY" ? 2500 : s.phase === "CATEGORY_VOTING" || s.phase === "OPTIONS_VISIBLE" ? 1500 : 4000);
      if (!prev) return;
      const phaseChanged = s.phase !== prev.phase;
      const questionChanged = s.question?.id !== prev.question?.id;
      // soluzione: "La risposta giusta è…" e solo dopo la risposta evidenziata (con suono, coriandoli, applauso)
      const teaseNow = phaseChanged && s.phase === "ANSWER_REVEAL" && voice.settings.enabled && startedRef.current;
      if (phaseChanged && s.phase !== "ANSWER_REVEAL") holdReveal(null);
      const showReveal = () => {
        holdReveal(null);
        sound.play("reveal");
        setConfettiIntensity(0.5);
        setConfetti((c) => c + 1);
        // applauso leggero se qualcuno ci ha preso
        const right = s.question?.correctPositions?.reduce((a, p) => a + (s.question?.distribution?.[p] ?? 0), 0) ?? 0;
        if (right > 0) setTimeout(() => sound.applause("light"), 650);
      };
      if (phaseChanged) {
        const cue = PHASE_CUES[s.phase];
        if (cue && s.phase !== "ANSWER_REVEAL") sound.play(cue);
        if (s.phase === "ANSWER_REVEAL" && !teaseNow) showReveal();
        // fine dell'intro: applauso del pubblico; classifica del round: applauso al vincitore del round
        if (s.phase === "ROUND_INTRO" && prev.phase === "INTRO") sound.applause("medium");
        if (s.phase === "SCORE_REVEAL" && s.roundLeaderboard?.length) setTimeout(() => sound.applause("medium"), 900);
        // ultima domanda della serata: rullo di tamburi sotto il cartello
        if (s.phase === "QUESTION_VISIBLE" && questionMoment(s).lastOfGame) setTimeout(() => sound.drumroll(3), 300);
        if (s.phase === "CATEGORY_RESULT" || s.phase === "SPECIAL_EVENT") {
          setConfettiIntensity(0.8);
          setConfetti((c) => c + 1);
        }
        if (s.phase === "OPTIONS_VISIBLE" || s.phase === "ANSWER_REVEAL") stopClip();
      }
      if (questionChanged) setAudioState("idle");
      // lobby: chi entra viene accolto (suono e un applauso appena accennato)
      if (!phaseChanged && s.phase === "LOBBY" && s.playerCount > prev.playerCount) {
        sound.play("join");
        sound.applause("tiny");
      }
      const p = prefsRef.current;
      // Sigla della serata
      if (phaseChanged && s.phase !== "PAUSED") {
        const th = themeFor(s.phase);
        if (th && p.theme) sound.playTheme({ loop: th.loop, volume: th.volume, from: s.phase === "FINISHED" ? 0 : undefined });
        else if (s.phase !== "INTRO") sound.stopTheme(900);
      }
      // Voce dei presentatori
      const lines = startedRef.current ? speechFor(s, prev, { readOptions: p.readOptions }) : [];
      // all'avvio dell'intro nessuna battuta rimasta in coda (es. un saluto della lobby in attesa della clip);
      // sui telefoni dei giocatori mai battute vecchie: a ogni cambio di fase la coda si svuota
      if (phaseChanged && (lines.length > 0 || s.phase === "INTRO" || viewerCode)) voice.stop();
      let spoken: Promise<unknown>;
      if (s.phase === "QUESTION_VISIBLE" && s.question && (phaseChanged || questionChanged)) {
        // cartello "DOMANDA N. X": annuncio (e suspense), una pausa muta fino al tempo minimo, poi la
        // domanda compare e il presentatore la legge (la voce resta "occupata": niente passo anticipato)
        const qid = s.question.id;
        const elapsed = Math.max(0, Date.parse(s.serverNow) - Date.parse(s.phaseStartedAt));
        const wait = Math.max(0, questionIntroMs(questionMoment(s)) - elapsed);
        const pre = lines.filter((l) => l.beforeCard);
        const rest = lines.filter((l) => !l.beforeCard);
        const said = pre.map((l) => voice.say(l.who, l.text, sayOpts(l)));
        if (lines.length > 0 && voice.settings.enabled) {
          gateFor.current = qid;
          said.push(
            voice.gate(new Promise((r) => setTimeout(r, wait))).then(() => {
              setCardFor(qid);
              sound.play("whoosh");
            }),
          );
        }
        said.push(...rest.map((l) => voice.say(l.who, l.text, sayOpts(l))));
        spoken = Promise.all(said);
      } else {
        const spinning = () => phaseRef.current === "WHEEL_SPIN";
        const tease = teaseNow ? lines.find((l) => l.revealTease) : undefined;
        let release: (() => void) | null = null;
        if (teaseNow && !tease) showReveal();
        if (tease && s.question) {
          // la risposta resta nascosta al massimo 6 s (voce lenta o assente: si scopre comunque)
          holdReveal(s.question.id);
          let done = false;
          const r = () => {
            if (done) return;
            done = true;
            if (phaseRef.current === "ANSWER_REVEAL") showReveal();
            else holdReveal(null);
          };
          release = r;
          setTimeout(r, 6000);
        }
        spoken = Promise.all(
          lines.map((l) => {
            const p = voice.say(l.who, l.text, { ...sayOpts(l), skipIf: wheelSkip(s, l, spinning) });
            return l === tease && release ? p.then(release) : p;
          }),
        );
      }
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
          const qid = s.question.id;
          // da subito "occupato": lo scorrimento automatico aspetta lettura + estratto
          clipBusy.current = true;
          void spoken.then(() => {
            // momento già passato (es. "Avanti" durante la lettura): niente canzone fuori tempo
            if (phaseRef.current !== "QUESTION_VISIBLE" || questionRef.current !== qid) {
              clipBusy.current = false;
              return;
            }
            return playClip(m.id, m.audioStartMs, m.audioDurationMs, m.audioPlays);
          });
        }
      }
    },
    [playClip, sound, stopClip, voice, startedRef, viewerCode],
  );

  const { state, status, now } = useGameState({
    fetchSnapshot: async () => {
      if (viewerCode) {
        const r = await api<{ state: PublicState }>(`/api/play/${viewerCode}/me${viewerSlot ? `?slot=${viewerSlot}` : ""}`);
        return r.state;
      }
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
    onViewState?.(view);
  }, [view, onViewState]);

  // Scorrimento automatico: il TV chiama /tick quando arriva l'orario del prossimo passo
  // (funziona anche con la regia chiusa; il server esegue il passo solo se è dovuto).
  const autoTickRequest = useCallback(
    () => api<AutoTickResponse>(`/api/display/${sessionId}/tick?k=${encodeURIComponent(displayKey)}`, { method: "POST", timeoutMs: 20000 }),
    [sessionId, displayKey],
  );
  // mentre il presentatore parla (o la sua clip sta arrivando) il TV non manda avanti la partita
  // (e mentre suona l'estratto musicale della domanda)
  const voiceBusy = useCallback(() => voice.pending || clipBusy.current, [voice]);
  // solo lo schermo dell'host guida la partita (mai i telefoni dei giocatori)
  useAutoTick({ auto: viewerCode ? null : state?.auto, now, tick: autoTickRequest, holdWhile: voiceBusy });

  // Il TV dice al server quando ha finito di parlare per questo momento della partita: lo
  // scorrimento automatico non taglia il presentatore e, appena ha finito, passa subito oltre
  // (dopo un respiro breve) invece di aspettare la stima dal testo.
  const autoOn = !!state?.auto && !viewerCode;
  const version = state?.version ?? null;
  useEffect(() => {
    if (!autoOn || version === null) return;
    const url = `/api/display/${sessionId}/spoken?k=${encodeURIComponent(displayKey)}`;
    const post = (speaking: boolean) => api(url, { method: "POST", json: { version, speaking }, timeoutMs: 20000 }).catch(() => undefined);
    let toldSpeaking = false;
    let idleSince: number | null = null;
    let done = false;
    // ruota che gira (Ruota impazzita o di Palmino): il momento finisce solo dopo l'arrivo e la
    // battuta "Tocca a… X!", che il TV dice quando la ruota si ferma
    const wheelTurning = () => {
      const s = stateRef.current;
      const sp = s?.version === version && s.phase === "WHEEL_SPIN" ? s.wheel?.spin : null;
      return !!sp && sp.frozenElapsedMs === null && now() < Date.parse(sp.startedAt) + sp.durationMs + 400;
    };
    const t = setInterval(() => {
      if (done) return;
      if (voice.pending || clipBusy.current || wheelTurning()) {
        idleSince = null;
        if (!toldSpeaking) {
          toldSpeaking = true;
          void post(true);
        }
        return;
      }
      idleSince ??= Date.now();
      if (Date.now() - idleSince >= SPOKEN_BREATH_MS) {
        done = true;
        void post(false);
      }
    }, 100);
    return () => clearInterval(t);
  }, [autoOn, version, sessionId, displayKey, voice, now]);

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

  // Countdown della votazione: tick negli ultimi 5 secondi
  const timerActive = view?.phase === "OPTIONS_VISIBLE" || view?.phase === "CATEGORY_VOTING";
  useTicker(timerActive, 200);
  const closesAt = view?.phase === "CATEGORY_VOTING" ? view.vote?.closesAt : view?.question?.closesAt;
  const remainingMs = closesAt ? Math.max(0, Date.parse(closesAt) - now()) : 0;
  const voting = view?.phase === "CATEGORY_VOTING";
  useEffect(() => {
    if (!voting) return;
    const s = Math.ceil(remainingMs / 1000);
    if (s !== lastTick.current && s <= 5 && s >= 0) {
      lastTick.current = s;
      sound.play(s === 0 ? "tickFinal" : "tick");
    }
  }, [remainingMs, voting, sound]);

  // Tempo che scade (libreria ufficiale): a volte (lo decide il server) una battuta negli ultimi secondi,
  // solo se non hanno risposto tutti, mai sopra un'altra voce e in tempo per finire prima della chiusura.
  const timeLine = view?.phase === "OPTIONS_VISIBLE" && view.question && !view.question.media ? ((view.showLines ?? []).find((l) => l.event === "TIME_RUNNING_OUT") ?? null) : null;
  const timeFired = useRef<string | null>(null);
  const timeQid = view?.question?.id ?? null;
  const timeAnswered = view?.question?.answeredCount ?? null;
  const timePlayers = view?.playerCount ?? 0;
  useEffect(() => {
    if (!timeLine || !started || !timeQid) return;
    const key = `${timeQid}|${timeLine.id ?? timeLine.text}`;
    if (timeFired.current === key) return;
    const due = timeLineDue({
      remainingMs,
      startAtMs: timeLineStartMs(timeLine.display ?? timeLine.text, timeLine.tags),
      textMs: spokenMs(timeLine.display ?? timeLine.text),
      answered: timeAnswered,
      players: timePlayers,
      voiceBusy: voice.pending,
    });
    if (!due) return;
    timeFired.current = key;
    void voice.say(timeLine.who, timeLine.text, {
      live: timeLine.live ?? false,
      display: timeLine.display,
      optional: true,
      optionalWaitMs: TIME_LINE_CLIP_WAIT_MS,
      // la fase è cambiata (tutti hanno risposto, tempo scaduto): non si dice più
      skipIf: () => stateRef.current?.phase !== "OPTIONS_VISIBLE" || stateRef.current?.question?.id !== timeQid,
    });
  }, [timeLine, started, timeQid, remainingMs, timeAnswered, timePlayers, voice]);

  // "Tic-tac" dell'orologio mentre si risponde: da quando le risposte si aprono a quando si chiudono.
  // Si ferma subito quando la fase cambia (tutti hanno risposto, tempo scaduto, pausa).
  const answering = view?.phase === "OPTIONS_VISIBLE" && view.question?.closesAt ? view.question : null;
  const clockKey = answering && started ? `${answering.id}|${answering.openedAt}|${answering.closesAt}` : null;
  useEffect(() => {
    if (!clockKey) return;
    const [, opened, closes] = clockKey.split("|");
    const t = now();
    sound.startClock((opened && opened !== "null" ? Date.parse(opened) : t) - t, Date.parse(closes) - t);
    return () => sound.stopClock();
  }, [clockKey, now, sound]);

  // Sigla in lobby (anche sullo show del telefono): parte appena l'audio è attivo, anche se lo stato
  // è arrivato dopo il tocco; si spegne se la si disattiva dalle impostazioni.
  const themePhase = view ? (view.phase === "PAUSED" && view.pausedFrom ? view.pausedFrom : view.phase) : null;
  useEffect(() => {
    if (!started || !themePhase) return;
    const th = themeFor(themePhase);
    if (!prefs.theme) {
      if (themePhase !== "INTRO") sound.stopTheme(600);
      return;
    }
    if (th && !sound.themePlaying && themePhase !== "FINISHED") sound.playTheme({ loop: th.loop, volume: th.volume });
  }, [started, themePhase, prefs.theme, sound]);

  // cartello "DOMANDA N. X": la domanda compare al più tardi dopo il tempo minimo (senza voce) o il tetto di sicurezza
  const introQid = view?.phase === "QUESTION_VISIBLE" ? (view.question?.id ?? null) : null;
  const introMoment = view ? questionMoment(view) : null;
  const introStart = view ? Date.parse(view.phaseStartedAt) : 0;
  useEffect(() => {
    if (!introQid || cardFor === introQid || !introMoment) return;
    const elapsed = now() - introStart;
    const limit = gateFor.current === introQid ? questionIntroMaxMs(introMoment) : questionIntroMs(introMoment);
    const t = setTimeout(() => setCardFor(introQid), Math.max(0, limit - elapsed));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- il momento dipende solo dalla domanda
  }, [introQid, cardFor, introStart, now]);
  const questionIntro = !!introQid && cardFor !== introQid && !!introMoment && now() - introStart < questionIntroMaxMs(introMoment);

  async function start() {
    if (startedRef.current) return;
    await sound.unlock();
    sound.preloadSfx();
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
    if (!tapToStart || autoStarted.current) return;
    autoStarted.current = true;
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (!ua?.hasBeenActive) return;
    const t = setTimeout(() => {
      void (async () => {
        if (!(await sound.unlock())) return;
        startedRef.current = true;
        sound.preloadSfx();
        sound.play("join");
        const p = prefsRef.current;
        const th = stateRef.current ? themeFor(stateRef.current.phase) : null;
        if (th && p.theme) sound.playTheme({ loop: th.loop, volume: th.volume });
        void voice.say(WELCOME_LINE.who, WELCOME_LINE.text);
        setStarted(true);
      })();
    }, 0);
    return () => clearTimeout(t);
  }, [tapToStart, sound, voice]);
  useEffect(() => {
    if (!tapToStart || started) return;
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
  const Stage = layout === "portrait" ? PortraitStage : TvStage;
  const screen = (
    <StageBoundary portrait={layout === "portrait"} onError={() => setSafe2d(true)}>
    <CharacterModeProvider prefer3d={prefs.characters3d && !safe2d} lowPower={prefs.lowPower}>
    <Stage
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
      questionIntro={questionIntro}
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
            portrait={layout === "portrait"}
          />
        ) : null
      }
    />
    </CharacterModeProvider>
    </StageBoundary>
  );

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-night [container-type:size]" data-motion={prefs.reducedMotion ? "reduced" : undefined} onDoubleClick={tapToStart ? undefined : () => setShowSettings((s) => !s)}>
      {screen}
      {view?.phase === "PAUSED" && <TvPauseOverlay />}
      <SilentSubtitle portrait={layout === "portrait"} />
      <VoicePreparing portrait={layout === "portrait"} />
      {themePhase === "INTRO" && <IntroSkipCounter skip={view?.introSkip} portrait={layout === "portrait"} />}
      {(started || hostMode) && !viewerCode && <TvScreenAgent sessionId={sessionId} showButton={!hostMode} audioOn={started} />}
      {(started || tapToStart) && renderOverlay?.(view, overlayCtx)}
      <Confetti fire={prefs.reducedMotion ? 0 : confetti} intensity={prefs.lowPower ? confettiIntensity * 0.4 : confettiIntensity} className="z-40" />

      {status !== "live" && started && (
        <div className="absolute right-[1cqw] top-[1cqh] z-50 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white/80">
          {status === "offline" ? "Connessione assente…" : "Riconnessione…"}
        </div>
      )}

      {!started && !tapToStart && (
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

      {showSettings && !tapToStart && (
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
