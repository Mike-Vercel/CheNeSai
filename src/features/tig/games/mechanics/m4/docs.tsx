"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { IconKind } from "@/lib/tig/games/components/art";
import type { DocKind } from "@/lib/tig/games/mechanics/_m4";
import { IconBadge, SceneIcon } from "../../kit/scene";

/**
 * Documenti dei fascicoli INVENTATI disegnati in codice (niente foto né loghi reali): scontrino, biglietto,
 * messaggio, post-it, tessera, verbale, agenda, polaroid. Ogni tipo ha il suo «materiale» ma lo stesso
 * schema: intestazione, righe, contenuto extra (es. campi toccabili). Testi scuri su carta, contrasto alto.
 */

export type DocState = "idle" | "picked" | "fake" | "genuine" | "dim";

const PAPER: Record<DocKind, { bg: string; ink: string; label: string }> = {
  scontrino: { bg: "#f4f1e8", ink: "#16181d", label: "Scontrino" },
  biglietto: { bg: "#ffd36b", ink: "#1a1406", label: "Biglietto" },
  messaggio: { bg: "#1d2330", ink: "#eef2f6", label: "Messaggio" },
  nota: { bg: "#ffe680", ink: "#221c05", label: "Appunto" },
  tessera: { bg: "#e8f7ff", ink: "#0b1a22", label: "Tessera" },
  verbale: { bg: "#f7f4ee", ink: "#1a1a1a", label: "Verbale" },
  agenda: { bg: "#fbfbf6", ink: "#1b1b22", label: "Agenda" },
  foto: { bg: "#f6f6f2", ink: "#16181d", label: "Foto" },
};

export function docKindLabel(kind: DocKind): string {
  return PAPER[kind].label;
}

export function DocCard({
  kind,
  title,
  lines,
  icon,
  iconLabel,
  state = "idle",
  tv = false,
  index,
  children,
  footer,
  compact = false,
}: {
  kind: DocKind;
  title: string;
  lines?: readonly string[];
  icon?: IconKind;
  iconLabel?: string;
  state?: DocState;
  tv?: boolean;
  /** numero mostrato nell'angolo (scorciatoia da tastiera) */
  index?: number;
  /** contenuto aggiuntivo (es. campi toccabili) */
  children?: ReactNode;
  footer?: ReactNode;
  /** versione bassa (TV al reveal: foto più piccola) */
  compact?: boolean;
}) {
  const p = PAPER[kind];
  const mono = kind === "scontrino" || kind === "biglietto" || kind === "tessera";
  const s = (phone: string, tvc: string) => (tv ? tvc : phone);
  return (
    <figure
      className={clsx(
        "relative flex flex-col overflow-hidden transition-[transform,box-shadow,opacity] duration-300",
        s("rounded-xl", "rounded-[0.8cqw]"),
        kind === "nota" && "rotate-[-0.6deg]",
        state === "picked" && s("outline outline-[4px] outline-offset-2 outline-[#c6ff3d]", "outline outline-[0.3cqw] outline-offset-[0.2cqw] outline-[#c6ff3d]"),
        state === "fake" && s("outline outline-[4px] outline-offset-2 outline-[#ff3b4e]", "outline outline-[0.35cqw] outline-offset-[0.2cqw] outline-[#ff3b4e]"),
        state === "genuine" && s("outline outline-[3px] outline-offset-2 outline-[#c6ff3d]/70", "outline outline-[0.22cqw] outline-offset-[0.2cqw] outline-[#c6ff3d]/70"),
        state === "dim" && "opacity-45",
      )}
      style={{ background: p.bg, color: p.ink, boxShadow: "0 18px 40px -18px rgba(0,0,0,0.9)" }}
    >
      {/* fascia del tipo di documento */}
      <div
        className={clsx("flex items-center justify-between font-extrabold uppercase", s("gap-2 px-3 pt-2 text-[10px] tracking-[0.18em]", "gap-[0.6cqw] px-[1cqw] pt-[0.6cqw] text-[0.8cqw] tracking-[0.2em]"))}
        style={{ color: kind === "messaggio" ? "#6fe7ff" : `${p.ink}99` }}
      >
        <span>{p.label}</span>
        {index !== undefined && (
          <span className={clsx("tg-num grid place-items-center rounded-md", s("h-6 w-6 text-sm", "h-[1.8cqw] w-[1.8cqw] text-[1.1cqw]"))} style={{ background: kind === "messaggio" ? "rgba(255,255,255,0.12)" : `${p.ink}1f` }}>
            {index + 1}
          </span>
        )}
      </div>

      {kind === "foto" && (
        <div className={clsx("mx-auto flex items-center justify-center bg-[#1d2330]", s("mt-2 h-36 w-[calc(100%-1.5rem)] rounded-sm", compact ? "mt-[0.4cqw] h-[4.6cqw] w-[calc(100%-2cqw)] rounded-[0.2cqw]" : "mt-[0.5cqw] h-[7cqw] w-[calc(100%-2cqw)] rounded-[0.2cqw]"))} role="img" aria-label={`Foto: ${title}${iconLabel ? `, si legge «${iconLabel}»` : ""}`}>
          {icon ? (
            <svg viewBox="0 0 100 100" className="h-[86%]" aria-hidden>
              <SceneIcon kind={icon} tone="amber" label={iconLabel} />
            </svg>
          ) : (
            <IconBadge kind="poster" tone="cyan" className="h-[70%]" />
          )}
        </div>
      )}

      <div className={clsx("flex flex-1 flex-col", s("gap-1 px-3 pb-3 pt-1.5", "gap-[0.35cqw] px-[1cqw] pb-[0.9cqw] pt-[0.4cqw]"))}>
        <p className={clsx("font-extrabold leading-tight", mono && "uppercase", kind === "scontrino" && "text-center", s("text-base", "text-[1.55cqw]"))}>{title}</p>
        {kind === "verbale" && <span className={clsx("self-start rounded border-2 border-[#c22a3a] font-extrabold uppercase text-[#c22a3a]", s("px-1.5 text-[10px] tracking-widest", "px-[0.4cqw] text-[0.75cqw] tracking-[0.2em]"))}>Protocollo</span>}
        {lines?.map((l, i) => (
          <p
            key={i}
            className={clsx(
              "leading-snug",
              mono ? "font-mono font-bold" : kind === "nota" ? "font-bold italic" : "font-semibold",
              kind === "agenda" && "border-b border-[#c22a3a]/25",
              kind === "messaggio" && i === 0 && "rounded-xl bg-white/[0.07] px-2 py-1",
              s("text-[15px]", "text-[1.3cqw]"),
            )}
          >
            {l}
          </p>
        ))}
        {children}
      </div>
      {footer}
      {kind === "scontrino" && (
        <div aria-hidden className={s("h-2.5", "h-[0.7cqw]")} style={{ background: `linear-gradient(-45deg, transparent 50%, ${p.bg} 50%) 0 0 / 12px 12px, linear-gradient(45deg, transparent 50%, ${p.bg} 50%) 0 0 / 12px 12px`, backgroundColor: "transparent", marginBottom: "-1px" }} />
      )}
    </figure>
  );
}
