"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { CharacterAnimation } from "../../types";
import { PROFESSORE_HEIGHT, ProfessoreModel } from "../ProfessoreModel";

const ANIMS: CharacterAnimation[] = ["idle", "intro", "talk", "wave", "celebrate", "surprised", "point"];

type View = "ref" | "front" | "left34" | "right34" | "side" | "back" | "face" | "eyes";
const VIEWS: Record<View, { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  // inquadratura del riferimento: dal basso, alla destra del personaggio
  ref: { pos: [-0.75, 0.55, 2.45], target: [0.05, 1.0, 0], fov: 34 },
  front: { pos: [0, 1.15, 3.6], target: [0, 1.0, 0], fov: 32 },
  left34: { pos: [2.5, 1.35, 2.6], target: [0, 1.0, 0], fov: 32 },
  right34: { pos: [-2.5, 1.35, 2.6], target: [0, 1.0, 0], fov: 32 },
  side: { pos: [3.6, 1.2, 0], target: [0, 1.0, 0], fov: 32 },
  back: { pos: [0, 1.3, -3.6], target: [0, 1.0, 0], fov: 32 },
  face: { pos: [-0.25, 1.3, 1.7], target: [0, 1.25, 0.1], fov: 30 },
  eyes: { pos: [0, 1.34, 1.1], target: [0, 1.32, 0.1], fov: 22 },
};

export interface ProfessorePreviewProps {
  initialAnimation?: CharacterAnimation;
  initialView?: string;
  initialMouth?: number;
  talking?: boolean;
  lowPower?: boolean;
  showUi?: boolean;
}

function isAnim(a: string | undefined): a is CharacterAnimation {
  return !!a && (ANIMS as string[]).includes(a);
}

function Stats({ onStats }: { onStats: (s: string) => void }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 1) return;
    acc.current = 0;
    onStats(`${gl.info.render.triangles.toLocaleString("it-IT")} tri · ${gl.info.render.calls} draw call · ${Math.round(1 / Math.max(dt, 1e-3))} fps`);
  });
  return null;
}

function Talker({ enabled, base, onValue }: { enabled: boolean; base: number; onValue: (v: number) => void }) {
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!enabled) return;
    t.current += dt;
    const x = t.current;
    // parlato simulato: sillabe ~6/s con pause
    const syll = 0.5 + 0.5 * Math.sin(x * 12.5) * Math.sin(x * 3.7 + 1);
    const phrase = Math.sin(x * 0.9) > -0.6 ? 1 : 0;
    onValue(Math.max(base, Math.min(1, syll * phrase * 1.1)));
  });
  return null;
}

export default function ProfessorePreviewCanvas({
  initialAnimation,
  initialView,
  initialMouth = 0,
  talking = false,
  lowPower = false,
  showUi = true,
}: ProfessorePreviewProps) {
  const [anim, setAnim] = useState<CharacterAnimation>(isAnim(initialAnimation) ? initialAnimation : "idle");
  const [mouth, setMouth] = useState(initialMouth);
  const [talk, setTalk] = useState(talking);
  const [low, setLow] = useState(lowPower);
  const [stats, setStats] = useState("");
  const [animKey, setAnimKey] = useState(0);
  const view = VIEWS[(initialView as View) in VIEWS ? (initialView as View) : "ref"];
  const [shownMouth, setShownMouth] = useState(initialMouth);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#170824", color: "#f6eefc", fontFamily: "system-ui, sans-serif" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: view.pos, fov: view.fov, near: 0.05, far: 50 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={["#170824"]} />
        <hemisphereLight args={["#ffe9dc", "#3a1f4a", 0.7]} />
        {/* key: alto a sinistra (come nell'illustrazione), caldo */}
        <directionalLight
          position={[-3, 4.5, 4]}
          intensity={2.6}
          color="#fff1e2"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
        />
        {/* fill: destra, più freddo */}
        <directionalLight position={[3.5, 1.6, 3]} intensity={0.9} color="#d9d4ff" />
        {/* rim: dietro, caldo-magenta per staccare dal fondo viola */}
        <directionalLight position={[0.5, 3, -4]} intensity={2.2} color="#ffc6a8" />
        <directionalLight position={[-3, 2, -3]} intensity={1.0} color="#c99bff" />
        <Environment resolution={64}>
          <Lightformer form="rect" intensity={1.2} position={[-3, 3, 3]} scale={[3, 3, 1]} color="#fff2e6" />
          <Lightformer form="rect" intensity={0.5} position={[3, 1, 2]} scale={[2, 3, 1]} color="#fff6ee" />
          <Lightformer form="rect" intensity={0.8} position={[0, 3, -3]} scale={[4, 2, 1]} color="#ffd2b0" />
        </Environment>
        <ProfessoreModel
          key={`${animKey}-${low ? 1 : 0}`}
          animation={anim}
          mouthOpen={talk ? shownMouth : mouth > 0 ? mouth : undefined}
          lowPower={low}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
          <circleGeometry args={[1.4, 48]} />
          <meshStandardMaterial color="#2a1238" roughness={0.9} />
        </mesh>
        <Talker enabled={talk} base={0} onValue={setShownMouth} />
        <OrbitControls target={view.target} minDistance={0.6} maxDistance={8} enableDamping />
        <Stats onStats={setStats} />
      </Canvas>

      {showUi && (
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 16,
            bottom: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            padding: 12,
            borderRadius: 14,
            background: "rgba(23, 8, 36, 0.78)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(6px)",
          }}
        >
          <strong style={{ marginRight: 8 }}>Il Professore</strong>
          {ANIMS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAnim(a);
                if (a === anim) setAnimKey((k) => k + 1);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.25)",
                background: a === anim ? "#f4b23e" : "transparent",
                color: a === anim ? "#170824" : "#f6eefc",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {a}
            </button>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
            mouthOpen
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={talk ? shownMouth : mouth}
              disabled={talk}
              onChange={(e) => setMouth(Number(e.target.value))}
            />
            <code style={{ width: 34 }}>{(talk ? shownMouth : mouth).toFixed(2)}</code>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={talk} onChange={(e) => setTalk(e.target.checked)} />
            simula parlato
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />
            lowPower
          </label>
          <span style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12 }}>
            h {PROFESSORE_HEIGHT.toFixed(2)} m · {stats}
          </span>
        </div>
      )}
    </div>
  );
}
