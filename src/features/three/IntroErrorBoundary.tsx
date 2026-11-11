"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  onError?: (error: unknown) => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Se la scena 3D lancia un errore (shader, asset, driver) mostra il fallback 2D: l'intro non blocca mai il gioco. */
export class IntroErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[intro] scena 3D non disponibile, uso il fallback 2D", error, info.componentStack);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Verifica rapida del supporto WebGL (crea e rilascia subito un contesto). */
export function detectWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | WebGL2RenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

let weakGpuCache: boolean | null = null;

/**
 * Euristica GPU: integrate (Intel/UHD/Iris), mobile/TV (Mali, Adreno, PowerVR, VideoCore),
 * renderer software (SwiftShader, llvmpipe) → "deboli": niente MSAA.
 */
export function isWeakGpu(): boolean {
  if (weakGpuCache !== null) return weakGpuCache;
  let weak = true;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
      weak = /intel|uhd|iris|mali|adreno|powervr|videocore|swiftshader|llvmpipe|software|microsoft basic/.test(name);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    weak = true;
  }
  weakGpuCache = weak;
  return weak;
}
