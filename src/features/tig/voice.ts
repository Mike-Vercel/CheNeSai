"use client";

import { useEffect, useRef, useState } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { api } from "@/lib/realtime/api-client";
import { fillVoiceText, pickLine } from "@/lib/tig/voices/fill";
import type { VoiceFile } from "@/lib/tig/voices/schema";
import type { TigPublicState } from "@/lib/tig/types";
import type { HostId } from "./arena-contract";
import { directVoice, type TigSfx, type VoiceCue } from "./voice-director";

/**
 * VOCE DELLO SHOW di TAVOLI IN GUERRA!: UNA coda (mai due battute insieme), interrompibile, sottotitoli SEMPRE.
 *
 *  1. evento della serata → categoria (voice-director) → battuta a caso del personaggio, evitando quelle dette di
 *     recente in questa serata (memoria per serata nella scheda), con le variabili sostituite;
 *  2. audio: clip registrato `/audio/tig/voci/<id battuta>.mp3` se c'è; altrimenti sintesi dal server SOLO se la voce
 *     del personaggio è configurata (oggi nessuna); altrimenti solo il sottotitolo;
 *  3. bocca: livello 0..1 dall'analizzatore audio, esposto come ref per l'arena (ArenaHost.mouthRef).
 * Parla un solo dispositivo per sala: la TV. Telefoni e PC dei giocatori restano silenziosi.
 */
export interface SpeechState {
  /** personaggio in scena (null per chi non ha un modello 3D: solo sottotitolo e voce) */
  who: HostId | null;
  characterId: string | null;
  name: string | null;
  caption: string | null;
  audible: boolean;
}

const SILENT: SpeechState = { who: null, characterId: null, name: null, caption: null, audible: false };

/** Personaggio della scena (HostId del contratto 3D) → id del file del catalogo vocale. */
const VOICE_OF: Partial<Record<HostId, string>> = { professore: "professor-smoke", investigatore: "victor", franca: "nonna-franca" };
export const voiceIdOf = (h: HostId) => VOICE_OF[h] ?? h;
const HOST_IDS: HostId[] = ["professore", "regina", "palmino", "investigatore", "don-patrizio", "zafira", "nek", "ciccio", "franca", "piroletto", "minu", "chicca", "bumbaru", "mordicchio", "mammusss", "rumpo"];
export const hostOfVoice = (id: string): HostId | null => HOST_IDS.find((h) => voiceIdOf(h) === id) ?? null;
const RECENT_MAX = 40;

interface QueueItem {
  who: HostId | null;
  characterId: string;
  name: string;
  lineId: string;
  caption: string;
  cue: VoiceCue;
}

class TigVoice {
  private files: VoiceFile[] = [];
  private voices: Record<string, boolean> = {};
  private loading: Promise<void> | null = null;
  private queue: QueueItem[] = [];
  private playing = false;
  private missing = new Set<string>();
  private listeners = new Set<(s: SpeechState) => void>();
  private analyser: AnalyserNode | null = null;
  private generation = 0;
  source: { eventId?: string; key?: string } = {};
  enabled = true;
  readonly mouth: { current: number } = { current: 0 };
  state: SpeechState = SILENT;

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

  load(): Promise<void> {
    if (!this.loading) {
      this.loading = api<{ files: VoiceFile[]; voices: Record<string, boolean> }>("/api/tig/voce", { timeoutMs: 8000 })
        .then((r) => {
          this.files = r.files;
          this.voices = r.voices;
        })
        .catch(() => {
          this.loading = null;
        });
    }
    return this.loading ?? Promise.resolve();
  }

  private recentKey() {
    return `tig-voci-recenti:${this.source.eventId ?? this.source.key ?? "shell"}`;
  }
  private recent(): string[] {
    try {
      return JSON.parse(sessionStorage.getItem(this.recentKey()) ?? "[]") as string[];
    } catch {
      return [];
    }
  }
  private remember(id: string) {
    try {
      const list = [id, ...this.recent().filter((x) => x !== id)].slice(0, RECENT_MAX);
      sessionStorage.setItem(this.recentKey(), JSON.stringify(list));
    } catch {
      /* archivio della scheda non disponibile */
    }
  }

  /** Dalle battute richieste agli elementi della coda (personaggio con battute adatte, niente ripetizioni). */
  private resolve(cue: VoiceCue): QueueItem | null {
    const recent = this.recent();
    const item = (file: VoiceFile, lineId: string, text: string): QueueItem => ({ who: hostOfVoice(file.character.id), characterId: file.character.id, name: file.character.name, lineId, caption: fillVoiceText(text, cue.vars), cue });
    for (const who of cue.hosts) {
      const file = this.files.find((f) => f.character.id === voiceIdOf(who) || f.character.id === who);
      const line = pickLine(file, cue.category, cue.vars, recent);
      if (file && line) return item(file, line.id, line.text);
    }
    // nessuno dei preferiti: chiunque abbia una battuta per la categoria
    for (const file of this.files) {
      const line = pickLine(file, cue.category, cue.vars, recent);
      if (line) return item(file, line.id, line.text);
    }
    return null;
  }

  async say(cues: VoiceCue[], replace = false) {
    if (!cues.length) return;
    await this.load();
    if (cues.some((c) => c.interrupt)) this.interrupt();
    else if (replace) this.queue = [];
    for (const c of cues) {
      const item = this.resolve(c);
      if (!item) continue;
      this.remember(item.lineId);
      this.queue.push(item);
    }
    if (this.queue.length > 4) this.queue = this.queue.slice(-4);
    if (!this.playing) void this.next();
  }

