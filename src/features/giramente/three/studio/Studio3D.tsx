"use client";

import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AdditiveBlending, Box3, CanvasTexture, SRGBColorSpace, type Group, type Mesh, type MeshBasicMaterial, type Object3D, type PerspectiveCamera } from "three";
import { Boundary3D } from "../CharacterStage3D";
import { GiramenteCharacterModel } from "../character-model";
import { characterUrl } from "../characters";
import { PortalRig } from "../JollyPortal3D";
import { prefersReducedMotion } from "../quality";
import type { CharacterAction, CharacterWho, WheelSegment, WheelSpinCommand } from "../types";
import { FLOOR_Y, RoomEnv, STAND_URL, WheelAssembly } from "../Wheel3D";
import { DEFAULT_WHEEL_FONT } from "../wheel-texture";
import { drawLed, LED_SIZE, type LedContent } from "./led-texture";
import { cameraPosition, fitDistance, FULL_WINDOW, lensShift, shotFor, smoothDamp, type FrameWindow } from "./studio-camera";
import { directStudio, effectiveSince, WALK_IN_MS, type ShotId, type StudioCue, type StudioDirection } from "./studio-director";
import { groundAt, LED_WALL, MARKS, PODIUM, PORTAL_SPOT, PRESENTER_HEIGHT, WHEEL_SCALE, WHEEL_X, type MarkId } from "./studio-layout";
import { readStudioWindow } from "./studio-window";
import { StudioLighting, StudioSet, type MoodRef } from "./StudioSet";

/**
 * LO STUDIO 3D DI GIRAMENTE!: UN solo canvas per tutta la pagina del gioco (non si ricarica tra le fasi).
 * Set da game show, la RUOTA grande sul podio (stesso giro deterministico del server), DON PATRIZIO a figura intera
 * accanto alla ruota, ZAFIRA che esce dal portale quando esce la Jolly, schermo LED, regia di camera per fase.
 * L'interfaccia di gioco (HUD) sta sopra: lo studio inquadra i soggetti nella "finestra" che l'HUD lascia libera.
 *
 * Prestazioni: disegno a richiesta (60 fps in "high", 45/30 in "low", fermo a scheda
 * nascosta); qualità "low" = niente riflessi veri né ombre, meno luci e particelle, dpr ≤ 1.5, modelli -low;
 * dpr che scende da solo se i fotogrammi sono lenti.
 */

export interface StudioWheelInput {
  segments: WheelSegment[];
  spin: WheelSpinCommand | null;
  restIndex: number | null;
  highlight: boolean;
}

export interface StudioSpeech {
  who: CharacterWho | null;
  speaking: boolean;
  /** apertura della bocca 0..1 di chi parla (analizzatore della voce) */
  mouthRef?: RefObject<number>;
}

export interface Studio3DProps {
  quality: "high" | "low";
  cue: StudioCue;
  wheel: StudioWheelInput;
  led: LedContent;
  speech: StudioSpeech;
  now: () => number;
  onTick?: () => void;
  onFail?: (reason: string) => void;
  /** inquadratura forzata (anteprime) */
  shot?: ShotId | null;
  /**
   * Copione al posto della regia della partita (l'intro di «Nuova partita»): dal tempo trascorso (ms, orologio `now`
   * meno `cue.since`) e da chi parla decide inquadratura, azione, segno e luci. Puro, chiamato a ogni fotogramma.
   */
  script?: StudioScript | null;
  /** luci di sala 0..1 (esposizione): l'intro le accende piano; senza, sempre accese */
  lights?: (() => number) | null;
  /** la scena è pronta (Don Patrizio caricato e disegnato): l'intro parte da qui */
  onReady?: () => void;
  className?: string;
}

export type StudioScript = (elapsedMs: number, speaking: boolean) => StudioDirection;

/** Esposizione normale dello studio (luci di sala piene). */
const EXPOSURE = 1.05;

// ------------------------------------------------------------------ regia (ogni fotogramma, prima di tutto)
interface Live {
  /** fase in corso e suo inizio effettivo */
  phase: { key: string; since: number } | null;
  dir: StudioDirection;
  mood: MoodRef;
  /** qualcosa si muove davvero: serve fluidità piena */
  busy: { cam: boolean; wheel: boolean; walk: boolean; zafira: boolean };
}

