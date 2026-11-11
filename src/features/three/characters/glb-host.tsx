"use client";

/**
 * I PERSONAGGI da modelli GLB riggati (Mixamo): Il Professore, La Regina, Palmino.
 * Sostituiscono i modelli procedurali quando il file è disponibile (vedi host-auto.tsx).
 *
 * Clip di ogni file: "Idle_3" (riposo), "Talk_Passionately" e "Talk_with_Hands_Open" (parlata),
 * "Walking" (ingresso a piedi), "Running" (non usata). Le clip girano su un AnimationMixer con
 * pesi che sfumano (~0.3 s). Dove una clip non esiste (saluto, indicare, festa, sorpresa) si
 * aggiungono pose procedurali sulle ossa di braccia, busto e testa.
 *
 * Viso: se il file ha i morph target (jawOpen, mouthO, mouthE, blink, browsUp — il Professore
 * "parlante") la bocca segue la voce con pseudo-visemi, gli occhi sbattono da soli e le
 * sopracciglia si alzano sugli accenti. Senza morph la voce muove testa e collo.
 *
 * Root motion: tutte le clip sono rese "sul posto" (le anche non si spostano sul piano XZ
 * rispetto alla posa di bind; nelle clip da fermo resta l'ondeggiamento ma non la deriva).
 * Lo spostamento lo fa la scena, alla velocità della camminata.
 *
 * Contratto (CharacterModelProps): guarda verso +Z; origine alla base del busto per i
 * presentatori (inquadrati dalla vita in su), ai piedi per Palmino; altezza visibile come i
 * procedurali (registry → CHARACTER_HEIGHTS). Con `fullBody` invece l'origine è ai piedi e
 * l'unità è il metro (serve nell'intro, dove i presentatori entrano camminando).
 */

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AnimationClip,
  AnimationMixer,
  Bone,
  Box3,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
  type AnimationAction,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Presenter } from "@/lib/game-engine/types";
import type { CharacterAnimation, CharacterModelProps } from "./types";

// ------------------------------------------------------------------ configurazione per personaggio
interface HostGlbConfig {
  /** File predefinito (public/models); la variante leggera ha il suffisso "-low". */
  url: string;
  /** Valore di NEXT_PUBLIC_QZ_GLB_<NOME> (letto in chiaro: Next lo sostituisce in build). */
  env: string | undefined;
  /** Origine del contratto: base del busto (presentatori) o piedi (Palmino). */
  origin: "waist" | "feet";
  /** Altezza visibile del contratto (sopra l'origine), come i procedurali. */
  height: number;
  /** Ritmo delle clip da fermo e di parlata (Palmino è più "elettrico"). */
  idleRate: number;
  talkRate: number;
  /**
   * Velocità della clip "Walking" a timeScale 1 (m/s): misurata dallo scorrimento all'indietro
   * delle punte dei piedi in appoggio (clip in-place da 1.033 s): Professore ≈0.89, Regina ≈0.98.
   * Palmino non cammina nell'intro (valore indicativo).
   */
  walkSpeed: number;
  /** Torsione (rad, metà avambraccio e metà polso) che porta il palmo verso il pubblico nel saluto. */
  waveTwist: number;
  /** Chiusura massima delle palpebre (la Regina a 1 mostra la piega delle ciglia schiacciata). */
  blinkMax: number;
}

export const HOST_GLB: Record<Presenter, HostGlbConfig> = {
  professore: { url: "/models/professore.glb", env: process.env.NEXT_PUBLIC_QZ_GLB_PROFESSORE, origin: "waist", height: 1.8, idleRate: 1, talkRate: 1, walkSpeed: 0.9, waveTwist: 0.8, blinkMax: 1 },
  regina: { url: "/models/regina.glb", env: process.env.NEXT_PUBLIC_QZ_GLB_REGINA, origin: "waist", height: 1.85, idleRate: 1, talkRate: 1, walkSpeed: 0.98, waveTwist: 1.4, blinkMax: 0.8 },
  palmino: { url: "/models/palmino.glb", env: process.env.NEXT_PUBLIC_QZ_GLB_PALMINO, origin: "feet", height: 1.6, idleRate: 1.2, talkRate: 1.3, walkSpeed: 0.9, waveTwist: 0.8, blinkMax: 1 },
};

