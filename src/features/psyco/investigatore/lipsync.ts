"use client";

import { getNarrator } from "../narrator";

/**
 * Apertura della bocca 0..1 dalla voce del narratore, a ogni frame (stessa formula dei presentatori,
 * src/features/media/voice.ts → mouthOpen): RMS dell'AnalyserNode della voce, con soglia e guadagno.
 * Il modello (glb-host) ne ricava inviluppo, sillabe e vocali (jawOpen / mouthO / mouthE).
 * Clip mancante o audio bloccato: sillabe finte finché il sottotitolo è a schermo.
 */
export function createNarratorMouth() {
  let data: Uint8Array<ArrayBuffer> | null = null;
  let phase = 0;
  return function mouthOpen(dt: number): number {
    const n = getNarrator();
    const st = n.state;
    if (!st.speaking) return 0;
    const an = st.audible ? n.getAnalyser() : null;
    if (an) {
      if (!data || data.length !== an.fftSize) data = new Uint8Array(an.fftSize);
      an.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      return levelToMouth(Math.sqrt(sum / data.length));
    }
    phase += dt * 11.5;
    return 0.2 + 0.6 * Math.max(0, Math.sin(phase) * Math.sin(phase * 0.37 + 1.3));
  };
}

/** RMS della voce (0..1) → apertura della bocca 0..1 (pura, testata). */
export function levelToMouth(rms: number): number {
  return Math.min(1, Math.max(0, (rms - 0.015) * 7));
}
