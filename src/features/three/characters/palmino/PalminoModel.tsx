"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import type { CharacterModelProps } from "../types";
import { PalminoRuntime } from "./runtime";

/** Altezza visibile di Palmino (dai piedi alla cima delle foglie), in metri. */
export const PALMINO_HEIGHT: number = 1.6;

/**
 * PALMINO — palma-mascotte procedurale (img2threejs, costruita in codice dal render ufficiale).
 * Origine ai piedi, guarda verso +Z. Corpo = 1 SkinnedMesh rigido (23 ossa), chioma = 1
 * InstancedMesh: 2 draw call in tutto.
 *
 * Animazioni: idle, intro, talk, wave, celebrate, surprised, point (cross-fade 0.3 s).
 * `mouthOpen` (0..1) apre la mandibola a ogni frame (lip-sync); mentre parla il sorriso
 * di base si chiude così la bocca segue la voce.
 */
export function PalminoModel(props: CharacterModelProps) {
  const { animation = "idle", mouthOpen, speed = 1, lowPower = false, ...groupProps } = props;
  const groupRef = useRef<Group>(null);
  const runtimeRef = useRef<PalminoRuntime | null>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const runtime = new PalminoRuntime(gl, lowPower);
    group.add(runtime.object);
    runtimeRef.current = runtime;
    return () => {
      runtimeRef.current = null;
      runtime.dispose();
    };
  }, [gl, lowPower]);

  useFrame((_, delta) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.syncEnvironment(scene.environment);
    runtime.update(delta, animation, mouthOpen, speed);
  });

  return <group ref={groupRef} {...groupProps} />;
}
