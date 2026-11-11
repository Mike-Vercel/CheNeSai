import { PMREMGenerator, Vector3, type Texture, type WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { CharacterAnimation } from "../types";
import { ANIMS, CH, CHANNELS, ROT_BONES, S, rx, ry, rz, type AnimCtx } from "./animations";
import { B, buildRegina, type ReginaBuild } from "./build";

/** Mappa d'ambiente condivisa per renderer (riflessi di oro, vetro, occhi). Non viene mai rilasciata: è piccola e riusata. */
const ENV_CACHE = new WeakMap<WebGLRenderer, Texture>();
function getEnvMap(gl: WebGLRenderer): Texture | null {
  const cached = ENV_CACHE.get(gl);
  if (cached) return cached;
  try {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const tex = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    ENV_CACHE.set(gl, tex);
    return tex;
  } catch {
    return null;
  }
}

const FADE = 0.3;
const JAW_CLOSED = -0.1; // chiude la fessura di riposo
const JAW_RANGE = 0.5;
const LID_CLOSE = 1.2;
/** Rotazione Y massima complessiva (bacino+busto+testa): ~13°, sempre di fronte alla camera. */
const YAW_LIMIT = 0.23;
const HAIR = [B.hairR1, B.hairL1, B.hairB1, B.hairR2, B.hairL2, B.hairB2, B.bun] as const;

const _v = new Vector3();

/**
 * Rig procedurale: possiede mesh/ossa/materiali e aggiorna la posa ogni frame
 * senza allocazioni.
 */
export class ReginaRig {
  readonly build: ReginaBuild;
  private readonly cur = new Float32Array(CHANNELS);
  private readonly from = new Float32Array(CHANNELS);
  private readonly out = new Float32Array(CHANNELS);
  private anim: CharacterAnimation | null = null;
  private animTime = 0;
  private fade = 1;
  private time = 0;
  private mouth = 0;
  private lastVoice = -10;
  private readonly ctx: AnimCtx = { voice: 0, time: 0 };
  // molle dei capelli: [angoloX, velX, angoloZ, velZ] per osso
  private readonly spring = new Float32Array(HAIR.length * 4);
  private readonly prevHead = new Float32Array(3);
  private readonly trayPrev = new Vector3();
  private readonly trayVel = new Vector3();
  private trayInit = false;

  constructor(gl: WebGLRenderer | null, lowPower: boolean) {
    this.build = buildRegina({ lowPower, envMap: gl ? getEnvMap(gl) : null });
  }

  get root() {
    return this.build.root;
  }

  update(dtIn: number, anim: CharacterAnimation, mouthOpen: number, speed: number): void {
    const dt = Math.min(Math.max(dtIn, 0), 1 / 20);
    const sdt = dt * Math.max(0, speed);
    const { bones, restPositions } = this.build;

    if (anim !== this.anim) {
      if (this.anim !== null) this.from.set(this.out);
      this.fade = this.anim === null ? 1 : 0;
      this.anim = anim;
      this.animTime = 0;
    }
    this.animTime += sdt;
    this.time += sdt;
    this.fade = Math.min(1, this.fade + (speed > 0 ? dt / FADE : 0));

    // lip-sync: leggero smoothing e rilevamento voce attiva
    const target = Math.min(1, Math.max(0, mouthOpen || 0));
    this.mouth += (target - this.mouth) * Math.min(1, dt * 30);
    if (target > 0.02) this.lastVoice = this.time;
    this.ctx.voice = this.time - this.lastVoice < 0.6 ? 1 : 0;
    this.ctx.time = this.time;

    const p = this.cur;
    p.fill(0);
    ANIMS[anim](this.animTime, p, this.ctx);

    const f = this.fade;
    const w = f * f * (3 - 2 * f);
    const o = this.out;
    for (let i = 0; i < CHANNELS; i++) o[i] = this.from[i] + (p[i] - this.from[i]) * w;

    // sicurezza: il volto resta rivolto al pubblico. La somma delle rotazioni Y della catena
    // bacino→testa non supera ±YAW_LIMIT (anche durante le dissolvenze o dopo un rimontaggio).
    const yawSum = o[ry(S.root)] + o[ry(S.spine)] + o[ry(S.chest)] + o[ry(S.neck)] + o[ry(S.head)];
    if (yawSum > YAW_LIMIT) o[ry(S.root)] -= yawSum - YAW_LIMIT;
    else if (yawSum < -YAW_LIMIT) o[ry(S.root)] -= yawSum + YAW_LIMIT;

    // chi parla muove un po' la testa
    o[rx(S.head)] += 0.04 * this.mouth;

    // --- applica alle ossa
    for (let s = 0; s < ROT_BONES.length; s++) {
      bones[ROT_BONES[s]].rotation.set(o[s * 3], o[s * 3 + 1], o[s * 3 + 2]);
    }
    const rootBone = bones[B.root];
    rootBone.position.set(restPositions[B.root].x, restPositions[B.root].y + o[CH.posY], restPositions[B.root].z + o[CH.posZ]);

    const jawOpen = Math.min(1.1, Math.max(o[CH.jaw], this.mouth * 1.05));
    bones[B.jaw].rotation.x = JAW_CLOSED + jawOpen * JAW_RANGE;

    bones[B.lidR].rotation.x = Math.max(-0.45, o[CH.blinkR]) * LID_CLOSE;
    bones[B.lidL].rotation.x = Math.max(-0.45, o[CH.blinkL]) * LID_CLOSE;
    bones[B.eyeR].rotation.set(-o[CH.eyeY] * 0.3, o[CH.eyeX] * 0.35, 0);
    bones[B.eyeL].rotation.set(-o[CH.eyeY] * 0.3, o[CH.eyeX] * 0.35, 0);
    const br = restPositions[B.browR];
    const bl = restPositions[B.browL];
    bones[B.browR].position.set(br.x, br.y + o[CH.browR] * 0.012, br.z);
    bones[B.browL].position.set(bl.x, bl.y + o[CH.browL] * 0.012, bl.z);
    bones[B.browR].rotation.z = -o[CH.browR] * 0.08;
    bones[B.browL].rotation.z = o[CH.browL] * 0.08;

    // --- capelli: molle smorzate che compensano l'inclinazione della testa
    const roll = o[rz(S.spine)] + o[rz(S.chest)] + o[rz(S.neck)] + o[rz(S.head)];
    const pitch = o[rx(S.spine)] + o[rx(S.chest)] + o[rx(S.neck)] + o[rx(S.head)];
    const hvx = dt > 0 ? (o[rx(S.head)] - this.prevHead[0]) / dt : 0;
    const hvy = dt > 0 ? (o[ry(S.head)] - this.prevHead[1]) / dt : 0;
    const hvz = dt > 0 ? (o[rz(S.head)] - this.prevHead[2]) / dt : 0;
    this.prevHead[0] = o[rx(S.head)];
    this.prevHead[1] = o[ry(S.head)];
    this.prevHead[2] = o[rz(S.head)];
    const bounce = o[CH.posY];
    const sp = this.spring;
    const sway = 0.02 * Math.sin(this.time * 1.3);
    for (let i = 0; i < HAIR.length; i++) {
      const second = i >= 3 && i < 6;
      const isBun = i === 6;
      let tx: number;
      let tz: number;
      if (isBun) {
        tx = -hvx * 0.03 - bounce * 2;
        tz = -hvz * 0.03 - hvy * 0.01;
      } else if (!second) {
        tx = -pitch * 0.45 - hvx * 0.04 + bounce * 1.5;
        tz = -roll * 0.5 - hvz * 0.05 + sway * (i === 0 ? 1 : -1);
      } else {
        // segue con ritardo l'anello superiore (follow-through)
        tx = sp[(i - 3) * 4] * 0.5;
        tz = sp[(i - 3) * 4 + 2] * 0.5;
      }
      const k = isBun ? 120 : second ? 45 : 70;
      const c = isBun ? 9 : second ? 6 : 8;
      const j = i * 4;
      sp[j + 1] += ((tx - sp[j]) * k - sp[j + 1] * c) * dt;
      sp[j] += sp[j + 1] * dt;
      sp[j + 3] += ((tz - sp[j + 2]) * k - sp[j + 3] * c) * dt;
      sp[j + 2] += sp[j + 3] * dt;
      sp[j] = Math.max(-0.5, Math.min(0.5, sp[j]));
      sp[j + 2] = Math.max(-0.5, Math.min(0.5, sp[j + 2]));
      bones[HAIR[i]].rotation.set(sp[j], 0, sp[j + 2]);
    }

    // --- vassoio: segue il palmo ma resta in bolla (lieve inclinazione dai gesti)
    const hand = bones[B.handR];
    hand.updateWorldMatrix(true, false);
    _v.copy(this.build.traySocket).applyMatrix4(hand.matrixWorld);
    rootBone.worldToLocal(_v);
    if (!this.trayInit) {
      this.trayPrev.copy(_v);
      this.trayInit = true;
    }
    if (dt > 0) {
      const ax = (_v.x - this.trayPrev.x) / dt;
      const az = (_v.z - this.trayPrev.z) / dt;
      this.trayVel.x += (ax - this.trayVel.x) * Math.min(1, dt * 8);
      this.trayVel.z += (az - this.trayVel.z) * Math.min(1, dt * 8);
    }
    this.trayPrev.copy(_v);
    const tray = bones[B.tray];
    tray.position.copy(_v);
    const tiltX = Math.max(-0.12, Math.min(0.12, this.trayVel.z * 0.25)) + o[CH.trayX];
    const tiltZ = Math.max(-0.12, Math.min(0.12, -this.trayVel.x * 0.25)) + o[CH.trayZ];
    tray.rotation.set(tiltX, o[ry(S.chest)] * 0.5, tiltZ);
  }

  /** Libera le risorse GPU (idempotente: se il rig viene riusato, three le ricarica). */
  dispose(): void {
    for (const m of this.build.meshes) m.geometry.dispose();
    for (const m of this.build.materials) m.dispose();
    this.build.skeleton.dispose();
    for (const t of this.build.textures) t.dispose();
  }
}
