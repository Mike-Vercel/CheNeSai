"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
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

/**
 * Barra risposta (TV e anteprime). Con `onPress` diventa un pulsante vero (show interattivo dal PC:
 * clic, Tab + Invio/Spazio con l'anello di fuoco visibile, tasto numerico indicato da `keyHint`);
 * senza resta la barra del TV di sempre, identica.
 */
export function AnswerBar({
  position,
  text,
  visual = "idle",
  size = "tv",
  trailing,
  delayIndex = 0,
  onPress,
  disabled = false,
  keyHint = null,
  shortcut = null,
  multiple = false,
  dense = false,
}: {
  position: number;
  text: string;
  visual?: AnswerVisual;
  size?: "tv" | "md";
  trailing?: ReactNode;
  delayIndex?: number;
  /** risposta da cliccare (chi gioca dallo show) */
  onPress?: () => void;
  disabled?: boolean;
  /** tasto della scorciatoia mostrato sulla barra (es. "1"), solo mentre si può rispondere */
  keyHint?: string | null;
  /** tasto della scorciatoia per i lettori di schermo (aria-keyshortcuts), sempre */
  shortcut?: string | null;
  /** risposta multipla: casella di spunta (solo se si può cliccare) */
  multiple?: boolean;
  /** barre un po' più basse (show interattivo: sotto c'è lo stato della risposta) */
  dense?: boolean;
}) {
  const st = ANSWER_STYLES[position];
  const interactive = !!onPress;
  const selected = visual === "selected" || visual === "locked";
  const inner = (
    <>
      {/* bagliore della risposta giusta: pulsa solo l'opacità di un alone fisso (lavoro del compositore);
          il drop-shadow animato di animate-pulse-glow ridisegnava la barra a ogni frame */}
      {visual === "correct" && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 scale-[1.03] rounded-full"
          style={{ boxShadow: "0 0 22px 6px rgba(255,212,59,.95)" }}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div
        className={clsx(
          "relative flex items-center overflow-hidden rounded-full border-4 transition-all duration-500 animate-pop-in",
          size === "tv" ? clsx(dense ? "min-h-[6.6cqh]" : "min-h-[7.4cqh]", "gap-[1.2cqw] pr-[2cqw]") : "min-h-14 gap-3 pr-4",
          visual === "dimmed" && "opacity-35 saturate-50",
          visual === "wrong" && "opacity-40 grayscale",
          visual === "correct" && "scale-[1.03]",
          selected && "scale-[1.02]",
        )}
        style={{
          background: st.bg,
          borderColor: visual === "correct" ? "#ffd43b" : selected ? "#ffffff" : "rgba(255,212,59,.85)",
          boxShadow:
            visual === "correct"
              ? "0 0 0 4px #fff, 0 0 40px 8px rgba(255,212,59,.9)"
              : selected
                ? `0 0 0 4px ${st.ring}, 0 0 30px 6px ${st.ring}`
                : visual === "missed"
                  ? `0 0 0 4px rgba(255,212,59,.75), 0 6px 0 ${st.edge}`
                  : `0 6px 0 ${st.edge}, 0 10px 24px rgba(0,0,0,.45)`,
          animationDelay: `${delayIndex * 90}ms`,
        }}
      >
        <span
          className={clsx(
            "grid shrink-0 place-items-center rounded-full border-4 border-[#ffd43b] bg-gradient-to-b from-[#fff3a6] to-[#ffb800] font-display text-ink",
            size === "tv" ? (dense ? "ml-[0.5cqw] h-[5.4cqh] w-[5.4cqh] text-[3.4cqh]" : "ml-[0.5cqw] h-[6cqh] w-[6cqh] text-[3.8cqh]") : "ml-1 h-11 w-11 text-2xl",
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
        {interactive && multiple && (
          <span
            aria-hidden
            className={clsx(
              "grid shrink-0 place-items-center rounded-[0.8cqh] border-[0.35cqh] border-white font-black",
              size === "tv" ? "h-[4.4cqh] w-[4.4cqh] text-[3cqh]" : "h-8 w-8 text-xl",
              selected ? "bg-white text-ink" : "bg-black/20 text-transparent",
            )}
          >
            ✓
          </span>
        )}
        {interactive && !multiple && selected && <span className={clsx("shrink-0 font-display text-white", size === "tv" ? "text-[3.2cqh]" : "text-2xl")}>●</span>}
        {visual === "correct" && <span className={clsx("font-display text-gold", size === "tv" ? "text-[3.6cqh]" : "text-2xl")}>✓</span>}
        {trailing}
        {keyHint && (
          <kbd
            aria-hidden
            className={clsx(
              "shrink-0 rounded-[0.8cqh] border-b-[0.4cqh] border-black/40 bg-black/35 font-display leading-none text-white/95",
              size === "tv" ? "px-[1cqh] py-[0.5cqh] text-[2.4cqh]" : "px-2 py-1 text-sm",
            )}
          >
            {keyHint}
          </kbd>
        )}
      </div>
    </>
  );
  if (!interactive) return <div className="relative">{inner}</div>;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-pressed={selected}
      aria-keyshortcuts={shortcut ?? keyHint ?? undefined}
      className="relative block w-full rounded-full text-left outline-none transition focus-visible:ring-[0.7cqh] focus-visible:ring-cyan focus-visible:ring-offset-[0.5cqh] focus-visible:ring-offset-night enabled:hover:-translate-y-[0.3cqh] enabled:active:translate-y-[0.3cqh] disabled:cursor-default"
    >
      {inner}
    </button>
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
  keyHint = null,
}: {
  position: number;
  text: string;
  visual: AnswerVisual;
  multiple: boolean;
  disabled: boolean;
  onPress: () => void;
  /** tasto della scorciatoia (dal PC), es. "1" */
  keyHint?: string | null;
}) {
  const st = ANSWER_STYLES[position];
  const selected = visual === "selected" || visual === "locked";
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-pressed={selected}
      aria-keyshortcuts={keyHint ?? undefined}
      className={clsx(
        "relative flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-4 py-2 pl-2 pr-3 text-left outline-none transition focus-visible:ring-4 focus-visible:ring-cyan active:translate-y-[3px] active:shadow-none disabled:active:translate-y-0",
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
      {keyHint && (
        <kbd aria-hidden className="shrink-0 rounded-md border-b-2 border-black/40 bg-black/35 px-2 py-1 font-display text-sm leading-none text-white/95">
          {keyHint}
        </kbd>
      )}
    </button>
  );
}
