"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { AdditiveBlending, Color, Group, MeshBasicMaterial, SRGBColorSpace, type ShaderMaterial, type Texture } from "three";
import { setHostWalking, useIntroClock } from "./clock";
import { createLookOut, sampleLook } from "./look";
import { LAYOUT } from "./layout";
import { rimGlowFragment, rimGlowVertex } from "./shaders";
import { createGlowMask, createRadialTexture } from "./textures";
import { CHARACTERS, type CharacterId } from "../assets";
import { GlbCharacter, getGlbConfig } from "../characters/glb-character";
import { HOST_GLB, HostGlbModel, hostGlbEnabled } from "../characters/glb-host";
import { GlbBoundary } from "../characters/host-auto";
import { CHARACTER_HEIGHTS, CHARACTER_MODELS } from "../characters/registry";
import { useCharacterMode } from "../characters/character-mode";
import type { CharacterAnimation } from "../characters/types";
import { getVoice } from "@/features/media/voice";
import { HOST_WALK, T, WALK, type WalkingHost, clamp, easeOutBack, easeOutBounce, easeOutCubic, lerp, hostWalkPose, podiumRide, prog, smooth, type Speaker } from "../timeline";

/** Configura una texture-ritaglio: sRGB + alfa premoltiplicata (niente aloni chiari/scuri sui bordi). */
export function setupCutoutTexture(tex: Texture | Texture[]) {
  const list = Array.isArray(tex) ? tex : [tex];
  for (const t of list) {
    t.colorSpace = SRGBColorSpace;
    t.premultiplyAlpha = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
}

export function characterUrl(id: CharacterId, lowPower: boolean) {
  return lowPower ? CHARACTERS[id].srcLow : CHARACTERS[id].src;
}

interface CutoutProps {
  id: CharacterId;
  height: number;
  lowPower: boolean;
  rimColorIndex?: "rim" | "a" | "c";
  /** Riferimento al gruppo da animare (posizionato dal genitore). */
  groupRef: React.RefObject<Group | null>;
  /** Intensità del controluce (0..1) scritta dal genitore. */
  rimRef: React.RefObject<number>;
}

/** Piano 2.5D con il ritaglio del personaggio + alone sagomato (controluce). */
function Cutout({ id, height, lowPower, rimColorIndex = "rim", groupRef, rimRef }: CutoutProps) {
  const clock = useIntroClock();
  const tex = useTexture(characterUrl(id, lowPower), setupCutoutTexture);
  const width = height * CHARACTERS[id].aspect;
  const glowMat = useRef<ShaderMaterial>(null);
  const look = useMemo(() => createLookOut(), []);
  const pad = 0.1;
  // maschera dell'alone calcolata una sola volta (1 campione per pixel in GPU)
  const mask = useMemo(() => createGlowMask(tex.image as HTMLImageElement, pad), [tex]);
  useEffect(() => () => mask?.dispose(), [mask]);
  const uniforms = useMemo(
    () => ({
      uMask: { value: mask },
      uColor: { value: new Color() },
      uIntensity: { value: 0 },
    }),
    [mask],
  );
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: tex,
        transparent: true,
        premultipliedAlpha: true,
        alphaTest: 0.004,
        depthWrite: false,
        toneMapped: false,
      }),
    [tex],
  );

  useFrame(() => {
    const m = glowMat.current;
    if (!m) return;
    const { t, e } = clock.current;
    sampleLook(t, look);
    (m.uniforms.uColor.value as Color).copy(look[rimColorIndex]);
    m.uniforms.uIntensity.value = rimRef.current * (0.95 + 0.15 * Math.sin(e * 2.3));
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* origine del gruppo = centro del bordo inferiore dell'immagine */}
      <mesh position={[0, height / 2, -0.04]} scale={[1 + pad * 2, 1 + pad * 2, 1]} renderOrder={8} visible={mask !== null}>
        <planeGeometry args={[width, height]} />
        <shaderMaterial
          ref={glowMat}
          vertexShader={rimGlowVertex}
          fragmentShader={rimGlowFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, height / 2, 0]} material={material} renderOrder={10}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

/**
 * Animazione del modello 3D in base al copione: entrata, chi parla ("talk"),
 * reazioni degli altri (saluto, indicare, sorpresa), festa finale.
 */
export function introAnimationFor(id: CharacterId, t: number, voiceSpeaking: boolean, who: Speaker | null, rule = -1): CharacterAnimation {
  // entrata: i presentatori spuntano dal podio salutando, Palmino fa la sua "intro" quando atterra
  if (id === "palmino" && t < T.pushIn) return "intro";
  // i presentatori arrivano salutando dal podio in corsa
  if (id === "professore" && t < WALK.profTo + 0.6) return "wave";
  if (id === "regina" && t < WALK.reginaTo + 0.6) return "wave";
  if (t < T.welcome) return "wave";
  if (t >= T.end) return id === "palmino" ? "celebrate" : "wave";
  if (t >= T.countdown) return id === "palmino" ? "celebrate" : "idle";
  if (voiceSpeaking || who === id) return "talk";
  // regole: chi non parla ascolta e ogni tanto indica/annuisce
  if (rule >= 0) return (rule + (id === "regina" ? 1 : 0)) % 3 === 0 ? "point" : "idle";
  if (t >= T.welcome && t < T.lineProf) return "wave";
  if (who === "palmino" && t < T.linePalmino + 1.5) return "surprised";
  if (who) return id === "professore" ? "point" : "idle";
  return "idle";
}

/**
 * Personaggio 3D procedurale dentro il gruppo animato dell'intro:
 * animazione scelta dal copione, bocca guidata dalla voce.
 */
function Procedural3D({ id, height, lowPower }: { id: CharacterId; height: number; lowPower: boolean }) {
  const clock = useIntroClock();
  const Model = CHARACTER_MODELS[id];
  // un modello montato (o rimontato) a intro in corso parte dall'animazione giusta per QUESTO istante
  const [anim, setAnim] = useState<CharacterAnimation>(() => {
    const c = clock.current;
    return introAnimationFor(id, c.t, false, c.speaker, c.rule);
  });
  const [mouth, setMouth] = useState(0);
  const last = useRef({ anim, mouth: 0 });
  useFrame((_, dt) => {
    const { t } = clock.current;
    const a = introAnimationFor(id, t, getVoice().speaking === id, clock.current.speaker, clock.current.rule);
    const m = getVoice().mouthOpen(id, dt);
    const l = last.current;
    if (a !== l.anim) {
      l.anim = a;
      setAnim(a);
    }
    if (Math.abs(m - l.mouth) > 0.05 || (m === 0 && l.mouth !== 0)) {
      l.mouth = m;
      setMouth(m);
    }
  });
  // L'ambiente dell'intro è tarato per far brillare l'oro: sui personaggi va attenuato,
  // altrimenti pelle e vestiti risultano slavati.
  const root = useRef<Group>(null);
  const tuned = useRef({ idle: 0, seen: false });
  useFrame(() => {
    const g = root.current;
    if (!g || tuned.current.idle > 30) return;
    let n = 0;
    g.traverse((o) => {
      const mats = (o as { material?: unknown }).material;
      for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
        const mm = m as { envMapIntensity?: number; userData: Record<string, unknown> };
        if (mm.envMapIntensity !== undefined && !mm.userData.qzIntroEnv) {
          mm.envMapIntensity = Math.min(mm.envMapIntensity, 0.3);
          mm.userData.qzIntroEnv = true;
          n++;
        }
      }
    });
    // il modello arriva in differita (Suspense): si smette solo dopo averlo visto e sistemato
    if (n > 0) tuned.current.seen = true;
    else if (tuned.current.seen) tuned.current.idle++;
  });
  return (
    <group ref={root}>
      <Model animation={anim} mouthOpen={mouth} lowPower={lowPower} scale={height / CHARACTER_HEIGHTS[id]} />
    </group>
  );
}

