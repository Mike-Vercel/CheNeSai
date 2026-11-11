"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CharacterAnimation } from "../../types";
import { REGINA_HEIGHT, ReginaModel } from "../ReginaModel";

const ANIMS: { id: CharacterAnimation; label: string }[] = [
  { id: "idle", label: "Idle" },
  { id: "intro", label: "Intro" },
  { id: "talk", label: "Parla" },
  { id: "wave", label: "Saluta" },
  { id: "celebrate", label: "Festeggia" },
  { id: "surprised", label: "Sorpresa" },
  { id: "point", label: "Indica" },
];

type CamId = "ref" | "front" | "q34l" | "q34r" | "side" | "back" | "face" | "faceFront" | "hand" | "arms" | "chest" | "tray";
const CAMS: Record<CamId, { label: string; pos: [number, number, number]; target: [number, number, number] }> = {
  ref: { label: "Riferimento", pos: [-1.45, 1.18, 2.95], target: [-0.16, 1.02, 0] },
  front: { label: "Fronte", pos: [0, 1.1, 3.5], target: [0, 0.95, 0] },
  q34l: { label: "3/4 sinistra", pos: [2.45, 1.2, 2.45], target: [0, 0.95, 0] },
  q34r: { label: "3/4 destra", pos: [-2.45, 1.2, 2.45], target: [0, 0.95, 0] },
  side: { label: "Profilo", pos: [3.5, 1.15, 0], target: [0, 0.95, 0] },
  back: { label: "Retro", pos: [0, 1.25, -3.5], target: [0, 0.95, 0] },
  face: { label: "Volto", pos: [-0.38, 1.42, 1.3], target: [0, 1.36, 0.06] },
  faceFront: { label: "Volto fronte", pos: [0, 1.4, 1.35], target: [0, 1.37, 0.06] },
  hand: { label: "Mano microfono", pos: [0.75, 1.2, 1.1], target: [0.24, 1.08, 0.28] },
  arms: { label: "Braccia", pos: [0, 1.15, 2.6], target: [0, 1.0, 0] },
  chest: { label: "Colletto", pos: [0.15, 1.05, 1.45], target: [0, 0.92, 0.05] },
  tray: { label: "Vassoio", pos: [-1.0, 1.25, 1.2], target: [-0.45, 1.0, 0.2] },
};

const isAnim = (v: string | undefined): v is CharacterAnimation => ANIMS.some((a) => a.id === v);
const isCam = (v: string | undefined): v is CamId => !!v && v in CAMS;

export interface ReginaPreviewProps {
  initialAnim?: string;
  initialCam?: string;
  initialMouth?: number;
  initialTalk?: boolean;
  initialLow?: boolean;
  showUi?: boolean;
  pauseAt?: number | null;
}

function CameraRig({ cam }: { cam: CamId }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  useEffect(() => {
    const c = CAMS[cam];
    camera.position.set(...c.pos);
    if (controls) {
      controls.target.set(...c.target);
      controls.update();
    } else {
      camera.lookAt(...c.target);
    }
  }, [cam, camera, controls]);
  return null;
}

function TalkDriver({ on, onValue }: { on: boolean; onValue: (v: number) => void }) {
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!on) return;
    t.current += dt;
    const x = t.current;
    // sillabe pseudo-casuali con pause tra le parole
    const word = Math.max(0, Math.sin(x * 1.9) + 0.35);
    const syl = Math.abs(Math.sin(x * 11.3)) * (0.55 + 0.45 * Math.sin(x * 4.1));
    onValue(Math.min(1, word * syl));
  });
  return null;
}

type StatsT = { tris: number; calls: number; fps: number; model: string };
function Stats({ onStats }: { onStats: (s: StatsT) => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    acc.current.t += dt;
    acc.current.n += 1;
    if (acc.current.t > 0.5) {
      const ud = scene.getObjectByName("LaRegina")?.userData;
      const m = ud?.reginaStats as Record<string, number> | undefined;
      if (ud?.faceFit) document.body.dataset.faceFit = JSON.stringify(ud.faceFit);
      const model = m ? `modello ${m.triangles} tri (pelle/stoffa ${m.matte}, lucido ${m.gloss}, oro ${m.gold}, vetro ${m.glass}, capelli ${m.hair}) · cima ${m.maxY} m` : "";
      onStats({ tris: gl.info.render.triangles, calls: gl.info.render.calls, fps: Math.round(acc.current.n / acc.current.t), model });
      acc.current.t = 0;
      acc.current.n = 0;
    }
  });
  return null;
}

