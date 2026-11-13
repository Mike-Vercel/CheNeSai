import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { GiramenteIntroPreview } from "@/features/giramente/intro/GiramenteIntro";
import { ClientOnly } from "../../tv-question/ClientOnly";
import "../../../giramente/giramente.css";

export const metadata: Metadata = {
  title: "Anteprima · Intro di GIRAMENTE!",
  robots: { index: false, follow: false },
};

const display = Barlow_Condensed({ weight: ["700", "800", "900"], style: ["italic", "normal"], subsets: ["latin"], variable: "--font-gm-display", display: "swap" });
const body = Barlow({ weight: ["500", "600", "700", "800", "900"], subsets: ["latin"], variable: "--font-gm-body", display: "swap" });

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/giramente/intro — l'intro di «Nuova partita» a tutto schermo, senza account né server; riparte da capo.
 *   ?mode=2d|still (forza la versione 2D o quella ferma)  &t=secondi (fotogramma fermo)  &q=high|low (qualità del 3D)
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const mode = one(sp.mode);
  const t = Number(one(sp.t));
  return (
    <div className={`${display.variable} ${body.variable} gm-root min-h-dvh`}>
      <ClientOnly>
        <GiramenteIntroPreview force={mode === "2d" || mode === "still" ? mode : null} freezeAt={one(sp.t) !== undefined && Number.isFinite(t) ? Math.max(0, t) : null} />
      </ClientOnly>
    </div>
  );
}