/**
 * Clip di parlata scelta dal copione (deterministica anche dopo un ricaricamento):
 * regole → alternate per indice; presentazione → "benvenuti" 0 e battuta propria 1 per il
 * Professore, 0 per la Regina.
 */
function talkVariantAt(who: WalkingHost, t: number, rule: number) {
  if (rule >= 0) return rule + (who === "regina" ? 1 : 0);
  return who === "professore" && t >= T.lineProf ? 1 : 0;
}

/**
 * Presentatore GLB che entra a piedi: la posizione la scrive `Characters` (hostWalkPose),
 * qui si guidano peso e velocità della clip Walking e le animazioni del copione.
 */
function HostWalker({ who, lowPower }: { who: WalkingHost; lowPower: boolean }) {
  const clock = useIntroClock();
  const walkRef = useRef(0);
  const rateRef = useRef(1);
  const [anim, setAnim] = useState<CharacterAnimation>(() => {
    const c = clock.current;
    return introAnimationFor(who, c.t, false, c.speaker, c.rule);
  });
  const [mouth, setMouth] = useState(0);
  const [variant, setVariant] = useState(() => talkVariantAt(who, clock.current.t, clock.current.rule));
  const last = useRef({ anim, mouth: 0, variant });
  useFrame((_, dt) => {
    const c = clock.current;
    const v = talkVariantAt(who, c.t, c.rule);
    if (v !== last.current.variant) {
      last.current.variant = v;
      setVariant(v);
    }
    const w = hostWalkPose(who, c.t, c.reducedMotion);
    walkRef.current = w.walk;
    // passi alla stessa velocità del corpo (scala della scena inclusa); in giro: passi sul posto
    rateRef.current = w.turning ? 0.6 : w.speed / (HOST_GLB[who].walkSpeed * HOST_WALK[who].scale);
    const a = introAnimationFor(who, c.t, getVoice().speaking === who, c.speaker, c.rule);
    const m = getVoice().mouthOpen(who, dt);
    const l = last.current;
    if (a !== l.anim) {
      l.anim = a;
      setAnim(a);
    }
    if (Math.abs(m - l.mouth) > 0.04 || (m === 0 && l.mouth !== 0)) {
      l.mouth = m;
      setMouth(m);
    }
  });
  return <HostGlbModel who={who} fullBody animation={anim} mouthOpen={mouth} lowPower={lowPower} walkRef={walkRef} walkRateRef={rateRef} talkVariant={variant} />;
}

