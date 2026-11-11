"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  HemisphereLight,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  ShaderMaterial,
  SpotLight,
  TubeGeometry,
} from "three";
import { useIntroClock } from "./clock";
import { BRAND, createLookOut, sampleLook, studioOn } from "./look";
import { Marquee, archPoints } from "./Marquee";
import { coneFragment, coneVertex, ledWallFragment, ledWallVertex } from "./shaders";
import { T, WALK, hostWalkPose, lerp, podiumRide, prog, smooth, type Speaker } from "../timeline";
import { Barrels, NeonPalm, PalmTree, Podium, PubBar } from "./Props";
import { LAYOUT } from "./layout";

const PODIUM_PROF = LAYOUT.podiumProf;
const PODIUM_REGINA = LAYOUT.podiumRegina;

export function Studio({ lowPower }: { lowPower: boolean }) {
  return (
    <group>
      <StudioLights />
      <Floor lowPower={lowPower} />
      <Stage />
      <LedWall />
      <Arches />
      <LightCones />
      <Truss />
      <Podium position={PODIUM_PROF} label="IL PROFESSORE" accent={BRAND.blue} accent2={BRAND.cyan} side={-1} />
      <Podium position={PODIUM_REGINA} label="LA REGINA" accent={BRAND.fuchsia} accent2={BRAND.violet} side={1} />
      {/* il pubblico occupa le gradinate in fondo ai lati: bancone e botti si spostano davanti alle quinte */}
      <PubBar position={[-14.2, 0, 2.4]} rotationY={1.15} />
      <Barrels position={[13.8, 0, 2.2]} rotationY={-0.9} />
      <PalmTree position={[-10.4, 0, -7.2]} height={7.2} lean={0.22} seed={1} />
      <PalmTree position={[10.6, 0, -7.4]} height={7.6} lean={-0.2} seed={2} />
      {/* palme al neon agli angoli del LED wall (le gradinate dell'arena occupano i lati) */}
      <NeonPalm position={[-12.1, 4.4, -9.1]} rotationY={0.15} />
      <NeonPalm position={[12.1, 4.4, -9.1]} rotationY={-0.15} mirror />
    </group>
  );
}