/**
 * Attivazione dei GLB (robusta anche senza riavviare il server):
 *  - default ATTIVI (i file sono in public/models/);
 *  - NEXT_PUBLIC_QZ_GLB_<NOME>="off" | "0" | "false" li disattiva (oppure indica un altro URL "/...glb");
 *  - ?glb=0 / ?glb=1 nell'URL forza tutti; ?glb_regina=0 (ecc.) forza un solo personaggio;
 *  - se un file non si carica, per il resto della sessione quel personaggio usa il procedurale.
 */
const failed = new Set<Presenter>();

export function hostGlbEnabled(who: Presenter): boolean {
  if (failed.has(who)) return false;
  if (typeof window !== "undefined") {
    const sp = new URLSearchParams(window.location.search);
    const one = sp.get(`glb_${who}`);
    if (one === "0") return false;
    if (one === "1") return true;
    const all = sp.get("glb");
    if (all === "0") return false;
    if (all === "1") return true;
  }
  const env = HOST_GLB[who].env;
  return !(env === "off" || env === "0" || env === "false");
}

export function reportHostGlbFailure(who: Presenter) {
  failed.add(who);
}

/** URL del file (env o predefinito), nella variante leggera se richiesto. */
export function hostGlbUrl(who: Presenter, lowPower: boolean): string {
  const env = HOST_GLB[who].env;
  const base = env && env.startsWith("/") ? env : HOST_GLB[who].url;
  return lowPower ? base.replace(/\.glb$/, "-low.glb") : base;
}

export function preloadHostGlbs(lowPower = false) {
  for (const who of Object.keys(HOST_GLB) as Presenter[]) if (hostGlbEnabled(who)) useGLTF.preload(hostGlbUrl(who, lowPower));
}

/** Sfumatura tra clip (costante di tempo: ~0.3 s per completarla). */
const FADE_TAU = 0.1;

export interface HostGlbProps extends CharacterModelProps {
  who: Presenter;
  /** Origine ai piedi e unità in metri (intro con camminata). */
  fullBody?: boolean;
  /** Camminata 0..1 (peso della clip Walking), letto a ogni frame. */
  walkRef?: RefObject<number>;
  /** Moltiplicatore della velocità della clip Walking. */
  walkRate?: number;
  /** Come walkRate ma letto a ogni frame (ha la precedenza): segue la velocità reale del corpo. */
  walkRateRef?: RefObject<number>;
  /**
   * Quale clip di parlata usare (0 = Talk_Passionately, 1 = Talk_with_Hands_Open). Se assente
   * si alternano a ogni nuova battuta. Nell'intro la sceglie il copione (deterministica).
   */
  talkVariant?: number;
  /** Solo anteprime: forme del viso fisse (ignora voce e battito delle palpebre). */
  faceOverride?: Partial<Record<"jawOpen" | "mouthO" | "mouthE" | "blink" | "browsUp", number>>;
}

// ------------------------------------------------------------------ preparazione (una volta per file)
interface Prepared {
  idle: AnimationClip;
  talk: AnimationClip[];
  walk: AnimationClip | null;
  height: number;
  hipsY: number;
}

const prepCache = new WeakMap<object, Prepared>();

/**
 * Rende la clip "sul posto": le anche restano sulla X/Z di bind. Con `keepSway` resta
 * l'oscillazione attorno alla posizione di bind ma senza deriva (la differenza tra fine e
 * inizio viene distribuita lungo la clip, così il loop non scatta).
 */
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

/** Media dei quaternioni di ogni traccia della clip (riposo di riserva per file senza clip Idle). */
function averagePose(clip: AnimationClip): Map<string, Quaternion> {
  const out = new Map<string, Quaternion>();
  for (const tr of clip.tracks) {
    if (!(tr instanceof QuaternionKeyframeTrack)) continue;
    const bone = tr.name.replace(/\.quaternion$/, "");
    const v = tr.values;
    const acc = [0, 0, 0, 0];
    const ref = [v[0], v[1], v[2], v[3]];
    for (let i = 0; i < v.length; i += 4) {
      const s = v[i] * ref[0] + v[i + 1] * ref[1] + v[i + 2] * ref[2] + v[i + 3] * ref[3] < 0 ? -1 : 1;
      for (let k = 0; k < 4; k++) acc[k] += v[i + k] * s;
    }
    out.set(bone, new Quaternion(acc[0], acc[1], acc[2], acc[3]).normalize());
  }
  return out;
}

