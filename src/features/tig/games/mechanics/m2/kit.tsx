"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { TeamOutcome } from "@/lib/tig/games/contract";
import type { TvGameProps } from "../../ui-contract";
import { Icon, type IconName } from "../../kit/icons";
import { Eyebrow, Panel } from "../../kit/ui";

/**
 * Pezzi d'interfaccia comuni alle meccaniche della MANCHE 2 «FREGALI TUTTI!» (bersagli, passi numerati,
 * gettoni dei tavoli in TV, trasferimenti applicati). Stessi colori e caratteri del kit.
 */

export type TvTeams = TvGameProps["teams"];

/** Passo numerato di una scelta in più tempi (telefono/PC). */
export function Step({ n, title, icon, children, tone, done, className }: { n: number; title: ReactNode; icon?: IconName; children: ReactNode; tone?: "lime" | "red"; done?: boolean; className?: string }) {
  return (
    <Panel tone={tone} className={clsx("flex flex-col gap-3", className)}>
      <Eyebrow className="flex items-center gap-2">
        <span className={clsx("tg-num grid h-6 w-6 place-items-center rounded-md text-sm", done ? "bg-[#c6ff3d] text-[#0b0d12]" : "bg-white/12 text-white")}>{done ? <Icon name="check" className="h-4 w-4" /> : n}</span>
        {icon && <Icon name={icon} className="h-4 w-4" />}
        {title}
      </Eyebrow>
      {children}
    </Panel>
  );
}

/** Scelta di un tavolo bersaglio (telefono/PC): griglia di numeri grandi. */
export function TablePicker({
  tables,
  value,
  onChange,
  disabled,
  label,
  tone = "red",
}: {
  tables: { teamId: string; tableNo: number }[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  label: string;
  tone?: "red" | "lime";
}) {
  const accent = tone === "red" ? "border-[#ff3b4e]" : "border-[#c6ff3d]";
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label={label}>
      {tables.map((r) => (
        <button
          key={r.teamId}
          type="button"
          role="radio"
          aria-checked={value === r.teamId}
          aria-label={`Tavolo ${r.tableNo}`}
          disabled={disabled}
          onClick={() => onChange(r.teamId)}
          className={clsx("tg-num flex h-16 flex-col items-center justify-center rounded-xl border-2 text-3xl leading-none transition-transform active:scale-95", value === r.teamId ? clsx("tg-picked text-white", accent) : "border-white/12 bg-white/[0.04] text-white/80")}
        >
          {r.tableNo}
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-white/60">tavolo</span>
        </button>
      ))}
    </div>
  );
}

/** Gettone colorato di un tavolo per la TV. */
export function TvChip({ teams, id, size = 3.2 }: { teams: TvTeams; id: string; size?: number }) {
  const t = teams.find((x) => x.teamId === id);
  return (
    <span
      className="tg-num inline-grid shrink-0 place-items-center rounded-[0.6cqw] text-[#0b0d12]"
      style={{ background: t?.color ?? "#eef2f6", width: `${size}cqw`, height: `${size}cqw`, fontSize: `${size * 0.6}cqw` }}
      aria-label={`Tavolo ${t?.tableNo ?? "?"}`}
    >
      {t?.tableNo ?? "?"}
    </span>
  );
}

/** Gettone neutro di un tavolo per il telefono. */
export function PhoneChip({ tableNo, tone = "ice" }: { tableNo: number; tone?: "ice" | "red" | "lime" | "amber" }) {
  const bg = tone === "red" ? "#ff3b4e" : tone === "lime" ? "#c6ff3d" : tone === "amber" ? "#ffc24a" : "#eef2f6";
  return (
    <span className="tg-num inline-grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-1 text-xl text-[#0b0d12]" style={{ background: bg }} aria-label={`Tavolo ${tableNo}`}>
      {tableNo}
    </span>
  );
}

/** Trasferimenti APPLICATI dal runtime (dopo scudi e tetti), se l'esito li riporta. */
export function appliedTransfers(outcome: { outcomes: TeamOutcome[] } | null): { from: string; to: string; points: number; reason: string }[] {
  const out: { from: string; to: string; points: number; reason: string }[] = [];
  for (const o of outcome?.outcomes ?? []) for (const t of o.transfers ?? []) out.push({ from: o.teamId, to: t.toTeamId, points: t.points, reason: t.reason });
  return out;
}

/** Riga «A → B» per la TV, con esito a destra. */
export function TvVsRow({ teams, a, b, icon = "sword", right, delay = 0, iconClass = "text-[#ff3b4e]", joiner = "contro" }: { teams: TvTeams; a: string; b: string; icon?: IconName; right?: ReactNode; delay?: number; iconClass?: string; joiner?: string }) {
  return (
    <div className="tg-rise flex items-center gap-[0.8cqw] rounded-[0.8cqw] bg-white/[0.05] px-[0.8cqw] py-[0.45cqw]" style={{ animationDelay: `${delay}ms` }}>
      <TvChip teams={teams} id={a} size={2.6} />
      <Icon name={icon} className={clsx("h-[1.7cqw] w-[1.7cqw] shrink-0", iconClass)} />
      <span className="sr-only">{joiner}</span>
      <TvChip teams={teams} id={b} size={2.6} />
      <span className="ml-auto min-w-0 truncate text-right text-[1.3cqw] font-extrabold">{right}</span>
    </div>
  );
}

/** Forbici disegnate (tratto come le icone del kit). */
export function Scissors({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.6 7.6L20 18M8.6 16.4L20 6M13.5 12h.01" />
    </svg>
  );
}

/** Trappola a molla disegnata. */
export function TrapGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 18h18M5 18l2-6h10l2 6M7 12l-1-4M10 12l-.5-5M14 12l.5-5M17 12l1-4M12 12V6" />
    </svg>
  );
}

/** I quattro simboli della griglia incrociata (1 boccale, 2 pizza, 3 dado, 4 nota), disegnati. */
export const GRID_SYMBOLS: Record<string, { name: string; color: string }> = {
  "1": { name: "boccale", color: "#ffc24a" },
  "2": { name: "pizza", color: "#ff6b5a" },
  "3": { name: "dado", color: "#6fe7ff" },
  "4": { name: "nota", color: "#b49cff" },
};

export function GridSymbol({ v, className }: { v: string; className?: string }) {
  const s = GRID_SYMBOLS[v];
  if (!s) return null;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={s.name}>
      {v === "1" && <path d="M6 7h9v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM15 10h2.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H15M6 7c0-2 1.5-3 3-3 .8-1 2.5-1 3.3 0 1.5 0 2.7 1 2.7 3M9 11v6M12 11v6" />}
      {v === "2" && <path d="M12 21L3.5 6.5C8.5 3.5 15.5 3.5 20.5 6.5zM5.5 9.5c4-2 9-2 13 0M10 11.5h.01M14 13h.01M12 16.5h.01" />}
      {v === "3" && <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" />}
      {v === "4" && <path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM9 9l11-2" />}
    </svg>
  );
}

/** Numero con segno (+40, −30, 0). */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}
