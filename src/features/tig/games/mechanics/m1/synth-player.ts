"use client";

import type { SynthEvent } from "@/lib/tig/games/mechanics/m1/synth";
import { getSoundEngine } from "@/features/media/audio-engine";

/**
 * Riproduce gli eventi sintetici di «Rumore di fondo» con Web Audio, sul bus degli effetti del motore audio
 * della piattaforma (rispetta volume e muto della TV). Nessun file: oscillatori e rumore filtrato.
 */

const WAVES: OscillatorType[] = ["sine", "square", "sawtooth", "triangle"];
const FILTERS: BiquadFilterType[] = ["lowpass", "bandpass", "highpass"];
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseOf(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    // rumore bianco con un generatore semplice e fisso (stesso suono ovunque)
    let s = 0x2545f491;
    for (let i = 0; i < d.length; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      d[i] = ((s >>> 0) / 4294967296) * 2 - 1;
    }
    noiseBuffers.set(ctx, b);
  }
  return b;
}

/** Inviluppo attacco/tenuta/rilascio su un GainNode. */
function envelope(g: GainNode, t0: number, dur: number, peak: number, a: number, r: number) {
  const att = Math.min(a, dur * 0.5);
  const rel = Math.min(r, dur - att);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + att);
  g.gain.setValueAtTime(peak, t0 + dur - rel);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
}

/** Programma gli eventi a partire da `ctx.currentTime + delay`; restituisce lo «stop». */
export function playEvents(ctx: AudioContext, dest: AudioNode, events: readonly SynthEvent[], volume = 0.9, delay = 0.05): () => void {
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(dest);
  const t = ctx.currentTime + delay;
  const sources: AudioScheduledSourceNode[] = [];
  for (const ev of events) {
    if (ev[0] === "t") {
      const [, at, dur, wave, f0, f1, gain, a, r, tremHz, tremDepth] = ev;
      const t0 = t + at;
      const osc = ctx.createOscillator();
      osc.type = WAVES[wave] ?? "sine";
      osc.frequency.setValueAtTime(Math.max(1, f0), t0);
      if (f1 !== f0) osc.frequency.linearRampToValueAtTime(Math.max(1, f1), t0 + dur);
      const env = ctx.createGain();
      envelope(env, t0, dur, gain, a, r);
      osc.connect(env);
      if (tremHz > 0 && tremDepth > 0) {
        const trem = ctx.createGain();
        trem.gain.value = 1 - tremDepth / 2;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = tremHz;
        const depth = ctx.createGain();
        depth.gain.value = tremDepth / 2;
        lfo.connect(depth).connect(trem.gain);
        env.connect(trem).connect(master);
        lfo.start(t0);
        lfo.stop(t0 + dur + 0.05);
        sources.push(lfo);
      } else env.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
      sources.push(osc);
    } else {
      const [, at, dur, filter, f0, f1, q, gain, a, r] = ev;
      const t0 = t + at;
      const src = ctx.createBufferSource();
      src.buffer = noiseOf(ctx);
      src.loop = true;
      const bq = ctx.createBiquadFilter();
      bq.type = FILTERS[filter] ?? "bandpass";
      bq.frequency.setValueAtTime(Math.max(20, f0), t0);
      if (f1 !== f0) bq.frequency.linearRampToValueAtTime(Math.max(20, f1), t0 + dur);
      bq.Q.value = q;
      const env = ctx.createGain();
      envelope(env, t0, dur, gain, a, r);
      src.connect(bq).connect(env).connect(master);
      src.start(t0, (at * 7.31) % 1.5);
      src.stop(t0 + dur + 0.05);
      sources.push(src);
    }
  }
  return () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // già fermo
      }
    }
    try {
      master.disconnect();
    } catch {
      // già scollegato
    }
  };
}

/** Audio pronto? (contesto del motore sbloccato da un gesto) */
export function audioReady(): boolean {
  return getSoundEngine().unlocked;
}

/** Sblocca (da un gesto) e suona; `false` se il browser non lo permette. */
export async function playMix(events: readonly SynthEvent[], volume = 0.9): Promise<(() => void) | null> {
  const engine = getSoundEngine();
  const ok = engine.unlocked || (await engine.unlock());
  const ctx = engine.context;
  if (!ok || !ctx) return null;
  return playEvents(ctx, engine.sfx ?? ctx.destination, events, volume);
}
