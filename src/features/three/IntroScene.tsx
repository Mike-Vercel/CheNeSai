"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor, useFont, useTexture } from "@react-three/drei";
import { ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace, type Object3D } from "three";
import { IntroClockContext, type IntroClock } from "./scene/clock";
import { CameraRig } from "./scene/CameraRig";
import { Studio } from "./scene/Studio";
import { Characters } from "./scene/Characters";
import { Audience } from "./scene/Audience";
import { Logo3D, preloadLogoTextures } from "./scene/Logo3D";
import { Confetti, GoldDust, SparkBurst } from "./scene/Particles";
import { LAYOUT } from "./scene/layout";
import { BRAND } from "./scene/look";
import { registerDreiPreloader } from "./assets";
import { isWeakGpu } from "./IntroErrorBoundary";
import { INTRO_DURATION_S, T, WALK, speakerAt } from "./timeline";
import { RULES, ruleAt, rulesTime, speakerZoom, storyTime, type IntroSchedule } from "./rules";

// Quando questo modulo è caricato, preloadIntroAssets() scalda anche le cache di drei.
registerDreiPreloader((urls, font) => {
  for (const u of urls) useTexture.preload(u);
  useFont.preload(font);
  preloadLogoTextures(false);
});

export interface IntroSceneProps {
  startedAtMs: number;
  now: () => number;
  reducedMotion: boolean;
  lowPower: boolean;
  onContextLost: () => void;
  onContextRestored: () => void;
  schedule: IntroSchedule;
}

/**
 * Possiede l'orologio condiviso e lo aggiorna a ogni frame, prima di tutti gli altri useFrame.
 * Tempo = SOLO now() - startedAtMs (mai il tempo di montaggio locale).
 */
function ClockProvider({
  startedAtMs,
  now,
  reducedMotion,
  lowPower,
  schedule,
  children,
}: {
  startedAtMs: number;
  now: () => number;
  reducedMotion: boolean;
  lowPower: boolean;
  schedule: IntroSchedule;
  children: React.ReactNode;
}) {
  const clock = useRef<IntroClock>({ t: 0, e: 0, dt: 0, reducedMotion, lowPower, pointScale: 600, speaker: null, rule: -1, s: 0, zoom: 0, walking: { professore: false, regina: false } });
  useFrame(({ size, camera, viewport }) => {
    const c = clock.current;
    const e = Math.max(0, (now() - startedAtMs) / 1000);
    c.dt = Math.min(0.1, Math.max(0, e - c.e));
    c.e = e;
    c.s = storyTime(e, schedule);
    c.t = Math.min(c.s, INTRO_DURATION_S);
    const rule = ruleAt(e, schedule);
    c.rule = rule ?? -1;
    c.speaker = rule !== null ? RULES[rule].who : rulesTime(e, schedule) >= 0 ? null : speakerAt(c.t);
    c.zoom = c.speaker ? speakerZoom(e, schedule, c.t) : 0;
    c.reducedMotion = reducedMotion;
    c.lowPower = lowPower;
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 40;
    c.pointScale = (size.height * viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
  }, -100);
  return <IntroClockContext value={clock}>{children}</IntroClockContext>;
}

/** Ascolta perdita/ripristino del contesto WebGL (rimosso prima dello smontaggio del renderer). */
function ContextWatcher({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (ev: Event) => {
      ev.preventDefault();
      onLost();
    };
    const restored = () => onRestored();
    el.addEventListener("webglcontextlost", lost, false);
    el.addEventListener("webglcontextrestored", restored, false);
    return () => {
      el.removeEventListener("webglcontextlost", lost, false);
      el.removeEventListener("webglcontextrestored", restored, false);
    };
  }, [gl, onLost, onRestored]);
  return null;
}

/**
 * Compila tutti gli shader all'avvio (anche degli oggetti ancora nascosti: logo, coriandoli…)
 * per evitare scatti alla loro prima apparizione.
 */
function Precompile() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const hidden: Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    try {
      // compileAsync raccoglie i materiali subito (sincrono) e poi interroga lo stato dei programmi:
      // con KHR_parallel_shader_compile, un programma mai interrogato e poi eliminato (es. quando i
      // modelli dei personaggi si ricostruiscono) fa scrivere a Chrome "glGetProgramiv: Program object expected".
      void gl.compileAsync(scene, camera).catch(() => undefined);
    } finally {
      for (const o of hidden) o.visible = false;
    }
  }, [gl, scene, camera]);
  return null;
}

const CONFETTI_COLORS = [BRAND.gold, BRAND.fuchsia, BRAND.cyan, BRAND.green, BRAND.violet, BRAND.red, "#ffffff"] as const;
const PALMINO_COLORS = [BRAND.green, BRAND.gold, BRAND.cyan, "#b6ff7a", BRAND.fuchsia] as const;
const BRAKE_COLORS = ["#ffffff", "#ffe2f2", BRAND.gold, "#c8e8ff"] as const;
const LOGO_SPARK_COLORS = [BRAND.gold, BRAND.amber, "#ffffff", BRAND.fuchsia] as const;

