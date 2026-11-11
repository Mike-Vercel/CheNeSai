import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, Matrix3, Matrix4, Quaternion, Vector3 } from "three";

/**
 * Helper geometrici per La Regina (img2threejs, build procedurale).
 * Tutto gira solo in fase di costruzione: nessuna allocazione per frame.
 */

/** PRNG deterministico (mulberry32) per ciocche, lentiggini, noccioline. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface SkinSample {
  i0: number;
  w0: number;
  i1: number;
  w1: number;
}

/** Restituisce i pesi di skinning per un vertice (posizione nello spazio modello). */
export type WeightFn = (p: Vector3, out: SkinSample, v: number) => void;
/** Colore per vertice: p = posizione modello, v = coordinata lungo la geometria (uv.y) se presente. */
export type ColorFn = (p: Vector3, n: Vector3, out: Color, v: number, u: number) => void;

/** Campione di proiezione: coordinate nella texture di riferimento + peso di fusione (0 = solo colore procedurale). */
export interface ProjSample {
  u: number;
  v: number;
  w: number;
}
/** Proiezione/mappatura dei pixel dell'illustrazione: p = posizione modello (prima della scala testa), v/u = uv della geometria. */
export type ProjFn = (p: Vector3, n: Vector3, v: number, u: number, out: ProjSample) => void;

export interface AddOptions {
  proj?: ProjFn;
  matrix?: Matrix4;
  color?: Color;
  colorFn?: ColorFn;
  bone?: number;
  weightFn?: WeightFn;
}

const _p = new Vector3();
const _n = new Vector3();
const _c = new Color();
const _nm = new Matrix3();
const _skin: SkinSample = { i0: 0, w0: 1, i1: 0, w1: 0 };
const _proj: ProjSample = { u: 0, v: 0, w: 0 };
const IDENTITY = new Matrix4();

/**
 * Accumula più parti in un'unica geometria (un draw call per materiale) con
 * colore per vertice e indici/pesi di skinning (parti rigide o pesi morbidi).
 */
export class MeshAccumulator {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private si: number[] = [];
  private sw: number[] = [];
  private idx: number[] = [];
  private puv: number[] = [];
  private pw: number[] = [];
  /** trasformazione finale applicata dopo pesi e colori (es. scala della testa) */
  private post: Matrix4 | null = null;

  setPost(m: Matrix4 | null): void {
    this.post = m;
  }

