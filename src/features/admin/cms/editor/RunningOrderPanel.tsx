"use client";

import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { Button, Input, Panel, useToast } from "@/components/ui";
import { ESTIMATE, formatMinutes, planFromRounds, planSegments, type PlanSegment, type ResolvedPlan } from "@/lib/show/running-order";
import type { RunningOrder } from "@/lib/validation/schemas";
import { errorMessage, send } from "../api";
import type { RoundDetail } from "../types";

interface Draft {
  target: string;
  intro: string;
  outro: string;
  rounds: Record<string, { minutes: string; breakAfter: string }>;
}

const str = (v: number | undefined) => (v === undefined ? "" : String(v));

function draftFrom(ro: RunningOrder | undefined, rounds: RoundDetail[]): Draft {
  const out: Draft = { target: str(ro?.targetMinutes), intro: str(ro?.introMinutes), outro: str(ro?.outroMinutes), rounds: {} };
  for (const r of rounds) {
    const o = ro?.rounds?.[r.id];
    out.rounds[r.id] = { minutes: str(o?.minutes), breakAfter: str(o?.breakAfterMinutes) };
  }
  return out;
}

/** Numero intero nel range, altrimenti undefined (campo vuoto = valore predefinito/stima). */
function int(v: string, min: number, max: number): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

function runningOrderFrom(d: Draft, rounds: RoundDetail[]): RunningOrder {
  const ro: RunningOrder = {};
  const target = int(d.target, 10, 600);
  const intro = int(d.intro, 0, 120);
  const outro = int(d.outro, 0, 120);
  if (target !== undefined) ro.targetMinutes = target;
  if (intro !== undefined) ro.introMinutes = intro;
  if (outro !== undefined) ro.outroMinutes = outro;
  const rs: NonNullable<RunningOrder["rounds"]> = {};
  rounds.forEach((r, i) => {
    const x = d.rounds[r.id];
    if (!x) return;
    const minutes = int(x.minutes, 1, 240);
    const breakAfter = i < rounds.length - 1 ? int(x.breakAfter, 0, 120) : undefined;
    const entry: { minutes?: number; breakAfterMinutes?: number } = {};
    if (minutes !== undefined) entry.minutes = minutes;
    if (breakAfter) entry.breakAfterMinutes = breakAfter;
    if (Object.keys(entry).length > 0) rs[r.id] = entry;
  });
  if (Object.keys(rs).length > 0) ro.rounds = rs;
  return ro;
}

const ROUND_COLORS = ["bg-gold text-ink", "bg-electric text-white", "bg-fuchsia text-white", "bg-cyan text-ink", "bg-lime text-ink"];

function segmentStyle(s: PlanSegment): string {
  if (s.kind === "round") return ROUND_COLORS[s.index % ROUND_COLORS.length];
  if (s.kind === "break") return "qz-break-stripes text-white";
  return "bg-violet text-white";
}

function segmentLabel(s: PlanSegment, plan: ResolvedPlan): string {
  if (s.kind === "intro") return "Apertura";
  if (s.kind === "outro") return "Finale";
  if (s.kind === "break") return "Intervallo";
  return plan.rounds[s.index]?.title ?? "Round";
}

function clockAt(base: string | null, minutes: number): string | null {
  if (!base) return null;
  const t = Date.parse(base) + minutes * 60_000;
  return new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
}

