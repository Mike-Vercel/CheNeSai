"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  SphereGeometry,
  Vector3,
  type ShaderMaterial,
} from "three";
import { useIntroClock } from "./clock";
import { bulbCoreFragment, bulbCoreVertex, bulbHaloFragment, bulbHaloVertex } from "./shaders";
import { prog } from "../timeline";

export interface MarqueeProps {
  /** Punti delle lampadine (già in coordinate locali del gruppo). */
  points: readonly Vector3[];
  color?: string;
  /** Secondo colore alternato (lampadine bicolore). */
  color2?: string;
  radius?: number;
  haloSize?: number;
  /** Finestra di accensione progressiva (secondi di timeline). */
  onFrom: number;
  onTo: number;
  /** Intensità dell'effetto "inseguimento" 0..1. */
  chase?: number;
  /** Nel blackout le lampadine "respirano" a caso. */
  idleTwinkle?: boolean;
}

const tmpM = new Matrix4();

export function Marquee({ points, color = "#FFD9A0", color2, radius = 0.09, haloSize = 0.9, onFrom, onTo, chase = 1, idleTwinkle = false }: MarqueeProps) {
  const clock = useIntroClock();
  const coreRef = useRef<InstancedMesh>(null);
  const coreMat = useRef<ShaderMaterial>(null);
  const haloMat = useRef<ShaderMaterial>(null);
  const count = points.length;

  const { sphere, haloGeo, attrs } = useMemo(() => {
    const idx = new Float32Array(count);
    const phase = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const pos = new Float32Array(count * 3);
    const c1 = new Color(color);
    const c2 = new Color(color2 ?? color);
    for (let i = 0; i < count; i++) {
      idx[i] = count > 1 ? i / (count - 1) : 0;
      phase[i] = i / count;
      const c = i % 2 === 0 ? c1 : c2;
      col.set([c.r, c.g, c.b], i * 3);
      pos.set([points[i].x, points[i].y, points[i].z], i * 3);
    }
    const sphereGeo = new SphereGeometry(1, 10, 8);
    sphereGeo.setAttribute("aIdx", new InstancedBufferAttribute(idx, 1));
    sphereGeo.setAttribute("aPhase", new InstancedBufferAttribute(phase, 1));
    sphereGeo.setAttribute("aColor", new InstancedBufferAttribute(col, 3));
    const halo = new BufferGeometry();
    halo.setAttribute("position", new Float32BufferAttribute(pos, 3));
    halo.setAttribute("aIdx", new Float32BufferAttribute(idx, 1));
    halo.setAttribute("aPhase", new Float32BufferAttribute(phase, 1));
    halo.setAttribute("aColor", new Float32BufferAttribute(col, 3));
    return { sphere: sphereGeo, haloGeo: halo, attrs: pos };
  }, [points, count, color, color2]);

  useEffect(() => {
    const mesh = coreRef.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      tmpM.makeScale(radius, radius, radius);
      tmpM.setPosition(attrs[i * 3], attrs[i * 3 + 1], attrs[i * 3 + 2]);
      mesh.setMatrixAt(i, tmpM);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [attrs, count, radius]);

  useEffect(
    () => () => {
      sphere.dispose();
      haloGeo.dispose();
    },
    [sphere, haloGeo],
  );

  const coreUniforms = useMemo(() => ({ uTime: { value: 0 }, uOn: { value: 0 }, uChase: { value: chase }, uIdle: { value: 0 } }), [chase]);
  const haloUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOn: { value: 0 },
      uChase: { value: chase },
      uScale: { value: 500 },
      uSize: { value: haloSize },
      uIdle: { value: 0 },
    }),
    [chase, haloSize],
  );

  useFrame(() => {
    const c = clock.current;
    const on = prog(c.t, onFrom, onTo);
    const idle = idleTwinkle && on < 1 ? 0.6 * (1 - on) : 0;
    const cm = coreMat.current;
    if (cm) {
      cm.uniforms.uTime.value = c.e;
      cm.uniforms.uOn.value = on;
      cm.uniforms.uIdle.value = 0;
      cm.uniforms.uChase.value = c.reducedMotion ? chase * 0.4 : chase;
    }
    const hm = haloMat.current;
    if (hm) {
      hm.uniforms.uTime.value = c.e;
      hm.uniforms.uOn.value = on;
      hm.uniforms.uScale.value = c.pointScale;
      hm.uniforms.uIdle.value = idle;
      hm.uniforms.uChase.value = c.reducedMotion ? chase * 0.4 : chase;
    }
  });

  return (
    <group>
      <instancedMesh ref={coreRef} args={[sphere, undefined, count]} frustumCulled={false}>
        <shaderMaterial ref={coreMat} vertexShader={bulbCoreVertex} fragmentShader={bulbCoreFragment} uniforms={coreUniforms} />
      </instancedMesh>
      <points geometry={haloGeo} frustumCulled={false} renderOrder={5}>
        <shaderMaterial
          ref={haloMat}
          vertexShader={bulbHaloVertex}
          fragmentShader={bulbHaloFragment}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** Punti equidistanti lungo un arco "a portale" (due montanti + semiellisse). */
export function archPoints(halfWidth: number, legHeight: number, archHeight: number, spacing: number, z = 0): Vector3[] {
  const pts: Vector3[] = [];
  const samples: Vector3[] = [];
  const N = 400;
  // percorso: da (-w,0) su fino a (-w,leg), semiellisse, giù a (w,0)
  for (let i = 0; i <= N; i++) samples.push(new Vector3(-halfWidth, (legHeight * i) / N, z));
  for (let i = 1; i <= N; i++) {
    const a = Math.PI - (Math.PI * i) / N;
    samples.push(new Vector3(Math.cos(a) * halfWidth, legHeight + Math.sin(a) * archHeight, z));
  }
  for (let i = 1; i <= N; i++) samples.push(new Vector3(halfWidth, legHeight - (legHeight * i) / N, z));
  let acc = 0;
  pts.push(samples[0].clone());
  for (let i = 1; i < samples.length; i++) {
    acc += samples[i].distanceTo(samples[i - 1]);
    if (acc >= spacing) {
      pts.push(samples[i].clone());
      acc = 0;
    }
  }
  return pts;
}

/** Punti lungo il perimetro di un rettangolo. */
export function rectPoints(w: number, h: number, spacing: number, z = 0): Vector3[] {
  const pts: Vector3[] = [];
  const nx = Math.max(2, Math.round(w / spacing));
  const ny = Math.max(2, Math.round(h / spacing));
  for (let i = 0; i < nx; i++) pts.push(new Vector3(-w / 2 + (w * i) / nx, -h / 2, z));
  for (let i = 0; i < ny; i++) pts.push(new Vector3(w / 2, -h / 2 + (h * i) / ny, z));
  for (let i = 0; i < nx; i++) pts.push(new Vector3(w / 2 - (w * i) / nx, h / 2, z));
  for (let i = 0; i < ny; i++) pts.push(new Vector3(-w / 2, h / 2 - (h * i) / ny, z));
  return pts;
}

/** Punti lungo un'ellisse. */
export function ellipsePoints(rx: number, ry: number, count: number, z = 0): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.PI / 2 - (i / count) * Math.PI * 2;
    pts.push(new Vector3(Math.cos(a) * rx, Math.sin(a) * ry, z));
  }
  return pts;
}
