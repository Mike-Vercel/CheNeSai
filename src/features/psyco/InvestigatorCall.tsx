"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import type { InvestigatorMessage, PsycoPublicState, PublicTimer } from "@/lib/psyco/types";
import { getAudioPrefs } from "./audio-prefs";
import { CALL_VOICES, getNarrator, VOICE_LINES, type VoiceId } from "./narrator";
import { Silhouette } from "./ui";

/**
 * «CHIAMA L'INVESTIGATORE» – l'aiuto dello PSYCO.
 *
 * Sul dispositivo dello PSYCO (solo lui): pulsante → CHIAMATA IN ARRIVO a tutto schermo (suoneria
 * vintage, vibrazione, RISPONDI / RIFIUTA) → l'Investigatore risponde a voce («…ti ho mandato un
 * messaggio…», con sottotitolo) → arriva un MESSAGGIO con l'indizio, che resta in «📩 Messaggi» per
 * tutta la manche. RIFIUTA (o nessuna risposta) non consuma la chiamata: la consuma solo il server,
 * quando lo PSYCO risponde (`call_investigator`, idempotente con `requestId`).
 * Il timer NON si ferma durante la chiamata: chiamare costa tempo (scelta di gioco, vedi docs/psyco).
 * Il narratore non parla sopra la chiamata (`hold`), la voce dell'Investigatore passa davanti (`sayNow`).
 *
 * Su TV e altri telefoni: solo l'avviso pubblico («📞 Lo PSYCO ha chiamato l'investigatore! (1/2)») con
 * uno squillo breve. L'indizio non passa MAI dallo stato pubblico né dal canale realtime.
 */

// ---------------------------------------------------------------------------
// Suoni (file generati da `npm run psyco:voci -- --genera`; se mancano: sintesi Web Audio)
// ---------------------------------------------------------------------------
const SFX = {
  ring: "/audio/psyco/squillo.mp3",
  ringShort: "/audio/psyco/squillo-breve.mp3",
  notify: "/audio/psyco/notifica.mp3",
  hangup: "/audio/psyco/riattacca.mp3",
} as const;

function sfxOn(): boolean {
  const e = getSoundEngine();
  return getAudioPrefs().sfx && !e.settings.muted && e.unlocked;
}

/** Squillo del vecchio telefono, sintetizzato (doppio «drin» con campanello tremolante). */
function synthRing(at: number, dest: AudioNode, ctx: AudioContext, gain = 0.16) {
  for (const start of [at, at + 0.6]) {
    for (const f of [440, 480, 960]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const trill = ctx.createOscillator();
      const tg = ctx.createGain();
      o.frequency.value = f;
      o.type = f > 900 ? "sine" : "triangle";
      trill.frequency.value = 22;
      tg.gain.value = 0.5;
      trill.connect(tg).connect(g.gain);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime((f > 900 ? 0.35 : 1) * gain, start + 0.02);
      g.gain.setValueAtTime((f > 900 ? 0.35 : 1) * gain, start + 0.42);
      g.gain.linearRampToValueAtTime(0, start + 0.46);
      o.connect(g).connect(dest);
      o.start(start);
      trill.start(start);
      o.stop(start + 0.5);
      trill.stop(start + 0.5);
    }
  }
}

function synthBlips(freqs: number[], step: number, dur: number, gain = 0.12) {
  const e = getSoundEngine();
  const ctx = e.context;
  if (!ctx || !e.sfx) return;
  const t = ctx.currentTime + 0.02;
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * step);
    g.gain.linearRampToValueAtTime(gain, t + i * step + 0.01);
    g.gain.linearRampToValueAtTime(0, t + i * step + dur);
    o.connect(g).connect(e.sfx!);
    o.start(t + i * step);
    o.stop(t + i * step + dur + 0.05);
  });
}

