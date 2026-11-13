"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Group, type PerspectiveCamera, type PointLight, type ShaderMaterial, type ShaderMaterialParameters } from "three";
import { characterUrl } from "./characters";
import { GiramenteCharacterModel } from "./character-model";
import { Boundary3D, Pace, StudioLights } from "./CharacterStage3D";
import type { VisualQuality } from "./types";

/**
 * Scena 3D del portale della Jolly: anello ellittico al neon verde/rosso, vortice dentro (shader leggero, scrive la
 * profondità: Zafira dietro il portale non si vede e "esce" attraversandolo), particelle che girano sul bordo
 * (calcolate nello shader), luci del portale. Zafira cammina (clip Walking) dal portale verso il pubblico,
 * poi resta in Idle_3 / parlata; all'uscita si gira e rientra, il portale si chiude.
 */

const PORTAL_Y = 1.0;
const PORTAL_R = 1.08;
const PORTAL_SX = 0.62;
const Z_BEHIND = -0.95;
const Z_FRONT = 0.35;
const T_OPEN = 0.25;
const T_WALK = 0.9;
const WALK_S = 1.7;
const EXIT_TURN = 0.4;
const EXIT_WALK = 1.0;
const EXIT_TOTAL = 1.7;

const sm = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

function vortexMaterial(): ShaderMaterialParameters {
  return {
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uG: { value: new Color("#39FF14") }, uR: { value: new Color("#FF253A") } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uOpen; uniform vec3 uG; uniform vec3 uR;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        // spirale: sottili bracci verdi e rossi alternati che ruotano e si avvitano verso il centro, su fondo scuro
        float sw = a * 3.0 + r * 9.0 - uTime * 2.6;
        float g = pow(0.5 + 0.5 * sin(sw), 7.0);
        float rr = pow(0.5 + 0.5 * sin(sw + 3.14159), 7.0);
        float flick = 0.75 + 0.25 * sin(a * 5.0 - r * 14.0 + uTime * 1.7);
        float edge = smoothstep(0.55, 1.0, r);
        vec3 col = vec3(0.012, 0.03, 0.02) + (uG * g + uR * rr) * (0.35 + 1.1 * edge) * flick;
        col += mix(uG, vec3(1.0), 0.5) * pow(1.0 - r, 5.0) * 0.45;
        gl_FragColor = vec4(col * uOpen, 1.0);
      }
    `,
    toneMapped: false,
  };
}

function ringMaterial(): ShaderMaterialParameters {
  return {
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uG: { value: new Color("#39FF14") }, uR: { value: new Color("#FF253A") } },
    vertexShader: /* glsl */ `
      varying vec3 vP;
      void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uOpen; uniform vec3 uG; uniform vec3 uR;
      varying vec3 vP;
      void main() {
        float a = atan(vP.y, vP.x);
        float k = 0.5 + 0.5 * sin(a * 2.0 + uTime * 3.0);
        vec3 col = mix(uG, uR, k) * (1.6 + 0.6 * sin(a * 12.0 - uTime * 8.0));
        gl_FragColor = vec4(col * uOpen, 1.0);
      }
    `,
    toneMapped: false,
  };
}

function sparkGeometry(count: number): BufferGeometry {
  const g = new BufferGeometry();
  const seed = new Float32Array(count * 3);
  // pseudo-casuale deterministico (stesse scintille a ogni montaggio)
  const rnd = (n: number) => {
    const h = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return h - Math.floor(h);
  };
  for (let i = 0; i < count * 3; i++) seed[i] = rnd(i + 1);
  g.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("seed", new BufferAttribute(seed, 3));
  return g;
}

function sparkMaterial(): ShaderMaterialParameters {
  return {
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uSx: { value: PORTAL_SX }, uR: { value: PORTAL_R }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 seed;
      uniform float uTime; uniform float uOpen; uniform float uSx; uniform float uR; uniform float uPx;
      varying vec3 vCol; varying float vA;
      void main() {
        float life = fract(seed.y + uTime * (0.25 + 0.3 * seed.z));
        float ang = seed.x * 6.2831 + uTime * (0.8 + seed.z) * (seed.x > 0.5 ? 1.0 : -1.0);
        float rad = uR * (1.0 + life * 0.35 * uOpen);
        vec3 p = vec3(cos(ang) * rad * uSx, sin(ang) * rad, (seed.z - 0.5) * 0.3 + life * 0.4);
        vCol = seed.x > 0.5 ? vec3(0.22, 1.0, 0.08) : vec3(1.0, 0.15, 0.23);
        vA = (1.0 - life) * uOpen;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // uPx = pixel per unità a distanza 1 (altezza in pixel reali / 2·tan(fov/2)); scintille di 2–5 cm
        gl_PointSize = uPx * (0.02 + 0.03 * seed.z) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(vCol * 1.8 * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  };
}

function Frame() {
  const last = useRef("");
  useFrame((state) => {
    const cam = state.camera as PerspectiveCamera;
    const { width, height } = state.size;
    const key = `${width}x${height}`;
    if (key === last.current) return;
    last.current = key;
    const bottom = -0.08;
    const top = 2.25;
    const h = top - bottom;
    const aspect = Math.max(0.3, width / Math.max(1, height));
    const halfV = Math.tan((30 * Math.PI) / 360);
    const dist = Math.max(h / 2 / halfV, 1.7 / 2 / (halfV * aspect));
    cam.fov = 30;
    cam.aspect = aspect;
    cam.position.set(0, bottom + h / 2 + 0.1, dist + 0.4);
    cam.lookAt(0, bottom + h / 2, 0);
    cam.updateProjectionMatrix();
  });
  return null;
}

export interface PortalRigProps {
  play: boolean;
  quality: VisualQuality;
  speaking: boolean;
  mouthRef?: RefObject<number>;
  src?: string;
  busyRef: RefObject<boolean>;
  onEntered: () => void;
  onExited: () => void;
}

/**
 * Portale + Zafira + luci del portale, SENZA luci di scena né camera: lo usa questo canvas e lo STUDIO 3D
 * (che lo mette sul palco accanto alla ruota). Origine ai piedi del portale, Zafira esce verso +Z.
 */
export function PortalRig({ play, quality, speaking, mouthRef, src, busyRef, onEntered, onExited }: PortalRigProps) {
  const low = quality !== "high";
  const params = useMemo(() => ({ vortex: vortexMaterial(), ring: ringMaterial(), sparks: sparkMaterial() }), []);
  const vortex = useRef<ShaderMaterial>(null);
  const ring = useRef<ShaderMaterial>(null);
  const sparks = useRef<ShaderMaterial>(null);
  const sparkGeo = useMemo(() => sparkGeometry(low ? 90 : 220), [low]);
  useEffect(() => () => sparkGeo.dispose(), [sparkGeo]);
  const portal = useRef<Group>(null);
  const zafira = useRef<Group>(null);
  const green = useRef<PointLight>(null);
  const red = useRef<PointLight>(null);
  const walk = useRef(0);
  const st = useRef({ t: 0, exitT: -1, zAtExit: Z_BEHIND, entered: false, exited: false, ready: false });
  const cb = useRef({ onEntered, onExited });
  useEffect(() => {
    cb.current = { onEntered, onExited };
  });

  useFrame((state, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const s = st.current;
    if (!s.ready) return; // aspetta il modello: la sequenza parte quando Zafira c'è
    s.t += dt;
    let open: number;
    let z: number;
    let rotY = 0;
    let walking = 0;
    if (!play) {
      if (s.exitT < 0) {
        s.exitT = 0;
        s.zAtExit = zafira.current?.position.z ?? Z_BEHIND;
      }
      s.exitT += dt;
      const e = s.exitT;
      rotY = Math.PI * sm(e / EXIT_TURN);
      const k = sm((e - EXIT_TURN * 0.6) / EXIT_WALK);
      z = s.zAtExit + (Z_BEHIND - s.zAtExit) * k;
      walking = e > EXIT_TURN * 0.5 && k < 0.98 ? 1 : 0;
      open = 0.9 * (1 - sm((e - EXIT_WALK) / (EXIT_TOTAL - EXIT_WALK)));
      if (e >= EXIT_TOTAL && !s.exited) {
        s.exited = true;
        cb.current.onExited();
      }
    } else {
      if (s.exitT >= 0) {
        // di nuovo in scena durante l'uscita: la sequenza riparte
        s.t = 0;
        s.entered = false;
      }
      s.exitT = -1;
      s.exited = false;
      const t = s.t;
      const o = sm((t - T_OPEN) / 0.7);
      // apertura con un piccolo rimbalzo
      open = o * (1 + 0.12 * Math.sin(Math.min(1, o) * Math.PI)) * (t > T_WALK + WALK_S ? 0.9 : 1);
      const k = Math.min(1, Math.max(0, (t - T_WALK) / WALK_S));
      z = Z_BEHIND + (Z_FRONT - Z_BEHIND) * (1 - (1 - k) * (1 - k * 0.4));
      walking = k > 0 && k < 1 ? 1 : 0;
      if (k >= 1 && !s.entered) {
        s.entered = true;
        cb.current.onEntered();
      }
    }
    walk.current = walking;
    if (zafira.current) {
      zafira.current.position.z = z;
      zafira.current.rotation.y = rotY;
      zafira.current.visible = !(s.exited && !play);
    }
    if (portal.current) {
      portal.current.scale.set(Math.max(0.001, open), Math.max(0.001, open), 1);
      portal.current.visible = open > 0.002;
    }
    const time = state.clock.elapsedTime;
    const o1 = Math.min(1, open);
    for (const m of [vortex.current, ring.current, sparks.current]) {
      if (!m) continue;
      m.uniforms.uTime.value = time;
      m.uniforms.uOpen.value = o1;
    }
    const fov = (state.camera as PerspectiveCamera).fov ?? 30;
    if (sparks.current) sparks.current.uniforms.uPx.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
    const flick = 0.85 + 0.15 * Math.sin(time * 9);
    if (green.current) green.current.intensity = 6 * Math.min(1, open) * flick;
    if (red.current) red.current.intensity = 6 * Math.min(1, open) * flick;
    busyRef.current = true;
  });

  return (
    <>
      <pointLight ref={green} position={[-0.8, PORTAL_Y + 0.4, -0.4]} distance={4} decay={2} color="#39ff14" />
      <pointLight ref={red} position={[0.8, PORTAL_Y + 0.4, -0.4]} distance={4} decay={2} color="#ff253a" />
      <group ref={portal} position={[0, PORTAL_Y, 0]} scale={0.001} visible={false}>
        <mesh scale={[PORTAL_R * PORTAL_SX, PORTAL_R, 1]}>
          <circleGeometry args={[1, low ? 48 : 96]} />
          <shaderMaterial ref={vortex} args={[params.vortex]} />
        </mesh>
        <mesh scale={[PORTAL_SX, 1, 1]}>
          <torusGeometry args={[PORTAL_R, 0.05, 10, low ? 96 : 160]} />
          <shaderMaterial ref={ring} args={[params.ring]} />
        </mesh>
        <points geometry={sparkGeo} frustumCulled={false}>
          <shaderMaterial ref={sparks} args={[params.sparks]} />
        </points>
      </group>
      {/* bagliore sul pavimento */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]} scale={[1.4, 0.7, 1]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#1c6b12" transparent opacity={0.35} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <group ref={zafira} position={[0, 0, Z_BEHIND]} visible={false}>
        <Suspense fallback={null}>
          <GiramenteCharacterModel
            who="zafira"
            url={characterUrl("zafira", quality, undefined, src)}
            action="idle"
            speaking={speaking}
            mouthRef={mouthRef}
            externalWalk={walk}
            onReady={() => {
              st.current.ready = true;
            }}
          />
        </Suspense>
      </group>
    </>
  );
}

function PortalScene(p: PortalRigProps) {
  return (
    <>
      <StudioLights />
      <PortalRig {...p} />
    </>
  );
}

export default function JollyPortal3D(p: Omit<PortalRigProps, "busyRef"> & { onFail: (r: string) => void }) {
  const busy = useRef(true);
  const low = p.quality !== "high";
  return (
    <Boundary3D onError={(r) => p.onFail(r)}>
      <Canvas
        frameloop="demand"
        dpr={low ? [1, 1.25] : [1, 2]}
        resize={{ offsetSize: true }}
        gl={{ alpha: true, antialias: true, powerPreference: low ? "default" : "high-performance" }}
        camera={{ position: [0, 1.1, 5], fov: 30, near: 0.1, far: 30 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          const el = gl.domElement;
          el.addEventListener("webglcontextlost", () => setTimeout(() => el.isConnected && p.onFail("contesto WebGL perso"), 150), { once: true });
        }}
        style={{ position: "absolute", inset: 0, background: "transparent", pointerEvents: "none" }}
      >
        <Frame />
        <PortalScene {...p} busyRef={busy} />
        <Pace fpsRef={busy} base={60} />
      </Canvas>
    </Boundary3D>
  );
}
