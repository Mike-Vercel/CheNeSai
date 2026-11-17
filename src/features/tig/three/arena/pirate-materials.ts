import { AdditiveBlending, BackSide, Color, DoubleSide, Matrix4, ShaderMaterial, Vector3, type Texture } from "three";
import { TIG } from "../palette";
import { CRISP } from "./fx-materials";

/**
 * MATERIALI-SHADER DELLA TAVERNA DEL MOLO (edizione pirati). Stesse regole del resto dell'arena: valori lineari nel
 * buffer HDR; ciò che deve restare nitido (vela, stendardi) esce sotto la soglia del bagliore, ciò che brilla (oro
 * colpito dalla luce, fiamme, luna, lucciole) esce sopra. Tutti compatibili con InstancedMesh dove serve.
 */

const INSTANCE_MAT = /* glsl */ `
  #ifdef USE_INSTANCING
    mat4 im = instanceMatrix;
  #else
    mat4 im = mat4(1.0);
  #endif
`;
const INSTANCE_COLOR = /* glsl */ `
  #ifdef USE_INSTANCING_COLOR
    vec3 ic = instanceColor;
  #else
    vec3 ic = vec3(1.0);
  #endif
`;

const lin = (hex: string) => new Color(hex);

// ------------------------------------------------------------------ pila di dobloni (colonna del punteggio)
/**
 * La colonna della postazione è una PILA DI DOBLONI d'oro che cresce col punteggio (altezza = scala Y).
 * Monete da 6 cm (scanalature orizzontali antialiasate), zigrinatura del bordo che sparisce da lontano, pila un po'
 * storta (ogni moneta spostata di poco), oro "finto PBR": riflesso di un ambiente caldo a bande (lanterne), luce
 * chiave, controluce freddo della luna. `aState`: x = online, y = in primo piano, z = lampo (punti appena presi).
 */
