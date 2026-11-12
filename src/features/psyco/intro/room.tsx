"use client";

/**
 * La stanza dell'Investigatore per l'intro 3D di PSYCO, tutta in codice (nessun asset esterno):
 * pavimento a listoni, carta da parati scura, finestra con veneziane, pioggia sul vetro e insegna rossa
 * fuori, bacheca di sughero con foto e fili rossi, scrivania con fascicolo «REGOLA SEGRETA», lente,
 * fogli, lampada da scrivania con cono di luce e polvere che ci galleggia dentro, sedia di legno e cuoio.
 * Texture disegnate su canvas (una volta), materiali standard, una sola luce con ombre (la lampada).
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SpotLight,
  SRGBColorSpace,
  type Texture,
} from "three";

// ------------------------------------------------------------------ texture su canvas
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): Texture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Numeri pseudo-casuali ripetibili (stessa stanza a ogni intro). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawParquet(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = rng(7);
  const rows = 8;
  const rh = h / rows;
  for (let i = 0; i < rows; i++) {
    let x = -r() * w * 0.5;
    while (x < w) {
      const len = w * (0.35 + r() * 0.4);
      const l = 18 + r() * 14;
      g.fillStyle = `hsl(${20 + r() * 8}, ${38 + r() * 14}%, ${l}%)`;
      g.fillRect(x, i * rh, len, rh);
      // venature
      g.strokeStyle = "rgba(0,0,0,0.18)";
      g.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const y = i * rh + r() * rh;
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.6, y + (r() - 0.5) * 6, x + len, y + (r() - 0.5) * 4);
        g.stroke();
      }
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(x, i * rh, 2, rh);
      x += len;
    }
    g.fillStyle = "rgba(0,0,0,0.6)";
    g.fillRect(0, i * rh, w, 2);
  }
}

function drawWallpaper(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = "#2a1c1d";
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) {
    g.fillStyle = x % 64 === 0 ? "rgba(255,200,150,0.05)" : "rgba(0,0,0,0.12)";
    g.fillRect(x, 0, 16, h);
  }
  // motivo a rombi appena visibile
  g.strokeStyle = "rgba(255,190,120,0.06)";
  g.lineWidth = 2;
  for (let y = 0; y < h; y += 64) {
    for (let x = 0; x < w; x += 64) {
      g.beginPath();
      g.moveTo(x + 32, y + 8);
      g.lineTo(x + 52, y + 32);
      g.lineTo(x + 32, y + 56);
      g.lineTo(x + 12, y + 32);
      g.closePath();
      g.stroke();
    }
  }
  // umidità e sporco verso il basso
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "rgba(0,0,0,0.25)");
  grd.addColorStop(0.7, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
}

function drawWood(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = rng(3);
  g.fillStyle = "#3b1d12";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const y = r() * h;
    g.strokeStyle = `rgba(${r() < 0.5 ? "0,0,0" : "120,60,30"},${0.08 + r() * 0.14})`;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 18, w * 0.7, y + (r() - 0.5) * 18, w, y + (r() - 0.5) * 10);
    g.stroke();
  }
}

function drawFolder(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = "#c9a96a";
  g.fillRect(0, 0, w, h);
  const r = rng(11);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(80,50,20,${r() * 0.08})`;
    g.fillRect(r() * w, r() * h, 2 + r() * 6, 1 + r() * 3);
  }
  g.strokeStyle = "rgba(60,40,20,0.35)";
  g.lineWidth = 3;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = "#2a1a10";
  g.font = "bold 34px 'Courier New', monospace";
  g.fillText("FASCICOLO N. 13", 36, 70);
  g.fillText("CASO: PSYCO", 36, 112);
  // timbro rosso inclinato
  g.save();
  g.translate(w / 2, h * 0.62);
  g.rotate(-0.16);
  g.strokeStyle = "rgba(190,18,26,0.92)";
  g.lineWidth = 7;
  g.strokeRect(-w * 0.4, -52, w * 0.8, 104);
  g.fillStyle = "rgba(190,18,26,0.92)";
  g.font = "900 62px 'Courier New', monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("REGOLA SEGRETA", 0, 4);
  g.restore();
  g.fillStyle = "rgba(42,26,16,0.8)";
  g.font = "bold 26px 'Courier New', monospace";
  g.fillText("CONFIDENZIALE · NON APRIRE", 36, h - 40);
}

function drawCork(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = rng(5);
  g.fillStyle = "#6b4a2b";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? "40,25,10" : "160,120,70"},${r() * 0.35})`;
    g.fillRect(r() * w, r() * h, 2, 2);
  }
  // foto e biglietti
  const notes: [number, number, number, number, string][] = [
    [40, 40, 110, 140, "#d8d2c4"],
    [200, 60, 120, 90, "#e9dfb8"],
    [370, 30, 110, 140, "#cfc8b8"],
    [90, 230, 130, 100, "#efe2c4"],
    [300, 210, 110, 140, "#d8d2c4"],
    [430, 230, 60, 80, "#e9dfb8"],
  ];
  const pins: [number, number][] = [];
  for (const [x, y, nw, nh, col] of notes) {
    g.save();
    g.translate(x + nw / 2, y + nh / 2);
    g.rotate((r() - 0.5) * 0.25);
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.fillRect(-nw / 2 + 4, -nh / 2 + 5, nw, nh);
    g.fillStyle = col;
    g.fillRect(-nw / 2, -nh / 2, nw, nh);
    if (nh > nw) {
      // "foto": riquadro scuro con una sagoma
      g.fillStyle = "#3a3633";
      g.fillRect(-nw / 2 + 8, -nh / 2 + 8, nw - 16, nh - 36);
      g.fillStyle = "#151312";
      g.beginPath();
      g.arc(0, -nh / 2 + 40, 16, 0, Math.PI * 2);
      g.fill();
      g.fillRect(-22, -nh / 2 + 58, 44, 30);
    } else {
      g.fillStyle = "rgba(40,30,20,0.6)";
      for (let k = 0; k < 4; k++) g.fillRect(-nw / 2 + 10, -nh / 2 + 16 + k * 16, nw - 20 - r() * 30, 4);
    }
    g.restore();
    pins.push([x + nw / 2, y + 10]);
  }
  // fili rossi tra le puntine
  g.strokeStyle = "#c4141c";
  g.lineWidth = 3;
  const links: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 3],
    [3, 4],
    [1, 4],
    [4, 5],
  ];
  for (const [a, b] of links) {
    g.beginPath();
    g.moveTo(pins[a][0], pins[a][1]);
    g.lineTo(pins[b][0], pins[b][1]);
    g.stroke();
  }
  for (const [x, y] of pins) {
    g.fillStyle = "#e0161f";
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fill();
  }
}

function drawStripes(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const y = (i / n) * h;
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.15, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.85, "rgba(255,255,255,0.6)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, y, w, h / n / 2.2);
  }
}

function drawDot(g: CanvasRenderingContext2D, w: number, h: number) {
  const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
}

export interface RoomTextures {
  parquet: Texture;
  wallpaper: Texture;
  wood: Texture;
  folder: Texture;
  cork: Texture;
  stripes: Texture;
  dot: Texture;
}

export function useRoomTextures(): RoomTextures {
  const tex = useMemo<RoomTextures>(
    () => ({
      parquet: canvasTexture(1024, 512, drawParquet, [5, 5]),
      wallpaper: canvasTexture(256, 256, drawWallpaper, [10, 3.5]),
      wood: canvasTexture(512, 256, drawWood),
      folder: canvasTexture(512, 360, drawFolder),
      cork: canvasTexture(512, 360, drawCork),
      stripes: canvasTexture(256, 256, drawStripes),
      dot: canvasTexture(64, 64, drawDot),
    }),
    [],
  );
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);
  return tex;
}

// ------------------------------------------------------------------ shader
const RAIN_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
/** vetro di notte: insegna rossa sfocata che pulsa, città blu scura, gocce che scendono */
const RAIN_FRAG = /* glsl */ `
uniform float uTime; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  vec3 col = mix(vec3(0.02,0.03,0.06), vec3(0.05,0.07,0.13), uv.y);
  float neon = 0.75 + 0.25 * sin(uTime * 2.3) * sin(uTime * 0.7 + 1.0);
  col += vec3(1.0,0.07,0.1) * neon * 0.9 * exp(-8.0 * distance(uv, vec2(0.72,0.62)));
  col += vec3(1.0,0.5,0.2) * 0.12 * exp(-14.0 * distance(uv, vec2(0.2,0.3)));
  // rivoli di pioggia: colonne con gocce che scendono a velocità diverse
  float cols = 46.0;
  float cx = floor(uv.x * cols);
  float sp = 0.35 + h(vec2(cx, 1.0)) * 0.6;
  float y = fract(uv.y + uTime * sp * 0.35 + h(vec2(cx, 7.0)));
  float fx = abs(fract(uv.x * cols) - 0.5);
  float drop = smoothstep(0.12, 0.0, fx) * smoothstep(0.0, 0.05, y) * smoothstep(0.35, 0.05, y);
  col += drop * vec3(0.55,0.6,0.75) * 0.35;
  // goccioline ferme
  vec2 g = floor(uv * vec2(70.0, 90.0));
  float d = step(0.985, h(g)) * 0.5;
  col += d * vec3(0.6,0.65,0.8) * 0.3;
  gl_FragColor = vec4(col, 1.0);
}`;

