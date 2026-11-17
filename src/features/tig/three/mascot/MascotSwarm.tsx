"use client";

import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  FrontSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type ShaderMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MascotLevel, MascotProps } from "../../arena-contract";
import { mascotHasLevelModel, mascotModelUrl } from "../../mascots/registry";
import { TIG } from "../palette";
import { additiveMapMaterial, coneMaterial, glyphMaterial, hologramMaterial, spriteMaterial } from "../arena/fx-materials";
import { bandTexture, canvasTex, digitAtlas, glowTexture, ringTexture } from "../arena/textures";
import { EVOLVE_BURST_S, actionIsLively, mascotPose, restPose, shownLevel, type MascotPose } from "./mascot-motion";
import { MascotGlb } from "./MascotGlb";

/**
 * LE MASCOTTE (tutte insieme, istanziate): una sola draw call per ogni parte, che ci siano 1 o 20 mascotte.
 *
 * SEGNAPOSTO DICHIARATO (finché non arrivano i 12 GLB): totem olografico astratto — proiettore a terra con fascio
 * di luce, gemma sfaccettata che galleggia, numero dello slot dentro, fascia «MASCOTTE IN ARRIVO» che gira — tinto
 * col colore della squadra. Non è un personaggio finto: è chiaramente un ologramma provvisorio.
 *
 * EVOLUZIONE (generica: vale anche per i GLB futuri):
 *  - livello 2 «Potenziata»: luce propria più forte, aura, scintille che orbitano, anello esterno;
 *  - livello 3 «Leggendaria»: corona di luce sopra la testa, ali di energia, due anelli giroscopici, alone forte,
 *    riposo speciale (levita più in alto e disegna un otto);
 *  - transizione (`action: "evolve"` o livello che sale): carica, lampo con onda d'urto e colonna di luce, nuovo livello.
 * Azioni idle/cheer/sad/attack/hit/evolve/win: movimenti procedurali (mascot-motion.ts) sul segnaposto; sui GLB
 * veri le clip del registro, se ci sono, altrimenti gli stessi movimenti sul gruppo radice.
 */

export interface MascotEntry {
  key: string;
  slot: number | null;
  level: MascotLevel;
  color: string;
  online: boolean;
  action: MascotProps["action"];
  /** mostra lo scudo esagonale (spotlight "shield") */
  shield?: boolean;
  /** luminosità 0..1 (le altre torri si spengono un po' durante duello, caos e premiazione) */
  dim?: number;
}

/** Ancoraggi: per ogni mascotte x, y, z, yaw, scala (5 numeri), aggiornati da fuori senza render di React. */
export type AnchorsRef = RefObject<Float32Array>;

const STRIDE = 5;
const tmpEntry: MascotEntry = { key: "", slot: null, level: 1, color: "#ffffff", online: true, action: "idle" };
const ORBITERS = 8;
const tmpObj = new Object3D();
const mA = new Matrix4();
const mB = new Matrix4();
const mP = new Matrix4();
const vT = new Vector3();
const ZERO = new Matrix4().makeScale(0, 0, 0);
const cTmp = new Color();
const WHITE = new Color("#ffffff");
const GOLD = new Color(TIG.gold);

interface EntryState {
  action: MascotProps["action"];
  since: number;
  level: MascotLevel;
  prevLevel: MascotLevel;
  /** inizio dell'evoluzione automatica (livello salito senza azione "evolve") */
  autoEvolve: number;
  shield: number;
  pose: MascotPose;
}

function wingTexture(): CanvasTexture {
  return canvasTex(256, 192, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // ala di energia: piume a ventaglio che sfumano verso l'esterno
    for (let i = 0; i < 6; i++) {
      const a = -0.15 - i * 0.2;
      const len = 210 - i * 22;
      const g = ctx.createLinearGradient(8, h - 20, 8 + Math.cos(a) * len, h - 20 + Math.sin(a) * len);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 22 - i * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(8, h - 20);
      ctx.quadraticCurveTo(8 + Math.cos(a) * len * 0.5, h - 20 + Math.sin(a) * len * 0.5 - 18, 8 + Math.cos(a) * len, h - 20 + Math.sin(a) * len);
      ctx.stroke();
    }
  });
}

