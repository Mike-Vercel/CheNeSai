"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  Matrix4,
  Object3D,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type Group,
  type InstancedMesh,
  type Mesh,
  type PointLight,
  type ShaderMaterial,
  type ShaderMaterialParameters,
  type SpotLight,
} from "three";
import type { Mood } from "./studio-director";
import { LED_WALL, MARKS, PODIUM, TRUSS_Y, WHEEL_CENTER } from "./studio-layout";

/**
 * IL SET dello studio di GIRAMENTE!: pavimento lucido (riflesso vero solo in qualità alta), podio della ruota con
 * neon e lampadine da casinò, americane (truss) con i fari e i loro coni di luce (additivi, nessuna luce vera in
 * più), colonne al neon verdi e rosse, torri LED laterali, pulviscolo nella luce, coriandoli per il vincitore.
 * Le luci reagiscono all'atmosfera del momento (`moodRef`): giro, giusto, sbagliato, Jolly, vittoria.
 */

export interface MoodRef {
  mood: Mood;
  /** secondi (clock della scena) dall'ultimo cambio di atmosfera */
  since: number;
}

const GREEN = new Color("#39ff14");
const RED = new Color("#ff253a");
const GOLD = new Color("#f5c542");
const WHITE = new Color("#f4f6f7");
const WARM = new Color("#ffd48a");

const rnd = (n: number) => {
  const h = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return h - Math.floor(h);
};

// ------------------------------------------------------------------ texture in codice
function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

