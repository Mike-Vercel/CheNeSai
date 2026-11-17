import { AdditiveBlending, Color, DoubleSide, FrontSide, ShaderMaterial, type Texture } from "three";
import { DIGIT_CELLS } from "./textures";

/**
 * Materiali-shader dell'arena (tutti compatibili con InstancedMesh: `instanceMatrix` e `instanceColor` arrivano
 * dal prefisso di three quando la mesh è istanziata). Niente luci vere per gli elementi luminosi: neon, ologrammi,
 * coni di luce, cifre e schermi sono "emissivi" e costano pochissimo anche con 20 torri.
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

/**
 * Cifre istanziate da un atlante (0–9 + − ·). `billboard`: ogni cifra ha un centro (aCenter) e uno scarto in spazio
 * vista (aOffset × aSize), così un numero resta leggibile da qualsiasi angolo. Altrimenti si usa instanceMatrix.
 */
export function glyphMaterial(atlas: Texture, billboard: boolean): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uAtlas: { value: atlas }, uCells: { value: DIGIT_CELLS } },
    vertexShader: /* glsl */ `
      attribute float aGlyph;
      attribute float aAlpha;
      ${billboard ? "attribute vec3 aCenter; attribute vec2 aOffset; attribute float aSize;" : ""}
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlyph;
      void main() {
        ${INSTANCE_COLOR}
        vUv = uv;
        vColor = ic;
        vAlpha = aAlpha;
        vGlyph = aGlyph;
        ${
          billboard
            ? `vec4 mv = viewMatrix * vec4(aCenter, 1.0);
               mv.xy += (position.xy + aOffset) * aSize;
               gl_Position = projectionMatrix * mv;`
            : `${INSTANCE_MAT}
               gl_Position = projectionMatrix * viewMatrix * modelMatrix * im * vec4(position, 1.0);`
        }
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform float uCells;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlyph;
      void main() {
        vec4 t = texture2D(uAtlas, vec2((floor(vGlyph + 0.5) + vUv.x) / uCells, vUv.y));
        float a = t.a * vAlpha;
        if (a < 0.02) discard;
        // il bianco dell'atlante diventa il colore della cifra, il contorno scuro resta scuro
        vec3 col = vColor * t.rgb * 1.35;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/**
 * Colonna delle torri (prisma esagonale istanziato, altezza = scala Y). Acciaio scuro con spigoli al neon del colore
 * della squadra, tacche orizzontali ogni 25 cm, fascia luminosa in cima. `aState`: x = online (0/1), y = in primo
 * piano (0..1), z = lampo (0..1).
 */
export function columnMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uKey: { value: new Color("#fff1e2") }, uAmb: { value: 0.18 } },
    vertexShader: /* glsl */ `
      attribute vec3 aState;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vColor;
      varying vec3 vState;
      varying float vWy;
      varying float vH;
      void main() {
        ${INSTANCE_MAT}
        ${INSTANCE_COLOR}
        vUv = uv;
        vColor = ic;
        vState = aState;
        vec4 wp = modelMatrix * im * vec4(position, 1.0);
        vWy = wp.y;
        vH = length(im[1].xyz);
        vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
        vec4 mv = viewMatrix * wp;
        vV = normalize(-mv.xyz);
        vN = normalize((viewMatrix * vec4(vN, 0.0)).xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uKey;
      uniform float uAmb;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vColor;
      varying vec3 vState;
      varying float vWy;
      varying float vH;
      void main() {
        float online = vState.x;
        vec3 team = mix(vec3(dot(vColor, vec3(0.3, 0.59, 0.11))) * 0.35, vColor, online);
        // spigoli dell'esagono (uv.x da 0 a 1 attorno, 6 facce): linee sottili al neon
        float f = fract(vUv.x * 6.0);
        float edge = smoothstep(0.045, 0.0, f) + smoothstep(0.955, 1.0, f);
        // tacche ogni 25 cm (in metri veri)
        float tick = smoothstep(0.47, 0.5, abs(fract(vWy * 4.0) - 0.5));
        // fascia luminosa in cima, luce interna che sale dal basso verso il tappo
        float top = smoothstep(0.9, 1.0, vUv.y);
        float inner = smoothstep(0.15, 1.0, vUv.y);
        float facing = clamp(dot(vN, vV), 0.0, 1.0);
        float rim = pow(1.0 - facing, 3.0);
        float lit = uAmb + 0.6 * clamp(dot(vN, normalize(vec3(0.3, 0.6, 0.75))), 0.0, 1.0);
        // vetro fumé: quasi nero, un riflesso freddo verticale sulle facce verso la luce
        float streak = smoothstep(0.35, 0.5, fract(vUv.x * 6.0)) * smoothstep(0.65, 0.5, fract(vUv.x * 6.0));
        vec3 base = vec3(0.02, 0.026, 0.036) * (0.6 + lit * 1.6) + vec3(0.06, 0.07, 0.085) * streak * lit;
        float pulse = 0.88 + 0.12 * sin(uTime * 2.0 + vWy * 3.0);
        vec3 glow = team * (edge * 2.0 * pulse + tick * 0.22 + top * 1.9 + rim * 0.12 + inner * 0.16);
        glow *= 0.5 + 0.5 * online;
        glow += team * vState.y * (0.55 + 0.45 * sin(uTime * 6.0)) * 0.55;
        glow += vec3(1.0) * vState.z * 1.2;
        gl_FragColor = vec4(base + glow, 1.0);
      }
    `,
    toneMapped: false,
  });
}

/**
 * Anello dell'Energia Caos attorno alla mascotte (RingGeometry nel piano XZ, uv.x = angolo). `aProgress` 0..1 verso
 * il prossimo livello, `aLevel` 1..3 (al 3 l'anello è pieno e dorato-viola). Pronto a evolvere (≥ 0,98) = pulsa.
 */
export function chaosRingMaterial(chaosColor: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uChaos: { value: new Color(chaosColor) } },
    vertexShader: /* glsl */ `
      attribute float aProgress;
      attribute float aLevel;
      attribute float aOnline;
      varying vec2 vUv;
      varying float vP;
      varying float vL;
      varying float vO;
      varying vec3 vPos;
      void main() {
        ${INSTANCE_MAT}
        vUv = uv;
        vP = aProgress;
        vL = aLevel;
        vO = aOnline;
        vPos = position;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * im * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uChaos;
      varying vec2 vUv;
      varying float vP;
      varying float vL;
      varying float vO;
      varying vec3 vPos;
      void main() {
        float ang = atan(vPos.x, vPos.y) / 6.28318 + 0.5; // 0..1 a partire dal davanti
        float r = length(vPos.xy);
        float filled = step(ang, vP);
        float seg = smoothstep(0.0, 0.012, abs(fract(ang * 24.0) - 0.5) - 0.04);
        float ready = step(0.98, vP);
        float pulse = 0.65 + 0.35 * sin(uTime * 7.0);
        vec3 track = uChaos * 0.12;
        vec3 fill = uChaos * (1.5 + ready * pulse * 1.4);
        if (vL > 2.5) fill = mix(uChaos, vec3(1.0, 0.82, 0.35), 0.45) * (1.6 + 0.3 * sin(uTime * 3.0 + ang * 12.0));
        vec3 col = mix(track, fill, max(filled, step(2.5, vL))) * seg;
        float a = mix(0.45, 1.0, max(filled, step(2.5, vL))) * seg * (0.35 + 0.65 * vO);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
}

/**
 * Ologramma del segnaposto della mascotte: bordo di Fresnel, righe di scansione che salgono, tremolio leggero.
 * `aFx`: x = luce propria, y = lampo bianco, z = lampo rosso, w = online.
 */
export function hologramMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec4 aFx;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vColor;
      varying vec4 vFx;
      varying float vY;
      void main() {
        ${INSTANCE_MAT}
        ${INSTANCE_COLOR}
        vColor = ic;
        vFx = aFx;
        vec4 wp = modelMatrix * im * vec4(position, 1.0);
        vY = wp.y;
        vec4 mv = viewMatrix * wp;
        vV = normalize(-mv.xyz);
        vN = normalize((viewMatrix * vec4(mat3(modelMatrix) * mat3(im) * normal, 0.0)).xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vColor;
      varying vec4 vFx;
      varying float vY;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float fres = pow(1.0 - facing, 1.6);
        float scan = 0.55 + 0.45 * smoothstep(0.3, 0.7, fract(vY * 18.0 - uTime * 1.4));
        float band = smoothstep(0.0, 0.08, abs(fract(vY * 1.3 - uTime * 0.35) - 0.5));
        float flick = 0.92 + 0.08 * sin(uTime * 37.0 + vY * 9.0) * sin(uTime * 13.0);
        vec3 c = mix(vec3(dot(vColor, vec3(0.3, 0.59, 0.11))) * 0.4, vColor, vFx.w);
        vec3 col = c * (0.28 + fres * 1.9) * scan * flick * vFx.x;
        col += c * (1.0 - band) * 0.5 * vFx.x;
        col = mix(col, vec3(1.0), vFx.y * 0.85);
        col = mix(col, vec3(1.0, 0.12, 0.15) * 1.6, vFx.z * 0.8);
        float a = clamp(0.35 + fres * 0.65, 0.0, 1.0) * (0.55 + 0.45 * vFx.w);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}

/** Bagliori istanziati sempre rivolti alla camera (centro e scala da instanceMatrix, colore × intensità da instanceColor). */
export function spriteMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uMap: { value: map } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        ${INSTANCE_MAT}
        ${INSTANCE_COLOR}
        vUv = uv;
        vColor = ic;
        vec4 c = modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0);
        float s = length(im[0].xyz);
        vec4 mv = viewMatrix * c;
        mv.xy += position.xy * s;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        gl_FragColor = vec4(vColor * t.rgb * t.a, t.a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

/** Superfici additive istanziate con texture (pozze di luce, anelli, fascia di testo che scorre). */
export function additiveMapMaterial(map: Texture, scroll = 0): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: { value: 0 }, uScroll: { value: scroll } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vPhase;
      void main() {
        ${INSTANCE_MAT}
        ${INSTANCE_COLOR}
        vUv = uv;
        vColor = ic;
        vPhase = aPhase;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * im * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uScroll;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vPhase;
      void main() {
        vec4 t = texture2D(uMap, vec2(vUv.x + uTime * uScroll + vPhase, vUv.y));
        gl_FragColor = vec4(vColor * t.rgb * t.a, t.a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}

/** Coni di luce nella foschia (istanziati: posizione/direzione/scala da instanceMatrix, colore × intensità da instanceColor). */
export function coneMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uHaze: { value: 1 } },
    vertexShader: /* glsl */ `
      varying float vH;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vColor;
      void main() {
        ${INSTANCE_MAT}
        ${INSTANCE_COLOR}
        vH = uv.y;
        vColor = ic;
        vec4 mv = viewMatrix * modelMatrix * im * vec4(position, 1.0);
        vN = normalize((viewMatrix * vec4(mat3(modelMatrix) * mat3(im) * normal, 0.0)).xyz);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHaze;
      varying float vH;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vColor;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.7);
        float along = pow(vH, 1.4) * 0.85 + 0.15 * vH;
        // solo le facce davanti (metà dei pixel): si compensa la luminosità
        float a = edge * along * uHaze * 1.55;
        if (a < 0.002) discard;
        gl_FragColor = vec4(vColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
    toneMapped: false,
  });
}

/**
 * Schermo LED: texture disegnata su canvas + griglia di pixel, banda di scansione, lampeggio dell'allarme e tinta
 * dell'atmosfera, tutto nello shader (il canvas si ridisegna solo quando cambia il contenuto).
 */
export function ledMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uAlarm: { value: 0 },
      uBright: { value: 1 },
      uTint: { value: new Color("#ffffff") },
      uGrid: { value: [1100, 300] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uAlarm;
      uniform float uBright;
      uniform vec3 uTint;
      uniform vec2 uGrid;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(uMap, vUv).rgb;
        // pixel del LED (griglia procedurale: nitida a ogni distanza)
        vec2 g = fract(vUv * uGrid);
        float px = smoothstep(0.0, 0.18, g.x) * smoothstep(1.0, 0.82, g.x) * smoothstep(0.0, 0.18, g.y) * smoothstep(1.0, 0.82, g.y);
        c *= 0.9 + 0.1 * px;
        // banda di scansione lenta
        float scan = smoothstep(0.0, 0.04, abs(fract(vUv.y * 0.5 - uTime * 0.12) - 0.5) - 0.0);
        c *= 0.94 + 0.06 * scan;
        // allarme: il rosso pulsa a 2,5 Hz
        float alarm = uAlarm * (0.55 + 0.45 * step(0.5, fract(uTime * 2.5)));
        c = mix(c, c * vec3(1.35, 0.55, 0.55) + vec3(0.18, 0.0, 0.01), alarm * 0.6);
        c *= uTint * uBright;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    toneMapped: false,
  });
}

/** Nastro LED attorno all'arena: frecce che scorrono e colori delle squadre (uv.x lungo il nastro). */
export function ribbonMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new Color("#ff8a1f") }, uB: { value: new Color("#2de2ff") }, uBoost: { value: 0 }, uAlarm: { value: 0 }, uLen: { value: 60 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uA;
      uniform vec3 uB;
      uniform float uBoost;
      uniform float uAlarm;
      uniform float uLen;
      varying vec2 vUv;
      void main() {
        float x = vUv.x * uLen;
        vec2 cell = vec2(fract(x * 4.0), fract(vUv.y * 6.0));
        float dotm = smoothstep(0.5, 0.25, length(cell - 0.5));
        float chev = step(0.5, fract(x * 0.5 - abs(vUv.y - 0.5) * 0.8 - uTime * (0.6 + uBoost * 1.6)));
        float wave = 0.5 + 0.5 * sin(x * 0.35 - uTime * 1.3);
        vec3 col = mix(uA, uB, wave) * (0.15 + 1.1 * chev) * dotm;
        float al = uAlarm * step(0.5, fract(uTime * 2.5));
        col = mix(col, vec3(1.0, 0.08, 0.12) * dotm * 1.6, al);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    toneMapped: false,
  });
}

/** Pulviscolo nei fasci di luce (punti calcolati nello shader). */
export function dustMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: 600 }, uColor: { value: new Color("#fff2dc") }, uSize: { value: 16 }, uH: { value: 9 } },
    vertexShader: /* glsl */ `
      attribute vec3 seed;
      uniform float uTime;
      uniform float uPx;
      uniform float uSize;
      uniform float uH;
      varying float vA;
      void main() {
        float y = mod(seed.y * uH + uTime * (0.04 + 0.07 * seed.z), uH);
        vec3 p = vec3((seed.x - 0.5) * uSize + sin(uTime * 0.2 + seed.z * 6.0) * 0.3, y, (seed.z - 0.5) * uSize * 0.8);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = smoothstep(0.0, 1.0, y) * (1.0 - smoothstep(uH - 1.5, uH, y)) * (0.3 + 0.7 * seed.x);
        gl_PointSize = uPx * (0.014 + 0.016 * seed.y) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * 0.5;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}
