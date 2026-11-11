import {
  Bone,
  BufferAttribute,
  BoxGeometry,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  LatheGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  Raycaster,
  RGBAFormat,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  type Material,
  type Texture,
} from "three";
import {
  MeshAccumulator,
  basisMatrix,
  capsuleRadius,
  lerp,
  lockRadius,
  rng,
  smooth,
  taperedTube,
  v3,
  type ColorFn,
  type ProjFn,
  type SkinSample,
  type WeightFn,
} from "./geometry";

/* ------------------------------------------------------------------ */
/*  Ossa                                                               */
/* ------------------------------------------------------------------ */

export const B = {
  root: 0,
  spine: 1,
  chest: 2,
  neck: 3,
  head: 4,
  jaw: 5,
  lidR: 6,
  lidL: 7,
  eyeR: 8,
  eyeL: 9,
  browR: 10,
  browL: 11,
  shoR: 12,
  uarmR: 13,
  farmR: 14,
  handR: 15,
  shoL: 16,
  uarmL: 17,
  farmL: 18,
  handL: 19,
  tray: 20,
  bun: 21,
  hairR1: 22,
  hairR2: 23,
  hairL1: 24,
  hairL2: 25,
  hairB1: 26,
  hairB2: 27,
} as const;
export const BONE_COUNT = 28;

/** Altezza visibile: dalla base del busto (origine) alla cima dello chignon. */
export const REGINA_TOP = 1.85;

/**
 * Scala della testa (stile "testa grande" dell'illustrazione): testa, volto e
 * capelli sono costruiti a scala 1 attorno a HC e poi ingranditi attorno al
 * perno del collo. Pesi e colori si calcolano prima della scala.
 */
const HEAD_SCALE = 1.2;
const HEAD_PIVOT = new Vector3(0, 1.115, 0);
/** la testa scende un poco sul collo (collo meno lungo, più simile all'illustrazione) */
const HEAD_DROP = -0.022;
const HEAD_S = new Matrix4()
  .makeTranslation(HEAD_PIVOT.x, HEAD_PIVOT.y + HEAD_DROP, HEAD_PIVOT.z)
  .multiply(new Matrix4().makeScale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE))
  .multiply(new Matrix4().makeTranslation(-HEAD_PIVOT.x, -HEAD_PIVOT.y, -HEAD_PIVOT.z));

/** Centro del cranio (spazio modello, prima della scala). Il volto è costruito attorno a questo punto. */
const HC = v3(0, 1.335, 0.03);
const hc = (x: number, y: number, z: number) => v3(HC.x + x, HC.y + y, HC.z + z);

// Posizioni di riposo (spazio modello). Le rotazioni di riposo sono identità.
const JOINTS: { parent: number; p: Vector3 }[] = [];
JOINTS[B.root] = { parent: -1, p: v3(0, 0, 0) };
JOINTS[B.spine] = { parent: B.root, p: v3(0, 0.3, 0) };
JOINTS[B.chest] = { parent: B.spine, p: v3(0, 0.62, 0) };
JOINTS[B.neck] = { parent: B.chest, p: v3(0, 0.96, -0.01) };
JOINTS[B.head] = { parent: B.neck, p: v3(0, 1.115, 0.0) };
JOINTS[B.jaw] = { parent: B.head, p: hc(0, -0.075, -0.01) };
const EYE_R = hc(-0.074, 0.004, 0.142);
const EYE_L = hc(0.074, 0.004, 0.142);
JOINTS[B.lidR] = { parent: B.head, p: EYE_R.clone() };
JOINTS[B.lidL] = { parent: B.head, p: EYE_L.clone() };
JOINTS[B.eyeR] = { parent: B.head, p: EYE_R.clone() };
JOINTS[B.eyeL] = { parent: B.head, p: EYE_L.clone() };
JOINTS[B.browR] = { parent: B.head, p: hc(-0.075, 0.06, 0.17) };
JOINTS[B.browL] = { parent: B.head, p: hc(0.075, 0.06, 0.17) };
JOINTS[B.shoR] = { parent: B.chest, p: v3(-0.1, 0.9, -0.01) };
JOINTS[B.uarmR] = { parent: B.shoR, p: v3(-0.275, 0.87, -0.01) };
JOINTS[B.farmR] = { parent: B.uarmR, p: v3(-0.46, 0.58, 0.08) };
JOINTS[B.handR] = { parent: B.farmR, p: v3(-0.55, 0.92, 0.18) };
JOINTS[B.shoL] = { parent: B.chest, p: v3(0.1, 0.9, -0.01) };
JOINTS[B.uarmL] = { parent: B.shoL, p: v3(0.275, 0.87, -0.01) };
JOINTS[B.farmL] = { parent: B.uarmL, p: v3(0.385, 0.705, 0.215) };
JOINTS[B.handL] = { parent: B.farmL, p: v3(0.285, 0.985, 0.27) };
JOINTS[B.tray] = { parent: B.root, p: v3(0, 0, 0) }; // posizionato ogni frame
JOINTS[B.bun] = { parent: B.head, p: hc(-0.06, 0.23, -0.06) };
JOINTS[B.hairR1] = { parent: B.head, p: v3(-0.21, 1.19, -0.06) };
JOINTS[B.hairR2] = { parent: B.hairR1, p: v3(-0.29, 0.95, -0.1) };
JOINTS[B.hairL1] = { parent: B.head, p: v3(0.21, 1.19, -0.06) };
JOINTS[B.hairL2] = { parent: B.hairL1, p: v3(0.29, 0.95, -0.1) };
JOINTS[B.hairB1] = { parent: B.head, p: v3(0, 1.17, -0.2) };
JOINTS[B.hairB2] = { parent: B.hairB1, p: v3(0, 0.92, -0.23) };

/* ------------------------------------------------------------------ */
/*  Palette (sRGB, convertita nello spazio di lavoro lineare)          */
/* ------------------------------------------------------------------ */

const C = {
  skin: new Color("#e69a6c"),
  skinShade: new Color("#d07e58"),
  blush: new Color("#ef7f6a"),
  freckle: new Color("#cf8259"),
  lip: new Color("#d94e57"),
  lipDark: new Color("#a93c40"),
  mouth: new Color("#5a1418"),
  mouthDeep: new Color("#2e0709"),
  tongue: new Color("#c95458"),
  teeth: new Color("#fbf7ee"),
  eyeWhite: new Color("#fbf6f0"),
  iris: new Color("#8a4a1c"),
  irisLight: new Color("#c27a32"),
  irisRim: new Color("#2a1306"),
  pupil: new Color("#0d0604"),
  lash: new Color("#140906"),
  brow: new Color("#2f160b"),
  hairRoot: new Color("#1f0e08"),
  hair: new Color("#41200f"),
  hairMid: new Color("#552a15"),
  hairHi: new Color("#8e5530"),
  shirt: new Color("#f1e7dc"),
  shirtShade: new Color("#d9c6b5"),
  vest: new Color("#1b1512"),
  apron: new Color("#1f1813"),
  pants: new Color("#211a16"),
  trayBronze: new Color("#5e3418"),
  trayDark: new Color("#3a1f0e"),
  micBlack: new Color("#151112"),
  micGrille: new Color("#4a4643"),
  beerDeep: new Color("#b8560a"),
  beer: new Color("#e2851a"),
  beerTop: new Color("#f6b43a"),
  foam: new Color("#fff6e3"),
  foamShade: new Color("#f0dfc0"),
  pot: new Color("#4a2a18"),
  trunk: new Color("#7a5a2e"),
  leaf: new Color("#4f8a1e"),
  leafLight: new Color("#86b832"),
  bowl: new Color("#1d1411"),
  peanut: new Color("#e6ad5c"),
  peanutDark: new Color("#c98a3c"),
  pen: new Color("#2a1b10"),
  white: new Color("#ffffff"),
};

/* ------------------------------------------------------------------ */
/*  Pesi                                                               */
/* ------------------------------------------------------------------ */

function blend(out: SkinSample, a: number, b: number, t: number) {
  out.i0 = a;
  out.w0 = 1 - t;
  out.i1 = b;
  out.w1 = t;
}

const torsoWeight: WeightFn = (p, o) => {
  const y = p.y;
  if (y < 0.2) blend(o, B.root, B.spine, 0);
  else if (y < 0.42) blend(o, B.root, B.spine, smooth(0.2, 0.42, y));
  else if (y < 0.64) blend(o, B.spine, B.chest, smooth(0.42, 0.64, y));
  else if (y < 0.95) blend(o, B.chest, B.neck, 0);
  else blend(o, B.chest, B.neck, smooth(0.95, 1.04, y));
};

const neckWeight: WeightFn = (p, o) => {
  const y = p.y;
  if (y < 1.0) blend(o, B.chest, B.neck, smooth(0.9, 1.0, y));
  else blend(o, B.neck, B.head, smooth(1.07, 1.18, y));
};

/** Peso mandibola sul volto: mento e labbro inferiore. */
function jawWeightAt(p: Vector3): number {
  const lx = p.x - HC.x;
  const ly = p.y - HC.y;
  const lz = p.z - HC.z;
  const below = smooth(-0.121, -0.158, ly);
  const front = smooth(-0.04, 0.07, lz);
  const lateral = smooth(0.15, 0.075, Math.abs(lx));
  return below * front * lateral;
}
const headWeight: WeightFn = (p, o) => {
  const w = jawWeightAt(p);
  if (p.y < 1.17) {
    // collo/nuca: si fonde col collo
    const n = smooth(1.17, 1.09, p.y) * (1 - w);
    if (n > 0.001) {
      blend(o, B.head, B.neck, n);
      return;
    }
  }
  blend(o, B.head, B.jaw, w);
};

function hairChainWeight(p: Vector3, o: SkinSample) {
  const back = p.z < -0.13 && Math.abs(p.x) < 0.17;
  const c1 = back ? B.hairB1 : p.x < 0 ? B.hairR1 : B.hairL1;
  const c2 = back ? B.hairB2 : p.x < 0 ? B.hairR2 : B.hairL2;
  const y = p.y;
  if (y > 1.21) blend(o, B.head, c1, 0);
  else if (y > 0.99) blend(o, B.head, c1, smooth(1.21, 0.99, y));
  else if (y > 0.74) blend(o, c1, c2, smooth(0.99, 0.74, y));
  else blend(o, c1, c2, 1);
}
const hairWeight: WeightFn = (p, o) => hairChainWeight(p, o);

/* ------------------------------------------------------------------ */
/*  Testa                                                              */
/* ------------------------------------------------------------------ */

const _hd = new Vector3();
const g2 = (dx: number, dy: number, sx: number, sy: number) => Math.exp(-((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy)));
/**
 * Forma della testa: sfera unitaria deformata (coordinate volto, origine HC).
 * Volto a cuore: zigomi pieni, guance morbide, mento piccolo e appuntito;
 * naso piccolo all'insù integrato nella superficie (dorso morbido + punta + alette).
 */
function headShape(d: Vector3, out: Vector3, mouthCavity = false): Vector3 {
  const { x, y, z } = d;
  const s = y < 0 ? -y : 0;
  const u = y > 0 ? y : 0;
  const rx = 0.21 * (1 - 0.06 * u * u) * (1 - 0.1 * s - 0.5 * s * s * s * s);
  const ry = y >= 0 ? 0.25 : 0.222;
  const rz = z >= 0 ? 0.2 * (1 - 0.28 * s * s) : 0.232 * (1 - 0.45 * s);
  let px = x * rx;
  let py = y * ry;
  let pz = z * rz - 0.012;
  // il volto inferiore avanza (mento)
  pz += 0.1 * s * s * (0.3 + 0.7 * Math.max(0, z));
  py -= 0.012 * s * s * Math.max(0, z);
  const front = Math.max(0, z);
  let push = 0;
  for (const sg of [-1, 1]) {
    // zigomi e guance piene
    const dx = px - sg * 0.108;
    const dy = py + 0.07;
    const dz = pz - 0.12;
    push += 0.036 * Math.exp(-(dx * dx + dy * dy * 0.8 + dz * dz) / 0.0042);
    // orbite (accolgono occhi grandi)
    const ex = px - sg * 0.067;
    const ey = py - 0.006;
    const ez = pz - 0.17;
    push -= 0.024 * Math.exp(-(ex * ex * 0.8 + ey * ey * 1.3 + ez * ez) / 0.0016);
    // arcata sopraccigliare morbida
    push += 0.005 * g2(px - sg * 0.07, py - 0.07, 0.05, 0.016) * front;
    // alette del naso
    push += 0.011 * g2(px - sg * 0.016, py + 0.068, 0.009, 0.008) * front;
  }
  // naso: dorso sottile + punta arrotondata all'insù (sotto più netta)
  {
    const ny = py + 0.058;
    push += 0.007 * g2(px, py + 0.03, 0.009, 0.03) * front;
    push += 0.028 * g2(px, ny, 0.0135, ny > 0 ? 0.02 : 0.0095) * front;
  }
  // labbro superiore leggermente pieno
  push += 0.004 * g2(px, py + 0.121, 0.042, 0.012) * front;
  // cavità dietro la bocca: la pelle resta dietro l'interno scuro quando la mandibola si apre
  if (mouthCavity) {
    const dx = px / 0.052;
    const dy = (py + 0.152) / 0.017;
    push -= 0.01 * Math.exp(-(dx * dx * dx * dx + dy * dy)) * front;
  }
  // mento piccolo
  push += 0.007 * g2(px, py + 0.222, 0.025, 0.02) * front;
  _hd.set(px, py, pz).normalize();
  px += _hd.x * push;
  py += _hd.y * push;
  pz += _hd.z * push;
  return out.set(px, py, pz);
}