const CONE_VERT = /* glsl */ `varying float vH; varying vec3 vN; varying vec3 vV;
void main(){ vH = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
/** cono di luce: più denso vicino alla lampada, sfumato sui bordi (niente spigoli netti) */
const CONE_FRAG = /* glsl */ `uniform float uLamp; uniform vec3 uColor; varying float vH; varying vec3 vN; varying vec3 vV;
void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = edge * (0.12 + 0.55 * vH) * uLamp * 0.42; gl_FragColor = vec4(uColor * a, a); }`;

const DUST_VERT = /* glsl */ `uniform float uTime; uniform float uSize; attribute float aSeed; varying float vLit; uniform vec3 uLampPos;
void main(){
  vec3 p = position;
  p.x += sin(uTime * 0.21 + aSeed * 6.28) * 0.05;
  p.y += sin(uTime * 0.13 + aSeed * 12.0) * 0.06 + fract(uTime * 0.01 + aSeed) * 0.05;
  p.z += cos(uTime * 0.17 + aSeed * 9.0) * 0.05;
  // luminose dentro il cono della lampada (sotto e attorno alla lampada), quasi invisibili fuori
  vec2 d = p.xz - uLampPos.xz;
  float below = smoothstep(uLampPos.y + 0.1, uLampPos.y - 0.2, p.y);
  float r = length(d) / max(0.08, (uLampPos.y - p.y) * 1.2 + 0.1);
  vLit = 0.12 + 0.88 * below * smoothstep(1.1, 0.2, r);
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_PointSize = uSize * (0.6 + aSeed) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FRAG = /* glsl */ `uniform sampler2D uTex; uniform float uLamp; varying float vLit;
void main(){ vec4 t = texture2D(uTex, gl_PointCoord); float a = t.a * vLit * (0.25 + 0.75 * uLamp) * 0.7; gl_FragColor = vec4(vec3(1.0,0.82,0.6) * a, a); }`;

// ------------------------------------------------------------------ pezzi della stanza
function Shell({ tex }: { tex: RoomTextures }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial map={tex.parquet} roughness={0.62} metalness={0.05} color="#b38a6a" />
      </mesh>
      <mesh position={[0, 2, -2.2]} receiveShadow>
        <planeGeometry args={[12, 4]} />
        <meshStandardMaterial map={tex.wallpaper} roughness={0.95} color="#9a7a72" />
      </mesh>
      {/* battiscopa */}
      <mesh position={[0, 0.06, -2.18]}>
        <boxGeometry args={[12, 0.12, 0.03]} />
        <meshStandardMaterial color="#1a0d08" roughness={0.6} />
      </mesh>
      <mesh position={[3.2, 2, 0]} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[9, 4]} />
        <meshStandardMaterial map={tex.wallpaper} roughness={0.95} color="#7a5e58" />
      </mesh>
    </group>
  );
}

