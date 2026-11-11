/**
 * Timeline condivisa dell'intro (scena 3D, fallback 2D, overlay DOM, colonna sonora).
 * Tutti i tempi sono in SECONDI dall'avvio dell'intro (startedAtMs lato server).
 * Nessuno stato locale: tutto è funzione pura del tempo trascorso, così una TV
 * che ricarica a metà riprende esattamente dallo stesso punto.
 */

export const INTRO_DURATION_MS = 29_800;
export const INTRO_DURATION_S = INTRO_DURATION_MS / 1000;

/**
 * Storyboard (secondi):
 *  0     buio, lucine
 *  0.4   SOLO la ruota, grande al centro (spicchi + cornice + puntatore); 0.8 gira e rallenta coi "tic"
 *  6.2   si ferma su "INIZIA GIOCO" sotto il puntatore: lo spicchio lampeggia, coriandoli
 *  8.0   la ruota vola al centro-fondo dello studio, le luci si accendono
 *  9.6   TITOLO: scritta CHE NE SAI?! + lampadina + pulsante "esplodono" sulla ruota; voce dell'annunciatore
 *  12.6  inquadratura larga sulle quinte: il Professore entra da sinistra, la Regina da destra…
 *  14.3  …Palmino cade dall'alto (dall'americana) al centro
 *  15.4  la camera stringe sul terzetto; 16.8 presentazione (benvenuto + una battuta a testa)
 *  26.8  countdown 3·2·1 (solo beep), 29.8 "SI GIOCA!" e frame finale
 */
export const T = {
  blackout: 0,
  wheelIn: 0.4,
  spinStart: 0.8,
  wheelStop: 6.2,
  logoBack: 8.0,
  studioOn: 8.0,
  title: 9.6,
  entrance: 12.6,
  palminoDrop: 14.3,
  pushIn: 15.2,
  welcome: 16.8,
  lineProf: 19.0,
  lineRegina: 21.6,
  linePalmino: 24.2,
  /** Segmento regole (durata variabile, vedi rules.ts): la storia si ferma qui. */
  rulesStart: 26.6,
  countdown: 26.8,
  end: INTRO_DURATION_S,
} as const;

/**
 * Ingresso dei presentatori "in sella" al loro podio: il podio scivola dentro dalle quinte
 * (Professore da sinistra, Regina da destra) con il presentatore dietro, frena e oscilla.
 */
export const WALK = {
  profFrom: T.entrance,
  profTo: T.entrance + 1.2,
  reginaFrom: T.entrance + 0.4,
  reginaTo: T.entrance + 1.6,
} as const;

/** Distanza (m) da cui arriva il podio: fuori dall'inquadratura larga. */
const RIDE_FROM = 11.5;

/**
 * Posa del podio in ingresso (side −1 = da sinistra, +1 = da destra):
 * dx = spostamento dalla posizione finale, tilt = inclinazione (inerzia + oscillazione d'arresto),
 * speed = velocità normalizzata 0..1 (per la scia luminosa).
 */
export function podiumRide(side: -1 | 1, t: number, reduced = false): { dx: number; tilt: number; speed: number } {
  const t0 = side < 0 ? WALK.profFrom : WALK.reginaFrom;
  const t1 = side < 0 ? WALK.profTo : WALK.reginaTo;
  const pos = (tt: number) => {
    const k = (tt - t0) / (t1 - t0);
    if (k <= 0) return 1;
    if (k >= 1) return 0;
    // parte veloce e frena con un piccolo sorpasso (easeOutBack)
    const c1 = 1.1;
    const c3 = c1 + 1;
    return 1 - (1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2));
  };
  const p = pos(t);
  const v = Math.abs(pos(t) - pos(t - 0.02)) / 0.02; // frazione di corsa al secondo
  const speed = Math.min(1, (v * RIDE_FROM) / 18);
  const d = t - t1;
  const settle = d >= 0 && !reduced ? Math.exp(-d * 4.5) * Math.sin(d * 17) * 0.06 : 0;
  // inerzia: in corsa la cima resta indietro, all'arresto oscilla
  const lean = reduced ? 0 : -side * 0.07 * speed;
  return { dx: side * RIDE_FROM * p, tilt: lean + settle * -side, speed };
}

