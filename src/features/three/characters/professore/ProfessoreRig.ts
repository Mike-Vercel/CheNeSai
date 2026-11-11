/**
 * Runtime del Professore: scheletro, mesh skinnate (una per materiale),
 * fusione tra animazioni, IK delle braccia, palpebre e lip-sync.
 * Nessuna allocazione nel ciclo di update.
 */
import {
  Bone,
  CanvasTexture,
  DoubleSide,
  Group,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Material,
  type Texture,
} from "three";
import type { CharacterAnimation } from "../types";
import { buildBody, torsoClearance, type MatKey } from "./body";
import {
  A,
  B,
  BONE_COUNT,
  FINGERS,
  FORE_LEN,
  HAND_SCALE,
  HEAD_SCALE,
  MIC_GRIP,
  MIC_TILT,
  TORSO_SQUASH,
  UPPER_LEN,
  armBase,
  type Side,
} from "./layout";
import { AC, CH, N_CH, POSES, armCh, blendPose, type PoseCtx } from "./poses";

/** altezza del modello (m) dalla base del busto alla cima dei capelli */
export const PROFESSORE_MODEL_HEIGHT = 1.8;
const RAW_HEIGHT = 1.6;
const RAW_BASE = 0.068;
export const PROFESSORE_SCALE = PROFESSORE_MODEL_HEIGHT / (RAW_HEIGHT + RAW_BASE);

const BLEND = 0.3;
/** ancora della mano nello spazio della mano (sinistra: impugnatura del microfono) */
const ANCHOR_L = new Vector3(...MIC_GRIP);
const ANCHOR_R = new Vector3(0, -0.07, 0);

// ---- collisioni braccia/busto (spazio torace; il busto è quello di torsoPoint)
/** margine sul guscio del busto (gli strati sopra la camicia li conta già torsoClearance) */
const BODY_SHELL = 0.004;
/** aria minima tra la superficie del braccio e il guscio */
const CLEAR = 0.005;
/** aria minima per mano e microfono: la mano può appoggiarsi al grembiule */
const HAND_CLEAR = 0.002;
/** sfere della mano (spazio mano sinistra, prima di HAND_SCALE): x, y, z, raggio — palmo, dita, pollice */
const HAND_PROBES = [-0.004, -0.06, 0, 0.036, 0, -0.13, 0, 0.026, -0.045, -0.07, 0.1, 0.017];
/** sfere del microfono (mano sinistra) lungo il suo asse: fondo del manico, manico, griglia */
const MIC_PROBES = [-0.06, 0.022, 0.06, 0.026, 0.168, 0.046].flatMap((r, i, a) =>
  i % 2 === 0 ? [MIC_GRIP[0], MIC_GRIP[1] - Math.sin(MIC_TILT) * r, MIC_GRIP[2] + Math.cos(MIC_TILT) * r, a[i + 1]] : [],
);
/** sfere lungo il braccio: segmento (0 omero, 1 avambraccio), t, raggio (manica, gomito, risvolto, polso) */
const ARM_PROBES = [0, 0.5, 0.097, 0, 0.75, 0.093, 0, 1, 0.088, 1, 0.2, 0.105, 1, 0.33, 0.092, 1, 0.6, 0.068, 1, 0.85, 0.058, 1, 1, 0.052];
/** fette verticali (in frazioni del raggio) con cui si prova una sfera contro il busto */
const PROBE_DY = [0, -0.5, 0.5, -0.85, 0.85];
const SWIVEL_STEP = Math.PI / 16;
const SWIVEL_STEPS = 16;
/** velocità massima (rad/s) con cui il gomito può ruotare per schivare il busto */
const SWIVEL_SPEED = 7;

/** uniformi condivise della proiezione dell'illustrazione */
interface ProjUniforms {
  projMap: { value: Texture | null };
  projStrength: { value: number };
  projEmissive: { value: number };
}

/**
 * Inietta nel materiale la miscela "colore proiettato dall'illustrazione":
 * attributo `proj` = (u, v, peso, etichetta). Il peso tiene conto di quanto
 * la superficie guarda la camera del riferimento; l'etichetta deve coincidere
 * con quella scritta nell'alpha della texture (pelle/capelli/stoffa/cuoio),
 * altrimenti resta il materiale procedurale. Una parte del colore proiettato
 * va in emissione: regge le luci colorate del palco senza "slavarsi".
 */