async function playFile(url: string, fallback: () => void, loop = false): Promise<(() => void) | null> {
  const e = getSoundEngine();
  const ctx = e.context;
  if (!ctx || !e.sfx || !sfxOn()) return null;
  const buf = await Promise.race([e.loadBuffer(url), new Promise<null>((r) => setTimeout(() => r(null), 1200))]);
  if (!buf) {
    fallback();
    return null;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  src.connect(e.sfx);
  src.start(ctx.currentTime + 0.01);
  return () => {
    try {
      src.stop();
    } catch {
      /* già fermo */
    }
  };
}

/** Suoneria in loop + vibrazione finché non si risponde o si rifiuta. Ritorna lo «stop». */
export function startRinging(): () => void {
  let stopped = false;
  let stopSound: (() => void) | null = null;
  let synth: ReturnType<typeof setInterval> | null = null;
  const vibrate = () => {
    try {
      navigator.vibrate?.([450, 200, 450, 1300]);
    } catch {
      /* vibrazione non disponibile */
    }
  };
  vibrate();
  const vib = setInterval(vibrate, 2400);
  void playFile(SFX.ring, () => {
    const e = getSoundEngine();
    const ctx = e.context;
    if (!ctx || !e.sfx || stopped) return;
    const ring = () => synthRing(ctx.currentTime + 0.02, e.sfx!, ctx);
    ring();
    synth = setInterval(ring, 2400);
  }, true).then((stop) => {
    if (stopped) stop?.();
    else stopSound = stop;
  });
  return () => {
    stopped = true;
    clearInterval(vib);
    if (synth) clearInterval(synth);
    stopSound?.();
    try {
      navigator.vibrate?.(0);
    } catch {
      /* niente */
    }
  };
}

export function playRingShort() {
  void playFile(SFX.ringShort, () => {
    const e = getSoundEngine();
    if (e.context && e.sfx) synthRing(e.context.currentTime + 0.02, e.sfx, e.context, 0.12);
  });
}
export function playNotify() {
  void playFile(SFX.notify, () => synthBlips([880, 1320], 0.11, 0.09));
  try {
    navigator.vibrate?.([60, 60, 60]);
  } catch {
    /* niente */
  }
}
export function playHangup() {
  void playFile(SFX.hangup, () => synthBlips([425, 425, 425], 0.4, 0.2, 0.08));
}

/**
 * La manche è davvero in gioco (dopo il conto alla rovescia, non in pausa)? Si aggiorna da sola
 * allo scadere del conto alla rovescia (riferimento: l'ora del server).
 */
export function useLive(timer: PublicTimer | null | undefined, now: () => number): boolean {
  const startAt = timer?.startedAt ? Date.parse(timer.startedAt) : null;
  const paused = !!timer?.pausedAt;
  const [, force] = useState(0);
  const wait = startAt === null ? 0 : startAt - now();
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => force((x) => x + 1), wait + 50);
    return () => clearTimeout(t);
  }, [wait]);
  return startAt !== null && !paused && wait <= 0;
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // ripiego (browser molto vecchi): uuid v4 da Math.random
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// Pulsanti
// ---------------------------------------------------------------------------
/** Cornetta del telefono (SVG: uguale su tutti i dispositivi, a differenza delle emoji). */
export function PhoneIcon({ className, down = false }: { className?: string; down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx("inline-block shrink-0", down && "rotate-[135deg]", className)} fill="currentColor" aria-hidden>
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
    </svg>
  );
}

export function CallButton({ max, used, disabled, onCall, className }: { max: number; used: number; disabled?: boolean; onCall: () => void; className?: string }) {
  if (max <= 0) return null;
  const left = Math.max(0, max - used);
  return (
    <button
      type="button"
      className={clsx("psy-btn psy-btn-paper flex w-full max-w-sm flex-col items-center gap-0.5 !py-3 text-2xl", className)}
      disabled={disabled || left === 0}
      onClick={onCall}
      data-testid="psyco-call-button"
    >
      <span className="flex items-center gap-2">
        <PhoneIcon className="h-6 w-6" /> CHIAMA L&apos;INVESTIGATORE
      </span>
      <span className="font-sans text-xs font-black uppercase tracking-widest opacity-75">
        {left === 0 ? "Nessuna chiamata rimasta" : `${left === 1 ? "Ultima chiamata" : `Ne restano ${left}`} su ${max}`}
      </span>
    </button>
  );
}

export function MessagesButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count <= 0) return null;
  return (
    <button type="button" className="psy-chip" onClick={onOpen} aria-label={`Messaggi dell'Investigatore: ${count}`}>
      📩 Messaggi <span className="rounded-full bg-blood px-2 text-xs font-black text-white">{count}</span>
    </button>
  );
}

