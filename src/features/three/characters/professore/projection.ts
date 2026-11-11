/**
 * Proiezione dell'illustrazione ufficiale sul modello (img2threejs,
 * "projection-first fidelity"). Per ogni regione (testa, busto) si risolve
 * una camera affine (proiezione ortografica generica, 2×4) con minimi
 * quadrati da coppie di punti di riferimento 3D (modello a riposo) ↔ 2D
 * (pixel del riferimento 1254×1254). Ogni vertice proiettato riceve le
 * coordinate nel riferimento + un peso (quanto guarda verso la camera) +
 * l'etichetta della zona che può ricevere (pelle, capelli, stoffa, cuoio, grembiule).
 */
import { Vector3 } from "three";

export const REF_SIZE = 1254;
export const PROJ_TEXTURE_URL = "/three/characters/professore/professore-proj.webp?v=3";

/** etichette nel canale alpha della texture di proiezione */
export const LABEL = {
  skin: 255 / 255,
  hair: 213 / 255,
  cloth: 170 / 255,
  leather: 128 / 255,
  /** grembiule (denim): separato dalla camicia, così nessuno dei due prende il colore dell'altro */
  apron: 85 / 255,
} as const;

export interface ProjCam {
  /** righe della matrice affine: px = r0·[x,y,z,1], py = r1·[x,y,z,1] */
  r0: [number, number, number, number];
  r1: [number, number, number, number];
  /** direzione verso la camera nello spazio della regione */
  view: Vector3;
  /** origine della regione (posizione a riposo dell'osso) */
  origin: Vector3;
  /** errore medio di riproiezione dei punti di riferimento (pixel) */
  rms: number;
}

export interface Landmark {
  p: Vector3;
  px: number;
  py: number;
  w?: number;
}

function solve4(M: number[][], b: number[]): number[] {
  const a = M.map((row, i) => [...row, b[i]]);
  const n = 4;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    [a[c], a[piv]] = [a[piv], a[c]];
    const d = a[c][c] || 1e-12;
    for (let k = c; k <= n; k++) a[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((row) => row[n]);
}

/** camera affine ai minimi quadrati pesati (punti già relativi a `origin`) */
export function fitAffineCamera(marks: Landmark[], origin: Vector3): ProjCam {
  const M = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  const bx = [0, 0, 0, 0];
  const by = [0, 0, 0, 0];
  for (const m of marks) {
    const w = m.w ?? 1;
    const v = [m.p.x - origin.x, m.p.y - origin.y, m.p.z - origin.z, 1];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) M[i][j] += w * v[i] * v[j];
      bx[i] += w * v[i] * m.px;
      by[i] += w * v[i] * m.py;
    }
  }
  // piccola regolarizzazione per stabilità
  for (let i = 0; i < 3; i++) M[i][i] += 1e-6;
  const r0 = solve4(M, bx) as ProjCam["r0"];
  const r1 = solve4(M, by) as ProjCam["r1"];
  // l'asse dell'immagine y va verso il basso: la direzione verso la camera è -(r0 × r1)
  const view = new Vector3(r0[0], r0[1], r0[2]).cross(new Vector3(r1[0], r1[1], r1[2])).negate().normalize();
  let err = 0;
  for (const m of marks) {
    const x = m.p.x - origin.x;
    const y = m.p.y - origin.y;
    const z = m.p.z - origin.z;
    const ex = r0[0] * x + r0[1] * y + r0[2] * z + r0[3] - m.px;
    const ey = r1[0] * x + r1[1] * y + r1[2] * z + r1[3] - m.py;
    err += ex * ex + ey * ey;
  }
  return { r0, r1, view, origin: origin.clone(), rms: Math.sqrt(err / Math.max(1, marks.length)) };
}

function solve3(M: number[][], b: number[]): number[] {
  const a = M.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    [a[c], a[piv]] = [a[piv], a[c]];
    const d = a[c][c] || 1e-12;
    for (let k = c; k <= 3; k++) a[c][k] /= d;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = a[r][c];
      for (let k = c; k <= 3; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((row) => row[3]);
}

/**
 * Camera "weak perspective" robusta: cerca la direzione di vista (yaw/pitch)
 * e per ciascuna risolve un'affine 2D sul piano immagine (assorbe scala,
 * rollio e un po' di prospettiva). Stabile anche con punti quasi complanari.
 */
export function fitViewCamera(marks: Landmark[], origin: Vector3, yaw: [number, number], pitch: [number, number]): ProjCam {
  let best: ProjCam | null = null;
  const up = new Vector3(0, 1, 0);
  const v = new Vector3();
  const e1 = new Vector3();
  const e2 = new Vector3();
  const q = new Vector3();
  for (let ya = yaw[0]; ya <= yaw[1] + 1e-9; ya += 0.02) {
    for (let pa = pitch[0]; pa <= pitch[1] + 1e-9; pa += 0.02) {
      v.set(Math.sin(ya) * Math.cos(pa), Math.sin(pa), Math.cos(ya) * Math.cos(pa));
      e1.crossVectors(up, v).normalize();
      e2.crossVectors(v, e1).normalize();
      const M = [0, 1, 2].map(() => [0, 0, 0]);
      const bx = [0, 0, 0];
      const by = [0, 0, 0];
      for (const m of marks) {
        const w = m.w ?? 1;
        q.copy(m.p).sub(origin);
        const f = [q.dot(e1), q.dot(e2), 1];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) M[i][j] += w * f[i] * f[j];
          bx[i] += w * f[i] * m.px;
          by[i] += w * f[i] * m.py;
        }
      }
      const ax = solve3(M, bx);
      const ay = solve3(M, by);
      const r0: ProjCam["r0"] = [ax[0] * e1.x + ax[1] * e2.x, ax[0] * e1.y + ax[1] * e2.y, ax[0] * e1.z + ax[1] * e2.z, ax[2]];
      const r1: ProjCam["r1"] = [ay[0] * e1.x + ay[1] * e2.x, ay[0] * e1.y + ay[1] * e2.y, ay[0] * e1.z + ay[1] * e2.z, ay[2]];
      let err = 0;
      for (const m of marks) {
        q.copy(m.p).sub(origin);
        const ex = r0[0] * q.x + r0[1] * q.y + r0[2] * q.z + r0[3] - m.px;
        const ey = r1[0] * q.x + r1[1] * q.y + r1[2] * q.z + r1[3] - m.py;
        err += ex * ex + ey * ey;
      }
      const rms = Math.sqrt(err / marks.length);
      if (!best || rms < best.rms) best = { r0, r1, view: v.clone(), origin: origin.clone(), rms };
    }
  }
  return best!;
}

/** coordinate texture (u,v) + peso di "facing" per un punto/normale a riposo */
export function projectPoint(
  cam: ProjCam,
  p: Vector3,
  n: Vector3,
  out: [number, number, number],
  facing: [number, number] = [0.08, 0.48],
): void {
  const x = p.x - cam.origin.x;
  const y = p.y - cam.origin.y;
  const z = p.z - cam.origin.z;
  const px = cam.r0[0] * x + cam.r0[1] * y + cam.r0[2] * z + cam.r0[3];
  const py = cam.r1[0] * x + cam.r1[1] * y + cam.r1[2] * z + cam.r1[3];
  const f = n.dot(cam.view);
  const t = Math.min(1, Math.max(0, (f - facing[0]) / (facing[1] - facing[0])));
  out[0] = px / REF_SIZE;
  out[1] = 1 - py / REF_SIZE;
  out[2] = t * t * (3 - 2 * t);
}
