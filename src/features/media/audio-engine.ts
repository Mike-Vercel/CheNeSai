"use client";

/**
 * Motore audio di CHE NE SAI?!.
 * Quasi tutti i suoni sono ORIGINALI: sintetizzati in tempo reale con Web Audio
 * (oscillatori, rumore filtrato, inviluppi), compreso il "tic-tac" dell'orologio.
 * Applausi e rullo di tamburi usano tre campioni generati per il progetto con ElevenLabs
 * Sound Effects (public/audio/sfx, vedi LEGGIMI.md lì): se non si caricano si torna alla sintesi.
 * Tutto passa da Web Audio (anche la sigla, decodificata in un buffer): sui telefoni, dopo il
 * tocco che sblocca l'audio, niente viene più bloccato dal browser.
 *
 * Il suono "ufficiale" esce dal TV/impianto del pub. Gli smartphone non
 * usano questo motore (salvo feedback tattile), per non creare confusione.
 */

export type CueName =
  | "tick"
  | "tickFinal"
  | "questionAppear"
  | "optionsAppear"
  | "answerLocked"
  | "reveal"
  | "correct"
  | "wrong"
  | "score"
  | "leaderboard"
  | "palmino"
  | "drumroll"
  | "fanfare"
  | "whoosh"
  | "vote"
  | "voteResult"
  | "countdownBeep"
  | "countdownGo"
  | "join"
  | "pause"
  | "roundStart"
  | "victory"
  | "applause"
  | "brake"
  | "cheer"
  | "wheelTick";

export interface AudioSettings {
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  /** volume generale del TV (bus principale: musica, effetti e voci registrate) 0..1 */
  masterVolume?: number;
}