/** Posa del gruppo di un presentatore che entra a piedi (posizione, quota dei gradini, giro verso la camera). */
function placeWalker(g: Group, who: WalkingHost, t: number, reduced: boolean, camX: number, camZ: number) {
  const W = HOST_WALK[who];
  const w = hostWalkPose(who, t, reduced);
  g.visible = t >= W.t0 - 0.05;
  g.position.set(w.x, w.y, w.z);
  g.scale.setScalar(W.scale);
  const face = Math.atan2(camX - w.x, camZ - w.z) * 0.55;
  const k = reduced ? 1 : smooth(prog(t, W.t1 - 0.1, W.t1 + W.turn));
  g.rotation.set(0, lerpAngle(w.heading, face, k), 0);
}

/** Interpola due angoli lungo l'arco più breve. */
function lerpAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/**
 * Personaggio dell'intro, in ordine di priorità:
 * 1. modello GLB riggato, se configurato (characters/glb-character.tsx)
 * 2. modello 3D procedurale, se il TV è in modalità "personaggi 3D"
 * 3. ritaglio 2.5D dell'illustrazione originale (PC poco potenti)
 * Il gruppo animato (entrate, rimbalzi, salto sul logo) è lo stesso per tutti.
 */
function CharacterSlot({ id, height, lowPower, rimColorIndex, groupRef, rimRef }: CutoutProps) {
  const glb = getGlbConfig(id);
  const { mode } = useCharacterMode();
  if (glb) {
    return (
      <group ref={groupRef} visible={false}>
        <Suspense fallback={null}>
          <GlbCharacter id={id} config={glb} />
        </Suspense>
      </group>
    );
  }
  if (mode === "3d") {
    return (
      <group ref={groupRef} visible={false}>
        <Suspense fallback={null}>
          <Procedural3D id={id} height={height} lowPower={lowPower} />
        </Suspense>
      </group>
    );
  }
  return <Cutout id={id} height={height} lowPower={lowPower} rimColorIndex={rimColorIndex} groupRef={groupRef} rimRef={rimRef} />;
}

/** Rivolge parzialmente il piano verso la camera (solo asse Y): parallasse senza vederlo "di taglio". */
function faceCamera(g: Group, camX: number, camZ: number, amount: number) {
  const ang = Math.atan2(camX - g.position.x, camZ - g.position.z);
  g.rotation.y = ang * amount;
}

