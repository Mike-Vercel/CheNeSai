"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { Captions } from "@/features/psyco/audio";
import { getNarrator, VOICE_IDS, type VoiceId } from "@/features/psyco/narrator";
import { PsycoNarratorSlot } from "@/features/psyco/NarratorSlot";
import { deviceCaps } from "@/features/psyco/investigatore/device";
import { INVESTIGATORE_FILES, INVESTIGATORE_VARIANT, type InvestigatoreVariant } from "@/features/three/characters/investigatore";

const Stage = dynamic(() => import("@/features/psyco/investigatore/InvestigatoreStage"), { ssr: false });
const IntroPreview = dynamic(() => import("@/features/psyco/intro/PsycoIntro").then((m) => m.PsycoIntroPreview), { ssr: false });

export interface InvestigatorePreviewProps {
  variant: InvestigatoreVariant | "ab" | null;
  speak: boolean;
  talk: boolean;
  /** id di un clip (VOICE_LINES); se non valido si alternano tre frasi */
  line: string | null;
  view: "bust" | "face";
  face: Record<string, number> | null;
  low: boolean;
  slot: "sm" | "md" | "tv" | null;
  intro: boolean;
  layout: "portrait" | "landscape";
  mode3d: boolean;
  /** intro ferma a questo istante (secondi), per i fotogrammi */
  t: number | null;
}

/** Voce vera del narratore in loop (stessa clip per le due varianti): serve un tocco per sbloccare l'audio. */
function useSpeakLoop(on: boolean, line: VoiceId | null) {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => getSoundEngine().subscribe((s) => setUnlocked(s.unlocked)), []);
  useEffect(() => {
    if (!on) return;
    const n = getNarrator();
    n.preload(line ? [line] : ["benvenuti", "ruoli-assegnati", "ho-capito"]);
    const lines: VoiceId[] = line ? [line] : ["benvenuti", "ruoli-assegnati", "ho-capito"];
    let i = 0;
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = n.onState((s) => {
      if (s.speaking || t) return;
      t = setTimeout(() => {
        t = null;
        n.say([lines[i++ % lines.length]]);
      }, 900);
    });
    return () => {
      off();
      if (t) clearTimeout(t);
      n.stop();
    };
  }, [on, line]);
  return { unlocked, unlock: () => void getSoundEngine().unlock() };
}

/**
 * /preview/investigatore — confronto delle due varianti dell'Investigatore e anteprima dell'intro.
 *   ?variant=a|b|ab  &view=bust|face  &speak=1 (voce vera in loop)  &talk=1 (gesti senza voce)
 *   &face=jawOpen:1,mouthO:0.5 (forme fisse)  &line=<id clip>  &low=1  &slot=sm|md|tv (slot reale)
 *   &intro=1&layout=portrait|landscape (intro 3D, sempre da capo; &chars=2d per la versione illustrata)
 */
export function InvestigatorePreview(p: InvestigatorePreviewProps) {
  const line = p.line && (VOICE_IDS as string[]).includes(p.line) ? (p.line as VoiceId) : null;
  const { unlocked, unlock } = useSpeakLoop(p.speak && !p.intro, line);
  const low = p.low || deviceCaps().lowPower;
  if (p.intro) return <IntroPreview layout={p.layout} mode3d={p.mode3d} freezeAt={p.t} />;
  if (p.slot) {
    return (
      <main className="grid min-h-dvh place-items-center gap-6 p-6">
        <PsycoNarratorSlot size={p.slot} />
        <Captions position="bottom" />
        {p.speak && !unlocked && (
          <button type="button" className="psy-btn" onClick={unlock}>
            ▶ VOCE
          </button>
        )}
      </main>
    );
  }
  const variants: InvestigatoreVariant[] = p.variant === "ab" ? ["a", "b"] : [p.variant ?? INVESTIGATORE_VARIANT];
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4" onPointerDown={unlock}>
      <div className="flex w-full flex-wrap items-stretch justify-center gap-4">
        {variants.map((v) => (
          <figure key={v} className="flex flex-col items-center gap-2">
            <div className="psy-portrait relative h-[min(78vh,640px)] w-[min(44vw,520px)] overflow-hidden rounded-3xl">
              <Stage lowPower={low} framing={p.view} src={INVESTIGATORE_FILES[v]} speakingOverride={p.talk || undefined} faceOverride={p.face ?? undefined} className="!absolute inset-0" />
            </div>
            <figcaption className="psy-type text-lg text-paper">
              Variante {v.toUpperCase()} · {v === "a" ? "INVESTIGATORE_PARLANTE (bocca dell'utente)" : "INVESTIGATORE + bocca dello script"}
            </figcaption>
          </figure>
        ))}
      </div>
      {p.speak && !unlocked && (
        <button type="button" className="psy-btn" onClick={unlock}>
          ▶ ATTIVA LA VOCE
        </button>
      )}
      <Captions position="bottom" />
    </main>
  );
}