function hexDomeTexture(): CanvasTexture {
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = 18;
    const hh = Math.sqrt(3) * r;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    for (let row = -1; row < h / hh + 1; row++) {
      for (let col = -1; col < w / (r * 1.5) + 1; col++) {
        const x = col * r * 1.5;
        const y = row * hh + (col % 2 ? hh / 2 : 0);
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const px = x + Math.cos(a) * r * 0.9;
          const py = y + Math.sin(a) * r * 0.9;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  });
}

function crownGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const tall = i % 2 === 0 ? 0.2 : 0.13;
    const g = new ConeGeometry(0.035, tall, 4, 1);
    g.translate(Math.sin(a) * 0.17, tall / 2, Math.cos(a) * 0.17);
    parts.push(g.toNonIndexed());
  }
  const ring = new TorusGeometry(0.17, 0.014, 6, 32).toNonIndexed();
  ring.rotateX(Math.PI / 2);
  parts.push(ring);
  const merged = mergeGeometries(parts.map((p) => {
    p.deleteAttribute("uv");
    return p;
  }));
  for (const p of parts) p.dispose();
  return merged ?? new TorusGeometry(0.17, 0.02, 6, 32);
}

function makeMesh(geo: BufferGeometry, mat: ShaderMaterial, count: number, colors = true): InstancedMesh {
  const m = new InstancedMesh(geo, mat, Math.max(1, count));
  m.frustumCulled = false;
  m.count = count;
  for (let i = 0; i < Math.max(1, count); i++) m.setMatrixAt(i, ZERO);
  if (colors) {
    for (let i = 0; i < Math.max(1, count); i++) m.setColorAt(i, WHITE);
  }
  return m;
}

export interface MascotSwarmProps {
  entries: MascotEntry[];
  anchorsRef: AnchorsRef;
  /** azioni per mascotte (se presenti hanno la precedenza su `entries[i].action`), letti a ogni fotogramma */
  actionsRef?: RefObject<MascotProps["action"][]>;
  /** luminosità 0..1 per mascotte */
  dimRef?: RefObject<number[]>;
  /** scudo acceso per mascotte */
  shieldRef?: RefObject<boolean[]>;
  low: boolean;
  reduced: boolean;
  family: string;
  /** true finché qualcosa si muove (per il ritmo dei fotogrammi) */
  busyRef?: RefObject<boolean>;
}

