import type { Metadata } from "next";
import { Big_Shoulders } from "next/font/google";
import { ClientOnly } from "../../tv-question/ClientOnly";
import { ArenaPreview } from "./ArenaPreview";

export const metadata: Metadata = {
  title: "Anteprima · Arena 3D di TAVOLI IN GUERRA!",
  robots: { index: false, follow: false },
};

const display = Big_Shoulders({ weight: ["600", "700", "800", "900"], subsets: ["latin"], variable: "--font-tig-display", display: "swap" });

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/tig/arena — arena 3D con dati finti (noindex). Parametri per prove e screenshot:
 *   ?view=arena|mascotte|galleria   ?phase=<ArenaPhase>   ?teams=2..20   ?q=high|low|2d   ?hud=none|tel|tv|pc
 *   ?hosts=professore,regina   ?speak=1 (parla il primo)   ?spot=duel|chaos|evolve|winner|attack|sabotage|shield
 *   ?auto=1 (punti che cambiano da soli)   ?ui=0 (senza pannello)   ?seed=n   ?glb=/models/…glb (prova del percorso GLB delle mascotte)
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const s = one(v);
    if (s !== undefined) params[k] = s;
  }
  return (
    <div className={`${display.variable} min-h-dvh bg-[#020306] text-[#f3f6fa]`} data-tig-font="" style={{ fontFamily: "var(--font-tig-display), 'Arial Narrow', sans-serif" }}>
      <ClientOnly>
        <ArenaPreview params={params} />
      </ClientOnly>
    </div>
  );
}
