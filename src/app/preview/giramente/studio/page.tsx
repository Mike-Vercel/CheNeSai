import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import type { Phase, WheelKind } from "@/lib/giramente/types";
import { ClientOnly } from "../../tv-question/ClientOnly";
import { StudioPreview } from "./StudioPreview";
import "../../../giramente/giramente.css";

export const metadata: Metadata = {
  title: "Anteprima · Studio 3D di GIRAMENTE!",
  robots: { index: false, follow: false },
};

const display = Barlow_Condensed({ weight: ["700", "800", "900"], style: ["italic", "normal"], subsets: ["latin"], variable: "--font-gm-display", display: "swap" });
const body = Barlow({ weight: ["500", "600", "700", "800", "900"], subsets: ["latin"], variable: "--font-gm-body", display: "swap" });

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PHASES: Phase[] = ["LOBBY", "INTRO", "ROUND_INTRO", "TURN_READY", "CHOICE", "SPIN", "SPINNING", "WHEEL_RESULT", "QUESTION", "TURN_RESULT", "PLAY", "REVEAL", "ROUND_RESULTS", "FINAL"];
const SECTORS: WheelKind[] = ["intruso", "sequenza", "indizi", "prospettiva", "mistero", "jolly", "bonus", "colpo"];

/** /preview/giramente/studio — lo studio 3D con stati finti, fase per fase (vedi StudioPreview per i parametri). */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const phase = (one(sp.phase) ?? "LOBBY").toUpperCase() as Phase;
  const device = one(sp.device);
  const sector = one(sp.sector) as WheelKind | undefined;
  const round = Number(one(sp.round) ?? 1);
  return (
    <div className={`${display.variable} ${body.variable} gm-root min-h-dvh`}>
      <ClientOnly>
        <StudioPreview
          phase={PHASES.includes(phase) ? phase : "LOBBY"}
          device={device === "tv" || device === "tel" ? device : "pc"}
          sector={sector && SECTORS.includes(sector) ? sector : "indizi"}
          correct={one(sp.correct) !== "0"}
          round={Number.isFinite(round) && round >= 1 && round <= 5 ? round : 1}
          stage={one(sp.stage) ?? null}
          spinAt={Number(one(sp.spinAt) ?? 1800) || 1800}
          say={one(sp.say) ?? null}
        />
      </ClientOnly>
    </div>
  );
}
