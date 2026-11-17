"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
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
  Vector3,
  type DirectionalLight,
  type Group,
  type PointLight,
  type ShaderMaterial,
} from "three";
import { TIG } from "../palette";
import { awardsRevealed } from "./director";
import { coneMaterial, dustMaterial, ledMaterial, ribbonMaterial } from "./fx-materials";
import { REFLECT_LAYER, useFloorMaterial } from "./FloorReflector";
import type { RenderProfile } from "./perf";
import { useLatestRef } from "./use-latest";
import type { ArenaDebug } from "./debug";
import type { ArenaLive } from "./live";
import { LED, STAGE, TRUSS_Y } from "./layout";
import { LED_CANVAS, drawLed, type LedContent, type LedTeam } from "./led-texture";
import { canvasTex, floorDecal, stageDecal } from "./textures";

/**
 * IL SET dell'arena: pavimento nero lucido con la mappa tattica (riflesso vero del set nei profili ricchi, vedi
 * FloorReflector), palco esagonale a due gradini con i bordi ambra, HALO LED sospeso (schermo curvo dei contenuti +
 * anello luminoso), americana circolare con i fari e i coni nella foschia, nastro LED attorno all'arena, torri LED
 * sul fondo, pulviscolo, coriandoli, podio della premiazione. Le luci seguono l'atmosfera della fase (`live.mood`).
 * I neon escono in HDR (sopra la soglia del bagliore): brillano davvero col bloom del postprocessing.
 */

const C = {
  amber: new Color(TIG.amber),
  cyan: new Color(TIG.cyan),
  alarm: new Color(TIG.alarm),
  gold: new Color(TIG.gold),
  chaos: new Color(TIG.chaos),
  chill: new Color(TIG.chill),
  white: new Color("#f4f1ea"),
  warm: new Color("#ffd9a8"),
};

/** Colore al neon in HDR: `k` volte sopra il bianco, così il bagliore lo prende. */
function neon(hex: string, k: number): Color {
  return new Color(hex).multiplyScalar(k);
}
const NEON = {
  amber: neon(TIG.amber, 3.2),
  amberSoft: neon(TIG.amber, 2.2),
  cyan: neon(TIG.cyan, 2.6),
  gold: neon(TIG.gold, 2.6),
  silver: neon("#cfd6de", 2.0),
  bronze: neon("#d98a4e", 2.4),
};

/** Mette nel riflesso del pavimento tutti gli oggetti del gruppo (montati una volta: il set è statico). */
export function Reflected({ children }: { children: ReactNode }) {
  const g = useRef<Group>(null);
  useEffect(() => {
    g.current?.traverse((o) => o.layers.enable(REFLECT_LAYER));
  });
  return <group ref={g}>{children}</group>;
}

const rnd = (n: number) => {
  const h = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return h - Math.floor(h);
};

// ------------------------------------------------------------------ pavimento
function Floor({ reflect, every, radius }: { reflect: number; every: number; radius: number }) {
  const decal = useMemo(() => floorDecal(), []);
  useEffect(() => () => decal.dispose(), [decal]);
  const size = Math.max(26, radius * 3.6);
  // resina nera lucida: riflesso vero (solo il set luminoso, a bassa risoluzione, sfocato) o, nei profili leggeri,
  // solo i riflessi dell'ambiente di studio
  const { material: floorMat, meshRef: floorRef } = useFloorMaterial({ scale: reflect, every, strength: 0.62, color: "#06080c" });
  return (
    <group>
      <mesh ref={floorRef} rotation-x={-Math.PI / 2} material={floorMat}>
        <planeGeometry args={[90, 90]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={1}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={decal} transparent opacity={0.9} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ palco esagonale
function hexRing(r: number, y: number): Vector3[] {
  const pts: Vector3[] = [];
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    pts.push(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return pts;
}

function NeonHex({ r, y, color, width = 0.025 }: { r: number; y: number; color: Color; width?: number }) {
  const mat = useMemo(() => new MeshBasicMaterial({ color, toneMapped: false }), [color]);
  useEffect(() => () => mat.dispose(), [mat]);
  const segs = useMemo(() => {
    const pts = hexRing(r, y);
    return pts.slice(0, 6).map((p, i) => {
      const q = pts[i + 1];
      const mid = p.clone().add(q).multiplyScalar(0.5);
      const len = p.distanceTo(q);
      const ang = Math.atan2(q.z - p.z, q.x - p.x);
      return { mid, len, ang };
    });
  }, [r, y]);
  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} position={s.mid} rotation={[0, -s.ang, 0]} material={mat}>
          <boxGeometry args={[s.len, width, width]} />
        </mesh>
      ))}
    </group>
  );
}

