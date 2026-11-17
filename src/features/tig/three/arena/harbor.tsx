"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NormalBlending,
  Object3D,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type ShaderMaterial,
} from "three";
import { REFLECT_LAYER, usePlanarReflection } from "./FloorReflector";
import { spriteMaterial } from "./fx-materials";
import type { ArenaLive } from "./live";
import { fireflyMaterial, seaMaterial, skyMaterial } from "./pirate-materials";
import { frondTexture, seeded, smokeTexture } from "./pirate-textures";
import { canvasTex, glowTexture } from "./textures";
import { useLatestRef } from "./use-latest";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * LA BAIA attorno alla TAVERNA DEL MOLO (edizione pirati, disegno originale): cielo con le stelle e la luna, mare con
 * la scia della luna (e il riflesso vero di lanterne, vela e galeone nei profili ricchi), un galeone ancorato sullo
 * sfondo (costruito in codice: scafo, castello di poppa con le finestre accese, tre alberi con le vele imbrogliate,
 * sartiame, lanterne, bandiera generica), un'isola con le palme, palme in vaso sul molo, lucciole, cannonate del
 * galeone quando suona l'ALLARME CAOS (lampi e fumo). Niente nomi, navi o simboli di franchise: iconografia generica.
 */

/** Direzione della luna (dal centro della scena): alta a sinistra, dietro la baia. */
export const MOON_DIR = new Vector3(-0.5, 0.2, -0.84).normalize();
/** Quota del mare (il piano del molo è a 0). */
export const SEA_Y = -0.75;
/** Galeone: posizione (sul mare, a destra della vela), rotazione e lunghezza. */
export const GALLEON = { x: 17, z: -48, yaw: 0.32, length: 34 } as const;

const tmpO = new Object3D();
const tmpC = new Color();
const ZERO = new Matrix4().makeScale(0, 0, 0);

// ------------------------------------------------------------------ cielo e luna
export function Sky({ liveRef }: { liveRef: RefObject<ArenaLive> }) {
  const mat = useMemo(() => skyMaterial(), []);
  const geo = useMemo(() => new SphereGeometry(130, 32, 16), []);
  useEffect(
    () => () => {
      mat.dispose();
      geo.dispose();
    },
    [mat, geo],
  );
  const matRef = useLatestRef(mat);
  useFrame(() => {
    const m = matRef.current;
    const L = liveRef.current;
    m.uniforms.uTime.value = L.t;
    m.uniforms.uDim.value += ((L.mood.mood === "chaos" ? 0.7 : 1) - m.uniforms.uDim.value) * 0.05;
  });
  // disegnato per ultimo tra gli opachi (profondità al fondo): i pixel già coperti li scarta il test di profondità
  return <mesh geometry={geo} material={mat} renderOrder={100} frustumCulled={false} />;
}

function moonTexture() {
  return canvasTex(256, 256, (ctx, w) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, w);
    const g = ctx.createRadialGradient(c * 0.9, c * 0.85, 4, c, c, c * 0.98);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.75, "#e9eefc");
    g.addColorStop(0.97, "#b9c6e8");
    g.addColorStop(1, "rgba(185,198,232,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.98, 0, Math.PI * 2);
    ctx.fill();
    // "mari" tenui
    const rnd = seeded(3);
    for (let i = 0; i < 7; i++) {
      const x = c + (rnd() - 0.5) * c * 1.1;
      const y = c + (rnd() - 0.5) * c * 1.1;
      const r = 14 + rnd() * 30;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, "rgba(140,150,180,0.35)");
      gg.addColorStop(1, "rgba(140,150,180,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function Moon() {
  const tex = useMemo(() => moonTexture(), []);
  const mat = useMemo(() => new MeshBasicMaterial({ map: tex, color: new Color(2.4, 2.4, 2.5), transparent: true, depthWrite: false, fog: false, toneMapped: false }), [tex]);
  useEffect(
    () => () => {
      tex.dispose();
      mat.dispose();
    },
    [tex, mat],
  );
  const ref = useRef<Mesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    m.position.copy(MOON_DIR).multiplyScalar(118);
    m.lookAt(0, 0, 0);
    m.layers.enable(REFLECT_LAYER);
  }, []);
  return (
    <mesh ref={ref} material={mat} renderOrder={-9} frustumCulled={false}>
      <circleGeometry args={[4.6, 48]} />
    </mesh>
  );
}

