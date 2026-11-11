"use client";

import { useSyncExternalStore } from "react";
import type { Presenter } from "@/lib/game-engine/types";
import type { TtsRole } from "@/features/game/script";
import { stripAudioTags } from "@/features/game/lines";
import { getSoundEngine } from "./audio-engine";
import { CLIP_RETRY_DELAYS_MS, clipWaitMs, isFinalTtsFailure, silentLineMs, waitForClip } from "./voice-wait";

/**
 * Voce dei presentatori (solo sul TV).
 * - Con la voce professionale (ElevenLabs) configurata sul server si sentono SOLO le sue clip:
 *   mai la sintesi del browser. Se una clip non arriva (dopo l'attesa e qualche tentativo) la
 *   battuta compare come sottotitolo con il personaggio che parla.
 * - Senza voce professionale: sintesi del browser (se consentita dalle impostazioni del TV).
 *   Microsoft Edge offre voci neurali "Natural" (Isabella, Diego, Giuseppe, Elsa…), preferite;
 *   Chrome usa "Google italiano"; Windows le voci di sistema (Elsa, Cosimo).
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
  /**
   * Voce del browser (sintesi "Google"/Windows) quando la voce professionale NON è configurata.
   * Con ElevenLabs attivo non si usa MAI: se una clip non arriva la battuta compare come
   * sottotitolo con il personaggio che parla, senza voce sintetica.
   */
  browserVoice: boolean;
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

/** Attesa della clip oltre la quale lo show mostra "sto preparando la voce". */
const PREPARING_AFTER_MS = 700;

