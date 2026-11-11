import {
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Shape,
  SphereGeometry,
  SplineCurve,
  TubeGeometry,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BARK_HEIGHT, BARK_U0, BARK_U1, LENS_RECT, LOGO_RECT, PATCH, type UV } from "./atlas";

/* ------------------------------------------------------------------------------------------
 * Scheletro rigido di Palmino (bind pose = braccia orizzontali, metri, piedi all'origine,
 * sguardo verso +Z, sinistra del personaggio = +X). Ogni parte è pesata al 100% su un osso:
 * un unico SkinnedMesh = 1 draw call per tutto il corpo.
 * ---------------------------------------------------------------------------------------- */

export const BONE_NAMES = [
  "root",
  "hips",
  "sleeveLow",
  "sleeveHigh",
  "head",
  "jaw",
  "crown",
  "shoulderL",
  "elbowL",
  "handL",
  "indexL",
  "middleL",
  "ringL",
  "thumbL",
  "shoulderR",
  "elbowR",
  "handR",
  "indexR",
  "middleR",
  "ringR",
  "thumbR",
  "footL",
  "footR",
] as const;
export type BoneName = (typeof BONE_NAMES)[number];
export const BONE: Record<BoneName, number> = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i])) as Record<
  BoneName,
  number
>;

const SHOULDER = new Vector3(0.185, 0.885, 0.0);

/** Leggera curva organica del tronco-testa: sopra la bocca piega appena indietro e di lato. */
export function headBend(y: number): [number, number] {
  const sm = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  return [0.016 * sm(1.08, 1.36, y), -0.034 * sm(1.1, 1.36, y)];
}
const CROWN_Y = 1.285;
const UPPER_ARM = 0.18;
const FOREARM = 0.155;
const FINGER_BASE_X = 0.147;

/** Posizione (bind, coordinate modello) e genitore di ogni osso. */
export const BONE_BIND: Record<BoneName, { parent: BoneName | null; pos: [number, number, number] }> = {
  root: { parent: null, pos: [0, 0, 0] },
  hips: { parent: "root", pos: [0, 0.42, 0] },
  sleeveLow: { parent: "hips", pos: [0, 0.58, 0] },
  sleeveHigh: { parent: "sleeveLow", pos: [0, 0.7, 0] },
  head: { parent: "sleeveHigh", pos: [0, 0.8, 0] },
  jaw: { parent: "head", pos: [0, 1.035, -0.07] },
  crown: { parent: "head", pos: [headBend(CROWN_Y)[0], CROWN_Y, headBend(CROWN_Y)[1]] },
  shoulderL: { parent: "head", pos: [SHOULDER.x, SHOULDER.y, SHOULDER.z] },
  elbowL: { parent: "shoulderL", pos: [SHOULDER.x + UPPER_ARM, SHOULDER.y, 0] },
  handL: { parent: "elbowL", pos: [SHOULDER.x + UPPER_ARM + FOREARM, SHOULDER.y, 0] },
  indexL: { parent: "handL", pos: [SHOULDER.x + UPPER_ARM + FOREARM + FINGER_BASE_X, SHOULDER.y + 0.043, 0.005] },
  middleL: { parent: "handL", pos: [SHOULDER.x + UPPER_ARM + FOREARM + FINGER_BASE_X + 0.006, SHOULDER.y, 0.005] },
  ringL: { parent: "handL", pos: [SHOULDER.x + UPPER_ARM + FOREARM + FINGER_BASE_X, SHOULDER.y - 0.043, 0.005] },
  thumbL: { parent: "handL", pos: [SHOULDER.x + UPPER_ARM + FOREARM + 0.064, SHOULDER.y + 0.053, 0.009] },
  shoulderR: { parent: "head", pos: [-SHOULDER.x, SHOULDER.y, SHOULDER.z] },
  elbowR: { parent: "shoulderR", pos: [-(SHOULDER.x + UPPER_ARM), SHOULDER.y, 0] },
  handR: { parent: "elbowR", pos: [-(SHOULDER.x + UPPER_ARM + FOREARM), SHOULDER.y, 0] },
  indexR: { parent: "handR", pos: [-(SHOULDER.x + UPPER_ARM + FOREARM + FINGER_BASE_X), SHOULDER.y + 0.043, 0.005] },
  middleR: { parent: "handR", pos: [-(SHOULDER.x + UPPER_ARM + FOREARM + FINGER_BASE_X + 0.006), SHOULDER.y, 0.005] },
  ringR: { parent: "handR", pos: [-(SHOULDER.x + UPPER_ARM + FOREARM + FINGER_BASE_X), SHOULDER.y - 0.043, 0.005] },
  thumbR: { parent: "handR", pos: [-(SHOULDER.x + UPPER_ARM + FOREARM + 0.064), SHOULDER.y + 0.053, 0.009] },
  footL: { parent: "root", pos: [0.15, 0.06, 0.0] },
  footR: { parent: "root", pos: [-0.15, 0.06, 0.0] },
};

/* --------------------------------- palette ---------------------------------------------- */
const COL = {
  barkTex: new Color(1, 1, 1),
  // leggermente verdastro: il tone mapping ACES sposta il giallo verso l'arancio
  shorts: new Color("#e2f000"),
  shortsShade: new Color("#b2b000"),
  drawstring: new Color("#14686e"),
  glove: new Color("#f6f6f2"),
  gloveShade: new Color("#d7d7d2"),
  lens: new Color("#0b2117"),
  frame: new Color("#0a0a0a"),
  mouth: new Color("#7c1420"),
  throat: new Color("#3a060b"),
  teeth: new Color("#fbfbf6"),
  tongue: new Color("#ef7f97"),
  white: new Color(1, 1, 1),
};

/* ------------------------------ helpers ------------------------------------------------- */
type ColorFn = (p: Vector3, n: Vector3) => Color;
type UvFn = (p: Vector3, i: number) => UV;

