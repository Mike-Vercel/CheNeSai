import type { WheelSpinCommand } from "./types";

/**
 * Matematica della ruota di GIRAMENTE!: PURA e DETERMINISTICA (nessun Math.random, nessuno stato).
 * Dato il comando del server ({ spinId, targetIndex, startedAt, durationMs }) e l'ora del server,
 * ogni client calcola lo stesso angolo nello stesso istante e si ferma esattamente su targetIndex:
 * TV, telefoni, chi si riconnette a metà giro o entra in ritardo.
 *
 * Convenzioni (le stesse di ruota.js dell'utente):
 *  - angolo del rotore `a` in radianti, rotazione attorno a Z, positivo = antiorario visto da davanti;
 *  - sul disco lo spicchio i occupa gli angoli "canvas" [i·s, (i+1)·s] (s = 2π/n, senso orario da destra);
 *  - il puntatore sta in alto: sotto c'è l'angolo canvas φ = a − π/2;
 *  - girando (a che cresce) sotto il puntatore passano 0, 1, 2, …
 *
 * Profilo del giro (u = tempo normalizzato 0..1):
 *  - ATTIVAZIONE: un piccolo strappo all'indietro nei primi istanti (WINDUP_RAD),
 *  - ACCELERAZIONE morbida fino a u = ACCEL_END (velocità a smoothstep),
 *  - RALLENTAMENTO progressivo fino a velocità zero (velocità ∝ (1−u)², posizione cubica),
 *  - ARRESTO preciso: per t ≥ startedAt + durationMs l'angolo è esattamente restAngle(targetIndex).
 */

export const TAU = Math.PI * 2;

/** Fine della fase di accelerazione (frazione della durata). */
export const ACCEL_END = 0.14;
/** Ampiezza dello strappo iniziale all'indietro (rad) e sua durata massima. */
export const WINDUP_RAD = 0.16;
export const WINDUP_MAX_MS = 380;
/** Un client che stava mostrando un altro angolo si raccorda alla curva comune entro questo tempo dall'inizio. */
export const ACTIVATION_BLEND_MS = 600;

export function segmentStep(n: number): number {
  return TAU / Math.max(1, n);
}

/** Modulo positivo. */
export function wrap(a: number, m = TAU): number {
  const r = a % m;
  return r < 0 ? r + m : r;
}

/** Scarto (in frazioni di spicchio) dal centro dello spicchio: fisso per indice, così da fermo tutti vedono lo stesso. */
export function restJitter(index: number): number {
  return (((index * 7 + 3) % 5) - 2) * 0.11;
}

/**
 * Angolo del rotore (in [0, 2π)) per cui lo spicchio `index` è sotto il puntatore
 * (centro dello spicchio + piccolo scarto deterministico, mai oltre il 22 % dal centro).
 */
export function restAngle(index: number, n: number): number {
  const s = segmentStep(n);
  const i = ((Math.round(index) % n) + n) % n;
  return wrap((i + 0.5 + restJitter(i)) * s + Math.PI / 2);
}

/** Spicchio sotto il puntatore per l'angolo `a`. */
export function segmentAtAngle(a: number, n: number): number {
  const s = segmentStep(n);
  return Math.floor(wrap(a - Math.PI / 2) / s) % n;
}

/** Numero (non limitato) del separatore più recente passato sotto il puntatore: cambia a ogni "scatto". */
export function pegIndex(a: number, n: number): number {
  return Math.floor((a - Math.PI / 2) / segmentStep(n));
}

