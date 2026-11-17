"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, type RefObject } from "react";
import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from "three";
import type { ArenaTeam } from "../../arena-contract";
import { TIG, inkOn } from "../palette";
import { additiveMapMaterial, chaosRingMaterial, CRISP, glyphMaterial } from "./fx-materials";
import { REFLECT_LAYER } from "./FloorReflector";
import { bannerMaterial, goldStackMaterial } from "./pirate-materials";
import { BANNER_COLS, bannerAtlasSize, coinFaceTexture, drawBanners, plankTexture } from "./pirate-textures";
import { BASE_H, CAP_H, type ArenaLive } from "./live";
import { POD, type ArenaLayout } from "./layout";
import { deltaFlash, scoreDigits } from "./rank-anim";
import { digitAtlas, ringTexture } from "./textures";
import { spotlightLive } from "./director";
import { useLatestRef } from "./use-latest";

/**
 * LE POSTAZIONI DELLE CIURME (edizione pirati; istanziate: ogni parte è UNA draw call per tutte le postazioni).
 * Tamburo di legno cerchiato d'ottone con la corda nel colore della ciurma e la pozza di luce a terra · PILA DI
 * DOBLONI d'oro che sale e scende col punteggio · doblone grande in cima con l'anello dell'Energia Caos · STENDARDO
 * della ciurma su un'asta accanto (colore del tavolo, numero, ossa incrociate simpatiche) · targa di legno sempre
 * rivolta alla camera (numero del tavolo nel sigillo del colore della squadra + nome) · punteggio a cifre grandi
 * color oro che conta su/giù · lampo «+40». Tavolo offline: oro spento, stendardo grigio, «OFFLINE» sulla targa.
 * Con più di 12 squadre la fila dietro sta su una pedana (zoccolo esagonale sotto la base, `PodPlacement.y`).
 * Neon e spigoli escono sopra la soglia del bagliore; targhette e cifre sotto (nitide, con mipmap e anisotropia).
 */

const ZERO = new Matrix4().makeScale(0, 0, 0);
const tmp = new Object3D();
const cT = new Color();
const WHITE = new Color("#ffffff");
const GOLD = new Color(TIG.goldLight);
const CREAM = new Color(TIG.white);
const POOL_WARM = new Color(TIG.amber);
/** Stendardo: larghezza, altezza e quota dell'asta sopra il tamburo (m). */
const BANNER_W = 0.6;
const BANNER_H = 0.9;
const BANNER_TOP = 1.95;
const UP = new Color("#7dff9a");
const DOWN = new Color("#ff6b6b");
const SCORE_GLYPHS = 5;
const DELTA_GLYPHS = 5;

/** Atlante delle targhette: una cella per torre (numero del tavolo + nome su due righe). */
const CELL = { w: 640, h: 256 } as const;
const ATLAS_COLS = 3;

function labelAtlasSize(n: number) {
  const rows = Math.max(1, Math.ceil(n / ATLAS_COLS));
  return { w: CELL.w * ATLAS_COLS, h: CELL.h * rows, rows };
}

/** Divide il nome in al massimo due righe (a parola intera), troncando con «…» se serve. */
function twoLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) lines.splice(1, lines.length - 1, lines.slice(1).join(" "));
  return lines.map((l) => {
    let out = l;
    while (ctx.measureText(out).width > maxW && out.length > 2) out = `${out.slice(0, -2)}…`;
    return out;
  });
}