/** Griglia sferica più fitta sul volto (azimut e polare compressi verso il davanti). */
function faceDenseSphere(cols: number, rows: number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const PC = 1.72; // centro polare del volto (leggermente sotto l'equatore)
  for (let j = 0; j <= rows; j++) {
    const t = (j / rows) * 2 - 1;
    const w = 0.42 * t + 0.58 * t * t * t;
    const phi = t < 0 ? PC + PC * w : PC + (Math.PI - PC) * w;
    for (let i = 0; i <= cols; i++) {
      const q = (i / cols) * 2 - 1;
      const th = Math.PI * (0.42 * q + 0.58 * q * q * q);
      pos.push(Math.sin(phi) * Math.sin(th), Math.cos(phi), Math.sin(phi) * Math.cos(th));
      uv.push(i / cols, j / rows);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + cols + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
}

/* ------------------------------------------------------------------ */
/*  Risultato                                                          */
/* ------------------------------------------------------------------ */

export interface ReginaBuild {
  root: Group;
  bones: Bone[];
  skeleton: Skeleton;
  meshes: SkinnedMesh[];
  materials: Material[];
  /** offset del vassoio rispetto all'osso della mano destra (spazio mano a riposo) */
  traySocket: Vector3;
  restPositions: Vector3[];
  textures: Texture[];
  triangles: number;
  drawCalls: number;
}

export interface BuildOptions {
  lowPower: boolean;
  envMap?: Texture | null;
}

/* ------------------------------------------------------------------ */
/*  Costruzione                                                        */
/* ------------------------------------------------------------------ */

let faceFitDebug: Record<string, unknown> = {};

export function buildRegina(opts: BuildOptions): ReginaBuild {
  const lp = opts.lowPower;
  const Q = (hi: number, lo: number) => (lp ? lo : hi);

  const matte = new MeshAccumulator(); // pelle, stoffa
  const gloss = new MeshAccumulator(); // capelli, occhi, labbra, microfono, vassoio, birra
  const gold = new MeshAccumulator(); // oro
  const glass = new MeshAccumulator(); // boccale
  const hairAcc = new MeshAccumulator(); // capelli (materiale dedicato con sheen)

  const M = new Matrix4();
  const tmpQ = new Quaternion();
  const one = v3(1, 1, 1);

  /* ---------------- testa (sfera deformata) ---------------- */
  const headGeo = faceDenseSphere(Q(60, 34), Q(48, 28));
  // pelle visibile (con cavità dietro la bocca) e superficie "piena" per appoggiare i dettagli
  const skinGeo = headGeo.clone();
  {
    const pa = headGeo.getAttribute("position");
    const ps = skinGeo.getAttribute("position");
    const d = new Vector3();
    const o = new Vector3();
    for (let i = 0; i < pa.count; i++) {
      d.fromBufferAttribute(pa, i).normalize();
      headShape(d, o);
      pa.setXYZ(i, o.x + HC.x, o.y + HC.y, o.z + HC.z);
      headShape(d, o, true);
      ps.setXYZ(i, o.x + HC.x, o.y + HC.y, o.z + HC.z);
    }
    headGeo.computeVertexNormals();
    skinGeo.computeVertexNormals();
  }
  // raycaster sul volto per appoggiare dettagli sulla superficie
  const headMesh = new Mesh(headGeo);
  headMesh.updateMatrixWorld();
  const ray = new Raycaster();
  const rayO = new Vector3();
  const rayD = new Vector3();
  /** Punto di superficie del volto (coord. volto), raggio dal davanti verso il centro. */
  const surf = (lx: number, ly: number, off = 0, out = new Vector3(), nOut?: Vector3): Vector3 => {
    rayO.set(HC.x + lx, HC.y + ly, HC.z + 0.6);
    rayD.set(0, 0, -1);
    ray.set(rayO, rayD);
    const hit = ray.intersectObject(headMesh, false)[0];
    if (!hit) return out.set(HC.x + lx, HC.y + ly, HC.z + 0.15);
    const n = hit.face ? hit.face.normal.clone() : v3(0, 0, 1);
    if (nOut) nOut.copy(n);
    return out.copy(hit.point).addScaledVector(n, off);
  };
  /** Punto di superficie lungo una direzione dal centro testa (per lati/orecchie). */
  const surfDir = (dir: Vector3, off = 0, out = new Vector3()): Vector3 => {
    rayD.copy(dir).normalize();
    rayO.copy(HC).addScaledVector(rayD, 0.8);
    ray.set(rayO, rayD.clone().negate());
    const hit = ray.intersectObject(headMesh, false)[0];
    if (!hit) return out.copy(HC).addScaledVector(rayD, 0.22 + off);
    const n = hit.face ? hit.face.normal.clone() : rayD.clone();
    return out.copy(hit.point).addScaledVector(n, off);
  };

  matte.setPost(HEAD_S);
  gloss.setPost(HEAD_S);
  gold.setPost(HEAD_S);
  const skinColor: ColorFn = (p, _n, out) => {
    const lx = p.x - HC.x;
    const ly = p.y - HC.y;
    out.copy(C.skin);
    // rossore sulle guance
    for (const sg of [-1, 1]) {
      const dx = lx - sg * 0.11;
      const dy = ly + 0.07;
      const g = Math.exp(-(dx * dx + dy * dy * 1.4) / 0.003);
      out.lerp(C.blush, g * 0.38 * smooth(0.04, 0.12, p.z - HC.z));
    }
    // punta del naso un po' più rosata
    out.lerp(C.blush, 0.22 * Math.exp(-(lx * lx + (ly + 0.06) ** 2) / 0.0005));
    // ombra morbida sotto il mento/mascella
    out.lerp(C.skinShade, 0.35 * smooth(-0.19, -0.24, ly) * smooth(-0.02, 0.06, p.z - HC.z));
    // occlusione dipinta (leggera): sotto il naso, sotto il labbro inferiore e verso le tempie,
    // così il volto non sembra un disco piatto sotto le luci frontali del palco
    out.lerp(C.skinShade, 0.22 * Math.exp(-((lx / 0.022) ** 2 + ((ly + 0.088) / 0.01) ** 2)));
    out.lerp(C.skinShade, 0.25 * Math.exp(-((lx / 0.035) ** 2 + ((ly + 0.178) / 0.012) ** 2)));
    out.lerp(C.skinShade, 0.28 * smooth(0.12, 0.2, Math.abs(lx)) * smooth(-0.2, 0.05, ly));
  };
  // pelle del volto: pixel dell'illustrazione proiettati con la camera risolta sui punti di riferimento.
  // Il lato sinistro (in scorcio nell'illustrazione) rispecchia il destro; occhi, sopracciglia
  // e bocca restano modellati (animati), quindi lì la proiezione sfuma a zero.
  const faceCam = fitFaceCamera(
    [hc(-0.067, 0.006, 0.16), hc(0.067, 0.006, 0.16), surf(0, -0.058), surf(-0.062, -0.136), surf(0.062, -0.136), surf(0, -0.215)],
    [
      [735, 277],
      [855, 240],
      [845, 285],
      [775, 350],
      [890, 320],
      [830, 450],
    ],
    HC,
  );
  const _fp = new Vector3();
  const _fn = new Vector3();
  const faceProj: ProjFn = (p, n, _v, _u, o) => {
    const lx = p.x - HC.x;
    const ly = p.y - HC.y;
    // il lato destro del viso (-X) è quello più visibile nell'illustrazione: il sinistro lo rispecchia
    const mir = lx > 0 ? -1 : 1;
    _fp.set(HC.x - Math.abs(lx), p.y, p.z).sub(HC).applyQuaternion(faceCam.q);
    _fn.set(n.x * mir, n.y, n.z).applyQuaternion(faceCam.q);
    const px = faceCam.ax[0] * _fp.x + faceCam.ax[1] * _fp.y + faceCam.ax[2];
    const py = faceCam.ay[0] * _fp.x + faceCam.ay[1] * _fp.y + faceCam.ay[2];
    pxUv(px, py, o);
    const ax = Math.abs(lx);
    // solo le guance: rossore e lentiggini dipinti. Occhi, naso, bocca (aperta nell'illustrazione)
    // e sopracciglia restano modellati e animati, così niente doppioni.
    const dc = Math.hypot((ax - 0.1) / 0.055, (ly + 0.065) / 0.042);
    o.w = 0.62 * smooth(1.05, 0.4, dc) * smooth(0.25, 0.5, _fn.z);
  };
  matte.add(skinGeo, { colorFn: skinColor, weightFn: headWeight, proj: faceProj });
  {
    // diagnostica: dove cadono nell'illustrazione alcuni punti del volto (leggibile da userData)
    const probe = (x: number, y: number) => {
      const o = { u: 0, v: 0, w: 0 };
      const sp = surf(x, y);
      faceProj(sp, v3(0, 0, 1), 0, 0, o);
      return [Math.round(o.u * IMG_W), Math.round((1 - o.v) * IMG_H)];
    };
    faceFitDebug = { err: Math.round(faceCam.err), cheek: probe(-0.1, -0.065), eye: probe(-0.067, 0.006), mouth: probe(-0.062, -0.136), nose: probe(0, -0.058) };
  }

  // naso: modellato nella superficie della testa (headShape), nessuna sfera separata

  /* ---------------- orecchie + cerchi d'oro ---------------- */
  for (const sg of [-1, 1]) {
    const ep = surfDir(v3(sg * 1, -0.18, -0.05), -0.004);
    const ear = new SphereGeometry(0.03, 14, 12);
    tmpQ.setFromAxisAngle(v3(0, 1, 0), sg * 0.5);
    matte.add(ear, { matrix: M.compose(ep, tmpQ, v3(0.55, 1.6, 1.05)), colorFn: skinColor, bone: B.head });
    const hoop = new TorusGeometry(0.026, 0.0048, 8, 24);
    const hp = ep.clone().add(v3(sg * 0.008, -0.075, 0.01));
    tmpQ.setFromAxisAngle(v3(0, 1, 0), sg * 1.25);
    gold.add(hoop, { matrix: M.compose(hp, tmpQ, one), bone: B.head });
  }

  /* ---------------- occhi ---------------- */
  const EYE_RAD = 0.051;
  for (const [ec, sx] of [
    [EYE_R, -1],
    [EYE_L, 1],
  ] as const) {
    ec.copy(surf(sx * 0.067, 0.006)).add(v3(0, 0, -EYE_RAD * 0.6));
  }
  JOINTS[B.eyeR].p.copy(EYE_R);
  JOINTS[B.lidR].p.copy(EYE_R);
  JOINTS[B.eyeL].p.copy(EYE_L);
  JOINTS[B.lidL].p.copy(EYE_L);
  for (const side of [-1, 1] as const) {
    const ec = side < 0 ? EYE_R : EYE_L;
    const eyeBone = side < 0 ? B.eyeR : B.eyeL;
    const lidBone = side < 0 ? B.lidR : B.lidL;
    const ball = new SphereGeometry(EYE_RAD, 28, 20);
    gloss.add(ball, { matrix: M.makeTranslation(ec.x, ec.y, ec.z), color: C.eyeWhite, bone: eyeBone });
    // iride: calotta sferica con gradiente radiale
    const irisR = 0.036;
    const capAngle = Math.asin(irisR / EYE_RAD);
    const iris = new SphereGeometry(EYE_RAD * 1.004, 32, 10, 0, Math.PI * 2, 0, capAngle);
    const toFront = new Quaternion().setFromUnitVectors(v3(0, 1, 0), v3(0, 0, 1));
    gloss.add(iris, {
      matrix: M.compose(ec, toFront, one),
      colorFn: (p, _n, out) => {
        const r = Math.hypot(p.x - ec.x, p.y - ec.y) / irisR;
        // gradiente: pupilla, iride calda più chiara in basso, bordo scuro
        const lower = smooth(0.0, -0.02, p.y - ec.y);
        if (r < 0.36) out.copy(C.pupil);
        else if (r < 0.8) out.copy(C.iris).lerp(C.irisLight, (1 - Math.abs(r - 0.6) / 0.22) * 0.6 + lower * 0.35);
        else out.copy(C.iris).lerp(C.irisRim, (r - 0.8) / 0.2);
      },
      bone: eyeBone,
    });
    // riflessi (catchlight): calotte sottili tra iride e palpebra, così la palpebra chiusa li copre
    for (const [hx, hy, hr] of [
      [0.011, 0.011, 0.0095],
      [-0.01, -0.011, 0.0042],
    ] as const) {
      const shell = EYE_RAD * 1.022;
      const dirH = v3(hx, hy, Math.sqrt(Math.max(0, shell * shell - hx * hx - hy * hy))).normalize();
      const cap = new SphereGeometry(shell, 12, 3, 0, Math.PI * 2, 0, Math.asin(hr / shell));
      const qh = new Quaternion().setFromUnitVectors(v3(0, 1, 0), dirH);
      gloss.add(cap, { matrix: M.compose(ec, qh, one), color: C.white, bone: eyeBone });
    }

    // palpebra superiore (calotta che ruota attorno al centro dell'occhio)
    const lidR = EYE_RAD * 1.045;
    const lidOpen = 0.86; // ampiezza della calotta (rad dalla cima)
    const lid = new SphereGeometry(lidR, 28, 10, 0, Math.PI * 2, 0, lidOpen);
    // inclina leggermente: angolo esterno più alto
    const tilt = new Quaternion().setFromAxisAngle(v3(0, 0, 1), side * 0.14);
    // palpebra a riposo appena sopra l'iride: sguardo aperto e vivace (il rig chiude di LID_CLOSE)
    const lidRot = new Quaternion().setFromAxisAngle(v3(1, 0, 0), 0.07).premultiply(tilt);
    matte.add(lid, { matrix: M.compose(ec, lidRot, one), colorFn: skinColor, bone: lidBone });
    // linea delle ciglia lungo il bordo della palpebra
    const lashPts: Vector3[] = [];
    const lashN = 14;
    const edgeY = Math.cos(lidOpen) * lidR;
    const edgeR = Math.sin(lidOpen) * lidR;
    for (let i = 0; i <= lashN; i++) {
      const a = lerp(-1.25, 1.25, i / lashN); // da interno a esterno (davanti = z)
      const pp = v3(Math.sin(a) * edgeR, edgeY, Math.cos(a) * edgeR).applyQuaternion(lidRot).add(ec);
      lashPts.push(pp);
    }
    if (side > 0) lashPts.reverse();
    gloss.add(
      taperedTube(lashPts, {
        segments: 24,
        radial: 6,
        radius: (t) => {
          // più spessa verso l'esterno
          const outerT = side < 0 ? 1 - t : t;
          return lerp(0.0028, 0.0068, outerT * outerT) * (outerT > 0.96 ? 0.6 : 1);
        },
        flat: 0.55,
      }),
      { color: C.lash, bone: lidBone },
    );
    // ciglia ad ala sull'angolo esterno
    for (let k = 0; k < 4; k++) {
      const a = 0.62 + k * 0.2; // verso l'esterno
      const base = v3(side * Math.sin(a) * edgeR, edgeY, Math.cos(a) * edgeR).applyQuaternion(lidRot).add(ec);
      const outDir = v3(side * (0.75 + k * 0.12), 0.3 + k * 0.12, 0.3 - k * 0.05).normalize();
      const len = 0.012 + k * 0.004;
      const tipP = base.clone().addScaledVector(outDir, len).add(v3(0, len * 0.35, 0));
      const midP = base.clone().addScaledVector(outDir, len * 0.5).add(v3(0, len * 0.05, 0));
      gloss.add(
        taperedTube([base, midP, tipP], { segments: 5, radial: 4, radius: (t) => lerp(0.0036, 0.0004, t), flat: 0.5 }),
        { color: C.lash, bone: lidBone },
      );
    }
    // palpebra inferiore (fissa)
    const low = new SphereGeometry(lidR * 0.99, 24, 6, 0, Math.PI * 2, Math.PI - 1.04, 1.04);
    const lowRot = new Quaternion().setFromAxisAngle(v3(1, 0, 0), -0.05).premultiply(tilt);
    matte.add(low, { matrix: M.compose(ec, lowRot, one), colorFn: skinColor, bone: B.head });
  }

  /* ---------------- sopracciglia ---------------- */
  for (const side of [-1, 1] as const) {
    const bone = side < 0 ? B.browR : B.browL;
    const pts: Vector3[] = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const t = i / n; // interno → esterno
      const lx = side * lerp(0.022, 0.12, t);
      const ly = 0.075 + 0.026 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.85) - 0.016 * t;
      pts.push(surf(lx, ly, 0.004));
    }
    gloss.add(
      taperedTube(pts, {
        segments: 18,
        radial: 6,
        radius: (t) => {
          const r = t < 0.25 ? lerp(0.011, 0.0145, t / 0.25) : lerp(0.0145, 0.0035, (t - 0.25) / 0.75);
          return r;
        },
        flat: 0.45,
        hint: (p, out) => out.subVectors(p, HC).normalize(),
      }),
      { color: C.brow, bone },
    );
  }

  /* ---------------- lentiggini ---------------- */
  {
    const r = rng(7);
    const count = Q(9, 6);
    for (let i = 0; i < count; i++) {
      // solo sul naso: le guance hanno le lentiggini dipinte dell'illustrazione
      const lx = (r() - 0.5) * 0.045;
      const ly = -0.025 - r() * 0.035;
      const nrm = new Vector3();
      const p = surf(lx, ly, 0.0016, new Vector3(), nrm);
      const dot = new SphereGeometry(0.0008 + r() * 0.0006, 4, 3);
      tmpQ.setFromUnitVectors(v3(0, 0, 1), nrm);
      matte.add(dot, { matrix: M.compose(p, tmpQ, v3(1, 1, 0.25)), color: C.freckle, weightFn: headWeight });
    }
  }

  /* ---------------- bocca ---------------- */
  {
    const W = 0.058; // semi-larghezza
    const yM = -0.138;
    const topY = (u: number) => yM + 0.008 + 0.016 * u * u;
    const botY = (u: number) => yM - 0.022 * Math.pow(Math.max(0, 1 - u * u), 0.9) + 0.017 * u * u;
    const cols = 20;
    const rows = 8;
    const pos: number[] = [];
    const idx: number[] = [];
    const vv: number[] = [];
    const tmp = new Vector3();
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      for (let i = 0; i <= cols; i++) {
        const u = lerp(-1, 1, i / cols);
        const lx = u * W;
        const ly = lerp(topY(u), botY(u), v);
        surf(lx, ly, 0.0022, tmp);
        // leggermente incavata al centro
        tmp.z -= 0.004 * (1 - u * u) * Math.sin(v * Math.PI);
        pos.push(tmp.x, tmp.y, tmp.z);
        vv.push(u, v);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        const b = a + cols + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const mg = new BufferGeometry();
    mg.setAttribute("position", fattr(pos, 3));
    mg.setAttribute("uv", fattr(vv, 2));
    mg.setIndex(idx);
    mg.computeVertexNormals();
    const mouthW = (u: number, v: number) => v * (1 - 0.85 * Math.pow(Math.abs(u), 3));
    gloss.add(mg, {
      colorFn: (_p, _n, out, v, u) => {
        const deep = Math.sin(v * Math.PI) * (1 - u * u);
        out.copy(C.mouth).lerp(C.mouthDeep, deep * 0.8);
      },
      weightFn: (_p, o, v) => {
        // uv.x = u (-1..1) passato come "u" non disponibile qui: ricavato da x
        const u = Math.max(-1, Math.min(1, (_p.x - HC.x) / W));
        blend(o, B.head, B.jaw, mouthW(u, v));
      },
    });
    // denti superiori
    {
      const tp: number[] = [];
      const ti: number[] = [];
      const tc = 16;
      for (let j = 0; j <= 2; j++) {
        for (let i = 0; i <= tc; i++) {
          const u = lerp(-0.78, 0.78, i / tc);
          const ly = topY(u) - 0.001 - j * 0.0085 * (1 - 0.35 * u * u);
          surf(u * W, ly, 0.0042 - 0.001 * u * u, tmp);
          tp.push(tmp.x, tmp.y, tmp.z);
        }
      }
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < tc; i++) {
          const a = j * (tc + 1) + i;
          const b = a + tc + 1;
          ti.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const tg = new BufferGeometry();
      tg.setAttribute("position", fattr(tp, 3));
      tg.setIndex(ti);
      tg.computeVertexNormals();
      gloss.add(tg, {
        colorFn: (p, _n, out) => {
          // leggere separazioni tra i denti
          const k = Math.abs(Math.sin(((p.x - HC.x) / W) * Math.PI * 4.2));
          out.copy(C.teeth).lerp(C.foamShade, k < 0.12 ? 0.5 : 0);
        },
        bone: B.head,
      });
    }
    // lingua
    {
      const tg = new SphereGeometry(1, 16, 8);
      const tpos = surf(0, botY(0) + 0.005, -0.005);
      gloss.add(tg, { matrix: M.compose(tpos, tmpQ.identity(), v3(0.036, 0.009, 0.014)), color: C.tongue, bone: B.jaw });
    }
    // labbra
    const lipN = 16;
    const upper: Vector3[] = [];
    const lower: Vector3[] = [];
    for (let i = 0; i <= lipN; i++) {
      const u = lerp(-1.04, 1.04, i / lipN);
      upper.push(surf(u * W, topY(Math.min(1, Math.abs(u))) + 0.004 * (1 - u * u), 0.004));
      lower.push(surf(u * W, botY(Math.min(1, Math.abs(u))) - 0.004 * (1 - u * u), 0.004));
    }
    gloss.add(
      taperedTube(upper, {
        segments: 28,
        radial: 7,
        radius: (t) => {
          const c = 1 - Math.pow(Math.abs(t - 0.5) * 2, 2);
          // arco di cupido: leggermente più sottile al centro
          const cup = 1 - 0.18 * Math.exp(-((t - 0.5) ** 2) / 0.002);
          return (0.002 + 0.0052 * c) * cup;
        },
        flat: 0.75,
        hint: (p, out) => out.subVectors(p, HC).normalize(),
      }),
      { color: C.lip, bone: B.head },
    );
    gloss.add(
      taperedTube(lower, {
        segments: 28,
        radial: 7,
        radius: (t) => 0.002 + 0.0068 * (1 - Math.pow(Math.abs(t - 0.5) * 2, 2)),
        flat: 0.8,
        hint: (p, out) => out.subVectors(p, HC).normalize(),
      }),
      {
        color: C.lip,
        weightFn: (p, o) => {
          const u = Math.max(-1, Math.min(1, (p.x - HC.x) / W));
          blend(o, B.head, B.jaw, 1 - 0.85 * Math.pow(Math.abs(u), 3));
        },
      },
    );
    // fossette agli angoli
    // (angoli della bocca: nessun puntino, la piega la danno le labbra)
  }

  matte.setPost(null);
  gloss.setPost(null);
  gold.setPost(null);

  /* ---------------- collo ---------------- */
  {
    const neck = taperedTube([v3(0, 0.88, -0.015), v3(0, 1.03, -0.005), v3(0, 1.2, 0.0)], {
      segments: 10,
      radial: Q(20, 12),
      radius: (t) => lerp(0.077, 0.066, t),
    });
    matte.add(neck, { colorFn: (p, _n, out) => out.copy(C.skin).lerp(C.skinShade, 0.25 * smooth(1.16, 1.0, p.y)), weightFn: neckWeight });
  }

  /* ---------------- torso ---------------- */
  // sezione: semi-larghezza a(y), semi-profondità b(y), con seno modesto
  const ta = (y: number) => {
    const k: [number, number][] = [
      [-0.02, 0.278],
      [0.12, 0.27],
      [0.3, 0.178],
      [0.48, 0.2],
      [0.66, 0.232],
      [0.8, 0.246],
      [0.9, 0.254],
      [0.95, 0.222],
      [0.99, 0.13],
      [1.02, 0.07],
    ];
    return pw(k, y);
  };
  const tb = (y: number) => {
    const k: [number, number][] = [
      [-0.02, 0.172],
      [0.12, 0.165],
      [0.3, 0.12],
      [0.48, 0.135],
      [0.66, 0.14],
      [0.8, 0.13],
      [0.9, 0.11],
      [0.95, 0.095],
      [0.99, 0.075],
      [1.02, 0.065],
    ];
    return pw(k, y);
  };
  const bust = (y: number, thIn: number) => {
    const th = Math.atan2(Math.sin(thIn), Math.cos(thIn));
    let s = 0;
    for (const c of [-0.5, 0.5]) {
      const dt = th - c;
      s += Math.exp(-(dt * dt) / 0.09) * Math.exp(-((y - 0.68) ** 2) / 0.006);
    }
    return 0.045 * s;
  };
  /** punto sul torso: th = angolo (0 = davanti, + verso sinistra del personaggio = +X) */
  const torsoPt = (y: number, th: number, off: number, out: Vector3) => {
    const a = ta(y) + off;
    const b = tb(y) + off + (Math.cos(th) > 0 ? bust(y, th) : 0);
    return out.set(Math.sin(th) * a, y, Math.cos(th) * b - 0.01 + 0.012 * Math.cos(th) * smooth(0.5, 0.2, y));
  };
  const torsoGrid = (
    y0: number,
    y1: number,
    rows: number,
    cols: number,
    thFn: (y: number, u: number) => number,
    off: (y: number, th: number) => number,
  ) => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const tmp = new Vector3();
    for (let j = 0; j <= rows; j++) {
      const y = lerp(y0, y1, j / rows);
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const th = thFn(y, u);
        torsoPt(y, th, off(y, th), tmp);
        pos.push(tmp.x, tmp.y, tmp.z);
        uv.push(u, j / rows);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        const b = a + cols + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", fattr(pos, 3));
    g.setAttribute("uv", fattr(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // corpo base: camicia (+ scollo a V) e pantaloni sotto il grembiule.
  // Lo scollo è geometria vera (pannello di pelle + camicia che lo contorna), non colore per vertice:
  // bordo netto e pulito anche da vicino.
  const Y_V = 0.8;
  const skinV = (y: number) => (y <= Y_V ? 0.004 : 0.004 + (y - Y_V) * 0.8);
  const thV = (y: number) => Math.asin(Math.min(0.95, skinV(y) / ta(y)));
  const torsoColor: ColorFn = (p, _n, out) => {
    if (p.y < 0.3) {
      out.copy(C.pants);
      return;
    }
    // sotto il gilet chiuso (si intravede solo nella fessura dei bottoni)
    if (p.y < 0.5 && p.z > 0) {
      out.copy(C.vest);
      return;
    }
    out.copy(C.shirt).lerp(C.shirtShade, 0.4 * smooth(0.55, 0.85, Math.abs(p.x) / ta(p.y)));
  };
  const shirtProj: ProjFn = (p, n, v, u, o) => {
    SHIRT_FABRIC(p, n, v, u * 3, o);
    o.w = p.y < 0.5 ? 0 : 0.42;
  };
  // in basso l'anello è chiuso; verso Y_V si apre come lo scollo, così le due griglie combaciano vertice per vertice
  const thLow = (y: number) => thV(Y_V) * smooth(Y_V - 0.06, Y_V, y);
  matte.add(torsoGrid(-0.02, Y_V, Q(28, 17), Q(38, 24), (y, u) => lerp(thLow(y), Math.PI * 2 - thLow(y), u), () => 0), {
    colorFn: torsoColor,
    weightFn: torsoWeight,
    proj: shirtProj,
  });
  matte.add(torsoGrid(Y_V, 1.02, Q(10, 6), Q(38, 24), (y, u) => lerp(thV(y), Math.PI * 2 - thV(y), u), () => 0), {
    colorFn: torsoColor,
    weightFn: torsoWeight,
    proj: shirtProj,
  });
  // chiude la sottile fessura in cui l'anello inferiore si apre (sotto il vertice dello scollo)
  matte.add(torsoGrid(Y_V - 0.06, Y_V, 3, 2, (y, u) => lerp(-thLow(y), thLow(y), u), () => 0), { colorFn: torsoColor, weightFn: torsoWeight });
  // pelle dello scollo (con un accenno d'ombra al centro)
  matte.add(torsoGrid(Y_V, 1.02, Q(10, 6), Q(10, 6), (y, u) => lerp(-thV(y), thV(y), u), () => 0), {
    colorFn: (p, _n, out) => {
      out.copy(C.skin).lerp(C.skinShade, 0.18 + 0.3 * Math.exp(-((p.x / 0.014) ** 2)) * smooth(0.93, 0.82, p.y));
    },
    weightFn: torsoWeight,
  });
  // fondo chiuso
  {
    const cap = new CylinderGeometry(1, 1, 0.01, Q(40, 20));
    matte.add(cap, { matrix: M.compose(v3(0, -0.02, -0.01), tmpQ.identity(), v3(ta(-0.02) + 0.02, 1, tb(-0.02) + 0.02)), color: C.apron, bone: B.root });
  }

  /* ---------------- gilet ---------------- */
  const vestOpen = (y: number) => {
    if (y < 0.5) return 0.012;
    const w = 0.012 + ((y - 0.5) / 0.38) * 0.15;
    return Math.min(w, 0.17);
  };
  const vestTh = (y: number, sideSign: number) => sideSign * Math.asin(Math.min(0.98, vestOpen(y) / ta(y)));
  const VEST_BOT = 0.255;
  const VEST_TOP = 0.885;
  const vestOff = (y: number) => 0.011 + 0.004 * smooth(0.5, 0.3, y);
  {
    // pannello unico che gira dietro: da +apertura a 2π-apertura
    const g = torsoGrid(
      VEST_BOT,
      VEST_TOP,
      Q(26, 16),
      Q(40, 26),
      (y, u) => {
        const a0 = vestTh(y, 1);
        return lerp(a0, Math.PI * 2 - a0, u);
      },
      (y) => vestOff(y),
    );
    matte.add(g, { colorFn: (p, _n, out) => out.copy(C.vest).lerp(C.white, 0.02 * smooth(0.3, 0.8, p.y)), weightFn: torsoWeight, proj: VEST_FABRIC });
    // profili dorati: bordo della V, bordo inferiore, cuciture verticali
    const edge = (side: number) => {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 14; i++) {
        const y = lerp(VEST_BOT, VEST_TOP, i / 14);
        pts.push(torsoPt(y, vestTh(y, side) * 1.0, vestOff(y) + 0.003, new Vector3()));
      }
      return pts;
    };
    for (const sd of [-1, 1]) {
      gold.add(taperedTube(edge(sd), { segments: 40, radial: 5, radius: () => 0.0035 }), { weightFn: torsoWeight });
      // cucitura verticale (princess seam) curva
      const seam: Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const y = lerp(VEST_BOT + 0.01, 0.7, i / 10);
        const th = sd * lerp(0.62, 0.95, smooth(0.45, 0.7, y));
        seam.push(torsoPt(y, th, vestOff(y) + 0.003, new Vector3()));
      }
      gold.add(taperedTube(seam, { segments: 24, radial: 5, radius: () => 0.0028 }), { weightFn: torsoWeight });
    }
    const bottom: Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const th = lerp(0.02, Math.PI * 2 - 0.02, i / 40);
      bottom.push(torsoPt(VEST_BOT, th, vestOff(VEST_BOT) + 0.003, new Vector3()));
    }
    gold.add(taperedTube(bottom, { segments: 64, radial: 5, radius: () => 0.0035 }), { weightFn: torsoWeight });
    // bottoni
    for (const y of [0.3, 0.385, 0.47]) {
      const p = torsoPt(y, 0.03, vestOff(y) + 0.006, new Vector3());
      const bt = new SphereGeometry(0.014, 14, 10);
      gold.add(bt, { matrix: M.compose(p, tmpQ.identity(), v3(1, 1, 0.5)), weightFn: torsoWeight });
    }
    // logo palma (petto destro, -X)
    const lp = torsoPt(0.665, -0.6, vestOff(0.665) + 0.004, new Vector3());
    const nrm = v3(Math.sin(-0.6), 0.05, Math.cos(-0.6)).normalize();
    addPalmLogo(gold, lp, nrm, 0.05, B.chest);
  }

  /* bordo netto dello scollo della camicia (copre il passaggio pelle/camicia) */
  for (const sd of [-1, 1]) {
    const edgePts: Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const y = lerp(Y_V + 0.01, 0.99, i / 10);
      edgePts.push(torsoPt(y, sd * thV(y), 0.002, new Vector3()));
    }
    matte.add(taperedTube(edgePts, { segments: 16, radial: 6, radius: capsuleRadius(0.0045, 0.1), flat: 0.5, hint: (p, out) => out.set(p.x, 0, p.z).normalize() }), {
      colorFn: (_p, n, out) => out.copy(C.shirt).lerp(C.shirtShade, 0.3 * Math.max(0, -n.y)),
      weightFn: torsoWeight,
    });
  }

  /* ---------------- colletto camicia ---------------- */
  // colletto aperto: gira dietro il collo e si adagia sul petto lungo lo scollo, punte verso il basso
  for (const sd of [-1, 1]) {
    const pts = [
      v3(sd * 0.02, 1.02, -0.07),
      v3(sd * 0.075, 1.005, -0.03),
      torsoPt(0.975, sd * (thV(0.975) + 0.12), 0.012, new Vector3()),
      torsoPt(0.92, sd * (thV(0.92) + 0.2), 0.012, new Vector3()),
      torsoPt(0.855, sd * (thV(0.855) + 0.26), 0.012, new Vector3()),
    ];
    matte.add(
      taperedTube(pts, {
        segments: 18,
        radial: 8,
        // largo sul petto e a punta all'estremità (come un vero colletto a punte)
        radius: (t) => (t < 0.7 ? lerp(0.016, 0.03, smooth(0, 0.7, t)) : lerp(0.03, 0.004, smooth(0.7, 1, t))),
        flat: 0.18,
        hint: (p, out) => out.set(p.x, 0.35, p.z + 0.02).normalize(),
      }),
      { colorFn: (_p, n, out) => out.copy(C.shirt).lerp(C.shirtShade, 0.35 * Math.max(0, -n.y)), weightFn: torsoWeight },
    );
  }

  /* ---------------- collana con palma ---------------- */
  {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = lerp(-2.3, 2.3, i / 16);
      const y = 0.975 - 0.085 * Math.pow(Math.cos(a / 2.3 * Math.PI * 0.5), 2);
      const r = 0.075 + 0.01 * Math.cos(a);
      pts.push(v3(Math.sin(a) * r * 1.05, y, Math.cos(a) * r * 1.25 + 0.012));
    }
    gold.add(taperedTube(pts, { segments: 40, radial: 4, radius: () => 0.0022 }), { bone: B.chest });
    const pend = v3(0, 0.875, tb(0.875) + 0.02);
    addPalmLogo(gold, pend, v3(0, 0.15, 1).normalize(), 0.035, B.chest);
  }

  /* ---------------- grembiule ---------------- */
  {
    const g = torsoGrid(
      -0.02,
      0.305,
      Q(14, 8),
      Q(48, 28),
      (_y, u) => lerp(-Math.PI * 0.92, Math.PI * 0.92, u),
      (y) => 0.018 + 0.022 * smooth(0.3, -0.02, y),
    );
    matte.add(g, { color: C.apron, weightFn: torsoWeight, proj: APRON_FABRIC });
    // fascia in vita
    const band: Vector3[] = [];
    for (let i = 0; i <= 36; i++) band.push(torsoPt(0.29, lerp(-Math.PI, Math.PI, i / 36), 0.02, new Vector3()));
    matte.add(taperedTube(band, { segments: 56, radial: 6, radius: () => 0.022, flat: 0.25, hint: (p, out) => out.set(p.x, 0, p.z).normalize() }), {
      color: C.apron,
      weightFn: torsoWeight,
    });
    // tasca con profilo dorato
    const pk: Vector3[] = [];
    for (let i = 0; i <= 10; i++) pk.push(torsoPt(0.13, lerp(-0.5, 0.5, i / 10), 0.044, new Vector3()));
    gold.add(taperedTube(pk, { segments: 20, radial: 4, radius: () => 0.003 }), { weightFn: torsoWeight });
    const pkL: Vector3[] = [];
    for (let i = 0; i <= 10; i++) pkL.push(torsoPt(lerp(0.13, -0.02, i / 10), -0.5, 0.044, new Vector3()));
    gold.add(taperedTube(pkL, { segments: 10, radial: 4, radius: () => 0.003 }), { weightFn: torsoWeight });
    const pkR: Vector3[] = [];
    for (let i = 0; i <= 10; i++) pkR.push(torsoPt(lerp(0.13, -0.02, i / 10), 0.5, 0.044, new Vector3()));
    gold.add(taperedTube(pkR, { segments: 10, radial: 4, radius: () => 0.003 }), { weightFn: torsoWeight });
    // penna nella tasca
    const pp = torsoPt(0.13, -0.36, 0.046, new Vector3());
    gloss.add(taperedTube([pp.clone().add(v3(0, -0.04, 0)), pp.clone().add(v3(0, 0.055, 0.002))], { segments: 4, radial: 8, radius: capsuleRadius(0.008, 0.1) }), {
      color: C.pen,
      bone: B.root,
    });
    gold.add(new BoxGeometry(0.004, 0.035, 0.003), { matrix: M.makeTranslation(pp.x, pp.y + 0.03, pp.z + 0.009), bone: B.root });
    // fiocco sul fianco destro (-X)
    const k = torsoPt(0.285, -1.15, 0.05, new Vector3());
    matte.add(new SphereGeometry(0.03, 14, 10), { matrix: M.compose(k, tmpQ.identity(), v3(1, 0.9, 0.8)), color: C.apron, bone: B.spine });
    for (const sd of [-1, 1]) {
      const loop = taperedTube(
        [k.clone(), k.clone().add(v3(-0.04, sd * 0.045 + 0.01, 0.03)), k.clone().add(v3(-0.085, sd * 0.03 + 0.005, 0.035)), k.clone().add(v3(-0.07, sd * 0.005, 0.02)), k.clone()],
        { segments: 18, radial: 8, radius: capsuleRadius(0.022, 0.08), flat: 0.3, hint: () => v3(0, 0, 1), curveType: "catmullrom" },
      );
      matte.add(loop, { color: C.apron, weightFn: torsoWeight });
      const tail = taperedTube(
        [k.clone(), k.clone().add(v3(-0.02 + sd * 0.025, -0.1, 0.035)), k.clone().add(v3(-0.03 + sd * 0.04, -0.22, 0.03)), k.clone().add(v3(-0.03 + sd * 0.05, -0.3, 0.02))],
        { segments: 16, radial: 8, radius: (t) => lerp(0.016, 0.028, t), flat: 0.22, hint: () => v3(0, 0, 1) },
      );
      matte.add(tail, { color: C.apron, weightFn: torsoWeight });
    }
  }

  /* ---------------- presa del microfono (calcolata prima del braccio) ---------------- */
  // testa del microfono davanti all'angolo della bocca, manico che scende fuori dal pugno
  const mouthPt = surf(0, -0.138, 0).applyMatrix4(HEAD_S);
  const MIC_HEAD = mouthPt.clone().add(v3(0.085, -0.032, 0.062));
  const MIC_AXIS = MIC_HEAD.clone().sub(v3(0.2, 1.05, 0.31)).normalize();
  const FIST = MIC_HEAD.clone().addScaledVector(MIC_AXIS, -0.15);
  const FIST_Z = v3(-0.1, 0, 1).addScaledVector(MIC_AXIS, -v3(-0.1, 0, 1).dot(MIC_AXIS)).normalize();
  const FIST_X = new Vector3().crossVectors(MIC_AXIS, FIST_Z).normalize();
  // il polso sta sotto/dietro il pugno
  JOINTS[B.handL].p.copy(FIST).addScaledVector(MIC_AXIS, -0.045).addScaledVector(FIST_Z, -0.028).addScaledVector(FIST_X, 0.01);

  /* ---------------- braccia ---------------- */
  const P = (b: number) => JOINTS[b].p;
  const buildArm = (side: -1 | 1) => {
    const sho = side < 0 ? B.uarmR : B.uarmL;
    const farm = side < 0 ? B.farmR : B.farmL;
    const hand = side < 0 ? B.handR : B.handL;
    const s = P(sho);
    const e = P(farm);
    const w = P(hand);
    // manica (camicia), gonfia
    const mid = s.clone().lerp(e, 0.5).add(v3(side * 0.012, 0, 0.0));
    matte.add(
      taperedTube([s.clone().add(v3(-side * 0.012, 0.01, 0)), mid, e.clone().lerp(s, 0.04)], {
        segments: 14,
        radial: Q(18, 10),
        // inizio arrotondato dentro la sfera della spalla: nessun bordo che sporge quando il braccio si alza
        radius: (t) => lerp(0.085, 0.07, t) * (1 + 0.14 * Math.sin(t * Math.PI)) * (t < 0.14 ? 0.55 + 0.45 * Math.sqrt(1 - ((0.14 - t) / 0.14) ** 2) : 1),
      }),
      { colorFn: (p, n, out) => out.copy(C.shirt).lerp(C.shirtShade, 0.35 * Math.max(0, -n.y)), bone: sho, proj: SHIRT_FABRIC },
    );
    // spalla arrotondata
    matte.add(new SphereGeometry(0.088, Q(16, 10), Q(12, 8)), { matrix: M.compose(s.clone().add(v3(-side * 0.01, 0.012, 0)), tmpQ.identity(), v3(1, 0.95, 1)), color: C.shirt, bone: sho });
    // risvolto arrotolato appena sopra il gomito: un solo rotolo morbido, allungato lungo il braccio
    // (sta sulla manica, non sulla piega del gomito: niente "nodi" bianchi quando il braccio si piega)
    const dirU = e.clone().sub(s).normalize();
    const qU = new Quaternion().setFromUnitVectors(v3(0, 0, 1), dirU);
    {
      const c = e.clone().addScaledVector(dirU, -0.04);
      matte.add(new TorusGeometry(0.061, 0.021, Q(10, 6), Q(20, 12)), {
        matrix: M.compose(c, qU, v3(1, 1, 1.5)),
        colorFn: (_p, n, out) => out.copy(C.shirt).lerp(C.shirtShade, 0.5 * Math.max(0, -n.y) + 0.1),
        bone: sho,
        proj: SHIRT_FABRIC,
      });
    }
    // avambraccio nudo
    matte.add(
      taperedTube([e.clone(), e.clone().lerp(w, 0.5), w.clone()], { segments: 10, radial: Q(16, 10), radius: (t) => lerp(0.06, 0.041, t) * (1 + 0.12 * Math.sin(t * Math.PI * 0.8)) }),
      { colorFn: skinColor, bone: farm },
    );
    matte.add(new SphereGeometry(0.046, 14, 10), { matrix: M.makeTranslation(e.x, e.y, e.z), colorFn: skinColor, bone: farm });
    // polso: bracciale (dx) o orologio (sx)
    const dirF = w.clone().sub(e).normalize();
    const qF = new Quaternion().setFromUnitVectors(v3(0, 0, 1), dirF);
    const wc = w.clone().addScaledVector(dirF, -0.03);
    if (side < 0) {
      const links = Q(14, 9);
      for (let i = 0; i < links; i++) {
        const a = (i / links) * Math.PI * 2;
        const lp = v3(Math.cos(a) * 0.046, Math.sin(a) * 0.046, 0).applyQuaternion(qF).add(wc);
        const tang = v3(-Math.sin(a), Math.cos(a), 0).applyQuaternion(qF);
        const ql = new Quaternion().setFromUnitVectors(v3(1, 0, 0), tang);
        if (i % 2) ql.multiply(new Quaternion().setFromAxisAngle(v3(1, 0, 0), Math.PI / 2));
        gold.add(new TorusGeometry(0.0085, 0.0026, 5, 10), { matrix: M.compose(lp, ql, v3(1.3, 1, 1)), bone: farm });
      }
    } else {
      gold.add(new TorusGeometry(0.045, 0.007, 6, Q(24, 14)), { matrix: M.compose(wc, qF, v3(1, 1, 1.4)), bone: farm });
      // quadrante sul dorso del polso (verso fuori/avanti)
      const faceDir = v3(1, 0, 0.6).normalize();
      faceDir.addScaledVector(dirF, -faceDir.dot(dirF)).normalize();
      const fc = wc.clone().addScaledVector(faceDir, 0.047);
      const qf = new Quaternion().setFromUnitVectors(v3(0, 1, 0), faceDir);
      gold.add(new CylinderGeometry(0.015, 0.015, 0.008, 16), { matrix: M.compose(fc, qf, one), bone: farm });
      gloss.add(new CylinderGeometry(0.0115, 0.0115, 0.002, 16), { matrix: M.compose(fc.clone().addScaledVector(faceDir, 0.004), qf, one), color: C.foam, bone: farm });
    }
  };
  buildArm(-1);
  buildArm(1);

  /* ---------------- mano destra (palmo in su, regge il vassoio) ---------------- */
  const wR = P(B.handR);
  const fingersDirR = v3(-0.72, 0.08, 0.68).normalize();
  const upR = v3(0.05, 1, 0.0).normalize();
  {
    const z = fingersDirR.clone();
    const y = upR.clone().addScaledVector(z, -upR.dot(z)).normalize();
    const x = new Vector3().crossVectors(y, z).normalize();
    const H = basisMatrix(wR, x, y, z);
    addHand(matte, H, { curl: 0.18, spread: 0.16, thumbSide: -1, palmUp: true, bone: B.handR, color: skinColor });
  }
  const palmR = wR.clone().addScaledVector(fingersDirR, 0.05).addScaledVector(upR, 0.012);
  const traySocketWorld = palmR.clone().add(v3(0, 0.03, 0)).addScaledVector(fingersDirR, 0.02);

  /* ---------------- mano sinistra (pugno sul microfono) ---------------- */
  {
    const wL = P(B.handL);
    const H = basisMatrix(FIST, FIST_X, MIC_AXIS, FIST_Z);
    addFist(matte, H, { bone: B.handL, color: skinColor });
    // polso → dorso del pugno
    const fistBack = v3(0.01, -0.03, -0.022).applyMatrix4(H);
    matte.add(taperedTube([wL.clone().addScaledVector(wL.clone().sub(fistBack).normalize(), 0.01), fistBack], { segments: 4, radial: 12, radius: () => 0.03, flat: 0.8 }), {
      colorFn: skinColor,
      bone: B.handL,
    });
    // microfono rigido nella mano: il manico esce sotto il mignolo
    const tail = FIST.clone().addScaledVector(MIC_AXIS, -0.055);
    const neckM = MIC_HEAD.clone().addScaledVector(MIC_AXIS, -0.042);
    gloss.add(
      taperedTube([tail, FIST.clone(), neckM], { segments: 10, radial: 16, radius: (t) => lerp(0.0175, 0.0205, t) * (t < 0.05 ? 0.7 + 6 * t : 1) }),
      { color: C.micBlack, bone: B.handL },
    );
    const qa = new Quaternion().setFromUnitVectors(v3(0, 1, 0), MIC_AXIS);
    gold.add(new CylinderGeometry(0.025, 0.022, 0.016, 20), { matrix: M.compose(neckM.clone().addScaledVector(MIC_AXIS, 0.006), qa, one), bone: B.handL });
    gloss.add(new SphereGeometry(0.037, Q(20, 12), Q(16, 10)), {
      matrix: M.compose(MIC_HEAD, qa, v3(1, 1.05, 1)),
      colorFn: (p, _n, out) => {
        // griglia: alterna toni
        const q = Math.sin((p.x + p.y) * 520) * Math.sin((p.y - p.z) * 520);
        out.copy(C.micGrille).multiplyScalar(q > 0 ? 1.15 : 0.55);
      },
      bone: B.handL,
    });
  }

  /* ---------------- vassoio (osso dedicato, resta in bolla) ---------------- */
  // costruito nello spazio modello con origine nel socket; l'osso parte da lì
  JOINTS[B.tray].p = traySocketWorld.clone();
  {
    const T = traySocketWorld;
    const tr = (x: number, y: number, z: number) => v3(T.x + x, T.y + y, T.z + z);
    const R = 0.25;
    const prof = [
      new Vector2(0.0, -0.006),
      new Vector2(R - 0.03, -0.006),
      new Vector2(R - 0.012, -0.002),
      new Vector2(R, 0.022),
      new Vector2(R + 0.006, 0.026),
      new Vector2(R + 0.01, 0.022),
      new Vector2(R - 0.004, 0.018),
      new Vector2(R - 0.02, 0.0),
      new Vector2(0.0, 0.0),
    ];
    gloss.add(new LatheGeometry(prof, Q(48, 28)), {
      matrix: M.makeTranslation(T.x, T.y, T.z),
      colorFn: (p, n, out) => out.copy(C.trayBronze).lerp(C.trayDark, 0.6 * Math.max(0, -n.y)),
      bone: B.tray,
    });
    // boccale
    const mug = tr(0.075, 0, 0.01);
    const mr = 0.078;
    const mh = 0.2;
    const outer = [
      new Vector2(0, 0.0),
      new Vector2(mr - 0.004, 0.0),
      new Vector2(mr, 0.006),
      new Vector2(mr, mh),
      new Vector2(mr - 0.006, mh + 0.002),
      new Vector2(mr - 0.008, mh - 0.004),
      new Vector2(mr - 0.008, 0.026),
      new Vector2(0, 0.024),
    ];
    glass.add(new LatheGeometry(outer, Q(32, 18)), { matrix: M.makeTranslation(mug.x, mug.y, mug.z), color: C.white, bone: B.tray });
    // manico (verso l'esterno, -X)
    const handle = taperedTube(
      [mug.clone().add(v3(-mr + 0.004, 0.165, 0)), mug.clone().add(v3(-mr - 0.05, 0.16, 0)), mug.clone().add(v3(-mr - 0.06, 0.09, 0)), mug.clone().add(v3(-mr - 0.045, 0.04, 0)), mug.clone().add(v3(-mr + 0.004, 0.04, 0))],
      { segments: 20, radial: 8, radius: () => 0.012, flat: 0.75 },
    );
    glass.add(handle, { color: C.white, bone: B.tray });
    // birra (cilindro interno, gradiente)
    const beer = new CylinderGeometry(mr - 0.011, mr - 0.012, 0.155, Q(28, 16), 4);
    const beerProj: ProjFn = (_p, _n, v, u, o) => {
      pxUv(212 + tri(u * 2) * 135, 392 - v * 168, o);
      o.w = 0.9;
    };
    gloss.add(beer, {
      proj: beerProj,
      matrix: M.makeTranslation(mug.x, mug.y + 0.026 + 0.0775, mug.z),
      colorFn: (p, _n, out) => {
        const k = (p.y - (mug.y + 0.026)) / 0.155;
        out.copy(C.beerDeep).lerp(C.beer, smooth(0, 0.6, k)).lerp(C.beerTop, smooth(0.6, 1, k));
      },
      bone: B.tray,
    });
    // bollicine
    const r = rng(11);
    for (let i = 0; i < Q(18, 8); i++) {
      const a = r() * Math.PI * 2;
      const y = 0.035 + r() * 0.14;
      const bp = mug.clone().add(v3(Math.cos(a) * (mr - 0.0105), y, Math.sin(a) * (mr - 0.0105)));
      gloss.add(new SphereGeometry(0.0022 + r() * 0.002, 5, 4), { matrix: M.makeTranslation(bp.x, bp.y, bp.z), color: C.beerTop, bone: B.tray });
    }
    // schiuma traboccante
    const foamTop = mug.y + 0.19;
    for (let i = 0; i < Q(9, 6); i++) {
      const a = (i / Q(9, 6)) * Math.PI * 2 + 0.3;
      const fp = mug.clone().add(v3(Math.cos(a) * (mr - 0.02), foamTop - mug.y + 0.012 + r() * 0.012, Math.sin(a) * (mr - 0.02)));
      matte.add(new SphereGeometry(0.03 + r() * 0.012, 10, 7), {
        matrix: M.makeTranslation(fp.x, fp.y, fp.z),
        colorFn: (_p, n, out) => out.copy(C.foam).lerp(C.foamShade, 0.6 * Math.max(0, -n.y)),
        proj: (_p, _n, v, u, o) => {
          pxUv(200 + tri(u * 3) * 150, 232 - v * 60, o);
          o.w = 0.75;
        },
        bone: B.tray,
      });
    }
    matte.add(new SphereGeometry(mr * 0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), {
      matrix: M.compose(mug.clone().add(v3(0, 0.205, 0)), tmpQ.identity(), v3(1, 0.55, 1)),
      color: C.foam,
      bone: B.tray,
    });
    // colate di schiuma
    for (const a of [0.6, 2.2, 4.0, 5.3]) {
      const top = mug.clone().add(v3(Math.cos(a) * (mr + 0.002), 0.2, Math.sin(a) * (mr + 0.002)));
      const len = 0.03 + r() * 0.04;
      matte.add(
        taperedTube([top, top.clone().add(v3(0, -len * 0.6, 0)), top.clone().add(v3(0, -len, 0))], {
          segments: 6,
          radial: 8,
          radius: (t) => lerp(0.014, 0.008, t) * (t > 0.8 ? Math.sqrt(1 - ((t - 0.8) / 0.2) ** 2) : 1),
          flat: 0.6,
          hint: (p, out) => out.set(p.x - mug.x, 0, p.z - mug.z).normalize(),
        }),
        { color: C.foam, bone: B.tray },
      );
    }
    // palmetta in vaso
    const pot = tr(-0.12, 0, -0.08);
    const potProf = [new Vector2(0, 0), new Vector2(0.04, 0), new Vector2(0.05, 0.065), new Vector2(0.056, 0.07), new Vector2(0.054, 0.078), new Vector2(0.046, 0.078), new Vector2(0, 0.07)];
    gloss.add(new LatheGeometry(potProf, Q(20, 12)), { matrix: M.makeTranslation(pot.x, pot.y, pot.z), color: C.pot, bone: B.tray });
    const trunkTop = pot.clone().add(v3(0.005, 0.15, 0));
    matte.add(taperedTube([pot.clone().add(v3(0, 0.06, 0)), pot.clone().add(v3(0.002, 0.11, 0)), trunkTop], { segments: 8, radial: 8, radius: (t) => lerp(0.012, 0.008, t) }), {
      colorFn: (p, _n, out) => out.copy(C.trunk).multiplyScalar(Math.sin(p.y * 260) > 0.3 ? 0.75 : 1),
      bone: B.tray,
    });
    const fronds = Q(8, 6);
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + 0.2;
      const dir = v3(Math.cos(a), 0, Math.sin(a));
      const p0 = trunkTop.clone();
      const p1 = trunkTop.clone().addScaledVector(dir, 0.05).add(v3(0, 0.035, 0));
      const p2 = trunkTop.clone().addScaledVector(dir, 0.1).add(v3(0, 0.02, 0));
      const p3 = trunkTop.clone().addScaledVector(dir, 0.135).add(v3(0, -0.025, 0));
      matte.add(
        taperedTube([p0, p1, p2, p3], {
          segments: 12,
          radial: 6,
          radius: (t) => (t < 0.15 ? lerp(0.006, 0.022, t / 0.15) : lerp(0.022, 0.002, (t - 0.15) / 0.85)),
          flat: 0.12,
          hint: () => v3(0, 1, 0),
        }),
        { colorFn: (_p, _n, out, v, u) => out.copy(C.leaf).lerp(C.leafLight, Math.abs(Math.sin(u * Math.PI * 9)) * 0.5 + v * 0.2), bone: B.tray },
      );
    }
    // ciotola di noccioline
    const bowl = tr(-0.105, 0, 0.11);
    const bowlProf = [new Vector2(0, 0), new Vector2(0.035, 0), new Vector2(0.06, 0.03), new Vector2(0.064, 0.036), new Vector2(0.058, 0.034), new Vector2(0.032, 0.008), new Vector2(0, 0.008)];
    gloss.add(new LatheGeometry(bowlProf, Q(24, 14)), { matrix: M.makeTranslation(bowl.x, bowl.y, bowl.z), color: C.bowl, bone: B.tray });
    const nuts = Q(13, 8);
    for (let i = 0; i < nuts; i++) {
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r()) * 0.045;
      const np = bowl.clone().add(v3(Math.cos(a) * rr, 0.034 + (0.045 - rr) * 0.35 + r() * 0.008, Math.sin(a) * rr));
      const q = new Quaternion().setFromAxisAngle(v3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), r() * 3);
      matte.add(new SphereGeometry(0.0095, 6, 5), { matrix: M.compose(np, q, v3(1, 1.6, 0.95)), color: r() < 0.5 ? C.peanut : C.peanutDark, bone: B.tray });
    }
  }

  /* ---------------- capelli ---------------- */
  hairAcc.setPost(HEAD_S);
  buildHair(hairAcc, Q, surfDir);
  hairAcc.setPost(null);

  /* ------------------------------------------------------------------ */
  /*  Ossa, skeleton, mesh                                                */
  /* ------------------------------------------------------------------ */
  // posizioni finali dei giunti: la famiglia della testa segue la scala della testa
  const headFamily = new Set<number>([B.jaw, B.lidR, B.lidL, B.eyeR, B.eyeL, B.browR, B.browL, B.bun, B.hairR1, B.hairR2, B.hairL1, B.hairL2, B.hairB1, B.hairB2]);
  const jointWorld = JOINTS.map((j, i) => (headFamily.has(i) ? j.p.clone().applyMatrix4(HEAD_S) : j.p.clone()));
  const bones: Bone[] = [];
  const restPositions: Vector3[] = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const b = new Bone();
    b.name = `regina_${i}`;
    bones.push(b);
  }
  for (let i = 0; i < BONE_COUNT; i++) {
    const j = JOINTS[i];
    const local = j.parent < 0 ? jointWorld[i].clone() : jointWorld[i].clone().sub(jointWorld[j.parent]);
    bones[i].position.copy(local);
    restPositions.push(local.clone());
    if (j.parent >= 0) bones[j.parent].add(bones[i]);
  }
  const root = new Group();
  root.name = "LaRegina";
  root.add(bones[B.root]);
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);

  const env = opts.envMap ?? null;
  const loader = new TextureLoader();
  const refTex = loader.load(REF_TEX_URL);
  // capelli: atlante di "fili" generato in codice (fibre sottili e ordinate, niente macchie dipinte)
  const hairTex = makeHairTexture(lp);
  for (const t of [refTex, hairTex]) {
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
  }
  const matteMat = new MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0,
    sheen: 0.18,
    sheenRoughness: 0.55,
    sheenColor: new Color("#ffe0cc"),
    side: DoubleSide,
    envMap: env,
    // ≤ 0.3 come in studio (Characters.tsx limita l'ambiente dei personaggi): l'anteprima è fedele al palco
    envMapIntensity: 0.25,
  });
  const glossMat = new MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.36,
    metalness: 0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
    side: DoubleSide,
    envMap: env,
    envMapIntensity: 0.3,
  });
  const goldMat = new MeshStandardMaterial({
    // con poco ambiente un metallo puro diventa bruno: metallo "parziale" + un filo di emissivo caldo
    // tengono l'oro leggibile anche sotto le luci magenta del palco
    color: new Color("#f2bb52"),
    metalness: 0.72,
    roughness: 0.3,
    emissive: new Color("#4a2e08"),
    emissiveIntensity: 0.55,
    envMap: env,
    envMapIntensity: 0.3,
  });
  const glassMat = new MeshPhysicalMaterial({
    color: new Color("#fff7e8"),
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: DoubleSide,
    envMap: env,
    envMapIntensity: 0.3,
    clearcoat: 1,
  });
  glassMat.forceSinglePass = true;
  const hairMat = new MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.4,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.35,
    sheenColor: new Color("#c98a5c"),
    clearcoat: 0.12,
    clearcoatRoughness: 0.4,
    side: DoubleSide,
    envMap: env,
    envMapIntensity: 0.3,
  });
  // controluce: bordo caldo che stacca il personaggio dal fondo viola
  addRim(matteMat, new Color("#ffc08a"), 0.3, 3.5, { map: refTex, unlit: 0.32 });
  addRim(glossMat, new Color("#ffc896"), 0.18, 3.5, { map: refTex, unlit: 0.45 });
  addRim(hairMat, new Color("#ffa365"), 0.16, 3, { map: hairTex, unlit: 0.12 });

  const meshes: SkinnedMesh[] = [];
  root.userData.faceFit = faceFitDebug;
  const materials: Material[] = [matteMat, glossMat, goldMat, glassMat, hairMat];
  let triangles = 0;
  let maxY = 0;
  const parts: [MeshAccumulator, Material, number][] = [
    [matte, matteMat, 0],
    [gloss, glossMat, 0],
    [gold, goldMat, 0],
    [hairAcc, hairMat, 0],
    [glass, glassMat, 2],
  ];
  for (const [acc, mat, order] of parts) {
    if (acc.vertexCount === 0) continue;
    triangles += acc.triangleCount;
    const geo = acc.build();
    geo.computeBoundingBox();
    if (geo.boundingBox) maxY = Math.max(maxY, geo.boundingBox.max.y);
    const mesh = new SkinnedMesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton);
    meshes.push(mesh);
  }
  headGeo.dispose();

  // socket del vassoio rispetto all'osso mano destra (a riposo, rotazioni identità)
  const traySocket = traySocketWorld.clone().sub(JOINTS[B.handR].p);

  root.userData.reginaStats = { matte: matte.triangleCount, gloss: gloss.triangleCount, gold: gold.triangleCount, glass: glass.triangleCount, hair: hairAcc.triangleCount, triangles, maxY: Math.round(maxY * 1000) / 1000 };
  return { root, bones, skeleton, meshes, materials, traySocket, restPositions, textures: [refTex, hairTex], triangles, drawCalls: meshes.length };
}

