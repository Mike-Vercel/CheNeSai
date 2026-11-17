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
import { additiveMapMaterial, chaosRingMaterial, columnMaterial, glyphMaterial } from "./fx-materials";
import { BASE_H, CAP_H, type ArenaLive } from "./live";
import { POD, type ArenaLayout } from "./layout";
import { deltaFlash, scoreDigits } from "./rank-anim";
import { digitAtlas, ringTexture } from "./textures";
import { spotlightLive } from "./director";
import { useLatestRef } from "./use-latest";

/**
 * LE TORRI DELLE SQUADRE (istanziate: ogni parte è UNA draw call per tutte le torri).
 * Base esagonale col neon della squadra e la pozza di luce a terra · colonna che sale e scende col punteggio
 * (spigoli al neon, tacche ogni 25 cm) · tappo con l'anello dell'Energia Caos · targhetta sempre rivolta alla camera
 * (numero del tavolo nel colore della squadra + nome) · punteggio a cifre grandi che conta su/giù · lampo «+40».
 * Tavolo offline: colori spenti, neon al minimo, «OFFLINE» sulla targhetta.
 */

const ZERO = new Matrix4().makeScale(0, 0, 0);
const tmp = new Object3D();
const cT = new Color();
const WHITE = new Color("#ffffff");
const GOLD = new Color(TIG.gold);
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
    // piastra scura (vetro) con filo del colore della squadra
    ctx.fillStyle = "rgba(5,8,13,0.84)";
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, CELL.w - pad * 2, CELL.h - pad * 2, 30);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // numero del tavolo: quadrato pieno nel colore della squadra
    const bs = CELL.h - pad * 2 - 22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + pad + 11, y + pad + 11, bs, bs, 22);
    ctx.fill();
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
      ctx.font = `800 44px ${family}`;
      ctx.fillStyle = "#ff8f8f";
      ctx.fillText("OFFLINE", tx, y + 92);
    }
    let size = 74;
    let lines: string[] = [];
    for (; size >= 44; size -= 4) {
      ctx.font = `800 ${size}px ${family}`;
      lines = twoLines(ctx, t.name.toUpperCase(), maxW);
      if (lines.every((l) => !l.endsWith("…"))) break;
    }
    ctx.fillStyle = t.online ? "#f6f8fb" : "#9aa3ad";
    const lh = size * 0.98;
    const total = lines.length * lh;
    const baseY = t.online ? y + CELL.h / 2 - total / 2 + size * 0.8 : y + 150;
    lines.slice(0, t.online ? 2 : 1).forEach((l, k) => ctx.fillText(l, tx, baseY + k * lh));
  });
}

/** Targhette sempre rivolte alla camera, una cella dell'atlante per istanza. */
function labelMaterial(map: CanvasTexture, rows: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uMap: { value: map }, uGrid: { value: [ATLAS_COLS, rows] }, uCrop: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aCenter;
      attribute float aCell;
      attribute vec2 aSize;
      attribute float aAlpha;
      uniform vec2 uGrid;
      uniform float uCrop;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float col = mod(aCell, uGrid.x);
        float row = floor(aCell / uGrid.x);
        vUv = vec2((col + uv.x * uCrop) / uGrid.x, 1.0 - (row + 1.0 - uv.y) / uGrid.y);
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
        gl_FragColor = vec4(t.rgb, t.a * vAlpha);
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
}