export function goldStackMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGold: { value: lin(TIG.gold) }, uRim: { value: lin(TIG.chill) }, uWarm: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aState;
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vState;
      varying float vWy;
      varying vec2 vUv;
      void main() {
        ${INSTANCE_MAT}
        vUv = uv;
        vState = aState;
        vec4 wp = modelMatrix * im * vec4(position, 1.0);
        // pila un po' storta: spostamento morbido che cambia di moneta in moneta (mai alla base)
        float id = float(gl_InstanceID);
        float coin = wp.y / 0.06;
        vec2 j = vec2(sin(coin * 1.7 + id * 3.1) + 0.5 * sin(coin * 0.43 + id), cos(coin * 1.3 + id * 1.9) + 0.5 * cos(coin * 0.37 + id * 2.3));
        wp.xz += j * 0.011 * smoothstep(0.0, 0.15, uv.y);
        vWy = wp.y;
        vec3 n = normalize(mat3(modelMatrix) * mat3(im) * normal);
        vec4 mv = viewMatrix * wp;
        vV = normalize(-mv.xyz);
        vN = normalize((viewMatrix * vec4(n, 0.0)).xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uGold;
      uniform vec3 uRim;
      uniform float uWarm;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vState;
      varying float vWy;
      varying vec2 vUv;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float facing = clamp(dot(N, V), 0.0, 1.0);
        // monete da 6 cm: la fessura tra una e l'altra (antialiasata, energia costante da lontano)
        float cy = vWy / 0.06;
        float fwy = max(fwidth(cy), 1e-4);
        float d = 0.5 - abs(fract(cy) - 0.5);
        float groove = (1.0 - smoothstep(0.07 - fwy, 0.07 + fwy, d)) * min(1.0, 0.07 / fwy);
        // zigrinatura del bordo: righe verticali fitte, solo da vicino
        float ang = vUv.x * 120.0;
        float fwa = max(fwidth(ang), 1e-4);
        float reed = (0.5 + 0.5 * sin(ang * 6.2832)) * (1.0 - smoothstep(0.12, 0.45, fwa));
        // oro: riflesso dell'ambiente (bande calde delle lanterne, buio sopra e sotto) + chiave + controluce
        vec3 R = reflect(-V, N);
        float band = smoothstep(-0.35, 0.05, R.y) * (1.0 - smoothstep(0.25, 0.8, R.y));
        float spec = pow(max(dot(R, normalize(vec3(0.45, 0.55, 0.7))), 0.0), 18.0);
        float spec2 = pow(max(dot(R, normalize(vec3(-0.6, 0.3, 0.75))), 0.0), 30.0);
        float rim = pow(1.0 - facing, 3.0);
        float diff = clamp(dot(N, normalize(vec3(0.3, 0.5, 0.8))), 0.0, 1.0);
        vec3 col = uGold * (0.3 + 0.35 * diff + 0.75 * band * uWarm + 1.6 * spec + 0.8 * spec2);
        col += uRim * rim * 0.25;
        col *= (1.0 - 0.7 * groove) * (0.9 + 0.1 * reed);
        // fuori linea: oro spento, quasi bronzo
        float online = vState.x;
        col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(0.55, 0.5, 0.45), col, online);
        // in primo piano: pulsa; punti appena presi: lampo
        col += uGold * vState.y * (0.25 + 0.2 * sin(uTime * 6.0));
        col += vec3(1.0, 0.9, 0.6) * vState.z * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// ------------------------------------------------------------------ stendardi delle ciurme
/**
 * Stendardo appeso a un'asta (istanziato): la tela ondeggia nel vento (più in basso, più si muove), pieghe che
 * scuriscono, retro più scuro. Una cella dell'atlante per istanza (`aCell`), `aPhase` sfasa il vento, `aState`:
 * x = online, y = in primo piano. Sotto la soglia del bagliore (il numero resta leggibile).
 */
export function bannerMaterial(map: Texture, cols: number, rows: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uMap: { value: map }, uGrid: { value: [cols, rows] }, uTime: { value: 0 }, uWind: { value: 1 }, uLight: { value: new Color(1, 0.92, 0.8) } },
    vertexShader: /* glsl */ `
      attribute float aCell;
      attribute float aPhase;
      attribute vec2 aState;
      uniform vec2 uGrid;
      uniform float uTime;
      uniform float uWind;
      varying vec2 vUv;
      varying float vShade;
      varying vec2 vState;
      void main() {
        ${INSTANCE_MAT}
        vec3 p = position;
        // il pannello pende dall'asta: y da 0 (in alto) a -1 (in basso)
        float hang = clamp(-p.y, 0.0, 1.0);
        float t = uTime * 1.7 + aPhase;
        float w1 = sin(p.x * 4.0 + t) * 0.5 + sin(p.y * 5.0 - t * 1.3) * 0.5;
        p.z += w1 * 0.07 * (0.25 + hang) * uWind;
        p.x += sin(t * 0.6) * 0.035 * hang * uWind;
        vShade = 0.8 + 0.2 * cos(p.x * 4.0 + t);
        float col = mod(aCell, uGrid.x);
        float row = floor(aCell / uGrid.x);
        vUv = vec2((col + uv.x) / uGrid.x, 1.0 - (row + 1.0 - uv.y) / uGrid.y);
        vState = aState;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * im * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform vec3 uLight;
      varying vec2 vUv;
      varying float vShade;
      varying vec2 vState;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        if (t.a < 0.5) discard;
        vec3 c = t.rgb * vShade * (gl_FrontFacing ? 1.0 : 0.55) * uLight;
        c *= mix(0.55, 1.0, vState.x);
        c *= 1.0 + vState.y * (0.25 + 0.15 * sin(uTime * 6.0));
        gl_FragColor = vec4(min(c, vec3(${CRISP.toFixed(2)})), 1.0);
      }
    `,
    side: DoubleSide,
  });
}

// ------------------------------------------------------------------ fiamme (torce, lanterne, bracieri)
/**
 * Fiamma istanziata sempre rivolta alla camera (centro e scala da instanceMatrix, colore da instanceColor):
 * goccia increspata che si stringe in alto, nucleo chiaro; esce oltre il bianco (il bagliore la fa splendere).
 */
