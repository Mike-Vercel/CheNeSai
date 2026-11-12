"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, CanvasTexture, Color, Group, MeshBasicMaterial, SphereGeometry, SRGBColorSpace, type BufferGeometry, type ShaderMaterial, type ShaderMaterialParameters } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Il CERVELLO luminoso al centro della ruota (brief §6, mockup approvato), costruito in codice:
 * due emisferi ellissoidali con circonvoluzioni scavate (solchi meandriformi da un campo a seni deformati),
 * visti dall'alto come l'icona del mockup. Materiale a shader leggero: superficie verde scuro, solchi al neon
 * che pulsano, bordo luminoso (fresnel) e alone additivo. `glowRef` (0..1) lo accende di più durante il giro.
 */

const NEON = new Color("#39FF14");
const DEEP = new Color("#0a4d1d");

/**
 * Campo dei solchi: le linee di livello zero di un'onda trasversale deformata da altre onde sono meandri lunghi,
 * simili alle circonvoluzioni viste dall'alto.
 */
function sulcusField(x: number, y: number, z: number): number {
  return Math.sin(17 * y + 2.4 * Math.sin(6.1 * Math.abs(x) + 0.7) + 1.3 * Math.sin(11.3 * x + 4.7 * y) + 0.9 * Math.sin(9.7 * x - 3.1 * y + 1.9) + 4.4 * z);
}

const geoCache = new Map<string, BufferGeometry>();
/** distanza del centro di ogni emisfero dal piano mediano e larghezza totale risultante */
const SX = 0.46;
const MEDIAL = 0.35;
const OFF = SX * MEDIAL + 0.012;
const TOTAL_W = 2 * (OFF + SX);

/** Un emisfero (side = −1 sinistro, +1 destro), unità: larghezza totale del cervello = TOTAL_W. */
function hemisphere(side: -1 | 1, detail: "high" | "low"): BufferGeometry {
  const key = `${side}:${detail}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const g = new SphereGeometry(1, detail === "high" ? 110 : 56, detail === "high" ? 80 : 40);
  const pos = g.attributes.position as BufferAttribute;
  const groove = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    // la sfera ha l'asse dei poli su Y: lo usiamo come asse fronte-retro (verso l'alto dello schermo)
    // parete mediale quasi verticale: la superficie arriva fino alla scissura e i due emisferi si toccano
    if (x * side < 0) x = -side * MEDIAL * Math.pow(Math.abs(x), 0.35);
    if (z < 0) z *= 0.35; // il retro non si vede
    // lobo frontale un po' più stretto, occipitale più largo
    const taper = 1 - 0.12 * Math.max(0, y);
    const sx = SX * taper;
    const sy = 0.8;
    const sz = 0.46;
    const px = x * sx + side * OFF;
    const py = y * sy;
    const pz = z * sz;
    const n = sulcusField(px, py, pz);
    const a = Math.abs(n);
    const g01 = 1 - Math.min(1, a / 0.36);
    const depth = g01 * g01 * (3 - 2 * g01);
    // solco: rientra lungo la normale approssimata (direzione dal centro dell'emisfero), solo sul davanti
    const front = Math.max(0, Math.min(1, z * 2 + 0.6));
    const k = 1 - 0.085 * depth * front;
    pos.setXYZ(i, side * OFF + (px - side * OFF) * k, py * k, pz * k);
    groove[i] = depth * front;
  }
  g.setAttribute("groove", new BufferAttribute(groove, 1));
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

/** Cervello intero (due emisferi in una sola geometria: un solo draw call). */
function brainGeometry(detail: "high" | "low"): BufferGeometry {
  const key = "brain:" + detail;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const g = mergeGeometries([hemisphere(-1, detail), hemisphere(1, detail)]) as BufferGeometry;
  geoCache.set(key, g);
  return g;
}

function materialParams(): ShaderMaterialParameters {
  return {
    uniforms: {
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uNeon: { value: NEON.clone() },
      uDeep: { value: DEEP.clone() },
    },
    vertexShader: /* glsl */ `
      attribute float groove;
      varying float vGroove;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vP;
      void main() {
        vGroove = groove;
        vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uGlow;
      uniform vec3 uNeon;
      uniform vec3 uDeep;
      varying float vGroove;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vP;
      void main() {
        vec3 n = normalize(vN);
        float fres = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.4);
        float light = 0.5 + 0.7 * max(dot(n, normalize(vec3(-0.4, 0.6, 0.8))), 0.0);
        // impulso che scorre dal davanti al retro (pensiero in corsa), più veloce col glow
        float wave = 0.5 + 0.5 * sin(vP.y * 7.0 - uTime * (2.2 + 5.0 * uGlow));
        float lines = smoothstep(0.25, 0.95, vGroove) * (0.75 + 0.55 * wave) * (1.0 + 0.9 * uGlow);
        vec3 col = uDeep * light * (1.3 + 0.5 * uGlow) * (1.0 - 0.6 * lines) + uNeon * lines * 1.5 + uNeon * fres * (0.7 + 0.6 * uGlow);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    toneMapped: false,
  };
}

function haloTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(120,255,90,0.9)");
  g.addColorStop(0.35, "rgba(57,255,20,0.35)");
  g.addColorStop(1, "rgba(57,255,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface Brain3DProps {
  /** larghezza totale del cervello (unità di scena) */
  width: number;
  detail: "high" | "low";
  /** 0..1 letto a ogni fotogramma: più luce durante il giro e all'arresto */
  glowRef: RefObject<number>;
  /** false = fermo (movimento ridotto) */
  animate: boolean;
}

export function Brain3D({ width, detail, glowRef, animate }: Brain3DProps) {
  const geo = useMemo(() => brainGeometry(detail), [detail]);
  const params = useMemo(() => materialParams(), []);
  const halo = useMemo(() => haloTexture(), []);
  const mat = useRef<ShaderMaterial>(null);
  const group = useRef<Group>(null);
  const haloMat = useRef<MeshBasicMaterial>(null);
  useEffect(() => () => halo.dispose(), [halo]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const glow = Math.max(0, Math.min(1, glowRef.current ?? 0));
    if (mat.current) {
      mat.current.uniforms.uTime.value = animate ? t : 0;
      mat.current.uniforms.uGlow.value = glow;
    }
    if (group.current) {
      const breathe = animate ? 1 + 0.025 * Math.sin(t * 2.1) + 0.03 * glow : 1;
      group.current.scale.setScalar((width / TOTAL_W) * breathe);
    }
    if (haloMat.current) haloMat.current.opacity = 0.55 + 0.35 * glow + (animate ? 0.08 * Math.sin(t * 2.1) : 0);
  });
  return (
    <group ref={group}>
      <mesh position-z={-0.12} scale={TOTAL_W * 1.9}>
        <planeGeometry />
        <meshBasicMaterial ref={haloMat} map={halo} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh geometry={geo}>
        <shaderMaterial ref={mat} args={[params]} />
      </mesh>
    </group>
  );
}
