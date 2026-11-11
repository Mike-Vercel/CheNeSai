import type { Metadata } from "next";
import { IntroPreview } from "@/features/three/IntroPreview";
import { CharacterModeProvider } from "@/features/three/characters/character-mode";

export const metadata: Metadata = {
  title: "Anteprima intro · CHE NE SAI?!",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const flag = (v: string | string[] | undefined) => {
  const s = one(v);
  return s === "1" || s === "true";
};

/**
 * /preview/intro — anteprima a tutto schermo dell'intro.
 * Parametri: ?t=<secondi> (parte da quel punto), ?freeze=1 (tempo fermo),
 * ?fallback=1 (intro 2D), ?reduced=1, ?low=1, ?muted=1, ?rules=0 (salta le regole), ?ui=0 (senza controlli),
 * ?chars=3d|2d (personaggi 3D procedurali o ritagli 2.5D; default 3D se il PC lo regge).
 */
export default async function IntroPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const t = Number.parseFloat(one(sp.t) ?? "0");
  return (
    <CharacterModeProvider prefer3d={one(sp.chars) !== "2d"} lowPower={flag(sp.low)}>
    <IntroPreview
      startAt={Number.isFinite(t) ? t : 0}
      freeze={flag(sp.freeze)}
      fallback={flag(sp.fallback)}
      reducedMotion={flag(sp.reduced)}
      lowPower={flag(sp.low)}
      muted={flag(sp.muted)}
      showUi={one(sp.ui) !== "0"}
      rules={one(sp.rules) !== "0"}
    />
    </CharacterModeProvider>
  );
}
