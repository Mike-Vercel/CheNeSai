"use client";

import Link from "next/link";
import { EmptyState, Panel } from "@/components/ui";
import { useApi } from "../api";
import { ErrorBlock, LinkButton, LoadingBlock, PageHeader, StatTile, StatusBadge, TestBadge } from "../common";
import { fmtDateTime, fmtNum, fmtPct, plural } from "../format";
import type { DashboardStats, SessionSummary } from "../types";

export function StatsIndex() {
  const stats = useApi<DashboardStats>("/api/admin/stats");
  const sessions = useApi<{ sessions: SessionSummary[] }>("/api/admin/sessions?archived=1");
  const t = stats.data?.totals;
  const played = (sessions.data?.sessions ?? []).filter((s) => s.status === "finished" || s.status === "archived" || s.status === "live");

  return (
    <div className="space-y-5">
      <PageHeader title="Statistiche" subtitle="Andamento delle serate e delle domande" />
      {stats.error && <ErrorBlock message={stats.error} onRetry={stats.reload} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Serate giocate" value={t ? fmtNum(t.sessions_finished) : "…"} hint="Prove generali escluse" />
        <StatTile label="Giocatori" tone="violet" value={t ? fmtNum(t.players_total) : "…"} hint={t && `${fmtNum(t.identities)} dispositivi distinti`} />
        <StatTile label="Risposte" tone="cyan" value={t ? fmtNum(t.answers_total) : "…"} />
        <StatTile label="Risposte corrette" tone="lime" value={t ? fmtPct(t.correct_pct) : "…"} />
      </div>
      <Panel title="Serate">
        {sessions.error ? (
          <ErrorBlock message={sessions.error} onRetry={sessions.reload} />
        ) : !sessions.data ? (
          <LoadingBlock />
        ) : played.length === 0 ? (
          <EmptyState title="Ancora nessuna serata giocata">Le statistiche compaiono quando una serata è stata giocata.</EmptyState>
        ) : (
          <ul className="divide-y divide-white/10">
            {played.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={s.status} />
                    {s.isTest && <TestBadge />}
                  </div>
                  <Link href={`/admin/sessions/${s.id}/stats`} className="mt-1 block break-words font-bold hover:text-gold">
                    {s.title}
                  </Link>
                  <p className="text-xs text-white/55">
                    {fmtDateTime(s.scheduledAt ?? s.startedAt)} · {plural(s.participants, "giocatore", "giocatori")} · {plural(s.questions, "domanda", "domande")}
                  </p>
                </div>
                <LinkButton href={`/admin/sessions/${s.id}/stats`} size="sm">
                  📊 Apri statistiche
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
