"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AnimationClip,
  AnimationMixer,
  LoopRepeat,
  Quaternion,
  Vector3,
  VectorKeyframeTrack,
  type AnimationAction,
  type Bone,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CHARACTER_INFO } from "./characters";
import { simulatedMouth } from "./mouth";
import type { CharacterAction, CharacterWho } from "./types";

/**
 * Controller dei personaggi GLB di GIRAMENTE! (DonTrallà, Zafira). Stessa tecnica di glb-host.tsx (CHE NE SAI?! /
 * PSYCO) ma con le azioni di GIRAMENTE!, in un modulo indipendente:
 *  - CLIP VERE del file: Idle_3 (riposo), Talk_Passionately e Talk_with_Hands_Open (parlata e «presentazione»),
 *    Walking (ingresso / uscita). Running non è usata. Le clip sono rese "sul posto" (le anche non derivano).
 *  - PROCEDURALE (dichiarato in ACTION_PLAN): saluto, indica, applauso, risata, sorpresa, delusione, pensiero,
 *    vittoria = rotazioni additive sulle ossa mixamo sopra la clip; ingresso/uscita = spostamento della radice.
 *  - VISO: morph jawOpen / mouthO / mouthE / blink / browsUp (presenti in entrambe le varianti A e B):
 *    pseudo-visemi dalla voce (mouthRef 0..1) o bocca simulata se parla senza audio, battito delle palpebre.
 * Origine ai piedi, unità in metri, guarda verso +Z.
 */

const FADE_TAU = 0.1;

type BoneKey = "hips" | "spine" | "chest" | "neck" | "head" | "lArm" | "lFore" | "lHand" | "rArm" | "rFore" | "rHand";
const BONE_NAMES: Record<BoneKey, string> = {
  hips: "mixamorigHips",
  spine: "mixamorigSpine",
  chest: "mixamorigSpine2",
  neck: "mixamorigNeck",
  head: "mixamorigHead",
  lArm: "mixamorigLeftArm",
  lFore: "mixamorigLeftForeArm",
  lHand: "mixamorigLeftHand",
  rArm: "mixamorigRightArm",
  rFore: "mixamorigRightForeArm",
  rHand: "mixamorigRightHand",
};
const BONE_KEYS = (Object.keys(BONE_NAMES) as BoneKey[]).filter((k) => k !== "hips");

type Vec3 = [number, number, number];
type Pose = Partial<Record<BoneKey, Vec3>>;
type PoseKind = "saluto" | "indicaL" | "indicaR" | "applauso" | "risata" | "sorpresa" | "delusione" | "pensiero" | "vittoria";

/**
 * Pose additive in spazio PERSONAGGIO (X verso la sinistra dello schermo è −X = destra del personaggio,
 * Y su, Z verso chi guarda), angoli [x, y, z] in radianti. Braccio destro in fuori/su = z negativa,
 * sinistro = z positiva; in avanti = x negativa. Busto: x negativa = indietro, positiva = in avanti.
 */