/** Barra della scaletta: segmenti proporzionali ai minuti, con la linea della durata prevista. */
export function RunningOrderTimeline({ plan, className }: { plan: ResolvedPlan; className?: string }) {
  const segments = planSegments(plan);
  const scale = Math.max(plan.totalMinutes, plan.targetMinutes, 1);
  const targetPct = (plan.targetMinutes / scale) * 100;
  return (
    <div className={clsx("relative pt-5", className)}>
      <div className="flex h-10 w-full overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10" role="img" aria-label={`Scaletta: ${formatMinutes(plan.totalMinutes)} su ${formatMinutes(plan.targetMinutes)} previsti`}>
        {segments.map((s, i) => {
          const pct = (s.minutes / scale) * 100;
          if (pct <= 0) return null;
          const label = segmentLabel(s, plan);
          return (
            <div
              key={i}
              className={clsx("flex min-w-0 items-center justify-center overflow-hidden border-r border-night/60 px-1 text-[11px] font-extrabold leading-tight last:border-r-0", segmentStyle(s))}
              style={{ width: `${pct}%` }}
              title={`${label}: ${formatMinutes(s.minutes)}`}
            >
              {pct >= 7 && <span className="truncate">{s.kind === "round" ? `${s.index + 1}. ${label}` : label}</span>}
            </div>
          );
        })}
      </div>
      {/* linea della durata prevista */}
      <div className="pointer-events-none absolute bottom-0 top-0" style={{ left: `calc(${targetPct}% - 1px)` }} aria-hidden>
        <div className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded bg-white px-1.5 text-[10px] font-black text-ink">{formatMinutes(plan.targetMinutes)}</div>
        <div className={clsx("absolute bottom-0 top-4 w-0.5", plan.overMinutes > 0 ? "bg-flame" : "bg-white")} />
      </div>
    </div>
  );
}

