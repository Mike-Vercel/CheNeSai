import type { CharacterAnimation } from "../types";

/**
 * Animazioni procedurali di Palmino. Ogni clip scrive una posa completa in un Float32Array
 * di canali; il runtime le miscela con pesi (cross-fade ~0.3 s) e poi applica molle per il
 * rimbalzo secondario. Nessuna allocazione per frame.
 */

const CH_NAMES = [
  "rootX",
  "rootY",
  "rootZ",
  "rootRotX",
  "rootRotY",
  "rootRotZ",
  "stretch",
  "hipsRotX",
  "hipsRotY",
  "hipsRotZ",
  "lowRotX",
  "lowRotZ",
  "highRotX",
  "highRotZ",
  "headRotX",
  "headRotY",
  "headRotZ",
  "grin",
  "leafLift",
  "leafFlap",
  "footLLift",
  "footLPitch",
  "footRLift",
  "footRPitch",
  // braccio sinistro (+X) poi destro (-X): stessi 11 canali, il runtime specchia
  "L_shZ",
  "L_shY",
  "L_shX",
  "L_elZ",
  "L_elY",
  "L_wrX",
  "L_wrY",
  "L_wrZ",
  "L_curl",
  "L_index",
  "L_thumb",
  "R_shZ",
  "R_shY",
  "R_shX",
  "R_elZ",
  "R_elY",
  "R_wrX",
  "R_wrY",
  "R_wrZ",
  "R_curl",
  "R_index",
  "R_thumb",
] as const;

export type Channel = (typeof CH_NAMES)[number];
export const CH = Object.fromEntries(CH_NAMES.map((n, i) => [n, i])) as Record<Channel, number>;
export const CHANNEL_COUNT = CH_NAMES.length;
export const ARM_CHANNELS = 11;
export const ARM_L = CH.L_shZ;
export const ARM_R = CH.R_shZ;
/** offset dei canali dentro un blocco braccio */
export const ARM = { shZ: 0, shY: 1, shX: 2, elZ: 3, elY: 4, wrX: 5, wrY: 6, wrZ: 7, curl: 8, index: 9, thumb: 10 } as const;

export type Pose = Float32Array;

export const ANIMATIONS: readonly CharacterAnimation[] = ["idle", "intro", "talk", "wave", "celebrate", "surprised", "point", "spin"];

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function setArm(p: Pose, base: number, shZ: number, shY: number, elZ: number, wrX: number, curl: number) {
  p[base + ARM.shZ] = shZ;
  p[base + ARM.shY] = shY;
  p[base + ARM.shX] = 0;
  p[base + ARM.elZ] = elZ;
  p[base + ARM.elY] = 0.12;
  p[base + ARM.wrX] = wrX;
  p[base + ARM.wrY] = 0;
  p[base + ARM.wrZ] = -0.12;
  p[base + ARM.curl] = curl;
  p[base + ARM.index] = curl * 0.6;
  p[base + ARM.thumb] = 0.12;
}

/** Posa di riposo: la posa "braccia aperte" del riferimento. */
export function restPose(p: Pose) {
  p.fill(0);
  p[CH.stretch] = 1;
  p[CH.grin] = 0.88;
  setArm(p, ARM_L, 0.14, 0.16, 0.22, -0.6, 0.15);
  setArm(p, ARM_R, 0.14, 0.16, 0.22, -0.6, 0.15);
}

export interface ClipContext {
  /** true se nessun lip-sync è collegato: la clip "talk" muove la bocca da sola */
  autoChatter: boolean;
}