// ------------------------------------------------------------------ luci reali
function StudioLights() {
  const clock = useIntroClock();
  const hemi = useRef<HemisphereLight>(null);
  const keyL = useRef<SpotLight>(null);
  const keyR = useRef<SpotLight>(null);
  const center = useRef<SpotLight>(null);
  const pl = useRef<PointLight>(null);
  const pr = useRef<PointLight>(null);
  const look = useMemo(() => createLookOut(), []);
  const targetL = useMemo(() => {
    const o = new Object3D();
    o.position.set(PODIUM_PROF.x, 1.5, PODIUM_PROF.z);
    return o;
  }, []);
  const targetR = useMemo(() => {
    const o = new Object3D();
    o.position.set(PODIUM_REGINA.x, 1.5, PODIUM_REGINA.z);
    return o;
  }, []);
  const targetC = useMemo(() => {
    const o = new Object3D();
    o.position.set(0, 0, 0.5);
    return o;
  }, []);

  useFrame(({ scene }) => {
    const { t } = clock.current;
    sampleLook(t, look);
    const on = smooth(studioOn(t));
    // riflessi ambientali spenti nel blackout, pieni a studio acceso
    scene.environmentIntensity = 0.08 + 0.92 * on;
    if (hemi.current) hemi.current.intensity = 0.12 + 0.55 * on;
    // i podi si accendono quando entra il rispettivo presentatore
    // i podi si accendono quando entrano i presentatori; durante la battuta la luce segue chi parla
    const enter = smooth(prog(t, WALK.profFrom, WALK.profFrom + 0.5));
    // le luci chiave inseguono i podi mentre arrivano dalle quinte (o i presentatori che entrano a piedi)
    const rp = hostX("professore", t, clock.current.walking.professore) - PODIUM_PROF.x;
    const rr = hostX("regina", t, clock.current.walking.regina) - PODIUM_REGINA.x;
    targetL.position.setX(PODIUM_PROF.x + rp);
    targetR.position.setX(PODIUM_REGINA.x + rr);
    keyL.current?.position.setX(PODIUM_PROF.x + 2 + rp);
    keyR.current?.position.setX(PODIUM_REGINA.x - 2 + rr);
    const who = clock.current.speaker;
    const profOn = enter * (who === "professore" ? 1.25 : who ? 0.7 : 1);
    const regOn = enter * (who === "regina" ? 1.25 : who ? 0.7 : 1);
    if (keyL.current) {
      keyL.current.intensity = 9 * profOn;
      keyL.current.color.copy(look.key);
    }
    if (keyR.current) {
      keyR.current.intensity = 9 * regOn;
      keyR.current.color.copy(look.key);
    }
    if (center.current) {
      center.current.intensity = 16 * on;
      center.current.color.copy(look.key).lerp(WHITE, 0.6);
    }
    if (pl.current) {
      pl.current.intensity = 30 * on;
      pl.current.color.copy(look.a);
    }
    if (pr.current) {
      pr.current.intensity = 30 * on;
      pr.current.color.copy(look.rim);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#7d4dff", "#2a0a1a", 0.2]} />
      <primitive object={targetL} />
      <primitive object={targetR} />
      <primitive object={targetC} />
      <spotLight ref={keyL} position={[PODIUM_PROF.x + 2, 10, 7]} target={targetL} angle={0.32} penumbra={0.7} decay={0} intensity={0} />
      <spotLight ref={keyR} position={[PODIUM_REGINA.x - 2, 10, 7]} target={targetR} angle={0.32} penumbra={0.7} decay={0} intensity={0} />
      <spotLight ref={center} position={[0, 12, 6]} target={targetC} angle={0.45} penumbra={0.8} decay={0} intensity={0} />
      <pointLight ref={pl} position={[-8, 3, -5]} distance={22} decay={1.2} intensity={0} />
      <pointLight ref={pr} position={[8, 3, -5]} distance={22} decay={1.2} intensity={0} />
    </>
  );
}

const WHITE = new Color("#ffffff");

// ------------------------------------------------------------------ pavimento lucido
function Floor({ lowPower }: { lowPower: boolean }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
      <planeGeometry args={[90, 90]} />
      {lowPower ? (
        <meshStandardMaterial color="#120720" roughness={0.35} metalness={0.6} envMapIntensity={0.08} />
      ) : (
        <MeshReflectorMaterial
          resolution={256}
          blur={[300, 90]}
          mixBlur={1}
          mixStrength={6}
          mixContrast={1.1}
          roughness={0.75}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#120720"
          metalness={0.5}
          mirror={0.75}
          envMapIntensity={0.08}
        />
      )}
    </mesh>
  );
}

// ------------------------------------------------------------------ palco
function Stage() {
  const clock = useIntroClock();
  const ring1 = useRef<MeshBasicMaterial>(null);
  const ring2 = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => () => ring2.dispose(), [ring2]);
  const inlay = useRef<MeshBasicMaterial>(null);
  const look = useMemo(() => createLookOut(), []);

  useFrame(() => {
    const { t, e } = clock.current;
    sampleLook(t, look);
    const on = studioOn(t);
    const pulse = 0.85 + 0.15 * Math.sin(e * 3);
    if (ring1.current) ring1.current.color.copy(look.c).multiplyScalar(2.2 * on * pulse + 0.02);
    ring2.color.copy(look.a).multiplyScalar(1.8 * on + 0.02);
    if (inlay.current) inlay.current.color.set(BRAND.amber).multiplyScalar(0.9 * on + 0.03);
  });

  return (
    <group>
      <mesh position={[0, 0.09, 0.4]}>
        <cylinderGeometry args={[8.3, 8.5, 0.18, 96]} />
        <meshStandardMaterial color="#1a0a2c" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.175, 0.4]}>
        <cylinderGeometry args={[7.4, 7.4, 0.35, 96]} />
        <meshStandardMaterial color="#22103a" roughness={0.18} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.355, 0.4]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.0, 3.16, 96]} />
        <meshBasicMaterial ref={inlay} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.355, 0.4]} rotation-x={-Math.PI / 2} material={ring2}>
        <ringGeometry args={[5.0, 5.06, 96]} />
      </mesh>
      <mesh position={[0, 0.35, 0.4]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[7.4, 0.05, 8, 128]} />
        <meshBasicMaterial ref={ring1} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.18, 0.4]} rotation-x={Math.PI / 2} material={ring2}>
        <torusGeometry args={[8.4, 0.04, 8, 128]} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ LED wall