/**
 * I presentatori GLB (modelli riggati con la clip "Walking") entrano A PIEDI dalle quinte:
 * il Professore da sinistra (esce da dietro il bancone del pub), la Regina da destra (dalle botti).
 * Attraversano in diagonale, salgono i due gradini del palco e si fermano dietro al loro podio
 * (che in questo caso resta fermo), poi si girano verso il pubblico.
 * Profilo di velocità trapezoidale: la clip rallenta insieme al corpo → niente piedi che scivolano.
 */
export type WalkingHost = "professore" | "regina";

export interface HostWalkDef {
  from: { x: number; z: number };
  to: { x: number; z: number };
  t0: number;
  /** Arrivo dietro al podio. */
  t1: number;
  accel: number;
  decel: number;
  /** Giro verso la camera (passi sul posto). */
  turn: number;
  /** Scala del modello (1.70 m → testa a ~5.1 m come il ritaglio/procedurale). */
  scale: number;
}

export const HOST_WALK: Record<WalkingHost, HostWalkDef> = {
  professore: { from: { x: -14.2, z: -2.2 }, to: { x: -5.85, z: 0.55 }, t0: WALK.profFrom, t1: WALK.profFrom + 2.35, accel: 0.3, decel: 0.55, turn: 0.45, scale: 2.8 },
  regina: { from: { x: 14.2, z: -2.2 }, to: { x: 5.9, z: 0.55 }, t0: WALK.reginaFrom, t1: WALK.reginaFrom + 2.35, accel: 0.3, decel: 0.55, turn: 0.45, scale: 2.85 },
};

/** Quota del pavimento del palco (due gradini circolari attorno a (0, 0.4)). */
export function stageFloorY(x: number, z: number): number {
  const r = Math.hypot(x, z - 0.4);
  // gradini "addolciti" su ~0.35 m: i piedi salgono durante il passo
  const step = (edge: number) => Math.min(1, Math.max(0, (edge + 0.2 - r) / 0.35));
  return 0.18 * step(8.4) + 0.17 * step(7.4);
}

export interface HostWalkPose {
  x: number;
  y: number;
  z: number;
  /** Rotazione Y del corpo (0 = verso +Z). */
  heading: number;
  /** Velocità in unità-scena/s. */
  speed: number;
  /** Peso della camminata 0..1 (1 = clip Walking). */
  walk: number;
  /** In giro verso la camera (passi sul posto). */
  turning: boolean;
}

export function hostWalkPose(who: WalkingHost, t: number, reduced = false): HostWalkPose {
  const W = HOST_WALK[who];
  const dx = W.to.x - W.from.x;
  const dz = W.to.z - W.from.z;
  const D = Math.hypot(dx, dz);
  const heading = Math.atan2(dx, dz);
  const T0 = W.t1 - W.t0;
  if (reduced || t >= W.t1) {
    const turning = !reduced && t < W.t1 + W.turn;
    return { x: W.to.x, y: stageFloorY(W.to.x, W.to.z), z: W.to.z, heading, speed: 0, walk: turning ? 1 : 0, turning };
  }
  const vmax = D / (T0 - W.accel / 2 - W.decel / 2);
  const tt = Math.max(0, t - W.t0);
  let s: number;
  let v: number;
  if (tt < W.accel) {
    s = (0.5 * vmax * tt * tt) / W.accel;
    v = (vmax * tt) / W.accel;
  } else if (tt <= T0 - W.decel) {
    s = vmax * (tt - W.accel / 2);
    v = vmax;
  } else {
    const r = T0 - tt;
    s = D - (0.5 * vmax * r * r) / W.decel;
    v = (vmax * r) / W.decel;
  }
  const k = s / D;
  const x = W.from.x + dx * k;
  const z = W.from.z + dz * k;
  return { x, y: stageFloorY(x, z), z, heading, speed: v, walk: 1, turning: false };
}

