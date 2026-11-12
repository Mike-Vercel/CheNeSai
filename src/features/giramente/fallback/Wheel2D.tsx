"use client";

import { clsx } from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FINALE_WHEEL, restAngle, segmentAtAngle, spinAngleAt, STANDARD_WHEEL, WHEEL_LABEL } from "@/lib/giramente/rules";
import type { GiramenteWheelProps, WheelKind, WheelSegment } from "./types";

/**
 * RUOTA 2D (SVG) – versione semplificata con le STESSE regole e gli STESSI risultati della ruota 3D:
 * stessa geometria (lib/giramente/rules.ts), si ferma esattamente sullo spicchio deciso dal server
 * all'istante startedAt + durationMs; chi arriva a metà giro ricalcola l'angolo dal tempo trascorso.
 * Verticale, otto settori verde/rosso/avorio, bordo metallico, luci lungo la circonferenza, puntatore
 * triangolare in alto, «cervello» luminoso al centro.
 */
/** Colori come la ruota 3D: verde, avorio, rosso alternati senza due spicchi uguali vicini. */
const COL_G = "#0f7a2a";
const COL_R = "#c3162a";
const COL_A = "#efe6d2";
const STANDARD_COLORS = [COL_G, COL_A, COL_R, COL_G, COL_R, COL_A, COL_G, COL_R];
const FINALE_COLORS = [COL_G, COL_A, COL_R, COL_A, COL_G, COL_A, COL_R, COL_A];

function toSegments(kinds: WheelKind[], finale: boolean): WheelSegment[] {
  const colors = finale ? FINALE_COLORS : STANDARD_COLORS;
  return kinds.map((kind, i) => ({
    // stessi id della ruota 3D: «intruso» (standard), «intruso-1»/«intruso-2» (Giro Decisivo)
    id: finale ? `${kind}-${i < 4 ? 1 : 2}` : kind,
    kind,
    label: WHEEL_LABEL[kind],
    color: colors[i],
    ...(colors[i] === COL_A ? { textColor: "#0b1a10" } : {}),
  }));
}

export const WHEEL_SEGMENTS_STANDARD: WheelSegment[] = toSegments(STANDARD_WHEEL, false);
export const WHEEL_SEGMENTS_FINALE: WheelSegment[] = toSegments(FINALE_WHEEL, true);

const ICON: Record<WheelKind, string> = { intruso: "✕", sequenza: "1·2·3", indizi: "?!", prospettiva: "◎", mistero: "?", jolly: "♦", bonus: "★", colpo: "⚡" };

const C = 200;
const R = 168;
const point = (a: number, r: number) => [C + r * Math.sin(a), C - r * Math.cos(a)] as const;