// ------------------------------------------------------------------ mare
export function Sea({ liveRef, reflect, every }: { liveRef: RefObject<ArenaLive>; reflect: number; every: number }) {
  const mat = useMemo(() => seaMaterial(), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const { texture, textureMatrix, meshRef } = usePlanarReflection({ scale: reflect, every });
  const objRef = useLatestRef({ mat, texture, textureMatrix });
  useFrame(() => {
    const { mat, texture, textureMatrix } = objRef.current;
    const L = liveRef.current;
    mat.uniforms.uTime.value = L.t;
    mat.uniforms.tReflect.value = texture;
    mat.uniforms.uTexMatrix.value = textureMatrix;
    mat.uniforms.uReflect.value = texture ? 0.85 : 0;
    const calm = L.mood.mood === "break" ? 1 : 0;
    mat.uniforms.uCalm.value += (calm - mat.uniforms.uCalm.value) * 0.02;
  });
  return (
    <mesh ref={meshRef} rotation-x={-Math.PI / 2} position-y={SEA_Y} material={mat} renderOrder={90}>
      <planeGeometry args={[420, 420]} />
    </mesh>
  );
}

// ------------------------------------------------------------------ galeone (disegno originale, costruito in codice)
function windowsTexture() {
  return canvasTex(512, 64, (ctx, w, h) => {
    ctx.fillStyle = "#120b06";
    ctx.fillRect(0, 0, w, h);
    const rnd = seeded(21);
    for (let i = 0; i < 12; i++) {
      const x = 14 + i * 41;
      const lit = rnd() > 0.28;
      ctx.fillStyle = lit ? (rnd() > 0.5 ? "#ffb35a" : "#ff9a3c") : "#1d140c";
      ctx.fillRect(x, 18, 22, 28);
      if (lit) {
        ctx.fillStyle = "rgba(255,230,170,0.85)";
        ctx.fillRect(x + 4, 22, 14, 10);
      }
    }
  });
}

function flagTexture(red: boolean) {
  return canvasTex(256, 160, (ctx, w, h) => {
    ctx.fillStyle = red ? "#a3221c" : "#0d0d10";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = red ? "#f6ead2" : "#e8e2d2";
    // teschio simpatico generico: tondo, mascella, occhi, ossa incrociate
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w / 2 - 20, h * 0.42 + 18, 40, 22);
    ctx.fillStyle = red ? "#a3221c" : "#0d0d10";
    ctx.beginPath();
    ctx.arc(w / 2 - 13, h * 0.4, 9, 0, Math.PI * 2);
    ctx.arc(w / 2 + 13, h * 0.4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = red ? "#f6ead2" : "#e8e2d2";
    ctx.save();
    ctx.translate(w / 2, h * 0.78);
    for (const r of [-0.45, 0.45]) {
      ctx.save();
      ctx.rotate(r);
      ctx.fillRect(-58, -6, 116, 12);
      ctx.restore();
    }
    ctx.restore();
  });
}

function buildGalleon(): { group: Group; dispose: () => void } {
  const group = new Group();
  const disposables: { dispose: () => void }[] = [];
  const L = GALLEON.length;
  const hl = L / 2;
  // scafo: profilo laterale estruso e poi rastremato verso prua e poppa (e verso la chiglia)
  const s = new Shape();
  s.moveTo(-hl + 2, -2.2);
  s.lineTo(-hl + 0.4, 1.2);
  s.lineTo(-hl, 5.0);
  s.lineTo(-hl + 5, 5.0);
  s.lineTo(-hl + 5.6, 3.2);
  s.lineTo(hl - 9, 2.5);
  s.lineTo(hl - 5, 3.0);
  s.lineTo(hl - 1.5, 3.4);
  s.lineTo(hl + 0.8, 1.6);
  s.lineTo(hl - 3, -1.6);
  s.lineTo(-hl + 2, -2.2);
  const hullGeo = new ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, steps: 1 });
  const pos = hullGeo.getAttribute("position") as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i) - 0.5;
    const bow = Math.min(1, Math.max(0, (x - (hl - 10)) / 11));
    const stern = Math.min(1, Math.max(0, (-hl + 3 - x) / 4));
    const keel = 0.55 + 0.45 * Math.min(1, Math.max(0, (y + 2.2) / 3.5));
    const beam = 7.4 * (1 - 0.82 * bow * bow) * (1 - 0.18 * stern) * keel;
    pos.setZ(i, z * beam);
  }
  hullGeo.computeVertexNormals();
  const hullMat = new MeshLambertMaterial({ color: "#2a1a0f" });
  const hull = new Mesh(hullGeo, hullMat);
  group.add(hull);
  disposables.push(hullGeo, hullMat);
  // fascia scura e fascia ocra lungo il fianco (si leggono sotto la luna)
  const stripeMat = new MeshLambertMaterial({ color: "#6a4a1c" });
  disposables.push(stripeMat);
  for (const side of [-1, 1]) {
    const g = new BoxGeometry(L * 0.7, 0.35, 0.05);
    disposables.push(g);
    const m = new Mesh(g, stripeMat);
    m.position.set(-1.5, 2.2, side * 3.62);
    group.add(m);
  }
  // finestre accese: castello di poppa (fianchi e specchio di poppa) e una fila di oblò
  const winTex = windowsTexture();
  const winMat = new MeshBasicMaterial({ map: winTex, color: new Color(1.8, 1.6, 1.3), toneMapped: false });
  disposables.push(winTex, winMat);
  for (const side of [-1, 1]) {
    const g = new PlaneGeometry(5.4, 0.7);
    disposables.push(g);
    const m = new Mesh(g, winMat);
    m.position.set(-hl + 2.6, 3.9, side * 3.2);
    m.rotation.y = side > 0 ? 0 : Math.PI;
    m.layers.enable(REFLECT_LAYER);
    group.add(m);
  }
  {
    const g = new PlaneGeometry(5.2, 0.8);
    disposables.push(g);
    const m = new Mesh(g, winMat);
    m.position.set(-hl - 0.02, 3.9, 0);
    m.rotation.y = -Math.PI / 2;
    m.layers.enable(REFLECT_LAYER);
    group.add(m);
  }
  // alberi, pennoni, vele imbrogliate
  const woodMat = new MeshLambertMaterial({ color: "#2b1d12" });
  const furlMat = new MeshLambertMaterial({ color: "#8f8670" });
  disposables.push(woodMat, furlMat);
  const masts = [
    { x: -9, h: 17 },
    { x: 0, h: 23 },
    { x: 8.5, h: 19 },
  ];
  const mastTops: Vector3[] = [];
  for (const m of masts) {
    const g = new CylinderGeometry(0.18, 0.38, m.h, 8);
    disposables.push(g);
    const mesh = new Mesh(g, woodMat);
    mesh.position.set(m.x, 2.5 + m.h / 2, 0);
    group.add(mesh);
    mastTops.push(new Vector3(m.x, 2.5 + m.h, 0));
    for (const k of [0.42, 0.68, 0.88]) {
      const span = (m.h * (1.15 - k)) * 0.9;
      const yg = new CylinderGeometry(0.12, 0.12, span, 6);
      yg.rotateX(Math.PI / 2);
      disposables.push(yg);
      const yard = new Mesh(yg, woodMat);
      yard.position.set(m.x, 2.5 + m.h * k, 0);
      group.add(yard);
      const fg = new CylinderGeometry(0.32, 0.32, span * 0.92, 8);
      fg.rotateX(Math.PI / 2);
      disposables.push(fg);
      const furl = new Mesh(fg, furlMat);
      furl.position.set(m.x + 0.1, 2.5 + m.h * k - 0.28, 0);
      group.add(furl);
    }
  }
  // una vela di gabbia mollata sul maestro (tela al chiaro di luna, gonfia)
  {
    const g = new PlaneGeometry(9, 5.2, 12, 6);
    const p = g.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setZ(i, Math.cos((x / 9) * Math.PI) * 0.9 * (0.6 + 0.4 * (0.5 - y / 5.2)));
    }
    g.computeVertexNormals();
    const sailMat = new MeshLambertMaterial({ color: "#b8ad92", side: DoubleSide });
    disposables.push(g, sailMat);
    const sail = new Mesh(g, sailMat);
    sail.position.set(0.25, 2.5 + 23 * 0.55, 0);
    sail.rotation.y = Math.PI / 2;
    group.add(sail);
  }
  // bompresso
  {
    const g = new CylinderGeometry(0.1, 0.22, 10, 6);
    disposables.push(g);
    const b = new Mesh(g, woodMat);
    b.position.set(hl + 3.2, 4.3, 0);
    b.rotation.z = -1.25;
    group.add(b);
  }
  // sartiame (linee sottili): dalle cime alle murate e tra gli alberi
  const pts: number[] = [];
  const push = (a: Vector3, b: Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (const top of mastTops) {
    for (const side of [-1, 1]) {
      for (const dx of [-2.2, 0, 2.2]) push(top, new Vector3(top.x + dx, 2.6, side * 3.3));
    }
  }
  push(mastTops[0], mastTops[1]);
  push(mastTops[1], mastTops[2]);
  push(mastTops[2], new Vector3(hl + 7.5, 5.8, 0));
  push(mastTops[0], new Vector3(-hl, 5.0, 0));
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
  const lineMat = new LineBasicMaterial({ color: "#2a2620", transparent: true, opacity: 0.8 });
  disposables.push(lineGeo, lineMat);
  group.add(new LineSegments(lineGeo, lineMat));
  // bandiera in cima al maestro
  const flagTex = flagTexture(false);
  const flagMat = new MeshBasicMaterial({ map: flagTex, color: new Color(0.55, 0.55, 0.6), side: DoubleSide });
  const flagGeo = new PlaneGeometry(2.4, 1.5);
  disposables.push(flagTex, flagMat, flagGeo);
  const flag = new Mesh(flagGeo, flagMat);
  flag.position.set(mastTops[1].x, mastTops[1].y + 0.4, 1.2);
  flag.rotation.y = Math.PI / 2;
  group.add(flag);
  return {
    group,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Lanterne del galeone (bagliori caldi: si riflettono nel mare). */
const GALLEON_LIGHTS: [number, number, number][] = [
  [-17.6, 5.8, 2.2],
  [-17.6, 5.8, -2.2],
  [-17.9, 6.6, 0],
  [17.0, 4.2, 0],
  [0, 25.6, 0],
];

export function Galleon({ liveRef }: { liveRef: RefObject<ArenaLive> }) {
  const built = useMemo(() => buildGalleon(), []);
  useEffect(() => () => built.dispose(), [built]);
  const glow = useMemo(() => glowTexture(), []);
  const lights = useMemo(() => {
    const m = new InstancedMesh(new PlaneGeometry(1, 1), spriteMaterial(glow), GALLEON_LIGHTS.length);
    m.frustumCulled = false;
    m.layers.enable(REFLECT_LAYER);
    GALLEON_LIGHTS.forEach((p, i) => {
      tmpO.position.set(p[0], p[1], p[2]);
      tmpO.scale.setScalar(i === 4 ? 1.2 : 2.6);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
      m.setColorAt(i, new Color(i === 4 ? "#ff6a3a" : "#ffb35a").multiplyScalar(i === 4 ? 1.2 : 2.2));
    });
    return m;
  }, [glow]);
  useEffect(
    () => () => {
      glow.dispose();
      lights.geometry.dispose();
      (lights.material as ShaderMaterial).dispose();
      lights.dispose();
    },
    [glow, lights],
  );
  const g = useRef<Group>(null);
  useFrame(() => {
    // il galeone beccheggia appena all'ancora
    const t = liveRef.current.t;
    if (g.current) {
      g.current.rotation.z = Math.sin(t * 0.4) * 0.012;
      g.current.rotation.x = Math.sin(t * 0.31 + 1) * 0.008;
      g.current.position.y = SEA_Y + Math.sin(t * 0.5) * 0.06;
    }
  });
  return (
    <group ref={g} position={[GALLEON.x, SEA_Y, GALLEON.z]} rotation-y={GALLEON.yaw}>
      <primitive object={built.group} />
      <primitive object={lights} />
    </group>
  );
}

// ------------------------------------------------------------------ palme e isola
/** Tronco e chioma di una palma come DUE geometrie (fronde unite in una: poche chiamate di disegno). */
function buildPalm(seed: number, height: number, lean: number): { trunk: BufferGeometry; fronds: BufferGeometry } {
  const rnd = seeded(seed);
  const pts: Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    pts.push(new Vector3(Math.sin(u * 1.4) * lean, u * height, Math.sin(u * 2.1) * lean * 0.25));
  }
  const curve = new CatmullRomCurve3(pts);
  const trunk = new TubeGeometry(curve, 12, 0.2, 7, false);
  const top = curve.getPoint(1);
  const n = 9;
  const parts: BufferGeometry[] = [];
  const m = new Matrix4();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const len = 2.8 + rnd() * 1.2;
    const g = new PlaneGeometry(len, len * 0.5, 6, 1);
    g.translate(len / 2, 0, 0);
    const p = g.getAttribute("position") as BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k);
      p.setZ(k, 0);
      p.setY(k, p.getY(k) - (x / len) * (x / len) * len * 0.55);
    }
    tmpO.position.copy(top);
    tmpO.rotation.set(-0.15 - rnd() * 0.2, a, 0, "YXZ");
    tmpO.scale.setScalar(1);
    tmpO.updateMatrix();
    g.applyMatrix4(m.copy(tmpO.matrix));
    parts.push(g);
  }
  tmpO.rotation.set(0, 0, 0);
  const fronds = mergeGeometries(parts) ?? parts[0];
  fronds.computeVertexNormals();
  for (const g of parts) if (g !== fronds) g.dispose();
  return { trunk, fronds };
}

