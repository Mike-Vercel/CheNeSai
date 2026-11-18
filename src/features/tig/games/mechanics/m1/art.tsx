"use client";

import "./m1.css";
import { clsx } from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { hexOf, type Art, type Shape } from "@/lib/tig/games/mechanics/m1/draw";
import { SceneIcon } from "../../kit/scene";

/**
 * Disegno di una tela della manche 1 (forme + icone del kit) in SVG. Le icone vivono in un riquadro 100×100:
 * qui si scalano al lato `s` e si centrano in (x, y); `flip` le specchia in orizzontale (mai con un testo:
 * lo schema lo vieta, un testo specchiato non si leggerebbe).
 */
export function ShapeSvg({ s }: { s: Shape }): ReactNode {
  switch (s.k) {
    case "rect":
      return (
        <rect
          x={s.x}
          y={s.y}
          width={s.w}
          height={s.h}
          rx={s.r ?? 0}
          fill={hexOf(s.c)}
          opacity={s.o}
          transform={s.rot ? `rotate(${s.rot} ${s.x + s.w / 2} ${s.y + s.h / 2})` : undefined}
        />
      );
    case "ell":
      return <ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={hexOf(s.c)} opacity={s.o} transform={s.rot ? `rotate(${s.rot} ${s.x} ${s.y})` : undefined} />;
    case "poly": {
      const pts: string[] = [];
      for (let i = 0; i + 1 < s.p.length; i += 2) pts.push(`${s.p[i]},${s.p[i + 1]}`);
      return <polygon points={pts.join(" ")} fill={hexOf(s.c)} opacity={s.o} />;
    }
    case "line":
      return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={hexOf(s.c)} strokeWidth={s.w} strokeLinecap="round" opacity={s.o} />;
    case "text":
      return (
        <text x={s.x} y={s.y} fontSize={s.size} fill={hexOf(s.c)} textAnchor={s.anchor ?? "middle"} dominantBaseline="central" opacity={s.o} style={{ fontFamily: "var(--tg-display)", fontWeight: 800 }}>
          {s.t}
        </text>
      );
    case "icon": {
      const k = s.s / 100;
      return (
        <g transform={`translate(${s.x} ${s.y}) rotate(${s.rot ?? 0}) scale(${s.flip ? -k : k} ${k}) translate(-50 -50)`}>
          <SceneIcon kind={s.kind} tone={s.tone ?? "white"} label={s.label} />
        </g>
      );
    }
  }
}

/**
 * Misure di un quadro con la cornice di legno (`.tg1-frame`) dentro un contenitore «a misura»
 * (`container-type: size`): il più grande che entra in larghezza E in altezza. `ratio` = larghezza/altezza del
 * quadro, `fw` = spessore della cornice in unità del contenitore (cqw). Il quadro interno resta esattamente `ratio`.
 */
export function framed(ratio: number, fw: number): CSSProperties {
  const f2 = `${2 * fw}cqw`;
  const w = `min(100cqw, calc((100cqh - ${f2}) * ${ratio} + ${f2}))`;
  return { width: w, height: `calc((${w} - ${f2}) / ${ratio} + ${f2})`, ["--tg1-fw" as string]: `${fw}cqw` } as CSSProperties;
}

export function ArtSvg({ art, label, className, children }: { art: Art; label: string; className?: string; children?: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${art.w} ${art.h}`} className={clsx("tg1-art", className)} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <rect width={art.w} height={art.h} fill={hexOf(art.bg)} />
      {art.shapes.map((s, i) => (
        <ShapeSvg key={i} s={s} />
      ))}
      {children}
    </svg>
  );
}
