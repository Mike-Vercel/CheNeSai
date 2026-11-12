"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { ICON_STROKE, WHEEL_ICONS } from "./icons";
import type { GiramenteWheelProps, WheelSegment } from "./types";
import { WheelDriver } from "./wheel-driver";
import { DISC_LAYOUT, segmentTextColor } from "./wheel-texture";
import { prefersReducedMotion } from "./quality";
import { WHEEL_KIND_LABEL } from "./segments";

/**
 * Ruota 2D (SVG) per dispositivi senza WebGL, renderer software o movimento ridotto: STESSI spicchi, STESSA
 * animazione deterministica (WheelDriver/wheel-math) e STESSO risultato della 3D. Il rotore gira con una
 * trasformazione SVG aggiornata in requestAnimationFrame (nessun render di React per fotogramma).
 */

const LOGO_URL = "/models/giramente/logo-g.webp";
const RAD = 100; // raggio del disco nel viewBox
const BULBS = 24;

/** Icona del cervello per il centro (disegnata da noi, riquadro 24). */
const BRAIN_2D = [
  "M11.3 4.2c-1.4-1.6-4.3-1.2-5 .9-1.9.2-3 2.1-2.4 3.8-1.5.9-1.8 3-.6 4.2-.9 1.5-.2 3.5 1.4 4 .2 1.9 2.3 3 4 2.2 1 .9 2.2 1 2.6.7V4.2Z",
  "M12.7 4.2c1.4-1.6 4.3-1.2 5 .9 1.9.2 3 2.1 2.4 3.8 1.5.9 1.8 3 .6 4.2.9 1.5.2 3.5-1.4 4-.2 1.9-2.3 3-4 2.2-1 .9-2.2 1-2.6.7V4.2Z",
  "M8 7.4c1 .3 1.6 1.2 1.5 2.3 M5.8 11.4c1.2-.4 2.5 0 3.1 1 M7.4 15.6c.3-1.1 1.4-1.8 2.5-1.6 M16 7.4c-1 .3-1.6 1.2-1.5 2.3 M18.2 11.4c-1.2-.4-2.5 0-3.1 1 M16.6 15.6c-.3-1.1-1.4-1.8-2.5-1.6",
];

function polar(r: number, a: number): [number, number] {
  return [Math.cos(a) * r, Math.sin(a) * r];
}

function sectorPath(i: number, n: number, r0: number, r1: number): string {
  const s = (Math.PI * 2) / n;
  const a0 = i * s;
  const a1 = a0 + s;
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  const large = s > Math.PI ? 1 : 0;
  return `M${x3} ${y3}L${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

/** Arco su cui scorre il nome (senso orario: si legge da sinistra a destra quando lo spicchio è in alto). */
function labelArc(i: number, n: number, r: number): string {
  const s = (Math.PI * 2) / n;
  const a0 = i * s + s * 0.03;
  const a1 = (i + 1) * s - s * 0.03;
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`;
}

function Icon({ seg, size }: { seg: WheelSegment; size: number }) {
  const color = segmentTextColor(seg);
  const k = size / 24;
  return (
    <g transform={`translate(${-size / 2} ${-size / 2}) scale(${k})`} strokeLinecap="round" strokeLinejoin="round">
      {WHEEL_ICONS[seg.kind].map((p, j) => (
        <path key={j} d={p.d} fill={p.fill ? color : "none"} stroke={p.fill ? "none" : color} strokeWidth={ICON_STROKE} />
      ))}
    </g>
  );
}

export interface Wheel2DProps extends GiramenteWheelProps {
  center?: "brain" | "logo";
}

