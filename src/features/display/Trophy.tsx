"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";

/** Coppa dorata (SVG originale): oro con riflesso, manici, base a gradini. */
export function TrophyCup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 80" className={className} aria-hidden>
      <defs>
        <linearGradient id="qz-cup-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b8770a" />
          <stop offset="0.35" stopColor="#ffe680" />
          <stop offset="0.55" stopColor="#ffc83d" />
          <stop offset="1" stopColor="#9a5d00" />
        </linearGradient>
        <linearGradient id="qz-cup-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b2a10" />
          <stop offset="1" stopColor="#3b1205" />
        </linearGradient>
      </defs>
      {/* manici */}
      <path d="M14 14 C2 14 2 34 18 38" fill="none" stroke="url(#qz-cup-gold)" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 14 C62 14 62 34 46 38" fill="none" stroke="url(#qz-cup-gold)" strokeWidth="5" strokeLinecap="round" />
      {/* coppa */}
      <path d="M12 8 H52 V20 C52 36 42 46 32 46 C22 46 12 36 12 20 Z" fill="url(#qz-cup-gold)" stroke="#7a4300" strokeWidth="1.5" />
      <ellipse cx="32" cy="8" rx="20" ry="3.5" fill="#fff2a8" stroke="#7a4300" strokeWidth="1.2" />
      {/* stelo e base */}
      <rect x="28" y="45" width="8" height="12" fill="url(#qz-cup-gold)" />
      <path d="M20 57 H44 L47 64 H17 Z" fill="url(#qz-cup-gold)" stroke="#7a4300" strokeWidth="1.2" />
      <rect x="14" y="64" width="36" height="12" rx="2" fill="url(#qz-cup-base)" />
      <rect x="22" y="67" width="20" height="5" rx="1" fill="#ffc83d" opacity="0.85" />
      {/* stella e riflesso */}
      <path d="M32 18 l2.6 5.3 5.8 0.8 -4.2 4.1 1 5.8 -5.2 -2.7 -5.2 2.7 1 -5.8 -4.2 -4.1 5.8 -0.8 Z" fill="#fff8d0" opacity="0.9" />
      <path d="M18 12 C17 22 19 30 23 36" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

/**
 * Il momento della coppa sul podio: un tavolino con la coppa accanto a Palmino; quando compare il
 * vincitore Palmino la prende e la alza sopra la testa (con un piccolo tremolio di gioia) e la tiene
 * lì mentre arrivano gli altri piazzamenti. Funziona sopra i personaggi 2D e 3D (la coppa è un
 * livello a sé: segue un percorso, non le ossa del modello).
 * `table` = posizione del tavolino, `raised` = dove arriva la coppa (percentuali del contenitore, numeri).
 */
export function TrophyMoment({
  won,
  className,
  table,
  raised,
  cupClassName,
  reducedMotion = false,
}: {
  won: boolean;
  className?: string;
  table: { left: number; bottom: number; width: number; height: number };
  raised: { left: number; bottom: number };
  cupClassName: string;
  reducedMotion?: boolean;
}) {
  const pct = (n: number) => `${n}%`;
  const onTable = { left: pct(table.left + table.width / 2), bottom: pct(table.bottom + table.height * 0.9) };
  const up = { left: pct(raised.left), bottom: pct(raised.bottom) };
  return (
    <div className={clsx("pointer-events-none absolute", className)} data-testid="trophy" data-won={won ? "1" : "0"}>
      {/* tavolino */}
      <div className="absolute" style={{ left: pct(table.left), bottom: pct(table.bottom), width: pct(table.width), height: pct(table.height) }}>
        <div className="absolute inset-x-0 top-0 h-[22%] rounded-[30%] border-[0.25em] border-[#9a5d00] bg-gradient-to-b from-[#ffe680] to-[#c98a10] shadow-[0_0.3em_0_rgba(0,0,0,.35)]" />
        <div className="absolute bottom-0 left-1/2 top-[18%] w-[26%] -translate-x-1/2 bg-gradient-to-r from-[#5a2008] via-[#8a3a12] to-[#5a2008]" />
        <div className="absolute bottom-0 left-[12%] right-[12%] h-[12%] rounded-full bg-[#3b1205]" />
      </div>
      {/* coppa: sul tavolino, poi alzata da Palmino */}
      <motion.div
        className="absolute -translate-x-1/2"
        initial={false}
        animate={won ? up : onTable}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 11, delay: won ? 0.25 : 0 }}
      >
        <motion.div
          animate={won && !reducedMotion ? { rotate: [0, -7, 6, -5, 4, 0], y: [0, -6, 0, -4, 0] } : { rotate: 0, y: 0 }}
          transition={won && !reducedMotion ? { delay: 1.2, duration: 1.1, repeat: Infinity, repeatDelay: 0.6 } : { duration: 0.2 }}
          className="relative"
        >
          <TrophyCup className={cupClassName} />
          {won && !reducedMotion && (
            <motion.span
              className="absolute -right-[10%] top-[6%] text-[1.4em]"
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1.2, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.5 }}
              aria-hidden
            >
              ✨
            </motion.span>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
