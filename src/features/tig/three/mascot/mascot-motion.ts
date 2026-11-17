import type { MascotLevel, MascotProps } from "../../arena-contract";

/**
 * MOVIMENTI PROCEDURALI DELLE MASCOTTE (puri, testati). Valgono per il segnaposto e, finché un modello vero non ha
 * la sua clip, anche per i GLB futuri (si applicano al gruppo radice: saltelli, inclinazioni, scosse, rotazioni).
 * Tutte le curve tornano a riposo: nessuna azione lascia la mascotte storta o fuori dal suo tavolo.
 */

export type MascotAction = MascotProps["action"];

export interface MascotPose {
  /** sollevamento (m, unità della mascotte alta 1) */
  y: number;
  /** spostamento in avanti (+) / indietro (−) */
  z: number;
  /** scossa laterale */
  x: number;
  /** rotazione attorno a Y (radianti, si somma al riposo) */
  rotY: number;
  /** inclinazione avanti (+) / indietro (−) */
  tiltX: number;
  /** inclinazione laterale */
  tiltZ: number;
  /** scala uniforme */
  scale: number;
  /** schiacciamento verticale (1 = niente; <1 schiacciata, >1 allungata) */
  squash: number;
  /** intensità della luce propria (1 = normale) */
  glow: number;
  /** lampo bianco 0..1 (attacco, evoluzione) */
  flash: number;
  /** lampo rosso 0..1 (colpo subito) */
  hurt: number;
}

export function restPose(out?: MascotPose): MascotPose {
  const p = out ?? ({} as MascotPose);
  p.y = 0;
  p.z = 0;
  p.x = 0;
  p.rotY = 0;
  p.tiltX = 0;
  p.tiltZ = 0;
  p.scale = 1;
  p.squash = 1;
  p.glow = 1;
  p.flash = 0;
  p.hurt = 0;
  return p;
}

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

/** Durata (s) dei movimenti "a colpo singolo"; gli altri sono in ciclo. */
export const ACTION_LENGTH: Partial<Record<MascotAction, number>> = { hit: 1.4, evolve: 3.2 };

/** Istante (s) del lampo dell'evoluzione (cambio di livello visibile). */
export const EVOLVE_BURST_S = 1.65;

/**
 * Posa della mascotte. `t` = secondi dall'inizio dell'azione, `clock` = tempo globale (riposo che respira),
 * `level` = livello di evoluzione (il 3 ha un riposo speciale, più leggero e solenne).
 */
export function mascotPose(action: MascotAction, t: number, clock: number, level: MascotLevel, out?: MascotPose): MascotPose {
  const p = restPose(out);
  // riposo: galleggia piano (il livello 3 levita più in alto e disegna un piccolo otto)
  const bobAmp = level === 3 ? 0.06 : level === 2 ? 0.045 : 0.035;
  p.y = bobAmp * Math.sin(clock * (level === 3 ? 1.2 : 1.6));
  if (level === 3) {
    p.tiltZ = 0.05 * Math.sin(clock * 0.8);
    p.tiltX = 0.03 * Math.sin(clock * 1.6);
  }
  p.glow = level === 3 ? 1.35 : level === 2 ? 1.15 : 1;
  switch (action) {
    case "idle":
      break;
    case "cheer": {
      // saltelli a 1,6 Hz: schiacciata all'atterraggio, mezzo giro ogni tanto
      const ph = (t * 1.6) % 1;
      const hop = Math.sin(ph * Math.PI);
      p.y += hop * 0.24;
      p.squash = ph < 0.12 || ph > 0.88 ? 0.86 : 1 + hop * 0.06;
      p.rotY += Math.sin(t * 2.2) * 0.35;
      p.glow *= 1.25;
      break;
    }
    case "sad": {
      // si abbassa e si inclina avanti, luce smorzata, piccolo dondolio
      const k = smooth(0, 0.5, t);
      p.y -= 0.05 * k;
      p.tiltX += 0.28 * k;
      p.tiltZ += 0.06 * Math.sin(t * 1.4) * k;
      p.scale = 1 - 0.06 * k;
      p.glow *= 1 - 0.45 * k;
      break;
    }
    case "attack": {
      // carica indietro, affondo in avanti con lampo, rientro (ciclo di 1,6 s)
      const c = t % 1.6;
      const wind = smooth(0, 0.28, c) * (1 - smooth(0.28, 0.4, c));
      const lunge = smooth(0.28, 0.42, c) * (1 - smooth(0.62, 1.05, c));
      p.z += -0.12 * wind + 0.38 * lunge;
      p.tiltX += -0.22 * wind + 0.35 * lunge;
      p.squash = 1 + 0.08 * wind - 0.06 * lunge;
      p.flash = lunge * (1 - smooth(0.42, 0.75, c));
      p.glow *= 1 + 0.5 * lunge;
      break;
    }
    case "hit": {
      // contraccolpo, scossa che si smorza, lampo rosso
      const back = smooth(0, 0.1, t) * (1 - smooth(0.25, 0.9, t));
      p.z -= 0.26 * back;
      p.tiltX -= 0.3 * back;
      const decay = Math.exp(-t * 3.5);
      p.x += 0.07 * Math.sin(t * 42) * decay;
      p.tiltZ += 0.12 * Math.sin(t * 30) * decay;
      p.hurt = clamp01(1 - t / 0.9);
      p.squash = 1 - 0.1 * back;
      break;
    }
    case "evolve": {
      // carica (sale e gira sempre più veloce), LAMPO al cambio di livello, ricaduta morbida
      const rise = smooth(0, EVOLVE_BURST_S, t) * (1 - smooth(EVOLVE_BURST_S + 0.3, 3.2, t));
      p.y += 0.38 * rise;
      const spin = t < EVOLVE_BURST_S ? (t * t * 3.2) : EVOLVE_BURST_S * EVOLVE_BURST_S * 3.2 + (t - EVOLVE_BURST_S) * 5 * Math.exp(-(t - EVOLVE_BURST_S) * 1.5);
      p.rotY += spin;
      const burst = Math.exp(-Math.abs(t - EVOLVE_BURST_S) * 9);
      p.scale = 1 + 0.08 * Math.sin(t * 18) * smooth(0.4, EVOLVE_BURST_S, t) * (t < EVOLVE_BURST_S ? 1 : 0) + 0.28 * burst;
      p.flash = burst;
      p.glow *= 1 + 1.6 * rise + 2 * burst;
      break;
    }
    case "win": {
      // sale, gira lento e solenne, rimbalzo leggero, luce piena
      const up = smooth(0, 0.6, t);
      p.y += 0.2 * up + 0.05 * Math.abs(Math.sin(t * 3.2));
      p.rotY += t * TAU * 0.35;
      p.scale = 1 + 0.08 * up;
      p.glow *= 1.6;
      break;
    }
  }
  return p;
}

/** Il movimento richiede 60 fps (in ciclo o non ancora finito). */
export function actionIsLively(action: MascotAction, t: number): boolean {
  if (action === "idle") return false;
  const len = ACTION_LENGTH[action];
  return len === undefined || t < len + 0.3;
}

/** Livello mostrato durante l'evoluzione: il vecchio fino al lampo, poi il nuovo. */
export function shownLevel(action: MascotAction, t: number, level: MascotLevel, previous: MascotLevel): MascotLevel {
  if (action !== "evolve" || previous >= level) return level;
  return t < EVOLVE_BURST_S ? previous : level;
}
