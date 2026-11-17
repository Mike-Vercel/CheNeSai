import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { VisualQuality } from "@/features/tig/arena-contract";
import { ClientOnly } from "../../tv-question/ClientOnly";
import { SchermatePreview } from "./SchermatePreview";

export const metadata: Metadata = {
  title: "Anteprima · TAVERNA DEI PIRATI schermate",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /preview/tig/schermate — banco di prova delle schermate dell'app con stati finti (nessun database):
 *   ?s=<schermata> &n=<tavoli 2–12> &cap=1 (sottotitoli) &q=2d|low|high &freeze=1 (orologio fermo) &audio=1 (avviso audio)
 * TV: lobby, lobby-live, intro, manche, regola, regola-puntata, caos, duello, evoluzione, classifica, classifica-buia,
 *     pausa, break, finale, premiazione, chiusa · telefono/PC: p-lobby, p-manche, p-regola, p-puntata, p-caos,
 *     p-caos-spettatore, p-duello, p-classifica, p-break, p-pausa, p-premiazione, p-chiusa · regia: r-bozza, r-lobby,
 *     r-gioco, r-pausa, r-premiazione · ingresso: j-crea, j-entra, j-pin, j-bloccato, j-codice · menu, menu-riprendi, wizard.
 * In produzione risponde 404 a meno che TIG_PREVIEW=1.
 */
export default async function TigSchermatePreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (process.env.NODE_ENV === "production" && process.env.TIG_PREVIEW !== "1") notFound();
  const sp = await searchParams;
  const n = Math.max(2, Math.min(12, Number(one(sp.n)) || 6));
  const q = one(sp.q);
  return (
    <ClientOnly>
      <SchermatePreview s={one(sp.s) ?? "lobby"} n={n} caption={one(sp.cap) === "1"} quality={(q === "low" || q === "high" ? q : "2d") as VisualQuality} freeze={one(sp.freeze) === "1"} audio={one(sp.audio) === "1"} />
    </ClientOnly>
  );
}