function idle(p: Pose, t: number) {
  restPose(p);
  const f = 1.05;
  const s = Math.sin(TAU * f * t);
  // respiro "a molla": su-giù con schiacciamento
  p[CH.stretch] = 1 + 0.028 * s;
  p[CH.rootY] = 0.009 * (s + 1);
  p[CH.hipsRotZ] = 0.035 * Math.sin(TAU * 0.5 * t);
  p[CH.lowRotZ] = -0.02 * Math.sin(TAU * 0.5 * t + 0.6);
  p[CH.headRotZ] = -0.05 * Math.sin(TAU * 0.5 * t + 1.1);
  p[CH.headRotY] = 0.09 * Math.sin(TAU * 0.21 * t);
  p[CH.headRotX] = 0.025 * Math.sin(TAU * f * t + 1);
  p[CH.grin] = 0.84 + 0.1 * Math.sin(TAU * 0.37 * t);
  const arm = 0.07 * Math.sin(TAU * f * t + 0.7);
  p[ARM_L + ARM.shZ] += arm;
  p[ARM_R + ARM.shZ] += arm;
  p[ARM_L + ARM.elZ] += 0.06 * Math.sin(TAU * f * t + 1.4);
  p[ARM_R + ARM.elZ] += 0.06 * Math.sin(TAU * f * t + 1.4);
  p[ARM_L + ARM.wrZ] += 0.08 * Math.sin(TAU * 0.6 * t);
  p[ARM_R + ARM.wrZ] += 0.08 * Math.sin(TAU * 0.6 * t + 2);
  // ogni tanto batte il piede a tempo
  p[CH.footRPitch] = -0.22 * Math.pow(Math.max(0, Math.sin(TAU * f * t)), 6) * smooth(0.2, 0.8, Math.sin(TAU * 0.12 * t));
}

/**
 * Intro "piombo dall'alto + rimbalzo". La scena dell'intro fa cadere il gruppo con un easeOutBounce
 * di 0.8 s (impatti a 0.29, 0.58, 0.73, 0.8 s): la clip parte quando Palmino diventa visibile
 * (vedi runtime) e mette pose e schiacciamenti esattamente su quegli impatti.
 */
const INTRO_IMPACTS: readonly [number, number][] = [
  [0.29, 1],
  [0.58, 0.45],
  [0.727, 0.2],
  [0.8, 0.08],
];
const INTRO_LEN = 1.7;

function intro(p: Pose, t: number, ctx: ClipContext) {
  void ctx;
  if (t >= INTRO_LEN) {
    // coda: dalla posa "ta-daa" all'idle
    idle(p, t - INTRO_LEN);
    const k = smooth(INTRO_LEN, INTRO_LEN + 0.6, t);
    if (k < 1) {
      p[CH.grin] = lerp(1, p[CH.grin], k);
      p[ARM_L + ARM.shZ] = lerp(0.62, p[ARM_L + ARM.shZ], k);
      p[ARM_R + ARM.shZ] = lerp(0.62, p[ARM_R + ARM.shZ], k);
    }
    return;
  }
  restPose(p);
  // schiacciamento: somma di impulsi smorzati sugli impatti
  let squash = 0;
  let land = 0;
  for (const [ti, amp] of INTRO_IMPACTS) {
    const d = t - ti;
    if (d < 0) continue;
    squash += amp * Math.exp(-d * 16) * Math.cos(d * 26);
    land = Math.max(land, amp * Math.exp(-d * 9));
  }
  const first = INTRO_IMPACTS[0][0];
  if (t < first) {
    // in caduta: allungato, braccia in alto che si agitano, piedi a penzoloni, chioma che "vola" su
    const u = t / first;
    const flail = Math.sin(TAU * 3.2 * t);
    p[CH.stretch] = 1.06 + 0.1 * u;
    p[CH.headRotX] = -0.16;
    p[CH.grin] = 1;
    p[ARM_L + ARM.shZ] = 1.25 + 0.18 * flail;
    p[ARM_R + ARM.shZ] = 1.25 - 0.18 * flail;
    p[ARM_L + ARM.shY] = p[ARM_R + ARM.shY] = 0.4;
    p[ARM_L + ARM.elZ] = 0.5 - 0.3 * flail;
    p[ARM_R + ARM.elZ] = 0.5 + 0.3 * flail;
    p[ARM_L + ARM.wrX] = p[ARM_R + ARM.wrX] = 0.3;
    p[ARM_L + ARM.curl] = p[ARM_R + ARM.curl] = -0.12;
    p[CH.footLPitch] = 0.35 + 0.1 * flail;
    p[CH.footRPitch] = 0.35 - 0.1 * flail;
    p[CH.footLLift] = p[CH.footRLift] = 0.02;
    p[CH.leafLift] = -0.55;
    p[CH.leafFlap] = 0.7;
    return;
  }
  const after = t - first;
  // "ta-daa": dopo il primo impatto le braccia scendono e si spalancano, palmi in su
  const open = smooth(0.05, 0.5, after);
  const wob = Math.exp(-Math.max(0, t - 0.8) * 4.5) * Math.sin(Math.max(0, t - 0.8) * 20);
  p[CH.stretch] = 1 - 0.3 * squash + 0.06 * wob;
  p[CH.rootY] = 0;
  p[CH.headRotX] = 0.14 * land - 0.05 * wob;
  p[CH.headRotZ] = 0.1 * wob;
  p[CH.hipsRotX] = 0.06 * land;
  p[CH.grin] = 1;
  const armDown = 0.35 * land;
  p[ARM_L + ARM.shZ] = p[ARM_R + ARM.shZ] = lerp(1.25, 0.62, open) - armDown + 0.08 * wob;
  p[ARM_L + ARM.shY] = p[ARM_R + ARM.shY] = lerp(0.4, 0.14, open);
  p[ARM_L + ARM.elZ] = p[ARM_R + ARM.elZ] = lerp(0.5, 0.25, open);
  p[ARM_L + ARM.wrX] = p[ARM_R + ARM.wrX] = lerp(0.3, -0.9, open);
  p[ARM_L + ARM.curl] = p[ARM_R + ARM.curl] = -0.05;
  // piedi: si appiattiscono all'impatto, le dita si sollevano un po' nel rimbalzo
  p[CH.footLPitch] = p[CH.footRPitch] = -0.12 * land;
  // chioma: frustata verso il basso a ogni impatto, poi vibra (le molle per foglia fanno il resto)
  p[CH.leafLift] = 0.45 * land - 0.15 * (1 - open);
  p[CH.leafFlap] = 0.5 * land;
}

