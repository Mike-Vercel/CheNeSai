"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { ACESFilmicToneMapping, SRGBColorSpace, type Vector3 } from "three";

type OrbitControlsImpl = { target: Vector3; update(): void };
import type { CharacterAnimation } from "../types";
import { PALMINO_HEIGHT, PalminoModel } from "./PalminoModel";

export type PreviewView = "ref" | "front" | "34" | "side" | "sideR" | "back" | "close";

const VIEWS: Record<PreviewView, { pos: [number, number, number]; target: [number, number, number] }> = {
  // inquadratura del render di riferimento (figura intera che riempie il fotogramma)
  ref: { pos: [0, 0.9, 3.42], target: [0, 0.845, 0] },
  front: { pos: [0, 0.82, 4.3], target: [0, 0.8, 0] },
  "34": { pos: [2.9, 1.15, 3.1], target: [0, 0.8, 0] },
  side: { pos: [4.2, 0.95, 0], target: [0, 0.8, 0] },
  sideR: { pos: [-4.2, 0.95, 0], target: [0, 0.8, 0] },
  back: { pos: [0, 1.0, -4.3], target: [0, 0.8, 0] },
  close: { pos: [0, 1.05, 1.9], target: [0, 1.02, 0] },
};

export interface PreviewCanvasProps {
  animation: CharacterAnimation;
  mouthOpen: number;
  simulateSpeech: boolean;
  /** true = lascia la bocca libera (nessun lip-sync collegato) */
  noLipSync: boolean;
  speed: number;
  lowPower: boolean;
  view: PreviewView;
  background?: string;
  onStats?: (s: { calls: number; triangles: number; fps: number; model?: { triangles: number; drawCalls: number } }) => void;
}

function CameraRig({ view }: { view: PreviewView }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  useEffect(() => {
    const v = VIEWS[view];
    camera.position.set(...v.pos);
    if (controls) {
      controls.target.set(...v.target);
      controls.update();
    } else {
      camera.lookAt(...v.target);
    }
  }, [view, camera, controls]);
  return null;
}

function Stats({ onStats }: { onStats?: PreviewCanvasProps["onStats"] }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const acc = useRef({ t: 0, frames: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.t += dt;
    a.frames += 1;
    if (a.t >= 1) {
      const rt = scene.getObjectByName("Palmino")?.userData.sculptRuntime as { stats?: { triangles: number; drawCalls: number } } | undefined;
      onStats?.({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, fps: Math.round(a.frames / a.t), model: rt?.stats });
      a.t = 0;
      a.frames = 0;
    }
  });
  return null;
}

/** Palmino con un "finto parlato" che fa oscillare mouthOpen a sillabe. */
function SpeakingPalmino(props: Omit<PreviewCanvasProps, "view" | "onStats">) {
  const [simMouth, setSimMouth] = useState(0);
  const clock = useRef(0);
  useFrame((_, dt) => {
    if (!props.simulateSpeech) return;
    clock.current += dt;
    const t = clock.current;
    const syll = Math.abs(Math.sin(t * 9.4) * Math.sin(t * 3.3 + 0.7));
    const pause = Math.sin(t * 0.9) > -0.55 ? 1 : 0;
    setSimMouth(Math.min(1, syll * 1.15 * pause));
  });
  const mouth = props.simulateSpeech ? simMouth : props.mouthOpen;
  return (
    <PalminoModel
      animation={props.animation}
      mouthOpen={props.noLipSync && !props.simulateSpeech ? undefined : mouth}
      speed={props.speed}
      lowPower={props.lowPower}
    />
  );
}

export default function PalminoPreviewCanvas(props: PreviewCanvasProps) {
  const { view, onStats, background = "#170824", ...rest } = props;
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.05, far: 60, position: VIEWS[view].pos }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05, outputColorSpace: SRGBColorSpace, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={[background]} />
      <hemisphereLight args={["#fff6ea", "#3a2240", 0.45]} />
      <directionalLight
        position={[-2.2, 3.6, 3.2]}
        intensity={1.8}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={2}
        shadow-camera-bottom={-0.5}
      />
      <directionalLight position={[2.6, 2.2, 2.4]} intensity={0.6} color="#e9e4ff" />
      <directionalLight position={[1.5, 2.8, -3.2]} intensity={1.5} color="#e7c8ff" />
      <SpeakingPalmino {...rest} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={3} blur={2.4} far={1.2} resolution={512} color="#05000a" />
      <OrbitControls makeDefault target={[0, PALMINO_HEIGHT / 2, 0]} minDistance={0.8} maxDistance={12} />
      <CameraRig view={view} />
      <Stats onStats={onStats} />
    </Canvas>
  );
}
