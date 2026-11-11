"use client";

import { clsx } from "clsx";
import { Badge, EmptyState, Panel } from "@/components/ui";
import { useApi } from "../api";
import { ErrorBlock, LinkButton, LoadingBlock, PageHeader, StatTile } from "../common";
import { ANSWER_COLORS, fmtNum, fmtPct, fmtStamp, LETTERS } from "../format";
import type { SessionStatsData } from "../types";

const SERIES = ["#ffd43b", "#00d9ff", "#ff5fb0", "#3cf095", "#b48cff"];

function niceStep(range: number, ticks: number) {
  const raw = range / ticks;
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/** Andamento punti cumulati dei primi 5 (linee SVG). */
function TrendChart({ trend, final }: { trend: SessionStatsData["trend"]; final: SessionStatsData["final"] }) {
  const names = final.slice(0, 5).map((f) => f.nickname);
  const series = names.map((n) => ({ name: n, points: trend.filter((t) => t.nickname === n).sort((a, b) => a.play_order - b.play_order) }));
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <EmptyState title="Nessun dato di andamento" />;
  const orders = [...new Set(all.map((p) => p.play_order))].sort((a, b) => a - b);
  const W = 720;
  const H = 280;
  const pad = { l: 56, r: 16, t: 14, b: 30 };
  const minX = orders[0];
  const maxX = orders[orders.length - 1];
  const rawMin = Math.min(0, ...all.map((p) => p.points_after));
  const rawMax = Math.max(1, ...all.map((p) => p.points_after));
  const step = niceStep(rawMax - rawMin, 6);
  const minY = Math.floor(rawMin / step) * step;
  const maxY = Math.ceil(rawMax / step) * step;
  const x = (o: number) => pad.l + (maxX === minX ? (W - pad.l - pad.r) / 2 : ((o - minX) / (maxX - minX)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - minY) / (maxY - minY || 1)) * (H - pad.t - pad.b);
  const ticks: number[] = [];
  for (let v = minY; v <= maxY + 1e-9; v += step) ticks.push(v);
  const xEvery = Math.max(1, Math.ceil(orders.length / 12));

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Andamento dei punti dei primi cinque giocatori domanda per domanda">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.08)"} strokeWidth={1} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,.55)">
              {fmtNum(v)}
            </text>
          </g>
        ))}
        {orders.map((o, i) =>
          i % xEvery === 0 || i === orders.length - 1 ? (
            <text key={o} x={x(o)} y={H - 10} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,.55)">
              D{o}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          if (s.points.length === 0) return null;
          const d = s.points.map((p, i) => `${i ? "L" : "M"}${x(p.play_order).toFixed(1)},${y(p.points_after).toFixed(1)}`).join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={SERIES[si]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p) => (
                <circle key={p.play_order} cx={x(p.play_order)} cy={y(p.points_after)} r={3.2} fill={SERIES[si]} stroke="#1d0c30" strokeWidth={1.5}>
                  <title>{`${s.name} · domanda ${p.play_order}: ${fmtNum(p.points_after)} punti`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {series.map((s, si) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full" style={{ background: SERIES[si] }} aria-hidden />
            <span className="font-bold">{s.name}</span>
            <span className="text-white/55">{fmtNum(final[si]?.points)} pt</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function RateBar({ value, label, sub }: { value: number | null; label: string; sub?: string }) {
  const pct = value ?? 0;
  const color = pct >= 66 ? "#3cf095" : pct >= 33 ? "#ffd43b" : "#ff5a74";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-bold">{label}</span>
        <span className="shrink-0 font-extrabold" style={{ color }}>
          {value === null ? "-" : fmtPct(value)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10" role="presentation">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      </div>
      {sub && <p className="mt-0.5 text-xs text-white/45">{sub}</p>}
    </div>
  );
}

function Distribution({ q }: { q: SessionStatsData["questions"][number] }) {
  const total = q.distribution.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...q.distribution);
  return (
    <div className="space-y-1">
      {q.distribution.map((n, i) => {
        const correct = q.correct_positions.includes(i);
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className={clsx("grid h-6 w-6 shrink-0 place-items-center rounded-md font-display text-sm text-white", correct && "ring-2 ring-[#5dffab] ring-offset-1 ring-offset-[#1d0c30]")}
              style={{ background: ANSWER_COLORS[i] }}
              aria-label={`Risposta ${LETTERS[i]}${correct ? " (corretta)" : ""}`}
            >
              {LETTERS[i]}
            </span>
            <div className="h-5 min-w-0 flex-1 overflow-hidden rounded bg-white/5">
              <div className="h-full rounded" style={{ width: `${(n / max) * 100}%`, background: ANSWER_COLORS[i], opacity: correct ? 1 : 0.55 }} />
            </div>
            <span className="w-20 shrink-0 text-right tabular-nums text-white/70">
              {n} · {total ? fmtPct(n / total, true) : "0%"}
            </span>
            <span className="w-4 shrink-0 text-[#5dffab]" aria-hidden>
              {correct ? "✓" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SessionStats({ id }: { id: string }) {
  const req = useApi<SessionStatsData>(`/api/admin/sessions/${id}/stats`);
  if (req.error && !req.data) return <ErrorBlock message={req.error} onRetry={req.reload} />;
  if (!req.data) return <LoadingBlock label="Calcolo delle statistiche…" />;
  const d = req.data;
  const winner = d.final[0];
  const votesByRound = new Map<string, SessionStatsData["votes"]>();
  for (const v of d.votes) votesByRound.set(v.round, [...(votesByRound.get(v.round) ?? []), v]);

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/admin/stats", label: "Statistiche" }}
        title={d.session.title}
        subtitle="Statistiche della serata"
        actions={
          <>
            <LinkButton href={`/admin/sessions/${id}`} size="sm">
              Apri serata
            </LinkButton>
            <LinkButton href={`/api/admin/sessions/${id}/backup`} size="sm" download>
              ⬇ Backup JSON
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Giocatori" value={fmtNum(d.summary.participants)} tone="violet" />
        <StatTile label="Domande giocate" value={fmtNum(d.summary.questions_played)} tone="cyan" />
        <StatTile label="Risposte" value={fmtNum(d.summary.answers)} />
        <StatTile label="Corrette" value={fmtPct(d.summary.correct_pct)} tone="lime" />
        <StatTile label="Tempo medio" value={d.summary.avg_response_ms !== null ? `${fmtNum(d.summary.avg_response_ms / 1000, 1)} s` : "-"} tone="fuchsia" hint="Per rispondere" />
      </div>

      {winner && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-gold/50 bg-gradient-to-r from-gold/15 to-transparent p-4">
          <span className="text-3xl" aria-hidden>
            🏆
          </span>
          <p className="text-lg">
            Vincitore: <strong className="font-display text-2xl text-gold">{winner.nickname}</strong> con {fmtNum(winner.points)} punti e {winner.correct_count} risposte
            corrette
          </p>
        </div>
      )}

      <Panel title="Andamento dei primi 5">
        <TrendChart trend={d.trend} final={d.final} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Risposte corrette per round">
          {d.rounds.length === 0 ? (
            <EmptyState title="Nessun round" />
          ) : (
            <div className="space-y-3">
              {d.rounds.map((r) => (
                <RateBar key={r.position} label={`${r.position + 1}. ${r.title}`} value={r.answers ? r.correct_pct : null} sub={`${fmtNum(r.answers)} risposte`} />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Classifica finale">
          {d.final.length === 0 ? (
            <EmptyState title="Classifica non disponibile" />
          ) : (
            <ol className="max-h-96 divide-y divide-white/5 overflow-y-auto pr-1">
              {d.final.map((f) => (
                <li key={f.final_rank + f.nickname} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className={clsx("w-8 text-center font-display text-lg", f.final_rank <= 3 ? "text-gold" : "text-white/60")}>{f.final_rank}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{f.nickname}</span>
                  <span className="text-xs text-white/50">{f.correct_count} corrette</span>
                  <span className="w-20 text-right font-extrabold tabular-nums text-gold">{fmtNum(f.points)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Le più difficili">
          {d.hardest.length === 0 ? (
            <EmptyState title="Nessun dato" />
          ) : (
            <div className="space-y-3">
              {d.hardest.map((q, i) => (
                <RateBar key={i} label={q.text} value={q.correctRate * 100} />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Le più facili">
          {d.easiest.length === 0 ? (
            <EmptyState title="Nessun dato" />
          ) : (
            <div className="space-y-3">
              {d.easiest.map((q, i) => (
                <RateBar key={i} label={q.text} value={q.correctRate * 100} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {votesByRound.size > 0 && (
        <Panel title="Votazioni di categoria">
          <div className="grid gap-5 md:grid-cols-2">
            {[...votesByRound.entries()].map(([round, opts]) => {
              const tot = opts.reduce((a, o) => a + o.votes, 0);
              const method = opts.find((o) => o.method)?.method;
              return (
                <div key={round}>
                  <p className="mb-2 font-bold">
                    {round} <span className="text-xs font-normal text-white/50">· {tot} voti</span>
                    {method && method !== "majority" && <Badge className="ml-2">Pareggio: {method}</Badge>}
                  </p>
                  <div className="space-y-1.5">
                    {opts.map((o) => (
                      <div key={o.label} className="flex items-center gap-2 text-sm">
                        <span className={clsx("w-32 shrink-0 truncate", o.winner && "font-extrabold text-gold")}>
                          {o.winner && "👑 "}
                          {o.label}
                        </span>
                        <div className="h-4 min-w-0 flex-1 overflow-hidden rounded bg-white/5">
                          <div className={clsx("h-full rounded", o.winner ? "bg-gold" : "bg-white/30")} style={{ width: `${tot ? (o.votes / tot) * 100 : 0}%` }} />
                        </div>
                        <span className="w-16 shrink-0 text-right tabular-nums text-white/70">{o.votes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel title="Domanda per domanda">
        {d.questions.length === 0 ? (
          <EmptyState title="Nessuna domanda rivelata" />
        ) : (
          <ol className="grid gap-3 lg:grid-cols-2">
            {d.questions.map((q) => (
              <li key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-start gap-2">
                  <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-lg bg-white/10 px-1 text-sm font-extrabold">{q.play_order ?? "-"}</span>
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{q.text}</p>
                    <p className="mt-0.5 text-xs text-white/50">
                      {q.round_title} · {q.category} · {q.answers} risposte su {q.eligible} · tempo medio {q.avg_ms !== null ? `${fmtNum(q.avg_ms / 1000, 1)} s` : "-"}
                    </p>
                  </div>
                  <span
                    className="ml-auto shrink-0 rounded-lg px-2 py-0.5 text-sm font-extrabold"
                    style={{ color: q.correctRate >= 0.66 ? "#3cf095" : q.correctRate >= 0.33 ? "#ffd43b" : "#ff5a74" }}
                  >
                    {fmtPct(q.correctRate, true)}
                  </span>
                </div>
                <Distribution q={q} />
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {d.events.length > 0 && (
        <Panel title="Eventi di Palmino">
          <ul className="divide-y divide-white/5 text-sm">
            {d.events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-bold">🌴 {e.title}</span>
                <Badge color={e.source === "manual" ? "blue" : e.source === "palmino_decides" ? "fuchsia" : "gray"}>
                  {e.source === "manual" ? "Manuale" : e.source === "palmino_decides" ? "Palmino decide" : "Programmato"}
                </Badge>
                <Badge color={e.status === "applied" ? "green" : "gray"}>{e.status}</Badge>
                {e.question && <span className="min-w-0 truncate text-white/60">su &laquo;{e.question}&raquo;</span>}
                <span className="ml-auto text-xs text-white/45">{fmtStamp(e.announced_at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
