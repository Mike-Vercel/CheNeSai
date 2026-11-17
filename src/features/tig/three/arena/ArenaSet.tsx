"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  ClampToEdgeWrapping,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  type BufferAttribute,
  type DirectionalLight,
  type Group,
  type Material,
  type PointLight,
  type ShaderMaterial,
} from "three";
import { TIG } from "../palette";
import { awardsRevealed } from "./director";
import { coneMaterial, spriteMaterial } from "./fx-materials";
import { REFLECT_LAYER, useFloorMaterial } from "./FloorReflector";
import { CannonFx, Fireflies, Galleon, HarborEnvironment, Island, MOON_DIR, Moon, Palms, Sea, Sky, type PalmSpot } from "./harbor";
import type { RenderProfile } from "./perf";
import { useLatestRef } from "./use-latest";
import type { ArenaDebug } from "./debug";
import type { ArenaLive } from "./live";
import { MAST, SAIL, STAGE, TRUSS_Y, U_BACK, type ArenaLayout } from "./layout";
import { LED_CANVAS, drawLed, type LedContent, type LedTeam } from "./led-texture";
import { bannerMaterial, flameMaterial, sailMaterial } from "./pirate-materials";
import { coinFaceTexture, commandDeckTexture, deckDecal, plankTexture, seeded } from "./pirate-textures";
import { canvasTex, glowTexture } from "./textures";

/**
 * IL SET — «LA TAVERNA DEL MOLO» (edizione pirati, disegno originale): molo di tavole con la rosa dei venti dipinta,
 * ringhiera di corda con le torce, PONTE DI COMANDO col timone e le lanterne al posto del palco, ALBERO MAESTRO con
 * LA GRANDE VELA (i contenuti dello "schermo" dipinti sulla tela, testi nitidi) e la coffa con la bandiera (rossa
 * nell'allarme), sartiame con le lanterne di bordo (i fasci di luce nella nebbia del porto) e i festoni di lucine,
 * podio di casse e FORZIERE nella premiazione, PIOGGIA DI DOBLONI al posto dei coriandoli. Attorno: la baia
 * (harbor.tsx). Le luci seguono l'atmosfera della fase (`live.mood`).
 */

const C = {
  amber: new Color(TIG.amber),
  cyan: new Color(TIG.cyan),
  alarm: new Color(TIG.alarm),
  gold: new Color(TIG.gold),
  chaos: new Color(TIG.chaos),
  chill: new Color(TIG.chill),
  white: new Color("#fff1dc"),
  warm: new Color("#ffc58a"),
};

/** Mette nel riflesso del mare tutti gli oggetti del gruppo (montati una volta: il set è statico). */
export function Reflected({ children }: { children: ReactNode }) {
  const g = useRef<Group>(null);
  useEffect(() => {
    g.current?.traverse((o) => o.layers.enable(REFLECT_LAYER));
  });
  return <group ref={g}>{children}</group>;
}

const UP = new Vector3(0, 1, 0);
const tmpO = new Object3D();
const tmpV = new Vector3();
const tmpQ = new Quaternion();
const ZERO_M = new Matrix4().makeScale(0, 0, 0);

/** Matrice di un cilindro unitario (alto 1, base in 0) teso tra due punti. */
function segmentMatrix(a: Vector3, b: Vector3, r: number, out: Matrix4): Matrix4 {
  tmpV.subVectors(b, a);
  const len = tmpV.length();
  tmpQ.setFromUnitVectors(UP, tmpV.normalize());
  tmpO.position.copy(a);
  tmpO.quaternion.copy(tmpQ);
  tmpO.scale.set(r, len, r);
  tmpO.updateMatrix();
  return out.copy(tmpO.matrix);
}

function unitCylinder(seg = 6): CylinderGeometry {
  const g = new CylinderGeometry(1, 1, 1, seg, 1, true);
  g.translate(0, 0.5, 0);
  return g;
}

/** Legno (tavole) per casse, palco e ringhiere: un materiale condiviso per tavola di texture. */
function woodMaterial(map: CanvasTexture, color = "#c9a582") {
  return new MeshStandardMaterial({ color, map, roughness: 0.82, metalness: 0.02 });
}

// ------------------------------------------------------------------ molo (pavimento, bordi, pali, ringhiera, torce)
/** Contorno del molo in base alla pianta: largo quanto la U delle postazioni più un margine, dietro fino all'acqua. */
export function deckBounds(layout: ArenaLayout) {
  const halfW = Math.max(12, layout.halfWidth + 3.6);
  const back = -(Math.abs(U_BACK) + (layout.rows === 2 ? 3.2 : 2.2));
  const front = 16;
  return { halfW, back, front };
}

function Deck({ layout, pbr, torches }: { layout: ArenaLayout; pbr: boolean; torches: Vector3[] }) {
  const { halfW, back, front } = deckBounds(layout);
  const W = halfW * 2;
  const D = front - back;
  const zc = (front + back) / 2;
  const planks = useMemo(() => {
    const t = plankTexture();
    t.wrapS = t.wrapT = RepeatWrapping;
    // tavole che corrono verso la camera (linee di fuga verso il ponte)
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
    t.repeat.set(D / 1.9, W / 1.9);
    return t;
  }, [W, D]);
  const decal = useMemo(() => {
    const t = deckDecal();
    const S = Math.max(26, layout.radius * 3.4);
    t.wrapS = t.wrapT = ClampToEdgeWrapping;
    t.premultiplyAlpha = true;
    t.anisotropy = 8;
    t.repeat.set(W / S, D / S);
    t.offset.set(0.5 - (0.5 * W) / S, 0.5 - (zc + 0.5 * D) / S);
    return t;
  }, [W, D, zc, layout.radius]);
  useEffect(
    () => () => {
      planks.dispose();
      decal.dispose();
    },
    [planks, decal],
  );
  const floorMat = useFloorMaterial({ map: planks, decal, decalStrength: 0.42, pbr });

  // bordi, pali e ringhiera (istanziati)
  const parts = useMemo(() => {
    const woodTex = plankTexture(512);
    const edgeMat = woodMaterial(woodTex, "#7a5a40");
    const posts: Vector3[] = [];
    const step = 2.3;
    for (let x = -halfW + 0.4; x <= halfW - 0.3; x += step) posts.push(new Vector3(x, 0, back + 0.35));
    for (let z = back + 0.35 + step; z <= 7; z += step) {
      posts.push(new Vector3(-halfW + 0.35, 0, z));
      posts.push(new Vector3(halfW - 0.35, 0, z));
    }
    const piles = new InstancedMesh(new CylinderGeometry(0.17, 0.2, 1, 8), edgeMat, posts.length);
    const railPosts = new InstancedMesh(new BoxGeometry(0.13, 1, 0.13), edgeMat, posts.length);
    posts.forEach((p, i) => {
      tmpO.position.set(p.x, -1.3, p.z);
      tmpO.quaternion.identity();
      tmpO.scale.set(1, 2.9, 1);
      tmpO.updateMatrix();
      piles.setMatrixAt(i, tmpO.matrix);
      tmpO.position.set(p.x, 0.55, p.z);
      tmpO.scale.set(1, 1.1, 1);
      tmpO.updateMatrix();
      railPosts.setMatrixAt(i, tmpO.matrix);
    });
    // corda della ringhiera: tra pali vicini, due altezze
    const ropeMat = new MeshStandardMaterial({ color: "#a08460", roughness: 1 });
    const links: [Vector3, Vector3][] = [];
    for (let i = 0; i < posts.length; i++) {
      for (let j = i + 1; j < posts.length; j++) {
        const a = posts[i];
        const b = posts[j];
        if (Math.abs(a.distanceTo(b) - step) < 0.05 && (Math.abs(a.z - b.z) < 0.01 || Math.abs(a.x - b.x) < 0.01)) links.push([a, b]);
      }
    }
    const ropes = new InstancedMesh(unitCylinder(5), ropeMat, links.length * 2);
    const m = new Matrix4();
    links.forEach(([a, b], i) => {
      for (const [k, y] of [
        [0, 0.95],
        [1, 0.58],
      ] as const) {
        segmentMatrix(new Vector3(a.x, y, a.z), new Vector3(b.x, y - 0.06, b.z), 0.022, m);
        ropes.setMatrixAt(i * 2 + k, m);
      }
    });
    // fascia del molo verso l'acqua
    const fasciaGeo = new BoxGeometry(1, 1, 1);
    const fascia = new InstancedMesh(fasciaGeo, edgeMat, 3);
    tmpO.quaternion.identity();
    tmpO.position.set(0, -0.32, back);
    tmpO.scale.set(W, 0.64, 0.3);
    tmpO.updateMatrix();
    fascia.setMatrixAt(0, tmpO.matrix);
    for (const [i, sx] of [
      [1, -1],
      [2, 1],
    ] as const) {
      tmpO.position.set(sx * halfW, -0.32, zc);
      tmpO.scale.set(0.3, 0.64, D);
      tmpO.updateMatrix();
      fascia.setMatrixAt(i, tmpO.matrix);
    }
    const all = [piles, railPosts, ropes, fascia];
    for (const x of all) x.frustumCulled = false;
    return { all, woodTex, edgeMat, ropeMat };
  }, [halfW, back, W, D, zc]);
  useEffect(
    () => () => {
      for (const m of parts.all) {
        m.geometry.dispose();
        m.dispose();
      }
      parts.woodTex.dispose();
      parts.edgeMat.dispose();
      parts.ropeMat.dispose();
    },
    [parts],
  );
  // torce sui pali (una ogni tre): coppa di ferro + fiamma (istanziata dal Rig delle fiamme)
  const cups = useMemo(() => {
    const m = new InstancedMesh(new CylinderGeometry(0.12, 0.07, 0.2, 8), new MeshStandardMaterial({ color: "#2a2420", metalness: 0.6, roughness: 0.5 }), Math.max(1, torches.length));
    torches.forEach((p, i) => {
      tmpO.position.set(p.x, p.y - 0.1, p.z);
      tmpO.quaternion.identity();
      tmpO.scale.setScalar(1);
      tmpO.updateMatrix();
      m.setMatrixAt(i, tmpO.matrix);
    });
    m.count = torches.length;
    return m;
  }, [torches]);
  useEffect(
    () => () => {
      cups.geometry.dispose();
      (cups.material as Material).dispose();
      cups.dispose();
    },
    [cups],
  );
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, zc]} material={floorMat}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {parts.all.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <primitive object={cups} />
    </group>
  );
}

