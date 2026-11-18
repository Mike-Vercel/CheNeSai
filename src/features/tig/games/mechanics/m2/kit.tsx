"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { TeamOutcome } from "@/lib/tig/games/contract";
import type { TvGameProps } from "../../ui-contract";
import { Icon, type IconName } from "../../kit/icons";
import { CrewFlag } from "../../kit/ornaments";
import { Eyebrow, Panel } from "../../kit/ui";

/**
 * Pezzi d'interfaccia comuni alle meccaniche della MANCHE 2 «FREGALI TUTTI!» (bersagli, passi numerati,
 * bandiere delle ciurme in TV, trasferimenti applicati). Stessi token, caratteri e ornamenti del kit di
 * TAVERNA DEI PIRATI.
 */

export type TvTeams = TvGameProps["teams"];

/** TV «stretta»: con più di 6 tavoli la striscia delle ciurme va su due righe e il corpo si abbassa. */
export function tvCompact(teams: TvTeams): boolean {
  return teams.length > 6;
}

/** Passo numerato di una scelta in più tempi (telefono/PC). */
export function Step({ n, title, icon, children, tone, done, className }: { n: number; title: ReactNode; icon?: IconName; children: ReactNode; tone?: "lime" | "red"; done?: boolean; className?: string }) {
  return (
    <Panel tone={tone} className={clsx("flex flex-col gap-3", className)}>
      <Eyebrow className="flex items-center gap-2">
        <span className={clsx("tg-num grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm", done ? "tg-coin" : "border border-(--tg-brass)/55 bg-(--tg-night-2) text-(--tg-cream)")}>{done ? <Icon name="check" className="h-3.5 w-3.5" /> : n}</span>
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
  const accent = tone === "red" ? "border-(--tg-red-hi)" : "border-(--tg-gold)";
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
          className={clsx("tg-num flex h-16 flex-col items-center justify-center rounded-xl border-2 text-3xl leading-none transition-transform active:scale-95", value === r.teamId ? clsx("tg-picked text-(--tg-cream)", accent) : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04] text-(--tg-cream)/80")}
        >
          {r.tableNo}
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-(--tg-cream)/60">tavolo</span>
        </button>
      ))}
    </div>
  );
}

/** Bandiera della ciurma (colore del tavolo, numero inciso) per la TV, alta `size` cqw. */
export function TvChip({ teams, id, size = 3.2 }: { teams: TvTeams; id: string; size?: number }) {
  const t = teams.find((x) => x.teamId === id);
  return (
    <span className="inline-block shrink-0" role="img" aria-label={`Tavolo ${t?.tableNo ?? "?"}`} style={{ width: `${(size * 4) / 3}cqw`, height: `${size}cqw` }}>
      <CrewFlag color={t?.color ?? "#f6ead2"} n={t?.tableNo ?? "?"} className="h-full w-full drop-shadow-[0_0.15cqw_0.2cqw_rgba(0,0,0,.55)]" />
    </span>
  );
}

