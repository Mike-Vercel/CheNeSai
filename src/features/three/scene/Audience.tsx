"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
  type MeshLambertMaterial,
  type ShaderMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useIntroClock } from "./clock";
import { BRAND, createLookOut, sampleLook } from "./look";
import { crowdLevel } from "../crowd";
import { T, mulberry32, prog, smooth } from "../timeline";

/**
 * Pubblico stilizzato sulle gradinate ai lati (in fondo, nella penombra):
 * corpi, teste e braccia istanziati (4 draw call in tutto), animati in CPU con matrici
 * preallocate. Applaude e alza le braccia sui momenti forti (crowd.ts).
 */

interface Person {
  base: Matrix4;
  pos: Vector3;
  yaw: number;
  scale: number;
  phase: number;
  /** Questa persona alza le braccia nelle ovazioni. */
  cheers: boolean;
}

const PALETTE = ["#6b2fb8", "#0f7fa8", "#b8243f", "#c99a1c", "#1d4fbf", "#b8336f", "#d9d2e6", "#2f8f5b", "#e06a2a"];
const SKIN = ["#f1c7a2", "#d9a37d", "#b77a52", "#8a5638", "#f5d6bd"];

/**
 * Arena: gradinate curve attorno al palco (lati e fondo), che salgono a ogni fila.
 * Angolo phi misurato dal centro del palco: x = R*sin(phi), z = R*cos(phi) (+z verso la camera).
 */
export const ARENA = {
  r0: 16.5,
  rowDepth: 1.7,
  rowRise: 1.45,
  phiFrom: (88 * Math.PI) / 180,
  phiTo: (168 * Math.PI) / 180,
} as const;

/** Nascosto dietro al LED wall (non serve disegnarlo). */
function hiddenByWall(x: number, y: number, z: number) {
  return Math.abs(x) < 13.6 && z < -9.6 && y + 1.75 < 11.0;
}

function buildPeople(rows: number, spacing: number): Person[] {
  const rnd = mulberry32(2024);
  const people: Person[] = [];
  for (const side of [-1, 1]) {
    for (let r = 0; r < rows; r++) {
      const R = ARENA.r0 + r * ARENA.rowDepth;
      const y = r * ARENA.rowRise;
      const step = spacing / R;
      for (let phi = ARENA.phiFrom + (r % 2) * step * 0.5; phi < ARENA.phiTo; phi += step) {
        const rr = R + (rnd() - 0.5) * 0.25;
        const ang = phi + (rnd() - 0.5) * step * 0.25;
        const px = side * rr * Math.sin(ang);
        const pz = rr * Math.cos(ang);
        if (hiddenByWall(px, y, pz)) continue;
        // guardano il centro del palco
        const yaw = Math.atan2(0 - px, 0.5 - pz);
        const scale = 0.9 + rnd() * 0.22;
        const pos = new Vector3(px, y, pz);
        const base = new Matrix4().compose(pos, new Quaternion().setFromEuler(new Euler(0, yaw, 0)), new Vector3(scale, scale, scale));
        people.push({ base, pos, yaw, scale, phase: rnd() * Math.PI * 2, cheers: rnd() < 0.5 });
      }
    }
  }
  return people;
}

// matrici temporanee (nessuna allocazione per frame)
const mBody = new Matrix4();
const mLocal = new Matrix4();
const mTmp = new Matrix4();
const qTmp = new Quaternion();
const eTmp = new Euler();
const vTmp = new Vector3();
const vOne = new Vector3(1, 1, 1);

