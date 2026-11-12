/**
 * INTRO 3D DI PSYCO – copione (funzioni pure del tempo, testate in tests/unit/psyco-intro.test.ts).
 *
 *  0.0  buio (solo la finestra: pioggia e insegna rossa)       1.0  click della lampada, sfarfallio
 *  2.0  l'Investigatore entra da sinistra camminando dietro la scrivania (passi sul parquet)
 *  5.5  arriva alla sedia, si gira verso di noi                6.2  si siede (sedia che scricchiola)
 *  6.0  la camera da carrellata passa al piano medio, poi al primo piano
 *  8.3  parla il narratore: «Benvenuti a PSYCO…» (labbra a tempo), poi dissolvenza sulla lobby
 * Fine: dopo la voce (almeno a 11.5 s), al massimo 18 s. «Salta intro» sempre disponibile.
 *
 * Coordinate in metri: Y in alto, la camera guarda verso −Z, scrivania centrata in (0, 0.76, 0),
 * sedia dietro (z ≈ −0.8). L'Investigatore guarda verso +Z (rotY = 0) quando è seduto.
 */
export const INTRO_T = {
  lampClick: 1.0,
  lampOn: 1.9,
  walkStart: 2.0,
  walkEnd: 5.5,
  turnEnd: 6.3,
  sitStart: 6.1,
  sitEnd: 7.5,
  voiceAt: 8.3,
  minEnd: 11.5,
  maxEnd: 18,
} as const;

export const PATH = { startX: -3.3, endX: 0, z: -0.6, seatZ: -0.72 } as const;

