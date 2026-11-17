"use client";

import { useId } from "react";
import type { MascotLevel, MascotProps } from "../../arena-contract";
import { mascotLabel } from "../../mascots/registry";
import { TIG } from "../palette";
import "../arena/arena-2d.css";

/**
 * Segnaposto 2D della mascotte (SVG), edizione pirati: lo stesso DOBLONE D'ORO del 3D — moneta con le perline sul
 * bordo, filo nel colore della ciurma, numero dello slot inciso, fascia «MASCOTTE IN ARRIVO» — con alone d'oro
 * (livello 2) e corona + ali dorate (livello 3). Dichiaratamente un segnaposto. Animazioni CSS spente con movimento
 * ridotto.
 */
export function Mascot2DGlyph({ slot, level, color, action = "idle", label = false }: { slot: number | null; level: MascotLevel; color: string; action?: MascotProps["action"]; label?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const num = slot ? String(slot).padStart(2, "0") : "··";
  const beads = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return { x: 100 + Math.cos(a) * 49, y: 94 + Math.sin(a) * 49 };
  });
  return (
    <svg className="tig-m2d" viewBox="0 0 200 200" data-action={action} role="img" aria-label={`${mascotLabel(slot)} (segnaposto), livello ${level}`}>
      <defs>
        <radialGradient id={`g${uid}`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff1c4" />
          <stop offset="0.55" stopColor="#e9b13f" />
          <stop offset="1" stopColor="#9b6716" />
        </radialGradient>
        <radialGradient id={`a${uid}`}>
          <stop offset="0" stopColor={TIG.goldLight} stopOpacity="0.6" />
          <stop offset="1" stopColor={TIG.gold} stopOpacity="0" />
        </radialGradient>
        <path id={`c${uid}`} d="M 100 100 m -80 0 a 80 80 0 1 1 160 0 a 80 80 0 1 1 -160 0" />
      </defs>
      {level >= 2 && <circle cx="100" cy="94" r={level >= 3 ? 96 : 82} fill={`url(#a${uid})`} />}
      {/* luce d'oro che sale dalla pila */}
      <ellipse cx="100" cy="178" rx="44" ry="9" fill={TIG.gold} opacity="0.3" />
      <polygon points="80,178 120,178 110,96 90,96" fill={TIG.goldLight} opacity="0.1" />
      {level >= 3 && (
        <g opacity="0.85" fill={TIG.gold}>
          <path d="M52 92 C 18 70, 12 40, 16 26 C 36 44, 50 62, 64 86 Z" opacity="0.6" />
          <path d="M148 92 C 182 70, 188 40, 184 26 C 164 44, 150 62, 136 86 Z" opacity="0.6" />
        </g>
      )}
      <g className="tig-m2d-float">
        {/* doblone */}
        <circle cx="100" cy="94" r="62" fill={color} opacity="0.95" />
        <circle cx="100" cy="94" r="57" fill={`url(#g${uid})`} stroke="#7a4f10" strokeWidth="4" />
        {beads.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r="2.6" fill="#ffe08a" />
        ))}
        <circle cx="100" cy="94" r="41" fill="none" stroke="#8a5a12" strokeWidth="3" opacity="0.8" />
        <text x="100" y="109" textAnchor="middle" fontSize="40" fontWeight="900" fill="#3a2408" fontFamily="var(--font-tig-num), 'Roboto Slab', Rockwell, Georgia, serif">
          {num}
        </text>
        {level >= 3 && <path d="M76 26 L84 12 L92 24 L100 8 L108 24 L116 12 L124 26 Z" fill={TIG.gold} stroke="#4a2c06" strokeOpacity="0.6" />}
      </g>
      <g className="tig-m2d-spin" opacity={label ? 0.95 : 0.75}>
        <text fontSize="12.5" fontWeight="800" letterSpacing="2" fill={TIG.goldLight} fontFamily="var(--font-tig-num), 'Roboto Slab', Rockwell, Georgia, serif">
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