/** Targhetta di un tavolo per il telefono (oro = noi/capolista/vincitori, rosso = bersaglio, crema = altri). */
export function PhoneChip({ tableNo, tone = "ice" }: { tableNo: number; tone?: "ice" | "red" | "lime" | "amber" }) {
  const bg = tone === "red" ? "var(--tg-red-hi)" : tone === "lime" ? "var(--tg-gold)" : tone === "amber" ? "var(--tg-gold-hi)" : "var(--tg-cream)";
  return (
    <span className="tg-num inline-grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-1 text-xl text-(--tg-ink) shadow-[inset_0_-2px_0_rgba(27,20,16,.28),inset_0_1px_0_rgba(255,255,255,.45)]" style={{ background: bg }} aria-label={`Tavolo ${tableNo}`}>
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
export function TvVsRow({
  teams,
  a,
  b,
  icon = "sword",
  right,
  delay = 0,
  iconClass = "text-(--tg-red-hi)",
  joiner = "contro",
  compact = false,
}: {
  teams: TvTeams;
  a: string;
  b: string;
  icon?: IconName;
  right?: ReactNode;
  delay?: number;
  iconClass?: string;
  joiner?: string;
  /** righe strette (due colonne, fino a 12 tavoli) */
  compact?: boolean;
}) {
  return (
    <div className={clsx("tg-rise flex items-center rounded-[0.8cqw] bg-(--tg-cream)/[0.06]", compact ? "gap-[0.4cqw] px-[0.5cqw] py-[0.3cqw]" : "gap-[0.8cqw] px-[0.8cqw] py-[0.45cqw]")} style={{ animationDelay: `${delay}ms` }}>
      <TvChip teams={teams} id={a} size={compact ? 2.3 : 2.7} />
      <Icon name={icon} className={clsx("shrink-0", compact ? "h-[1.3cqw] w-[1.3cqw]" : "h-[1.7cqw] w-[1.7cqw]", iconClass)} />
      <span className="sr-only">{joiner}</span>
      <TvChip teams={teams} id={b} size={compact ? 2.3 : 2.7} />
      <span className={clsx("ml-auto min-w-0 truncate text-right font-extrabold", compact ? "text-[1.05cqw]" : "text-[1.3cqw]")}>{right}</span>
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

/** Tagliola disegnata: due ganasce dentate aperte sulla piastra, con la catena. */
export function TrapGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 12a8.5 8.5 0 0 1 17 0" />
      <path d="M3.5 12L5.6 9.6 7.4 12l1.9-2.6L11 12l1-2.7 1 2.7 1.7-2.6 1.9 2.6 1.8-2.4L20.5 12" />
      <path d="M2.5 15.5h19M8 15.5v-3.5M16 15.5v-3.5M12 15.5v3M10.5 20.5a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

/** I quattro simboli della griglia incrociata (1 boccale, 2 pizza, 3 dado, 4 nota), disegnati. */
export const GRID_SYMBOLS: Record<string, { name: string; color: string }> = {
  "1": { name: "boccale", color: "var(--tg-gold-hi)" },
  "2": { name: "pizza", color: "#ff6b5a" },
  "3": { name: "dado", color: "var(--tg-sky)" },
  "4": { name: "nota", color: "var(--tg-violet)" },
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

/** Spiegazione al reveal sulla TV: foglio di pergamena (come il kit), più compatto con 12 tavoli. */
export function TvWhy({ text, compact = false, className }: { text: string; compact?: boolean; className?: string }) {
  return (
    <div className={clsx("tg-parch tg-rise min-h-0 shrink-0 overflow-hidden", compact ? "px-[1.2cqw] py-[0.9cqw]" : "p-[1.5cqw]", className)}>
      <p className="mb-[0.3cqw] text-[0.95cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-burnt-ink)">Perché</p>
      <p className={clsx("font-semibold leading-snug", compact ? "text-[1.3cqw]" : "text-[1.5cqw]")}>{text}</p>
    </div>
  );
}

/**
 * Risposte compatte per le schede strette della TV (tre colonne affiancate, fino a 12 tavoli): stesso aspetto
 * delle opzioni del kit (oro = giusta, le altre spente) ma righe più basse, e il testo va a capo invece di uscire.
 * Colonne automatiche: 3 per risposte brevissime, 2 per brevi, 1 per frasi.
 */
export function TvAnswers({ options, solutionId = null, compact = false, cols, className }: { options: ReadonlyArray<{ id: string; text: string }>; solutionId?: string | null; compact?: boolean; cols?: 1 | 2 | 3 | 4; className?: string }) {
  const longest = Math.max(0, ...options.map((o) => o.text.length));
  const n = cols ?? (options.length <= 3 && longest <= 3 ? 3 : longest <= 8 ? 2 : 1);
  return (
    <div className={clsx("grid gap-[0.35cqw]", n === 4 ? "grid-cols-4" : n === 3 ? "grid-cols-3" : n === 2 ? "grid-cols-2" : "grid-cols-1", className)}>
      {options.map((o, i) => {
        const state = solutionId ? (o.id === solutionId ? "right" : "dim") : "idle";
        return (
          <div
            key={o.id}
            className={clsx(
              "flex items-center gap-[0.55cqw] rounded-[0.9cqw] border-[0.15cqw] px-[0.6cqw] py-[0.3cqw] transition-all duration-500",
              state === "right" ? "tg-shine border-(--tg-gold-hi) bg-(--tg-gold) text-(--tg-ink) shadow-[0_0_2cqw_-0.6cqw_rgba(242,177,52,.85)]" : state === "dim" ? "border-(--tg-cream)/8 bg-(--tg-cream)/[0.03] opacity-45" : "border-(--tg-cream)/14 bg-(--tg-night-2)/70",
            )}
          >
            <span className={clsx("tg-num grid shrink-0 place-items-center rounded-full leading-none", compact ? "h-[1.7cqw] w-[1.7cqw] text-[1.05cqw]" : "h-[1.9cqw] w-[1.9cqw] text-[1.15cqw]", state === "right" ? "bg-(--tg-ink) text-(--tg-gold-hi)" : "border-[0.12cqw] border-(--tg-brass)/55 bg-(--tg-night)")}>{i + 1}</span>
            <span className={clsx("min-w-0 flex-1 break-words font-extrabold leading-tight", compact ? "text-[1.3cqw]" : "text-[1.45cqw]")}>{o.text}</span>
            {state === "right" && <Icon name="check" className={clsx("shrink-0", compact ? "h-[1.4cqw] w-[1.4cqw]" : "h-[1.6cqw] w-[1.6cqw]")} />}
          </div>
        );
      })}
    </div>
  );
}

/** Domanda lunga in TV: corpo più piccolo, per lasciare posto a risposte e «Perché» senza tagli. */
export function tvLongPrompt(text: string): boolean {
  return text.length > 100;
}

/** Corpo della domanda principale in TV, in base alla lunghezza e alla TV stretta (12 tavoli). */
export function tvPromptSize(text: string, compact: boolean): string {
  const n = text.length;
  if (compact) return n > 150 ? "text-[1.55cqw]" : n > 100 ? "text-[1.75cqw]" : "text-[1.95cqw]";
  return n > 150 ? "text-[1.8cqw]" : n > 100 ? "text-[2.05cqw]" : "text-[2.3cqw]";
}

/** Etichetta maiuscola dei pannelli TV (icona facoltativa). */
export function TvLabel({ children, className, icon }: { children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <p className={clsx("flex shrink-0 items-center gap-[0.6cqw] text-[1.1cqw] font-extrabold uppercase tracking-[0.2em]", className)}>
      {icon}
      {children}
    </p>
  );
}

/** Numero con segno (+40, −30, 0). */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}