function WindowWithBlinds({ tex }: { tex: RoomTextures }) {
  const glassMat = useMemo(() => new ShaderMaterial({ vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, uniforms: { uTime: { value: 0 } } }), []);
  useEffect(() => () => glassMat.dispose(), [glassMat]);
  const glass = useRef<Mesh>(null);
  useFrame((_, dt) => {
    const m = glass.current?.material as ShaderMaterial | undefined;
    if (m) m.uniforms.uTime.value += Math.min(0.1, dt);
  });
  const W = 1.3;
  const H = 1.5;
  const slats = 15;
  return (
    <group position={[1.55, 1.55, -2.17]}>
      <mesh ref={glass} material={glassMat}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* telaio */}
      {[
        [0, H / 2 + 0.04, W + 0.16, 0.08],
        [0, -H / 2 - 0.04, W + 0.16, 0.08],
        [-W / 2 - 0.04, 0, 0.08, H],
        [W / 2 + 0.04, 0, 0.08, H],
        [0, 0, 0.04, H],
        [0, 0.1, W, 0.04],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.03]}>
          <boxGeometry args={[w, h, 0.06]} />
          <meshStandardMaterial map={tex.wood} color="#4a2a1c" roughness={0.7} />
        </mesh>
      ))}
      {/* davanzale */}
      <mesh position={[0, -H / 2 - 0.1, 0.08]}>
        <boxGeometry args={[W + 0.3, 0.05, 0.18]} />
        <meshStandardMaterial map={tex.wood} color="#4a2a1c" roughness={0.7} />
      </mesh>
      {/* veneziane mezze aperte: controluce contro il vetro */}
      {Array.from({ length: slats }, (_, i) => (
        <mesh key={i} position={[0, H / 2 - 0.05 - (i * (H - 0.1)) / (slats - 1), 0.1]} rotation-x={0.85}>
          <boxGeometry args={[W - 0.02, 0.055, 0.004]} />
          <meshStandardMaterial color="#6d5f50" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function CorkBoard({ tex }: { tex: RoomTextures }) {
  return (
    <group position={[-1.25, 1.65, -2.16]}>
      <mesh>
        <boxGeometry args={[1.25, 0.88, 0.03]} />
        <meshStandardMaterial color="#2a160c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.017]}>
        <planeGeometry args={[1.15, 0.8]} />
        <meshStandardMaterial map={tex.cork} roughness={0.95} />
      </mesh>
    </group>
  );
}

function Desk({ tex }: { tex: RoomTextures }) {
  const wood = useMemo(() => new MeshStandardMaterial({ map: tex.wood, color: "#8a5236", roughness: 0.42, metalness: 0.05 }), [tex]);
  const dark = useMemo(() => new MeshStandardMaterial({ map: tex.wood, color: "#5a3020", roughness: 0.55 }), [tex]);
  const brass = useMemo(() => new MeshStandardMaterial({ color: "#c9973f", roughness: 0.35, metalness: 0.9 }), []);
  useEffect(
    () => () => {
      wood.dispose();
      dark.dispose();
      brass.dispose();
    },
    [wood, dark, brass],
  );
  return (
    <group>
      {/* piano */}
      <mesh position={[0, 0.745, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.05, 0.85]} />
      </mesh>
      {/* bordo in cuoio verde (sottomano) */}
      <mesh position={[0.08, 0.772, 0.02]} receiveShadow>
        <boxGeometry args={[0.85, 0.004, 0.5]} />
        <meshStandardMaterial color="#1f3a2a" roughness={0.75} />
      </mesh>
      {/* pannello frontale e cassettiere: coprono le gambe di chi è seduto */}
      <mesh position={[0, 0.39, 0.39]} material={dark} castShadow receiveShadow>
        <boxGeometry args={[1.62, 0.66, 0.04]} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.36, 0]} material={dark} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.72, 0.8]} />
          </mesh>
          {[0.55, 0.33, 0.12].map((y) => (
            <mesh key={y} position={[x, y, 0.405]} material={brass}>
              <boxGeometry args={[0.12, 0.018, 0.02]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Props({ tex }: { tex: RoomTextures }) {
  return (
    <group>
      {/* fascicolo «REGOLA SEGRETA» */}
      <group position={[0.14, 0.776, 0.13]} rotation-y={0.14}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.36, 0.012, 0.26]} />
          <meshStandardMaterial color="#b8955a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.0065, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.355, 0.255]} />
          <meshStandardMaterial map={tex.folder} roughness={0.85} />
        </mesh>
      </group>
      {/* fogli sparsi */}
      {[
        [0.52, 0.12, -0.3, "#e8dcc0"],
        [0.47, 0.06, 0.25, "#d9cba8"],
        [-0.22, 0.18, 0.5, "#e3d6b8"],
      ].map(([x, z, r, c], i) => (
        <mesh key={i} position={[x as number, 0.773 + i * 0.001, z as number]} rotation={[-Math.PI / 2, 0, r as number]} receiveShadow>
          <planeGeometry args={[0.21, 0.29]} />
          <meshStandardMaterial color={c as string} roughness={0.9} />
        </mesh>
      ))}
      {/* lente d'ingrandimento */}
      <group position={[0.5, 0.79, 0.16]} rotation={[-Math.PI / 2, 0, -0.6]}>
        <mesh castShadow>
          <torusGeometry args={[0.055, 0.008, 10, 32]} />
          <meshStandardMaterial color="#c9973f" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.052, 32]} />
          <meshStandardMaterial color="#cfe6ff" transparent opacity={0.18} roughness={0.05} metalness={0.2} />
        </mesh>
        <mesh position={[0, -0.11, 0]}>
          <cylinderGeometry args={[0.009, 0.011, 0.11, 10]} />
          <meshStandardMaterial color="#2a120a" roughness={0.5} />
        </mesh>
      </group>
      {/* bicchiere di whisky */}
      <mesh position={[-0.6, 0.815, 0.22]} castShadow>
        <cylinderGeometry args={[0.032, 0.028, 0.08, 18]} />
        <meshStandardMaterial color="#7a3a10" transparent opacity={0.75} roughness={0.15} metalness={0.1} />
      </mesh>
    </group>
  );
}

/** Sedia di legno e cuoio: si avvicina alla scrivania quando l'Investigatore si siede. */
export function Chair({ tex, sitRef }: { tex: RoomTextures; sitRef: RefObject<number> }) {
  const g = useRef<Object3D>(null);
  useFrame(() => {
    if (g.current) g.current.position.z = -1.05 + 0.2 * (sitRef.current ?? 0);
  });
  const leather = useMemo(() => new MeshStandardMaterial({ color: "#1c0708", roughness: 0.5, metalness: 0.05 }), []);
  const wood = useMemo(() => new MeshStandardMaterial({ map: tex.wood, color: "#5a3020", roughness: 0.5 }), [tex]);
  useEffect(
    () => () => {
      leather.dispose();
      wood.dispose();
    },
    [leather, wood],
  );
  return (
    <group ref={g} position={[0, 0, -1.05]}>
      <mesh position={[0, 0.45, 0]} material={leather} castShadow receiveShadow>
        <boxGeometry args={[0.52, 0.08, 0.5]} />
      </mesh>
      <mesh position={[0, 0.9, -0.25]} rotation-x={-0.1} material={leather} castShadow>
        <boxGeometry args={[0.54, 0.78, 0.09]} />
      </mesh>
      {/* schienale arrotondato in alto, cornice e gambe */}
      <mesh position={[0, 1.29, -0.29]} rotation={[Math.PI / 2 - 0.1, 0, 0]} material={leather} castShadow>
        <cylinderGeometry args={[0.27, 0.27, 0.09, 24, 1, false, Math.PI / 2, Math.PI]} />
      </mesh>
      {[
        [-0.23, -0.21],
        [0.23, -0.21],
        [-0.23, 0.21],
        [0.23, 0.21],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z]} material={wood} castShadow>
          <cylinderGeometry args={[0.022, 0.018, 0.41, 8]} />
        </mesh>
      ))}
      {[-0.29, 0.29].map((x) => (
        <mesh key={x} position={[x, 0.66, -0.02]} material={wood} castShadow>
          <boxGeometry args={[0.05, 0.05, 0.46]} />
        </mesh>
      ))}
    </group>
  );
}