/** Clip statica (riposo) per i file che hanno solo la camminata: braccia dalla media, il resto dal bind. */
function restClip(scene: Object3D, walk: AnimationClip | null): AnimationClip {
  const avg = walk ? averagePose(walk) : new Map<string, Quaternion>();
  const tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[] = [];
  scene.traverse((o) => {
    if (!(o as Bone).isBone) return;
    const a = avg.get(o.name);
    const q = a && /(Shoulder|Arm|Hand)/.test(o.name) ? a : o.quaternion;
    tracks.push(new QuaternionKeyframeTrack(`${o.name}.quaternion`, [0, 1], [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]));
    if (/Hips$/.test(o.name)) {
      const p = o.position;
      tracks.push(new VectorKeyframeTrack(`${o.name}.position`, [0, 1], [p.x, p.y, p.z, p.x, p.y, p.z]));
    }
  });
  return new AnimationClip("RestPose", 1, tracks);
}

function prepare(scene: Object3D, animations: AnimationClip[]): Prepared {
  const cached = prepCache.get(scene);
  if (cached) return cached;
  const bindHips = new Vector3();
  scene.traverse((o) => {
    if ((o as Bone).isBone && /Hips$/.test(o.name)) bindHips.copy(o.position);
  });
  const find = (re: RegExp) => animations.find((a) => re.test(a.name)) ?? null;
  const walkRaw = find(/walk/i);
  const walk = walkRaw ? inPlace(walkRaw, bindHips, false) : null;
  const idleRaw = find(/idle/i);
  const idle = idleRaw ? inPlace(idleRaw, bindHips, true) : restClip(scene, walk);
  const talk = [find(/passionate/i), find(/hands_?open|talk/i)]
    .filter((c, i, arr): c is AnimationClip => c !== null && arr.indexOf(c) === i)
    .map((c) => inPlace(c, bindHips, true));
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene);
  let hipsY = box.max.y * 0.55;
  scene.traverse((o) => {
    if ((o as Bone).isBone && /Hips$/.test(o.name)) hipsY = o.getWorldPosition(new Vector3()).y;
  });
  const p: Prepared = { idle, talk, walk, height: box.max.y - box.min.y, hipsY };
  prepCache.set(scene, p);
  return p;
}

// ------------------------------------------------------------------ pose procedurali (solo dove manca una clip)
type Pose = Partial<Record<BoneKey, [number, number, number]>>;
type BoneKey = "chest" | "neck" | "head" | "lArm" | "lFore" | "lHand" | "rArm" | "rFore" | "rHand";

