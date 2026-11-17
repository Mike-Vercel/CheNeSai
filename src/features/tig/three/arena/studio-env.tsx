"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { BackSide, BoxGeometry, Color, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene } from "three";
import { TIG } from "../palette";

/**
 * AMBIENTE RIFLESSO DA STUDIO TV, generato in codice (nessun file HDR): una stanza nera con i "softbox" dello show —
 * una chiave calda grande davanti in alto, due strisce di controluce ambra (sinistra) e ciano (destra), un cielo di
 * fari freddi sopra. Dà ai metalli delle torri, al palco e ai personaggi riflessi e bordi di luce da studio vero.
 */
function buildStudioScene(): Scene {
  const scene = new Scene();
  scene.background = new Color("#020305");
  const room = new Mesh(new BoxGeometry(40, 20, 40), new MeshBasicMaterial({ color: "#05070b", side: BackSide }));
  room.position.y = 6;
  scene.add(room);
  const panel = (w: number, h: number, color: string, intensity: number, x: number, y: number, z: number, rx: number, ry: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity), side: 2 }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    scene.add(m);
  };
  // chiave neutra davanti (morbida, grande): sui metalli lucidi un riflesso pulito, non arancione
  panel(10, 4, "#f2f4f8", 1.5, 0, 9, 14, -0.6, 0);
  // controluce ambra e ciano (strisce verticali ai lati, un po' dietro)
  panel(1.6, 10, TIG.amber, 3.0, -15, 5, -6, 0, Math.PI / 2.6);
  panel(1.6, 10, TIG.cyan, 2.6, 15, 5, -6, 0, -Math.PI / 2.6);
  // fari freddi sopra l'arena (cielo di americana)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    panel(1.2, 1.2, "#dfe9ff", 2.4, Math.sin(a) * 8, 13.5, Math.cos(a) * 8, Math.PI / 2, 0);
  }
  // pavimento leggermente caldo (rimbalzo)
  panel(30, 30, "#0d0b09", 0.5, 0, -3.5, 0, -Math.PI / 2, 0);
  return scene;
}

export function StudioEnvironment({ intensity = 0.55 }: { intensity?: number }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const src = buildStudioScene();
    const env = pmrem.fromScene(src, 0.035).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    src.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as MeshBasicMaterial).dispose();
      }
    });
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [get, intensity]);
  return null;
}
