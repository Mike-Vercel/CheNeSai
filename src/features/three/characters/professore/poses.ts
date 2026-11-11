/**
 * Animazioni procedurali del Professore come funzioni di posa:
 * ogni animazione scrive un vettore di canali (Float32Array) al tempo t.
 * Le mani sono comandate da un punto-ancora nello spazio del torace +
 * orientamento assoluto (quaternione) e risolte con IK a due ossa.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { CharacterAnimation } from "../types";
import { MIC_TILT, type Side } from "./layout";

let n = 0;
const c = () => n++;
export const CH = {
  rootX: c(),
  rootY: c(),
  rootZ: c(),
  rootRx: c(),
  rootRy: c(),
  pelvisX: c(),
  pelvisY: c(),
  pelvisZ: c(),
  spineX: c(),
  spineY: c(),
  spineZ: c(),
  chestX: c(),
  chestY: c(),
  chestZ: c(),
  neckX: c(),
  neckY: c(),
  neckZ: c(),
  headX: c(),
  headY: c(),
  headZ: c(),
  jaw: c(),
  stache: c(),
  lidL: c(),
  lidR: c(),
  lowL: c(),
  lowR: c(),
  browL: c(),
  browR: c(),
};
/** canali per braccio, a partire da armCh(side) */
export const AC = {
  ax: 0,
  ay: 1,
  az: 2,
  px: 3,
  py: 4,
  pz: 5,
  qx: 6,
  qy: 7,
  qz: 8,
  qw: 9,
  curl: 10,
  idx: 11,
  thumb: 12,
  spread: 13,
} as const;
export const ARM_CH = 14;
const ARM_L0 = n;
const ARM_R0 = n + ARM_CH;
export const N_CH = n + ARM_CH * 2;
export const armCh = (s: Side) => (s === 1 ? ARM_L0 : ARM_R0);

export interface PoseCtx {
  /** true se nessun lip-sync esterno: "talk" muove la bocca da solo */
  autoMouth: boolean;
}

const _e = new Euler();
const _q = new Quaternion();
const _qz = new Quaternion();
const _z = new Vector3(0, 0, 1);

const HALF_PI = Math.PI / 2;

/** imposta il braccio: ancora (spazio torace), polo del gomito, orientamento mano (Euler XYZ, spazio torace) */
function arm(
  o: Float32Array,
  s: Side,
  ax: number,
  ay: number,
  az: number,
  ex: number,
  ey: number,
  ez: number,
  fingers: [curl: number, idx: number, thumb: number, spread: number],
  pole: [number, number, number] = [0.7, -1, -0.35],
  wobble = 0,
): void {
  const b = armCh(s);
  o[b + AC.ax] = ax * s;
  o[b + AC.ay] = ay;
  o[b + AC.az] = az;
  o[b + AC.px] = pole[0] * s;
  o[b + AC.py] = pole[1];
  o[b + AC.pz] = pole[2];
  // l'Euler è scritto per il lato sinistro; per il destro si specchia (y,z negati)
  _e.set(ex, ey * s, ez * s, "XYZ");
  _q.setFromEuler(_e);
  if (wobble !== 0) {
    _qz.setFromAxisAngle(_z, wobble * s);
    _q.premultiply(_qz);
  }
  o[b + AC.qx] = _q.x;
  o[b + AC.qy] = _q.y;
  o[b + AC.qz] = _q.z;
  o[b + AC.qw] = _q.w;
  o[b + AC.curl] = fingers[0];
  o[b + AC.idx] = fingers[1];
  o[b + AC.thumb] = fingers[2];
  o[b + AC.spread] = fingers[3];
}

const _fx = new Vector3();
const _fy = new Vector3();
const _fz = new Vector3();
const _m = new Matrix4();
/**
 * come arm(), ma l'orientamento della mano è dato da direzione delle dita
 * (fx,fy,fz) e direzione del pollice (tx,ty,tz), nello spazio torace reale.
 */
function armDir(
  o: Float32Array,
  s: Side,
  ax: number,
  ay: number,
  az: number,
  fx: number,
  fy: number,
  fz: number,
  tx: number,
  ty: number,
  tz: number,
  fingers: [number, number, number, number],
  pole: [number, number, number],
): void {
  arm(o, s, ax, ay, az, 0, 0, 0, fingers, pole);
  const b = armCh(s);
  _fy.set(-fx, -fy, -fz).normalize(); // +Y della mano = opposto alle dita
  _fz.set(tx, ty, tz).addScaledVector(_fy, -(tx * _fy.x + ty * _fy.y + tz * _fy.z)).normalize();
  _fx.crossVectors(_fy, _fz).normalize();
  _m.makeBasis(_fx, _fy, _fz);
  _q.setFromRotationMatrix(_m);
  o[b + AC.qx] = _q.x;
  o[b + AC.qy] = _q.y;
  o[b + AC.qz] = _q.z;
  o[b + AC.qw] = _q.w;
}

