"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  type ShaderMaterial,
  type Vector3Tuple,
} from "three";
import { useIntroClock } from "./clock";
import { BRAND } from "./look";
import { burstFragment, burstVertex, confettiFragment, confettiVertex, dustFragment, dustVertex } from "./shaders";
import { T, mulberry32, prog } from "../timeline";

// ------------------------------------------------------------------ polvere dorata sospesa
export function GoldDust({ count }: { count: number }) {
  const clock = useIntroClock();
  const mat = useRef<ShaderMaterial>(null);
  const geo = useMemo(() => {
    const rnd = mulberry32(4242);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 30;
      pos[i * 3 + 1] = rnd() * 13;
      pos[i * 3 + 2] = -9 + rnd() * 16;
      seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 4));
    return g;
  }, [count]);
  useEffect(() => () => geo.dispose(), [geo]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScale: { value: 500 },
      uSize: { value: 0.16 },
      uBox: { value: [30, 13, 16] },
      uColor: { value: new Color(BRAND.gold) },
      uOpacity: { value: 0 },
    }),
    [],
  );
  useFrame(() => {
    const m = mat.current;
    if (!m) return;
    const { t, e, pointScale } = clock.current;
    m.uniforms.uTime.value = e;
    m.uniforms.uScale.value = pointScale;
    // nel blackout poche scintille, poi piena intensità
    m.uniforms.uOpacity.value = 0.25 + 0.75 * prog(t, T.studioOn, T.studioOn + 2);
  });
  return (
    <points geometry={geo} frustumCulled={false} renderOrder={4}>
      <shaderMaterial ref={mat} vertexShader={dustVertex} fragmentShader={dustFragment} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} />
    </points>
  );
}

// ------------------------------------------------------------------ esplosione di scintille (Palmino)
export function SparkBurst({ at, origin, count, colors }: { at: number; origin: Vector3Tuple; count: number; colors: readonly string[] }) {
  const clock = useIntroClock();
  const mat = useRef<ShaderMaterial>(null);
  const geo = useMemo(() => {
    const rnd = mulberry32(911 + count);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const col = new Float32Array(count * 3);
    const c = new Color();
    for (let i = 0; i < count; i++) {
      pos.set(origin, i * 3);
      // direzione su sfera, più verso l'alto
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      seed.set([r * Math.cos(th), Math.abs(u) * 0.8 + 0.2, r * Math.sin(th) * 0.6, 3 + rnd() * 6], i * 4);
      c.set(colors[i % colors.length]);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 4));
    g.setAttribute("aColor", new Float32BufferAttribute(col, 3));
    return g;
  }, [count, origin, colors]);
  useEffect(() => () => geo.dispose(), [geo]);
  const uniforms = useMemo(() => ({ uAge: { value: -1 }, uScale: { value: 500 }, uSize: { value: 0.32 } }), []);
  useFrame(() => {
    const m = mat.current;
    if (!m) return;
    const { t, pointScale } = clock.current;
    m.uniforms.uAge.value = t - at;
    m.uniforms.uScale.value = pointScale;
  });
  return (
    <points geometry={geo} frustumCulled={false} renderOrder={6}>
      <shaderMaterial ref={mat} vertexShader={burstVertex} fragmentShader={burstFragment} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} />
    </points>
  );
}

// ------------------------------------------------------------------ coriandoli digitali
export interface ConfettiProps {
  at: number;
  count: number;
  origin: Vector3Tuple;
  spread: Vector3Tuple;
  colors: readonly string[];
  /** Durata del ciclo; con loop=true pioggia continua (anche nel frame finale). */
  life: number;
  loop?: boolean;
  /** Usa il tempo di storia NON bloccato (continua dopo la fine della timeline). */
  free?: boolean;
  seed?: number;
}

const tmp = new Matrix4();

export function Confetti({ at, count, origin, spread, colors, life, loop = false, free = false, seed = 7 }: ConfettiProps) {
  const clock = useIntroClock();
  const mesh = useRef<InstancedMesh>(null);
  const mat = useRef<ShaderMaterial>(null);
  const geo = useMemo(() => {
    const rnd = mulberry32(seed * 7919 + count);
    const g = new PlaneGeometry(0.16, 0.28);
    const s = new Float32Array(count * 4);
    const col = new Float32Array(count * 3);
    const c = new Color();
    for (let i = 0; i < count; i++) {
      s.set([rnd() * 2 - 1, rnd() * 2 - 1, rnd(), rnd()], i * 4);
      c.set(colors[Math.floor(rnd() * colors.length)]);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("aSeed", new InstancedBufferAttribute(s, 4));
    g.setAttribute("aColor", new InstancedBufferAttribute(col, 3));
    return g;
  }, [count, colors, seed]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    tmp.identity();
    for (let i = 0; i < count; i++) m.setMatrixAt(i, tmp);
    m.instanceMatrix.needsUpdate = true;
  }, [count]);
  const uniforms = useMemo(
    () => ({
      uAge: { value: -1 },
      uLoop: { value: loop ? 1 : 0 },
      uOrigin: { value: origin },
      uSpread: { value: spread },
      uFall: { value: life },
    }),
    [loop, origin, spread, life],
  );
  useFrame(() => {
    const m = mat.current;
    if (!m) return;
    const c = clock.current;
    m.uniforms.uAge.value = (free ? c.s : c.t) - at;
  });
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, count]} frustumCulled={false} renderOrder={7}>
      <shaderMaterial ref={mat} vertexShader={confettiVertex} fragmentShader={confettiFragment} uniforms={uniforms} side={DoubleSide} transparent />
    </instancedMesh>
  );
}
