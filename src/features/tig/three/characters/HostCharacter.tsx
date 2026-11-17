"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Color,
  LoopRepeat,
  Matrix4,
  Plane,
  Quaternion,
  Vector3,
  VectorKeyframeTrack,
  type AnimationAction,
  type Bone,
  type Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { HostId, VisualQuality } from "../../arena-contract";
import type { HostAction } from "../arena/director";
import { BUMBARINO, HOST_MODELS, bumbarinoUrl, hostModelUrl } from "./host-models";

/**
 * Controller dei PERSONAGGI ESISTENTI nell'arena (GLB Mixamo). Stessa tecnica dei personaggi di GIRAMENTE!
 * (character-model.tsx), in un modulo di TAVOLI IN GUERRA!:
 *  - CLIP VERE del file: Idle_3 (riposo), Talk_Passionately e Talk_with_Hands_Open (parlata; «presenta» = mani
 *    aperte). Le clip sono rese "sul posto" (le anche non derivano).
 *  - GESTI PROCEDURALI (dichiarati in docs/tavoli-in-guerra/3D.md): saluto, indica, applauso, sorpresa, pensiero,
 *    vittoria = rotazioni additive sulle ossa sopra la clip. LIMITI DELLA PELLE (giacche Meshy + rig Mixamo):
 *    braccio (Arm) mai oltre ~1 rad dal riposo, clavicola ≤ 0,12, il resto dell'altezza lo dà il gomito.
 *  - VISO: morph jawOpen/mouthO/mouthE (pseudo-visemi dalla voce `mouthRef` 0..1, o bocca simulata se parla senza
 *    audio), blink ogni 2–6 s, browsUp sugli accenti (non per Franca). Mammusss: anche snakeOpen (il serpente fa eco).
 *  - Bumbaru porta Bumbarino agganciato all'osso Spine2 (taglio sotto la pancia, come REFERENCE/…/bumbaru.js).
 * Origine ai piedi, statura del personaggio in metri (host-models.ts), guarda verso +Z.
 */

const FADE_TAU = 0.2;

type BoneKey = "spine" | "chest" | "neck" | "head" | "lSh" | "lArm" | "lFore" | "lHand" | "rSh" | "rArm" | "rFore" | "rHand";
const BONE_NAMES: Record<BoneKey, string> = {
  spine: "mixamorigSpine",
  chest: "mixamorigSpine2",
  neck: "mixamorigNeck",
  head: "mixamorigHead",
  lSh: "mixamorigLeftShoulder",
  lArm: "mixamorigLeftArm",
  lFore: "mixamorigLeftForeArm",
  lHand: "mixamorigLeftHand",
  rSh: "mixamorigRightShoulder",
  rArm: "mixamorigRightArm",
  rFore: "mixamorigRightForeArm",
  rHand: "mixamorigRightHand",
};
const BONE_KEYS = Object.keys(BONE_NAMES) as BoneKey[];

type Vec3 = [number, number, number];
type Pose = Partial<Record<BoneKey, Vec3>>;
type PoseKind = "saluto" | "indica" | "applauso" | "sorpresa" | "pensiero" | "vittoria";

/**
 * Pose additive in spazio PERSONAGGIO ([x, y, z] radianti; braccio destro in fuori = z negativa, sinistro = z
 * positiva, in avanti = x negativa). Valori entro i limiti della pelle (vedi sopra).
 */
