import { GLYPHS, type GlyphKind } from "@/lib/tig/games/components/art";
import type { CifraArt } from "@/lib/tig/games/mechanics/cifra-improbabile";

/** Sagoma singola (legenda «contate solo queste»). */
export function GlyphIcon({ kind, className }: { kind: GlyphKind; className?: string }) {
  const d = `M${GLYPHS[kind].map(([x, y]) => `${x} ${y}`).join("L")}Z`;
  return (
    <svg viewBox="-0.5 -0.5 11 11" className={className} aria-hidden>
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/** La nuvola di sagome (un solo tracciato). */
export function ScatterArt({ art, label, className }: { art: CifraArt; label: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${art.width} ${art.height}`} className={className} role="img" aria-label={label}>
      <rect width={art.width} height={art.height} fill="var(--tg-night-2)" />
      <path d={art.d} fill="var(--tg-cream)" stroke="var(--tg-ink)" strokeWidth={2} />
    </svg>
  );
}