function Stage({ family, shadows }: { family: string; shadows: boolean }) {
  const decal = useMemo(() => stageDecal(family), [family]);
  useEffect(() => () => decal.dispose(), [decal]);
  const low = STAGE.height * 0.45;
  return (
    <group>
      {/* gradino basso */}
      <mesh position-y={low / 2} rotation-y={Math.PI / 6} receiveShadow={shadows}>
        <cylinderGeometry args={[STAGE.radius + 0.5, STAGE.radius + 0.56, low, 6]} />
        <meshStandardMaterial color="#0b1016" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* piano del palco */}
      <mesh position-y={(STAGE.height + low) / 2} rotation-y={Math.PI / 6} receiveShadow={shadows}>
        <cylinderGeometry args={[STAGE.radius, STAGE.radius + 0.04, STAGE.height - low, 6]} />
        <meshStandardMaterial color="#080b10" metalness={0.9} roughness={0.22} />
      </mesh>
      <mesh position-y={STAGE.height + 0.002} rotation-x={-Math.PI / 2} receiveShadow={shadows}>
        <circleGeometry args={[STAGE.radius * 0.99, 6, Math.PI / 6]} />
        <meshStandardMaterial color="#06080c" metalness={0.7} roughness={0.18} />
      </mesh>
      <mesh position-y={STAGE.height + 0.006} rotation-x={-Math.PI / 2} renderOrder={1}>
        <planeGeometry args={[STAGE.radius * 2.04, STAGE.radius * 2.04]} />
        <meshBasicMaterial map={decal} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <NeonHex r={STAGE.radius + 0.02} y={STAGE.height} color={NEON.amber} width={0.03} />
      <NeonHex r={STAGE.radius + 0.56} y={0.012} color={NEON.amberSoft} width={0.022} />
      <NeonHex r={STAGE.radius + 0.51} y={low} color={NEON.cyan} width={0.018} />
    </group>
  );
}

// ------------------------------------------------------------------ podio della premiazione (sale dal palco)
export const PODIUM_SPOTS = [
  { place: 1, x: 0, h: 1.45 },
  { place: 2, x: -1.04, h: 1.04 },
  { place: 3, x: 1.04, h: 0.74 },
] as const;
/** Lato dei blocchi del podio. */
const PODIUM_W = 0.96;
export const PODIUM_Z = -0.45;

