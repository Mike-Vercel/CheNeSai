"use client";

import { useSyncExternalStore } from "react";

/**
 * Cosa può fare il dispositivo per l'Investigatore 3D (slot del narratore e intro di PSYCO).
 *
 *  - `?chars=3d` forza il 3D (diagnostica e screenshot, anche col renderer software), `?chars=2d` lo spegne;
 *  - senza WebGL o col renderer software (SwiftShader, llvmpipe: PC senza scheda video, test automatici)
 *    → illustrazione 2D, mai bloccare;
 *  - `lowPower`: pochi core o poca memoria (o `?low=1`) → file -low, dpr 1, niente ombre.
 */
export interface DeviceCaps {
  webgl: boolean;
  lowPower: boolean;
  reducedMotion: boolean;
}

let cached: DeviceCaps | null = null;

function param(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function probeWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|software|microsoft basic/.test(name);
  } catch {
    return false;
  }
}

export function deviceCaps(): DeviceCaps {
  if (typeof window === "undefined") return { webgl: false, lowPower: false, reducedMotion: false };
  if (cached) return cached;
  const chars = param("chars");
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  const low = param("low");
  cached = {
    webgl: chars === "3d" ? true : chars === "2d" ? false : probeWebgl(),
    lowPower: low === "1" ? true : low === "0" ? false : cores <= 4 || mem <= 3,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  };
  return cached;
}

/** Il 3D si è rotto in questa pagina (WebGL perso, file mancante): da qui in poi solo 2D. */
let broken = false;
const brokenListeners = new Set<() => void>();
export function report3dFailure(reason: string) {
  if (broken) return;
  console.warn(`[psyco] Investigatore 3D → 2D: ${reason}`);
  broken = true;
  for (const l of brokenListeners) l();
}
export function is3dBroken(): boolean {
  return broken;
}

/**
 * Intro 3D a schermo: lo slot del narratore non apre un secondo canvas (uno solo per schermata).
 */
let introActive = false;
const introListeners = new Set<() => void>();
export function setIntroActive(on: boolean) {
  if (introActive === on) return;
  introActive = on;
  for (const l of introListeners) l();
}
export function useIntroActive(): boolean {
  return useSyncExternalStore(
    (fn) => {
      introListeners.add(fn);
      return () => introListeners.delete(fn);
    },
    () => introActive,
    () => false,
  );
}

/** true se in questa pagina il 3D si può usare (falso sul server e al primo render: niente salti di idratazione). */
export function use3dAllowed(): boolean {
  return useSyncExternalStore(
    (fn) => {
      brokenListeners.add(fn);
      return () => brokenListeners.delete(fn);
    },
    () => deviceCaps().webgl && !broken,
    () => false,
  );
}
