"use client";

/**
 * IL PROFESSORE — modello 3D procedurale (img2threejs, profilo character)
 * ricostruito dall'illustrazione ufficiale. Busto fino alla cintura, origine
 * alla base del busto, guarda +Z, alto PROFESSORE_HEIGHT.
 *
 * Gerarchia ossa: root › pelvis › spine › chest › neck › head › (jaw, stache,
 * palpebre, sopracciglia) e chest › upperArm › foreArm › hand › dita (L/R).
 * Una SkinnedMesh per materiale (8 draw call), animazioni procedurali in
 * useFrame con dissolvenza di 0.3 s, IK a due ossa per le braccia.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { CharacterModelProps } from "../types";
import { PROFESSORE_MODEL_HEIGHT, ProfessoreRig } from "./ProfessoreRig";
import { PROJ_TEXTURE_URL } from "./projection";

export const PROFESSORE_HEIGHT: number = PROFESSORE_MODEL_HEIGHT;


export function ProfessoreModel({ animation = "idle", mouthOpen, speed = 1, lowPower = false, ...group }: CharacterModelProps) {
  const rig = useMemo(() => new ProfessoreRig(lowPower), [lowPower]);

  useEffect(() => {
    const cancelProj = rig.loadProjection(PROJ_TEXTURE_URL);
    return () => {
      cancelProj();
      rig.dispose();
    };
  }, [rig]);

  useFrame((_, delta) => {
    rig.setAnimation(animation);
    rig.update(delta * speed, mouthOpen);
  });

  return (
    <group {...group}>
      <primitive object={rig.root} />
    </group>
  );
}

export default ProfessoreModel;
