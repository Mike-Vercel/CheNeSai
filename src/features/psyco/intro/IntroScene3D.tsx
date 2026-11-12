"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Vector3, type Mesh, type Object3D, type PerspectiveCamera } from "three";
import { glbConfig, HostGlbModel, SIT_DROP } from "@/features/three/characters/glb-host";
import { getNarrator } from "../narrator";
import { createNarratorMouth } from "../investigatore/lipsync";
import { Room, useRoomTextures } from "./room";
import { cameraAt, characterAt, lampAt, VFOV, type IntroLayout, type Vec3 } from "./timeline";

/**
 * Scena 3D dell'intro di PSYCO (un solo canvas): la stanza (room.tsx) e l'Investigatore GLB che entra
 * camminando, si gira, si siede (posa procedurale, vedi glb-host SIT_POSE) e parla col narratore.
 * Il tempo lo avanza la scena (`timeRef`, secondi) solo quando `runningRef` è true; i passi sono
 * rilevati dai piedi del modello (quando un piede tocca terra) e segnalati con `onStep`.
 */
export interface IntroScene3DProps {
  timeRef: RefObject<number>;
  runningRef: RefObject<boolean>;
  lowPower: boolean;
  /** Pronto: modello caricato e primi fotogrammi disegnati. */
  onReady: () => void;
  onFail: (reason: string) => void;
  onStep: (foot: "l" | "r") => void;
  className?: string;
}

const tmp = new Vector3();

function Investigator({ timeRef, onReady, onStep, headRef, sitRef }: { timeRef: RefObject<number>; onReady: () => void; onStep: (f: "l" | "r") => void; headRef: RefObject<Vec3 | null>; sitRef: RefObject<number> }) {
  const group = useRef<Object3D>(null);
  const walkRef = useRef(0);
  const walkRateRef = useRef(1);
  const mouth = useRef(0);
  const mouthFn = useMemo(() => createNarratorMouth(), []);
  const bones = useRef<{ head: Object3D | null; lf: Object3D | null; rf: Object3D | null; ground: number }>({ head: null, lf: null, rf: null, ground: 0 });
  const feet = useRef({ l: true, r: true });
  const [talking, setTalking] = useState(false);
  const [seated, setSeated] = useState(false);
  useEffect(() => getNarrator().onState((s) => setTalking(s.speaking)), []);
  const walkSpeed = glbConfig("investigatore").walkSpeed;

  useFrame((_, dt) => {
    const t = timeRef.current ?? 0;
    const c = characterAt(t);
    walkRef.current = c.walk;
    walkRateRef.current = c.walk > 0.01 ? Math.max(0.55, Math.min(1.4, (c.speed || walkSpeed * 0.6) / walkSpeed)) : 1;
    sitRef.current = c.sit;
    if (c.sit > 0.9 !== seated) setSeated(c.sit > 0.9);
    const g = group.current;
    if (g) {
      g.position.set(c.x, -SIT_DROP * c.sit, c.z);
      g.rotation.y = c.rotY;
    }
    mouth.current = mouthFn(Math.min(0.1, dt));
    const b = bones.current;
    if (b.head) {
      b.head.getWorldPosition(tmp);
      headRef.current = [tmp.x, tmp.y, tmp.z];
    }
    // passi: un piede che scende a terra (sotto la soglia) mentre cammina
    if (c.walk > 0.25 && c.sit < 0.05) {
      for (const [k, bone] of [
        ["l", b.lf],
        ["r", b.rf],
      ] as const) {
        if (!bone) continue;
        const y = bone.getWorldPosition(tmp).y;
        const down = y < b.ground + 0.025;
        if (down && !feet.current[k]) onStep(k);
        if (down) feet.current[k] = true;
        else if (y > b.ground + 0.05) feet.current[k] = false;
      }
    }
  });

  return (
    <group ref={group} position={[-3.3, 0, -0.6]} rotation-y={Math.PI / 2}>
      <HostGlbModel
        who="investigatore"
        fullBody
        animation={talking && seated ? "talk" : "idle"}
        walkRef={walkRef}
        walkRateRef={walkRateRef}
        sitRef={sitRef}
        mouthRef={mouth}
        onReady={(m) => {
          m.traverse((o) => {
            const mesh = o as Mesh;
            if (mesh.isMesh) mesh.castShadow = true;
          });
          const find = (n: string) => m.getObjectByName(n) ?? null;
          m.updateMatrixWorld(true);
          const lf = find("mixamorigLeftFoot");
          const rf = find("mixamorigRightFoot");
          // altezza della caviglia in piedi (posa di bind) = piede appoggiato
          const ground = lf ? lf.getWorldPosition(new Vector3()).y - (group.current?.position.y ?? 0) : 0.08;
          bones.current = { head: find("mixamorigHead"), lf, rf, ground };
          onReady();
        }}
      />
    </group>
  );
}