/** Palme: in vaso agli angoli del molo e sull'isola in fondo alla baia. */
export interface PalmSpot {
  x: number;
  z: number;
  y?: number;
  h: number;
  lean: number;
  yaw: number;
}

/** Palme (i punti arrivano già memorizzati dal chiamante: si ricostruiscono solo se cambiano). */
export function Palms({ spots }: { spots: PalmSpot[] }) {
  const built = useMemo(() => spots.map((s, i) => ({ s, b: buildPalm(31 + i * 7, s.h, s.lean) })), [spots]);
  const mats = useMemo(() => {
    const frondTex = frondTexture();
    return {
      frondTex,
      trunk: new MeshLambertMaterial({ color: "#3a2a1c" }),
      fronds: new MeshLambertMaterial({ map: frondTex, alphaTest: 0.5, side: DoubleSide, color: "#7f9a7a" }),
    };
  }, []);
  useEffect(
    () => () => {
      mats.frondTex.dispose();
      mats.trunk.dispose();
      mats.fronds.dispose();
    },
    [mats],
  );
  useEffect(
    () => () =>
      built.forEach((x) => {
        x.b.trunk.dispose();
        x.b.fronds.dispose();
      }),
    [built],
  );
  return (
    <group>
      {built.map(({ s, b }, i) => (
        <group key={i} position={[s.x, s.y ?? 0, s.z]} rotation-y={s.yaw}>
          <mesh geometry={b.trunk} material={mats.trunk} />
          <mesh geometry={b.fronds} material={mats.fronds} />
        </group>
      ))}
    </group>
  );
}

