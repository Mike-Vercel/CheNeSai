"use client";

import { useSyncExternalStore } from "react";
import type { Presenter } from "@/lib/game-engine/types";
import type { TtsRole } from "@/features/game/script";
import { stripAudioTags } from "@/features/game/lines";
import { getSoundEngine } from "./audio-engine";

/**
 * Voce dei presentatori (solo sul TV): sintesi vocale italiana del browser.
 * - Microsoft Edge offre gratuitamente voci neurali "Natural" (Isabella,
 *   Diego, Giuseppe, Elsa…): sono le preferite.
 * - Chrome usa "Google italiano"; Windows le voci di sistema (Elsa, Cosimo).
 * Ogni personaggio ha voce, intonazione e velocità proprie. Mentre un
 * personaggio parla la musica si abbassa e la bocca (2D/3D) si muove.
 */

export interface VoiceSettings {
  enabled: boolean;
  /** Legge anche le quattro risposte quando compaiono. */
  readOptions: boolean;
  volume: number;
  /** Moltiplicatore della velocità di lettura. */
  rate: number;
}

interface CharacterVoice {
  pitch: number;
  rate: number;
  prefer: RegExp[];
  gender: "m" | "f";
}

const PROFILES: Record<TtsRole, CharacterVoice> = {
  professore: { pitch: 0.92, rate: 1.04, gender: "m", prefer: [/giuseppe/i, /diego/i, /benigno/i, /cosimo/i, /luca/i, /male/i] },
  regina: { pitch: 1.08, rate: 1.06, gender: "f", prefer: [/isabella/i, /elsa/i, /palmira/i, /alice/i, /google italiano/i, /female/i] },
  palmino: { pitch: 1.55, rate: 1.16, gender: "m", prefer: [/diego/i, /giuseppe/i, /cosimo/i, /luca/i, /benigno/i] },
  annunciatore: { pitch: 0.8, rate: 1.0, gender: "m", prefer: [/giuseppe/i, /cosimo/i, /diego/i, /benigno/i, /male/i] },
};

const FEMALE = /(isabella|elsa|palmira|alice|federica|paola|carla|bianca|google italiano|female|donna)/i;

/** Per quanto la battuta appena finita resta "in scena" (vedi heldSpeech). */
const HELD_SPEECH_MS = 900;

/**
 * Attesa massima della clip ElevenLabs (generata al momento sul server, anche 3-6 s su Vercel).
 * Solo oltre questo tempo, o se il server risponde con un errore, si ripiega sulla voce del browser.
 */
const CLIP_READY_TIMEOUT_MS = 10000;

type SpeakingListener = (who: Presenter | null) => void;

/** L'annunciatore è fuori campo: nessuna bocca si muove (ma la musica si abbassa). */
function mouthOf(who: TtsRole | null): Presenter | null {
  return who === null || who === "annunciatore" ? null : who;
}

/** Elemento della coda: battuta da sintetizzare oppure clip registrata (who=null: voce fuori campo). */
interface QueueItem {
  who: TtsRole | null;
  text: string;
  /** URL di un file audio registrato (es. /audio/intro/regina.mp3). */
  clip?: string;
  /** URL firmato della voce professionale, richiesto appena la battuta entra in coda (null = non disponibile). */
  prefetch?: Promise<string | null>;
  resolve: () => void;
}

class VoiceEngine {
  private voices: SpeechSynthesisVoice[] = [];
  private speakingWho: Presenter | null = null;
  private listeners = new Set<SpeakingListener>();
  private queue: QueueItem[] = [];
  private busy = false;
  /**
   * Turno della battuta in corso: ogni battuta che parte (e ogni stop) lo incrementa.
   * Gli eventi di fine che arrivano in ritardo da una battuta interrotta (es. "end"/"error"
   * dopo speechSynthesis.cancel()) hanno un turno vecchio e NON fanno partire la successiva:
   * così due voci non si sovrappongono mai.
   */
  private turn = 0;
  private mouthPhase = 0;
  private lastBoundary = 0;
  /** "browser" = sintesi gratuita del browser; "elevenlabs" = voce professionale dal server. */
  provider: "browser" | "elevenlabs" = "browser";
  private creds: { s: string; k: string } | null = null;
  private current: HTMLAudioElement | null = null;
  private analyser: AnalyserNode | null = null;
  private level = new Uint8Array(256);
  settings: VoiceSettings = { enabled: true, readOptions: true, volume: 1, rate: 1 };

