import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATALOG } from "@/lib/tig/games";
import { MECHANIC_CONTENT } from "@/lib/tig/games/content";
import { ClientOnly } from "../../tv-question/ClientOnly";
import { GiochiPreview, type PreviewSurface } from "./GiochiPreview";

export const metadata: Metadata = {
  title: "Anteprima · TAVOLI IN GUERRA! minigiochi",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SURFACES: PreviewSurface[] = ["all", "phone", "pc", "tv"];

/**
 * /preview/tig/giochi — banco di prova dei minigiochi: meccanica, variante, tre tavoli finti, fase
 * (play/locked/reveal), telefono + PC + TV affiancati e `score()` vero.
 *   ?m=<codice> &v=<indice variante> &stage=play|locked|reveal &view=all|phone|pc|tv
 *   &t=<secondi trascorsi> &freeze=1 (orologio fermo, per gli screenshot) &cap=0 (non capitano) &sent=1 (già inviato)
 *
 * CONTIENE LE SOLUZIONI: in produzione risponde 404 a meno che TIG_PREVIEW=1. I contenuti viaggiano solo
 * nella risposta di questa pagina (props dal server), mai nei bundle JavaScript statici.
 */
export default async function TigGiochiPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (process.env.NODE_ENV === "production" && process.env.TIG_PREVIEW !== "1") notFound();
  const sp = await searchParams;
  const view = one(sp.view);
  const stage = one(sp.stage);
  const num = (k: string) => {
    const v = one(sp[k]);
    return v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  return (
    <ClientOnly>
      <GiochiPreview
        content={MECHANIC_CONTENT as Record<string, unknown[]>}
        catalog={CATALOG}
        initial={{
          code: one(sp.m) ?? null,
          variant: num("v") ?? 0,
          stage: stage === "locked" || stage === "reveal" ? stage : "play",
          surface: SURFACES.includes(view as PreviewSurface) ? (view as PreviewSurface) : "all",
          elapsedSec: num("t") ?? 0,
          freeze: one(sp.freeze) === "1",
          captain: one(sp.cap) !== "0",
          sent: one(sp.sent) === "1",
        }}
      />
    </ClientOnly>
  );
}
