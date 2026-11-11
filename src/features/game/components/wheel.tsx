"use client";

import { clsx } from "clsx";
import { useId, type Ref } from "react";
import { segmentAngle } from "@/lib/game-engine/wheel";

/**
 * Grafica della Ruota impazzita (SVG), condivisa da TV e telefoni.
 * La rotazione NON è una prop: chi anima la ruota scrive il transform del rotore
 * via ref, a 60 fps, senza passare da React.
 */

/** Colori degli spicchi (8 tinte ben distinte, testo leggibile su ognuna). */
export const WHEEL_COLORS: readonly { bg: string; text: string }[] = [
  { bg: "#e8173e", text: "#ffffff" },
  { bg: "#ffb800", text: "#2a0f3d" },
  { bg: "#0a6fe6", text: "#ffffff" },
  { bg: "#00b85c", text: "#ffffff" },
  { bg: "#7a22f0", text: "#ffffff" },
  { bg: "#ff6a1a", text: "#ffffff" },
  { bg: "#00b8d9", text: "#13072a" },
  { bg: "#ff1f9d", text: "#ffffff" },
];

export function wheelColor(index: number) {
  return WHEEL_COLORS[index % WHEEL_COLORS.length];
}

/** Raggio degli spicchi (unità SVG; il bordo dorato arriva a 100). */
const R = 92;
const BULBS = 24;

/** Punto a distanza r con angolo a (gradi, senso orario dalle 12). */
function polar(r: number, a: number): [number, number] {
  const rad = (a * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)];
}

function slicePath(i: number, n: number): string {
  const s = segmentAngle(n);
  const [x0, y0] = polar(R, i * s);
  const [x1, y1] = polar(R, (i + 1) * s);
  return `M0 0 L${x0.toFixed(3)} ${y0.toFixed(3)} A${R} ${R} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`;
}

/** A capo per parole: al massimo `maxLines` righe, la più lunga il più corta possibile. */
export function wrapLabel(label: string, maxLines: number): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1 || maxLines <= 1) return [label.trim()];
  let best: string[] = [label.trim()];
  let bestLen = label.length;
  const total = label.length;
  for (let k = 2; k <= Math.min(maxLines, words.length); k++) {
    const target = Math.ceil(total / k);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if (cur && (cur + " " + w).length > target && lines.length < k - 1) {
        lines.push(cur);
        cur = w;
      } else cur = cur ? cur + " " + w : w;
    }
    lines.push(cur);
    const longest = Math.max(...lines.map((l) => l.length));
    if (longest < bestLen) {
      best = lines;
      bestLen = longest;
    }
  }
  return best;
}

/** Impaginazione dell'etichetta di uno spicchio: righe, corpo del testo e distanza dal centro. */
export function labelLayout(label: string, n: number): { lines: string[]; fontSize: number; radius: number } {
  const s = segmentAngle(n);
  const radius = n === 2 ? 50 : n <= 4 ? 58 : 62;
  const chord = Math.min(118, 2 * radius * Math.sin(((Math.min(s, 180) / 2) * Math.PI) / 180) * 0.86);
  const radial = n <= 4 ? 44 : 38;
  let best = { lines: [label], fontSize: 0 };
  for (let k = 1; k <= 3; k++) {
    const lines = wrapLabel(label, k);
    const longest = Math.max(...lines.map((l) => l.length), 1);
    const size = Math.min(n <= 3 ? 17 : 14.5, chord / (longest * 0.62), radial / (lines.length * 1.12));
    if (size > best.fontSize + 0.3) best = { lines, fontSize: size };
  }
  return { ...best, radius };
}

export interface WheelGraphicProps {
  labels: string[];
  /** Spicchio vincente evidenziato (null = nessuno). */
  winnerIndex?: number | null;
  rotorRef?: Ref<SVGGElement>;
  pointerRef?: Ref<SVGGElement>;
  /** Niente bagliori né lampadine animate (PC lenti, movimento ridotto). */
  calm?: boolean;
  showLabels?: boolean;
  className?: string;
}

