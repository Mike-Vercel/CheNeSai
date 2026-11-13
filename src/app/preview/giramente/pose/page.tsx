import type { Metadata } from "next";
import type { CharacterAction, CharacterWho } from "@/features/giramente/three/types";
import { ACTION_PLAN } from "@/features/giramente/three/characters";
import { ClientOnly } from "../../tv-question/ClientOnly";
import { PosePreview } from "./PosePreview";

export const metadata: Metadata = { title: "Anteprima · pose dei personaggi di GIRAMENTE!", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** /preview/giramente/pose?who=dontralla|zafira&variant=a|b&action=saluto&t=1.2&view=front|side|back&low=1 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const who: CharacterWho = one(sp.who) === "zafira" ? "zafira" : "dontralla";
  const a = one(sp.action) ?? "saluto";
  const action = (a in ACTION_PLAN ? a : "saluto") as CharacterAction;
  const view = one(sp.view);
  return (
    <ClientOnly>
      <PosePreview who={who} variant={one(sp.variant) === "b" ? "b" : "a"} action={action} t={Number(one(sp.t) ?? 1.2) || 1.2} view={view === "side" || view === "back" ? view : "front"} low={one(sp.low) === "1"} />
    </ClientOnly>
  );
}
