import { GameError } from "./types";

/**
 * Ruota impazzita: geometria e animazione del giro, funzioni PURE condivise
 * da server (che sceglie il risultato) e TV (che lo disegna).
 *
 * Convenzioni (gradi, senso orario):
 * - il puntatore è fisso in alto (0°);
 * - lo spicchio i occupa, a ruota ferma, l'arco [i·S, (i+1)·S) con S = 360/n,
 *   misurato in senso orario dal puntatore;
 * - la ruota parte sempre da rotazione 0 e gira in senso orario fino a `rotationDeg`.
 * Con rotazione R, sotto il puntatore c'è l'angolo della ruota (−R mod 360).
 */

export const WHEEL_MIN_SEGMENTS = 2;
export const WHEEL_MAX_SEGMENTS = 8;
/** Giri completi (estremi inclusi). */
export const WHEEL_TURNS = { min: 5, max: 7 } as const;
/** Durata dell'animazione in ms (estremi inclusi). */
export const WHEEL_DURATION_MS = { min: 7500, max: 9000 } as const;
/** Punto di arrivo nello spicchio: mai troppo vicino ai bordi (niente "fotofinish" ambigui). */
export const WHEEL_LANDING = { min: 0.2, max: 0.8 } as const;
/** Anticipo fra il comando e la partenza: tutti i TV ricevono lo stato prima che la ruota parta. */
export const WHEEL_LEAD_MS = 1200;
/** Frazione del tempo spesa ad accelerare (il resto è una lunga frenata). */
const ACCEL = 0.12;
/** Esponente della frenata: più alto = coda più lunga e lenta. */
const DECAY = 3;

export interface WheelSpinPlan {
  segments: number;
  winnerIndex: number;
  turns: number;
  landing: number;
  rotationDeg: number;
  durationMs: number;
}

export interface WheelSpinInputs {
  turns: number;
  landing: number;
  durationMs: number;
}

export function segmentAngle(segments: number): number {
  return 360 / segments;
}

function mod360(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Costruisce il piano del giro: stesso input → stesso piano (deterministico). */
export function buildSpinPlan(segments: number, winnerIndex: number, inputs: WheelSpinInputs): WheelSpinPlan {
  if (!Number.isInteger(segments) || segments < WHEEL_MIN_SEGMENTS || segments > WHEEL_MAX_SEGMENTS) {
    throw new GameError("VALIDATION", `La ruota deve avere da ${WHEEL_MIN_SEGMENTS} a ${WHEEL_MAX_SEGMENTS} spicchi`);
  }
  if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= segments) {
    throw new GameError("VALIDATION", "Spicchio vincente non valido");
  }
  const { turns, landing, durationMs } = inputs;
  if (!Number.isInteger(turns) || turns < WHEEL_TURNS.min || turns > WHEEL_TURNS.max) throw new GameError("VALIDATION", "Numero di giri non valido");
  if (!(landing >= WHEEL_LANDING.min && landing <= WHEEL_LANDING.max)) throw new GameError("VALIDATION", "Punto di arrivo non valido");
  if (!Number.isInteger(durationMs) || durationMs < WHEEL_DURATION_MS.min || durationMs > WHEEL_DURATION_MS.max) {
    throw new GameError("VALIDATION", "Durata del giro non valida");
  }
  const local = (winnerIndex + landing) * segmentAngle(segments);
  const rotationDeg = turns * 360 + mod360(360 - local);
  return { segments, winnerIndex, turns, landing, rotationDeg, durationMs };
}

/**
 * Profilo di velocità: sale linearmente durante l'accelerazione, poi cala come (1−s)^DECAY.
 * Posizione = integrale normalizzato: continua, con velocità continua, ferma alla fine.
 */
export function wheelEase(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const total = ACCEL / 2 + (1 - ACCEL) / (DECAY + 1);
  if (u < ACCEL) return (u * u) / (2 * ACCEL) / total;
  const s = (u - ACCEL) / (1 - ACCEL);
  return (ACCEL / 2 + ((1 - ACCEL) / (DECAY + 1)) * (1 - (1 - s) ** (DECAY + 1))) / total;
}

/** Rotazione (gradi) dopo `elapsedMs` dall'inizio del giro. */
export function wheelRotationAt(plan: Pick<WheelSpinPlan, "rotationDeg" | "durationMs">, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= plan.durationMs) return plan.rotationDeg;
  return plan.rotationDeg * wheelEase(elapsedMs / plan.durationMs);
}

/** Spicchio sotto il puntatore per una data rotazione. */
export function segmentAtPointer(rotationDeg: number, segments: number): number {
  const local = mod360(-rotationDeg);
  return Math.min(segments - 1, Math.floor(local / segmentAngle(segments)));
}

/** Numero di bordi di spicchio passati sotto il puntatore (per il "tic" della ruota). */
export function tickCount(rotationDeg: number, segments: number): number {
  return Math.floor(Math.max(0, rotationDeg) / segmentAngle(segments));
}

/** Millisecondi trascorsi dall'inizio del giro (in pausa: fermi al momento della pausa). */
export function spinElapsedMs(spin: { startedAt: string; frozenElapsedMs: number | null }, nowMs: number): number {
  if (spin.frozenElapsedMs !== null) return spin.frozenElapsedMs;
  return nowMs - Date.parse(spin.startedAt);
}

export function spinEndsAtMs(spin: { startedAt: string; durationMs: number }): number {
  return Date.parse(spin.startedAt) + spin.durationMs;
}
