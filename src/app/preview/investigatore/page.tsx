import type { Metadata } from "next";
import { ClientOnly } from "../tv-question/ClientOnly";
import { InvestigatorePreview } from "./InvestigatorePreview";

export const metadata: Metadata = {
  title: "Anteprima · Investigatore",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** /preview/investigatore?variant=a|b|ab&speak=1&talk=1&view=bust|face&face=jawOpen:1&line=benvenuti&low=1&slot=sm|md|tv&intro=1&layout=portrait|landscape&chars=2d&t=secondi */
export default async function InvestigatorePreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const v = one(sp.variant);
  const line = one(sp.line);
  const slot = one(sp.slot);
  const face = one(sp.face);
  return (
    <ClientOnly>
      <InvestigatorePreview
        variant={v === "a" || v === "b" || v === "ab" ? v : null}
        speak={one(sp.speak) === "1"}
        talk={one(sp.talk) === "1"}
        line={line ?? null}
        view={one(sp.view) === "face" ? "face" : "bust"}
        face={face ? Object.fromEntries(face.split(",").map((kv) => kv.split(":")).map(([k, n]) => [k, Number(n)])) : null}
        low={one(sp.low) === "1"}
        slot={slot === "sm" || slot === "md" || slot === "tv" ? slot : null}
        intro={one(sp.intro) === "1"}
        layout={one(sp.layout) === "portrait" ? "portrait" : "landscape"}
        mode3d={one(sp.chars) !== "2d"}
        t={one(sp.t) !== undefined && Number.isFinite(Number(one(sp.t))) ? Number(one(sp.t)) : null}
      />
    </ClientOnly>
  );
}
