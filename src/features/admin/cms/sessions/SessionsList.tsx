"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, EmptyState, useConfirm, useToast } from "@/components/ui";
import { useCan } from "@/features/admin/AdminShell";
import type { SessionStatus } from "@/lib/game-engine/types";
import { qs, send, useApi, useRunner } from "../api";
import { ErrorBlock, LinkButton, LoadingBlock, PageHeader, Segmented, StatusBadge, TestBadge } from "../common";
import { fmtDateTime, fmtNum, PHASE_LABEL } from "../format";
import type { SessionSummary } from "../types";
import { QuickSessionModal } from "./QuickSessionModal";
import { DuplicateSessionModal, emptySessionInfo, SessionInfoModal } from "./SessionForms";

type Filter = "all" | SessionStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tutte" },
  { value: "draft", label: "Bozze" },
  { value: "ready", label: "Pubblicate" },
  { value: "live", label: "In onda" },
  { value: "finished", label: "Terminate" },
  { value: "archived", label: "Archiviate" },
];

type Kind = "admin" | "public";
const KINDS: { value: Kind; label: string }[] = [
  { value: "admin", label: "Serate della regia" },
  { value: "public", label: "Partite libere" },
];

export function SessionsList({ openCreate = false }: { openCreate?: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const isAdmin = useCan("admin");
  const [filter, setFilter] = useState<Filter>("all");
  const [kind, setKind] = useState<Kind>("admin");
  const [creating, setCreating] = useState(openCreate && isAdmin);
  const [quick, setQuick] = useState(false);
  const toast = useToast();
  const [dup, setDup] = useState<SessionSummary | null>(null);
  const { data, error, loading, reload } = useApi<{ sessions: SessionSummary[] }>(`/api/admin/sessions${qs({ status: filter === "all" ? undefined : filter, kind: kind === "public" ? "public" : undefined })}`);
  const { busy, run } = useRunner();

  async function remove(s: SessionSummary) {
    const real = s.status !== "draft";
    const ok = await confirm({
      title: "Eliminare la serata?",
      message: (
        <>
          <p>
            Stai per eliminare <strong>{s.title}</strong> con tutti i suoi round{real ? ", giocatori, risposte e punteggi" : ""}.
          </p>
          <p className="mt-2 text-sm text-white/60">L&apos;operazione non si può annullare. Le domande restano nell&apos;archivio.</p>
        </>
      ),
      confirmLabel: "Elimina",
      danger: true,
      typeToConfirm: real ? "ELIMINA" : undefined,
    });
    if (!ok) return;
    const r = await run(`del-${s.id}`, () => send(`/api/admin/sessions/${s.id}`, "DELETE"), "Serata eliminata");
    if (r) reload();
  }

  async function archive(s: SessionSummary) {
    const ok = await confirm({
      title: "Archiviare la serata?",
      message: "La serata sparisce dagli elenchi principali ma restano statistiche, classifiche e backup.",
      confirmLabel: "Archivia",
    });
    if (!ok) return;
    const r = await run(`arc-${s.id}`, () => send(`/api/admin/sessions/${s.id}/archive`, "POST"), "Serata archiviata");
    if (r) reload();
  }

  const list = data?.sessions ?? [];
  return (
    <div className="space-y-4">
      <PageHeader
        title="Serate"
        subtitle="Prepara, pubblica e conduci le serate di CHE NE SAI?!"
        actions={
          isAdmin && (
            <>
              <Button variant="primary" onClick={() => setQuick(true)}>
                ⚡ Serata rapida
              </Button>
              <Button variant="gold" onClick={() => setCreating(true)}>
                + Crea serata
              </Button>
            </>
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        <Segmented label="Tipo di partita" value={kind} onChange={setKind} options={KINDS} />
        <Segmented label="Filtra per stato" value={filter} onChange={setFilter} options={FILTERS} />
      </div>
      {kind === "public" && (
        <p className="text-sm text-white/60">
          Partite create dal pubblico da <span className="font-mono">/gioca</span> con un account host: scorrimento automatico, domande scelte dal sito. Non entrano nelle statistiche e nelle classifiche mensili.
        </p>
      )}

      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : list.length === 0 ? (
        kind === "public" ? (
        <EmptyState title="Nessuna partita libera">{filter === "all" ? "Compaiono qui quando qualcuno crea una partita da /gioca." : "Nessuna partita libera con questo stato."}</EmptyState>
      ) : (
        <EmptyState title="Nessuna serata">{filter === "all" ? "Crea la prima serata con il pulsante in alto." : "Nessuna serata con questo stato."}</EmptyState>
      )
      ) : (
        <ul className="space-y-2" aria-busy={loading}>
          {list.map((s) => {
            const canDelete = s.status === "draft" || (s.isTest && s.status !== "live");
            return (
              <li key={s.id} className="rounded-2xl border border-white/10 bg-[#1d0c30] p-4 transition hover:border-white/20">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={s.status} />
                      {s.isTest && <TestBadge />}
                      {s.hostUserId && <span className="rounded-full bg-cyan/15 px-2 py-0.5 text-xs font-bold text-cyan">Partita libera · @{s.hostUsername ?? "account"}</span>}
                      {s.status === "live" && s.phase && <span className="text-xs font-bold text-white/60">{PHASE_LABEL[s.phase] ?? s.phase}</span>}
                    </div>
                    <Link href={`/admin/sessions/${s.id}`} className="mt-1 block break-words text-lg font-extrabold hover:text-gold">
                      {s.title}
                    </Link>
                    <p className="text-sm text-white/60">{fmtDateTime(s.scheduledAt)}</p>
                  </div>
                  <dl className="grid grid-cols-4 gap-2 text-center text-xs lg:w-80">
                    {[
                      ["Codice", <span key="c" className="font-mono text-gold">{s.code}</span>],
                      ["Round", fmtNum(s.rounds)],
                      ["Domande", fmtNum(s.questions)],
                      [s.status === "live" ? "Online" : "Giocatori", s.status === "live" ? `${s.online}/${s.participants}` : fmtNum(s.participants)],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="rounded-lg bg-white/5 px-1 py-1.5">
                        <dt className="text-white/50">{k}</dt>
                        <dd className="mt-0.5 text-sm font-extrabold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap gap-2 lg:w-[22rem] lg:justify-end">
                    {(s.status === "ready" || s.status === "live") && (
                      <LinkButton href={`/admin/sessions/${s.id}/live`} size="sm" variant={s.status === "live" ? "danger" : "primary"}>
                        {s.status === "live" ? "▶ Regia live" : "Regia live"}
                      </LinkButton>
                    )}
                    {s.status === "ready" && (
                      <LinkButton href={`/admin/sessions/${s.id}/rehearsal`} size="sm">
                        Prova generale
                      </LinkButton>
                    )}
                    <LinkButton href={`/admin/sessions/${s.id}`} size="sm" variant={s.status === "draft" ? "gold" : "ghost"}>
                      {s.status === "draft" && isAdmin ? "Modifica" : "Apri"}
                    </LinkButton>
                    {(s.status === "finished" || s.status === "archived") && isAdmin && (
                      <LinkButton href={`/admin/sessions/${s.id}/stats`} size="sm">
                        Statistiche
                      </LinkButton>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" onClick={() => setDup(s)}>
                        Duplica
                      </Button>
                    )}
                    {isAdmin && s.status === "finished" && (
                      <Button size="sm" variant="ghost" loading={busy === `arc-${s.id}`} onClick={() => archive(s)}>
                        Archivia
                      </Button>
                    )}
                    {isAdmin && canDelete && (
                      <Button size="sm" variant="ghost" className="text-[#ff8098]" loading={busy === `del-${s.id}`} onClick={() => remove(s)}>
                        Elimina
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <SessionInfoModal
          open
          onClose={() => setCreating(false)}
          title="Nuova serata"
          initial={emptySessionInfo()}
          submitLabel="Crea e apri editor"
          allowTestToggle
          showAdvanceMode
          onSubmit={async (body) => {
            const r = await send<{ id: string }>("/api/admin/sessions", "POST", { settings: {}, ...body });
            setCreating(false);
            router.push(`/admin/sessions/${r.id}`);
          }}
        />
      )}
      {quick && (
        <QuickSessionModal
          onClose={() => setQuick(false)}
          onCreated={(r) => {
            setQuick(false);
            const s = r.summary;
            toast(
              s.repeats + s.planned > 0 ? "info" : "ok",
              s.repeats + s.planned > 0
                ? `Serata creata: ${s.fresh} domande mai giocate, ${s.repeats + s.planned} ripetute`
                : `Serata creata con ${s.picked} domande mai giocate`,
            );
            if (r.sessionId) router.push(`/admin/sessions/${r.sessionId}`);
          }}
        />
      )}
      {dup && (
        <DuplicateSessionModal
          key={dup.id}
          source={dup}
          onClose={() => setDup(null)}
          onDone={(id) => {
            setDup(null);
            router.push(`/admin/sessions/${id}`);
          }}
        />
      )}
    </div>
  );
}
