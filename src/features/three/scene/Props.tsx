"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text3D } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
  type Vector3Tuple,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useIntroClock } from "./clock";
import { BRAND } from "./look";
import { HOST_WALK, T, WALK, mulberry32, podiumRide, prog, smooth } from "../timeline";
import { createLinearTexture } from "./textures";

const WHITE_TRAIL = new Color("#ffffff");
import { LOGO_FONT_URL } from "../assets";

// ------------------------------------------------------------------ podio dei presentatori
function drawPodiumPanel(label: string, accent: string, accent2: string, fontReady: boolean): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 448;
  const g = canvas.getContext("2d");
  if (g) {
    const w = canvas.width;
    const h = canvas.height;
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, accent2);
    grad.addColorStop(0.55, accent);
    grad.addColorStop(1, "#170824");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // righe diagonali lucide
    g.globalAlpha = 0.12;
    g.fillStyle = "#ffffff";
    for (let x = -h; x < w; x += 70) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 30, h);
      g.lineTo(x + 30 + h, 0);
      g.lineTo(x + h, 0);
      g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = BRAND.gold;
    g.lineWidth = 14;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.font = fontReady ? "140px 'QZ Lilita One', 'Arial Black', sans-serif" : "bold 120px 'Arial Black', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = 18;
    g.strokeStyle = "#1a0526";
    g.strokeText(label, w / 2, h / 2 + 6);
    g.fillStyle = "#ffffff";
    g.fillText(label, w / 2, h / 2 + 6);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const STILL = { dx: 0, tilt: 0, speed: 0 };