function talk(p: Pose, t: number, ctx: ClipContext) {
  restPose(p);
  const g1 = Math.sin(TAU * 0.55 * t);
  const g2 = Math.sin(TAU * 0.55 * t + 2.2);
  const beat = Math.sin(TAU * 1.8 * t);
  p[CH.stretch] = 1 + 0.018 * beat;
  p[CH.rootY] = 0.006 * (beat + 1);
  p[CH.headRotX] = 0.06 * beat;
  p[CH.headRotY] = 0.16 * Math.sin(TAU * 0.27 * t);
  p[CH.headRotZ] = 0.05 * Math.sin(TAU * 0.4 * t);
  p[CH.hipsRotY] = 0.08 * Math.sin(TAU * 0.27 * t + 0.5);
  // gesti: le mani si alzano a turno, palmi in su ("ma dai!")
  p[ARM_L + ARM.shZ] = -0.15 + 0.3 * Math.max(0, g1);
  p[ARM_L + ARM.shY] = 0.75;
  p[ARM_L + ARM.elZ] = 0.55 + 0.45 * Math.max(0, g1);
  p[ARM_L + ARM.wrX] = -1.0;
  p[ARM_L + ARM.curl] = 0.35 - 0.25 * Math.max(0, g1);
  p[ARM_R + ARM.shZ] = -0.15 + 0.3 * Math.max(0, g2);
  p[ARM_R + ARM.shY] = 0.75;
  p[ARM_R + ARM.elZ] = 0.55 + 0.45 * Math.max(0, g2);
  p[ARM_R + ARM.wrX] = -1.0;
  p[ARM_R + ARM.curl] = 0.35 - 0.25 * Math.max(0, g2);
  p[CH.grin] = ctx.autoChatter
    ? 0.12 + 0.75 * Math.abs(Math.sin(TAU * 2.9 * t) * Math.sin(TAU * 1.15 * t + 0.8))
    : 0.2;
}

