import type { CharacterAnimation } from "../types";
import { B } from "./build";

/**
 * Animazioni procedurali della Regina come "pose a canali": ogni funzione
 * scrive offset di rotazione (rad) rispetto alla posa di riferimento più
 * qualche canale extra (mandibola, palpebre, sopracciglia, sguardo, vassoio).
 * Il rig fa la dissolvenza (~0.3 s) tra la posa precedente e quella nuova.
 */

/** Ossa con rotazione animata, nell'ordine dei canali. */
export const ROT_BONES = [B.root, B.spine, B.chest, B.neck, B.head, B.shoR, B.uarmR, B.farmR, B.handR, B.shoL, B.uarmL, B.farmL, B.handL] as const;

export const S = {
  root: 0,
  spine: 1,
  chest: 2,
  neck: 3,
  head: 4,
  shoR: 5,
  uarmR: 6,
  farmR: 7,
  handR: 8,
  shoL: 9,
  uarmL: 10,
  farmL: 11,
  handL: 12,
} as const;
const X = (s: number) => s * 3;
const Y = (s: number) => s * 3 + 1;
const Z = (s: number) => s * 3 + 2;

const E0 = ROT_BONES.length * 3;
export const CH = {
  posY: E0,
  posZ: E0 + 1,
  jaw: E0 + 2,
  blinkR: E0 + 3,
  blinkL: E0 + 4,
  browR: E0 + 5,
  browL: E0 + 6,
  eyeX: E0 + 7,
  eyeY: E0 + 8,
  trayX: E0 + 9,
  trayZ: E0 + 10,
} as const;
export const CHANNELS = E0 + 11;
export const rx = X;
export const ry = Y;
export const rz = Z;

export interface AnimCtx {
  /** 1 quando il lip-sync reale è attivo (mouthOpen recente > 0) */
  voice: number;
  /** tempo globale (continuità di blink/respiro tra animazioni) */
  time: number;
}

type AnimFn = (t: number, p: Float32Array, ctx: AnimCtx) => void;

const TAU = Math.PI * 2;
const sm = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** finestra: sale in `rise`, resta `hold`, scende in `fall` */
const env = (ph: number, rise: number, hold: number, fall: number) => {
  if (ph < 0) return 0;
  if (ph < rise) return sm(0, rise, ph);
  if (ph < rise + hold) return 1;
  return 1 - sm(rise + hold, rise + hold + fall, ph);
};

/** Battito di ciglia naturale (periodo variabile). */
function blinkAt(t: number): number {
  const period = 3.6;
  const k = Math.floor(t / period);
  const start = k * period + hash(k) * 1.6;
  const ph = t - start;
  return ph >= 0 && ph < 0.17 ? Math.sin((Math.PI * ph) / 0.17) : 0;
}

/** Occhiolino ricorrente (occhio destro, come nell'illustrazione). */
function winkAt(t: number): number {
  const period = 9;
  const ph = (t + 3.5) % period;
  return env(ph, 0.12, 0.55, 0.16);
}

function base(p: Float32Array, c: AnimCtx, wink = true) {
  const g = c.time;
  const br = Math.sin((g * TAU) / 3.8);
  p[Y(S.root)] = 0.025 * Math.sin(g * 0.37);
  p[CH.posY] = 0.004 * br;
  p[X(S.spine)] = 0.008 * br;
  p[Z(S.spine)] = 0.018 * Math.sin(g * 0.53);
  p[X(S.chest)] = -0.012 * br;
  p[Y(S.chest)] = 0.015 * Math.sin(g * 0.31);
  p[Z(S.chest)] = -0.01 * Math.sin(g * 0.53 + 0.6);
  p[Z(S.neck)] = 0.01 + 0.01 * Math.sin(g * 0.41);
  p[X(S.head)] = -0.05 + 0.022 * Math.sin(g * 0.71);
  // testa appena girata verso il microfono, come nell'illustrazione (resta frontale)
  p[Y(S.head)] = 0.04 + 0.03 * Math.sin(g * 0.29);
  p[Z(S.head)] = 0.025 + 0.02 * Math.sin(g * 0.47);
  p[Z(S.uarmR)] = -0.02 * Math.sin(g * 0.9);
  p[X(S.farmR)] = 0.025 * Math.sin(g * 1.1);
  p[Z(S.uarmL)] = 0.012 * Math.sin(g * 0.8 + 1);
  p[X(S.farmL)] = 0.012 * Math.sin(g * 0.9 + 2);
  p[CH.jaw] = 0.03 + 0.015 * Math.sin(g * 0.6);
  const b = blinkAt(g);
  const w = wink ? winkAt(g) : 0;
  p[CH.blinkR] = Math.max(b, w);
  p[CH.blinkL] = Math.max(b * (1 - w), 0.18 * w);
  p[CH.browR] = -0.25 * w + 0.08 * Math.sin(g * 0.3);
  p[CH.browL] = 0.35 * w + 0.08 * Math.sin(g * 0.3);
  p[Z(S.head)] += 0.05 * w;
  p[CH.jaw] += 0.12 * w;
  // saccadi
  const k = Math.floor(g / 1.9);
  p[CH.eyeX] = (hash(k) - 0.5) * 0.16;
  p[CH.eyeY] = (hash(k + 17) - 0.5) * 0.1;
}