interface PartOptions {
  bone: BoneName;
  color: Color | ColorFn;
  uv: UV | UvFn | "keep";
  /** peso della proiezione del riferimento (0 = solo procedurale); default 1, 0 per bocca/denti/mandibola */
  proj?: number | ((p: Vector3) => number);
}

const _p = new Vector3();
const _n = new Vector3();

/** Normalizza una geometria in una "parte" pronta per il merge: position/normal/uv/color/skin. */
function part(geoIn: BufferGeometry, opts: PartOptions): BufferGeometry {
  let geo = geoIn;
  for (const name of Object.keys(geo.attributes)) {
    if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
  }
  if (!geo.index) {
    if (!geo.getAttribute("uv")) geo.setAttribute("uv", new Float32BufferAttribute(new Float32Array(geo.getAttribute("position").count * 2), 2));
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    geo = mergeVertices(geo, 1e-5);
  }
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const oldUv = geo.getAttribute("uv");
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  const projFn = typeof opts.proj === "function" ? opts.proj : null;
  const refWeight = new Float32Array(count).fill(
    typeof opts.proj === "number" ? opts.proj : opts.bone === "jaw" || opts.uv === PATCH.mouth || opts.uv === PATCH.enamel ? 0 : 1,
  );
  const boneIdx = BONE[opts.bone];
  for (let i = 0; i < count; i++) {
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nor, i);
    const c = typeof opts.color === "function" ? opts.color(_p, _n) : opts.color;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    if (opts.uv === "keep") {
      uvs[i * 2] = oldUv ? oldUv.getX(i) : 0;
      uvs[i * 2 + 1] = oldUv ? oldUv.getY(i) : 0;
    } else {
      const uv = typeof opts.uv === "function" ? opts.uv(_p, i) : opts.uv;
      uvs[i * 2] = uv[0];
      uvs[i * 2 + 1] = uv[1];
    }
    if (projFn) refWeight[i] = projFn(_p);
    skinIndex[i * 4] = boneIdx;
    skinWeight[i * 4] = 1;
  }
  const out = new BufferGeometry();
  out.setIndex(geo.index ? geo.index.clone() : null);
  out.setAttribute("position", pos.clone());
  out.setAttribute("normal", nor.clone());
  out.setAttribute("uv", new BufferAttribute(uvs, 2));
  out.setAttribute("color", new BufferAttribute(colors, 3));
  out.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndex, 4));
  out.setAttribute("skinWeight", new BufferAttribute(skinWeight, 4));
  out.setAttribute("refWeight", new BufferAttribute(refWeight, 1));
  geo.dispose();
  geoIn.dispose();
  return out;
}

/** Specchia una parte sinistra sul lato destro (x → -x) e ri-assegna l'osso. */
function mirrorPart(src: BufferGeometry, bone: BoneName): BufferGeometry {
  const g = src.clone();
  g.applyMatrix4(new Matrix4().makeScale(-1, 1, 1));
  const idx = g.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
  }
  const si = g.getAttribute("skinIndex");
  const b = BONE[bone];
  for (let i = 0; i < si.count; i++) si.setX(i, b);
  return g;
}

