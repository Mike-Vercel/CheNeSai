"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { Group } from "three";
import type { Presenter } from "@/lib/game-engine/types";
import { getVoice } from "@/features/media/voice";
import type { CharacterAnimation } from "./types";
import { CHARACTER_MODELS as MODELS } from "./registry";
import { effectiveAnimation, GESTURE_MS } from "./gesture";

/** Inquadratura predefinita per personaggio (presentatori a mezzo busto, Palmino intero). */
export const FRAMING: Record<Presenter, { camera: [number, number, number]; target: [number, number, number]; fov: number }> = {
  professore: { camera: [0, 1.05, 3.4], target: [0, 0.95, 0], fov: 32 },
  regina: { camera: [0, 1.05, 3.5], target: [0, 0.95, 0], fov: 32 },
  palmino: { camera: [0, 0.85, 3.6], target: [0, 0.8, 0], fov: 30 },
};

export interface CastMember {
  who: Presenter;
  animation: CharacterAnimation;
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  /** Cambiandolo il gesto richiesto riparte (es. nuova schermata con la stessa animazione). */
  gestureKey?: string;
  /** Spostamenti morbidi (~0.5 s) quando cambiano posizione, rotazione o scala (il trio che si riordina). */
  glide?: boolean;
}

/** true quando il gesto richiesto è già stato fatto (riparte a ogni cambio di animazione o di chiave). */
function useGestureDone(animation: CharacterAnimation, key = ""): boolean {
  const [g, setG] = useState({ anim: animation, key, done: false });
  // nuovo gesto richiesto: si riparte (aggiornamento durante il render, schema consigliato da React)
  if (g.anim !== animation || g.key !== key) setG({ anim: animation, key, done: false });
  useEffect(() => {
    const ms = GESTURE_MS[animation];
    if (!ms) return;
    const t = setTimeout(() => setG((p) => (p.anim === animation && p.key === key ? { anim: animation, key, done: true } : p)), ms);
    return () => clearTimeout(t);
  }, [animation, key]);
  return g.anim === animation && g.key === key && g.done;
}

/** Contenitore che raggiunge con calma posizione, rotazione e scala richieste (trio che si riordina). */
function Glide({ position, rotationY, scale, children }: { position: [number, number, number]; rotationY: number; scale: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const first = useRef(true);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    // al primo frame si parte già al posto giusto; poi ~0.5 s per arrivare (costante di tempo 0.15 s)
    const k = first.current ? 1 : 1 - Math.exp(-Math.min(0.1, dt) / 0.15);
    first.current = false;
    g.position.x += (position[0] - g.position.x) * k;
    g.position.y += (position[1] - g.position.y) * k;
    g.position.z += (position[2] - g.position.z) * k;
    g.rotation.y += (rotationY - g.rotation.y) * k;
    g.scale.setScalar(g.scale.x + (scale - g.scale.x) * k);
  });
  return <group ref={ref}>{children}</group>;
}

function Member({ m, lowPower }: { m: CastMember; lowPower: boolean }) {
  const Model = MODELS[m.who];
  const [talking, setTalking] = useState(false);
  const talkingRef = useRef(false);
  useEffect(
    () =>
      getVoice().subscribe((who) => {
        talkingRef.current = who === m.who;
        setTalking(who === m.who);
      }),
    [m.who],
  );
  // Lip-sync: la voce fornisce l'apertura della bocca a ogni frame. Va in un ref letto dal modello
  // nel suo useFrame: niente render di React a ogni frame mentre il personaggio parla.
  const mouthRef = useRef(0);
  useFrame((_, dt) => {
    const v = getVoice().mouthOpen(m.who, dt);
    mouthRef.current = talkingRef.current ? v : 0;
  });
  const animation = effectiveAnimation(m.animation, useGestureDone(m.animation, m.gestureKey), talking);
  if (m.glide)
    return (
      <Glide position={m.position ?? [0, 0, 0]} rotationY={m.rotationY ?? 0} scale={m.scale ?? 1}>
        <Model animation={animation} mouthRef={mouthRef} lowPower={lowPower} />
      </Glide>
    );
  return (
    <Model
      animation={animation}
      mouthRef={mouthRef}
      lowPower={lowPower}
      position={m.position ?? [0, 0, 0]}
      rotation={[0, m.rotationY ?? 0, 0]}
      scale={m.scale ?? 1}
    />
  );
}

/**
 * Si torna alle immagini 2D solo se il PC è DAVVERO troppo lento (sotto ~12 fps per 15 s di fila).
 * Le misure con la scheda in secondo piano, con la finestra coperta o appena dopo un cambio
 * schermata non contano: il browser rallenta da solo quei casi e non vuol dire che il PC non regga.
 */
function FpsGuard({ onSlow, minFps = 12 }: { onSlow: (reason: string) => void; minFps?: number }) {
  const acc = useRef({ t: 0, frames: 0, warm: 0, slow: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    // finestra coperta o schermo spento: il browser dà ~1 frame al secondo pur restando "visible";
    // non è il PC lento (un PC lento fa comunque più frame al secondo), quindi non conta
    const throttled = dt > 0.75;
    if (throttled || (typeof document !== "undefined" && document.visibilityState !== "visible")) {
      a.t = 0;
      a.frames = 0;
      a.warm = 0;
      return;
    }
    a.warm += dt;
    if (a.warm < 4) return; // compilazione shader e caricamento
    a.t += dt;
    a.frames += 1;
    if (a.t >= 5) {
      const fps = a.frames / a.t;
      a.slow = fps < minFps ? a.slow + 1 : 0;
      if (a.slow >= 3) onSlow(`frame rate molto basso (${fps.toFixed(0)} fps)`);
      a.t = 0;
      a.frames = 0;
    }
  });
  return null;
}

