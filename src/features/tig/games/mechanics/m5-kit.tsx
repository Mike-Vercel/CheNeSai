"use client";

import { clsx } from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import type { ScoreOutput } from "@/lib/tig/games/contract";
import type { TvGameProps } from "../ui-contract";
import { Icon } from "../kit/icons";
import { Eyebrow } from "../kit/ui";

/**
 * Pezzi comuni alle schermate della MANCHE 5 «TUTTO O NIENTE!» (solo per le meccaniche 66–80).
 * Stesso linguaggio del kit: vetro scuro, lime/rosso/ambra, numeri in Big Shoulders, unità cqw sulla TV.
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

/** Riga di avviso a tempo (finestra di scelta, colpo in arrivo…), sul telefono. */
export function TimedBanner({ icon, children, tone = "lime" }: { icon: Parameters<typeof Icon>[0]["name"]; children: ReactNode; tone?: "lime" | "red" | "amber" }) {
  const c = tone === "red" ? "border-[#ff3b4e]/60 bg-[#ff3b4e]/10 text-[#ff8c97]" : tone === "amber" ? "border-[#ffc24a]/60 bg-[#ffc24a]/10 text-[#ffd68a]" : "border-[#c6ff3d]/60 bg-[#c6ff3d]/10 text-[#c6ff3d]";
  return (
    <div role="status" aria-live="polite" className={clsx("flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide", c)}>
      <Icon name={icon} className="h-5 w-5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Saldo del proprio tavolo (vista privata), con una nota sotto. */
export function BalanceCard({ balance, note }: { balance: number | null; note: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon name="coins" className="h-7 w-7 shrink-0 text-[#ffc24a]" />
        <Eyebrow className="flex-1">Il vostro saldo</Eyebrow>
        <p className="tg-num text-3xl leading-none">{balance === null ? "—" : balance.toLocaleString("it-IT")}</p>
      </div>
      <p className="text-sm font-bold leading-snug text-white/75">{note}</p>
    </div>
  );
}

/** Targhetta di un tavolo sulla TV (numero nel colore del tavolo + nome): il nome si accorcia, mai sopra ad altro. */
export function TvTeamTag({ team, className, children, numberOnly = false }: { team: TvTeam | undefined; className?: string; children?: ReactNode; numberOnly?: boolean }) {
  if (!team) return null;
  return (
    <span className={clsx("flex min-w-0 max-w-full items-center gap-[0.5cqw]", className)} title={team.name}>
      <span className="tg-num grid h-[2.4cqw] w-[2.4cqw] shrink-0 place-items-center rounded-[0.5cqw] text-[1.35cqw] text-[#0b0d12]" style={{ background: team.color }}>
        {team.tableNo}
      </span>
      {!numberOnly && <span className="min-w-0 flex-1 truncate text-[1.15cqw] font-extrabold">{team.name}</span>}
      {children}
    </span>
  );
}

/** Solo il numero del tavolo nel suo colore (liste fitte sulla TV). */
export function TvTableBadge({ team, className }: { team: TvTeam | undefined; className?: string }) {
  if (!team) return null;
  return (
    <span className={clsx("tg-num grid h-[2.4cqw] min-w-[2.4cqw] shrink-0 place-items-center rounded-[0.5cqw] px-[0.3cqw] text-[1.35cqw] text-[#0b0d12]", className)} style={{ background: team.color }} aria-label={`Tavolo ${team.tableNo}`}>
      {team.tableNo}
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
  const n = cols ?? (ids.length > 12 ? 4 : ids.length > 6 ? 3 : 2);
  const colCls = n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : n === 3 ? "grid-cols-3" : "grid-cols-4";
  return (
    <div className={clsx("grid content-start gap-[0.6cqw]", colCls)}>
      {ids.map((id, i) => {
        const t = map.get(id);
        const o = by.get(id);
        if (!t) return null;
        const pts = o?.points ?? 0;
        return (
          <div key={id} className="tg-rise flex min-w-0 items-center gap-[0.7cqw] rounded-[0.8cqw] border border-white/10 bg-white/[0.05] px-[0.7cqw] py-[0.45cqw]" style={{ animationDelay: `${i * stagger}ms` }}>
            <div className="min-w-0 flex-1">
              <TvTeamTag team={t} />
              {note && <div className="mt-[0.15cqw] truncate text-[0.95cqw] font-bold text-white/65">{note(id)}</div>}
            </div>
            <span className={clsx("tg-num shrink-0 text-[1.9cqw] leading-none", pts > 0 ? "text-[#c6ff3d]" : pts < 0 ? "text-[#ff3b4e]" : "text-white/50")}>{signed(pts)}</span>
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
  const c = tone === "red" ? "text-[#ff3b4e]" : tone === "amber" ? "text-[#ffc24a]" : "text-[#c6ff3d]";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1.2cqw] text-center">
      <Icon name={icon} className={clsx("h-[7cqw] w-[7cqw]", c)} />
      <p className="text-[1.3cqw] font-extrabold uppercase tracking-[0.3em] text-white/65">{kicker}</p>
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
    <ol className={clsx("flex flex-col", dense ? "gap-[0.3cqw]" : "gap-[0.5cqw]")}>
      {sorted.map((r, i) => {
        const t = map.get(r.teamId);
        if (!t) return null;
        return (
          <li
            key={r.teamId}
            className={clsx("tg-rise flex min-w-0 items-center gap-[0.8cqw] rounded-[0.8cqw] border border-white/10 bg-white/[0.05] px-[0.8cqw]", dense ? "py-[0.25cqw]" : "py-[0.5cqw]", i === 0 && "border-[#c6ff3d]/60 bg-[#c6ff3d]/10")}
            style={{ animationDelay: `${(n - 1 - i) * stepMs}ms` }}
          >
            <span className="tg-num w-[2cqw] shrink-0 text-center text-[1.4cqw] text-white/55">{i + 1}</span>
            <TvTeamTag team={t} className="min-w-0 flex-1" />
            {r.note && <span className="shrink-0 text-[1.05cqw] font-bold text-white/70">{r.note}</span>}
            <span className={clsx("tg-num w-[5cqw] shrink-0 text-right text-[1.8cqw] leading-none", r.points > 0 ? "text-[#c6ff3d]" : r.points < 0 ? "text-[#ff3b4e]" : "text-white/50")}>{signed(r.points)}</span>
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
      <p className="text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-[#ffc24a]">{kicker}</p>
      <p className="line-clamp-3 text-[1.6cqw] font-extrabold leading-tight">{prompt}</p>
      <p className="tg-shine mt-auto flex items-center gap-[0.6cqw] rounded-[0.8cqw] bg-[#c6ff3d] px-[0.9cqw] py-[0.5cqw] text-[1.6cqw] font-extrabold leading-tight text-[#0b0d12]">
        <Icon name="check" className="h-[1.8cqw] w-[1.8cqw] shrink-0" />
        <span className="min-w-0">{answer}</span>
      </p>
    </div>
  );
}
