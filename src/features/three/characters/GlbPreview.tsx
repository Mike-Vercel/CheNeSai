"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Presenter } from "@/lib/game-engine/types";
import type { CharacterAnimation } from "./types";
import { HostGlbModel, type HostGlbProps } from "./glb-host";
import { CHARACTER_MODELS_PROCEDURAL } from "./registry";

export interface GlbPreviewProps {
  who: Presenter | "trio";
  src: "glb" | "proc";
  animation: CharacterAnimation;
  view: "front" | "34" | "full" | "face";
  mouth: number;
  walk: number;
  lowPower: boolean;
  variant?: number;
  /** Voce simulata (inviluppo sillabico ~6 sillabe/s) per provare il lip-sync senza audio. */
  speak?: boolean;
  /** Camera libera "px,py,pz,tx,ty,tz" (sostituisce la vista). */
  cam?: number[] | null;
  /** Forme del viso fisse, es. {jawOpen: 1}. */
  face?: Record<string, number> | null;
  /** Ritmo delle clip (0 = posa ferma al primo fotogramma). */
  speed?: number;
}

const VIEWS = {
  front: { pos: [0, 1.05, 3.4], target: [0, 0.95, 0] },
  "34": { pos: [2.2, 1.15, 2.7], target: [0, 0.95, 0] },
  full: { pos: [0, 0.95, 4.6], target: [0, 0.85, 0] },
  face: { pos: [0, 1.42, 2.0], target: [0, 1.36, 0] },
  trio: { pos: [0, 1.0, 6.2], target: [0, 0.85, 0] },
} as const;

function CameraAim({ view, cam }: { view: keyof typeof VIEWS; cam?: number[] | null }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const v = cam && cam.length === 6 ? { pos: cam.slice(0, 3), target: cam.slice(3) } : VIEWS[view];
    camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
    camera.lookAt(v.target[0], v.target[1], v.target[2]);
  }, [camera, view, cam]);
  return null;
}

/** Modello che "parla" con un inviluppo sillabico finto (stessa soglia di aggiornamento dell'intro). */
function SpeakingHost(props: HostGlbProps) {
  const [mouth, setMouth] = useState(0);
  const st = useRef({ t: 0, last: 0 });
  useFrame((_, dt) => {
    const s = st.current;
    s.t += dt;
    // sillabe a ~6/s con accenti irregolari e piccole pause tra le parole
    const syl = Math.max(0, Math.sin(s.t * Math.PI * 6)) * (0.55 + 0.45 * Math.abs(Math.sin(s.t * 1.7)));
    const word = Math.sin(s.t * 1.3) > -0.75 ? 1 : 0;
    const m = syl * word;
    if (Math.abs(m - s.last) > 0.04) {
      s.last = m;
      setMouth(m);
    }
  });
  return <HostGlbModel {...props} mouthOpen={mouth} />;
}

/** Palmino accanto ai presentatori con le proporzioni dell'intro (3.0 contro ~4.76 unità). */
const TRIO_PALMINO_SCALE = 0.63;

/**
 * Confronto GLB ⟷ procedurale dei personaggi con le stesse luci del palco TV (CharacterStage).
 * /preview/character-glb?who=professore|regina|palmino|trio&src=glb|proc&anim=…&view=front|34|full&mouth=0..1&walk=0..1&variant=0|1
 */
export function GlbPreview({ who, src, animation, view, mouth, walk, lowPower, variant, speak = false, cam = null, face = null, speed = 1 }: GlbPreviewProps) {
  const walkRef = useRef(walk);
  const one = who === "trio" ? "professore" : who;
  const Proc = CHARACTER_MODELS_PROCEDURAL[one];
  return (
    <div className="fixed inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, #5a1a8f 0%, #22083f 60%, #12041f 100%)" }}>
      <Canvas camera={{ position: [0, 1.05, 3.4], fov: 32, near: 0.1, far: 50 }} dpr={[1, 1.5]}>
        <CameraAim view={who === "trio" ? "trio" : view} cam={cam} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#ffe9c7", "#2a0d45", 0.6]} />
        <directionalLight position={[2.5, 4, 4]} intensity={2.1} color="#fff1dc" />
        <directionalLight position={[-3, 2.5, -2]} intensity={1.6} color="#ff4fb0" />
        <directionalLight position={[3, 1.5, -2.5]} intensity={1.3} color="#3fb8ff" />
        <Suspense fallback={null}>
          {who === "trio" ? (
            <>
              <HostGlbModel who="professore" animation={animation} mouthOpen={mouth} fullBody walkRef={walkRef} lowPower={lowPower} position={[-1.15, 0, 0]} rotation-y={0.25} />
              <HostGlbModel who="palmino" animation={animation} mouthOpen={mouth} fullBody walkRef={walkRef} lowPower={lowPower} position={[0, 0, 0.3]} scale={TRIO_PALMINO_SCALE} />
              <HostGlbModel who="regina" animation={animation} mouthOpen={mouth} fullBody walkRef={walkRef} lowPower={lowPower} position={[1.15, 0, 0]} rotation-y={-0.25} />
            </>
          ) : src === "glb" && speak ? (
            <SpeakingHost who={one} animation={animation} fullBody={view === "full"} walkRef={walkRef} lowPower={lowPower} talkVariant={variant} />
          ) : src === "glb" ? (
            <HostGlbModel who={one} animation={animation} mouthOpen={mouth} fullBody={view === "full"} walkRef={walkRef} lowPower={lowPower} talkVariant={variant} faceOverride={face ?? undefined} speed={speed} />
          ) : (
            <Proc animation={animation} mouthOpen={mouth} lowPower={lowPower} />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