const btn = (active: boolean): CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(246,210,122,0.5)",
  background: active ? "#f6d27a" : "rgba(30,10,45,0.75)",
  color: active ? "#2a0d3a" : "#f8ead0",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
});

export default function ReginaPreviewCanvas({
  initialAnim,
  initialCam,
  initialMouth = 0,
  initialTalk = false,
  initialLow = false,
  showUi = true,
  pauseAt = null,
}: ReginaPreviewProps) {
  const [anim, setAnim] = useState<CharacterAnimation>(isAnim(initialAnim) ? initialAnim : "idle");
  const [cam, setCam] = useState<CamId>(isCam(initialCam) ? initialCam : "ref");
  const [mouth, setMouth] = useState(initialMouth);
  const [talk, setTalk] = useState(initialTalk);
  const [talkValue, setTalkValue] = useState(0);
  const [low, setLow] = useState(initialLow);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState<StatsT>({ tris: 0, calls: 0, fps: 0, model: "" });

  useEffect(() => {
    if (pauseAt === null) return;
    const id = window.setTimeout(() => setPaused(true), pauseAt * 1000);
    return () => window.clearTimeout(id);
  }, [pauseAt]);

  const play = (id: CharacterAnimation) => {
    if (id === anim) {
      // riavvia la stessa animazione passando un istante per idle
      setAnim("idle");
      window.setTimeout(() => setAnim(id), 40);
    } else setAnim(id);
  };

  const mouthOpen = talk ? talkValue : mouth;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#170824" }}>
      <Canvas camera={{ fov: 30, near: 0.05, far: 60, position: CAMS.ref.pos }} dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={["#170824"]} />
        <hemisphereLight args={["#ffe9d6", "#2a0f3d", 0.55]} />
        <directionalLight position={[-2.6, 3.6, 3.2]} intensity={2.6} color="#ffe2c2" />
        <directionalLight position={[3.2, 1.6, 2.2]} intensity={0.8} color="#d4c6ff" />
        <directionalLight position={[0.6, 3.2, -3.4]} intensity={2.4} color="#ffc98a" />
        <directionalLight position={[-2.8, 1.2, -2.6]} intensity={0.5} color="#ffb98a" />
        <ReginaModel animation={anim} mouthOpen={mouthOpen} speed={paused ? 0 : 1} lowPower={low} />
        <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.6, 48]} />
          <meshStandardMaterial color="#2b0f40" roughness={0.9} />
        </mesh>
        <OrbitControls makeDefault enableDamping target={CAMS.ref.target} minDistance={0.6} maxDistance={9} />
        <CameraRig cam={cam} />
        <TalkDriver on={talk} onValue={setTalkValue} />
        <Stats onStats={setStats} />
      </Canvas>

      {showUi && (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontFamily: "var(--font-nunito), sans-serif",
            color: "#f8ead0",
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, pointerEvents: "auto" }}>
            {ANIMS.map((a) => (
              <button key={a.id} type="button" data-anim={a.id} style={btn(anim === a.id)} onClick={() => play(a.id)}>
                {a.label}
              </button>
            ))}
            <button type="button" data-ctl="pause" style={btn(paused)} onClick={() => setPaused((v) => !v)}>
              {paused ? "Riprendi" : "Pausa"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, pointerEvents: "auto" }}>
            {(Object.keys(CAMS) as CamId[]).map((id) => (
              <button key={id} type="button" data-cam={id} style={btn(cam === id)} onClick={() => setCam(id)}>
                {CAMS[id].label}
              </button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 14,
              pointerEvents: "auto",
              background: "rgba(30,10,45,0.75)",
              borderRadius: 12,
              padding: "8px 12px",
              fontSize: 13,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Bocca {mouthOpen.toFixed(2)}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={mouth}
                disabled={talk}
                onChange={(e) => setMouth(Number(e.target.value))}
                data-ctl="mouth"
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={talk} onChange={(e) => setTalk(e.target.checked)} data-ctl="talk" />
              Simula parlato
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} data-ctl="low" />
              Bassa potenza
            </label>
            <span data-stats="" style={{ opacity: 0.85 }}>
              {stats.tris.toLocaleString("it-IT")} triangoli · {stats.calls} draw call · {stats.fps} fps · altezza {REGINA_HEIGHT.toFixed(2)} m · {stats.model}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
