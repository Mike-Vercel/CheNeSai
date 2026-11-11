/**
 * SkinKit: raccoglie le parti (geometria in spazio locale dell'osso) e le
 * fonde in UNA geometria skinnata per materiale. Ogni parte è legata
 * rigidamente a un osso oppure sfuma tra due ossa (barba/bocca sulla
 * mandibola, busto tra bacino/colonna/torace). Risultato: pochi draw call
 * con una gerarchia di ossa completa.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Uint16BufferAttribute, Vector3 } from "three";
import { projectPoint, type ProjCam } from "./projection";

export interface BoneDef {
  name: string;
  parent: number;
  /** offset dal genitore in posa di riposo (nessuna rotazione a riposo) */
  offset: [number, number, number];
}

export type ColorFn = (p: Vector3, n: Vector3, out: Color, u: number, v: number) => void;
/** ritorna [ossoA, ossoB, pesoB] dato il punto in spazio modello (riposo) */
export type WeightFn = (p: Vector3) => [number, number, number];

export interface PartOpts {
  bone: number;
  /** trasformazione della parte nello spazio dell'osso */
  matrix?: Matrix4;
  color: string | Color | ColorFn;
  weights?: WeightFn;
  /** proiezione dell'illustrazione: camera della regione + etichetta accettata */
  proj?: { cam: ProjCam; label: number; strength?: number; facing?: [number, number] };
}

interface Part {
  geo: BufferGeometry;
  color: Float32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  proj: Float32Array;
}

export class SkinKit<M extends string> {
  readonly rest: Vector3[];
  private parts = new Map<M, Part[]>();
  triangles = 0;

  /**
   * @param squash compressione verticale del busto: le parti legate a `bones`
   * sono scritte in coordinate "di progetto" e poi schiacciate in y di `s`
   * (le ossa del busto hanno già gli offset y scalati in layout.ts).
   */
  constructor(
    readonly bones: BoneDef[],
    private readonly squash: { s: number; bones: number[] } = { s: 1, bones: [] },
  ) {
    this.rest = [];
    bones.forEach((b, i) => {
      const v = new Vector3(...b.offset);
      if (b.parent >= 0) v.add(this.rest[b.parent]);
      this.rest[i] = v;
    });
  }