/** Numero di chiamate (pubblico): «📞 1/2». */
export function CallsChip({ state, className }: { state: PsycoPublicState; className?: string }) {
  const c = state.round?.calls;
  if (!c || c.max <= 0) return null;
  return (
    <span className={clsx("psy-chip gap-1.5", className)} aria-label={`Chiamate all'investigatore: ${c.used} su ${c.max}`} data-testid="psyco-calls-chip">
      <PhoneIcon className="h-[1em] w-[1em] text-lamp" />
      {c.used}/{c.max}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avviso pubblico (TV, altri telefoni): MAI il contenuto
// ---------------------------------------------------------------------------
export function CallNotice({ state, hidden = false, className, sound = true, holdNarrator = false }: { state: PsycoPublicState; hidden?: boolean; className?: string; sound?: boolean; holdNarrator?: boolean }) {
  const ev = state.event?.kind === "investigator_call" ? state.event : null;
  const at = ev?.at ?? null;
  const serverNow = useRef(state.serverNow);
  useEffect(() => {
    serverNow.current = state.serverNow;
  });
  const [visibleFor, setVisibleFor] = useState<string | null>(null);
  useEffect(() => {
    if (!at || hidden || Date.parse(serverNow.current) - Date.parse(at) > 8000) return;
    const show = setTimeout(() => {
      setVisibleFor(at);
      if (sound) playRingShort();
      if (holdNarrator) getNarrator().hold(true);
    }, 0);
    const release = setTimeout(() => holdNarrator && getNarrator().hold(false), 2600);
    const hide = setTimeout(() => setVisibleFor(null), 6500);
    return () => {
      clearTimeout(show);
      clearTimeout(release);
      clearTimeout(hide);
      if (holdNarrator) getNarrator().hold(false);
    };
  }, [at, hidden, sound, holdNarrator]);
  if (!ev || visibleFor !== at || hidden) return null;
  const no = Number(ev.data?.no ?? 0);
  const max = Number(ev.data?.max ?? 0);
  return (
    <div role="status" data-testid="psyco-call-notice" className={clsx("psy-rise flex items-center justify-center gap-3 rounded-2xl bg-blood/25 px-5 py-3 text-center font-black text-[#ffe1e3] ring-2 ring-blood/60", className)}>
      <span aria-hidden className="psy-ring-shake grid h-[1.9em] w-[1.9em] shrink-0 place-items-center rounded-full bg-[#1fae4b] text-white">
        <PhoneIcon className="h-[1.1em] w-[1.1em]" />
      </span>
      <span>
        Lo PSYCO ha chiamato l&apos;investigatore!{max > 0 ? ` (${no}/${max})` : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// La chiamata (sul dispositivo dello PSYCO)
// ---------------------------------------------------------------------------
type Step = "ringing" | "connecting" | "talking" | "typing" | "message" | "error";

/**
 * Chiamata a tutto schermo. `onAnswer(requestId)` consuma la chiamata sul server e restituisce il
 * messaggio nuovo (o lancia un errore leggibile). `active=false` (la manche non è più in gioco)
 * chiude la suoneria come chiamata persa.
 */
export function IncomingCall({
  active,
  forName,
  isLast,
  onAnswer,
  onClose,
}: {
  active: boolean;
  /** dispositivo condiviso: per chi è la chiamata («per MIKE») */
  forName?: string | null;
  /** è l'ultima chiamata disponibile (l'Investigatore lo dice) */
  isLast: boolean;
  onAnswer: (requestId: string) => Promise<InvestigatorMessage>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("ringing");
  const [msg, setMsg] = useState<InvestigatorMessage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceId>(CALL_VOICES[0]);
  const [secs, setSecs] = useState(0);
  const requestId = useRef(newRequestId());
  const stopRing = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // suoneria + vibrazione; il narratore tace per tutta la chiamata
  useEffect(() => {
    alive.current = true;
    getNarrator().hold(true);
    stopRing.current = startRinging();
    const missed = setTimeout(() => {
      stopRing.current?.();
      onCloseRef.current();
    }, 30_000);
    return () => {
      alive.current = false;
      clearTimeout(missed);
      stopRing.current?.();
      getNarrator().hold(false);
    };
  }, []);

  // la manche è finita (o è iniziata la verifica) mentre squillava: chiamata persa, niente consumata
  useEffect(() => {
    if (!active && step === "ringing") {
      stopRing.current?.();
      onCloseRef.current();
    }
  }, [active, step]);

  // durata della chiamata (estetica)
  useEffect(() => {
    if (step !== "talking") return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [step]);

  async function answer() {
    stopRing.current?.();
    setStep("connecting");
    try {
      const m = await onAnswer(requestId.current);
      if (!alive.current) return;
      setMsg(m);
      const v = CALL_VOICES[Math.floor(Math.random() * CALL_VOICES.length)];
      setVoice(v);
      setStep("talking");
      await getNarrator().sayNow(v);
      if (!alive.current) return;
      playHangup();
      setStep("typing");
      await new Promise((r) => setTimeout(r, 1400));
      if (!alive.current) return;
      setStep("message");
      playNotify();
      if (isLast) void getNarrator().sayNow("investigatore-fine");
    } catch (e) {
      if (!alive.current) return;
      setErr(e instanceof Error ? e.message : "La linea è caduta: riprova");
      setStep("error");
    }
  }

  function decline() {
    stopRing.current?.();
    onClose();
  }

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  if (step === "typing" || step === "message") {
    return (
      <div role="dialog" aria-modal="true" aria-label="Messaggio dell'Investigatore" className="psy-call-bg fixed inset-0 z-[80] flex flex-col text-left" data-testid="psyco-call-message">
        <header className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-[#2a2220] ring-2 ring-lamp/50">
            <Silhouette className="h-10 w-10 translate-y-1 [&_path]:fill-[#c9b48a] [&_circle]:fill-[#c9b48a]" />
          </span>
          <span className="flex flex-col">
            <span className="font-black tracking-wide">INVESTIGATORE</span>
            <span className="text-xs font-bold text-paper/60">{step === "typing" ? "sta scrivendo…" : "online"}</span>
          </span>
          {forName && <span className="psy-chip ml-auto !min-h-8 text-xs">per {forName}</span>}
        </header>
        <div className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-6">
          <p className="mx-auto rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-paper/60">Oggi · solo per te</p>
          {step === "typing" ? (
            <div className="psy-bubble self-start" aria-label="sta scrivendo">
              <span className="psy-typing" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : (
            msg && (
              <div className="psy-bubble psy-rise self-start" data-testid="psyco-call-hint">
                <p className="text-[0.7rem] font-black uppercase tracking-widest text-[#8e0b12]">📎 Indizio n. {msg.no}</p>
                <p className="psy-type mt-1 text-lg leading-snug">{msg.text}</p>
                <p className="mt-1 text-right text-[0.7rem] font-bold text-[#4a3220]/70">
                  {new Date(msg.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} ✓✓
                </p>
              </div>
            )
          )}
        </div>
        <footer className="flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          <p className="text-center text-xs font-bold text-paper/60">Lo ritrovi in «📩 Messaggi» fino alla fine della manche. Non farlo vedere a nessuno.</p>
          <button type="button" className="psy-btn w-full max-w-sm text-2xl" disabled={step === "typing"} onClick={onClose}>
            HO LETTO
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={step === "ringing" ? "Chiamata in arrivo dall'Investigatore" : "In chiamata con l'Investigatore"}
      className="psy-call-bg fixed inset-0 z-[80] flex flex-col items-center justify-between px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-center"
      data-testid="psyco-call"
    >
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-paper/70">
          {step === "ringing" ? "Chiamata in arrivo…" : step === "connecting" ? "Connessione…" : step === "error" ? "Linea caduta" : `In chiamata · ${mm}:${ss}`}
        </p>
        {forName && <p className="psy-chip !min-h-8 text-sm">Per {forName}: prendi tu il telefono</p>}
      </div>
      <div className="flex flex-col items-center gap-5">
        <div className={clsx("relative grid h-44 w-44 place-items-center rounded-full bg-gradient-to-b from-[#3a2c24] to-[#120d0b] ring-4 ring-lamp/40", step === "ringing" && "psy-call-rings")}>
          <Silhouette className="h-36 w-36 translate-y-3 [&_path]:fill-[#c9b48a] [&_circle]:fill-[#c9b48a]" />
        </div>
        <div className="w-full">
          <p className="psy-display text-[min(3rem,8.2vw)] leading-none text-paper">INVESTIGATORE</p>
          <p className="psy-type mt-2 text-lg text-paper/70">numero sconosciuto</p>
        </div>
        {step === "talking" && (
          <p aria-live="polite" className="psy-type psy-caption mx-2 max-w-sm rounded-xl px-4 py-3 text-lg text-paper" data-testid="psyco-call-subtitle">
            «{VOICE_LINES[voice]}»
          </p>
        )}
        {step === "error" && (
          <p role="alert" className="max-w-sm rounded-xl bg-blood/25 px-4 py-3 font-bold text-[#ffd8da]">
            {err}
          </p>
        )}
      </div>
      {step === "ringing" ? (
        <div className="grid w-full max-w-sm grid-cols-2 gap-10">
          <button type="button" onClick={decline} className="flex flex-col items-center gap-2 font-black" aria-label="Rifiuta la chiamata">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[#d4202a] text-white shadow-[0_10px_30px_-8px_rgba(212,32,42,0.8)] transition active:scale-95">
              <PhoneIcon className="h-9 w-9" down />
            </span>
            RIFIUTA
          </button>
          <button type="button" onClick={() => void answer()} className="flex flex-col items-center gap-2 font-black" aria-label="Rispondi alla chiamata">
            <span className="psy-answer grid h-20 w-20 place-items-center rounded-full bg-[#1fae4b] text-white shadow-[0_10px_30px_-8px_rgba(31,174,75,0.8)] transition active:scale-95">
              <PhoneIcon className="h-9 w-9" />
            </span>
            RISPONDI
          </button>
        </div>
      ) : step === "error" ? (
        <button type="button" className="psy-btn w-full max-w-sm" onClick={onClose}>
          CHIUDI
        </button>
      ) : (
        <p className="text-sm font-bold text-paper/60">{step === "connecting" ? "Un attimo…" : "Ascolta bene. E non farti vedere."}</p>
      )}
    </div>
  );
}

/** Messaggi dell'Investigatore ricevuti in questa manche (solo sul dispositivo dello PSYCO). */
export function MessagesSheet({ messages, onClose, forName }: { messages: InvestigatorMessage[]; onClose: () => void; forName?: string | null }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Messaggi dell'Investigatore" className="psy-call-bg fixed inset-0 z-[80] flex flex-col text-left" data-testid="psyco-messages">
      <header className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-[#2a2220] ring-2 ring-lamp/50">
          <Silhouette className="h-10 w-10 translate-y-1 [&_path]:fill-[#c9b48a] [&_circle]:fill-[#c9b48a]" />
        </span>
        <span className="font-black tracking-wide">INVESTIGATORE</span>
        {forName && <span className="psy-chip !min-h-8 text-xs">per {forName}</span>}
        <button type="button" className="psy-chip ml-auto" onClick={onClose}>
          Chiudi
        </button>
      </header>
      <ol className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-6">
        {messages.map((m) => (
          <li key={m.no} className="psy-bubble self-start">
            <p className="text-[0.7rem] font-black uppercase tracking-widest text-[#8e0b12]">📎 Indizio n. {m.no}</p>
            <p className="psy-type mt-1 text-lg leading-snug">{m.text}</p>
            <p className="mt-1 text-right text-[0.7rem] font-bold text-[#4a3220]/70">{new Date(m.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Comandi della chiamata sul telefono dello PSYCO (dispositivo personale): pulsante, chiamata,
 * messaggi. `call` consuma la chiamata sul server e ritorna i messaggi aggiornati.
 */
export function PsycoCallControls({
  state,
  messages,
  call,
  disabled,
  now,
}: {
  state: PsycoPublicState;
  messages: InvestigatorMessage[];
  call: (requestId: string) => Promise<InvestigatorMessage[]>;
  disabled?: boolean;
  now: () => number;
}) {
  const [ringing, setRinging] = useState(false);
  const [reading, setReading] = useState(false);
  const r = state.round;
  const live = useLive(r?.timer, now);
  if (!r || r.calls.max <= 0) return null;
  const playing = state.phase === "PLAYING" && live;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <CallButton max={r.calls.max} used={r.calls.used} disabled={disabled || !playing} onCall={() => setRinging(true)} />
      <MessagesButton count={messages.length} onOpen={() => setReading(true)} />
      {ringing && (
        <IncomingCall
          active={state.phase === "PLAYING"}
          isLast={r.calls.used + 1 >= r.calls.max}
          onAnswer={async (id) => {
            const list = await call(id);
            const last = list[list.length - 1];
            if (!last) throw new Error("La linea è caduta: riprova");
            return last;
          }}
          onClose={() => setRinging(false)}
        />
      )}
      {reading && <MessagesSheet messages={messages} onClose={() => setReading(false)} />}
    </div>
  );
}
