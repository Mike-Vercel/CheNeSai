import type { ShotId } from "./studio-director";
import { LED_WALL, MARKS, PORTAL_SPOT, WHEEL_CENTER, WHEEL_RADIUS } from "./studio-layout";

/**
 * Inquadrature dello studio (pure, testate): ogni inquadratura è un "soggetto" (centro e mezze misure in metri)
 * visto da una direzione (yaw/pitch in gradi). La distanza si calcola perché il soggetto stia nella FINESTRA libera
 * dall'interfaccia (rettangolo in frazioni del canvas), e il centro dell'obiettivo si sposta (lens shift) sul centro
 * della finestra: l'interfaccia non copre mai la ruota o il presentatore.
 */
export interface ShotDef {
  center: [number, number, number];
  /** mezza larghezza e mezza altezza da far stare nel quadro */
  half: [number, number];
  /** gradi: 0 = di fronte, positivo = camera spostata verso +X (destra) */
  yaw: number;
  /** gradi: positivo = camera più in alto che guarda in giù */
  pitch: number;
  fov: number;
  /** oscillazione lenta della camera (gradi di yaw, periodo in secondi) */
  orbit?: { amp: number; period: number };
  /** variante per finestre strette o basse (telefono): soggetto più raccolto, la scena non diventa minuscola */
  compact?: Partial<Pick<ShotDef, "center" | "half" | "pitch" | "yaw">>;
}

const W = WHEEL_CENTER;
const WR = WHEEL_RADIUS;
const HOME = MARKS.home;

/** La coppia sulla pedana: dal fianco sinistro di Don Patrizio al bordo destro della ruota. */
const PAIR_L = HOME.x - 0.45;
const PAIR_R = W.x + WR * 1.3;
const PAIR_X = (PAIR_L + PAIR_R) / 2;
const PAIR_HALF = (PAIR_R - PAIR_L) / 2;

export const SHOTS: Record<ShotId, ShotDef> = {
  /** campo lungo: pedana con presentatore e ruota, schermo LED sopra */
  wide: { center: [PAIR_X, 1.95, -0.2], half: [3.3, 2.05], yaw: 4, pitch: 8, fov: 36, orbit: { amp: 6, period: 26 }, compact: { center: [PAIR_X, 1.6, 0.5], half: [PAIR_HALF + 0.25, 1.7] } },
  /** presentatore + ruota, figure intere, titolo del LED in alto */
  duo: { center: [PAIR_X, 1.7, 0.75], half: [PAIR_HALF + 0.1, 1.85], yaw: 8, pitch: 5, fov: 34, orbit: { amp: 2.5, period: 18 }, compact: { center: [PAIR_X - 0.05, 1.55, 0.8], half: [PAIR_HALF + 0.2, 1.6] } },
  /** prima del giro: il presentatore al bordo della ruota, pronto a spingerla */
  spin: { center: [(MARKS.push.x - 0.4 + PAIR_R) / 2, 1.45, 0.7], half: [(PAIR_R - MARKS.push.x + 0.4) / 2 + 0.1, 1.45], yaw: 6, pitch: 4, fov: 34 },
  /** la ruota riempie il quadro (fine della carrellata del giro) */
  wheel: { center: [W.x, W.y + 0.1, W.z], half: [WR * 1.42, WR * 1.62], yaw: 0, pitch: 3, fov: 32 },
  /** primo piano dello spicchio vincente sotto il puntatore */
  sector: { center: [W.x, W.y + WR * 0.78, W.z], half: [WR * 0.95, WR * 0.62], yaw: 0, pitch: 4, fov: 30 },
  /** mezza figura di Don Patrizio, di tre quarti */
  presenter: { center: [HOME.x + 0.05, 1.55, HOME.z], half: [0.72, 0.62], yaw: 22, pitch: 3, fov: 30, orbit: { amp: 1.5, period: 12 } },
  /** figura intera (ingresso, passaggio del telefono) */
  presenterFull: { center: [(HOME.x + MARKS.center.x) / 2, 1.05, (HOME.z + MARKS.center.z) / 2], half: [1.25, 1.15], yaw: 14, pitch: 5, fov: 32 },
  /** ruota + portale di Zafira */
  jolly: { center: [(W.x - WR * 1.3 + PORTAL_SPOT.x + 0.75) / 2, 1.45, 0.9], half: [(PORTAL_SPOT.x + 0.75 - W.x + WR * 1.3) / 2 + 0.1, 1.55], yaw: -9, pitch: 5, fov: 34, compact: { half: [(PORTAL_SPOT.x + 0.75 - W.x + WR * 1.3) / 2, 1.55] } },
  /** schermo LED con il Tabellone Segreto, quasi frontale */
  board: { center: [0, LED_WALL.y + 0.1, LED_WALL.z], half: [LED_WALL.width * 0.5, LED_WALL.height * 0.52], yaw: 0, pitch: 10, fov: 34, compact: { center: [0, LED_WALL.y + 0.3, LED_WALL.z], half: [LED_WALL.width * 0.4, LED_WALL.height * 0.4], pitch: 8 } },
  /** classifica: campo largo che gira piano, LED in vista sopra la ruota */
  standings: { center: [0, 2.3, -1.0], half: [3.5, 2.2], yaw: 0, pitch: 9, fov: 36, orbit: { amp: 9, period: 30 }, compact: { center: [0, 2.6, -1.3], half: [3.3, 2.05], pitch: 11 } },
  /** vincitore: orbita di festa attorno alla pedana */
  winner: { center: [(MARKS.center.x + PAIR_R) / 2 - 0.3, 1.4, 0.95], half: [1.95, 1.55], yaw: 0, pitch: 9, fov: 34, orbit: { amp: 22, period: 18 }, compact: { center: [(MARKS.center.x + PAIR_R) / 2 - 0.3, 1.45, 0.95], half: [1.8, 1.6] } },
  /** intro: campo lunghissimo dall'alto (gru), tutto lo studio con l'ingresso del presentatore da sinistra */
  establish: { center: [-0.9, 2.3, -0.3], half: [5.6, 3.1], yaw: -14, pitch: 15, fov: 38, orbit: { amp: 4, period: 34 }, compact: { center: [-0.4, 2.5, -0.4], half: [3.3, 3.4], pitch: 14 } },
  /** intro: il titolo sullo schermo LED con presentatore e ruota sotto, quasi frontale */
  /** intro: mezza figura di Don Patrizio al centro del palco (la ruota resta di lato) */
  host: { center: [MARKS.center.x + 0.1, 1.42, MARKS.center.z], half: [0.95, 0.78], yaw: -20, pitch: 3, fov: 30, orbit: { amp: 1.5, period: 14 }, compact: { center: [MARKS.center.x, 1.3, MARKS.center.z], half: [0.72, 1.0], yaw: -16 } },
  /** intro: il titolo sullo schermo LED con presentatore e ruota sotto, frontale e un po' dall'alto (la ruota non copre lo slogan) */
  title: { center: [0, 2.95, -0.9], half: [LED_WALL.width * 0.47, 2.9], yaw: 0, pitch: 13, fov: 36, orbit: { amp: 1.5, period: 20 }, compact: { center: [0, 3.05, -1.6], half: [LED_WALL.width * 0.36, 2.9], pitch: 12 } },
};