/** Punti delle torce del molo (in cima a un palo su tre della ringhiera). */
export function torchSpots(layout: ArenaLayout): Vector3[] {
  const { halfW, back } = deckBounds(layout);
  const out: Vector3[] = [];
  const step = 2.3;
  let k = 0;
  for (let x = -halfW + 0.4; x <= halfW - 0.3; x += step) if (k++ % 3 === 1) out.push(new Vector3(x, 1.28, back + 0.35));
  k = 0;
  for (let z = back + 0.35 + step; z <= 7; z += step) {
    if (k++ % 2 === 0) {
      out.push(new Vector3(-halfW + 0.35, 1.28, z));
      out.push(new Vector3(halfW - 0.35, 1.28, z));
    }
  }
  return out;
}

// ------------------------------------------------------------------ fiamme (torce del molo + lanterne del ponte)
function Flames({ liveRef, spots }: { liveRef: RefObject<ArenaLive>; spots: { p: Vector3; s: number }[] }) {
  const glow = useMemo(() => glowTexture(), []);
  const parts = useMemo(() => {
    const flames = new InstancedMesh(new PlaneGeometry(1, 1), flameMaterial(), Math.max(1, spots.length));
    const halos = new InstancedMesh(new PlaneGeometry(1, 1), spriteMaterial(glow), Math.max(1, spots.length));
    for (const m of [flames, halos]) {
      m.frustumCulled = false;
      m.layers.enable(REFLECT_LAYER);
      m.count = spots.length;
    }
    halos.renderOrder = 5;
    flames.renderOrder = 6;
    spots.forEach(({ p, s }, i) => {
      tmpO.position.copy(p);
      tmpO.quaternion.identity();
      tmpO.scale.setScalar(0.42 * s);
      tmpO.updateMatrix();
      flames.setMatrixAt(i, tmpO.matrix);
      flames.setColorAt(i, C.white);
      tmpO.position.set(p.x, p.y + 0.18 * s, p.z);
      tmpO.scale.setScalar(1.7 * s);
      tmpO.updateMatrix();
      halos.setMatrixAt(i, tmpO.matrix);
      halos.setColorAt(i, new Color("#ff9a3c").multiplyScalar(0.55));
    });
    return { flames, halos };
  }, [glow, spots]);
  useEffect(
    () => () => {
      glow.dispose();
      for (const m of [parts.flames, parts.halos]) {
        m.geometry.dispose();
        (m.material as ShaderMaterial).dispose();
        m.dispose();
      }
    },
    [glow, parts],
  );
  const partsRef = useLatestRef(parts);
  useFrame(() => {
    const L = liveRef.current;
    const m = partsRef.current.flames.material as ShaderMaterial;
    m.uniforms.uTime.value = L.t;
    // nell'allarme le fiamme si fanno rosse e alte
    const red = L.mood.mood === "chaos" ? 1 : 0;
    const halo = partsRef.current.halos;
    halo.visible = true;
    if (halo.userData.red !== red) {
      halo.userData.red = red;
      for (let i = 0; i < halo.count; i++) halo.setColorAt(i, red ? new Color("#ff3a24").multiplyScalar(0.7) : new Color("#ff9a3c").multiplyScalar(0.55));
      if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    }
  });
  return (
    <group>
      <primitive object={parts.halos} />
      <primitive object={parts.flames} />
    </group>
  );
}

// ------------------------------------------------------------------ ponte di comando (palco), timone, lanterne
function hexPoints(r: number): Vector3[] {
  const pts: Vector3[] = [];
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    pts.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  return pts;
}

function BrassHex({ r, y, mat, width = 0.05 }: { r: number; y: number; mat: Material; width?: number }) {
  const segs = useMemo(() => {
    const pts = hexPoints(r);
    return pts.slice(0, 6).map((p, i) => {
      const q = pts[i + 1];
      return { mid: p.clone().add(q).multiplyScalar(0.5), len: p.distanceTo(q), ang: Math.atan2(q.z - p.z, q.x - p.x) };
    });
  }, [r]);
  return (
    <group position-y={y}>
      {segs.map((s, i) => (
        <mesh key={i} position={s.mid} rotation={[0, -s.ang, 0]} material={mat}>
          <boxGeometry args={[s.len, width, width * 1.4]} />
        </mesh>
      ))}
    </group>
  );
}

/** Lanterne del ponte di comando (agli spigoli): punti delle fiamme (nella lanterna) per il Rig delle fiamme. */
export const DECK_LANTERNS: Vector3[] = [
  new Vector3(-2.21, STAGE.height + 1.52, -1.275),
  new Vector3(2.21, STAGE.height + 1.52, -1.275),
  new Vector3(-2.35, STAGE.height + 1.52, 1.2),
  new Vector3(2.35, STAGE.height + 1.52, 1.2),
];

/** Timone (a sinistra dietro il podio). */
export const HELM = { x: -1.3, z: -1.5 } as const;

