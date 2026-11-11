import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type IUniform,
  type WebGLProgramParametersWithUniforms,
} from "three";

/**
 * Chioma di Palmino: una sola geometria di foglia (larga, seghettata, piegata a V lungo la
 * nervatura, ad arco che poi ricade) disegnata con un InstancedMesh = 1 draw call.
 * Il moto secondario (molle per foglia) è calcolato su CPU; lo sventolio fine lo fa il
 * vertex shader (uTime + gl_InstanceID).
 */

export interface LeafSpec {
  /** azimut (rad) attorno all'asse Y, 0 = davanti (+Z), +π/2 = sinistra del personaggio (+X) */
  azimuth: number;
  /** inclinazione di base (rad): negativa = verso l'alto, positiva = verso il basso */
  pitch: number;
  roll: number;
  length: number;
  width: number;
  /** distanza della radice dall'asse del tronco */
  radius: number;
  /** altezza della radice rispetto all'osso "crown" */
  y: number;
  /** rigidità della molla (più bassa = più ballonzolante) */
  stiffness: number;
  tint: number;
  /** luminosità del livello (le foglie basse/dietro sono in ombra sotto la chioma) */
  shade: number;
}

const deg = Math.PI / 180;
const TAU = Math.PI * 2;
const smooth01 = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Disposizione della chioma letta dal riferimento: quattro livelli che si aprono "a fontana"
 * (alto, medio largo, basso cadente) più un ciuffo di foglioline arricciate in cima alla testa.
 * Il livello alto copre anche il davanti (foglie quasi verticali che si piegano sopra la fronte),
 * così la chioma resta piena anche di 3/4.
 */
export function palminoLeafLayout(): LeafSpec[] {
  const rand = mulberry32(77);
  const out: LeafSpec[] = [];
  const add = (
    az: number,
    pitch: number,
    length: number,
    width: number,
    radius: number,
    y: number,
    stiffness: number,
    shade: number,
    rollFront = 46,
  ) => {
    out.push({
      azimuth: (az + (rand() - 0.5) * 8) * deg,
      pitch: (pitch + (rand() - 0.5) * 6) * deg,
      // rollio: le foglie laterali mostrano la faccia superiore verso il pubblico
      roll: (rollFront * Math.sin(az * deg) + (rand() - 0.5) * 12) * deg,
      length: length * (0.94 + rand() * 0.12),
      width: width * (0.92 + rand() * 0.16),
      radius,
      y,
      stiffness,
      tint: rand(),
      shade,
    });
  };
  // livello alto: davanti si alzano quasi verticali e ricadono appena sopra la fronte
  for (const az of [-34, 34]) add(az, -86, 0.66, 0.95, 0.05, 0.045, 85, 1.1, 18);
  // livello alto: salgono ripide e si aprono "a ombrello" (cima della chioma ~0.3 m sopra la testa)
  for (const az of [72, 108, 144, 180, 216, 252, 288]) add(az, -78, 0.82, 1.0, 0.07, 0.025, 70, 1.06);
  // livello medio: si allargano ai lati, punte all'altezza degli occhiali
  for (const az of [68, 96, 124, 152, 180, 208, 236, 264, 292]) add(az, -44, 0.9, 1.05, 0.1, 0.0, 55, 0.98);
  // livello basso: pendono dietro le braccia fino all'altezza della bocca
  for (const az of [98, 128, 156, 180, 204, 232, 262]) add(az, -8, 0.82, 1.05, 0.12, -0.03, 48, 0.82);
  // ciuffo: foglioline arricciate che spuntano dalla cima della testa e ricadono sul bordo
  // (davanti più ritte, così non coprono gli occhiali)
  for (const az of [20, 60, 100, 140, 180, 220, 260, 300, 340]) {
    const front = Math.cos(az * deg) > 0.6;
    add(az, front ? -74 : -42, front ? 0.27 : 0.32, 1.15, 0.07, 0.04, 115, 1.12, 0);
  }
  return out;
}

/** curvatura totale della foglia (rad): ~140° di arco, sagoma "a ombrello" */
const BEND = 2.4;

