"use client";

import { useId } from "react";
import type { MascotLevel, MascotProps } from "../../arena-contract";
import { mascotLabel } from "../../mascots/registry";
import { TIG } from "../palette";
import "../arena/arena-2d.css";

/**
 * Segnaposto 2D della mascotte (SVG): stesso totem olografico del 3D — proiettore, gemma col numero dello slot,
 * fascia «MASCOTTE IN ARRIVO» — con aura (livello 2) e corona + ali (livello 3). Animazioni CSS spente con
 * movimento ridotto.
 */
export function Mascot2DGlyph({ slot, level, color, action = "idle", label = false }: { slot: number | null; level: MascotLevel; color: string; action?: MascotProps["action"]; label?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const num = slot ? String(slot).padStart(2, "0") : "··";
  return (
    <svg className="tig-m2d" viewBox="0 0 200 200" data-action={action} role="img" aria-label={`${mascotLabel(slot)} (segnaposto), livello ${level}`}>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.35" stopColor={color} stopOpacity="0.85" />
          <stop offset="1" stopColor={color} stopOpacity="0.25" />
        </linearGradient>
        <radialGradient id={`a${uid}`}>
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <path id={`c${uid}`} d="M 100 100 m -78 0 a 78 78 0 1 1 156 0 a 78 78 0 1 1 -156 0" />
      </defs>
      {level >= 2 && <circle cx="100" cy="96" r={level >= 3 ? 96 : 80} fill={`url(#a${uid})`} />}
      <ellipse cx="100" cy="178" rx="46" ry="10" fill={color} opacity="0.35" />
      <polygon points="76,178 124,178 112,60 88,60" fill={color} opacity="0.12" />
      {level >= 3 && (
        <g opacity="0.85" fill={TIG.gold}>
          <path d="M58 92 C 22 70, 14 40, 18 26 C 38 44, 54 62, 70 86 Z" opacity="0.55" />
          <path d="M142 92 C 178 70, 186 40, 182 26 C 162 44, 146 62, 130 86 Z" opacity="0.55" />
        </g>
      )}
      <g className="tig-m2d-float">
        <polygon points="100,22 136,92 100,166 64,92" fill={`url(#g${uid})`} stroke={color} strokeWidth="3" />
        <polygon points="100,22 112,92 100,166 88,92" fill="#ffffff" opacity="0.18" />
        <text x="100" y="106" textAnchor="middle" fontSize="38" fontWeight="900" fill="#ffffff" stroke="#000" strokeWidth="4" paintOrder="stroke" fontFamily="var(--font-tig-display), 'Arial Narrow', Impact, sans-serif">
          {num}
        </text>
        {level >= 3 && <path d="M76 16 L84 4 L92 14 L100 0 L108 14 L116 4 L124 16 Z" fill={TIG.gold} stroke="#000" strokeOpacity="0.4" />}
      </g>
      <g className="tig-m2d-spin" opacity={label ? 0.95 : 0.7}>
        <text fontSize="13" fontWeight="800" letterSpacing="2" fill={color} fontFamily="var(--font-tig-display), 'Arial Narrow', Impact, sans-serif">
          <textPath href={`#c${uid}`}>MASCOTTE IN ARRIVO · MASCOTTE IN ARRIVO · MASCOTTE IN ARRIVO ·</textPath>
        </text>
      </g>
    </svg>
  );
}

export default function Mascot2D({ slot, level, color, action, className }: MascotProps) {
  return (
    <div className={className} style={{ position: "relative" }}>
      <Mascot2DGlyph slot={slot} level={level} color={color} action={action} label />
    </div>
  );
}
