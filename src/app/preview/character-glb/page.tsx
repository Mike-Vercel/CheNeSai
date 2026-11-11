import type { Metadata } from "next";
import { GlbPreview } from "@/features/three/characters/GlbPreview";
import type { CharacterAnimation } from "@/features/three/characters/types";

export const metadata: Metadata = {
  title: "Anteprima GLB · personaggi",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ANIMS: CharacterAnimation[] = ["idle", "intro", "talk", "wave", "celebrate", "surprised", "point"];

/** /preview/character-glb?who=professore|regina|palmino|trio&src=glb|proc&anim=…&view=front|34|full&mouth=0..1&walk=0..1&low=1&variant=0|1&speak=1 */
export default async function CharacterGlbPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const anim = one(sp.anim) as CharacterAnimation | undefined;
  const view = one(sp.view);
  const num = (v: string | undefined, d: number) => {
    const n = Number.parseFloat(v ?? "");
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d;
  };
  const w = one(sp.who);
  return (
    <GlbPreview
      who={w === "regina" || w === "palmino" || w === "trio" ? w : "professore"}
      src={one(sp.src) === "proc" ? "proc" : "glb"}
      animation={anim && ANIMS.includes(anim) ? anim : "idle"}
      view={view === "34" || view === "full" || view === "face" ? view : "front"}
      mouth={num(one(sp.mouth), 0)}
      walk={num(one(sp.walk), 0)}
      lowPower={one(sp.low) === "1"}
      variant={one(sp.variant) === "1" ? 1 : 0}
      speak={one(sp.speak) === "1"}
      cam={one(sp.cam)?.split(",").map(Number).filter(Number.isFinite) ?? null}
      face={one(sp.face) ? Object.fromEntries((one(sp.face) ?? "").split(",").map((kv) => kv.split(":")).map(([k, v]) => [k, Number(v)])) : null}
      speed={one(sp.speed) !== undefined ? Number(one(sp.speed)) : 1}
    />
  );
}