export function Podium({ position, label, accent, accent2, side }: { position: Vector3; label: string; accent: string; accent2: string; side: -1 | 1 }) {
  const clock = useIntroClock();
  const panel = useRef<MeshBasicMaterial>(null);
  const root = useRef<Group>(null);
  const trail = useRef<MeshBasicMaterial>(null);
  // scia luminosa: chiara vicino al podio, sfuma verso le quinte
  const trailTex = useMemo(
    () =>
      createLinearTexture([
        [0, "rgba(255,255,255,0)"],
        [0.7, "rgba(255,255,255,0.35)"],
        [1, "rgba(255,255,255,0.9)"],
      ]),
    [],
  );
  useEffect(() => () => trailTex.dispose(), [trailTex]);
  const edges = useMemo(() => new MeshBasicMaterial({ color: accent, toneMapped: false }), [accent]);
  const onAt = label.includes("PROF") ? WALK.profTo - 0.4 : WALK.reginaTo - 0.4;

  // il testo del podio usa Lilita One: ridisegna quando il font è pronto
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts
      ?.load("140px 'QZ Lilita One'")
      .then(() => {
        if (alive) setFontReady(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const texture = useMemo(() => drawPodiumPanel(label, accent, accent2, fontReady), [label, accent, accent2, fontReady]);

  useEffect(
    () => () => {
      texture.dispose();
      edges.dispose();
    },
    [texture, edges],
  );

  useFrame(() => {
    const { t, e } = clock.current;
    // col presentatore a piedi il suo podio è già al suo posto e si accende al suo arrivo
    const host = side < 0 ? "professore" : "regina";
    const still = clock.current.walking[host];
    const at = still ? HOST_WALK[host].t1 - 0.3 : onAt;
    const on = smooth(prog(t, at - 0.3, at + 0.5));
    const lit = smooth(prog(t, T.studioOn, T.studioOn + 2));
    const base = 0.012 + 0.3 * lit + 0.69 * on;
    if (panel.current) panel.current.color.setScalar(base * (0.95 + 0.05 * Math.sin(e * 4)));
    edges.color.set(accent).multiplyScalar(0.2 + 2 * on);
    // in sella: il podio arriva dalle quinte, frena e oscilla
    const ride = still ? STILL : podiumRide(side, t, clock.current.reducedMotion);
    const g = root.current;
    if (g) {
      g.position.set(position.x + ride.dx, position.y, position.z);
      g.rotation.z = ride.tilt;
    }
    if (trail.current) trail.current.color.set(accent).lerp(WHITE_TRAIL, 0.35).multiplyScalar(ride.speed * 1.6);
  });

  return (
    <group ref={root} position={position}>
      {/* scia di luce dietro al podio in corsa */}
      <mesh position={[side * 4.2, 0.95, -0.05]} scale={[side < 0 ? 1 : -1, 1, 1]} renderOrder={6}>
        <planeGeometry args={[5.6, 1.8]} />
        <meshBasicMaterial ref={trail} map={trailTex} color="#000000" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[3.0, 1.7, 1.1]} />
        <meshStandardMaterial color="#1e0c32" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.92, 0.556]}>
        <planeGeometry args={[2.8, 1.22]} />
        <meshBasicMaterial ref={panel} map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.77, 0]}>
        <boxGeometry args={[3.25, 0.14, 1.32]} />
        <meshStandardMaterial color="#e2ac2a" metalness={1} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[3.2, 0.1, 1.25]} />
        <meshStandardMaterial color="#e2ac2a" metalness={1} roughness={0.3} />
      </mesh>
      {[-1.52, 1.52].map((x) => (
        <mesh key={x} position={[x, 0.9, 0.56]} material={edges}>
          <boxGeometry args={[0.06, 1.62, 0.06]} />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ bancone del pub
export function PubBar({ position, rotationY }: { position: Vector3Tuple; rotationY: number }) {
  const clock = useIntroClock();
  const bottles = useRef<InstancedMesh>(null);
  const glow = useMemo(() => new MeshBasicMaterial({ color: "#000000", toneMapped: false }), []);
  const sign = useRef<MeshBasicMaterial>(null);
  const bottleMat = useRef<MeshBasicMaterial>(null);
  const count = 3 * 16;
  const bottleGeo = useMemo(() => {
    const g = new LatheGeometry(
      [new Vector2(0, 0), new Vector2(0.11, 0), new Vector2(0.11, 0.3), new Vector2(0.05, 0.4), new Vector2(0.04, 0.52), new Vector2(0, 0.52)],
      10,
    );
    return g;
  }, []);
  useEffect(
    () => () => {
      glow.dispose();
      bottleGeo.dispose();
    },
    [glow, bottleGeo],
  );

  useEffect(() => {
    const mesh = bottles.current;
    if (!mesh) return;
    const rnd = mulberry32(77);
    const m = new Matrix4();
    const c = new Color();
    const palette = ["#3fbf5a", "#d98a1c", "#7a3b12", "#c7e6ff", "#ff5a7a", "#ffd43b"];
    let i = 0;
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 16; k++) {
        const s = 0.85 + rnd() * 0.35;
        m.makeScale(s, s, s);
        m.setPosition(-3.1 + k * 0.41 + rnd() * 0.08, 1.66 + row * 1.0, -1.32);
        mesh.setMatrixAt(i, m);
        c.set(palette[Math.floor(rnd() * palette.length)]).multiplyScalar(0.55 + rnd() * 0.4);
        mesh.setColorAt(i, c);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame(() => {
    const { t, e } = clock.current;
    const on = smooth(prog(t, T.studioOn + 1.0, T.studioOn + 2.4));
    glow.color.set(BRAND.amber).multiplyScalar(1.4 * on + 0.02);
    if (bottleMat.current) bottleMat.current.color.setScalar(0.004 + 0.996 * on);
    if (sign.current) {
      const flick = t < T.studioOn + 2.4 && on > 0 && on < 1 ? (Math.sin(e * 55) > 0 ? 1 : 0.2) : 1;
      sign.current.color.set(BRAND.fuchsia).multiplyScalar((2.2 * on + 0.02) * flick);
    }
  });

  return (
    <group position={position} rotation-y={rotationY}>
      {/* bancone */}
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[7, 1.25, 1.2]} />
        <meshStandardMaterial color="#3d1d0e" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.29, 0.05]}>
        <boxGeometry args={[7.3, 0.1, 1.45]} />
        <meshStandardMaterial color="#26100a" roughness={0.18} metalness={0.25} />
      </mesh>
      <mesh position={[0, 1.2, 0.71]} material={glow}>
        <boxGeometry args={[7.0, 0.04, 0.04]} />
      </mesh>
      <mesh position={[0, 0.25, 0.7]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.04, 0.04, 7, 8]} />
        <meshStandardMaterial color="#e2ac2a" metalness={1} roughness={0.25} />
      </mesh>
      {/* spillatrice */}
      <mesh position={[0.6, 1.62, 0.1]}>
        <boxGeometry args={[1.5, 0.55, 0.22]} />
        <meshStandardMaterial color="#e2ac2a" metalness={1} roughness={0.2} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <group key={k} position={[0.05 + k * 0.37, 1.9, 0.1]}>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.035, 0.05, 0.45, 8]} />
            <meshStandardMaterial color={[BRAND.green, BRAND.red, BRAND.blue, BRAND.gold][k]} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.25, 0.18]}>
            <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
            <meshStandardMaterial color="#e2ac2a" metalness={1} roughness={0.2} />
          </mesh>
        </group>
      ))}
      {/* scaffale retroilluminato */}
      <mesh position={[0, 2.7, -1.6]}>
        <boxGeometry args={[7, 4.4, 0.35]} />
        <meshStandardMaterial color="#1a0b12" roughness={0.7} />
      </mesh>
      {[1.62, 2.62, 3.62].map((y) => (
        <mesh key={y} position={[0, y, -1.38]} material={glow}>
          <boxGeometry args={[6.8, 0.04, 0.12]} />
        </mesh>
      ))}
      <instancedMesh ref={bottles} args={[bottleGeo, undefined, count]}>
        <meshBasicMaterial ref={bottleMat} toneMapped={false} />
      </instancedMesh>
      {/* insegna neon */}
      <group position={[-2.55, 4.4, -1.35]}>
        <Text3D font={LOGO_FONT_URL} size={0.55} height={0.04} curveSegments={4} letterSpacing={0.02}>
          CHE NE SAI?!
          <meshBasicMaterial ref={sign} toneMapped={false} />
        </Text3D>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ botti
