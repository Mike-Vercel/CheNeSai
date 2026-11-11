/**
 * Shader GLSL della scena. Tutta l'animazione "di massa" (lampadine, particelle,
 * coriandoli, coni di luce, LED wall) è calcolata in GPU a partire da uniform
 * di tempo: zero allocazioni e zero lavoro CPU per istanza.
 */

/** Dimensione dei punti in pixel: size (unità mondo) * uScale / distanza. */
const POINT_SIZE = /* glsl */ `
  float qzPointSize(float worldSize, vec4 mvPosition, float scale) {
    return worldSize * scale / max(0.001, -mvPosition.z);
  }
`;

// ------------------------------------------------------------------ LED wall
export const ledWallVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ledWallFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOn;        // 0..1 accensione progressiva
  uniform float uBoost;     // lampi d'intensità
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform vec3 uColC;
  uniform vec2 uGrid;       // numero di "pixel LED"
  uniform vec2 uCenter;     // centro dei raggi (uv)
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    vec2 g = uv * uGrid;
    vec2 cell = fract(g) - 0.5;
    vec2 cellId = floor(g);
    // pixel LED quadrati arrotondati; da lontano si fondono in un pannello uniforme (niente moiré)
    vec2 dc = abs(cell);
    float box = max(dc.x, dc.y) * 0.75 + length(dc) * 0.25;
    float led = smoothstep(0.5, 0.36, box);
    float aa = max(fwidth(g.x), fwidth(g.y));
    led = mix(led, 0.85, smoothstep(0.2, 0.6, aa));

    vec2 p = (cellId + 0.5) / uGrid - uCenter;
    p.x *= uGrid.x / uGrid.y * 0.55;
    float ang = atan(p.y, p.x);
    float r = length(p);

    // raggi larghi e morbidi che ruotano lentamente
    float rays = 0.5 + 0.5 * sin(ang * 10.0 + uTime * 0.35);
    rays = smoothstep(0.35, 0.95, rays);
    float waves = 0.5 + 0.5 * sin(r * 14.0 - uTime * 1.6);
    vec3 base = mix(uColB, uColA * 0.75, smoothstep(0.0, 1.0, uv.y));
    vec3 col = mix(base, uColC, rays * 0.42 * smoothstep(0.05, 0.35, r));
    col += uColA * waves * 0.07;
    // bagliore caldo in basso (luce del palco)
    col += vec3(1.0, 0.6, 0.25) * smoothstep(0.35, 0.0, uv.y) * 0.12;

    // accensione: parte dal centro e si espande
    float on = smoothstep(r * 1.6 - 0.15, r * 1.6 + 0.05, uOn * 1.9);
    float flicker = 0.95 + 0.05 * sin(uTime * 37.0 + cellId.x * 1.7 + cellId.y * 3.1);
    float vign = smoothstep(1.05, 0.2, length((uv - vec2(0.5, 0.55)) * vec2(1.0, 1.5)));
    vec3 outCol = col * (0.2 + 0.8 * led) * on * flicker * (0.25 + 0.5 * vign) * (1.0 + uBoost);
    gl_FragColor = vec4(outCol, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ lampadine (sfere istanziate)
export const bulbCoreVertex = /* glsl */ `
  attribute float aIdx;     // posizione 0..1 lungo l'arco
  attribute float aPhase;   // fase dell'inseguimento
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uOn;
  uniform float uChase;
  varying vec3 vColor;
  varying float vLight;
  varying vec3 vNormal;
  void main() {
    float on = step(aIdx, uOn * 1.02);
    float chase = 0.5 + 0.5 * sin(aPhase * 6.2831 * 8.0 - uTime * 7.0);
    chase = mix(1.0, smoothstep(0.2, 0.8, chase), uChase);
    vLight = on * (0.35 + 0.65 * chase);
    vColor = aColor;
    vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

export const bulbCoreFragment = /* glsl */ `
  uniform float uIdle;      // luci di attesa (blackout)
  varying vec3 vColor;
  varying float vLight;
  varying vec3 vNormal;
  void main() {
    float l = max(vLight, uIdle);
    float rim = pow(1.0 - abs(vNormal.z), 2.0);
    vec3 hot = mix(vColor, vec3(1.0, 0.97, 0.9), 0.65);
    vec3 col = mix(vColor * 0.08 + vec3(0.03), hot * 1.6 + rim * vColor, l);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Aloni additivi (finto bloom) sopra le lampadine. */
export const bulbHaloVertex = /* glsl */ `
  ${POINT_SIZE}
  attribute float aIdx;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uOn;
  uniform float uChase;
  uniform float uScale;
  uniform float uSize;
  uniform float uIdle;
  varying vec3 vColor;
  varying float vLight;
  void main() {
    float on = step(aIdx, uOn * 1.02);
    float chase = 0.5 + 0.5 * sin(aPhase * 6.2831 * 8.0 - uTime * 7.0);
    chase = mix(1.0, smoothstep(0.2, 0.8, chase), uChase);
    // nel blackout qualche lampadina "respira" a caso
    float idle = uIdle * smoothstep(0.6, 1.0, sin(uTime * 1.3 + aPhase * 91.0));
    vLight = max(on * (0.3 + 0.7 * chase), idle);
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = qzPointSize(uSize, mv, uScale);
    gl_Position = projectionMatrix * mv;
  }
`;

export const bulbHaloFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vLight;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float glow = exp(-d * d * 5.0) * 0.55 + exp(-d * d * 40.0) * 0.9;
    glow *= smoothstep(1.0, 0.7, d);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.25) * glow * vLight, 1.0);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ coni di luce volumetrici