const FIST: [number, number, number, number] = [1.5, 1.5, 0.9, 0];
const POINT: [number, number, number, number] = [1.6, 0.0, 0.12, 0];
const OPEN: [number, number, number, number] = [0.12, 0.08, 0.05, 0.18];
const RELAX: [number, number, number, number] = [0.55, 0.4, 0.3, 0.05];
const GRIP: [number, number, number, number] = [1.45, 1.35, 1.0, 0];

const _ma = new Vector3();
const _mw = new Vector3();
const _my = new Vector3();
const _mz = new Vector3();
const MIC_SIN = Math.sin(MIC_TILT);
const MIC_COS = Math.cos(MIC_TILT);
/**
 * mano sinistra che stringe il microfono: impugnatura in (gx,gy,gz) (spazio
 * torace), asse del microfono verso la griglia e direzione in cui sta il polso
 * rispetto al pugno (cioè da dove arriva l'avambraccio). Il microfono è in
 * diagonale nel pugno (MIC_TILT): da qui si ricava l'orientamento della mano.
 * Il polso va dato a ~110–130° dall'asse del microfono (verso l'avambraccio):
 * quasi parallelo all'asse la sua componente ortogonale diventa instabile.
 */
function holdMic(
  o: Float32Array,
  gx: number,
  gy: number,
  gz: number,
  axis: [number, number, number],
  wrist: [number, number, number],
  pole: [number, number, number],
): void {
  const a = _ma.set(...axis).normalize();
  const w = _mw.set(...wrist);
  w.addScaledVector(a, -w.dot(a)).normalize();
  // asse = cos·Z − sin·Y  →  Y = −sin·a + cos·w,  Z = cos·a + sin·w
  const y = _my.copy(a).multiplyScalar(-MIC_SIN).addScaledVector(w, MIC_COS);
  const z = _mz.copy(a).multiplyScalar(MIC_COS).addScaledVector(w, MIC_SIN);
  armDir(o, 1, gx, gy, gz, -y.x, -y.y, -y.z, z.x, z.y, z.z, GRIP, pole);
}

function micAtChest(o: Float32Array, t: number) {
  holdMic(o, 0.3, 0.07 + 0.008 * Math.sin(t * 1.7), 0.43, [-0.12, 1, 0.1], [0.45, -0.5, -1], [0.8, -1, -0.2]);
}
/** griglia davanti alla bocca, un po' di lato; il pugno sotto, l'avambraccio sale da fuori */
function micAtMouth(o: Float32Array, wob = 0) {
  holdMic(o, 0.22 + wob, 0.25, 0.42, [-0.55, 0.85, -0.3], [0.9, -1, -0.3], [0.9, -1, -0.1]);
}

function base(o: Float32Array, t: number): void {
  o.fill(0);
  micAtChest(o, t);
  arm(o, -1, 0.2, -0.17, 0.33, -0.75, 0.25, -0.35, RELAX, [0.7, -1, -0.5]);
  o[CH.lowL] = 0.25;
  o[CH.lowR] = 0.25;
  o[CH.jaw] = 0.02;
}

function breathe(o: Float32Array, t: number, amt = 1): void {
  const b = Math.sin((t * Math.PI * 2) / 3.6);
  o[CH.chestX] += -0.018 * b * amt;
  o[CH.spineX] += -0.008 * b * amt;
  o[CH.rootY] += 0.005 * b * amt;
}

function idle(t: number, o: Float32Array): void {
  base(o, t);
  // la mano destra si appoggia sulla pancia (ancora espressa per il lato destro: x negativo)
  arm(o, -1, 0.3, -0.12, 0.26, -0.85, 0.35, -0.6, [0.95, 0.8, 0.5, 0], [0.7, -1, -0.5]);
  breathe(o, t);
  o[CH.rootRy] = 0.05 * Math.sin(t * 0.45);
  o[CH.spineZ] = 0.015 * Math.sin(t * 0.7);
  o[CH.headY] = 0.1 * Math.sin(t * 0.33) + 0.05;
  o[CH.headZ] = 0.035 * Math.sin(t * 0.41 + 1);
  o[CH.headX] = -0.04 + 0.015 * Math.sin(t * 0.6);
  o[CH.browL] = 0.1;
  o[CH.browR] = 0.1;
}