export function MascotSwarm({ entries, anchorsRef, actionsRef, dimRef, shieldRef, low, reduced, family, busyRef }: MascotSwarmProps) {
  const n = entries.length;
  const textures = useMemo(() => ({ glow: glowTexture(), ring: ringTexture(), band: bandTexture(family), digits: digitAtlas(family), wing: wingTexture(), dome: hexDomeTexture() }), [family]);
  useEffect(
    () => () => {
      for (const t of Object.values(textures)) t.dispose();
    },
    [textures],
  );

  const parts = useMemo(() => {
    const holo = hologramMaterial();
    const coreGeo = new OctahedronGeometry(0.3, 0);
    coreGeo.scale(1, 1.55, 1);
    const innerGeo = new OctahedronGeometry(0.13, 0);
    innerGeo.scale(1, 1.4, 1);
    const fxAttr = (count: number) => new InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 4).fill(1), 4);
    const core = makeMesh(coreGeo, holo, n);
    coreGeo.setAttribute("aFx", fxAttr(n));
    const inner = makeMesh(innerGeo, holo, n);
    innerGeo.setAttribute("aFx", fxAttr(n));
    // proiettore: disco con anelli + fascio verso l'alto
    const padMat = additiveMapMaterial(textures.ring);
    const padGeo = new CircleGeometry(0.42, 40);
    padGeo.rotateX(-Math.PI / 2);
    padGeo.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1));
    const pad = makeMesh(padGeo, padMat, n);
    const beamGeo = new ConeGeometry(1, 1, 24, 1, true);
    beamGeo.rotateX(Math.PI);
    beamGeo.translate(0, 0.5, 0);
    const beam = makeMesh(beamGeo, coneMaterial(), n);
    // fascia «MASCOTTE IN ARRIVO»
    const bandMat = additiveMapMaterial(textures.band, -0.03);
    bandMat.side = FrontSide;
    const bandGeo = new CylinderGeometry(0.4, 0.4, 0.075, 64, 1, true);
    const uvs = bandGeo.getAttribute("uv");
    for (let i = 0; i < uvs.count; i++) uvs.setX(i, uvs.getX(i) * 2);
    bandGeo.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)).map((_, i) => i * 0.37), 1));
    const band = makeMesh(bandGeo, bandMat, n);
    // numero dello slot (2 cifre, sempre rivolte alla camera)
    const glyphGeo = new PlaneGeometry(0.75, 1);
    const glyphN = Math.max(1, n * 2);
    glyphGeo.setAttribute("aGlyph", new InstancedBufferAttribute(new Float32Array(glyphN), 1));
    glyphGeo.setAttribute("aAlpha", new InstancedBufferAttribute(new Float32Array(glyphN), 1));
    glyphGeo.setAttribute("aCenter", new InstancedBufferAttribute(new Float32Array(glyphN * 3), 3));
    glyphGeo.setAttribute("aOffset", new InstancedBufferAttribute(new Float32Array(glyphN * 2), 2));
    glyphGeo.setAttribute("aSize", new InstancedBufferAttribute(new Float32Array(glyphN), 1));
    const glyphs = makeMesh(glyphGeo, glyphMaterial(textures.digits, true), n * 2);
    glyphs.renderOrder = 6;
    // aura (livello 2+) e scintille in orbita
    const auraGeo = new PlaneGeometry(1, 1);
    const aura = makeMesh(auraGeo, spriteMaterial(textures.glow), n);
    const orbGeo = new PlaneGeometry(1, 1);
    const orbiters = makeMesh(orbGeo, spriteMaterial(textures.glow), n * ORBITERS);
    const ring2Geo = new TorusGeometry(0.5, 0.008, 6, 64);
    ring2Geo.rotateX(Math.PI / 2);
    ring2Geo.setAttribute("aFx", fxAttr(n));
    const ring2 = makeMesh(ring2Geo, holo, n);
    // livello 3: corona, anelli giroscopici, ali
    const crownGeo = crownGeometry();
    crownGeo.setAttribute("aFx", fxAttr(n));
    const crown = makeMesh(crownGeo, holo, n);
    const gyroGeo = new TorusGeometry(0.58, 0.012, 6, 72);
    gyroGeo.setAttribute("aFx", fxAttr(n * 2));
    const gyro = makeMesh(gyroGeo, holo, n * 2);
    const wingMat = additiveMapMaterial(textures.wing);
    const wingGeo = new PlaneGeometry(0.95, 0.72);
    wingGeo.translate(0.475, 0.3, 0);
    wingGeo.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array(Math.max(1, n * 2)), 1));
    const wings = makeMesh(wingGeo, wingMat, n * 2);
    // evoluzione: onda d'urto e colonna di luce
    const shockGeo = new PlaneGeometry(1, 1);
    shockGeo.rotateX(-Math.PI / 2);
    shockGeo.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1));
    const shock = makeMesh(shockGeo, additiveMapMaterial(textures.ring), n);
    const pillarGeo = new CylinderGeometry(0.3, 0.42, 1, 24, 1, true);
    pillarGeo.translate(0, 0.5, 0);
    const pillar = makeMesh(pillarGeo, coneMaterial(), n);
    // scudo esagonale
    const domeGeo = new SphereGeometry(0.78, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeo.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1));
    const dome = makeMesh(domeGeo, additiveMapMaterial(textures.dome, 0.02), n);
    const all = [pad, beam, core, inner, band, glyphs, aura, orbiters, ring2, crown, gyro, wings, shock, pillar, dome];
    return { holo, core, inner, pad, beam, band, glyphs, aura, orbiters, ring2, crown, gyro, wings, shock, pillar, dome, all };
  }, [n, textures]);
  useEffect(
    () => () => {
      const mats = new Set<ShaderMaterial>();
      for (const m of parts.all) {
        m.geometry.dispose();
        mats.add(m.material as ShaderMaterial);
        m.dispose();
      }
      for (const m of mats) m.dispose();
    },
    [parts],
  );

  const partsRef = useRef(parts);
  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);
  const states = useRef(new Map<string, EntryState>());
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  });
  const clock = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    clock.current += reduced ? 0 : dt;
    const t = clock.current;
    const list = entriesRef.current;
    const A = anchorsRef.current;
    const P = partsRef.current;
    const acts = actionsRef?.current;
    const dims = dimRef?.current;
    const shields = shieldRef?.current;
    for (const mat of [P.holo, P.band.material, P.dome.material] as ShaderMaterial[]) mat.uniforms.uTime.value = t;
    const coreFx = P.core.geometry.getAttribute("aFx") as InstancedBufferAttribute;
    const innerFx = P.inner.geometry.getAttribute("aFx") as InstancedBufferAttribute;
    const ring2Fx = P.ring2.geometry.getAttribute("aFx") as InstancedBufferAttribute;
    const crownFx = P.crown.geometry.getAttribute("aFx") as InstancedBufferAttribute;
    const gyroFx = P.gyro.geometry.getAttribute("aFx") as InstancedBufferAttribute;
    const gG = P.glyphs.geometry;
    const gGlyph = gG.getAttribute("aGlyph") as InstancedBufferAttribute;
    const gAlpha = gG.getAttribute("aAlpha") as InstancedBufferAttribute;
    const gCenter = gG.getAttribute("aCenter") as InstancedBufferAttribute;
    const gOffset = gG.getAttribute("aOffset") as InstancedBufferAttribute;
    const gSize = gG.getAttribute("aSize") as InstancedBufferAttribute;
    let lively = false;

    for (let i = 0; i < list.length; i++) {
      const base = list[i];
      const e = tmpEntry;
      e.key = base.key;
      e.slot = base.slot;
      e.level = base.level;
      e.color = base.color;
      e.online = base.online;
      e.action = acts?.[i] ?? base.action;
      e.dim = dims?.[i] ?? base.dim ?? 1;
      e.shield = shields?.[i] ?? base.shield ?? false;
      let s = states.current.get(e.key);
      if (!s) {
        s = { action: e.action, since: t, level: e.level, prevLevel: e.level, autoEvolve: -99, shield: 0, pose: restPose() };
        states.current.set(e.key, s);
      }
      if (e.action !== s.action) {
        s.action = e.action;
        s.since = t;
      }
      if (e.level !== s.level) {
        s.prevLevel = s.level;
        s.level = e.level;
        if (e.level > s.prevLevel && e.action !== "evolve") s.autoEvolve = t;
        if (e.action === "evolve") s.since = t;
      }
      const autoT = t - s.autoEvolve;
      const evolving = e.action === "evolve" || autoT < 3.2;
      const act: MascotProps["action"] = autoT < 3.2 ? "evolve" : e.action;
      const at = autoT < 3.2 ? autoT : t - s.since;
      const lvl = shownLevel(evolving ? "evolve" : act, at, s.level, s.prevLevel);
      const pose = mascotPose(e.online ? act : "idle", reduced ? 0 : at, t, lvl, s.pose);
      if (!reduced && actionIsLively(act, at)) lively = true;
      s.shield += ((e.shield ? 1 : 0) - s.shield) * (1 - Math.exp(-dt * 6));

      const ax = A[i * STRIDE];
      const ay = A[i * STRIDE + 1];
      const az = A[i * STRIDE + 2];
      const yaw = A[i * STRIDE + 3];
      const sc = A[i * STRIDE + 4] || 1;
      // matrice dell'ancoraggio (posizione sulla torre, verso il pubblico, scala della mascotte)
      tmpObj.position.set(ax, ay, az);
      tmpObj.rotation.set(0, yaw, 0);
      tmpObj.scale.setScalar(sc);
      tmpObj.updateMatrix();
      mA.copy(tmpObj.matrix);
      // posa procedurale
      tmpObj.position.set(pose.x, pose.y, pose.z);
      tmpObj.rotation.set(pose.tiltX, 0, pose.tiltZ);
      tmpObj.scale.set(pose.scale, pose.scale * pose.squash, pose.scale);
      tmpObj.updateMatrix();
      mP.multiplyMatrices(mA, tmpObj.matrix);
      const color = cTmp.set(e.color);
      const glow = pose.glow * (e.online ? 1 : 0.35) * (e.dim ?? 1);
      const glbUrl = mascotModelUrl(e.slot, lvl);
      const placeholder = !glbUrl;

      // proiettore e fascio
      tmpObj.position.set(0, 0.012, 0);
      tmpObj.rotation.set(0, t * 0.6 + i, 0);
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      mB.multiplyMatrices(mA, tmpObj.matrix);
      P.pad.setMatrixAt(i, mB);
      P.pad.setColorAt(i, cTmp.set(e.color).multiplyScalar(0.9 * glow));
      if (placeholder) {
        tmpObj.position.set(0, 0.02, 0);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.set(0.3, 0.95 + pose.y, 0.3);
        tmpObj.updateMatrix();
        mB.multiplyMatrices(mA, tmpObj.matrix);
        P.beam.setMatrixAt(i, mB);
        P.beam.setColorAt(i, cTmp.set(e.color).multiplyScalar(0.55 * glow));
      } else P.beam.setMatrixAt(i, ZERO);
      color.set(e.color);

      // gemma, nucleo, fascia, numero (solo segnaposto)
      if (placeholder) {
        tmpObj.position.set(0, 0.56, 0);
        tmpObj.rotation.set(0, t * 0.7 + pose.rotY, 0);
        tmpObj.scale.setScalar(1);
        tmpObj.updateMatrix();
        mB.multiplyMatrices(mP, tmpObj.matrix);
        P.core.setMatrixAt(i, mB);
        P.core.setColorAt(i, color);
        coreFx.setXYZW(i, glow, pose.flash, pose.hurt, e.online ? 1 : 0);
        tmpObj.rotation.set(0, -t * 1.3 - pose.rotY, 0);
        tmpObj.updateMatrix();
        mB.multiplyMatrices(mP, tmpObj.matrix);
        P.inner.setMatrixAt(i, mB);
        P.inner.setColorAt(i, cTmp.set(e.color).lerp(WHITE, 0.45));
        innerFx.setXYZW(i, glow * 1.3, pose.flash, pose.hurt, e.online ? 1 : 0);
        tmpObj.position.set(0, 0.18, 0);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.updateMatrix();
        mB.multiplyMatrices(mA, tmpObj.matrix);
        P.band.setMatrixAt(i, mB);
        P.band.setColorAt(i, cTmp.set(e.color).lerp(WHITE, 0.35).multiplyScalar(1.1 * (e.online ? 1 : 0.5) * (e.dim ?? 1)));
        // numero dello slot al centro della gemma
        vT.set(0, 0.56, 0).applyMatrix4(mP);
        const label = e.slot ? String(e.slot).padStart(2, "0") : "··";
        for (let k = 0; k < 2; k++) {
          const gi = i * 2 + k;
          const ch = label[k];
          gGlyph.setX(gi, ch === "·" ? 12 : Number(ch));
          gAlpha.setX(gi, (e.online ? 0.95 : 0.5) * (1 - pose.flash * 0.6) * (0.35 + 0.65 * (e.dim ?? 1)));
          gCenter.setXYZ(gi, vT.x, vT.y, vT.z);
          gOffset.setXY(gi, (k - 0.5) * 0.62, 0);
          gSize.setX(gi, 0.2 * sc * pose.scale);
          P.glyphs.setColorAt(gi, cTmp.set(e.color).lerp(WHITE, 0.7));
        }
      } else {
        P.core.setMatrixAt(i, ZERO);
        P.inner.setMatrixAt(i, ZERO);
        P.band.setMatrixAt(i, ZERO);
        gAlpha.setX(i * 2, 0);
        gAlpha.setX(i * 2 + 1, 0);
      }

      // aura e scintille (livello 2+), anello esterno
      const l2 = lvl >= 2 ? 1 : 0;
      const l3 = lvl >= 3 ? 1 : 0;
      if (l2 || pose.flash > 0.05) {
        vT.set(0, 0.56, 0).applyMatrix4(mP);
        tmpObj.position.copy(vT);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.setScalar(sc * (1.5 + 0.6 * l3 + pose.flash * 1.6) * (1 + 0.05 * Math.sin(t * 3 + i)));
        tmpObj.updateMatrix();
        P.aura.setMatrixAt(i, tmpObj.matrix);
        P.aura.setColorAt(i, cTmp.set(e.color).lerp(l3 ? GOLD : WHITE, 0.15 + pose.flash * 0.6).multiplyScalar((0.32 + 0.3 * l3) * glow + pose.flash * 1.2));
      } else P.aura.setMatrixAt(i, ZERO);
      for (let k = 0; k < ORBITERS; k++) {
        const oi = i * ORBITERS + k;
        if (!l2 || low && k % 2) {
          P.orbiters.setMatrixAt(oi, ZERO);
          continue;
        }
        const a = t * (1.4 + 0.15 * k) + (k / ORBITERS) * Math.PI * 2;
        const r = 0.42 + 0.06 * Math.sin(t * 2 + k);
        vT.set(Math.cos(a) * r, 0.5 + 0.28 * Math.sin(a * 1.7 + k), Math.sin(a) * r).applyMatrix4(mA);
        tmpObj.position.copy(vT);
        tmpObj.scale.setScalar(sc * (0.07 + 0.03 * Math.sin(t * 5 + k)));
        tmpObj.updateMatrix();
        P.orbiters.setMatrixAt(oi, tmpObj.matrix);
        P.orbiters.setColorAt(oi, cTmp.set(e.color).lerp(l3 ? GOLD : WHITE, 0.5).multiplyScalar(1.6 * glow));
      }
      if (l2) {
        tmpObj.position.set(0, 0.56 + 0.03 * Math.sin(t * 1.3), 0);
        tmpObj.rotation.set(0.25 * Math.sin(t * 0.7 + i), t * 0.4, 0.2 * Math.cos(t * 0.6));
        tmpObj.scale.setScalar(1);
        tmpObj.updateMatrix();
        mB.multiplyMatrices(mA, tmpObj.matrix);
        P.ring2.setMatrixAt(i, mB);
        P.ring2.setColorAt(i, color);
        ring2Fx.setXYZW(i, glow, pose.flash, 0, e.online ? 1 : 0);
      } else P.ring2.setMatrixAt(i, ZERO);

      // livello 3: corona, anelli giroscopici, ali
      if (l3) {
        tmpObj.position.set(0, placeholder ? 1.12 : 1.08, 0);
        tmpObj.rotation.set(0, t * 0.8, 0);
        tmpObj.scale.setScalar(1 + 0.04 * Math.sin(t * 2.4));
        tmpObj.updateMatrix();
        mB.multiplyMatrices(mP, tmpObj.matrix);
        P.crown.setMatrixAt(i, mB);
        P.crown.setColorAt(i, cTmp.copy(GOLD).lerp(color.set(e.color), 0.25));
        crownFx.setXYZW(i, glow * 1.4, pose.flash, 0, e.online ? 1 : 0);
        for (let k = 0; k < 2; k++) {
          const gi = i * 2 + k;
          tmpObj.position.set(0, 0.56, 0);
          tmpObj.rotation.set(k ? 1.1 + t * 0.9 : 0.4 - t * 0.7, k ? t * 0.5 : 0.9, k ? 0.3 : t * 1.1);
          tmpObj.scale.setScalar(k ? 0.92 : 1.06);
          tmpObj.updateMatrix();
          mB.multiplyMatrices(mA, tmpObj.matrix);
          P.gyro.setMatrixAt(gi, mB);
          P.gyro.setColorAt(gi, k ? cTmp.copy(GOLD) : cTmp.set(e.color));
          gyroFx.setXYZW(gi, glow, pose.flash, 0, e.online ? 1 : 0);
          // ali: dietro la gemma, battito lento
          const side = k ? -1 : 1;
          const flap = 0.35 + 0.22 * Math.sin(t * 2.1);
          tmpObj.position.set(side * 0.08, 0.55, -0.12);
          tmpObj.rotation.set(0, side > 0 ? -flap : Math.PI + flap, 0.25);
          tmpObj.scale.set(1, 1, 1);
          tmpObj.updateMatrix();
          mB.multiplyMatrices(mP, tmpObj.matrix);
          P.wings.setMatrixAt(gi, mB);
          P.wings.setColorAt(gi, cTmp.set(e.color).lerp(GOLD, 0.45).multiplyScalar(1.7 * glow));
        }
      } else {
        P.crown.setMatrixAt(i, ZERO);
        P.gyro.setMatrixAt(i * 2, ZERO);
        P.gyro.setMatrixAt(i * 2 + 1, ZERO);
        P.wings.setMatrixAt(i * 2, ZERO);
        P.wings.setMatrixAt(i * 2 + 1, ZERO);
      }

      // evoluzione: onda d'urto e colonna di luce attorno al lampo
      const burstT = evolving ? at - EVOLVE_BURST_S : 99;
      if (burstT > -1.2 && burstT < 1.6) {
        const k = Math.max(0, burstT);
        tmpObj.position.set(0, 0.03, 0);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.setScalar(0.3 + k * 3.2);
        tmpObj.updateMatrix();
        mB.multiplyMatrices(mA, tmpObj.matrix);
        P.shock.setMatrixAt(i, burstT >= 0 ? mB : ZERO);
        P.shock.setColorAt(i, cTmp.set(e.color).lerp(WHITE, 0.4).multiplyScalar(2 * Math.max(0, 1 - k / 1.6)));
        const pil = burstT < 0 ? (1.2 + burstT) / 1.2 : Math.max(0, 1 - burstT / 1.4);
        tmpObj.position.set(0, 0, 0);
        tmpObj.scale.set(1, 4.5, 1);
        tmpObj.updateMatrix();
        mB.multiplyMatrices(mA, tmpObj.matrix);
        P.pillar.setMatrixAt(i, mB);
        P.pillar.setColorAt(i, cTmp.set(e.color).lerp(WHITE, 0.3).multiplyScalar(1.4 * pil));
      } else {
        P.shock.setMatrixAt(i, ZERO);
        P.pillar.setMatrixAt(i, ZERO);
      }

      // scudo
      if (s.shield > 0.02) {
        tmpObj.position.set(0, 0, 0);
        tmpObj.rotation.set(0, t * 0.3, 0);
        tmpObj.scale.setScalar(0.85 + 0.15 * s.shield);
        tmpObj.updateMatrix();
        mB.multiplyMatrices(mA, tmpObj.matrix);
        P.dome.setMatrixAt(i, mB);
        P.dome.setColorAt(i, cTmp.set(TIG.cyan).multiplyScalar(0.9 * s.shield * (0.8 + 0.2 * Math.sin(t * 4))));
        lively = true;
      } else P.dome.setMatrixAt(i, ZERO);
    }

    for (const m of P.all) {
      // eslint-disable-next-line react-hooks/immutability -- three.js: gli attributi istanziati si segnano «da caricare» nel ciclo di disegno, è voluto
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    coreFx.needsUpdate = innerFx.needsUpdate = ring2Fx.needsUpdate = crownFx.needsUpdate = gyroFx.needsUpdate = true;
    gGlyph.needsUpdate = gAlpha.needsUpdate = gCenter.needsUpdate = gOffset.needsUpdate = gSize.needsUpdate = true;
    if (busyRef) busyRef.current = lively;
  });

  // modelli GLB veri (quando il registro li avrà): uno per mascotte, con gli effetti dei livelli qui sopra
  const glbEntries = entries.map((e, i) => ({ e, i, url: mascotModelUrl(e.slot, e.level) })).filter((x) => x.url);
  return (
    <group>
      {parts.all.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {glbEntries.map(({ e, i, url }) => (
        <Suspense key={e.key} fallback={null}>
          <MascotGlb url={url!} index={i} entry={e} anchorsRef={anchorsRef} actionsRef={actionsRef} levelModel={mascotHasLevelModel(e.slot, e.level)} reduced={reduced} />
        </Suspense>
      ))}
    </group>
  );
}

export { STRIDE as ANCHOR_STRIDE };
