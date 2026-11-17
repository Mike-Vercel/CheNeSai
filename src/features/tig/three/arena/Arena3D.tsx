"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AdditiveBlending, type Group, type PerspectiveCamera } from "three";
import type { ArenaHost, ArenaProps, ArenaTeam, MascotProps } from "../../arena-contract";
import { HostCharacter } from "../characters/HostCharacter";
import { RoomEnvironmentLight } from "../characters/room-env";
import { MascotSwarm, type MascotEntry } from "../mascot/MascotSwarm";
import { readTigFont, TIG } from "../palette";
import { prefersReducedMotion } from "../quality";
import { ArenaLighting, ArenaSet, PODIUM_SPOTS, PODIUM_Z, type LedStatic } from "./ArenaSet";
import { cameraPosition, fitDistance, FULL_WINDOW, lensShift, normalizeSafeArea, smoothDamp, type FrameWindow, type Vec3 } from "./camera-math";
import { awardsRevealed, directArena, mascotActionFor, spotlightLive, type ArenaDirection } from "./director";
import { BASE_H, type ArenaLive } from "./live";
import { hostMarks, podLayout, POD, STAGE } from "./layout";
import { Pods } from "./Pods";
import { RankAnimator, rankOrder, tableOrder } from "./rank-anim";
import { shotSubject } from "./shots";
import { SpotFx } from "./SpotFx";
import { readArenaDebug, type ArenaDebug } from "./debug";
import { shadowTexture } from "./textures";

/**
 * L'ARENA 3D di TAVOLI IN GUERRA!: UNA scena persistente per pagina (TV, telefono/PC sotto l'HUD, menu), mai
 * ricaricata tra le fasi. Regia per fase (director.ts), camera smorzata che inquadra nella finestra libera dall'HUD
 * (safeArea → view offset), set + torri + mascotte istanziate + presentatori GLB.
 *
 * Prestazioni («super fluido»): disegno a richiesta; 60 fps quando qualcosa si muove davvero (camera, punteggi,
 * azioni, allarme, chi parla), 30 fps (high) o 24 (low) quando la scena "respira" e basta; fermo a scheda nascosta;
 * dpr adattivo; parti ripetute istanziate; nessuna allocazione per fotogramma nei cicli caldi. "low": niente
 * riflesso vero né ombre, meno luci, fari e particelle, modelli -low, dpr ≤ 1,5. Movimento ridotto: camera ferma,
 * luci ferme, disegno solo quando cambia qualcosa.
 */

export type Arena3DProps = Omit<ArenaProps, "quality"> & { quality: "high" | "low"; onFail?: (reason: string) => void };