const idle: AnimFn = (_t, p, c) => base(p, c);

const talk: AnimFn = (t, p, c) => {
  base(p, c, false);
  const phrase = 0.55 + 0.45 * Math.sin(t * 1.3);
  p[X(S.head)] += 0.05 * Math.sin(t * 5.3) * phrase - 0.02;
  // parla al pubblico: la testa oscilla poco attorno al fronte (niente giri di lato)
  p[Y(S.head)] += -0.03 + 0.035 * Math.sin(t * 0.8);
  p[Z(S.head)] += 0.05 * Math.sin(t * 1.7);
  p[X(S.spine)] += 0.035;
  p[Y(S.chest)] += 0.03 * Math.sin(t * 0.9);
  // gesti col vassoio (resta in bolla)
  p[Z(S.uarmR)] += -0.06 * (0.5 + 0.5 * Math.sin(t * 1.7));
  p[X(S.farmR)] += -0.1 * Math.sin(t * 1.7 + 0.4);
  p[Z(S.farmR)] += 0.06 * Math.sin(t * 2.3);
  // il microfono resta davanti alla bocca
  p[Z(S.uarmL)] += 0.03 * Math.sin(t * 2.1);
  p[CH.browL] = 0.35 * Math.max(0, Math.sin(t * 2.3));
  p[CH.browR] = 0.3 * Math.max(0, Math.sin(t * 2.3 + 0.4));
  // bocca sintetica solo senza voce reale
  // risata aperta come nell'illustrazione; con la voce reale la bocca parte già socchiusa
  const syn = 0.32 + 0.5 * Math.abs(Math.sin(t * 8.7)) * (0.6 + 0.4 * Math.sin(t * 2.1));
  p[CH.jaw] = c.voice > 0.5 ? 0.28 : syn;
  p[CH.trayZ] = 0.03 * Math.sin(t * 1.7);
};

const wave: AnimFn = (t, p, c) => {
  base(p, c, false);
  // braccio del microfono alzato, saluto con l'avambraccio
  p[Z(S.uarmL)] = 1.25;
  p[X(S.uarmL)] = 0.1;
  p[Z(S.farmL)] = -1.95 + 0.3 * Math.sin(t * 8.5);
  p[Y(S.farmL)] = 0;
  p[Z(S.handL)] = 0.15 * Math.sin(t * 8.5 - 0.6);
  p[Z(S.spine)] += -0.05;
  p[Z(S.chest)] += -0.04;
  p[Z(S.head)] += 0.1;
  p[Y(S.head)] += -0.05;
  p[X(S.head)] += -0.04;
  p[CH.jaw] = 0.42 + 0.06 * Math.sin(t * 3);
  p[CH.browL] = 0.45;
  p[CH.browR] = 0.45;
  // il vassoio ondeggia appena
  p[X(S.farmR)] += 0.06 * Math.sin(t * 4.25);
  p[CH.trayZ] = 0.04 * Math.sin(t * 4.25 + 0.5);
  p[CH.eyeX] = 0;
  p[CH.eyeY] = 0;
};

const celebrate: AnimFn = (t, p, c) => {
  base(p, c, false);
  const beat = t * 4.4;
  const bounce = Math.abs(Math.sin(beat));
  p[CH.posY] = 0.035 * bounce;
  // vassoio alzato in alto (resta in bolla)
  p[Z(S.uarmR)] = -0.95;
  p[X(S.uarmR)] = -0.15;
  p[Z(S.farmR)] = 0.75;
  // pugno col microfono che "pompa"
  // (pose risolta in cinematica diretta: pugno ~(0.56, 1.45, 0.17), gomito in fuori: resta fuori
  // dalla sagoma di testa e capelli sia di fronte sia di 3/4)
  p[Z(S.uarmL)] = 1.35 + 0.1 * Math.sin(beat * 2);
  p[X(S.uarmL)] = -0.6;
  p[Z(S.farmL)] = -2.6 + 0.16 * Math.sin(beat * 2 - 0.5);
  p[X(S.farmL)] = -1.2;
  p[X(S.head)] = -0.16 + 0.04 * Math.sin(beat * 2);
  p[Z(S.head)] = 0.15 * Math.sin(t * 2.2);
  p[Z(S.spine)] = 0.05 * Math.sin(t * 2.2);
  p[Y(S.root)] = 0.06 * Math.sin(t * 1.1);
  p[CH.jaw] = 0.78 + 0.12 * Math.sin(beat);
  p[CH.blinkR] = 0.95; // occhiolino
  p[CH.blinkL] = 0.25;
  p[CH.browL] = 0.6;
  p[CH.browR] = 0.1;
  p[CH.trayZ] = -0.04 * Math.sin(beat);
  p[CH.trayX] = 0.03 * Math.sin(beat + 1);
  p[CH.eyeX] = 0;
  p[CH.eyeY] = 0.2;
};

