import type { Vec3 } from "./camera-math";
import type { ShotSpec } from "./director";
import { POD, SAIL, STAGE, hostMarks, type ArenaLayout } from "./layout";

/**
 * SOGGETTI DELLE INQUADRATURE (puri, testati): per ogni tipo di inquadratura il centro e i punti 3D che devono stare
 * nel quadro, calcolati dalla pianta (numero di torri, altezze vere delle colonne, presentatori). La camera poi
 * sceglie la distanza perché i punti stiano nella finestra libera dall'HUD (camera-math.fitDistance).
 */

export interface ShotContext {
  layout: ArenaLayout;
  /** quota della cima della colonna della torre i (m) */
  podTop: (i: number) => number;
  /** indice della torre di una squadra (−1 se non c'è) */
  teamIndex: (teamId: string) => number;
  hostCount: number;
  /** finestra stretta (telefono in verticale): inquadrature più raccolte e più dall'alto */
  compact: boolean;
}

export interface ShotSubject {
  center: Vec3;
  points: Vec3[];
  /** yaw (gradi) da aggiungere a quello dell'inquadratura (torri ai lati: la camera le guarda di fronte) */
  yawBias: number;
  /** pitch (gradi) da aggiungere */
  pitchBias: number;
}

/** Altezza sopra la cima della colonna occupata da mascotte, targhetta e punteggio. */
export const ABOVE_TOP = POD.mascotHeight + 1.25;

const DEG = 180 / Math.PI;
/** Frazione della larghezza della vela occupata dai titoli più larghi (78% del canvas). */
export const LED_TEXT_FRAC = 0.82;
const SAIL_TOP = SAIL.bottom + SAIL.height;

function podPoints(ctx: ShotContext, idx: number[], out: Vec3[], pad: number = POD.baseRadius) {
  for (const i of idx) {
    const p = ctx.layout.pods[i];
    if (!p) continue;
    const top = ctx.podTop(i) + ABOVE_TOP * ctx.layout.scale;
    out.push([p.x - pad, 0, p.z], [p.x + pad, 0, p.z], [p.x, 0, p.z - pad], [p.x, 0, p.z + pad], [p.x - pad * 0.8, top, p.z], [p.x + pad * 0.8, top, p.z]);
  }
}

/** La parte "scritta" della grande vela: angoli (sul piano del pennone) e centro della pancia. */
function ledFront(out: Vec3[], frac: number, withTop = true) {
  for (const s of [-1, 1]) {
    const xb = (s * SAIL.bottomWidth * frac) / 2;
    const xt = (s * SAIL.width * frac) / 2;
    out.push([xb, SAIL.bottom, SAIL.z + SAIL.belly * 0.35]);
    if (withTop) out.push([xt, SAIL_TOP, SAIL.z]);
  }
  out.push([0, SAIL.bottom, SAIL.z + SAIL.belly * 0.75]);
  if (withTop) out.push([0, SAIL_TOP, SAIL.z]);
}

function stagePoints(ctx: ShotContext, out: Vec3[]) {
  const marks = hostMarks(ctx.hostCount);
  if (marks.length) {
    for (const m of marks) out.push([m.x - 0.55, STAGE.height, m.z + 0.3], [m.x + 0.55, STAGE.height, m.z + 0.3], [m.x, STAGE.height + 2.05, m.z]);
  } else {
    out.push([-STAGE.radius, 0, 0], [STAGE.radius, 0, 0], [0, STAGE.height, STAGE.radius], [0, STAGE.height + 1.2, 0]);
  }
}

function circularMeanDeg(angles: number[]): number {
  if (!angles.length) return 0;
  let sx = 0;
  let sy = 0;
  for (const a of angles) {
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  return Math.atan2(sy, sx) * DEG;
}

function centerOf(points: Vec3[]): [number, number, number] {
  if (!points.length) return [0, 1.5, 0];
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
    z0 = Math.min(z0, p[2]);
    z1 = Math.max(z1, p[2]);
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
}

export function shotSubject(spec: ShotSpec, ctx: ShotContext): ShotSubject {
  const all = ctx.layout.pods.map((_, i) => i);
  const pts: Vec3[] = [];
  let yawBias = 0;
  let pitchBias = ctx.compact ? 3 : 0;
  switch (spec.kind) {
    case "establish":
    case "wide": {
      podPoints(ctx, all, pts);
      ledFront(pts, LED_TEXT_FRAC);
      pts.push([0, 0, STAGE.radius + 0.6]);
      if (spec.kind === "establish") pitchBias += 4;
      break;
    }
    case "arena": {
      podPoints(ctx, all, pts);
      stagePoints(ctx, pts);
      // lo schermo intero (titolo della prova): con la U larga il quadro ha comunque spazio in altezza
      ledFront(pts, LED_TEXT_FRAC);
      break;
    }
    case "stage": {
      stagePoints(ctx, pts);
      break;
    }
    case "led": {
      ledFront(pts, LED_TEXT_FRAC);
      stagePoints(ctx, pts);
      break;
    }
    case "pods":
    case "pod": {
      const idx = spec.teamIds.map(ctx.teamIndex).filter((i) => i >= 0);
      if (!idx.length) {
        podPoints(ctx, all, pts);
        break;
      }
      if (spec.kind === "pod") {
        pitchBias += 16;
        // da vicino: tappo, mascotte e corona (la targhetta resta fuori): la camera si avvicina abbastanza da lasciare
        // i presentatori alle sue spalle, l'evoluzione riempie il quadro
        for (const i of idx) {
          const p = ctx.layout.pods[i];
          const top = ctx.podTop(i);
          const r = POD.baseRadius * 1.15;
          const head = top + (POD.mascotHeight + 0.45) * ctx.layout.scale;
          pts.push([p.x - r, top - 0.35, p.z], [p.x + r, top - 0.35, p.z], [p.x, head, p.z], [p.x, top, p.z + r], [p.x, top, p.z - r]);
        }
      } else {
        podPoints(ctx, idx, pts, POD.baseRadius * 1.1);
        // i presentatori davanti alle torri restano interi (mai teste tagliate dal bordo del quadro)
        if (ctx.hostCount > 0) stagePoints(ctx, pts);
        if (spec.withLed) ledFront(pts, LED_TEXT_FRAC);
      }
      // la camera guarda le torri di fronte (come le vede il pubblico), mai da dietro il palco
      const yaws = idx.map((i) => ctx.layout.pods[i].yaw);
      yawBias = Math.max(-70, Math.min(70, circularMeanDeg(yaws) * 0.8));
      break;
    }
    case "podium": {
      // podio (con le mascotte sopra), presentatori ai lati e lo schermo con i posti
      pts.push([-2.3, STAGE.height, 0.6], [2.3, STAGE.height, 0.6], [-1.6, STAGE.height + 3.3, -0.45], [1.6, STAGE.height + 3.6, -0.45]);
      for (const m of hostMarks(ctx.hostCount, true)) pts.push([m.x - 0.45, STAGE.height, m.z + 0.3], [m.x + 0.45, STAGE.height + 2.05, m.z]);
      if (spec.withLed) ledFront(pts, LED_TEXT_FRAC);
      break;
    }
  }
  return { center: centerOf(pts), points: pts, yawBias, pitchBias };
}