/** Lampada da scrivania: luce calda a cono (con ombre), bulbo, cono di luce visibile. `lampRef` 0..1. */
export function DeskLamp({ lampRef, lowShadows }: { lampRef: RefObject<number>; lowShadows: boolean }) {
  const spot = useRef<SpotLight>(null);
  const face = useRef<SpotLight>(null);
  const glow = useRef<PointLight>(null);
  const bulb = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);
  const cone = useRef<Mesh>(null);
  const coneMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CONE_VERT,
        fragmentShader: CONE_FRAG,
        uniforms: { uLamp: { value: 0 }, uColor: { value: new Color("#ffc47a") } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [],
  );
  useEffect(() => () => coneMat.dispose(), [coneMat]);
  const target = useMemo(() => {
    const o = new Object3D();
    o.position.set(0.05, 0.76, 0.05);
    return o;
  }, []);
  const faceTarget = useMemo(() => {
    const o = new Object3D();
    o.position.set(0, 1.05, -0.7);
    return o;
  }, []);
  useFrame(() => {
    const l = lampRef.current ?? 0;
    if (spot.current) spot.current.intensity = 26 * l;
    if (face.current) face.current.intensity = 5 * l;
    if (glow.current) glow.current.intensity = 2.2 * l;
    const cm = cone.current?.material as ShaderMaterial | undefined;
    if (cm) cm.uniforms.uLamp.value = l;
    if (bulb.current) (bulb.current.material as MeshStandardMaterial).emissiveIntensity = 0.2 + 6 * l;
    if (inner.current) (inner.current.material as MeshStandardMaterial).emissiveIntensity = 0.05 + 1.6 * l;
  });
  const shadow = lowShadows ? 512 : 1024;
  return (
    <group>
      <primitive object={target} />
      <primitive object={faceTarget} />
      {/* base, stelo e braccio in ottone brunito */}
      <group position={[-0.62, 0.77, -0.14]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.11, 0.03, 28]} />
          <meshStandardMaterial color="#6b4a1f" metalness={0.85} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.4, 10]} />
          <meshStandardMaterial color="#8a6428" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0.07, 0.4, 0.04]} rotation={[0.5, 0, -1.0]} castShadow>
          <cylinderGeometry args={[0.01, 0.01, 0.2, 10]} />
          <meshStandardMaterial color="#8a6428" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* paralume verde scuro inclinato verso la scrivania */}
        <group position={[0.15, 0.43, 0.09]} rotation={[0.12, 0, 0.5]}>
          <mesh castShadow>
            <coneGeometry args={[0.13, 0.17, 28, 1, true]} />
            <meshStandardMaterial color="#123222" metalness={0.6} roughness={0.35} side={DoubleSide} />
          </mesh>
          <mesh ref={inner} scale={0.97}>
            <coneGeometry args={[0.13, 0.17, 28, 1, true]} />
            <meshStandardMaterial color="#3a2a12" emissive="#ffb050" emissiveIntensity={0} side={BackSide} />
          </mesh>
          <mesh ref={bulb} position={[0, -0.05, 0]}>
            <sphereGeometry args={[0.035, 16, 12]} />
            <meshStandardMaterial color="#fff2d0" emissive="#ffd9a0" emissiveIntensity={0} />
          </mesh>
          {/* cono di luce visibile (con la polvere dentro) */}
          <mesh ref={cone} position={[0, -0.36, 0]} material={coneMat}>
            <coneGeometry args={[0.5, 0.6, 32, 1, true]} />
          </mesh>
        </group>
      </group>
      <spotLight
        ref={spot}
        position={[-0.48, 1.13, -0.04]}
        target={target}
        angle={0.95}
        penumbra={0.65}
        distance={4}
        decay={1.7}
        color="#ffb664"
        intensity={0}
        castShadow
        shadow-mapSize-width={shadow}
        shadow-mapSize-height={shadow}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* la luce che il paralume lascia uscire attorno: illumina chi passa dietro la scrivania */}
      <pointLight ref={glow} position={[-0.52, 1.25, -0.1]} color="#ffb05a" intensity={0} distance={3.6} decay={1.4} />
      {/* il riverbero della lampada sul viso (niente ombre: costa poco) */}
      <spotLight ref={face} position={[-0.55, 1.2, 0.35]} target={faceTarget} angle={0.5} penumbra={0.9} distance={3} decay={1.5} color="#ffb36b" intensity={0} />
    </group>
  );
}