export function RunningOrderPanel({
  sessionId,
  rounds,
  runningOrder,
  defaultDuration,
  scheduledAt,
  readOnly,
  onSaved,
}: {
  sessionId: string;
  rounds: RoundDetail[];
  runningOrder: RunningOrder | undefined;
  defaultDuration: number;
  scheduledAt: string | null;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(runningOrder, rounds));
  const [saving, setSaving] = useState(false);

  const ro = useMemo(() => runningOrderFrom(draft, rounds), [draft, rounds]);
  const plan = useMemo(() => planFromRounds(ro, rounds, defaultDuration), [ro, rounds, defaultDuration]);
  const saved = useMemo(() => runningOrderFrom(draftFrom(runningOrder, rounds), rounds), [runningOrder, rounds]);
  const dirty = JSON.stringify(ro) !== JSON.stringify(saved);
  const segments = planSegments(plan);
  const startMinute = new Map<string, number>();
  for (const s of segments) if (s.kind === "round") startMinute.set(s.roundId, s.startMinute);
  const outroStart = segments[segments.length - 1]?.startMinute ?? 0;

  function setRound(id: string, patch: Partial<Draft["rounds"][string]>) {
    setDraft((d) => ({ ...d, rounds: { ...d.rounds, [id]: { ...(d.rounds[id] ?? { minutes: "", breakAfter: "" }), ...patch } } }));
  }

  async function save() {
    setSaving(true);
    try {
      await send(`/api/admin/sessions/${sessionId}`, "PATCH", { settings: { runningOrder: Object.keys(ro).length > 0 ? ro : null } });
      toast("ok", "Scaletta salvata");
      onSaved();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function resetToEstimates() {
    setDraft((d) => ({ ...d, rounds: Object.fromEntries(Object.entries(d.rounds).map(([k, v]) => [k, { ...v, minutes: "" }])) }));
  }

  const over = plan.overMinutes;
  const numberInput = "w-20 text-right tabular-nums";

  return (
    <Panel
      title="Scaletta a tempo"
      actions={
        !readOnly && (
          <>
            <Button size="sm" variant="ghost" onClick={resetToEstimates} disabled={!plan.rounds.some((r) => r.manual)}>
              Usa le stime
            </Button>
            <Button size="sm" variant="gold" loading={saving} disabled={!dirty} onClick={() => void save()}>
              Salva scaletta
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl leading-none">
            {formatMinutes(plan.totalMinutes)} <span className="text-lg text-white/50">su {formatMinutes(plan.targetMinutes)}</span>
          </p>
          <p className={clsx("mt-1 text-sm font-bold", over > 0 ? "text-[#ff8098]" : over < -10 ? "text-[#8cc4ff]" : "text-[#5dffab]")}>
            {over > 0 ? `Sfora di ${formatMinutes(over)}: togli domande o accorcia un round` : over < 0 ? `Margine di ${formatMinutes(-over)}` : "Perfettamente in tempo"}
            {plan.breaksMinutes > 0 && <span className="font-normal text-white/60"> · intervalli {formatMinutes(plan.breaksMinutes)}</span>}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-white/80">
          Durata serata (min)
          <Input
            type="number"
            inputMode="numeric"
            min={10}
            max={600}
            placeholder={String(ESTIMATE.targetMinutes)}
            value={draft.target}
            disabled={readOnly}
            onChange={(e) => setDraft((d) => ({ ...d, target: e.target.value }))}
            className={numberInput}
          />
        </label>
      </div>

      <RunningOrderTimeline plan={plan} className="mt-3" />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-white/50">
              <th className="py-1 pr-2 font-bold">Momento</th>
              <th className="py-1 pr-2 font-bold">Stima</th>
              <th className="py-1 pr-2 font-bold">Minuti</th>
              <th className="py-1 pr-2 font-bold">Intervallo dopo</th>
              {scheduledAt && <th className="py-1 font-bold">Orario</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <tr>
              <td className="py-1.5 pr-2 font-bold">Apertura <span className="font-normal text-white/50">(intro e regole)</span></td>
              <td className="py-1.5 pr-2 text-white/50">-</td>
              <td className="py-1.5 pr-2">
                <Input type="number" inputMode="numeric" min={0} max={120} aria-label="Minuti di apertura" placeholder={String(ESTIMATE.introMinutes)} value={draft.intro} disabled={readOnly} onChange={(e) => setDraft((d) => ({ ...d, intro: e.target.value }))} className={numberInput} />
              </td>
              <td />
              {scheduledAt && <td className="py-1.5 tabular-nums text-white/70">{clockAt(scheduledAt, 0)}</td>}
            </tr>
            {plan.rounds.map((r, i) => {
              const d = draft.rounds[r.id] ?? { minutes: "", breakAfter: "" };
              const last = i === plan.rounds.length - 1;
              return (
                <tr key={r.id}>
                  <td className="max-w-[220px] py-1.5 pr-2">
                    <p className="truncate font-bold">
                      {i + 1}. {r.title}
                    </p>
                    <p className="text-xs text-white/50">{r.questions === 1 ? "1 domanda" : `${r.questions} domande`}</p>
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-white/70">{formatMinutes(r.estimateMinutes)}</td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={240}
                      aria-label={`Minuti previsti per ${r.title}`}
                      placeholder={String(r.estimateMinutes)}
                      value={d.minutes}
                      disabled={readOnly}
                      onChange={(e) => setRound(r.id, { minutes: e.target.value })}
                      className={clsx(numberInput, r.manual && "ring-1 ring-gold/60")}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    {last ? (
                      <span className="text-xs text-white/40">poi il finale</span>
                    ) : (
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        aria-label={`Intervallo dopo ${r.title} (minuti)`}
                        placeholder="0"
                        value={d.breakAfter}
                        disabled={readOnly}
                        onChange={(e) => setRound(r.id, { breakAfter: e.target.value })}
                        className={numberInput}
                      />
                    )}
                  </td>
                  {scheduledAt && <td className="py-1.5 tabular-nums text-white/70">{clockAt(scheduledAt, startMinute.get(r.id) ?? 0)}</td>}
                </tr>
              );
            })}
            <tr>
              <td className="py-1.5 pr-2 font-bold">Finale <span className="font-normal text-white/50">(podio e saluti)</span></td>
              <td className="py-1.5 pr-2 text-white/50">-</td>
              <td className="py-1.5 pr-2">
                <Input type="number" inputMode="numeric" min={0} max={120} aria-label="Minuti del finale" placeholder={String(ESTIMATE.outroMinutes)} value={draft.outro} disabled={readOnly} onChange={(e) => setDraft((d) => ({ ...d, outro: e.target.value }))} className={numberInput} />
              </td>
              <td />
              {scheduledAt && (
                <td className="py-1.5 tabular-nums text-white/70">
                  {clockAt(scheduledAt, outroStart)} → {clockAt(scheduledAt, plan.totalMinutes)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-white/50">
        Campo vuoto = stima automatica: domande × (lettura + {defaultDuration} s circa per rispondere + {ESTIMATE.revealSeconds} s di soluzione e punti), più presentazione,
        votazione e classifica del round. Solo pianificazione: non cambia tempi né regole del gioco e si può ritoccare anche a serata pubblicata.
      </p>
    </Panel>
  );
}