function Director({ cue, now, speaking, shot, script, liveRef, onChange }: { cue: StudioCue; now: () => number; speaking: boolean; shot: ShotId | null; script: StudioScript | null; liveRef: RefObject<Live>; onChange: (d: StudioDirection) => void }) {
  const last = useRef("");
  useFrame((_, dt) => {
    const L0 = liveRef.current;
    const t = now();
    const since = effectiveSince(cue, L0.phase, t);
    L0.phase = { key: cue.key, since };
    const d = script ? script(t - since, speaking) : directStudio(cue, t - since, speaking);
    if (shot) d.shot = shot;
    const L = liveRef.current;
    if (d.mood !== L.mood.mood) L.mood = { mood: d.mood, since: 0 };
    else L.mood.since += Math.min(0.1, dt);
    L.dir = d;
    const key = `${d.action}|${d.mark}|${d.zafira}`;
    if (key !== last.current) {
      last.current = key;
      onChange(d);
    }
  }, -2);
  return null;
}

// ------------------------------------------------------------------ camera (inquadrature smorzate, lens shift)
const CAM_KEYS = ["cx", "cy", "cz", "hx", "hy", "yaw", "pitch", "fov"] as const;
const WIN_KEYS = ["x0", "y0", "x1", "y1"] as const;

function CameraRig({ liveRef, reduced }: { liveRef: RefObject<Live>; reduced: boolean }) {
  const st = useRef({
    init: false,
    shot: "" as ShotId | "",
    p: { cx: 0, cy: 0, cz: 0, hx: 1, hy: 1, yaw: 0, pitch: 0, fov: 34 },
    /** bersaglio dell'inquadratura (riusato: nessuna allocazione per fotogramma) */
    goal: { cx: 0, cy: 0, cz: 0, hx: 1, hy: 1, yaw: 0, pitch: 0, fov: 34 },
    pos: [0, 0, 0] as [number, number, number],
    v: { cx: { v: 0 }, cy: { v: 0 }, cz: { v: 0 }, hx: { v: 0 }, hy: { v: 0 }, yaw: { v: 0 }, pitch: { v: 0 }, fov: { v: 0 } },
    /** finestra misurata e finestra usata (smorzata: quando l'HUD si allarga o si chiude la camera scivola) */
    target: FULL_WINDOW as FrameWindow,
    win: { ...FULL_WINDOW } as FrameWindow,
    wv: { x0: { v: 0 }, y0: { v: 0 }, x1: { v: 0 }, y1: { v: 0 } },
    measuredAt: -1,
  });
  useFrame((state, rawDt) => {
    const dt = Math.min(0.25, rawDt);
    const S = st.current;
    const d = liveRef.current.dir;
    const t = state.clock.elapsedTime;
    if (t - S.measuredAt > 0.12 || S.measuredAt < 0) {
      const first = S.measuredAt < 0;
      S.target = readStudioWindow(state.gl.domElement);
      S.measuredAt = t;
      if (first) S.win = { ...S.target };
    }
    let winMoving = false;
    for (const k of WIN_KEYS) {
      if (reduced) S.win[k] = S.target[k];
      else S.win[k] = smoothDamp(S.win[k], S.target[k], S.wv[k], 0.35, dt);
      if (Math.abs(S.wv[k].v) > 0.002) winMoving = true;
    }
    const { width, height } = state.size;
    const aspect = width / Math.max(1, height);
    const ratio = (aspect * (S.target.x1 - S.target.x0)) / Math.max(0.01, S.target.y1 - S.target.y0);
    const def = shotFor(d.shot, ratio);
    const orbit = def.orbit && !reduced ? def.orbit.amp * Math.sin((t * 2 * Math.PI) / def.orbit.period) : 0;
    const target = S.goal;
    target.cx = def.center[0];
    target.cy = def.center[1];
    target.cz = def.center[2];
    target.hx = def.half[0];
    target.hy = def.half[1];
    target.yaw = def.yaw + orbit;
    target.pitch = def.pitch;
    target.fov = def.fov;
    const changed = S.shot !== d.shot;
    S.shot = d.shot;
    const snap = !S.init || reduced || (changed && d.ease <= 0);
    let moving = false;
    for (const k of CAM_KEYS) {
      if (snap) {
        S.p[k] = target[k];
        S.v[k].v = 0;
      } else {
        S.p[k] = smoothDamp(S.p[k], target[k], S.v[k], Math.max(0.05, d.ease), dt);
        if (Math.abs(S.v[k].v) > 0.002) moving = true;
      }
    }
    S.init = true;
    liveRef.current.busy.cam = moving || winMoving;
    const camera = state.camera as PerspectiveCamera;
    const dist = fitDistance([S.p.hx, S.p.hy], S.p.fov, aspect, S.win);
    const pos = cameraPosition([S.p.cx, S.p.cy, S.p.cz], S.p.yaw, S.p.pitch, dist, S.pos);
    camera.fov = S.p.fov;
    camera.aspect = aspect;
    camera.near = 0.1;
    camera.far = 90;
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(S.p.cx, S.p.cy, S.p.cz);
    const sh = lensShift(S.win);
    // setViewOffset imposta anche aspect = fullWidth / fullHeight: misure "virtuali" con lo stesso rapporto del canvas
    camera.setViewOffset(aspect, 1, (-sh.x / 2) * aspect, sh.y / 2, aspect, 1);
  }, -1);
  return null;
}