function CommandDeck({ liveRef, family, brass, wood }: { liveRef: RefObject<ArenaLive>; family: string; brass: Material; wood: Material }) {
  const top = useMemo(() => commandDeckTexture(family), [family]);
  useEffect(() => () => top.dispose(), [top]);
  const low = STAGE.height * 0.45;
  const wheel = useRef<Group>(null);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const L = liveRef.current;
    if (!wheel.current) return;
    const m = L.mood.mood;
    // il timone: oscilla piano, gira nell'allarme e all'inizio della serata
    const spin = m === "chaos" ? 2.4 : m === "intro" && L.mood.since < 4 ? 1.2 : 0;
    wheel.current.rotation.z = spin ? wheel.current.rotation.z + spin * dt : wheel.current.rotation.z * 0.97 + Math.sin(L.t * 0.6) * 0.004;
  });
  return (
    <group>
      {/* gradino basso e piano del ponte */}
      <mesh position-y={low / 2} rotation-y={Math.PI / 6} material={wood}>
        <cylinderGeometry args={[STAGE.radius + 0.5, STAGE.radius + 0.56, low, 6]} />
      </mesh>
      <mesh position-y={(STAGE.height + low) / 2} rotation-y={Math.PI / 6} material={wood}>
        <cylinderGeometry args={[STAGE.radius, STAGE.radius + 0.04, STAGE.height - low, 6]} />
      </mesh>
      <mesh position-y={STAGE.height + 0.003} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[STAGE.radius * 0.995, 6, Math.PI / 6]} />
        <meshStandardMaterial map={top} roughness={0.7} metalness={0.05} />
      </mesh>
      <BrassHex r={STAGE.radius + 0.02} y={STAGE.height} mat={brass} />
      <BrassHex r={STAGE.radius + 0.55} y={low} mat={brass} width={0.04} />
      {/* lanterne su paletti agli spigoli */}
      {DECK_LANTERNS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position-y={STAGE.height + 0.72} material={wood}>
            <cylinderGeometry args={[0.05, 0.06, 1.44, 6]} />
          </mesh>
          <mesh position-y={p.y + 0.24} material={brass}>
            <coneGeometry args={[0.16, 0.16, 6]} />
          </mesh>
          <mesh position-y={p.y + 0.02}>
            <cylinderGeometry args={[0.11, 0.11, 0.36, 6, 1, true]} />
            <meshBasicMaterial color={new Color(1.6, 0.95, 0.42)} transparent opacity={0.55} side={DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position-y={p.y - 0.18} material={brass}>
            <cylinderGeometry args={[0.13, 0.13, 0.05, 6]} />
          </mesh>
        </group>
      ))}
      {/* timone */}
      <group position={[HELM.x, STAGE.height, HELM.z]} rotation-y={0.25}>
        <mesh position-y={0.42} material={wood}>
          <boxGeometry args={[0.26, 0.84, 0.3]} />
        </mesh>
        <group ref={wheel} position={[0, 1.08, 0.2]}>
          <mesh material={wood}>
            <torusGeometry args={[0.42, 0.04, 8, 32]} />
          </mesh>
          <mesh material={brass}>
            <torusGeometry args={[0.3, 0.018, 6, 28]} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} material={brass}>
            <cylinderGeometry args={[0.07, 0.07, 0.12, 12]} />
          </mesh>
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2;
            return (
              <group key={k} rotation-z={a}>
                <mesh position-y={0.31} material={wood}>
                  <cylinderGeometry args={[0.022, 0.026, 0.62, 6]} />
                </mesh>
                <mesh position-y={0.64} material={wood}>
                  <cylinderGeometry args={[0.03, 0.04, 0.16, 6]} />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ albero maestro, pennone, coffa, bandiera
function flagAtlas(): CanvasTexture {
  // due celle: bandiera nera (di solito) e bandiera rossa (ALLARME CAOS)
  const t = canvasTex(512, 320, (ctx) => {
    for (const [i, red] of [
      [0, false],
      [1, true],
    ] as const) {
      const x = i * 256;
      ctx.fillStyle = red ? "#a3221c" : "#141416";
      ctx.beginPath();
      ctx.moveTo(x + 6, 6);
      ctx.lineTo(x + 250, 6);
      ctx.lineTo(x + 250, 300);
      ctx.lineTo(x + 200, 270);
      ctx.lineTo(x + 150, 306);
      ctx.lineTo(x + 100, 272);
      ctx.lineTo(x + 50, 306);
      ctx.lineTo(x + 6, 290);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#efe6d2";
      const cx = x + 128;
      ctx.beginPath();
      ctx.arc(cx, 118, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 28, 140, 56, 34);
      ctx.fillStyle = red ? "#a3221c" : "#141416";
      ctx.beginPath();
      ctx.arc(cx - 17, 114, 12, 0, Math.PI * 2);
      ctx.arc(cx + 17, 114, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 3, 128, 6, 12);
      ctx.fillStyle = "#efe6d2";
      ctx.save();
      ctx.translate(cx, 222);
      for (const r of [-0.42, 0.42]) {
        ctx.save();
        ctx.rotate(r);
        ctx.beginPath();
        ctx.roundRect(-82, -9, 164, 18, 9);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  });
  t.anisotropy = 4;
  return t;
}

function MastAndSail({ liveRef, ledStatic, family, numFamily, canvasW, wood, brass }: { liveRef: RefObject<ArenaLive>; ledStatic: LedStatic; family: string; numFamily: string; canvasW: number; wood: Material; brass: Material }) {
  const yardY = SAIL.bottom + SAIL.height + 0.12;
  // bandiera in cima all'albero (stendardo istanziato: una istanza, cella 0 nera o 1 rossa)
  const flag = useMemo(() => {
    const tex = flagAtlas();
    const g = new PlaneGeometry(1.6, 1.0, 8, 5);
    g.translate(0.8, -0.5, 0);
    g.setAttribute("aCell", new InstancedBufferAttribute(new Float32Array([0]), 1));
    g.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array([0.7]), 1));
    g.setAttribute("aState", new InstancedBufferAttribute(new Float32Array([1, 0]), 2));
    const mat = bannerMaterial(tex, 2, 1);
    mat.uniforms.uWind.value = 1.6;
    const m = new InstancedMesh(g, mat, 1);
    tmpO.position.set(MAST.x + 0.05, MAST.height + 0.05, MAST.z);
    tmpO.quaternion.identity();
    tmpO.scale.setScalar(1);
    tmpO.updateMatrix();
    m.setMatrixAt(0, tmpO.matrix);
    m.frustumCulled = false;
    return { m, tex, mat };
  }, []);
  useEffect(
    () => () => {
      flag.m.geometry.dispose();
      flag.mat.dispose();
      flag.tex.dispose();
      flag.m.dispose();
    },
    [flag],
  );
  const flagRef = useLatestRef(flag);
  useFrame(() => {
    const L = liveRef.current;
    const f = flagRef.current;
    f.mat.uniforms.uTime.value = L.t;
    const cell = f.m.geometry.getAttribute("aCell") as InstancedBufferAttribute;
    const want = L.mood.mood === "chaos" ? 1 : 0;
    if (cell.getX(0) !== want) {
      cell.setX(0, want);
      cell.needsUpdate = true;
    }
  });
  // sartie e scotte: dalla coffa ai fianchi del ponte, dalle bugne della vela al ponte
  const ropes = useMemo(() => {
    const links: [Vector3, Vector3, number][] = [];
    const top = new Vector3(MAST.x, MAST.height - 2.0, MAST.z);
    for (const s of [-1, 1]) {
      links.push([top, new Vector3(s * 2.0, STAGE.height, MAST.z - 0.4), 0.025]);
      links.push([top, new Vector3(s * 3.4, 0.25, MAST.z - 1.6), 0.025]);
      links.push([new Vector3((s * SAIL.bottomWidth) / 2, SAIL.bottom, SAIL.z + 0.05), new Vector3(s * 3.2, 0.3, MAST.z - 0.9), 0.022]);
      links.push([new Vector3((s * (SAIL.width + 1.0)) / 2, yardY, SAIL.z - 0.08), new Vector3(MAST.x, MAST.height - 1.2, MAST.z), 0.02]);
    }
    const m = new InstancedMesh(unitCylinder(5), new MeshStandardMaterial({ color: "#8f7552", roughness: 1 }), links.length);
    const mm = new Matrix4();
    links.forEach(([a, b, r], i) => m.setMatrixAt(i, segmentMatrix(a, b, r, mm)));
    m.frustumCulled = false;
    return m;
  }, [yardY]);
  useEffect(
    () => () => {
      ropes.geometry.dispose();
      (ropes.material as Material).dispose();
      ropes.dispose();
    },
    [ropes],
  );
  return (
    <group>
      {/* albero maestro */}
      <mesh position={[MAST.x, MAST.height / 2, MAST.z]} material={wood}>
        <cylinderGeometry args={[MAST.radius * 0.7, MAST.radius, MAST.height, 10]} />
      </mesh>
      {[3.2, 6.4, 9.4].map((y) => (
        <mesh key={y} position={[MAST.x, y, MAST.z]} material={brass}>
          <cylinderGeometry args={[MAST.radius * 1.12, MAST.radius * 1.12, 0.1, 10]} />
        </mesh>
      ))}
      {/* pennone */}
      <mesh position={[0, yardY, SAIL.z - 0.08]} rotation-z={Math.PI / 2} material={wood}>
        <cylinderGeometry args={[0.1, 0.14, SAIL.width + 1.2, 8]} />
      </mesh>
      {/* coffa */}
      <group position={[MAST.x, MAST.height - 2.0, MAST.z]}>
        <mesh material={wood}>
          <cylinderGeometry args={[0.7, 0.62, 0.42, 12, 1, true]} />
        </mesh>
        <mesh position-y={-0.2} rotation-x={-Math.PI / 2} material={wood}>
          <circleGeometry args={[0.66, 12]} />
        </mesh>
        <mesh position-y={0.21} rotation-x={Math.PI / 2} material={brass}>
          <torusGeometry args={[0.7, 0.03, 6, 24]} />
        </mesh>
      </group>
      <primitive object={flag.m} />
      <primitive object={ropes} />
      <Reflected>
        <Sail liveRef={liveRef} ledStatic={ledStatic} family={family} numFamily={numFamily} canvasW={canvasW} />
      </Reflected>
    </group>
  );
}

// ------------------------------------------------------------------ la grande vela (contenuti dello "schermo")
/** Testi della vela che arrivano dalle props (titolo, sottotitolo, manche). */
export interface LedStatic {
  title: string | null;
  subtitle: string | null;
  mancheNo: number | null;
}

const LED_MODES = ["ambient", "logo", "manche", "title", "leaderboard", "alarm", "vs", "evolve", "break", "final", "awards"] as const;

/**
 * Contenuto della vela ricavato a ogni fotogramma dallo stato vivo (classifica animata, spotlight, premiazione)
 * in un oggetto riusato; restituisce una firma numerica: se cambia, si ridisegna il canvas.
 */
function updateLedContent(L: ArenaLive, st: LedStatic, c: LedContent, pool: Map<string, LedTeam>): number {
  c.mode = L.dir.led;
  c.title = st.title;
  c.subtitle = st.subtitle;
  c.mancheNo = st.mancheNo;
  c.scale = L.ranks.scale;
  c.awardsShown = L.mood.mood === "awards" ? awardsRevealed(L.elapsedMs, L.teams.length) : 0;
  c.teams.length = 0;
  c.focus.length = 0;
  let sig = LED_MODES.indexOf(c.mode) * 7919 + c.awardsShown * 131 + Math.round(c.scale);
  const dynamic = c.mode === "leaderboard" || c.mode === "vs" || c.mode === "evolve" || c.mode === "awards" || c.mode === "alarm";
  for (let i = 0; i < L.teams.length; i++) {
    const t = L.teams[i];
    let e = pool.get(t.teamId);
    if (!e) {
      e = { teamId: t.teamId, tableNo: 0, name: "", color: "", score: 0, rank: 0, place: 0, row: 0, level: 1 };
      pool.set(t.teamId, e);
    }
    const a = L.ranks.get(t.teamId);
    e.tableNo = t.tableNo;
    e.name = t.name;
    e.color = t.color;
    e.score = a ? a.score : t.score;
    e.row = a ? a.row : t.rank - 1;
    e.rank = t.rank;
    e.place = L.podiumIds.indexOf(t.teamId) + 1;
    e.level = t.mascotLevel;
    c.teams.push(e);
    if (dynamic) sig += (Math.round(e.score) * 31 + Math.round(e.row * 24) * 7 + e.level * 3 + e.rank + e.place * 101) * (i + 1);
  }
  const ids = L.spotlight?.teamIds ?? [];
  for (let k = 0; k < ids.length; k++) {
    const e = pool.get(ids[k]);
    if (e) {
      c.focus.push(e);
      sig += (k + 1) * 977 * (e.tableNo + 1);
    }
  }
  return sig;
}

/** Geometria della vela: trapezio (più larga in basso) con la pancia verso la camera, più forte in basso al centro. */
function sailGeometry(): BufferGeometry {
  const g = new PlaneGeometry(1, 1, 44, 16);
  const p = g.getAttribute("position") as BufferAttribute;
  const uv = g.getAttribute("uv") as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const w = SAIL.bottomWidth + (SAIL.width - SAIL.bottomWidth) * v;
    const belly = SAIL.belly * Math.sin(Math.PI * u) * (0.12 + 0.88 * Math.pow(1 - v, 0.6));
    p.setXYZ(i, (u - 0.5) * w, SAIL.bottom + v * SAIL.height, SAIL.z + belly);
  }
  g.computeVertexNormals();
  return g;
}