export function Characters({ lowPower }: { lowPower: boolean }) {
  const clock = useIntroClock();
  const { mode } = useCharacterMode();
  // presentatori GLB a piedi (solo con i personaggi 3D); se il file non si carica: podio in corsa + procedurale
  const [profOk, setProfOk] = useState(() => hostGlbEnabled("professore"));
  const [regOk, setRegOk] = useState(() => hostGlbEnabled("regina"));
  const profWalk = mode === "3d" && profOk;
  const regWalk = mode === "3d" && regOk;
  useEffect(() => {
    setHostWalking(clock, "professore", profWalk);
    setHostWalking(clock, "regina", regWalk);
  }, [clock, profWalk, regWalk]);
  const prof = useRef<Group>(null);
  const reg = useRef<Group>(null);
  const palm = useRef<Group>(null);
  const shadow = useRef<Group>(null);
  const profRim = useRef(0);
  const regRim = useRef(0);
  const palmRim = useRef(0);
  const shadowTex = useMemo(
    () =>
      createRadialTexture([
        [0, "rgba(255,255,255,1)"],
        [0.5, "rgba(255,255,255,0.45)"],
        [1, "rgba(255,255,255,0)"],
      ]),
    [],
  );
  useEffect(() => () => shadowTex.dispose(), [shadowTex]);

  useFrame(({ camera }) => {
    const { t, e, reducedMotion } = clock.current;
    const idleAmp = reducedMotion ? 0.3 : 1;
    const who = clock.current.speaker;
    // chi parla "vibra" un po' (anche senza voce), gli altri reagiscono
    const talkPulse = (id: CharacterId) => (who === id && !reducedMotion ? 1 + Math.abs(Math.sin(e * 9)) * 0.022 : 1);
    // sobbalzo di sorpresa quando Palmino annuncia le sorprese
    const surprise = !reducedMotion ? Math.max(0, Math.sin(prog(t, T.linePalmino + 0.35, T.linePalmino + 0.85) * Math.PI)) * 0.25 : 0;
    // countdown e finale: tutti a tempo
    const party = t >= T.countdown && !reducedMotion ? Math.abs(Math.sin((t - T.countdown) * Math.PI)) * 0.12 : 0;

    // ---------------------------------------------------------- IL PROFESSORE: arriva da sinistra in sella al suo podio
    const gp = prof.current;
    if (gp && profWalk) {
      // a piedi: posizione/quota dal percorso, poi si gira verso il pubblico
      placeWalker(gp, "professore", t, reducedMotion, camera.position.x, camera.position.z);
      profRim.current = 0;
    } else if (gp) {
      const a = LAYOUT.profAnchor;
      const ride = podiumRide(-1, t, reducedMotion);
      gp.visible = t >= WALK.profFrom - 0.05;
      gp.position.set(a.x + ride.dx, a.y + Math.sin(e * 1.7) * 0.045 * idleAmp + surprise + party, a.z);
      gp.scale.setScalar(talkPulse("professore"));
      faceCamera(gp, camera.position.x, camera.position.z, 0.55);
      gp.rotation.z = ride.tilt + Math.sin(e * 1.15) * 0.012 * idleAmp;
      profRim.current = smooth(prog(t, WALK.profFrom + 0.3, WALK.profTo)) * (who && who !== "professore" ? 0.5 : 1);
    }

    // ---------------------------------------------------------- LA REGINA: arriva da destra in sella al suo podio
    const gr = reg.current;
    if (gr && regWalk) {
      placeWalker(gr, "regina", t, reducedMotion, camera.position.x, camera.position.z);
      regRim.current = 0;
    } else if (gr) {
      const a = LAYOUT.reginaAnchor;
      const ride = podiumRide(1, t, reducedMotion);
      gr.visible = t >= WALK.reginaFrom - 0.05;
      gr.position.set(a.x + ride.dx, a.y + Math.sin(e * 1.5 + 1.3) * 0.045 * idleAmp + surprise + party * 0.8, a.z);
      gr.scale.setScalar(talkPulse("regina"));
      faceCamera(gr, camera.position.x, camera.position.z, 0.55);
      gr.rotation.z = ride.tilt + Math.sin(e * 1.05 + 0.7) * 0.012 * idleAmp;
      regRim.current = smooth(prog(t, WALK.reginaFrom + 0.3, WALK.reginaTo)) * (who && who !== "regina" ? 0.5 : 1);
    }

    // ---------------------------------------------------------- PALMINO: piomba dall'alto girando e rimbalza al centro
    const gm = palm.current;
    if (gm) {
      const hero = LAYOUT.palminoHero;
      const t0 = T.palminoDrop;
      gm.visible = t >= t0;
      const fall = prog(t, t0, t0 + 0.8);
      let y = hero.y;
      let s = 1;
      let rotZ = 0;
      let squash = 0;
      if (reducedMotion) {
        s = lerp(0.6, 1, easeOutBack(prog(t, t0, t0 + 0.6)));
      } else {
        // cade dall'americana (y≈11.5) e rimbalza
        y = hero.y + (1 - easeOutBounce(fall)) * 11;
        rotZ = (1 - easeOutCubic(prog(t, t0, t0 + 0.6))) * Math.PI * 4;
        // all'atterraggio si schiaccia (squash) e si allunga rimbalzando (stretch)
        const pop = prog(t, t0 + 0.28, t0 + 0.75);
        squash = Math.sin(pop * Math.PI * 2) * Math.exp(-pop * 1.5) * 0.2;
      }
      // saltella a ritmo (di più quando parla lui)
      const hopAmp = who === "palmino" ? 0.32 : 0.16;
      if (t > t0 + 0.8) y += Math.abs(Math.sin((t - t0 - 0.8) * Math.PI * 2 * 0.57)) * hopAmp * idleAmp + party;
      rotZ += Math.sin(e * 2.4) * 0.04 * idleAmp;
      gm.position.set(hero.x, y, hero.z);
      const sp = s * talkPulse("palmino");
      gm.scale.set(sp * (1 + squash * 0.5), sp * (1 - squash), sp * (1 + squash * 0.5));
      gm.rotation.z = rotZ;
      faceCamera(gm, camera.position.x, camera.position.z, 0.5);
      palmRim.current = smooth(prog(t, t0 + 0.3, t0 + 1.0)) * (who && who !== "palmino" ? 0.55 : 1.1);

      const sh = shadow.current;
      if (sh) {
        sh.visible = gm.visible;
        const h = clamp((y - hero.y) / 6);
        sh.scale.setScalar((1 - h * 0.7) * s);
      }
    }
  });

  return (
    <group>
      {mode === "3d" && <directionalLight position={[0, 5, 14]} intensity={0.5} color="#ffe2c8" />}
      {profWalk ? (
        <group ref={prof} visible={false}>
          <GlbBoundary who="professore" fallback={null} onFail={() => setProfOk(false)}>
            <Suspense fallback={null}>
              <HostWalker who="professore" lowPower={lowPower} />
            </Suspense>
          </GlbBoundary>
        </group>
      ) : (
        <CharacterSlot id="professore" height={LAYOUT.profHeight} lowPower={lowPower} groupRef={prof} rimRef={profRim} rimColorIndex="c" />
      )}
      {regWalk ? (
        <group ref={reg} visible={false}>
          <GlbBoundary who="regina" fallback={null} onFail={() => setRegOk(false)}>
            <Suspense fallback={null}>
              <HostWalker who="regina" lowPower={lowPower} />
            </Suspense>
          </GlbBoundary>
        </group>
      ) : (
        <CharacterSlot id="regina" height={LAYOUT.reginaHeight} lowPower={lowPower} groupRef={reg} rimRef={regRim} rimColorIndex="a" />
      )}
      <CharacterSlot id="palmino" height={LAYOUT.palminoHeroHeight} lowPower={lowPower} groupRef={palm} rimRef={palmRim} rimColorIndex="c" />
      {/* ombra di contatto di Palmino */}
      <group ref={shadow} position={[LAYOUT.palminoHero.x, LAYOUT.stageTop + 0.01, LAYOUT.palminoHero.z]} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[2.8, 1.4]} />
          <meshBasicMaterial map={shadowTex} color="#000000" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export function preloadCharacterTextures(urls: string[]) {
  for (const u of urls) useTexture.preload(u);
}
