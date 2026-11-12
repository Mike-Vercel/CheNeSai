"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  Color,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  Quaternion,
  Shape,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector3,
  Box3,
  type PerspectiveCamera,
  type Texture,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Brain3D } from "./Brain3D";
import type { GiramenteWheelProps } from "./types";
import { drawWheelDisc, DEFAULT_WHEEL_FONT, DISC_LAYOUT } from "./wheel-texture";
import { WheelDriver } from "./wheel-driver";
import { segmentStep, TAU } from "./wheel-math";
import { prefersReducedMotion } from "./quality";

/**
 * La ruota 3D di GIRAMENTE! (porting in React Three Fiber di ruota.js dell'utente).
 * Disco con spicchi/icone/scritte su canvas, cerchione in acciaio con lampadine, pioli, puntatore triangolare
 * che scatta sui pioli, centro con il CERVELLO luminoso (o il logo G!), montata sul supporto RUOTA_GIRAMENTE.glb.
 * L'angolo arriva da WheelDriver (deterministico dall'orologio del server). Canvas "a richiesta":
 * 60 fps solo mentre gira, pochi fps da ferma (lampadine), 0 con movimento ridotto.
 */

export type WheelCenter = "brain" | "logo";
/** Centro della ruota: cervello 3D (brief e mockup) oppure il logo G! dell'utente. UNICO PUNTO da cambiare. */
export const WHEEL_CENTER_DEFAULT: WheelCenter = "brain";

export const STAND_URL = "/models/giramente/supporto.glb";
export const LOGO_URL = "/models/giramente/logo-g.webp";

/** Misure della ruota in scena (come ruota.html): raggio del disco, altezza del perno, pavimento. */
const R = 1.1;
const WHEEL_Y = 1.25;
const FLOOR_Y = -1.0;
/** Supporto (misurato in Blender sul modello Meshy): perno a 1.768 dal fondo, faccia del perno a +0.317. */
const STAND = { hubFromBottom: 1.768, hubFront: 0.317 };
const BULBS = 24;

const NEON_GREEN = new Color("#39FF14");
const NEON_RED = new Color("#FF253A");
const WARM = new Color("#ffd48a");

// ------------------------------------------------------------------ inquadratura
function Fit({ withStand }: { withStand: boolean }) {
  const last = useRef("");
  useFrame((state) => {
    const cam = state.camera as PerspectiveCamera;
    const { width, height } = state.size;
    const key = `${withStand}:${width}x${height}`;
    if (key === last.current) return;
    last.current = key;
    cam.aspect = width / Math.max(1, height);
    const half = Math.tan((cam.fov * Math.PI) / 360);
    // altezza e larghezza da far stare: ruota + supporto, oppure solo la ruota con il puntatore
    const needH = withStand ? WHEEL_Y + R * 1.42 - FLOOR_Y + 0.15 : R * 2.75;
    const needW = withStand ? R * 2.75 : R * 2.6;
    const cy = withStand ? (WHEEL_Y + R * 1.42 + FLOOR_Y) / 2 : WHEEL_Y + R * 0.06;
    const dist = Math.max(needH / 2 / half, needW / 2 / (half * cam.aspect));
    cam.position.set(0, cy + (withStand ? 0.35 : 0.05), dist + 0.4);
    cam.lookAt(0, cy, 0);
    cam.updateProjectionMatrix();
  });
  return null;
}

/** Ridisegna a `fps` fotogrammi al secondo (0 = solo quando cambia qualcosa). */
function Pace({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    if (fps <= 0) return;
    let id = 0;
    let last = -Infinity;
    const step = 1000 / fps;
    const loop = (t: number) => {
      if (t - last >= step - 2) {
        last = t;
        invalidate();
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [fps, invalidate]);
  return null;
}

/** Riflessi del metallo senza file esterni: ambiente "stanza" generato in codice (solo qualità alta). */
function RoomEnv() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [get]);
  return null;
}