/** Gratile (corda dell'orlo) lungo i bordi della vela. */
function boltRopeGeometry(): TubeGeometry {
  const pts: Vector3[] = [];
  const n = 24;
  // giro completo: alto (dritto, sul pennone), lato destro, basso (con la pancia), lato sinistro
  pts.push(new Vector3(-SAIL.width / 2, SAIL.bottom + SAIL.height, SAIL.z + SAIL.belly * 0.0));
  pts.push(new Vector3(SAIL.width / 2, SAIL.bottom + SAIL.height, SAIL.z));
  for (let i = 0; i <= n; i++) {
    const u = 1 - i / n;
    pts.push(new Vector3((u - 0.5) * SAIL.bottomWidth, SAIL.bottom, SAIL.z + SAIL.belly * Math.sin(Math.PI * u)));
  }
  pts.push(new Vector3(-SAIL.width / 2, SAIL.bottom + SAIL.height, SAIL.z));
  const curve = new CatmullRomCurve3(pts, false, "catmullrom", 0.05);
  return new TubeGeometry(curve, 160, 0.045, 5, false);
}

function Sail({ liveRef, ledStatic, family, numFamily, canvasW }: { liveRef: RefObject<ArenaLive>; ledStatic: LedStatic; family: string; numFamily: string; canvasW: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = canvasW;
    c.height = Math.round((c.width * LED_CANVAS.h) / LED_CANVAS.w);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    // mipmap + anisotropia: la tela vista di scorcio e da lontano resta pulita (niente scalette sulle scritte)
    t.anisotropy = 8;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = true;
    return t;
  }, [canvasW]);
  const mat = useMemo(() => sailMaterial(tex), [tex]);
  const geo = useMemo(() => sailGeometry(), []);
  const rope = useMemo(() => boltRopeGeometry(), []);
  const ropeMat = useMemo(() => new MeshStandardMaterial({ color: "#b39a74", roughness: 1 }), []);
  useEffect(
    () => () => {
      tex.dispose();
      mat.dispose();
      geo.dispose();
      rope.dispose();
      ropeMat.dispose();
    },
    [tex, mat, geo, rope, ropeMat],
  );
  const invalidate = useThree((s) => s.invalidate);
  // contenuto riusato (nessuna allocazione per fotogramma) e firma dell'ultimo disegno
  const draw = useRef({
    content: { mode: "logo", title: null, subtitle: null, mancheNo: null, teams: [], focus: [], awardsShown: 0, scale: 300 } as LedContent,
    pool: new Map<string, LedTeam>(),
    sig: NaN,
    at: -1,
    force: true,
  });
  const staticRef = useRef(ledStatic);
  // testi nuovi o caratteri pronti → ridisegno forzato
  const staticKey = `${ledStatic.title}|${ledStatic.subtitle}|${ledStatic.mancheNo}|${family}|${numFamily}`;
  useEffect(() => {
    staticRef.current = ledStatic;
    draw.current.force = true;
    invalidate();
  });
  useEffect(() => {
    const again = () => {
      draw.current.force = true;
      invalidate();
    };
    document.fonts?.ready.then(again).catch(() => undefined);
    const late = setTimeout(again, 1400);
    return () => clearTimeout(late);
  }, [staticKey, invalidate]);
  const objRef = useLatestRef({ tex, mat });
  useFrame(() => {
    const { tex, mat } = objRef.current;
    const L = liveRef.current;
    const D = draw.current;
    const sig = updateLedContent(L, staticRef.current, D.content, D.pool);
    const now = performance.now();
    // al massimo ~20 ridisegni al secondo mentre la classifica scorre
    if (D.force || (sig !== D.sig && now - D.at > 50)) {
      drawLed(tex.image as HTMLCanvasElement, D.content, family, numFamily);
      tex.needsUpdate = true;
      D.sig = sig;
      D.at = now;
      D.force = false;
      L.busy.led = true;
    } else L.busy.led = sig !== D.sig;
    mat.uniforms.uTime.value = L.t;
    mat.uniforms.uAlarm.value += ((L.dir.led === "alarm" ? 1 : 0) - mat.uniforms.uAlarm.value) * 0.2;
    const tint = L.mood.mood === "break" ? 0.78 : L.mood.mood === "game" ? 0.94 : 1;
    mat.uniforms.uBright.value += (tint - mat.uniforms.uBright.value) * 0.1;
    mat.uniforms.uWind.value += ((L.mood.mood === "chaos" ? 2.2 : L.mood.mood === "break" ? 0.5 : 1) - mat.uniforms.uWind.value) * 0.03;
  });
  return (
    <group>
      <mesh geometry={geo} material={mat} />
      <mesh geometry={rope} material={ropeMat} />
    </group>
  );
}