function withProjection(mat: Material, u: ProjUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.projMap = u.projMap;
    shader.uniforms.projStrength = u.projStrength;
    shader.uniforms.projEmissive = u.projEmissive;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 proj;\nvarying vec4 vProj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvProj = proj;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D projMap;\nuniform float projStrength;\nuniform float projEmissive;\nvarying vec4 vProj;",
      )
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "vec4 projTex = texture2D(projMap, vProj.xy);",
          "float projW = clamp(vProj.z, 0.0, 1.0) * projStrength * step(0.01, vProj.w)",
          "  * (1.0 - smoothstep(0.035, 0.075, abs(projTex.a - vProj.w)));",
          "diffuseColor.rgb = mix(diffuseColor.rgb, projTex.rgb, projW);",
        ].join("\n"),
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += projTex.rgb * projW * projEmissive;",
      );
  };
}

function makeGrilleTexture(): Texture | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#2a2b2f";
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "#a9adb5";
  g.lineWidth = 3;
  for (let i = -64; i < 128; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 64, 64);
    g.stroke();
    g.beginPath();
    g.moveTo(i + 64, 0);
    g.lineTo(i, 64);
    g.stroke();
  }
  const t = new CanvasTexture(cv);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(10, 6);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class ProfessoreRig {
  readonly root = new Group();
  readonly triangles: number;
  readonly drawCalls: number;
  private readonly model = new Group();
  private readonly bones: Bone[] = [];
  private readonly rest: Vector3[] = [];
  private readonly meshes: SkinnedMesh[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private readonly projUniforms: ProjUniforms = {
    projMap: { value: null },
    projStrength: { value: 0 },
    projEmissive: { value: 0.32 },
  };

  private anim: CharacterAnimation = "idle";
  private animT = 0;
  private blendT = BLEND;
  private time = 0;
  private readonly cur = new Float32Array(N_CH);
  private readonly out = new Float32Array(N_CH);
  private readonly snap = new Float32Array(N_CH);
  private readonly ctx: PoseCtx = { autoMouth: true };
  private mouthSm = 0;
  private nextBlink = 2.2;
  private blinkSeed = 1;

  // temporanei IK
  private readonly vS = new Vector3();
  private readonly vW = new Vector3();
  private readonly vD = new Vector3();
  private readonly vP = new Vector3();
  private readonly vE = new Vector3();
  private readonly vX = new Vector3();
  private readonly vY = new Vector3();
  private readonly vZ = new Vector3();
  private readonly vA = new Vector3();
  private readonly vQ = new Vector3();
  private readonly vT = new Vector3();
  private readonly vN = new Vector3();
  /** angolo di swivel del gomito al fotogramma precedente (sinistro, destro) e limite per fotogramma */
  private readonly swivelPrev = [0, 0];
  private swivelOut = 0;
  private swivelMaxStep = Infinity;
  /** altezza a riposo del torace (spazio modello): porta lo spazio torace nelle coordinate del busto */
  private readonly chestY: number;
  private readonly qH = new Quaternion();
  private readonly qU = new Quaternion();
  private readonly qF = new Quaternion();
  private readonly m4 = new Matrix4();

  constructor(lowPower = false) {
    const body = buildBody(lowPower);
    this.triangles = body.triangles;
    this.chestY = body.kit.rest[B.chest].y;
    for (let i = 0; i < BONE_COUNT; i++) {
      const def = body.kit.bones[i];
      const b = new Bone();
      b.name = def.name;
      b.position.set(...def.offset);
      this.rest.push(b.position.clone());
      if (def.parent >= 0) this.bones[def.parent].add(b);
      this.bones.push(b);
    }
    for (const n of ["neck", "head", "chest", "spine"] as const) this.bones[B[n]].rotation.order = "YXZ";
    this.model.add(this.bones[0]);
    this.model.updateMatrixWorld(true);
    const skeleton = new Skeleton(this.bones);
    // proporzioni cartoon: testa e mani più grandi (scala sull'osso, dopo il bind)
    this.bones[B.head].scale.setScalar(HEAD_SCALE);
    this.bones[armBase(1) + A.hand].scale.setScalar(HAND_SCALE);
    this.bones[armBase(-1) + A.hand].scale.setScalar(HAND_SCALE);

    const grille = makeGrilleTexture();
    if (grille) this.textures.push(grille);
    const mats: Record<MatKey, Material> = {
      skin: new MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.5,
        sheen: 0.8,
        sheenRoughness: 0.45,
        sheenColor: "#ffc2a0",
        emissive: "#5a1a08",
        emissiveIntensity: 0.18,
      }),
      hair: new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.48, sheen: 0.7, sheenRoughness: 0.35, sheenColor: "#c98a52" }),
      cloth: new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.86, side: DoubleSide, sheen: 0.12, sheenRoughness: 0.8, sheenColor: "#6a5040" }),
      leather: new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, envMapIntensity: 0.5 }),
      metal: new MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.55, emissive: "#3a2a10", emissiveIntensity: 0.25 }),
      gloss: new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1, envMapIntensity: 0.5 }),
      grille: new MeshStandardMaterial({ color: "#8a8d93", map: grille, roughness: 0.42, metalness: 0.55 }),
    };
    for (const k of ["skin", "hair", "cloth", "leather", "metal", "gloss"] as const) withProjection(mats[k], this.projUniforms);
    for (const [key, geo] of body.geometries) {
      const mat = mats[key];
      const mesh = new SkinnedMesh(geo, mat);
      mesh.name = `professore-${key}`;
      mesh.frustumCulled = false;
      mesh.castShadow = key !== "hair";
      mesh.receiveShadow = true;
      this.model.add(mesh);
      mesh.bind(skeleton);
      this.meshes.push(mesh);
    }
    for (const m of Object.values(mats)) this.materials.push(m);
    this.drawCalls = this.meshes.length;

    this.model.position.y = RAW_BASE;
    this.root.add(this.model);
    this.root.scale.setScalar(PROFESSORE_SCALE);
    POSES.idle(0, this.cur, this.ctx);
    this.out.set(this.cur);
    this.apply(this.out, 0);
  }

  /** carica la texture proiettata (illustrazione de-illuminata + etichette in alpha) */
  loadProjection(url: string): () => void {
    let alive = true;
    new TextureLoader().load(url, (tex) => {
      if (!alive) {
        tex.dispose();
        return;
      }
      tex.colorSpace = SRGBColorSpace;
      tex.premultiplyAlpha = false;
      tex.anisotropy = 4;
      this.textures.push(tex);
      this.projUniforms.projMap.value = tex;
      this.projUniforms.projStrength.value = 1;
    });
    return () => {
      alive = false;
    };
  }

  setAnimation(a: CharacterAnimation): void {
    if (a === this.anim) return;
    this.snap.set(this.out);
    this.anim = a;
    this.animT = 0;
    this.blendT = 0;
  }

  update(dt: number, mouthOpen: number | undefined): void {
    const d = Math.min(0.1, Math.max(0, dt));
    this.time += d;
    this.animT += d;
    this.ctx.autoMouth = mouthOpen === undefined;
    POSES[this.anim](this.animT, this.cur, this.ctx);
    if (this.blendT < BLEND) {
      this.blendT += d;
      const k = Math.min(1, this.blendT / BLEND);
      blendPose(this.snap, this.cur, k * k * (3 - 2 * k), this.out);
    } else {
      this.out.set(this.cur);
    }
    this.swivelMaxStep = SWIVEL_SPEED * Math.max(d, 1 / 120);
    const m = Math.min(1, Math.max(0, mouthOpen ?? 0));
    this.mouthSm += (m - this.mouthSm) * Math.min(1, d * 28);
    this.apply(this.out, this.blink(d));
  }

  private blink(dt: number): number {
    this.nextBlink -= dt;
    if (this.nextBlink < -0.16) {
      this.blinkSeed = (this.blinkSeed * 16807) % 2147483647;
      this.nextBlink = 2 + (this.blinkSeed % 1000) / 380;
    }
    if (this.nextBlink > 0) return 0;
    const p = -this.nextBlink / 0.16;
    return Math.sin(Math.min(1, p) * Math.PI);
  }

  private apply(o: Float32Array, blink: number): void {
    const bn = this.bones;
    const mouth = this.mouthSm;
    bn[B.root].position.set(o[CH.rootX], o[CH.rootY], o[CH.rootZ]);
    bn[B.root].rotation.set(o[CH.rootRx], o[CH.rootRy], 0);
    bn[B.pelvis].rotation.set(o[CH.pelvisX], o[CH.pelvisY], o[CH.pelvisZ]);
    bn[B.spine].rotation.set(o[CH.spineX], o[CH.spineY], o[CH.spineZ]);
    bn[B.chest].rotation.set(o[CH.chestX], o[CH.chestY], o[CH.chestZ]);
    bn[B.neck].rotation.set(o[CH.neckX], o[CH.neckY] * 0.4 + o[CH.headY] * 0.25, o[CH.neckZ]);
    bn[B.head].rotation.set(o[CH.headX] - mouth * 0.035, o[CH.headY] * 0.75, o[CH.headZ]);

    const jaw = o[CH.jaw] + mouth * 0.42;
    bn[B.jaw].rotation.x = Math.max(-0.1, Math.min(0.5, jaw));
    const st = o[CH.stache] + mouth * 0.7;
    bn[B.stache].rotation.x = -0.1 * st;
    bn[B.stache].position.y = this.rest[B.stache].y + 0.007 * st;

    const lidL = Math.max(o[CH.lidL], blink);
    const lidR = Math.max(o[CH.lidR], blink);
    bn[B.lidL].rotation.x = -1.22 + 1.5 * Math.max(-0.3, Math.min(1, lidL));
    bn[B.lidR].rotation.x = -1.22 + 1.5 * Math.max(-0.3, Math.min(1, lidR));
    bn[B.lowLidL].rotation.x = 1.0 - 0.62 * o[CH.lowL];
    bn[B.lowLidR].rotation.x = 1.0 - 0.62 * o[CH.lowR];
    bn[B.browL].position.y = this.rest[B.browL].y + 0.022 * o[CH.browL];
    bn[B.browR].position.y = this.rest[B.browR].y + 0.022 * o[CH.browR];
    bn[B.browL].rotation.z = 0.14 * o[CH.browL];
    bn[B.browR].rotation.z = -0.14 * o[CH.browR];

    this.solveArm(1, o);
    this.solveArm(-1, o);
  }

  private solveArm(s: Side, o: Float32Array): void {
    const bn = this.bones;
    const base = armBase(s);
    const c = armCh(s);
    const upper = bn[base + A.upper];
    const fore = bn[base + A.fore];
    const hand = bn[base + A.hand];
    const L1 = UPPER_LEN;
    const L2 = FORE_LEN;
    const side = s === 1 ? 0 : 1;

    this.qH.set(o[c + AC.qx], o[c + AC.qy], o[c + AC.qz], o[c + AC.qw]).normalize();
    // polso = ancora - R_mano * offsetAncora
    const anc = s === 1 ? ANCHOR_L : ANCHOR_R;
    this.vA.set(anc.x * s, anc.y, anc.z).multiplyScalar(HAND_SCALE).applyQuaternion(this.qH);
    this.vW.set(o[c + AC.ax], o[c + AC.ay], o[c + AC.az]).sub(this.vA);
    // 1) la mano (e il microfono) non entra nel busto: si sposta il polso fuori dal guscio
    this.pushHandOut(s, o[c + AC.curl]);
    const S = this.vS.copy(this.rest[base + A.upper]);
    const D = this.vD;
    const Pp = this.vP;
    const Q = this.vQ;
    let ex = 0;
    let er = 0;
    for (let pass = 0; pass < 3; pass++) {
      D.subVectors(this.vW, S);
      let dist = D.length();
      if (dist < 1e-4) {
        D.set(0, -1, 0);
        dist = 1e-4;
      }
      D.divideScalar(dist);
      dist = Math.min(L1 + L2 - 1e-3, Math.max(Math.abs(L1 - L2) + 1e-3, dist));
      const cosA = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist);
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      // polso effettivo (raggiungibile)
      this.vW.copy(S).addScaledVector(D, dist);
      // 2) gomito: polo della posa, poi rotazione attorno all'asse spalla→polso
      //    fino al primo angolo in cui omero e avambraccio restano fuori dal busto
      Pp.set(o[c + AC.px], o[c + AC.py], o[c + AC.pz]);
      Pp.addScaledVector(D, -Pp.dot(D));
      if (Pp.lengthSq() < 1e-8) Pp.set(0, -1, 0).addScaledVector(D, -D.y);
      Pp.normalize();
      Q.crossVectors(D, Pp); // secondo asse del cerchio del gomito
      ex = L1 * cosA;
      er = L1 * sinA;
      const left = this.swivel(S, D, Pp, Q, ex, er, this.swivelPrev[side]);
      if (left <= 0) break;
      // 3) nessun angolo basta (es. avambraccio che attraversa la pancia):
      //    la mano si allontana dal busto quanto manca e si risolve di nuovo
      this.vW.addScaledVector(this.vN, left + 0.004);
    }
    this.swivelPrev[side] = this.swivelOut;
    // gomito
    const E = this.vE.copy(S).addScaledVector(D, ex).addScaledVector(Pp, er);
    const U = this.vY.subVectors(E, S).divideScalar(L1); // direzione omero
    // base: Y = -U, Z = -(P ortogonale a U), X = Y × Z
    const Z = this.vZ.copy(Pp).addScaledVector(U, -Pp.dot(U)).normalize().negate();
    U.negate(); // ora è l'asse Y locale
    const X = this.vX.crossVectors(U, Z).normalize();
    this.m4.makeBasis(X, U, Z);
    this.qU.setFromRotationMatrix(this.m4);
    upper.quaternion.copy(this.qU);
    // flessione del gomito
    const fx = this.vW.x - E.x;
    const fy = this.vW.y - E.y;
    const fz = this.vW.z - E.z;
    const fl = Math.hypot(fx, fy, fz) || 1;
    const cosB = Math.max(-1, Math.min(1, (-U.x * fx - U.y * fy - U.z * fz) / fl));
    const bend = Math.acos(cosB);
    fore.rotation.set(-bend, 0, 0);
    // mano: orientamento assoluto nello spazio torace
    this.qF.setFromAxisAngle(this.vA.set(1, 0, 0), -bend);
    this.qU.multiply(this.qF).invert();
    hand.quaternion.copy(this.qU).multiply(this.qH);

    // dita
    const curl = o[c + AC.curl];
    const idx = o[c + AC.idx];
    const spread = o[c + AC.spread];
    for (let i = 0; i < FINGERS.length; i++) {
      const f = FINGERS[i];
      const k = i === 0 ? idx : curl * (i === 3 ? 1.06 : 1);
      const p1 = bn[base + f.bone1];
      const p2 = bn[base + f.bone2];
      p1.rotation.set((1.5 - i) * 0.12 * spread * -1, 0, -s * k);
      p2.rotation.set(0, 0, -s * k * 1.1);
    }
    const th = o[c + AC.thumb];
    bn[base + A.thumb1].rotation.set(0.75 * th, s * 0.2 * th, -s * 0.5 * th);
    bn[base + A.thumb2].rotation.set(0, 0, -s * 0.6 * th);
  }

  /**
   * Penetrazione (>0 = dentro) di una sfera di raggio r (spazio torace) nel guscio
   * del busto. Il busto è descritto a fette orizzontali: si provano alcune fette
   * dentro la sfera, così conta anche la spalla che scende (vicino al colletto).
   * Con `n` scrive la normale (orizzontale) della fetta peggiore.
   */
  private probe(p: Vector3, r: number, n?: Vector3): number {
    let worst = -Infinity;
    let wk = 0;
    for (let k = 0; k < PROBE_DY.length; k++) {
      const dy = PROBE_DY[k] * r;
      const pen = Math.sqrt(r * r - dy * dy) - torsoClearance(p.x, (p.y + dy + this.chestY) / TORSO_SQUASH, p.z, BODY_SHELL);
      if (pen > worst) {
        worst = pen;
        wk = k;
      }
    }
    if (n) torsoClearance(p.x, (p.y + PROBE_DY[wk] * r + this.chestY) / TORSO_SQUASH, p.z, BODY_SHELL, n);
    return worst;
  }

  /** sposta il polso (vW) finché mano, punta delle dita e microfono non sono fuori dal busto */
  private pushHandOut(s: Side, curl: number): void {
    // punta delle dita: segue la piega (due falangi, la seconda piega 2.1 volte)
    const k1 = Math.min(1.6, Math.max(0, curl));
    const tipX = -s * (Math.sin(k1) * 0.05 + Math.sin(2.1 * k1) * 0.04);
    const tipY = -0.1 - Math.cos(k1) * 0.05 - Math.cos(2.1 * k1) * 0.04;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (let set = 0; set < (s === 1 ? 3 : 2); set++) {
        const pr = set === 0 ? HAND_PROBES : set === 1 ? null : MIC_PROBES;
        // punte: indice/medio e anulare/mignolo (z delle dita in layout.FINGERS)
        const n = pr ? pr.length : 8;
        for (let i = 0; i < n; i += 4) {
          const p = pr ? this.vT.set(pr[i] * s, pr[i + 1], pr[i + 2]) : this.vT.set(tipX, tipY, i === 0 ? 0.025 : -0.03);
          p.multiplyScalar(HAND_SCALE).applyQuaternion(this.qH).add(this.vW);
          const rad = pr ? pr[i + 3] : 0.019;
          const pen = this.probe(p, rad * HAND_SCALE + HAND_CLEAR, this.vN);
          if (pen > 0) {
            this.vW.addScaledVector(this.vN, pen);
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
  }


  /**
   * penetrazione massima (>0 = dentro) di omero e avambraccio col gomito all'angolo phi;
   * con `normal` scrive in vN la normale del busto nel punto peggiore
   */
  private elbowCost(S: Vector3, D: Vector3, P: Vector3, Q: Vector3, ex: number, er: number, phi: number, normal = false): number {
    const cp = Math.cos(phi) * er;
    const sp = Math.sin(phi) * er;
    const E = this.vE.copy(S).addScaledVector(D, ex).addScaledVector(P, cp).addScaledVector(Q, sp);
    let worst = -1;
    let wi = -1;
    for (let i = 0; i < ARM_PROBES.length; i += 3) {
      const t = ARM_PROBES[i + 1];
      if (ARM_PROBES[i] === 0) this.vT.copy(S).lerp(E, t);
      else this.vT.copy(E).lerp(this.vW, t);
      const pen = this.probe(this.vT, ARM_PROBES[i + 2] + CLEAR);
      if (pen > worst) {
        worst = pen;
        wi = i;
      }
    }
    if (normal && wi >= 0) {
      if (ARM_PROBES[wi] === 0) this.vT.copy(S).lerp(E, ARM_PROBES[wi + 1]);
      else this.vT.copy(E).lerp(this.vW, ARM_PROBES[wi + 1]);
      this.probe(this.vT, ARM_PROBES[wi + 2] + CLEAR, this.vN);
    }
    return worst;
  }

  /**
   * Ruota il piano del gomito attorno all'asse spalla→polso (swivel) quanto basta
   * perché il braccio resti fuori dal busto. Su ciascun verso cerca il primo
   * angolo libero e ne raffina il confine con una bisezione; tra i due tiene
   * quello più vicino all'angolo del fotogramma prima e ne limita la velocità:
   * il gomito si sposta con continuità, senza scatti da un lato all'altro.
   * Scrive la direzione scelta in P e restituisce la penetrazione che resta
   * (>0 se nessun angolo basta; normale del busto in vN).
   */
  private swivel(S: Vector3, D: Vector3, P: Vector3, Q: Vector3, ex: number, er: number, prev: number): number {
    let best = 0;
    const cost0 = this.elbowCost(S, D, P, Q, ex, er, 0);
    if (cost0 > 0) {
      let bestGap = Infinity;
      let minCost = cost0;
      let minPhi = 0;
      for (let dir = 1; dir >= -1; dir -= 2) {
        let lo = 0;
        for (let k = 1; k <= SWIVEL_STEPS; k++) {
          const phi = dir * k * SWIVEL_STEP;
          const cost = this.elbowCost(S, D, P, Q, ex, er, phi);
          if (cost <= 0) {
            let hi = phi;
            for (let b = 0; b < 6; b++) {
              const mid = (lo + hi) / 2;
              if (this.elbowCost(S, D, P, Q, ex, er, mid) <= 0) hi = mid;
              else lo = mid;
            }
            const gap = Math.abs(hi - prev);
            if (gap < bestGap) {
              bestGap = gap;
              best = hi;
            }
            break;
          }
          if (cost < minCost) {
            minCost = cost;
            minPhi = phi;
          }
          lo = phi;
        }
      }
      if (bestGap === Infinity) best = minPhi;
    }
    best = prev + Math.max(-this.swivelMaxStep, Math.min(this.swivelMaxStep, best - prev));
    this.swivelOut = best;
    const left = this.elbowCost(S, D, P, Q, ex, er, best, true);
    if (best !== 0) P.multiplyScalar(Math.cos(best)).addScaledVector(Q, Math.sin(best)).normalize();
    return left;
  }

  dispose(): void {
    for (const m of this.meshes) m.geometry.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    for (const m of this.meshes) m.skeleton.dispose();
  }
}
