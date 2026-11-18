"use client";

import { clsx } from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import type { ScoreOutput } from "@/lib/tig/games/contract";
import type { TvGameProps } from "../ui-contract";
import { Icon } from "../kit/icons";
import { CrewFlag, Doubloon } from "../kit/ornaments";
import { Eyebrow } from "../kit/ui";

/**
 * Pezzi comuni alle schermate della MANCHE 5 «TUTTO O NIENTE!» (solo per le meccaniche 66–80), nello stile della
 * TAVERNA DEI PIRATI: tavole di notte con il filo d'ottone, oro dei dobloni per punti e scelte, turchese per gli
 * accenti, pergamena con l'inchiostro per spiegazioni e racconti, bandiere delle ciurme per i tavoli. Unità cqw in TV.
 */

export type TvTeam = TvGameProps["teams"][number];

/** Orologio a fotogrammi (requestAnimationFrame) per le animazioni fluide; fermo se `active` è falso. */
export function useFrameClock(now: () => number, active: boolean): number {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      setT(now());
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [now, active]);
  return active ? t : now();
}

/** Secondi che mancano a un istante della prova (mai negativi). */
export function secsTo(untilMs: number, elapsed: number): number {
  return Math.max(0, Math.ceil((untilMs - elapsed) / 1000));
}

/** Punti con segno tipografico («+40», «−30», «0»). */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

/** Saldo del proprio tavolo (vista privata), con una nota sotto. */
export function BalanceCard({ balance, note }: { balance: number | null; note: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-(--tg-cream)/12 bg-(--tg-cream)/[0.04] px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon name="coins" className="h-7 w-7 shrink-0 text-(--tg-gold)" />
        <Eyebrow className="flex-1">Il vostro saldo</Eyebrow>
        <p className="tg-num text-3xl leading-none">{balance === null ? "—" : balance.toLocaleString("it-IT")}</p>
      </div>
      <p className="text-sm font-bold leading-snug text-(--tg-cream)/75">{note}</p>
    </div>
  );
}

/**
 * Targhetta di un tavolo sulla TV: bandiera della ciurma col numero e nome (che si accorcia, mai sopra ad altro).
 * `compact` per le liste lunghe (12 tavoli in colonna).
 */
export function TvTeamTag({ team, className, children, numberOnly = false, compact = false }: { team: TvTeam | undefined; className?: string; children?: ReactNode; numberOnly?: boolean; compact?: boolean }) {
  if (!team) return null;
  return (
    <span className={clsx("flex min-w-0 max-w-full items-center gap-[0.45cqw]", className)} title={team.name}>
      <CrewFlag color={team.color} n={team.tableNo} className={clsx("shrink-0", compact ? "h-[2cqw] w-[2.65cqw]" : "h-[2.5cqw] w-[3.3cqw]")} />
      {!numberOnly && <span className={clsx("min-w-0 flex-1 truncate font-extrabold", compact ? "text-[1.05cqw]" : "text-[1.15cqw]")}>{team.name}</span>}
      {children}
    </span>
  );
}

/** Solo la bandiera col numero del tavolo (liste fitte sulla TV). */
export function TvTableBadge({ team, className }: { team: TvTeam | undefined; className?: string }) {
  if (!team) return null;
  return (
    <span className={clsx("inline-flex shrink-0", className)} role="img" aria-label={`Tavolo ${team.tableNo}`}>
      <CrewFlag color={team.color} n={team.tableNo} className="h-[2.5cqw] w-[3.3cqw]" />
    </span>
  );
}

/** Mappa id → tavolo per la TV. */
export function teamMap(teams: readonly TvTeam[]): Map<string, TvTeam> {
  return new Map(teams.map((t) => [t.teamId, t]));
}

