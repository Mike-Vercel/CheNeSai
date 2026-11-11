"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferenze dello schermo TV (audio, voce, animazioni), salvate su questo dispositivo.
 * Un piccolo store condiviso: le usano il TV (DisplayApp), l'icona impostazioni del TV e il
 * pannello dell'host sull'altro schermo. Tra finestre diverse dello stesso browser (pannello
 * host ↔ finestra del TV) le modifiche arrivano con l'evento "storage".
 */
export interface TvPrefs {
  /** volume generale 0..1 (bus principale del TV e voce del browser) */
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  lowPower: boolean;
  voice: boolean;
  readOptions: boolean;
  /** sigla e musica della serata */
  theme: boolean;
  characters3d: boolean;
  /** Segmento "Spiega le regole" nell'intro. */
  rules: boolean;
  /**
   * Voce del browser quando la voce professionale (ElevenLabs) NON è configurata sul server.
   * Spenta di default: senza voce professionale le battute compaiono come sottotitoli.
   * Con ElevenLabs attivo la voce del browser non si usa mai.
   */
  browserVoice: boolean;
}

export const PREFS_KEY = "qz.tv.prefs";
export const DEFAULT_PREFS: TvPrefs = {
  masterVolume: 1,
  musicVolume: 0.8,
  sfxVolume: 0.9,
  muted: false,
  reducedMotion: false,
  lowPower: false,
  voice: true,
  readOptions: true,
  theme: true,
  characters3d: true,
  rules: true,
  browserVoice: false,
};

function read(): TvPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<TvPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

let current: TvPrefs | null = null;
const listeners = new Set<() => void>();
let storageHooked = false;

export function getTvPrefs(): TvPrefs {
  current ??= read();
  return current;
}

export function setTvPrefs(patch: Partial<TvPrefs>): void {
  current = { ...getTvPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(current));
  } catch {
    /* archiviazione non disponibile: si usano i valori in memoria */
  }
  for (const l of listeners) l();
}

export function subscribeTvPrefs(fn: () => void): () => void {
  listeners.add(fn);
  if (!storageHooked && typeof window !== "undefined") {
    storageHooked = true;
    // modifiche fatte da un'altra finestra (es. pannello host → finestra del TV)
    window.addEventListener("storage", (e) => {
      if (e.key !== PREFS_KEY) return;
      current = read();
      for (const l of listeners) l();
    });
  }
  return () => listeners.delete(fn);
}

export function useTvPrefs(): [TvPrefs, (patch: Partial<TvPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribeTvPrefs, getTvPrefs, () => DEFAULT_PREFS);
  const update = useCallback((patch: Partial<TvPrefs>) => setTvPrefs(patch), []);
  return [prefs, update];
}
