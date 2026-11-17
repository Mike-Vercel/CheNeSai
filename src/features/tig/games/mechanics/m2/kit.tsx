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

/** Numero con segno (+40, −30, 0). */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}