function podiumFace(place: number, family: string): CanvasTexture {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = `900 180px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const col = place === 1 ? TIG.gold : place === 2 ? "#dfe5ec" : "#e0965a";
    ctx.shadowColor = col;
    ctx.shadowBlur = 30;
    ctx.fillStyle = col;
    ctx.fillText(String(place), w / 2, h / 2 + 12);
  });
}

function Podium({ liveRef, family }: { liveRef: RefObject<ArenaLive>; family: string }) {
  const g = useRef<Group>(null);
  const faces = useMemo(() => PODIUM_SPOTS.map((s) => podiumFace(s.place, family)), [family]);
  useEffect(() => () => faces.forEach((f) => f.dispose()), [faces]);
  useFrame(() => {
    const k = liveRef.current.podium;
    if (!g.current) return;
    g.current.visible = k > 0.01;
    g.current.scale.set(1, Math.max(0.001, k), 1);
  });
  return (
    <group ref={g} position={[0, STAGE.height, PODIUM_Z]} visible={false}>
      {PODIUM_SPOTS.map((s, i) => {
        const trim = s.place === 1 ? NEON.gold : s.place === 2 ? NEON.silver : NEON.bronze;
        return (
          <group key={s.place} position-x={s.x}>
            <mesh position-y={s.h / 2}>
              <boxGeometry args={[PODIUM_W, s.h, PODIUM_W]} />
              <meshStandardMaterial color="#0b0e13" metalness={0.92} roughness={0.22} />
            </mesh>
            {/* bordi luminosi in alto e alla base */}
            <mesh position={[0, s.h - 0.035, 0]}>
              <boxGeometry args={[PODIUM_W + 0.03, 0.04, PODIUM_W + 0.03]} />
              <meshBasicMaterial color={trim} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.015, 0]}>
              <boxGeometry args={[PODIUM_W + 0.03, 0.03, PODIUM_W + 0.03]} />
              <meshBasicMaterial color={NEON.amberSoft} toneMapped={false} />
            </mesh>
            {/* numero del posto sulla faccia davanti */}
            <mesh position={[0, s.h * 0.5, PODIUM_W / 2 + 0.004]}>
              <planeGeometry args={[Math.min(0.8, s.h * 0.9), Math.min(0.8, s.h * 0.9)]} />
              <meshBasicMaterial map={faces[i]} transparent toneMapped={false} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------------ halo LED sospeso
/** Testi dello schermo che arrivano dalle props (titolo, sottotitolo, manche). */
export interface LedStatic {
  title: string | null;
  subtitle: string | null;
  mancheNo: number | null;
}

const LED_MODES = ["ambient", "logo", "manche", "title", "leaderboard", "alarm", "vs", "evolve", "break", "final", "awards"] as const;

/**
 * Contenuto dello schermo ricavato a ogni fotogramma dallo stato vivo (classifica animata, spotlight, premiazione)
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

function LedHalo({ liveRef, ledStatic, family, canvasW }: { liveRef: RefObject<ArenaLive>; ledStatic: LedStatic; family: string; canvasW: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = canvasW;
    c.height = Math.round((c.width * LED_CANVAS.h) / LED_CANVAS.w);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    // mipmap + anisotropia: lo schermo curvo visto di scorcio e da lontano resta pulito (niente moiré sulle scritte)
    t.anisotropy = 8;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = true;
    return t;
  }, [canvasW]);
  const mat = useMemo(() => ledMaterial(tex), [tex]);
  useEffect(
    () => () => {
      tex.dispose();
      mat.dispose();
    },
    [tex, mat],
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
  // testi nuovi o nomi/colori delle squadre cambiati → ridisegno forzato; caratteri pronti → ridisegno
  const staticKey = `${ledStatic.title}|${ledStatic.subtitle}|${ledStatic.mancheNo}|${family}`;
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

  const ribbon = useMemo(() => {
    const m = ribbonMaterial();
    m.uniforms.uLen.value = 30;
    return m;
  }, []);
  useEffect(() => () => ribbon.dispose(), [ribbon]);
  const objRef = useLatestRef({ tex, mat, ribbon });
  useFrame(() => {
    const { tex, mat, ribbon } = objRef.current;
    const L = liveRef.current;
    const D = draw.current;
    const sig = updateLedContent(L, staticRef.current, D.content, D.pool);
    const now = performance.now();
    // al massimo ~20 ridisegni al secondo mentre la classifica scorre
    if (D.force || (sig !== D.sig && now - D.at > 50)) {
      const t0 = performance.now();
      drawLed(tex.image as HTMLCanvasElement, D.content, family);
      tex.needsUpdate = true;
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __tigLed?: { n: number; ms: number; max: number } };
        const st = (w.__tigLed ??= { n: 0, ms: 0, max: 0 });
        const dt = performance.now() - t0;
        st.n++;
        st.ms += dt;
        st.max = Math.max(st.max, dt);
      }
      D.sig = sig;
      D.at = now;
      D.force = false;
      L.busy.led = true;
    } else L.busy.led = sig !== D.sig;
    mat.uniforms.uTime.value = L.t;
    mat.uniforms.uAlarm.value += ((L.dir.led === "alarm" ? 1 : 0) - mat.uniforms.uAlarm.value) * 0.2;
    const tint = L.mood.mood === "break" ? 0.82 : L.mood.mood === "game" ? 0.92 : 1;
    mat.uniforms.uBright.value += (tint - mat.uniforms.uBright.value) * 0.1;
    ribbon.uniforms.uTime.value = L.t;
    ribbon.uniforms.uAlarm.value = L.mood.mood === "chaos" ? 1 : 0;
    ribbon.uniforms.uBoost.value = L.mood.mood === "chaos" || L.mood.mood === "awards" || L.mood.mood === "intro" ? 1 : 0;
  });
  const arc = (LED.arcDeg * Math.PI) / 180;
  const yC = LED.bottom + LED.height / 2;
  const rest = Math.PI * 2 - arc;
  return (
    <group position-y={yC}>
      {/* schermo dei contenuti (davanti) */}
      <mesh>
        <cylinderGeometry args={[LED.radius, LED.radius, LED.height, 96, 1, true, -arc / 2, arc]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* resto dell'anello: pannello scuro con nastro LED */}
      <mesh>
        <cylinderGeometry args={[LED.radius, LED.radius, LED.height, 72, 1, true, arc / 2, rest]} />
        <meshStandardMaterial color="#07090d" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position-y={-LED.height / 2 + 0.22}>
        <cylinderGeometry args={[LED.radius + 0.012, LED.radius + 0.012, 0.18, 72, 1, true, arc / 2, rest]} />
        <primitive object={ribbon} attach="material" />
      </mesh>
      {/* interno (visto dalle inquadrature alte) */}
      <mesh>
        <cylinderGeometry args={[LED.radius - 0.08, LED.radius - 0.08, LED.height, 72, 1, true]} />
        <meshStandardMaterial color="#05070a" metalness={0.6} roughness={0.6} side={DoubleSide} />
      </mesh>
      {/* cornici al neon sopra e sotto */}
      {[-1, 1].map((s) => (
        <group key={s} position-y={(s * LED.height) / 2}>
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[LED.radius + 0.03, 0.045, 8, 128]} />
            <meshStandardMaterial color="#141a22" metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} position-y={s * 0.05}>
            <torusGeometry args={[LED.radius + 0.07, 0.016, 6, 128]} />
            <meshBasicMaterial color={s > 0 ? NEON.amber : NEON.cyan} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* cavi verso l'americana */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const len = TRUSS_Y - (LED.bottom + LED.height);
        return (
          <mesh key={i} position={[Math.sin(a) * (LED.radius - 0.1), LED.height / 2 + len / 2, Math.cos(a) * (LED.radius - 0.1)]}>
            <cylinderGeometry args={[0.012, 0.012, len, 4]} />
            <meshBasicMaterial color="#3a434e" />
          </mesh>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------------ americana con i fari e i coni di luce
function trussTex(): CanvasTexture {
  const t = canvasTex(256, 64, (ctx) => {
    ctx.clearRect(0, 0, 256, 64);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(256, 5);
    ctx.moveTo(0, 59);
    ctx.lineTo(256, 59);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 64) {
      ctx.moveTo(x, 5);
      ctx.lineTo(x + 32, 59);
      ctx.lineTo(x + 64, 5);
    }
    ctx.stroke();
  });
  t.wrapS = RepeatWrapping;
  return t;
}

interface Fixture {
  pos: Vector3;
  phase: number;
  /** torre (indice) a cui punta in "game" */
  angle: number;
}

const UP_NEG = new Vector3(0, -1, 0);
const ZERO_M = new Matrix4().makeScale(0, 0, 0);
const tmpO = new Object3D();
const mT = new Matrix4();
const vTarget = new Vector3();
const vDir = new Vector3();
const qT = new Quaternion();
const cT = new Color();

const MAX_FIXTURES = 12;

function Rig({ liveRef, radius, low, reduced, fixtures: shown, cones: showCones = true }: { liveRef: RefObject<ArenaLive>; radius: number; low: boolean; reduced: boolean; fixtures: number; cones?: boolean }) {
  const trussR = Math.max(LED.radius + 1.6, radius + 0.4);
  // allocati una volta (niente shader ricompilati quando il profilo cambia): si disegnano i primi `shown`
  const count = MAX_FIXTURES;
  const fixtures = useMemo<Fixture[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        // ordine "a ventaglio": i primi N fari restano distribuiti su tutto l'anello qualunque sia N
        const k = (i * 5) % count;
        const a = (k / count) * Math.PI * 2 + 0.1;
        return { pos: new Vector3(Math.sin(a) * trussR, TRUSS_Y - 0.35, Math.cos(a) * trussR), phase: i * 0.83, angle: a };
      }),
    [count, trussR],
  );
  const texs = useMemo(() => {
    const t1 = trussTex();
    t1.repeat.set(Math.round((trussR * Math.PI * 2) / 1.6), 1);
    return { t1 };
  }, [trussR]);
  useEffect(() => () => texs.t1.dispose(), [texs]);
  const cones = useMemo(() => {
    const geo = new ConeGeometry(1, 1, low ? 14 : 20, 1, true);
    geo.translate(0, -0.5, 0);
    const mat = coneMaterial();
    mat.uniforms.uHaze.value = low ? 1.6 : 2.0;
    const m = new InstancedMesh(geo, mat, count);
    m.frustumCulled = false;
    m.renderOrder = 2;
    for (let i = 0; i < count; i++) m.setColorAt(i, C.white);
    return m;
  }, [count, low]);
  const lenses = useMemo(() => {
    const geo = new CylinderGeometry(0.17, 0.21, 0.44, 12);
    const m = new InstancedMesh(geo, new MeshStandardMaterial({ color: "#161b22", metalness: 0.85, roughness: 0.35 }), count);
    m.frustumCulled = false;
    const glowGeo = new CylinderGeometry(0.15, 0.15, 0.02, 14);
    const g = new InstancedMesh(glowGeo, new MeshBasicMaterial({ toneMapped: false }), count);
    g.frustumCulled = false;
    for (let i = 0; i < count; i++) g.setColorAt(i, C.white);
    return { body: m, glow: g };
  }, [count]);
  useEffect(
    () => () => {
      for (const m of [cones, lenses.body, lenses.glow]) {
        m.geometry.dispose();
        (m.material as ShaderMaterial).dispose();
        m.dispose();
      }
    },
    [cones, lenses],
  );
  const smooth = useRef(fixtures.map(() => ({ x: 0, z: 0, i: 0.3, c: new Color("#ffffff"), init: false })));
  const objRef = useLatestRef({ cones, lenses, shown });

  useFrame((_, rawDt) => {
    const { cones, lenses, shown } = objRef.current;
    // quanti fari si vedono: lo decide il profilo (gli altri restano allocati, nessuno shader da ricompilare)
    cones.count = lenses.body.count = lenses.glow.count = Math.max(1, Math.min(count, shown));
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
      let col = C.white;
      let angle = 0.13;
      const home = pods.length ? pods[(i * 7) % n] : null;
      switch (mood) {
        case "lobby": {
          const a = t * 0.25 + f.phase;
          tx = Math.sin(f.angle) * radius * 0.7 + Math.cos(a) * 2.2;
          tz = Math.cos(f.angle) * radius * 0.6 + Math.sin(a * 1.3) * 1.6;
          col = i % 3 === 0 ? C.amber : i % 3 === 1 ? C.cyan : C.white;
          inten = 0.32;
          break;
        }
        case "intro": {
          if (since < 3.5) {
            const a = t * 1.6 + f.phase * 2;
            tx = Math.cos(a) * radius;
            tz = Math.sin(a) * radius * 0.8;
            col = i % 2 ? C.amber : C.white;
            inten = 0.55;
          } else {
            const a = t * 0.5 + f.phase;
            tx = Math.cos(a) * 0.8;
            tz = 0.6 + Math.sin(a) * 0.5;
            col = i % 2 ? C.amber : C.warm;
            inten = 0.42;
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
          inten = 0.5;
          break;
        }
        case "game": {
          if (home) {
            tx = home.x + Math.sin(t * 0.3 + f.phase) * 0.25;
            tz = home.z + Math.cos(t * 0.27 + f.phase) * 0.25;
          }
          col = i % 4 === 0 ? C.amber : C.white;
          inten = 0.2;
          angle = 0.1;
          break;
        }
        case "reveal": {
          const flash = Math.exp(-since * 2.2);
          tx = Math.sin(f.phase * 3) * 1.4;
          tz = 0.6 + Math.cos(f.phase * 3) * 1.0;
          col = C.white;
          inten = 0.28 + 0.6 * flash;
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
          inten = 0.42;
          break;
        }
        case "chaos": {
          // sirena: fasci che ruotano veloci, rosso pieno, lampeggio
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
          inten = i < 4 ? 0.62 : 0.06;
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
          col = i % 3 === 0 ? C.white : C.chaos;
          inten = 0.5;
          angle = 0.09;
          break;
        }
        case "break": {
          const a = t * 0.12 + f.phase;
          tx = Math.cos(a) * radius * 0.9;
          tz = Math.sin(a * 1.2) * radius * 0.7;
          col = i % 2 ? C.chill : C.chaos;
          inten = 0.16;
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
      qT.setFromUnitVectors(UP_NEG, vDir);
      const rad = len * Math.tan(angle * 0.85);
      tmpO.position.copy(f.pos);
      tmpO.quaternion.copy(qT);
      tmpO.scale.set(rad, len, rad);
      tmpO.updateMatrix();
      // cono spento: niente pixel da disegnare
      cones.setMatrixAt(i, S.i < 0.03 ? ZERO_M : tmpO.matrix);
      cones.setColorAt(i, cT.copy(S.c).multiplyScalar(S.i));
      tmpO.scale.setScalar(1);
      tmpO.updateMatrix();
      lenses.body.setMatrixAt(i, tmpO.matrix);
      mT.makeTranslation(0, -0.23, 0);
      tmpO.matrix.multiply(mT);
      lenses.glow.setMatrixAt(i, tmpO.matrix);
      // lente del faro: sopra la soglia del bagliore (brilla)
      lenses.glow.setColorAt(i, cT.copy(S.c).multiplyScalar(1.2 + S.i * 5));
    });
    cones.instanceMatrix.needsUpdate = true;
    if (cones.instanceColor) cones.instanceColor.needsUpdate = true;
    lenses.body.instanceMatrix.needsUpdate = true;
    lenses.glow.instanceMatrix.needsUpdate = true;
    if (lenses.glow.instanceColor) lenses.glow.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* americana circolare: due fasce traforate */}
      {[0, 0.42].map((dy) => (
        <mesh key={dy} position-y={TRUSS_Y + dy}>
          <cylinderGeometry args={[trussR, trussR, 0.42, 96, 1, true]} />
          <meshStandardMaterial map={texs.t1} alphaMap={texs.t1} alphaTest={0.4} color="#8a939b" metalness={0.85} roughness={0.35} side={DoubleSide} />
        </mesh>
      ))}
      <primitive object={lenses.body} />
      <primitive object={lenses.glow} />
      {showCones && <primitive object={cones} />}
    </group>
  );
}

// ------------------------------------------------------------------ nastro LED attorno all'arena e torri sul fondo
function Ribbon({ liveRef, radius }: { liveRef: RefObject<ArenaLive>; radius: number }) {
  const r = radius + 1.9;
  const mat = useMemo(() => {
    const m = ribbonMaterial();
    m.uniforms.uLen.value = Math.round((r * Math.PI * 2) / 1.2);
    m.side = DoubleSide;
    return m;
  }, [r]);
  const tower = useMemo(() => {
    const m = ribbonMaterial();
    m.uniforms.uLen.value = 3;
    return m;
  }, []);
  useEffect(
    () => () => {
      mat.dispose();
      tower.dispose();
    },
    [mat, tower],
  );
  const objRef = useLatestRef({ mat, tower });
  useFrame(() => {
    const { mat, tower } = objRef.current;
    const L = liveRef.current;
    for (const m of [mat, tower]) {
      m.uniforms.uTime.value = L.t;
      m.uniforms.uAlarm.value = L.mood.mood === "chaos" ? 1 : 0;
      m.uniforms.uBoost.value = L.mood.mood === "chaos" || L.mood.mood === "awards" ? 1 : L.mood.mood === "break" ? -0.3 : 0;
      const gold = L.mood.mood === "final" || L.mood.mood === "awards";
      m.uniforms.uA.value.lerp(gold ? C.gold : L.mood.mood === "break" ? C.chill : C.amber, 0.05);
      m.uniforms.uB.value.lerp(gold ? C.amber : L.mood.mood === "evolve" ? C.chaos : C.cyan, 0.05);
    }
  });
  const towers = useMemo(() => {
    const out: { x: number; z: number; h: number; ry: number }[] = [];
    const R = radius + 6.5;
    for (let i = 0; i < 9; i++) {
      const a = -1.25 + (i / 8) * 2.5;
      out.push({ x: Math.sin(a) * R, z: -Math.cos(a) * R, h: 5.5 + (i % 3) * 1.6, ry: -a });
    }
    return out;
  }, [radius]);
  return (
    <group>
      <mesh position-y={0.32}>
        <cylinderGeometry args={[r, r, 0.42, 128, 1, true]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh position-y={0.1}>
        <cylinderGeometry args={[r + 0.06, r + 0.1, 0.2, 128, 1, true]} />
        <meshStandardMaterial color="#0b0f14" metalness={0.8} roughness={0.4} side={DoubleSide} />
      </mesh>
      {towers.map((tw, i) => (
        <group key={i} position={[tw.x, tw.h / 2, tw.z]} rotation-y={tw.ry}>
          <mesh>
            <planeGeometry args={[0.55, tw.h]} />
            <primitive object={tower} attach="material" />
          </mesh>
          <mesh position-z={-0.06}>
            <boxGeometry args={[0.7, tw.h + 0.2, 0.1]} />
            <meshStandardMaterial color="#0a0d12" metalness={0.8} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ pulviscolo e coriandoli
function Dust({ count, shown, size }: { count: number; shown: number; size: number }) {
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    const seed = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) seed[i] = rnd(i + 7);
    g.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("seed", new BufferAttribute(seed, 3));
    return g;
  }, [count]);
  useEffect(() => {
    geo.setDrawRange(0, Math.max(0, Math.min(count, shown)));
  }, [geo, count, shown]);
  const mat = useMemo(() => {
    const m = dustMaterial();
    m.uniforms.uSize.value = size;
    return m;
  }, [size]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const matRef = useLatestRef(mat);
  useFrame((state) => {
    const mat = matRef.current;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    const fov = (state.camera as unknown as { fov?: number }).fov ?? 38;
    mat.uniforms.uPx.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

function Confetti({ liveRef, count, shown }: { liveRef: RefObject<ArenaLive>; count: number; shown: number }) {
  const mesh = useMemo(() => {
    const m = new InstancedMesh(new PlaneGeometry(0.07, 0.12), new MeshBasicMaterial({ side: DoubleSide, toneMapped: false }), count);
    m.frustumCulled = false;
    m.visible = false;
    const cols = [C.gold, C.amber, C.white, C.cyan, C.gold];
    for (let i = 0; i < count; i++) m.setColorAt(i, cols[Math.floor(rnd(i + 307) * cols.length)].clone().multiplyScalar(1.3));
    return m;
  }, [count]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => [rnd(i + 1), rnd(i + 101), rnd(i + 211)]), [count]);
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
      const fall = 0.9 + s[1] * 0.8;
      const y = 8.5 - ((t * fall + s[0] * 9) % 9);
      tmpO.position.set((s[0] - 0.5) * 12 + Math.sin(t * 1.3 + i) * 0.3, y, (s[2] - 0.5) * 8 + 0.5);
      tmpO.rotation.set(t * (2 + s[2] * 3) + i, t * (1.5 + s[1] * 2), i);
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
 * Luci VERE ridotte al minimo per il costo per pixel (pavimento e palco riempiono lo schermo): emisferica + ambiente,
 * una chiave direzionale, due controluce (ambra/ciano, cambiano con l'atmosfera) e la luce dell'atmosfera.
 * Occhi di bue, fari e neon sono finti (coni additivi, materiali emissivi). Ombre: di contatto (morbide, sotto i
 * piedi), niente shadow map — costavano ~25% dei fotogrammi su una scheda integrata.
 */
export function ArenaLighting({ liveRef }: { liveRef: RefObject<ArenaLive>; high: boolean }) {
  const mood = useRef<PointLight>(null);
  const key = useRef<DirectionalLight>(null);
  const rimL = useRef<PointLight>(null);
  const rimR = useRef<PointLight>(null);
  const c = useMemo(() => new Color(), []);
  useFrame(() => {
    const L = liveRef.current;
    const m = L.mood.mood;
    const t = L.t;
    let inten = 0;
    let keyI = 2.3;
    switch (m) {
      case "chaos":
        c.copy(C.alarm);
        inten = Math.floor(t * 5) % 2 ? 70 : 25;
        keyI = 1.0;
        break;
      case "duel":
        c.copy(C.cyan);
        inten = 12;
        keyI = 1.2;
        break;
      case "evolve":
        c.copy(C.chaos);
        inten = 45 + 25 * Math.sin(t * 4);
        keyI = 1.5;
        break;
      case "reveal":
        c.copy(C.white);
        inten = 14 + 60 * Math.exp(-L.mood.since * 2);
        break;
      case "leaderboard":
      case "final":
        c.copy(C.gold);
        inten = 26;
        keyI = 1.9;
        break;
      case "awards":
        c.copy(C.gold);
        inten = 50 + 20 * Math.sin(t * 5);
        break;
      case "break":
        c.copy(C.chill);
        inten = 18;
        keyI = 1.2;
        break;
      case "intro":
      case "manche":
        c.copy(C.amber);
        inten = 35;
        break;
      default:
        c.copy(C.warm);
        inten = 14;
    }
    if (mood.current) {
      mood.current.color.lerp(c, 0.12);
      mood.current.intensity += (inten - mood.current.intensity) * 0.15;
    }
    if (key.current) key.current.intensity += (keyI - key.current.intensity) * 0.08;
    const amberRim = m === "chaos" ? C.alarm : m === "break" ? C.chill : C.amber;
    const cyanRim = m === "chaos" ? C.alarm : m === "evolve" ? C.chaos : m === "final" || m === "awards" ? C.gold : C.cyan;
    rimL.current?.color.lerp(amberRim, 0.08);
    rimR.current?.color.lerp(cyanRim, 0.08);
  });
  const g = useRef<Group>(null);
  useEffect(() => {
    // le luci valgono anche per la camera del riflesso del pavimento
    g.current?.traverse((o) => o.layers.enable(REFLECT_LAYER));
  }, []);
  return (
    <group ref={g}>
      <hemisphereLight args={["#c4d6ff", "#0a0c10", 0.62]} />
      <ambientLight intensity={0.14} color="#ffe6cf" />
      <directionalLight ref={key} position={[4, 11, 10]} intensity={2.3} color="#fff0e0" />
      <pointLight ref={rimL} position={[-7, 5, -5]} intensity={80} distance={22} decay={2} color={TIG.amber} />
      <pointLight ref={rimR} position={[7, 5, -5]} intensity={80} distance={22} decay={2} color={TIG.cyan} />
      <pointLight ref={mood} position={[0, 5.5, 4]} intensity={14} distance={22} decay={2} />
    </group>
  );
}

/** Il set completo (senza torri, mascotte e presentatori). Quanto è ricco lo decide il profilo di resa (perf.ts). */
export function ArenaSet({ liveRef, ledStatic, family, quality, reduced, radius, debug, profile }: { liveRef: RefObject<ArenaLive>; ledStatic: LedStatic; family: string; quality: "high" | "low"; reduced: boolean; radius: number; debug: ArenaDebug; profile: RenderProfile }) {
  const high = quality === "high";
  // canvas del LED: più pixel in qualità alta (le scritte restano nitide anche da vicino); fisso per tutta la serata
  const ledW = high ? 2560 : 1600;
  return (
    <group>
      <Floor reflect={debug.noReflect ? 0 : profile.reflect} every={profile.reflectEvery} radius={radius} />
      <Reflected>
        <Stage family={family} shadows={false} />
        <Podium liveRef={liveRef} family={family} />
        <LedHalo liveRef={liveRef} ledStatic={ledStatic} family={family} canvasW={ledW} />
        <Ribbon liveRef={liveRef} radius={radius} />
      </Reflected>
      <Rig liveRef={liveRef} radius={radius} low={!high} reduced={reduced} fixtures={profile.fixtures} cones={!debug.noCones} />
      <Dust count={360} shown={profile.dust} size={radius * 2.6} />
      <Confetti liveRef={liveRef} count={280} shown={profile.confetti} />
    </group>
  );
}
