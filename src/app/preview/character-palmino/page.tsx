import type { Metadata } from "next";
import type { CharacterAnimation } from "@/features/three/characters/types";
import { PalminoPreview } from "@/features/three/characters/palmino/PalminoPreview";
import type { PreviewView } from "@/features/three/characters/palmino/PalminoPreviewCanvas";

export const metadata: Metadata = {
  title: "Anteprima Palmino",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ANIMS: readonly CharacterAnimation[] = ["idle", "intro", "talk", "wave", "celebrate", "surprised", "point"];
const VIEWS: readonly PreviewView[] = ["ref", "front", "34", "side", "sideR", "back", "close"];

/**
 * /preview/character-palmino — anteprima del modello 3D procedurale di Palmino.
 * Parametri: ?anim=<clip> ?view=ref|front|34|side|sideR|back|close ?mouth=0..1 ?talk=1 (simula parlato)
 * ?low=1 (low power) ?ui=0 (senza controlli) ?bg=white (sfondo bianco per il confronto col riferimento).
 */
export default async function PalminoPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const anim = one(sp.anim) as CharacterAnimation | undefined;
  const view = one(sp.view) as PreviewView | undefined;
  const mouth = Number.parseFloat(one(sp.mouth) ?? "0");
  return (
    <PalminoPreview
      initialAnimation={anim && ANIMS.includes(anim) ? anim : "idle"}
      initialView={view && VIEWS.includes(view) ? view : "front"}
      initialMouth={Number.isFinite(mouth) ? Math.min(1, Math.max(0, mouth)) : 0}
      initialSpeech={one(sp.talk) === "1"}
      lowPower={one(sp.low) === "1"}
      showUi={one(sp.ui) !== "0"}
      background={one(sp.bg) === "white" ? "#ffffff" : undefined}
    />
  );
}
