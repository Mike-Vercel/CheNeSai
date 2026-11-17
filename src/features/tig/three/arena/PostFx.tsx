"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BloomEffect, EdgeDetectionMode, EffectComposer, EffectPass, FXAAEffect, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect, type Effect } from "postprocessing";
import { HalfFloatType, NoToneMapping, UnsignedByteType } from "three";
import type { RenderProfile } from "./perf";

/**
 * RESA "BROADCAST" dell'arena (postprocessing di pmndrs): la scena si disegna in un buffer HDR, poi in UN solo
 * passaggio a schermo intero: bagliore selettivo (bloom a mipmap: solo ciò che supera la soglia, cioè neon, spigoli,
 * ologrammi), tone mapping neutro (i colori delle squadre e del LED restano fedeli), vignettatura leggera e
 * antialiasing (MSAA nel buffer sulle schede dedicate, SMAA/FXAA nello stesso passaggio sulle altre).
 * Prende il posto del disegno automatico di R3F (useFrame con priorità 1).
 */

/** Interruttori di misura (debug.ts): buffer, antialiasing, bagliore. */
export interface PostOverrides {
  buffer?: "hdr" | "ldr";
  aa?: "smaa" | "fxaa" | "none";
  bloom?: boolean;
  msaa?: 0 | 2 | 4;
}

export function PostFx({ profile, exposure = 1, overrides }: { profile: RenderProfile; exposure?: number; overrides?: PostOverrides }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const buffer = overrides?.buffer ?? profile.buffer;
  const aaMode = overrides?.aa ?? (profile.msaa > 0 ? "none" : profile.postAA);
  const bloomOn = overrides?.bloom ?? profile.bloom > 0;
  const msaa = overrides?.msaa ?? profile.msaa;

  const built = useMemo(() => {
    // HDR (mezza precisione) dove la banda passante lo permette; altrimenti 8 bit sRGB: i neon si fermano a 1 ma la
    // soglia del bagliore è più bassa e i testi nitidi restano sotto (CRISP)
    const composer = new EffectComposer(gl, { frameBufferType: buffer === "hdr" ? HalfFloatType : UnsignedByteType, multisampling: msaa });
    composer.addPass(new RenderPass(scene, camera));
    const effects: Effect[] = [];
    if (bloomOn) {
      const ldr = buffer === "ldr";
      effects.push(
        new BloomEffect({
          mipmapBlur: true,
          // a 8 bit tutto si ferma a 1: soglia appena sopra i testi nitidi (CRISP), sfumatura stretta
          luminanceThreshold: ldr ? 0.84 : 0.92,
          luminanceSmoothing: ldr ? 0.06 : 0.25,
          intensity: ldr ? 1.15 : 1.0,
          radius: 0.7,
          levels: profile.level >= 4 ? 6 : profile.level >= 3 ? 5 : 4,
          resolutionScale: Math.max(0.25, profile.bloom),
        }),
      );
    }
    if (profile.vignette) effects.push(new VignetteEffect({ offset: 0.32, darkness: 0.52 }));
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }));
    // antialiasing nello STESSO passaggio (un solo giro a schermo intero: conta la banda passante delle integrate)
    if (aaMode === "smaa") effects.push(new SMAAEffect({ preset: SMAAPreset.LOW, edgeDetectionMode: EdgeDetectionMode.LUMA }));
    else if (aaMode === "fxaa") effects.push(new FXAAEffect());
    composer.addPass(new EffectPass(camera, ...effects));
    return { composer };
  }, [gl, scene, camera, profile, buffer, aaMode, bloomOn, msaa]);

  useEffect(() => {
    built.composer.setSize(size.width, size.height);
  }, [built, size, dpr]);
  useEffect(
    () => () => {
      built.composer.dispose();
    },
    [built],
  );
  const builtRef = useRef(built);
  useEffect(() => {
    builtRef.current = built;
  }, [built]);
  const expRef = useRef(exposure);
  useEffect(() => {
    expRef.current = exposure;
  }, [exposure]);

  useFrame((state, delta) => {
    // il tone mapping lo fa il passaggio finale (sull'immagine HDR intera): i materiali scrivono valori lineari
    state.gl.toneMapping = NoToneMapping;
    state.gl.toneMappingExposure = expRef.current;
    builtRef.current.composer.render(delta);
  }, 1);
  return null;
}

/** Disegno diretto senza postprocessing (solo per misurare quanto costa la scena da sola: `?dbg=nopost`). */
export function DirectRender() {
  useFrame((state) => {
    state.gl.render(state.scene, state.camera);
  }, 1);
  return null;
}
