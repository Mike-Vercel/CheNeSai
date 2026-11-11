"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Modalità di resa dei personaggi sul TV:
 * - "3d": modelli procedurali animati con lip-sync
 * - "2d": illustrazioni originali (PC poco potenti, WebGL assente, scelta manuale)
 * Fuori dal TV (regia, anteprime, telefoni) il default è sempre "2d".
 */
interface ModeCtx {
  mode: "3d" | "2d";
  lowPower: boolean;
  /** Passaggio al 2D fino al prossimo caricamento della pagina (solo errori veri o PC davvero lento). */
  fallback: (reason?: string) => void;
}

const Ctx = createContext<ModeCtx>({ mode: "2d", lowPower: false, fallback: () => {} });

function softwareRenderer(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|software|microsoft basic/.test(name);
  } catch {
    return true;
  }
}

export function CharacterModeProvider({ prefer3d, lowPower, children }: { prefer3d: boolean; lowPower: boolean; children: ReactNode }) {
  const [forced3d] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("chars") === "3d");
  const [capable] = useState(() => {
    if (typeof window === "undefined") return false;
    // ?chars=3d forza i modelli 3D (diagnostica), ?chars=2d forza le illustrazioni
    const forced = new URLSearchParams(window.location.search).get("chars");
    if (forced === "3d") return true;
    if (forced === "2d") return false;
    // niente più "2D ricordato" fra un caricamento e l'altro: al riavvio del TV si riparte sempre dal 3D
    try {
      sessionStorage.removeItem("qz.chars2d");
    } catch {
      /* ignora */
    }
    return !softwareRenderer();
  });
  const [failed, setFailed] = useState(false);
  const fallback = useCallback((reason?: string) => {
    console.warn(`[che-ne-sai] personaggi 3D → 2D: ${reason ?? "errore"}${forced3d ? " (ignorato: ?chars=3d)" : ""}`);
    if (forced3d) return;
    setFailed(true);
  }, [forced3d]);
  const value = useMemo<ModeCtx>(() => ({ mode: prefer3d && capable && !failed ? "3d" : "2d", lowPower, fallback }), [prefer3d, capable, failed, lowPower, fallback]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCharacterMode(): ModeCtx {
  return useContext(Ctx);
}
