import type { Metadata } from "next";
import { ReginaPreview } from "@/features/three/characters/regina/preview/ReginaPreview";

export const metadata: Metadata = {
  title: "Anteprima La Regina 3D",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/character-regina — anteprima del modello procedurale della Regina.
 * Parametri: ?anim=<idle|intro|talk|wave|celebrate|surprised|point>, ?cam=<ref|front|q34l|q34r|side|back|face>,
 * ?mouth=<0..1>, ?talk=1 (simula parlato), ?low=1, ?ui=0, ?t=<secondi di pausa dopo l'avvio>.
 */
export default async function ReginaPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const mouth = Number.parseFloat(one(sp.mouth) ?? "0");
  const pauseAt = Number.parseFloat(one(sp.t) ?? "");
  return (
    <ReginaPreview
      initialAnim={one(sp.anim)}
      initialCam={one(sp.cam)}
      initialMouth={Number.isFinite(mouth) ? mouth : 0}
      initialTalk={one(sp.talk) === "1"}
      initialLow={one(sp.low) === "1"}
      showUi={one(sp.ui) !== "0"}
      pauseAt={Number.isFinite(pauseAt) ? pauseAt : null}
    />
  );
}