function wave(p: Pose, t: number) {
  restPose(p);
  const w = Math.sin(TAU * 2.1 * t);
  // saluta con la mano destra (-X, lato sinistro dello schermo)
  // braccio più aperto e in avanti: la mano che saluta resta davanti alla chioma anche di 3/4
  p[ARM_R + ARM.shZ] = 1.15;
  p[ARM_R + ARM.shY] = 1.0;
  p[ARM_R + ARM.elY] = 0.35;
  // il saluto è soprattutto di polso: il gomito oscilla poco, così la mano non passa dietro la testa
  p[ARM_R + ARM.elZ] = 0.3 + 0.3 * w;
  p[ARM_R + ARM.wrX] = 0.15;
  p[ARM_R + ARM.wrZ] = 0.5 * Math.sin(TAU * 2.1 * t + 0.7);
  p[ARM_R + ARM.curl] = -0.08;
  p[ARM_R + ARM.index] = -0.08;
  p[ARM_L + ARM.shZ] = 0.15 + 0.05 * w;
  p[ARM_L + ARM.shY] = 0.35;
  p[ARM_L + ARM.elZ] = 0.35;
  p[CH.hipsRotZ] = -0.06 * Math.sin(TAU * 1.05 * t);
  p[CH.headRotZ] = -0.1 + 0.07 * Math.sin(TAU * 1.05 * t + 1);
  p[CH.headRotY] = -0.12;
  p[CH.rootY] = 0.014 * (1 + Math.sin(TAU * 2.1 * t));
  p[CH.stretch] = 1 + 0.03 * Math.sin(TAU * 2.1 * t);
  p[CH.grin] = 0.88;
}

function celebrate(p: Pose, t: number) {
  restPose(p);
  const f = 1.7;
  const ph = (t * f) % 1;
  p[CH.rootY] = 0.26 * 4 * ph * (1 - ph);
  p[CH.stretch] = 1 + 0.14 * Math.sin(Math.PI * ph) - 0.3 * Math.exp(-ph * 16) - 0.12 * Math.exp(-(1 - ph) * 30);
  p[CH.rootRotY] = 0.3 * Math.sin(TAU * 0.42 * t);
  p[CH.headRotX] = -0.1 * Math.sin(Math.PI * ph);
  p[CH.headRotZ] = 0.08 * Math.sin(TAU * 0.85 * t);
  const pump = Math.sin(TAU * f * t);
  p[ARM_L + ARM.shZ] = 1.3 + 0.22 * pump;
  p[ARM_R + ARM.shZ] = 1.3 - 0.22 * pump;
  // braccia un po' in avanti: le mani restano davanti alla chioma (niente compenetrazioni)
  p[ARM_L + ARM.shY] = p[ARM_R + ARM.shY] = 0.62;
  p[ARM_L + ARM.elZ] = 0.35 + 0.3 * pump;
  p[ARM_R + ARM.elZ] = 0.35 - 0.3 * pump;
  p[ARM_L + ARM.wrX] = p[ARM_R + ARM.wrX] = 0.25;
  p[ARM_L + ARM.curl] = p[ARM_R + ARM.curl] = -0.1;
  p[CH.footLPitch] = p[CH.footRPitch] = -0.35 * Math.sin(Math.PI * ph);
  p[CH.footLLift] = p[CH.footRLift] = 0.03 * Math.sin(Math.PI * ph);
  p[CH.leafFlap] = 1;
  p[CH.grin] = 1;
}

function surprised(p: Pose, t: number) {
  restPose(p);
  const k = smooth(0, 0.14, t);
  const hop = t < 0.36 ? Math.sin(Math.PI * (t / 0.36)) : 0;
  const tremble = Math.sin(TAU * 11 * t) * smooth(0.3, 0.6, t);
  p[CH.rootY] = 0.13 * hop;
  p[CH.rootZ] = -0.09 * k;
  p[CH.rootX] = 0.004 * tremble;
  p[CH.stretch] = 1 + 0.16 * hop + 0.05 * k + 0.008 * tremble;
  p[CH.headRotX] = -0.2 * k;
  p[CH.hipsRotX] = -0.06 * k;
  // mani alzate davanti al viso ("whoa!"), ben visibili davanti alla chioma
  p[ARM_L + ARM.shZ] = p[ARM_R + ARM.shZ] = lerp(0.4, 0.55, k);
  p[ARM_L + ARM.shY] = p[ARM_R + ARM.shY] = lerp(0.28, 0.95, k);
  p[ARM_L + ARM.elZ] = p[ARM_R + ARM.elZ] = lerp(0.14, 0.95, k);
  p[ARM_L + ARM.wrX] = p[ARM_R + ARM.wrX] = lerp(-0.55, 0.45, k);
  p[ARM_L + ARM.curl] = p[ARM_R + ARM.curl] = lerp(0.15, -0.22, k);
  p[ARM_L + ARM.index] = p[ARM_R + ARM.index] = lerp(0.1, -0.22, k);
  p[ARM_L + ARM.thumb] = p[ARM_R + ARM.thumb] = lerp(0.12, -0.2, k);
  p[CH.leafLift] = -0.55 * k;
  p[CH.leafFlap] = 0.5 * smooth(0, 0.1, t) * (1 - smooth(0.6, 1.4, t)) + 0.15;
  p[CH.grin] = lerp(0.8, 1, k);
}

