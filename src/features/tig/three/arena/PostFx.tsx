"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BloomEffect, EffectComposer, EffectPass, FXAAEffect, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect, type Effect } from "postprocessing";
import { HalfFloatType, NoToneMapping } from "three";
import type { RenderProfile } from "./perf";

/**
 * RESA "BROADCAST" dell'arena (postprocessing di pmndrs): la scena si disegna in un buffer HDR a mezza precisione,
 * poi in UN solo passaggio di effetti: bagliore selettivo (bloom a mipmap: solo ciò che supera la soglia, cioè neon,
 * LED, ologrammi, fasci), tone mapping neutro (i colori delle squadre e del LED restano fedeli), vignettatura leggera
 * e antialiasing (MSAA nel buffer sui PC con scheda dedicata, SMAA/FXAA in post sugli altri).
 * Prende il posto del disegno automatico di R3F (useFrame con priorità 1).
 */
export function PostFx({ profile, exposure = 1 }: { profile: RenderProfile; exposure?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const built = useMemo(() => {
    const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: profile.msaa });
    composer.addPass(new RenderPass(scene, camera));
    const effects: Effect[] = [];
    let bloom: BloomEffect | null = null;
    if (profile.bloom > 0) {
      bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.92, luminanceSmoothing: 0.25, intensity: 1.0, radius: 0.7, levels: profile.level >= 3 ? 7 : 5, resolutionScale: profile.bloom });
      effects.push(bloom);
    }
    if (profile.vignette) effects.push(new VignetteEffect({ offset: 0.32, darkness: 0.52 }));
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }));
    const aa = profile.msaa > 0 ? null : profile.postAA === "smaa" ? new SMAAEffect({ preset: SMAAPreset.HIGH }) : profile.postAA === "fxaa" ? new FXAAEffect() : null;
    composer.addPass(new EffectPass(camera, ...effects));
    // l'antialiasing va DOPO il tone mapping (lavora sui bordi già in LDR)
    if (aa) composer.addPass(new EffectPass(camera, aa));
    return { composer, bloom };
  }, [gl, scene, camera, profile]);

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
    // il tone mapping lo fa l'ultimo passaggio (sull'immagine HDR intera): i materiali scrivono valori lineari
    state.gl.toneMapping = NoToneMapping;
    state.gl.toneMappingExposure = expRef.current;
    builtRef.current.composer.render(delta);
  }, 1);
  return null;
}
