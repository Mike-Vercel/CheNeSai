import type { Metadata } from "next";
import { ClientOnly } from "../tv-question/ClientOnly";
import { SpettacoloPreview, type PreviewScreen } from "./SpettacoloPreview";

export const metadata: Metadata = {
  title: "Anteprima spettacolo",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SCREENS: PreviewScreen[] = ["intro", "intro-round", "intro-last", "question", "options", "round-lb", "general-lb", "podium", "skip"];

/** /preview/spettacolo?screen=intro|intro-round|intro-last|question|options|round-lb|general-lb|podium|skip&layout=portrait&chars=2d&t=20 */
export default async function SpettacoloPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const s = one(sp.screen) as PreviewScreen | undefined;
  const screen = s && SCREENS.includes(s) ? s : "intro";
  return (
    <ClientOnly>
      <SpettacoloPreview screen={screen} portrait={one(sp.layout) === "portrait"} chars3d={one(sp.chars) !== "2d"} podiumAt={Number(one(sp.t) ?? 0) || 0} />
    </ClientOnly>
  );
}