  configure(patch: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...patch };
    if (!this.settings.enabled) this.stop();
  }

  get supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Credenziali dello schermo TV per la voce professionale (servizio a pagamento lato server). */
  setDisplayCredentials(sessionId: string, displayKey: string) {
    this.creds = { s: sessionId, k: displayKey };
  }

  init() {
    if (typeof window !== "undefined") {
      void fetch("/api/tts?status=1", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { provider?: string } | null) => {
          if (j?.provider === "elevenlabs") this.provider = "elevenlabs";
        })
        .catch(() => undefined);
    }
    if (!this.supported) return;
    const load = () => {
      this.voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("it"));
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
  }

  /** Voci italiane disponibili (per la diagnostica in impostazioni). */
  listVoices(): string[] {
    return this.voices.map((v) => `${v.name}${v.localService ? "" : " (online)"}`);
  }

  pickVoice(who: TtsRole): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) return null;
    const p = PROFILES[who];
    const score = (v: SpeechSynthesisVoice) => {
      let s = 0;
      if (/natural|neural|online/i.test(v.name)) s += 50;
      if (/google/i.test(v.name)) s += 15;
      const isF = FEMALE.test(v.name);
      if ((p.gender === "f") === isF) s += 30;
      const idx = p.prefer.findIndex((r) => r.test(v.name));
      if (idx >= 0) s += 20 - idx;
      return s;
    };
    return [...this.voices].sort((a, b) => score(b) - score(a))[0] ?? null;
  }

  subscribe(fn: SpeakingListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setSpeaking(who: Presenter | null, duck = who !== null, text = "") {
    this.speakingWho = who;
    // nuovo oggetto solo quando cambia davvero (snapshot stabile per useSyncExternalStore)
    const next = who ? { who, text } : null;
    if (next?.who !== this.speakingLine?.who || next?.text !== this.speakingLine?.text) this.speakingLine = next;
    if (this.heldTimer) clearTimeout(this.heldTimer);
    this.heldTimer = null;
    if (this.speakingLine) this.heldLine = this.speakingLine;
    else if (this.heldLine) {
      // fra due battute consecutive (pausa di ~120 ms) chi ha parlato resta in scena
      this.heldTimer = setTimeout(() => {
        this.heldTimer = null;
        this.heldLine = null;
        for (const l of this.listeners) l(this.speakingWho);
      }, HELD_SPEECH_MS);
    }
    getSoundEngine().duck(duck);
    for (const l of this.listeners) l(who);
  }

  get speaking(): Presenter | null {
    return this.speakingWho;
  }

  /** Battuta in corso (chi parla e il testo passato a say), per animare chi la dice sul TV. */
  private speakingLine: { who: Presenter; text: string } | null = null;
  get speech(): { who: Presenter; text: string } | null {
    return this.speakingLine;
  }

  private heldLine: { who: Presenter; text: string } | null = null;
  private heldTimer: ReturnType<typeof setTimeout> | null = null;
  /** Come `speech`, ma resta per un attimo dopo la fine della battuta (niente sfarfallii di scena). */
  get heldSpeech(): { who: Presenter; text: string } | null {
    return this.heldLine;
  }

  /**
   * Apertura della bocca 0..1 per il lip-sync (chiamata a ogni frame).
   * La sintesi del browser non espone l'audio: si combina un'oscillazione
   * sillabica con gli eventi "boundary" (inizio di ogni parola).
   */
  mouthOpen(who: Presenter, dtSeconds: number): number {
    if (this.speakingWho !== who) return 0;
    // voce professionale: lip-sync reale dal volume dell'audio
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.level);
      let sum = 0;
      for (let i = 0; i < this.level.length; i++) {
        const v = (this.level[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.level.length);
      return Math.min(1, Math.max(0, (rms - 0.015) * 7));
    }
    this.mouthPhase += dtSeconds * 11.5;
    const sinceWord = (performance.now() - this.lastBoundary) / 1000;
    const accent = Math.max(0, 1 - sinceWord * 4);
    const syl = 0.5 + 0.5 * Math.sin(this.mouthPhase) * Math.sin(this.mouthPhase * 0.37 + 1.3);
    return Math.min(1, 0.18 + syl * 0.6 + accent * 0.35);
  }

  /**
   * Mette in coda una battuta; risolve quando è stata pronunciata (o saltata).
   * Con la voce professionale l'URL della clip viene chiesto subito (prefetch),
   * così quando arriva il suo turno l'audio parte senza pause.
   * `live` = battuta con nickname/punteggi (modello veloce lato server).
   */
  say(who: TtsRole, text: string, opts: { live?: boolean } = {}): Promise<void> {
    if ((!this.supported && this.provider === "browser") || !this.settings.enabled || !text.trim()) return Promise.resolve();
    return new Promise((resolve) => {
      this.queue.push({ who, text, resolve, prefetch: this.prefetchClip(who, text, !!opts.live) });
      this.pump();
    });
  }

  /** Chiede al server l'URL firmato della battuta (la chiave API resta sul server). */
  private prefetchClip(who: TtsRole, text: string, live: boolean): Promise<string | null> | undefined {
    if (this.provider !== "elevenlabs" || !this.creds) return undefined;
    const c = this.creds;
    const qs = new URLSearchParams({ who, text, s: c.s, k: c.k, format: "json" });
    if (live) qs.set("live", "1");
    return fetch(`/api/tts?${qs.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ url?: string }>) : null))
      .then((j) => {
        if (!j?.url) return null;
        // scarica l'audio in anticipo: al suo turno parte subito
        const pre = new Audio();
        pre.preload = "auto";
        pre.crossOrigin = "anonymous";
        pre.src = j.url;
        return j.url;
      })
      .catch(() => null);
  }

  /**
   * Mette in coda una clip registrata (es. voci ElevenLabs dell'intro). Lip-sync reale dal volume
   * (AnalyserNode) e musica abbassata come per le altre battute. `who = null` = voce fuori campo
   * (annunciatore): nessuna bocca si muove ma la musica si abbassa lo stesso.
   * Se il file non si riproduce e c'è `fallbackText`, la battuta passa alla sintesi del browser.
   */
  playClip(who: Presenter | null, url: string, fallbackText?: { who: Presenter; text: string }): Promise<void> {
    if (!this.settings.enabled) return Promise.resolve();
    return new Promise((resolve) => {
      this.queue.push({ who, text: fallbackText?.text ?? "", clip: url, resolve });
      if (fallbackText) this.clipFallback.set(url, fallbackText);
      this.pump();
    });
  }

  private clipFallback = new Map<string, { who: Presenter; text: string }>();

  /** Interrompe tutto (es. cambio di fase improvviso). */
  stop() {
    this.queueEpoch++;
    this.turn++;
    for (const q of this.queue.splice(0)) q.resolve();
    if (this.current) {
      this.current.pause();
      this.current = null;
      this.analyser = null;
    }
    if (!this.supported) {
      this.busy = false;
      this.setSpeaking(null);
      return;
    }
    window.speechSynthesis.cancel();
    this.busy = false;
    this.setSpeaking(null);
  }

  private pump() {
    if (this.busy) return;
    const next = this.queue.shift();
    if (!next) return;
    this.busy = true;
    if (next.clip) {
      this.playRecorded(next, next.clip);
      return;
    }
    if (next.who === null) {
      // voce fuori campo senza clip: niente da dire
      this.busy = false;
      next.resolve();
      setTimeout(() => this.pump(), 0);
      return;
    }
    const line = { who: next.who, text: next.text, resolve: next.resolve };
    if (next.prefetch) {
      // Voce professionale: si aspetta l'URL al massimo ~10 s (errore del server = browser subito).
      const epoch = this.queueEpoch;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((r) => {
        timer = setTimeout(() => r(null), CLIP_READY_TIMEOUT_MS);
      });
      void Promise.race([next.prefetch, timeout]).then((url) => {
        clearTimeout(timer);
        if (this.queueEpoch !== epoch) {
          line.resolve(); // fermato nel frattempo
          return;
        }
        if (url) this.playRecorded(line, url);
        else if (this.supported) this.speakBrowser(line);
        else this.finishItem(line.resolve);
      });
      return;
    }
    if (!this.supported) {
      this.finishItem(line.resolve);
      return;
    }
    this.speakBrowser(line);
  }

  /** Incrementato da stop(): le attese in corso capiscono di essere state annullate. */
  private queueEpoch = 0;

  private finishItem(resolve: () => void) {
    this.busy = false;
    this.setSpeaking(null, false);
    resolve();
    setTimeout(() => this.pump(), 0);
  }

  /** Audio registrato: voce professionale dal server (ElevenLabs) oppure clip statica. */
  private playRecorded(next: QueueItem, url: string) {
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.volume = this.settings.volume;
    el.src = url;
    this.current = el;
    const eng = getSoundEngine();
    const ctx = eng.context;
    if (ctx && eng.sfx) {
      try {
        const src = ctx.createMediaElementSource(el);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an).connect(eng.sfx);
        this.analyser = an;
      } catch {
        this.analyser = null;
      }
    }
    let finished = false;
    const my = ++this.turn;
    const done = (fallback: boolean) => {
      if (finished) return;
      finished = true;
      if (my !== this.turn) {
        // battuta interrotta da stop(): chi aspettava viene sbloccato, la coda no
        next.resolve();
        return;
      }
      this.current = null;
      this.analyser = null;
      const fb = next.clip ? this.clipFallback.get(next.clip) : next.who ? { who: next.who, text: next.text } : undefined;
      if (fallback && this.supported && fb && fb.text) {
        // file/rete/servizio non disponibile: la battuta viene detta con la voce del browser
        this.speakBrowser({ who: fb.who, text: fb.text, resolve: next.resolve });
        return;
      }
      this.busy = false;
      this.setSpeaking(null);
      next.resolve();
      setTimeout(() => this.pump(), 120);
    };
    el.onplaying = () => this.setSpeaking(mouthOf(next.who), true, next.text);
    el.onended = () => done(false);
    el.onerror = () => done(true);
    void el.play().catch(() => done(true));
  }

  private speakBrowser(next: { who: TtsRole; text: string; resolve: () => void }) {
    const p = PROFILES[next.who];
    // gli audio tag ([laughs]…) servono solo a ElevenLabs: il browser non deve leggerli
    const spoken = stripAudioTags(next.text);
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = "it-IT";
    const v = this.pickVoice(next.who);
    if (v) u.voice = v;
    u.pitch = p.pitch;
    u.rate = p.rate * this.settings.rate;
    u.volume = this.settings.volume;
    const my = ++this.turn;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      if (my !== this.turn) {
        next.resolve(); // interrotta da stop(): niente ripartenza della coda (eviterebbe voci sovrapposte)
        return;
      }
      this.busy = false;
      this.setSpeaking(null);
      next.resolve();
      setTimeout(() => this.pump(), 120);
    };
    // alcuni browser non emettono "end" se la voce online cade: rete di sicurezza.
    // Se allo scadere il browser sta ancora parlando si aspetta ancora (fino a un tetto), invece di
    // far partire la battuta successiva sopra a questa.
    const hardStop = performance.now() + 6000 + spoken.length * 250;
    let watchdog: ReturnType<typeof setTimeout>;
    const check = () => {
      if (window.speechSynthesis.speaking && performance.now() < hardStop) watchdog = setTimeout(check, 700);
      else done();
    };
    watchdog = setTimeout(check, 1500 + spoken.length * 120);
    u.onstart = () => this.setSpeaking(mouthOf(next.who), true, next.text);
    u.onboundary = () => {
      this.lastBoundary = performance.now();
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  }
}

let engine: VoiceEngine | null = null;
export function getVoice(): VoiceEngine {
  if (!engine) {
    engine = new VoiceEngine();
    engine.init();
  }
  return engine;
}
export type { VoiceEngine };

/** Legge il testo di una lettera di risposta in modo naturale. */
export function spokenLetter(i: number): string {
  return ["A", "B", "C", "D"][i] ?? "";
}

/** Numeri grandi leggibili dalla sintesi ("12.400" → "12400"). */
export function spokenPoints(n: number): string {
  return `${n}`;
}

/**
 * Battuta in corso sul TV (chi parla e cosa), null in silenzio. Resta per ~0,9 s dopo la fine,
 * così tra due battute consecutive dello stesso momento il personaggio non esce e rientra.
 */
export function useHeldSpeech(): { who: Presenter; text: string } | null {
  return useSyncExternalStore(
    (cb) => getVoice().subscribe(() => cb()),
    () => getVoice().heldSpeech,
    () => null,
  );
}

/** Chi sta parlando in questo momento (per animare i personaggi). */
export function useSpeaker(): Presenter | null {
  return useSyncExternalStore(
    (cb) => getVoice().subscribe(() => cb()),
    () => getVoice().speaking,
    () => null,
  );
}