const surprised: AnimFn = (t, p, c) => {
  base(p, c, false);
  const k = sm(0, 0.16, t);
  const settle = sm(0.5, 1.6, t);
  const amt = k * (1 - 0.35 * settle);
  const shake = Math.exp(-4 * t) * Math.sin(t * 38);
  p[X(S.spine)] = -0.13 * amt;
  p[X(S.chest)] = -0.06 * amt;
  p[X(S.neck)] = -0.06 * amt;
  p[X(S.head)] = -0.12 * amt + 0.03 * shake;
  p[Z(S.head)] = 0.02;
  p[CH.posY] = 0.025 * k * (1 - settle) + 0.01 * k;
  p[CH.posZ] = -0.03 * amt;
  // il microfono si allontana di scatto dalla bocca, il vassoio sobbalza
  p[Z(S.uarmL)] = 0.38 * amt;
  p[X(S.uarmL)] = 0.12 * amt;
  p[Z(S.farmL)] = -0.95 * amt;
  p[X(S.farmR)] = -0.22 * amt;
  p[Z(S.uarmR)] = -0.12 * amt;
  p[CH.trayZ] = 0.14 * Math.exp(-2.5 * t) * Math.sin(t * 13);
  p[CH.trayX] = 0.08 * Math.exp(-2.5 * t) * Math.sin(t * 11 + 1);
  p[CH.jaw] = 0.95 * k - 0.25 * settle;
  p[CH.blinkR] = -0.4 * amt;
  p[CH.blinkL] = -0.4 * amt;
  p[CH.browR] = 1 * amt;
  p[CH.browL] = 1 * amt;
  p[CH.eyeX] = 0;
  p[CH.eyeY] = 0.15 * amt;
};

const point: AnimFn = (t, p, c) => {
  base(p, c, false);
  const poke = Math.pow(Math.max(0, Math.sin(t * 3.9)), 3);
  // punta il microfono verso il pubblico
  p[X(S.uarmL)] = -0.75 - 0.06 * poke;
  p[Z(S.uarmL)] = -0.12;
  p[Y(S.uarmL)] = 0.15;
  p[X(S.farmL)] = 1.95 + 0.25 * poke;
  p[Z(S.farmL)] = -0.15;
  p[X(S.spine)] += 0.06 + 0.02 * poke;
  p[Y(S.chest)] += -0.08;
  p[X(S.head)] += 0.04 * poke;
  p[Y(S.head)] = 0.05;
  p[Z(S.head)] = 0.12;
  p[CH.jaw] = 0.58 + 0.12 * poke;
  const w = env((t % 3.2) - 0.4, 0.1, 0.9, 0.15);
  p[CH.blinkR] = Math.max(p[CH.blinkR], w);
  p[CH.browL] = 0.3 + 0.2 * w;
  p[CH.eyeX] = 0;
  p[CH.eyeY] = 0;
};

const intro: AnimFn = (t, p, c) => {
  base(p, c, false);
  // entrata frontale: "spunta" dal basso con un piccolo rimbalzo, sempre rivolta al pubblico.
  // (niente giro su sé stessa: il modello può essere rimontato a scena in corso e ripartire da qui)
  const e = sm(0, 0.7, t);
  const pop = Math.sin(sm(0, 0.9, t) * Math.PI) * Math.exp(-1.5 * t);
  p[CH.posY] += -0.12 * (1 - e) + 0.03 * pop;
  p[Y(S.root)] += 0.12 * (1 - e) * Math.cos(t * 6);
  p[X(S.spine)] += 0.06 * (1 - e) - 0.04 * pop;
  // braccia: il vassoio arriva dal basso, il microfono si apre in un gesto
  const flourish = Math.sin(sm(0.15, 1.3, t) * Math.PI);
  p[Z(S.uarmR)] += 0.3 * (1 - e);
  p[Z(S.uarmL)] += 0.5 * flourish;
  p[Z(S.farmL)] += -1.0 * flourish;
  p[X(S.spine)] += -0.04 * flourish;
  p[X(S.head)] += -0.08 * flourish;
  // posa finale con occhiolino
  const w = env(t - 1.0, 0.12, 0.9, 0.2);
  p[CH.blinkR] = Math.max(p[CH.blinkR], w);
  p[CH.blinkL] = Math.max(p[CH.blinkL] * (1 - w), 0.2 * w);
  p[CH.browL] += 0.5 * w;
  p[CH.browR] += -0.2 * w;
  p[Z(S.head)] += 0.1 * w;
  p[CH.jaw] = Math.max(p[CH.jaw], 0.6 * flourish, 0.4 * w);
  p[CH.trayZ] = 0.05 * Math.sin(t * 6) * (1 - e);
  // dopo ~2.3 s tutti gli extra si esauriscono e resta l'idle
};

export const ANIMS: Record<CharacterAnimation, AnimFn> = { idle, intro, talk, wave, celebrate, surprised, point };