function Director({ timeRef, runningRef, headRef }: { timeRef: RefObject<number>; runningRef: RefObject<boolean>; headRef: RefObject<Vec3 | null> }) {
  const head = useRef<Vec3 | null>(null);
  useFrame((state, dt) => {
    const camera = state.camera as PerspectiveCamera;
    const size = state.size;
    if (runningRef.current) timeRef.current = (timeRef.current ?? 0) + Math.min(0.1, dt);
    const t = timeRef.current ?? 0;
    const aspect = size.width / Math.max(1, size.height);
    const layout: IntroLayout = aspect < 0.9 ? "portrait" : "landscape";
    // la testa si muove con le clip: la camera la segue ammorbidita
    const h = headRef.current;
    if (h) head.current = head.current ? [head.current[0] + (h[0] - head.current[0]) * 0.08, head.current[1] + (h[1] - head.current[1]) * 0.08, head.current[2] + (h[2] - head.current[2]) * 0.08] : h;
    const cam = cameraAt(t, layout, aspect, head.current);
    camera.fov = VFOV[layout];
    camera.position.set(...cam.pos);
    camera.lookAt(...cam.target);
    camera.updateProjectionMatrix();
  });
  return null;
}

function LampDriver({ timeRef, lampRef }: { timeRef: RefObject<number>; lampRef: RefObject<number> }) {
  useFrame(() => {
    lampRef.current = lampAt(timeRef.current ?? 0);
  });
  return null;
}

/** Segnala "pronto" dopo un paio di fotogrammi col modello (shader compilati, niente scatti all'avvio). */
function ReadyAfterFrames({ armed, onReady }: { armed: boolean; onReady: () => void }) {
  const n = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (!armed || done.current) return;
    if (++n.current >= 3) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

function SceneContents({ timeRef, runningRef, lowPower, onReady, onStep }: Omit<IntroScene3DProps, "onFail" | "className">) {
  const tex = useRoomTextures();
  const lampRef = useRef(0);
  const sitRef = useRef(0);
  const headRef = useRef<Vec3 | null>(null);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <color attach="background" args={["#060505"]} />
      <fogExp2 attach="fog" args={[0x0b0909, 0.11]} />
      <ambientLight intensity={0.05} color="#ffdcc0" />
      <hemisphereLight args={["#2a1e2a", "#050404", 0.18]} />
      <Room tex={tex} lampRef={lampRef} sitRef={sitRef} lowPower={lowPower} />
      <Suspense fallback={null}>
        <Investigator timeRef={timeRef} onReady={() => setLoaded(true)} onStep={onStep} headRef={headRef} sitRef={sitRef} />
      </Suspense>
      <LampDriver timeRef={timeRef} lampRef={lampRef} />
      <Director timeRef={timeRef} runningRef={runningRef} headRef={headRef} />
      <ReadyAfterFrames armed={loaded} onReady={onReady} />
    </>
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

export default function IntroScene3D({ timeRef, runningRef, lowPower, onReady, onFail, onStep, className }: IntroScene3DProps) {
  return (
    <Boundary onError={(r) => onFail(`errore 3D: ${r}`)}>
      <Canvas
        className={className}
        shadows="percentage"
        dpr={lowPower ? 1 : [1, 1.5]}
        gl={{ antialias: !lowPower, powerPreference: "high-performance" }}
        camera={{ position: [0, 1.2, 4], fov: 34, near: 0.05, far: 30 }}
        onCreated={({ gl }) => {
          const el = gl.domElement;
          el.addEventListener("webglcontextlost", () => setTimeout(() => el.isConnected && onFail("contesto WebGL perso"), 150), { once: true });
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <SceneContents timeRef={timeRef} runningRef={runningRef} lowPower={lowPower} onReady={onReady} onStep={onStep} />
      </Canvas>
    </Boundary>
  );
}
