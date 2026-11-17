"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PerspectiveCamera } from "three";
import type { MascotProps } from "../../arena-contract";
import { readTigFont } from "../palette";
import { prefersReducedMotion } from "../quality";
import { MascotSwarm, type MascotEntry } from "./MascotSwarm";

/**
 * Mascotte singola in un canvas trasparente (scheda squadra, voto della mascotte sul telefono, premiazione).
 * Disegno a richiesta: 60 fps durante le azioni, 24 fps a riposo, fermo fuori schermo o a scheda nascosta.
 * Stesso codice delle mascotte nell'arena (MascotSwarm con un solo elemento).
 */

function Frame({ level }: { level: number }) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const cam = get().camera as PerspectiveCamera;
    // soggetto: da 0 a ~1,45 (livello 3: corona e ali), largo ~1,3 con le ali
    const top = level >= 3 ? 1.5 : level === 2 ? 1.3 : 1.25;
    const halfH = (top + 0.1) / 2;
    const halfW = level >= 3 ? 0.85 : 0.62;
    const fov = 30;
    const t = Math.tan((fov * Math.PI) / 360);
    const aspect = size.width / Math.max(1, size.height);
    const d = Math.max(halfH / t, halfW / (t * aspect)) * 1.12;
    cam.fov = fov;
    cam.position.set(0, halfH + 0.12, d);
    cam.lookAt(0, halfH - 0.02, 0);
    cam.updateProjectionMatrix();
  }, [get, size, level]);
  return null;
}

function Pace({ busy, visible, reduced }: { busy: React.RefObject<boolean>; visible: React.RefObject<boolean>; reduced: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let id = 0;
    let last = -Infinity;
    const loop = (t: number) => {
      id = requestAnimationFrame(loop);
      if (document.hidden || !visible.current) return;
      const fps = reduced ? (busy.current ? 12 : 2) : busy.current ? 60 : 24;
      if (t - last >= 1000 / fps - 2) {
        last = t;
        invalidate();
      }
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [busy, visible, reduced, invalidate]);
  return null;
}

export default function Mascot3D({ slot, level, color, action, quality, className, onFail }: MascotProps & { onFail?: () => void }) {
  const [reduced] = useState(prefersReducedMotion);
  const [family] = useState(readTigFont);
  const anchors = useRef(new Float32Array([0, 0, 0, 0, 1]));
  const busy = useRef(false);
  const visible = useRef(true);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const entries: MascotEntry[] = useMemo(() => [{ key: "single", slot, level, color, online: true, action }], [slot, level, color, action]);
  return (
    <div ref={host} className={className} style={{ position: "relative" }}>
      <Canvas
        frameloop="demand"
        dpr={quality === "high" ? [1, 2] : [1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power", stencil: false }}
        camera={{ position: [0, 0.7, 4], fov: 30 }}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener("webglcontextlost", () => onFail?.(), { once: true });
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 5]} intensity={1.6} />
        <Frame level={level} />
        <MascotSwarm entries={entries} anchorsRef={anchors} low={quality !== "high"} reduced={reduced} family={family} busyRef={busy} />
        <Pace busy={busy} visible={visible} reduced={reduced} />
      </Canvas>
    </div>
  );
}