export function flameMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vSeed;
      void main() {
        ${INSTANCE_MAT}
        ${INSTANCE_COLOR}
        vUv = uv;
        vColor = ic;
        vec4 c = modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0);
        vSeed = fract(c.x * 0.37 + c.z * 0.71);
        float s = length(im[0].xyz);
        vec4 mv = viewMatrix * c;
        mv.xy += vec2(position.x, position.y + 0.5) * s;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vSeed;
      void main() {
        float y = vUv.y;
        float t = uTime * 3.2 + vSeed * 17.0;
        float wob = (sin(y * 7.0 - t * 2.1) * 0.13 + sin(y * 15.0 - t * 3.3) * 0.05) * y;
        float x = (vUv.x - 0.5) * 2.0 + wob;
        float width = mix(0.62, 0.02, pow(y, 0.85)) * (0.9 + 0.1 * sin(t * 1.7));
        float body = smoothstep(width, width * 0.3, abs(x)) * smoothstep(1.0, 0.7, y) * smoothstep(0.0, 0.1, y);
        float core = smoothstep(width * 0.5, 0.0, abs(x)) * smoothstep(0.6, 0.05, y);
        vec3 col = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.55, 0.1), body) * body * 2.4 + vec3(1.0, 0.85, 0.55) * core * 3.0;
        float a = clamp(body + core, 0.0, 1.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

// ------------------------------------------------------------------ lucciole
/** Lucciole sul molo e tra le palme: punti caldi che vagano piano e si accendono a intermittenza (sopra la soglia). */
export function fireflyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: 600 }, uArea: { value: new Vector3(30, 4, 22) }, uCenter: { value: new Vector3(0, 0, -2) }, uColor: { value: new Color(1.0, 0.82, 0.32) } },
    vertexShader: /* glsl */ `
      attribute vec3 seed;
      uniform float uTime;
      uniform float uPx;
      uniform vec3 uArea;
      uniform vec3 uCenter;
      varying float vA;
      void main() {
        float t = uTime;
        vec3 p = uCenter + (seed - 0.5) * uArea;
        p.y = uCenter.y + 0.4 + seed.y * uArea.y;
        p.x += sin(t * 0.21 + seed.z * 31.0) * 0.9 + sin(t * 0.53 + seed.x * 17.0) * 0.3;
        p.z += cos(t * 0.17 + seed.x * 23.0) * 0.9;
        p.y += sin(t * 0.37 + seed.z * 11.0) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float blink = pow(max(0.0, sin(t * (0.5 + seed.y * 0.9) + seed.x * 40.0)), 6.0);
        vA = blink;
        gl_PointSize = uPx * 0.05 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a * vA;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor * a * 3.0, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

// ------------------------------------------------------------------ mare della baia
/**
 * Mare di notte: onde come somma di seni (normale per pixel, le più piccole si spengono da lontano: niente
 * sfarfallio), Fresnel, cielo riflesso a gradiente, scia scintillante della luna, riflesso vero (lanterne, vela,
 * galeone) deformato dalle onde quando il profilo lo permette, nebbia del porto.
 */
export function seaMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: lin("#03101a") },
      uHorizon: { value: lin("#12333f") },
      uZenith: { value: lin("#061019") },
      uMoonDir: { value: new Vector3(-0.5, 0.2, -0.84).normalize() },
      uMoonCol: { value: lin("#cfdcff") },
      uFog: { value: lin(TIG.ink) },
      uFogNear: { value: 30 },
      uFogFar: { value: 160 },
      tReflect: { value: null as Texture | null },
      uTexMatrix: { value: new Matrix4() },
      uReflect: { value: 0 },
      uCalm: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uMoonDir;
      uniform vec3 uMoonCol;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform sampler2D tReflect;
      uniform mat4 uTexMatrix;
      uniform float uReflect;
      uniform float uCalm;
      varying vec3 vWPos;
      void main() {
        vec2 p = vWPos.xz;
        float t = uTime;
        float dist = length(cameraPosition - vWPos);
        float near = exp(-dist * 0.018);
        float amp = 1.0 - 0.55 * uCalm;
        vec2 g = vec2(0.0);
        g += 0.09 * vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 0.55 + t * 0.7);
        g += 0.07 * vec2(-0.6, 0.8) * cos(dot(p, vec2(-0.6, 0.8)) * 1.1 + t * 0.95);
        g += 0.06 * near * vec2(0.3, -0.95) * cos(dot(p, vec2(0.3, -0.95)) * 2.3 + t * 1.5);
        g += 0.05 * near * near * vec2(-0.9, -0.4) * cos(dot(p, vec2(-0.9, -0.4)) * 4.1 + t * 2.2);
        g *= amp;
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vWPos);
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.45, R.y));
        float m = max(dot(R, uMoonDir), 0.0);
        float glitter = pow(m, 300.0) * 2.4 + pow(m, 40.0) * 0.1;
        vec3 col = uDeep * (0.5 + 0.5 * N.y) + sky * fres * 0.9 + uMoonCol * glitter;
        if (uReflect > 0.0) {
          vec4 ru = uTexMatrix * vec4(vWPos, 1.0);
          vec2 uvr = ru.xy / ru.w + N.xz * 0.05;
          col += textureLod(tReflect, uvr, 1.0).rgb * uReflect * (0.3 + 0.7 * fres);
        }
        col = mix(col, uFog, smoothstep(uFogNear, uFogFar, dist));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// ------------------------------------------------------------------ cielo
/** Cupola del cielo notturno: gradiente, stelle che tremolano (griglia sulla sfera), alone della luna, foschia bassa. */
export function skyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uZenith: { value: lin("#03080f") },
      uHorizon: { value: lin("#0f2a35") },
      uMoonDir: { value: new Vector3(-0.5, 0.2, -0.84).normalize() },
      uMoonGlow: { value: lin("#9db6e6") },
      uDim: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uMoonDir;
      uniform vec3 uMoonGlow;
      uniform float uDim;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.55, h));
        vec3 sp = d * 180.0;
        vec3 cell = floor(sp);
        float r = hash(cell);
        float star = step(0.9962, r) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5));
        star *= (0.55 + 0.45 * sin(uTime * (0.8 + r * 3.0) + r * 60.0)) * smoothstep(0.03, 0.3, h);
        col += vec3(0.85, 0.9, 1.0) * star * 1.6;
        float m = max(dot(d, uMoonDir), 0.0);
        col += uMoonGlow * (pow(m, 90.0) * 0.5 + pow(m, 10.0) * 0.1 + pow(m, 3.0) * 0.03);
        gl_FragColor = vec4(col * uDim, 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
}

// ------------------------------------------------------------------ la grande vela (schermo dei contenuti)
/**
 * Vela con la pittura del canvas (testi nitidi: sotto la soglia del bagliore). La forma (pancia, trapezio) è nella
 * geometria; qui il vento la increspa piano e la luce delle lanterne la scalda dal basso, più scura ai bordi e
 * nelle pieghe. Stessi uniform del vecchio LED (uTime, uAlarm, uBright, uTint) così la regia è la stessa.
 */
export function sailMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: { value: 0 }, uAlarm: { value: 0 }, uBright: { value: 1 }, uTint: { value: new Color("#ffffff") }, uWind: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWind;
      varying vec2 vUv;
      varying float vFold;
      void main() {
        vUv = uv;
        vec3 p = position;
        float free = 1.0 - uv.y;
        float r1 = sin(p.x * 0.9 + uTime * 1.3) * 0.045 + sin(p.x * 2.3 - uTime * 1.9 + p.y * 0.8) * 0.018;
        p.z += r1 * free * uWind;
        vFold = 1.0 - 0.1 * sin(p.x * 2.3 - uTime * 1.9 + p.y * 0.8) * free * uWind;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uAlarm;
      uniform float uBright;
      uniform vec3 uTint;
      varying vec2 vUv;
      varying float vFold;
      void main() {
        vec3 c = texture2D(uMap, vUv).rgb;
        // luce delle lanterne da sotto, bordi in ombra
        float light = mix(1.0, 0.8, smoothstep(0.2, 1.0, vUv.y)) * (1.0 - 0.2 * pow(abs(vUv.x * 2.0 - 1.0), 3.0)) * vFold;
        // allarme: la tela rossa "respira" coi lampi dei cannoni
        float alarm = uAlarm * (0.8 + 0.2 * step(0.5, fract(uTime * 2.5)));
        c *= mix(1.0, alarm, uAlarm * 0.35);
        c *= light * uTint * uBright * ${CRISP.toFixed(2)};
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}
