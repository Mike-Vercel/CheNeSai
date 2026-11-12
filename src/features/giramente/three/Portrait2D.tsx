"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CHARACTER_INFO } from "./characters";
import { simulatedMouth } from "./mouth";
import type { CharacterWho } from "./types";

/**
 * Ritratto 2D di riserva (qualità "2d", WebGL assente o modello non caricato). NON finge di essere il
 * personaggio riggato: è una targa con sagoma stilizzata, nome e un indicatore di voce che segue mouthRef.
 */
export function Portrait2D({ who, speaking, mouthRef, className }: { who: CharacterWho; speaking: boolean; mouthRef?: RefObject<number>; className?: string }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const live = useRef({ speaking, mouthRef });
  useEffect(() => {
    live.current = { speaking, mouthRef };
  });
  useEffect(() => {
    let id = 0;
    const t0 = performance.now();
    const loop = (pt: number) => {
      const L = live.current;
      const t = (pt - t0) / 1000;
      const m = L.mouthRef ? (L.mouthRef.current ?? 0) : L.speaking ? simulatedMouth(t) : 0;
      bars.current.forEach((b, i) => {
        if (b) b.style.transform = `scaleY(${0.15 + m * (0.55 + 0.45 * Math.abs(Math.sin(t * 9 + i * 1.7)))})`;
      });
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  const info = CHARACTER_INFO[who];
  const accent = who === "zafira" ? "#FF253A" : "#39FF14";
  return (
    <div
      className={className}
      role="img"
      aria-label={`${info.name}, ${info.role}${speaking ? " (sta parlando)" : ""}`}
      style={{ position: "relative", display: "grid", placeItems: "center", overflow: "hidden" }}
    >
      <svg viewBox="0 0 100 120" style={{ width: "min(100%, 260px)", height: "auto", maxHeight: "85%", filter: `drop-shadow(0 0 10px ${accent}66)` }} aria-hidden>
        <defs>
          <linearGradient id={`p2d-${who}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a3238" />
            <stop offset="1" stopColor="#0d1013" />
          </linearGradient>
        </defs>
        {who === "dontralla" ? (
          <path d="M50 14c-12 0-19 8-19 19 0 7 3 12 6 15-12 4-26 13-29 31-2 12 0 27 0 41h84c0-14 2-29 0-41-3-18-17-27-29-31 3-3 6-8 6-15 0-11-7-19-19-19Z" fill={`url(#p2d-${who})`} stroke={accent} strokeWidth="1.5" />
        ) : (
          <path d="M50 8c-6 0-10 3-11 8-7 2-12 9-12 18 0 8 4 14 9 17-11 4-22 12-25 28-2 13 0 27 0 41h78c0-14 2-28 0-41-3-16-14-24-25-28 5-3 9-9 9-17 0-9-5-16-12-18-1-5-5-8-11-8Z" fill={`url(#p2d-${who})`} stroke={accent} strokeWidth="1.5" />
        )}
      </svg>
      <div style={{ position: "absolute", bottom: "6%", left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", gap: 3, height: 18, alignItems: "center" }} aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              ref={(el) => {
                bars.current[i] = el;
              }}
              style={{ width: 4, height: 18, borderRadius: 2, background: accent, transformOrigin: "center", transform: "scaleY(0.15)" }}
            />
          ))}
        </div>
        <span style={{ font: "800 15px/1 var(--font-giramente, 'Arial Narrow', sans-serif)", letterSpacing: "0.08em", color: "#F4F6F7", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, background: "rgba(8,11,13,0.8)", border: `1px solid ${accent}` }}>
          {info.name}
        </span>
      </div>
    </div>
  );
}