const BONE_NAMES: Record<BoneKey, string> = {
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

/**
 * Pose additive (sopra Idle_3) in spazio PERSONAGGIO (X destra dello schermo, Y su, Z verso
 * chi guarda), angoli in radianti [x, y, z], applicate dalla radice verso le mani.
 * Saluti e indicazioni usano la DESTRA del personaggio (lato −X). Braccio destro in fuori/su =
 * z NEGATIVA, sinistro = z positiva, in avanti = x negativa.
 */
const WAVE = { arm: -1.75, fore: -1.39 };
const POSES: Partial<Record<CharacterAnimation, Pose>> = {
  intro: { chest: [-0.06, 0, 0], rArm: [-0.2, 0, -0.9], rFore: [-0.5, 0, 0] },
  // saluto: braccio in fuori e in su, avambraccio verticale dal gomito, palmo verso il pubblico
  // (Rz porta l'avambraccio in verticale, poi Ry lo ruota sul proprio asse: avambraccio + polso)
  wave: { rArm: [0, 0, WAVE.arm], rFore: [0, 0, WAVE.fore] },
  point: { chest: [0, -0.12, 0], rArm: [-1.3, 0, -0.1], rFore: [-0.1, 0, 0] },
  celebrate: { chest: [-0.12, 0, 0], lArm: [0, 0, 2.5], rArm: [0, 0, -2.5], head: [-0.15, 0, 0] },
  surprised: { chest: [0.12, 0, 0], head: [0.12, 0, 0], lArm: [-0.4, 0, 0.45], rArm: [-0.5, 0, -0.5] },
};
const POSE_KEYS = Object.keys(POSES) as CharacterAnimation[];
const BONE_KEYS = Object.keys(BONE_NAMES) as BoneKey[];

const qA = new Quaternion();
const qB = new Quaternion();
const qC = new Quaternion();
const qD = new Quaternion();
const eTmp = { x: 0, y: 0, z: 0 };
const vX = new Vector3(1, 0, 0);
const vY = new Vector3(0, 1, 0);
const vZ = new Vector3(0, 0, 1);

/** Ruota un osso di (x,y,z) radianti attorno agli assi del PERSONAGGIO (root). */
function rotateInModelSpace(bone: Object3D, root: Object3D, x: number, y: number, z: number) {
  if (!bone.parent || (x === 0 && y === 0 && z === 0)) return;
  bone.parent.getWorldQuaternion(qA);
  root.getWorldQuaternion(qB);
  qC.copy(qB).invert().multiply(qA); // genitore rispetto alla radice
  qD.setFromAxisAngle(vX, x);
  if (y !== 0) qD.multiply(qB.setFromAxisAngle(vY, y));
  if (z !== 0) qD.multiply(qB.setFromAxisAngle(vZ, z));
  qB.copy(qC).invert().multiply(qD).multiply(qC); // nello spazio del genitore: qC⁻¹ · qD · qC
  bone.quaternion.premultiply(qB);
}

// ------------------------------------------------------------------ viso (morph target)
const FACE_KEYS = ["jawOpen", "mouthO", "mouthE", "blink", "browsUp"] as const;
type FaceKey = (typeof FACE_KEYS)[number];

/** Imposta un morph target per nome (se il mesh ce l'ha). */
function setMorph(mesh: Mesh, name: FaceKey, value: number) {
  const i = mesh.morphTargetDictionary?.[name];
  const inf = mesh.morphTargetInfluences;
  if (i === undefined || !inf) return;
  inf[i] = value;
}

/**
 * Pseudo-visemi: a ogni nuova sillaba (risalita della voce dopo un minimo) si sceglie una vocale
 * con un hash del contatore — A (mascella), O (labbra arrotondate), E (labbra tirate).
 */
function vowelOf(n: number): 0 | 1 | 2 {
  const h = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  const r = h - Math.floor(h);
  return r < 0.45 ? 0 : r < 0.72 ? 1 : 2;
}

export function HostGlbModel({
  who,
  animation = "idle",
  mouthOpen: mouthOpenProp = 0,
  mouthRef,
  speed = 1,
  lowPower = false,
  fullBody = false,
  walkRef,
  walkRate = 1,
  walkRateRef,
  talkVariant,
  faceOverride,
  ...group
}: HostGlbProps) {
  const cfg = HOST_GLB[who];
  const gltf = useGLTF(hostGlbUrl(who, lowPower));
  const prep = useMemo(() => prepare(gltf.scene, gltf.animations), [gltf]);
  const model = useMemo(() => {
    const m = cloneSkinned(gltf.scene);
    m.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      // le mesh skinnate si deformano oltre il loro bounding box di bind: niente culling
      mesh.frustumCulled = false;
      // i pesi predefiniti dei morph nel file sono 1: si parte a viso neutro
      mesh.morphTargetInfluences?.fill(0);
      const mat = mesh.material as MeshStandardMaterial;
      if (mat?.isMeshStandardMaterial) {
        mat.envMapIntensity = 0.3; // l'ambiente dell'intro è tarato per l'oro: sulla pelle va attenuato
        mat.needsUpdate = true;
      }
    });
    return m;
  }, [gltf]);
  const bones = useMemo(() => {
    const map = new Map<string, Object3D>();
    model.traverse((o) => {
      if ((o as Bone).isBone) map.set(o.name, o);
    });
    return map;
  }, [model]);
  /** Mesh con le forme del viso (corpo + interno bocca del Professore "parlante"). */
  const faceMeshes = useMemo(() => {
    const list: Mesh[] = [];
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && "jawOpen" in mesh.morphTargetDictionary) list.push(mesh);
    });
    return list;
  }, [model]);
  /**
   * Posa di bind delle ossa ritoccate in codice: alcune ossa non hanno tracce nelle clip
   * e senza un reset a ogni frame le rotazioni procedurali si sommerebbero.
   */
  const bind = useMemo(() => {
    const m = new Map<Object3D, Quaternion>();
    for (const key of BONE_KEYS) {
      const b = bones.get(BONE_NAMES[key]);
      if (b) m.set(b, b.quaternion.clone());
    }
    return m;
  }, [bones]);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const idle = mixer.clipAction(prep.idle);
    const talk = prep.talk.map((c) => mixer.clipAction(c));
    const walk = prep.walk ? mixer.clipAction(prep.walk) : null;
    return { idle, talk, walk, all: [idle, ...talk, ...(walk ? [walk] : [])] as AnimationAction[] };
  }, [mixer, prep]);
  // play/stop in un effetto (in StrictMode il doppio montaggio fermerebbe un'azione avviata nel render)
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

  // stato animato: pesi delle clip e delle pose, viso
  const st = useRef({
    clipW: [] as number[],
    poseW: {} as Partial<Record<CharacterAnimation, number>>,
    t: 0,
    walk: 0,
    talking: false,
    talkIdx: 0,
    talkCount: 0,
    face: { jawOpen: 0, mouthO: 0, mouthE: 0, blink: 0, browsUp: 0 } as Record<FaceKey, number>,
    env: 0,
    low: 1,
    rising: false,
    syl: 0,
    vowel: 0 as 0 | 1 | 2,
    blinkIn: 2.5,
    blinkPh: -1,
  });

  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt) * speed;
    const s = st.current;
    const mouthOpen = mouthRef ? mouthRef.current : mouthOpenProp;
    s.t += dt;
    const walk = Math.max(0, Math.min(1, walkRef?.current ?? 0));
    s.walk += (walk - s.walk) * (1 - Math.exp(-dt / FADE_TAU));
    const still = 1 - s.walk;

    // parlata: a ogni nuova battuta si sceglie la clip (dal copione o alternando) e la si fa ripartire
    const talking = animation === "talk" || mouthOpen > 0.05;
    const nTalk = actions.talk.length;
    if (talking && !s.talking && nTalk > 0) {
      s.talkIdx = (talkVariant ?? s.talkCount) % nTalk;
      s.talkCount++;
      const a = actions.talk[s.talkIdx];
      if (a.getEffectiveWeight() < 0.05) a.reset();
    }
    s.talking = talking;

    // pesi bersaglio (somma = 1): camminata, poi parlata o riposo
    const k = 1 - Math.exp(-dt / FADE_TAU);
    let sum = 0;
    actions.all.forEach((a, i) => {
      let target = 0;
      if (a === actions.walk) target = s.walk;
      else if (a === actions.idle) target = still * (talking && nTalk > 0 ? 0 : 1);
      else target = still * (talking && actions.talk[s.talkIdx] === a ? 1 : 0);
      const prev = s.clipW[i] ?? (a === actions.idle ? 1 : 0);
      const w = prev + (target - prev) * k;
      s.clipW[i] = w;
      sum += w;
    });
    actions.all.forEach((a, i) => a.setEffectiveWeight(sum > 0 ? s.clipW[i] / sum : a === actions.idle ? 1 : 0));
    actions.idle.setEffectiveTimeScale(cfg.idleRate);
    for (const a of actions.talk) a.setEffectiveTimeScale(cfg.talkRate);
    actions.walk?.setEffectiveTimeScale(s.walk < 0.01 ? 0 : (walkRateRef?.current ?? walkRate));
    for (const [b, q] of bind) b.quaternion.copy(q);
    mixer.update(dt);

    // pose procedurali (saluto, indicare, festa, sorpresa) sopra alle clip, attenuate in camminata
    for (const a of POSE_KEYS) {
      const target = a === animation ? 1 : 0;
      s.poseW[a] = (s.poseW[a] ?? 0) + (target - (s.poseW[a] ?? 0)) * (1 - Math.exp(-dt * 7));
    }
    const t = s.t;
    // voce → testa e collo: piena senza viso animato, ridotta con la bocca vera o con una clip di parlata
    const talkClipW = nTalk > 0 ? actions.talk.reduce((acc, a) => acc + a.getEffectiveWeight(), 0) : 0;
    const bob = faceMeshes.length > 0 ? 0.25 : 1;
    const speech = mouthOpen * 0.09 * bob * (1 - 0.65 * talkClipW) * still;
    for (const key of BONE_KEYS) {
      const bone = bones.get(BONE_NAMES[key]);
      if (!bone) continue;
      eTmp.x = 0;
      eTmp.y = 0;
      eTmp.z = 0;
      for (const a of POSE_KEYS) {
        const w = (s.poseW[a] ?? 0) * still;
        const p = POSES[a]?.[key];
        if (!p || w < 0.001) continue;
        eTmp.x += p[0] * w;
        eTmp.y += p[1] * w;
        eTmp.z += p[2] * w;
      }
      if (key === "neck") eTmp.x += speech * 0.6;
      if (key === "head") eTmp.x += speech;
      // palmo verso il pubblico: torsione sull'asse dell'avambraccio (già verticale), metà avambraccio e metà polso
      if ((key === "rFore" || key === "rHand") && (s.poseW.wave ?? 0) > 0.01) eTmp.y += (s.poseW.wave ?? 0) * cfg.waveTwist * still;
      // saluto: la mano oscilla di lato (nel piano dello schermo) facendo perno sul gomito
      if (key === "rFore" && (s.poseW.wave ?? 0) > 0.01) eTmp.z += (s.poseW.wave ?? 0) * Math.sin(t * 8) * 0.32 * still;
      if ((key === "lArm" || key === "rArm") && (s.poseW.celebrate ?? 0) > 0.01) eTmp.x += (s.poseW.celebrate ?? 0) * Math.sin(t * 8) * 0.18 * still;
      rotateInModelSpace(bone, model, eTmp.x, eTmp.y, eTmp.z);
    }

    // ---------------------------------------------------------- viso
    if (faceMeshes.length === 0) return;
    const f = s.face;
    // inviluppo della voce (già 0..1) ammorbidito; nuova sillaba = risalita dopo un minimo
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
    const target = {
      jawOpen: m * (s.vowel === 0 ? 1 : 0.45),
      mouthO: s.vowel === 1 ? m * 0.95 : 0,
      mouthE: s.vowel === 2 ? m * 0.9 : 0,
    };
    const km = 1 - Math.exp(-dt * 18);
    f.jawOpen += (target.jawOpen - f.jawOpen) * km;
    f.mouthO += (target.mouthO - f.mouthO) * km;
    f.mouthE += (target.mouthE - f.mouthE) * km;
    // sopracciglia: sugli accenti forti della voce e nelle pose di sorpresa/festa
    const brows = Math.max(m > 0.75 ? 0.7 : 0, animation === "surprised" ? 0.9 : animation === "celebrate" ? 0.6 : 0);
    f.browsUp += (brows - f.browsUp) * (1 - Math.exp(-dt * 6));
    // battito delle palpebre ogni 2–6 s (0.16 s)
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
    for (const mesh of faceMeshes) for (const key of FACE_KEYS) setMorph(mesh, key, Math.min(1, Math.max(0, faceOverride?.[key] ?? f[key])));
  });

  // trasformazione interna: contratto (busto/piedi) oppure piedi in metri (intro a piedi)
  const inner = useMemo(() => {
    if (fullBody) return { y: 0, s: 1 };
    if (cfg.origin === "feet") return { y: 0, s: cfg.height / Math.max(0.1, prep.height) };
    const above = Math.max(0.1, prep.height - prep.hipsY);
    return { y: -prep.hipsY * (cfg.height / above), s: cfg.height / above };
  }, [fullBody, prep, cfg]);

  return (
    <group {...group}>
      <group position-y={inner.y} scale={inner.s}>
        <primitive object={model} />
      </group>
    </group>
  );
}
