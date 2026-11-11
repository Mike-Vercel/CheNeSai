"use client";

import { getSoundEngine } from "@/features/media/audio-engine";
import { getVoice } from "@/features/media/voice";
import { INTRO_SPEECH } from "@/features/game/speech";
import { T, WALK, wheelTick } from "./timeline";
import { CROWD_BEATS } from "./crowd";
import { RULES, RULES_AUDIO_DIR, rulesTime, storyTime, type IntroSchedule } from "./rules";
import type { CueName } from "@/features/media/audio-engine";

/**
 * Effetti sonori agganciati alla timeline (secondi): tic della ruota, whoosh, rullo prima del titolo,
 * colpo sul titolo, tonfo di Palmino, beep del conto alla rovescia (3 · 2 · 1 · VIA: i numeri NON vengono letti).
 */
type Cue = { at: number; cue: CueName };
const STEP = (T.end - T.countdown) / 3;
const CUES: Cue[] = [
  { at: T.wheelIn, cue: "whoosh" },
  { at: T.wheelStop, cue: "correct" },
  { at: T.logoBack + 0.1, cue: "whoosh" },
  { at: T.title - 1.55, cue: "drumroll" },
  { at: T.title, cue: "reveal" },
  // podi in corsa: whoosh in entrata, frenata all'arrivo
  { at: WALK.profFrom, cue: "whoosh" },
  { at: WALK.profTo - 0.15, cue: "brake" },
  { at: WALK.reginaFrom, cue: "whoosh" },
  { at: WALK.reginaTo - 0.15, cue: "brake" },
  { at: T.palminoDrop + 0.3, cue: "palmino" },
  // pubblico: applausi e ovazioni sui momenti forti (stessi istanti dell'animazione del pubblico)
  ...CROWD_BEATS.map((b) => ({ at: b.at, cue: b.cheer ? ("cheer" as const) : ("applause" as const) })),
  { at: T.countdown, cue: "countdownBeep" },
  { at: T.countdown + STEP, cue: "countdownBeep" },
  { at: T.countdown + STEP * 2, cue: "countdownBeep" },
  { at: T.end, cue: "countdownGo" },
];

/**
 * VOCI REGISTRATE (opzionali) in public/audio/intro/ — se un file esiste si usa al posto della
 * voce del browser, con lip-sync reale. Durata IDEALE massima di ciascuna (finestra fino alla battuta dopo):
 *   annunciatore.mp3  "CHEEEEE NE SAAAAAIIII?!"                  ≤ 2.6 s  (da 9.75 s; alle 12.6 entrano i personaggi)
 *   benvenuti.mp3     Professore: "Benvenuti su Che ne sai!"     ≤ 2.0 s  (16.8 → 19.0)
 *   professore.mp3    "Siete pronti a mettervi alla prova?"      ≤ 2.4 s  (19.0 → 21.6)
 *   regina.mp3        "Solo i migliori arriveranno in cima!"     ≤ 2.4 s  (21.6 → 24.2)
 *   palmino.mp3       "E attenti alle sorprese!"                 ≤ 2.4 s  (24.2 → 26.8, poi i beep)
 * Se una clip è più lunga, la battuta successiva aspetta (la coda della voce non sovrappone mai).
 */
const CLIP_DIR = "/audio/intro/";
const clipCache = new Map<string, Promise<boolean>>();

/**
 * Verifica (una sola volta per pagina) se la clip esiste e la scarica in cache, così parte
 * subito quando arriva il suo momento. Niente richieste ripetute ai 404.
 */
function clipAvailable(url: string): Promise<boolean> {
  let p = clipCache.get(url);
  if (!p) {
    p = fetch(url)
      .then(async (r) => {
        const ok = r.ok && (r.headers.get("content-type") ?? "audio").includes("audio");
        if (ok) await r.arrayBuffer(); // scarica tutto: la cache HTTP la serve subito al momento giusto
        return ok;
      })
      .catch(() => false);
    clipCache.set(url, p);
  }
  return p;
}

/**
 * Voci registrate dell'intro e delle regole (public/audio): verificate e scaricate già in lobby,
 * così all'avvio dell'intro si usano sempre le clip registrate (mai la voce generata al volo).
 */