export function WheelGraphic({ labels, winnerIndex = null, rotorRef, pointerRef, calm = false, showLabels = true, className }: WheelGraphicProps) {
  const uid = useId().replace(/:/g, "");
  const n = labels.length;
  const s = segmentAngle(n);
  const decided = winnerIndex !== null && winnerIndex >= 0 && winnerIndex < n;
  return (
    <svg viewBox="-112 -118 224 230" className={clsx("overflow-visible", className)} role="img" aria-label={`Ruota con ${n} categorie: ${labels.join(", ")}`}>
      <defs>
        <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3a6" />
          <stop offset="0.45" stopColor="#ffc21a" />
          <stop offset="1" stopColor="#a8650a" />
        </linearGradient>
        <radialGradient id={`hub-${uid}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.5" stopColor="#ffbf1f" />
          <stop offset="1" stopColor="#8a5206" />
        </radialGradient>
        <radialGradient id={`shade-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>
        {!calm && (
          <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* ombra e bordo dorato con lampadine (fermi) */}
      <circle r="106" fill="#000" opacity="0.35" transform="translate(0 5)" />
      <circle r="104" fill={`url(#rim-${uid})`} stroke="#6b3d00" strokeWidth="1.5" />
      <circle r="96.5" fill="#2a0f3d" />
      {Array.from({ length: BULBS }, (_, i) => {
        const [x, y] = polar(100.2, (i * 360) / BULBS);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2.3"
            fill="#fffbe0"
            stroke="#b8770a"
            strokeWidth="0.6"
            className={clsx(!calm && "animate-pulse")}
            style={!calm ? { animationDelay: `${(i % 2) * 0.5}s`, animationDuration: "1s" } : { opacity: i % 2 ? 0.75 : 1 }}
          />
        );
      })}

      {/* rotore: spicchi ed etichette */}
      <g ref={rotorRef}>
        {labels.map((label, i) => {
          const c = wheelColor(i);
          const isWinner = decided && i === winnerIndex;
          return (
            <path
              key={`p${i}`}
              d={slicePath(i, n)}
              fill={c.bg}
              stroke={isWinner ? "#ffffff" : "#2a0f3d"}
              strokeWidth={isWinner ? 2.6 : 1.4}
              strokeLinejoin="round"
              style={{ opacity: decided && !isWinner ? 0.42 : 1, transition: "opacity 600ms ease" }}
            />
          );
        })}
        <circle r={R} fill={`url(#shade-${uid})`} pointerEvents="none" />
        {decided && !calm && (
          <path d={slicePath(winnerIndex!, n)} fill="#ffffff" opacity="0.18" filter={`url(#glow-${uid})`} className="animate-pulse" pointerEvents="none" />
        )}
        {showLabels &&
          labels.map((label, i) => {
            const c = wheelColor(i);
            const { lines, fontSize, radius } = labelLayout(label, n);
            const mid = (i + 0.5) * s;
            const lh = fontSize * 1.08;
            return (
              <g key={`t${i}`} transform={`rotate(${mid.toFixed(3)})`} style={{ opacity: decided && i !== winnerIndex ? 0.5 : 1, transition: "opacity 600ms ease" }}>
                <text
                  className="font-display"
                  x="0"
                  y={-radius - ((lines.length - 1) * lh) / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  fill={c.text}
                  stroke={c.text === "#ffffff" ? "rgba(20,4,40,.6)" : "rgba(255,255,255,.35)"}
                  strokeWidth={fontSize * 0.09}
                  paintOrder="stroke"
                >
                  {lines.map((l, k) => (
                    <tspan key={k} x="0" dy={k === 0 ? 0 : lh}>
                      {l}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
      </g>

      {/* mozzo */}
      <circle r="17" fill={`url(#hub-${uid})`} stroke="#6b3d00" strokeWidth="1.2" />
      <circle r="10.5" fill="#2a0f3d" />
      <text className="font-display" textAnchor="middle" dominantBaseline="central" fontSize="13" fill="#ffd34d" y="0.5">
        ?!
      </text>

      {/* puntatore dorato fisso in alto (la linguetta "scatta" a ogni spicchio) */}
      <g ref={pointerRef}>
        <path d="M0 -82 L-11 -110 Q0 -116 11 -110 Z" fill={`url(#rim-${uid})`} stroke="#6b3d00" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="0" cy="-106" r="3.2" fill="#fff6c2" stroke="#6b3d00" strokeWidth="0.8" />
      </g>
    </svg>
  );
}