function point(p: Pose, t: number) {
  restPose(p);
  // punta in avanti (verso il pubblico) con la mano sinistra (+X), l'altra sul fianco
  const poke = Math.pow(Math.max(0, Math.sin(TAU * 0.8 * t)), 8);
  p[ARM_L + ARM.shZ] = 0.2 + 0.03 * poke;
  p[ARM_L + ARM.shY] = 0.85 + 0.12 * poke;
  p[ARM_L + ARM.elZ] = 0.06;
  p[ARM_L + ARM.elY] = 0.02;
  p[ARM_L + ARM.wrX] = 0.1;
  p[ARM_L + ARM.wrZ] = 0.05;
  p[ARM_L + ARM.curl] = 1.65;
  p[ARM_L + ARM.index] = -0.05;
  p[ARM_L + ARM.thumb] = 0.7;
  // mano destra sul fianco
  p[ARM_R + ARM.shZ] = -0.55;
  p[ARM_R + ARM.shY] = -0.25;
  p[ARM_R + ARM.elZ] = 0.2;
  p[ARM_R + ARM.elY] = -1.5;
  p[ARM_R + ARM.wrX] = -0.3;
  p[ARM_R + ARM.curl] = 0.6;
  p[CH.hipsRotX] = 0.05;
  p[CH.hipsRotY] = -0.12;
  p[CH.headRotX] = 0.06 + 0.04 * poke;
  p[CH.headRotY] = 0.18;
  p[CH.headRotZ] = -0.06;
  p[CH.rootY] = 0.01 * poke;
  p[CH.stretch] = 1 + 0.03 * poke + 0.012 * Math.sin(TAU * 1.1 * t);
  p[CH.grin] = 0.78;
}

/**
 * RUOTA DI PALMINO: Palmino spinge la ruota con un colpo del braccio destro (lato −X, a sinistra
 * sullo schermo: la ruota è alla sua destra). Tempi della clip (s):
 *  0.00–0.38 carica: braccio alto e piegato, busto che ruota indietro, sulle punte;
 *  0.38–0.58 COLPO: il braccio scende di scatto in avanti e in basso (la mano "trascina" il bordo
 *            della ruota verso il basso: con Palmino a destra della ruota la fa girare in senso
 *            orario), il busto si avvita, schiacciamento;
 *  0.58–1.10 accompagnamento: braccio disteso in basso, saltello di gioia, chioma che sbatte;
 *  1.10–1.60 ritorno al riposo.
 * Il TV fa partire la clip SPIN_CONTACT_S prima della partenza della ruota (palmino-wheel.ts):
 * il colpo arriva quando la ruota comincia a muoversi.
 */
export const SPIN_LEN = 1.6;
export const SPIN_CONTACT_S = 0.45;