const POSES: Record<PoseKind, Pose> = {
  saluto: { rArm: [0, 0, -1.75], rFore: [0, 0, -1.39], head: [0, -0.08, 0.05] },
  // braccio destro verso la sinistra dello schermo (la ruota), busto e sguardo che seguono
  indicaL: { chest: [0, -0.16, 0], head: [0, -0.3, 0], rArm: [-0.35, 0, -1.3], rFore: [-0.05, 0, -0.08] },
  indicaR: { chest: [0, 0.16, 0], head: [0, 0.3, 0], lArm: [-0.35, 0, 1.3], lFore: [-0.05, 0, 0.08] },
  applauso: { chest: [0.04, 0, 0], rArm: [-0.62, 0, 0.42], lArm: [-0.62, 0, -0.42], rFore: [-0.62, 0, 0.42], lFore: [-0.62, 0, -0.42] },
  risata: { chest: [-0.12, 0, 0], head: [-0.22, 0, 0], rArm: [-0.45, 0, 0.42], lArm: [-0.45, 0, -0.42], rFore: [-0.75, 0, 0.35], lFore: [-0.75, 0, -0.35] },
  sorpresa: { chest: [-0.16, 0, 0], head: [-0.1, 0, 0], rArm: [-0.3, 0, -0.42], lArm: [-0.3, 0, 0.42], rFore: [-1.25, 0, -0.15], lFore: [-1.25, 0, 0.15] },
  delusione: { spine: [0.08, 0, 0], chest: [0.2, 0, 0], neck: [0.12, 0, 0], head: [0.3, 0, 0], rArm: [0, 0, 0.1], lArm: [0, 0, -0.1] },
  pensiero: { head: [0.1, 0.1, 0.17], rArm: [-0.6, 0, 0.4], rFore: [-1.7, 0, 0.3], rHand: [0.3, 0, 0], lArm: [-0.45, 0, -0.42], lFore: [-1.0, 0, -0.55] },
  vittoria: { chest: [-0.12, 0, 0], head: [-0.15, 0, 0], lArm: [0, 0, 2.5], rArm: [0, 0, -2.5], lFore: [0, 0, 0.3], rFore: [0, 0, -0.3] },
};
const POSE_KINDS = Object.keys(POSES) as PoseKind[];

function poseFor(action: CharacterAction, pointSide: "left" | "right"): PoseKind | null {
  switch (action) {
    case "saluto":
    case "applauso":
    case "risata":
    case "sorpresa":
    case "delusione":
    case "pensiero":
    case "vittoria":
      return action;
    case "indica":
      return pointSide === "left" ? "indicaL" : "indicaR";
    default:
      return null;
  }
}

// ------------------------------------------------------------------ preparazione clip (una volta per file)
interface Prepared {
  idle: AnimationClip | null;
  talk: AnimationClip[];
  walk: AnimationClip | null;
}
const prepCache = new WeakMap<object, Prepared>();

/** Clip "sul posto": le anche restano sulla X/Z di bind (con `keepSway` resta l'ondeggiamento, senza deriva). */
function inPlace(clip: AnimationClip, bindHips: Vector3, keepSway: boolean): AnimationClip {
  const c = clip.clone();
  for (const tr of c.tracks) {
    if (!(tr instanceof VectorKeyframeTrack) || !/Hips\.position$/.test(tr.name)) continue;
    const v = tr.values;
    const n = v.length / 3;
    const dur = Math.max(1e-6, tr.times[n - 1] - tr.times[0]);
    const dx = v[(n - 1) * 3] - v[0];
    const dz = v[(n - 1) * 3 + 2] - v[2];
    const x0 = v[0];
    const z0 = v[2];
    for (let i = 0; i < n; i++) {
      const k = (tr.times[i] - tr.times[0]) / dur;
      v[i * 3] = keepSway ? bindHips.x + (v[i * 3] - x0 - dx * k) : bindHips.x;
      v[i * 3 + 2] = keepSway ? bindHips.z + (v[i * 3 + 2] - z0 - dz * k) : bindHips.z;
    }
  }
  return c;
}

function prepare(scene: Object3D, animations: AnimationClip[]): Prepared {
  const hit = prepCache.get(scene);
  if (hit) return hit;
  const bindHips = new Vector3();
  scene.traverse((o) => {
    if ((o as Bone).isBone && /Hips$/.test(o.name)) bindHips.copy(o.position);
  });
  const find = (re: RegExp) => animations.find((a) => re.test(a.name)) ?? null;
  const idleRaw = find(/idle/i);
  const walkRaw = find(/walk/i);
  const talk = [find(/passionate/i), find(/hands_?open/i)].filter((c): c is AnimationClip => c !== null).map((c) => inPlace(c, bindHips, true));
  const p: Prepared = {
    idle: idleRaw ? inPlace(idleRaw, bindHips, true) : null,
    talk,
    walk: walkRaw ? inPlace(walkRaw, bindHips, false) : null,
  };
  prepCache.set(scene, p);
  return p;
}

