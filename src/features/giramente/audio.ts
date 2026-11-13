"use client";

import { useEffect, useRef, useState } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { api } from "@/lib/realtime/api-client";
import { captionOf, fillLine, isDynamic, LINE_BY_ID, LINES, lineAudioUrl, pickVariant, type Speaker } from "@/lib/giramente/lines";
import { roundInfo, type PublicState } from "@/lib/giramente/types";
import { direct, type Cue, type Sfx } from "./director";

/**
 * Guadagno per portare una voce sintetizzata al volume delle frasi registrate (normalizzate a circa -17 LUFS: RMS parlato ≈ 0,146):
 * RMS dei tratti parlati (sopra una soglia, così le pause non contano) → livello obiettivo. Limitato fra 0,5 e 4.
 */
const VOICE_TARGET_RMS = 0.146;
function loudnessGain(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  const win = Math.max(1, Math.round(buf.sampleRate * 0.05));
  let sum = 0;
  let n = 0;
  let peak = 0;
  for (let i = 0; i < d.length; i += win) {
    let s = 0;
    const end = Math.min(d.length, i + win);
    for (let j = i; j < end; j++) {
      s += d[j] * d[j];
      peak = Math.max(peak, Math.abs(d[j]));
    }
    const rms = Math.sqrt(s / (end - i));
    if (rms > 0.01) {
      sum += rms * rms;
      n++;
    }
  }
  if (!n) return 1;
  const rms = Math.sqrt(sum / n);
  // mai oltre il fondo scala: il picco resta sotto 0,95
  return Math.min(4, Math.max(0.5, VOICE_TARGET_RMS / rms), peak > 0 ? 0.95 / peak : 4);
}

/**
 * Audio di GIRAMENTE!: sigla (GIRAMENTE.mp3 dell'utente), effetti sintetizzati dal motore audio del sito
 * (nessun brano di terzi) e voci di Don Patrizio e Zafira in UNA coda: mai due battute insieme.
 *
 * - Battute fisse: clip in /audio/giramente/voci/<id>.mp3 se presenti; altrimenti, se le voci sono
 *   configurate sul server, voce sintetizzata; altrimenti solo il sottotitolo.
 * - Battute dinamiche (nomi, punti): voce sintetizzata dal server (la chiave non arriva mai qui).
 * - Dove suona (niente doppioni nella stessa stanza): schermo TV, dispositivo condiviso, telefono di
 *   chi gestisce la partita se nessuno schermo TV è collegato. Gli altri: solo effetti brevi.
 * - La voce non blocca mai il gioco: coda corta, battute vecchie scartate a ogni nuova fase.
 */
const THEME = "/audio/giramente/sigla.mp3";
const MUSIC_LOUD = 0.42;
const MUSIC_QUIET = 0.08;

export interface SpeechState {
  who: Speaker | null;
  caption: string | null;
  audible: boolean;
}

type Source = { roomId?: string; key?: string };

class GiramenteVoice {
  private queue: { cue: Cue; caption: string }[] = [];
  private playing = false;
  private missing = new Set<string>();
  private listeners = new Set<(s: SpeechState) => void>();
  private analyser: AnalyserNode | null = null;
  private voicesConfigured: boolean | null = null;
  /** battute fisse con il clip registrato (controllate una volta con HEAD, senza scaricarle) */
  private available: Set<string> | null = null;
  private probing = false;
  private lastVariant = new Map<string, string>();
  source: Source = {};
  enabled = true;
  /** apertura della bocca 0–1 per i personaggi (aggiornata a ogni fotogramma mentre parlano) */
  readonly mouth: { current: number } = { current: 0 };
  state: SpeechState = { who: null, caption: null, audible: false };

