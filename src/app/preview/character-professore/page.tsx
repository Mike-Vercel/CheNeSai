import type { Metadata } from "next";
import { ProfessorePreview } from "@/features/three/characters/professore/preview/ProfessorePreview";

export const metadata: Metadata = {
  title: "Anteprima personaggio · Il Professore",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/character-professore — modello 3D procedurale del Professore.
 * Parametri: ?anim=idle|intro|talk|wave|celebrate|surprised|point,
 * ?view=ref|front|left34|right34|side|back|face, ?mouth=0..1, ?talk=1, ?low=1, ?ui=0
 */
export default async function ProfessorePreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const mouth = Number.parseFloat(one(sp.mouth) ?? "0");
  return (
    <ProfessorePreview
      initialAnimation={one(sp.anim) as never}
      initialView={one(sp.view)}
      initialMouth={Number.isFinite(mouth) ? Math.min(1, Math.max(0, mouth)) : 0}
      talking={one(sp.talk) === "1"}
      lowPower={one(sp.low) === "1"}
      showUi={one(sp.ui) !== "0"}
    />
  );
}