// ------------------------------------------------------------------ utilità ossa e viso
const qA = new Quaternion();
const qB = new Quaternion();
const qC = new Quaternion();
const qD = new Quaternion();
const vX = new Vector3(1, 0, 0);
const vY = new Vector3(0, 1, 0);
const vZ = new Vector3(0, 0, 1);

/** Ruota un osso di (x, y, z) attorno agli assi del PERSONAGGIO (radice), come glb-host. */
function rotateInModelSpace(bone: Object3D, root: Object3D, x: number, y: number, z: number) {
  if (!bone.parent || (x === 0 && y === 0 && z === 0)) return;
  bone.parent.getWorldQuaternion(qA);
  root.getWorldQuaternion(qB);
  qC.copy(qB).invert().multiply(qA);
  qD.setFromAxisAngle(vX, x);
  if (y !== 0) qD.multiply(qB.setFromAxisAngle(vY, y));
  if (z !== 0) qD.multiply(qB.setFromAxisAngle(vZ, z));
  qB.copy(qC).invert().multiply(qD).multiply(qC);
  bone.quaternion.premultiply(qB);
}

const FACE_KEYS = ["jawOpen", "mouthO", "mouthE", "blink", "browsUp"] as const;
type FaceKey = (typeof FACE_KEYS)[number];

function setMorph(mesh: Mesh, name: FaceKey, value: number) {
  const i = mesh.morphTargetDictionary?.[name];
  const inf = mesh.morphTargetInfluences;
  if (i === undefined || !inf) return;
  inf[i] = value;
}

/** Vocale della sillaba n: A (mascella), O (labbra tonde), E (labbra tirate). */
function vowelOf(n: number): 0 | 1 | 2 {
  const h = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  const r = h - Math.floor(h);
  return r < 0.45 ? 0 : r < 0.72 ? 1 : 2;
}

// ------------------------------------------------------------------ ingresso / uscita (radice)
/** Durate (s) della camminata di ingresso/uscita e della rotazione verso il pubblico. */
export const WALK_IN_S = 1.9;
export const TURN_S = 0.45;
const WALK_DIST = 1.7;

export interface CharacterModelProps {
  who: CharacterWho;
  url: string;
  action: CharacterAction;
  speaking: boolean;
  mouthRef?: RefObject<number>;
  pointSide?: "left" | "right";
  /** da che parte entra/esce (lato dello schermo): predefinito sinistra */
  walkFrom?: "left" | "right";
  onReady?: (model: Object3D) => void;
  /** a fine ingresso (ferma davanti) e a fine uscita (fuori scena) */
  onWalkDone?: (kind: "ingresso" | "uscita") => void;
  /** viene chiamato a ogni fotogramma con true se c'è movimento che richiede 60 fps */
  busyRef?: RefObject<boolean>;
  /**
   * Camminata pilotata da fuori (0..1, peso della clip Walking): la scena sposta il personaggio
   * (portale della Jolly). Se presente, ingresso/uscita non muovono la radice.
   */
  externalWalk?: RefObject<number>;
}

