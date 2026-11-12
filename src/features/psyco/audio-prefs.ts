"use client";

/**
 * Preferenze audio di PSYCO su questo dispositivo (localStorage): musica, voce, effetti, volume.
 * `music: null` = automatico (decide il ruolo del dispositivo, vedi audio.tsx).
 */
export interface AudioPrefs {
  music: boolean | null;
  voice: boolean;
  sfx: boolean;
  /** volume generale 0..1 */
  volume: number;
}

const KEY = "psyco.audio";
const DEFAULTS: AudioPrefs = { music: null, voice: true, sfx: true, volume: 0.9 };
const listeners = new Set<(p: AudioPrefs) => void>();
let cache: AudioPrefs | null = null;

export function getAudioPrefs(): AudioPrefs {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<AudioPrefs> | null;
    cache = { ...DEFAULTS, ...(raw ?? {}) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function setAudioPrefs(patch: Partial<AudioPrefs>) {
  cache = { ...getAudioPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* archiviazione non disponibile: vale finché la pagina è aperta */
  }
  for (const l of listeners) l(cache);
}

export function subscribeAudioPrefs(fn: (p: AudioPrefs) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