export const coneVertex = /* glsl */ `
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vViewPos;
  void main() {
    vAlong = uv.y; // 1 alla sorgente, 0 alla base
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

export const coneFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vViewPos;
  void main() {
    vec3 v = normalize(-vViewPos);
    float facing = abs(dot(normalize(vN), v));
    float edge = pow(facing, 1.6);
    float fall = pow(vAlong, 1.4);
    float a = edge * fall * uIntensity;
    gl_FragColor = vec4(uColor * a, 1.0);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ polvere dorata
export const dustVertex = /* glsl */ `
  ${POINT_SIZE}
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uSize;
  uniform vec3 uBox;
  varying float vTw;
  void main() {
    vec3 p = position;
    float t = uTime * (0.15 + aSeed.x * 0.25);
    p.y = mod(p.y + t * 2.0, uBox.y) - 0.5;
    p.x += sin(uTime * 0.4 + aSeed.y * 30.0) * 0.6;
    p.z += cos(uTime * 0.3 + aSeed.z * 30.0) * 0.6;
    vTw = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * (2.0 + aSeed.w * 4.0) + aSeed.y * 50.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = qzPointSize(uSize * (0.5 + aSeed.w), mv, uScale);
    gl_Position = projectionMatrix * mv;
  }
`;

export const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTw;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float g = exp(-d * d * 6.0) * smoothstep(1.0, 0.6, d);
    gl_FragColor = vec4(uColor * g * vTw * uOpacity, 1.0);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ esplosione di scintille
export const burstVertex = /* glsl */ `
  ${POINT_SIZE}
  attribute vec4 aSeed;   // direzione (xyz) + velocità
  attribute vec3 aColor;
  uniform float uAge;     // secondi dall'esplosione (<0 = non ancora)
  uniform float uScale;
  uniform float uSize;
  varying vec3 vColor;
  varying float vA;
  void main() {
    float age = max(uAge, 0.0);
    vec3 dir = normalize(aSeed.xyz);
    float speed = aSeed.w;
    vec3 p = position + dir * speed * (1.0 - exp(-age * 2.2)) / 2.2 * 2.0;
    p.y -= 0.9 * age * age;
    vA = step(0.0, uAge) * smoothstep(2.2, 0.3, age);
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = qzPointSize(uSize * (1.0 - 0.5 * clamp(age / 2.0, 0.0, 1.0)), mv, uScale);
    gl_Position = projectionMatrix * mv;
  }
`;

export const burstFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float g = exp(-d * d * 5.0) + exp(-d * d * 40.0);
    g *= smoothstep(1.0, 0.7, d);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.3) * g * vA, 1.0);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ coriandoli digitali (istanziati)
export const confettiVertex = /* glsl */ `
  attribute vec4 aSeed;   // x,z spawn, fase, velocità
  attribute vec3 aColor;
  uniform float uAge;
  uniform float uLoop;    // 1 = pioggia continua
  uniform vec3 uOrigin;
  uniform vec3 uSpread;
  uniform float uFall;
  varying vec3 vColor;
  varying float vShade;
  varying float vA;

  mat3 rotAxis(vec3 axis, float a) {
    float s = sin(a), c = cos(a), oc = 1.0 - c;
    return mat3(
      oc*axis.x*axis.x + c,        oc*axis.x*axis.y - axis.z*s, oc*axis.z*axis.x + axis.y*s,
      oc*axis.x*axis.y + axis.z*s, oc*axis.y*axis.y + c,        oc*axis.y*axis.z - axis.x*s,
      oc*axis.z*axis.x - axis.y*s, oc*axis.y*axis.z + axis.x*s, oc*axis.z*axis.z + c
    );
  }

  void main() {
    float age = max(uAge, 0.0);
    float life = uFall;
    float local = age;
    if (uLoop > 0.5) local = mod(age + aSeed.z * life, life);
    // esplosione iniziale verso l'alto/esterno poi caduta lenta
    vec3 dir = vec3(aSeed.x, 0.0, aSeed.y);
    vec3 p = uOrigin + dir * uSpread;
    if (uLoop < 0.5) {
      float burst = 1.0 - exp(-local * 3.0);
      p += vec3(aSeed.x * 3.5, 4.5 + aSeed.w * 4.0, aSeed.y * 2.0) * burst;
      p.y -= local * (0.8 + aSeed.w * 0.6);
    } else {
      p.y += uSpread.y * (1.0 - local / life);
    }
    p.x += sin(local * (1.5 + aSeed.w * 2.0) + aSeed.z * 20.0) * 0.35;
    float spin = local * (4.0 + aSeed.w * 6.0) + aSeed.z * 10.0;
    vec3 axis = normalize(vec3(aSeed.y, 1.0, aSeed.x) + 0.001);
    mat3 R = rotAxis(axis, spin);
    vec3 lp = R * position;
    vec3 n = R * vec3(0.0, 0.0, 1.0);
    vShade = 0.55 + 0.45 * abs(n.z);
    vColor = aColor;
    vA = step(0.0, uAge);
    if (uLoop < 0.5) vA *= smoothstep(life, life * 0.7, local);
    vec4 mv = modelViewMatrix * vec4(p + lp, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

export const confettiFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vShade;
  varying float vA;
  void main() {
    if (vA < 0.01) discard;
    gl_FragColor = vec4(vColor * vShade * 1.25, vA);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ alone sagomato dietro i personaggi
export const rimGlowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Alone sagomato: la maschera (alfa del ritaglio sfocata e dilatata) è precalcolata
 * una volta in CPU (vedi createGlowMask), qui basta UN campione per pixel.
 */
export const rimGlowFragment = /* glsl */ `
  uniform sampler2D uMask;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float glow = texture2D(uMask, vUv).a;
    gl_FragColor = vec4(uColor * glow * uIntensity, 1.0);
    #include <colorspace_fragment>
  }
`;