  /** Ferma subito la battuta in corso e svuota la coda (Allarme Caos, pausa, uscita). */
  interrupt() {
    this.queue = [];
    this.generation++;
    try {
      getSoundEngine().stopVoices();
    } catch {
      /* motore non pronto */
    }
    this.mouth.current = 0;
    this.playing = false;
    this.set(SILENT);
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

  private async bufferFor(item: QueueItem): Promise<AudioBuffer | null> {
    if (!this.enabled) return null;
    const engine = getSoundEngine();
    if (!this.missing.has(item.lineId)) {
      const b = await Promise.race([engine.loadBuffer(`/audio/tig/voci/${encodeURIComponent(item.lineId)}.mp3`), new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
      if (b) return b;
      this.missing.add(item.lineId);
    }
    if (!this.voices[item.characterId] || (!this.source.eventId && !this.source.key)) return null;
    try {
      const v = item.cue.vars;
      const r = await api<{ url: string | null }>("/api/tig/voce", {
        method: "POST",
        timeoutMs: 9000,
        json: { ...this.source, characterId: item.characterId, lineId: item.lineId, vars: { tavoloA: v.tavoloA ?? null, tavoloB: v.tavoloB ?? null, mascotA: v.mascotA ?? null, mascotB: v.mascotB ?? null, punti: v.punti ?? null, manche: v.manche ?? null, secondi: v.secondi ?? null, posizione: v.posizione ?? null } },
      });
      return r.url ? await engine.loadBuffer(r.url) : null;
    } catch {
      return null;
    }
  }

  private async next() {
    const gen = this.generation;
    const item = this.queue.shift();
    if (!item) {
      this.playing = false;
      this.mouth.current = 0;
      this.set(SILENT);
      return;
    }
    this.playing = true;
    const minShow = new Promise((r) => setTimeout(r, Math.min(5200, 1400 + item.caption.length * 45)));
    let spoken: Promise<void> | null = null;
    try {
      const buf = await this.bufferFor(item);
      if (gen !== this.generation) return;
      if (buf) spoken = getSoundEngine().playVoiceClip(buf, 1, this.getAnalyser());
    } catch {
      spoken = null;
    }
    this.set({ who: item.who, characterId: item.characterId, name: item.name, caption: item.caption, audible: !!spoken });
    let raf = 0;
    if (spoken && this.analyser) {
      const data = new Uint8Array(this.analyser.fftSize);
      const frame = () => {
        this.analyser!.getByteTimeDomainData(data);
        let sum = 0;
        for (const x of data) sum += ((x - 128) / 128) ** 2;
        this.mouth.current = Math.min(1, Math.sqrt(sum / data.length) * 5);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }
    await Promise.race([Promise.all([spoken ?? Promise.resolve(), minShow]), new Promise((r) => setTimeout(r, 14_000))]);
    cancelAnimationFrame(raf);
    this.mouth.current = 0;
    if (gen !== this.generation) return;
    void this.next();
  }
}

let voice: TigVoice | null = null;
export function getTigVoice(): TigVoice {
  if (!voice) voice = new TigVoice();
  return voice;
}

export function useSpeech(): SpeechState {
  const [s, setS] = useState<SpeechState>(SILENT);
  useEffect(() => getTigVoice().onState(setS), []);
  return s;
}

/** Effetti sintetizzati dal motore audio del sito (nessun file di terzi). */
export function playTigSfx(s: TigSfx) {
  const e = getSoundEngine();
  if (!e.unlocked) return;
  switch (s) {
    case "roundStart":
      return e.play("roundStart");
    case "question":
      return e.play("questionAppear");
    case "reveal":
      return e.play("reveal");
    case "correct":
      return e.play("correct");
    case "wrong":
      return e.play("wrong");
    case "leaderboard":
      return e.play("leaderboard");
    case "alarm":
      e.play("brake");
      return e.play("countdownBeep");
    case "evolve":
      e.play("score");
      return e.play("whoosh");
    case "fanfare":
      return e.play("fanfare");
    case "victory":
      e.play("victory");
      return e.applause("big");
    case "pause":
      return e.play("pause");
    case "join":
      return e.play("join");
    case "shield":
      return e.play("answerLocked");
  }
}

/**
 * Collega lo stato della serata alla voce e agli effetti (solo sul dispositivo «voiced»: la TV).
 * Il primo tocco/tasto sblocca l'audio del browser.
 */
export function useTigShowAudio(state: TigPublicState | null, opts: { voiced: boolean; source: { eventId?: string; key?: string } }) {
  const prev = useRef<TigPublicState | null>(null);
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
    const v = getTigVoice();
    v.source = srcRef.current;
    v.enabled = opts.voiced;
    if (opts.voiced) void v.load();
  }, [opts.voiced]);
  useEffect(() => () => getTigVoice().interrupt(), []);
  useEffect(() => {
    if (!state) return;
    const p = prev.current;
    prev.current = state;
    if (!opts.voiced) return;
    const d = directVoice(p, state);
    for (const s of d.sfx) playTigSfx(s);
    void getTigVoice().say(d.cues, !!p && p.state !== state.state);
  }, [state, opts.voiced]);
}