// ------------------------------------------------------------------ supporto (GLB Meshy)
function Stand({ low, shadows, onPlaced }: { low: boolean; shadows: boolean; onPlaced: (z: number) => void }) {
  const gltf = useGLTF(low ? STAND_URL.replace(/\.glb$/, "-low.glb") : STAND_URL);
  const placed = useMemo(() => {
    const s = gltf.scene.clone(true);
    const k = (WHEEL_Y - FLOOR_Y) / STAND.hubFromBottom;
    s.scale.setScalar(k);
    s.updateMatrixWorld(true);
    const box = new Box3().setFromObject(s);
    s.position.y += FLOOR_Y - box.min.y;
    s.position.x -= (box.min.x + box.max.x) / 2;
    s.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      const mat = m.material as MeshStandardMaterial;
      if (mat?.isMeshStandardMaterial) mat.envMapIntensity = 0.9;
    });
    return { scene: s, wheelZ: STAND.hubFront * k + 0.16 };
  }, [gltf, shadows]);
  useEffect(() => onPlaced(placed.wheelZ), [placed, onPlaced]);
  return <primitive object={placed.scene} />;
}

/** Supporto di riserva (file mancante): cavalletto e base in codice, come ruota.html. */
function PlaceholderStand() {
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(-0.95, -0.6);
    s.lineTo(0.95, -0.6);
    s.lineTo(0.22, WHEEL_Y);
    s.lineTo(-0.22, WHEEL_Y);
    s.closePath();
    return s;
  }, []);
  return (
    <group>
      <mesh position-z={-0.35}>
        <extrudeGeometry args={[shape, { depth: 0.25, bevelEnabled: false }]} />
        <meshStandardMaterial color="#101214" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position-y={-0.8}>
        <cylinderGeometry args={[1.6, 1.75, 0.4, 64]} />
        <meshStandardMaterial color="#101214" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position-y={-0.59} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.66, 0.025, 8, 96]} />
        <meshBasicMaterial color={NEON_GREEN} toneMapped={false} />
      </mesh>
    </group>
  );
}

