/**
 * Primitive procedurali per Il Professore (solo codice, nessun asset).
 * Tutte le funzioni girano una sola volta alla costruzione del modello.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Quaternion,
  Vector3,
  type Curve,
} from "three";

export type SurfaceFn = (u: number, v: number, out: Vector3) => void;

/**
 * Superficie parametrica (u,v) in [0,1]². Le normali sono calcolate per
 * differenze finite sulla funzione (niente cuciture sulla giunzione u=0/u=1).
 * Convenzione: con u crescente verso +X sul fronte e v crescente verso l'alto
 * la normale du×dv punta verso l'esterno.
 */
export function paramSurface(fn: SurfaceFn, segU: number, segV: number, flip = false): BufferGeometry {
  const nu = segU + 1;
  const nv = segV + 1;
  const pos = new Float32Array(nu * nv * 3);
  const nor = new Float32Array(nu * nv * 3);
  const uvs = new Float32Array(nu * nv * 2);
  const p = new Vector3();
  const a = new Vector3();
  const b = new Vector3();
  const du = new Vector3();
  const dv = new Vector3();
  const n = new Vector3();
  const e = 1e-3;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const u = i / segU;
      const v = j / segV;
      fn(u, v, p);
      const k = j * nu + i;
      pos[k * 3] = p.x;
      pos[k * 3 + 1] = p.y;
      pos[k * 3 + 2] = p.z;
      uvs[k * 2] = u;
      uvs[k * 2 + 1] = v;
      // normale per differenze finite (con arretramento ai poli degeneri)
      let vv = v;
      for (let tries = 0; tries < 4; tries++) {
        fn(Math.min(1, u + e), vv, a);
        fn(Math.max(0, u - e), vv, b);
        du.subVectors(a, b);
        fn(u, Math.min(1, vv + e), a);
        fn(u, Math.max(0, vv - e), b);
        dv.subVectors(a, b);
        n.crossVectors(du, dv);
        if (n.lengthSq() > 1e-6 * du.lengthSq() * dv.lengthSq() && n.lengthSq() > 1e-30) break;
        vv = vv < 0.5 ? vv + 0.01 : vv - 0.01;
      }
      if (flip) n.negate();
      if (n.lengthSq() < 1e-30) n.set(0, 1, 0);
      n.normalize();
      nor[k * 3] = n.x;
      nor[k * 3 + 1] = n.y;
      nor[k * 3 + 2] = n.z;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const i0 = j * nu + i;
      const i1 = i0 + 1;
      const i2 = i0 + nu + 1;
      const i3 = i0 + nu;
      if (flip) idx.push(i0, i3, i1, i1, i3, i2);
      else idx.push(i0, i1, i3, i1, i2, i3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

/** Direzione unitaria da (u,v): u=0 davanti (+Z) e cresce verso +X, v=0 polo basso, v=1 polo alto. */
export function sphereDir(u: number, v: number, out: Vector3): Vector3 {
  const phi = u * Math.PI * 2;
  const theta = (1 - v) * Math.PI; // 0 = alto
  const s = Math.sin(theta);
  return out.set(s * Math.sin(phi), Math.cos(theta), s * Math.cos(phi));
}

/** Guscio radiale chiuso attorno a `center`: raggio funzione della direzione. */
export function radialShell(
  center: Vector3,
  radius: (dir: Vector3) => number,
  segU: number,
  segV: number,
): BufferGeometry {
  const d = new Vector3();
  return paramSurface(
    (u, v, out) => {
      sphereDir(u, v, d);
      out.copy(d).multiplyScalar(radius(d)).add(center);
    },
    segU,
    segV,
  );
}

/** Ellissoide semplice (u,v) già orientato. */
export function ellipsoid(rx: number, ry: number, rz: number, segU: number, segV: number, cx = 0, cy = 0, cz = 0): BufferGeometry {
  const d = new Vector3();
  return paramSurface(
    (u, v, out) => {
      sphereDir(u, v, d);
      out.set(cx + d.x * rx, cy + d.y * ry, cz + d.z * rz);
    },
    segU,
    segV,
  );
}

export interface TubeOpts {
  /** sezione schiacciata: scala lungo la binormale */
  flatten?: number;
  capStart?: boolean;
  capEnd?: boolean;
  /** se presente, la binormale segue questa direzione (es. "fuori dalla testa") */
  outward?: (p: Vector3, out: Vector3) => void;
}

/** Tubo a raggio variabile lungo una curva (frame di Frenet). */
export function taperTube(
  curve: Curve<Vector3>,
  segs: number,
  radial: number,
  radius: (t: number) => number,
  opts: TubeOpts = {},
): BufferGeometry {
  const frames = curve.computeFrenetFrames(segs, false);
  const flat = opts.flatten ?? 1;
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const p = new Vector3();
  const n = new Vector3();
  const oN = new Vector3();
  const oB = new Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    const r = radius(t);
    let N = frames.normals[i];
    let B = frames.binormals[i];
    if (opts.outward) {
      const T = frames.tangents[i];
      opts.outward(p, oB);
      oB.addScaledVector(T, -oB.dot(T));
      if (oB.lengthSq() > 1e-8) {
        oB.normalize();
        oN.crossVectors(oB, T).normalize();
        N = oN;
        B = oB;
      }
    }
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(p.x + r * (c * N.x + s * B.x * flat), p.y + r * (c * N.y + s * B.y * flat), p.z + r * (c * N.z + s * B.z * flat));
      n.set(c * N.x + (s * B.x) / flat, c * N.y + (s * B.y) / flat, c * N.z + (s * B.z) / flat).normalize();
      nor.push(n.x, n.y, n.z);
      uvs.push(t, j / radial);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const cap = (atEnd: boolean) => {
    const t = atEnd ? 1 : 0;
    curve.getPointAt(t, p);
    const T = frames.tangents[atEnd ? segs : 0];
    const sign = atEnd ? 1 : -1;
    const center = pos.length / 3;
    pos.push(p.x, p.y, p.z);
    nor.push(T.x * sign, T.y * sign, T.z * sign);
    uvs.push(t, 0.5);
    const base = (atEnd ? segs : 0) * row;
    const start = pos.length / 3;
    for (let j = 0; j <= radial; j++) {
      const k = base + j;
      pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
      nor.push(T.x * sign, T.y * sign, T.z * sign);
      uvs.push(t, j / radial);
    }
    for (let j = 0; j < radial; j++) {
      if (atEnd) idx.push(center, start + j, start + j + 1);
      else idx.push(center, start + j + 1, start + j);
    }
  };
  if (opts.capStart) cap(false);
  if (opts.capEnd) cap(true);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

export function curve(points: [number, number, number][], tension = 0.5): CatmullRomCurve3 {
  return new CatmullRomCurve3(
    points.map(([x, y, z]) => new Vector3(x, y, z)),
    false,
    "catmullrom",
    tension,
  );
}

/**
 * Nastro a sezione rettangolare (cinghie, cintura): `outward(p, out)` dà la
 * direzione "fuori dal corpo" in ogni punto.
 */
export function ribbon(
  path: Curve<Vector3>,
  segs: number,
  width: number,
  thickness: number,
  outward: (p: Vector3, out: Vector3) => void,
): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const p = new Vector3();
  const T = new Vector3();
  const O = new Vector3();
  const S = new Vector3();
  const corners: Vector3[][] = [];
  const outs: Vector3[] = [];
  const sides: Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    path.getPointAt(t, p);
    path.getTangentAt(t, T);
    outward(p, O);
    O.addScaledVector(T, -O.dot(T)).normalize();
    S.crossVectors(T, O).normalize();
    const hw = width / 2;
    const ht = thickness / 2;
    corners.push([
      p.clone().addScaledVector(S, -hw).addScaledVector(O, ht),
      p.clone().addScaledVector(S, hw).addScaledVector(O, ht),
      p.clone().addScaledVector(S, hw).addScaledVector(O, -ht),
      p.clone().addScaledVector(S, -hw).addScaledVector(O, -ht),
    ]);
    outs.push(O.clone());
    sides.push(S.clone());
  }
  // 4 facce: fuori, lato +S, dentro, lato -S
  const faces: [number, number, (i: number) => Vector3][] = [
    [0, 1, (i) => outs[i]],
    [1, 2, (i) => sides[i]],
    [2, 3, (i) => outs[i].clone().negate()],
    [3, 0, (i) => sides[i].clone().negate()],
  ];
  for (const [c0, c1, nf] of faces) {
    const start = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const n = nf(i);
      for (const c of [c0, c1]) {
        const q = corners[i][c];
        pos.push(q.x, q.y, q.z);
        nor.push(n.x, n.y, n.z);
        uvs.push(i / segs, c === c0 ? 0 : 1);
      }
    }
    for (let i = 0; i < segs; i++) {
      const a = start + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

const _q = new Quaternion();
const _down = new Vector3(0, -1, 0);
/** Quaternione che porta -Y sulla direzione data (per capsule orientate). */
export function alignDown(dir: Vector3): Quaternion {
  return _q.setFromUnitVectors(_down, dir.clone().normalize()).clone();
}

/** Interpolazione cubica liscia (Catmull-Rom) su una tabella (xs crescenti). */
export function smoothTable(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 0;
  while (i < n - 2 && x > xs[i + 1]) i++;
  const x0 = xs[i];
  const x1 = xs[i + 1];
  const t = (x - x0) / (x1 - x0);
  const y0 = ys[i];
  const y1 = ys[i + 1];
  const m0 = i > 0 ? ((ys[i + 1] - ys[i - 1]) / (xs[i + 1] - xs[i - 1])) * (x1 - x0) : y1 - y0;
  const m1 = i < n - 2 ? ((ys[i + 2] - ys[i]) / (xs[i + 2] - xs[i])) * (x1 - x0) : y1 - y0;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Pseudo-random deterministico (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