type Listener = (s: { unlocked: boolean; settings: AudioSettings }) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private listeners = new Set<Listener>();
  /** sigla: sorgente su buffer decodificato (niente elemento <audio>: sui telefoni verrebbe bloccato) */
  private themeSrc: AudioBufferSourceNode | null = null;
  private themeGain: GainNode | null = null;
  /** richiesta di sigla in corso (il buffer si carica una volta; uno stop nel frattempo la annulla) */
  private themeWant = 0;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** orologio delle risposte: suoni già programmati (si fermano subito alla chiusura) */
  private clockNodes: AudioScheduledSourceNode[] = [];
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  /** bus del "tic-tac": si abbassa un po' quando parla un personaggio */
  private clockGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  /** Bus del pubblico (applausi/ovazioni): si abbassa anche lui quando parla un personaggio. */
  private crowdGain: GainNode | null = null;
  private themeFade: ReturnType<typeof setTimeout> | null = null;
  private themeUrl: string | null = null;
  settings: AudioSettings = { musicVolume: 0.7, sfxVolume: 0.9, muted: false };

  get unlocked(): boolean {
    return this.ctx?.state === "running";
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Bus musica: la colonna sonora dell'intro si collega qui. */
  get music(): GainNode | null {
    return this.musicBus;
  }

  get sfx(): GainNode | null {
    return this.sfxBus;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn({ unlocked: this.unlocked, settings: this.settings });
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const l of this.listeners) l({ unlocked: this.unlocked, settings: this.settings });
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor({ latencyHint: "interactive" });
    const master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    // la musica passa da un "duck" che si abbassa quando parla un personaggio
    const duck = ctx.createGain();
    music.connect(duck).connect(master);
    this.duckGain = duck;
    sfx.connect(master);
    const crowd = ctx.createGain();
    crowd.connect(sfx);
    this.crowdGain = crowd;
    const clock = ctx.createGain();
    clock.connect(sfx);
    this.clockGain = clock;
    this.ctx = ctx;
    this.master = master;
    this.musicBus = music;
    this.sfxBus = sfx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.applySettings();
    ctx.addEventListener("statechange", () => this.emit());
    return ctx;
  }

  /** Va chiamato da un gesto dell'operatore (click) per sbloccare l'audio. */
  async unlock(): Promise<boolean> {
    const ctx = this.ensure();
    if (!ctx) return false;
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      return false;
    }
    this.emit();
    return ctx.state === "running";
  }

  setSettings(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch };
    this.applySettings();
    this.emit();
  }

  private applySettings() {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : (this.settings.masterVolume ?? 1), t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.settings.musicVolume, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfxVolume, t, 0.05);
  }

  // ------------------------------------------------------------------ sintesi
  private tone(
    freq: number,
    start: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; slideTo?: number; attack?: number; dest?: AudioNode; detune?: number } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, start);
    if (opts.detune) osc.detune.value = opts.detune;
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + dur);
    const peak = opts.gain ?? 0.3;
    const a = opts.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + a);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(opts.dest ?? this.sfxBus!);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private noiseBurst(start: number, dur: number, opts: { freq?: number; q?: number; gain?: number; type?: BiquadFilterType; sweepTo?: number; dest?: AudioNode } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? "bandpass";
    f.frequency.setValueAtTime(opts.freq ?? 1200, start);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, start + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(opts.dest ?? this.sfxBus!);
    src.start(start, Math.random());
    src.stop(start + dur + 0.05);
  }

  private chord(freqs: number[], start: number, dur: number, type: OscillatorType = "triangle", gain = 0.12) {
    for (const f of freqs) this.tone(f, start, dur, { type, gain, attack: 0.02 });
  }

  // ------------------------------------------------------------- campioni
  /** Decodifica (una volta sola) un file audio del sito in un buffer Web Audio; null se non disponibile. */
  loadBuffer(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ensure();
    if (!ctx) return Promise.resolve(null);
    let p = this.buffers.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.buffers.set(url, p);
    }
    return p;
  }

  /** Precarica i campioni degli effetti (applausi, rullo): al momento giusto partono subito. */
  preloadSfx() {
    for (const url of Object.values(SFX_FILES)) void this.loadBuffer(url).then((b) => b && this.ready.set(url, b));
  }

  /** Suona un campione già decodificato (false = non pronto: chi chiama usa la sintesi). */
  private playSample(url: string, opts: { gain?: number; dest?: AudioNode; at?: number } = {}): AudioBufferSourceNode | null {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.settings.muted) return null;
    const ready = this.ready.get(url);
    if (!ready) {
      void this.loadBuffer(url).then((b) => b && this.ready.set(url, b));
      return null;
    }
    const src = ctx.createBufferSource();
    src.buffer = ready;
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    src.connect(g).connect(opts.dest ?? this.sfxBus!);
    src.start(opts.at ?? ctx.currentTime + 0.01);
    return src;
  }
  private ready = new Map<string, AudioBuffer>();

  /**
   * Applauso del pubblico: "light" (un battimani breve), "medium", "big" (ovazione del vincitore).
   * Passa dal bus del pubblico: si abbassa da solo quando parla un personaggio.
   */
  applause(size: "tiny" | "light" | "medium" | "big") {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== "running" || this.settings.muted) return;
    const url = size === "big" ? SFX_FILES.applauseBig : SFX_FILES.applauseLight;
    const gain = size === "tiny" ? 0.2 : size === "light" ? 0.45 : size === "medium" ? 0.8 : 1;
    if (this.playSample(url, { gain, dest: this.crowdGain ?? undefined })) return;
    // campione non ancora pronto: applauso sintetico
    const t = ctx.currentTime + 0.01;
    if (size === "big") {
      this.crowdCheer(t, 2.2);
      this.applause_(t, 3.2, 1.2);
    } else this.applause_(t, size === "medium" ? 2.6 : 1.8, size === "tiny" ? 0.3 : size === "light" ? 0.6 : 1);
  }

  /** Rullo di tamburi lungo circa `seconds` (campione con colpo finale, altrimenti sintesi ripetuta). */
  drumroll(seconds = 3.5) {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== "running" || this.settings.muted) return;
    if (this.playSample(SFX_FILES.drumroll, { gain: 0.9 })) return;
    const reps = Math.max(1, Math.round(seconds / 1.55));
    for (let i = 0; i < reps; i++) setTimeout(() => this.play("drumroll"), i * 1550);
  }

  // ------------------------------------------------------------- orologio delle risposte
  /**
   * "Tic-tac" dell'orologio mentre si risponde: un colpo al secondo (tic e tac alternati), discreto;
   * negli ultimi 5 secondi due colpi al secondo, più forti. `startsInMs`/`endsInMs`: apertura e
   * chiusura delle risposte da adesso. I colpi sono programmati sull'orologio audio (precisi) e
   * si fermano SUBITO con stopClock (tutti hanno risposto, tempo scaduto, pausa).
   */
  startClock(startsInMs: number, endsInMs: number) {
    this.stopClock();
    const ctx = this.ensure();
    if (!ctx || !this.clockGain || endsInMs <= 0) return;
    const t0 = ctx.currentTime;
    const startAt = t0 + Math.max(0, startsInMs) / 1000;
    const endAt = t0 + endsInMs / 1000;
    let k = 0;
    // colpi allineati alla chiusura: a -n secondi (e a -n,5 negli ultimi 5)
    const beatAt = (i: number) => endAt - (i <= 10 ? i * 0.5 : 5 + (i - 10));
    // dal colpo più lontano ancora valido
    let i = 10 + Math.ceil(Math.max(0, endAt - startAt - 5));
    const pump = () => {
      if (!this.ctx) return;
      const horizon = this.ctx.currentTime + 0.25;
      while (i >= 1) {
        const at = beatAt(i);
        if (at < startAt - 0.001 || at < this.ctx.currentTime) {
          i--;
          continue;
        }
        if (at > horizon) break;
        this.clockBeat(at, k++ % 2 === 0, i <= 10);
        i--;
      }
      if (i < 1) this.stopClockTimer();
    };
    pump();
    this.clockTimer = setInterval(pump, 80);
  }

  private clockBeat(at: number, tick: boolean, hurry: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.clockGain || !this.noise || this.settings.muted) return;
    const vol = hurry ? 0.16 : 0.08;
    // legnetto: tono breve e smorzato + clic di rumore filtrato
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(tick ? 2100 : 1500, at);
    osc.frequency.exponentialRampToValueAtTime(tick ? 1700 : 1150, at + 0.05);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    osc.connect(g).connect(this.clockGain);
    osc.start(at);
    osc.stop(at + 0.09);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = tick ? 3800 : 2600;
    f.Q.value = 2.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, at);
    ng.gain.exponentialRampToValueAtTime(vol * 0.9, at + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.025);
    src.connect(f).connect(ng).connect(this.clockGain);
    src.start(at, Math.random());
    src.stop(at + 0.04);
    this.clockNodes.push(osc, src);
    if (this.clockNodes.length > 40) this.clockNodes.splice(0, this.clockNodes.length - 40);
  }

  private stopClockTimer() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }

  /** Ferma subito il "tic-tac" (anche i colpi già programmati). */
  stopClock() {
    this.stopClockTimer();
    for (const n of this.clockNodes.splice(0)) {
      try {
        n.stop();
      } catch {
        /* già fermato */
      }
    }
  }

  get clockRunning(): boolean {
    return this.clockTimer !== null;
  }

  // ------------------------------------------------------------- colonna sonora
  /**
   * Sigla della serata (file audio fornito dal locale, `public/audio/theme.mp3`), decodificata in
   * un buffer Web Audio: sui telefoni parte anche senza un nuovo tocco (basta l'audio sbloccato).
   * Passa per il bus musica, quindi rispetta volume/muto e il "ducking" della voce.
   * `from`: riparte da quel secondo (es. 0 al podio); senza, se sta già suonando continua.
   * `url`: un'altra colonna sonora al posto della sigla del quiz (es. il tema di PSYCO).
   */
  playTheme(opts: { from?: number; loop?: boolean; volume?: number; fadeMs?: number; url?: string } = {}) {
    const url = opts.url ?? THEME_URL;
    const ctx = this.ensure();
    if (!ctx || !this.musicBus) return;
    if (!this.themeGain) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.musicBus);
      this.themeGain = g;
    }
    const g = this.themeGain;
    const want = ++this.themeWant;
    if (this.themeFade) clearTimeout(this.themeFade);
    this.themeFade = null;
    const target = opts.volume ?? 1;
    const fade = (opts.fadeMs ?? 800) / 1000;
    const ramp = () => {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(target, t + fade);
    };
    if (this.themeSrc && opts.from === undefined && this.themeUrl === url) {
      this.themeSrc.loop = opts.loop ?? false;
      ramp();
      return;
    }
    void this.loadBuffer(url).then((buf) => {
      if (!buf || want !== this.themeWant || !this.ctx) return;
      this.stopThemeSource();
      this.themeUrl = url;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = opts.loop ?? false;
      src.connect(g);
      src.onended = () => {
        if (this.themeSrc === src) this.themeSrc = null;
      };
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(0, ctx.currentTime);
      src.start(ctx.currentTime + 0.02, Math.max(0, Math.min(opts.from ?? 0, buf.duration - 0.1)));
      this.themeSrc = src;
      ramp();
    });
  }

  private stopThemeSource() {
    const src = this.themeSrc;
    this.themeSrc = null;
    if (!src) return;
    try {
      src.stop();
    } catch {
      /* già ferma */
    }
  }

  stopTheme(fadeMs = 1200) {
    this.themeWant++;
    const ctx = this.ctx;
    const g = this.themeGain;
    if (!ctx || !g || !this.themeSrc) return;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
    if (this.themeFade) clearTimeout(this.themeFade);
    const want = this.themeWant;
    this.themeFade = setTimeout(() => {
      if (want === this.themeWant) this.stopThemeSource();
    }, fadeMs + 50);
  }

  /**
   * Silenzio totale quando si esce dal gioco (tasto Esci, indietro, link verso il sito): ferma
   * subito sigla e tic-tac e mette in pausa il motore audio, così nulla continua a suonare sulle
   * pagine normali. Rientrando in partita il primo tocco (o lo sblocco già previsto) lo riattiva.
   */
  silenceAll() {
    this.themeWant++;
    if (this.themeFade) clearTimeout(this.themeFade);
    this.themeFade = null;
    this.stopThemeSource();
    this.stopClock();
    const ctx = this.ctx;
    if (ctx && ctx.state === "running") {
      void ctx
        .suspend()
        .catch(() => undefined)
        .finally(() => this.emit());
    }
  }

  get themePlaying(): boolean {
    return this.themeSrc !== null && this.themeWant > 0;
  }

  /**
   * Clip vocale già decodificato (es. il narratore di PSYCO): passa dal bus principale (rispetta muto
   * e volume generale), abbassa musica ed effetti mentre parla. Risolve a fine clip;
   * null = non riprodotto (audio bloccato o muto: chi chiama mostra solo il sottotitolo).
   */
  playVoiceClip(buffer: AudioBuffer, gain = 1): Promise<void> | null {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.settings.muted || !this.master) return null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    this.duck(true);
    return new Promise((resolve) => {
      src.onended = () => {
        this.duck(false);
        resolve();
      };
      src.start(ctx.currentTime + 0.02);
    });
  }

  /** Abbassa la musica mentre parla un personaggio. */
  duck(on: boolean) {
    if (!this.ctx || !this.duckGain) return;
    const t = this.ctx.currentTime;
    this.duckGain.gain.setTargetAtTime(on ? 0.28 : 1, t, on ? 0.08 : 0.35);
    this.crowdGain?.gain.setTargetAtTime(on ? 0.3 : 1, t, on ? 0.08 : 0.35);
    this.clockGain?.gain.setTargetAtTime(on ? 0.55 : 1, t, on ? 0.08 : 0.35);
  }

  /**
   * Applauso sintetico: centinaia di "battiti di mani" (rumore filtrato cortissimo, frequenze e
   * volumi casuali) con un inviluppo che cresce e poi si spegne. Nessun file esterno.
   */
  private applause_(t: number, dur: number, intensity: number) {
    if (!this.crowdGain) return;
    const grains = Math.round(dur * 70 * intensity);
    for (let i = 0; i < grains; i++) {
      // densità maggiore all'inizio, poi coda che si dirada
      const u = Math.random();
      const at = t + dur * Math.pow(u, 1.6);
      const env = Math.min(1, (at - t) / 0.25) * (1 - Math.pow((at - t) / dur, 2));
      this.noiseBurst(at, 0.025 + Math.random() * 0.035, {
        freq: 900 + Math.random() * 2200,
        q: 0.9 + Math.random() * 1.2,
        gain: (0.025 + Math.random() * 0.05) * Math.max(0.15, env) * intensity,
        dest: this.crowdGain,
      });
    }
  }

  /** Ovazione del pubblico ("uoooh!"): rumore con due formanti che si gonfia e cala. */
  private crowdCheer(t: number, dur: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.crowdGain) return;
    for (const [f, q, peak] of [
      [650, 4, 0.12],
      [1150, 5, 0.08],
    ] as const) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(f * 0.85, t);
      bp.frequency.linearRampToValueAtTime(f * 1.12, t + dur * 0.4);
      bp.frequency.linearRampToValueAtTime(f, t + dur);
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp).connect(g).connect(this.crowdGain);
      src.start(t, Math.random());
      src.stop(t + dur + 0.05);
    }
  }

  play(cue: CueName) {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== "running" || this.settings.muted) return;
    const t = ctx.currentTime + 0.01;
    switch (cue) {
      case "tick":
        this.tone(1250, t, 0.06, { type: "square", gain: 0.06 });
        break;
      case "tickFinal":
        this.tone(1650, t, 0.09, { type: "square", gain: 0.1 });
        break;
      case "countdownBeep":
        this.tone(660, t, 0.25, { type: "triangle", gain: 0.3 });
        break;
      case "countdownGo":
        this.chord([523.25, 659.25, 783.99, 1046.5], t, 0.7, "sawtooth", 0.08);
        this.noiseBurst(t, 0.5, { freq: 3000, type: "highpass", gain: 0.12 });
        break;
      case "questionAppear":
        this.noiseBurst(t, 0.35, { freq: 400, sweepTo: 5000, q: 2, gain: 0.18 });
        this.tone(392, t + 0.18, 0.25, { type: "triangle", gain: 0.2 });
        this.tone(587.33, t + 0.3, 0.4, { type: "triangle", gain: 0.2 });
        break;
      case "optionsAppear":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.08, 0.22, { type: "square", gain: 0.07 }));
        break;
      case "answerLocked":
        this.tone(880, t, 0.08, { type: "square", gain: 0.12 });
        this.tone(440, t + 0.07, 0.25, { type: "square", gain: 0.12 });
        this.noiseBurst(t, 0.12, { freq: 200, type: "lowpass", gain: 0.3 });
        break;
      case "drumroll": {
        for (let i = 0; i < 28; i++) this.noiseBurst(t + i * 0.055, 0.06, { freq: 900 + i * 20, q: 0.7, gain: 0.08 + i * 0.006 });
        break;
      }
      case "reveal":
        this.noiseBurst(t, 0.6, { freq: 6000, type: "highpass", gain: 0.15 });
        this.chord([392, 493.88, 587.33], t, 0.9, "triangle", 0.12);
        this.tone(783.99, t + 0.12, 0.8, { type: "sine", gain: 0.2 });
        break;
      case "correct":
        [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, t + i * 0.07, 0.35, { type: "triangle", gain: 0.18 }));
        break;
      case "wrong":
        this.tone(220, t, 0.35, { type: "sawtooth", gain: 0.12, slideTo: 140 });
        this.tone(207.65, t + 0.18, 0.45, { type: "sawtooth", gain: 0.1, slideTo: 110 });
        break;
      case "score":
        for (let i = 0; i < 10; i++) this.tone(900 + i * 90, t + i * 0.045, 0.08, { type: "square", gain: 0.05 });
        this.chord([783.99, 987.77, 1174.66], t + 0.5, 0.5, "triangle", 0.1);
        break;
      case "leaderboard":
        this.chord([261.63, 329.63, 392], t, 0.45, "sawtooth", 0.06);
        this.chord([293.66, 369.99, 440], t + 0.45, 0.45, "sawtooth", 0.06);
        this.chord([329.63, 415.3, 493.88, 659.25], t + 0.9, 1.1, "sawtooth", 0.07);
        break;
      case "palmino": {
        // "boing" tropicale + marimba
        this.tone(180, t, 0.5, { type: "sine", gain: 0.35, slideTo: 720 });
        [1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => this.tone(f, t + 0.35 + i * 0.09, 0.25, { type: "sine", gain: 0.16 }));
        this.noiseBurst(t + 0.3, 0.8, { freq: 7000, type: "highpass", gain: 0.1 });
        break;
      }
      case "fanfare":
        [
          [392, 0],
          [523.25, 0.15],
          [659.25, 0.3],
          [783.99, 0.45],
          [659.25, 0.75],
          [783.99, 0.9],
        ].forEach(([f, d]) => this.tone(f, t + d, 0.35, { type: "sawtooth", gain: 0.09 }));
        this.chord([523.25, 659.25, 783.99, 1046.5], t + 1.05, 1.4, "sawtooth", 0.07);
        break;
      case "brake":
        // frenata del podio: fruscio che scende + tonfo
        this.noiseBurst(t, 0.32, { freq: 2600, sweepTo: 350, q: 2.2, gain: 0.22 });
        this.tone(95, t + 0.04, 0.28, { type: "sine", gain: 0.32, slideTo: 55 });
        break;
      case "wheelTick":
        // "clac" della linguetta della ruota: brevissimo, legnoso
        this.tone(1900, t, 0.022, { type: "triangle", gain: 0.11, slideTo: 1100 });
        this.noiseBurst(t, 0.025, { freq: 2500, q: 1.2, gain: 0.07 });
        break;
      case "applause":
        this.applause_(t, 2.6, 1);
        break;
      case "cheer":
        this.crowdCheer(t, 2.2);
        this.applause_(t, 3.2, 1.2);
        break;
      case "victory":
        this.play("fanfare");
        for (let i = 0; i < 12; i++) this.noiseBurst(t + 1.1 + i * 0.12, 0.25, { freq: 4000 + Math.random() * 3000, type: "highpass", gain: 0.06 });
        break;
      case "whoosh":
        this.noiseBurst(t, 0.45, { freq: 300, sweepTo: 4000, q: 1.5, gain: 0.25 });
        break;
      case "vote":
        this.tone(700, t, 0.08, { type: "sine", gain: 0.12 });
        break;
      case "voteResult":
        this.play("drumroll");
        this.chord([440, 554.37, 659.25], t + 1.6, 0.9, "triangle", 0.14);
        break;
      case "join":
        this.tone(988, t, 0.09, { type: "sine", gain: 0.1 });
        this.tone(1318.5, t + 0.08, 0.14, { type: "sine", gain: 0.1 });
        break;
      case "pause":
        this.tone(440, t, 0.3, { type: "triangle", gain: 0.15, slideTo: 330 });
        break;
      case "roundStart":
        this.play("whoosh");
        this.chord([392, 523.25, 659.25], t + 0.25, 0.8, "sawtooth", 0.07);
        break;
    }
  }
}

const THEME_URL = "/audio/theme.mp3";
/** Campioni degli effetti (generati per il progetto, vedi public/audio/sfx/LEGGIMI.md). */
const SFX_FILES = {
  applauseLight: "/audio/sfx/applause-light.mp3",
  applauseBig: "/audio/sfx/applause-big.mp3",
  drumroll: "/audio/sfx/drumroll.mp3",
} as const;

let engine: SoundEngine | null = null;
export function getSoundEngine(): SoundEngine {
  if (!engine) engine = new SoundEngine();
  return engine;
}
export type { SoundEngine };