export default function IntroScene({ startedAtMs, now, reducedMotion, lowPower, onContextLost, onContextRestored, schedule }: IntroSceneProps) {
  const [degraded, setDegraded] = useState(false);
  const low = lowPower || degraded;
  // MSAA nativo solo su GPU dedicate: su integrate/TV costa ~8 ms/frame con tanti strati additivi.
  // Deciso una volta alla creazione del contesto (non si può cambiare dopo).
  const [msaa] = useState(() => !lowPower && !isWeakGpu());

  const counts = useMemo(
    () => ({
      dust: low ? 160 : reducedMotion ? 220 : 520,
      burst: low ? 120 : reducedMotion ? 60 : 280,
      confetti: low ? 120 : reducedMotion ? 90 : 240,
      rain: low ? 90 : reducedMotion ? 60 : 220,
    }),
    [low, reducedMotion],
  );

  const palminoBurstOrigin = useMemo<[number, number, number]>(() => [LAYOUT.palminoHero.x, 1.6, LAYOUT.palminoHero.z], []);
  const profBrakeOrigin = useMemo<[number, number, number]>(() => [LAYOUT.podiumProf.x - 1.6, 0.6, LAYOUT.podiumProf.z + 0.3], []);
  const reginaBrakeOrigin = useMemo<[number, number, number]>(() => [LAYOUT.podiumRegina.x + 1.6, 0.6, LAYOUT.podiumRegina.z + 0.3], []);
  const titleBurstOrigin = useMemo<[number, number, number]>(() => [LAYOUT.logo.x, LAYOUT.logo.y, LAYOUT.logo.z + 0.8], []);
  const logoBurstOrigin = useMemo<[number, number, number]>(() => [LAYOUT.logoReveal.x, LAYOUT.logoReveal.y - 2.2, LAYOUT.logoReveal.z - 0.8], []);

  return (
    <Canvas
      dpr={low ? [1, 1] : [1, 1.75]}
      gl={{ antialias: msaa, alpha: false, stencil: false, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
      camera={{ fov: 32, near: 0.1, far: 140, position: [0, 1, 26] }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ClockProvider startedAtMs={startedAtMs} now={now} reducedMotion={reducedMotion} lowPower={low} schedule={schedule}>
        <ContextWatcher onLost={onContextLost} onRestored={onContextRestored} />
        {!lowPower && <PerformanceMonitor onDecline={() => setDegraded(true)} flipflops={2} />}
        <color attach="background" args={["#07020d"]} />
        <fog attach="fog" args={["#0d0418", 24, 62]} />
        <CameraRig />
        <Suspense fallback={null}>
          <Environment resolution={low ? 64 : 256} frames={1}>
            <Lightformer form="rect" intensity={4} color="#ffd27a" position={[0, 6, -9]} scale={[14, 4, 1]} />
            <Lightformer form="rect" intensity={3} color={BRAND.fuchsia} position={[-10, 3, 2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
            <Lightformer form="rect" intensity={3} color={BRAND.blue} position={[10, 3, 2]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} />
            <Lightformer form="ring" intensity={5} color="#ffffff" position={[0, 10, 6]} scale={4} />
            <Lightformer form="rect" intensity={1.5} color={BRAND.violet} position={[0, -4, 8]} rotation-x={-Math.PI / 2} scale={[20, 6, 1]} />
            {/* luci "dietro la camera": danno all'oro del logo riflessi caldi frontali */}
            <Lightformer form="rect" intensity={3.5} color="#fff1c8" position={[0, 7, 16]} rotation-y={Math.PI} scale={[16, 3, 1]} />
            <Lightformer form="rect" intensity={2} color="#ffb347" position={[-8, 1, 14]} rotation-y={Math.PI * 0.85} scale={[6, 6, 1]} />
            <Lightformer form="rect" intensity={2} color="#ff5ab4" position={[8, 1, 14]} rotation-y={-Math.PI * 0.85} scale={[6, 6, 1]} />
          </Environment>
          <Studio lowPower={low} />
          {/* qualità di personaggi, pubblico e logo FISSA per tutta l'intro (preferenza del TV): se il
              monitor delle prestazioni degrada a metà, non si ricostruiscono i modelli né si ricaricano le texture */}
          <Characters lowPower={lowPower} />
          <Audience lowPower={lowPower} />
          <Logo3D lowPower={lowPower} />
          <GoldDust count={counts.dust} />
          <SparkBurst at={T.title} origin={titleBurstOrigin} count={counts.burst} colors={LOGO_SPARK_COLORS} />
          <Confetti at={T.wheelStop + 0.05} count={counts.confetti} origin={logoBurstOrigin} spread={[1.2, 0, 0.4]} colors={CONFETTI_COLORS} life={3.2} seed={5} />
          {/* sbuffo di frenata dei podi */}
          <SparkBurst at={WALK.profTo - 0.12} origin={profBrakeOrigin} count={Math.round(counts.burst * 0.35)} colors={BRAKE_COLORS} />
          <SparkBurst at={WALK.reginaTo - 0.12} origin={reginaBrakeOrigin} count={Math.round(counts.burst * 0.35)} colors={BRAKE_COLORS} />
          <SparkBurst at={T.palminoDrop + 0.3} origin={palminoBurstOrigin} count={counts.burst} colors={PALMINO_COLORS} />
          <Confetti at={T.palminoDrop + 0.3} count={counts.confetti} origin={palminoBurstOrigin} spread={[0.6, 0, 0.6]} colors={CONFETTI_COLORS} life={3.4} seed={3} />
          <Precompile />
          <Confetti at={T.countdown} count={counts.rain} origin={[0, -0.5, 0]} spread={[13, 13, 5]} colors={CONFETTI_COLORS} life={7} loop free seed={9} />
        </Suspense>
      </ClockProvider>
    </Canvas>
  );
}
