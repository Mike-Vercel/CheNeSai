import type { Metadata } from "next";
import { CharacterModeProvider } from "@/features/three/characters/character-mode";
import { ClientOnly } from "../tv-question/ClientOnly";
import { WheelPreview } from "./WheelPreview";

export const metadata: Metadata = {
  title: "Anteprima schermo TV · Ruota impazzita",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/tv-wheel — la Ruota impazzita del TV (stesso componente della diretta) con un giro
 * di prova. ?n=2..8 spicchi, ?chars=2d|3d, ?low=1 PC lento, ?reduced=1 movimento ridotto,
 * ?audio=1 suoni e voce (dopo un clic), ?w=indice spicchio vincente.
 */
export default async function TvWheelPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const n = Math.min(8, Math.max(2, Number(one(sp.n) ?? 6) || 6));
  const w = one(sp.w);
  return (
    <div className="fixed inset-0 grid place-items-center bg-black">
      <div className="w-full max-w-[177.78vh]">
        <ClientOnly>
          <CharacterModeProvider prefer3d={one(sp.chars) !== "2d"} lowPower={one(sp.low) === "1"}>
            <WheelPreview
              segments={n}
              winner={w === undefined ? null : Number(w)}
              lowPower={one(sp.low) === "1"}
              reducedMotion={one(sp.reduced) === "1"}
              audio={one(sp.audio) === "1"}
            />
          </CharacterModeProvider>
        </ClientOnly>
      </div>
    </div>
  );
}