/* ------------------------------------------------------------------ */
/*  Utility locali                                                     */
/* ------------------------------------------------------------------ */

const fattr = (a: number[], n: number) => new BufferAttribute(new Float32Array(a), n);

/* ---------------- proiezione dell'illustrazione (projection-first) ---------------- */
/** texture ricavate dall'illustrazione ufficiale (de-light leggero) */
const REF_TEX_URL = "/three/characters/regina/regina-ref.webp";

/**
 * Atlante 4x1 di ciocche (u attorno alla ciocca, v lungo la ciocca): fibre sottili castane con
 * qualche filo ramato, generate una volta sola (≈0.5 MB su GPU, 0.25 MB in bassa potenza).
 * Tessere: 0 castano medio, 1 castano caldo, 2 scuro (chignon), 3 riflessi ramati.
 */
function makeHairTexture(lowPower: boolean): Texture {
  const TW = lowPower ? 64 : 128;
  const TH = lowPower ? 128 : 256;
  const W = TW * 4;
  const data = new Uint8Array(W * TH * 4);
  const tones = [
    { dark: [36, 17, 9], mid: [82, 43, 22], hi: [150, 92, 52] },
    { dark: [42, 20, 10], mid: [94, 50, 26], hi: [164, 102, 58] },
    { dark: [30, 14, 8], mid: [68, 35, 18], hi: [128, 76, 44] },
    { dark: [40, 18, 9], mid: [100, 52, 25], hi: [178, 110, 58] },
  ];
  const r = rng(4242);
  for (let tile = 0; tile < 4; tile++) {
    const t = tones[tile];
    // fasi e frequenze casuali per le fibre (somma di onde: righe fini e irregolari)
    const waves: [number, number, number][] = [];
    for (let k = 0; k < 10; k++) waves.push([k < 2 ? 2 + Math.floor(r() * 3) : 14 + Math.floor(r() * 40), r() * Math.PI * 2, k < 2 ? 0.22 : 0.26]);
    const drift = r() * Math.PI * 2;
    for (let y = 0; y < TH; y++) {
      const v = y / TH;
      for (let x = 0; x < TW; x++) {
        // le fibre ondeggiano un poco lungo la ciocca
        const u = x / TW + 0.025 * Math.sin(v * Math.PI * 2 * 1.5 + drift) + 0.012 * Math.sin(v * Math.PI * 2 * 4.2 + drift * 2);
        let n = 0;
        for (const [f, ph, a] of waves) n += a * Math.sin(u * Math.PI * 2 * f + ph);
        n = 0.5 + 0.5 * Math.tanh(n * 1.4);
        const fine = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 47 + Math.sin(u * 31 + drift) * 3);
        const b = Math.min(1, Math.max(0, 0.15 + 0.7 * n + 0.15 * fine));
        const hi = Math.pow(Math.max(0, n - 0.72) / 0.28, 2) * (0.75 + 0.25 * Math.sin(v * Math.PI * 2 + drift));
        const i = (y * W + tile * TW + x) * 4;
        for (let c = 0; c < 3; c++) {
          const base = t.dark[c] + (t.mid[c] - t.dark[c]) * b;
          data[i + c] = Math.round(base + (t.hi[c] - base) * hi);
        }
        data[i + 3] = 255;
      }
    }
  }
  const tex = new DataTexture(data, W, TH, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
const IMG_W = 1312;
const IMG_H = 1199;
/** onda triangolare 0→1→0: ripetizione speculare continua delle coordinate */
const tri = (x: number) => {
  const f = ((x % 2) + 2) % 2;
  return f < 1 ? f : 2 - f;
};
/** pixel dell'illustrazione → uv (flipY) */
const pxUv = (x: number, y: number, o: { u: number; v: number }) => {
  o.u = x / IMG_W;
  o.v = 1 - y / IMG_H;
};
/** tessuto dipinto: ritaglio rettangolare dell'illustrazione ripetuto a specchio sulle uv della geometria */
const fabric = (x0: number, y0: number, x1: number, y1: number, repU: number, repV: number, w: number): ProjFn => (_p, _n, v, u, o) => {
  pxUv(x0 + tri(u * repU) * (x1 - x0), y1 - tri(v * repV) * (y1 - y0), o);
  o.w = w;
};
// ritaglio di solo panno nero (il precedente prendeva una ciocca ramata e il logo: macchie arancioni sul gilet)
const VEST_FABRIC = fabric(765, 795, 832, 872, 7, 2, 0.7);
const APRON_FABRIC = fabric(900, 1050, 990, 1170, 8, 1, 0.65);
const SHIRT_FABRIC = fabric(330, 866, 450, 930, 3, 2, 0.5);

/** tessera i (0..3) dell'atlante capelli 1024x512: u attorno alla ciocca, v lungo la ciocca */
const hairTile = (tile: number, repU: number, repV: number, w: number, phase = 0): ProjFn => (_p, _n, v, u, o) => {
  o.u = (tile + 0.03 + 0.94 * tri(u * repU)) / 4;
  o.v = 0.02 + 0.96 * tri(v * repV + phase);
  o.w = w;
};

function solve3(m: number[], b: number[]): number[] {
  const det = (a: number[]) => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
  const d = det(m) || 1e-12;
  const out: number[] = [];
  for (let c = 0; c < 3; c++) {
    const mc = m.slice();
    for (let r = 0; r < 3; r++) mc[r * 3 + c] = b[r];
    out.push(det(mc) / d);
  }
  return out;
}

/**
 * Risolve la "camera" del volto: rotazione (yaw/pitch/roll) + proiezione ortografica + affine 2D
 * che porta i punti di riferimento 3D del volto sui pixel misurati nell'illustrazione.
 */
function fitFaceCamera(lm3: Vector3[], lm2: [number, number][], center: Vector3) {
  let best = { err: Infinity, q: new Quaternion(), ax: [0, 0, 0], ay: [0, 0, 0] };
  const e = new Euler();
  const q = new Quaternion();
  const t = new Vector3();
  for (let yaw = -0.2; yaw <= 0.9; yaw += 0.05) {
    for (let pitch = -0.5; pitch <= 0.5; pitch += 0.05) {
      for (let roll = -0.5; roll <= 0.5; roll += 0.05) {
        q.setFromEuler(e.set(pitch, yaw, roll, "YXZ"));
        const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        const bx = [0, 0, 0];
        const by = [0, 0, 0];
        const pts: number[][] = [];
        for (let i = 0; i < lm3.length; i++) {
          t.copy(lm3[i]).sub(center).applyQuaternion(q);
          const row = [t.x, t.y, 1];
          pts.push(row);
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) M[r * 3 + c] += row[r] * row[c];
            bx[r] += row[r] * lm2[i][0];
            by[r] += row[r] * lm2[i][1];
          }
        }
        const ax = solve3(M, bx);
        const ay = solve3(M, by);
        let err = 0;
        for (let i = 0; i < pts.length; i++) {
          const [x, y] = pts[i];
          err += (ax[0] * x + ax[1] * y + ax[2] - lm2[i][0]) ** 2 + (ay[0] * x + ay[1] * y + ay[2] - lm2[i][1]) ** 2;
        }
        // l'affine non deve "schiacciare" troppo: penalizza scale molto diverse sui due assi
        const sx = Math.hypot(ax[0], ay[0]);
        const sy = Math.hypot(ax[1], ay[1]);
        err *= 1 + 2 * Math.abs(Math.log(sx / sy));
        if (err < best.err) best = { err, q: q.clone(), ax, ay };
      }
    }
  }
  return best;
}

