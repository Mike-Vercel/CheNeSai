"use client";

import { clsx } from "clsx";
import { Badge } from "@/components/ui";
import type { AdminLiveState } from "@/lib/server/admin-live";
import { delayLabel, formatClock, formatMinutes, type LiveRoundTiming, type LiveTiming } from "@/lib/show/running-order";

const TONE_CLASS = { ok: "text-[#5dffab]", late: "text-[#ff8098]", early: "text-[#8cc4ff]" } as const;

export function clockTime(ms: number | null): string {
  if (ms === null) return "-";
  return new Date(ms).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
}

function signedClock(ms: number): string {
  return `${ms > 0 ? "+" : ms < 0 ? "−" : ""}${formatClock(Math.abs(ms))}`;
}

/** Badge compatto per l'intestazione della regia: "In ritardo di 7 min · fine 22:47". */
export function TimingBadge({ timing }: { timing: LiveTiming }) {
  if (timing.phase === "not_started") return null;
  const d = delayLabel(timing.delayMs);
  if (timing.phase === "finished") {
    return (
      <Badge color="gray" className="px-3 py-1 text-sm">
        ⏱ Durata {formatClock(timing.elapsedMs)}
      </Badge>
    );
  }
  return (
    <Badge color={d.tone === "late" ? "red" : d.tone === "early" ? "blue" : "green"} className="px-3 py-1 text-sm">
      ⏱ {d.text} · fine {clockTime(timing.projectedEndAt)}
    </Badge>
  );
}

function RoundRow({ r, index }: { r: LiveRoundTiming; index: number }) {
  const ratio = r.actualMs !== null && r.plannedMs > 0 ? r.actualMs / r.plannedMs : 0;
  const active = r.status === "running" || r.status === "after";
  return (
    <li className={clsx("rounded-xl p-2", active ? "bg-gold/15 ring-1 ring-gold" : "bg-white/5", r.status === "pending" && "opacity-70")}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate font-bold">
          {index + 1}. {r.title}
        </p>
        <p className="shrink-0 tabular-nums text-white/80">
          {r.actualMs !== null ? formatClock(r.actualMs) : "-"} <span className="text-white/45">/ {formatMinutes(Math.round(r.plannedMs / 60_000))}</span>
        </p>
      </div>
      {r.status !== "pending" && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={clsx("h-full", ratio > 1 ? "bg-flame" : r.status === "done" ? "bg-lime" : "bg-cyan")} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {r.status === "running" && <span className="font-bold text-cyan">in corso</span>}
        {r.status === "after" && <span className="font-bold text-gold">domande finite · classifica/intervallo</span>}
        {r.status === "done" && <span className="text-white/50">concluso</span>}
        {r.status === "pending" && <span className="text-white/50">da giocare</span>}
        {r.deltaMs !== null && Math.abs(r.deltaMs) >= 30_000 && (
          <span className={clsx("font-bold tabular-nums", r.deltaMs > 0 ? "text-[#ff8098]" : "text-[#8cc4ff]")}>{signedClock(r.deltaMs)}</span>
        )}
        {(r.breakPlannedMs > 0 || (r.breakActualMs !== null && r.breakActualMs >= 60_000)) && (
          <span className="text-white/60">
            ☕ intervallo {r.breakActualMs !== null ? formatClock(r.breakActualMs) : "-"}
            {r.breakPlannedMs > 0 && <span className="text-white/40"> / {formatMinutes(Math.round(r.breakPlannedMs / 60_000))}</span>}
          </span>
        )}
      </div>
    </li>
  );
}

/** Tempi della serata in regia (sola lettura): effettivo contro scaletta, ritardo e fine prevista. */
export function TimingPanel({ live, timing }: { live: AdminLiveState; timing: LiveTiming }) {
  const plan = live.timing.plan;
  const d = delayLabel(timing.delayMs);
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1d0c30] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg">Tempi della serata</h2>
        <span className="text-xs text-white/50">
          scaletta {formatMinutes(plan.totalMinutes)} · obiettivo {formatMinutes(plan.targetMinutes)}
        </span>
      </div>

      {timing.phase === "not_started" ? (
        <p className="text-sm text-white/70">
          Non ancora iniziata: il cronometro parte con l&apos;intro (o il primo round).
          {timing.plannedEndAt !== null && (
            <>
              {" "}
              In programma alle {clockTime(live.timing.input.scheduledAt)}, fine prevista alle <strong>{clockTime(timing.plannedEndAt)}</strong>.
            </>
          )}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/5 p-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">{timing.phase === "finished" ? "Durata" : "In onda da"}</p>
            <p className="font-display text-2xl tabular-nums">{formatClock(timing.elapsedMs)}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">{timing.phase === "finished" ? "Rispetto al piano" : "Scaletta"}</p>
            <p className={clsx("font-display text-lg leading-tight", TONE_CLASS[d.tone])}>
              {timing.phase === "finished" ? (d.tone === "ok" ? "In orario" : d.tone === "late" ? `+${formatMinutes(Math.round(timing.delayMs / 60_000))}` : `−${formatMinutes(Math.round(-timing.delayMs / 60_000))}`) : d.text}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">{timing.phase === "finished" ? "Finita alle" : "Fine prevista"}</p>
            <p className="font-display text-2xl tabular-nums">{clockTime(timing.projectedEndAt)}</p>
            <p className="text-[11px] text-white/45">piano {clockTime(timing.plannedEndAt)}</p>
          </div>
        </div>
      )}

      <ol className="mt-3 flex flex-col gap-1.5 text-sm">
        {timing.rounds.map((r, i) => (
          <RoundRow key={r.id} r={r} index={i} />
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-white/45">
        Dai tempi registrati (inizio round, ultima domanda conclusa). Le pause contano come tempo della serata. I minuti si pianificano nell&apos;editor della serata.
      </p>
    </div>
  );
}
