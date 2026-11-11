"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, EmptyState, Panel } from "@/components/ui";
import { useAdminMe, useCan } from "@/features/admin/AdminShell";
import { Character } from "@/features/game/components/brand";
import { useApi } from "./api";
import { ErrorBlock, LinkButton, LoadingBlock, PageHeader, StatTile, StatusBadge, TestBadge } from "./common";
import { fmtDateTime, fmtNum, fmtPct, PHASE_LABEL, plural } from "./format";
import type { DashboardStats, SessionSummary } from "./types";

function upcomingSort(a: SessionSummary, b: SessionSummary) {
  const ta = a.scheduledAt ? Date.parse(a.scheduledAt) : Number.MAX_SAFE_INTEGER;
  const tb = b.scheduledAt ? Date.parse(b.scheduledAt) : Number.MAX_SAFE_INTEGER;
  return ta - tb;
}

export function Dashboard() {
  const me = useAdminMe();
  const isAdmin = useCan("admin");
  // Riferimento temporale fissato al montaggio (render puro).
  const [now] = useState(() => Date.now());
  const stats = useApi<DashboardStats>("/api/admin/stats");
  const sessions = useApi<{ sessions: SessionSummary[] }>("/api/admin/sessions");

  const all = sessions.data?.sessions ?? [];
  const live = all.filter((s) => s.status === "live");
  const upcoming = all
    .filter((s) => (s.status === "draft" || s.status === "ready") && (!s.scheduledAt || Date.parse(s.scheduledAt) > now - 6 * 3600_000))
    .sort(upcomingSort);
  const next = upcoming.find((s) => s.scheduledAt) ?? upcoming[0] ?? null;
  const t = stats.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ciao ${me.displayName.split(" ")[0]}!`}
        subtitle="Panoramica delle serate di CHE NE SAI?!"
        actions={
          isAdmin && (
            <>
              <LinkButton href="/admin/sessions?new=1" variant="gold">
                + Crea serata
              </LinkButton>
              <LinkButton href="/admin/questions/import" variant="ghost">
                Importa domande
              </LinkButton>
            </>
          )
        }
      />

      {sessions.error && <ErrorBlock message={sessions.error} onRetry={sessions.reload} />}

      {live.map((s) => (
        <section
          key={s.id}
          className="relative overflow-hidden rounded-3xl border-2 border-flame/70 bg-gradient-to-br from-[#3d0914] via-[#2a0c3f] to-[#1d0c30] p-5 shadow-2xl md:p-6"
          aria-label="Serata in onda"
        >
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="live" />
                {s.isTest && <TestBadge />}
                {s.phase && <Badge color="gold">{PHASE_LABEL[s.phase] ?? s.phase}</Badge>}
              </div>
              <h2 className="mt-2 break-words font-display text-3xl text-white md:text-4xl">{s.title}</h2>
              <p className="mt-1 text-sm text-white/70">
                Codice <span className="font-mono font-bold text-gold">{s.code}</span> · {fmtNum(s.online)} online su {fmtNum(s.participants)} iscritti ·{" "}
                {plural(s.questions, "domanda", "domande")} in {s.rounds} round
              </p>
            </div>
            <LinkButton href={`/admin/sessions/${s.id}/live`} variant="danger" size="xl" className="shrink-0">
              ▶ APRI REGIA LIVE
            </LinkButton>
          </div>
        </section>
      ))}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Prossima serata" className="lg:col-span-2">
          {sessions.loading && !sessions.data ? (
            <LoadingBlock />
          ) : next ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={next.status} />
                  {next.isTest && <TestBadge />}
                </div>
                <Link href={`/admin/sessions/${next.id}`} className="mt-2 block break-words font-display text-2xl text-white hover:text-gold">
                  {next.title}
                </Link>
                <p className="mt-1 text-sm font-bold text-cyan">{fmtDateTime(next.scheduledAt)}</p>
                <p className="mt-1 text-sm text-white/60">
                  {next.rounds} round · {plural(next.questions, "domanda", "domande")} · codice <span className="font-mono text-white/80">{next.code}</span>
                </p>
                {next.status === "draft" && (
                  <p className="mt-2 text-sm text-[#ffe9a3]">Ancora in bozza: completa i round e pubblicala prima della serata.</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                <LinkButton href={`/admin/sessions/${next.id}`} variant="gold">
                  Apri editor
                </LinkButton>
                {next.status === "ready" && (
                  <>
                    <LinkButton href={`/admin/sessions/${next.id}/live`} variant="primary">
                      Regia live
                    </LinkButton>
                    <LinkButton href={`/admin/sessions/${next.id}/rehearsal`} variant="ghost">
                      Prova generale
                    </LinkButton>
                  </>
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="Nessuna serata in programma">
              {isAdmin ? (
                <Link href="/admin/sessions?new=1" className="font-bold text-gold underline">
                  Crea la prossima serata
                </Link>
              ) : (
                "Un amministratore deve ancora programmare la prossima serata."
              )}
            </EmptyState>
          )}
        </Panel>

        <Panel title="Scorciatoie">
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/admin/sessions", label: "Serate", icon: "🎬", show: true },
              { href: "/admin/sessions?new=1", label: "Crea serata", icon: "➕", show: isAdmin },
              { href: "/admin/questions/new", label: "Nuova domanda", icon: "✏️", show: isAdmin },
              { href: "/admin/questions/import", label: "Importa domande", icon: "📥", show: isAdmin },
              { href: "/admin/questions?status=draft", label: "Da confermare", icon: "✅", show: isAdmin },
              { href: "/admin/media", label: "Media", icon: "🎵", show: isAdmin },
              { href: "/admin/leaderboards", label: "Classifiche", icon: "🏆", show: isAdmin },
              { href: "/admin/events", label: "Eventi Palmino", icon: "🌴", show: isAdmin },
            ]
              .filter((l) => l.show)
              .map((l) => (
                <Link
                  key={l.href + l.label}
                  href={l.href}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold transition hover:border-gold/50 hover:bg-white/10"
                >
                  <span aria-hidden>{l.icon}</span>
                  {l.label}
                </Link>
              ))}
          </div>
        </Panel>
      </div>

      {stats.error && <ErrorBlock message={stats.error} onRetry={stats.reload} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Serate in programma" value={t ? fmtNum(t.sessions_upcoming) : "…"} hint={t && `${fmtNum(t.sessions_finished)} giocate su ${fmtNum(t.sessions_total)}`} href="/admin/sessions" />
        <StatTile
          label="Domande pronte"
          tone="lime"
          value={t ? fmtNum(t.questions_approved) : "…"}
          hint={t && (t.questions_draft > 0 ? `${fmtNum(t.questions_draft)} bozze da confermare` : "Nessuna bozza in attesa")}
          href={isAdmin ? "/admin/questions?status=draft" : undefined}
        />
        <StatTile label="Round configurati" tone="cyan" value={t ? fmtNum(t.rounds) : "…"} hint="In tutte le serate" />
        <StatTile label="Eventi Palmino attivi" tone="fuchsia" value={t ? fmtNum(t.events_enabled) : "…"} href={isAdmin ? "/admin/events" : undefined} />
        <StatTile label="Giocatori totali" tone="violet" value={t ? fmtNum(t.players_total) : "…"} hint={t && `${fmtNum(t.identities)} dispositivi riconosciuti`} />
        <StatTile label="Risposte date" value={t ? fmtNum(t.answers_total) : "…"} hint="Serate reali (prove escluse)" />
        <StatTile label="Risposte corrette" tone="lime" value={t ? fmtPct(t.correct_pct) : "…"} hint="Media di tutte le serate" />
        <StatTile
          label="Online adesso"
          tone="flame"
          value={fmtNum(live.reduce((n, s) => n + s.online, 0))}
          hint={live.length ? `${live.length} serata in onda` : "Nessuna serata in onda"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Serate programmate" actions={<LinkButton href="/admin/sessions" size="sm">Tutte le serate</LinkButton>}>
          {sessions.loading && !sessions.data ? (
            <LoadingBlock />
          ) : upcoming.length === 0 ? (
            <EmptyState title="Nessuna serata in preparazione" />
          ) : (
            <ul className="divide-y divide-white/10">
              {upcoming.slice(0, 8).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/admin/sessions/${s.id}`} className="block truncate font-bold hover:text-gold">
                      {s.title}
                    </Link>
                    <p className="text-xs text-white/55">
                      {fmtDateTime(s.scheduledAt)} · {s.rounds} round · {plural(s.questions, "domanda", "domande")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.isTest && <TestBadge />}
                    <StatusBadge status={s.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Storico serate">
          {stats.loading && !stats.data ? (
            <LoadingBlock />
          ) : !stats.data || stats.data.history.length === 0 ? (
            <EmptyState title="Ancora nessuna serata conclusa">Qui vedrai vincitori e partecipanti delle serate reali.</EmptyState>
          ) : (
            <ul className="divide-y divide-white/10">
              {stats.data.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link href={isAdmin ? `/admin/sessions/${h.id}/stats` : `/admin/sessions/${h.id}`} className="block truncate font-bold hover:text-gold">
                      {h.title}
                    </Link>
                    <p className="text-xs text-white/55">
                      {fmtDateTime(h.date)} · {plural(h.players, "giocatore", "giocatori")}
                    </p>
                  </div>
                  {h.winner ? (
                    <span className="flex items-center gap-1 text-sm font-bold text-gold">
                      🏆 {h.winner} <span className="text-white/50">({fmtNum(h.top)} pt)</span>
                    </span>
                  ) : (
                    <span className="text-xs text-white/40">Nessuna classifica</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1d0c30] p-4">
        <Character who="palmino" small className="w-16 shrink-0" />
        <p className="text-sm text-white/70">
          Ricorda: le domande importate o generate con ChatGPT entrano come <strong className="text-white">bozze</strong>. Prima di inserirle in una
          serata va confermata a mano ogni risposta corretta.
        </p>
      </div>
    </div>
  );
}