/** Finestra "stretta" (in pixel larghezza/altezza): si usa la variante compatta dell'inquadratura. */
export const COMPACT_RATIO = 1.25;

/** L'inquadratura da usare per una finestra di questo rapporto (pixel). */
export function shotFor(id: ShotId, windowRatio: number): ShotDef {
  const def = SHOTS[id];
  return windowRatio < COMPACT_RATIO && def.compact ? { ...def, ...def.compact } : def;
}

/** Distanza massima della camera: oltre, la nebbia dello studio mangerebbe la scena. */
export const MAX_DISTANCE = 26;

/** Finestra libera dall'interfaccia: frazioni del canvas (0..1), y dall'alto. */
export interface FrameWindow {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export const FULL_WINDOW: FrameWindow = { x0: 0, y0: 0, x1: 1, y1: 1 };

/** Distanza perché il soggetto (mezze misure) stia nella finestra, con un margine. */
export function fitDistance(half: [number, number], fovDeg: number, aspect: number, win: FrameWindow, margin = 1.08): number {
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const fw = Math.max(0.12, win.x1 - win.x0);
  const fh = Math.max(0.12, win.y1 - win.y0);
  const byH = (half[1] * margin) / (t * fh);
  const byW = (half[0] * margin) / (t * Math.max(0.2, aspect) * fw);
  return Math.min(MAX_DISTANCE, Math.max(byH, byW));
}

/** Spostamento dell'obiettivo (coordinate NDC, −1..1) che porta il centro del quadro al centro della finestra. */
export function lensShift(win: FrameWindow): { x: number; y: number } {
  return { x: win.x0 + win.x1 - 1, y: 1 - (win.y0 + win.y1) };
}

/** Posizione della camera: dal centro del soggetto, a distanza d, nella direzione yaw/pitch. */
export function cameraPosition(center: readonly number[], yawDeg: number, pitchDeg: number, d: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  out[0] = center[0] + d * Math.sin(y) * Math.cos(p);
  out[1] = center[1] + d * Math.sin(p);
  out[2] = center[2] + d * Math.cos(y) * Math.cos(p);
  return out;
}

/**
 * Smorzamento critico (come SmoothDamp di Unity): avvicina `cur` a `target` in circa `smooth` secondi senza
 * oscillare; `vel` è lo stato della velocità (modificato). smooth ≤ 0 = salto immediato.
 */
export function smoothDamp(cur: number, target: number, vel: { v: number }, smooth: number, dt: number): number {
  if (smooth <= 0 || dt <= 0) {
    vel.v = 0;
    return smooth <= 0 ? target : cur;
  }
  const omega = 2 / smooth;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  // niente superamento del bersaglio
  if (target - cur > 0 === out > target) {
    out = target;
    vel.v = 0;
  }
  return out;
}