export function GiramenteCharacterModel({ who, url, action, speaking, mouthRef, pointSide = "left", walkFrom = "left", onReady, onWalkDone, busyRef, externalWalk }: CharacterModelProps) {
  const info = CHARACTER_INFO[who];
  const gltf = useGLTF(url);
  const prep = useMemo(() => prepare(gltf.scene, gltf.animations), [gltf]);
  const model = useMemo(() => {
    const m = cloneSkinned(gltf.scene);
    m.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false; // le mesh skinnate escono dal box di bind
      mesh.morphTargetInfluences?.fill(0);
      const mat = mesh.material as MeshStandardMaterial;
      if (mat?.isMeshStandardMaterial) {
        mat.envMapIntensity = 0.35;
        mat.needsUpdate = true;
      }
    });
    return m;
  }, [gltf]);
  const bones = useMemo(() => {
    const map = new Map<BoneKey, Object3D>();
    model.traverse((o) => {
      if (!(o as Bone).isBone) return;
      for (const k of Object.keys(BONE_NAMES) as BoneKey[]) if (o.name === BONE_NAMES[k]) map.set(k, o);
    });
    return map;
  }, [model]);
  const faceMeshes = useMemo(() => {
    const list: Mesh[] = [];
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && "jawOpen" in mesh.morphTargetDictionary) list.push(mesh);
    });
    return list;
  }, [model]);
  const bind = useMemo(() => {
    const m = new Map<Object3D, Quaternion>();
    for (const b of bones.values()) m.set(b, b.quaternion.clone());
    return m;
  }, [bones]);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const idle = prep.idle ? mixer.clipAction(prep.idle) : null;
    const talk = prep.talk.map((c) => mixer.clipAction(c));
    const walk = prep.walk ? mixer.clipAction(prep.walk) : null;
    const all = [idle, ...talk, walk].filter((a): a is AnimationAction => a !== null);
    return { idle, talk, walk, all };
  }, [mixer, prep]);

  const cbs = useRef({ onReady, onWalkDone });
  useEffect(() => {
    cbs.current = { onReady, onWalkDone };
  });
  useEffect(() => {
    cbs.current.onReady?.(model);
  }, [model]);
  useEffect(() => {
    for (const a of actions.all) {
      a.setLoop(LoopRepeat, Infinity);
      a.setEffectiveWeight(a === actions.idle ? 1 : 0);
      a.play();
    }
    return () => {
      for (const a of actions.all) a.stop();
    };
  }, [actions]);

  const root = useRef<Group>(null);
  const st = useRef({
    t: 0,
    clipW: [] as number[],
    poseW: {} as Partial<Record<PoseKind, number>>,
    talking: false,
    talkIdx: 0,
    talkCount: 0,
    action: "idle" as CharacterAction,
    actionT: 0,
    walk: 0,
    walkDone: "" as "" | "ingresso" | "uscita",
    face: { jawOpen: 0, mouthO: 0, mouthE: 0, blink: 0, browsUp: 0 } as Record<FaceKey, number>,
    env: 0,
    low: 1,
    rising: false,
    syl: 0,
    vowel: 0 as 0 | 1 | 2,
    blinkIn: 2.2,
    blinkPh: -1,
  });

  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const s = st.current;
    s.t += dt;
    if (action !== s.action) {
      s.action = action;
      s.actionT = 0;
      s.walkDone = "";
    }
    s.actionT += dt;
    const at = s.actionT;

    // ---------------------------------------------------------- radice: ingresso / uscita
    const side = walkFrom === "left" ? -1 : 1; // lato dello schermo (−X = sinistra)
    let walkTarget = 0;
    let rootX = 0;
    let rootRotY = 0;
    let hidden = false;
    if (externalWalk) {
      walkTarget = Math.max(0, Math.min(1, externalWalk.current ?? 0));
    } else if (action === "ingresso") {
      const k = Math.min(1, at / WALK_IN_S);
      const e = 1 - (1 - k) * (1 - k) * 0.35 - 0.65 * (1 - k); // quasi lineare, rallenta un filo alla fine
      rootX = side * WALK_DIST * (1 - Math.min(1, e));
      const turn = Math.min(1, Math.max(0, (at - WALK_IN_S + 0.15) / TURN_S));
      const tt = turn * turn * (3 - 2 * turn);
      rootRotY = -side * (Math.PI / 2) * (1 - tt); // cammina verso il centro, poi si gira verso il pubblico
      walkTarget = at < WALK_IN_S ? 1 : 0;
      if (at >= WALK_IN_S + TURN_S && s.walkDone !== "ingresso") {
        s.walkDone = "ingresso";
        cbs.current.onWalkDone?.("ingresso");
      }
    } else if (action === "uscita") {
      const turn = Math.min(1, at / TURN_S);
      const tt = turn * turn * (3 - 2 * turn);
      rootRotY = side * (Math.PI / 2) * tt; // si gira verso il lato di uscita
      const k = Math.min(1, Math.max(0, (at - TURN_S * 0.6) / WALK_IN_S));
      rootX = side * WALK_DIST * k;
      walkTarget = at > TURN_S * 0.4 && k < 1 ? 1 : 0;
      if (k >= 1) {
        hidden = true;
        if (s.walkDone !== "uscita") {
          s.walkDone = "uscita";
          cbs.current.onWalkDone?.("uscita");
        }
      }
    }
    if (root.current && !externalWalk) {
      root.current.position.x = rootX;
      root.current.rotation.y = rootRotY;
      root.current.visible = !hidden;
    }
    s.walk += (walkTarget - s.walk) * (1 - Math.exp(-dt / FADE_TAU));

    // ---------------------------------------------------------- bocca: voce, simulata o espressione
    let mouthOpen = mouthRef ? Math.max(0, Math.min(1, mouthRef.current ?? 0)) : speaking ? simulatedMouth(s.t) : 0;
    if (action === "risata" && !speaking) mouthOpen = Math.max(mouthOpen, 0.35 + 0.5 * Math.max(0, Math.sin(at * 2 * Math.PI * 4.5)));
    const talking = speaking || action === "presentazione";

    // ---------------------------------------------------------- clip: camminata, parlata, riposo
    const nTalk = actions.talk.length;
    if (talking && !s.talking && nTalk > 0) {
      // «presentazione» = Talk_with_Hands_Open (mani aperte); la parlata alterna le due clip a ogni battuta
      s.talkIdx = action === "presentazione" ? Math.min(1, nTalk - 1) : s.talkCount % nTalk;
      s.talkCount++;
      const a = actions.talk[s.talkIdx];
      if (a.getEffectiveWeight() < 0.05) a.reset();
    }
    s.talking = talking;
    const k = 1 - Math.exp(-dt / FADE_TAU);
    let sum = 0;
    actions.all.forEach((a, i) => {
      let target = 0;
      if (a === actions.walk) target = s.walk;
      else if (a === actions.idle) target = (1 - s.walk) * (talking && nTalk > 0 ? 0 : 1);
      else target = (1 - s.walk) * (talking && actions.talk[s.talkIdx] === a ? 1 : 0);
      const prev = s.clipW[i] ?? (a === actions.idle ? 1 : 0);
      const w = prev + (target - prev) * k;
      s.clipW[i] = w;
      sum += w;
    });
    actions.all.forEach((a, i) => a.setEffectiveWeight(sum > 0 ? s.clipW[i] / sum : a === actions.idle ? 1 : 0));
    actions.idle?.setEffectiveTimeScale(info.idleRate);
    for (const a of actions.talk) a.setEffectiveTimeScale(info.talkRate);
    actions.walk?.setEffectiveTimeScale(s.walk < 0.01 ? 0 : 1.05);
    for (const [b, q] of bind) b.quaternion.copy(q);
    mixer.update(dt);

    // ---------------------------------------------------------- pose procedurali
    const want = poseFor(action, pointSide);
    const fast = action === "sorpresa" ? 14 : 7;
    for (const p of POSE_KINDS) {
      const target = p === want ? 1 : 0;
      const prev = s.poseW[p] ?? 0;
      s.poseW[p] = prev + (target - prev) * (1 - Math.exp(-dt * (target ? fast : 6)));
    }
    const still = 1 - s.walk;
    const t = s.t;
    const w = (p: PoseKind) => (s.poseW[p] ?? 0) * still;
    const clap = 0.5 + 0.5 * Math.sin(at * 2 * Math.PI * 3);
    const shake = Math.sin(at * 2 * Math.PI * 5.2);
    const pump = Math.sin(at * 2 * Math.PI * 2.1);
    const speech = mouthOpen * 0.05 * (faceMeshes.length ? 0.4 : 1) * still;
    let busy = s.walk > 0.01 || talking;
    for (const key of BONE_KEYS) {
      const bone = bones.get(key);
      if (!bone) continue;
      let x = 0;
      let y = 0;
      let z = 0;
      for (const p of POSE_KINDS) {
        const pw = w(p);
        const v = POSES[p][key];
        if (!v || pw < 0.001) continue;
        busy = true;
        x += v[0] * pw;
        y += v[1] * pw;
        z += v[2] * pw;
      }
      // parti dinamiche
      const ws = w("saluto");
      if (ws > 0.01) {
        if (key === "rFore") z += ws * Math.sin(t * 8) * 0.32;
        if (key === "rFore" || key === "rHand") y += ws * 0.8;
      }
      const wa = w("applauso");
      if (wa > 0.01) {
        if (key === "rArm") z += wa * (clap - 0.5) * 0.3;
        if (key === "lArm") z -= wa * (clap - 0.5) * 0.3;
        if (key === "chest") x += wa * 0.03 * clap;
      }
      const wr = w("risata");
      if (wr > 0.01) {
        if (key === "chest") x += wr * 0.05 * shake;
        if (key === "head") x += wr * 0.06 * shake;
        if (key === "rArm") z += wr * 0.04 * shake;
        if (key === "lArm") z -= wr * 0.04 * shake;
      }
      const wd = w("delusione");
      if (wd > 0.01 && key === "head") y += wd * 0.14 * Math.sin(at * 2 * Math.PI * 0.9);
      const wv = w("vittoria");
      if (wv > 0.01 && (key === "lArm" || key === "rArm")) x += wv * 0.2 * pump;
      const wp = w("pensiero");
      if (wp > 0.01 && key === "head") z += wp * 0.04 * Math.sin(at * 1.3);
      if (key === "neck") x += speech * 0.6;
      if (key === "head") x += speech;
      rotateInModelSpace(bone, model, x, y, z);
    }
    // saltello della vittoria (radice)
    if (root.current) root.current.position.y = w("vittoria") * 0.035 * Math.abs(pump);
    if (busyRef) busyRef.current = busy;

    // ---------------------------------------------------------- viso
    if (faceMeshes.length === 0) return;
    const f = s.face;
    s.env += (mouthOpen - s.env) * (1 - Math.exp(-dt * 22));
    if (s.env < s.low) s.low = s.env;
    if (!s.rising && s.env > s.low + 0.12) {
      s.rising = true;
      s.syl++;
      s.vowel = vowelOf(s.syl);
    } else if (s.rising && s.env < s.low + 0.05) {
      s.rising = false;
    }
    if (s.rising) s.low = Math.min(s.env, s.low + dt * 0.4);
    const m = s.env;
    const surprise = w("sorpresa");
    const laugh = w("risata");
    const target = {
      jawOpen: Math.max(m * (s.vowel === 0 || laugh > 0.5 ? 1 : 0.45), surprise * 0.5),
      mouthO: Math.max(s.vowel === 1 && laugh < 0.5 ? m * 0.95 : 0, surprise * 0.6),
      mouthE: Math.max(s.vowel === 2 ? m * 0.9 : 0, laugh * 0.5, w("vittoria") * 0.45),
    };
    const km = 1 - Math.exp(-dt * 18);
    f.jawOpen += (target.jawOpen - f.jawOpen) * km;
    f.mouthO += (target.mouthO - f.mouthO) * km;
    f.mouthE += (target.mouthE - f.mouthE) * km;
    const brows = Math.max(m > 0.75 ? 0.7 : 0, surprise, w("vittoria") * 0.6, laugh * 0.5, w("pensiero") * 0.35);
    f.browsUp += (brows - f.browsUp) * (1 - Math.exp(-dt * 6));
    s.blinkIn -= dt;
    if (s.blinkIn <= 0 && s.blinkPh < 0) {
      s.blinkPh = 0;
      s.blinkIn = 2 + Math.random() * 4;
    }
    if (s.blinkPh >= 0) {
      s.blinkPh += dt / 0.16;
      f.blink = Math.sin(Math.min(1, s.blinkPh) * Math.PI) * info.blinkMax;
      if (s.blinkPh >= 1) {
        s.blinkPh = -1;
        f.blink = 0;
      }
    }
    for (const mesh of faceMeshes) for (const key of FACE_KEYS) setMorph(mesh, key, Math.min(1, Math.max(0, f[key])));
  });

  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}

export function preloadCharacter(url: string) {
  useGLTF.preload(url);
}
