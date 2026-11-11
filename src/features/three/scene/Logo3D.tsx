"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { AdditiveBlending, CircleGeometry, ExtrudeGeometry, Group, MeshBasicMaterial, SRGBColorSpace, Shape, type Texture } from "three";
import { useIntroClock } from "./clock";
import { LAYOUT } from "./layout";
import { Marquee, ellipsePoints } from "./Marquee";
import { createRadialTexture } from "./textures";
import { BRAND_LAYERS } from "../assets";
import { T, WHEEL_SPECIAL, clamp, easeInOutCubic, easeOutBack, easeOutCubic, lerp, prog, smooth, wheelAngle, wheelPointer } from "../timeline";

/**
 * Emblema ufficiale CHE NE SAI?! a strati:
 *  - ruota (spicchi arcobaleno + etichette) che GIRA — ridisegnata fedelmente (tools/logo_wheel.py)
 *  - cornice dorata fissa con lampadine 3D (inseguimento)
 *  - primo piano FERMO estratto dall'immagine del logo: scritta, lampadina-puntatore,
 *    pulsante, orbita e scintille (tools/logo_extract_front.py → logo-front-*.webp)
 */
const LOGO_FRONT_URL = BRAND_LAYERS.front;
const LOGO_FRONT_URL_LOW = BRAND_LAYERS.frontLow;
const LOGO_WHEEL_URL = BRAND_LAYERS.wheelHd;
const LOGO_WHEEL_URL_LOW = BRAND_LAYERS.wheel;
const LOGO_RIM_URL = BRAND_LAYERS.rim;

// geometria dell'emblema (pixel dell'immagine 1600×1491)
const IMG_W = 1600;
const IMG_H = 1491;
const WHEEL_CX = 772;
const WHEEL_CY = 800;
const RIM_OUT = 646;
const RIM_IN = RIM_OUT * 0.868;
const BULB_R = (RIM_IN + RIM_OUT) / 2;

const H = LAYOUT.logoHeight;
const W = (H * IMG_W) / IMG_H;
const PX = W / IMG_W; // metri per pixel
const WHEEL_X = (WHEEL_CX - IMG_W / 2) * PX;
const WHEEL_Y = -(WHEEL_CY - IMG_H / 2) * PX;

function setupTexture(t: Texture | Texture[]) {
  for (const tex of Array.isArray(t) ? t : [t]) {
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
  }
}

export function preloadLogoTextures(lowPower: boolean) {
  useTexture.preload(lowPower ? LOGO_FRONT_URL_LOW : LOGO_FRONT_URL);
  useTexture.preload(lowPower ? LOGO_WHEEL_URL_LOW : LOGO_WHEEL_URL);
  useTexture.preload(LOGO_RIM_URL);
}