/** Hash FNV-1a → [0, 1), stabile su ogni piattaforma. */
export function hash01(text: string, salt = ""): number {
  let h = 0x811c9dc5;
  const s = `${salt}|${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

export interface SpinPlan {
  spinId: string;
  targetIndex: number;
  startedAt: number;
  durationMs: number;
  /** angolo all'istante startedAt */
  from: number;
  /** angolo finale (= restAngle(targetIndex), in [0, 2π)) */
  to: number;
  /** frazione della durata occupata dallo strappo iniziale */
  windupU: number;
}

/** Piano del giro: dipende SOLO dal comando del server e dal numero di spicchi. */
export function planSpin(cmd: WheelSpinCommand, n: number): SpinPlan {
  const target = ((Math.round(cmd.targetIndex) % n) + n) % n;
  const durationMs = Math.max(800, cmd.durationMs);
  const to = restAngle(target, n);
  // giri completi in proporzione alla durata (≈ 5–7 giri per 6 s) + una frazione dal codice del giro
  const base = Math.min(9, Math.max(2, Math.floor((durationMs / 1000) * 0.85)));
  const turns = base + Math.floor(hash01(cmd.spinId, "giri") * 2);
  const extra = hash01(cmd.spinId, "fraz") * TAU;
  const from = to - (turns * TAU + extra);
  return {
    spinId: cmd.spinId,
    targetIndex: target,
    startedAt: cmd.startedAt,
    durationMs,
    from,
    to,
    windupU: Math.min(0.07, WINDUP_MAX_MS / durationMs),
  };
}

const V_PEAK = 1 / (ACCEL_END / 2 + (1 - ACCEL_END) / 3);

/** Progresso 0..1 della rotazione principale (senza lo strappo): p(0)=0, p(1)=1, velocità 0 agli estremi. */
export function spinProgress(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < ACCEL_END) {
    const x = u / ACCEL_END;
    return V_PEAK * ACCEL_END * (x * x * x - (x * x * x * x) / 2);
  }
  const y = (1 - u) / (1 - ACCEL_END);
  return (V_PEAK * ACCEL_END) / 2 + ((V_PEAK * (1 - ACCEL_END)) / 3) * (1 - y * y * y);
}

/** Tempo normalizzato del giro all'istante t (ms epoch), limitato a 0..1. */
export function spinU(plan: SpinPlan, t: number): number {
  return Math.min(1, Math.max(0, (t - plan.startedAt) / plan.durationMs));
}

/** Angolo del rotore all'istante t (ms epoch, orologio del server). Prima della partenza = from, dopo = to. */
export function spinAngleAt(plan: SpinPlan, t: number): number {
  const u = spinU(plan, t);
  if (u >= 1) return plan.to;
  const w = Math.min(1, u / plan.windupU);
  const back = Math.sin(Math.PI * w);
  return plan.from + (plan.to - plan.from) * spinProgress(u) - WINDUP_RAD * back * back;
}

/** Velocità angolare (rad/s) all'istante t: serve a scatti del puntatore, luci e mosso. */
export function spinSpeedAt(plan: SpinPlan, t: number): number {
  const dt = 8;
  return ((spinAngleAt(plan, t + dt) - spinAngleAt(plan, t - dt)) / (2 * dt)) * 1000;
}

export function spinDone(plan: SpinPlan, t: number): boolean {
  return t >= plan.startedAt + plan.durationMs;
}

/** Differenza d'angolo ridotta a (−π, π]. */
export function shortestDelta(from: number, to: number): number {
  const d = wrap(to - from);
  return d > Math.PI ? d - TAU : d;
}

/**
 * Raccordo locale: un client che a inizio giro mostrava `shownAtStart` (es. un altro spicchio) parte da lì e
 * converge sulla curva comune entro ACTIVATION_BLEND_MS. Restituisce lo scarto da sommare all'angolo comune.
 * Dopo il raccordo (e per chi entra a giro avviato) lo scarto è 0: tutti vedono lo stesso angolo.
 */
export function activationOffset(plan: SpinPlan, shownAtStart: number | null, t: number): number {
  if (shownAtStart === null) return 0;
  const k = (t - plan.startedAt) / ACTIVATION_BLEND_MS;
  if (k >= 1) return 0;
  const d = shortestDelta(plan.from, shownAtStart);
  const x = Math.max(0, k);
  return d * (1 - x * x * (3 - 2 * x));
}
