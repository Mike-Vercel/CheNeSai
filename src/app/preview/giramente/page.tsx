import type { Metadata } from "next";
import { ClientOnly } from "../tv-question/ClientOnly";
import { GiramentePreview, type PreviewSection } from "./GiramentePreview";

export const metadata: Metadata = {
  title: "Anteprima · GIRAMENTE! 3D",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SECTIONS: PreviewSection[] = ["ruota", "personaggi", "portale", "tabellone"];

/**
 * /preview/giramente — ruota, personaggi (confronto bocca A/B), portale della Jolly, Tabellone Segreto.
 *   ?q=high|low|2d (qualità; senza = rilevata)  &solo=ruota|personaggi|portale|tabellone
 *   ruota:      &target=0..7 &freeze=ms (ferma il giro a quell'istante) &center=brain|logo &finale=1 &hi=1 &stand=0
 *   personaggi: &who=dontralla|zafira &variant=a|b|ab &action=<azione> &talk=1 &framing=full|bust &mouth=0..1 (bocca ferma)
 *   portale:    &portal=1 (parte subito)    tabellone: &reveal=n (lettere già svelate) &solved=1
 */
export default async function GiramentePreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = one(sp.q);
  const solo = one(sp.solo);
  const num = (k: string) => {
    const v = one(sp[k]);
    return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  const variant = one(sp.variant);
  const who = one(sp.who);
  return (
    <ClientOnly>
      <GiramentePreview
        quality={q === "high" || q === "low" || q === "2d" ? q : null}
        solo={SECTIONS.includes(solo as PreviewSection) ? (solo as PreviewSection) : null}
        target={num("target")}
        freeze={num("freeze")}
        center={one(sp.center) === "logo" ? "logo" : "brain"}
        finale={one(sp.finale) === "1"}
        hi={one(sp.hi) === "1"}
        stand={one(sp.stand) !== "0"}
        who={who === "dontralla" || who === "zafira" ? who : null}
        variant={variant === "a" || variant === "b" || variant === "ab" ? variant : "ab"}
        action={one(sp.action) ?? null}
        talk={one(sp.talk) === "1"}
        mouth={num("mouth")}
        framing={one(sp.framing) === "full" ? "full" : "bust"}
        portal={one(sp.portal) === "1"}
        reveal={num("reveal")}
        solved={one(sp.solved) === "1"}
      />
    </ClientOnly>
  );
}