export function Logo3D({ lowPower = false }: { lowPower?: boolean }) {
  const clock = useIntroClock();
  const root = useRef<Group>(null);
  const wheel = useRef<Group>(null);
  const glow = useRef<MeshBasicMaterial>(null);
  const front = useRef<MeshBasicMaterial>(null);
  const highlight = useRef<MeshBasicMaterial>(null);
  const pointer = useRef<Group>(null);
  const frontGroup = useRef<Group>(null);
  const [frontTex, wheelTex, rimTex] = useTexture([lowPower ? LOGO_FRONT_URL_LOW : LOGO_FRONT_URL, lowPower ? LOGO_WHEEL_URL_LOW : LOGO_WHEEL_URL, LOGO_RIM_URL], setupTexture);

  const glowTex = useMemo(
    () =>
      createRadialTexture([
        [0, "rgba(255,200,110,0.95)"],
        [0.3, "rgba(255,40,160,0.5)"],
        [0.65, "rgba(131,43,255,0.18)"],
        [1, "rgba(0,0,0,0)"],
      ]),
    [],
  );
  // spicchio "INIZIA GIOCO" in alto: si illumina quando la ruota si ferma
  const wedgeGeo = useMemo(() => new CircleGeometry(RIM_IN * PX, 24, Math.PI / 2 - WHEEL_SPECIAL / 2, WHEEL_SPECIAL), []);
  const bulbs = useMemo(() => ellipsePoints(BULB_R * PX, BULB_R * PX, 28, 0.06), []);
  // puntatore: goccia dorata con la punta verso il centro della ruota
  const pointerGeo = useMemo(() => {
    const sh = new Shape();
    const w = 0.2;
    const len = (RIM_OUT - RIM_IN) * PX + 0.14;
    sh.moveTo(0, -len);
    sh.quadraticCurveTo(w * 0.9, -len * 0.45, w, 0);
    sh.absarc(0, 0, w, 0, Math.PI, false);
    sh.quadraticCurveTo(-w * 0.9, -len * 0.45, 0, -len);
    return new ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 16 });
  }, []);
  useEffect(
    () => () => {
      glowTex.dispose();
      wedgeGeo.dispose();
      pointerGeo.dispose();
    },
    [glowTex, wedgeGeo, pointerGeo],
  );

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const { t, e, reducedMotion } = clock.current;
    g.visible = t >= T.wheelIn;

    // ---- ingresso della sola ruota, volo verso il fondo, respiro
    const enter = prog(t, T.wheelIn, T.wheelIn + (reducedMotion ? 0.5 : 0.9));
    const fly = easeInOutCubic(prog(t, T.logoBack, T.logoBack + (reducedMotion ? 1.2 : 1.6)));
    const a = LAYOUT.logoReveal;
    const b = LAYOUT.logo;
    const arc = reducedMotion ? 0 : Math.sin(fly * Math.PI) * 1.6;
    const float = reducedMotion ? 0 : Math.sin(e * 1.1) * 0.05;
    // finché c'è solo la ruota, è LEI a stare al centro dello schermo (non l'emblema)
    const center = 1 - fly;
    g.position.set(lerp(a.x, b.x, fly) - WHEEL_X * center, lerp(a.y, b.y, fly) + arc + float - WHEEL_Y * center, lerp(a.z, b.z, fly));
    // pulsazione sul ritmo durante il titolo/annunciatore
    const ann = t >= T.title + 0.6 && t < T.entrance ? 1 : 0;
    const beat = ann * Math.pow(0.5 + 0.5 * Math.sin((t - T.title) * Math.PI * 2 * 2.2), 3);
    const s = (reducedMotion ? easeOutCubic(enter) : easeOutBack(enter, 1.7)) * (1 + (reducedMotion ? 0 : beat * 0.04));
    g.scale.setScalar(Math.max(0.0001, s));
    g.rotation.z = reducedMotion ? 0 : (1 - easeOutCubic(enter)) * -0.5;
    g.rotation.y = reducedMotion ? 0 : Math.sin(fly * Math.PI) * 0.4 + (t > T.title ? Math.sin(e * 0.45) * 0.05 : 0);

    // ---- la ruota gira (solo gli spicchi: cornice e puntatore restano fermi)
    const angle = wheelAngle(t);
    if (wheel.current) wheel.current.rotation.z = -angle;
    // cricchetto: il puntatore "scatta" quando passa un divisorio
    const pt = pointer.current;
    if (pt) {
      // subito dopo un divisorio il puntatore (local vicino a 1) scatta e torna giù
      const { local } = wheelPointer(t);
      const kick = t >= T.spinStart && t < T.wheelStop + 0.4 && !reducedMotion ? Math.exp(-(1 - local) * 9) * 0.45 : 0;
      pt.rotation.z = kick;
      // dopo il titolo la lampadina fa da puntatore: quello dorato sparisce
      pt.visible = t < T.title + 0.25;
    }

    // ---- primo piano (scritta, lampadina, pulsante): entra di colpo sul titolo
    const pop = prog(t, T.title, T.title + (reducedMotion ? 0.35 : 0.75));
    const fg = frontGroup.current;
    if (fg) {
      fg.visible = t >= T.title;
      const ps = reducedMotion ? easeOutCubic(pop) : easeOutBack(pop, 3.2);
      fg.scale.setScalar(Math.max(0.0001, ps));
      fg.rotation.z = reducedMotion ? 0 : (1 - easeOutCubic(pop)) * 0.35;
    }

    // ---- luci
    const stopFlash = t >= T.wheelStop ? Math.exp(-(t - T.wheelStop) * 2.2) : 0;
    const titleFlash = t >= T.title ? Math.exp(-(t - T.title) * 2.5) : 0;
    const glowBase = smooth(enter) * (t < T.logoBack ? 0.75 : 0.7);
    if (glow.current) glow.current.color.setScalar(glowBase + stopFlash * 0.8 + titleFlash * 1.2 + beat * 0.9 + 0.08 * Math.sin(e * 2));
    if (highlight.current) {
      const on = t >= T.wheelStop - 0.05 ? clamp(1 - (t - T.title + 0.3) / 0.6) : 0;
      const blink = reducedMotion ? 1 : 0.55 + 0.45 * Math.sign(Math.sin((t - T.wheelStop) * Math.PI * 6));
      // lampeggio leggero: lo spicchio "si accende" senza sbiancare la scritta
      highlight.current.color.setScalar(on * blink * 0.05);
    }
    if (front.current) front.current.color.setScalar(1 + beat * 0.12 + titleFlash * 0.35);
  });

  return (
    <group ref={root} visible={false}>
      {/* alone dietro l'emblema */}
      <mesh position={[0, 0, -0.4]} renderOrder={2}>
        <planeGeometry args={[W * 2.6, H * 2.2]} />
        <meshBasicMaterial ref={glow} map={glowTex} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <group position={[WHEEL_X, WHEEL_Y, 0]}>
        {/* spicchi che girano */}
        <group ref={wheel}>
          <mesh renderOrder={3}>
            <planeGeometry args={[RIM_IN * PX * 2.048, RIM_IN * PX * 2.048]} />
            <meshBasicMaterial map={wheelTex} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
        <mesh geometry={wedgeGeo} position={[0, 0, 0.01]} renderOrder={4}>
          <meshBasicMaterial ref={highlight} color="#000000" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
        {/* cornice dorata fissa + lampadine a inseguimento */}
        <mesh position={[0, 0, 0.02]} renderOrder={5}>
          <planeGeometry args={[RIM_OUT * PX * 2 * 1.00385, RIM_OUT * PX * 2 * 1.00385]} />
          <meshBasicMaterial map={rimTex} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <Marquee points={bulbs} onFrom={T.wheelIn} onTo={T.wheelIn + 1.2} color="#FFF1C8" color2="#FFFFFF" radius={0.07} haloSize={0.42} chase={1} />
        {/* puntatore dorato in cima alla cornice (cricchetto) */}
        <group ref={pointer} position={[0, RIM_OUT * PX * 0.985, 0.08]}>
          <mesh geometry={pointerGeo} position={[0, 0, 0]}>
            <meshStandardMaterial color="#ffd84a" emissive="#ffb000" emissiveIntensity={1.1} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.02, 0.09]}>
            <sphereGeometry args={[0.085, 16, 12]} />
            <meshStandardMaterial color="#ff2a55" emissive="#c0002a" emissiveIntensity={0.8} roughness={0.2} />
          </mesh>
        </group>
      </group>
      {/* primo piano fermo: scritta, lampadina, pulsante, orbita (entra sul titolo) */}
      <group ref={frontGroup} position={[WHEEL_X, WHEEL_Y, 0.16]} visible={false}>
        <mesh position={[-WHEEL_X, -WHEEL_Y, 0]} renderOrder={9}>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial ref={front} map={frontTex} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