function drawLabels(canvas: HTMLCanvasElement, teams: ArenaTeam[], family: string) {
  const { w, h } = labelAtlasSize(teams.length);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  teams.forEach((t, i) => {
    const x = (i % ATLAS_COLS) * CELL.w;
    const y = Math.floor(i / ATLAS_COLS) * CELL.h;
    const color = t.online ? t.color : "#4a525c";
    const pad = 10;
    // targa di legno scuro con le venature, bordo d'ottone e chiodi agli angoli
    const plate = ctx.createLinearGradient(0, y + pad, 0, y + CELL.h - pad);
    plate.addColorStop(0, "rgba(92,60,34,0.97)");
    plate.addColorStop(0.5, "rgba(62,38,20,0.97)");
    plate.addColorStop(1, "rgba(40,24,12,0.97)");
    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, CELL.w - pad * 2, CELL.h - pad * 2, 26);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(20,10,4,0.28)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      const vy = y + 30 + k * 32;
      ctx.beginPath();
      for (let vx = x; vx <= x + CELL.w; vx += 16) ctx.lineTo(vx, vy + Math.sin(vx * 0.03 + k) * 3);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, CELL.w - pad * 2, CELL.h - pad * 2, 26);
    ctx.stroke();
    ctx.fillStyle = "#e0c070";
    for (const [cx, cy] of [
      [x + 30, y + 30],
      [x + CELL.w - 30, y + 30],
      [x + 30, y + CELL.h - 30],
      [x + CELL.w - 30, y + CELL.h - 30],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // numero del tavolo: bandierina quadrata nel colore della squadra, bordata di pergamena
    const bs = CELL.h - pad * 2 - 22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + pad + 11, y + pad + 11, bs, bs, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(241,226,191,0.9)";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = inkOn(color);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${t.tableNo >= 10 ? 150 : 172}px ${family}`;
    ctx.fillText(String(t.tableNo), x + pad + 11 + bs / 2, y + CELL.h / 2 + 10);
    // nome su due righe (o OFFLINE)
    const tx = x + pad + 11 + bs + 22;
    const maxW = CELL.w - (tx - x) - pad - 18;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    if (!t.online) {
      // tavolo offline: badge rosso su una riga sua, il nome sotto su una riga (mai sovrapposti)
      ctx.font = `800 36px ${family}`;
      const bw = ctx.measureText("OFFLINE").width + 28;
      ctx.fillStyle = "rgba(255,70,80,0.18)";
      ctx.strokeStyle = "#ff6b74";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(tx, y + 34, bw, 52, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff9aa1";
      ctx.textBaseline = "middle";
      ctx.fillText("OFFLINE", tx + 14, y + 62);
      ctx.textBaseline = "alphabetic";
    }
    let size = t.online ? 66 : 54;
    let lines: string[] = [];
    for (; size >= 36; size -= 4) {
      ctx.font = `800 ${size}px ${family}`;
      lines = t.online ? twoLines(ctx, t.name.toUpperCase(), maxW) : [t.name.toUpperCase()];
      if (lines.every((l) => ctx.measureText(l).width <= maxW && !l.endsWith("…"))) break;
    }
    if (!t.online) {
      let one = lines[0];
      while (ctx.measureText(one).width > maxW && one.length > 2) one = `${one.slice(0, -2)}…`;
      lines = [one];
    }
    ctx.fillStyle = t.online ? "#f6ead2" : "#a49c8e";
    const lh = size * 0.98;
    const total = lines.length * lh;
    const baseY = t.online ? y + CELL.h / 2 - total / 2 + size * 0.8 : y + 100 + size * 0.85;
    lines.slice(0, t.online ? 2 : 1).forEach((l, k) => ctx.fillText(l, tx, baseY + k * lh));
  });
}

/** Targhette sempre rivolte alla camera, una cella dell'atlante per istanza. */
function labelMaterial(map: CanvasTexture, rows: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uMap: { value: map }, uGrid: { value: [ATLAS_COLS, rows] } },
    vertexShader: /* glsl */ `
      attribute vec3 aCenter;
      attribute float aCell;
      attribute vec2 aSize;
      attribute float aAlpha;
      attribute float aCrop;
      uniform vec2 uGrid;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float col = mod(aCell, uGrid.x);
        float row = floor(aCell / uGrid.x);
        vUv = vec2((col + uv.x * aCrop) / uGrid.x, 1.0 - (row + 1.0 - uv.y) / uGrid.y);
        vAlpha = aAlpha;
        vec4 mv = viewMatrix * vec4(aCenter, 1.0);
        mv.xy += position.xy * aSize;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        if (t.a * vAlpha < 0.02) discard;
        // sotto la soglia del bagliore: le scritte restano nitide
        gl_FragColor = vec4(t.rgb * ${CRISP.toFixed(2)}, t.a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function instanced(geo: BufferGeometry, mat: Material, count: number, colors = false): InstancedMesh {
  const m = new InstancedMesh(geo, mat, Math.max(1, count));
  m.count = count;
  m.frustumCulled = false;
  for (let i = 0; i < Math.max(1, count); i++) {
    m.setMatrixAt(i, ZERO);
    if (colors) m.setColorAt(i, WHITE);
  }
  return m;
}

export interface PodsProps {
  liveRef: RefObject<ArenaLive>;
  teams: ArenaTeam[];
  layout: ArenaLayout;
  family: string;
  low: boolean;
  shadows: boolean;
  /** finestra stretta (telefono): targhette ridotte al solo numero del tavolo, più grandi */
  compact?: boolean;
  /** carattere di numeri ed etichette (targhe, cifre, stendardi) */
  numFamily?: string;
}

export function Pods({ liveRef, teams, layout, family, low, shadows, compact = false, numFamily }: PodsProps) {
  const n = teams.length;
  // targhe, cifre e stendardi col carattere dei numeri (leggibile da lontano); i titoli restano a `family`
  const labelFamily = numFamily ?? family;
  const atlas = useMemo(() => {
    const c = document.createElement("canvas");
    const s = labelAtlasSize(Math.max(1, n));
    c.width = s.w;
    c.height = s.h;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    // mipmap + anisotropia: da lontano le scritte si rimpiccioliscono pulite (niente sfarfallio né scalette)
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    return t;
  }, [n]);
  const digits = useMemo(() => {
    const d = digitAtlas(labelFamily);
    d.anisotropy = 8;
    return d;
  }, [labelFamily]);
  const ring = useMemo(() => ringTexture(), []);
  // stendardi delle ciurme (atlante, una cella per tavolo) e materiali del legno e dell'oro
  const banners = useMemo(() => {
    const c = document.createElement("canvas");
    const s0 = bannerAtlasSize(Math.max(1, n));
    c.width = s0.w;
    c.height = s0.h;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    return t;
  }, [n]);
  const tex = useMemo(() => ({ planks: plankTexture(512), coin: coinFaceTexture() }), []);
  useEffect(
    () => () => {
      atlas.dispose();
      digits.dispose();
      ring.dispose();
      banners.dispose();
      tex.planks.dispose();
      tex.coin.dispose();
    },
    [atlas, digits, ring, banners, tex],
  );

  // targhette: ridisegnate solo quando cambiano tavolo, nome, colore o stato online
  const labelKey = teams.map((t) => `${t.tableNo}|${t.name}|${t.color}|${t.online ? 1 : 0}`).join("§");
  const atlasRef = useLatestRef(atlas);
  const bannersRef = useLatestRef(banners);
  const teamsRef = useLatestRef(teams);
  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (!alive) return;
      const tex = atlasRef.current;
      drawLabels(tex.image as HTMLCanvasElement, teamsRef.current, labelFamily);
      tex.needsUpdate = true;
      const b = bannersRef.current;
      drawBanners(b.image as HTMLCanvasElement, teamsRef.current, labelFamily);
      b.needsUpdate = true;
    };
    draw();
    document.fonts?.ready.then(draw).catch(() => undefined);
    const late = setTimeout(draw, 1200);
    return () => {
      alive = false;
      clearTimeout(late);
    };
  }, [labelKey, atlas, banners, labelFamily, atlasRef, bannersRef, teamsRef]);

  const parts = useMemo(() => {
    // tamburo di legno (doghe) cerchiato d'ottone
    const baseGeo = new CylinderGeometry(0.72, 0.78, BASE_H, 14, 1);
    baseGeo.translate(0, BASE_H / 2, 0);
    const baseMat = new MeshStandardMaterial({ color: "#b8906a", map: tex.planks, roughness: 0.8, metalness: 0.02 });
    const base = instanced(baseGeo, baseMat, n);
    base.castShadow = false;
    base.receiveShadow = shadows;
    const hoopGeo = new TorusGeometry(0.76, 0.022, 6, 28);
    hoopGeo.rotateX(Math.PI / 2);
    const hoops = instanced(hoopGeo, new MeshStandardMaterial({ color: "#c9a24a", metalness: 0.9, roughness: 0.35 }), n * 2);
    // zoccolo della fila dietro (altezza = pedana, scala Y)
    const plinthGeo = new CylinderGeometry(0.86, 0.94, 1, 14, 1);
    plinthGeo.translate(0, 0.5, 0);
    const plinth = instanced(plinthGeo, new MeshStandardMaterial({ color: "#6b4a30", map: tex.planks, roughness: 0.85 }), n);
    // corda nel colore della ciurma attorno al bordo del tamburo e del doblone (un filo di luce: si legge da lontano)
    const rimGeo = new TorusGeometry(0.75, 0.03, 6, 28);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new MeshBasicMaterial({ toneMapped: false });
    const rim = instanced(rimGeo, rimMat, n * 2, true);
    const poolGeo = new PlaneGeometry(1, 1);
    poolGeo.rotateX(-Math.PI / 2);
    poolGeo.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1));
    const pool = instanced(poolGeo, additiveMapMaterial(ring), n, true);
    pool.renderOrder = 1;
    // pila di dobloni (altezza = punteggio): tanti segmenti in altezza per la pila un po' storta
    const colGeo = new CylinderGeometry(POD.radius * 0.84, POD.radius * 0.84, 1, 28, 40, true);
    colGeo.translate(0, 0.5, 0);
    colGeo.setAttribute("aState", new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
    const colMat = goldStackMaterial();
    const column = instanced(colGeo, colMat, n, true);
    // doblone grande in cima (la mascotte ci sta sopra)
    const capGeo = new CylinderGeometry(0.54, 0.54, CAP_H, 36, 1);
    capGeo.translate(0, CAP_H / 2, 0);
    const capMat = new MeshStandardMaterial({ color: "#ffd27a", map: tex.coin, metalness: 0.8, roughness: 0.32, envMapIntensity: 1.6, emissive: new Color(0.42, 0.27, 0.06), emissiveMap: tex.coin });
    const cap = instanced(capGeo, capMat, n);
    // stendardo della ciurma su un'asta accanto alla pila
    const poleGeo = new CylinderGeometry(0.03, 0.035, 1, 6);
    poleGeo.translate(0, 0.5, 0);
    const poles = instanced(poleGeo, new MeshStandardMaterial({ color: "#4a3020", roughness: 0.85 }), n);
    const banGeo = new PlaneGeometry(BANNER_W, BANNER_H, 6, 8);
    banGeo.translate(0, -BANNER_H / 2, 0);
    banGeo.setAttribute("aCell", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)).map((_, i) => i), 1));
    banGeo.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)).map((_, i) => i * 1.37), 1));
    banGeo.setAttribute("aState", new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 2).fill(1), 2));
    const banMat = bannerMaterial(banners, BANNER_COLS, bannerAtlasSize(Math.max(1, n)).rows);
    // l'atlante degli stendardi ha uv con l'origine in basso: la tela va dall'alto (v=1) al basso
    const bannerMesh = instanced(banGeo, banMat, n);
    const chaosGeo = new RingGeometry(0.62, 0.72, 64, 1);
    chaosGeo.setAttribute("aProgress", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1));
    chaosGeo.setAttribute("aLevel", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)).fill(1), 1));
    chaosGeo.setAttribute("aOnline", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)).fill(1), 1));
    const chaosMat = chaosRingMaterial(TIG.chaos);
    const chaos = instanced(chaosGeo, chaosMat, n);
    chaos.renderOrder = 3;
    const lblGeo = new PlaneGeometry(1, 1);
    lblGeo.setAttribute("aCenter", new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
    lblGeo.setAttribute("aCell", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)).map((_, i) => i), 1));
    lblGeo.setAttribute("aSize", new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 2), 2));
    lblGeo.setAttribute("aAlpha", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)).fill(1), 1));
    lblGeo.setAttribute("aCrop", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)).fill(1), 1));
    const labels = instanced(lblGeo, labelMaterial(atlas, labelAtlasSize(Math.max(1, n)).rows), n);
    labels.renderOrder = 8;
    // cifre del punteggio + lampo del cambio di punti, sempre rivolte alla camera
    const gN = Math.max(1, n * (SCORE_GLYPHS + DELTA_GLYPHS));
    const gGeo = new PlaneGeometry(0.72, 1);
    gGeo.setAttribute("aGlyph", new InstancedBufferAttribute(new Float32Array(gN), 1));
    gGeo.setAttribute("aAlpha", new InstancedBufferAttribute(new Float32Array(gN), 1));
    gGeo.setAttribute("aCenter", new InstancedBufferAttribute(new Float32Array(gN * 3), 3));
    gGeo.setAttribute("aOffset", new InstancedBufferAttribute(new Float32Array(gN * 2), 2));
    gGeo.setAttribute("aSize", new InstancedBufferAttribute(new Float32Array(gN), 1));
    const glyphs = instanced(gGeo, glyphMaterial(digits, true), n * (SCORE_GLYPHS + DELTA_GLYPHS), true);
    glyphs.renderOrder = 9;
    const all = [plinth, base, hoops, rim, pool, column, cap, poles, bannerMesh, chaos, labels, glyphs];
    // nel mare si riflettono le parti luminose (non targhette, cifre e pozze)
    for (const m of [rim, column, cap]) m.layers.enable(REFLECT_LAYER);
    return { plinth, base, hoops, rim, pool, column, colMat, cap, poles, bannerMesh, banMat, chaos, chaosMat, labels, glyphs, all };
  }, [n, atlas, digits, ring, shadows, banners, tex]);
  useEffect(
    () => () => {
      for (const m of parts.all) {
        m.geometry.dispose();
        (m.material as Material).dispose();
        m.dispose();
      }
    },
    [parts],
  );

  const partsRef = useLatestRef(parts);
  // matrici fisse (base, neon della base, pozza di luce): cambiano solo col layout
  useEffect(() => {
    const parts = partsRef.current;
    layout.pods.forEach((p, i) => {
      tmp.position.set(p.x, p.y, p.z);
      tmp.rotation.set(0, p.yaw, 0);
      tmp.scale.setScalar(layout.scale);
      tmp.updateMatrix();
      parts.base.setMatrixAt(i, tmp.matrix);
      // cerchi d'ottone del tamburo
      for (let k = 0; k < 2; k++) {
        tmp.position.set(p.x, p.y + (k ? BASE_H - 0.05 : 0.06), p.z);
        tmp.scale.setScalar(layout.scale);
        tmp.updateMatrix();
        parts.hoops.setMatrixAt(i * 2 + k, tmp.matrix);
      }
      // asta dello stendardo a sinistra della pila (vista dal pubblico) e traversa
      const sc0 = layout.scale;
      const c0 = Math.cos(p.yaw);
      const s0 = Math.sin(p.yaw);
      const lx = -0.62 * sc0;
      const lz = -0.3 * sc0;
      const px = p.x + lx * c0 + lz * s0;
      const pz = p.z - lx * s0 + lz * c0;
      tmp.position.set(px, p.y + BASE_H, pz);
      tmp.rotation.set(0, p.yaw, 0);
      tmp.scale.set(sc0, (BANNER_TOP + 0.12) * sc0, sc0);
      tmp.updateMatrix();
      parts.poles.setMatrixAt(i, tmp.matrix);
      // lo stendardo pende dalla cima dell'asta, appena davanti
      const fx = lx * c0 + (lz + 0.05 * sc0) * s0;
      const fz = -lx * s0 + (lz + 0.05 * sc0) * c0;
      tmp.position.set(p.x + fx, p.y + BASE_H + BANNER_TOP * sc0, p.z + fz);
      tmp.rotation.set(0, p.yaw, 0);
      tmp.scale.setScalar(sc0);
      tmp.updateMatrix();
      parts.bannerMesh.setMatrixAt(i, tmp.matrix);
      tmp.rotation.set(0, p.yaw, 0);
      if (p.y > 0.01) {
        tmp.position.set(p.x, 0, p.z);
        tmp.scale.set(layout.scale, p.y, layout.scale);
        tmp.updateMatrix();
        parts.plinth.setMatrixAt(i, tmp.matrix);
      } else parts.plinth.setMatrixAt(i, ZERO);
      tmp.position.set(p.x, 0.015, p.z);
      tmp.scale.setScalar(2.6 * layout.scale);
      tmp.updateMatrix();
      parts.pool.setMatrixAt(i, tmp.matrix);
    });
    parts.base.instanceMatrix.needsUpdate = true;
    parts.hoops.instanceMatrix.needsUpdate = true;
    parts.poles.instanceMatrix.needsUpdate = true;
    parts.bannerMesh.instanceMatrix.needsUpdate = true;
    parts.plinth.instanceMatrix.needsUpdate = true;
    parts.pool.instanceMatrix.needsUpdate = true;
  }, [layout, parts, partsRef]);

  useFrame((state) => {
    const parts = partsRef.current;
    const L = liveRef.current;
    const t = L.t;
    parts.colMat.uniforms.uTime.value = t;
    parts.chaosMat.uniforms.uTime.value = t;
    parts.banMat.uniforms.uTime.value = t;
    // vento: forte nell'allarme, quasi fermo in pausa
    const wind = L.dir.mood === "chaos" ? 2.2 : L.dir.mood === "break" ? 0.4 : 1;
    parts.banMat.uniforms.uWind.value += (wind - parts.banMat.uniforms.uWind.value) * 0.03;
    const banState = parts.bannerMesh.geometry.getAttribute("aState") as InstancedBufferAttribute;
    const colState = parts.column.geometry.getAttribute("aState") as InstancedBufferAttribute;
    const prog = parts.chaos.geometry.getAttribute("aProgress") as InstancedBufferAttribute;
    const lvl = parts.chaos.geometry.getAttribute("aLevel") as InstancedBufferAttribute;
    const onl = parts.chaos.geometry.getAttribute("aOnline") as InstancedBufferAttribute;
    const lc = parts.labels.geometry.getAttribute("aCenter") as InstancedBufferAttribute;
    const ls = parts.labels.geometry.getAttribute("aSize") as InstancedBufferAttribute;
    const la = parts.labels.geometry.getAttribute("aAlpha") as InstancedBufferAttribute;
    const lcr = parts.labels.geometry.getAttribute("aCrop") as InstancedBufferAttribute;
    const g = parts.glyphs.geometry;
    const gGlyph = g.getAttribute("aGlyph") as InstancedBufferAttribute;
    const gAlpha = g.getAttribute("aAlpha") as InstancedBufferAttribute;
    const gCenter = g.getAttribute("aCenter") as InstancedBufferAttribute;
    const gOffset = g.getAttribute("aOffset") as InstancedBufferAttribute;
    const gSize = g.getAttribute("aSize") as InstancedBufferAttribute;
    const spot = L.spotlight;
    const spotOn = spotlightLive(L.dir.mood === "duel" ? "duel" : L.dir.mood === "chaos" ? "chaos" : L.dir.mood === "evolve" ? "evolve" : "game", spot, L.spotAgeMs);
    // targhette più piccole quando le torri sono tante e vicine
    const lblW = 1.32 * layout.scale;
    const dim = L.dir.mood === "duel" || L.dir.mood === "chaos" ? 1 : 0;
    const camDist = state.camera.position.length();
    const lblScale = compact ? Math.min(3.2, Math.max(1, camDist / 11)) : Math.min(1.5, Math.max(0.85, camDist / 16));
    // due file (fino a 24 tavoli): le torri vicine sono a mezzo passo, la targhetta intera non ci sta. Si mostra il
    // numero del tavolo (grande, nel colore della squadra) e il punteggio; nome intero per le torri in primo piano
    const twoRows = layout.rows === 2;

    const sc = layout.scale;
    L.teams.forEach((team, i) => {
      const p = layout.pods[i];
      if (!p) return;
      const a = L.ranks.get(team.teamId);
      const h = a?.height ?? POD.minHeight;
      const focus = spotOn && spot ? spot.teamIds.includes(team.teamId) : false;
      const podiumDim = L.dir.mood === "awards" && L.podium > 0.5 && !L.podiumIds.includes(team.teamId);
      // sul podio della premiazione targhette e punteggi delle torri si spengono: li dicono la classifica e il LED
      const podiumUp = L.dir.mood === "awards" && L.podium > 0.5;
      const fade = podiumDim ? 0.28 : dim && !focus ? 0.45 : 1;
      // colonna (la fila dietro parte dalla pedana)
      const y0 = p.y;
      tmp.position.set(p.x, y0 + BASE_H, p.z);
      tmp.rotation.set(0, p.yaw, 0);
      tmp.scale.set(sc, h, sc);
      tmp.updateMatrix();
      parts.column.setMatrixAt(i, tmp.matrix);
      cT.set(team.color).multiplyScalar(fade);
      parts.column.setColorAt(i, cT);
      const flash = a && a.deltaAge < 0.5 && a.delta > 0 ? (1 - a.deltaAge / 0.5) * 0.5 : 0;
      colState.setXYZ(i, team.online ? 1 : 0, focus ? 1 : 0, flash);
      banState.setXY(i, team.online ? fade : 0.5 * fade, focus ? 1 : 0);
      const top = y0 + BASE_H + h;
      // tappo
      tmp.position.set(p.x, top, p.z);
      tmp.scale.set(sc, 1, sc);
      tmp.updateMatrix();
      parts.cap.setMatrixAt(i, tmp.matrix);
      // neon: bordo della base e bordo del tappo
      tmp.position.set(p.x, y0 + BASE_H, p.z);
      tmp.scale.set(sc, 1, sc);
      tmp.updateMatrix();
      parts.rim.setMatrixAt(i * 2, tmp.matrix);
      tmp.position.set(p.x, top + CAP_H, p.z);
      tmp.scale.set(0.78 * sc, 1, 0.78 * sc);
      tmp.updateMatrix();
      parts.rim.setMatrixAt(i * 2 + 1, tmp.matrix);
      // corda colorata della ciurma: un filo di luce (appena sopra la soglia del bagliore), spenta se offline
      cT.set(team.online ? team.color : "#39414b").multiplyScalar((team.online ? 1.35 : 0.45) * fade);
      parts.rim.setColorAt(i * 2, cT);
      parts.rim.setColorAt(i * 2 + 1, cT);
      // pozza di luce calda delle lanterne, appena tinta del colore della ciurma
      parts.pool.setColorAt(i, cT.set(team.online ? team.color : "#1b2027").lerp(POOL_WARM, 0.55).multiplyScalar((focus ? 1.2 : 0.38) * fade));
      // anello dell'Energia Caos
      tmp.position.set(p.x, top + CAP_H + 0.012, p.z);
      tmp.rotation.set(-Math.PI / 2, 0, -p.yaw);
      tmp.scale.setScalar(sc);
      tmp.updateMatrix();
      parts.chaos.setMatrixAt(i, tmp.matrix);
      prog.setX(i, a?.chaos ?? team.chaosProgress);
      lvl.setX(i, team.mascotLevel);
      onl.setX(i, team.online ? 1 : 0);
      // ancoraggio della mascotte
      const k = i * 5;
      L.anchors[k] = p.x;
      L.anchors[k + 1] = top + CAP_H;
      L.anchors[k + 2] = p.z;
      L.anchors[k + 3] = p.yaw;
      L.anchors[k + 4] = POD.mascotHeight * sc;
      // targhetta sopra la mascotte
      // durante l'evoluzione la mascotte sale e si ingrandisce: targa e punteggio del tavolo salgono più in alto
      const lift = focus && L.dir.mood === "evolve" ? 1.35 * sc : 0;
      const ly = top + CAP_H + POD.mascotHeight * sc + 0.62 + lift;
      const crop = compact || (twoRows && !focus) ? 0.375 : 1;
      lc.setXYZ(i, p.x, ly, p.z);
      ls.setXY(i, lblW * lblScale * crop, lblW * lblScale * (CELL.h / CELL.w));
      la.setX(i, podiumUp ? 0 : fade);
      lcr.setX(i, crop);
      // punteggio (sotto la targhetta, sopra la testa della mascotte)
      const shown = a?.score ?? team.score;
      const ds = scoreDigits(shown, SCORE_GLYPHS);
      const gsz = (compact ? 0.24 : 0.3) * lblScale * (lblW / 1.35);
      for (let d = 0; d < SCORE_GLYPHS; d++) {
        const gi = i * (SCORE_GLYPHS + DELTA_GLYPHS) + d;
        if (d < ds.length) {
          gGlyph.setX(gi, ds[d]);
          gAlpha.setX(gi, podiumUp ? 0 : (team.online ? 1 : 0.55) * fade);
          gCenter.setXYZ(gi, p.x, ly, p.z);
          gOffset.setXY(gi, (d - (ds.length - 1) / 2) * 0.64, -1.45);
          gSize.setX(gi, gsz);
          parts.glyphs.setColorAt(gi, team.rank === 1 && team.score > 0 ? GOLD : CREAM);
        } else gAlpha.setX(gi, 0);
      }
      // lampo «+40» / «−20» che sale sopra la targhetta
      const fl = a ? deltaFlash(a.deltaAge) : 0;
      const dd = a && fl > 0 ? [a.delta >= 0 ? 10 : 11, ...scoreDigits(Math.abs(a.delta), DELTA_GLYPHS - 1)] : [];
      for (let d = 0; d < DELTA_GLYPHS; d++) {
        const gi = i * (SCORE_GLYPHS + DELTA_GLYPHS) + SCORE_GLYPHS + d;
        if (d < dd.length && a) {
          gGlyph.setX(gi, dd[d]);
          gAlpha.setX(gi, fl);
          gCenter.setXYZ(gi, p.x, ly + 0.45 + Math.min(1, a.deltaAge) * 0.35, p.z);
          gOffset.setXY(gi, (d - (dd.length - 1) / 2) * 0.64, 0);
          gSize.setX(gi, gsz * 1.15);
          parts.glyphs.setColorAt(gi, a.delta >= 0 ? UP : DOWN);
        } else gAlpha.setX(gi, 0);
      }
    });
    for (const m of parts.all) {
      // eslint-disable-next-line react-hooks/immutability -- three.js: gli attributi istanziati si segnano «da caricare» nel ciclo di disegno, è voluto
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    colState.needsUpdate = prog.needsUpdate = lvl.needsUpdate = onl.needsUpdate = banState.needsUpdate = true;
    lc.needsUpdate = ls.needsUpdate = la.needsUpdate = lcr.needsUpdate = true;
    gGlyph.needsUpdate = gAlpha.needsUpdate = gCenter.needsUpdate = gOffset.needsUpdate = gSize.needsUpdate = true;
  }, -1);

  void low;
  return (
    <group>
      {parts.all.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
