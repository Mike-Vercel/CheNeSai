/**
 * MATEMATICA DELLA CAMERA dell'arena (pura, testata). Una inquadratura = un CENTRO e un insieme di PUNTI da far
 * stare nel quadro, visti da una direzione (yaw/pitch). La distanza si calcola punto per punto (prospettiva vera:
 * i punti vicini alla camera contano di più) perché tutto stia nella FINESTRA libera dall'HUD; poi l'obiettivo si
 * sposta (view offset / lens shift) sul centro della finestra: l'HUD non copre mai il soggetto.
 */

export type Vec3 = readonly [number, number, number];

/** Finestra libera dall'HUD in frazioni del canvas (0..1), origine in alto a sinistra (come un DOMRect). */
export interface FrameWindow {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const FULL_WINDOW: FrameWindow = { x0: 0, y0: 0, x1: 1, y1: 1 };

/** Lato minimo della finestra (frazione): sotto, l'HUD si considera a tutto schermo e si usa tutto il canvas. */
const MIN_SIDE = 0.15;

/**
 * `safeArea` del contratto → finestra. Interpretazione principale: BORDI del rettangolo libero misurati dall'angolo
 * in alto a sinistra (left < right, top < bottom, come un DOMRect diviso per il canvas). Se i valori non formano un
 * rettangolo valido (es. { left: 0, top: 0, right: 0, bottom: 0.4 }) si leggono come MARGINI occupati dall'HUD.
 */
export function normalizeSafeArea(sa?: { left: number; top: number; right: number; bottom: number } | null): FrameWindow {
  if (!sa) return FULL_WINDOW;
  const c = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  const l = c(sa.left);
  const t = c(sa.top);
  const r = c(sa.right);
  const b = c(sa.bottom);
  if (r - l >= MIN_SIDE && b - t >= MIN_SIDE) return { x0: l, y0: t, x1: r, y1: b };
  // margini
  const x0 = l;
  const x1 = 1 - r;
  const y0 = t;
  const y1 = 1 - b;
  if (x1 - x0 >= MIN_SIDE && y1 - y0 >= MIN_SIDE) return { x0, y0, x1, y1 };
  return FULL_WINDOW;
}

/** Spostamento dell'obiettivo (NDC −1..1) che porta il centro del quadro al centro della finestra. */
export function lensShift(win: FrameWindow): { x: number; y: number } {
  return { x: win.x0 + win.x1 - 1, y: 1 - (win.y0 + win.y1) };
}

export interface CameraBasis {
  /** direzione dal centro verso la camera */
  dir: [number, number, number];
  right: [number, number, number];
  up: [number, number, number];
  /** verso cui guarda la camera (−dir) */
  fwd: [number, number, number];
}

/** Assi della camera per yaw/pitch in gradi (yaw 0 = davanti, + = camera verso +X; pitch + = dall'alto). */
export function cameraBasis(yawDeg: number, pitchDeg: number): CameraBasis {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  const dir: [number, number, number] = [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)];
  const fwd: [number, number, number] = [-dir[0], -dir[1], -dir[2]];
  const right: [number, number, number] = [Math.cos(y), 0, -Math.sin(y)];
  // up = right × fwd
  const up: [number, number, number] = [
    right[1] * fwd[2] - right[2] * fwd[1],
    right[2] * fwd[0] - right[0] * fwd[2],
    right[0] * fwd[1] - right[1] * fwd[0],
  ];
  return { dir, right, up, fwd };
}

/** Posizione della camera: dal centro, a distanza d, nella direzione yaw/pitch. */
export function cameraPosition(center: Vec3, yawDeg: number, pitchDeg: number, d: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  out[0] = center[0] + d * Math.sin(y) * Math.cos(p);
  out[1] = center[1] + d * Math.sin(p);
  out[2] = center[2] + d * Math.cos(y) * Math.cos(p);
  return out;
}

/** Distanza massima della camera (oltre, la nebbia mangerebbe l'arena). */
export const MAX_DISTANCE = 60;
/** Distanza minima davanti al punto più vicino. */
const NEAR_GAP = 0.8;

/**
 * Distanza minima perché TUTTI i punti stiano nella finestra (con un margine), con la camera che guarda `center`
 * da yaw/pitch e l'obiettivo spostato sul centro della finestra. Prospettiva esatta: per ogni punto
 * |x| ≤ (d + z) · tan(fov/2) · aspect · larghezza e |y| ≤ (d + z) · tan(fov/2) · altezza della finestra.
 */
export function fitDistance(points: readonly Vec3[], center: Vec3, yawDeg: number, pitchDeg: number, fovDeg: number, aspect: number, win: FrameWindow, margin = 1.08): number {
  const { right, up, fwd } = cameraBasis(yawDeg, pitchDeg);
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const fw = Math.max(MIN_SIDE, win.x1 - win.x0);
  const fh = Math.max(MIN_SIDE, win.y1 - win.y0);
  const hx = t * Math.max(0.2, aspect) * fw;
  const hy = t * fh;
  let d = 1;
  for (const p of points) {
    const rx = p[0] - center[0];
    const ry = p[1] - center[1];
    const rz = p[2] - center[2];
    const x = rx * right[0] + ry * right[1] + rz * right[2];
    const y = rx * up[0] + ry * up[1] + rz * up[2];
    const z = rx * fwd[0] + ry * fwd[1] + rz * fwd[2];
    d = Math.max(d, (Math.abs(x) * margin) / hx - z, (Math.abs(y) * margin) / hy - z, NEAR_GAP - z);
  }
  return Math.min(MAX_DISTANCE, d);
}

/**
 * Proiezione di un punto sul canvas (frazioni 0..1, y dall'alto) con camera e lens shift come nell'arena.
 * Serve ai test (tutto dentro la finestra?) e a posizionare eventuali etichette HTML.
 */
export function projectToCanvas(p: Vec3, center: Vec3, yawDeg: number, pitchDeg: number, d: number, fovDeg: number, aspect: number, win: FrameWindow): { x: number; y: number; depth: number } {
  const { right, up, fwd } = cameraBasis(yawDeg, pitchDeg);
  const cam = cameraPosition(center, yawDeg, pitchDeg, d);
  const rx = p[0] - cam[0];
  const ry = p[1] - cam[1];
  const rz = p[2] - cam[2];
  const x = rx * right[0] + ry * right[1] + rz * right[2];
  const y = rx * up[0] + ry * up[1] + rz * up[2];
  const z = rx * fwd[0] + ry * fwd[1] + rz * fwd[2];
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const ndcX = x / (z * t * aspect);
  const ndcY = y / (z * t);
  const sh = lensShift(win);
  // NDC → canvas: il centro ottico finisce al centro della finestra
  return { x: (ndcX + sh.x + 1) / 2, y: (1 - (ndcY + sh.y)) / 2, depth: z };
}

/**
 * Smorzamento critico (SmoothDamp): avvicina `cur` a `target` in circa `smooth` secondi senza oscillare;
 * `vel.v` è lo stato della velocità. smooth ≤ 0 = salto immediato.
 */
export function smoothDamp(cur: number, target: number, vel: { v: number }, smooth: number, dt: number): number {
  if (smooth <= 0 || dt <= 0) {
    if (smooth <= 0) vel.v = 0;
    return smooth <= 0 ? target : cur;
  }
  const omega = 2 / smooth;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  if (target - cur > 0 === out > target) {
    out = target;
    vel.v = 0;
  }
  return out;
}

/** Angolo (gradi) avvicinato per la via più corta. */
export function wrapDeg(a: number): number {
  let d = a % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}