function spin(p: Pose, t: number) {
  if (t >= SPIN_LEN) return idle(p, t - SPIN_LEN);
  restPose(p);
  const windup = smooth(0, 0.38, t);
  const strike = smooth(0.38, 0.58, t);
  const settle = smooth(1.1, SPIN_LEN, t);
  // braccio destro: alto e piegato → giù e in avanti, disteso
  const shZ = lerp(lerp(0.14, 1.6, windup), -0.55, strike);
  const shY = lerp(lerp(0.16, 0.3, windup), 0.4, strike);
  const elZ = lerp(lerp(0.22, 0.85, windup), 0.05, strike);
  p[ARM_R + ARM.shZ] = lerp(shZ, 0.14, settle);
  p[ARM_R + ARM.shY] = lerp(shY, 0.16, settle);
  p[ARM_R + ARM.elZ] = lerp(elZ, 0.22, settle);
  p[ARM_R + ARM.wrX] = lerp(lerp(-0.6, 0.35, windup), -0.25, strike);
  p[ARM_R + ARM.curl] = lerp(lerp(0.15, -0.15, windup), 0.25, strike);
  p[ARM_R + ARM.index] = p[ARM_R + ARM.curl] * 0.6;
  // braccio sinistro: bilanciere (si apre durante il colpo)
  p[ARM_L + ARM.shZ] = lerp(lerp(0.14, 0.3, windup), 0.45, strike) * (1 - settle) + 0.14 * settle;
  p[ARM_L + ARM.shY] = lerp(0.16, 0.35, windup);
  // busto: si carica girandosi indietro, poi si avvita nel colpo
  // (torsione contenuta: il braccio destro deve restare davanti, in vista)
  const twist = lerp(lerp(0, 0.18, windup), -0.22, strike) * (1 - settle);
  p[CH.rootRotY] = twist;
  p[CH.hipsRotY] = 0.5 * twist;
  // si piega lontano dalla ruota nella carica e verso la ruota nel colpo
  p[CH.highRotZ] = lerp(lerp(0, -0.1, windup), 0.16, strike) * (1 - settle);
  p[CH.lowRotZ] = lerp(lerp(0, -0.05, windup), 0.08, strike) * (1 - settle);
  p[CH.headRotY] = -0.6 * twist;
  p[CH.headRotX] = lerp(lerp(0, -0.12, windup), 0.1, strike) * (1 - settle);
  // sulle punte in carica, schiacciato sul colpo, poi saltello di gioia
  const hit = t > 0.5 ? Math.exp(-(t - 0.5) * 9) : 0;
  const hop = t > 0.62 && t < 0.98 ? Math.sin(Math.PI * ((t - 0.62) / 0.36)) : 0;
  p[CH.rootY] = 0.025 * windup * (1 - strike) + 0.09 * hop;
  p[CH.stretch] = 1 + 0.07 * windup * (1 - strike) - 0.16 * hit + 0.08 * hop;
  p[CH.footLPitch] = p[CH.footRPitch] = -0.25 * windup * (1 - strike) - 0.3 * hop;
  // chioma: frustata nel colpo e sbattuta nel saltello
  p[CH.leafLift] = -0.35 * windup * (1 - strike) + 0.4 * hit;
  p[CH.leafFlap] = 0.3 + 0.7 * hit + 0.5 * hop;
  p[CH.grin] = lerp(0.85, 1, windup);
}

/** Durata delle clip one-shot (le altre sono in loop). */
export const ONE_SHOT: Partial<Record<CharacterAnimation, number>> = { intro: INTRO_LEN, surprised: 0.6, spin: SPIN_LEN };

export function evaluateClip(anim: CharacterAnimation, p: Pose, t: number, ctx: ClipContext) {
  switch (anim) {
    case "idle":
      return idle(p, t);
    case "intro":
      return intro(p, t, ctx);
    case "talk":
      return talk(p, t, ctx);
    case "wave":
      return wave(p, t);
    case "celebrate":
      return celebrate(p, t);
    case "surprised":
      return surprised(p, t);
    case "point":
      return point(p, t);
    case "spin":
      return spin(p, t);
  }
}

/**
 * Rigidità per canale delle molle che inseguono la posa: valori bassi = più rimbalzo
 * (segmenti del tronco, testa), alti = risposta pronta (radice, piedi).
 */
export function channelStiffness(): Float32Array {
  const k = new Float32Array(CHANNEL_COUNT).fill(260);
  const set = (names: Channel[], v: number) => names.forEach((n) => (k[CH[n]] = v));
  set(["rootX", "rootY", "rootZ", "rootRotY", "footLLift", "footRLift", "footLPitch", "footRPitch"], 0);
  set(["stretch"], 420);
  set(["hipsRotX", "hipsRotY", "hipsRotZ"], 170);
  set(["lowRotX", "lowRotZ", "highRotX", "highRotZ"], 140);
  set(["headRotX", "headRotY", "headRotZ"], 120);
  set(["grin"], 0);
  return k;
}