/** Polvere che galleggia: punti con movimento nel vertex shader (nessun lavoro della CPU per frame). */
export function Dust({ tex, lampRef, count }: { tex: RoomTextures; lampRef: RefObject<number>; count: number }) {
  const geo = useMemo(() => {
    const r = rng(19);
    const g = new BufferGeometry();
    const pos: number[] = [];
    const seed: number[] = [];
    for (let i = 0; i < count; i++) {
      pos.push(-1.1 + r() * 1.8, 0.8 + r() * 0.9, -0.7 + r() * 1.1);
      seed.push(r());
    }
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        uniforms: { uTime: { value: 0 }, uSize: { value: 14 }, uTex: { value: tex.dot }, uLamp: { value: 0 }, uLampPos: { value: [-0.48, 1.13, -0.04] } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [tex],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  const pts = useRef<Points>(null);
  useFrame((_, dt) => {
    const m = pts.current?.material as ShaderMaterial | undefined;
    if (!m) return;
    m.uniforms.uTime.value += Math.min(0.1, dt);
    m.uniforms.uLamp.value = lampRef.current ?? 0;
  });
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />;
}

/** Lame di luce delle veneziane sul pavimento (rosse e fredde, dalla finestra). */
function BlindLight({ tex }: { tex: RoomTextures }) {
  return (
    <mesh position={[1.25, 0.004, -1.25]} rotation={[-Math.PI / 2, 0, 0.5]}>
      <planeGeometry args={[1.5, 1.7]} />
      <meshBasicMaterial map={tex.stripes} color="#ff3a44" transparent opacity={0.11} blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

/** Insegna rossa fuori dalla finestra: controluce che pulsa piano. */
function NeonBacklight() {
  const l = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (l.current) l.current.intensity = 4 + 1.2 * Math.sin(t * 2.3) * Math.sin(t * 0.7 + 1);
  });
  return (
    <>
      <pointLight ref={l} position={[1.2, 2.3, -1.8]} color="#ff1e2a" intensity={4} distance={5} decay={1.7} />
      {/* luce fredda della città, quasi niente: dà forma al buio */}
      <pointLight position={[1.6, 1.5, -1.6]} color="#3c5aa8" intensity={1.2} distance={5} decay={1.8} />
    </>
  );
}

export function Room({ tex, lampRef, sitRef, lowPower }: { tex: RoomTextures; lampRef: RefObject<number>; sitRef: RefObject<number>; lowPower: boolean }) {
  return (
    <group>
      <Shell tex={tex} />
      <WindowWithBlinds tex={tex} />
      <CorkBoard tex={tex} />
      <Desk tex={tex} />
      <Props tex={tex} />
      <Chair tex={tex} sitRef={sitRef} />
      <DeskLamp lampRef={lampRef} lowShadows={lowPower} />
      <Dust tex={tex} lampRef={lampRef} count={lowPower ? 120 : 260} />
      <BlindLight tex={tex} />
      <NeonBacklight />
    </group>
  );
}