/** Per quanto la battuta appena finita resta "in scena" (vedi heldSpeech). */
const HELD_SPEECH_MS = 900;

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
  /** battuta in diretta (nickname, punteggi) */
  live?: boolean;
  /**
   * Battuta da saltare se, quando arriva il suo turno (o la sua clip), non è più il momento
   * (es. "E il vincitore è…" quando il vincitore è già sullo schermo).
   */
  skipIf?: () => boolean;
  /** Attesa muta in coda (es. il cartello "DOMANDA N. X"): la coda resta "occupata" finché non si risolve. */
  gate?: Promise<unknown>;
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
  /**
   * "elevenlabs" = voce professionale dal server; "browser" = voce professionale spenta sul server;
   * "unknown" = non ancora saputo (in quel caso niente voce del browser: si aspetta la risposta).
   */
  provider: "unknown" | "browser" | "elevenlabs" = "unknown";
  private providerReady: Promise<"browser" | "elevenlabs" | "unknown"> = Promise.resolve("unknown");
  private creds: { s: string; k: string } | null = null;
  /** Battuta registrata in riproduzione (elemento audio o sorgente Web Audio): `stop()` la ferma. */
  private current: { stop: () => void } | null = null;
  private analyser: AnalyserNode | null = null;
  private level = new Uint8Array(256);
  settings: VoiceSettings = { enabled: true, readOptions: true, volume: 1, rate: 1, browserVoice: true };

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
    this.player = null;
  }

  /**
   * Telefono di un GIOCATORE con lo show sul telefono: le voci arrivano dal server solo per le
   * battute della sua partita (cookie del giocatore, /api/play/tts).
   */
  setPlayerCredentials(code: string, slot: string | null) {
    this.player = { code, slot };
    this.creds = null;
  }
  private player: { code: string; slot: string | null } | null = null;

  init() {
    if (typeof window !== "undefined") {
      // la voce professionale c'è? (qualche tentativo: finché non si sa, mai la voce del browser)
      this.providerReady = (async () => {
        for (let i = 0; i < 4; i++) {
          try {
            const r = await fetch("/api/tts?status=1", { cache: "no-store" });
            if (r.ok) {
              const j = (await r.json()) as { provider?: string };
              this.provider = j.provider === "elevenlabs" ? "elevenlabs" : "browser";
              return this.provider;
            }
          } catch {
            /* rete: si riprova */
          }
          await new Promise((res) => setTimeout(res, 800 * (i + 1)));
        }
        return "unknown" as const;
      })();
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
  say(who: TtsRole, text: string, opts: { live?: boolean; skipIf?: () => boolean } = {}): Promise<void> {
    if (!this.settings.enabled || !text.trim()) return Promise.resolve();
    return new Promise((resolve) => {
      this.queue.push({ who, text, resolve, live: !!opts.live, skipIf: opts.skipIf, prefetch: this.prefetchClip(who, text, !!opts.live) });
      this.pump();
    });
  }

  /**
   * Pausa muta in coda: le battute successive partono solo quando `until` si risolve (es. fine del
   * cartello "DOMANDA N. X"). Nel frattempo la voce risulta "occupata" (pending), così il TV non
   * dice al server di aver finito di parlare. Con la voce spenta si risolve subito.
   */
  gate(until: Promise<unknown>): Promise<void> {
    if (!this.settings.enabled) return Promise.resolve();
    return new Promise((resolve) => {
      this.queue.push({ who: null, text: "", gate: until, resolve });
      this.pump();
    });
  }

  /**
   * Chiede al server l'URL firmato della battuta (la chiave API resta sul server), con qualche
   * tentativo ravvicinato se il server è lento o dà un errore passeggero (sempre entro l'attesa
   * massima della battuta). null = niente clip: voce spenta, budget esaurito o guasto ripetuto.
   */
  private prefetchClip(who: TtsRole, text: string, live: boolean): Promise<string | null> {
    return this.providerReady.then(async (provider) => {
      if (provider !== "elevenlabs" || (!this.creds && !this.player)) return null;
      let endpoint: string;
      if (this.player) {
        const qs = new URLSearchParams({ code: this.player.code, who, text });
        if (this.player.slot) qs.set("slot", this.player.slot);
        endpoint = `/api/play/tts?${qs.toString()}`;
      } else {
        const c = this.creds!;
        const qs = new URLSearchParams({ who, text, s: c.s, k: c.k, format: "json" });
        if (live) qs.set("live", "1");
        endpoint = `/api/tts?${qs.toString()}`;
      }
      const until = Date.now() + clipWaitMs(live) - 500;
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await fetch(endpoint, { cache: "no-store" });
          if (r.ok) {
            const j = (await r.json()) as { url?: string };
            if (!j.url) return null;
            // scarica l'audio in anticipo: al suo turno parte subito
            const pre = new Audio();
            pre.preload = "auto";
            pre.crossOrigin = "anonymous";
            pre.src = j.url;
            return j.url;
          }
          if (isFinalTtsFailure(r.status)) return null; // voce spenta, budget esaurito, accesso negato
        } catch {
          /* rete: si riprova */
        }
        const pause = CLIP_RETRY_DELAYS_MS[attempt];
        if (pause === undefined || Date.now() + pause >= until) return null;
        await new Promise((res) => setTimeout(res, pause));
      }
    });
  }

  /** Voce del browser consentita? Solo se la voce professionale è spenta sul server e l'impostazione lo permette. */
  private browserAllowed(): boolean {
    return this.supported && this.provider === "browser" && this.settings.browserVoice;
  }

  /** Battuta senza clip: voce del browser solo se consentita, altrimenti sottotitolo con il personaggio che parla. */
  private fallback(line: { who: TtsRole; text: string; resolve: () => void }) {
    if (this.browserAllowed()) this.speakBrowser(line);
    else this.speakSilent(line);
  }

  /** Riga mostrata come sottotitolo quando la battuta non ha voce (vedi speakSilent). */
  private silent: { who: TtsRole; text: string } | null = null;
  get silentLine(): { who: TtsRole; text: string } | null {
    return this.silent;
  }

  /**
   * Battuta "muta": il personaggio parla (bocca e animazione) e il testo compare come sottotitolo
   * per il tempo che servirebbe a dirla; nessuna voce sintetica. Poi la coda prosegue.
   */
  private speakSilent(next: { who: TtsRole; text: string; resolve: () => void }) {
    const spoken = stripAudioTags(next.text);
    const my = ++this.turn;
    this.silent = { who: next.who, text: spoken };
    this.setSpeaking(mouthOf(next.who), true, next.text);
    setTimeout(() => {
      if (my !== this.turn) {
        next.resolve();
        return;
      }
      this.silent = null;
      this.busy = false;
      this.setSpeaking(null);
      next.resolve();
      setTimeout(() => this.pump(), 120);
    }, silentLineMs(spoken));
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

  /**
   * true finché c'è una battuta in corso, in attesa della clip o in coda: lo scorrimento automatico
   * del TV aspetta (useAutoTick holdWhile) invece di tagliare il presentatore a metà.
   */
  get pending(): boolean {
    return this.busy || this.queue.length > 0;
  }

  /** true mentre si aspetta una clip che il server sta ancora preparando ("Un attimo… sto preparando la voce"). */
  private preparingClip = false;
  get preparing(): boolean {
    return this.preparingClip;
  }
  private setPreparing(on: boolean) {
    if (this.preparingClip === on) return;
    this.preparingClip = on;
    for (const l of this.listeners) l(this.speakingWho);
  }

  /** Interrompe tutto (es. cambio di fase improvviso). */
  stop() {
    this.setPreparing(false);
    this.silent = null;
    this.queueEpoch++;
    this.turn++;
    for (const q of this.queue.splice(0)) q.resolve();
    if (this.current) {
      this.current.stop();
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
    if (next.gate) {
      const epoch = this.queueEpoch;
      const done = () => {
        next.resolve();
        if (this.queueEpoch !== epoch) return; // fermato nel frattempo: la coda è già ripartita
        this.busy = false;
        this.pump();
      };
      void next.gate.then(done, done);
      return;
    }
    if (next.skipIf?.()) {
      // non è più il momento: la battuta non si dice
      this.busy = false;
      next.resolve();
      setTimeout(() => this.pump(), 0);
      return;
    }
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
      // Voce professionale: si aspetta la clip anche se è lenta (generata al volo, fino a ~12 s, con
      // qualche nuovo tentativo). Se non arriva: MAI la voce del browser con ElevenLabs attivo,
      // la battuta compare come sottotitolo (vedi fallback).
      const epoch = this.queueEpoch;
      // clip non ancora pronta (es. nome nuovo da generare): dopo un attimo lo show lo dice
      const slow = setTimeout(() => this.setPreparing(true), PREPARING_AFTER_MS);
      void waitForClip(next.prefetch, clipWaitMs(!!next.live)).then((url) => {
        clearTimeout(slow);
        this.setPreparing(false);
        if (this.queueEpoch !== epoch) {
          line.resolve(); // fermato nel frattempo
          return;
        }
        if (next.skipIf?.()) {
          // la clip è arrivata tardi: il momento è passato, la battuta non si dice
          this.busy = false;
          line.resolve();
          setTimeout(() => this.pump(), 0);
          return;
        }
        if (url) this.playRecorded(line, url);
        else this.fallback(line);
      });
      return;
    }
    this.fallback(line);
  }

  /** Incrementato da stop(): le attese in corso capiscono di essere state annullate. */
  private queueEpoch = 0;

  /** Audio registrato: voce professionale dal server (ElevenLabs) oppure clip statica. */
  /**
   * Riproduce una clip. Sui telefoni (soprattutto iPhone) un nuovo elemento audio avviato senza un
   * tocco dell'utente viene bloccato: quando il motore Web Audio è già sbloccato (tocco su "Su questo
   * telefono", "Attiva audio"…) la clip passa da lì, che non ha questo limite. Altrimenti, o se la
   * decodifica fallisce, si usa l'elemento audio come prima.
   */
  private playRecorded(next: QueueItem, url: string) {
    const eng = getSoundEngine();
    const ctx = eng.context;
    if (ctx && eng.sfx && ctx.state === "running") {
      void this.playBuffered(next, url, ctx, eng.sfx);
      return;
    }
    this.playElement(next, url);
  }

  private async playBuffered(next: QueueItem, url: string, ctx: AudioContext, out: GainNode) {
    const my = ++this.turn;
    let source: AudioBufferSourceNode | null = null;
    let stopped = false;
    this.current = {
      stop: () => {
        stopped = true;
        try {
          source?.stop();
        } catch {
          // già fermata
        }
      },
    };
    let audio: AudioBuffer;
    try {
      const res = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(String(res.status));
      audio = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      if (stopped || my !== this.turn) {
        next.resolve();
        return;
      }
      // rete o decodifica non riuscite: si riprova con l'elemento audio (con il suo ripiego)
      this.turn--;
      this.playElement(next, url);
      return;
    }
    if (stopped || my !== this.turn) {
      next.resolve();
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = audio;
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an).connect(out);
    source = src;
    this.analyser = an;
    src.onended = () => {
      if (my !== this.turn || stopped) {
        next.resolve();
        return;
      }
      this.current = null;
      this.analyser = null;
      this.busy = false;
      this.setSpeaking(null);
      next.resolve();
      setTimeout(() => this.pump(), 120);
    };
    this.setSpeaking(mouthOf(next.who), true, next.text);
    src.start();
  }

  private playElement(next: QueueItem, url: string) {
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.volume = this.settings.volume;
    el.src = url;
    this.current = { stop: () => el.pause() };
    const eng = getSoundEngine();
    const ctx = eng.context;
    if (ctx && eng.sfx) {
      try {
        const src = ctx.createMediaElementSource(el);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an).connect(eng.sfx);
        this.analyser = an;
        // passa dal mixer del TV: il volume generale lo applica già il bus principale
        el.volume = 1;
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
      if (fallback && fb && fb.text) {
        // file/rete non disponibile: sottotitolo (o voce del browser solo se la voce professionale è spenta)
        this.fallback({ who: fb.who, text: fb.text, resolve: next.resolve });
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

/** Battuta senza voce in corso (sottotitolo sul TV), null se si sente la voce o c'è silenzio. */
export function useSilentLine(): { who: TtsRole; text: string } | null {
  return useSyncExternalStore(
    (cb) => getVoice().subscribe(() => cb()),
    () => getVoice().silentLine,
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

/** Lo show sta aspettando una voce ancora in preparazione (indicatore "Un attimo…"). */
export function useVoicePreparing(): boolean {
  return useSyncExternalStore(
    (cb) => getVoice().subscribe(() => cb()),
    () => getVoice().preparing,
    () => false,
  );
}
