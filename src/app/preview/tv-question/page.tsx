import type { Metadata } from "next";
import { TvQuestionPreview } from "@/features/display/preview";
import type { Presenter } from "@/lib/game-engine/types";
import { CharacterModeProvider } from "@/features/three/characters/character-mode";
import { ClientOnly } from "./ClientOnly";

export const metadata: Metadata = {
  title: "Anteprima schermo TV · domanda",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/tv-question — lo schermo TV di una domanda (stesso componente della diretta),
 * per controllare i personaggi 3D. ?who=professore|regina|palmino&stage=question|options|reveal
 * (+ ?glb=0|1 e ?chars=2d|3d come sul TV).
 */
export default async function TvQuestionPreviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const who = one(sp.who);
  const presenter: Presenter =
    who === "regina" || who === "palmino" ? who : "professore";
  const st = one(sp.stage);
  const stage = st === "question" || st === "reveal" ? st : "options";
  return (
    <div className="fixed inset-0 grid place-items-center bg-black">
      <div className="w-full max-w-[177.78vh]">
        <ClientOnly>
          <CharacterModeProvider
            prefer3d={one(sp.chars) !== "2d"}
            lowPower={one(sp.low) === "1"}
          >
            <TvQuestionPreview
              question={{
                type: "single",
                text: "In che anno è stata fondata la città di Roma secondo la tradizione?",
                category: "Storia",
                difficulty: 2,
                presenter,
                options: [
                  { position: 0, text: "753 a.C.", isCorrect: true },
                  { position: 1, text: "509 a.C.", isCorrect: false },
                  { position: 2, text: "476 d.C.", isCorrect: false },
                  { position: 3, text: "1000 a.C.", isCorrect: false },
                ],
                durationSeconds: 20,
                roundTitle: "Round 1",
                stage,
              }}
            />
          </CharacterModeProvider>
        </ClientOnly>
      </div>
    </div>
  );
}
