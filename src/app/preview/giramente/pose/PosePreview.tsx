"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { GiramenteCharacterModel } from "@/features/giramente/three/character-model";
import { StudioLights } from "@/features/giramente/three/CharacterStage3D";
import { CHARACTER_FILES, type MouthVariant } from "@/features/giramente/three/characters";
import type { CharacterAction, CharacterWho } from "@/features/giramente/three/types";

/**
 * Controllo delle POSE (spalla, ascella, manica) al culmine: personaggio fermo all'istante `t` dell'azione,
 * inquadratura stretta sul busto da davanti o di tre quarti. Serve agli screenshot di verifica della giacca.
 */
function Cam({ view }: { view: "front" | "side" | "back" }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const pos: Record<typeof view, [number, number, number]> = { front: [0, 1.5, 2.3], side: [1.6, 1.55, 1.6], back: [-1.5, 1.55, 1.7] };
    camera.position.set(...pos[view]);
    camera.lookAt(0, 1.45, 0);
  }, [camera, view]);
  return null;
}

export function PosePreview({ who, variant, action, t, view, low }: { who: CharacterWho; variant: MouthVariant; action: CharacterAction; t: number; view: "front" | "side" | "back"; low: boolean }) {
  const base = CHARACTER_FILES[who][variant];
  const url = low ? base.replace(/\.glb$/, "-low.glb") : base;
  return (
    <div className="h-dvh w-full bg-[#1b2126]">
      <Canvas camera={{ fov: 30, position: [0, 1.5, 2.3] }} gl={{ antialias: true }}>
        <color attach="background" args={["#2a3138"]} />
        <Cam view={view} />
        <StudioLights />
        <ambientLight intensity={0.6} />
        <Suspense fallback={null}>
          <GiramenteCharacterModel who={who} url={url} action={action} speaking={false} pointSide={who === "dontralla" ? "right" : "left"} holdAt={t} />
        </Suspense>
      </Canvas>
      <p className="fixed left-2 top-2 rounded bg-black/70 px-2 py-1 font-mono text-sm text-white">
        {who} {variant} · {action} · t={t}s · {view}
      </p>
    </div>
  );
}
