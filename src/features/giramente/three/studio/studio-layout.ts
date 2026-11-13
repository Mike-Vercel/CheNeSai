/**
 * Pianta dello STUDIO 3D di GIRAMENTE! (metri, pavimento a y = 0, il pubblico/la camera guarda verso −Z).
 * Unico punto con le misure del set: la regia (inquadrature) e la scena le leggono da qui.
 *
 *                 [ LED WALL, centrato su x = 0 ]               z ≈ −3.4
 *   colonne   ┌──────── PEDANA (x ≈ −0.3, r 2.5) ────────┐   colonne
 *             │ DON PATRIZIO (x ≈ −1.35)   RUOTA (x ≈ +0.6) │   portale di ZAFIRA (x ≈ +2.9)
 *             └──────────────────────────────────────────┘
 *                    camera  →  z > 0
 * Presentatore e ruota stanno sulla STESSA pedana, vicini: la coppia è centrata su x ≈ 0, come il titolo del LED.
 */
export const PODIUM = { x: -0.3, z: 0.2, radius: 2.5, height: 0.1 } as const;

/** Statura di Don Patrizio in scena (il modello viene portato a questa altezza): un uomo adulto vero. */
export const PRESENTER_HEIGHT = 1.8;

/**
 * Scala della ruota (con il supporto) rispetto al canvas della ruota da sola. Proporzioni da studio vero accanto a un
 * uomo di 1,80 m sulla stessa pedana: centro del disco ≈ 1,6 m (all'altezza del suo viso), disco ≈ 1,75 m con il
 * cerchione (quanto lui), ruota + supporto + puntatore ≈ 2,6 m (≈ 1,45 volte la sua statura).
 */
export const WHEEL_SCALE = 0.66;
/** Posizione della ruota sulla pedana. */
export const WHEEL_X = 0.6;
/** Centro del disco in scena (calcolato da Wheel3D: perno a 2,25 m sopra il pavimento del supporto, scalato). */
export const WHEEL_CENTER = { x: WHEEL_X, y: PODIUM.height + 2.25 * WHEEL_SCALE, z: 0.37 } as const;
/** Raggio del disco in scena (R di Wheel3D × scala). */
export const WHEEL_RADIUS = 1.1 * WHEEL_SCALE;

/**
 * Segni di Don Patrizio: casa (sulla pedana accanto alla ruota, di tre quarti verso la camera e la ruota), spinta
 * (al bordo della ruota), centro (davanti, per salutare e festeggiare), fuori scena (ingresso, sul pavimento).
 */
export const MARKS = {
  home: { x: -1.35, z: 1.0, yaw: 0.5 },
  push: { x: -0.7, z: 0.95, yaw: 1.1 },
  center: { x: -0.55, z: 1.75, yaw: 0.2 },
  offstage: { x: -5.4, z: 1.6, yaw: Math.PI / 2 },
} as const;
export type MarkId = keyof typeof MARKS;

/** Altezza del pavimento sotto un punto (sulla pedana o fuori). */
export function groundAt(x: number, z: number): number {
  return Math.hypot(x - PODIUM.x, z - PODIUM.z) <= PODIUM.radius - 0.05 ? PODIUM.height : 0;
}

/** Portale della Jolly (Zafira) dall'altra parte della ruota, appena fuori dalla pedana. */
export const PORTAL_SPOT = { x: 2.95, z: 1.25, yaw: -0.35 } as const;

/** Schermo LED di fondo (centrato sulla coppia presentatore + ruota). */
export const LED_WALL = { width: 9.8, height: 3.8, y: 3.25, z: -3.45 } as const;
/** Altezza delle americane (truss) con i fari. */
export const TRUSS_Y = 6.6;
