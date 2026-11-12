"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useRef, type ReactNode } from "react";
import type { Mesh, Object3D, PerspectiveCamera } from "three";
import { characterUrl } from "./characters";
import { GiramenteCharacterModel } from "./character-model";
import type { GiramenteCharacterProps } from "./types";

/**
 * Canvas trasparente con un personaggio di GIRAMENTE! (DonTrallà o Zafira). Luci dello studio: chiave calda
 * davanti, controluce verde da sinistra e rosso da destra (identità del gioco), riempimento morbido.
 * Disegno "a richiesta": 60 fps quando parla o si muove, 24 fps da fermo.
 */

/** Inquadrature in metri (origine ai piedi): finestra verticale da `bottom` a `top`. */
const FRAMES = {
  // figura intera: un po' d'aria sopra la testa per le braccia alzate (saluto, vittoria)
  full: { bottom: -0.04, top: 2.02, fov: 28, minWidth: 1.15 },
  bust: { bottom: 1.0, top: 1.76, fov: 26, minWidth: 0.85 },
} as const;

function Camera({ framing }: { framing: "full" | "bust" }) {
  const last = useRef("");
  useFrame((state) => {
    const camera = state.camera as PerspectiveCamera;
    const { width, height } = state.size;
    const key = `${framing}:${width}x${height}`;
    if (last.current === key) return;
    last.current = key;
    const f = FRAMES[framing];
    const h = f.top - f.bottom;
    const aspect = Math.max(0.3, width / Math.max(1, height));
    const halfV = Math.tan((f.fov * Math.PI) / 360);
    const dist = Math.max(h / 2 / halfV, f.minWidth / 2 / (halfV * aspect));
    const cy = f.bottom + h / 2;
    camera.fov = f.fov;
    camera.aspect = aspect;
    camera.position.set(0, cy + 0.04, dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  });
  return null;
}

export function Pace({ fpsRef, base }: { fpsRef: React.RefObject<boolean>; base: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let id = 0;
    let last = -Infinity;
    const loop = (t: number) => {
      const fps = fpsRef.current ? 60 : base;
      if (fps > 0 && t - last >= 1000 / fps - 2) {
        last = t;
        invalidate();
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [fpsRef, base, invalidate]);
  return null;
}

export class Boundary3D extends Component<{ onError: (r: string) => void; fallback?: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    this.props.onError(e instanceof Error ? e.message : String(e));
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

/** Luci dello studio di GIRAMENTE! per i personaggi. */
export function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.35} color="#fff1e0" />
      <hemisphereLight args={["#e9f2ff", "#0b0e10", 0.55]} />
      <directionalLight position={[0.8, 2.6, 3]} intensity={2.6} color="#fff4e6" />
      <directionalLight position={[-2.6, 2.2, -1.6]} intensity={1.7} color="#39ff14" />
      <directionalLight position={[2.6, 2.0, -1.6]} intensity={1.9} color="#ff253a" />
      <pointLight position={[0, 1.6, 1.2]} intensity={0.8} distance={3} decay={2} color="#ffe1c0" />
    </>
  );
}

export default function CharacterStage3D({ who, action, speaking, mouthRef, framing, quality, onReady, onFail, className, pointSide, src }: GiramenteCharacterProps) {
  const low = quality !== "high";
  const busy = useRef(false);
  const url = characterUrl(who, quality, undefined, src);
  return (
    <Boundary3D onError={(r) => onFail?.(`errore 3D: ${r}`)}>
      <Canvas
        className={className}
        frameloop="demand"
        dpr={low ? [1, 1.25] : [1, 2]}
        resize={{ offsetSize: true }}
        gl={{ alpha: true, antialias: true, powerPreference: low ? "default" : "high-performance" }}
        camera={{ position: [0, 1.2, 4], fov: 28, near: 0.1, far: 30 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          const el = gl.domElement;
          el.addEventListener("webglcontextlost", () => setTimeout(() => el.isConnected && onFail?.("contesto WebGL perso"), 150), { once: true });
        }}
        style={{ background: "transparent", pointerEvents: "none" }}
      >
        <Camera framing={framing} />
        <StudioLights />
        <Suspense fallback={null}>
          <GiramenteCharacterModel
            who={who}
            url={url}
            action={action}
            speaking={speaking}
            mouthRef={mouthRef}
            pointSide={pointSide}
            busyRef={busy}
            onReady={(m: Object3D) => {
              m.traverse((o) => {
                const mesh = o as Mesh;
                if (mesh.isMesh) mesh.castShadow = false;
              });
              onReady?.();
            }}
          />
        </Suspense>
        <Pace fpsRef={busy} base={24} />
      </Canvas>
    </Boundary3D>
  );
}