  onState(fn: (s: SpeechState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private set(s: SpeechState) {
    this.state = s;
    for (const l of this.listeners) l(s);
  }

  private getAnalyser(): AnalyserNode | null {
    if (this.analyser) return this.analyser;
    const ctx = getSoundEngine().context;
    if (!ctx) return null;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.5;
    return this.analyser;
  }

  private async configured(): Promise<boolean> {
    if (this.voicesConfigured !== null) return this.voicesConfigured;
    try {
      const r = await api<{ voices: Record<Speaker, boolean> }>("/api/giramente/voce", { timeoutMs: 4000 });
      this.voicesConfigured = r.voices.dontralla || r.voices.zafira;
    } catch {
      this.voicesConfigured = false;
    }
    return this.voicesConfigured;
  }

  /** Controlla (una volta) quali clip registrati esistono: si preferiscono le varianti con la voce vera. */
  probe() {
    if (this.available || this.probing || typeof fetch === "undefined") return;
    this.probing = true;
    const found = new Set<string>();
    const ids = LINES.filter((l) => !isDynamic(l)).map((l) => l.id);
    let i = 0;
    const worker = async () => {
      while (i < ids.length) {
        const id = ids[i++];
        try {
          const r = await fetch(lineAudioUrl(id), { method: "HEAD", cache: "force-cache" });
          if (r.ok && (r.headers.get("content-type") ?? "").includes("audio")) found.add(id);
        } catch {
          /* rete assente: si riprova alla prossima pagina */
        }
      }
    };
    void Promise.all([worker(), worker(), worker(), worker()]).then(() => {
      this.available = found;
      this.probing = false;
    });
  }

  /** Variante della battuta (a caso, mai la stessa due volte di fila, preferendo quelle registrate). */
  pick(baseId: string): string {
    const id = pickVariant(baseId, this.available, this.lastVariant.get(baseId) ?? null);
    this.lastVariant.set(baseId, id);
    return id;
  }

  say(cues: { cue: Cue; caption: string }[], replace: boolean) {
    if (!cues.length) return;
    if (replace) this.queue = [];
    this.queue.push(...cues);
    if (this.queue.length > 4) this.queue = this.queue.slice(-4);
    if (!this.playing) void this.next();
  }

  stop() {
    this.queue = [];
    this.set({ who: null, caption: null, audible: false });
  }

  private async bufferFor(cue: Cue): Promise<AudioBuffer | null> {
    if (!this.enabled) return null;
    const line = LINE_BY_ID[cue.line];
    if (!line) return null;
    const engine = getSoundEngine();
    if (!isDynamic(line) && !this.missing.has(line.id)) {
      const b = await Promise.race([engine.loadBuffer(lineAudioUrl(line.id)), new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
      if (b) return b;
      this.missing.add(line.id);
    }
    // fisse senza clip registrato: solo sottotitolo (la sintesi vale solo per le battute con nomi e punti)
    if (!isDynamic(line)) return null;
    if (!(await this.configured()) || (!this.source.roomId && !this.source.key)) return null;
    try {
      const r = await api<{ url: string | null }>("/api/giramente/voce", {
        method: "POST",
        timeoutMs: 9000,
        json: { ...this.source, line: line.id, competitorId: cue.competitorId ?? null, points: cue.points ?? null, roundNo: cue.roundNo ?? null },
      });
      return r.url ? await engine.loadBuffer(r.url) : null;
    } catch {
      return null;
    }
  }

  private async next() {
    const item = this.queue.shift();
    if (!item) {
      this.playing = false;
      this.mouth.current = 0;
      this.set({ who: null, caption: null, audible: false });
      return;
    }
    this.playing = true;
    const line = LINE_BY_ID[item.cue.line];
    const minShow = new Promise((r) => setTimeout(r, Math.min(3600, 1000 + item.caption.length * 38)));
    let spoken: Promise<void> | null = null;
    try {
      const buf = await this.bufferFor(item.cue);
      if (buf) {
        const engine = getSoundEngine();
        engine.duck(true);
        // le frasi registrate sono già allo stesso volume; quelle sintetizzate al momento (col nome) si pareggiano qui
        spoken = engine.playVoiceClip(buf, line && isDynamic(line) ? loudnessGain(buf) : 1, this.getAnalyser());
      }
    } catch {
      spoken = null;
    }
    this.set({ who: line?.who ?? "dontralla", caption: item.caption, audible: !!spoken });
    let raf = 0;
    if (spoken && this.analyser) {
      const data = new Uint8Array(this.analyser.fftSize);
      const frame = () => {
        this.analyser!.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        this.mouth.current = Math.min(1, Math.sqrt(sum / data.length) * 5);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }
    await Promise.race([Promise.all([spoken ?? Promise.resolve(), minShow]), new Promise((r) => setTimeout(r, 12_000))]);
    cancelAnimationFrame(raf);
    this.mouth.current = 0;
    if (spoken) getSoundEngine().duck(false);
    void this.next();
  }
}

let voice: GiramenteVoice | null = null;
export function getGiramenteVoice(): GiramenteVoice {
  if (!voice) voice = new GiramenteVoice();
  return voice;
}

/** Effetti del gioco con il motore audio del sito (sintetizzati, nessun file di terzi). */
export function playSfx(s: Sfx) {
  const e = getSoundEngine();
  switch (s) {
    case "spin":
      e.play("whoosh");
      break;
    case "correct":
      e.play("correct");
      break;
    case "wrong":
      e.play("wrong");
      break;
    case "bonus":
      e.play("score");
      break;
    case "jolly":
      e.play("reveal");
      e.play("whoosh");
      break;
    case "penalty":
      e.play("wrong");
      e.play("brake");
      break;
    case "finale":
      e.play("fanfare");
      break;
    case "victory":
      e.play("victory");
      e.applause("big");
      break;
    case "leaderboard":
      e.play("leaderboard");
      break;
    case "roundStart":
      e.play("roundStart");
      break;
    case "question":
      e.play("questionAppear");
      break;
    case "reveal":
      e.play("drumroll");
      break;
    case "join":
      e.play("join");
      break;
    case "pause":
      e.play("pause");
      break;
  }
}

/** Testo del sottotitolo con i nomi veri (pubblici). */
export function captionFor(cue: Cue, state: PublicState): string {
  const line = LINE_BY_ID[cue.line];
  if (!line) return "";
  const c = state.competitors.find((x) => x.id === cue.competitorId);
  return captionOf(fillLine(line, { playerName: c?.name, teamName: c?.name, points: cue.points ?? undefined, roundName: cue.roundNo ? roundInfo(cue.roundNo)?.name : undefined }));
}

export interface AudioPrefs {
  music: boolean;
  voice: boolean;
  sfx: boolean;
}
const PREFS_KEY = "giramente-audio";
export function loadPrefs(): AudioPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<AudioPrefs> | null;
    return { music: v?.music ?? true, voice: v?.voice ?? true, sfx: v?.sfx ?? true };
  } catch {
    return { music: true, voice: true, sfx: true };
  }
}
export function savePrefs(p: AudioPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* archivio del browser non disponibile */
  }
  window.dispatchEvent(new CustomEvent("giramente-audio", { detail: p }));
}
export function useAudioPrefs(): AudioPrefs {
  const [p, setP] = useState<AudioPrefs>({ music: true, voice: true, sfx: true });
  useEffect(() => {
    const t = setTimeout(() => setP(loadPrefs()), 0);
    const on = (e: Event) => setP((e as CustomEvent<AudioPrefs>).detail);
    window.addEventListener("giramente-audio", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("giramente-audio", on);
    };
  }, []);
  return p;
}

/**
 * Collega lo stato della partita all'audio: regia (battute + effetti) e sigla.
 * `voiced`: questo dispositivo è quello che «parla» (TV, dispositivo condiviso, host senza TV).
 */
export function useGiramenteAudio(state: PublicState | null, opts: { voiced: boolean; source: Source }) {
  const prefs = useAudioPrefs();
  const prev = useRef<PublicState | null>(null);
  const voiced = opts.voiced;
  const sourceKey = `${opts.source.roomId ?? ""}|${opts.source.key ?? ""}`;
  const srcRef = useRef(opts.source);
  useEffect(() => {
    srcRef.current = opts.source;
  });

  useEffect(() => {
    const engine = getSoundEngine();
    const unlock = () => void engine.unlock().then((ok) => ok && engine.preloadSfx());
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const v = getGiramenteVoice();
    v.source = srcRef.current;
    v.enabled = voiced && prefs.voice;
    if (v.enabled) v.probe();
  }, [voiced, prefs.voice, sourceKey]);

  useEffect(() => {
    getSoundEngine().setSettings({ sfxVolume: prefs.sfx ? 0.9 : 0 });
  }, [prefs.sfx]);

  useEffect(
    () => () => {
      getGiramenteVoice().stop();
      getSoundEngine().stopTheme(600);
    },
    [],
  );

  // sigla: forte nelle introduzioni e nelle classifiche, quasi muta mentre si gioca
  const phase = state?.phase ?? null;
  const closed = state?.status === "closed";
  useEffect(() => {
    const e = getSoundEngine();
    if (!voiced || !prefs.music || !phase || closed) {
      e.stopTheme(1200);
      return;
    }
    const loud = ["LOBBY", "INTRO", "ROUND_INTRO", "ROUND_RESULTS", "FINAL"].includes(phase);
    const play = () => e.playTheme({ url: THEME, loop: true, volume: loud ? MUSIC_LOUD : MUSIC_QUIET, fadeMs: 1500 });
    if (e.unlocked) play();
    const onTouch = () => void e.unlock().then((ok) => ok && play());
    window.addEventListener("pointerdown", onTouch, { once: true });
    return () => window.removeEventListener("pointerdown", onTouch);
  }, [voiced, prefs.music, phase, closed]);

  // regia: battute ed effetti a ogni nuovo stato
  useEffect(() => {
    if (!state) return;
    const p = prev.current;
    prev.current = state;
    if (p && p.version === state.version) return;
    const d = direct(p, state);
    if (prefs.sfx && p) for (const s of d.sfx) playSfx(s);
    // i sottotitoli compaiono ovunque parli la voce; sugli altri telefoni solo le battute principali
    if (voiced) {
      const v = getGiramenteVoice();
      v.say(
        d.cues.map((c) => {
          const cue = { ...c, line: v.pick(c.line) };
          return { cue, caption: captionFor(cue, state) };
        }),
        d.replace,
      );
    }
  }, [state, voiced, prefs.sfx]);
}

/** Chi sta parlando (per sottotitoli e personaggi). */
export function useSpeech(): SpeechState {
  const [s, setS] = useState<SpeechState>({ who: null, caption: null, audible: false });
  useEffect(() => getGiramenteVoice().onState(setS), []);
  return s;
}
