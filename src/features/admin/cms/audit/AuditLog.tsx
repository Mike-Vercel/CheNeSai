"use client";

import { useState } from "react";
import { Badge, Button, EmptyState, Select } from "@/components/ui";
import { errorMessage, get, qs, useApi } from "../api";
import { ErrorBlock, InfoNote, LoadingBlock, PageHeader } from "../common";
import { fmtStamp } from "../format";
import type { AuditEntry, SessionSummary } from "../types";

const PAGE = 50;

const ACTION_LABEL: Record<string, string> = {
  "session.create": "Serata creata",
  "session.update": "Serata modificata",
  "session.delete": "Serata eliminata",
  "session.duplicate": "Serata duplicata",
  "session.publish": "Serata pubblicata",
  "session.unpublish": "Pubblicazione annullata",
  "session.archive": "Serata archiviata",
  "session.backup": "Backup scaricato",
  "round.create": "Round creato",
  "round.update": "Round modificato",
  "round.delete": "Round eliminato",
  "round.reorder": "Round riordinati",
  "round.add_questions": "Domande aggiunte al round",
  "round.reorder_questions": "Domande riordinate",
  "session_question.update": "Domanda della serata modificata",
  "session_question.remove": "Domanda tolta dalla serata",
  "event.schedule": "Evento programmato",
  "event.unschedule": "Evento rimosso",
  "question.create": "Domanda creata",
  "question.update": "Domanda modificata",
  "question.delete": "Domanda eliminata",
  "question.import": "Domande importate",
  "question.confirm_answer": "Risposta confermata",
  "question.approved": "Domanda approvata",
  "question.draft": "Domanda in bozza",
  "question.archived": "Domanda archiviata",
  "media.upload": "Media caricato",
  "media.update": "Media modificato",
  "settings.update": "Impostazioni modificate",
  "admin.create": "Utente creato",
  "admin.update": "Utente modificato",
  "season.create": "Stagione creata",
  "season.update": "Stagione modificata",
  "season.delete": "Stagione eliminata",
  "event_definition.update": "Evento Palmino modificato",
};

function color(action: string): "gray" | "gold" | "green" | "red" | "blue" | "violet" | "fuchsia" {
  if (/delete|remove|archive|kick/i.test(action)) return "red";
  if (/publish|approve|confirm/i.test(action)) return "green";
  if (action.startsWith("command") || action.startsWith("live")) return "fuchsia";
  if (action.startsWith("settings") || action.startsWith("admin")) return "gold";
  if (/create|import|upload/.test(action)) return "blue";
  return "gray";
}

export function AuditLog() {
  const [sessionId, setSessionId] = useState("");
  const [extra, setExtra] = useState<AuditEntry[]>([]);
  const [more, setMore] = useState<{ loading: boolean; done: boolean; error: string | null }>({ loading: false, done: false, error: null });
  const sessions = useApi<{ sessions: SessionSummary[] }>("/api/admin/sessions?archived=1");
  const first = useApi<{ entries: AuditEntry[] }>(`/api/admin/audit${qs({ limit: PAGE, sessionId })}`);
  const entries = [...(first.data?.entries ?? []), ...extra];
  const done = more.done || (first.data !== null && first.data.entries.length < PAGE);
  const titleOf = (id: string) => sessions.data?.sessions.find((s) => s.id === id)?.title ?? `${id.slice(0, 8)}…`;

  function changeSession(v: string) {
    setSessionId(v);
    setExtra([]);
    setMore({ loading: false, done: false, error: null });
  }

  async function loadMore() {
    const last = entries[entries.length - 1];
    if (!last) return;
    setMore((m) => ({ ...m, loading: true, error: null }));
    try {
      const r = await get<{ entries: AuditEntry[] }>(`/api/admin/audit${qs({ limit: PAGE, sessionId, before: last.id })}`);
      setExtra((x) => [...x, ...r.entries]);
      setMore({ loading: false, done: r.entries.length < PAGE, error: null });
    } catch (e) {
      setMore({ loading: false, done: false, error: errorMessage(e) });
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Registro attività" subtitle="Chi ha fatto cosa, e quando: ogni modifica e ogni comando di regia viene registrato" />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-bold text-white/80">
          Serata
          <Select className="min-w-64" value={sessionId} onChange={(e) => changeSession(e.target.value)}>
            <option value="">Tutte le attività</option>
            {(sessions.data?.sessions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setExtra([]);
            setMore({ loading: false, done: false, error: null });
            first.reload();
          }}
        >
          Aggiorna
        </Button>
      </div>

      {first.error ? (
        <ErrorBlock message={first.error} onRetry={first.reload} />
      ) : !first.data ? (
        <LoadingBlock />
      ) : entries.length === 0 ? (
        <EmptyState title="Nessuna attività registrata" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1d0c30]">
          <ul className="divide-y divide-white/5" aria-busy={first.loading}>
            {entries.map((e) => (
              <li key={e.id} className="grid gap-1 px-4 py-2.5 text-sm md:grid-cols-[150px_220px_minmax(0,1fr)] md:gap-3">
                <span className="tabular-nums text-white/55">{fmtStamp(e.created_at)}</span>
                <span className="min-w-0 truncate font-bold" title={e.actor_email ?? ""}>
                  {e.actor_email ?? "sistema"}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={color(e.action)}>{ACTION_LABEL[e.action] ?? e.action}</Badge>
                    {e.session_id && !sessionId && (
                      <button type="button" className="truncate text-xs text-cyan underline" onClick={() => changeSession(e.session_id ?? "")}>
                        {titleOf(e.session_id)}
                      </button>
                    )}
                    {e.ip && <span className="text-xs text-white/35">IP {e.ip}</span>}
                  </div>
                  {e.details !== null && e.details !== undefined && typeof e.details === "object" && Object.keys(e.details as object).length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-white/50 hover:text-white/80">Dettagli</summary>
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#0f0519] p-2 text-xs text-white/70">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {more.error && <InfoNote tone="danger">{more.error}</InfoNote>}
      {first.data && entries.length > 0 && !done && (
        <div className="flex justify-center">
          <Button variant="ghost" loading={more.loading} onClick={loadMore}>
            Carica altri
          </Button>
        </div>
      )}
    </div>
  );
}