/**
 * Patch dello shader: rim light di Fresnel + fusione dei pixel proiettati dell'illustrazione
 * (attributi projUv/projW). Una quota del colore proiettato è "unlit" così non si slava con luci colorate.
 */
function addRim(mat: MeshPhysicalMaterial, color: Color, strength: number, power: number, proj?: { map: Texture; unlit: number }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: color };
    shader.uniforms.rimStrength = { value: strength };
    if (proj) {
      shader.uniforms.projMap = { value: proj.map };
      shader.uniforms.projUnlit = { value: proj.unlit };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 projUv;\nattribute float projW;\nvarying vec2 vProjUv;\nvarying float vProjW;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvProjUv = projUv;\nvProjW = projW;");
    }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\n" +
          (proj ? "uniform sampler2D projMap;\nuniform float projUnlit;\nvarying vec2 vProjUv;\nvarying float vProjW;\n" : ""),
      )
      .replace(
        "#include <color_fragment>",
        proj
          ? `#include <color_fragment>
        vec4 projTex = texture2D(projMap, vProjUv);
        float projK = clamp(vProjW, 0.0, 1.0) * projTex.a;
        diffuseColor.rgb = mix(diffuseColor.rgb, projTex.rgb, projK);`
          : "#include <color_fragment>",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          float rimNV = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float rimF = pow(1.0 - rimNV, ${power.toFixed(2)});
          totalEmissiveRadiance += rimColor * rimStrength * rimF * (0.45 + 0.55 * diffuseColor.rgb);
          ${proj ? "totalEmissiveRadiance += projTex.rgb * projK * projUnlit;" : ""}
        }`,
      );
  };
  mat.customProgramCacheKey = () => `regina-rim-${power.toFixed(2)}-${strength.toFixed(2)}-${proj ? "p" : "n"}`;
}

function pw(k: [number, number][], y: number): number {
  if (y <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (y <= k[i][0]) {
      const t = (y - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      const s = t * t * (3 - 2 * t);
      return lerp(k[i - 1][1], k[i][1], s);
    }
  }
  return k[k.length - 1][1];
}

/** Piccola palma dorata piatta (logo sul gilet, ciondolo). */
function addPalmLogo(acc: MeshAccumulator, center: Vector3, normal: Vector3, size: number, bone: number) {
  const up = v3(0, 1, 0);
  const x = new Vector3().crossVectors(up, normal).normalize();
  const y = new Vector3().crossVectors(normal, x).normalize();
  const P = (a: number, b: number) => center.clone().addScaledVector(x, a * size).addScaledVector(y, b * size);
  const flat = { hint: () => normal.clone(), flat: 0.25 };
  acc.add(taperedTube([P(0.05, -0.5), P(0.0, -0.1), P(-0.05, 0.25)], { segments: 8, radial: 5, radius: (t) => lerp(0.07, 0.045, t) * size, ...flat }), { bone });
  const leaves: [number, number][] = [
    [-0.55, 0.05],
    [-0.42, 0.32],
    [0.0, 0.48],
    [0.42, 0.34],
    [0.55, 0.06],
  ];
  for (const [lx, ly] of leaves) {
    acc.add(
      taperedTube([P(-0.05, 0.25), P((-0.05 + lx) * 0.55, 0.25 + (ly - 0.25) * 0.55 + 0.08), P(lx, ly)], {
        segments: 8,
        radial: 5,
        radius: (t) => Math.sin(Math.max(0.05, t) * Math.PI) * 0.09 * size + 0.004 * size,
        ...flat,
      }),
      { bone },
    );
  }
}

interface HandOpts {
  curl: number;
  spread: number;
  thumbSide: 1 | -1;
  palmUp: boolean;
  bone: number;
  color: ColorFn;
}

/** Mano aperta: frame H con origine al polso, dita lungo +Z, palmo verso +Y (se palmUp). */
function addHand(acc: MeshAccumulator, H: Matrix4, o: HandOpts) {
  const tp = (x: number, y: number, z: number) => v3(x, y, z).applyMatrix4(H);
  // palmo
  const palm = new SphereGeometry(1, 16, 12);
  acc.add(palm, { matrix: H.clone().multiply(new Matrix4().compose(v3(0, 0, 0.048), new Quaternion(), v3(0.043, 0.018, 0.052))), colorFn: o.color, bone: o.bone });
  // polso
  acc.add(taperedTube([tp(0, -0.004, -0.03), tp(0, 0, 0.01)], { segments: 3, radial: 12, radius: () => 0.03, flat: 0.7 }), { colorFn: o.color, bone: o.bone });
  const fingers = [
    { x: 0.03, len: 0.068 },
    { x: 0.011, len: 0.076 },
    { x: -0.009, len: 0.072 },
    { x: -0.027, len: 0.058 },
  ];
  const up = o.palmUp ? 1 : -1;
  fingers.forEach((f, i) => {
    const fx = f.x * -o.thumbSide;
    const spreadA = (i - 1.5) * o.spread * 0.5 * -o.thumbSide;
    const pts: Vector3[] = [];
    let px = fx;
    let py = 0;
    let pz = 0.092;
    let ang = 0;
    pts.push(tp(px, py, pz - 0.01));
    const seg = f.len / 3;
    for (let k = 0; k < 3; k++) {
      ang += o.curl;
      px += Math.sin(spreadA) * seg;
      pz += Math.cos(ang) * seg * Math.cos(spreadA);
      py += Math.sin(ang) * seg * up;
      pts.push(tp(px, py, pz));
    }
    acc.add(taperedTube(pts, { segments: 10, radial: 8, radius: capsuleRadius(0.0098, 0.12, 0.0082), flat: 0.85 }), { colorFn: o.color, bone: o.bone });
  });
  // pollice
  const ts = o.thumbSide;
  acc.add(
    taperedTube([tp(ts * 0.03, 0.002, 0.03), tp(ts * 0.055, 0.006 * up, 0.06), tp(ts * 0.07, 0.012 * up, 0.085), tp(ts * 0.075, 0.018 * up, 0.105)], {
      segments: 10,
      radial: 8,
      radius: capsuleRadius(0.012, 0.12, 0.009),
    }),
    { colorFn: o.color, bone: o.bone },
  );
}

/** Pugno attorno a un manico lungo +Y locale (origine al centro della presa). */
/**
 * Pugno chiuso attorno al manico del microfono.
 * Frame H: origine sull'asse del manico, +Y verso la testa del microfono,
 * +Z verso il davanti (dita visibili), +X lato delle nocche/dorso.
 */
function addFist(acc: MeshAccumulator, H: Matrix4, o: { bone: number; color: ColorFn }) {
  const tp = (x: number, y: number, z: number) => v3(x, y, z).applyMatrix4(H);
  // palmo + dorso: massa dietro/di lato al manico (verso il polso)
  acc.add(new SphereGeometry(1, 16, 12), {
    matrix: H.clone().multiply(new Matrix4().compose(v3(0.012, -0.006, -0.02), new Quaternion(), v3(0.036, 0.05, 0.03))),
    colorFn: o.color,
    bone: o.bone,
  });
  // nocche (dorso) sul lato +X
  acc.add(taperedTube([tp(0.03, 0.03, 0.004), tp(0.034, 0.0, 0.006), tp(0.03, -0.03, 0.002)], { segments: 8, radial: 8, radius: capsuleRadius(0.013, 0.15) }), {
    colorFn: o.color,
    bone: o.bone,
  });
  // quattro dita che avvolgono il davanti del manico (raggio interno > raggio del manico)
  for (let i = 0; i < 4; i++) {
    const y = 0.027 - i * 0.0185;
    const R = 0.032;
    const pts: Vector3[] = [];
    for (let k = 0; k <= 7; k++) {
      const ang = lerp(1.45, -1.75, k / 7); // dalle nocche (+X) attorno al davanti fino al lato -X
      pts.push(tp(Math.sin(ang) * R, y - (i === 3 ? 0.002 : 0), Math.cos(ang) * R));
    }
    acc.add(taperedTube(pts, { segments: 12, radial: 8, radius: capsuleRadius(i === 3 ? 0.0095 : 0.011, 0.1, 0.0095) }), { colorFn: o.color, bone: o.bone });
  }
  // pollice: parte dal palmo e si appoggia sopra l'indice, davanti
  acc.add(
    taperedTube([tp(-0.012, -0.006, -0.03), tp(-0.03, 0.02, -0.006), tp(-0.02, 0.04, 0.02), tp(0.004, 0.044, 0.03)], {
      segments: 10,
      radial: 8,
      radius: capsuleRadius(0.0125, 0.12, 0.0105),
    }),
    { colorFn: o.color, bone: o.bone },
  );
}

/* ------------------------------------------------------------------ */
/*  Capelli                                                            */
/* ------------------------------------------------------------------ */

function buildHair(
  hair: MeshAccumulator,
  Q: (hi: number, lo: number) => number,
  surfDir: (dir: Vector3, off?: number, out?: Vector3) => Vector3,
) {
  const r = rng(2026);
  // ogni ciocca prende una tessera di capelli dipinti dall'illustrazione (atlante 4x1)
  const rT = rng(77);
  const strandTiles = () => hairTile([0, 1, 3][Math.floor(rT() * 3) % 3], 1, 0.8 + rT() * 0.5, 0.72, rT());
  hair.setProjFactory(strandTiles);
  const hint = (p: Vector3, out: Vector3) => out.subVectors(p, HC).normalize();
  const radialHint = (p: Vector3, out: Vector3) => out.set(p.x - HC.x, 0, p.z - HC.z + 0.04).normalize();
  /** direzione dal centro testa con azimut a (0 = davanti, + = sinistra/+X) e componente verticale e */
  const dirAE = (a: number, e: number) => {
    const ee = Math.max(-0.99, Math.min(0.995, e));
    const h = Math.sqrt(1 - ee * ee);
    return v3(Math.sin(a) * h, ee, Math.cos(a) * h);
  };
  /** attaccatura: componente verticale del bordo della calotta in funzione dell'azimut */
  const hairline = (a: number) => {
    const c = Math.cos(a);
    return c > 0 ? -0.08 + 0.72 * Math.pow(c, 1.3) : -0.08 + 0.75 * c;
  };

  // 3 toni di castano + colpo di luce "anisotropo" dipinto lungo la ciocca
  const PAL = [
    { base: new Color("#4a2414"), hi: new Color("#a1602f") },
    { base: new Color("#5a2e1a"), hi: new Color("#b46d38") },
    { base: new Color("#3d1d10"), hi: new Color("#8a4a2a") },
  ];
  const ROOT = new Color("#22100a");
  const pickPal = () => PAL[Math.floor(r() * PAL.length) % PAL.length];
  /** colore ciocca: radice scura, banda lucida a quota `band`, lato esterno più chiaro (finta AO tra ciocche) */
  const strandCol = (pal: { base: Color; hi: Color }, band: number, gain = 0.6, darkRoot = true): ColorFn => (_p, _n, out, v, u) => {
    const face = 0.5 + 0.5 * Math.sin(u * Math.PI * 2);
    out.copy(ROOT).lerp(pal.base, darkRoot ? smooth(0, 0.16, v) : 0.85 + 0.15 * smooth(0, 0.2, v));
    const b = Math.exp(-(((v - band) / 0.07) ** 2)) + 0.45 * Math.exp(-(((v - band - 0.32) / 0.06) ** 2));
    out.lerp(pal.hi, Math.min(1, gain * b * (0.35 + 0.65 * face)));
    out.multiplyScalar(0.7 + 0.3 * face);
  };

  /* calotta: griglia che parte esattamente dall'attaccatura (bordo liscio, niente denti) */
  {
    const cols = Q(64, 36);
    const rows = Q(16, 9);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const o = new Vector3();
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      for (let i = 0; i <= cols; i++) {
        const a = -Math.PI + (2 * Math.PI * i) / cols;
        const e = lerp(hairline(a), 1, Math.pow(v, 0.85));
        const d = dirAE(a, e);
        headShape(d, o);
        // il bordo rientra appena nella pelle, poi la calotta prende spessore
        o.multiplyScalar(lerp(0.996, 1.045, smooth(0, 0.14, v)) + 0.03 * Math.max(0, e));
        pos.push(o.x + HC.x, o.y + HC.y, o.z + HC.z);
        uv.push(i / cols, v);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        const b = a + cols + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", fattr(pos, 3));
    g.setAttribute("uv", fattr(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    hair.add(g, {
      colorFn: (_p, _n, out, v, u) => {
        const streak = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 38 + Math.sin(v * 5) * 2);
        out.copy(ROOT).lerp(PAL[0].base, smooth(0, 0.12, v)).lerp(PAL[1].base, 0.55 * streak);
        out.lerp(PAL[1].hi, 0.45 * Math.exp(-(((v - 0.42) / 0.12) ** 2)) * streak);
      },
      proj: hairTile(1, 12, 1, 0.82),
      bone: B.head,
    });
  }

  /** punto sulla superficie della testa con la stessa parametrizzazione (azimut, elevazione) della calotta */
  const capPt = (a: number, e: number, off: number) => {
    const o = headShape(dirAE(a, e), new Vector3());
    const len = o.length();
    return o.multiplyScalar((len + off) / len).add(HC);
  };
  const BUN = hc(-0.06, 0.275, -0.055);
  const upAt = (p: Vector3) => hint(p, new Vector3());

  /* ciocche raccolte verso lo chignon (davanti e dietro), a ciuffi di 2 */
  const sweptClump = (a: number, e0: number, back: boolean) => {
    // davanti la radice nasce sulla calotta (stessa mappatura headShape), schiacciata e aderente:
    // nessun bordo tagliato né punte "a dente" sulla fronte
    const p0 = back ? surfDir(dirAE(a, e0), -0.003) : capPt(a, e0, 0.004);
    const p1 = surfDir(dirAE(a * (back ? 1 : 0.92), lerp(e0, 1, 0.38)), 0.024 + r() * 0.008);
    const aTop = back ? Math.PI + (a - Math.PI) * 0.6 : a * 0.6 - 0.25;
    const p2 = surfDir(dirAE(aTop, lerp(e0, 1, 0.72)), 0.036 + r() * 0.01);
    const p3 = BUN.clone().add(v3((r() - 0.5) * 0.06, -0.035, (back ? -0.04 : 0.04) + (r() - 0.5) * 0.03));
    const flow = p2.clone().sub(p0).normalize();
    const pal = pickPal();
    for (let k = 0; k < 2; k++) {
      const sOff = (k - 0.5) * 0.024 + (r() - 0.5) * 0.006;
      const side = new Vector3().crossVectors(flow, upAt(p1)).normalize();
      const pts = [p0, p1, p2].map((p, idx) => p.clone().addScaledVector(side, sOff * (1 - idx * 0.25)).addScaledVector(upAt(p), k * 0.004));
      pts.push(p3.clone().addScaledVector(side, sOff * 0.3));
      hair.add(
        taperedTube(pts, {
          segments: Q(10, 7),
          radial: 6,
          // nasce sottile dalla calotta e si gonfia: nessun taglio netto sulla fronte
          // radice larga ma sottilissima (aderente alla calotta), poi la ciocca prende volume
          radius: (t: number) => (0.023 + k * 0.003) * (0.75 + 0.25 * smooth(0, 0.3, t)) * (1 - 0.3 * t),
          flat: back ? 0.6 : (t: number) => lerp(0.08, 0.6, smooth(0, 0.45, t)),
          hint,
        }),
        { colorFn: strandCol(pal, 0.45, 0.55, false), bone: B.head },
      );
    }
  };
  const nFront = Q(13, 7);
  for (let i = 0; i < nFront; i++) {
    const a = lerp(-1.35, 1.35, i / (nFront - 1)) + (r() - 0.5) * 0.06;
    sweptClump(a, hairline(a) + 0.07, false);
  }
  const nBackS = Q(9, 5);
  for (let i = 0; i < nBackS; i++) {
    const a = Math.PI + lerp(-1.4, 1.4, i / (nBackS - 1)) + (r() - 0.5) * 0.08;
    sweptClump(a, -0.02 + r() * 0.1, true);
  }

  /* sottostrati: massa continua dietro testa/schiena e ai lati (niente buchi) */
  {
    const at = (arr: number[], t: number) => {
      const f = t * (arr.length - 1);
      const i = Math.min(arr.length - 2, Math.floor(f));
      return lerp(arr[i], arr[i + 1], f - i);
    };
    const pts = [hc(0, 0.03, -0.07), v3(0, 1.13, -0.13), v3(0, 0.9, -0.19), v3(0, 0.68, -0.21), v3(0, 0.5, -0.19)];
    const wid = [0.2, 0.28, 0.32, 0.3, 0.22];
    const dep = [0.85, 0.5, 0.34, 0.3, 0.26];
    const under = PAL[2];
    hair.add(
      taperedTube(pts, {
        segments: Q(20, 12),
        radial: Q(18, 12),
        radius: (t) => at(wid, t) * (t > 0.78 ? Math.sqrt(Math.max(0.02, 1 - ((t - 0.78) / 0.22) ** 2)) : 1),
        flat: (t) => at(dep, t),
        hint: () => v3(0, 0, -1),
      }),
      { colorFn: (_p, _n, out, v) => out.copy(ROOT).lerp(under.base, 0.6 + 0.3 * v), weightFn: hairWeight, proj: hairTile(2, 5, 1.5, 0.25) },
    );
    for (const sx of [-1, 1]) {
      const sp = [hc(sx * 0.15, 0.02, -0.04), hc(sx * 0.27, -0.12, -0.07), v3(sx * 0.34, 0.98, -0.1), v3(sx * 0.34, 0.76, -0.13), v3(sx * 0.31, sx < 0 ? 0.52 : 0.6, -0.14)];
      hair.add(
        taperedTube(sp, {
          segments: Q(18, 10),
          radial: Q(12, 8),
          radius: (t) => lerp(0.07, 0.1, Math.sin(t * Math.PI)) * (t > 0.85 ? Math.sqrt(Math.max(0.02, 1 - ((t - 0.85) / 0.15) ** 2)) : 1),
          flat: 0.55,
          hint: radialHint,
        }),
        { colorFn: (_p, _n, out, v) => out.copy(ROOT).lerp(under.base, 0.55 + 0.3 * v), weightFn: hairWeight, proj: hairTile(2, 3, 1.5, 0.25) },
      );
    }
  }

  /* ciocche lunghe ondulate a ciuffi: si gonfiano all'altezza delle guance e ricadono a cascata */
  const longStrand = (az: number, el: number, o: { bulge: number; endY: number; back: number; rad: number; wave: number; curl: number; phase: number; pal: { base: Color; hi: Color }; band: number }) => {
    const p0 = surfDir(dirAE(az, el), -0.004);
    const radial = v3(Math.sin(az), 0, Math.cos(az));
    const r0 = Math.hypot(p0.x - HC.x, p0.z - HC.z);
    const side = new Vector3().crossVectors(radial, v3(0, 1, 0)).normalize();
    const pts: Vector3[] = [p0];
    const n = 9;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const y = lerp(p0.y, o.endY, Math.pow(t, 1.1));
      const bulge = o.bulge * Math.sin(Math.min(1, t * 1.8) * Math.PI * 0.5) * (1 - 0.3 * smooth(0.6, 1, t));
      const w = o.wave * Math.sin(t * Math.PI * 3.3 + o.phase) * smooth(0.06, 0.3, t);
      let rr = r0 + 0.014 + bulge + w * 0.45;
      if (y > HC.y - 0.3) {
        const sp = surfDir(v3(radial.x, (y - HC.y) / 0.25, radial.z), 0);
        rr = Math.max(rr, Math.hypot(sp.x - HC.x, sp.z - HC.z) + 0.03);
      }
      pts.push(
        v3(HC.x + radial.x * rr, y, HC.z + radial.z * rr)
          .addScaledVector(side, w)
          .add(v3(0, 0, -o.back * Math.pow(t, 0.7))),
      );
    }
    const last = pts[pts.length - 1];
    const cs = side.clone().multiplyScalar(Math.sin(o.phase) > 0 ? 1 : -1);
    pts.push(last.clone().add(v3(0, -o.curl * 0.7, 0)).addScaledVector(cs, o.curl * 0.6));
    pts.push(last.clone().add(v3(0, -o.curl * 0.6, 0)).addScaledVector(cs, o.curl * 1.4));
    pts.push(last.clone().add(v3(0, o.curl * 0.15, 0)).addScaledVector(cs, o.curl * 1.2));
    hair.add(
      taperedTube(pts, {
        segments: Q(18, 11),
        radial: Q(6, 5),
        radius: lockRadius(o.rad * 0.8, o.rad, 0.82, 0.06),
        flat: 0.6,
        hint: radialHint,
      }),
      { colorFn: strandCol(o.pal, o.band, 0.65), weightFn: hairWeight },
    );
  };
  const clump = (az: number, el: number, base: { bulge: number; endY: number; back: number; rad: number }) => {
    const pal = pickPal();
    const phase = r() * Math.PI * 2;
    const wave = 0.04 + r() * 0.02;
    const curl = 0.03 + r() * 0.02;
    const band = 0.22 + r() * 0.08;
    for (let k = 0; k < 2; k++) {
      longStrand(az + (k - 0.5) * 0.11, el + (r() - 0.5) * 0.05, {
        bulge: base.bulge + (k - 0.5) * 0.025,
        endY: base.endY + (r() - 0.5) * 0.06,
        back: base.back,
        rad: base.rad * (0.85 + 0.25 * r()),
        wave,
        curl,
        phase: phase + k * 0.5,
        pal,
        band,
      });
    }
  };
  const nSide = Q(10, 6);
  for (const sg of [-1, 1]) {
    for (let i = 0; i < nSide; i++) {
      const t = i / (nSide - 1);
      const az = sg * (lerp(1.02, 2.65, t) + (r() - 0.5) * 0.1);
      const el = lerp(0.36, -0.02, t) + (r() - 0.5) * 0.08;
      clump(az, el, {
        bulge: lerp(0.2, 0.1, t) + r() * 0.045,
        endY: sg < 0 ? lerp(0.48, 0.3, r()) : lerp(0.64, 0.44, r()),
        back: lerp(0.24, 0.05, t),
        rad: 0.046 + r() * 0.012,
      });
    }
  }
  const nBack = Q(7, 4);
  for (let i = 0; i < nBack; i++) {
    const az = Math.PI + lerp(-0.6, 0.6, i / (nBack - 1)) + (r() - 0.5) * 0.08;
    clump(az, -0.12 + r() * 0.1, { bulge: 0.05 + r() * 0.03, endY: lerp(0.55, 0.38, r()), back: 0.03, rad: 0.042 });
  }

  /* ciocche ondulate che incorniciano il viso (dalla riga verso tempie e spalle) */
  const frame = (sx: number, k: number) => {
    const pal = pickPal();
    const p0 = surfDir(v3(sx * 0.12, 0.82, 0.55), -0.008);
    const p1 = surfDir(v3(sx * 0.72, 0.58, 0.58), 0.034 + k * 0.012);
    const p2 = surfDir(v3(sx * 1, 0.12, 0.42), 0.05 + k * 0.014);
    const p3 = surfDir(v3(sx * 1, -0.32, 0.26), 0.07 + k * 0.014);
    const ph = r() * Math.PI;
    const pts = [p0, p1, p2, p3];
    let last = p3;
    for (let j = 1; j <= 3; j++) {
      const w = Math.sin(j * 1.6 + ph) * 0.035;
      last = last.clone().add(v3(sx * (0.025 + w), -0.13, -0.035));
      pts.push(last);
    }
    hair.add(taperedTube(pts, { segments: Q(24, 14), radial: Q(7, 5), radius: lockRadius(0.026, 0.032, 0.84, 0.005), flat: 0.68, hint }), {
      colorFn: strandCol(pal, 0.3, 0.7),
      weightFn: hairWeight,
    });
  };
  for (let k = 0; k < Q(3, 2); k++) {
    frame(-1, k);
    frame(1, k);
  }

  /* chignon alto: nucleo + spire avvolte + riccioli ad anello sciolti */
  hair.setProjFactory(() => hairTile(2, 1, 1.2 + rT() * 0.6, 0.86, rT()));
  {
    const RB = 0.105;
    hair.add(new SphereGeometry(RB * 0.92, 16, 12), { matrix: new Matrix4().compose(BUN, new Quaternion(), v3(1.1, 0.88, 1.05)), color: PAL[2].base, bone: B.bun });
    const outward = (p: Vector3, out: Vector3) => out.subVectors(p, BUN).normalize();
    const coils = Q(3, 2);
    for (let c = 0; c < coils; c++) {
      const tilt = new Quaternion().setFromEuler(new Euler((r() - 0.5) * 0.6, c * 2.1, (r() - 0.5) * 0.6));
      const pts: Vector3[] = [];
      const n = 22;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const phi = t * Math.PI * 2 * 1.5 + c * 1.3;
        const h = lerp(-0.55, 0.75, t);
        const rr = Math.sqrt(Math.max(0.05, 1 - h * h)) * RB * 1.05;
        pts.push(v3(Math.cos(phi) * rr * 1.1, h * RB * 0.9, Math.sin(phi) * rr).applyQuaternion(tilt).add(BUN));
      }
      hair.add(taperedTube(pts, { segments: Q(30, 18), radial: Q(6, 5), radius: capsuleRadius(0.036, 0.05, 0.028), flat: 0.8, hint: outward }), {
        colorFn: strandCol(pickPal(), 0.5, 0.5),
        bone: B.bun,
      });
    }
    const loops = Q(10, 5);
    for (let i = 0; i < loops; i++) {
      const yaw = (i / loops) * Math.PI * 2 + r() * 0.5;
      const d = v3(Math.cos(yaw), 0.05 + r() * 0.5, Math.sin(yaw)).normalize();
      const tg = new Vector3().crossVectors(d, v3(0, 1, 0));
      if (tg.lengthSq() < 1e-4) tg.set(1, 0, 0);
      tg.normalize().applyAxisAngle(d, (r() - 0.5) * 1.8);
      const S0 = BUN.clone().addScaledVector(d, RB * 0.82);
      const R = 0.036 + r() * 0.026;
      const pts: Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const ang = (k / 12) * Math.PI * 2 * 0.95;
        pts.push(S0.clone().addScaledVector(tg, Math.sin(ang) * R).addScaledVector(d, (1 - Math.cos(ang)) * R * 0.9));
      }
      hair.add(taperedTube(pts, { segments: Q(16, 10), radial: Q(6, 5), radius: capsuleRadius(0.02 + r() * 0.008, 0.1, 0.016), flat: 0.92 }), {
        colorFn: strandCol(pickPal(), 0.5, 0.6),
        bone: B.bun,
      });
    }
    for (let i = 0; i < Q(4, 2); i++) {
      const dir = v3(-0.6 + r() * 0.5, 0.2 + r() * 0.6, -0.5 + r() * 0.9).normalize();
      const p0 = BUN.clone().addScaledVector(dir, RB * 0.9);
      const side = new Vector3().crossVectors(dir, v3(0, 1, 0)).normalize();
      const up = new Vector3().crossVectors(side, dir).normalize();
      const pts: Vector3[] = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const ang = t * Math.PI * 2.2;
        const rad = 0.035 * (1 - 0.4 * t);
        pts.push(p0.clone().addScaledVector(dir, 0.05 * t).addScaledVector(side, Math.sin(ang) * rad).addScaledVector(up, (Math.cos(ang) - 1) * rad));
      }
      hair.add(taperedTube(pts, { segments: 16, radial: 5, radius: lockRadius(0.014, 0.012, 0.8, 0.1), flat: 0.85 }), { colorFn: strandCol(PAL[1], 0.4, 0.6), bone: B.bun });
    }
  }

  hair.setProjFactory(strandTiles);
  /* ricciolini sciolti vicino al viso */
  const wisps: [number, number, number][] = [
    [0.95, 0.55, 0.25],
    [-0.95, 0.4, 0.3],
    [0.6, 0.9, 0.45],
    [-0.5, 0.85, 0.45],
  ];
  for (const [x, y, z] of wisps.slice(0, Q(4, 2))) {
    const p0 = surfDir(v3(x, y, z), 0.02);
    const sx = Math.sign(x);
    const pts = [p0];
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      pts.push(p0.clone().add(v3(sx * (0.03 + Math.sin(t * Math.PI * 2.2) * 0.025), -0.2 * t, 0.025 * Math.cos(t * Math.PI * 2.2))));
    }
    hair.add(taperedTube(pts, { segments: 16, radial: 5, radius: lockRadius(0.007, 0.008, 0.75, 0.1), flat: 0.85 }), { colorFn: strandCol(PAL[1], 0.4, 0.6), weightFn: hairWeight });
  }
  hair.setProjFactory(null);
}

export type { SkinSample };