/** Superficie di rivoluzione con sezione ellittica, cucitura sul retro e buchi opzionali. */
function lathe(
  profile: Vector2[],
  segments: number,
  opts: {
    zScale?: number;
    center?: [number, number];
    hole?: (theta: number, y: number) => boolean;
    closeBottom?: boolean;
  } = {},
): BufferGeometry {
  const zScale = opts.zScale ?? 1;
  const [cx, cz] = opts.center ?? [0, 0];
  const rows = profile.length;
  const cols = segments + 1;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  for (let j = 0; j < rows; j++) {
    const { x: r, y } = profile[j];
    for (let i = 0; i < cols; i++) {
      const theta = -Math.PI + (i / segments) * Math.PI * 2;
      const k = (j * cols + i) * 3;
      positions[k] = cx + r * Math.sin(theta);
      positions[k + 1] = y;
      positions[k + 2] = cz + r * Math.cos(theta) * zScale;
      uvs[(j * cols + i) * 2] = BARK_U0 + (BARK_U1 - BARK_U0) * (i / segments);
      uvs[(j * cols + i) * 2 + 1] = Math.min(1, Math.max(0, y / BARK_HEIGHT));
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < segments; i++) {
      if (opts.hole) {
        const tc = -Math.PI + ((i + 0.5) / segments) * Math.PI * 2;
        const yc = (profile[j].y + profile[j + 1].y) / 2;
        if (opts.hole(tc, yc)) continue;
      }
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      // profilo dal basso verso l'alto → normale verso l'esterno
      index.push(a, b, d, a, d, c);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("uv", new BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // ricuci le normali sulla cucitura (prima/ultima colonna)
  const nor = geo.getAttribute("normal");
  for (let j = 0; j < rows; j++) {
    const a = j * cols;
    const b = a + segments;
    const nx = nor.getX(a) + nor.getX(b);
    const ny = nor.getY(a) + nor.getY(b);
    const nz = nor.getZ(a) + nor.getZ(b);
    const len = Math.hypot(nx, ny, nz) || 1;
    nor.setXYZ(a, nx / len, ny / len, nz / len);
    nor.setXYZ(b, nx / len, ny / len, nz / len);
  }
  return geo;
}

/** Griglia parametrica generica (cols×rows) con indice; `flip` inverte l'avvolgimento. */
function grid(cols: number, rows: number, fn: (u: number, v: number) => Vector3, flip = false): BufferGeometry {
  const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const p = fn(i / cols, j / rows);
      const k = (j * (cols + 1) + i) * 3;
      positions[k] = p.x;
      positions[k + 1] = p.y;
      positions[k + 2] = p.z;
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      if (flip) index.push(a, d, b, a, c, d);
      else index.push(a, b, d, a, d, c);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function sampleProfile(points: [number, number][], count: number): Vector2[] {
  const curve = new SplineCurve(points.map(([r, y]) => new Vector2(r, y)));
  return curve.getSpacedPoints(count - 1);
}

function flipInsideOut(geo: BufferGeometry): BufferGeometry {
  const idx = geo.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
  }
  const n = geo.getAttribute("normal");
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return geo;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** UV corteccia "planare" per parti non di rivoluzione (piedi, braccia). */
const barkPlanar =
  (scale = 1, offset = 0): UvFn =>
  (p) => [BARK_U0 + (BARK_U1 - BARK_U0) * (((p.x + p.z * 0.7) * scale + offset + 10) % 1), Math.min(1, Math.max(0, p.y / BARK_HEIGHT))];

/* -------------------------------- testa e bocca ---------------------------------------- */

const HEAD_PROFILE: [number, number][] = [
  [0.176, 0.74],
  [0.19, 0.8],
  [0.206, 0.87],
  [0.215, 0.94],
  [0.216, 1.0],
  [0.211, 1.07],
  [0.201, 1.14],
  [0.189, 1.2],
  [0.175, 1.25],
  [0.155, 1.29],
  [0.116, 1.322],
  [0.064, 1.34],
  [0.0, 1.348],
];

/** Raggio della testa all'altezza y (interpolazione del profilo campionato). */
export function makeHeadRadius(samples: Vector2[]) {
  return (y: number) => {
    if (y <= samples[0].y) return samples[0].x;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      if (y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
    }
    return 0;
  };
}

/** Contorno della bocca: mezzaluna con il bordo superiore quasi dritto (sorriso). */
export const MOUTH = {
  thetaHalf: 0.74,
  // bordo superiore quasi dritto, angoli che salgono (sorriso a "D" del riferimento)
  topY: (u: number) => 1.045 + 0.03 * u * u * u * u + 0.006 * u,
  depth: 0.175,
  bottomY(u: number) {
    // fondo pieno e arrotondato (esponente < 0.5 = più "a D")
    return this.topY(u) - this.depth * Math.pow(Math.max(0, 1 - u * u), 0.42);
  },
  /** linea dove arriva il labbro inferiore a bocca chiusa (sotto ai denti) */
  closedY(u: number) {
    return this.topY(u) - 0.042;
  },
};

/* -------------------------------- costruzione ------------------------------------------ */

export interface PalminoBodyGeometry {
  geometry: BufferGeometry;
  headRadius: (y: number) => number;
  triangles: number;
}

export function buildPalminoBody(lowPower: boolean): PalminoBodyGeometry {
  const q = lowPower ? 0.55 : 1;
  const seg = (n: number) => Math.max(6, Math.round(n * q));
  const parts: BufferGeometry[] = [];

  /* ---- testa (tronco con faccia) ---- */
  const headRows = seg(54);
  const headSamples = sampleProfile(HEAD_PROFILE, headRows);
  const headRadius = makeHeadRadius(headSamples);
  const holeMargin = lowPower ? 0.012 : 0.006;
  const inMouth = (theta: number, y: number) => {
    const u = theta / (MOUTH.thetaHalf + 0.015);
    if (Math.abs(u) >= 1) return false;
    return y < MOUTH.topY(u) + holeMargin && y > MOUTH.bottomY(u) - holeMargin;
  };
  const barkAO: ColorFn = (p) => {
    // leggera occlusione in basso (dove entra nel segmento sotto) e sotto i labbri della bocca
    const base = 0.72 + 0.28 * smooth(0.74, 0.84, p.y);
    return new Color(base, base, base);
  };
  {
    const headGeo = lathe(headSamples, seg(84), { hole: inMouth });
    const hp = headGeo.getAttribute("position");
    for (let i = 0; i < hp.count; i++) {
      const [bx, bz] = headBend(hp.getY(i));
      hp.setXYZ(i, hp.getX(i) + bx, hp.getY(i), hp.getZ(i) + bz);
    }
    // la bocca del riferimento non coincide al millimetro con la nostra: attorno alla bocca niente
    // proiezione, altrimenti compare un "secondo labbro" fantasma sul mento e sulle guance
    const mouthFade = (p: Vector3) => {
      const th = Math.atan2(p.x, p.z);
      const u = th / MOUTH.thetaHalf;
      const du = Math.max(0, Math.abs(u) - 1) * MOUTH.thetaHalf * 0.21;
      const yTop = MOUTH.topY(Math.max(-1, Math.min(1, u)));
      const yBot = MOUTH.bottomY(Math.max(-1, Math.min(1, u))) - 0.02;
      const dy = Math.max(0, p.y - yTop, yBot - 0.02 - p.y);
      const d = Math.hypot(du, dy);
      return smooth(0.012, 0.05, d);
    };
    parts.push(part(headGeo, { bone: "head", color: barkAO, uv: "keep", proj: mouthFade }));
  }

  /* ---- segmenti a manicotto ---- */
  // manicotti come nel riferimento: tronchi di cono quasi cilindrici (stretti in basso) con un
  // labbro arrotondato che sporge appena oltre il segmento sopra, non "ciotole" svasate
  const sleeveLow = sampleProfile(
    [
      [0.158, 0.5],
      [0.163, 0.56],
      [0.17, 0.61],
      [0.179, 0.65],
      [0.19, 0.684],
      [0.2, 0.705],
      [0.207, 0.716],
      [0.208, 0.726],
      [0.2, 0.733],
      [0.188, 0.733],
      [0.18, 0.726],
    ],
    seg(30),
  );
  const sleeveHigh = sampleProfile(
    [
      [0.17, 0.66],
      [0.176, 0.71],
      [0.184, 0.75],
      [0.195, 0.78],
      [0.207, 0.8],
      [0.214, 0.81],
      [0.215, 0.82],
      [0.207, 0.827],
      [0.194, 0.826],
      [0.186, 0.818],
    ],
    seg(26),
  );
  const sleeveAO = (y0: number, lipY: number): ColorFn => (p, n) => {
    const entry = 0.62 + 0.38 * smooth(y0, y0 + 0.06, p.y);
    const under = n.y < -0.2 ? 0.8 : 1;
    const lip = p.y > lipY ? 0.92 : 1;
    const v = entry * under * lip;
    return new Color(v, v, v);
  };
  parts.push(part(lathe(sleeveLow, seg(60)), { bone: "sleeveLow", color: sleeveAO(0.58, 0.728), uv: "keep" }));
  parts.push(part(lathe(sleeveHigh, seg(60)), { bone: "sleeveHigh", color: sleeveAO(0.715, 0.815), uv: "keep" }));

  /* ---- pantaloncini ---- */
  const shortsShade: ColorFn = (p) => {
    const crotch = 1 - 0.35 * (1 - smooth(0.0, 0.07, Math.abs(p.x))) * (1 - smooth(0.36, 0.44, p.y));
    const band = p.y > 0.58 && p.y < 0.6 ? 0.9 : 1;
    const t = Math.min(crotch, band);
    return COL.shortsShade.clone().lerp(COL.shorts, t);
  };
  const shortsBody = sampleProfile(
    [
      [0.0, 0.366],
      [0.1, 0.37],
      [0.162, 0.382],
      [0.186, 0.41],
      [0.194, 0.45],
      [0.193, 0.52],
      [0.19, 0.572],
      [0.195, 0.584],
      [0.196, 0.597],
      [0.185, 0.606],
      [0.165, 0.604],
    ],
    seg(26),
  );
  parts.push(part(lathe(shortsBody, seg(64), { zScale: 0.96 }), { bone: "hips", color: shortsShade, uv: PATCH.cloth }));
  const legProfile = sampleProfile(
    [
      [0.086, 0.296],
      [0.104, 0.276],
      [0.113, 0.281],
      [0.112, 0.296],
      [0.106, 0.35],
      [0.1, 0.43],
      [0.094, 0.47],
    ],
    seg(16),
  );
  const shortsLegL = part(lathe(legProfile, seg(40), { zScale: 1.42, center: [0.09, 0] }), {
    bone: "hips",
    color: shortsShade,
    uv: PATCH.cloth,
  });
  parts.push(shortsLegL, mirrorPart(shortsLegL, "hips"));

  /* laccio verde-acqua */
  const knot = new Vector3(0.04, 0.535, 0.19);
  const loop = (dir: number) => {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push(new Vector3(knot.x + dir * (0.024 - 0.024 * Math.cos(a)), knot.y + 0.012 * Math.sin(a) + 0.006 * (1 - Math.cos(a)), knot.z + 0.004 * Math.sin(a * 0.5)));
    }
    return new TubeGeometry(new CatmullRomCurve3(pts, true), seg(28), 0.0045, 6, true);
  };
  const end = (dir: number) =>
    new TubeGeometry(
      new CatmullRomCurve3([
        knot.clone(),
        new Vector3(knot.x + dir * 0.012, knot.y - 0.025, knot.z + 0.004),
        new Vector3(knot.x + dir * 0.02, knot.y - 0.05, knot.z + 0.002),
      ]),
      seg(10),
      0.0045,
      6,
      false,
    );
  for (const g of [loop(1), loop(-1), end(1), end(-1)]) parts.push(part(g, { bone: "hips", color: COL.drawstring, uv: PATCH.satin }));
  const knotBall = new SphereGeometry(0.008, 8, 6);
  knotBall.translate(knot.x, knot.y, knot.z + 0.002);
  parts.push(part(knotBall, { bone: "hips", color: COL.drawstring, uv: PATCH.satin }));

  /* logo rosa sulla gamba destra del personaggio (-X) */
  {
    const legCx = -0.09;
    const ang = -0.3; // verso l'esterno
    const R = 0.031;
    const rx = 0.107;
    const rz = 0.107 * 1.42;
    const cy = 0.322;
    const disc = grid(
      seg(10),
      seg(10),
      (u, v) => {
        const a = (u - 0.5) * 2 * R;
        const b = (v - 0.5) * 2 * R;
        const th = ang + a / rx;
        return new Vector3(legCx + (rx + 0.005) * Math.sin(th), cy + b, (rz + 0.005) * Math.cos(th));
      },
      false,
    );
    // ritaglio circolare: scarta i triangoli fuori dal cerchio
    const idx = disc.index;
    const keep: number[] = [];
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        let inside = true;
        for (let k = 0; k < 3; k++) {
          const vi = idx.getX(i + k);
          const cols = seg(10) + 1;
          const u = (vi % cols) / (cols - 1) - 0.5;
          const v = Math.floor(vi / cols) / (cols - 1) - 0.5;
          if (u * u + v * v > 0.27) inside = false;
        }
        if (inside) keep.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
      }
      disc.setIndex(keep);
    }
    const cols = seg(10) + 1;
    const [u0, v0, u1, v1] = LOGO_RECT;
    parts.push(
      part(disc, {
        bone: "hips",
        color: COL.white,
        uv: (_p2, i) => {
          const u = (i % cols) / (cols - 1);
          const v = Math.floor(i / cols) / (cols - 1);
          return [u0 + (u1 - u0) * (0.02 + 0.96 * u), v0 + (v1 - v0) * (0.02 + 0.96 * v)];
        },
      }),
    );
  }

  /* ---- gambe e piedi a radice: piatti, lunghi, 4 dita tozze aperte a ventaglio ---- */
  {
    const FX = 0.15;
    const FZ = 0.02;
    const YAW = 0.2;
    // UV cilindrica attorno al piede: fibre verticali come sul tronco, densità simile
    const barkFoot: UvFn = (p) => {
      const a = Math.atan2(p.x - FX, p.z - FZ);
      return [BARK_U0 + (BARK_U1 - BARK_U0) * (0.62 * ((a + Math.PI) / (Math.PI * 2))), Math.min(1, Math.max(0, p.y / BARK_HEIGHT))];
    };
    // piede unico e liscio "da cartone" (come nel riferimento): pianta ellittica lunga davanti,
    // dorso a cupola spostato verso il tallone, 4 dita tonde ricavate da solchi morbidi sul davanti.
    // Una sola superficie saldata (niente primitive compenetrate → niente "grumi").
    const FOOT = { side: 0.126, front: 0.185, back: 0.095, yc: 0.04, top: 0.092, bottom: 0.044 };
    const TOES = 4;
    const TOE_SPAN = 0.95; // |φ| coperto dalle dita (rad, 0 = avanti)
    const toeLobe = (phi: number) => {
      const w = smooth(TOE_SPAN, TOE_SPAN * 0.72, Math.abs(phi));
      if (w <= 0) return { lobe: 1, w: 0 };
      const k = ((phi + TOE_SPAN) / (2 * TOE_SPAN)) * TOES;
      const f = Math.min(1, Math.max(0, k - Math.floor(k)));
      return { lobe: Math.pow(Math.sin(Math.PI * f), 0.62), w };
    };
    const footBody = grid(seg(64), seg(24), (u, v) => {
      const phi = -Math.PI + 2 * Math.PI * u;
      const th = -Math.PI / 2 + Math.PI * v;
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);
      const zr = cp > 0 ? FOOT.front : FOOT.back;
      let r = 1 / Math.sqrt((sp / FOOT.side) ** 2 + (cp / zr) ** 2);
      const { lobe, w } = toeLobe(phi);
      const ct = Math.cos(th);
      const st = Math.sin(th);
      // i solchi tra le dita restano sul davanti/in basso, il dorso resta liscio
      const groove = w * (1 - lobe) * (1 - smooth(0.25, 0.7, st));
      r *= 1 - 0.17 * groove;
      const fwd = Math.max(0, cp) ** 2;
      // dita più basse del dorso; cupola spostata verso il tallone
      // ogni dito è una piccola cupola: più alto al centro del lobo, più basso nel solco
      const h = st > 0 ? FOOT.top * (1 - 0.32 * fwd * ct) * (1 - 0.18 * groove * ct) : FOOT.bottom;
      return new Vector3(r * ct * sp, Math.max(0.004, FOOT.yc + h * st), r * ct * cp - 0.03 * Math.max(0, st));
    });
    // salda cucitura e poli → normali lisce ovunque
    footBody.deleteAttribute("normal");
    const footWelded = mergeVertices(footBody, 1e-6);
    footBody.dispose();
    footWelded.computeVertexNormals();
    {
      const pos = footWelded.getAttribute("position");
      const nor = footWelded.getAttribute("normal");
      let dot = 0;
      for (let i = 0; i < pos.count; i++) {
        dot += nor.getX(i) * pos.getX(i) + nor.getY(i) * (pos.getY(i) - 0.06) + nor.getZ(i) * (pos.getZ(i) - 0.03);
      }
      if (dot < 0) flipInsideOut(footWelded);
    }
    const pieces: { g: BufferGeometry; kind: "foot" | "ankle" | "flare" }[] = [{ g: footWelded, kind: "foot" }];
    // gamba corta inclinata: dal piede (x 0.15) sale dentro la gamba dei pantaloncini
    const ankle = new CylinderGeometry(0.038, 0.048, 0.3, seg(14), 3, true);
    ankle.rotateZ(0.19);
    ankle.translate(-0.028, 0.225, -0.025);
    pieces.push({ g: ankle, kind: "ankle" });
    // svasatura "a radice" tra gamba e piede: profilo concavo continuo (si infila nel dorso)
    const flareProfile: Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      flareProfile.push(new Vector2(0.045 + 0.058 * Math.pow(1 - t, 2.2), 0.045 + 0.16 * t));
    }
    pieces.push({ g: lathe(flareProfile, seg(28), { center: [-0.008, -0.03] }), kind: "flare" });
    const cosY = Math.cos(YAW);
    const sinY = Math.sin(YAW);
    const footParts = pieces.map(({ g, kind }) => {
      if (kind !== "foot") {
        const pos = g.getAttribute("position");
        for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.004) pos.setY(i, 0.004); // suola piatta
        g.computeVertexNormals();
      }
      g.rotateY(YAW);
      g.translate(FX, 0, FZ);
      if (kind !== "foot") {
        // caviglia con le fibre del tronco; la svasatura liscia come il piede (niente "colletto")
        return part(g, {
          bone: "footL",
          color: (p) => new Color().setScalar(0.82 + 0.18 * smooth(0.04, 0.16, p.y)),
          uv: kind === "flare" ? PATCH.barkFlat : barkFoot,
          proj: kind === "flare" ? 0.12 : 0.3,
        });
      }
      return part(g, {
        bone: "footL",
        color: (p, n) => {
          // coordinate locali del piede (inversa di rotateY + translate) per ritrovare i solchi
          const dx = p.x - FX;
          const dz = p.z - FZ;
          const lx = dx * cosY - dz * sinY;
          const lz = dx * sinY + dz * cosY;
          const { lobe, w } = toeLobe(Math.atan2(lx, lz));
          // dorso chiaro, pianta e solchi tra le dita più scuri: ombreggiatura morbida da cartone
          let v = 0.7 + 0.3 * smooth(0.0, 0.07, p.y);
          v *= 1 - 0.22 * w * (1 - lobe) * smooth(0.01, 0.05, p.y);
          v *= 0.94 + 0.06 * Math.max(0, n.y);
          return new Color(v * 1.04, v, v * 0.96);
        },
        uv: PATCH.barkFlat,
        // poca proiezione: il riferimento ha i piedi in posa diversa e porterebbe "rumore"
        proj: 0.12,
      });
    });
    for (const g of footParts) parts.push(g, mirrorPart(g, "footR"));
  }

  /* ---- bocca: labbro, cavità, denti ---- */
  {
    const outline: Vector3[] = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const u = -1 + (2 * i) / n;
      const y = MOUTH.topY(u);
      const th = u * MOUTH.thetaHalf;
      const r = headRadius(y) + 0.002;
      outline.push(new Vector3(r * Math.sin(th), y, r * Math.cos(th)));
    }
    for (let i = n - 1; i >= 1; i--) {
      const u = -1 + (2 * i) / n;
      const y = MOUTH.bottomY(u);
      const th = u * MOUTH.thetaHalf;
      const r = headRadius(y) + 0.002;
      outline.push(new Vector3(r * Math.sin(th), y, r * Math.cos(th)));
    }
    const lip = new TubeGeometry(new CatmullRomCurve3(outline, true, "centripetal"), seg(120), lowPower ? 0.016 : 0.0115, seg(8), true);
    parts.push(part(lip, { bone: "head", color: new Color(0.9, 0.9, 0.9), uv: PATCH.barkFlat, proj: 0 }));

    // cavità: "sacca" che parte esattamente dal contorno della bocca e rientra nel tronco,
    // così ogni raggio che entra dall'apertura incontra l'interno rosso (niente buchi a vista)
    const curve = new CatmullRomCurve3(outline, true, "centripetal");
    const ringN = seg(72);
    const depthN = seg(10);
    const ring = curve.getSpacedPoints(ringN);
    const centre = new Vector3(0, 0.962, 0.2);
    const back = new Vector3(0, 0.955, -0.035);
    const pocket = grid(ringN, depthN, (a, d) => {
      const o = ring[Math.min(ringN, Math.round(a * ringN))];
      // bordo leggermente più largo del contorno: si infila dietro al labbro
      const surf = new Vector3(o.x + (o.x - centre.x) * 0.06, o.y + (o.y - centre.y) * 0.1, o.z);
      const rr = Math.hypot(surf.x, surf.z);
      surf.x *= (rr - 0.008) / rr;
      surf.z *= (rr - 0.008) / rr;
      const off = new Vector3(o.x - centre.x, o.y - centre.y, 0);
      const deep = back.clone().add(off.multiplyScalar(0.55));
      // 0..0.75: dal contorno all'anello profondo; 0.75..1: si chiude sul fondo (polo)
      const p = surf.lerp(deep, Math.min(1, d / 0.75));
      if (d > 0.75) p.lerp(back, (d - 0.75) / 0.25);
      // sacca rigonfia (più spazio per lingua e mandibola) ma sempre dentro il tronco
      const bulge = Math.sin(Math.PI * d) * 0.025;
      const lateral = new Vector3(p.x, (p.y - centre.y) * 0.6, 0);
      if (lateral.lengthSq() > 1e-8) p.add(lateral.normalize().multiplyScalar(bulge));
      return p;
    });
    // orienta le facce verso l'interno della sacca (media su tutto l'anello a metà profondità)
    {
      const nor = pocket.getAttribute("normal");
      const pos = pocket.getAttribute("position");
      const row = Math.floor(depthN / 2);
      const axis = centre.clone().lerp(back, row / depthN);
      let dot = 0;
      const pv = new Vector3();
      const nv = new Vector3();
      for (let i = 0; i <= ringN; i++) {
        const k = row * (ringN + 1) + i;
        pv.fromBufferAttribute(pos, k);
        nv.fromBufferAttribute(nor, k);
        dot += nv.dot(axis.clone().sub(pv));
      }
      if (dot < 0) flipInsideOut(pocket);
    }
    parts.push(
      part(pocket, {
        bone: "head",
        color: (p) => COL.throat.clone().lerp(COL.mouth, smooth(0.0, 0.17, p.z)),
        uv: PATCH.mouth,
      }),
    );

    // denti superiori (8, canini a punta)
    const teethN = 8;
    for (let i = 0; i < teethN; i++) {
      const u = -0.74 + (1.48 * i) / (teethN - 1);
      const th = u * MOUTH.thetaHalf * 0.98;
      const top = MOUTH.topY(u) - 0.002;
      const canine = i === 1 || i === teethN - 2;
      // dente arrotondato; i canini sono un po' più lunghi e appuntiti
      const tooth: BufferGeometry = new CapsuleGeometry(0.0172, 0.017, 3, seg(10));
      tooth.translate(0, -0.027, 0);
      if (canine) {
        const tp = tooth.getAttribute("position");
        for (let k = 0; k < tp.count; k++) {
          const yy = tp.getY(k);
          if (yy < -0.027) {
            const f = Math.min(1, (-0.027 - yy) / 0.018);
            tp.setXYZ(k, tp.getX(k) * (1 - 0.28 * f), yy - 0.005 * f, tp.getZ(k) * (1 - 0.15 * f));
          }
        }
        tooth.computeVertexNormals();
      }
      tooth.translate(0, top, 0);
      tooth.scale(1, 1, 0.6);
      const r = headRadius(top - 0.02) - 0.006;
      tooth.translate(0, 0, r);
      tooth.rotateY(th);
      parts.push(part(tooth, { bone: "head", color: COL.teeth, uv: PATCH.enamel }));
    }
  }

  /* ---- mandibola: superficie corteccia + labbro + pavimento + lingua ---- */
  {
    const cols = seg(26);
    const rows = seg(9);
    const uMax = 0.965;
    const outer = grid(cols, rows, (a, b) => {
      const u = -uMax + 2 * uMax * a;
      const y0 = MOUTH.bottomY(u) - 0.04;
      const y1 = MOUTH.closedY(u);
      const y = y0 + (y1 - y0) * b;
      const th = u * MOUTH.thetaHalf;
      const r = headRadius(y) - 0.0035;
      return new Vector3(r * Math.sin(th), y, r * Math.cos(th));
    });
    parts.push(
      part(outer, {
        bone: "jaw",
        color: new Color(0.95, 0.95, 0.95),
        uv: (p) => {
          const th = Math.atan2(p.x, p.z);
          return [BARK_U0 + (BARK_U1 - BARK_U0) * ((th + Math.PI) / (Math.PI * 2)), p.y / BARK_HEIGHT];
        },
      }),
    );
    const lipPts: Vector3[] = [];
    for (let i = 0; i <= 30; i++) {
      const u = -0.86 + (1.72 * i) / 30;
      const y = MOUTH.closedY(u) + 0.002;
      const th = u * MOUTH.thetaHalf;
      const r = headRadius(y) - 0.002;
      lipPts.push(new Vector3(r * Math.sin(th), y, r * Math.cos(th)));
    }
    const jawLip = new TubeGeometry(new CatmullRomCurve3(lipPts), seg(40), 0.0105, seg(8), false);
    parts.push(part(jawLip, { bone: "jaw", color: new Color(0.9, 0.9, 0.9), uv: PATCH.barkFlat }));
    const floor = grid(cols, seg(6), (a, b) => {
      const u = -0.93 + 1.86 * a;
      const y = MOUTH.closedY(u) + 0.004 - 0.016 * b;
      const th = u * MOUTH.thetaHalf * (1 - 0.3 * b);
      const r = headRadius(y) - 0.006 - 0.15 * b;
      return new Vector3(r * Math.sin(th), y, r * Math.cos(th));
    }, true);
    parts.push(part(floor, { bone: "jaw", color: COL.mouth.clone().multiplyScalar(1.15), uv: PATCH.mouth }));
    const tongue = new SphereGeometry(1, seg(18), seg(10));
    tongue.scale(0.072, 0.024, 0.058);
    tongue.translate(0, MOUTH.closedY(0) - 0.004, 0.105);
    parts.push(part(tongue, { bone: "jaw", color: (p) => COL.tongue.clone().multiplyScalar(Math.abs(p.x) < 0.006 ? 0.88 : 1), uv: PATCH.satin }));
  }

  /* ---- occhiali da sole ---- */
  parts.push(...buildSunglasses(headRadius, seg, lowPower));

  /* ---- braccia, guanti, dita (lato sinistro poi specchiato) ---- */
  {
    const left: { geo: BufferGeometry; bone: BoneName; right: BoneName }[] = [];
    const sh = BONE_BIND.shoulderL.pos;
    const el = BONE_BIND.elbowL.pos;
    const hd = BONE_BIND.handL.pos;
    const barkArm = barkPlanar(4);
    const armTube = (len: number, r0: number, r1: number) => {
      const g = new CylinderGeometry(r1, r0, len, seg(10), 3, true);
      g.rotateZ(-Math.PI / 2);
      g.translate(len / 2, 0, 0);
      return g;
    };
    const upper = armTube(UPPER_ARM + 0.04, 0.026, 0.023);
    upper.translate(sh[0] - 0.04, sh[1], sh[2]);
    left.push({ geo: part(upper, { bone: "shoulderL", color: COL.barkTex, uv: barkArm }), bone: "shoulderL", right: "shoulderR" });
    const elbowBall = new SphereGeometry(0.0235, seg(10), seg(8));
    elbowBall.translate(el[0], el[1], el[2]);
    left.push({ geo: part(elbowBall, { bone: "elbowL", color: COL.barkTex, uv: barkArm }), bone: "elbowL", right: "elbowR" });
    const fore = armTube(FOREARM + 0.01, 0.023, 0.021);
    fore.translate(el[0], el[1], el[2]);
    left.push({ geo: part(fore, { bone: "elbowL", color: COL.barkTex, uv: barkArm }), bone: "elbowL", right: "elbowR" });

    // guanto: polsino arrotolato + palmo + 3 dita + pollice
    // ombreggiatura "cartoon": i lati delle dita (normale quasi orizzontale verso le dita vicine)
    // scuriscono un po', così le dita si separano anche da lontano
    const gloveShade: ColorFn = (_p, nn) =>
      COL.gloveShade.clone().lerp(COL.glove, Math.min(1, 0.35 + 0.65 * Math.max(0, nn.y * 0.45 + nn.z * 0.6 + 0.35)));
    const cuff = new CylinderGeometry(0.052, 0.041, 0.045, seg(16), 2, true);
    cuff.rotateZ(-Math.PI / 2);
    cuff.translate(hd[0] + 0.018, hd[1], hd[2]);
    const cuffRim = new TubeGeometry(
      new CatmullRomCurve3(
        Array.from({ length: 17 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return new Vector3(hd[0] + 0.041, hd[1] + 0.052 * Math.cos(a), hd[2] + 0.052 * Math.sin(a));
        }),
        true,
      ),
      seg(24),
      0.011,
      seg(6),
      true,
    );
    const palm = new SphereGeometry(1, seg(18), seg(12));
    palm.scale(0.083, 0.069, 0.039);
    palm.translate(hd[0] + 0.101, hd[1], hd[2] + 0.002);
    for (const g of [cuff, cuffRim, palm]) {
      left.push({ geo: part(g, { bone: "handL", color: gloveShade, uv: PATCH.satin }), bone: "handL", right: "handR" });
    }
    const finger = (bone: BoneName, len: number, r: number, dir: Vector3) => {
      const g = new CapsuleGeometry(r, len, 4, seg(10));
      g.translate(0, len / 2 + r * 0.4, 0);
      // asse Y → direzione del dito
      g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
      const b = BONE_BIND[bone].pos;
      g.translate(b[0], b[1], b[2]);
      return part(g, { bone, color: gloveShade, uv: PATCH.satin });
    };
    // dita più snelle e un po' aperte a ventaglio: a distanza restano 3 dita + pollice distinti
    left.push({ geo: finger("indexL", 0.082, 0.0215, new Vector3(1, 0.2, 0).normalize()), bone: "indexL", right: "indexR" });
    left.push({ geo: finger("middleL", 0.092, 0.0225, new Vector3(1, 0.02, 0).normalize()), bone: "middleL", right: "middleR" });
    left.push({ geo: finger("ringL", 0.076, 0.021, new Vector3(1, -0.2, 0).normalize()), bone: "ringL", right: "ringR" });
    left.push({ geo: finger("thumbL", 0.056, 0.0235, new Vector3(0.4, 1, 0.14).normalize()), bone: "thumbL", right: "thumbR" });

    for (const { geo, right } of left) {
      parts.push(geo, mirrorPart(geo, right));
    }
  }

  const geometry = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!geometry) throw new Error("Palmino: merge geometria fallito");
  geometry.computeBoundingSphere();
  const triangles = (geometry.index ? geometry.index.count : geometry.getAttribute("position").count) / 3;
  return { geometry, headRadius, triangles };
}

