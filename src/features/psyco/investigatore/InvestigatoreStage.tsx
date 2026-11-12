"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Mesh, Object3D, PerspectiveCamera } from "three";
import { HostGlbModel, type HostGlbProps } from "@/features/three/characters/glb-host";
import { getNarrator } from "../narrator";
import { createNarratorMouth } from "./lipsync";

/**
 * L'Investigatore 3D a mezzo busto che parla con la voce del narratore (slot delle schermate PSYCO).
 * Un canvas trasparente sopra la cornice del ritratto (NarratorSlot). Prestazioni da telefono:
 *  - disegno "a richiesta": ~24 fps quando tace, ~50 quando parla, fermo se il ritratto non si vede;
 *  - dpr massimo 1.5 (1 su lowPower, che usa anche il file -low), niente ombre né antialias su lowPower.
 * Luci noir: lampada calda davanti in alto a sinistra, controluce rosso da dietro, riempimento quasi nero.
 */
export type StageFraming = "bust" | "face";

/** Inquadrature in metri (origine ai piedi, faccia verso +Z): finestra verticale da `bottom` a `top`. */
const FRAMES: Record<StageFraming, { bottom: number; top: number; fov: number; minWidth: number }> = {
  // dal petto (risvolti del cappotto e cravatta) alla tesa del cappello, con un filo d'aria sopra
  bust: { bottom: 1.02, top: 1.8, fov: 26, minWidth: 0.62 },
  face: { bottom: 1.3, top: 1.74, fov: 24, minWidth: 0.42 },
};

function Camera({ framing }: { framing: StageFraming }) {
  const last = useRef("");
  useFrame((state) => {
    const camera = state.camera as PerspectiveCamera;
    const size = state.size;
    const key = `${framing}:${size.width}x${size.height}`;
    if (last.current === key) return;
    last.current = key;
    const f = FRAMES[framing];
    const h = f.top - f.bottom;
    // in un riquadro più largo che alto serve meno distanza; in uno stretto si allarga per non tagliare le spalle
    const aspect = Math.max(0.3, size.width / Math.max(1, size.height));
    const minWidth = f.minWidth;
    const halfV = Math.tan((f.fov * Math.PI) / 360);
    const dist = Math.max(h / 2 / halfV, minWidth / 2 / (halfV * aspect));
    const cy = f.bottom + h / 2;
    camera.fov = f.fov;
    camera.position.set(0, cy + 0.03, dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  });
  return null;
}

/** Ridisegna a `fps` fotogrammi al secondo (0 = fermo). */
function Pace({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (fps <= 0) return;
    let id = 0;
    let last = -Infinity;
    const step = 1000 / fps;
    const loop = (t: number) => {
      if (t - last >= step - 2) {
        last = t;
        invalidate();
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [fps, invalidate]);
  return null;
}

type Face = HostGlbProps["faceOverride"];

function Narrator3D({ lowPower, src, onReady, speakingOverride, faceOverride }: { lowPower: boolean; src?: string; onReady: () => void; speakingOverride?: boolean; faceOverride?: Face }) {
  const mouth = useRef(0);
  const mouthFn = useMemo(() => createNarratorMouth(), []);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => getNarrator().onState((s) => setSpeaking(s.speaking)), []);
  useFrame((_, dt) => {
    mouth.current = mouthFn(Math.min(0.1, dt));
  });
  const talk = speakingOverride ?? speaking;
  return (
    <HostGlbModel
      who="investigatore"
      src={src}
      fullBody
      lowPower={lowPower}
      animation={talk ? "talk" : "idle"}
      mouthRef={mouth}
      faceOverride={faceOverride}
      onReady={(m: Object3D) => {
        m.traverse((o) => {
          const mesh = o as Mesh;
          if (mesh.isMesh) mesh.castShadow = false;
        });
        onReady();
      }}
    />
  );
}

class Boundary extends Component<{ onError: (r: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    this.props.onError(e instanceof Error ? e.message : String(e));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface InvestigatoreStageProps {
  lowPower: boolean;
  framing?: StageFraming;
  /** false = fuori schermo / scheda nascosta: niente disegno. */
  visible?: boolean;
  /** File esplicito (anteprima delle varianti). */
  src?: string;
  onReady?: () => void;
  onFail?: (reason: string) => void;
  /** Solo anteprime: forza la parlata (gesti) anche senza voce. */
  speakingOverride?: boolean;
  /** Solo anteprime: forme del viso fisse (es. { jawOpen: 1 }). */
  faceOverride?: Face;
  className?: string;
}

export default function InvestigatoreStage({ lowPower, framing = "bust", visible = true, src, onReady, onFail, speakingOverride, faceOverride, className }: InvestigatoreStageProps) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => getNarrator().onState((s) => setSpeaking(s.speaking)), []);
  const fps = !visible ? 0 : speaking || speakingOverride ? 50 : 24;
  return (
    <Boundary onError={(r) => onFail?.(`errore 3D: ${r}`)}>
      <Canvas
        className={className}
        frameloop="demand"
        dpr={lowPower ? 1 : [1, 1.5]}
        resize={{ offsetSize: true }}
        gl={{ alpha: true, antialias: !lowPower, powerPreference: lowPower ? "low-power" : "default" }}
        camera={{ position: [0, 1.4, 2], fov: 26, near: 0.1, far: 20 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          const el = gl.domElement;
          el.addEventListener("webglcontextlost", () => setTimeout(() => el.isConnected && onFail?.("contesto WebGL perso"), 150), { once: true });
        }}
        style={{ background: "transparent", pointerEvents: "none" }}
      >
        <Camera framing={framing} />
        <ambientLight intensity={0.22} color="#ffe2c0" />
        <hemisphereLight args={["#4a3326", "#0b0909", 0.45]} />
        {/* la lampada: calda, davanti in alto a sinistra */}
        <directionalLight position={[-1.6, 2.6, 2.2]} intensity={2.6} color="#ffbf73" />
        {/* controluce rosso da dietro a destra (bordo della sagoma) */}
        <directionalLight position={[1.8, 2.2, -2.2]} intensity={3.2} color="#ff2330" />
        <directionalLight position={[-2, 1.2, -1.5]} intensity={0.8} color="#8e0b12" />
        <Suspense fallback={null}>
          <Narrator3D lowPower={lowPower} src={src} onReady={() => onReady?.()} speakingOverride={speakingOverride} faceOverride={faceOverride} />
        </Suspense>
        <Pace fps={fps} />
      </Canvas>
    </Boundary>
  );
}