function talk(t: number, o: Float32Array, ctx: PoseCtx): void {
  base(o, t);
  breathe(o, t, 0.6);
  micAtMouth(o, 0.01 * Math.sin(t * 1.3));
  const g = Math.sin(t * 2.1);
  arm(
    o,
    -1,
    0.3 + 0.07 * g,
    0.04 + 0.07 * Math.sin(t * 3.3 + 1),
    0.42 + 0.05 * Math.sin(t * 1.7),
    -1.3 + 0.25 * g,
    -0.5,
    -0.9,
    OPEN,
    [0.8, -1, -0.4],
  );
  o[CH.chestY] = 0.06 * Math.sin(t * 1.05);
  o[CH.rootRy] = 0.04 * Math.sin(t * 0.6);
  o[CH.headX] = -0.06 + 0.035 * Math.sin(t * 4.2);
  o[CH.headY] = 0.12 * Math.sin(t * 0.9);
  o[CH.headZ] = 0.05 * Math.sin(t * 0.7);
  const br = Math.max(0, Math.sin(t * 2.7)) * 0.35;
  o[CH.browL] = br;
  o[CH.browR] = br * 0.8;
  if (ctx.autoMouth) {
    o[CH.jaw] += 0.2 * (0.5 + 0.5 * Math.sin(t * 11)) * (0.4 + 0.6 * Math.abs(Math.sin(t * 3.1)));
  }
}

function wave(t: number, o: Float32Array): void {
  base(o, t);
  breathe(o, t, 0.5);
  const w = Math.sin(t * 7.5);
  arm(o, -1, 0.56 + 0.04 * w, 0.46, 0.2, Math.PI, HALF_PI, 0, OPEN, [1, -0.6, -0.5], 0.35 * w);
  o[CH.chestY] = -0.12;
  o[CH.chestZ] = 0.04;
  o[CH.headZ] = -0.08;
  o[CH.headY] = -0.1;
  o[CH.headX] = -0.05;
  o[CH.jaw] = 0.14;
  o[CH.lowL] = 0.45;
  o[CH.lowR] = 0.45;
  o[CH.browL] = 0.3;
  o[CH.browR] = 0.3;
  o[CH.stache] = 0.3;
}

function celebrate(t: number, o: Float32Array): void {
  base(o, t);
  const b = Math.abs(Math.sin(t * 3.6));
  o[CH.rootY] = 0.035 * b;
  o[CH.spineX] = -0.06;
  o[CH.chestX] = -0.05;
  o[CH.headX] = -0.16 + 0.04 * b;
  o[CH.headZ] = 0.06 * Math.sin(t * 1.8);
  arm(o, -1, 0.5, 0.86 + 0.06 * b, 0.08, Math.PI, 0, 0.25, FIST, [0.9, -0.3, -0.5]);
  holdMic(o, 0.5, 0.74 + 0.05 * b, 0.12, [-0.15, 1, 0.15], [0.5, -0.5, -0.7], [0.9, -0.3, -0.5]);
  o[CH.jaw] = 0.3 + 0.06 * b;
  o[CH.lidL] = 0.6;
  o[CH.lidR] = 0.6;
  o[CH.lowL] = 0.8;
  o[CH.lowR] = 0.8;
  o[CH.browL] = 0.5;
  o[CH.browR] = 0.5;
  o[CH.stache] = 0.7;
}

function surprised(t: number, o: Float32Array): void {
  base(o, t);
  const k = Math.min(1, t / 0.18);
  const e = 1 - (1 - k) ** 3;
  const over = Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.25 * (1 - Math.min(1, t / 0.5));
  const tremble = 0.004 * Math.sin(t * 40) * Math.max(0, 1 - t / 1.2);
  o[CH.rootZ] = (-0.05 - over * 0.1) * e;
  o[CH.spineX] = -0.1 * e;
  o[CH.chestX] = -0.06 * e + tremble;
  o[CH.headX] = (-0.08 + 0.02 * over) * e;
  o[CH.browL] = 1 * e;
  o[CH.browR] = 1 * e;
  o[CH.lidL] = -0.25 * e;
  o[CH.lidR] = -0.25 * e;
  o[CH.lowL] = 0;
  o[CH.lowR] = 0;
  o[CH.jaw] = 0.36 * e;
  o[CH.stache] = 0.7 * e;
  arm(o, -1, 0.3, 0.32 * e - 0.17 * (1 - e), 0.36, -0.2, 1.1, 0.3, OPEN, [0.8, -1, -0.3]);
  holdMic(o, 0.3, 0.15, 0.43, [-0.25, 1, -0.1], [0.45, -0.6, -1], [0.8, -1, -0.2]);
  breathe(o, t, 1.5);
}