export function preloadIntroClips(): void {
  if (typeof window === "undefined") return;
  for (const l of INTRO_SPEECH) void clipAvailable(`${CLIP_DIR}${l.clip}.mp3`);
  for (const r of RULES) void clipAvailable(`${RULES_AUDIO_DIR}${r.file}`);
}

// ------------------------------------------------------------------ sigla in loop
const THEME_URL = "/audio/theme.mp3";
/** Coda finale quasi silenziosa tagliata e dissolvenza incrociata fra un giro e l'altro (niente click). */
const THEME_TAIL = 0.15;
const THEME_XFADE = 0.25;
let themeBuffer: Promise<AudioBuffer | null> | null = null;

function loadTheme(ctx: AudioContext): Promise<AudioBuffer | null> {
  themeBuffer ??= fetch(THEME_URL)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((b) => ctx.decodeAudioData(b))
    .catch(() => null);
  return themeBuffer;
}

/**
 * Sigla ufficiale (≈70 s) in loop per tutta l'intro (che con le regole dura di più): sorgenti su
 * buffer programmate in anticipo con una breve dissolvenza incrociata a ogni giro. Riparte da
 * `elapsed % durata`, passa dal bus musica (rispetta volume e "ducking" sotto le voci).
 */
/** Volume della sigla nell'intro (1 = pieno): più bassa perché voci e battute si sentano bene. */
const INTRO_MUSIC_LEVEL = 0.6;

class ThemeLooper {
  private out: GainNode;
  private buffer: AudioBuffer | null = null;
  private nextAt = 0;
  private sources: { src: AudioBufferSourceNode; g: GainNode }[] = [];
  private stopped = false;

  constructor(
    private ctx: AudioContext,
    bus: AudioNode,
    private elapsed: () => number,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(bus);
    void loadTheme(ctx).then((buf) => {
      if (this.stopped || !buf) return;
      this.buffer = buf;
      const len = this.loopLen();
      const offset = ((this.elapsed() % len) + len) % len;
      const now = ctx.currentTime + 0.05;
      this.play(now, offset, offset < 0.2 ? 0 : 0.3);
      this.nextAt = now + (len - offset) - THEME_XFADE;
      const t = ctx.currentTime;
      this.out.gain.setValueAtTime(0, t);
      this.out.gain.linearRampToValueAtTime(INTRO_MUSIC_LEVEL, t + 0.3);
    });
  }

  private loopLen() {
    return Math.max(1, (this.buffer?.duration ?? 70) - THEME_TAIL);
  }

  private play(at: number, offset: number, fadeIn: number) {
    const buf = this.buffer;
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    const dur = this.loopLen() - offset;
    g.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, at);
    if (fadeIn > 0) g.gain.linearRampToValueAtTime(1, at + fadeIn);
    // dissolvenza in uscita sovrapposta all'inizio del giro successivo
    g.gain.setValueAtTime(1, at + dur - THEME_XFADE);
    g.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(g).connect(this.out);
    src.start(at, offset);
    src.stop(at + dur + 0.05);
    const item = { src, g };
    this.sources.push(item);
    src.onended = () => {
      this.sources = this.sources.filter((x) => x !== item);
      g.disconnect();
    };
  }

  /** Programma il giro successivo quando manca poco alla fine di quello in corso. */
  tick() {
    if (this.stopped || !this.buffer) return;
    if (this.ctx.currentTime > this.nextAt - 1.5) {
      this.play(this.nextAt, 0, THEME_XFADE);
      this.nextAt += this.loopLen() - THEME_XFADE;
    }
  }

  /**
   * Abbassamento in più (oltre al "ducking" generale del bus musica) mentre parla una voce
   * dell'intro: la sigla resta presente ma non copre le battute registrate.
   */
  private talking = false;
  setTalking(on: boolean) {
    if (this.stopped || !this.buffer || on === this.talking) return;
    this.talking = on;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(INTRO_MUSIC_LEVEL * (on ? 0.65 : 1), t, on ? 0.06 : 0.3);
  }

  stop(fadeMs: number) {
    this.stopped = true;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
    const sources = this.sources;
    setTimeout(() => {
      for (const { src } of sources) {
        try {
          src.stop();
        } catch {
          /* già fermata */
        }
      }
      this.out.disconnect();
    }, fadeMs + 60);
  }
}