export function Barrels({ position, rotationY }: { position: Vector3Tuple; rotationY: number }) {
  const geo = useMemo(() => {
    const pts: Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const y = (i / 12) * 1.5;
      const bulge = Math.sin((i / 12) * Math.PI) * 0.12;
      pts.push(new Vector2(0.62 + bulge, y));
    }
    return new LatheGeometry(pts, 24);
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const spots: Vector3Tuple[] = [
    [-0.75, 0, 0],
    [0.75, 0, 0],
    [0, 1.5, 0],
    [2.3, 0, 0.9],
  ];
  return (
    <group position={position} rotation-y={rotationY}>
      {spots.map((p, i) => (
        <group key={i} position={p} rotation-y={i * 0.7}>
          <mesh geometry={geo}>
            <meshStandardMaterial color="#6b3a1a" roughness={0.65} side={DoubleSide} />
          </mesh>
          {[0.18, 0.75, 1.32].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.62 + Math.sin((y / 1.5) * Math.PI) * 0.12 + 0.01, 0.035, 6, 32]} />
              <meshStandardMaterial color="#2b2b30" metalness={0.9} roughness={0.35} />
            </mesh>
          ))}
          <mesh position={[0, 1.5, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.62, 24]} />
            <meshStandardMaterial color="#5a3016" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ palma procedurale
export function PalmTree({ position, height, lean, seed }: { position: Vector3Tuple; height: number; lean: number; seed: number }) {
  const clock = useIntroClock();
  const crown = useRef<Group>(null);
  const { trunk, leaves, top } = useMemo(() => buildPalm(height, lean, seed), [height, lean, seed]);
  useEffect(
    () => () => {
      trunk.dispose();
      leaves.dispose();
    },
    [trunk, leaves],
  );
  useFrame(() => {
    const { e, reducedMotion } = clock.current;
    if (crown.current && !reducedMotion) {
      crown.current.rotation.z = Math.sin(e * 0.8 + seed) * 0.04;
      crown.current.rotation.x = Math.cos(e * 0.6 + seed * 2) * 0.03;
    }
  });
  return (
    <group position={position}>
      <mesh geometry={trunk}>
        <meshStandardMaterial color="#7a5230" roughness={0.85} />
      </mesh>
      <group position={top} ref={crown}>
        <mesh geometry={leaves}>
          <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.6} emissive="#0b4a1f" emissiveIntensity={0.35} />
        </mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[Math.cos(k * 2.1) * 0.22, -0.25, Math.sin(k * 2.1) * 0.22]}>
            <sphereGeometry args={[0.17, 10, 8]} />
            <meshStandardMaterial color="#4a2d14" roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function buildPalm(height: number, lean: number, seed: number) {
  const rnd = mulberry32(seed * 1013);
  const segs = 14;
  const parts: BufferGeometry[] = [];
  const up = new Vector3(0, 1, 0);
  const q = new Quaternion();
  const pt = (s: number) => new Vector3(lean * height * s * s, height * s, lean * 0.3 * height * s * s);
  for (let i = 0; i < segs; i++) {
    const s0 = i / segs;
    const s1 = (i + 1) / segs;
    const a = pt(s0);
    const b = pt(s1);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const r0 = 0.32 - 0.14 * s0;
    const r1 = 0.32 - 0.14 * s1;
    // segmento leggermente svasato in alto: effetto "anelli" del tronco
    const g = new CylinderGeometry(r1 * 1.12, r0, len * 1.02, 10, 1);
    g.translate(0, len / 2, 0);
    q.setFromUnitVectors(up, dir.normalize());
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    parts.push(g.toNonIndexed());
  }
  const trunk = mergeGeometries(parts) ?? new BufferGeometry();
  for (const p of parts) p.dispose();

  // fronde: costole curve con foglioline triangolari
  const pos: number[] = [];
  const col: number[] = [];
  const dark = new Color("#0f6b2c");
  const light = new Color("#3fd068");
  const fronds = 10;
  for (let f = 0; f < fronds; f++) {
    const yaw = (f / fronds) * Math.PI * 2 + rnd() * 0.4;
    const L = 2.6 + rnd() * 0.9;
    const rise = 0.55 + rnd() * 0.35;
    const droop = 0.32 + rnd() * 0.12;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const rib = (s: number) => {
      const x = s * L;
      return new Vector3(x, rise * x - droop * x * x, 0);
    };
    const stations = 16;
    for (let k = 0; k < stations; k++) {
      const s = 0.08 + (k / stations) * 0.9;
      const p0 = rib(s);
      const p1 = rib(s + 0.05);
      const leafLen = 0.95 * Math.sin(Math.PI * (0.12 + 0.88 * s)) + 0.15;
      for (const side of [-1, 1]) {
        const tip = new Vector3(p0.x + leafLen * 0.35, p0.y - leafLen * 0.45, side * leafLen);
        const tri = [p0, p1, tip];
        for (const v of tri) {
          // ruota attorno a Y
          pos.push(v.x * cy - v.z * sy, v.y, v.x * sy + v.z * cy);
        }
        const c0 = dark.clone().lerp(light, s * 0.6);
        const c1 = dark.clone().lerp(light, 0.4 + s * 0.6);
        col.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
      }
    }
  }
  const leaves = new BufferGeometry();
  leaves.setAttribute("position", new Float32BufferAttribute(pos, 3));
  leaves.setAttribute("color", new Float32BufferAttribute(col, 3));
  leaves.computeVertexNormals();
  const top = pt(1);
  return { trunk, leaves, top: [top.x, top.y, top.z] as Vector3Tuple };
}

// ------------------------------------------------------------------ palma al neon
export function NeonPalm({ position, rotationY, mirror = false }: { position: Vector3Tuple; rotationY: number; mirror?: boolean }) {
  const clock = useIntroClock();
  const core = useMemo(() => new MeshBasicMaterial({ color: "#000000", toneMapped: false }), []);
  const halo = useMemo(
    () => new MeshBasicMaterial({ color: "#000000", toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 1 }),
    [],
  );
  const { cores, halos } = useMemo(() => {
    const curves: CatmullRomCurve3[] = [];
    const m = mirror ? -1 : 1;
    curves.push(
      new CatmullRomCurve3([new Vector3(0.3 * m, -2.6, 0), new Vector3(0.1 * m, -1.2, 0), new Vector3(-0.15 * m, 0.2, 0), new Vector3(0, 1.4, 0)]),
    );
    const fronds: [number, number][] = [
      [-2.2, -0.6],
      [-1.6, 0.6],
      [-0.4, 1.3],
      [0.9, 1.1],
      [1.9, 0.1],
      [2.3, -0.9],
    ];
    for (const [x, y] of fronds) {
      const tip = new Vector3(x * m, 1.4 + y, 0);
      const mid = new Vector3(x * 0.55 * m, 1.4 + Math.max(y, 0) * 0.6 + 0.7, 0);
      curves.push(new CatmullRomCurve3([new Vector3(0, 1.4, 0), mid, tip]));
    }
    return {
      cores: curves.map((c) => new TubeGeometry(c, 40, 0.06, 6, false)),
      halos: curves.map((c) => new TubeGeometry(c, 40, 0.2, 6, false)),
    };
  }, [mirror]);
  useEffect(
    () => () => {
      core.dispose();
      halo.dispose();
      for (const g of cores) g.dispose();
      for (const g of halos) g.dispose();
    },
    [core, halo, cores, halos],
  );
  useFrame(() => {
    const { t, e } = clock.current;
    const on = prog(t, T.studioOn + 1.2, T.studioOn + 2.0);
    const flick = on > 0 && on < 1 ? (Math.sin(e * 63) > 0.2 ? 1 : 0.1) : 1;
    const k = on * flick;
    core.color.set(BRAND.green).multiplyScalar(2.4 * k + 0.01);
    halo.color.set(BRAND.green).multiplyScalar(0.25 * k);
  });
  return (
    <group position={position} rotation-y={rotationY}>
      {cores.map((g, i) => (
        <mesh key={`c${i}`} geometry={g} material={core} />
      ))}
      {halos.map((g, i) => (
        <mesh key={`h${i}`} geometry={g} material={halo} />
      ))}
    </group>
  );
}
