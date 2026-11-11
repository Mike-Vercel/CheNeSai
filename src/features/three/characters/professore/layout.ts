/**
 * Scheletro e misure di riposo del Professore (unità "modello": il busto
 * intero è alto ~1.56 e viene poi scalato a PROFESSORE_HEIGHT).
 * Asse Y in alto, il personaggio guarda +Z; la sua sinistra è +X.
 */
import type { BoneDef } from "./kit";

export const B = {
  root: 0,
  pelvis: 1,
  spine: 2,
  chest: 3,
  neck: 4,
  head: 5,
  jaw: 6,
  stache: 7,
  lidL: 8,
  lidR: 9,
  browL: 10,
  browR: 11,
  lowLidL: 12,
  lowLidR: 13,
} as const;

/** ossa del braccio, relative all'inizio del blocco del lato */
export const A = {
  upper: 0,
  fore: 1,
  hand: 2,
  thumb1: 3,
  thumb2: 4,
  index1: 5,
  index2: 6,
  middle1: 7,
  middle2: 8,
  ring1: 9,
  ring2: 10,
  pinky1: 11,
  pinky2: 12,
} as const;
export const ARM_BONES = 13;
export const ARM_L = 14;
export const ARM_R = ARM_L + ARM_BONES;
export const BONE_COUNT = ARM_R + ARM_BONES;

/** lato: +1 sinistra del personaggio (+X), -1 destra */
export type Side = 1 | -1;
export const armBase = (s: Side) => (s === 1 ? ARM_L : ARM_R);

// ---- misure (spazio modello) ----
export const UPPER_LEN = 0.35;
export const FORE_LEN = 0.34;
export const SHOULDER: [number, number, number] = [0.46, 0.2, -0.015]; // nello spazio del torace
/** scala extra (cartoon) di testa e mani, applicata alle ossa */
export const HEAD_SCALE = 1.2;
export const HAND_SCALE = 1.42;
/** impugnatura del microfono nella mano sinistra (spazio mano, prima di HAND_SCALE) */
export const MIC_GRIP: [number, number, number] = [-0.045, -0.1, -0.02];
/**
 * il microfono attraversa il pugno in diagonale (come nel riferimento): il suo
 * asse è cos·Z − sin·Y della mano, cioè la griglia piega verso le dita e il
 * manico verso il polso. Così l'avambraccio può salire da sotto fino alla bocca.
 */
export const MIC_TILT = 0.75;
/** busto più corto (~15%): scala y degli offset delle ossa del busto e delle parti del busto */
export const TORSO_SQUASH = 0.85;
export const HEAD_C: [number, number, number] = [0, 0.22, 0]; // centro cranio, spazio testa
export const HEAD_R: [number, number, number] = [0.185, 0.235, 0.195];
export const EYE_R = 0.047;
export const JAW_PIVOT: [number, number, number] = [0, 0.135, 0.02];

export interface FingerDef {
  bone1: number;
  bone2: number;
  z: number;
  len1: number;
  len2: number;
  r: number;
}
export const FINGERS: FingerDef[] = [
  { bone1: A.index1, bone2: A.index2, z: 0.037, len1: 0.05, len2: 0.04, r: 0.0205 },
  { bone1: A.middle1, bone2: A.middle2, z: 0.0125, len1: 0.054, len2: 0.042, r: 0.021 },
  { bone1: A.ring1, bone2: A.ring2, z: -0.012, len1: 0.05, len2: 0.038, r: 0.02 },
  { bone1: A.pinky1, bone2: A.pinky2, z: -0.035, len1: 0.04, len2: 0.032, r: 0.0175 },
];
export const THUMB_LEN1 = 0.045;
export const THUMB_LEN2 = 0.038;
/** direzione del pollice a riposo (mano sinistra; per la destra si nega x) */
export const THUMB_DIR: [number, number, number] = [-0.35, -0.5, 0.79];

/** posizione a riposo dell'occhio (spazio testa), calcolata in body.ts */
export const EYE_DIR: [number, number, number] = [0.43, 0.25, 0.87];

export function boneDefs(eyeL: [number, number, number], eyeR: [number, number, number]): BoneDef[] {
  const defs: BoneDef[] = [
    { name: "root", parent: -1, offset: [0, 0, 0] },
    { name: "pelvis", parent: B.root, offset: [0, 0.12 * TORSO_SQUASH, 0] },
    { name: "spine", parent: B.pelvis, offset: [0, 0.2 * TORSO_SQUASH, 0] },
    { name: "chest", parent: B.spine, offset: [0, 0.28 * TORSO_SQUASH, 0] },
    { name: "neck", parent: B.chest, offset: [0, 0.3 * TORSO_SQUASH, 0] },
    { name: "head", parent: B.neck, offset: [0, 0.08, 0.02] },
    { name: "jaw", parent: B.head, offset: JAW_PIVOT },
    { name: "stache", parent: B.head, offset: [0, 0.165, 0.2] },
    { name: "lidL", parent: B.head, offset: eyeL },
    { name: "lidR", parent: B.head, offset: eyeR },
    { name: "browL", parent: B.head, offset: [0.088, 0.372, 0.162] },
    { name: "browR", parent: B.head, offset: [-0.088, 0.372, 0.162] },
    { name: "lowLidL", parent: B.head, offset: eyeL },
    { name: "lowLidR", parent: B.head, offset: eyeR },
  ];
  for (const s of [1, -1] as Side[]) {
    const base = defs.length;
    const n = s === 1 ? "L" : "R";
    defs.push({ name: `upperArm${n}`, parent: B.chest, offset: [SHOULDER[0] * s, SHOULDER[1] * TORSO_SQUASH, SHOULDER[2]] });
    defs.push({ name: `foreArm${n}`, parent: base + A.upper, offset: [0, -UPPER_LEN, 0] });
    defs.push({ name: `hand${n}`, parent: base + A.fore, offset: [0, -FORE_LEN, 0] });
    const td = THUMB_DIR;
    const tl = Math.hypot(td[0], td[1], td[2]);
    defs.push({ name: `thumb1${n}`, parent: base + A.hand, offset: [-0.02 * s, -0.03, 0.04] });
    defs.push({
      name: `thumb2${n}`,
      parent: base + A.thumb1,
      offset: [((td[0] * s) / tl) * THUMB_LEN1, (td[1] / tl) * THUMB_LEN1, (td[2] / tl) * THUMB_LEN1],
    });
    for (const f of FINGERS) {
      defs.push({ name: `f${f.bone1}${n}`, parent: base + A.hand, offset: [-0.006 * s, -0.1, f.z] });
      defs.push({ name: `f${f.bone2}${n}`, parent: base + f.bone1, offset: [0, -f.len1, 0] });
    }
  }
  return defs;
}
