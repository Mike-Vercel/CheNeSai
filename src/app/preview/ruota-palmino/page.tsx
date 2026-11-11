import type { Metadata } from "next";
import { CharacterModeProvider } from "@/features/three/characters/character-mode";
import { ClientOnly } from "../tv-question/ClientOnly";
import { PalminoWheelPreview } from "./PalminoWheelPreview";

export const metadata: Metadata = {
  title: "Anteprima · Ruota di Palmino",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/ruota-palmino — la Ruota di Palmino (stesso componente della diretta) con un giro di
 * prova che parte da solo: Palmino arriva, la spinge, la ruota gira e si ferma.
 * ?layout=landscape|portrait|phone (TV, show verticale, telefono del giocatore), ?n=3..8 spicchi,
 * ?chars=2d|3d, ?low=1 PC lento, ?reduced=1 movimento ridotto, ?audio=1 suoni e voce (dopo un clic),
 * ?w=indice dello spicchio vincente, ?at=ms fotogramma fisso (dalla partenza del giro).
 */
export default async function PalminoWheelPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const n = Math.min(8, Math.max(3, Number(one(sp.n) ?? 8) || 8));
  const w = one(sp.w);
  const at = one(sp.at);
  const layout = one(sp.layout) === "portrait" ? "portrait" : one(sp.layout) === "phone" ? "phone" : "landscape";
  return (
    <div className={layout === "landscape" ? "fixed inset-0 grid place-items-center bg-black" : "min-h-[100dvh] bg-black"}>
      <div className={layout === "landscape" ? "w-full max-w-[177.78vh]" : "w-full"}>
        <ClientOnly>
          <CharacterModeProvider prefer3d={one(sp.chars) !== "2d"} lowPower={one(sp.low) === "1"}>
            <PalminoWheelPreview
              segments={n}
              winner={w === undefined ? null : Number(w)}
              lowPower={one(sp.low) === "1"}
              reducedMotion={one(sp.reduced) === "1"}
              audio={one(sp.audio) === "1"}
              layout={layout}
              at={at === undefined ? null : Number(at)}
            />
          </CharacterModeProvider>
        </ClientOnly>
      </div>
    </div>
  );
}