export function Pods({ liveRef, teams, layout, family, low, shadows, compact = false }: PodsProps) {
  const n = teams.length;
  const atlas = useMemo(() => {
    const c = document.createElement("canvas");
    const s = labelAtlasSize(Math.max(1, n));
    c.width = s.w;
    c.height = s.h;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
    t.anisotropy = 4;
    return t;
  }, [n]);
  const digits = useMemo(() => digitAtlas(family), [family]);
  const ring = useMemo(() => ringTexture(), []);
  useEffect(
    () => () => {
      atlas.dispose();
      digits.dispose();
      ring.dispose();
    },
    [atlas, digits, ring],
  );

  // targhette: ridisegnate solo quando cambiano tavolo, nome, colore o stato online
  const labelKey = teams.map((t) => `${t.tableNo}|${t.name}|${t.color}|${t.online ? 1 : 0}`).join("§");
  const atlasRef = useLatestRef(atlas);
  const teamsRef = useLatestRef(teams);
  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (!alive) return;
      const tex = atlasRef.current;
      drawLabels(tex.image as HTMLCanvasElement, teamsRef.current, family);
      tex.needsUpdate = true;
    };
    draw();
    document.fonts?.ready.then(draw).catch(() => undefined);
    const late = setTimeout(draw, 1200);
    return () => {
      alive = false;
      clearTimeout(late);
    };
  }, [labelKey, atlas, family, atlasRef, teamsRef]);

  const parts = useMemo(() => {
    const baseGeo = new CylinderGeometry(0.74, 0.8, BASE_H, 6, 1);
    baseGeo.translate(0, BASE_H / 2, 0);
    const baseMat = new MeshStandardMaterial({ color: "#0c1118", metalness: 0.85, roughness: 0.32 });
    const base = instanced(baseGeo, baseMat, n);
    base.castShadow = false;
    base.receiveShadow = shadows;
    const rimGeo = new TorusGeometry(0.75, 0.022, 6, 6);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.rotateY(Math.PI / 6);
    const rimMat = new MeshBasicMaterial({ toneMapped: false });
    const rim = instanced(rimGeo, rimMat, n * 2, true);
    const poolGeo = new PlaneGeometry(1, 1);
    poolGeo.rotateX(-Math.PI / 2);
    poolGeo.setAttribute("aPhase", new InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1));
    const pool = instanced(poolGeo, additiveMapMaterial(ring), n, true);
    pool.renderOrder = 1;
    const colGeo = new CylinderGeometry(POD.radius, POD.radius, 1, 6, 1, true);
    colGeo.rotateY(Math.PI / 6);
    colGeo.translate(0, 0.5, 0);
    colGeo.setAttribute("aState", new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
    const colMat = columnMaterial();
    const column = instanced(colGeo, colMat, n, true);
    const capGeo = new CylinderGeometry(0.58, 0.55, CAP_H, 6, 1);
    capGeo.rotateY(Math.PI / 6);
    capGeo.translate(0, CAP_H / 2, 0);
    const capMat = new MeshStandardMaterial({ color: "#10161e", metalness: 0.9, roughness: 0.25 });
    const cap = instanced(capGeo, capMat, n);
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
    const all = [base, rim, pool, column, cap, chaos, labels, glyphs];
    return { base, rim, pool, column, colMat, cap, chaos, chaosMat, labels, glyphs, all };
  }, [n, atlas, digits, ring, shadows]);
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
      tmp.position.set(p.x, 0, p.z);
      tmp.rotation.set(0, p.yaw, 0);
      tmp.scale.setScalar(layout.scale);
      tmp.updateMatrix();
      parts.base.setMatrixAt(i, tmp.matrix);
      tmp.position.set(p.x, 0.015, p.z);
      tmp.scale.setScalar(2.6 * layout.scale);
      tmp.updateMatrix();
      parts.pool.setMatrixAt(i, tmp.matrix);
    });
    parts.base.instanceMatrix.needsUpdate = true;
    parts.pool.instanceMatrix.needsUpdate = true;
  }, [layout, parts, partsRef]);

  useFrame((state) => {
    const parts = partsRef.current;
    const L = liveRef.current;
    const t = L.t;
    parts.colMat.uniforms.uTime.value = t;
    parts.chaosMat.uniforms.uTime.value = t;
    const colState = parts.column.geometry.getAttribute("aState") as InstancedBufferAttribute;
    const prog = parts.chaos.geometry.getAttribute("aProgress") as InstancedBufferAttribute;
    const lvl = parts.chaos.geometry.getAttribute("aLevel") as InstancedBufferAttribute;
    const onl = parts.chaos.geometry.getAttribute("aOnline") as InstancedBufferAttribute;
    const lc = parts.labels.geometry.getAttribute("aCenter") as InstancedBufferAttribute;
    const ls = parts.labels.geometry.getAttribute("aSize") as InstancedBufferAttribute;
    const la = parts.labels.geometry.getAttribute("aAlpha") as InstancedBufferAttribute;
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
    const crop = compact ? 0.375 : 1;
    (parts.labels.material as ShaderMaterial).uniforms.uCrop.value = crop;

    const sc = layout.scale;
    L.teams.forEach((team, i) => {
      const p = layout.pods[i];
      if (!p) return;
      const a = L.ranks.get(team.teamId);
      const h = a?.height ?? POD.minHeight;
      const focus = spotOn && spot ? spot.teamIds.includes(team.teamId) : false;
      const podiumDim = L.dir.mood === "awards" && L.podium > 0.5 && !L.podiumIds.includes(team.teamId);
      const fade = podiumDim ? 0.28 : dim && !focus ? 0.45 : 1;
      // colonna
      tmp.position.set(p.x, BASE_H, p.z);
      tmp.rotation.set(0, p.yaw, 0);
      tmp.scale.set(sc, h, sc);
      tmp.updateMatrix();
      parts.column.setMatrixAt(i, tmp.matrix);
      cT.set(team.color).multiplyScalar(fade);
      parts.column.setColorAt(i, cT);
      const flash = a && a.deltaAge < 0.5 && a.delta > 0 ? (1 - a.deltaAge / 0.5) * 0.5 : 0;
      colState.setXYZ(i, team.online ? 1 : 0, focus ? 1 : 0, flash);
      const top = BASE_H + h;
      // tappo
      tmp.position.set(p.x, top, p.z);
      tmp.scale.set(sc, 1, sc);
      tmp.updateMatrix();
      parts.cap.setMatrixAt(i, tmp.matrix);
      // neon: bordo della base e bordo del tappo
      tmp.position.set(p.x, BASE_H, p.z);
      tmp.scale.set(sc, 1, sc);
      tmp.updateMatrix();
      parts.rim.setMatrixAt(i * 2, tmp.matrix);
      tmp.position.set(p.x, top + CAP_H, p.z);
      tmp.scale.set(0.78 * sc, 1, 0.78 * sc);
      tmp.updateMatrix();
      parts.rim.setMatrixAt(i * 2 + 1, tmp.matrix);
      cT.set(team.online ? team.color : "#39414b").multiplyScalar((team.online ? 1.6 : 0.6) * fade);
      parts.rim.setColorAt(i * 2, cT);
      parts.rim.setColorAt(i * 2 + 1, cT);
      parts.pool.setColorAt(i, cT.set(team.online ? team.color : "#1b2027").multiplyScalar((focus ? 1.4 : 0.55) * fade));
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
      const ly = top + CAP_H + POD.mascotHeight * sc + 0.62;
      lc.setXYZ(i, p.x, ly, p.z);
      ls.setXY(i, lblW * lblScale * crop, lblW * lblScale * (CELL.h / CELL.w));
      la.setX(i, podiumDim ? 0.18 : fade);
      // punteggio (sotto la targhetta, sopra la testa della mascotte)
      const shown = a?.score ?? team.score;
      const ds = scoreDigits(shown, SCORE_GLYPHS);
      const gsz = (compact ? 0.24 : 0.3) * lblScale * (lblW / 1.35);
      for (let d = 0; d < SCORE_GLYPHS; d++) {
        const gi = i * (SCORE_GLYPHS + DELTA_GLYPHS) + d;
        if (d < ds.length) {
          gGlyph.setX(gi, ds[d]);
          gAlpha.setX(gi, (team.online ? 1 : 0.55) * fade);
          gCenter.setXYZ(gi, p.x, ly, p.z);
          gOffset.setXY(gi, (d - (ds.length - 1) / 2) * 0.64, -1.45);
          gSize.setX(gi, gsz);
          parts.glyphs.setColorAt(gi, team.rank === 1 && team.score > 0 ? GOLD : WHITE);
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
    colState.needsUpdate = prog.needsUpdate = lvl.needsUpdate = onl.needsUpdate = true;
    lc.needsUpdate = ls.needsUpdate = la.needsUpdate = true;
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