function LedWall() {
  const clock = useIntroClock();
  const mat = useRef<ShaderMaterial>(null);
  const look = useMemo(() => createLookOut(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOn: { value: 0 },
      uBoost: { value: 0 },
      uColA: { value: new Color() },
      uColB: { value: new Color() },
      uColC: { value: new Color() },
      uGrid: { value: [210, 90] },
      uCenter: { value: [0.5, 0.58] },
    }),
    [],
  );

  useFrame(() => {
    const m = mat.current;
    if (!m) return;
    const { t, e, reducedMotion } = clock.current;
    sampleLook(t, look);
    m.uniforms.uTime.value = reducedMotion ? e * 0.35 : e;
    m.uniforms.uOn.value = smooth(prog(t, T.studioOn + 0.2, T.studioOn + 2.6));
    // piccoli "colpi" di luminosità sugli ingressi
    let boost = 0;
    if (!reducedMotion) {
      for (const at of HITS) {
        const d = t - at;
        if (d >= 0 && d < 0.6) boost = Math.max(boost, (1 - d / 0.6) * 0.8);
      }
    }
    m.uniforms.uBoost.value = boost;
    (m.uniforms.uColA.value as Color).copy(look.a);
    (m.uniforms.uColB.value as Color).copy(look.b);
    (m.uniforms.uColC.value as Color).copy(look.c);
  });

  return (
    <group position={[0, 5.6, -9.4]}>
      <mesh>
        <planeGeometry args={[26, 11.2]} />
        <shaderMaterial ref={mat} vertexShader={ledWallVertex} fragmentShader={ledWallFragment} uniforms={uniforms} />
      </mesh>
      {/* cornice */}
      <mesh position={[0, 5.75, 0.05]}>
        <boxGeometry args={[26.6, 0.35, 0.4]} />
        <meshStandardMaterial color="#2a1640" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, -5.75, 0.05]}>
        <boxGeometry args={[26.6, 0.35, 0.4]} />
        <meshStandardMaterial color="#2a1640" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  );
}

const HITS = [T.wheelStop, T.studioOn, T.title, T.title + 0.9, T.title + 1.8, T.palminoDrop + 0.3, T.end];

// ------------------------------------------------------------------ archi dorati con lampadine
interface ArchDef {
  z: number;
  w: number;
  leg: number;
  ry: number;
  tube: number;
  spacing: number;
  on: [number, number];
  colors: [string, string];
}

const ARCHES: readonly ArchDef[] = [
  // l'arco di fondo sta DIETRO l'emblema parcheggiato; quello davanti è alto abbastanza da incorniciarlo
  { z: -7.6, w: 10.6, leg: 6.2, ry: 3.6, tube: 0.24, spacing: 0.62, on: [T.studioOn + 0.1, T.studioOn + 1.9], colors: ["#FFE3A6", "#FFE3A6"] },
  { z: -3.5, w: 8.4, leg: 7.0, ry: 3.6, tube: 0.18, spacing: 0.58, on: [T.studioOn + 0.5, T.studioOn + 2.3], colors: ["#FFD08A", "#FF7AC6"] },
];

function Arches() {
  return (
    <>
      {ARCHES.map((a, i) => (
        <Arch key={i} def={a} index={i} />
      ))}
    </>
  );
}

