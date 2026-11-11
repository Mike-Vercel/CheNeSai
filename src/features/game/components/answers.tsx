"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export const LETTERS = ["A", "B", "C", "D"] as const;

/**
 * Colori per POSIZIONE (A verde, B rosso, C blu, D viola). Identificano solo
 * il pulsante: non anticipano mai quale risposta è corretta.
 */
export const ANSWER_STYLES = [
  { bg: "linear-gradient(180deg,#2ee887 0%,#00b85c 55%,#008a44 100%)", edge: "#006b35", ring: "#7dffbb" },
  { bg: "linear-gradient(180deg,#ff5f7a 0%,#e8173e 55%,#b00f2e 100%)", edge: "#7e0b21", ring: "#ff9fb1" },
  { bg: "linear-gradient(180deg,#45a4ff 0%,#0a6fe6 55%,#0753b0 100%)", edge: "#05408a", ring: "#9fd0ff" },
  { bg: "linear-gradient(180deg,#a865ff 0%,#7a22f0 55%,#5212b8 100%)", edge: "#420e96", ring: "#d2b0ff" },
] as const;

export type AnswerVisual = "idle" | "selected" | "locked" | "correct" | "wrong" | "dimmed" | "missed";

/** Barra risposta (TV e anteprime). */
export function AnswerBar({
  position,
  text,
  visual = "idle",
  size = "tv",
  trailing,
  delayIndex = 0,
}: {
  position: number;
  text: string;
  visual?: AnswerVisual;
  size?: "tv" | "md";
  trailing?: ReactNode;
  delayIndex?: number;
}) {
  const st = ANSWER_STYLES[position];
  return (
    <div
      className={clsx(
        "relative flex items-center overflow-hidden rounded-full border-4 transition-all duration-500 animate-pop-in",
        size === "tv" ? "min-h-[7.4cqh] gap-[1.2cqw] pr-[2cqw]" : "min-h-14 gap-3 pr-4",
        visual === "dimmed" && "opacity-35 saturate-50",
        visual === "wrong" && "opacity-40 grayscale",
        visual === "correct" && "scale-[1.03] animate-pulse-glow",
      )}
      style={{
        background: st.bg,
        borderColor: visual === "correct" ? "#ffd43b" : "rgba(255,212,59,.85)",
        boxShadow:
          visual === "correct"
            ? "0 0 0 4px #fff, 0 0 40px 8px rgba(255,212,59,.9)"
            : `0 6px 0 ${st.edge}, 0 10px 24px rgba(0,0,0,.45)`,
        animationDelay: `${delayIndex * 90}ms`,
      }}
    >
      <span
        className={clsx(
          "grid shrink-0 place-items-center rounded-full border-4 border-[#ffd43b] bg-gradient-to-b from-[#fff3a6] to-[#ffb800] font-display text-ink",
          size === "tv" ? "ml-[0.5cqw] h-[6cqh] w-[6cqh] text-[3.8cqh]" : "ml-1 h-11 w-11 text-2xl",
        )}
      >
        {LETTERS[position]}
      </span>
      <span
        className={clsx(
          "min-w-0 flex-1 font-extrabold leading-tight text-white [text-shadow:0_2px_0_rgba(0,0,0,.35)]",
          size === "tv" ? "text-[3.6cqh]" : "text-lg",
        )}
      >
        {text}
      </span>
      {visual === "correct" && <span className={clsx("font-display text-gold", size === "tv" ? "text-[3.6cqh]" : "text-2xl")}>✓</span>}
      {trailing}
    </div>
  );
}

/** Pulsante risposta per smartphone: grande, usabile con una mano. */
export function AnswerButton({
  position,
  text,
  visual,
  multiple,
  disabled,
  onPress,
}: {
  position: number;
  text: string;
  visual: AnswerVisual;
  multiple: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const st = ANSWER_STYLES[position];
  const selected = visual === "selected" || visual === "locked";
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-pressed={selected}
      className={clsx(
        "relative flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-4 py-2 pl-2 pr-3 text-left transition active:translate-y-[3px] active:shadow-none disabled:active:translate-y-0",
        visual === "dimmed" && "opacity-40",
        visual === "wrong" && "opacity-45 grayscale",
        visual === "missed" && "ring-4 ring-gold/70",
        visual === "correct" && "animate-pulse-glow",
      )}
      style={{
        background: st.bg,
        borderColor: selected || visual === "correct" ? "#ffffff" : "rgba(255,212,59,.8)",
        boxShadow: selected ? `0 0 0 3px ${st.ring}, 0 0 22px ${st.ring}` : `0 5px 0 ${st.edge}`,
      }}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] border-[#ffd43b] bg-gradient-to-b from-[#fff3a6] to-[#ffb800] font-display text-2xl text-ink">
        {LETTERS[position]}
      </span>
      <span className="min-w-0 flex-1 break-words text-[clamp(17px,4.8vw,22px)] font-extrabold leading-tight text-white [text-shadow:0_2px_0_rgba(0,0,0,.35)]">
        {text}
      </span>
      {multiple && (
        <span
          aria-hidden
          className={clsx(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border-[3px] border-white text-xl font-black",
            selected ? "bg-white text-ink" : "bg-black/20 text-transparent",
          )}
        >
          ✓
        </span>
      )}
      {!multiple && selected && <span className="shrink-0 font-display text-2xl text-white">●</span>}
      {visual === "correct" && <span className="shrink-0 font-display text-2xl text-gold">✓</span>}
    </button>
  );
}
