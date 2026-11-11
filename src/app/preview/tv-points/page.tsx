import type { Metadata } from "next";
import { TvAnswerPointsScreen } from "@/features/display/TvScreens";
import type { LeaderboardEntry } from "@/lib/game-engine/types";
import { CharacterModeProvider } from "@/features/three/characters/character-mode";
import { ClientOnly } from "../tv-question/ClientOnly";

export const metadata: Metadata = {
  title: "Anteprima schermo TV · punti della risposta",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const NAMES = ["Vodka", "Mike scemissimo", "Ebrei Fumanti", "PELI FITUSI", "SimasukiSinamiku", "Porc. Dio", "Gigi", "Lalla", "Tano", "Rosy"];
const DELTAS = [1480, 1320, 1105, 0, -400, 1210, 0, -400, 1050, 0];

/** /preview/tv-points — punti di una risposta a metà round. ?who=professore|regina|palmino&chars=2d|3d */
export default async function TvPointsPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const w = one(sp.who);
  const who = w === "regina" || w === "palmino" ? w : "professore";
  const entries: LeaderboardEntry[] = NAMES.map((nickname, i) => ({
    participantId: `p${i}`,
    rank: i + 1,
    previousRank: null,
    nickname,
    points: 5000 - i * 300,
    lastDelta: DELTAS[i],
    correctCount: 2,
  }));
  return (
    <div className="fixed inset-0 grid place-items-center bg-black">
      <div className="w-full max-w-[177.78vh]">
        <ClientOnly>
          <CharacterModeProvider prefer3d={one(sp.chars) !== "2d"} lowPower={one(sp.low) === "1"}>
            <div className="relative aspect-video w-full overflow-hidden bg-night [container-type:size]">
              <TvAnswerPointsScreen entries={entries} who={who} questionId="preview-q" />
            </div>
          </CharacterModeProvider>
        </ClientOnly>
      </div>
    </div>
  );
}