/**
 * Audio dell'intro: sigla ufficiale del locale (public/audio/theme.mp3)
 * sincronizzata con la timeline del server + battute parlate dei personaggi.
 * Funziona anche se l'audio viene sbloccato a intro già iniziata (riparte dal
 * punto giusto) e si ferma con una dissolvenza quando l'intro viene smontata.
 */
export function startIntroAudio(getElapsedSeconds: () => number, getSchedule: () => IntroSchedule, opts: { music: boolean; voice: boolean }): () => void {
  const eng = getSoundEngine();
  const voice = getVoice();
  const said = new Set<number>();
  const saidRules = new Set<number>();
  // esito delle verifiche sulle clip (undefined = ancora in corso → voce del browser)
  const clips = new Map<string, boolean>();
  if (opts.voice) {
    for (const l of INTRO_SPEECH) void clipAvailable(`${CLIP_DIR}${l.clip}.mp3`).then((ok) => clips.set(l.clip, ok));
    // le regole: solo riscaldamento della cache (la presenza la decide già la timeline)
    for (const r of RULES) void clipAvailable(`${RULES_AUDIO_DIR}${r.file}`);
  }
  const beeped = new Set<number>();
  let lastTick: number | null = null;
  let looper: ThemeLooper | null = null;

  const startMusic = () => {
    if (looper || !opts.music || !eng.unlocked) return;
    const ctx = eng.context;
    const bus = eng.music;
    if (!ctx || !bus) return;
    // la sigla dell'intro gira in loop su un buffer decodificato (senza buchi): l'eventuale sigla della lobby si spegne
    eng.stopTheme(300);
    looper = new ThemeLooper(ctx, bus, getElapsedSeconds);
  };

  const unsubscribe = eng.subscribe(({ unlocked }) => {
    if (unlocked) startMusic();
  });

  const timer = setInterval(() => {
    if (!eng.unlocked) return;
    startMusic();
    looper?.tick();
    looper?.setTalking(voice.speaking !== null);
    const e = getElapsedSeconds();
    const schedule = getSchedule();
    // tempo di storia: fermo durante le regole, così effetti e battute restano agganciati
    const t = storyTime(e, schedule);
    CUES.forEach((b, i) => {
      if (beeped.has(i)) return;
      if (t >= b.at && t < b.at + 0.5) {
        beeped.add(i);
        eng.play(b.cue);
      } else if (t >= b.at + 0.5) beeped.add(i);
    });
    // "tic" della ruota a ogni spicchio che passa sotto il puntatore (al massimo uno per controllo)
    if (t >= T.spinStart && t < T.wheelStop + 0.3) {
      const tick = wheelTick(t);
      if (lastTick !== null && tick !== lastTick) eng.play("tick");
      lastTick = tick;
    }
    if (!opts.voice) return;
    // regole: battute nel loro orologio (clip registrata se c'è, altrimenti voce del browser)
    const r = rulesTime(e, schedule);
    for (const slot of schedule.rules) {
      if (saidRules.has(slot.index)) continue;
      if (r >= slot.from && r < slot.from + 1.2) {
        saidRules.add(slot.index);
        const rule = RULES[slot.index];
        if (slot.clip) void voice.playClip(rule.who, `${RULES_AUDIO_DIR}${rule.file}`, { who: rule.who, text: rule.text });
        else void voice.say(rule.who, rule.text);
      } else if (r >= slot.from + 1.2 || e >= schedule.rulesRealStart + schedule.rulesTotal) saidRules.add(slot.index);
    }
    INTRO_SPEECH.forEach((line, i) => {
      if (said.has(i)) return;
      if (t >= line.at && t < line.at + 1.2) {
        said.add(i);
        if (clips.get(line.clip)) void voice.playClip(line.clipWho, `${CLIP_DIR}${line.clip}.mp3`, line.line);
        else void voice.say(line.line.who, line.line.text);
      } else if (t >= line.at + 1.2) {
        said.add(i); // battuta già passata (TV ricaricato a metà): non la si recupera
      }
    });
  }, 120);

  return () => {
    clearInterval(timer);
    unsubscribe();
    looper?.stop(700);
    looper = null;
  };
}
