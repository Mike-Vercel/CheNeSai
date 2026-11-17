"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { PerspectiveCamera } from "three";
import type { HostId } from "../../arena-contract";
import { RoomEnvironmentLight } from "./room-env";
import { HostCharacter } from "./HostCharacter";
import { HOST_MODELS } from "./host-models";
import type { HostAction } from "../arena/director";

/**
 * GALLERIA DEI PERSONAGGI (solo anteprima): tutti i presentatori in UN canvas, in griglia, che parlano a turno
 * (bocca simulata o voce finta), per controllare i nuovi modelli ottimizzati. Un solo contesto WebGL.
 */

class Boundary extends Component<{ children: ReactNode; label: string }, { failed: string | null }> {
  state = { failed: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { failed: e instanceof Error ? e.message : String(e) };
  }
  componentDidCatch(e: unknown) {
    console.warn(`[tig] galleria: ${this.props.label} non caricato`, e);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Frame({ rows, cols, cell }: { rows: number; cols: number; cell: { w: number; h: number } }) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const cam = get().camera as PerspectiveCamera;
    // dalla testa della prima riga (~2,05 m) ai piedi dell'ultima
    const top = 2.05;
    const bottom = -(rows - 1) * cell.h - 0.05;
    const H = top - bottom;
    const W = cols * cell.w;
    const fov = 24;
    const t = Math.tan((fov * Math.PI) / 360);
    const aspect = size.width / Math.max(1, size.height);
    const d = Math.max(H / 2 / t, W / 2 / (t * aspect)) * 1.04;
    const cy = (top + bottom) / 2;
    cam.fov = fov;
    cam.position.set(0, cy + 0.2, d);
    cam.lookAt(0, cy, 0);
    cam.updateProjectionMatrix();
  }, [get, size, rows, cols, cell]);
  return null;
}

function Speaker({ mouths, ids, speakAll }: { mouths: RefObject<number[]>; ids: HostId[]; speakAll: boolean }) {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ids.forEach((_, i) => {
      const p = t * 11 + i * 1.7;
      const on = speakAll || Math.floor(t / 2.2) % ids.length === i;
      mouths.current[i] = on ? Math.max(0, 0.15 + 0.7 * Math.sin(p) * Math.sin(p * 0.41 + i)) : 0;
    });
  });
  return null;
}

function Pace() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let id = 0;
    const loop = () => {
      id = requestAnimationFrame(loop);
      if (!document.hidden) invalidate();
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [invalidate]);
  return null;
}

export default function HostGallery({ ids, quality, speakAll = true, action = "idle" }: { ids: HostId[]; quality: "high" | "low"; speakAll?: boolean; action?: HostAction }) {
  const cols = Math.min(ids.length, ids.length > 8 ? 6 : 4);
  const rows = Math.ceil(ids.length / cols);
  // celle larghe quanto serve perché la griglia 3D riempia il canvas come la griglia delle etichette HTML
  const [aspect, setAspect] = useState(() => (typeof window === "undefined" ? 16 / 9 : window.innerWidth / Math.max(1, window.innerHeight)));
  useEffect(() => {
    const on = () => setAspect(window.innerWidth / Math.max(1, window.innerHeight));
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const cell = useMemo(() => {
    const h = 2.35;
    return { w: Math.max(0.9, (h * aspect * rows) / cols), h };
  }, [aspect, rows, cols]);
  const mouths = useRef<number[]>(ids.map(() => 0));
  const refs = useMemo(() => ids.map((_, i) => ({ get current() { return mouths.current[i] ?? 0; } }) as RefObject<number>), [ids]);
  const [loadedSet, setLoaded] = useState<ReadonlySet<HostId>>(new Set());
  const loaded = loadedSet.size;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas frameloop="demand" dpr={[1, 1.75]} shadows={false} gl={{ antialias: true }} camera={{ position: [0, 1, 20], fov: 24 }}>
        <color attach="background" args={["#05070b"]} />
        <RoomEnvironmentLight intensity={0.55} />
        <hemisphereLight args={["#cfe0ff", "#0b0d10", 0.6]} />
        <directionalLight position={[3, 6, 8]} intensity={2.2} color="#fff1e2" />
        <pointLight position={[-6, 3, -2]} intensity={60} distance={18} color="#ff8a1f" />
        <pointLight position={[6, 3, -2]} intensity={60} distance={18} color="#2de2ff" />
        <Frame rows={rows} cols={cols} cell={cell} />
        <Speaker mouths={mouths} ids={ids} speakAll={speakAll} />
        {ids.map((who, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const x = (c - (cols - 1) / 2) * cell.w;
          const y = -r * cell.h;
          return (
            <group key={who} position={[x, y, 0]}>
              <Boundary label={who}>
                <Suspense fallback={null}>
                  <group scale={1.8 / Math.max(1.5, HOST_MODELS[who].height)}>
                    <HostCharacter who={who} quality={quality} action={action} speaking mouthRef={refs[i]} phase={i} onReady={() => setLoaded((prev) => (prev.has(who) ? prev : new Set([...prev, who])))} />
                  </group>
                </Suspense>
              </Boundary>
            </group>
          );
        })}
        <Pace />
      </Canvas>
      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, pointerEvents: "none" }}>
        {ids.map((who) => (
          <div key={who} style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6 }}>
            <span style={{ background: "rgba(5,7,11,0.78)", border: `1px solid ${HOST_MODELS[who].tint}`, borderRadius: 999, padding: "2px 10px", fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>
              {HOST_MODELS[who].name.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 10, top: 8, fontSize: 12, opacity: 0.7 }} data-loaded={loaded}>
        {loaded}/{ids.length} modelli
      </div>
    </div>
  );
}