export type IntroPhase = "blackout" | "wheel" | "stop" | "logoBack" | "title" | "entrance" | "presentation" | "rules" | "countdown" | "hold";

export const PHASE_ORDER: readonly IntroPhase[] = ["blackout", "wheel", "stop", "logoBack", "title", "entrance", "presentation", "rules", "countdown", "hold"];

export function phaseAt(t: number): IntroPhase {
  if (t >= T.end) return "hold";
  if (t >= T.countdown) return "countdown";
  if (t >= T.welcome) return "presentation";
  if (t >= T.entrance) return "entrance";
  if (t >= T.title) return "title";
  if (t >= T.logoBack) return "logoBack";
  if (t >= T.wheelStop) return "stop";
  if (t >= T.wheelIn) return "wheel";
  return "blackout";
}

/** true se la fase corrente è uguale o successiva a `p`. */
export const reached = (phase: IntroPhase, p: IntroPhase) => PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(p);

// ------------------------------------------------------------------ ruota del logo
/** Spicchi della ruota, in senso orario a partire da quello in alto (sotto la lampadina). */
export const WHEEL_WEDGES = ["INIZIA GIOCO", "CINEMA", "MUSICA", "SPORT", "STORIA", "GEOGRAFIA", "SCIENZA", "ARTE", "CUCINA", "TV", "NATURA", "CURIOSITÀ"] as const;
/** Ampiezza media di uno spicchio (per i "tic"). */
export const WHEEL_STEP = (Math.PI * 2) / WHEEL_WEDGES.length;
/** "INIZIA GIOCO" è più largo (45°) per avere una scritta grande; gli altri si dividono il resto. */
export const WHEEL_SPECIAL = Math.PI / 4;
export const WHEEL_OTHER = (Math.PI * 2 - WHEEL_SPECIAL) / (WHEEL_WEDGES.length - 1);
/** Giri compiuti dalla ruota: parte veloce e rallenta fino a "INIZIA GIOCO". */
const WHEEL_TURNS = 5.4;

/**
 * Rotazione della ruota (radianti, positivo = senso orario) al tempo t.
 * Vale 0 (mod 2π) a fine corsa: "INIZIA GIOCO" sotto il puntatore.
 */
export function wheelAngle(t: number): number {
  const total = WHEEL_TURNS * Math.PI * 2;
  if (t < T.spinStart) return -total;
  if (t < T.wheelStop) {
    const p = (t - T.spinStart) / (T.wheelStop - T.spinStart);
    // decelerazione da ruota della fortuna: velocità iniziale alta, ultimi spicchi lentissimi
    return -total * Math.pow(1 - p, 3.4);
  }
  // piccolo "rimbalzo" del cricchetto all'arresto
  const d = t - T.wheelStop;
  return -0.045 * Math.exp(-d * 5) * Math.sin(d * 14);
}

/**
 * Spicchio sotto il puntatore: `count` cresce di 1 a ogni divisorio che passa (per i "tic"),
 * `local` 0..1 = posizione del puntatore dentro lo spicchio.
 */
export function wheelPointer(t: number): { count: number; local: number } {
  const a = wheelAngle(t);
  // angolo della ruota sotto il puntatore, misurato dal bordo sinistro dello spicchio speciale
  const phi = -a + WHEEL_SPECIAL / 2;
  const turns = Math.floor(phi / (Math.PI * 2));
  const rel = phi - turns * Math.PI * 2;
  const idx = rel < WHEEL_SPECIAL ? 0 : 1 + Math.min(WHEEL_WEDGES.length - 2, Math.floor((rel - WHEEL_SPECIAL) / WHEEL_OTHER));
  const local = idx === 0 ? rel / WHEEL_SPECIAL : (rel - WHEEL_SPECIAL - (idx - 1) * WHEEL_OTHER) / WHEEL_OTHER;
  return { count: turns * WHEEL_WEDGES.length + idx, local };
}

