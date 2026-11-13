import type { VisualQuality } from "./types";

/**
 * Qualità visiva di GIRAMENTE! sul dispositivo (da chiamare nel browser, dopo il montaggio).
 *
 *  - `?q=high|low|2d` nell'URL la forza (diagnostica, screenshot, TV problematiche);
 *  - niente WebGL o renderer software (SwiftShader, llvmpipe: PC senza scheda video) → "2d";
 *  - movimento ridotto richiesto dal sistema → "2d" (ruota SVG: stesso giro e stesso risultato, senza luci che corrono);
 *  - dispositivo debole (≤ 4 core, ≤ 3 GB di memoria, oppure `?low=1`) → "low";
 *  - altrimenti "high".
 * Sul server restituisce "2d" (nessun canvas al primo render).
 */
let cached: VisualQuality | null = null;

function param(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/** "hw" = WebGL con scheda video, "sw" = renderer software, "none" = niente WebGL. */
export function probeWebgl(): "hw" | "sw" | "none" {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "none";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|software|microsoft basic/.test(name) ? "sw" : "hw";
  } catch {
    return "none";
  }
}

/** Qualità scelta dal giocatore nel menu IMPOSTAZIONI (questo browser); "auto" = decide il dispositivo. */
export type QualityPref = VisualQuality | "auto";
const PREF_KEY = "giramente-qualita";
export function loadQualityPref(): QualityPref {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === "high" || v === "low" || v === "2d" ? v : "auto";
  } catch {
    return "auto";
  }
}
export function saveQualityPref(p: QualityPref) {
  try {
    if (p === "auto") localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, p);
  } catch {
    /* archivio del browser non disponibile */
  }
}

export function detectVisualQuality(): VisualQuality {
  if (typeof window === "undefined") return "2d";
  const forced = param("q");
  if (forced === "high" || forced === "low" || forced === "2d") return forced;
  const pref = loadQualityPref();
  if (pref !== "auto") return pref;
  if (cached) return cached;
  const gl = probeWebgl();
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const low = param("low");
  const weak = low === "1" ? true : low === "0" ? false : cores <= 4 || mem <= 3;
  cached = gl !== "hw" || reduced ? "2d" : weak ? "low" : "high";
  return cached;
}

/** Movimento ridotto richiesto dal sistema (luci ferme, niente lampeggi). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