export function GiramenteWheel({ segments, spin, restIndex = null, now, highlight = false, onSpinEnd, onTick, showStand = true, className }: GiramenteWheelProps) {
  const n = Math.max(1, segments.length);
  const s = (Math.PI * 2) / n;
  const groupRef = useRef<SVGGElement>(null);
  const angleRef = useRef(restIndex !== null && restIndex !== undefined ? restAngle(restIndex, n) : 0);
  const fromRef = useRef<{ spinId: string; from: number } | null>(null);
  const endedRef = useRef<string | null>(null);
  const lastSeg = useRef(-1);
  const [stopped, setStopped] = useState<{ spinId: string; index: number } | null>(null);
  const cb = useRef({ onSpinEnd, onTick, now });
  useEffect(() => {
    cb.current = { onSpinEnd, onTick, now };
  });

  // ruota ferma (nessun giro in corso): sullo spicchio indicato
  useLayoutEffect(() => {
    if (spin) return;
    if (restIndex !== null && restIndex !== undefined) angleRef.current = restAngle(restIndex, n);
    groupRef.current?.setAttribute("transform", `rotate(${(angleRef.current * 180) / Math.PI} ${C} ${C})`);
  }, [spin, restIndex, n]);

  useEffect(() => {
    if (!spin) return;
    if (!fromRef.current || fromRef.current.spinId !== spin.spinId) {
      // il giro parte dall'angolo mostrato ora (chi arriva in ritardo parte da 0: l'arresto è identico)
      fromRef.current = { spinId: spin.spinId, from: angleRef.current };
    }
    const from = fromRef.current.from;
    let raf = 0;
    const frame = () => {
      const t = cb.current.now();
      const a = spinAngleAt(spin, n, t, from);
      angleRef.current = a;
      groupRef.current?.setAttribute("transform", `rotate(${(a * 180) / Math.PI} ${C} ${C})`);
      const seg = segmentAtAngle(a, n);
      if (seg !== lastSeg.current) {
        if (lastSeg.current !== -1 && t < spin.startedAt + spin.durationMs) cb.current.onTick?.();
        lastSeg.current = seg;
      }
      if (t >= spin.startedAt + spin.durationMs) {
        if (endedRef.current !== spin.spinId) {
          endedRef.current = spin.spinId;
          setStopped({ spinId: spin.spinId, index: spin.targetIndex });
          cb.current.onSpinEnd?.(spin.spinId);
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spin, n]);

  const lit = highlight ? (spin ? (stopped?.spinId === spin.spinId ? stopped.index : null) : restIndex) : null;
  const bulbs = Array.from({ length: 24 }, (_, i) => point((i / 24) * Math.PI * 2, R + 14));

  return (
    <div className={clsx("relative mx-auto aspect-square w-full max-w-[34rem] select-none", className)} role="img" aria-label="Ruota di GIRAMENTE!">
      <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible drop-shadow-[0_24px_40px_rgba(0,0,0,.8)]">
        <defs>
          <radialGradient id="gm-rim" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#e8edf0" />
            <stop offset="55%" stopColor="#7d878e" />
            <stop offset="100%" stopColor="#2b3136" />
          </radialGradient>
          <radialGradient id="gm-hub" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#1d3a1f" />
            <stop offset="100%" stopColor="#060a07" />
          </radialGradient>
          <radialGradient id="gm-shade" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,.45)" />
          </radialGradient>
        </defs>
        {/* bordo metallico con lampadine */}
        <circle cx={C} cy={C} r={R + 24} fill="url(#gm-rim)" />
        <circle cx={C} cy={C} r={R + 6} fill="#0b0f12" />
        {bulbs.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4.2} fill={i % 2 ? "#ffe9a3" : "#b6ff9e"} className={i % 2 ? "" : "gm-pulse"} opacity={0.95} />
        ))}
        <g ref={groupRef}>
          {segments.map((seg, i) => {
            const a0 = i * s;
            const a1 = (i + 1) * s;
            const [x0, y0] = point(a0, R);
            const [x1, y1] = point(a1, R);
            const mid = a0 + s / 2;
            const [lx, ly] = point(mid, R * 0.64);
            const [ix, iy] = point(mid, R * 0.86);
            const on = lit === i;
            return (
              <g key={seg.id}>
                <path d={`M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`} fill={seg.color} stroke="#f2c14e" strokeWidth={2} style={on ? { filter: "brightness(1.35)" } : undefined} />
                <text
                  x={lx}
                  y={ly}
                  fill={seg.textColor ?? "#f4f6f7"}
                  fontSize={seg.label.length > 12 ? 11 : seg.label.length > 9 ? 13 : 16}
                  fontWeight={900}
                  fontStyle="italic"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${(mid * 180) / Math.PI - 90} ${lx} ${ly})`}
                  style={{ fontFamily: "var(--font-gm)", letterSpacing: ".02em", paintOrder: "stroke", stroke: seg.textColor ? "none" : "rgba(0,0,0,.55)", strokeWidth: 3 }}
                >
                  {seg.label}
                </text>
                <text x={ix} y={iy} fill={seg.textColor ?? "#f4f6f7"} fontSize={14} fontWeight={900} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(mid * 180) / Math.PI} ${ix} ${iy})`}>
                  {ICON[seg.kind]}
                </text>
              </g>
            );
          })}
          <circle cx={C} cy={C} r={R} fill="url(#gm-shade)" pointerEvents="none" />
        </g>
        {/* centro: cervello luminoso */}
        <circle cx={C} cy={C} r={44} fill="url(#gm-hub)" stroke="#39ff14" strokeWidth={4} className="gm-pulse" />
        <g transform={`translate(${C - 24} ${C - 22}) scale(2)`} fill="none" stroke="#39ff14" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4.5a3 3 0 0 0-5.6-1.2A3 3 0 0 0 3 6.2a3 3 0 0 0-.6 5.3A3.2 3.2 0 0 0 5.2 17a3 3 0 0 0 5.6 1.2A2.9 2.9 0 0 0 12 18V4.5z" />
          <path d="M12 4.5a3 3 0 0 1 5.6-1.2A3 3 0 0 1 21 6.2a3 3 0 0 1 .6 5.3A3.2 3.2 0 0 1 18.8 17a3 3 0 0 1-5.6 1.2A2.9 2.9 0 0 1 12 18" />
          <path d="M8 8.5c1 .2 1.8 1 2 2M16 8.5c-1 .2-1.8 1-2 2M7.5 13.5c1-.6 2.2-.5 3 .3M16.5 13.5c-1-.6-2.2-.5-3 .3" />
        </g>
        {/* puntatore triangolare */}
        <g transform={`translate(${C} ${C - R - 30})`}>
          <path d="M -18 -6 L 18 -6 L 0 30 Z" fill="#39ff14" stroke="#e9ffe0" strokeWidth={2.5} strokeLinejoin="round" className="gm-pulse" />
        </g>
      </svg>
      {showStand && (
        <div aria-hidden className="mx-auto -mt-[4%] h-[9%] w-[46%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(57,255,20,.35),transparent_70%)] blur-[2px]" />
      )}
    </div>
  );
}
