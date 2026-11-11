"use client";

import { getSoundEngine } from "@/features/media/audio-engine";

/** 0,1 s di silenzio (WAV 8 kHz, 8 bit): serve solo a "svegliare" l'audio dei telefoni. */
function silentWavUrl(): string | null {
  try {
    const n = 800;
    const b = new Uint8Array(44 + n);
    const v = new DataView(b.buffer);
    const str = (o: number, s: string) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, 36 + n, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true);
    v.setUint32(28, 8000, true);
    v.setUint16(32, 1, true);
    v.setUint16(34, 8, true);
    str(36, "data");
    v.setUint32(40, n, true);
    b.fill(128, 44);
    return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
  } catch {
    return null;
  }
}

/**
 * Da chiamare DENTRO un tocco dell'utente (regola dei browser dei telefoni): sblocca l'audio del
 * sito (Web Audio: sigla ed effetti) e un elemento <audio> di prova (iOS Safari altrimenti può
 * rifiutare le voci dei presentatori, che sono file audio).
 */
export async function unlockMobileAudio(): Promise<boolean> {
  const ok = await getSoundEngine()
    .unlock()
    .catch(() => false);
  const url = silentWavUrl();
  if (url) {
    try {
      const a = new Audio(url);
      a.volume = 0.01;
      await a.play();
    } catch {
      /* non consentito: il primo tocco sullo show riprova */
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }
  return ok;
}

/** Schermo intero dove c'è (Android sì, iPhone no: lì si usa "Aggiungi a Home"). */
export async function enterFullscreen(): Promise<boolean> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    return !!document.fullscreenElement;
  } catch {
    return false;
  }
}

/** Blocca il telefono in verticale quando il browser lo consente (solo a schermo intero, Android). */
export async function lockPortrait(): Promise<void> {
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.("portrait");
  } catch {
    /* non supportato */
  }
}