// ------------------------------------------------------------------ podio di casse e forziere della premiazione
export const PODIUM_SPOTS = [
  { place: 1, x: 0, h: 1.45 },
  { place: 2, x: -1.04, h: 1.04 },
  { place: 3, x: 1.04, h: 0.74 },
] as const;
/** Lato delle casse del podio. */
const PODIUM_W = 0.96;
export const PODIUM_Z = -0.45;

function crateFace(place: number, numFamily: string): CanvasTexture {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = `900 170px ${numFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const col = place === 1 ? TIG.goldLight : place === 2 ? "#e6e2d6" : "#e3a56a";
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(27,20,16,0.9)";
    ctx.strokeText(String(place), w / 2, h / 2 + 10);
    ctx.fillStyle = col;
    ctx.fillText(String(place), w / 2, h / 2 + 10);
  });
}

function Podium({ liveRef, numFamily, wood, iron }: { liveRef: RefObject<ArenaLive>; numFamily: string; wood: Material; iron: Material }) {
  const g = useRef<Group>(null);
  const faces = useMemo(() => PODIUM_SPOTS.map((s) => crateFace(s.place, numFamily)), [numFamily]);
  useEffect(() => () => faces.forEach((f) => f.dispose()), [faces]);
  useFrame(() => {
    const k = liveRef.current.podium;
    if (!g.current) return;
    g.current.visible = k > 0.01;
    g.current.scale.set(1, Math.max(0.001, k), 1);
  });
  return (
    <group ref={g} position={[0, STAGE.height, PODIUM_Z]} visible={false}>
      {PODIUM_SPOTS.map((s, i) => (
        <group key={s.place} position-x={s.x}>
          <mesh position-y={s.h / 2} material={wood}>
            <boxGeometry args={[PODIUM_W, s.h, PODIUM_W]} />
          </mesh>
          {/* spigoli di ferro in alto e in basso */}
          {[s.h - 0.03, 0.03].map((y) => (
            <mesh key={y} position-y={y} material={iron}>
              <boxGeometry args={[PODIUM_W + 0.03, 0.06, PODIUM_W + 0.03]} />
            </mesh>
          ))}
          {/* numero dipinto sulla faccia davanti */}
          <mesh position={[0, s.h * 0.52, PODIUM_W / 2 + 0.005]}>
            <planeGeometry args={[Math.min(0.78, s.h * 0.85), Math.min(0.78, s.h * 0.85)]} />
            <meshBasicMaterial map={faces[i]} transparent toneMapped={false} depthWrite={false} color={s.place === 1 ? new Color(1.25, 1.15, 1.0) : new Color(0.95, 0.95, 0.95)} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Forziere davanti al podio: compare con la premiazione, si apre col 1° posto (luce d'oro, monete che schizzano). */
function Chest({ liveRef, wood, iron, gold }: { liveRef: RefObject<ArenaLive>; wood: Material; iron: Material; gold: Material }) {
  const root = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const glowTex = useMemo(() => glowTexture(), []);
  const glow = useMemo(() => {
    const m = new InstancedMesh(new PlaneGeometry(1, 1), spriteMaterial(glowTex), 1);
    m.frustumCulled = false;
    m.renderOrder = 7;
    m.setMatrixAt(0, ZERO_M);
    m.setColorAt(0, new Color("#ffcf6a"));
    return m;
  }, [glowTex]);
  useEffect(
    () => () => {
      glowTex.dispose();
      glow.geometry.dispose();
      (glow.material as ShaderMaterial).dispose();
      glow.dispose();
    },
    [glowTex, glow],
  );
  const st = useRef({ open: 0 });
  const glowRef = useLatestRef(glow);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const L = liveRef.current;
    const show = L.mood.mood === "awards" ? L.podium : 0;
    if (root.current) {
      root.current.visible = show > 0.02;
      root.current.scale.setScalar(Math.max(0.001, show));
    }
    const first = L.mood.mood === "awards" && awardsRevealed(L.elapsedMs, L.teams.length) >= 3 ? 1 : 0;
    st.current.open += (first - st.current.open) * (1 - Math.exp(-dt * 2.5));
    if (lid.current) lid.current.rotation.x = -st.current.open * 1.9;
    const m = glowRef.current;
    if (m) {
      const k = st.current.open * show;
      tmpO.position.set(0, STAGE.height + 0.62, 1.08);
      tmpO.quaternion.identity();
      tmpO.scale.setScalar(k > 0.01 ? 1.6 + 0.8 * k + 0.15 * Math.sin(L.t * 4) : 0);
      tmpO.updateMatrix();
      m.setMatrixAt(0, tmpO.matrix);
      m.setColorAt(0, cT.set("#ffcf6a").multiplyScalar(2.4 * k));
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });
  return (
    <group>
      <group ref={root} position={[0, STAGE.height, 1.08]} visible={false}>
        <mesh position-y={0.24} material={wood}>
          <boxGeometry args={[0.96, 0.48, 0.6]} />
        </mesh>
        {[-0.36, 0, 0.36].map((x) => (
          <mesh key={x} position={[x, 0.24, 0]} material={iron}>
            <boxGeometry args={[0.06, 0.5, 0.62]} />
          </mesh>
        ))}
        {/* monete dentro */}
        <mesh position-y={0.42} scale={[0.44, 0.12, 0.26]} material={gold}>
          <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* coperchio a botte, incernierato dietro */}
        <group ref={lid} position={[0, 0.48, -0.3]}>
          <mesh position={[0, 0, 0.3]} rotation-z={Math.PI / 2} material={wood}>
            <cylinderGeometry args={[0.3, 0.3, 0.96, 14, 1, false, 0, Math.PI]} />
          </mesh>
          {[-0.36, 0.36].map((x) => (
            <mesh key={x} position={[x, 0, 0.3]} rotation-z={Math.PI / 2} material={iron}>
              <cylinderGeometry args={[0.315, 0.315, 0.06, 14, 1, true, 0, Math.PI]} />
            </mesh>
          ))}
        </group>
      </group>
      <primitive object={glow} />
    </group>
  );
}

// ------------------------------------------------------------------ lanterne di bordo appese al sartiame, fasci, festoni
interface Fixture {
  pos: Vector3;
  phase: number;
  angle: number;
}

const ZERO_MAT = new Matrix4().makeScale(0, 0, 0);
const vTarget = new Vector3();
const vDir = new Vector3();
const UP_NEG = new Vector3(0, -1, 0);
const cT = new Color();
const MAX_FIXTURES = 12;
const BULBS = 7;

function Rig({ liveRef, radius, low, reduced, fixtures: shown, cones: showCones = true, brass }: { liveRef: RefObject<ArenaLive>; radius: number; low: boolean; reduced: boolean; fixtures: number; cones?: boolean; brass: Material }) {
  const ringR = Math.max(7.2, radius + 0.4);
  const count = MAX_FIXTURES;
  const fixtures = useMemo<Fixture[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        // ordine "a ventaglio": i primi N restano distribuiti su tutto l'anello qualunque sia N
        const k = (i * 5) % count;
        const a = (k / count) * Math.PI * 2 + 0.1;
        return { pos: new Vector3(Math.sin(a) * ringR, TRUSS_Y - 0.35, Math.cos(a) * ringR), phase: i * 0.83, angle: a };
      }),
    [count, ringR],
  );
  const glowTex = useMemo(() => glowTexture(), []);
  const parts = useMemo(() => {
    const geo = new ConeGeometry(1, 1, low ? 14 : 20, 1, true);
    geo.translate(0, -0.5, 0);
    const mat = coneMaterial();
    mat.uniforms.uHaze.value = low ? 1.4 : 1.7;
    const cones = new InstancedMesh(geo, mat, count);
    cones.frustumCulled = false;
    cones.renderOrder = 2;
    for (let i = 0; i < count; i++) cones.setColorAt(i, C.white);
    // lanterna: cappello d'ottone + vetro acceso + alone
    const body = new InstancedMesh(new CylinderGeometry(0.14, 0.19, 0.12, 8), brass, count);
    const glass = new InstancedMesh(new CylinderGeometry(0.11, 0.11, 0.24, 8), new MeshBasicMaterial({ toneMapped: false }), count);
    const halo = new InstancedMesh(new PlaneGeometry(1, 1), spriteMaterial(glowTex), count);
    for (const m of [body, glass, halo]) m.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      glass.setColorAt(i, C.white);
      halo.setColorAt(i, C.white);
    }
    glass.layers.enable(REFLECT_LAYER);
    halo.layers.enable(REFLECT_LAYER);
    // sartiame: dalla cima dell'albero a ogni lanterna (e dalle lanterne di dietro giù fino al molo), festoni di lucine
    const masthead = new Vector3(MAST.x, MAST.height - 0.5, MAST.z);
    const links: [Vector3, Vector3][] = [];
    for (const f of fixtures) {
      links.push([masthead, f.pos]);
      if (f.pos.z < 1.5) links.push([f.pos, new Vector3(f.pos.x * 1.25, 0.3, f.pos.z * 1.25 - 0.5)]);
    }
    const ropes = new InstancedMesh(unitCylinder(5), new MeshStandardMaterial({ color: "#7d6446", roughness: 1 }), links.length);
    const mm = new Matrix4();
    links.forEach(([a, b], i) => ropes.setMatrixAt(i, segmentMatrix(a, b, 0.022, mm)));
    ropes.frustumCulled = false;
    const bulbs = new InstancedMesh(new PlaneGeometry(1, 1), spriteMaterial(glowTex), links.length * BULBS);
    bulbs.frustumCulled = false;
    bulbs.layers.enable(REFLECT_LAYER);
    const rnd = seeded(12);
    links.forEach(([a, b], i) => {
      for (let k = 0; k < BULBS; k++) {
        const u = (k + 1) / (BULBS + 1);
        tmpO.position.lerpVectors(a, b, u);
        tmpO.position.setY(tmpO.position.y - Math.sin(u * Math.PI) * 0.25);
        tmpO.quaternion.identity();
        tmpO.scale.setScalar(0.28);
        tmpO.updateMatrix();
        bulbs.setMatrixAt(i * BULBS + k, tmpO.matrix);
        bulbs.setColorAt(i * BULBS + k, new Color(rnd() > 0.25 ? "#ffb35a" : "#ffe1a0").multiplyScalar(1.6));
      }
    });
    return { cones, body, glass, halo, ropes, bulbs, all: [cones, body, glass, halo, ropes, bulbs] };
  }, [count, low, brass, glowTex, fixtures]);
  useEffect(
    () => () => {
      glowTex.dispose();
      for (const m of parts.all) {
        m.geometry.dispose();
        if (m.material !== brass) (m.material as Material).dispose();
        m.dispose();
      }
    },
    [parts, glowTex, brass],
  );
  const smooth = useRef(fixtures.map(() => ({ x: 0, z: 0, i: 0.3, c: new Color("#ffffff"), init: false })));
  const objRef = useLatestRef({ parts, shown });

  useFrame((_, rawDt) => {
    const { parts: P, shown } = objRef.current;
    const n0 = Math.max(1, Math.min(count, shown));
    P.cones.count = P.body.count = P.glass.count = P.halo.count = n0;
    const dt = Math.min(0.1, rawDt);
    const L = liveRef.current;
    const t = reduced ? 0 : L.t;
    const mood = L.mood.mood;
    const since = L.mood.since;
    const pods = L.layout.pods;
    const focus = L.spotlight?.teamIds ?? [];
    const focusIdx = focus.map((id) => L.teams.findIndex((tm) => tm.teamId === id)).filter((i) => i >= 0);
    const n = pods.length;
    fixtures.forEach((f, i) => {
      let tx = 0;
      let tz = 0;
      let inten = 0.3;
      let col = C.warm;
      let angle = 0.13;
      const home = pods.length ? pods[(i * 7) % n] : null;
      switch (mood) {
        case "lobby": {
          const a = t * 0.22 + f.phase;
          tx = Math.sin(f.angle) * radius * 0.7 + Math.cos(a) * 2.2;
          tz = Math.cos(f.angle) * radius * 0.6 + Math.sin(a * 1.3) * 1.6;
          col = i % 3 === 0 ? C.amber : i % 3 === 1 ? C.warm : C.white;
          inten = 0.26;
          break;
        }
        case "intro": {
          if (since < 3.5) {
            const a = t * 1.6 + f.phase * 2;
            tx = Math.cos(a) * radius;
            tz = Math.sin(a) * radius * 0.8;
            col = i % 2 ? C.amber : C.white;
            inten = 0.5;
          } else {
            const a = t * 0.5 + f.phase;
            tx = Math.cos(a) * 0.8;
            tz = 0.6 + Math.sin(a) * 0.5;
            col = i % 2 ? C.amber : C.warm;
            inten = 0.4;
            angle = 0.1;
          }
          break;
        }
        case "manche": {
          const conv = Math.min(1, since / 1.2);
          const a = t * 0.9 + f.phase;
          tx = (1 - conv) * Math.sin(f.angle) * radius + conv * Math.cos(a) * 1.2;
          tz = (1 - conv) * Math.cos(f.angle) * radius + conv * (0.4 + Math.sin(a) * 0.8);
          col = i % 3 === 2 ? C.white : C.amber;
          inten = 0.46;
          break;
        }
        case "game": {
          if (home) {
            tx = home.x + Math.sin(t * 0.3 + f.phase) * 0.25;
            tz = home.z + Math.cos(t * 0.27 + f.phase) * 0.25;
          }
          col = i % 4 === 0 ? C.amber : C.warm;
          inten = 0.16;
          angle = 0.1;
          break;
        }
        case "reveal": {
          const flash = Math.exp(-since * 2.2);
          tx = Math.sin(f.phase * 3) * 1.4;
          tz = 0.6 + Math.cos(f.phase * 3) * 1.0;
          col = C.white;
          inten = 0.26 + 0.6 * flash;
          break;
        }
        case "leaderboard": {
          const k = n ? Math.floor((t * 1.2 + i) % n) : 0;
          const p = pods[k];
          if (p) {
            tx = p.x;
            tz = p.z;
          }
          col = i % 2 ? C.gold : C.amber;
          inten = 0.38;
          break;
        }
        case "chaos": {
          // allarme: fasci che girano veloci, rosso bandiera, lampeggio
          const a = t * 4.2 + f.phase * 1.7;
          tx = Math.sin(f.angle) * radius * 0.5 + Math.cos(a) * 3.2;
          tz = Math.cos(f.angle) * radius * 0.5 + Math.sin(a) * 3.2;
          col = i % 4 === 0 ? C.white : C.alarm;
          inten = (0.55 + 0.25 * Math.sin(t * 9 + i)) * (reduced ? 1 : Math.floor(t * 5) % 2 ? 1 : 0.55);
          angle = 0.16;
          break;
        }
        case "duel": {
          const target = focusIdx.length ? pods[focusIdx[i % focusIdx.length]] : home;
          if (target) {
            tx = target.x;
            tz = target.z;
          }
          col = i % 2 ? C.white : C.cyan;
          inten = i < 4 ? 0.6 : 0.05;
          angle = 0.075;
          break;
        }
        case "evolve": {
          const target = focusIdx.length ? pods[focusIdx[0]] : home;
          const a = t * 1.4 + f.phase;
          if (target) {
            tx = target.x + Math.cos(a) * (1.2 - Math.min(1, since / 1.8));
            tz = target.z + Math.sin(a) * (1.2 - Math.min(1, since / 1.8));
          }
          col = i % 3 === 0 ? C.white : C.gold;
          inten = 0.5;
          angle = 0.09;
          break;
        }
        case "break": {
          const a = t * 0.12 + f.phase;
          tx = Math.cos(a) * radius * 0.9;
          tz = Math.sin(a * 1.2) * radius * 0.7;
          col = i % 2 ? C.chill : C.warm;
          inten = 0.1;
          break;
        }
        case "final": {
          const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 1.1)), 12);
          const a = t * 0.22 + f.phase;
          tx = Math.cos(a) * 1.6;
          tz = 0.4 + Math.sin(a) * 1.2;
          col = i % 3 === 0 ? C.white : C.gold;
          inten = 0.24 + 0.3 * beat;
          angle = 0.11;
          break;
        }
        case "awards": {
          const a = t * 1.1 + f.phase * 1.4;
          const conv = Math.min(1, since / 2);
          tx = (1 - conv) * Math.cos(a) * radius + conv * Math.cos(a) * 1.3;
          tz = (1 - conv) * Math.sin(a) * radius + conv * (Math.sin(a) * 0.8 - 0.3);
          col = i % 3 === 0 ? C.white : C.gold;
          inten = 0.5 + 0.15 * Math.sin(t * 5 + i);
          break;
        }
      }
      const S = smooth.current[i];
      const k = S.init ? 1 - Math.exp(-dt * (mood === "chaos" ? 14 : 4)) : 1;
      S.x += (tx - S.x) * k;
      S.z += (tz - S.z) * k;
      S.i += (inten - S.i) * (1 - Math.exp(-dt * 6));
      S.c.lerp(col, S.init ? 1 - Math.exp(-dt * 5) : 1);
      S.init = true;
      vTarget.set(S.x, 0, S.z);
      vDir.subVectors(vTarget, f.pos);
      const len = vDir.length();
      vDir.normalize();
      tmpQ.setFromUnitVectors(UP_NEG, vDir);
      const rad = len * Math.tan(angle * 0.85);
      // la lanterna dondola appena
      const sway = reduced ? 0 : Math.sin(t * 1.3 + f.phase) * 0.04;
      tmpO.position.set(f.pos.x + sway, f.pos.y, f.pos.z);
      tmpO.quaternion.copy(tmpQ);
      tmpO.scale.set(rad, len, rad);
      tmpO.updateMatrix();
      P.cones.setMatrixAt(i, S.i < 0.03 ? ZERO_MAT : tmpO.matrix);
      P.cones.setColorAt(i, cT.copy(S.c).multiplyScalar(S.i));
      tmpO.quaternion.identity();
      tmpO.scale.setScalar(1);
      tmpO.position.y = f.pos.y + 0.18;
      tmpO.updateMatrix();
      P.body.setMatrixAt(i, tmpO.matrix);
      tmpO.position.y = f.pos.y;
      tmpO.updateMatrix();
      P.glass.setMatrixAt(i, tmpO.matrix);
      P.glass.setColorAt(i, cT.copy(C.amber).lerp(S.c, 0.3).multiplyScalar(1.2 + S.i * 2));
      tmpO.scale.setScalar(0.8 + S.i * 1.0);
      tmpO.updateMatrix();
      P.halo.setMatrixAt(i, tmpO.matrix);
      P.halo.setColorAt(i, cT.copy(C.amber).lerp(S.c, 0.3).multiplyScalar(0.35 + S.i * 0.7));
    });
    for (const m of [P.cones, P.body, P.glass, P.halo]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <primitive object={parts.ropes} />
      <primitive object={parts.bulbs} />
      <primitive object={parts.body} />
      <primitive object={parts.glass} />
      <primitive object={parts.halo} />
      {showCones && <primitive object={parts.cones} />}
    </group>
  );
}

// ------------------------------------------------------------------ pioggia di dobloni (premiazione, vincitore)
function CoinRain({ liveRef, count, shown, gold }: { liveRef: RefObject<ArenaLive>; count: number; shown: number; gold: Material }) {
  const mesh = useMemo(() => {
    const m = new InstancedMesh(new CylinderGeometry(0.075, 0.075, 0.012, 14), gold, count);
    m.frustumCulled = false;
    m.visible = false;
    return m;
  }, [count, gold]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.dispose();
    },
    [mesh],
  );
  const seeds = useMemo(() => {
    const rnd = seeded(91);
    return Array.from({ length: count }, () => [rnd(), rnd(), rnd()]);
  }, [count]);
  const meshRef = useLatestRef(mesh);
  useFrame(() => {
    const mesh = meshRef.current;
    const L = liveRef.current;
    const winner = L.spotlight?.kind === "winner" && L.spotAgeMs < 6000;
    const on = (L.mood.mood === "awards" && L.elapsedMs > 7800) || winner;
    mesh.visible = on;
    if (!on) return;
    mesh.count = Math.max(1, Math.min(count, shown));
    const t = L.t;
    seeds.forEach((s, i) => {
      const fall = 1.3 + s[1] * 1.1;
      const y = 9 - ((t * fall + s[0] * 9.5) % 9.5);
      tmpO.position.set((s[0] - 0.5) * 12 + Math.sin(t * 1.1 + i) * 0.25, y, (s[2] - 0.5) * 8 + 0.5);
      tmpO.rotation.set(t * (3 + s[2] * 4) + i, t * (2 + s[1] * 2), i * 0.7);
      tmpO.scale.setScalar(1);
      tmpO.updateMatrix();
      mesh.setMatrixAt(i, tmpO.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

// ------------------------------------------------------------------ luci vere (poche: il resto è emissivo)
/**
 * Luci VERE al minimo (il costo per pixel conta): cielo/terra (emisferica), una chiave calda dalle lanterne del ponte,
 * il CHIARO DI LUNA freddo da dietro (controluce su postazioni, personaggi e vela), due lanterne calde ai lati e la
 * luce dell'atmosfera della fase. Torce, lanterne di bordo e fasci sono emissivi (bagliore del postprocessing).
 */
export function ArenaLighting({ liveRef }: { liveRef: RefObject<ArenaLive>; high: boolean }) {
  const mood = useRef<PointLight>(null);
  const key = useRef<DirectionalLight>(null);
  const moon = useRef<DirectionalLight>(null);
  const rimL = useRef<PointLight>(null);
  const rimR = useRef<PointLight>(null);
  const c = useMemo(() => new Color(), []);
  const g = useRef<Group>(null);
  useEffect(() => {
    // le luci valgono anche per la camera del riflesso nel mare
    g.current?.traverse((o) => o.layers.enable(REFLECT_LAYER));
  }, []);
  useFrame(() => {
    const L = liveRef.current;
    const m = L.mood.mood;
    const t = L.t;
    let inten = 0;
    let keyI = 1.7;
    let moonI = 1.25;
    switch (m) {
      case "chaos":
        c.copy(C.alarm);
        inten = Math.floor(t * 5) % 2 ? 70 : 25;
        keyI = 0.9;
        break;
      case "duel":
        c.copy(C.cyan);
        inten = 12;
        keyI = 1.0;
        break;
      case "evolve":
        c.copy(C.gold);
        inten = 45 + 25 * Math.sin(t * 4);
        keyI = 1.3;
        break;
      case "reveal":
        c.copy(C.white);
        inten = 14 + 60 * Math.exp(-L.mood.since * 2);
        break;
      case "leaderboard":
      case "final":
        c.copy(C.gold);
        inten = 26;
        keyI = 1.5;
        break;
      case "awards":
        c.copy(C.gold);
        inten = 50 + 20 * Math.sin(t * 5);
        break;
      case "break":
        c.copy(C.chill);
        inten = 14;
        keyI = 0.9;
        moonI = 1.6;
        break;
      case "intro":
      case "manche":
        c.copy(C.amber);
        inten = 35;
        break;
      default:
        c.copy(C.warm);
        inten = 16;
    }
    if (mood.current) {
      mood.current.color.lerp(c, 0.12);
      mood.current.intensity += (inten - mood.current.intensity) * 0.15;
    }
    if (key.current) key.current.intensity += (keyI - key.current.intensity) * 0.08;
    if (moon.current) moon.current.intensity += (moonI - moon.current.intensity) * 0.05;
    const flick = 0.92 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    const warmL = m === "chaos" ? C.alarm : C.amber;
    rimL.current?.color.lerp(warmL, 0.08);
    rimR.current?.color.lerp(m === "chaos" ? C.alarm : m === "final" || m === "awards" ? C.gold : C.warm, 0.08);
    if (rimL.current) rimL.current.intensity = 70 * flick;
    if (rimR.current) rimR.current.intensity = 64 * (1.84 - flick);
  });
  return (
    <group ref={g}>
      <hemisphereLight args={["#2a4a66", "#2a1a0c", 0.6]} />
      <ambientLight intensity={0.1} color="#ffd9b0" />
      <directionalLight ref={key} position={[4, 11, 10]} intensity={1.7} color="#ffd2a0" />
      <directionalLight ref={moon} position={[MOON_DIR.x * 30, MOON_DIR.y * 30 + 6, MOON_DIR.z * 30]} intensity={1.25} color="#9fb7ff" />
      <pointLight ref={rimL} position={[-7.5, 4.5, -4.5]} intensity={70} distance={22} decay={2} color={TIG.amber} />
      <pointLight ref={rimR} position={[7.5, 4.5, -4.5]} intensity={64} distance={22} decay={2} color="#ffc58a" />
      <pointLight ref={mood} position={[0, 5.5, 4]} intensity={16} distance={22} decay={2} />
    </group>
  );
}

/** Il set completo (senza postazioni, mascotte e presentatori). Quanto è ricco lo decide il profilo di resa (perf.ts). */
export function ArenaSet({ liveRef, ledStatic, family, numFamily, quality, reduced, layout, debug, profile }: { liveRef: RefObject<ArenaLive>; ledStatic: LedStatic; family: string; numFamily: string; quality: "high" | "low"; reduced: boolean; layout: ArenaLayout; debug: ArenaDebug; profile: RenderProfile }) {
  const high = quality === "high";
  const radius = layout.radius;
  // canvas della vela: più pixel in qualità alta (le scritte restano nitide anche da vicino); fisso per la serata
  const ledW = high ? 2560 : 1600;
  // materiali condivisi del set
  const mats = useMemo(() => {
    const planks = plankTexture(512);
    const coin = coinFaceTexture();
    return {
      planks,
      coin,
      wood: woodMaterial(planks, "#b58e68"),
      brass: new MeshStandardMaterial({ color: TIG.brass, metalness: 0.9, roughness: 0.32 }),
      iron: new MeshStandardMaterial({ color: "#26221e", metalness: 0.7, roughness: 0.45 }),
      gold: new MeshStandardMaterial({ color: "#ffd27a", map: coin, metalness: 0.8, roughness: 0.32, envMapIntensity: 1.6, emissive: new Color(0.42, 0.27, 0.06), emissiveMap: coin }),
    };
  }, []);
  useEffect(
    () => () => {
      mats.planks.dispose();
      mats.coin.dispose();
      mats.wood.dispose();
      mats.brass.dispose();
      mats.iron.dispose();
      mats.gold.dispose();
    },
    [mats],
  );
  const torches = useMemo(() => torchSpots(layout), [layout]);
  const flameSpots = useMemo(() => [...torches.map((p) => ({ p, s: 1 })), ...DECK_LANTERNS.map((p) => ({ p: new Vector3(p.x, p.y - 0.12, p.z), s: 0.45 }))], [torches]);
  const { halfW, back } = deckBounds(layout);
  const palms = useMemo<PalmSpot[]>(
    () => [
      { x: -halfW + 1.2, z: back + 1.3, h: 7.6, lean: 1.3, yaw: 0.6 },
      { x: halfW - 1.2, z: back + 1.4, h: 8.4, lean: -1.4, yaw: -0.4 },
      { x: -halfW - 3.5, z: back - 3.5, y: -0.4, h: 9.5, lean: 1.8, yaw: 1.4 },
    ],
    [halfW, back],
  );
  // interruttori di misura (`?dbg=`): quanto costa ogni parte della baia e del set
  const off = (k: string) => debug.flags.includes(k);
  return (
    <group>
      <HarborEnvironment intensity={1} />
      {!off("nosky") && <Sky liveRef={liveRef} />}
      {!off("nosky") && <Moon />}
      {!off("nosea") && <Sea liveRef={liveRef} reflect={debug.noReflect ? 0 : profile.reflect} every={profile.reflectEvery} />}
      {!off("noship") && <Galleon liveRef={liveRef} />}
      {!off("nopalms") && <Island />}
      {!off("nopalms") && <Palms spots={palms} />}
      <Deck layout={layout} pbr={off("stdfloor")} torches={torches} />
      {!off("noflames") && <Flames liveRef={liveRef} spots={flameSpots} />}
      {!off("nodeck") && <CommandDeck liveRef={liveRef} family={family} brass={mats.brass} wood={mats.wood} />}
      <MastAndSail liveRef={liveRef} ledStatic={ledStatic} family={family} numFamily={numFamily} canvasW={ledW} wood={mats.wood} brass={mats.brass} />
      <Podium liveRef={liveRef} numFamily={numFamily} wood={mats.wood} iron={mats.iron} />
      <Chest liveRef={liveRef} wood={mats.wood} iron={mats.iron} gold={mats.gold} />
      {!off("norig") && <Rig liveRef={liveRef} radius={radius} low={!high} reduced={reduced} fixtures={profile.fixtures} cones={!debug.noCones} brass={mats.brass} />}
      {profile.dust > 0 && <Fireflies count={Math.round(profile.dust * 0.45)} area={[halfW * 2, 3.2, Math.abs(back) + 8]} center={[0, 0, back / 2 + 2]} />}
      <CoinRain liveRef={liveRef} count={280} shown={profile.confetti} gold={mats.gold} />
      <CannonFx liveRef={liveRef} />
    </group>
  );
}