export default function Wheel2D({ segments, spin, restIndex, now, highlight, onSpinEnd, onTick, showStand = true, className, center = "brain" }: Wheel2DProps) {
  const uid = useId().replace(/:/g, "");
  const n = Math.max(2, segments.length);
  const s = (Math.PI * 2) / n;
  const rotor = useRef<SVGGElement>(null);
  const pointer = useRef<SVGGElement>(null);
  const hi = useRef<SVGGElement>(null);
  const bulbRefs = useRef<(SVGCircleElement | null)[]>([]);
  const driver = useMemo(() => new WheelDriver(), []);
  const cb = useRef({ onSpinEnd, onTick });
  useEffect(() => {
    cb.current = { onSpinEnd, onTick };
  });
  const live = useRef({ spin, restIndex, highlight, now });
  useEffect(() => {
    live.current = { spin, restIndex, highlight, now };
  });

  useEffect(() => {
    const reduced = prefersReducedMotion();
    let id = 0;
    let kick = 0;
    let last = performance.now();
    let hiW = 0;
    const loop = (pt: number) => {
      const dt = Math.min(0.1, (pt - last) / 1000);
      last = pt;
      const L = live.current;
      const f = driver.update(L.spin, L.restIndex ?? null, n, L.now());
      // SVG: y verso il basso, quindi la rotazione antioraria del 3D è un angolo negativo
      rotor.current?.setAttribute("transform", `rotate(${(-f.angle * 180) / Math.PI})`);
      if (f.ticked) cb.current.onTick?.();
      if (f.ended) cb.current.onSpinEnd?.(f.ended);
      if (f.pegChanged) kick = Math.min(1, kick + 0.75);
      kick *= Math.exp(-dt * 13);
      pointer.current?.setAttribute("transform", `rotate(${kick * 24 * Math.sign(f.speed || 1)} 0 -118)`);
      const showHi = !!L.highlight && !f.spinning && f.restingOn !== null;
      hiW += ((showHi ? 1 : 0) - hiW) * (1 - Math.exp(-dt * 6));
      if (hi.current) hi.current.style.opacity = String(hiW * (reduced ? 1 : 0.75 + 0.25 * Math.sin(pt / 160)));
      if (!reduced) {
        const chase = f.spinning ? 6 + Math.abs(f.speed) * 1.6 : 3.5;
        const phase = Math.floor((pt / 1000) * chase);
        bulbRefs.current.forEach((b, i) => {
          if (!b) return;
          if (hiW > 0.5) {
            const on = (Math.floor(pt / 250) + i) % 2 === 0;
            b.setAttribute("fill", i % 2 === 0 ? (on ? "#7dff5a" : "#1d4a12") : on ? "#ff5a6a" : "#4a1218");
          } else b.setAttribute("fill", (phase + i) % 3 === 0 ? "#fff1c9" : "#6b5a3a");
        });
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [driver, n]);

  const hiIndex = ((Math.round(spin?.targetIndex ?? restIndex ?? 0) % n) + n) % n;
  const rText = RAD * DISC_LAYOUT.text;
  const winner = segments[hiIndex];

  return (
    <div className={className} style={{ position: "relative" }}>
      <svg
        viewBox={showStand ? "-140 -150 280 330" : "-140 -150 280 285"}
        role="img"
        aria-label={`Ruota di GIRAMENTE!${winner && !spin ? `: ${WHEEL_KIND_LABEL[winner.kind] ?? winner.label}` : ""}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          <radialGradient id={`${uid}-shade`} cx="0" cy="0" r={RAD} gradientUnits="userSpaceOnUse">
            <stop offset="0.2" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.4" />
          </radialGradient>
          <linearGradient id={`${uid}-steel`} x1="0" y1="-1" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#eef2f4" />
            <stop offset="0.5" stopColor="#8d979e" />
            <stop offset="1" stopColor="#d6dce0" />
          </linearGradient>
          <linearGradient id={`${uid}-neon`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0.25" stopColor="#39FF14" />
            <stop offset="0.75" stopColor="#FF253A" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {segments.map((_, i) => (
            <path key={i} id={`${uid}-arc-${i}`} d={labelArc(i, n, rText)} />
          ))}
        </defs>

        {showStand && (
          <g>
            <path d="M-26 0 L-78 150 L78 150 L26 0 Z" fill="#15191c" stroke="#2b3237" strokeWidth="2" />
            <ellipse cx="0" cy="160" rx="112" ry="18" fill="#0b0e10" stroke={`url(#${uid}-neon)`} strokeWidth="2.5" />
            <rect x="-96" y="142" width="192" height="20" rx="8" fill="#101416" />
            <text x="0" y="157" textAnchor="middle" fontSize="15" fontWeight="900" fill="#39FF14" style={{ fontFamily: "var(--font-giramente, Impact, sans-serif)", letterSpacing: "0.06em" }}>
              GIRAMENTE<tspan fill="#FF253A">!</tspan>
            </text>
          </g>
        )}

        <circle r={RAD * 1.205} fill="none" stroke={`url(#${uid}-neon)`} strokeWidth="2.6" filter={`url(#${uid}-glow)`} />
        <circle r={RAD * 1.13} fill="#0c0e10" />

        <g ref={rotor}>
          {segments.map((seg, i) => (
            <path key={seg.id + i} d={sectorPath(i, n, 0, RAD)} fill={seg.color} />
          ))}
          <circle r={RAD} fill={`url(#${uid}-shade)`} />
          {segments.map((_, i) => {
            const [x, y] = polar(RAD, i * s);
            return <line key={i} x1="0" y1="0" x2={x} y2={y} stroke="#cfd6db" strokeWidth="1.1" />;
          })}
          {segments.map((seg, i) => {
            const mid = (i + 0.5) * s;
            const deg = ((mid + Math.PI / 2) * 180) / Math.PI;
            const color = segmentTextColor(seg);
            const label = seg.label.toLocaleUpperCase("it-IT");
            const fs = Math.min(RAD * DISC_LAYOUT.textMax, (rText * s * 0.84) / Math.max(4, label.length * 0.62));
            return (
              <g key={`l${i}`}>
                <g transform={`rotate(${deg}) translate(0 ${-RAD * DISC_LAYOUT.icon})`}>
                  <Icon seg={seg} size={RAD * DISC_LAYOUT.iconSize} />
                </g>
                <text fontSize={fs} fontWeight="800" fill={color} dominantBaseline="middle" style={{ fontFamily: "var(--font-giramente, 'Arial Narrow', Impact, sans-serif)", letterSpacing: "0.02em" }}>
                  <textPath href={`#${uid}-arc-${i}`} startOffset="50%" textAnchor="middle">
                    {label}
                  </textPath>
                </text>
              </g>
            );
          })}
          <g ref={hi} style={{ opacity: 0 }}>
            <path d={sectorPath(hiIndex, n, RAD * DISC_LAYOUT.hub, RAD * 0.99)} fill="#eaffdf" fillOpacity="0.22" stroke="#39FF14" strokeWidth="3.2" filter={`url(#${uid}-glow)`} />
          </g>
          <circle r={RAD * 1.075} fill="none" stroke={`url(#${uid}-steel)`} strokeWidth={RAD * 0.12} />
          {Array.from({ length: BULBS }, (_, i) => {
            const [x, y] = polar(RAD * 1.075, (i / BULBS) * Math.PI * 2);
            return (
              <circle
                key={i}
                ref={(el) => {
                  bulbRefs.current[i] = el;
                }}
                cx={x}
                cy={y}
                r={3.6}
                fill="#fff1c9"
              />
            );
          })}
        </g>

        {/* mozzo fermo */}
        <circle r={RAD * DISC_LAYOUT.hub} fill="#121619" stroke="#c9d0d5" strokeWidth="3" />
        <circle r={RAD * (DISC_LAYOUT.hub - 0.04)} fill="none" stroke="#39FF14" strokeWidth="1.4" filter={`url(#${uid}-glow)`} />
        {center === "brain" ? (
          <g transform="translate(-15 -15) scale(1.25)" fill="#0b3a17" stroke="#39FF14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${uid}-glow)`}>
            {BRAIN_2D.map((d, j) => (
              <path key={j} d={d} fill={j < 2 ? "#0b3a17" : "none"} />
            ))}
          </g>
        ) : (
          <image href={LOGO_URL} x={-RAD * 0.22} y={-RAD * 0.22} width={RAD * 0.44} height={RAD * 0.44} />
        )}

        {/* puntatore in alto (perno a y = −118) */}
        <g ref={pointer}>
          <path d="M-15 -122 L15 -122 L0 -96 Z" fill="#d7dde1" stroke="#7d868c" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M-9 -119 L9 -119 L0 -103 Z" fill="#39FF14" filter={`url(#${uid}-glow)`} />
        </g>
        <circle cx="0" cy="-118" r="3.2" fill="#9aa3a9" />
      </svg>
    </div>
  );
}