export const HOST_POSES: Record<PoseKind, Pose> = {
  saluto: { rSh: [0, 0, -0.1], rArm: [-0.32, 0, -0.85], rFore: [-0.1, 0, -1.75], head: [0, -0.08, 0.05] },
  // indica le torri alla sua sinistra (lato destro dello schermo): braccio sinistro teso, busto e sguardo che seguono
  indica: { chest: [0, 0.16, 0], head: [0, 0.3, 0], lSh: [0, 0, 0.08], lArm: [-0.2, 0, 0.92], lFore: [0, 0, 0.42] },
  applauso: { chest: [0.04, 0, 0], rArm: [-0.62, 0, 0.42], lArm: [-0.62, 0, -0.42], rFore: [-0.62, 0, 0.42], lFore: [-0.62, 0, -0.42] },
  sorpresa: { chest: [-0.16, 0, 0], head: [-0.1, 0, 0], rArm: [-0.3, 0, -0.42], lArm: [-0.3, 0, 0.42], rFore: [-1.25, 0, -0.15], lFore: [-1.25, 0, 0.15] },
  pensiero: { head: [0.1, 0.1, 0.17], rArm: [-0.6, 0, 0.4], rFore: [-1.7, 0, 0.3], rHand: [0.3, 0, 0], lArm: [-0.45, 0, -0.42], lFore: [-1.0, 0, -0.55] },
  vittoria: { chest: [-0.1, 0, 0], head: [-0.15, 0, 0], lSh: [0, 0, 0.08], rSh: [0, 0, -0.08], lArm: [-0.9, 0, 0.48], rArm: [-0.9, 0, -0.48], lFore: [-0.6, 0, 1.25], rFore: [-0.6, 0, -1.25] },
};
const POSE_KINDS = Object.keys(HOST_POSES) as PoseKind[];

function poseOf(action: HostAction): PoseKind | null {
  return action === "saluto" || action === "indica" || action === "applauso" || action === "sorpresa" || action === "pensiero" || action === "vittoria" ? action : null;
}

// ------------------------------------------------------------------ clip (una volta per file)
interface Prepared {
  idle: AnimationClip | null;
  talk: AnimationClip[];
  walk: AnimationClip | null;
}
const prepCache = new WeakMap<object, Prepared>();

function inPlace(clip: AnimationClip, bindHips: Vector3, keepSway = true): AnimationClip {
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
  const p: Prepared = {
    idle: idleRaw ? inPlace(idleRaw, bindHips) : null,
    walk: walkRaw ? inPlace(walkRaw, bindHips, false) : null,
    talk: [find(/passionate/i), find(/hands_?open/i)].filter((c): c is AnimationClip => c !== null).map((c) => inPlace(c, bindHips)),
  };
  prepCache.set(scene, p);
  return p;
}

// ------------------------------------------------------------------ ossa e viso
const qA = new Quaternion();
const qB = new Quaternion();
const qC = new Quaternion();
const qD = new Quaternion();
const vX = new Vector3(1, 0, 0);
const vY = new Vector3(0, 1, 0);
const vZ = new Vector3(0, 0, 1);

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

const FACE_KEYS = ["jawOpen", "mouthO", "mouthE", "blink", "browsUp", "snakeOpen"] as const;
type FaceKey = (typeof FACE_KEYS)[number];

function setMorph(mesh: Mesh, name: FaceKey, value: number) {
  const i = mesh.morphTargetDictionary?.[name];
  const inf = mesh.morphTargetInfluences;
  if (i === undefined || !inf) return;
  inf[i] = value;
}

function vowelOf(n: number): 0 | 1 | 2 {
  const h = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  const r = h - Math.floor(h);
  return r < 0.45 ? 0 : r < 0.72 ? 1 : 2;
}

/** Sillabe finte quando un personaggio parla senza audio (solo sottotitolo). */
export function simulatedMouth(t: number): number {
  const p = t * 11.5;
  return 0.18 + 0.62 * Math.max(0, Math.sin(p) * Math.sin(p * 0.37 + 1.3));
}

function faceMeshesOf(root: Object3D): Mesh[] {
  const list: Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.morphTargetDictionary && ("jawOpen" in mesh.morphTargetDictionary || "snakeOpen" in mesh.morphTargetDictionary)) list.push(mesh);
  });
  return list;
}

/**
 * CONTROLUCE DA STUDIO sui presentatori (gratis: niente luci vere in più): un filo di luce sui contorni, ambra da
 * sinistra e ciano da destra (in vista), che li stacca dal fondo buio come le luci di taglio di uno show. Uniform
 * condivise: l'arena le cambia con l'atmosfera (rosso nel caos, oro sul podio). Intensità 0 = spento.
 */