  private projFactory: (() => ProjFn | undefined) | null = null;
  /** proiezione di default per le aggiunte che non ne specificano una (chiamata una volta per geometria) */
  setProjFactory(f: (() => ProjFn | undefined) | null): void {
    this.projFactory = f;
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get triangleCount(): number {
    return this.idx.length / 3;
  }

  add(geom: BufferGeometry, o: AddOptions): void {
    if (!geom.getAttribute("normal")) geom.computeVertexNormals();
    const pa = geom.getAttribute("position");
    const na = geom.getAttribute("normal");
    const uva = geom.getAttribute("uv");
    const m = o.matrix ?? IDENTITY;
    _nm.getNormalMatrix(m);
    const base = this.vertexCount;
    const flip = m.determinant() < 0;
    const proj = o.proj ?? this.projFactory?.();
    for (let i = 0; i < pa.count; i++) {
      _p.fromBufferAttribute(pa, i).applyMatrix4(m);
      _n.fromBufferAttribute(na, i).applyMatrix3(_nm).normalize();
      if (flip) _n.multiplyScalar(-1);
      const v = uva ? uva.getY(i) : 0;
      const u = uva ? uva.getX(i) : 0;
      if (o.colorFn) o.colorFn(_p, _n, _c, v, u);
      else if (o.color) _c.copy(o.color);
      else _c.setRGB(1, 1, 1);
      this.col.push(_c.r, _c.g, _c.b);
      if (o.weightFn) {
        _skin.i0 = 0;
        _skin.w0 = 1;
        _skin.i1 = 0;
        _skin.w1 = 0;
        o.weightFn(_p, _skin, v);
        const s = _skin.w0 + _skin.w1 || 1;
        this.si.push(_skin.i0, _skin.i1, 0, 0);
        this.sw.push(_skin.w0 / s, _skin.w1 / s, 0, 0);
      } else {
        this.si.push(o.bone ?? 0, 0, 0, 0);
        this.sw.push(1, 0, 0, 0);
      }
      if (proj) {
        _proj.u = 0;
        _proj.v = 0;
        _proj.w = 0;
        proj(_p, _n, v, u, _proj);
        this.puv.push(_proj.u, _proj.v);
        this.pw.push(_proj.w);
      } else {
        this.puv.push(0, 0);
        this.pw.push(0);
      }
      if (this.post) _p.applyMatrix4(this.post);
      this.pos.push(_p.x, _p.y, _p.z);
      this.nor.push(_n.x, _n.y, _n.z);
    }
    const index = geom.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i) + base;
        const b = index.getX(i + 1) + base;
        const c = index.getX(i + 2) + base;
        if (flip) this.idx.push(a, c, b);
        else this.idx.push(a, b, c);
      }
    } else {
      for (let i = 0; i < pa.count; i += 3) {
        if (flip) this.idx.push(base + i, base + i + 2, base + i + 1);
        else this.idx.push(base + i, base + i + 1, base + i + 2);
      }
    }
    geom.dispose();
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute("skinIndex", new BufferAttribute(new Uint16Array(this.si), 4));
    g.setAttribute("skinWeight", new BufferAttribute(new Float32Array(this.sw), 4));
    g.setAttribute("projUv", new BufferAttribute(new Float32Array(this.puv), 2));
    g.setAttribute("projW", new BufferAttribute(new Float32Array(this.pw), 1));
    const n = this.vertexCount;
    g.setIndex(new BufferAttribute(n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
}

export interface TubeOptions {
  segments: number;
  radial: number;
  /** raggio in funzione di t (0..1 lungo la curva) */
  radius: (t: number) => number;
  /** schiacciamento della sezione lungo la "normale" (1 = tondo), costante o funzione di t */
  flat?: number | ((t: number) => number);
  /** direzione "fuori" per orientare la sezione piatta (es. normale della testa) */
  hint?: (p: Vector3, out: Vector3) => void;
  /** tensione Catmull-Rom */
  curveType?: "centripetal" | "chordal" | "catmullrom";
  closed?: boolean;
}

const _t = new Vector3();
const _b = new Vector3();
const _nn = new Vector3();
const _h = new Vector3();
const _prevT = new Vector3();
const _q = new Quaternion();
const _pt = new Vector3();

/** Tubo rastremato a sezione ellittica lungo una curva (ciocche, sopracciglia, profili). */
export function taperedTube(points: Vector3[], o: TubeOptions): BufferGeometry {
  const curve = new CatmullRomCurve3(points, o.closed ?? false, o.curveType ?? "centripetal");
  const segs = o.segments;
  const rad = o.radial;
  const flatOpt = o.flat ?? 1;
  const flatAt = typeof flatOpt === "number" ? () => flatOpt : flatOpt;
  const ring = rad + 1;
  const pos = new Float32Array((segs + 1) * ring * 3);
  const uv = new Float32Array((segs + 1) * ring * 2);
  const idx: number[] = [];
  // frame iniziale
  curve.getTangentAt(0, _prevT);
  if (o.hint) {
    o.hint(curve.getPointAt(0, _pt), _h);
  } else {
    _h.set(0, 1, 0);
    if (Math.abs(_h.dot(_prevT)) > 0.9) _h.set(1, 0, 0);
  }
  _b.crossVectors(_prevT, _h).normalize();
  _nn.crossVectors(_b, _prevT).normalize();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, _pt);
    curve.getTangentAt(t, _t);
    if (o.hint) {
      o.hint(_pt, _h);
      _b.crossVectors(_t, _h);
      if (_b.lengthSq() < 1e-8) _b.crossVectors(_t, _nn);
      _b.normalize();
      _nn.crossVectors(_b, _t).normalize();
    } else if (i > 0) {
      // trasporto parallelo
      _q.setFromUnitVectors(_prevT, _t);
      _nn.applyQuaternion(_q);
      _b.applyQuaternion(_q);
    }
    _prevT.copy(_t);
    const r = o.radius(t);
    const flat = flatAt(t);
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      const ca = Math.cos(a) * r;
      const sa = Math.sin(a) * r * flat;
      const k = (i * ring + j) * 3;
      pos[k] = _pt.x + _b.x * ca + _nn.x * sa;
      pos[k + 1] = _pt.y + _b.y * ca + _nn.y * sa;
      pos[k + 2] = _pt.z + _b.z * ca + _nn.z * sa;
      const ku = (i * ring + j) * 2;
      uv[ku] = j / rad;
      uv[ku + 1] = t;
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < rad; j++) {
      const a = i * ring + j;
      const b = (i + 1) * ring + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Profilo di raggio con punta arrotondata e radice piena. */
export function lockRadius(r0: number, rMid: number, tipStart = 0.82, rootRound = 0.04): (t: number) => number {
  return (t: number) => {
    let r = t < 0.5 ? lerp(r0, rMid, t / 0.5) : lerp(rMid, rMid * 0.35, (t - 0.5) / 0.5);
    if (t > tipStart) {
      const k = (t - tipStart) / (1 - tipStart);
      r *= Math.sqrt(Math.max(0, 1 - k * k));
    }
    if (t < rootRound) r *= 0.25 + 0.75 * Math.sqrt(t / rootRound);
    return Math.max(r, 0.0004);
  };
}

/** Raggio "a capsula": pieno al centro e chiuso agli estremi. */
export function capsuleRadius(r: number, cap = 0.12, rEnd?: number): (t: number) => number {
  return (t: number) => {
    const base = rEnd === undefined ? r : lerp(r, rEnd, t);
    let k = 1;
    if (t < cap) k = Math.sqrt(Math.max(0, 1 - ((cap - t) / cap) ** 2));
    else if (t > 1 - cap) k = Math.sqrt(Math.max(0, 1 - ((t - (1 - cap)) / cap) ** 2));
    return Math.max(base * k, 0.0003);
  };
}

/** Matrice che porta l'asse +Y locale lungo (b - a), centrata in a, con scala. */
export function alignY(a: Vector3, b: Vector3, out: Matrix4, sx = 1, sz = 1): Matrix4 {
  const dir = new Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  return out.compose(a.clone(), q, new Vector3(sx, len, sz));
}

/** Matrice da base ortonormale (x, y, z) + origine + scala. */
export function basisMatrix(origin: Vector3, x: Vector3, y: Vector3, z: Vector3, s = 1): Matrix4 {
  const m = new Matrix4().makeBasis(x.clone().multiplyScalar(s), y.clone().multiplyScalar(s), z.clone().multiplyScalar(s));
  m.setPosition(origin);
  return m;
}

export const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