/**
 * Disegno a frequenza ridotta (canvas in modalità "demand"): un frame ogni 1/fps secondi, agganciato
 * al refresh del browser. Il movimento di riposo a 30 fps è fluido e la GPU lavora la metà.
 */
function FrameCap({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let id = 0;
    let last = -Infinity;
    const step = 1000 / fps;
    const loop = (t: number) => {
      // 2 ms di tolleranza: con refresh a 60 Hz si disegna esattamente un frame su due
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

class StageBoundary extends Component<{ onError: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(`errore 3D: ${error instanceof Error ? error.message : String(error)}`);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Palco 3D trasparente con uno o più personaggi (sovrapposto alla grafica TV).
 * `onFallback` viene chiamato se WebGL fallisce o il PC è troppo lento.
 */
/**
 * Margine di disegno oltre il riquadro del personaggio (frazioni della sua larghezza/altezza).
 * Il canvas viene allargato di tanto (vedi `bleedStyle`) e qui la camera viene corretta perché il
 * personaggio resti identico per misura e posizione: le braccia aperte o alzate non vengono più
 * tagliate dal bordo del canvas (il "muro invisibile").
 */
export interface StageBleed {
  left: number;
  right: number;
  top: number;
}

/** Stile del canvas allargato: va messo dentro un contenitore `relative` grande quanto il personaggio. */
export function bleedStyle(b: StageBleed): React.CSSProperties {
  // width/height "auto": il Canvas di R3F mette 100% di default, che annullerebbe left/right/top
  return { position: "absolute", left: `${-b.left * 100}%`, right: `${-b.right * 100}%`, top: `${-b.top * 100}%`, bottom: 0, width: "auto", height: "auto" };
}

function withBleed(f: { camera: [number, number, number]; target: [number, number, number]; fov: number }, top: number) {
  if (top <= 0) return f;
  const [cx, cy, cz] = f.camera;
  const [tx, ty, tz] = f.target;
  const d = Math.hypot(cx - tx, cy - ty, cz - tz);
  const half = Math.tan((f.fov * Math.PI) / 360);
  const height = 2 * d * half;
  // più spazio sopra: fov verticale più ampio e centro alzato, il bordo inferiore resta dov'era
  const fov = (Math.atan(half * (1 + top)) * 360) / Math.PI;
  const lift = (height * top) / 2;
  return { camera: [cx, cy + lift, cz] as [number, number, number], target: [tx, ty + lift, tz] as [number, number, number], fov };
}

export function CharacterStage({
  cast,
  framing,
  lowPower = false,
  onFallback,
  className,
  style,
  bleedTop = 0,
  frameloop = "always",
  fpsCap = 0,
  children,
}: {
  cast: CastMember[];
  framing?: { camera: [number, number, number]; target: [number, number, number]; fov: number };
  lowPower?: boolean;
  onFallback?: (reason?: string) => void;
  className?: string;
  style?: React.CSSProperties;
  /** Spazio extra sopra il personaggio (frazione della sua altezza), già incluso nello stile del canvas. */
  bleedTop?: number;
  /** "never" ferma il disegno (palco persistente momentaneamente non in scena). */
  frameloop?: "always" | "never";
  /** Frame al secondo massimi (0 = come il browser). */
  fpsCap?: number;
  /** Altro da mettere nella scena (es. la luce che segue chi parla). */
  children?: ReactNode;
}) {
  const f = withBleed(framing ?? FRAMING[cast[0]?.who ?? "professore"], bleedTop);
  return (
    <StageBoundary onError={(r) => onFallback?.(r)}>
      <Canvas
        className={className}
        frameloop={frameloop === "always" && fpsCap > 0 ? "demand" : frameloop}
        dpr={lowPower ? [0.75, 1] : [1, 1.5]}
        // misura le dimensioni vere del riquadro, ignorando le animazioni di entrata (scale):
        // altrimenti un personaggio che entra "zoomando" resta piccolo e fuori centro per sempre
        resize={{ offsetSize: true }}
        gl={{ alpha: true, antialias: !lowPower, powerPreference: "high-performance" }}
        camera={{ position: f.camera, fov: f.fov, near: 0.1, far: 50 }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(...f.target);
          gl.setClearColor(0x000000, 0);
          // Alla chiusura del canvas (cambio schermata) R3F forza la perdita del contesto:
          // conta come guasto solo se il canvas è ancora nella pagina.
          const el = gl.domElement;
          el.addEventListener("webglcontextlost", () => setTimeout(() => el.isConnected && onFallback?.("contesto WebGL perso"), 150), { once: true });
        }}
        style={{ background: "transparent", pointerEvents: "none", ...style }}
      >
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#ffe9c7", "#2a0d45", 0.6]} />
        <directionalLight position={[2.5, 4, 4]} intensity={2.1} color="#fff1dc" />
        <directionalLight position={[-3, 2.5, -2]} intensity={1.6} color="#ff4fb0" />
        <directionalLight position={[3, 1.5, -2.5]} intensity={1.3} color="#3fb8ff" />
        <Suspense fallback={null}>
          {cast.map((m) => (
            <Member key={m.who} m={m} lowPower={lowPower} />
          ))}
        </Suspense>
        {children}
        {frameloop === "always" && fpsCap > 0 && <FrameCap fps={fpsCap} />}
        {onFallback && frameloop === "always" && <FpsGuard onSlow={onFallback} minFps={fpsCap > 0 ? Math.min(12, fpsCap / 3) : 12} />}
      </Canvas>
    </StageBoundary>
  );
}
