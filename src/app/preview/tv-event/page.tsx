import type { Metadata } from "next";
import { TvSpecialEventScreen } from "@/features/display/TvScreens";
import { CharacterModeProvider } from "@/features/three/characters/character-mode";
import { ClientOnly } from "../tv-question/ClientOnly";

export const metadata: Metadata = {
  title: "Anteprima schermo TV · evento speciale",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/tv-event — lo schermo TV di un evento speciale (stesso componente della diretta),
 * per controllare Palmino 3D. ?chars=2d|3d come sul TV.
 */
export default async function TvEventPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return (
    <div className="fixed inset-0 grid place-items-center bg-black">
      <div className="w-full max-w-[177.78vh]">
        <ClientOnly>
          <CharacterModeProvider prefer3d={one(sp.chars) !== "2d"} lowPower={one(sp.low) === "1"}>
            <div className="relative aspect-video w-full overflow-hidden bg-night [container-type:size]">
            <TvSpecialEventScreen
              event={{
                id: "preview",
                type: "super_bonus",
                title: "SUPER BONUS",
                tagline: "+500 punti a chi risponde giusto!",
                params: { bonusPoints: 500 },
                source: "palmino_decides",
                animation: "celebrate",
                sound: "palmino",
                targetQuestionId: null,
              }}
            />
            </div>
          </CharacterModeProvider>
        </ClientOnly>
      </div>
    </div>
  );
}
