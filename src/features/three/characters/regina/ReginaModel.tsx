"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { CharacterModelProps } from "../types";
import { REGINA_TOP } from "./build";
import { ReginaRig } from "./rig";

/**
 * LA REGINA — presentatrice di "CHE NE SAI?!".
 * Modello 3D procedurale (img2threejs, profilo character) costruito in codice
 * dall'illustrazione ufficiale: busto dai fianchi in su, origine alla base del
 * busto, +Y in alto, guarda verso +Z. Microfono nella mano sinistra (+X),
 * vassoio con birra, palmetta e noccioline sul palmo destro (-X).
 *
 * Draw call: 4 SkinnedMesh (pelle/stoffa, lucido, oro, vetro) su un unico scheletro.
 */
export const REGINA_HEIGHT: number = REGINA_TOP;

export function ReginaModel({ animation = "idle", mouthOpen = 0, speed = 1, lowPower = false, ...groupProps }: CharacterModelProps) {
  const gl = useThree((s) => s.gl);
  const rig = useMemo(() => new ReginaRig(gl, lowPower), [gl, lowPower]);

  useEffect(() => () => rig.dispose(), [rig]);

  useFrame((_, delta) => {
    rig.update(delta, animation, mouthOpen, speed);
  });

  return (
    <group {...groupProps}>
      <primitive object={rig.root} />
    </group>
  );
}

export default ReginaModel;