export type IntroLayout = "portrait" | "landscape";
export type Vec3 = [number, number, number];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (e0: number, e1: number, x: number) => {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Avanzamento lungo il percorso 0..1: velocità costante con partenza e arrivo morbidi. */
function walkProgress(t: number): number {
  const u = clamp01((t - INTRO_T.walkStart) / (INTRO_T.walkEnd - INTRO_T.walkStart));
  return 0.72 * u + 0.28 * u * u * (3 - 2 * u);
}

export interface CharPose {
  x: number;
  z: number;
  /** rotazione attorno a Y: π/2 = cammina verso +X, 0 = guarda la camera */
  rotY: number;
  /** peso della camminata 0..1 */
  walk: number;
  /** velocità della camminata in m/s (per il ritmo della clip e dei passi) */
  speed: number;
  /** seduta 0..1 (le anche scendono di SIT_DROP · sit) */
  sit: number;
}

export function characterAt(t: number): CharPose {
  const p = walkProgress(t);
  const dt = 1 / 60;
  const v = ((walkProgress(t + dt) - walkProgress(t - dt)) / (2 * dt)) * (PATH.endX - PATH.startX);
  const turn = smooth(INTRO_T.walkEnd - 0.15, INTRO_T.turnEnd, t);
  const sit = smooth(INTRO_T.sitStart, INTRO_T.sitEnd, t);
  // camminata piena finché si muove, qualche passo sul posto mentre si gira, poi ferma
  const walking = t >= INTRO_T.walkStart - 0.15 && t < INTRO_T.walkEnd ? smooth(INTRO_T.walkStart - 0.15, INTRO_T.walkStart + 0.2, t) : 0;
  const turning = t >= INTRO_T.walkEnd && t < INTRO_T.turnEnd ? 0.45 * (1 - smooth(INTRO_T.walkEnd, INTRO_T.turnEnd, t)) : 0;
  return {
    x: lerp(PATH.startX, PATH.endX, p),
    z: lerp(PATH.z, PATH.seatZ, sit),
    rotY: (Math.PI / 2) * (1 - turn),
    walk: Math.max(walking, turning),
    speed: Math.max(0, v),
    sit,
  };
}

/** Lampada 0..1: spenta, click, sfarfallio, accesa (con un respiro leggerissimo del filamento). */
export function lampAt(t: number): number {
  if (t < INTRO_T.lampClick) return 0;
  const k = t - INTRO_T.lampClick;
  // sequenza dello sfarfallio (durate in secondi, intensità)
  const seq: [number, number][] = [
    [0.07, 0.9],
    [0.1, 0.05],
    [0.05, 0.7],
    [0.22, 0.1],
    [0.12, 0.55],
    [0.08, 0.2],
    [0.26, 1],
  ];
  let acc = 0;
  for (const [d, v] of seq) {
    acc += d;
    if (k < acc) return v;
  }
  return 0.97 + 0.03 * Math.sin(t * 23) * Math.sin(t * 7.3);
}

export interface Shot {
  target: Vec3;
  /** direzione dal soggetto verso la camera (non serve normalizzata) */
  dir: Vec3;
  /** larghezza e altezza minime da tenere in quadro, alla distanza del soggetto */
  w: number;
  h: number;
}

/** Distanza della camera perché `shot` stia nel quadro (fov verticale in gradi, aspect = w/h). */
export function fitDistance(shot: Pick<Shot, "w" | "h">, vfovDeg: number, aspect: number): number {
  const half = Math.tan((vfovDeg * Math.PI) / 360);
  return Math.max(shot.h / 2 / half, shot.w / 2 / (half * Math.max(0.2, aspect)));
}

export const VFOV: Record<IntroLayout, number> = { landscape: 34, portrait: 50 };

/** Le inquadrature in ordine: dal campo largo al primo piano. `head` = testa del personaggio (se nota). */
function shots(t: number, layout: IntroLayout, head: Vec3 | null): { at: number; dur: number; shot: Shot }[] {
  const c = characterAt(t);
  const portrait = layout === "portrait";
  const h = head ?? [0, 1.02, -0.62];
  return [
    { at: 0, dur: 0, shot: portrait ? { target: [-0.2, 1.2, -0.4], dir: [0.12, 0.3, 1], w: 2.0, h: 3.0 } : { target: [-0.35, 0.95, -0.4], dir: [0.16, 0.3, 1], w: 4.4, h: 2.5 } },
    // carrellata laterale che accompagna l'ingresso
    {
      at: 2.4,
      dur: 3.6,
      shot: portrait ? { target: [c.x * 0.7, 1.12, -0.5], dir: [-0.2, 0.35, 1], w: 1.5, h: 2.4 } : { target: [Math.max(-1.6, c.x * 0.5), 1.0, -0.45], dir: [-0.14, 0.18, 1], w: 3.0, h: 1.9 },
    },
    // piano medio: scrivania, sedia e personaggio che si siede
    { at: 5.9, dur: 1.7, shot: portrait ? { target: [0, 0.98, -0.4], dir: [0.1, 0.45, 1], w: 1.05, h: 1.7 } : { target: [0, 0.95, -0.45], dir: [0.1, 0.2, 1], w: 2.0, h: 1.3 } },
    // primo piano per la voce (in verticale la scrivania e il fascicolo restano sotto la faccia)
    {
      at: 7.7,
      dur: 1.5,
      shot: portrait ? { target: [h[0], h[1] - 0.22, h[2] + 0.1], dir: [0.14, 0.4, 1], w: 0.8, h: 1.2 } : { target: [h[0], h[1] + 0.01, h[2]], dir: [0.2, 0.1, 1], w: 1.1, h: 0.74 },
    },
  ];
}

function camFor(shot: Shot, layout: IntroLayout, aspect: number): { pos: Vec3; target: Vec3 } {
  const d = fitDistance(shot, VFOV[layout], aspect);
  const [dx, dy, dz] = shot.dir;
  const n = Math.hypot(dx, dy, dz) || 1;
  return { pos: [shot.target[0] + (dx / n) * d, shot.target[1] + (dy / n) * d, shot.target[2] + (dz / n) * d], target: shot.target };
}

/** Camera al tempo t: si passa da un'inquadratura all'altra con un movimento morbido (dolly). */
export function cameraAt(t: number, layout: IntroLayout, aspect: number, head: Vec3 | null = null): { pos: Vec3; target: Vec3 } {
  const list = shots(t, layout, head);
  let cur = camFor(list[0].shot, layout, aspect);
  for (let i = 1; i < list.length; i++) {
    const s = list[i];
    if (t < s.at) break;
    const k = smooth(s.at, s.at + s.dur, t);
    const next = camFor(s.shot, layout, aspect);
    cur = {
      pos: [lerp(cur.pos[0], next.pos[0], k), lerp(cur.pos[1], next.pos[1], k), lerp(cur.pos[2], next.pos[2], k)],
      target: [lerp(cur.target[0], next.target[0], k), lerp(cur.target[1], next.target[1], k), lerp(cur.target[2], next.target[2], k)],
    };
  }
  // respiro della camera a mano (pochi millimetri)
  cur.pos = [cur.pos[0] + Math.sin(t * 0.7) * 0.012, cur.pos[1] + Math.sin(t * 0.9 + 1) * 0.008, cur.pos[2]];
  return cur;
}

/** L'intro può finire? (dopo la voce, mai prima di minEnd; sempre entro maxEnd). */
export function introCanEnd(t: number, voiceDone: boolean): boolean {
  if (t >= INTRO_T.maxEnd) return true;
  return t >= INTRO_T.minEnd && voiceDone;
}