function Arch({ def, index }: { def: ArchDef; index: number }) {
  const clock = useIntroClock();
  const neon = useRef<MeshBasicMaterial>(null);
  const look = useMemo(() => createLookOut(), []);
  const { tube, neonTube, bulbs } = useMemo(() => {
    const path = archPoints(def.w, def.leg, def.ry, 0.25, 0);
    const curve = new CatmullRomCurve3(path);
    const tubeGeo = new TubeGeometry(curve, 220, def.tube, 10, false);
    const inner = archPoints(def.w - def.tube * 2.2, def.leg, def.ry - def.tube * 2.2, 0.25, def.tube * 0.6);
    const neonGeo = new TubeGeometry(new CatmullRomCurve3(inner), 220, 0.045, 6, false);
    const bulbPts = archPoints(def.w, def.leg, def.ry, def.spacing, def.tube + 0.06);
    return { tube: tubeGeo, neonTube: neonGeo, bulbs: bulbPts };
  }, [def]);

  useEffect(
    () => () => {
      tube.dispose();
      neonTube.dispose();
    },
    [tube, neonTube],
  );

  useFrame(() => {
    const { t, e } = clock.current;
    sampleLook(t, look);
    const on = smooth(prog(t, def.on[0], def.on[1]));
    const src = index === 1 ? look.c : index === 0 ? look.rim : look.a;
    if (neon.current) neon.current.color.copy(src).multiplyScalar((1.8 + 0.3 * Math.sin(e * 2 + index)) * on + 0.01);
  });

  return (
    <group position={[0, 0, def.z]}>
      <mesh geometry={tube}>
        <meshStandardMaterial color="#d9a521" metalness={1} roughness={0.28} envMapIntensity={1.2} />
      </mesh>
      <mesh geometry={neonTube}>
        <meshBasicMaterial ref={neon} toneMapped={false} />
      </mesh>
      <Marquee points={bulbs} onFrom={def.on[0]} onTo={def.on[1]} color={def.colors[0]} color2={def.colors[1]} radius={0.1} haloSize={1.0} idleTwinkle={index === 0} />
    </group>
  );
}

// ------------------------------------------------------------------ coni di luce volumetrici
const CONES = [
  { x: -9.5, z: -2.5, phase: 0.0, useRim: false },
  { x: -5.8, z: -1.0, phase: 1.3, useRim: true },
  { x: -2.0, z: -2.0, phase: 2.1, useRim: false },
  { x: 2.0, z: -2.0, phase: 3.4, useRim: true },
  { x: 5.8, z: -1.0, phase: 4.2, useRim: false },
  { x: 9.5, z: -2.5, phase: 5.0, useRim: true },
] as const;