// ------------------------------------------------------------------ Don Patrizio sul palco
const WALK_SPEED = 1.2;

/** Ombra morbida di contatto sotto i piedi (anche senza ombre vere): i personaggi poggiano sul pavimento. */
function contactShadowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.78)");
  g.addColorStop(0.45, "rgba(0,0,0,0.42)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export function ContactShadow({ radius = 0.42, opacity = 0.85 }: { radius?: number; opacity?: number }) {
  const tex = useMemo(() => contactShadowTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.008} renderOrder={1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function angleTo(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function Presenter({ quality, action, mark, speaking, mouthRef, enter, liveRef, onLoaded }: { quality: "high" | "low"; action: CharacterAction; mark: MarkId; speaking: boolean; mouthRef?: RefObject<number>; enter: boolean; liveRef: RefObject<Live>; onLoaded?: () => void }) {
  const root = useRef<Group>(null);
  const walk = useRef(0);
  const busy = useRef(false);
  const body = useRef<Group>(null);
  const st = useRef({ init: false, x: 0, z: 0, y: 0, yaw: 0, v: 0 });
  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const S = st.current;
    const target = MARKS[mark];
    if (!S.init) {
      const start = enter ? MARKS.offstage : target;
      S.x = start.x;
      S.z = start.z;
      S.yaw = start.yaw;
      S.y = groundAt(S.x, S.z);
      S.init = true;
    }
    const dx = target.x - S.x;
    const dz = target.z - S.z;
    const dist = Math.hypot(dx, dz);
    let desired = target.yaw;
    let moving = false;
    // velocità che sale e scende dolcemente (parte e si ferma senza scatti)
    const want = dist > 0.03 ? Math.min(WALK_SPEED, 0.35 + dist * 1.6) : 0;
    S.v += (want - S.v) * (1 - Math.exp(-dt * 5));
    if (dist > 0.03 && S.v > 0.01) {
      moving = true;
      const step = Math.min(dist, S.v * dt);
      S.x += (dx / dist) * step;
      S.z += (dz / dist) * step;
      desired = Math.atan2(dx, dz);
    } else if (dist <= 0.03) S.v = 0;
    // si gira prima verso dove va, poi verso il suo punto di vista sul palco
    S.yaw += angleTo(S.yaw, desired) * (1 - Math.exp(-dt * (moving ? 7 : 4.5)));
    walk.current = Math.min(1, S.v / (WALK_SPEED * 0.6));
    liveRef.current.busy.walk = moving;
    if (root.current) {
      // sale sulla pedana con un passo (niente scatto di quota)
      S.y += (groundAt(S.x, S.z) - S.y) * (1 - Math.exp(-dt * 9));
      root.current.position.set(S.x, S.y, S.z);
      root.current.rotation.y = S.yaw;
    }
  });
  const url = characterUrl("dontralla", quality);
  return (
    <group ref={root}>
      <ContactShadow radius={0.45} />
      <group ref={body}>
      <Suspense fallback={null}>
        <GiramenteCharacterModel
          who="dontralla"
          url={url}
          action={action}
          speaking={speaking}
          mouthRef={mouthRef}
          pointSide="right"
          externalWalk={walk}
          busyRef={busy}
          onReady={(m: Object3D) => {
            m.traverse((o) => {
              const mesh = o as Mesh;
              if (mesh.isMesh) {
                mesh.castShadow = quality === "high";
                mesh.receiveShadow = false;
              }
            });
            // statura vera: il modello viene portato a PRESENTER_HEIGHT, piedi sul pavimento (y = 0)
            const g = body.current;
            if (g) {
              g.scale.setScalar(1);
              g.position.y = 0;
              g.updateMatrixWorld(true);
              const box = new Box3().setFromObject(m);
              const h = box.max.y - box.min.y;
              if (h > 0.5 && h < 4) {
                const k = PRESENTER_HEIGHT / h;
                g.scale.setScalar(k);
                g.position.y = -box.min.y * k;
              }
              if (process.env.NODE_ENV !== "production") (window as unknown as { __gmPresenter?: unknown }).__gmPresenter = { rawHeight: h, scale: g.scale.x };
            }
            onLoaded?.();
          }}
        />
      </Suspense>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ Zafira dal portale (quando esce la Jolly)
function ZafiraStage({ show, quality, speaking, mouthRef, liveRef }: { show: boolean; quality: "high" | "low"; speaking: boolean; mouthRef?: RefObject<number>; liveRef: RefObject<Live> }) {
  const [mounted, setMounted] = useState(show);
  if (show && !mounted) setMounted(true);
  const busy = useRef(false);
  useEffect(() => {
    const L = liveRef.current;
    L.busy.zafira = mounted;
    return () => {
      L.busy.zafira = false;
    };
  }, [mounted, liveRef]);
  if (!mounted) return null;
  return (
    <group position={[PORTAL_SPOT.x, 0, PORTAL_SPOT.z]} rotation-y={PORTAL_SPOT.yaw}>
      <PortalRig play={show} quality={quality} speaking={speaking} mouthRef={mouthRef} busyRef={busy} onEntered={() => undefined} onExited={() => setMounted(false)} />
    </group>
  );
}

// ------------------------------------------------------------------ schermo LED
function useGameFont(): string {
  const [family, setFamily] = useState(`"Barlow Condensed", ${DEFAULT_WHEEL_FONT}`);
  useEffect(() => {
    const root = document.querySelector(".gm-root") ?? document.documentElement;
    const css = getComputedStyle(root);
    const v = css.getPropertyValue("--font-gm-display").trim() || css.getPropertyValue("--font-giramente").trim();
    if (!v) return;
    const t = setTimeout(() => setFamily(`${v}, "Barlow Condensed", ${DEFAULT_WHEEL_FONT}`), 0);
    return () => clearTimeout(t);
  }, []);
  return family;
}

function LedWall({ content, family }: { content: LedContent; family: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = LED_SIZE.w;
    c.height = LED_SIZE.h;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const key = JSON.stringify(content);
  const invalidate = useThree((s) => s.invalidate);
  const screen = useRef<MeshBasicMaterial>(null);
  useEffect(() => {
    let alive = true;
    const draw = () => {
      const map = screen.current?.map;
      if (!alive || !map) return;
      drawLed(map.image as HTMLCanvasElement, JSON.parse(key) as LedContent, family);
      map.needsUpdate = true;
      invalidate();
    };
    draw();
    // ridisegna quando i caratteri del gioco sono pronti (la prima volta potrebbe usare quelli di riserva)
    document.fonts?.ready.then(draw).catch(() => undefined);
    const late = setTimeout(draw, 1500);
    return () => {
      alive = false;
      clearTimeout(late);
    };
  }, [key, family, invalidate]);
  const spill = useRef<MeshBasicMaterial>(null);
  return (
    <group position={[0, LED_WALL.y, LED_WALL.z]}>
      <mesh>
        <planeGeometry args={[LED_WALL.width, LED_WALL.height]} />
        <meshBasicMaterial ref={screen} map={tex} toneMapped={false} color="#e6e6e6" />
      </mesh>
      {/* riverbero dello schermo sul pavimento davanti */}
      <mesh position={[0, -LED_WALL.y + 0.006, 1.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[LED_WALL.width * 0.9, 3.2]} />
        <meshBasicMaterial ref={spill} color="#2b6f3a" transparent opacity={0.16} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ ritmo dei fotogrammi
function Pace({ liveRef, quality, reduced }: { liveRef: RefObject<Live>; quality: "high" | "low"; reduced: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const setDpr = useThree((s) => s.setDpr);
  const setFrameloop = useThree((s) => s.setFrameloop);
  // durata media dei fotogrammi DISEGNATI (ms), misurata dove si disegna: serve al dpr adattivo
  const render = useRef({ last: 0, avg: 16.7 });
  useFrame(() => {
    const r = render.current;
    const t = performance.now();
    if (r.last > 0) r.avg += (Math.min(200, t - r.last) - r.avg) * 0.05;
    r.last = t;
  });
  useEffect(() => {
    let id = 0;
    let last = -Infinity;
    let mode: "always" | "demand" = "demand";
    // dpr che si adatta: se i fotogrammi restano lenti si abbassa la risoluzione, se tornano veloci si rialza
    const maxDpr = Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.75 : 1.5);
    const minDpr = quality === "high" ? 0.85 : 0.7;
    let dpr = maxDpr;
    let checkAt = performance.now() + 3000;
    const setMode = (m: "always" | "demand") => {
      if (m === mode) return;
      mode = m;
      setFrameloop(m);
    };
    const loop = (t: number) => {
      id = requestAnimationFrame(loop);
      if (document.hidden) {
        // scheda nascosta: nessun disegno
        setMode("demand");
        return;
      }
      const L = liveRef.current;
      const m = L.mood.mood;
      const lively = m === "spin" || m === "victory" || m === "jolly" || m === "colpo" || ((m === "correct" || m === "wrong") && L.mood.since < 2.5);
      const busy = L.busy.cam || L.busy.wheel || L.busy.walk || L.busy.zafira || lively;
      // "high": sempre a piena velocità (60 fps, animazioni fluide anche da fermi);
      // "low": piena velocità quando qualcosa si muove, 30 fps da fermo; movimento ridotto e nulla che si muove: 8 fps
      const full = !(reduced && !busy) && (quality === "high" || busy);
      if (full) setMode("always");
      else {
        setMode("demand");
        const interval = 1000 / (reduced && !busy ? 8 : 30);
        if (t - last >= interval - 3) {
          last = t;
          invalidate();
        }
      }
      if (t > checkAt) {
        checkAt = t + 2000;
        const avg = render.current.avg;
        if (full && avg > 1000 / 28 && dpr > minDpr) dpr = Math.max(minDpr, dpr - 0.15);
        else if (full && avg < 1000 / 55 && dpr < maxDpr) dpr = Math.min(maxDpr, dpr + 0.1);
        else return;
        setDpr(dpr);
      }
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      setFrameloop("demand");
    };
  }, [liveRef, quality, reduced, invalidate, setDpr, setFrameloop]);
  return null;
}

/** Contesto WebGL perso → si torna all'interfaccia 2D (la partita continua). */
/** Solo in sviluppo: conta i fotogrammi disegnati (window.__gmFrames) per misurare la fluidità nelle prove. */
function FrameCounter() {
  useFrame(() => {
    const w = window as unknown as { __gmFrames?: number };
    w.__gmFrames = (w.__gmFrames ?? 0) + 1;
  });
  return null;
}

/** Luci di sala (esposizione del renderer): l'intro le porta dal buio alla piena luce. */
function HouseLights({ lights }: { lights: () => number }) {
  useFrame((state) => {
    state.gl.toneMappingExposure = EXPOSURE * Math.max(0, Math.min(1, lights()));
  }, -1);
  return null;
}

/** «Pronta»: Don Patrizio caricato e tre fotogrammi disegnati (niente comparse a metà). */
function ReadySignal({ loaded, onReady }: { loaded: boolean; onReady?: () => void }) {
  const frames = useRef(0);
  const done = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (loaded) invalidate();
  }, [loaded, invalidate]);
  useFrame(() => {
    if (!loaded || done.current) return;
    frames.current += 1;
    if (frames.current < 3) {
      invalidate();
      return;
    }
    done.current = true;
    onReady?.();
  });
  return null;
}

function ContextGuard({ onFail }: { onFail?: (r: string) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = () => setTimeout(() => el.isConnected && onFail?.("contesto WebGL perso"), 150);
    el.addEventListener("webglcontextlost", lost, { once: true });
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl, onFail]);
  return null;
}

// ------------------------------------------------------------------ la scena
function Scene({ quality, cue, wheel, led, speech, now, onTick, onFail, shot, script, lights, onReady }: Studio3DProps) {
  const low = quality !== "high";
  const [reduced] = useState(prefersReducedMotion);
  const family = useGameFont();
  const speaking = speech.speaking;
  const [start] = useState(() => {
    const t = now();
    const since = effectiveSince(cue, null, t);
    return { phase: { key: cue.key, since }, dir: script ? script(t - since, speaking) : directStudio(cue, t - since, speaking), elapsed: t - since };
  });
  const [dir, setDir] = useState<StudioDirection>(start.dir);
  const liveRef = useRef<Live>({ phase: start.phase, dir: start.dir, mood: { mood: start.dir.mood, since: 0 }, busy: { cam: false, wheel: false, walk: false, zafira: false } });
  const moodRef = useMemo(() => ({ get current() { return liveRef.current.mood; } }) as RefObject<MoodRef>, []);
  // ingresso camminando solo all'inizio della partita (chi si ricollega dopo lo trova già al suo posto)
  const enter = start.phase.key.startsWith("INTRO|") && start.elapsed < WALK_IN_MS * 0.7;
  // bocca dalla voce vera (analizzatore) per chi parla; senza audio (solo sottotitolo) bocca simulata
  const mouthRef = speech.mouthRef;
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <color attach="background" args={["#040607"]} />
      <fog attach="fog" args={["#040607", 18, 60]} />
      <Director cue={cue} now={now} speaking={speaking && speech.who !== "zafira"} shot={shot ?? null} script={script ?? null} liveRef={liveRef} onChange={setDir} />
      {lights && <HouseLights lights={lights} />}
      <CameraRig liveRef={liveRef} reduced={reduced} />
      <RoomEnv intensity={low ? 0.28 : 0.35} />
      <StudioLighting moodRef={moodRef} quality={quality} />
      <StudioSet quality={quality} moodRef={moodRef} reduced={reduced} />
      <LedWall content={led} family={family} />
      {/* la ruota sul podio */}
      <group position={[WHEEL_X, PODIUM.height - FLOOR_Y * WHEEL_SCALE, 0]} scale={WHEEL_SCALE}>
        <WheelAssembly
          segments={wheel.segments}
          spin={wheel.spin}
          restIndex={wheel.restIndex}
          now={now}
          highlight={wheel.highlight}
          onTick={onTick}
          low={low}
          shadows={!low}
          center="brain"
          fontFamily={family}
          reduced={reduced}
          onState={(s) => {
            liveRef.current.busy.wheel = s.spinning;
          }}
        />
      </group>
      <Boundary3D
        onError={(r) => {
          console.warn(`[giramente] Don Patrizio 3D non caricato: ${r}`);
          setLoaded(true);
        }}
      >
        <Presenter quality={quality} action={dir.action} mark={dir.mark} speaking={speaking && speech.who !== "zafira"} mouthRef={mouthRef} enter={enter} liveRef={liveRef} onLoaded={() => setLoaded(true)} />
      </Boundary3D>
      {onReady && <ReadySignal loaded={loaded} onReady={onReady} />}
      <Boundary3D onError={(r) => console.warn(`[giramente] Zafira 3D non caricata: ${r}`)}>
        <Suspense fallback={null}>
          <ZafiraStage show={dir.zafira} quality={quality} speaking={speaking && speech.who === "zafira"} mouthRef={mouthRef} liveRef={liveRef} />
        </Suspense>
      </Boundary3D>
      <Pace liveRef={liveRef} quality={quality} reduced={reduced} />
      <ContextGuard onFail={onFail} />
      {process.env.NODE_ENV !== "production" && <FrameCounter />}
    </>
  );
}

export default function Studio3D(props: Studio3DProps) {
  const high = props.quality === "high";
  useEffect(() => {
    // i modelli che servono dopo (Zafira) si scaricano in anticipo, con calma
    const t = setTimeout(() => preloadStudio(props.quality, true), 2500);
    return () => clearTimeout(t);
  }, [props.quality]);
  return (
    <Boundary3D onError={(r) => props.onFail?.(`errore 3D: ${r}`)}>
      <Canvas
        className={props.className}
        frameloop="demand"
        shadows={high}
        dpr={high ? [1, 1.75] : [0.85, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: high ? "high-performance" : "default", stencil: false }}
        camera={{ position: [0, 3, 14], fov: 34, near: 0.1, far: 90 }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = EXPOSURE;
        }}
        style={{ pointerEvents: "none" }}
      >
        <Scene {...props} />
      </Canvas>
    </Boundary3D>
  );
}

/** Scarica in anticipo supporto e Don Patrizio (e Zafira con `all`): da chiamare in sala d'attesa. */
export function preloadStudio(quality: "high" | "low", all = false) {
  const low = quality !== "high";
  useGLTF.preload(low ? STAND_URL.replace(/\.glb$/, "-low.glb") : STAND_URL);
  useGLTF.preload(characterUrl("dontralla", quality));
  if (all) useGLTF.preload(characterUrl("zafira", quality));
}