/** Isola bassa all'orizzonte (macchia scura) con qualche palma. */
export function Island() {
  const geo = useMemo(() => {
    const g = new SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(34, 5, 11);
    return g;
  }, []);
  // sagoma: non prende luce (di notte, contro il cielo, si legge come una macchia scura)
  const mat = useMemo(() => new MeshBasicMaterial({ color: "#06100e" }), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const palms = useMemo<PalmSpot[]>(
    () => [
      { x: -38, z: -86, y: SEA_Y + 3.6, h: 9, lean: 1.4, yaw: 0.4 },
      { x: -30, z: -84, y: SEA_Y + 4.6, h: 11, lean: -1.2, yaw: 1.2 },
      { x: -20, z: -88, y: SEA_Y + 4.0, h: 8, lean: 1.0, yaw: 2.4 },
      { x: -12, z: -86, y: SEA_Y + 2.2, h: 9.5, lean: -1.6, yaw: 0.9 },
    ],
    [],
  );
  return (
    <group>
      <mesh geometry={geo} material={mat} position={[-26, SEA_Y - 0.4, -88]} />
      <Palms spots={palms} />
    </group>
  );
}

// ------------------------------------------------------------------ lucciole
export function Fireflies({ count, area, center }: { count: number; area: [number, number, number]; center: [number, number, number] }) {
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    const rnd = seeded(77);
    const seed = new Float32Array(260 * 3);
    for (let i = 0; i < seed.length; i++) seed[i] = rnd();
    g.setAttribute("position", new BufferAttribute(new Float32Array(260 * 3), 3));
    g.setAttribute("seed", new BufferAttribute(seed, 3));
    return g;
  }, []);
  const mat = useMemo(() => fireflyMaterial(), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useEffect(() => {
    geo.setDrawRange(0, Math.max(0, Math.min(260, count)));
  }, [geo, count]);
  const objRef = useLatestRef({ mat, area, center });
  useFrame((state) => {
    const { mat, area, center } = objRef.current;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uArea.value.set(area[0], area[1], area[2]);
    mat.uniforms.uCenter.value.set(center[0], center[1], center[2]);
    const fov = (state.camera as unknown as { fov?: number }).fov ?? 38;
    mat.uniforms.uPx.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

// ------------------------------------------------------------------ cannonate (ALLARME CAOS)
const SHOTS = 6;
/** Punti dei cannoni sul fianco del galeone (nel suo sistema), già ruotati nella scena. */
function gunports(): Vector3[] {
  const out: Vector3[] = [];
  const m = new Matrix4().makeRotationY(GALLEON.yaw);
  for (let i = 0; i < SHOTS; i++) {
    const v = new Vector3(-8 + i * 3.6, SEA_Y + 2.1, 3.9).applyMatrix4(m);
    v.x += GALLEON.x;
    v.z += GALLEON.z;
    out.push(v);
  }
  return out;
}

/**
 * Bordate del galeone quando suona l'ALLARME CAOS: lampi ai portelli (bagliori oltre il bianco) e sbuffi di fumo che
 * salgono e si allargano. Istanziati, sincronizzati con il tempo di scena (niente stati React).
 */
export function CannonFx({ liveRef }: { liveRef: RefObject<ArenaLive> }) {
  const glow = useMemo(() => glowTexture(), []);
  const smoke = useMemo(() => smokeTexture(), []);
  const ports = useMemo(() => gunports(), []);
  const parts = useMemo(() => {
    const flashes = new InstancedMesh(new PlaneGeometry(1, 1), spriteMaterial(glow), SHOTS);
    flashes.frustumCulled = false;
    flashes.layers.enable(REFLECT_LAYER);
    const smokeMat = new MeshBasicMaterial({ map: smoke, transparent: true, depthWrite: false, color: new Color(0.42, 0.44, 0.5), blending: NormalBlending, side: DoubleSide, fog: true });
    const puffs = new InstancedMesh(new CircleGeometry(0.5, 16), smokeMat, SHOTS * 2);
    puffs.frustumCulled = false;
    for (let i = 0; i < SHOTS; i++) {
      flashes.setMatrixAt(i, ZERO);
      flashes.setColorAt(i, new Color("#ffd28a"));
    }
    for (let i = 0; i < SHOTS * 2; i++) puffs.setMatrixAt(i, ZERO);
    return { flashes, puffs, smokeMat };
  }, [glow, smoke]);
  useEffect(
    () => () => {
      glow.dispose();
      smoke.dispose();
      for (const m of [parts.flashes, parts.puffs]) {
        m.geometry.dispose();
        (m.material as MeshBasicMaterial).dispose();
        m.dispose();
      }
    },
    [glow, smoke, parts],
  );
  const partsRef = useLatestRef(parts);
  const cam = useThree((s) => s.camera);
  useFrame(() => {
    const P = partsRef.current;
    const L = liveRef.current;
    const on = L.mood.mood === "chaos" || L.mood.mood === "duel";
    const t = L.mood.since;
    for (let i = 0; i < SHOTS; i++) {
      // ogni cannone spara a ritmo suo (bordata che corre lungo il fianco)
      const period = on ? (L.mood.mood === "chaos" ? 2.4 : 4.2) : 1e9;
      const local = (t + i * 0.23) % period;
      const p = ports[i];
      const f = on && t > 0.6 ? Math.max(0, 1 - local / 0.22) : 0;
      if (f > 0) {
        tmpO.position.set(p.x, p.y, p.z);
        tmpO.scale.setScalar(2.2 + 2.5 * f);
        tmpO.updateMatrix();
        P.flashes.setMatrixAt(i, tmpO.matrix);
        P.flashes.setColorAt(i, tmpC.setRGB(4.5 * f, 3.4 * f, 2.0 * f));
      } else P.flashes.setMatrixAt(i, ZERO);
      for (let k = 0; k < 2; k++) {
        const age = local - k * 0.15;
        const pi = i * 2 + k;
        if (!on || t < 0.6 || age < 0 || age > 3.2) {
          P.puffs.setMatrixAt(pi, ZERO);
          continue;
        }
        const s = 1.4 + age * 2.4;
        tmpO.position.set(p.x + age * 0.8, p.y + 0.4 + age * 1.1, p.z + 1.2 + age * 0.6);
        tmpO.quaternion.copy(cam.quaternion);
        tmpO.scale.setScalar(s);
        tmpO.updateMatrix();
        P.puffs.setMatrixAt(pi, tmpO.matrix);
      }
      tmpO.quaternion.identity();
    }
    // fumo: più trasparente man mano che sale (opacità unica, basta per sbuffi brevi)
    P.smokeMat.opacity = 0.55;
    P.flashes.instanceMatrix.needsUpdate = true;
    if (P.flashes.instanceColor) P.flashes.instanceColor.needsUpdate = true;
    P.puffs.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <primitive object={parts.flashes} />
      <primitive object={parts.puffs} />
    </group>
  );
}

// ------------------------------------------------------------------ ambiente riflesso del porto (PMREM)
/**
 * Ambiente riflesso generato in codice: stanza blu notte, un grande pannello freddo (la luna) in alto a sinistra
 * dietro, lanterne calde tutt'intorno ad altezza d'uomo, rimbalzo caldo dal legno. Dà all'oro dei dobloni, all'ottone
 * e ai personaggi riflessi caldi e un filo di luce fredda: la notte di mare contro le lanterne.
 */
function buildHarborEnvScene(): Scene {
  const scene = new Scene();
  scene.background = new Color("#03070c");
  const room = new Mesh(new BoxGeometry(40, 20, 40), new MeshBasicMaterial({ color: "#060d16", side: BackSide }));
  room.position.y = 6;
  scene.add(room);
  const panel = (w: number, h: number, color: string, k: number, x: number, y: number, z: number, rx: number, ry: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(color).multiplyScalar(k), side: DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    scene.add(m);
  };
  // luna (fredda) e cielo
  panel(6, 6, "#cfdcff", 2.4, -9, 11, -14, -0.4, 0.5);
  panel(30, 30, "#0d1e2e", 1.0, 0, 15, 0, Math.PI / 2, 0);
  // lanterne calde tutt'intorno
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    panel(1.4, 1.8, i % 3 === 0 ? "#ffd27a" : "#ff9a3c", 3.2, Math.sin(a) * 12, 3 + (i % 2) * 2.5, Math.cos(a) * 12, 0, a);
  }
  // chiave calda morbida davanti (lanterne del ponte)
  panel(8, 3, "#ffe0b0", 1.6, 0, 8, 13, -0.6, 0);
  // rimbalzo del legno
  panel(30, 30, "#2a1608", 0.6, 0, -3.5, 0, -Math.PI / 2, 0);
  return scene;
}

export function HarborEnvironment({ intensity = 1 }: { intensity?: number }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const src = buildHarborEnvScene();
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