export const HOST_RIM = {
  a: { value: new Color("#ff9a3c") },
  b: { value: new Color("#3ee6ff") },
  k: { value: 0.85 },
};
const RIM_DONE = new WeakSet<Material>();

function addRim(mat: MeshStandardMaterial) {
  if (RIM_DONE.has(mat)) return;
  RIM_DONE.add(mat);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uRimA = HOST_RIM.a;
    shader.uniforms.uRimB = HOST_RIM.b;
    shader.uniforms.uRimK = HOST_RIM.k;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRimA;\nuniform vec3 uRimB;\nuniform float uRimK;")
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        {
          float tigRim = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 3.0);
          vec3 tigRimCol = mix(uRimA, uRimB, smoothstep(-0.35, 0.35, geometryNormal.x));
          totalEmissiveRadiance += tigRimCol * tigRim * uRimK * (0.35 + 0.65 * diffuseColor.rgb);
        }`,
      );
  };
  mat.customProgramCacheKey = () => "tig-host-rim";
}

function prepMaterials(root: Object3D, castShadow: boolean) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false; // le mesh skinnate escono dal box di bind
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    mesh.morphTargetInfluences?.fill(0);
    const mat = mesh.material as MeshStandardMaterial;
    if (mat?.isMeshStandardMaterial) {
      // ambiente di studio (softbox): riflessi morbidi su giacche, capelli e pelle
      mat.envMapIntensity = 0.7;
      addRim(mat);
      mat.needsUpdate = true;
    }
  });
}

// ------------------------------------------------------------------ Bumbarino nella pancia di Bumbaru
interface Passenger {
  root: Object3D;
  mixer: AnimationMixer;
  face: Mesh[];
  spine: Object3D;
  clipRest: Plane;
  clip: Plane;
}

function seatBumbarino(big: Object3D, smallScene: Object3D, smallAnims: AnimationClip[], castShadow: boolean): Passenger | null {
  const spine = big.getObjectByName("mixamorigSpine2");
  if (!spine) return null;
  const small = cloneSkinned(smallScene);
  prepMaterials(small, castShadow);
  const { seat, body } = BUMBARINO;
  const s = seat.bodyWidth / (2 * body.halfWidth);
  small.scale.setScalar(s);
  small.position.set(seat.centerX, seat.centerY - body.centerY * s, seat.frontZ - body.front * s);
  big.add(small);
  big.updateMatrixWorld(true);
  // il taglio sotto la pancia, nello spazio dell'osso (si muove con la pancia)
  const clipRest = new Plane(new Vector3(0, 1, 0), -seat.clipY).applyMatrix4(new Matrix4().copy(spine.matrixWorld).invert());
  spine.attach(small);
  const clip = clipRest.clone();
  small.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m: Material) => {
      const c = m.clone();
      c.clippingPlanes = [clip];
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
  });
  const mixer = new AnimationMixer(small);
  const bindHips = new Vector3();
  small.traverse((o) => {
    if ((o as Bone).isBone && /Hips$/.test(o.name)) bindHips.copy(o.position);
  });
  const idle = smallAnims.find((a) => /idle/i.test(a.name));
  if (idle) {
    const a = mixer.clipAction(inPlace(idle, bindHips));
    a.setLoop(LoopRepeat, Infinity);
    a.timeScale = 1.1;
    a.play();
  }
  return { root: small, mixer, face: faceMeshesOf(small), spine, clipRest, clip };
}

// ------------------------------------------------------------------ componente
export interface HostCharacterProps {
  who: HostId;
  quality: Exclude<VisualQuality, "2d">;
  action: HostAction;
  speaking: boolean;
  mouthRef?: RefObject<number>;
  /** true quando c'è movimento che richiede 60 fps */
  busyRef?: RefObject<boolean>;
  onReady?: () => void;
  /** solo anteprime: ritmo diverso per non far parlare tutti all'unisono */
  phase?: number;
  /** camminata 0..1 (peso della clip Walking) letta a ogni fotogramma: lo spostamento lo fa la scena */
  walkRef?: RefObject<number>;
}

export function HostCharacter(props: HostCharacterProps) {
  const cfg = HOST_MODELS[props.who];
  if (cfg.passenger === "bumbarino") return <HostWithPassenger {...props} />;
  return <HostModelView {...props} passengerUrl={null} />;
}

function HostWithPassenger(props: HostCharacterProps) {
  return <HostModelView {...props} passengerUrl={bumbarinoUrl(props.quality)} />;
}

function HostModelView({ who, quality, action, speaking, mouthRef, busyRef, onReady, phase = 0, walkRef, passengerUrl }: HostCharacterProps & { passengerUrl: string | null }) {
  const cfg = HOST_MODELS[who];
  const gltf = useGLTF(hostModelUrl(who, quality));
  const passengerGltf = useGLTF(passengerUrl ?? hostModelUrl(who, quality));
  const prep = useMemo(() => prepare(gltf.scene, gltf.animations), [gltf]);
  const getThree = useThree((s) => s.get);
  // ombre di contatto nella scena: le mesh non proiettano shadow map (costano troppo)
  const castShadow = false;

  const built = useMemo(() => {
    const m = cloneSkinned(gltf.scene);
    prepMaterials(m, castShadow);
    // statura: bbox del modello a riposo → altezza del personaggio, piedi a y = 0
    m.updateMatrixWorld(true);
    const box = new Box3().setFromObject(m);
    const raw = box.max.y - box.min.y;
    const k = raw > 0.3 && raw < 6 ? cfg.height / raw : 1;
    const passenger = passengerUrl ? seatBumbarino(m, passengerGltf.scene, passengerGltf.animations, castShadow) : null;
    return { model: m, scale: k, minY: box.min.y, passenger };
  }, [gltf, passengerGltf, passengerUrl, cfg.height, castShadow]);
  const model = built.model;

  useEffect(() => {
    // il taglio di Bumbarino sotto la pancia usa i piani di clipping locali
    if (built.passenger) getThree().gl.localClippingEnabled = true;
  }, [built.passenger, getThree]);

  const bones = useMemo(() => {
    const map = new Map<BoneKey, Object3D>();
    model.traverse((o) => {
      if (!(o as Bone).isBone) return;
      for (const k of BONE_KEYS) if (o.name === BONE_NAMES[k]) map.set(k, o);
    });
    return map;
  }, [model]);
  const faceMeshes = useMemo(() => {
    const own = faceMeshesOf(model);
    const p = built.passenger;
    return p ? own.filter((m) => !p.face.includes(m)) : own;
  }, [model, built.passenger]);
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

  const readyCb = useRef(onReady);
  useEffect(() => {
    readyCb.current = onReady;
  });
  useEffect(() => {
    readyCb.current?.();
  }, [model]);
  useEffect(() => {
    for (const a of actions.all) {
      a.setLoop(LoopRepeat, Infinity);
      a.setEffectiveWeight(a === actions.idle ? 1 : 0);
      a.play();
    }
    // ogni personaggio parte da un punto diverso delle clip (niente movimenti all'unisono)
    if (phase > 0) mixer.update((phase * 3.7) % 10);
    return () => {
      for (const a of actions.all) a.stop();
    };
  }, [actions, phase, mixer]);

  const root = useRef<Group>(null);
  const st = useRef({
    t: phase * 1.3,
    clipW: [] as number[],
    poseW: {} as Partial<Record<PoseKind, number>>,
    talking: false,
    talkIdx: 0,
    talkCount: 0,
    action: "idle" as HostAction,
    actionT: 0,
    face: { jawOpen: 0, mouthO: 0, mouthE: 0, blink: 0, browsUp: 0, snakeOpen: 0 } as Record<FaceKey, number>,
    env: 0,
    snakeEnv: 0,
    low: 1,
    rising: false,
    syl: 0,
    vowel: 0 as 0 | 1 | 2,
    blinkIn: 1.5 + phase * 0.7,
    blinkPh: -1,
    pBlinkIn: 2.4,
    pBlinkPh: -1,
  });

  useFrame((_, rawDt) => {
    const s = st.current;
    const dt = Math.min(0.1, rawDt);
    s.t += dt;
    if (action !== s.action) {
      s.action = action;
      s.actionT = 0;
    }
    s.actionT += dt;
    const at = s.actionT;

    // bocca: voce vera, simulata o chiusa
    const mouthOpen = mouthRef && speaking ? Math.max(0, Math.min(1, mouthRef.current ?? 0)) : speaking ? simulatedMouth(s.t) : 0;
    const talking = speaking || action === "talk" || action === "presenta";

    // clip: parlata o riposo
    const nTalk = actions.talk.length;
    if (talking && !s.talking && nTalk > 0) {
      s.talkIdx = action === "presenta" ? Math.min(1, nTalk - 1) : s.talkCount % nTalk;
      s.talkCount++;
      const a = actions.talk[s.talkIdx];
      if (a.getEffectiveWeight() < 0.05) a.reset();
    }
    s.talking = talking;
    const walkW = Math.max(0, Math.min(1, walkRef?.current ?? 0));
    const k = 1 - Math.exp(-dt / FADE_TAU);
    let sum = 0;
    actions.all.forEach((a, i) => {
      let target = 0;
      if (a === actions.walk) target = walkW;
      else if (a === actions.idle) target = (1 - walkW) * (talking && nTalk > 0 ? 0 : 1);
      else target = (1 - walkW) * (talking && actions.talk[s.talkIdx] === a ? 1 : 0);
      const prev = s.clipW[i] ?? (a === actions.idle ? 1 : 0);
      const w = prev + (target - prev) * k;
      s.clipW[i] = w;
      sum += w;
    });
    actions.all.forEach((a, i) => a.setEffectiveWeight(sum > 0 ? s.clipW[i] / sum : a === actions.idle ? 1 : 0));
    actions.idle?.setEffectiveTimeScale(cfg.idleRate);
    for (const a of actions.talk) a.setEffectiveTimeScale(cfg.talkRate);
    actions.walk?.setEffectiveTimeScale(walkW < 0.01 ? 0 : 1.05);
    for (const [b, q] of bind) b.quaternion.copy(q);
    mixer.update(dt);

    // gesti procedurali
    const want = poseOf(action);
    const fast = action === "sorpresa" ? 14 : 7;
    for (const p of POSE_KINDS) {
      const target = p === want ? 1 : 0;
      const prev = s.poseW[p] ?? 0;
      s.poseW[p] = prev + (target - prev) * (1 - Math.exp(-dt * (target ? fast : 6)));
    }
    const w = (p: PoseKind) => (s.poseW[p] ?? 0) * (1 - walkW);
    const clap = 0.5 + 0.5 * Math.sin(at * 2 * Math.PI * 3);
    const pump = Math.sin(at * 2 * Math.PI * 2.1);
    const speech = mouthOpen * 0.05 * (faceMeshes.length ? 0.4 : 1);
    let busy = talking || walkW > 0.01;
    for (const key of BONE_KEYS) {
      const bone = bones.get(key);
      if (!bone) continue;
      let x = 0;
      let y = 0;
      let z = 0;
      for (const p of POSE_KINDS) {
        const pw = w(p);
        const v = HOST_POSES[p][key];
        if (!v || pw < 0.001) continue;
        busy = true;
        x += v[0] * pw;
        y += v[1] * pw;
        z += v[2] * pw;
      }
      const ws = w("saluto");
      if (ws > 0.01) {
        if (key === "rFore") z += ws * Math.sin(s.t * 8) * 0.32;
        if (key === "rFore" || key === "rHand") y += ws * 0.8;
      }
      const wa = w("applauso");
      if (wa > 0.01) {
        if (key === "rArm") z += wa * (clap - 0.5) * 0.3;
        if (key === "lArm") z -= wa * (clap - 0.5) * 0.3;
        if (key === "chest") x += wa * 0.03 * clap;
      }
      const wv = w("vittoria");
      if (wv > 0.01 && key === "lFore") z += wv * 0.18 * pump;
      if (wv > 0.01 && key === "rFore") z -= wv * 0.18 * pump;
      const wp = w("pensiero");
      if (wp > 0.01 && key === "head") z += wp * 0.04 * Math.sin(at * 1.3);
      if (key === "neck") x += speech * 0.6;
      if (key === "head") x += speech;
      rotateInModelSpace(bone, model, x, y, z);
    }
    if (root.current) root.current.position.y = w("vittoria") * 0.03 * Math.abs(pump);
    if (busyRef) busyRef.current = busy;

    // Bumbarino: le sue clip, il suo battito di palpebre, il taglio che segue la pancia
    const pass = built.passenger;
    if (pass) {
      pass.mixer.update(dt);
      pass.spine.updateWorldMatrix(true, false);
      pass.clip.copy(pass.clipRest).applyMatrix4(pass.spine.matrixWorld);
      s.pBlinkIn -= dt;
      if (s.pBlinkIn <= 0 && s.pBlinkPh < 0) {
        s.pBlinkPh = 0;
        s.pBlinkIn = 2.2 + Math.random() * 3.5;
      }
      let pb = 0;
      if (s.pBlinkPh >= 0) {
        s.pBlinkPh += dt / 0.16;
        pb = Math.sin(Math.min(1, s.pBlinkPh) * Math.PI);
        if (s.pBlinkPh >= 1) s.pBlinkPh = -1;
      }
      for (const mesh of pass.face) setMorph(mesh, "blink", pb);
    }

    // viso
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
    const target = {
      jawOpen: Math.max(m * (s.vowel === 0 ? 1 : 0.45), surprise * 0.5),
      mouthO: Math.max(s.vowel === 1 ? m * 0.95 : 0, surprise * 0.6),
      mouthE: Math.max(s.vowel === 2 ? m * 0.9 : 0, w("vittoria") * 0.45, w("applauso") * 0.3),
    };
    const km = 1 - Math.exp(-dt * 18);
    f.jawOpen += (target.jawOpen - f.jawOpen) * km;
    f.mouthO += (target.mouthO - f.mouthO) * km;
    f.mouthE += (target.mouthE - f.mouthE) * km;
    // Mammusss: il serpente fa eco al mammut (un filo in ritardo, più morbido)
    if (cfg.snake) {
      s.snakeEnv += (m - s.snakeEnv) * (1 - Math.exp(-dt * 9));
      f.snakeOpen = Math.min(1, s.snakeEnv * 0.9);
    }
    const brows = cfg.noBrows ? 0 : Math.max(m > 0.75 ? 0.7 : 0, surprise, w("vittoria") * 0.6, w("pensiero") * 0.35);
    f.browsUp += (brows - f.browsUp) * (1 - Math.exp(-dt * 6));
    s.blinkIn -= dt;
    if (s.blinkIn <= 0 && s.blinkPh < 0) {
      s.blinkPh = 0;
      s.blinkIn = 2 + Math.random() * 4;
    }
    if (s.blinkPh >= 0) {
      s.blinkPh += dt / 0.16;
      f.blink = Math.sin(Math.min(1, s.blinkPh) * Math.PI) * cfg.blinkMax;
      if (s.blinkPh >= 1) {
        s.blinkPh = -1;
        f.blink = 0;
      }
    }
    for (const mesh of faceMeshes) for (const key of FACE_KEYS) setMorph(mesh, key, Math.min(1, Math.max(0, f[key])));
  });

  return (
    <group ref={root}>
      <group scale={built.scale} position={[cfg.offsetX * built.scale, -built.minY * built.scale, 0]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

/** Scarica in anticipo i file di un presentatore. */
export function preloadHost(who: HostId, quality: Exclude<VisualQuality, "2d">) {
  useGLTF.preload(hostModelUrl(who, quality));
  if (HOST_MODELS[who].passenger === "bumbarino") useGLTF.preload(bumbarinoUrl(quality));
}