export function Audience({ lowPower }: { lowPower: boolean }) {
  const clock = useIntroClock();
  const rows = lowPower ? 4 : 7;
  const people = useMemo(() => buildPeople(rows, lowPower ? 1.05 : 0.78), [rows, lowPower]);
  const look = useMemo(() => createLookOut(), []);
  const lights = useRef<ShaderMaterial>(null);
  // torce dei telefoni: una persona su 6 circa, sopra la testa
  const phoneGeo = useMemo(() => {
    const rnd = mulberry32(99);
    const pts: number[] = [];
    const seeds: number[] = [];
    for (const p of people) {
      if (rnd() > 0.17) continue;
      pts.push(p.pos.x + (rnd() - 0.5) * 0.3, p.pos.y + 2.0 * p.scale, p.pos.z);
      seeds.push(rnd());
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
    return g;
  }, [people]);
  useEffect(() => () => phoneGeo.dispose(), [phoneGeo]);
  const phoneUniforms = useMemo(() => ({ uTime: { value: 0 }, uScale: { value: 500 }, uLevel: { value: 0 } }), []);
  const n = people.length;
  const torso = useRef<InstancedMesh>(null);
  const head = useRef<InstancedMesh>(null);
  const arms = useRef<InstancedMesh>(null);

  const geos = useMemo(() => {
    const t = new CylinderGeometry(0.19, 0.26, 0.72, 7);
    t.translate(0, 1.0, 0);
    const h = new IcosahedronGeometry(0.16, 1);
    h.translate(0, 1.55, 0);
    const a = new BoxGeometry(0.09, 0.55, 0.09);
    a.translate(0, -0.27, 0); // perno alla spalla
    return { t, h, a };
  }, []);
  useEffect(
    () => () => {
      geos.t.dispose();
      geos.h.dispose();
      geos.a.dispose();
    },
    [geos],
  );

  // colori per istanza (una volta)
  useEffect(() => {
    const rnd = mulberry32(77);
    const c = new Color();
    for (let i = 0; i < n; i++) {
      c.set(PALETTE[Math.floor(rnd() * PALETTE.length)]).multiplyScalar(0.55 + rnd() * 0.35);
      torso.current?.setColorAt(i, c);
      arms.current?.setColorAt(i * 2, c);
      arms.current?.setColorAt(i * 2 + 1, c);
      c.set(SKIN[Math.floor(rnd() * SKIN.length)]).multiplyScalar(0.7);
      head.current?.setColorAt(i, c);
    }
    for (const m of [torso.current, head.current, arms.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true;
  }, [n]);

  useFrame(() => {
    const tm = torso.current;
    const hm = head.current;
    const am = arms.current;
    if (!tm || !hm || !am) return;
    const { t, e, reducedMotion } = clock.current;
    // in sala si accende con lo studio
    const on = smooth(prog(t, T.studioOn, T.studioOn + 2));
    const { clap, cheer } = crowdLevel(t);
    const amp = reducedMotion ? 0.4 : 1;
    for (let i = 0; i < n; i++) {
      const p = people[i];
      const ph = p.phase;
      // molleggio: più forte quando applaudono
      const bob = (Math.sin(e * 1.3 + ph) * 0.02 + Math.abs(Math.sin(e * 4.6 + ph)) * 0.07 * clap) * amp;
      mBody.copy(p.base);
      mBody.elements[13] += bob;
      tm.setMatrixAt(i, mBody);
      hm.setMatrixAt(i, mBody);
      // braccia: riposo → applauso (avanti, mani che si toccano) → ovazione (in alto)
      const up = p.cheers ? cheer : 0;
      const clapK = clap * (1 - up);
      const beat = 0.5 + 0.5 * Math.sin(e * 9.5 + ph * 3); // ~1.5 battiti/s
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? -1 : 1;
        const rx = -0.12 * (1 - clapK) - 1.25 * clapK - 2.85 * up + Math.sin(e * 6 + ph + s) * 0.18 * up;
        const rz = -side * (0.1 + clapK * (0.32 + 0.22 * beat) * amp + up * 0.25);
        eTmp.set(rx, 0, rz);
        qTmp.setFromEuler(eTmp);
        vTmp.set(side * 0.24, 1.3, 0);
        mLocal.compose(vTmp, qTmp, vOne);
        mTmp.multiplyMatrices(mBody, mLocal);
        am.setMatrixAt(i * 2 + s, mTmp);
      }
    }
    tm.instanceMatrix.needsUpdate = true;
    hm.instanceMatrix.needsUpdate = true;
    am.instanceMatrix.needsUpdate = true;
    // luminosità complessiva (penombra → luce di sala)
    sampleLook(t, look);
    for (const m of [tm, hm, am]) {
      const mat = m.material as MeshLambertMaterial;
      mat.color.setScalar(0.35 + 0.65 * on);
      // luci colorate di sala sul pubblico (costo zero: emissivo del colore del momento)
      mat.emissive.copy(look.rim).multiplyScalar(0.06 + 0.16 * on);
    }
    const lm = lights.current;
    if (lm) {
      lm.uniforms.uTime.value = e;
      lm.uniforms.uScale.value = clock.current.pointScale;
      lm.uniforms.uLevel.value = on * (0.45 + 0.55 * Math.max(clap, cheer));
    }
  });

  return (
    <group>
      <instancedMesh ref={torso} args={[geos.t, undefined, n]} frustumCulled={false}>
        <meshLambertMaterial emissive={BRAND.violet} emissiveIntensity={0.08} />
      </instancedMesh>
      <instancedMesh ref={head} args={[geos.h, undefined, n]} frustumCulled={false}>
        <meshLambertMaterial emissive="#3a1a10" emissiveIntensity={0.1} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[geos.a, undefined, n * 2]} frustumCulled={false}>
        <meshLambertMaterial emissive={BRAND.violet} emissiveIntensity={0.08} />
      </instancedMesh>
      <points geometry={phoneGeo} frustumCulled={false} renderOrder={5}>
        <shaderMaterial ref={lights} vertexShader={PHONE_VERTEX} fragmentShader={PHONE_FRAGMENT} uniforms={phoneUniforms} transparent depthWrite={false} blending={AdditiveBlending} />
      </points>
      <Bleachers rows={rows} />
    </group>
  );
}

/** Gradinate curve (parapetto + alzata + pedana per fila) fuse in poche mesh, con un filo neon sul bordo. */
function Bleachers({ rows }: { rows: number }) {
  const clock = useIntroClock();
  const neon = useMemo(() => new MeshBasicMaterial({ color: "#000000", toneMapped: false }), []);
  const { stands, edges } = useMemo(() => {
    const standParts: BufferGeometry[] = [];
    const edgeParts: BufferGeometry[] = [];
    const len = ARENA.phiTo - ARENA.phiFrom + 0.06;
    for (const side of [-1, 1]) {
      // CylinderGeometry: x = r·sin θ, z = r·cos θ → θ coincide con phi (lato sinistro: θ negativi)
      const start = side > 0 ? ARENA.phiFrom - 0.03 : -ARENA.phiTo - 0.03;
      for (let r = 0; r < rows; r++) {
        const R = ARENA.r0 + r * ARENA.rowDepth;
        const y = r * ARENA.rowRise;
        const wall = new CylinderGeometry(R - 0.75, R - 0.75, 0.85, 48, 1, true, start, len);
        wall.translate(0, y + 0.42, 0);
        standParts.push(wall.toNonIndexed());
        if (r > 0) {
          const riser = new CylinderGeometry(R - 0.8, R - 0.8, ARENA.rowRise, 48, 1, true, start, len);
          riser.translate(0, y - ARENA.rowRise / 2, 0);
          standParts.push(riser.toNonIndexed());
        }
        // pedana: anello orizzontale (RingGeometry ruotato: angolo di partenza riallineato a θ)
        const floor = new RingGeometry(R - 0.8, R + 0.9, 48, 1, start - Math.PI / 2, len);
        floor.rotateX(-Math.PI / 2);
        floor.translate(0, y, 0);
        standParts.push(floor.toNonIndexed());
        const edge = new CylinderGeometry(R - 0.72, R - 0.72, 0.05, 48, 1, true, start, len);
        edge.translate(0, y + 0.86, 0);
        edgeParts.push(edge.toNonIndexed());
      }
    }
    const merged = { stands: mergeGeometries(standParts) ?? new BufferGeometry(), edges: mergeGeometries(edgeParts) ?? new BufferGeometry() };
    for (const g of [...standParts, ...edgeParts]) g.dispose();
    return merged;
  }, [rows]);
  useEffect(
    () => () => {
      neon.dispose();
      stands.dispose();
      edges.dispose();
    },
    [neon, stands, edges],
  );
  useFrame(() => {
    const { t, e } = clock.current;
    const on = smooth(prog(t, T.studioOn + 0.5, T.studioOn + 2));
    neon.color.set(BRAND.fuchsia).multiplyScalar((0.05 + 1.1 * on) * (0.85 + 0.15 * Math.sin(e * 2)));
  });
  return (
    <>
      <mesh geometry={stands}>
        <meshStandardMaterial color="#1a0b2a" roughness={0.75} metalness={0.2} side={DoubleSide} />
      </mesh>
      <mesh geometry={edges} material={neon} />
    </>
  );
}

const PHONE_VERTEX = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uScale;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position + vec3(sin(uTime * 1.3 + aSeed * 40.0) * 0.25, 0.0, 0.0), 1.0);
    // ondeggiano e ogni tanto si accendono di più
    vA = 0.55 + 0.45 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 60.0);
    gl_PointSize = 0.42 * uScale / max(0.001, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const PHONE_FRAGMENT = /* glsl */ `
  uniform float uLevel;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float g = exp(-d * d * 7.0) + exp(-d * d * 60.0);
    gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * g * vA * uLevel, 1.0);
    #include <colorspace_fragment>
  }
`;
