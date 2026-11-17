"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Riflessi d'ambiente generati in codice (nessun file HDR): danno corpo ai materiali PBR di personaggi, acciaio
 * delle torri e palco. Intensità bassa: l'arena è notturna, la luce vera la fanno i fari.
 */
export function RoomEnvironmentLight({ intensity = 0.4 }: { intensity?: number }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [get, intensity]);
  return null;
}
