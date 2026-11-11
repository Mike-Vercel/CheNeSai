import {
  Bone,
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  type Material,
  Matrix4,
  MeshStandardMaterial,
  type Object3D,
  PMREMGenerator,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { CharacterAnimation } from "../types";
import {
  ANIMATIONS,
  ARM,
  ARM_L,
  ARM_R,
  CH,
  CHANNEL_COUNT,
  ONE_SHOT,
  channelStiffness,
  evaluateClip,
  restPose,
  type ClipContext,
} from "./animation";
import { createPalminoAtlas, type PalminoAtlas } from "./atlas";
import { BONE, BONE_BIND, BONE_NAMES, buildPalminoBody } from "./geometry";
import { buildLeafGeometry, createLeafMaterial, palminoLeafLayout, type LeafMaterial, type LeafSpec } from "./leaves";
import { createRefProjection, injectBodyProjection, injectLeafProjection, type RefProjection } from "./projection";

const FADE = 0.3;
const JAW_BIND = BONE_BIND.jaw.pos;

// temporanei riusati (nessuna allocazione per frame)
const _pos = new Vector3();
const _vel = new Vector3();
const _acc = new Vector3();
const _q = new Quaternion();
const _qInv = new Quaternion();
const _s = new Vector3();
const _m = new Matrix4();
const _e = new Euler(0, 0, 0, "YXZ");
const _lp = new Vector3();
const _ls = new Vector3();

/** Legge LINK_STATUS di ogni programma WebGL già creato per questi materiali (vedi `dispose`). */
function settlePrograms(gl: WebGLRenderer, materials: Material[]) {
  const ctx = gl.getContext();
  if (ctx.isContextLost()) return;
  for (const m of materials) {
    const programs = (gl.properties.get(m) as { programs?: Map<string, { program?: WebGLProgram }> }).programs;
    programs?.forEach((p) => {
      if (p.program) ctx.getProgramParameter(p.program, ctx.LINK_STATUS);
    });
  }
}

export interface PalminoStats {
  triangles: number;
  drawCalls: number;
  bones: number;
  leaves: number;
}

/**
 * Runtime imperativo di Palmino: costruisce geometrie/materiali una volta, poi `update()`
 * calcola la posa (cross-fade + molle) e la applica allo scheletro e alle foglie.
 */
export class PalminoRuntime {
  readonly object = new Group();
  readonly stats: PalminoStats;

  private readonly bones: Bone[];
  private readonly mesh: SkinnedMesh;
  private readonly bodyMaterial: MeshStandardMaterial;
  private readonly atlas: PalminoAtlas;
  private readonly leafMesh: InstancedMesh;
  private readonly leaf: LeafMaterial;
  private readonly leafSpecs: LeafSpec[];
  private readonly envTexture: Texture | null;
  private readonly projection: RefProjection | null;
  private usingOwnEnv = true;

  // stato animazione
  private readonly weights = new Float32Array(ANIMATIONS.length);
  private readonly times = new Float32Array(ANIMATIONS.length);
  private current = 0;
  private readonly target = new Float32Array(CHANNEL_COUNT);
  private readonly temp = new Float32Array(CHANNEL_COUNT);
  private readonly pose = new Float32Array(CHANNEL_COUNT);
  private readonly vel = new Float32Array(CHANNEL_COUNT);
  private readonly stiffness = channelStiffness();
  private readonly ctx: ClipContext = { autoChatter: true };
  private mouthSmooth = 0;
  private talkActivity = 0;
  private clock = 0;
  private started = false;
  private wasShown = true;

  // moto secondario delle foglie
  private readonly leafPitch: Float32Array;
  private readonly leafPitchV: Float32Array;
  private readonly leafYaw: Float32Array;
  private readonly leafYawV: Float32Array;
  private readonly prevCrown = new Vector3();
  private readonly prevCrownVel = new Vector3();
  private readonly crownAcc = new Vector3();
  private prevYaw = 0;
  private yawRate = 0;

  constructor(
    private readonly gl: WebGLRenderer | null,
    lowPower: boolean,
  ) {
    this.object.name = "Palmino";
    this.atlas = createPalminoAtlas(lowPower);

    let env: Texture | null = null;
    if (gl) {
      const pmrem = new PMREMGenerator(gl);
      const room = new RoomEnvironment();
      env = pmrem.fromScene(room, 0.04).texture;
      room.dispose();
      pmrem.dispose();
    }
    this.envTexture = env;

    // --- scheletro ---
    this.bones = BONE_NAMES.map((name) => {
      const b = new Bone();
      b.name = name;
      const { parent, pos } = BONE_BIND[name];
      const pp = parent ? BONE_BIND[parent].pos : [0, 0, 0];
      b.position.set(pos[0] - pp[0], pos[1] - pp[1], pos[2] - pp[2]);
      if (name.startsWith("shoulder") || name.startsWith("elbow")) b.rotation.order = "YZX";
      return b;
    });
    for (const name of BONE_NAMES) {
      const parent = BONE_BIND[name].parent;
      if (parent) this.bones[BONE[parent]].add(this.bones[BONE[name]]);
    }

    // --- corpo: un solo SkinnedMesh ---
    const body = buildPalminoBody(lowPower);
    this.bodyMaterial = new MeshStandardMaterial({
      vertexColors: true,
      map: this.atlas.map,
      roughnessMap: this.atlas.roughnessMap,
      bumpMap: this.atlas.bumpMap,
      bumpScale: lowPower ? 0.8 : 1.3,
      roughness: 1,
      metalness: 0,
      envMap: env,
      envMapIntensity: 0.18,
    });
    // ACES sbiadisce i gialli molto saturi: solo per la cella "cloth" dell'atlante (i pantaloncini)
    // si riporta la saturazione dopo il tone mapping, così restano giallo limone sotto le luci.
    const projection = gl ? createRefProjection(lowPower) : null;
    this.projection = projection;
    this.bodyMaterial.onBeforeCompile = (shader) => {
      if (projection) injectBodyProjection(shader, projection.uniforms);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <tonemapping_fragment>",
        [
          "#include <tonemapping_fragment>",
          "#ifdef USE_MAP",
          "if (vMapUv.x > 0.5 && vMapUv.x < 0.625 && vMapUv.y > 0.875) {",
          "  float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));",
          "  gl_FragColor.rgb = clamp(vec3(lum) + (gl_FragColor.rgb - vec3(lum)) * 1.6, 0.0, 1.0);",
          "}",
          "#endif",
        ].join("\n"),
      );
    };
    this.bodyMaterial.customProgramCacheKey = () => (projection ? "palmino-body-proj" : "palmino-body");
    this.mesh = new SkinnedMesh(body.geometry, this.bodyMaterial);
    this.mesh.name = "PalminoBody";
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.add(this.bones[BONE.root]);
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new Skeleton(this.bones));
    this.object.add(this.mesh);

    // --- chioma ---
    this.leafSpecs = palminoLeafLayout();
    const n = this.leafSpecs.length;
    this.leaf = createLeafMaterial(lowPower, projection ? (shader) => injectLeafProjection(shader, projection.uniforms) : undefined);
    this.leaf.material.envMap = env;
    const leafGeo = buildLeafGeometry(lowPower);
    this.leafMesh = new InstancedMesh(leafGeo, this.leaf.material, n);
    this.leafMesh.name = "PalminoLeaves";
    this.leafMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.leafMesh.frustumCulled = false;
    this.leafMesh.castShadow = true;
    const tint = new Color();
    this.leafSpecs.forEach((s, i) => {
      const k = (0.9 + 0.2 * s.tint) * s.shade;
      tint.setRGB(k * (0.95 + 0.08 * s.tint), k, k * 0.92);
      this.leafMesh.setColorAt(i, tint);
    });
    if (this.leafMesh.instanceColor) this.leafMesh.instanceColor.needsUpdate = true;
    this.bones[BONE.crown].add(this.leafMesh);
    this.leafPitch = new Float32Array(n);
    this.leafPitchV = new Float32Array(n);
    this.leafYaw = new Float32Array(n);
    this.leafYawV = new Float32Array(n);

    const leafTris = ((leafGeo.index?.count ?? 0) / 3) * n;
    this.stats = { triangles: Math.round(body.triangles + leafTris), drawCalls: 2, bones: this.bones.length, leaves: n };
    // gerarchia "action-ready" ispezionabile (ossa per nome, statistiche)
    this.object.userData.sculptRuntime = {
      character: "palmino",
      stats: this.stats,
      bones: Object.fromEntries(this.bones.map((b) => [b.name, b])),
      animations: ANIMATIONS,
    };

    // posa iniziale = riposo
    restPose(this.pose);
    this.target.set(this.pose);
    this.weights[0] = 1;
    this.applyPose(0);
    this.updateLeaves(1 / 60, true);

    // proiezione del riferimento: matrici di riposo + depth pre-pass dalla camera del riferimento
    if (projection && gl) {
      this.object.updateMatrixWorld(true);
      const inverses = this.mesh.skeleton.boneInverses;
      const restBones = this.bones.map((b, i) => new Matrix4().multiplyMatrices(b.matrixWorld, inverses[i]));
      const crownRest = this.bones[BONE.crown].matrixWorld.clone();
      const src = this.leafMesh.instanceMatrix.array as Float32Array;
      for (let c = 0; c < 4; c++) {
        const col = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) col[i * 4 + k] = src[i * 16 + c * 4 + k];
        leafGeo.setAttribute(`aRest${c}`, new InstancedBufferAttribute(col, 4));
      }
      projection.bake(gl, this.object, restBones, crownRest);
    }
  }

  /** Avanza l'animazione. `mouthOpen` undefined = nessun lip-sync collegato. */
  update(dtRaw: number, animation: CharacterAnimation, mouthOpen: number | undefined, speed: number) {
    const dt = Math.min(Math.max(dtRaw, 0), 1 / 20);
    const sp = Math.max(0, speed);
    const adt = dt * sp;
    this.clock += adt;
    this.ctx.autoChatter = mouthOpen === undefined;

    // la scena può tenere Palmino nascosto a lungo (intro: entra a 14 s) mentre il modello è già
    // montato: quando torna visibile la clip corrente riparte da 0, così l'entrata è a tempo
    const shown = this.isShown();
    if (shown && !this.wasShown && this.started) this.restartCurrent();
    this.wasShown = shown;

    // --- cambio clip con cross-fade ---
    const idx = Math.max(0, ANIMATIONS.indexOf(animation));
    if (!this.started) {
      // primo frame: nessun cross-fade, si parte direttamente dalla clip richiesta
      this.weights.fill(0);
      this.weights[idx] = 1;
      this.times[idx] = 0;
      this.current = idx;
      this.started = true;
    } else if (idx !== this.current) {
      if (ONE_SHOT[animation] !== undefined || this.weights[idx] < 0.05) this.times[idx] = 0;
      this.current = idx;
    }
    const fadeStep = dt / FADE;
    let sum = 0;
    for (let i = 0; i < this.weights.length; i++) {
      const w = this.weights[i] + (i === this.current ? fadeStep : -fadeStep);
      this.weights[i] = Math.min(1, Math.max(0, w));
      if (this.weights[i] > 0) this.times[i] += adt;
      sum += this.weights[i];
    }
    this.target.fill(0);
    for (let i = 0; i < this.weights.length; i++) {
      const w = this.weights[i];
      if (w <= 0) continue;
      evaluateClip(ANIMATIONS[i], this.temp, this.times[i], this.ctx);
      const k = w / (sum || 1);
      for (let c = 0; c < CHANNEL_COUNT; c++) this.target[c] += this.temp[c] * k;
    }

    // --- molle (rimbalzo secondario) ---
    const sub = 2;
    const h = dt / sub;
    for (let c = 0; c < CHANNEL_COUNT; c++) {
      const k = this.stiffness[c];
      if (k <= 0) {
        this.pose[c] = this.target[c];
        this.vel[c] = 0;
        continue;
      }
      const damp = 2 * Math.sqrt(k) * 0.42;
      for (let s = 0; s < sub; s++) {
        const a = k * (this.target[c] - this.pose[c]) - damp * this.vel[c];
        this.vel[c] += a * h;
        this.pose[c] += this.vel[c] * h;
      }
    }

    // --- lip-sync ---
    const m = Math.min(1, Math.max(0, mouthOpen ?? 0));
    const rate = m > this.mouthSmooth ? 32 : 20;
    this.mouthSmooth += (m - this.mouthSmooth) * (1 - Math.exp(-dt * rate));
    const actTarget = m > 0.04 ? 1 : 0;
    this.talkActivity += (actTarget - this.talkActivity) * (1 - Math.exp(-dt * (actTarget ? 10 : 1.6)));

    this.applyPose(dt);
    this.leaf.uniforms.uTime.value = this.clock;
    this.updateLeaves(dt, false);
  }

  /**
   * Se la scena ha già un environment (es. Lightformer dell'intro) i materiali usano quello,
   * altrimenti l'ambiente "studio" interno, così le lenti e le foglie restano lucide.
   */
  syncEnvironment(sceneEnvironment: Texture | null) {
    const own = sceneEnvironment === null;
    if (own === this.usingOwnEnv) return;
    this.usingOwnEnv = own;
    const env = own ? this.envTexture : null;
    this.bodyMaterial.envMap = env;
    this.leaf.material.envMap = env;
    this.bodyMaterial.needsUpdate = true;
    this.leaf.material.needsUpdate = true;
  }

  private isShown() {
    for (let o: Object3D | null = this.object; o; o = o.parent) if (!o.visible) return false;
    return true;
  }

  /** Riparte dalla clip corrente senza cross-fade (molle e foglie azzerate). */
  private restartCurrent() {
    this.weights.fill(0);
    this.weights[this.current] = 1;
    this.times.fill(0);
    evaluateClip(ANIMATIONS[this.current], this.pose, 0, this.ctx);
    this.target.set(this.pose);
    this.vel.fill(0);
    this.leafPitchV.fill(0);
    this.leafYawV.fill(0);
    this.applyPose(0);
    this.updateLeaves(1 / 60, true);
  }

  private applyPose(dt: number) {
    const p = this.pose;
    const b = this.bones;
    const root = b[BONE.root];
    const st = Math.max(0.3, p[CH.stretch]);
    const inv = 1 / Math.sqrt(st);
    root.position.set(p[CH.rootX], p[CH.rootY], p[CH.rootZ]);
    root.rotation.set(p[CH.rootRotX], p[CH.rootRotY], p[CH.rootRotZ]);
    root.scale.set(inv, st, inv);

    b[BONE.hips].rotation.set(p[CH.hipsRotX], p[CH.hipsRotY], p[CH.hipsRotZ]);
    b[BONE.sleeveLow].rotation.set(p[CH.lowRotX], 0, p[CH.lowRotZ]);
    b[BONE.sleeveHigh].rotation.set(p[CH.highRotX], 0, p[CH.highRotZ]);

    const talk = this.talkActivity;
    const speech = this.mouthSmooth;
    b[BONE.head].rotation.set(p[CH.headRotX] + 0.06 * speech * talk, p[CH.headRotY], p[CH.headRotZ]);

    // mandibola: sorriso di base (dalla clip) che lascia il posto al lip-sync mentre parla
    const grin = Math.min(1, Math.max(0, p[CH.grin])) * (1 - 0.85 * talk);
    const jaw = Math.max(grin, speech);
    const jb = b[BONE.jaw];
    jb.rotation.x = 0.4 * jaw;
    // aprendo, la mandibola scende e rientra un po' nel tronco: i bordi del labbro inferiore e della
    // superficie della mandibola non sbucano più dalla corteccia sotto la bocca
    jb.position.set(0, JAW_BIND[1] - BONE_BIND.head.pos[1] - 0.07 * jaw, JAW_BIND[2] - 0.026 * jaw);

    this.applyArm(ARM_L, 1, BONE.shoulderL, BONE.elbowL, BONE.handL, BONE.indexL, BONE.middleL, BONE.ringL, BONE.thumbL);
    this.applyArm(ARM_R, -1, BONE.shoulderR, BONE.elbowR, BONE.handR, BONE.indexR, BONE.middleR, BONE.ringR, BONE.thumbR);

    const fl = b[BONE.footL];
    fl.position.y = BONE_BIND.footL.pos[1] + p[CH.footLLift];
    fl.rotation.x = p[CH.footLPitch];
    const fr = b[BONE.footR];
    fr.position.y = BONE_BIND.footR.pos[1] + p[CH.footRLift];
    fr.rotation.x = p[CH.footRPitch];

    // velocità di rotazione (per il ritardo delle foglie)
    const yaw = p[CH.rootRotY] + p[CH.hipsRotY] + p[CH.headRotY];
    if (dt > 0) {
      let d = yaw - this.prevYaw;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      this.yawRate += (d / dt - this.yawRate) * 0.3;
    }
    this.prevYaw = yaw;
  }

  private applyArm(base: number, s: number, sh: number, el: number, hand: number, idx: number, mid: number, ring: number, thumb: number) {
    const p = this.pose;
    const b = this.bones;
    b[sh].rotation.set(p[base + ARM.shX], -s * p[base + ARM.shY], s * p[base + ARM.shZ]);
    b[el].rotation.set(0, -s * p[base + ARM.elY], s * p[base + ARM.elZ]);
    b[hand].rotation.set(p[base + ARM.wrX], -s * p[base + ARM.wrY], s * p[base + ARM.wrZ]);
    const curl = p[base + ARM.curl];
    b[idx].rotation.set(0, -s * p[base + ARM.index], 0);
    b[mid].rotation.set(0, -s * curl, 0);
    b[ring].rotation.set(0, -s * curl * 1.05, 0);
    b[thumb].rotation.set(p[base + ARM.thumb], 0, s * -0.1 * p[base + ARM.thumb]);
  }

  private updateLeaves(dt: number, reset: boolean) {
    const crown = this.bones[BONE.crown];
    crown.updateWorldMatrix(true, false);
    _pos.setFromMatrixPosition(crown.matrixWorld);
    if (reset || dt <= 0) {
      this.prevCrown.copy(_pos);
      this.prevCrownVel.set(0, 0, 0);
      this.crownAcc.set(0, 0, 0);
    } else {
      _vel.copy(_pos).sub(this.prevCrown).divideScalar(dt);
      _acc.copy(_vel).sub(this.prevCrownVel).divideScalar(dt);
      this.crownAcc.lerp(_acc, 0.35);
      this.prevCrown.copy(_pos);
      this.prevCrownVel.copy(_vel);
    }
    // accelerazione nel riferimento locale della chioma
    crown.matrixWorld.decompose(_lp, _q, _ls);
    _qInv.copy(_q).invert();
    _acc.copy(this.crownAcc).applyQuaternion(_qInv);
    const ax = Math.max(-60, Math.min(60, _acc.x));
    const ay = Math.max(-60, Math.min(60, _acc.y));
    const az = Math.max(-60, Math.min(60, _acc.z));

    const p = this.pose;
    const lift = p[CH.leafLift];
    const flap = p[CH.leafFlap];
    const t = this.clock;
    const h = dt / 2;
    for (let i = 0; i < this.leafSpecs.length; i++) {
      const L = this.leafSpecs[i];
      const sa = Math.sin(L.azimuth);
      const ca = Math.cos(L.azimuth);
      const along = ax * sa + az * ca;
      const across = ax * ca - az * sa;
      const scale = L.length > 0.3 ? 1 : 0.5;
      let pitchT = (ay * 0.016 - along * 0.006) * scale + lift * scale;
      pitchT += 0.03 * Math.sin(t * 1.7 + i * 1.3);
      pitchT += flap * 0.32 * scale * Math.sin(t * 12.5 + i * 1.9);
      const yawT = (-across * 0.008 - this.yawRate * 0.05) * scale + 0.02 * Math.sin(t * 1.1 + i * 2.1);
      if (reset) {
        this.leafPitch[i] = pitchT;
        this.leafYaw[i] = yawT;
      } else {
        const k = L.stiffness;
        const c = 2 * Math.sqrt(k) * 0.32;
        for (let s = 0; s < 2; s++) {
          this.leafPitchV[i] += (k * (pitchT - this.leafPitch[i]) - c * this.leafPitchV[i]) * h;
          this.leafPitch[i] += this.leafPitchV[i] * h;
          this.leafYawV[i] += (k * (yawT - this.leafYaw[i]) - c * this.leafYawV[i]) * h;
          this.leafYaw[i] += this.leafYawV[i] * h;
        }
        this.leafPitch[i] = Math.max(-1, Math.min(1, this.leafPitch[i]));
        this.leafYaw[i] = Math.max(-0.8, Math.min(0.8, this.leafYaw[i]));
      }
      _lp.set(L.radius * sa, L.y, L.radius * ca);
      _e.set(L.pitch + this.leafPitch[i], L.azimuth + this.leafYaw[i], L.roll, "YXZ");
      _q.setFromEuler(_e);
      _s.set(L.length * L.width, L.length, L.length);
      _m.compose(_lp, _q, _s);
      this.leafMesh.setMatrixAt(i, _m);
    }
    this.leafMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.object.removeFromParent();
    // Chrome/ANGLE con KHR_parallel_shader_compile: un programma linkato (es. da `gl.compile` della
    // scena) e cancellato senza essere mai stato usato o interrogato fa loggare in loop
    // "GL_INVALID_VALUE: glGetProgramiv: Program object expected". Prima di liberare i materiali se
    // ne legge lo stato di link, così la cancellazione avviene su un programma "risolto".
    if (this.gl) settlePrograms(this.gl, [this.bodyMaterial, this.leaf.material]);
    this.mesh.geometry.dispose();
    this.bodyMaterial.dispose();
    this.mesh.skeleton.dispose();
    this.leafMesh.geometry.dispose();
    this.leaf.material.dispose();
    this.leafMesh.dispose();
    this.atlas.dispose();
    this.envTexture?.dispose();
    this.projection?.dispose();
  }
}