/** Disegno sul pavimento attorno al podio: anelli verdi e rossi, tacche radiali, raggi che sfumano. */
function floorDecal(): CanvasTexture {
  return canvasTex(1024, 1024, (ctx) => {
    const c = 512;
    ctx.clearRect(0, 0, 1024, 1024);
    const ring = (r: number, wdt: number, color: string, alpha: number) => {
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    ring(250, 5, "#39ff14", 0.9);
    ring(268, 2, "#39ff14", 0.5);
    ring(330, 7, "#ff253a", 0.75);
    ring(350, 2, "#ff253a", 0.4);
    ring(470, 3, "#39ff14", 0.25);
    // tacche come una ruota gigante
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const long = i % 4 === 0;
      ctx.strokeStyle = i % 8 < 4 ? "#39ff14" : "#ff253a";
      ctx.globalAlpha = long ? 0.75 : 0.35;
      ctx.lineWidth = long ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 280, c + Math.sin(a) * 280);
      ctx.lineTo(c + Math.cos(a) * (long ? 322 : 305), c + Math.sin(a) * (long ? 322 : 305));
      ctx.stroke();
    }
    // raggi lunghi che sfumano
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
      const g = ctx.createLinearGradient(c + Math.cos(a) * 360, c + Math.sin(a) * 360, c + Math.cos(a) * 510, c + Math.sin(a) * 510);
      const col = i % 2 ? "57,255,20" : "255,37,58";
      g.addColorStop(0, `rgba(${col},0.55)`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.strokeStyle = g;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 360, c + Math.sin(a) * 360);
      ctx.lineTo(c + Math.cos(a) * 510, c + Math.sin(a) * 510);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/** Alone morbido (bagliori, "bloom" finto). */
function glowTex(): CanvasTexture {
  return canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Striscia verticale luminosa (alone dei tubi al neon). */
function stripTex(): CanvasTexture {
  return canvasTex(64, 8, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 8);
  });
}

/** Traliccio dell'americana: due correnti e le diagonali, il resto trasparente. */
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

// ------------------------------------------------------------------ coni di luce (additivi)
function coneMaterial(): ShaderMaterialParameters {
  return {
    uniforms: { uColor: { value: new Color("#ffffff") }, uI: { value: 0.5 } },
    vertexShader: /* glsl */ `
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uI;
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float along = pow(vH, 1.3) * 0.85 + 0.15 * vH;
        float a = edge * along * uI;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  };
}

interface Fixture {
  pos: Vector3;
  home: Vector3;
  phase: number;
}

const FIXTURES: Fixture[] = [
  [-5.6, TRUSS_Y - 0.3, 2.7, -2.6, 0, 1.4],
  [-2.3, TRUSS_Y - 0.3, 2.7, -2.4, 0, 1.0],
  [2.3, TRUSS_Y - 0.3, 2.7, 0.8, 0, 1.2],
  [5.6, TRUSS_Y - 0.3, 2.7, 2.6, 0, 1.2],
  [-4.3, TRUSS_Y - 0.3, -2.5, -1.2, 0, 0.6],
  [-1.5, TRUSS_Y - 0.3, -2.5, 0.2, 0, 1.6],
  [1.5, TRUSS_Y - 0.3, -2.5, -0.4, 0, 1.6],
  [4.3, TRUSS_Y - 0.3, -2.5, 1.4, 0, 0.6],
].map((f, i) => ({ pos: new Vector3(f[0], f[1], f[2]), home: new Vector3(f[3], f[4], f[5]), phase: i * 0.785 }));

const UP_NEG = new Vector3(0, -1, 0);

function LightCones({ moodRef, low, reduced }: { moodRef: RefObject<MoodRef>; low: boolean; reduced: boolean }) {
  const params = useMemo(() => coneMaterial(), []);
  const geo = useMemo(() => {
    // apice nell'origine, base verso −Y: lunghezza 1 e raggio 1, scalati per ogni faro
    const g = new ConeGeometry(1, 1, low ? 20 : 32, 1, true);
    g.translate(0, -0.5, 0);
    return g;
  }, [low]);
  useEffect(() => () => geo.dispose(), [geo]);
  const meshes = useRef<(Mesh | null)[]>([]);
  const mats = useRef<(ShaderMaterial | null)[]>([]);
  const pools = useRef<(Mesh | null)[]>([]);
  const glow = useMemo(() => glowTex(), []);
  useEffect(() => () => glow.dispose(), [glow]);
  const tmp = useMemo(() => ({ target: new Vector3(), dir: new Vector3(), q: new Quaternion(), c: new Color() }), []);

  useFrame((state) => {
    const m = moodRef.current;
    const t = reduced ? 0 : state.clock.elapsedTime;
    const since = m.since;
    FIXTURES.forEach((f, i) => {
      const mesh = meshes.current[i];
      const mat = mats.current[i];
      if (!mesh || !mat) return;
      const { target, dir, q, c } = tmp;
      let inten = 0.32;
      let angle = 0.16;
      switch (m.mood) {
        case "spin": {
          const a = t * 2.4 + f.phase * 2;
          target.set(WHEEL_CENTER.x + Math.cos(a) * 2.6, 0, 0.8 + Math.sin(a) * 1.8);
          c.copy(i % 2 === 0 ? GREEN : RED);
          inten = 0.62 + 0.18 * Math.sin(t * 9 + i);
          break;
        }
        case "correct":
        case "wrong": {
          const a = t * 1.1 + f.phase;
          target.set(f.home.x + Math.cos(a) * 0.9, 0, f.home.z + Math.sin(a) * 0.6);
          c.copy(m.mood === "correct" ? GREEN : RED);
          inten = 0.45 + 0.6 * Math.exp(-since * 1.6);
          angle = 0.19;
          break;
        }
        case "jolly":
        case "colpo": {
          const a = t * 1.8 + f.phase * 1.5;
          target.set(1.4 + Math.cos(a) * 2.2, 0, 1.0 + Math.sin(a) * 1.2);
          c.copy((i + Math.floor(t * 3)) % 2 === 0 ? GREEN : RED);
          inten = 0.6;
          break;
        }
        case "victory": {
          const a = t * 1.5 + f.phase * 1.3;
          target.set(MARKS.center.x + Math.cos(a) * 2.6, 0, MARKS.center.z - 0.4 + Math.sin(a) * 1.4);
          c.copy(i % 3 === 0 ? WHITE : GOLD);
          inten = 0.6 + 0.2 * Math.sin(t * 6 + i);
          break;
        }
        case "standings": {
          const a = t * 0.6 + f.phase;
          target.set(Math.cos(a) * 4, 0, 0.4 + Math.sin(a) * 1.5);
          c.copy(i % 2 === 0 ? GOLD : WHITE);
          inten = 0.4;
          break;
        }
        case "tension":
        case "reveal": {
          // fasci fermi su presentatore e ruota, più tenui
          const onPresenter = i % 2 === 0;
          target.set(onPresenter ? MARKS.home.x + Math.sin(t * 0.3 + i) * 0.25 : WHEEL_CENTER.x + Math.sin(t * 0.25 + i) * 0.6, 0, onPresenter ? MARKS.home.z : 0.9);
          c.copy(m.mood === "reveal" ? WHITE : i % 4 === 1 ? GREEN : i % 4 === 3 ? RED : WHITE);
          inten = 0.24;
          angle = 0.13;
          break;
        }
        default: {
          const a = t * 0.35 + f.phase;
          target.set(f.home.x + Math.cos(a) * 1.6, 0, f.home.z + Math.sin(a * 1.3) * 1.1);
          c.copy(i % 3 === 0 ? WHITE : i % 3 === 1 ? GREEN : RED);
          inten = 0.34;
        }
      }
      dir.subVectors(target, f.pos);
      const len = dir.length();
      dir.normalize();
      q.setFromUnitVectors(UP_NEG, dir);
      mesh.position.copy(f.pos);
      mesh.quaternion.copy(q);
      const rad = len * Math.tan(angle);
      mesh.scale.set(rad, len, rad);
      mat.uniforms.uColor.value.lerp(c, 0.18);
      mat.uniforms.uI.value += (inten - mat.uniforms.uI.value) * 0.2;
      const pool = pools.current[i];
      if (pool) {
        pool.position.set(target.x, 0.012, target.z);
        pool.scale.setScalar(rad * 2.6);
        const pm = pool.material as unknown as { color: Color; opacity: number };
        pm.color.copy(mat.uniforms.uColor.value);
        pm.opacity = Math.min(1, mat.uniforms.uI.value * 0.9);
      }
    });
  });

  return (
    <group>
      {FIXTURES.map((f, i) => (
        <group key={i}>
          <mesh
            ref={(el) => {
              meshes.current[i] = el;
            }}
            geometry={geo}
            frustumCulled={false}
            renderOrder={2}
          >
            <shaderMaterial
              ref={(el) => {
                mats.current[i] = el;
              }}
              args={[params]}
            />
          </mesh>
          {/* pozza di luce sul pavimento */}
          <mesh
            ref={(el) => {
              pools.current[i] = el;
            }}
            rotation-x={-Math.PI / 2}
            renderOrder={1}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={glow} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
          {/* corpo del faro con la lente accesa */}
          <group position={f.pos}>
            <mesh>
              <cylinderGeometry args={[0.16, 0.2, 0.42, 14]} />
              <meshStandardMaterial color="#1a1e22" metalness={0.8} roughness={0.4} />
            </mesh>
            <mesh position-y={-0.22} rotation-x={Math.PI / 2}>
              <circleGeometry args={[0.15, 16]} />
              <meshBasicMaterial color="#fff6e0" toneMapped={false} side={DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ lampadine da casinò (istanze)
function bulbsOnRect(w: number, h: number, step: number): Vector3[] {
  const out: Vector3[] = [];
  const nx = Math.round(w / step);
  const ny = Math.round(h / step);
  for (let i = 0; i < nx; i++) out.push(new Vector3(-w / 2 + (i / nx) * w, h / 2, 0));
  for (let i = 0; i < ny; i++) out.push(new Vector3(w / 2, h / 2 - (i / ny) * h, 0));
  for (let i = 0; i < nx; i++) out.push(new Vector3(w / 2 - (i / nx) * w, -h / 2, 0));
  for (let i = 0; i < ny; i++) out.push(new Vector3(-w / 2, -h / 2 + (i / ny) * h, 0));
  return out;
}

function Bulbs({ points, size, moodRef, reduced, offset = 0 }: { points: Vector3[]; size: number; moodRef: RefObject<MoodRef>; reduced: boolean; offset?: number }) {
  const ref = useRef<InstancedMesh>(null);
  const c = useMemo(() => new Color(), []);
  useEffect(() => {
    const m = new Matrix4();
    points.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      ref.current?.setMatrixAt(i, m);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const mood = moodRef.current.mood;
    const t = state.clock.elapsedTime + offset;
    const speed = mood === "spin" ? 18 : mood === "victory" || mood === "jolly" ? 10 : mood === "correct" || mood === "wrong" ? 6 : 4;
    const step = reduced ? 0 : Math.floor(t * speed);
    for (let i = 0; i < points.length; i++) {
      let on = reduced ? true : (i + step) % 3 === 0;
      if (mood === "correct" || mood === "wrong") on = reduced ? true : (step + i) % 2 === 0;
      const base = mood === "correct" ? GREEN : mood === "wrong" ? RED : mood === "victory" || mood === "standings" ? GOLD : mood === "spin" || mood === "jolly" ? (i % 2 ? GREEN : RED) : WARM;
      c.copy(base).multiplyScalar(on ? 2.4 : 0.32);
      mesh.setColorAt(i, c);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]} frustumCulled={false}>
      <sphereGeometry args={[size, 10, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// ------------------------------------------------------------------ pulviscolo e coriandoli
function Dust({ count }: { count: number }) {
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    const seed = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) seed[i] = rnd(i + 7);
    g.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("seed", new BufferAttribute(seed, 3));
    return g;
  }, [count]);
  useEffect(() => () => geo.dispose(), [geo]);
  const params = useMemo<ShaderMaterialParameters>(
    () => ({
      uniforms: { uTime: { value: 0 }, uPx: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute vec3 seed; uniform float uTime; uniform float uPx; varying float vA;
        void main() {
          float y = mod(seed.y * 6.5 + uTime * (0.05 + 0.08 * seed.z), 6.5);
          vec3 p = vec3((seed.x - 0.5) * 15.0 + sin(uTime * 0.2 + seed.z * 6.0) * 0.3, y, (seed.z - 0.5) * 8.0 + 0.4);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = smoothstep(0.0, 0.8, y) * (1.0 - smoothstep(5.2, 6.5, y)) * (0.35 + 0.65 * seed.x);
          gl_PointSize = uPx * (0.012 + 0.014 * seed.y) / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA * 0.55;
          gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    }),
    [],
  );
  const mat = useRef<ShaderMaterial>(null);
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    const fov = (state.camera as unknown as { fov?: number }).fov ?? 34;
    mat.current.uniforms.uPx.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} args={[params]} />
    </points>
  );
}

function Confetti({ count, moodRef }: { count: number; moodRef: RefObject<MoodRef> }) {
  const ref = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => [rnd(i + 1), rnd(i + 101), rnd(i + 211), rnd(i + 307)]), [count]);
  const o = useMemo(() => new Object3D(), []);
  const colors = useMemo(() => [GOLD, GREEN, WHITE, RED, GOLD], []);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    seeds.forEach((s, i) => mesh.setColorAt(i, colors[Math.floor(s[3] * colors.length)].clone().multiplyScalar(1.4)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [seeds, colors]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = moodRef.current;
    const on = m.mood === "victory";
    mesh.visible = on;
    if (!on) return;
    const t = m.since;
    seeds.forEach((s, i) => {
      const fall = 1.0 + s[1] * 0.9;
      const y = 7 - ((t * fall + s[0] * 7) % 7.4);
      o.position.set(MARKS.center.x + (s[0] - 0.5) * 9 + Math.sin(t * 1.3 + i) * 0.25, y, (s[2] - 0.5) * 5 + 0.8);
      o.rotation.set(t * (2 + s[2] * 3) + i, t * (1.5 + s[1] * 2), i);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} visible={false}>
      <planeGeometry args={[0.07, 0.12]} />
      <meshBasicMaterial side={DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

// ------------------------------------------------------------------ torri LED laterali (shader animato)
function towerMaterial(color: string): ShaderMaterialParameters {
  return {
    uniforms: { uTime: { value: 0 }, uC: { value: new Color(color) }, uBoost: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uC; uniform float uBoost; varying vec2 vUv;
      void main() {
        vec2 cell = floor(vUv * vec2(10.0, 44.0));
        vec2 f = fract(vUv * vec2(10.0, 44.0));
        float dotm = smoothstep(0.5, 0.32, length(f - 0.5));
        float wave = 0.5 + 0.5 * sin(cell.y * 0.45 - uTime * (2.2 + uBoost * 6.0) + sin(cell.x * 0.7) * 0.8);
        float chev = step(0.55, fract((cell.y + abs(cell.x - 4.5) * 1.2) * 0.12 - uTime * 0.6));
        float k = mix(wave, chev, 0.45) * (0.55 + 0.45 * uBoost);
        vec3 col = uC * (0.08 + 1.35 * k) * dotm;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    toneMapped: false,
  };
}

function SideTowers({ moodRef }: { moodRef: RefObject<MoodRef> }) {
  const left = useMemo(() => towerMaterial("#39ff14"), []);
  const right = useMemo(() => towerMaterial("#ff253a"), []);
  const ml = useRef<ShaderMaterial>(null);
  const mr = useRef<ShaderMaterial>(null);
  useFrame((state) => {
    const mood = moodRef.current.mood;
    const boost = mood === "spin" || mood === "victory" || mood === "jolly" ? 1 : mood === "correct" || mood === "wrong" ? 0.6 : 0;
    for (const m of [ml.current, mr.current]) {
      if (!m) continue;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uBoost.value += (boost - m.uniforms.uBoost.value) * 0.08;
    }
    if (mood === "correct" && ml.current && mr.current) mr.current.uniforms.uC.value.lerp(GREEN, 0.1);
    else if (mood === "wrong" && ml.current && mr.current) ml.current.uniforms.uC.value.lerp(RED, 0.1);
    else {
      ml.current?.uniforms.uC.value.lerp(GREEN, 0.1);
      mr.current?.uniforms.uC.value.lerp(RED, 0.1);
    }
  });
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 7.3, 3.2, -2.2]} rotation-y={-s * 0.62}>
          <mesh>
            <planeGeometry args={[1.7, 6.0]} />
            <shaderMaterial ref={s < 0 ? ml : mr} args={[s < 0 ? left : right]} />
          </mesh>
          <mesh position-z={-0.08}>
            <boxGeometry args={[1.95, 6.3, 0.12]} />
            <meshStandardMaterial color="#111518" metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ americane (truss)
const BEAMS: { key: string; pos: [number, number, number]; len: number; rotY: number; vertical: boolean; hiOnly: boolean }[] = [
  { key: "front", pos: [0, TRUSS_Y, 2.7], len: 15, rotY: 0, vertical: false, hiOnly: false },
  { key: "back", pos: [0, TRUSS_Y, -2.5], len: 15, rotY: 0, vertical: false, hiOnly: false },
  { key: "left", pos: [-7.3, TRUSS_Y, 0.1], len: 5.6, rotY: Math.PI / 2, vertical: false, hiOnly: false },
  { key: "right", pos: [7.3, TRUSS_Y, 0.1], len: 5.6, rotY: Math.PI / 2, vertical: false, hiOnly: false },
  { key: "tl", pos: [-7.3, 3.45, -2.5], len: 6.9, rotY: 0, vertical: true, hiOnly: true },
  { key: "tr", pos: [7.3, 3.45, -2.5], len: 6.9, rotY: 0, vertical: true, hiOnly: true },
  { key: "fl", pos: [-7.3, 3.45, 2.7], len: 6.9, rotY: 0, vertical: true, hiOnly: false },
  { key: "fr", pos: [7.3, 3.45, 2.7], len: 6.9, rotY: 0, vertical: true, hiOnly: false },
];

function Truss({ low }: { low: boolean }) {
  // una texture per trave (ripetizione diversa), create una volta e liberate allo smontaggio
  const texs = useMemo(() => {
    const base = trussTex();
    const list = BEAMS.map((b) => {
      const t = base.clone();
      t.repeat.set(b.len, 1);
      t.needsUpdate = true;
      return t;
    });
    return { base, list };
  }, []);
  useEffect(
    () => () => {
      texs.base.dispose();
      for (const t of texs.list) t.dispose();
    },
    [texs],
  );
  return (
    <group>
      {BEAMS.map((b, i) =>
        low && b.hiOnly ? null : (
          <mesh key={b.key} position={b.pos} rotation={b.vertical ? [0, b.rotY, Math.PI / 2] : [0, b.rotY, 0]}>
            <boxGeometry args={[b.len, 0.42, 0.42]} />
            <meshStandardMaterial map={texs.list[i]} alphaMap={texs.list[i]} alphaTest={0.4} color="#8d969d" metalness={0.85} roughness={0.35} side={DoubleSide} />
          </mesh>
        ),
      )}
    </group>
  );
}

// ------------------------------------------------------------------ colonne al neon
function NeonColumns() {
  const strip = useMemo(() => stripTex(), []);
  useEffect(() => () => strip.dispose(), [strip]);
  const cols: { x: number; z: number; h: number; c: string }[] = [
    { x: -4.4, z: -2.95, h: 5.2, c: "#39ff14" },
    { x: -5.3, z: -2.7, h: 4.4, c: "#39ff14" },
    { x: -6.2, z: -2.4, h: 5.6, c: "#39ff14" },
    { x: 4.4, z: -2.95, h: 5.2, c: "#ff253a" },
    { x: 5.3, z: -2.7, h: 4.4, c: "#ff253a" },
    { x: 6.2, z: -2.4, h: 5.6, c: "#ff253a" },
  ];
  return (
    <group>
      {cols.map((c, i) => (
        <group key={i} position={[c.x, c.h / 2, c.z]}>
          <mesh>
            <cylinderGeometry args={[0.035, 0.035, c.h, 8]} />
            <meshBasicMaterial color={c.c} toneMapped={false} />
          </mesh>
          <mesh position-z={0.02}>
            <planeGeometry args={[0.7, c.h * 1.04]} />
            <meshBasicMaterial map={strip} color={c.c} transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ podio della ruota
function Podium({ moodRef, reduced, shadows }: { moodRef: RefObject<MoodRef>; reduced: boolean; shadows: boolean }) {
  const ringPts = useMemo(() => {
    const pts: Vector3[] = [];
    const n = 56;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(new Vector3(Math.cos(a) * (PODIUM.radius + 0.13), 0.055, Math.sin(a) * (PODIUM.radius + 0.13)));
    }
    return pts;
  }, []);
  return (
    <group>
      {/* bordino a terra con le lampadine, poi la pedana bassa (un gradino: ci si sale camminando) */}
      <mesh position-y={0.02} receiveShadow={shadows} castShadow={false}>
        <cylinderGeometry args={[PODIUM.radius + 0.22, PODIUM.radius + 0.28, 0.04, 96]} />
        <meshStandardMaterial color="#14191d" metalness={0.85} roughness={0.32} />
      </mesh>
      <mesh position-y={PODIUM.height / 2} receiveShadow={shadows}>
        <cylinderGeometry args={[PODIUM.radius, PODIUM.radius + 0.04, PODIUM.height, 96]} />
        <meshStandardMaterial color="#0d1114" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* piano del podio: nero lucido */}
      <mesh position-y={PODIUM.height + 0.001} rotation-x={-Math.PI / 2} receiveShadow={shadows}>
        <circleGeometry args={[PODIUM.radius, 72]} />
        <meshStandardMaterial color="#0a0d10" metalness={0.6} roughness={0.22} />
      </mesh>
      {/* neon: verde sul bordo alto, rosso alla base */}
      <mesh position-y={PODIUM.height} rotation-x={Math.PI / 2}>
        <torusGeometry args={[PODIUM.radius, 0.022, 8, 120]} />
        <meshBasicMaterial color="#39ff14" toneMapped={false} />
      </mesh>
      <mesh position-y={0.012} rotation-x={Math.PI / 2}>
        <torusGeometry args={[PODIUM.radius + 0.25, 0.02, 8, 120]} />
        <meshBasicMaterial color="#ff253a" toneMapped={false} />
      </mesh>
      <Bulbs points={ringPts} size={0.03} moodRef={moodRef} reduced={reduced} offset={0.5} />
    </group>
  );
}

// ------------------------------------------------------------------ cornice dello schermo LED
function LedFrame({ moodRef, reduced }: { moodRef: RefObject<MoodRef>; reduced: boolean }) {
  const pts = useMemo(() => bulbsOnRect(LED_WALL.width + 0.55, LED_WALL.height + 0.55, 0.34), []);
  return (
    <group position={[0, LED_WALL.y, LED_WALL.z]}>
      <mesh position-z={-0.12}>
        <boxGeometry args={[LED_WALL.width + 0.95, LED_WALL.height + 0.95, 0.2]} />
        <meshStandardMaterial color="#101418" metalness={0.85} roughness={0.3} />
      </mesh>
      <group position-z={0.04}>
        <Bulbs points={pts} size={0.045} moodRef={moodRef} reduced={reduced} />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ luci vere della scena
export function StudioLighting({ moodRef, quality }: { moodRef: RefObject<MoodRef>; quality: "high" | "low" }) {
  const high = quality === "high";
  const mood = useRef<PointLight>(null);
  const spot = useRef<SpotLight>(null);
  const c = useMemo(() => new Color(), []);
  useEffect(() => {
    // il faro sul presentatore punta al suo segno
    if (spot.current) {
      spot.current.target.position.set(MARKS.home.x, 1.2, MARKS.home.z);
      spot.current.target.updateMatrixWorld();
    }
  }, []);
  useFrame((state) => {
    const l = mood.current;
    if (!l) return;
    const m = moodRef.current;
    const t = state.clock.elapsedTime;
    let inten = 0;
    switch (m.mood) {
      case "correct":
        c.copy(GREEN);
        inten = 30 + 70 * Math.exp(-m.since * 1.5);
        break;
      case "wrong":
        c.copy(RED);
        inten = 30 + 70 * Math.exp(-m.since * 1.5);
        break;
      case "spin":
        c.copy(Math.floor(t * 4) % 2 ? GREEN : RED);
        inten = 45;
        break;
      case "jolly":
      case "colpo":
        c.copy(Math.floor(t * 3) % 2 ? GREEN : RED);
        inten = 50;
        break;
      case "victory":
        c.copy(GOLD);
        inten = 55 + 25 * Math.sin(t * 5);
        break;
      case "standings":
        c.copy(GOLD);
        inten = 25;
        break;
      default:
        c.copy(WHITE);
        inten = 6;
    }
    l.color.lerp(c, 0.15);
    l.intensity += (inten - l.intensity) * 0.15;
  });
  return (
    <>
      <hemisphereLight args={["#cfe0ff", "#0a0d10", 0.55]} />
      <ambientLight intensity={0.12} color="#ffe9d6" />
      {/* luce principale calda da davanti in alto (ombre in qualità alta) */}
      <directionalLight
        position={[3.5, 8, 9]}
        intensity={2.1}
        color="#fff1e2"
        castShadow={high}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* controluce verde (sinistra) e rosso (destra): l'identità del gioco sui contorni */}
      <pointLight position={[-5.5, 4.2, -1.6]} intensity={60} distance={16} decay={2} color="#39ff14" />
      <pointLight position={[5.5, 4.2, -1.6]} intensity={60} distance={16} decay={2} color="#ff253a" />
      {/* riempimento frontale sulla ruota */}
      <pointLight position={[0.4, 2.8, 4.4]} intensity={14} distance={9} decay={2} color="#ffffff" />
      {/* faro sul presentatore */}
      {high && <spotLight ref={spot} position={[-1.2, 6.0, 5.2]} angle={0.32} penumbra={0.7} intensity={70} distance={14} decay={2} color="#ffe7cf" />}
      {/* luce dell'atmosfera (lampi verde/rosso/oro sugli eventi) */}
      <pointLight ref={mood} position={[0, 4.6, 2.6]} intensity={0} distance={14} decay={2} />
    </>
  );
}

// ------------------------------------------------------------------ pavimento
function Floor({ quality }: { quality: "high" | "low" }) {
  const decal = useMemo(() => floorDecal(), []);
  useEffect(() => () => decal.dispose(), [decal]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow={quality === "high"}>
        <planeGeometry args={[60, 60]} />
        {quality === "high" ? (
          <MeshReflectorMaterial
            resolution={384}
            blur={[240, 70]}
            mixBlur={1}
            mixStrength={3.2}
            mixContrast={1}
            roughness={0.7}
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#0c1013"
            metalness={0.5}
            mirror={0.75}
          />
        ) : (
          <meshStandardMaterial color="#0b0f12" metalness={0.55} roughness={0.28} />
        )}
      </mesh>
      {/* disegno al neon attorno al podio */}
      <mesh rotation-x={-Math.PI / 2} position={[PODIUM.x, 0.004, PODIUM.z]}>
        <planeGeometry args={[12.5, 12.5]} />
        <meshBasicMaterial map={decal} transparent opacity={0.85} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Il set completo (senza ruota, personaggi e schermo LED, che monta lo Studio). */
export function StudioSet({ quality, moodRef, reduced }: { quality: "high" | "low"; moodRef: RefObject<MoodRef>; reduced: boolean }) {
  const low = quality !== "high";
  const groupRef = useRef<Group>(null);
  return (
    <group ref={groupRef}>
      <Floor quality={quality} />
      <group position={[PODIUM.x, 0, PODIUM.z]}>
        <Podium moodRef={moodRef} reduced={reduced} shadows={!low} />
      </group>
      <LedFrame moodRef={moodRef} reduced={reduced} />
      <SideTowers moodRef={moodRef} />
      <NeonColumns />
      <Truss low={low} />
      <LightCones moodRef={moodRef} low={low} reduced={reduced} />
      <Dust count={low ? 110 : 280} />
      <Confetti count={low ? 90 : 220} moodRef={moodRef} />
    </group>
  );
}
