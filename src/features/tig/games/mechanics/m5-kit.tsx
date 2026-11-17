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
    <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3">
      <Icon name="coins" className="h-8 w-8 shrink-0 text-[#ffc24a]" />
      <div className="min-w-0 flex-1">
        <Eyebrow>Il vostro saldo</Eyebrow>
        <p className="tg-num text-3xl leading-none">{balance === null ? "—" : balance.toLocaleString("it-IT")}</p>
      </div>
      <p className="max-w-[55%] text-right text-xs font-bold leading-snug text-white/70">{note}</p>
    </div>
  );
}

/** Targhetta di un tavolo sulla TV (numero nel colore del tavolo + nome). */
export function TvTeamTag({ team, className, children }: { team: TvTeam | undefined; className?: string; children?: ReactNode }) {
  if (!team) return null;
  return (
    <span className={clsx("inline-flex min-w-0 items-center gap-[0.5cqw]", className)}>
      <span className="tg-num grid h-[2.4cqw] w-[2.4cqw] shrink-0 place-items-center rounded-[0.5cqw] text-[1.35cqw] text-[#0b0d12]" style={{ background: team.color }}>
        {team.tableNo}
      </span>
      <span className="min-w-0 truncate text-[1.15cqw] font-extrabold">{team.name}</span>
      {children}
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
}: {
  teams: readonly TvTeam[];
  outcome: ScoreOutput | null;
  /** ordine dei tavoli (id); predefinito: quello della TV */
  order?: string[];
  /** riga piccola sotto il nome (scelta, carta, difesa…) */
  note?: (teamId: string) => ReactNode;
  stagger?: number;
}) {
  const by = new Map((outcome?.outcomes ?? []).map((o) => [o.teamId, o]));
  const map = teamMap(teams);
  const ids = order ?? teams.map((t) => t.teamId);
  const cols = ids.length > 12 ? "grid-cols-4" : ids.length > 6 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={clsx("grid content-start gap-[0.6cqw]", cols)}>
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