function point(t: number, o: Float32Array): void {
  base(o, t);
  breathe(o, t, 0.6);
  const jab = Math.max(0, Math.sin(t * 3.2)) ** 3;
  o[CH.chestY] = 0.1;
  o[CH.spineX] = -0.03;
  o[CH.headX] = -0.1;
  o[CH.headY] = 0.02;
  o[CH.headZ] = 0.16;
  armDir(o, -1, 0.5, 0.2 + 0.01 * jab, 0.52 + 0.025 * jab, -0.32, -0.08, 1, 0.12, 1, 0.1, POINT, [0.6, -1, -0.5]);
  micAtMouth(o);
  o[CH.lidR] = 1;
  o[CH.lowR] = 0.75;
  o[CH.lidL] = 0.05;
  o[CH.lowL] = 0.35;
  o[CH.browR] = -0.45;
  o[CH.browL] = 0.4;
  o[CH.jaw] = 0.3 + 0.02 * Math.sin(t * 2);
  o[CH.stache] = 0.55;
}

const _a = new Float32Array(64);
const _b = new Float32Array(64);
function tada(t: number, o: Float32Array): void {
  base(o, t);
  arm(o, -1, 0.66, 0.24, 0.22, -0.3, 1.2, 0.2, OPEN, [0.5, -1, -0.6]);
  holdMic(o, 0.6, 0.36, 0.22, [0.25, 1, 0.1], [0.2, -0.6, -1], [0.6, -1, -0.5]);
  o[CH.jaw] = 0.32;
  o[CH.browL] = 0.6;
  o[CH.browR] = 0.6;
  o[CH.lowL] = 0.5;
  o[CH.lowR] = 0.5;
  o[CH.stache] = 0.6;
  o[CH.headX] = -0.12;
}

function intro(t: number, o: Float32Array): void {
  // 0–0.7 sale ruotando, 0.7–1.4 "ta-da", 1.4–2.0 passa al punto + occhiolino
  const rise = Math.min(1, t / 0.7);
  const e = 1 - (1 - rise) ** 3;
  tada(t, _a);
  point(Math.max(0, t - 1.4), _b);
  const m = Math.min(1, Math.max(0, (t - 1.4) / 0.6));
  const w = m * m * (3 - 2 * m);
  blendPose(_a, _b, w, o);
  const bounce = t > 0.7 && t < 1.4 ? Math.sin(((t - 0.7) / 0.7) * Math.PI) * 0.03 : 0;
  o[CH.rootY] += -0.55 * (1 - e) + bounce;
  o[CH.rootRy] += -1.1 * (1 - e) * (1 - e);
  o[CH.spineX] += 0.15 * (1 - e);
}

export const POSES: Record<CharacterAnimation, (t: number, o: Float32Array, ctx: PoseCtx) => void> = {
  idle,
  intro,
  talk,
  wave,
  celebrate,
  surprised,
  point,
  // la ruota la gira Palmino: qui basta indicarla
  spin: point,
};

/** out = lerp(a, b, w); i quaternioni delle mani con nlerp sullo stesso emisfero */
export function blendPose(a: Float32Array, b: Float32Array, w: number, out: Float32Array): void {
  for (let i = 0; i < N_CH; i++) out[i] = a[i] + (b[i] - a[i]) * w;
  for (let side = 0; side < 2; side++) {
    const q = (side === 0 ? ARM_L0 : ARM_R0) + AC.qx;
    let dot = 0;
    for (let k = 0; k < 4; k++) dot += a[q + k] * b[q + k];
    const sign = dot < 0 ? -1 : 1;
    let len = 0;
    for (let k = 0; k < 4; k++) {
      const v = a[q + k] * (1 - w) + b[q + k] * sign * w;
      out[q + k] = v;
      len += v * v;
    }
    len = Math.sqrt(len) || 1;
    for (let k = 0; k < 4; k++) out[q + k] /= len;
  }
}