/** Contatore dei divisori passati sotto il puntatore (per i "tic" della ruota). */
export function wheelTick(t: number): number {
  return wheelPointer(t).count;
}

// ------------------------------------------------------------------ didascalie
export type CaptionId = "inizia" | "benvenuti" | "professore" | "regina" | "palmino" | "final";
export type CaptionPlacement = "right" | "left" | "top" | "bottom" | "center" | "topLeft" | "topRight" | "band";
export type Speaker = "professore" | "regina" | "palmino";

export interface CaptionDef {
  id: CaptionId;
  from: number;
  to: number; // Infinity = resta nel frame finale
  tag?: string;
  text: string;
  placement: CaptionPlacement;
  accent: string;
  /** Personaggio che pronuncia la battuta (anima "talk"). */
  speaker?: Speaker;
}

export const CAPTIONS: readonly CaptionDef[] = [
  { id: "inizia", from: T.wheelStop + 0.3, to: T.logoBack, text: "INIZIA IL GIOCO!", placement: "bottom", accent: "#FFD43B" },
  { id: "benvenuti", from: T.welcome, to: T.lineProf - 0.15, tag: "IL PROFESSORE", text: "BENVENUTI SU CHE NE SAI?!", placement: "topRight", accent: "#087CFF", speaker: "professore" },
  { id: "professore", from: T.lineProf, to: T.lineRegina - 0.15, tag: "IL PROFESSORE", text: "SIETE PRONTI A METTERVI ALLA PROVA?", placement: "topRight", accent: "#087CFF", speaker: "professore" },
  { id: "regina", from: T.lineRegina, to: T.linePalmino - 0.15, tag: "LA REGINA", text: "SOLO I MIGLIORI ARRIVERANNO IN CIMA!", placement: "topLeft", accent: "#FF1493", speaker: "regina" },
  { id: "palmino", from: T.linePalmino, to: T.rulesStart - 0.1, tag: "PALMINO", text: "E ATTENTI ALLE SORPRESE!", placement: "topLeft", accent: "#00D46A", speaker: "palmino" },
  { id: "final", from: T.end, to: Infinity, text: "SI GIOCA!", placement: "band", accent: "#FFD43B" },
];

export function captionAt(t: number): CaptionDef | null {
  for (const c of CAPTIONS) if (t >= c.from && t < c.to) return c;
  return null;
}

/** Chi sta parlando secondo il copione (indipendente dalla sintesi vocale). */
export function speakerAt(t: number): Speaker | null {
  return captionAt(t)?.speaker ?? null;
}

/** 3, 2, 1 durante il countdown, altrimenti null. */
export function countdownAt(t: number): number | null {
  if (t < T.countdown || t >= T.end) return null;
  const step = (T.end - T.countdown) / 3;
  return 3 - Math.floor((t - T.countdown) / step);
}

/** Lampi a schermo (disattivati con reducedMotion). */
export const FLASHES: readonly { at: number; color: string }[] = [
  { at: T.wheelStop + 0.05, color: "#FFE680" },
  { at: T.title, color: "#FFF0B0" },
  { at: T.palminoDrop + 0.3, color: "#B6FF7A" },
  { at: T.end, color: "#FFE680" },
];

// ------------------------------------------------------------------ easing
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Progresso 0..1 lineare tra due istanti. */
export const prog = (t: number, from: number, to: number) => clamp((t - from) / (to - from));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInCubic = (x: number) => x * x * x;
export const easeOutBack = (x: number, s = 1.70158) => {
  const c3 = s + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
};
export const easeOutElastic = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
export const easeOutBounce = (x: number) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

/** PRNG deterministico (mulberry32): stesse "casualità" su tutte le TV, nessun Math.random in render. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
