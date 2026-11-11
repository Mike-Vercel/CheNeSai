/**
 * Costruzione procedurale del Professore (img2threejs, profilo character).
 * Ogni parte è scritta nello spazio del suo osso e poi fusa per materiale.
 * Parti inventate (non visibili nel riferimento): nuca/capelli dietro,
 * cinghie sulla schiena (incrociate), lato sinistro del viso (specchiato).
 */
import {
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import { P } from "./palette";
import { SkinKit, partMatrix, type ColorFn, type WeightFn } from "./kit";
import {
  A,
  B,
  TORSO_SQUASH,
  EYE_DIR,
  EYE_R,
  FINGERS,
  FORE_LEN,
  HEAD_C,
  HEAD_R,
  JAW_PIVOT,
  MIC_GRIP,
  MIC_TILT,
  THUMB_DIR,
  THUMB_LEN1,
  THUMB_LEN2,
  UPPER_LEN,
  armBase,
  boneDefs,
  type Side,
} from "./layout";
import { LABEL, fitViewCamera, type Landmark, type ProjCam } from "./projection";
import { curve, ellipsoid, paramSurface, radialShell, ribbon, rng, smoothTable, smoothstep, sphereDir, taperTube } from "./shapes";

export type MatKey = "skin" | "hair" | "cloth" | "leather" | "metal" | "gloss" | "grille";

export interface BuiltBody {
  geometries: Map<MatKey, BufferGeometry>;
  /** camere di proiezione risolte (testa, busto) */
  cams: { head: ProjCam; torso: ProjCam };
  kit: SkinKit<MatKey>;
  triangles: number;
  /** bacino della bocca in spazio testa, per debug */
  mouth: Vector3;
}

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
const hc = v3(...HEAD_C);

// ----------------------------------------------------------------- testa
function gauss(d: Vector3, c: Vector3, s2: number): number {
  return Math.exp(-d.distanceToSquared(c) / s2);
}
const CHEEK_L = v3(0.5, -0.06, 0.86).normalize();
const CHEEK_R = v3(-0.5, -0.06, 0.86).normalize();
const EYE_L_DIR = v3(EYE_DIR[0], EYE_DIR[1], EYE_DIR[2]).normalize();
const EYE_R_DIR = v3(-EYE_DIR[0], EYE_DIR[1], EYE_DIR[2]).normalize();
const BROW_DIR = v3(0, 0.45, 0.9).normalize();

/** raggio della pelle del cranio lungo la direzione d (dal centro hc) */
export function headRadius(d: Vector3): number {
  const [rx, ry, rz] = HEAD_R;
  // mandibola più larga in basso (viso "a pera" da cartone)
  const jawWide = 1 + 0.12 * smoothstep(0.1, -0.7, d.y) * (1 - Math.abs(d.z) * 0.3);
  const base = 1 / Math.sqrt((d.x / (rx * jawWide)) ** 2 + (d.y / ry) ** 2 + (d.z / rz) ** 2);
  let r = base;
  // guance a mela, alte sotto gli occhi
  r += 0.034 * (gauss(d, CHEEK_L, 0.045) + gauss(d, CHEEK_R, 0.045));
  r += 0.008 * gauss(d, BROW_DIR, 0.05);
  r -= 0.014 * (gauss(d, EYE_L_DIR, 0.02) + gauss(d, EYE_R_DIR, 0.02));
  return r;
}

const MOUTH_DIR = v3(0, -0.5, 0.87).normalize();

function hairThreshold(front: number): number {
  return smoothTable([-1, -0.5, -0.15, 0.1, 0.4, 0.7, 1], [-0.62, -0.45, 0.12, 0.28, 0.5, 0.72, 0.78], front);
}

function makeHairBumps(seed: number, count: number) {
  const r = rng(seed);
  const out: { c: Vector3; a: number; s2: number }[] = [];
  const d = new Vector3();
  let guard = 0;
  while (out.length < count && guard++ < 2000) {
    sphereDir(r(), 0.25 + r() * 0.75, d);
    if (d.y < hairThreshold(d.z) + 0.08) continue;
    out.push({ c: d.clone(), a: 0.01 + r() * 0.016, s2: 0.01 + r() * 0.014 });
  }
  return out;
}
const HAIR_BUMPS = makeHairBumps(7, 40);
const QUIFF = v3(-0.22, 0.85, 0.48).normalize();
const QUIFF2 = v3(0.25, 0.8, 0.45).normalize();
const SIDE_R = v3(-0.85, 0.42, -0.1).normalize();
const SIDE_L = v3(0.85, 0.42, -0.1).normalize();

function hairThickness(d: Vector3): number {
  const thr = hairThreshold(d.z);
  const m = smoothstep(thr - 0.02, thr + 0.07, d.y);
  if (m <= 0) return -0.014;
  let t = 0.025 + 0.035 * Math.max(0, d.y) + 0.05 * Math.abs(d.x) * (1 - Math.abs(d.y)) * smoothstep(-0.2, 0.3, d.y);
  t += 0.04 * gauss(d, QUIFF, 0.12) + 0.02 * gauss(d, QUIFF2, 0.12);
  // sbuffi laterali, più volume sul lato destro (immagine a sinistra)
  t += 0.04 * gauss(d, SIDE_R, 0.12) + 0.028 * gauss(d, SIDE_L, 0.1);
  for (const b of HAIR_BUMPS) t += b.a * gauss(d, b.c, b.s2);
  return -0.014 + (t + 0.014) * m;
}

function beardThickness(d: Vector3): number {
  const ax = Math.abs(d.x);
  // linea della barba: bassa sulle guance (le guance restano pelle), sale ai basettoni
  const top = smoothTable([0, 0.25, 0.5, 0.72, 0.88, 1], [-0.42, -0.42, -0.4, -0.22, 0.02, 0.12], ax);
  const back = smoothTable([-1, -0.7, -0.4, 0], [-0.55, -0.45, 0.1, 0.18], d.y);
  let m = smoothstep(top + 0.03, top - 0.03, d.y) * smoothstep(back - 0.06, back + 0.1, d.z);
  // taglio della bocca (grande, a "D")
  const ex = d.x / 0.5;
  const dy = d.y - MOUTH_DIR.y;
  const ey = dy / (dy > 0 ? 0.12 : 0.24);
  const hole = smoothstep(1.0, 0.8, ex * ex + ey * ey) * smoothstep(0.3, 0.5, d.z);
  m *= 1 - hole;
  if (m <= 0) return -0.012;
  // corta e curata: più piena solo sul mento
  let t = 0.013 + 0.026 * smoothstep(-0.55, -0.95, d.y) * smoothstep(-0.2, 0.5, d.z);
  t += 0.006 * smoothstep(0.5, 0.9, ax) * smoothstep(0.1, -0.5, d.y);
  t += 0.003 * Math.sin(Math.atan2(d.x, d.z) * 46) * smoothstep(0.0, -0.6, d.y);
  return -0.012 + (t + 0.012) * m;
}

// ----------------------------------------------------------------- busto
const TY = [-0.08, 0.1, 0.3, 0.5, 0.66, 0.78, 0.86, 0.915, 0.95];
const TRX = [0.31, 0.335, 0.365, 0.385, 0.405, 0.41, 0.375, 0.26, 0.12];
const TRZ = [0.25, 0.27, 0.29, 0.275, 0.265, 0.24, 0.205, 0.16, 0.11];
const TZO = [0.0, 0.012, 0.03, 0.03, 0.028, 0.012, -0.004, -0.004, 0.0];
const SUPER = 2.5;

/** punto della superficie del busto: theta=0 davanti, crescente verso +X */
export function torsoPoint(theta: number, y: number, off: number, out: Vector3): Vector3 {
  const yy = Math.min(TY[TY.length - 1], Math.max(TY[0], y));
  const rx = smoothTable(TY, TRX, yy) + off;
  const rz = smoothTable(TY, TRZ, yy) + off;
  const zo = smoothTable(TY, TZO, yy);
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const e = 2 / SUPER;
  return out.set(rx * Math.sign(s) * Math.abs(s) ** e, y, rz * Math.sign(c) * Math.abs(c) ** e + zo);
}

// grembiule: altezza del bordo della pettorina e mezza ampiezza (angolo) alle varie altezze
const BIB_TOP = 0.71;
const apronTheta = (y: number) => smoothTable([-0.08, 0.28, 0.4, 0.52, 0.62, BIB_TOP], [1.95, 1.85, 1.35, 0.9, 0.68, 0.6], y);

/**
 * Spessore degli strati sopra la camicia (coordinate di progetto, theta=0 davanti):
 * le braccia possono stare vicine ai fianchi dove c'è solo la camicia e restano
 * più lontane da grembiule, cinghie, cintura e asciugamano.
 */
function layerThickness(theta: number, y: number): number {
  const a = Math.abs(theta);
  let t = 0.008; // camicia
  if (y < BIB_TOP + 0.01 && a < apronTheta(Math.min(y, BIB_TOP)) + 0.05) t = 0.026; // grembiule
  if (y > 0.66 && a > 0.4 && a < 0.85) t = 0.048; // cinghie e fibbie davanti
  if (y > 0.86) t = Math.max(t, 0.045); // cinghie sulle spalle
  if (y > 0.06 && y < 0.18) t = Math.max(t, 0.042); // cintura
  if (theta > -1.02 && theta < -0.28 && y < 0.22) t = Math.max(t, 0.1); // asciugamano
  return t;
}

/**
 * Distanza orizzontale (approssimata, con segno: >0 fuori) di un punto dal
 * guscio del busto (camicia + strati sopra) gonfiato di `off`, in coordinate di progetto (y non
 * schiacciata). È lo stesso profilo di torsoPoint, quindi la stessa pancia.
 * In `n` (se dato) scrive la normale orizzontale verso l'esterno.
 * Nessuna allocazione: usata a ogni frame dall'IK delle braccia.
 */
export function torsoClearance(x: number, y: number, z: number, off: number, n?: Vector3): number {
  const top = TY[TY.length - 1];
  const yy = Math.min(top, Math.max(TY[0], y));
  const zo = smoothTable(TY, TZO, yy);
  const dz = z - zo;
  // spessore di quello che sta sopra la camicia in quel punto (grembiule, cinghie, cintura, asciugamano)
  const sh = off + layerThickness(Math.atan2(x, dz), y);
  const rx = smoothTable(TY, TRX, yy) + sh;
  const rz = smoothTable(TY, TRZ, yy) + sh;
  const ax = Math.abs(x) / rx;
  const az = Math.abs(dz) / rz;
  const len = Math.hypot(x, dz);
  if (n) {
    // gradiente della superellisse: normale vera, non radiale
    const gx = Math.sign(x) * ax ** (SUPER - 1) / rx;
    const gz = Math.sign(dz) * az ** (SUPER - 1) / rz;
    const gl = Math.hypot(gx, gz);
    if (gl > 1e-9) n.set(gx / gl, 0, gz / gl);
    else n.set(0, 0, 1);
  }
  if (len < 1e-6) return -Math.min(rx, rz);
  const r = (ax ** SUPER + az ** SUPER) ** (1 / SUPER);
  let d = len * (1 - 1 / r);
  // sopra la spalla / sotto il fondo il busto finisce
  if (d < 0 && y > top) d = Math.max(d, y - top);
  if (d < 0 && y < TY[0]) d = Math.max(d, TY[0] - y);
  return d;
}

const torsoWeights: WeightFn = (p) => {
  if (p.y < 0.4) return [B.pelvis, B.spine, smoothstep(0.12, 0.36, p.y)];
  return [B.spine, B.chest, smoothstep(0.42, 0.66, p.y)];
};

// ----------------------------------------------------------------- colori
const col = (h: string) => new Color(h);
const C = {
  skin: col(P.skin),
  blush: col(P.blush),
  nose: col(P.nose),
  lip: col(P.lip),
  hair: col(P.hair),
  hairHi: col(P.hairHi),
  hairDark: col(P.hairDark),
  hairMid: col(P.hairMid),
  beard: col(P.beard),
  beardHi: col(P.beardHi),
  irisHi: col(P.irisHi),
  noseHi: col(P.noseHi),
  shirt: col(P.shirt),
  shirtShade: col(P.shirtShade),
  denim: col(P.denim),
  denimHi: col(P.denimHi),
  stitch: col(P.stitch),
  leather: col(P.leather),
  leatherDark: col(P.leatherDark),
  brass: col(P.brass),
  silver: col(P.silver),
  bowtie: col(P.bowtie),
  white: col(P.eyeWhite),
  iris: col(P.iris),
  pupil: col(P.pupil),
  teeth: col(P.teeth),
  mouth: col(P.mouth),
  tongue: col(P.tongue),
  micBlack: col(P.micBlack),
  towel: col(P.towel),
  towelRed: col(P.towelRed),
  button: col(P.button),
};

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// ----------------------------------------------------------------- build
export function buildBody(lowPower: boolean): BuiltBody {
  const q = lowPower ? 0.6 : 1;
  const seg = (n: number) => Math.max(6, Math.round(n * q));

  // posizioni occhi (spazio testa)
  const eyeC = (dir: Vector3) => dir.clone().multiplyScalar(headRadius(dir) - 0.02).add(hc);
  const eyeL = eyeC(EYE_L_DIR);
  const eyeR = eyeC(EYE_R_DIR);
  const kit = new SkinKit<MatKey>(boneDefs(eyeL.toArray() as [number, number, number], eyeR.toArray() as [number, number, number]), {
    s: TORSO_SQUASH,
    bones: [B.root, B.pelvis, B.spine, B.chest],
  });
  const headPos = kit.rest[B.head];

  // ---------------- pesi mandibola
  const mouthLocal = MOUTH_DIR.clone().multiplyScalar(headRadius(MOUTH_DIR) + 0.004).add(hc);
  const jawWeights: WeightFn = (p) => {
    const ly = p.y - headPos.y;
    const lz = p.z - headPos.z;
    const w = smoothstep(mouthLocal.y + 0.012, mouthLocal.y - 0.025, ly) * smoothstep(-0.1, 0.05, lz);
    return [B.head, B.jaw, w];
  };

  // ---------------- colori funzione
  const skinColor: ColorFn = (p, _n, out) => {
    out.copy(C.skin);
    const l = v3(p.x - headPos.x - hc.x, p.y - headPos.y - hc.y, p.z - headPos.z - hc.z).normalize();
    const b = gauss(l, CHEEK_L, 0.03) + gauss(l, CHEEK_R, 0.03);
    out.lerp(C.blush, Math.min(0.85, b * 0.9));
  };

  // ================================================================ CAMERE DI PROIEZIONE (riferimento 1254×1254)
  // punti di riferimento letti sull'illustrazione (pixel) ↔ stessi punti sul modello a riposo
  const H = (x: number, y: number, z: number) => v3(x, y, z).add(headPos);
  const chinDir = v3(0, -0.85, 0.53).normalize();
  const headMarks: Landmark[] = [
    { p: eyeL.clone().add(headPos), px: 639, py: 228, w: 2 },
    { p: eyeR.clone().add(headPos), px: 520, py: 263, w: 2 },
    { p: H(0, 0.2, 0.266), px: 621, py: 280, w: 2 },
    { p: mouthLocal.clone().add(headPos), px: 622, py: 368, w: 2 },
    { p: H(0.19, 0.215, 0.14), px: 745, py: 285 },
    { p: H(-0.19, 0.215, 0.14), px: 505, py: 323 },
    { p: H(-0.184, 0.19, -0.015), px: 410, py: 380 },
    { p: H(0.088, 0.384, 0.177), px: 630, py: 158 },
    { p: H(-0.088, 0.384, 0.177), px: 500, py: 205 },
    { p: chinDir.clone().multiplyScalar(headRadius(chinDir) + beardThickness(chinDir)).add(hc).add(headPos), px: 607, py: 505 },
  ];
  const headCam = fitViewCamera(headMarks, headPos, [-0.9, 0.3], [-0.5, 0.3]);
  const T = (th: number, y: number, off: number) => torsoPoint(th, y, off, new Vector3());
  const torsoMarks: Landmark[] = [
    { p: v3(0, 0.862, 0.219), px: 690, py: 590, w: 2 },
    { p: v3(0, 0.79, T(0, 0.79, 0.004).z), px: 727, py: 652 },
    { p: v3(0, 0.745, T(0, 0.745, 0.004).z), px: 767, py: 720 },
    { p: T(-0.58, 0.79, 0.042), px: 595, py: 670, w: 2 },
    { p: T(0.58, 0.79, 0.042), px: 890, py: 733, w: 2 },
    { p: T(-0.555, 0.7, 0.044), px: 632, py: 765 },
    { p: T(0.555, 0.7, 0.044), px: 910, py: 815 },
    { p: T(0.16, 0.506, 0.0175), px: 785, py: 895, w: 2 },
    { p: T(0.675, 0.35, 0.024), px: 892, py: 990 },
    { p: T(0, 0.1175, 0.04), px: 747, py: 1175 },
  ];
  const torsoCam = fitViewCamera(torsoMarks, v3(0, 0, 0), [-0.5, -0.2], [-0.35, 0.0]); // stessa camera della testa, riportata nel busto
  const PH_SKIN = { cam: headCam, label: LABEL.skin };
  const PH_HAIR = { cam: headCam, label: LABEL.hair, strength: 0.55, facing: [0.35, 0.75] as [number, number] };
  const PT_CLOTH = { cam: torsoCam, label: LABEL.cloth };
  const PT_LEATHER = { cam: torsoCam, label: LABEL.leather };
  const PT_APRON = { cam: torsoCam, label: LABEL.apron };

  // ================================================================ TESTA
  kit.add("skin", radialShell(hc, headRadius, seg(52), seg(40)), { bone: B.head, color: skinColor, weights: jawWeights, proj: PH_SKIN });
  // sottopelo dei capelli: guscio scuro (fa da ombra tra le ciocche), senza proiezione
  kit.add("hair", radialShell(hc, (d) => headRadius(d) + hairThickness(d), seg(68), seg(54)), {
    bone: B.head,
    color: (p, _n, out) => {
      const up = smoothstep(-0.2, 0.9, (p.y - headPos.y - hc.y) / HEAD_R[1]);
      out.copy(C.hairDark).lerp(C.hair, 0.15 + 0.3 * up);
    },
  });
  kit.add("hair", radialShell(hc, (d) => headRadius(d) + beardThickness(d), seg(68), seg(52)), {
    bone: B.head,
    proj: PH_HAIR,
    color: (p, n, out) => {
      // barba più chiara e calda con trama a ciocche verticali
      const az = Math.atan2(p.x - headPos.x, p.z - headPos.z);
      const st = 0.5 + 0.5 * Math.sin(az * 70 + p.y * 40);
      out.copy(C.beard).lerp(C.beardHi, 0.25 + 0.35 * st + Math.max(0, n.y) * 0.2);
    },
    weights: jawWeights,
  });

  // ---------------- capelli: ciocche mosse e ricci (pompadour alto, lati gonfi, punte arricciate)
  // Ogni ciocca è un nastro spesso che segue il "pettinato" sul cranio, si stacca
  // dal guscio a metà (volume) e finisce con un ricciolo a "C". Colore dalla
  // radice scura alla punta calda, bordi più scuri tra una ciocca e l'altra e
  // striature lungo la ciocca: si leggono le ciocche anche da lontano.
  const hairOut = (p: Vector3, out: Vector3) => {
    out.copy(p).sub(hc).normalize();
  };
  const TONES = [C.hair, C.hairMid, C.hair, C.hairMid, C.hairHi];
  /** pettinato: sopra indietro e un po' su (pompadour), ai lati e dietro giù e indietro */
  const flow = (d: Vector3, out: Vector3) => {
    const top = smoothstep(0.3, 0.78, d.y);
    out.set(0.32 * top - 0.12 * d.x * (1 - top), -1 + 1.12 * top, -0.5 - 0.5 * top);
    out.addScaledVector(d, -out.dot(d));
    if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
    out.normalize();
  };
  interface LockOpts {
    len: number;
    rad: number;
    lift: number;
    curl: number;
    tone: number;
    /** deviazione laterale della direzione (radianti) */
    bend: number;
  }
  const lockColor = (tone: number): ColorFn => {
    const tint = TONES[tone % TONES.length];
    return (_p, n, o, u, v) => {
      // radice scura → punta calda; ombra sui bordi (v≈0 / 0.5), luce sul dorso (v≈0.25)
      const along = smoothstep(0.0, 0.75, u);
      const back = Math.max(0, Math.sin(v * Math.PI * 2));
      const streak = 0.5 + 0.5 * Math.sin(v * Math.PI * 14 + u * 3);
      o.copy(C.hairDark).lerp(tint, 0.45 + 0.5 * along);
      o.lerp(C.hairHi, 0.18 * back * along + 0.1 * streak * back + 0.12 * Math.max(0, n.y));
      o.multiplyScalar(0.62 + 0.38 * back);
    };
  };
  const lock = (start: Vector3, o: LockOpts) => {
    const d = start.clone();
    const f = new Vector3();
    const side = new Vector3();
    const pts: [number, number, number][] = [];
    const steps = 7;
    const nd = new Vector3();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lift = 0.004 + o.lift * Math.sin(Math.PI * Math.min(1, t * 1.15));
      const pp = d.clone().multiplyScalar(headRadius(d) + Math.max(0, hairThickness(d)) * 0.7 + lift).add(hc);
      pts.push([pp.x, pp.y, pp.z]);
      flow(d, f);
      side.crossVectors(d, f);
      f.multiplyScalar(Math.cos(o.bend)).addScaledVector(side, Math.sin(o.bend));
      nd.copy(d).addScaledVector(f, o.len / steps / 0.24).normalize();
      if (nd.y < hairThreshold(nd.z) + (nd.z > 0.4 ? 0.1 : 0.03)) break;
      d.copy(nd);
    }
    if (pts.length < 3) return;
    const n = pts.length - 1;
    const last = new Vector3(...pts[n]);
    const dir = last.clone().sub(new Vector3(...pts[n - 1])).normalize();
    const out = last.clone().sub(hc).normalize();
    const sd = new Vector3().crossVectors(dir, out).normalize();
    // ricciolo: si stacca in fuori, gira e torna verso la chioma
    const k = o.curl;
    const c = (a: number, b: number, s: number) =>
      last.clone().addScaledVector(dir, k * a).addScaledVector(out, k * b).addScaledVector(sd, k * s).toArray() as [number, number, number];
    pts.push(c(0.75, 0.25, 0), c(1.05, 0.85, 0.1), c(0.6, 1.3, 0.2), c(0.05, 1.05, 0.25), c(0.1, 0.55, 0.25));
    kit.add(
      "hair",
      taperTube(
        curve(pts),
        seg(26),
        seg(10),
        (t) => o.rad * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 1.5))) * (1 - 0.62 * smoothstep(0.62, 1, t)) + 0.006,
        { capStart: true, capEnd: true, flatten: 0.6, outward: hairOut },
      ),
      { bone: B.head, color: lockColor(o.tone) },
    );
  };
  {
    const r = rng(11);
    const d = new Vector3();
    const big = lowPower ? 0.75 : 1;
    // 1) pompadour: onde dall'attaccatura pettinate indietro e verso la sinistra
    //    del personaggio (come nel riferimento), sfalsate per non fare una cresta
    const front = lowPower ? 8 : 12;
    for (let i = 0; i < front; i++) {
      const x = -0.5 + (1.0 * i) / (front - 1) + (r() - 0.5) * 0.06;
      const z = 0.72 - Math.abs(x) * 0.35;
      d.set(x, hairThreshold(z) + 0.13 + (i % 2) * 0.07 + 0.03 * r(), z).normalize();
      lock(d.clone(), {
        len: 0.36 + 0.12 * r(),
        rad: 0.054 * big + 0.008 * r(),
        lift: 0.03 - 0.012 * Math.abs(x) + 0.01 * r(),
        curl: 0.022 + 0.008 * r(),
        tone: i,
        bend: (r() - 0.5) * 0.25,
      });
    }
    // 2) corona e dietro: ciocche che scendono e finiscono in ricci sulla nuca
    const crown = lowPower ? 10 : 16;
    for (let i = 0; i < crown; i++) {
      const a = (i / crown) * Math.PI * 2 + r() * 0.3;
      const y = 0.55 + 0.25 * r();
      const rr = Math.sqrt(1 - y * y);
      d.set(Math.sin(a) * rr, y, Math.cos(a) * rr * 0.7 - 0.35);
      d.normalize();
      if (d.z > 0.35) continue;
      lock(d.clone(), { len: 0.34 + 0.08 * r(), rad: 0.054 * big + 0.01 * r(), lift: 0.03, curl: 0.045 + 0.015 * r(), tone: i + 1, bend: (r() - 0.5) * 0.4 });
    }
    // 3) lati: ciocche gonfie sopra le orecchie con le punte arricciate in fuori
    const sideN = lowPower ? 4 : 6;
    for (const s of [1, -1]) {
      for (let i = 0; i < sideN; i++) {
        const z = 0.12 - (0.62 * i) / (sideN - 1);
        const y = 0.56 + 0.1 * r();
        d.set(s * Math.sqrt(Math.max(0.05, 1 - y * y - z * z)), y, z).normalize();
        lock(d.clone(), { len: 0.26 + 0.06 * r(), rad: 0.05 * big + 0.008 * r(), lift: 0.03, curl: 0.04 + 0.012 * r(), tone: i + 2, bend: s * (0.1 + 0.1 * r()) });
      }
    }
    // 4) un ricciolo sciolto che cade sulla fronte (lato destro, come nel riferimento)
    d.set(-0.3, 0.74, 0.6).normalize();
    const base0 = d.clone().multiplyScalar(headRadius(d) + Math.max(0, hairThickness(d)) * 0.8).add(hc);
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 10; k++) {
      const a = (k / 10) * Math.PI * 1.6;
      const rr = 0.034 * (1 - 0.45 * (k / 10));
      pts.push([base0.x - 0.012 * k - Math.sin(a) * rr * 0.5, base0.y - (1 - Math.cos(a)) * rr * 0.95, base0.z + 0.01 + Math.sin(a) * rr * 0.55]);
    }
    kit.add("hair", taperTube(curve(pts), seg(24), seg(9), (t) => 0.022 * (1 - 0.7 * t) + 0.004, { capStart: true, capEnd: true, flatten: 0.7 }), {
      bone: B.head,
      color: lockColor(1),
    });
  }

  // ---------------- orecchie
  for (const s of [1, -1] as Side[]) {
    const ear = ellipsoid(0.022, 0.052, 0.042, seg(16), seg(12));
    kit.add("skin", ear, {
      bone: B.head,
      proj: PH_SKIN,
      matrix: partMatrix([0.182 * s, 0.19, -0.015], [-0.15, 0.12 * s, -0.05 * s]),
      color: P.ear,
    });
    const rim = taperTube(
      curve([
        [0.194 * s, 0.152, 0.01],
        [0.206 * s, 0.185, 0.018],
        [0.208 * s, 0.225, 0.0],
        [0.198 * s, 0.236, -0.035],
        [0.19 * s, 0.215, -0.05],
      ]),
      seg(14),
      6,
      () => 0.011,
      { capStart: true, capEnd: true },
    );
    kit.add("skin", rim, { bone: B.head, color: P.ear, proj: PH_SKIN });
  }

  // ---------------- naso (bulbo rosso)
  kit.add("skin", ellipsoid(0.06, 0.052, 0.052, seg(24), seg(18), 0, 0.2, 0.214), {
    bone: B.head,
    proj: PH_SKIN,
    color: (p, n, out) => out.copy(C.nose).lerp(C.noseHi, Math.max(0, n.y * 0.5 + n.z * 0.3) * 0.5),
  });
  for (const s of [1, -1]) {
    kit.add("skin", ellipsoid(0.024, 0.021, 0.024, seg(12), seg(10), 0.038 * s, 0.176, 0.192), { bone: B.head, color: P.nose, proj: PH_SKIN });
  }
  // ponte del naso
  kit.add("skin", ellipsoid(0.022, 0.04, 0.022, seg(12), seg(10), 0, 0.245, 0.182), { bone: B.head, color: skinColor, proj: PH_SKIN });

  // ---------------- occhi
  for (const s of [1, -1] as Side[]) {
    const c = s === 1 ? eyeL : eyeR;
    kit.add("gloss", ellipsoid(EYE_R, EYE_R, EYE_R, seg(20), seg(16), c.x, c.y, c.z), { bone: B.head, color: C.white });
    // iride + pupilla guardano un po' verso il centro (verso la camera)
    const look = v3(-0.12 * s, -0.04, 1).normalize();
    const ic = c.clone().addScaledVector(look, EYE_R * 0.58);
    kit.add("gloss", ellipsoid(EYE_R * 0.7, EYE_R * 0.72, EYE_R * 0.5, seg(24), seg(16), ic.x, ic.y, ic.z), {
      bone: B.head,
      color: (p, _n, out) => out.copy(C.iris).lerp(C.irisHi, smoothstep(0.004, 0.03, p.distanceTo(v3(ic.x, ic.y, ic.z).add(headPos)))),
    });
    const pc = c.clone().addScaledVector(look, EYE_R * 0.86);
    kit.add("gloss", ellipsoid(EYE_R * 0.36, EYE_R * 0.38, EYE_R * 0.24, seg(16), seg(10), pc.x, pc.y, pc.z), { bone: B.head, color: C.pupil });
    const hl = c.clone().add(v3(-0.32, 0.36, 0.88).normalize().multiplyScalar(EYE_R * 1.0));
    kit.add("gloss", ellipsoid(EYE_R * 0.19, EYE_R * 0.19, EYE_R * 0.09, 10, 8, hl.x, hl.y, hl.z), { bone: B.head, color: "#ffffff" });
    const hl2 = c.clone().add(v3(0.25, -0.22, 0.94).normalize().multiplyScalar(EYE_R * 1.0));
    kit.add("gloss", ellipsoid(EYE_R * 0.09, EYE_R * 0.09, EYE_R * 0.05, 8, 6, hl2.x, hl2.y, hl2.z), { bone: B.head, color: "#ffffff" });

    // palpebra superiore (emisfero) + linea delle ciglia
    const lidBone = s === 1 ? B.lidL : B.lidR;
    const lid = new SphereGeometry(EYE_R * 1.13, seg(22), seg(10), 0, Math.PI * 2, 0, Math.PI / 2);
    kit.add("skin", lid, { bone: lidBone, color: P.lid, proj: PH_SKIN });
    const lash: [number, number, number][] = [];
    for (let k = 0; k <= 8; k++) {
      const a = -1.75 + (k / 8) * 3.5;
      lash.push([Math.sin(a) * EYE_R * 1.15, -0.002, Math.cos(a) * EYE_R * 1.15]);
    }
    kit.add("hair", taperTube(curve(lash), seg(18), 6, (t) => 0.004 + 0.0035 * Math.sin(Math.PI * t), { capStart: true, capEnd: true }), {
      bone: lidBone,
      color: C.hairDark,
    });
    // palpebra inferiore
    const low = new SphereGeometry(EYE_R * 1.1, seg(22), seg(8), 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    kit.add("skin", low, { bone: s === 1 ? B.lowLidL : B.lowLidR, color: skinColor, proj: PH_SKIN });

    // sopracciglio folto
    const browBone = s === 1 ? B.browL : B.browR;
    const brow = taperTube(
      curve([
        [-0.058 * s, -0.016, 0.026],
        [-0.025 * s, 0.012, 0.02],
        [0.02 * s, 0.018, 0.004],
        [0.062 * s, -0.006, -0.026],
        [0.074 * s, -0.026, -0.04],
      ]),
      seg(20),
      8,
      (t) => 0.004 + 0.026 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.5 * (1 - 0.45 * t),
      { capStart: true, capEnd: true, flatten: 0.62 },
    );
    kit.add("hair", brow, { bone: browBone, color: C.hairDark });
  }

  // ---------------- bocca (interno scuro, denti, lingua, labbro)
  {
    const m = mouthLocal;
    const tilt = Math.atan2(-MOUTH_DIR.y, MOUTH_DIR.z); // ~0.54 rad verso il basso
    const mm = (x: number, y: number, z: number) => partMatrix([m.x + x, m.y + y, m.z + z], [tilt * 0.6, 0, 0]);
    // sacca della bocca a "D": sopra piatta, sotto tonda
    const bag = paramSurface(
      (u, v, out) => {
        const a = u * Math.PI * 2;
        const b = (v - 0.5) * Math.PI;
        const x = Math.sin(a) * Math.cos(b) * 0.112;
        let y = Math.sin(b) * 0.07;
        if (y > 0) y *= 0.3;
        const z = Math.cos(a) * Math.cos(b) * 0.008;
        out.set(x, y - 0.006, z - 0.004);
      },
      seg(28),
      seg(16),
    );
    kit.add("skin", bag, { bone: B.head, matrix: mm(0, 0, 0.0), color: C.mouth, weights: jawWeights });
    // denti superiori
    const teeth = new CylinderGeometry(0.12, 0.112, 0.038, seg(22), 1, true, -0.7, 1.4);
    kit.add("gloss", teeth, { bone: B.head, matrix: mm(0, 0.006, 0.014 - 0.12), color: C.teeth });
    // lingua
    const tongueGeo = ellipsoid(0.066, 0.022, 0.036, seg(16), seg(10));
    const jl = (x: number, y: number, z: number) =>
      partMatrix([m.x + x - JAW_PIVOT[0], m.y + y - JAW_PIVOT[1], m.z + z - JAW_PIVOT[2]], [tilt * 0.6, 0, 0]);
    kit.add("skin", tongueGeo, { bone: B.jaw, matrix: jl(0, -0.05, -0.012), color: C.tongue });
    // labbro inferiore (sorriso)
    const lipPts: [number, number, number][] = [];
    for (let k = 0; k <= 8; k++) {
      const x = -0.1 + (k / 8) * 0.2;
      const y = -0.068 + 0.05 * (x / 0.1) ** 2;
      lipPts.push([m.x + x - JAW_PIVOT[0], m.y + y - JAW_PIVOT[1], m.z + 0.012 - 0.034 * (x / 0.1) ** 2 - JAW_PIVOT[2]]);
    }
    kit.add("skin", taperTube(curve(lipPts), seg(20), 7, (t) => 0.006 + 0.01 * Math.sin(Math.PI * t), { capStart: true, capEnd: true }), {
      bone: B.jaw,
      color: C.lip,
    });
  }

  // ---------------- baffi a manubrio (osso "stache")
  {
    const so = kit.rest[B.stache].clone().sub(headPos);
    for (const s of [1, -1] as Side[]) {
      const pts: [number, number, number][] = [
        [0.004, 0.158, 0.232],
        [0.05, 0.152, 0.236],
        [0.1, 0.142, 0.218],
        [0.15, 0.145, 0.19],
        [0.192, 0.165, 0.16],
        [0.214, 0.198, 0.14],
        [0.206, 0.232, 0.135],
        [0.18, 0.238, 0.14],
        [0.164, 0.218, 0.146],
        [0.174, 0.2, 0.146],
      ].map(([x, y, z]) => [x * s - so.x, y - so.y, z - so.z] as [number, number, number]);
      const tube = taperTube(curve(pts, 0.5), seg(44), seg(10), (t) => 0.007 + 0.033 * (1 - t) ** 1.25 * (0.88 + 0.12 * Math.sin(Math.PI * Math.min(1, t * 3))), {
        capStart: true,
        capEnd: true,
        flatten: 0.8,
      });
      kit.add("hair", tube, {
        bone: B.stache,
        // baffo: castano caldo, più chiaro sul dorso, con le striature del pettinato
        color: (_p, n, out, u, v) => {
          const streak = 0.5 + 0.5 * Math.sin(v * Math.PI * 16 + u * 6);
          out.copy(C.hairDark).lerp(C.beard, 0.75).lerp(C.beardHi, 0.45 * Math.max(0, n.y) + 0.18 * streak + 0.1 * u);
        },
      });
    }
  }

  // ================================================================ COLLO / BUSTO
  kit.add("skin", new CylinderGeometry(0.105, 0.115, 0.22, seg(20), 1, true), {
    bone: B.neck,
    matrix: partMatrix([0, 0.06, 0.0]),
    color: C.skin,
  });

  const tp = new Vector3();
  // camicia: busto chiuso
  kit.add(
    "cloth",
    paramSurface(
      (u, v, out) => {
        const theta = u * Math.PI * 2;
        // v: 0..0.06 fondo piatto, poi verso l'alto
        if (v < 0.06) {
          const k = v / 0.06;
          torsoPoint(theta, TY[0], 0, out);
          out.x *= k;
          out.z *= k;
          return;
        }
        const y = TY[0] + ((v - 0.06) / 0.94) * (TY[TY.length - 1] - TY[0]);
        torsoPoint(theta, y, 0, out);
      },
      seg(48),
      seg(36),
    ),
    {
      bone: B.root,
      proj: PT_CLOTH,
      color: (p, _n, out) => out.copy(C.shirt).lerp(C.shirtShade, smoothstep(0.75, 0.3, p.y) * 0.3),
      weights: torsoWeights,
    },
  );

  // grembiule (pettorina + gonna) conformato al busto
  const bibTop = BIB_TOP;
  kit.add(
    "cloth",
    paramSurface(
      (u, v, out) => {
        const y = -0.08 + v * (bibTop + 0.08);
        const th = (u * 2 - 1) * apronTheta(y);
        torsoPoint(th, y, 0.014 + 0.004 * smoothstep(0.4, 0.1, y) + 0.004 * Math.sin(th * 9 + y * 6) * smoothstep(0.45, 0.0, y), out);
      },
      seg(44),
      seg(34),
    ),
    {
      bone: B.root,
      proj: PT_APRON,
      color: (p, _n, out, u) => {
        const lim = apronTheta(p.y);
        const edge = (1 - Math.abs(u * 2 - 1)) * lim; // distanza angolare dal bordo
        const top = Math.abs(p.y - (bibTop - 0.02));
        const h = hash3(Math.round(p.x * 220), Math.round(p.y * 220), Math.round(p.z * 220));
        out.copy(C.denim).lerp(C.denimHi, h * 0.25 + 0.1 * smoothstep(0.3, 0.6, p.y) * (1 - Math.abs(u * 2 - 1)));
        out.multiplyScalar(0.8 + 0.2 * smoothstep(0.0, 0.25, edge));
        const dash = Math.sin(p.y * 260 + p.x * 260) > -0.3;
        if (((edge > 0.035 && edge < 0.047) || (top < 0.0028 && edge > 0.035)) && dash) out.copy(C.stitch);
      },
      weights: torsoWeights,
    },
  );
  // bordo superiore spesso della pettorina (orlo)
  {
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 10; k++) {
      const th = -0.6 + (k / 10) * 1.2;
      torsoPoint(th, bibTop, 0.016, tp);
      pts.push([tp.x, tp.y, tp.z]);
    }
    kit.add("cloth", taperTube(curve(pts), seg(20), 6, () => 0.007, { capStart: true, capEnd: true }), {
      bone: B.root,
      proj: PT_APRON,
      color: C.denim,
      weights: torsoWeights,
    });
  }

  // tasca con penna (lato sinistro del personaggio, in basso)
  {
    const th0 = 0.5;
    const th1 = 0.85;
    const y0 = 0.17;
    const y1 = 0.35;
    kit.add(
      "cloth",
      paramSurface(
        (u, v, out) => torsoPoint(th0 + u * (th1 - th0), y0 + v * (y1 - y0), 0.024, out),
        seg(10),
        seg(8),
      ),
      {
        bone: B.root,
        proj: PT_APRON,
        color: (_p, _n, out, u, v) => {
          const e = Math.min(u, 1 - u, v, 1 - v);
          out.copy(e > 0.035 && e < 0.06 && v < 0.96 ? C.stitch : C.denim);
        },
        weights: torsoWeights,
      },
    );
    torsoPoint(0.74, 0.33, 0.03, tp);
    kit.add("metal", new CylinderGeometry(0.008, 0.008, 0.12, 10), { bone: B.root, matrix: partMatrix([tp.x, tp.y + 0.02, tp.z], [0, 0, -0.05]), color: C.brass, weights: torsoWeights });
    kit.add("metal", new CylinderGeometry(0.004, 0.004, 0.05, 6), {
      bone: B.root,
      matrix: partMatrix([tp.x + 0.008, tp.y + 0.04, tp.z + 0.008], [0, 0, -0.05]),
      color: C.brass,
      weights: torsoWeights,
    });
  }

  // logo palma: è dipinto nella texture proiettata dell'illustrazione (vedi projection.ts)

  // cintura + rivetti
  kit.add(
    "leather",
    paramSurface(
      (u, v, out) => {
        const y = 0.075 + v * 0.085;
        // bordo arrotondato: più sottile su sopra/sotto
        const bulge = Math.sin(v * Math.PI) * 0.01;
        torsoPoint(u * Math.PI * 2, y, 0.026 + bulge, out);
      },
      seg(64),
      6,
    ),
    {
      bone: B.root,
      proj: PT_LEATHER,
      color: (p, _n, out) => out.copy(C.leather).lerp(C.leatherDark, Math.abs(p.y - 0.1175) > 0.03 ? 0.6 : 0),
      weights: torsoWeights,
    },
  );
  for (let k = -5; k <= 5; k++) {
    torsoPoint(k * 0.3, 0.1175, 0.04, tp);
    kit.add("metal", ellipsoid(0.011, 0.011, 0.011, 10, 8, tp.x, tp.y, tp.z), { bone: B.root, color: C.brass, weights: torsoWeights });
  }

  // cinghie di cuoio con fibbie (dietro: incrociate, inventate)
  const outward = (p: Vector3, out: Vector3) => {
    out.set(p.x, p.y - Math.min(0.78, Math.max(0.1, p.y)), p.z - 0.01);
    if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
    out.normalize();
  };
  for (const s of [1, -1] as Side[]) {
    const ctrl: [number, number][] = [
      [0.53, 0.685],
      [0.58, 0.78],
      [0.68, 0.86],
      [1.05, 0.92],
      [1.57, 0.935],
      [2.2, 0.9],
      [2.65, 0.75],
      [2.95, 0.52],
      [3.35, 0.3],
      [3.6, 0.12],
    ];
    const pts = ctrl.map(([th, y]) => {
      torsoPoint(th * s, y, 0.03, tp);
      return [tp.x, tp.y, tp.z] as [number, number, number];
    });
    kit.add("leather", ribbon(curve(pts), seg(48), 0.055, 0.012, outward), { bone: B.root, color: C.leather, weights: torsoWeights, proj: PT_LEATHER });
    // fibbia quadrata
    torsoPoint(0.58 * s, 0.79, 0.042, tp);
    const nrm = new Vector3();
    outward(tp, nrm);
    const rot = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), nrm);
    const fr = new Matrix4().compose(tp.clone(), rot, new Vector3(1, 1, 1)).multiply(new Matrix4().makeRotationZ(Math.PI / 4 + s * 0.08));
    kit.add("metal", new TorusGeometry(0.042, 0.0065, 4, 4), { bone: B.root, matrix: fr, color: C.brass, weights: torsoWeights, proj: PT_LEATHER });
    // rivetto all'angolo della pettorina
    torsoPoint(0.555 * s, 0.7, 0.044, tp);
    kit.add("metal", ellipsoid(0.014, 0.014, 0.01, 10, 8, tp.x, tp.y, tp.z), { bone: B.root, color: C.brass, weights: torsoWeights });
    // passante della cinghia sotto la fibbia
    torsoPoint(0.555 * s, 0.745, 0.042, tp);
    kit.add("leather", ellipsoid(0.034, 0.012, 0.008, 10, 6, tp.x, tp.y, tp.z), { bone: B.root, color: C.leatherDark, weights: torsoWeights });
  }

  // colletto + bottoni + papillon
  {
    const collar = new LatheGeometry(
      [new Vector2(0.14, 0.0), new Vector2(0.135, 0.03), new Vector2(0.12, 0.07), new Vector2(0.112, 0.085)],
      seg(24),
    );
    kit.add("cloth", collar, { bone: B.chest, matrix: partMatrix([0, 0.255, -0.01]), color: C.shirt, proj: PT_CLOTH });
    for (const s of [1, -1]) {
      kit.add("cloth", ellipsoid(0.05, 0.045, 0.01, seg(12), seg(8)), {
        bone: B.chest,
        matrix: partMatrix([0.045 * s, 0.255, 0.155], [0.55, 0.25 * s, 0.55 * s]),
        color: C.shirt,
      });
    }
    for (const y of [0.19, 0.145]) {
      torsoPoint(0, 0.6 + y, 0.004, tp);
      kit.add("leather", new CylinderGeometry(0.011, 0.011, 0.006, 10), {
        bone: B.chest,
        proj: PT_LEATHER,
        matrix: partMatrix([0, y, tp.z], [Math.PI / 2 - 0.25, 0, 0]),
        color: C.button,
      });
    }
    // papillon: due ali + nodo
    const bowC = v3(0, 0.262, 0.212);
    for (const s of [1, -1]) {
      const wing = taperTube(
        curve([
          [bowC.x, bowC.y, bowC.z],
          [bowC.x + 0.07 * s, bowC.y + 0.006, bowC.z - 0.008],
          [bowC.x + 0.14 * s, bowC.y + 0.004, bowC.z - 0.032],
        ]),
        seg(14),
        seg(14),
        // ala piena in altezza, schiacciata solo in profondità (la sezione segue +Z)
        (t) => (0.018 + 0.05 * smoothstep(0, 0.8, t)) * (1 - 0.3 * smoothstep(0.86, 1, t)),
        { capStart: true, capEnd: true, flatten: 0.42, outward: (_p, out) => out.set(0, 0, 1) },
      );
      kit.add("gloss", wing, { bone: B.chest, color: C.bowtie });
    }
    kit.add("gloss", ellipsoid(0.032, 0.042, 0.026, 12, 10, bowC.x, bowC.y, bowC.z + 0.016), { bone: B.chest, color: C.bowtie });
  }

  // asciugamano a righe infilato nella cintura (fianco destro del personaggio)
  {
    const th0 = -0.95;
    const th1 = -0.35;
    const towelColor: ColorFn = (p, _n, out, u) => {
      const s = u;
      const stripe = (s > 0.16 && s < 0.24) || (s > 0.3 && s < 0.34) || (p.y < -0.07 && p.y > -0.095);
      const h = hash3(Math.round(p.x * 300), Math.round(p.y * 300), Math.round(p.z * 300));
      out.copy(stripe ? C.towelRed : C.towel).multiplyScalar(0.92 + h * 0.08);
    };
    kit.add(
      "cloth",
      paramSurface(
        (u, v, out) => {
          const y = -0.16 + v * 0.36;
          const th = th0 + u * (th1 - th0) + 0.06 * (1 - v) * Math.sin(u * 3);
          torsoPoint(th, y, 0.05 + 0.02 * Math.sin(u * Math.PI) * (1 - v) + 0.012 * Math.sin(u * 9 + v * 3), out);
        },
        seg(18),
        seg(16),
      ),
      { bone: B.root, color: towelColor, weights: torsoWeights },
    );
    // risvolto sopra la cintura
    kit.add(
      "cloth",
      paramSurface(
        (u, v, out) => {
          const y = 0.06 + v * 0.13;
          const th = th0 + 0.03 + u * (th1 - th0 - 0.06);
          torsoPoint(th, y, 0.068 + 0.03 * (1 - v) + 0.01 * Math.sin(u * 7), out);
        },
        seg(16),
        seg(6),
      ),
      { bone: B.root, color: towelColor, weights: torsoWeights },
    );
  }

  // ================================================================ BRACCIA
  for (const s of [1, -1] as Side[]) {
    const base = armBase(s);
    const upper = base + A.upper;
    const fore = base + A.fore;
    const hand = base + A.hand;
    // spalla + braccio (manica): la manica è un tronco di cono tangente alla
    // sfera della spalla (stesso raggio all'equatore) e a quella del gomito,
    // così non resta nessun gradino né fessura al giunto
    const shoulderR = 0.1;
    const elbowR = 0.088;
    kit.add("cloth", ellipsoid(shoulderR, shoulderR, shoulderR, seg(18), seg(14), 0.0, -0.03, 0), { bone: upper, color: C.shirt });
    kit.add("cloth", new CylinderGeometry(shoulderR, elbowR, UPPER_LEN - 0.03, seg(18), 3, true), {
      bone: upper,
      matrix: partMatrix([0, -(UPPER_LEN + 0.03) / 2, 0]),
      color: C.shirt,
    });
    kit.add("cloth", ellipsoid(elbowR, elbowR, elbowR, seg(14), seg(12), 0, -UPPER_LEN, 0), { bone: upper, color: C.shirtShade });
    // risvolto arrotolato
    kit.add("cloth", new TorusGeometry(0.075, 0.03, seg(10), seg(18)), {
      bone: fore,
      matrix: partMatrix([0, -0.05, 0], [Math.PI / 2, 0, 0]),
      color: C.shirt,
    });
    kit.add("cloth", new TorusGeometry(0.07, 0.022, seg(8), seg(16)), {
      bone: fore,
      matrix: partMatrix([0, -0.08, 0], [Math.PI / 2, 0, 0]),
      color: C.shirtShade,
    });
    // avambraccio
    kit.add(
      "skin",
      taperTube(
        curve([
          [0, -0.04, 0],
          [0, -0.14, 0.005],
          [0, -FORE_LEN + 0.01, 0],
        ]),
        seg(14),
        seg(14),
        (t) => 0.07 - 0.02 * t,
        { capEnd: true },
      ),
      { bone: fore, color: C.skin },
    );
    // polso: sfera alla giuntura, copre lo stacco tra avambraccio e mano quando il polso piega
    kit.add("skin", ellipsoid(0.052, 0.052, 0.052, seg(12), seg(10), 0, -FORE_LEN, 0), { bone: fore, color: C.skin });
    // mano: palmo
    kit.add("skin", ellipsoid(0.036, 0.06, 0.056, seg(16), seg(14), -0.004 * s, -0.058, 0.0), { bone: hand, color: C.skin });
    // dita
    for (const f of FINGERS) {
      kit.add("skin", new CapsuleGeometry(f.r, f.len1, 3, seg(9)), {
        bone: base + f.bone1,
        matrix: partMatrix([0, -f.len1 / 2, 0]),
        color: C.skin,
      });
      kit.add("skin", new CapsuleGeometry(f.r * 0.95, f.len2 - f.r * 0.5, 3, seg(9)), {
        bone: base + f.bone2,
        matrix: partMatrix([0, -f.len2 / 2, 0]),
        color: C.skin,
      });
    }
    // pollice
    const td = v3(THUMB_DIR[0] * s, THUMB_DIR[1], THUMB_DIR[2]).normalize();
    const tq = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), td);
    const tm = (len: number) => new Matrix4().compose(td.clone().multiplyScalar(len / 2), tq, new Vector3(1, 1, 1));
    kit.add("skin", ellipsoid(0.026, 0.035, 0.024, seg(10), seg(8)), {
      bone: base + A.thumb1,
      matrix: new Matrix4().compose(td.clone().multiplyScalar(0.006), tq, new Vector3(1, 1, 1)),
      color: C.skin,
    });
    kit.add("skin", new CapsuleGeometry(0.021, THUMB_LEN1, 4, seg(10)), { bone: base + A.thumb1, matrix: tm(THUMB_LEN1), color: C.skin });
    kit.add("skin", new CapsuleGeometry(0.02, THUMB_LEN2 - 0.01, 4, seg(10)), { bone: base + A.thumb2, matrix: tm(THUMB_LEN2), color: C.skin });
  }

  // ================================================================ MICROFONO (mano sinistra)
  {
    const hand = armBase(1) + A.hand;
    // asse del microfono verso +Z della mano (lato pollice), inclinato di MIC_TILT verso le dita; impugnatura nel pugno
    const grip = v3(...MIC_GRIP);
    const toHand = new Matrix4()
      .makeTranslation(grip.x, grip.y, grip.z)
      .multiply(new Matrix4().makeRotationX(Math.PI / 2 + MIC_TILT))
      .multiply(new Matrix4().makeTranslation(0, -0.07, 0));
    const handle = new LatheGeometry(
      [
        new Vector2(0.0, 0.0),
        new Vector2(0.019, 0.0),
        new Vector2(0.021, 0.006),
        new Vector2(0.023, 0.11),
        new Vector2(0.028, 0.165),
        new Vector2(0.03, 0.18),
        new Vector2(0.0, 0.18),
      ],
      seg(18),
    );
    kit.add("gloss", handle, { bone: hand, matrix: toHand, color: C.micBlack });
    const ring = new LatheGeometry(
      [new Vector2(0.03, 0.172), new Vector2(0.034, 0.178), new Vector2(0.034, 0.198), new Vector2(0.031, 0.204)],
      seg(18),
    );
    kit.add("metal", ring, { bone: hand, matrix: toHand, color: C.silver });
    const grille = new SphereGeometry(0.046, seg(22), seg(16));
    grille.translate(0, 0.238, 0);
    kit.add("grille", grille, { bone: hand, matrix: toHand, color: "#ffffff" });
  }

  const geometries = kit.build();
  return { geometries, kit, triangles: kit.triangles, mouth: mouthLocal, cams: { head: headCam, torso: torsoCam } };
}
