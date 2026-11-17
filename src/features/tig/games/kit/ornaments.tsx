"use client";

import { clsx } from "clsx";
import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * Ornamenti di TAVERNA DEI PIRATI (ex TAVOLI IN GUERRA!), disegnati in codice (SVG): rosa dei venti, bandiera della
 * ciurma, sigillo di ceralacca, teschio simpatico, doblone. Iconografia pirata generica e originale: nessun nome,
 * logo o disegno di film o franchise.
 */

// ---------------------------------------------------------------------------
// Doblone (badge rotondo d'oro con un numero o un segno inciso)
// ---------------------------------------------------------------------------

export function Doubloon({ children, className, style, label }: { children: ReactNode; className?: string; style?: CSSProperties; label?: string }) {
  return (
    <span className={clsx("tg-coin shrink-0", className)} style={style} aria-label={label} role={label ? "img" : undefined}>
      <span aria-hidden={label ? true : undefined}>{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Rosa dei venti
// ---------------------------------------------------------------------------

const TICKS = Array.from({ length: 32 }, (_, i) => i * 11.25);

/** Rosa dei venti a otto punte (colore = `currentColor`; le metà in ombra sono più scure). */
export function CompassRose({ className, style, ring = true }: { className?: string; style?: CSSProperties; ring?: boolean }) {
  const point = (len: number, w: number, a: number, key: string) => (
    <g key={key} transform={`rotate(${a})`}>
      <path d={`M0 0L${-w} ${-w}L0 ${-len}Z`} fill="currentColor" />
      <path d={`M0 0L${w} ${-w}L0 ${-len}Z`} fill="currentColor" opacity={0.42} />
    </g>
  );
  return (
    <svg viewBox="-50 -50 100 100" className={className} style={style} aria-hidden>
      {ring && (
        <>
          <circle r={47.5} fill="none" stroke="currentColor" strokeWidth={1.3} opacity={0.6} />
          <circle r={41} fill="none" stroke="currentColor" strokeWidth={0.7} opacity={0.45} />
          {TICKS.map((a) => (
            <line key={a} x1={0} y1={-41} x2={0} y2={a % 90 === 0 ? -47.5 : a % 45 === 0 ? -46 : -44} stroke="currentColor" strokeWidth={a % 45 === 0 ? 1.4 : 0.8} opacity={0.7} transform={`rotate(${a})`} />
          ))}
        </>
      )}
      {[45, 135, 225, 315].map((a) => point(28, 4.5, a, `i${a}`))}
      {[0, 90, 180, 270].map((a) => point(44, 7, a, `c${a}`))}
      <circle r={3.6} fill="currentColor" />
      <circle r={1.4} fill="#1b1410" opacity={0.7} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Bandiera della ciurma (colore del tavolo, numero inciso)
// ---------------------------------------------------------------------------

const FLAG = "M7 5C17 1.5 27 8.5 38 5S56 1.5 61 3.5V32C55 30 47 36.5 36 33S17 29.5 7 33.5Z";

/** Bandiera della ciurma sull'asta d'ottone: il colore del tavolo, il numero inciso al centro. */
export function CrewFlag({ color, n, className, style }: { color: string; n?: number | string; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const big = String(n ?? "").length > 1;
  return (
    <svg viewBox="0 0 64 48" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#fff" stopOpacity={0.28} />
          <stop offset="0.45" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.7" stopColor="#000" stopOpacity={0.12} />
          <stop offset="1" stopColor="#000" stopOpacity={0.3} />
        </linearGradient>
      </defs>
      <rect x={3} y={2} width={3.4} height={45} rx={1.7} fill="#c9a24a" />
      <rect x={3} y={2} width={1.3} height={45} rx={0.65} fill="#ffe7a3" opacity={0.6} />
      <circle cx={4.7} cy={2.6} r={2.6} fill="#ffd56b" stroke="#8a5514" strokeWidth={0.6} />
      <path d={FLAG} fill={color} stroke="rgba(27,20,16,.55)" strokeWidth={0.9} />
      <path d={FLAG} fill={`url(#${id}-s)`} />
      {n !== undefined && (
        <text x={34} y={19.5} textAnchor="middle" dominantBaseline="central" fontSize={big ? 17 : 20} fontWeight={900} fill="#1b1410" stroke="rgba(255,248,230,.55)" strokeWidth={0.8} paintOrder="stroke" style={{ fontFamily: "var(--tg-display)", fontFeatureSettings: '"lnum" 1' }}>
          {n}
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sigillo di ceralacca
// ---------------------------------------------------------------------------

/** contorno «colato» della ceralacca (deterministico) */
const SEAL_EDGE = (() => {
  const pts: string[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 43 + (i % 2 ? 3.2 : -1.2) + Math.sin(i * 1.7) * 1.6;
    pts.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
})();

const SEAL_MARKS: Record<"check" | "anchor" | "x" | "star", ReactNode> = {
  check: <path d="M-15 1L-5 11L16-11" fill="none" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />,
  x: <path d="M-12-12L12 12M12-12L-12 12" fill="none" strokeWidth={7} strokeLinecap="round" />,
  anchor: (
    <g fill="none" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={0} cy={-15} r={4.5} />
      <path d="M0-10V17M-9-4H9M-17 4C-15 13-8 17 0 17S15 13 17 4M-17 4L-20 9M-17 4L-12 7M17 4L20 9M17 4L12 7" />
    </g>
  ),
  star: <path d="M0-17L4.6-5.6 17-5.3 7.3 2.4 10.6 14.4 0 7.6-10.6 14.4-7.3 2.4-17-5.3-4.6-5.6Z" strokeWidth={2} strokeLinejoin="round" />,
};

/** Sigillo di ceralacca rossa con un segno impresso (spunta, ancora, stella, croce). */
export function WaxSeal({ mark = "check", className, style, tone = "red" }: { mark?: keyof typeof SEAL_MARKS; className?: string; style?: CSSProperties; tone?: "red" | "gold" }) {
  const id = useId().replace(/:/g, "");
  const [a, b, c, deep] = tone === "gold" ? ["#ffe08a", "#e9a92c", "#9a6216", "#6b4210"] : ["#ea6a5f", "#c8312b", "#7e1a14", "#5a0f0b"];
  return (
    <svg viewBox="-50 -50 100 100" className={className} style={style} aria-hidden>
      <defs>
        <radialGradient id={`${id}-w`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor={a} />
          <stop offset="0.45" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </radialGradient>
      </defs>
      <path d={SEAL_EDGE} fill={`url(#${id}-w)`} />
      <circle r={30} fill="none" stroke={deep} strokeWidth={3} opacity={0.55} />
      <circle r={30} fill="none" stroke={a} strokeWidth={1.2} opacity={0.5} transform="translate(-1 -1)" />
      <g stroke={a} fill={a} opacity={0.45} transform="translate(-1.2 -1.2)">
        {SEAL_MARKS[mark]}
      </g>
      <g stroke={deep} fill={deep}>
        {SEAL_MARKS[mark]}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Teschio simpatico (mai macabro) con le tibie
// ---------------------------------------------------------------------------

/** Teschio simpatico con le tibie incrociate (Caos, allarmi). `currentColor` = colore dell'osso. */
export function SkullMark({ className, style }: { className?: string; style?: CSSProperties }) {
  const bone = (rot: number) => (
    <g transform={`rotate(${rot} 32 40)`}>
      <rect x={6} y={37.5} width={52} height={5} rx={2.5} fill="currentColor" />
      <circle cx={6.5} cy={36.5} r={3.4} fill="currentColor" />
      <circle cx={6.5} cy={43.5} r={3.4} fill="currentColor" />
      <circle cx={57.5} cy={36.5} r={3.4} fill="currentColor" />
      <circle cx={57.5} cy={43.5} r={3.4} fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden>
      <g stroke="#1b1410" strokeWidth={1.6} strokeLinejoin="round">
        {bone(32)}
        {bone(-32)}
        <path d="M32 7C20 7 12 15 12 26c0 6 3 10 7 12v6c0 3 2 5 5 5h16c3 0 5-2 5-5v-6c4-2 7-6 7-12C52 15 44 7 32 7Z" fill="currentColor" />
      </g>
      <ellipse cx={24.5} cy={27} rx={5.2} ry={5.8} fill="#1b1410" />
      <ellipse cx={39.5} cy={27} rx={5.2} ry={5.8} fill="#1b1410" />
      <circle cx={26} cy={25} r={1.6} fill="#fff" opacity={0.85} />
      <circle cx={41} cy={25} r={1.6} fill="#fff" opacity={0.85} />
      <path d="M32 33l-2.6 4h5.2Z" fill="#1b1410" />
      <path d="M25 41.5c4 2.6 10 2.6 14 0" fill="none" stroke="#1b1410" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M29 42.6v3M35 42.6v3" stroke="#1b1410" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}