class Boundary extends Component<{ onError: (r: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    this.props.onError(e instanceof Error ? e.message : String(e));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const hostKey = (hosts: ArenaHost[]) => hosts.map((h) => h.who).join(",");

// ------------------------------------------------------------------ regia (ogni fotogramma, prima di tutto)
function Director({ liveRef, propsRef, reduced, onDir }: { liveRef: RefObject<ArenaLive>; propsRef: RefObject<Arena3DProps>; reduced: boolean; onDir: (d: ArenaDirection) => void }) {
  const last = useRef("");
  const first = useRef(true);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const L = liveRef.current;
    const P = propsRef.current;
    const now = P.now();
    if (P.phase !== L.phaseKey) {
      L.phaseKey = P.phase;
      L.phaseSince = now;
    }
    const sk = P.spotlight?.eventId ?? "";
    if (sk !== L.spotKey) {
      L.spotKey = sk;
      L.spotSince = now;
    }
    L.spotlight = P.spotlight;
    L.elapsedMs = Math.max(0, now - L.phaseSince);
    L.spotAgeMs = Math.max(0, now - L.spotSince);
    L.t += reduced ? 0 : dt;
    const d = directArena({ phase: P.phase, elapsedMs: L.elapsedMs, spotlight: P.spotlight, spotAgeMs: L.spotAgeMs, speaking: false, hostCount: P.hosts.length });
    if (d.mood !== L.mood.mood) L.mood = { mood: d.mood, since: 0 };
    else L.mood.since += dt;
    L.dir = d;
    L.busy.scores = L.ranks.step(L.teams, dt, first.current || reduced);
    first.current = false;
    const shown = awardsRevealed(L.elapsedMs);
    const spotOn0 = spotlightLive(P.phase, P.spotlight, L.spotAgeMs);
    for (let i = 0; i < L.teams.length; i++) {
      const t = L.teams[i];
      const a = L.ranks.get(t.teamId);
      const place = d.mood === "awards" ? L.podiumIds.indexOf(t.teamId) + 1 : 0;
      L.mascotActions[i] = mascotActionFor({ team: t, phase: P.phase, elapsedMs: L.elapsedMs, spotlight: P.spotlight, spotAgeMs: L.spotAgeMs, delta: a?.delta ?? 0, deltaAge: a?.deltaAge ?? 99, podiumRank: place > 0 ? place : null });
      const inSpot = !!P.spotlight && P.spotlight.teamIds.includes(t.teamId);
      L.mascotShield[i] = inSpot && P.spotlight?.kind === "shield" && L.spotAgeMs < 3600;
      L.mascotDim[i] = d.mood === "awards" && shown > 0 && place === 0 ? 0.3 : (d.mood === "duel" || d.mood === "chaos") && spotOn0 && !inSpot ? 0.5 : 1;
    }
    L.mascotActions.length = L.mascotDim.length = L.mascotShield.length = L.teams.length;
    // podio della premiazione: sale nei primi 1,2 s
    const podiumOn = P.phase === "awards" ? 1 : 0;
    L.podium += (podiumOn - L.podium) * (1 - Math.exp(-dt * (podiumOn ? 2.5 : 5)));
    if (reduced) L.podium = podiumOn;
    // le azioni delle mascotte dipendono da spotlight, premiazione e cambi di punti recenti: si ricalcolano a scatti
    const spotOn = spotlightLive(P.phase, P.spotlight, L.spotAgeMs);
    let fresh = 0;
    for (const tm of L.teams) {
      const a = L.ranks.get(tm.teamId);
      if (a && a.deltaAge < 2.2) fresh++;
    }
    const key = `${d.hostAction}|${d.mood}|${d.led}|${d.shot.kind}|${shown}|${spotOn}|${fresh}`;
    if (key !== last.current) {
      last.current = key;
      onDir(d);
    }
  }, -3);
  return null;
}

// ------------------------------------------------------------------ camera
const KEYS = ["cx", "cy", "cz", "yaw", "pitch", "fov", "dist"] as const;
const WIN_KEYS = ["x0", "y0", "x1", "y1"] as const;