/** Esiti della prova in una griglia compatta per la TV (fino a 24 tavoli), nell'ordine dato. */
export function TvOutcomeGrid({
  teams,
  outcome,
  order,
  note,
  stagger = 60,
  cols,
}: {
  teams: readonly TvTeam[];
  outcome: ScoreOutput | null;
  /** ordine dei tavoli (id); predefinito: quello della TV */
  order?: string[];
  /** riga piccola sotto il nome (scelta, carta, difesa…) */
  note?: (teamId: string) => ReactNode;
  stagger?: number;
  /** colonne (predefinito: 2 fino a 6 tavoli, poi 3); nei pannelli stretti meglio 2 */
  cols?: 1 | 2 | 3 | 4;
}) {
  const by = new Map((outcome?.outcomes ?? []).map((o) => [o.teamId, o]));
  const map = teamMap(teams);
  const ids = order ?? teams.map((t) => t.teamId);
  const n = cols ?? (ids.length > 8 ? 4 : ids.length > 4 ? 3 : 2);
  const colCls = n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : n === 3 ? "grid-cols-3" : "grid-cols-4";
  return (
    <div className={clsx("grid content-start gap-[0.6cqw]", colCls)}>
      {ids.map((id, i) => {
        const t = map.get(id);
        const o = by.get(id);
        if (!t) return null;
        const pts = o?.points ?? 0;
        return (
          <div key={id} className="tg-rise flex min-w-0 items-center gap-[0.7cqw] rounded-[0.8cqw] border border-(--tg-cream)/10 bg-(--tg-cream)/[0.05] px-[0.7cqw] py-[0.45cqw]" style={{ animationDelay: `${i * stagger}ms` }}>
            <div className="min-w-0 flex-1">
              <TvTeamTag team={t} />
              {note && <div className="mt-[0.15cqw] truncate text-[0.95cqw] font-bold text-(--tg-cream)/65">{note(id)}</div>}
            </div>
            <span className={clsx("tg-num shrink-0 text-[1.9cqw] leading-none", pts > 0 ? "text-(--tg-gold)" : pts < 0 ? "text-(--tg-red-hi)" : "text-(--tg-cream)/50")}>{signed(pts)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Tavoli della TV senza lo stato «inviato» (prove in cui nessuno deve sapere se l'altro ha finito). */
export function silentTeams(teams: readonly TvTeam[]): TvTeam[] {
  return teams.map((t) => ({ ...t, submitted: false }));
}

/** Grande cifra/etichetta di attesa al centro della TV (finestre di scelta, conti alla rovescia). */
export function TvBigWait({ icon, kicker, title, sub, tone = "lime" }: { icon: Parameters<typeof Icon>[0]["name"]; kicker: string; title: ReactNode; sub?: ReactNode; tone?: "lime" | "red" | "amber" }) {
  const c = tone === "red" ? "text-(--tg-red-hi)" : tone === "amber" ? "text-(--tg-teal-hi)" : "text-(--tg-gold)";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1.2cqw] text-center">
      <Icon name={icon} className={clsx("h-[7cqw] w-[7cqw]", c)} />
      <p className="text-[1.3cqw] font-extrabold uppercase tracking-[0.3em] text-(--tg-cream)/65">{kicker}</p>
      <div className="tg-display tg-pop text-[6cqw] leading-none">{title}</div>
      {sub && <div className={clsx("tg-num text-[2.6cqw]", c)}>{sub}</div>}
    </div>
  );
}

/**
 * Scala «dal fondo alla vetta» per la TV: una riga per tavolo, il migliore in alto; le righe compaiono dal basso
 * verso l'alto (l'ultimo in classifica per primo, il migliore per ultimo).
 */
export function TvLadder({ teams, rows, stepMs = 320 }: { teams: readonly TvTeam[]; rows: { teamId: string; points: number; note?: ReactNode }[]; stepMs?: number }) {
  const map = teamMap(teams);
  const sorted = rows.slice().sort((a, b) => b.points - a.points || (map.get(a.teamId)?.tableNo ?? 0) - (map.get(b.teamId)?.tableNo ?? 0));
  const n = sorted.length;
  const dense = n > 8;
  return (
    <ol className={clsx("flex flex-col", dense ? "gap-[0.25cqw]" : "gap-[0.5cqw]")}>
      {sorted.map((r, i) => {
        const t = map.get(r.teamId);
        if (!t) return null;
        return (
          <li
            key={r.teamId}
            className={clsx("tg-rise flex min-w-0 items-center gap-[0.8cqw] rounded-[0.8cqw] border border-(--tg-cream)/10 bg-(--tg-cream)/[0.05] px-[0.8cqw]", dense ? "py-[0.2cqw]" : "py-[0.5cqw]", i === 0 && "border-(--tg-gold)/60 bg-(--tg-gold)/10")}
            style={{ animationDelay: `${(n - 1 - i) * stepMs}ms` }}
          >
            <span className={clsx("tg-num w-[2cqw] shrink-0 text-center text-(--tg-cream)/55", dense ? "text-[1.2cqw]" : "text-[1.4cqw]")}>{i + 1}</span>
            <TvTeamTag team={t} compact={dense} className="min-w-0 flex-1" />
            {r.note && <span className="shrink-0 text-[1.05cqw] font-bold text-(--tg-cream)/70">{r.note}</span>}
            <span className={clsx("tg-num w-[5cqw] shrink-0 text-right leading-none", dense ? "text-[1.6cqw]" : "text-[1.8cqw]", r.points > 0 ? "text-(--tg-gold)" : r.points < 0 ? "text-(--tg-red-hi)" : "text-(--tg-cream)/50")}>{signed(r.points)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Domanda chiusa in forma compatta per i reveal affollati: testo e solo la risposta giusta. */
export function TvSolved({ kicker, prompt, answer, className }: { kicker: ReactNode; prompt: string; answer: string; className?: string }) {
  return (
    <div className={clsx("tg-glass tg-rise flex min-h-0 flex-col gap-[0.5cqw] rounded-[1.4cqw] p-[1.1cqw]", className)}>
      <p className="text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-teal-hi)">{kicker}</p>
      <p className="line-clamp-3 text-[1.6cqw] font-extrabold leading-tight">{prompt}</p>
      <p className="tg-shine mt-auto flex items-center gap-[0.6cqw] rounded-[0.8cqw] bg-(--tg-gold) px-[0.9cqw] py-[0.5cqw] text-[1.6cqw] font-extrabold leading-tight text-(--tg-ink)">
        <Icon name="check" className="h-[1.8cqw] w-[1.8cqw] shrink-0" />
        <span className="min-w-0">{answer}</span>
      </p>
    </div>
  );
}

/** «Perché» della TV su pergamena, compatto per le righe di riepilogo (stesso materiale di TvExplain del kit). */
export function TvWhy({ text, className, size = "md" }: { text: string; className?: string; size?: "sm" | "md" }) {
  return (
    <div className={clsx("tg-parch tg-rise shrink-0", size === "sm" ? "px-[1.3cqw] py-[0.8cqw]" : "p-[1.4cqw]", className)}>
      <p className={clsx("font-semibold leading-snug", size === "sm" ? "text-[1.25cqw]" : "text-[1.45cqw]")}>
        <span className="mr-[0.6cqw] text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-burnt-ink)">Perché</span>
        {text}
      </p>
    </div>
  );
}

/** Racconto o regola della prova su pergamena (telefono). */
export function ParchNote({ kicker, children, className }: { kicker?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("tg-parch px-4 py-3", className)}>
      {kicker && <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-(--tg-burnt-ink)">{kicker}</p>}
      <div className="text-[15px] font-semibold leading-snug">{children}</div>
    </section>
  );
}

/** Prezzo o posta in punti come doblone d'oro (telefono e TV). */
export function CoinTag({ children, className }: { children: ReactNode; className?: string }) {
  return <Doubloon className={clsx("font-black", className)}>{children}</Doubloon>;
}

export interface ToggleOption<T extends string> {
  id: T;
  title: string;
  sub?: ReactNode;
  tone?: "gold" | "red" | "teal";
  icon?: Parameters<typeof Icon>[0]["name"];
}

/**
 * Scelta grande a due o tre caselle per il telefono (prudenza/rischio, sicuro/rischio, ora/dopo, posta): titolo in
 * Grenze ma più contenuto della BigToggle del kit, così le parole lunghe (PRUDENZA) restano dentro la casella.
 */
export function M5Toggle<T extends string>({ options, value, onChange, disabled = false, label }: { options: ToggleOption<T>[]; value: T | null; onChange: (v: T) => void; disabled?: boolean; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx("grid gap-2", options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {options.map((o) => {
        const on = value === o.id;
        const accent = o.tone === "red" ? "var(--tg-red-hi)" : o.tone === "teal" ? "var(--tg-teal-hi)" : "var(--tg-gold)";
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={clsx(
              "relative flex min-h-24 flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-transform active:scale-[0.98] disabled:cursor-default",
              on ? "tg-picked bg-(--tg-night-2)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]",
            )}
            style={on ? { borderColor: accent } : undefined}
          >
            <span className="flex w-full items-center gap-2">
              {o.icon && <Icon name={o.icon} className="h-6 w-6 shrink-0" />}
              <span className={clsx("tg-display min-w-0 leading-none", o.title.length > 7 ? "text-[1.35rem]" : "text-2xl")} style={on ? { color: accent } : undefined}>
                {o.title}
              </span>
            </span>
            {o.sub && <span className="text-sm font-bold leading-snug text-(--tg-cream)/85">{o.sub}</span>}
            {on && <Icon name="check" className="absolute bottom-2 right-2 h-5 w-5" />}
            <span className="sr-only">{on ? " · selezionato" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}