  /** posizione di riposo (spazio modello) di un punto espresso nello spazio dell'osso */
  toModel(bone: number, x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z).add(this.rest[bone]);
  }

  add(mat: M, geo: BufferGeometry, opts: PartOpts): void {
    if (opts.matrix) geo.applyMatrix4(opts.matrix);
    const squashed = this.squash.s !== 1 && this.squash.bones.includes(opts.bone);
    const r = this.rest[opts.bone];
    geo.translate(r.x, squashed ? r.y / this.squash.s : r.y, r.z);
    if (!geo.index) {
      const n = geo.getAttribute("position").count;
      const ix: number[] = [];
      for (let i = 0; i < n; i++) ix.push(i);
      geo.setIndex(ix);
    }
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    if (!geo.getAttribute("uv")) {
      const n = geo.getAttribute("position").count;
      geo.setAttribute("uv", new Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    const P = geo.getAttribute("position");
    const N = geo.getAttribute("normal");
    const UV = geo.getAttribute("uv");
    const n = P.count;
    const color = new Float32Array(n * 3);
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);
    const proj = new Float32Array(n * 4);
    const pj: [number, number, number] = [0, 0, 0];
    const p = new Vector3();
    const nn = new Vector3();
    const c = new Color();
    const flat = typeof opts.color === "function" ? null : new Color(opts.color);
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(P, i);
      nn.fromBufferAttribute(N, i);
      if (flat) c.copy(flat);
      else (opts.color as ColorFn)(p, nn, c, UV.getX(i), UV.getY(i));
      color[i * 3] = c.r;
      color[i * 3 + 1] = c.g;
      color[i * 3 + 2] = c.b;
      if (opts.proj) {
        projectPoint(opts.proj.cam, p, nn, pj, opts.proj.facing);
        proj[i * 4] = pj[0];
        proj[i * 4 + 1] = pj[1];
        proj[i * 4 + 2] = pj[2] * (opts.proj.strength ?? 1);
        proj[i * 4 + 3] = opts.proj.label;
      }
      if (opts.weights) {
        const [a, b, w] = opts.weights(p);
        skinIndex[i * 4] = a;
        skinIndex[i * 4 + 1] = b;
        skinWeight[i * 4] = 1 - w;
        skinWeight[i * 4 + 1] = w;
      } else {
        skinIndex[i * 4] = opts.bone;
        skinWeight[i * 4] = 1;
      }
    }
    if (squashed) {
      const sy = this.squash.s;
      for (let i = 0; i < n; i++) {
        P.setY(i, P.getY(i) * sy);
        nn.set(N.getX(i), N.getY(i) / sy, N.getZ(i)).normalize();
        N.setXYZ(i, nn.x, nn.y, nn.z);
      }
    }
    this.triangles += geo.index!.count / 3;
    const list = this.parts.get(mat) ?? [];
    list.push({ geo, color, skinIndex, skinWeight, proj });
    this.parts.set(mat, list);
  }

  /** Fonde tutte le parti di ogni materiale. */
  build(): Map<M, BufferGeometry> {
    const out = new Map<M, BufferGeometry>();
    for (const [mat, list] of this.parts) {
      let nv = 0;
      let ni = 0;
      for (const part of list) {
        nv += part.geo.getAttribute("position").count;
        ni += part.geo.index!.count;
      }
      const pos = new Float32Array(nv * 3);
      const nor = new Float32Array(nv * 3);
      const uv = new Float32Array(nv * 2);
      const col = new Float32Array(nv * 3);
      const si = new Uint16Array(nv * 4);
      const sw = new Float32Array(nv * 4);
      const pr = new Float32Array(nv * 4);
      const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
      let vo = 0;
      let io = 0;
      for (const part of list) {
        const g = part.geo;
        const count = g.getAttribute("position").count;
        pos.set(g.getAttribute("position").array as Float32Array, vo * 3);
        nor.set(g.getAttribute("normal").array as Float32Array, vo * 3);
        uv.set(g.getAttribute("uv").array as Float32Array, vo * 2);
        col.set(part.color, vo * 3);
        si.set(part.skinIndex, vo * 4);
        sw.set(part.skinWeight, vo * 4);
        pr.set(part.proj, vo * 4);
        const src = g.index!.array;
        for (let k = 0; k < src.length; k++) index[io + k] = src[k] + vo;
        vo += count;
        io += src.length;
        g.dispose();
      }
      const geo = new BufferGeometry();
      geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
      geo.setAttribute("normal", new Float32BufferAttribute(nor, 3));
      geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
      geo.setAttribute("color", new Float32BufferAttribute(col, 3));
      geo.setAttribute("skinIndex", new Uint16BufferAttribute(si, 4));
      geo.setAttribute("skinWeight", new Float32BufferAttribute(sw, 4));
      geo.setAttribute("proj", new Float32BufferAttribute(pr, 4));
      geo.setIndex(Array.from(index));
      geo.computeBoundingSphere();
      out.set(mat, geo);
    }
    return out;
  }
}

/** Matrice di parte: traslazione + rotazione (Euler XYZ) + scala. */
export function partMatrix(
  t: [number, number, number],
  r: [number, number, number] = [0, 0, 0],
  s: [number, number, number] | number = 1,
): Matrix4 {
  const m = new Matrix4();
  const sc = typeof s === "number" ? [s, s, s] : s;
  const rot = new Matrix4();
  const rx = new Matrix4().makeRotationX(r[0]);
  const ry = new Matrix4().makeRotationY(r[1]);
  const rz = new Matrix4().makeRotationZ(r[2]);
  rot.multiply(rx).multiply(ry).multiply(rz);
  m.makeTranslation(t[0], t[1], t[2]).multiply(rot).multiply(new Matrix4().makeScale(sc[0], sc[1], sc[2]));
  return m;
}