function CameraRig({ liveRef, propsRef, reduced }: { liveRef: RefObject<ArenaLive>; propsRef: RefObject<Arena3DProps>; reduced: boolean }) {
  const st = useRef({
    init: false,
    p: { cx: 0, cy: 2, cz: 0, yaw: 0, pitch: 14, fov: 38, dist: 20 },
    g: { cx: 0, cy: 2, cz: 0, yaw: 0, pitch: 14, fov: 38, dist: 20 },
    v: { cx: { v: 0 }, cy: { v: 0 }, cz: { v: 0 }, yaw: { v: 0 }, pitch: { v: 0 }, fov: { v: 0 }, dist: { v: 0 } },
    win: { ...FULL_WINDOW } as FrameWindow,
    wv: { x0: { v: 0 }, y0: { v: 0 }, x1: { v: 0 }, y1: { v: 0 } },
    shotKey: "",
    measuredAt: -1,
    pos: [0, 0, 0] as [number, number, number],
  });
  useFrame((state, rawDt) => {
    const dt = Math.min(0.25, rawDt);
    const S = st.current;
    const L = liveRef.current;
    const d = L.dir.shot;
    const target = normalizeSafeArea(propsRef.current.safeArea);
    for (const k of WIN_KEYS) S.win[k] = reduced || !S.init ? target[k] : smoothDamp(S.win[k], target[k], S.wv[k], 0.4, dt);
    const { width, height } = state.size;
    const aspect = width / Math.max(1, height);
    const winRatio = (aspect * (S.win.x1 - S.win.x0)) / Math.max(0.05, S.win.y1 - S.win.y0);
    const compact = winRatio < 1.15;
    // soggetto: ricalcolato al cambio di inquadratura e 5 volte al secondo (le colonne crescono piano)
    const key = `${d.kind}|${d.teamIds.join(",")}|${compact}`;
    const t = state.clock.elapsedTime;
    const changed = key !== S.shotKey;
    if (changed || t - S.measuredAt > 0.2) {
      S.measuredAt = t;
      const L2 = liveRef.current;
      const subj = shotSubject(d, {
        layout: L2.layout,
        podTop: (i) => BASE_H + (L2.ranks.get(L2.teams[i]?.teamId ?? "")?.height ?? POD.minHeight),
        teamIndex: (id) => L2.teams.findIndex((tm) => tm.teamId === id),
        hostCount: propsRef.current.hosts.length,
        compact,
      });
      S.g.cx = subj.center[0];
      S.g.cy = subj.center[1];
      S.g.cz = subj.center[2];
      S.g.yaw = d.yaw + subj.yawBias;
      S.g.pitch = d.pitch + subj.pitchBias;
      S.g.fov = d.fov + (compact ? 4 : 0);
      S.g.dist = fitDistance(subj.points as Vec3[], subj.center, S.g.yaw, S.g.pitch, S.g.fov, aspect, S.win, compact ? 1.04 : 1.07);
    }
    const snap = !S.init || reduced || (changed && d.ease <= 0);
    S.shotKey = key;
    let moving = false;
    for (const k of KEYS) {
      if (snap) {
        S.p[k] = S.g[k];
        S.v[k].v = 0;
      } else {
        // la distanza si adatta un po' più lenta (niente "respiro" della camera quando cambiano le colonne)
        S.p[k] = smoothDamp(S.p[k], S.g[k], S.v[k], Math.max(0.08, d.ease) * (k === "dist" ? 1.15 : 1), dt);
        if (Math.abs(S.v[k].v) > (k === "dist" ? 0.01 : 0.004)) moving = true;
      }
    }
    S.init = true;
    L.busy.cam = moving;
    const orbit = d.orbit && !reduced ? d.orbit.amp * Math.sin((L.t * 2 * Math.PI) / d.orbit.period) : 0;
    const shake = !reduced && d.shake > 0 ? d.shake : 0;
    const camera = state.camera as PerspectiveCamera;
    const pos = cameraPosition([S.p.cx, S.p.cy, S.p.cz], S.p.yaw + orbit, S.p.pitch, S.p.dist, S.pos);
    const sx = shake ? (Math.sin(L.t * 37) * 0.6 + Math.sin(L.t * 23) * 0.4) * 0.05 * shake : 0;
    const sy = shake ? (Math.sin(L.t * 41) * 0.5 + Math.sin(L.t * 17) * 0.5) * 0.04 * shake : 0;
    camera.fov = S.p.fov;
    camera.aspect = aspect;
    camera.near = 0.2;
    camera.far = 140;
    camera.position.set(pos[0] + sx, pos[1] + sy, pos[2]);
    camera.lookAt(S.p.cx + sx * 0.5, S.p.cy + sy * 0.5, S.p.cz);
    const sh = lensShift(S.win);
    camera.setViewOffset(aspect, 1, (-sh.x / 2) * aspect, sh.y / 2, aspect, 1);
  }, -2);
  return null;
}

