import type { Metadata } from "next";
import { Pirata_One, Roboto_Slab } from "next/font/google";
import { ClientOnly } from "../../tv-question/ClientOnly";
import { ArenaPreview } from "./ArenaPreview";

export const metadata: Metadata = {
  title: "Anteprima · Arena 3D di TAVERNA DEI PIRATI",
  robots: { index: false, follow: false },
};

// edizione pirati: titoli piratechi (OFL), numeri ed etichette con uno slab robusto e leggibilissimo (OFL).
// Nel gioco i caratteri li sceglie la grafica 2D con le stesse variabili CSS: l'arena le legge e basta.
const display = Pirata_One({ weight: "400", subsets: ["latin"], variable: "--font-tig-display", display: "swap" });
const numbers = Roboto_Slab({ weight: ["700", "800", "900"], subsets: ["latin"], variable: "--font-tig-num", display: "swap" });

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/tig/arena — arena 3D con dati finti (noindex). Parametri per prove e screenshot:
 *   ?view=arena|mascotte|galleria   ?phase=<ArenaPhase>   ?teams=2..24   ?q=high|low|2d   ?hud=none|tel|tv|pc
 *   ?hosts=professore,regina   ?speak=1 (parla il primo)   ?spot=duel|chaos|evolve|winner|attack|sabotage|shield
 *   ?auto=1 (punti che cambiano da soli)   ?ui=0 (senza pannello)   ?seed=n   ?glb=/models/…glb (prova del percorso GLB delle mascotte)
 *   ?lvl=0..4 (gradino di resa fisso)   ?dpr=…   ?dbg=… (interruttori di misura, vedi arena/debug.ts)
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const s = one(v);
    if (s !== undefined) params[k] = s;
  }
  return (
    <div className={`${display.variable} ${numbers.variable} min-h-dvh bg-[#07131a] text-[#f6ead2]`} data-tig-font="" style={{ fontFamily: "var(--font-tig-num), Georgia, serif" }}>
      <ClientOnly>
        <ArenaPreview params={params} />
      </ClientOnly>
    </div>
  );
}