class Boundary extends Component<{ fallback: ReactNode; onError?: (r: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    this.props.onError?.(e instanceof Error ? e.message : String(e));
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ------------------------------------------------------------------ texture condivise
function glowTexture(inner: string, outer: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, outer);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Riflesso morbido sul disco: luce dall'alto a sinistra e ombra verso il basso (canvas, nessun file). */
function glossTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(90, 70, 0, 110, 90, 190);
  g.addColorStop(0, "rgba(255,255,255,0.22)");
  g.addColorStop(0.45, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Anello al neon esterno: verde in alto a sinistra, rosso in basso a destra (colori per vertice). */
function neonRingGeometry(radius: number, tube: number): TorusGeometry {
  const g = new TorusGeometry(radius, tube, 10, 180);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getY(i), pos.getX(i));
    const k = 0.5 + 0.5 * Math.sin(a - Math.PI / 4 + Math.PI / 2); // 1 in alto a sinistra, 0 in basso a destra
    c.copy(NEON_RED).lerp(NEON_GREEN, Math.min(1, Math.max(0, (k - 0.2) / 0.6)));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new BufferAttribute(col, 3));
  return g;
}

// ------------------------------------------------------------------ la ruota
interface RigProps extends Pick<GiramenteWheelProps, "segments" | "spin" | "restIndex" | "now" | "highlight" | "onSpinEnd" | "onTick"> {
  low: boolean;
  center: WheelCenter;
  fontFamily: string;
  reduced: boolean;
  onState: (s: { spinning: boolean; lit: boolean }) => void;
}

function WheelRig({ segments, spin, restIndex, now, highlight, onSpinEnd, onTick, low, center, fontFamily, reduced, onState }: RigProps) {
  const n = Math.max(2, segments.length);
  const s = segmentStep(n);
  const driver = useMemo(() => new WheelDriver(), []);
  const rotor = useRef<Group>(null);
  const pointer = useRef<Group>(null);
  const bulbs = useRef<InstancedMesh>(null);
  const halos = useRef<InstancedMesh>(null);
  const hiFill = useRef<MeshBasicMaterial>(null);
  const hiEdge = useRef<MeshBasicMaterial>(null);
  const brainGlow = useRef(0);
  const cb = useRef({ onSpinEnd, onTick, onState });
  useEffect(() => {
    cb.current = { onSpinEnd, onTick, onState };
  });

  // disco: canvas → texture, creata e ridisegnata in un effetto (quando cambiano spicchi, qualità o carattere)
  const discMat = useRef<MeshBasicMaterial>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = low ? 1024 : 2048;
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = low ? 2 : 8;
    let alive = true;
    const draw = () => {
      if (!alive) return;
      drawWheelDisc(canvas, segments, fontFamily);
      tex.needsUpdate = true;
      const m = discMat.current;
      if (m && m.map !== tex) {
        m.map = tex;
        m.needsUpdate = true;
      }
    };
    draw();
    // ridisegna quando il carattere web è pronto (la prima volta potrebbe usare quello di riserva)
    document.fonts?.ready.then(draw).catch(() => {});
    return () => {
      alive = false;
      tex.dispose();
    };
  }, [low, segments, fontFamily]);

  const logoTex = useMemo<Texture | null>(() => {
    if (center !== "logo") return null;
    const t = new TextureLoader().load(LOGO_URL);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [center]);
  useEffect(() => () => logoTex?.dispose(), [logoTex]);

  const tex = useMemo(
    () => ({
      bulbHalo: glowTexture("rgba(255,240,200,0.95)", "rgba(255,190,90,0.35)"),
      gloss: glossTexture(),
      pointerHalo: glowTexture("rgba(140,255,110,0.9)", "rgba(57,255,20,0.35)"),
    }),
    [],
  );
  useEffect(
    () => () => {
      tex.bulbHalo.dispose();
      tex.pointerHalo.dispose();
      tex.gloss.dispose();
    },
    [tex],
  );

  const neonRing = useMemo(() => neonRingGeometry(R * 1.205, R * 0.016), []);
  useEffect(() => () => neonRing.dispose(), [neonRing]);

  const pointerGeo = useMemo(() => {
    const w = R * 0.15;
    const h = R * 0.24;
    const outer = new Shape();
    outer.moveTo(-w, 0);
    outer.lineTo(w, 0);
    outer.lineTo(0, -h);
    outer.closePath();
    const inner = new Shape();
    const k = 0.62;
    inner.moveTo(-w * k, -h * 0.12);
    inner.lineTo(w * k, -h * 0.12);
    inner.lineTo(0, -h * 0.8);
    inner.closePath();
    return {
      frame: new ExtrudeGeometry(outer, { depth: 0.07, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.014, bevelSegments: 2 }),
      face: new ExtrudeGeometry(inner, { depth: 0.02, bevelEnabled: false }),
    };
  }, []);
  useEffect(
    () => () => {
      pointerGeo.frame.dispose();
      pointerGeo.face.dispose();
    },
    [pointerGeo],
  );

  // pioli (sui separatori) e lampadine: matrici fisse nel rotore
  useEffect(() => {
    const m = new Matrix4();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    if (bulbs.current) {
      for (let i = 0; i < BULBS; i++) {
        const a = (i / BULBS) * TAU;
        m.compose(new Vector3(Math.cos(a) * R * 1.075, Math.sin(a) * R * 1.075, R * 0.075), q, one);
        bulbs.current.setMatrixAt(i, m);
        halos.current?.setMatrixAt(i, m.clone().multiply(new Matrix4().makeTranslation(0, 0, 0.02)));
      }
      bulbs.current.instanceMatrix.needsUpdate = true;
      if (halos.current) halos.current.instanceMatrix.needsUpdate = true;
    }
  }, []);
  const pegs = useMemo(() => {
    const list: { pos: [number, number, number]; rot: Euler }[] = [];
    for (let i = 0; i < n; i++) {
      const a = -i * s; // separatore tra lo spicchio i−1 e i (angolo 3D = −angolo canvas)
      list.push({ pos: [Math.cos(a) * R * 0.955, Math.sin(a) * R * 0.955, 0.045], rot: new Euler(Math.PI / 2, 0, 0) });
    }
    return list;
  }, [n, s]);

  const st = useRef({ kick: 0, lit: false, spinning: false, hi: 0, lastT: 0 });
  const tmpColor = useMemo(() => new Color(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const t = now();
    const f = driver.update(spin, restIndex ?? null, n, t);
    const S = st.current;
    if (rotor.current) rotor.current.rotation.z = f.angle;
    if (f.ticked) cb.current.onTick?.();
    if (f.ended) cb.current.onSpinEnd?.(f.ended);
    // puntatore: scatto a ogni piolo, ritorno elastico (verso opposto al moto del bordo in alto)
    if (f.pegChanged) S.kick = Math.min(1, S.kick + 0.75);
    S.kick *= Math.exp(-dt * 13);
    if (pointer.current) pointer.current.rotation.z = -S.kick * 0.42 * Math.sign(f.speed || 1);
    // evidenziazione dello spicchio vincente
    const showHi = !!highlight && !f.spinning && f.restingOn !== null;
    S.hi += ((showHi ? 1 : 0) - S.hi) * (1 - Math.exp(-dt * 6));
    const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(state.clock.elapsedTime * 6);
    if (hiFill.current) hiFill.current.opacity = 0.22 * S.hi * pulse;
    if (hiEdge.current) hiEdge.current.opacity = S.hi * (0.7 + 0.3 * pulse);
    // cervello: più acceso mentre gira e all'arresto
    const speedK = Math.min(1, Math.abs(f.speed) / 12);
    brainGlow.current = Math.max(speedK, S.hi * 0.8);
    // lampadine: corrono (più veloci col giro), a giro finito lampeggiano verde/rosso alternate
    const et = state.clock.elapsedTime;
    if (bulbs.current) {
      const chase = reduced ? 0 : f.spinning ? 6 + Math.abs(f.speed) * 1.6 : 3.5;
      const phase = Math.floor(et * chase);
      for (let i = 0; i < BULBS; i++) {
        let on: boolean;
        if (S.hi > 0.5 && !reduced) {
          on = (Math.floor(et * 4) + i) % 2 === 0;
          tmpColor.copy(i % 2 === 0 ? NEON_GREEN : NEON_RED).multiplyScalar(on ? 2.6 : 0.35);
        } else {
          on = reduced ? true : (phase + i) % 3 === 0;
          tmpColor.copy(WARM).multiplyScalar(on ? 2.4 : 0.42);
        }
        bulbs.current.setColorAt(i, tmpColor);
        halos.current?.setColorAt(i, tmpColor.multiplyScalar(on ? 0.5 : 0.05));
      }
      if (bulbs.current.instanceColor) bulbs.current.instanceColor.needsUpdate = true;
      if (halos.current?.instanceColor) halos.current.instanceColor.needsUpdate = true;
    }
    if (S.spinning !== f.spinning || S.lit !== showHi) {
      S.spinning = f.spinning;
      S.lit = showHi;
      cb.current.onState({ spinning: f.spinning, lit: showHi });
    }
  });

  // spicchio evidenziato (coordinate del rotore): angoli 3D [−(i+1)s, −i·s]
  const hiIndex = ((Math.round(spin?.targetIndex ?? restIndex ?? 0) % n) + n) % n;
  const hiStart = -(hiIndex + 1) * s;

  return (
    <group>
      {/* parte che gira */}
      <group ref={rotor}>
        <mesh>
          <circleGeometry args={[R, 128]} />
          <meshBasicMaterial ref={discMat} color="#ffffff" toneMapped={false} />
        </mesh>
        {/* evidenziazione: riempimento additivo + bordo al neon */}
        <mesh position-z={0.004}>
          <ringGeometry args={[R * DISC_LAYOUT.hub, R * 0.99, 48, 1, hiStart, s]} />
          <meshBasicMaterial ref={hiFill} color="#e9ffe0" transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
        <mesh position-z={0.006}>
          <ringGeometry args={[R * 0.955, R * 1.0, 48, 1, hiStart, s]} />
          <meshBasicMaterial ref={hiEdge} color={NEON_GREEN} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* pioli */}
        {pegs.map((p, i) => (
          <mesh key={i} position={p.pos} rotation={p.rot}>
            <cylinderGeometry args={[R * 0.022, R * 0.026, 0.07, 14]} />
            <meshStandardMaterial color="#d9dee2" metalness={1} roughness={0.22} />
          </mesh>
        ))}
        {/* cerchione in acciaio, fianco e retro */}
        <mesh>
          <torusGeometry args={[R * 1.075, R * 0.075, low ? 16 : 28, low ? 96 : 180]} />
          <meshStandardMaterial color="#b9c1c7" metalness={1} roughness={0.24} envMapIntensity={1.2} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position-z={-0.07}>
          <cylinderGeometry args={[R * 1.13, R * 1.13, 0.14, 96, 1, true]} />
          <meshStandardMaterial color="#14181b" metalness={0.6} roughness={0.4} side={DoubleSide} />
        </mesh>
        <mesh position-z={-0.14} rotation-y={Math.PI}>
          <circleGeometry args={[R * 1.13, 96]} />
          <meshStandardMaterial color="#0c0e10" roughness={0.6} />
        </mesh>
        {/* lampadine (colore per istanza) e alone */}
        <instancedMesh ref={bulbs} args={[undefined, undefined, BULBS]}>
          <sphereGeometry args={[R * 0.034, 14, 10]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {!low && (
          <instancedMesh ref={halos} args={[undefined, undefined, BULBS]}>
            <planeGeometry args={[R * 0.26, R * 0.26]} />
            <meshBasicMaterial map={tex.bulbHalo} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </instancedMesh>
        )}
      </group>

      {/* centro fermo (mozzo): cervello luminoso o logo G! */}
      <group position-z={0.02}>
        <mesh rotation-x={Math.PI / 2} position-z={0.03}>
          <cylinderGeometry args={[R * DISC_LAYOUT.hub, R * DISC_LAYOUT.hub, 0.07, 64]} />
          <meshStandardMaterial color="#121619" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position-z={0.068}>
          <torusGeometry args={[R * (DISC_LAYOUT.hub - 0.008), R * 0.016, 12, 96]} />
          <meshStandardMaterial color="#c9d0d5" metalness={1} roughness={0.2} />
        </mesh>
        <mesh position-z={0.072}>
          <torusGeometry args={[R * (DISC_LAYOUT.hub - 0.04), R * 0.008, 8, 96]} />
          <meshBasicMaterial color={NEON_GREEN} toneMapped={false} />
        </mesh>
        {center === "brain" ? (
          <group position-z={0.1}>
            <Brain3D width={R * 0.31} detail={low ? "low" : "high"} glowRef={brainGlow} animate={!reduced} />
          </group>
        ) : (
          <mesh position-z={0.072}>
            <circleGeometry args={[R * (DISC_LAYOUT.hub - 0.05), 64]} />
            <meshStandardMaterial map={logoTex} transparent roughness={0.5} emissive="#ffffff" emissiveMap={logoTex} emissiveIntensity={0.3} />
          </mesh>
        )}
      </group>

      {/* riflesso della luce sul disco (fermo: quando la ruota gira gli spicchi ci scorrono sotto) */}
      <mesh position-z={0.012}>
        <circleGeometry args={[R * 0.995, 96]} />
        <meshBasicMaterial map={tex.gloss} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>

      {/* anello al neon esterno (fermo) */}
      <mesh geometry={neonRing} position-z={-0.03}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>

      {/* puntatore in alto: telaio d'acciaio, faccia al neon, perno */}
      <group position={[0, R * 1.25, 0.16]}>
        <group ref={pointer}>
          <mesh geometry={pointerGeo.frame}>
            <meshStandardMaterial color="#d7dde1" metalness={1} roughness={0.2} />
          </mesh>
          <mesh geometry={pointerGeo.face} position-z={0.09}>
            <meshBasicMaterial color={NEON_GREEN} toneMapped={false} />
          </mesh>
          {!low && (
            <mesh position={[0, -R * 0.11, 0.05]}>
              <planeGeometry args={[R * 0.7, R * 0.7]} />
              <meshBasicMaterial map={tex.pointerHalo} transparent opacity={0.65} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
            </mesh>
          )}
        </group>
        <mesh rotation-x={Math.PI / 2} position-z={0.05}>
          <cylinderGeometry args={[R * 0.035, R * 0.035, 0.18, 16]} />
          <meshStandardMaterial color="#9aa3a9" metalness={1} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ canvas
export interface Wheel3DProps extends GiramenteWheelProps {
  center?: WheelCenter;
  onFail?: (reason: string) => void;
}

export default function Wheel3D({ quality, showStand = true, className, center = WHEEL_CENTER_DEFAULT, onFail, ...rig }: Wheel3DProps) {
  const low = quality !== "high";
  const shadows = quality === "high";
  const [wheelZ, setWheelZ] = useState(0.55);
  const [mode, setMode] = useState({ spinning: false, lit: false });
  const [fontFamily, setFontFamily] = useState(DEFAULT_WHEEL_FONT);
  const [reduced] = useState(prefersReducedMotion);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const v = getComputedStyle(el).getPropertyValue("--font-giramente").trim();
    if (v) setFontFamily(`${v}, ${DEFAULT_WHEEL_FONT}`);
  }, []);
  // fotogrammi: 60 mentre gira, 30 con lo spicchio evidenziato, 10 da ferma (lampadine), 0 con movimento ridotto
  const fps = mode.spinning || rig.spin ? 60 : reduced ? 0 : mode.lit ? 30 : 10;
  return (
    <div ref={wrap} className={className} style={{ position: "relative" }}>
      <Canvas
        frameloop="demand"
        shadows={shadows}
        dpr={low ? [1, 1.25] : [1, 2]}
        resize={{ offsetSize: true }}
        gl={{ alpha: true, antialias: true, powerPreference: low ? "default" : "high-performance" }}
        camera={{ position: [0, 1, 8], fov: 30, near: 0.1, far: 60 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          const el = gl.domElement;
          el.addEventListener("webglcontextlost", () => setTimeout(() => el.isConnected && onFail?.("contesto WebGL perso"), 150), { once: true });
        }}
        style={{ position: "absolute", inset: 0, background: "transparent" }}
      >
        <Fit withStand={showStand} />
        <hemisphereLight args={["#ffffff", "#1a2024", 0.9]} />
        <directionalLight
          position={[2.2, 4.5, 5]}
          intensity={2.1}
          castShadow={shadows}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-3}
          shadow-camera-right={3}
          shadow-camera-top={4}
          shadow-camera-bottom={-2}
          shadow-bias={-0.0004}
        />
        <pointLight position={[-3.6, 2.6, 1.6]} intensity={14} distance={12} color="#ff2a44" />
        <pointLight position={[3.6, 2.6, 1.6]} intensity={14} distance={12} color="#3dff3a" />
        <pointLight position={[0, WHEEL_Y + 0.4, 2.4]} intensity={4} distance={5} color="#ffffff" />
        {!low && <RoomEnv />}
        <group position={[0, WHEEL_Y, showStand ? wheelZ : 0]}>
          <WheelRig {...rig} low={low} center={center} fontFamily={fontFamily} reduced={reduced} onState={setMode} />
        </group>
        {showStand && (
          <Boundary fallback={<PlaceholderStand />} onError={(r) => console.warn(`[giramente] supporto 3D non caricato: ${r}`)}>
            <Suspense fallback={null}>
              <Stand low={low} shadows={shadows} onPlaced={setWheelZ} />
            </Suspense>
          </Boundary>
        )}
        {showStand && shadows && (
          <mesh rotation-x={-Math.PI / 2} position-y={FLOOR_Y + 0.002} receiveShadow>
            <planeGeometry args={[12, 12]} />
            <shadowMaterial opacity={0.4} />
          </mesh>
        )}
        <Pace fps={fps} />
      </Canvas>
    </div>
  );
}

export function preloadWheel3D(low = false) {
  useGLTF.preload(low ? STAND_URL.replace(/\.glb$/, "-low.glb") : STAND_URL);
}
