"use client";

import "./m1.css";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { SymbolKind, Token } from "@/lib/tig/games/mechanics/la-sequenza-sporca";

/**
 * Elementi della «Sequenza sporca» disegnati in codice: numeri, simboli (con rotazione), facce di dado,
 * orari, lettere e poligoni regolari. Ogni elemento ha anche un nome a parole per i lettori di schermo.
 */

const SYMBOL_NAME: Record<SymbolKind, string> = {
  freccia: "freccia",
  triangolo: "triangolo",
  quadrato: "quadrato",
  cerchio: "cerchio",
  stella: "stella",
  rombo: "rombo",
  cuore: "cuore",
  luna: "luna",
  croce: "croce",
  esagono: "esagono",
};

const DIRS: Record<number, string> = { 0: "in alto", 45: "in alto a destra", 90: "a destra", 135: "in basso a destra", 180: "in basso", 225: "in basso a sinistra", 270: "a sinistra", 315: "in alto a sinistra" };
const POLY: Record<number, string> = { 3: "triangolo", 4: "quadrato", 5: "pentagono", 6: "esagono", 7: "ettagono", 8: "ottagono", 9: "ennagono", 10: "decagono" };

/** Nome a parole dell'elemento (alternativa testuale). */
export function tokenLabel(t: Token): string {
  switch (t.t) {
    case "n":
      return String(t.n);
    case "s":
      return t.s === "freccia" ? `freccia verso ${DIRS[t.r ?? 0] ?? "l'alto"}` : `${SYMBOL_NAME[t.s]}${t.r ? ` ruotato di ${t.r} gradi` : ""}`;
    case "d":
      return `dado con ${t.n} ${t.n === 1 ? "punto" : "punti"}`;
    case "h":
      return `ore ${t.h}`;
    case "l":
      return `lettera ${t.l}`;
    case "p":
      return `${POLY[t.n] ?? "poligono"} (${t.n} lati)`;
  }
}

/** Poligono regolare: con un numero pari di lati poggia su un lato (il quadrato non sembra un rombo). */
function ngon(n: number, r: number): string {
  const phase = -Math.PI / 2 + (n % 2 === 0 ? Math.PI / n : 0);
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

function star(r1: number, r2: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? r2 : r1;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

const SYMBOL_SHAPES: Record<SymbolKind, ReactNode> = {
  freccia: <path d="M50 10 L80 46 H62 V90 H38 V46 H20 Z" />,
  triangolo: <polygon points={ngon(3, 42)} transform="translate(0 6)" />,
  quadrato: <rect x={16} y={16} width={68} height={68} rx={4} />,
  cerchio: <circle cx={50} cy={50} r={36} />,
  stella: <polygon points={star(44, 18)} transform="translate(0 4)" />,
  rombo: <polygon points="50,8 86,50 50,92 14,50" />,
  cuore: <path d="M50 86 C20 64 8 48 12 32 C16 16 38 12 50 30 C62 12 84 16 88 32 C92 48 80 64 50 86 Z" />,
  luna: <path d="M62 10 A40 40 0 1 0 90 66 A32 32 0 1 1 62 10 Z" />,
  croce: <path d="M38 10 H62 V38 H90 V62 H62 V90 H38 V62 H10 V38 H38 Z" />,
  esagono: <polygon points={ngon(6, 40)} />,
};

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

/** Disegno dell'elemento in un riquadro quadrato (colore del testo corrente). */
export function TokenFace({ token, className }: { token: Token; className?: string }) {
  const label = tokenLabel(token);
  if (token.t === "n" || token.t === "l" || token.t === "h") {
    const s = token.t === "n" ? String(token.n) : token.t === "l" ? token.l : token.h;
    const fs = s.length <= 2 ? 62 : s.length === 3 ? 48 : s.length === 4 ? 38 : 30;
    return (
      <svg viewBox="0 0 100 100" className={className} role="img" aria-label={label}>
        <text x={50} y={53} fontSize={fs} textAnchor="middle" dominantBaseline="central" fill="currentColor" style={{ fontFamily: "var(--tg-display)", fontWeight: 800 }}>
          {s}
        </text>
      </svg>
    );
  }
  if (token.t === "d") {
    return (
      <svg viewBox="0 0 100 100" className={className} role="img" aria-label={label}>
        <rect x={10} y={10} width={80} height={80} rx={16} fill="currentColor" />
        {PIPS[token.n].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={8} fill="var(--tg-ink)" />
        ))}
      </svg>
    );
  }
  if (token.t === "p") {
    return (
      <svg viewBox="0 0 100 100" className={className} role="img" aria-label={label}>
        <polygon points={ngon(token.n, 40)} fill="currentColor" transform={token.n === 3 ? "translate(0 6)" : undefined} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={label}>
      <g fill="currentColor" transform={`rotate(${token.r ?? 0} 50 50)`}>
        {SYMBOL_SHAPES[token.s]}
      </g>
    </svg>
  );
}

/** Tessera dell'elemento con il numero di posizione. */
export function TokenTile({
  token,
  index,
  state = "idle",
  tv = false,
  className,
}: {
  token: Token;
  index: number;
  state?: "idle" | "picked" | "right" | "wrong" | "dim";
  tv?: boolean;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "relative flex aspect-square flex-col items-center justify-center border-2 transition-[transform,border-color,background-color] duration-200",
        tv ? "rounded-[1.2cqw] border-[0.2cqw]" : "rounded-2xl",
        // targhette di legno scuro col bordo d'ottone; scelta = oro, intruso al reveal = rosso bandiera a strisce
        state === "idle" && "tg1-plaque text-(--tg-cream)",
        state === "picked" && "tg-picked border-(--tg-gold) bg-(--tg-gold)/10 text-(--tg-gold-hi) shadow-[0_0_24px_-8px_color-mix(in_srgb,var(--tg-gold)_80%,transparent)]",
        state === "right" && "border-(--tg-gold) bg-(--tg-gold)/12 text-(--tg-cream)",
        state === "wrong" && "tg-stripes-red border-(--tg-red) bg-(--tg-red-deep)/35 text-(--tg-red-hi)",
        state === "dim" && "tg1-plaque text-(--tg-cream)/55 opacity-60",
        className,
      )}
    >
      <span className={clsx("tg-num absolute left-[8%] top-[5%] leading-none text-(--tg-gold-pale)/70", tv ? "text-[1.25cqw]" : "text-[13px]")} aria-hidden>
        {index + 1}
      </span>
      <TokenFace token={token} className="h-[72%] w-[72%]" />
    </span>
  );
}
