"use client";

/**
 * OPZIONE B — personaggi 3D "veri" (GLB rigged) al posto dei ritagli 2.5D.
 *
 * Scaffold pronto ma INATTIVO: si attiva solo se per un personaggio è configurato
 * l'URL di un modello (variabili NEXT_PUBLIC_QZ_GLB_* oppure GLB_CHARACTER_MODELS).
 * Non si genera MAI un modello 3D dalle immagini 2D: senza GLB ufficiale restano i ritagli.
 *
 * Requisiti del file .glb (consegna dell'animatore/modellatore):
 *  - glTF 2.0 binario, Y in alto, unità = metri, personaggio rivolto verso +Z,
 *    piedi (o taglio a mezzo busto per i presentatori) all'origine.
 *  - Scheletro skinnato (max 4 influenze/vertice), ≤ 40k triangoli, texture ≤ 2048 px (meglio KTX2/WebP),
 *    materiali PBR (MeshStandard) o unlit per lo stile cartoon.
 *  - Clip d'animazione con questi NOMI (o mappati con `clipMap`):
 *      IDLE       loop, respiro/oscillazione (obbligatoria, usata come fallback)
 *      INTRO      ingresso in scena (one-shot, ~1 s)
 *      TALK       parla al microfono (loop)
 *      WAVE       saluta il pubblico (one-shot o loop)
 *      CELEBRATE  esulta (logo / finale)
 *      SURPRISED  reazione di sorpresa (quando irrompe Palmino)
 *  - Se compresso con Draco/Meshopt, drei useGLTF lo gestisce (decoder Draco da CDN gstatic per default:
 *    per uso offline servire il decoder in /public e passarne il percorso a useGLTF).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { LoopOnce, LoopRepeat, type AnimationAction, type Group } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CharacterId } from "../assets";
import { T, speakerAt, type Speaker } from "../timeline";
import { useIntroClock } from "../scene/clock";

export type CharacterClip = "IDLE" | "WAVE" | "TALK" | "CELEBRATE" | "SURPRISED" | "INTRO";
export const CHARACTER_CLIPS: readonly CharacterClip[] = ["IDLE", "WAVE", "TALK", "CELEBRATE", "SURPRISED", "INTRO"];
const ONE_SHOT: ReadonlySet<CharacterClip> = new Set(["INTRO", "SURPRISED"]);

export interface GlbCharacterConfig {
  url: string;
  /** Scala uniforme per portare il modello all'altezza del ritaglio corrispondente. */
  scale?: number;
  rotationY?: number;
  offsetY?: number;
  /** Nome reale della clip nel file, se diverso dallo standard. */
  clipMap?: Partial<Record<CharacterClip, string>>;
}

/** Modelli configurati staticamente (vuoto = si usano i ritagli 2.5D). */
export const GLB_CHARACTER_MODELS: Partial<Record<CharacterId, GlbCharacterConfig>> = {};

const ENV_URLS: Record<CharacterId, string | undefined> = {
  professore: process.env.NEXT_PUBLIC_QZ_GLB_PROFESSORE,
  regina: process.env.NEXT_PUBLIC_QZ_GLB_REGINA,
  palmino: process.env.NEXT_PUBLIC_QZ_GLB_PALMINO,
};

const HOST_GLB_IDS: readonly CharacterId[] = ["professore", "regina", "palmino"];

/** Config del modello per un personaggio, o null se non configurato. */
export function getGlbConfig(id: CharacterId): GlbCharacterConfig | null {
  // i tre personaggi hanno i loro GLB dedicati (glb-host.tsx), integrati nel registro dei modelli
  if (HOST_GLB_IDS.includes(id)) return null;
  const fromMap = GLB_CHARACTER_MODELS[id];
  if (fromMap?.url) return fromMap;
  const url = ENV_URLS[id];
  return url ? { url } : null;
}

/** Da chiamare insieme a preloadIntroAssets() quando ci sono modelli configurati. */
export function preloadGlbCharacters(): void {
  for (const id of ["professore", "regina", "palmino"] as const) {
    const cfg = getGlbConfig(id);
    if (cfg) useGLTF.preload(cfg.url);
  }
}

/** Clip da usare per un personaggio al tempo t della timeline (stesso copione dei modelli procedurali). */
export function clipForTimeline(id: CharacterId, t: number, who: Speaker | null = speakerAt(t)): CharacterClip {
  if (t >= T.entrance && t < T.pushIn) return "INTRO";
  if (who === id) return "TALK";
  if (t >= T.welcome && t < T.lineProf) return "WAVE";
  if (id !== "palmino" && who === "palmino" && t < T.linePalmino + 1.2) return "SURPRISED";
  if (t >= T.end) return "CELEBRATE";
  return "IDLE";
}

export interface GlbCharacterProps {
  id: CharacterId;
  config: GlbCharacterConfig;
  /** Forza una clip (altrimenti segue la timeline dell'intro). */
  clip?: CharacterClip;
  fadeSeconds?: number;
}

/**
 * Modello rigged con animazioni a dissolvenza incrociata. Va montato DENTRO il gruppo
 * che i `Characters` già animano (posizione/ingresso/parallasse), al posto del ritaglio.
 * Richiede <Suspense> (useGLTF sospende durante il caricamento).
 */
export function GlbCharacter({ id, config, clip, fadeSeconds = 0.35 }: GlbCharacterProps) {
  const clock = useIntroClock();
  const { scene, animations } = useGLTF(config.url);
  // clone con scheletro: ogni istanza ha le proprie ossa
  const model = useMemo(() => cloneSkinned(scene), [scene]);
  const root = useRef<Group>(null);
  const { actions } = useAnimations(animations, root);
  const [timelineClip, setTimelineClip] = useState<CharacterClip>("IDLE");
  const current = clip ?? timelineClip;

  // aggiorna la clip solo quando cambia (niente re-render per frame)
  useFrame(() => {
    if (clip) return;
    const next = clipForTimeline(id, clock.current.t, clock.current.speaker);
    if (next !== timelineClip) setTimelineClip(next);
  });

  useEffect(() => {
    const resolve = (c: CharacterClip): AnimationAction | null => actions[config.clipMap?.[c] ?? c] ?? null;
    const action = resolve(current) ?? resolve("IDLE");
    if (!action) return;
    const oneShot = ONE_SHOT.has(current);
    action.setLoop(oneShot ? LoopOnce : LoopRepeat, oneShot ? 1 : Infinity);
    action.clampWhenFinished = oneShot;
    action.reset().fadeIn(fadeSeconds).play();
    return () => {
      action.fadeOut(fadeSeconds);
    };
  }, [actions, current, config.clipMap, fadeSeconds]);

  return (
    <group ref={root} scale={config.scale ?? 1} rotation-y={config.rotationY ?? 0} position-y={config.offsetY ?? 0}>
      <primitive object={model} />
    </group>
  );
}