// ------------------------------------------------------------------ presentatori
function ContactShadow({ radius = 0.45 }: { radius?: number }) {
  const tex = useMemo(() => shadowTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.01} renderOrder={1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

const WALK_SPEED = 1.1;

function angleTo(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Un presentatore sul palco: va al suo segno camminando (clip Walking) e poi si gira verso il pubblico. */
function HostSlot({ host, index, total, quality, action, liveRef, busy, onLoaded, reduced }: { host: ArenaHost; index: number; total: number; quality: "high" | "low"; action: ArenaDirection["hostAction"]; liveRef: RefObject<ArenaLive>; busy: { current: boolean }; onLoaded: () => void; reduced: boolean }) {
  const root = useRef<Group>(null);
  const walk = useRef(0);
  const st = useRef({ init: false, x: 0, z: 0, yaw: 0, v: 0 });
  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const S = st.current;
    const aside = liveRef.current.mood.mood === "awards";
    const m = hostMarks(total, aside)[index];
    if (!m) return;
    if (!S.init || reduced) {
      S.x = m.x;
      S.z = m.z;
      S.yaw = m.yaw;
      S.init = true;
    }
    const dx = m.x - S.x;
    const dz = m.z - S.z;
    const dist = Math.hypot(dx, dz);
    const want = dist > 0.02 ? Math.min(WALK_SPEED, 0.3 + dist * 1.8) : 0;
    S.v += (want - S.v) * (1 - Math.exp(-dt * 5));
    let desired = m.yaw;
    if (dist > 0.02 && S.v > 0.01) {
      const step = Math.min(dist, S.v * dt);
      S.x += (dx / dist) * step;
      S.z += (dz / dist) * step;
      desired = Math.atan2(dx, dz);
    } else if (dist <= 0.02) S.v = 0;
    S.yaw += angleTo(S.yaw, desired) * (1 - Math.exp(-dt * (S.v > 0.05 ? 7 : 4.5)));
    walk.current = Math.min(1, S.v / (WALK_SPEED * 0.6));
    if (root.current) {
      root.current.position.set(S.x, STAGE.height, S.z);
      root.current.rotation.y = S.yaw;
    }
  });
  return (
    <group ref={root}>
      <ContactShadow />
      <Boundary
        onError={(r) => {
          console.warn(`[tig] ${host.who} 3D non caricato: ${r}`);
          onLoaded();
        }}
      >
        <Suspense fallback={null}>
          <HostCharacter who={host.who} quality={quality} action={action} speaking={host.speaking} mouthRef={host.mouthRef} busyRef={busy} walkRef={walk} phase={index} onReady={onLoaded} />
        </Suspense>
      </Boundary>
    </group>
  );
}

function Hosts({ hosts, quality, dir, liveRef, onLoaded, reduced }: { hosts: ArenaHost[]; quality: "high" | "low"; dir: ArenaDirection; liveRef: RefObject<ArenaLive>; onLoaded: () => void; reduced: boolean }) {
  const count = hosts.length;
  const busyRefs = useMemo(() => Array.from({ length: count }, () => ({ current: false })), [count]);
  useFrame(() => {
    let b = false;
    for (const r of busyRefs) if (r.current) b = true;
    liveRef.current.busy.hosts = b;
  });
  const list = hosts.slice(0, 4);
  return (
    <group>
      {list.map((h, i) => (
        <HostSlot
          key={`${h.who}-${i}`}
          host={h}
          index={i}
          total={list.length}
          quality={quality}
          action={h.speaking ? "talk" : dir.hostAction === "talk" ? "idle" : dir.hostAction}
          liveRef={liveRef}
          busy={busyRefs[i] ?? { current: false }}
          onLoaded={onLoaded}
          reduced={reduced}
        />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ ritmo dei fotogrammi
function Pace({ liveRef, quality, reduced, propsRef, onDegrade }: { liveRef: RefObject<ArenaLive>; quality: "high" | "low"; reduced: boolean; propsRef: RefObject<Arena3DProps>; onDegrade?: () => void }) {
  const degradeRef = useRef(onDegrade);
  useEffect(() => {
    degradeRef.current = onDegrade;
  });
  const invalidate = useThree((s) => s.invalidate);
  const setDpr = useThree((s) => s.setDpr);
  const setFrameloop = useThree((s) => s.setFrameloop);
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
    const maxDpr = Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.75 : 1.5);
    const minDpr = quality === "high" ? 0.9 : 0.65;
    let dpr = maxDpr;
    let checkAt = performance.now() + 3000;
    let slow = 0;
    const setMode = (m: "always" | "demand") => {
      if (m === mode) return;
      mode = m;
      setFrameloop(m);
    };
    const loop = (t: number) => {
      id = requestAnimationFrame(loop);
      if (document.hidden) {
        setMode("demand");
        return;
      }
      const L = liveRef.current;
      const m = L.mood.mood;
      const lively = m === "chaos" || m === "evolve" || m === "awards" || m === "duel" || ((m === "intro" || m === "manche" || m === "reveal") && L.mood.since < 6);
      const speaking = propsRef.current.hosts.some((h) => h.speaking);
      const busy = L.busy.cam || L.busy.scores || L.busy.hosts || L.busy.mascots || L.busy.fx || L.busy.led || lively || speaking;
      if (reduced) {
        // movimento ridotto: si disegna solo se qualcosa cambia davvero
        setMode("demand");
        if (busy && t - last >= 1000 / 30 - 3) {
          last = t;
          invalidate();
        } else if (t - last >= 1000) {
          last = t;
          invalidate();
        }
        return;
      }
      if (busy) setMode("always");
      else {
        setMode("demand");
        const interval = 1000 / (quality === "high" ? 30 : 24);
        if (t - last >= interval - 3) {
          last = t;
          invalidate();
        }
      }
      if (t > checkAt) {
        checkAt = t + 2000;
        const avg = render.current.avg;
        const full = mode === "always";
        // già al dpr minimo e ancora lento per 2 controlli di fila: si spegne il riflesso vero del pavimento (una volta)
        if (full && avg > 1000 / 42 && dpr <= minDpr + 0.01) {
          slow += 1;
          if (slow >= 2 && degradeRef.current) {
            degradeRef.current();
            degradeRef.current = undefined;
          }
        } else slow = 0;
        if (full && avg > 1000 / 40 && dpr > minDpr) dpr = Math.max(minDpr, dpr - 0.15);
        else if (full && avg < 1000 / 57 && dpr < maxDpr) dpr = Math.min(maxDpr, dpr + 0.1);
        else return;
        setDpr(dpr);
      }
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      setFrameloop("demand");
    };
  }, [liveRef, quality, reduced, invalidate, setDpr, setFrameloop, propsRef]);
  return null;
}

function FrameCounter() {
  useFrame(() => {
    const w = window as unknown as { __tigFrames?: number };
    w.__tigFrames = (w.__tigFrames ?? 0) + 1;
  });
  return null;
}

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

/** Bagliore del palco (fa da "bloom" sotto i presentatori, gratis). */
function StageGlow({ liveRef }: { liveRef: RefObject<ArenaLive> }) {
  const g = useRef<Group>(null);
  useFrame(() => {
    const m = liveRef.current.mood.mood;
    if (g.current) g.current.visible = m !== "duel" && m !== "chaos";
  });
  return (
    <group ref={g} position={[0, STAGE.height + 0.01, 0.5]}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2.2, 48]} />
        <meshBasicMaterial color={TIG.amber} transparent opacity={0.06} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ la scena
function Scene(props: Arena3DProps & { reduced: boolean; family: string; debug: ArenaDebug }) {
  const { quality, reduced, family, debug } = props;
  // riflesso vero del pavimento (solo high): si spegne da solo se il dispositivo non regge
  const [reflect, setReflect] = useState(true);
  const setDebug = useMemo(() => ({ ...debug, noReflect: debug.noReflect || !reflect }), [debug, reflect]);
  const high = quality === "high";
  const teams = useMemo(() => tableOrder(props.teams), [props.teams]);
  const layout = useMemo(() => podLayout(teams.length), [teams.length]);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  const [initial] = useState(() => directArena({ phase: props.phase, elapsedMs: 0, spotlight: props.spotlight, spotAgeMs: 0, speaking: false, hostCount: props.hosts.length }));
  const [dir, setDir] = useState<ArenaDirection>(initial);
  // stato vivo letto e scritto dai fotogrammi (mai dal render): creato una volta, poi tenuto in un ref
  const [created] = useState<ArenaLive>(() => ({
    phaseKey: "",
    phaseSince: 0,
    spotKey: "",
    spotSince: 0,
    elapsedMs: 0,
    spotAgeMs: 0,
    dir: initial,
    mood: { mood: initial.mood, since: 0 },
    t: 0,
    ranks: new RankAnimator(),
    layout,
    teams,
    spotlight: props.spotlight,
    anchors: new Float32Array(Math.max(1, teams.length) * 5),
    busy: { cam: false, scores: false, hosts: false, mascots: false, fx: false, led: false },
    podium: 0,
    podiumIds: [],
    mascotActions: [],
    mascotDim: [],
    mascotShield: [],
  }));
  const liveRef = useRef<ArenaLive>(created);
  // squadre, pianta e spazio per gli ancoraggi: aggiornati prima del fotogramma successivo
  const order = useMemo(() => rankOrder(teams), [teams]);
  useEffect(() => {
    const L = liveRef.current;
    L.teams = teams;
    L.layout = layout;
    if (L.anchors.length < teams.length * 5) L.anchors = new Float32Array(teams.length * 5);
    L.podiumIds = order.slice(0, 3).map((t) => t.teamId);
  }, [teams, layout, order]);

  const anchorsRef = useMemo(() => ({ get current() { return liveRef.current.anchors; } }) as RefObject<Float32Array>, []);
  const actionsRef = useMemo(() => ({ get current() { return liveRef.current.mascotActions; } }) as RefObject<MascotProps["action"][]>, []);
  const dimRef = useMemo(() => ({ get current() { return liveRef.current.mascotDim; } }) as RefObject<number[]>, []);
  const shieldRef = useMemo(() => ({ get current() { return liveRef.current.mascotShield; } }) as RefObject<boolean[]>, []);
  const mascotBusy = useRef(false);
  useFrame(() => {
    liveRef.current.busy.mascots = mascotBusy.current;
  });

  // dati fissi delle mascotte (le azioni le calcola la regia a ogni fotogramma)
  const entries: MascotEntry[] = useMemo(() => teams.map((t) => ({ key: t.teamId, slot: t.mascotSlot, level: t.mascotLevel, color: t.color, online: t.online, action: "idle" as const })), [teams]);

  const [hostsLoaded, setHostsLoaded] = useState(props.hosts.length === 0);
  const loadedCount = useRef(0);
  useEffect(() => {
    // al massimo 8 s di attesa dei modelli: poi l'arena è comunque "pronta"
    const t = setTimeout(() => setHostsLoaded(true), 8000);
    return () => clearTimeout(t);
  }, []);
  // finestra stretta (telefono in verticale, arena nella parte alta): targhette compatte
  const size = useThree((s) => s.size);
  const win = normalizeSafeArea(props.safeArea);
  const compact = (size.width * (win.x1 - win.x0)) / Math.max(1, size.height * (win.y1 - win.y0)) < 1.15;
  const ledStatic: LedStatic = useMemo(() => ({ title: props.title, subtitle: props.subtitle ?? null, mancheNo: props.mancheNo }), [props.title, props.subtitle, props.mancheNo]);

  return (
    <>
      <color attach="background" args={["#020306"]} />
      <fog attach="fog" args={["#020306", 22, 70]} />
      <Director liveRef={liveRef} propsRef={propsRef} reduced={reduced} onDir={setDir} />
      <CameraRig liveRef={liveRef} propsRef={propsRef} reduced={reduced} />
      <RoomEnvironmentLight intensity={high ? 0.32 : 0.26} />
      <ArenaLighting liveRef={liveRef} high={high} />
      <ArenaSet liveRef={liveRef} ledStatic={ledStatic} family={family} quality={quality} reduced={reduced} radius={layout.radius} debug={setDebug} />
      <StageGlow liveRef={liveRef} />
      <Pods liveRef={liveRef} teams={teams} layout={layout} family={family} low={!high} shadows={high} compact={compact} />
      <PodiumMascots liveRef={liveRef} teams={teams} order={order} />
      <MascotSwarm entries={entries} anchorsRef={anchorsRef} actionsRef={actionsRef} dimRef={dimRef} shieldRef={shieldRef} low={!high} reduced={reduced} family={family} busyRef={mascotBusy} />
      <SpotFx liveRef={liveRef} low={!high} />
      <Hosts
        key={hostKey(props.hosts)}
        hosts={props.hosts}
        quality={quality}
        dir={dir}
        liveRef={liveRef}
        reduced={reduced}
        onLoaded={() => {
          loadedCount.current += 1;
          if (loadedCount.current >= props.hosts.length) setHostsLoaded(true);
        }}
      />
      {props.onReady && <ReadySignal loaded={hostsLoaded} onReady={props.onReady} />}
      <Pace liveRef={liveRef} quality={quality} reduced={reduced} propsRef={propsRef} onDegrade={reflect ? () => setReflect(false) : undefined} />
      <ContextGuard onFail={props.onFail} />
      {process.env.NODE_ENV !== "production" && <FrameCounter />}
    </>
  );
}

/**
 * Premiazione: le mascotte dei primi tre volano dalla loro torre al podio (dal 3° al 1°). Sovrascrive gli
 * ancoraggi scritti dalle torri (gira dopo di loro nello stesso fotogramma).
 */
function PodiumMascots({ liveRef, teams, order }: { liveRef: RefObject<ArenaLive>; teams: ArenaTeam[]; order: ArenaTeam[] }) {
  const prog = useRef(new Map<string, number>());
  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const L = liveRef.current;
    const shown = L.mood.mood === "awards" ? awardsRevealed(L.elapsedMs) : 0;
    for (let place = 1; place <= 3; place++) {
      const t = order[place - 1];
      if (!t) continue;
      const i = teams.findIndex((x) => x.teamId === t.teamId);
      if (i < 0) continue;
      const on = shown >= 4 - place && L.podium > 0.5 ? 1 : 0;
      const k0 = prog.current.get(t.teamId) ?? 0;
      const k = k0 + (on - k0) * (1 - Math.exp(-dt * 2.2));
      prog.current.set(t.teamId, k);
      if (k < 0.002) continue;
      const spot = PODIUM_SPOTS.find((s) => s.place === place)!;
      const a = i * 5;
      const x0 = L.anchors[a];
      const y0 = L.anchors[a + 1];
      const z0 = L.anchors[a + 2];
      const x1 = spot.x;
      const y1 = STAGE.height + spot.h * L.podium;
      const z1 = PODIUM_Z;
      const e = k * k * (3 - 2 * k);
      L.anchors[a] = x0 + (x1 - x0) * e;
      L.anchors[a + 2] = z0 + (z1 - z0) * e;
      L.anchors[a + 1] = y0 + (y1 - y0) * e + Math.sin(Math.PI * e) * 2.2;
      L.anchors[a + 3] = L.anchors[a + 3] * (1 - e);
      L.anchors[a + 4] = POD.mascotHeight * (1 + e * (place === 1 ? 0.5 : 0.3));
    }
  }, -0.5);
  return null;
}

export default function Arena3D(props: Arena3DProps) {
  const high = props.quality === "high";
  const [reduced] = useState(prefersReducedMotion);
  const [debug] = useState(readArenaDebug);
  const [family, setFamily] = useState(readTigFont);
  useEffect(() => {
    const f = () => setFamily(readTigFont());
    document.fonts?.ready.then(f).catch(() => undefined);
  }, []);
  return (
    <Boundary onError={(r) => props.onFail?.(`errore 3D: ${r}`)}>
      <Canvas
        className={props.className}
        frameloop="demand"
        shadows={false}
        dpr={high ? [1, 1.75] : [0.75, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: high ? "high-performance" : "default", stencil: false }}
        camera={{ position: [0, 6, 24], fov: 38, near: 0.2, far: 140 }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.05;
        }}
        style={{ pointerEvents: "none" }}
      >
        <Scene {...props} reduced={reduced} family={family} debug={debug} />
      </Canvas>
    </Boundary>
  );
}