/** Geometria unitaria della foglia: radice nell'origine, lunghezza 1 lungo +Z. */
export function buildLeafGeometry(lowPower: boolean): BufferGeometry {
  const rows = lowPower ? 14 : 24; // lungo la foglia
  const cols = lowPower ? 4 : 8; // attraverso (pari, nervatura al centro)
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const root = new Color("#0a4a04");
  const mid = new Color("#169f08");
  const tip = new Color("#2cbb10");
  const rib = new Color("#62d838");
  const c = new Color();
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    // foglia larga "a pagaia" (come nel riferimento): picciolo stretto, ventre largo, punta tonda
    let w = 0.29 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.75) * 0.97 + 0.03)), 0.55);
    w *= 1 - 0.55 * (1 - smooth01(0.0, 0.16, t));
    w = Math.max(w, 0.018 * (1 - t));
    // bordo a festoni morbidi (3 lobi), niente seghettature
    if (t > 0.3 && t < 0.92) w *= 1 - 0.09 * Math.pow(0.5 + 0.5 * Math.cos(TAU * (t - 0.3) * 3.3), 3);
    // asse della foglia: arco a curvatura costante (lunghezza 1), parte lungo +Z e si piega in giù
    const spineY = (Math.cos(BEND * t) - 1) / BEND;
    const spineZ = Math.sin(BEND * t) / BEND;
    for (let i = 0; i <= cols; i++) {
      const s = (i / cols) * 2 - 1; // -1..1 attraverso
      const x = s * w;
      // piega a V rovesciata (bordi verso il basso) che si accentua verso la punta
      const fold = -(0.5 + 0.5 * t) * Math.pow(Math.abs(x), 1.1) - 0.04 * Math.abs(s) * t;
      positions.push(x, spineY + fold, spineZ - 0.05 * Math.abs(s) * w);
      uvs.push(i / cols, t);
      c.copy(root).lerp(mid, Math.min(1, t * 2.4));
      if (t > 0.5) c.lerp(tip, (t - 0.5) / 0.5);
      const ribT = Math.max(0, 1 - Math.abs(s) * 6) * (0.5 - 0.3 * t);
      c.lerp(rib, ribT);
      // bordo un po' più scuro + leggero solco ai lati della nervatura (volume)
      const edge = (1 - 0.2 * Math.pow(Math.abs(s), 1.5)) * (1 - 0.1 * Math.exp(-Math.pow((Math.abs(s) - 0.22) / 0.08, 2)));
      colors.push(c.r * edge, c.g * edge, c.b * edge);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const d = a + cols + 1;
      const e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export interface LeafMaterial {
  material: MeshStandardMaterial;
  uniforms: { uTime: IUniform<number>; uFlutter: IUniform<number> };
}

/** Materiale lucido delle foglie con sventolio nel vertex shader. */
export function createLeafMaterial(lowPower: boolean, extraCompile?: (shader: WebGLProgramParametersWithUniforms) => void): LeafMaterial {
  const uniforms = { uTime: { value: 0 }, uFlutter: { value: 1 } };
  // lowPower: MeshStandard (shader più leggero); altrimenti Physical con speculare attenuato
  const material = lowPower
    ? new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: DoubleSide, envMapIntensity: 0.2, emissive: new Color("#062803") })
    : new MeshPhysicalMaterial({
        vertexColors: true,
        // il rovescio delle foglie non deve diventare nero in controluce
        emissive: new Color("#062803"),
        roughness: 0.52,
        specularIntensity: 0.38,
        metalness: 0,
        side: DoubleSide,
        envMapIntensity: 0.25,
      });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uFlutter = uniforms.uFlutter;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uFlutter;")
      .replace(
        "#include <begin_vertex>",
        [
          "#include <begin_vertex>",
          "{",
          "  float ph = float(gl_InstanceID) * 1.7;",
          "  float t = uv.y;",
          "  float w = sin(uTime * 3.1 + ph + t * 4.0) * 0.6 + sin(uTime * 5.3 + ph * 1.3 + t * 7.0) * 0.4;",
          "  transformed.y += w * 0.035 * t * t * uFlutter;",
          "  transformed.x += sin(uTime * 2.3 + ph * 0.7) * 0.02 * t * t * uFlutter;",
          "}",
        ].join("\n"),
      );
    // rovescio della foglia (faccia posteriore) più scuro e meno saturo, come nel riferimento
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      ["#include <color_fragment>", "diffuseColor.rgb *= gl_FrontFacing ? vec3(1.0) : vec3(0.62, 0.7, 0.6);"].join("\n"),
    );
    extraCompile?.(shader);
  };
  material.customProgramCacheKey = () => (extraCompile ? "palmino-leaf-v2-proj" : "palmino-leaf-v2");
  return { material, uniforms };
}