function LightCones() {
  const clock = useIntroClock();
  const groups = useRef<(Group | null)[]>([]);
  const mats = useRef<(ShaderMaterial | null)[]>([]);
  const look = useMemo(() => createLookOut(), []);
  const geo = useMemo(() => {
    const g = new ConeGeometry(2.1, 13, 32, 1, true);
    g.translate(0, -6.5, 0);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const uniforms = useMemo(() => CONES.map(() => ({ uColor: { value: new Color() }, uIntensity: { value: 0 } })), []);

  useFrame(() => {
    const { t, e, reducedMotion } = clock.current;
    sampleLook(t, look);
    for (let i = 0; i < CONES.length; i++) {
      const c = CONES[i];
      const g = groups.current[i];
      const m = mats.current[i];
      // si accendono a coppie durante lo "studio on"
      const on = smooth(prog(t, T.studioOn + 0.15 + (i % 3) * 0.35, T.studioOn + 0.9 + (i % 3) * 0.35));
      const blink = t < T.studioOn + 1.2 && !reducedMotion ? 0.6 + 0.4 * Math.sign(Math.sin(e * 40 + i)) : 1;
      if (m) {
        (m.uniforms.uColor.value as Color).copy(c.useRim ? look.rim : look.key);
        const annPulse = t >= T.title && t < T.entrance && !reducedMotion ? Math.pow(0.5 + 0.5 * Math.sin((t - T.title) * Math.PI * 2 * 2.2 + i), 2) : 0;
        m.uniforms.uIntensity.value = 0.2 * on * blink * (1 + annPulse * 1.4);
      }
      if (g) {
        const speed = reducedMotion ? 0.12 : 0.55;
        const amp = reducedMotion ? 0.1 : 0.42;
        // movimento libero
        let rz = Math.sin(e * speed + c.phase) * amp;
        let rx = 0.12 + Math.sin(e * speed * 0.7 + c.phase * 2) * amp * 0.4;
        // chi parla: i coni convergono sul personaggio
        const focus = focusTarget(t, clock.current.speaker, clock.current.walking);
        if (focus !== null) {
          aimAt(focus, 2.2, 1.2, c.x, c.z);
          rz = lerp(rz, AIM.z, 0.75);
          rx = lerp(rx, AIM.x, 0.75);
        }
        // annunciatore: tutti i coni si girano sull'emblema in fondo e "spazzano" a tempo
        const ann = smooth(prog(t, T.title - 0.4, T.title + 0.2)) * (1 - smooth(prog(t, T.entrance - 0.3, T.entrance + 0.2)));
        if (ann > 0) {
          const sweep = reducedMotion ? 0 : Math.sin(e * 4.4 + c.phase) * 0.12;
          aimAt(LAYOUT.logo.x, LAYOUT.logo.y - 0.5, LAYOUT.logo.z, c.x, c.z);
          rz = lerp(rz, AIM.z + sweep, ann);
          rx = lerp(rx, AIM.x, ann);
        }
        g.rotation.z = rz;
        g.rotation.x = rx;
      }
    }
  });

  return (
    <>
      {CONES.map((c, i) => (
        <group key={i} position={[c.x, 11.5, c.z]}>
          <mesh>
            <cylinderGeometry args={[0.32, 0.4, 0.7, 16]} />
            <meshStandardMaterial color="#120a1c" metalness={0.8} roughness={0.4} />
          </mesh>
          <group
            ref={(el) => {
              groups.current[i] = el;
            }}
          >
            <mesh geometry={geo}>
              <shaderMaterial
                ref={(el) => {
                  mats.current[i] = el;
                }}
                vertexShader={coneVertex}
                fragmentShader={coneFragment}
                uniforms={uniforms[i]}
                transparent
                depthWrite={false}
                blending={AdditiveBlending}
                side={DoubleSide}
              />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

const CONE_Y = 11.5;
const AIM = { x: 0, z: 0 };
/**
 * Rotazioni (ordine XYZ) che puntano l'asse del cono (−Y) dal proiettore (cx, CONE_Y, cz) al bersaglio.
 * Rz porta (0,−1,0) in (sin z, −cos z, 0), poi Rx inclina avanti/indietro.
 */
function aimAt(tx: number, ty: number, tz: number, cx: number, cz: number) {
  const dx = tx - cx;
  const dy = ty - CONE_Y;
  const dz = tz - cz;
  const len = Math.hypot(dx, dy, dz) || 1;
  AIM.z = Math.asin(Math.max(-1, Math.min(1, dx / len)));
  AIM.x = Math.atan2(-dz, -dy);
}

/** X del presentatore in ingresso: col podio in corsa, oppure a piedi (GLB). */
function hostX(who: "professore" | "regina", t: number, walking: boolean): number {
  if (walking) return hostWalkPose(who, t).x;
  return who === "professore" ? PODIUM_PROF.x + podiumRide(-1, t).dx : PODIUM_REGINA.x + podiumRide(1, t).dx;
}

/** X del personaggio su cui convergono i coni (null = movimento libero). */
function focusTarget(t: number, who: Speaker | null, walking: { professore: boolean; regina: boolean }): number | null {
  if (t >= T.title && t < T.entrance) return 0; // tutti sul logo
  // ingresso: i coni seguono chi compare
  // ingresso: i coni seguono i podi in corsa
  if (t >= T.entrance && t < WALK.reginaFrom) return hostX("professore", t, walking.professore);
  if (t >= WALK.reginaFrom && t < T.palminoDrop) return hostX("regina", t, walking.regina);
  if (t >= T.palminoDrop && t < T.pushIn) return 0;
  if (who === "professore") return PODIUM_PROF.x;
  if (who === "regina") return PODIUM_REGINA.x;
  if (who === "palmino") return 0;
  return null;
}

// ------------------------------------------------------------------ americana (traliccio)
function Truss() {
  return (
    <group position={[0, 11.9, -1.8]}>
      {[-0.25, 0.25].map((dz) =>
        [-0.25, 0.25].map((dy) => (
          <mesh key={`${dz}${dy}`} position={[0, dy, dz]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.05, 0.05, 24, 6]} />
            <meshStandardMaterial color="#3a3550" metalness={0.9} roughness={0.35} />
          </mesh>
        )),
      )}
    </group>
  );
}