/* -------------------------------- occhiali ----------------------------------------------- */

function roundedRectPoints(cx: number, cy: number, w: number, h: number, r: number, step: number): Vector2[] {
  const pts: Vector2[] = [];
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let i = 0; i < n; i++) pts.push(new Vector2(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n));
  };
  const arc = (ox: number, oy: number, a0: number) => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((Math.PI / 2) * i) / n;
      pts.push(new Vector2(ox + r * Math.cos(a), oy + r * Math.sin(a)));
    }
  };
  line(x0 + r, y0, x1 - r, y0);
  arc(x1 - r, y0 + r, -Math.PI / 2);
  line(x1, y0 + r, x1, y1 - r);
  arc(x1 - r, y1 - r, 0);
  line(x1 - r, y1, x0 + r, y1);
  arc(x0 + r, y1 - r, Math.PI / 2);
  line(x0, y1 - r, x0, y0 + r);
  arc(x0 + r, y0 + r, Math.PI);
  return pts;
}

function buildSunglasses(headRadius: (y: number) => number, seg: (n: number) => number, lowPower: boolean): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const yc = 1.152;
  const zFront = headRadius(yc) + 0.016;
  const Rb = 0.27;
  const [bendX, bendZ] = headBend(yc);
  const bend = (g: BufferGeometry) => {
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const a = x / Rb;
      const rr = Rb + z;
      pos.setXYZ(i, rr * Math.sin(a) + bendX, y + yc, rr * Math.cos(a) - Rb + zFront + bendZ);
    }
    g.computeVertexNormals();
    return g;
  };
  const lensW = 0.2;
  const lensH = 0.096;
  const lensCx = 0.109;
  const t = 0.0085;
  const tTop = 0.016;
  const step = lowPower ? 0.02 : 0.008;
  const lensCy = -0.003;
  const lensR = 0.03;
  for (const s of [1, -1]) {
    const cx = s * lensCx;
    const outer = roundedRectPoints(cx, lensCy + (tTop - t) / 2, lensW + 2 * t, lensH + t + tTop, lensR + 0.006, step);
    const inner = roundedRectPoints(cx, lensCy, lensW, lensH, lensR, step).reverse();
    const shape = new Shape(outer);
    shape.holes.push(new Shape(inner));
    const ring = new ExtrudeGeometry(shape, {
      depth: 0.006,
      bevelEnabled: true,
      bevelThickness: 0.0018,
      bevelSize: 0.0016,
      bevelSegments: lowPower ? 1 : 2,
      curveSegments: 4,
    });
    ring.translate(0, 0, -0.006);
    out.push(part(bend(ring), { bone: "head", color: COL.frame, uv: PATCH.gloss }));
    // lente: griglia ritagliata ad angoli arrotondati (segue la curvatura)
    const lens = grid(seg(24), seg(12), (u, v) => {
      let x = (u - 0.5) * (lensW + 0.004);
      let y = (v - 0.5) * (lensH + 0.004);
      const rc = lensR;
      const hw = (lensW + 0.004) / 2 - rc;
      const hh = (lensH + 0.004) / 2 - rc;
      const dx = Math.abs(x) - hw;
      const dy = Math.abs(y) - hh;
      if (dx > 0 && dy > 0) {
        const len = Math.hypot(dx, dy);
        if (len > rc) {
          x = Math.sign(x) * (hw + (dx / len) * rc);
          y = Math.sign(y) * (hh + (dy / len) * rc);
        }
      }
      return new Vector3(cx + x, lensCy + y, -0.004);
    });
    // lente: cella dell'atlante con vetro scuro sfumato, riflessi e gli occhi appena visibili dietro
    const [lu0, lv0, lu1, lv1] = LENS_RECT;
    const lensCols = seg(24) + 1;
    const lensRows = seg(12) + 1;
    out.push(
      part(bend(lens), {
        bone: "head",
        color: COL.white,
        proj: 0,
        uv: (_p, i) => {
          let u = (i % lensCols) / (lensCols - 1);
          const v = Math.floor(i / lensCols) / (lensRows - 1);
          if (s < 0) u = 1 - u; // lente destra: specchiata (occhi simmetrici, riflesso dallo stesso lato)
          // margine del 4% contro il "bleeding" delle mipmap dalle celle vicine
          return [lu0 + (lu1 - lu0) * (0.04 + 0.92 * u), lv0 + (lv1 - lv0) * (0.04 + 0.92 * v)];
        },
      }),
    );
    // stanghetta verso i lati della testa
    const a0 = (s * (lensCx + lensW / 2 + t)) / Rb;
    const p0 = new Vector3((Rb - 0.005) * Math.sin(a0) + bendX, yc + 0.02, (Rb - 0.005) * Math.cos(a0) - Rb + zFront + bendZ);
    const pts = [p0];
    for (let k = 1; k <= 4; k++) {
      const th = s * (Math.abs(a0) * 0.95 + k * 0.17);
      const r = headRadius(yc + 0.02) + 0.003;
      pts.push(new Vector3(r * Math.sin(th) + bendX, yc + 0.02, r * Math.cos(th) + bendZ));
    }
    const temple = new TubeGeometry(new CatmullRomCurve3(pts), seg(14), 0.0045, 5, false);
    out.push(part(temple, { bone: "head", color: COL.frame, uv: PATCH.gloss }));
  }
  // ponte
  const bridge = new Shape(roundedRectPoints(0, 0.02, 0.03, 0.011, 0.004, step));
  const bridgeGeo = new ExtrudeGeometry(bridge, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0013, bevelSize: 0.0013, bevelSegments: 1, curveSegments: 3 });
  bridgeGeo.translate(0, 0, -0.006);
  out.push(part(bend(bridgeGeo), { bone: "head", color: COL.frame, uv: PATCH.gloss }));
  return out;
}
