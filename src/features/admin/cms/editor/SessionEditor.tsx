"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, EmptyState, Panel, useConfirm, useToast } from "@/components/ui";
import { useCan } from "@/features/admin/AdminShell";
import type { MediaKind } from "@/lib/game-engine/types";
import { ApiError, errorMessage, get, send, useApi, useRunner } from "../api";
import { ErrorBlock, InfoNote, LinkButton, LoadingBlock, PageHeader, StatusBadge, TestBadge } from "../common";
import { AGGREGATION_LABEL, fmtDateTime, PHASE_LABEL, plural } from "../format";
import { QuestionPreviewModal, type PreviewBase } from "../QuestionPreviewModal";
import { DuplicateSessionModal, SessionInfoModal, sessionInfoFrom } from "../sessions/SessionForms";
import type { EventDefinition, GlobalSettings, PublishIssue, QuestionRecord, RoundDetail, Season, SessionDetail, SessionQuestionItem } from "../types";
import { QuestionPickerModal } from "./QuestionPickerModal";
import { RandomQuestionsModal } from "./RandomQuestionsModal";
import { RoundCard } from "./RoundCard";
import { RoundFormModal } from "./RoundFormModal";
import { RunningOrderPanel } from "./RunningOrderPanel";
import { SessionSettingsModal } from "./SessionSettingsModal";
import { TeamsPanel } from "./TeamsPanel";
import { usePregen, VoicePrepBox } from "../voices/VoicePrep";

export function SessionEditor({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const isAdmin = useCan("admin");
  const { busy, run } = useRunner();

  const sess = useApi<{ session: SessionDetail }>(`/api/admin/sessions/${id}`);
  const defsReq = useApi<{ definitions: EventDefinition[] }>("/api/admin/event-definitions");
  const globalReq = useApi<{ settings: GlobalSettings }>(isAdmin ? "/api/admin/settings" : null);
  const seasonsReq = useApi<{ seasons: Season[] }>(isAdmin ? "/api/admin/seasons" : null);
  const s = sess.data?.session ?? null;
  const isDraft = s?.status === "draft";
  const check = useApi<{ issues: PublishIssue[] }>(isAdmin && isDraft ? `/api/admin/sessions/${id}/publish` : null);

  const [editInfo, setEditInfo] = useState(false);
  const [editSettings, setEditSettings] = useState(false);
  const [roundModal, setRoundModal] = useState<{ round: RoundDetail | null } | null>(null);
  const [picker, setPicker] = useState<RoundDetail | null>(null);
  const [randomFor, setRandomFor] = useState<RoundDetail | null>(null);
  const [preview, setPreview] = useState<PreviewBase | null>(null);
  const [publishErrors, setPublishErrors] = useState<PublishIssue[] | null>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const [voiceNonce, setVoiceNonce] = useState(0);
  const voicePrep = usePregen(() => setVoiceNonce((n) => n + 1));

  function refresh() {
    sess.reload();
    check.reload();
  }

  if (sess.error && !s) return <ErrorBlock message={sess.error} onRetry={sess.reload} />;
  if (!s) return <LoadingBlock label="Caricamento serata…" />;

  const session = s;
  const readOnly = !isAdmin || session.status !== "draft";
  const defs = defsReq.data?.definitions ?? [];
  const global = globalReq.data?.settings ?? null;
  const rounds = [...session.roundsDetail].sort((a, b) => a.position - b.position);
  const usedIds = new Set(rounds.flatMap((r) => r.questions.map((q) => q.questionId).filter((x): x is string => !!x)));
  const eventCounts = new Map<string, number>();
  for (const r of rounds) for (const q of r.questions) if (q.scheduledEvent) eventCounts.set(q.scheduledEvent.key, (eventCounts.get(q.scheduledEvent.key) ?? 0) + 1);
  const scheduledTotal = [...eventCounts.values()].reduce((a, b) => a + b, 0);
  const season = seasonsReq.data?.seasons.find((x) => x.id === session.seasonId) ?? null;
  const st = session.settings;
  const eff = {
    correctPoints: st.correctPoints ?? global?.scoring.correctPoints,
    wrongPenalty: st.wrongPenalty ?? global?.scoring.wrongPenalty,
    noAnswerPenalty: st.noAnswerPenalty ?? global?.scoring.noAnswerPenalty,
    durationSeconds: st.durationSeconds ?? global?.timing.defaultDurationSeconds,
    allowNegative: st.allowNegative ?? global?.scoring.allowNegative,
  };
  const issues = check.data?.issues ?? [];
  const errorsCount = issues.filter((i) => i.level === "error").length;
  const canUnpublish = session.status === "ready" && (session.phase === "READY" || session.phase === null);
  const displayUrl = `/display/${session.id}?k=${encodeURIComponent(session.displayKey)}`;

  async function moveRound(index: number, dir: -1 | 1) {
    const order = rounds.map((r) => r.id);
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j], order[index]];
    const r = await run("rounds", () => send(`/api/admin/sessions/${session.id}/rounds`, "PUT", { order }));
    if (r) refresh();
  }

  async function deleteRound(r: RoundDetail) {
    const ok = await confirm({
      title: "Eliminare il round?",
      message: (
        <>
          <p>
            Il round <strong>{r.title}</strong> verrà eliminato insieme alle sue {plural(r.questions.length, "domanda inserita", "domande inserite")} e agli eventi programmati.
          </p>
          <p className="mt-2 text-sm text-white/60">Le domande restano nell&apos;archivio.</p>
        </>
      ),
      confirmLabel: "Elimina round",
      danger: true,
    });
    if (!ok) return;
    const res = await run(`delr-${r.id}`, () => send(`/api/admin/rounds/${r.id}`, "DELETE"), "Round eliminato");
    if (res) refresh();
  }

  async function openPreview(q: SessionQuestionItem, r: RoundDetail) {
    const base: PreviewBase = {
      type: q.type,
      text: q.text,
      category: q.category,
      difficulty: q.difficulty,
      presenter: q.presenter,
      options: q.options,
      durationSeconds: q.durationSeconds ?? r.durationSeconds ?? eff.durationSeconds ?? 15,
      mediaKind: (q.mediaKind as MediaKind | null) ?? null,
      mediaUrl: null,
      roundTitle: r.title,
    };
    setPreview(base);
    if (q.mediaKind && q.questionId && isAdmin) {
      try {
        const { question } = await get<{ question: QuestionRecord }>(`/api/admin/questions/${q.questionId}`);
        if (question.mediaId) {
          const m = await get<{ url: string | null }>(`/api/admin/media/${question.mediaId}`);
          setPreview((p) => (p && p.text === base.text ? { ...p, mediaUrl: m.url } : p));
        }
      } catch {
        // anteprima senza media: non bloccante
      }
    }
  }

  async function publish() {
    const ok = await confirm({
      title: "Pubblicare la serata?",
      message: (
        <div className="space-y-2 text-sm">
          <p>
            Pubblicando, le domande vengono <strong>congelate in una copia</strong> (snapshot): eventuali modifiche successive alle domande in archivio non
            cambieranno questa serata.
          </p>
          <p>Si bloccano anche punteggi, tempi e struttura dei round. Potrai annullare la pubblicazione solo finché la lobby non viene aperta.</p>
          {issues.some((i) => i.level === "warning") && <p className="text-[#ffe9a3]">Ci sono avvisi non bloccanti: controllali nella lista di verifica.</p>}
        </div>
      ),
      confirmLabel: "PUBBLICA",
    });
    if (!ok) return;
    setPublishErrors(null);
    try {
      await send(`/api/admin/sessions/${session.id}/publish`, "POST");
      toast("ok", "Serata pubblicata: pronta per la regia live");
      refresh();
      // Subito dopo la pubblicazione si propone di preparare le voci (stima e conferma: nulla parte da solo).
      void voicePrep.prepare({ kind: "session", sessionId: session.id }, "Voci della serata");
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && Array.isArray(e.details)) {
        setPublishErrors(e.details as PublishIssue[]);
        toast("error", "Pubblicazione bloccata: risolvi gli errori indicati");
      } else toast("error", errorMessage(e));
      check.reload();
    }
  }

  async function unpublish() {
    const ok = await confirm({
      title: "Annullare la pubblicazione?",
      message: "La serata torna in bozza e lo snapshot delle domande viene eliminato. Potrai modificarla e ripubblicarla.",
      confirmLabel: "Annulla pubblicazione",
      danger: true,
    });
    if (!ok) return;
    const r = await run("unpub", () => send(`/api/admin/sessions/${session.id}/unpublish`, "POST"), "Serata riportata in bozza");
    if (r) refresh();
  }

  async function removeSession() {
    const ok = await confirm({
      title: "Eliminare la serata?",
      message: `"${session.title}" verrà eliminata con tutti i round${session.status !== "draft" ? ", giocatori e risposte" : ""}. Le domande restano nell'archivio.`,
      confirmLabel: "Elimina",
      danger: true,
      typeToConfirm: session.status !== "draft" ? "ELIMINA" : undefined,
    });
    if (!ok) return;
    const r = await run("del", () => send(`/api/admin/sessions/${session.id}`, "DELETE"), "Serata eliminata");
    if (r) router.push("/admin/sessions");
  }

  async function archive() {
    const ok = await confirm({ title: "Archiviare la serata?", message: "Statistiche, classifiche e backup restano disponibili.", confirmLabel: "Archivia" });
    if (!ok) return;
    const r = await run("arc", () => send(`/api/admin/sessions/${session.id}/archive`, "POST"), "Serata archiviata");
    if (r) refresh();
  }

  const canDelete = isAdmin && (session.status === "draft" || (session.isTest && session.status !== "live"));

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/admin/sessions", label: "Serate" }}
        title={session.title}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={session.status} />
            {session.isTest && <TestBadge />}
            {session.phase && session.status !== "draft" && <Badge color="gold">{PHASE_LABEL[session.phase] ?? session.phase}</Badge>}
            <span>{fmtDateTime(session.scheduledAt)}</span>
            <span>
              · Codice <span className="font-mono font-bold text-gold">{session.code}</span>
            </span>
            {season && <span>· Stagione {season.name}</span>}
          </div>
        }
        actions={
          <>
            {isAdmin && session.status !== "archived" && (
              <Button variant="ghost" size="sm" onClick={() => setEditInfo(true)}>
                Modifica dati
              </Button>
            )}
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setDupOpen(true)}>
                Duplica
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" className="text-[#ff8098]" loading={busy === "del"} onClick={removeSession}>
                Elimina
              </Button>
            )}
          </>
        }
      />

      {session.description && <p className="-mt-2 max-w-3xl text-sm text-white/70">{session.description}</p>}

      {session.status !== "draft" && (
        <section className="rounded-2xl border-2 border-electric/50 bg-gradient-to-br from-[#0b2a55] to-[#1d0c30] p-4 md:p-5" aria-label="Serata pubblicata">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1 text-sm text-white/80">
              <p className="font-display text-xl text-white">
                {session.status === "live" ? "🔴 Serata in onda" : session.status === "ready" ? "✅ Serata pubblicata e pronta" : "Serata conclusa"}
              </p>
              <p className="mt-1">
                Pubblicata il {fmtDateTime(session.publishedAt)}. Le domande sono congelate in uno snapshot: le modifiche all&apos;archivio non toccano questa
                serata. L&apos;editor è in sola lettura.
              </p>
              {session.status === "ready" && (
                <p className="mt-1 text-white/60">
                  {canUnpublish ? "Per cambiare la struttura puoi annullare la pubblicazione (solo prima di aprire la lobby)." : "La lobby è già stata aperta: la struttura non si può più modificare."}
                </p>
              )}
              {(session.status === "live" || session.status === "ready") && (
                <p className="mt-1 text-white/60">
                  {session.online} giocatori online · {session.participants} iscritti
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:max-w-[55%] lg:justify-end">
              {(session.status === "ready" || session.status === "live") && (
                <LinkButton href={`/admin/sessions/${session.id}/live`} variant={session.status === "live" ? "danger" : "gold"} size="lg">
                  ▶ Regia live
                </LinkButton>
              )}
              {session.status === "ready" && (
                <LinkButton href={`/admin/sessions/${session.id}/rehearsal`} variant="violet">
                  Prova generale
                </LinkButton>
              )}
              {session.status !== "archived" && session.status !== "finished" && (
                <LinkButton href={displayUrl} newTab variant="primary">
                  📺 Schermo TV
                </LinkButton>
              )}
              {isAdmin && (session.status === "finished" || session.status === "archived" || session.status === "live") && (
                <LinkButton href={`/admin/sessions/${session.id}/stats`}>📊 Statistiche</LinkButton>
              )}
              {isAdmin && (
                <LinkButton href={`/api/admin/sessions/${session.id}/backup`} download>
                  ⬇ Backup JSON
                </LinkButton>
              )}
              {isAdmin && canUnpublish && (
                <Button variant="ghost" className="text-[#ff8098]" loading={busy === "unpub"} onClick={unpublish}>
                  Annulla pubblicazione
                </Button>
              )}
              {isAdmin && session.status === "finished" && (
                <Button variant="ghost" loading={busy === "arc"} onClick={archive}>
                  Archivia
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4 xl:order-1">
          {rounds.length > 0 && (
            <RunningOrderPanel
              key={`${JSON.stringify(st.runningOrder ?? {})}|${rounds.map((r) => r.id).join(",")}`}
              sessionId={session.id}
              rounds={rounds}
              runningOrder={st.runningOrder}
              defaultDuration={eff.durationSeconds ?? 15}
              scheduledAt={session.scheduledAt}
              readOnly={!isAdmin || session.status === "archived"}
              onSaved={refresh}
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl text-gold">
              Round <span className="text-white/50">({rounds.length})</span>
            </h2>
            {!readOnly && (
              <Button variant="gold" onClick={() => setRoundModal({ round: null })}>
                + Nuovo round
              </Button>
            )}
          </div>
          {rounds.length === 0 ? (
            <EmptyState title="Nessun round">
              {readOnly ? "Questa serata non ha round." : "Crea il primo round: per esempio un classico, un round con voto di categoria e la finale."}
            </EmptyState>
          ) : (
            rounds.map((r, i) => (
              <RoundCard
                key={r.id}
                sessionId={session.id}
                round={r}
                index={i}
                rounds={rounds}
                readOnly={readOnly}
                defs={defs}
                eventCounts={eventCounts}
                onMoveRound={(dir) => moveRound(i, dir)}
                onEdit={() => setRoundModal({ round: r })}
                onDelete={() => deleteRound(r)}
                onAddQuestions={() => setPicker(r)}
                onAddRandom={() => setRandomFor(r)}
                onPreview={(q) => openPreview(q, r)}
                onChanged={refresh}
              />
            ))
          )}
        </div>

        <aside className="space-y-4 xl:order-2">
          {isAdmin && isDraft && (
            <Panel
              title="Pubblicazione"
              actions={
                <Button size="sm" variant="ghost" loading={check.loading} onClick={check.reload}>
                  Verifica
                </Button>
              }
            >
              <p className="mb-3 text-xs text-white/60">
                Pubblicare congela una copia delle domande (snapshot) e blocca punteggi e struttura. Dopo la pubblicazione la serata è pronta per la regia
                live e la prova generale.
              </p>
              {check.error ? (
                <InfoNote tone="danger">{check.error}</InfoNote>
              ) : !check.data ? (
                <p className="text-sm text-white/60">Verifica in corso…</p>
              ) : issues.length === 0 ? (
                <InfoNote tone="ok">✓ Tutto pronto: nessun problema trovato.</InfoNote>
              ) : (
                <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1 text-sm" aria-label="Lista di verifica">
                  {issues.map((iss, k) => (
                    <li key={k} className="flex gap-2">
                      <span aria-hidden className={iss.level === "error" ? "text-flame" : "text-gold"}>
                        {iss.level === "error" ? "✕" : "!"}
                      </span>
                      <span className={iss.level === "error" ? "text-[#ffc2cd]" : "text-[#ffe9a3]"}>
                        <span className="sr-only">{iss.level === "error" ? "Errore: " : "Avviso: "}</span>
                        {iss.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {publishErrors && publishErrors.length > 0 && (
                <InfoNote tone="danger" className="mt-3">
                  Il server ha bloccato la pubblicazione: risolvi gli errori nella lista.
                </InfoNote>
              )}
              <Button variant="gold" size="lg" className="mt-4 w-full" disabled={!check.data || errorsCount > 0} onClick={publish}>
                PUBBLICA
              </Button>
              {errorsCount > 0 && <p className="mt-2 text-center text-xs text-white/55">{errorsCount === 1 ? "Risolvi 1 errore per poter pubblicare." : `Risolvi ${errorsCount} errori per poter pubblicare.`}</p>}
            </Panel>
          )}

          {isAdmin && session.status !== "archived" && (
            <Panel title="Voci dei presentatori">
              <VoicePrepBox
                key={voiceNonce}
                scope={{ kind: "session", sessionId: session.id }}
                title="Voci della serata"
                label="Voci della serata"
                hint="Domande e riserve, round, eventi e frasi fisse."
              />
            </Panel>
          )}

          <Panel
            title="Regole della serata"
            actions={
              isAdmin &&
              session.status !== "archived" &&
              session.status !== "finished" && (
                <Button size="sm" variant="ghost" onClick={() => setEditSettings(true)}>
                  Modifica
                </Button>
              )
            }
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {[
                ["Risposta corretta", eff.correctPoints !== undefined ? `+${eff.correctPoints} pt` : "-", st.correctPoints === undefined],
                ["Risposta errata", eff.wrongPenalty !== undefined ? (eff.wrongPenalty ? `−${eff.wrongPenalty} pt` : "0 pt") : "-", st.wrongPenalty === undefined],
                ["Nessuna risposta", eff.noAnswerPenalty !== undefined ? (eff.noAnswerPenalty ? `−${eff.noAnswerPenalty} pt` : "0 pt") : "-", st.noAnswerPenalty === undefined],
                ["Tempo", eff.durationSeconds !== undefined ? `${eff.durationSeconds} s` : "-", st.durationSeconds === undefined],
                ["Sotto zero", eff.allowNegative === undefined ? "-" : eff.allowNegative ? "Sì" : "No", st.allowNegative === undefined],
                ["Ingressi", st.joinLocked ? "Bloccati" : "Aperti", false],
                ["Ingresso tardivo", st.allowLateJoin === false ? "No" : "Sì", false],
                ["Eventi automatici", st.autoEvents === false ? "No" : "Sì", false],
                ["Scorrimento", st.advanceMode === "auto" ? "Automatico" : "Manuale", st.advanceMode === undefined],
              ].map(([k, v, inherited]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-white/50">{k}</dt>
                  <dd className="font-bold">
                    {v}
                    {inherited && <span className="ml-1 text-xs font-normal text-white/40">(predef.)</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {session.status !== "draft" && <p className="mt-3 text-xs text-white/50">Punteggi e tempi congelati alla pubblicazione.</p>}
          </Panel>

          <TeamsPanel session={session} canEdit={isAdmin} onChanged={refresh} />

          <Panel title="Eventi di Palmino">
            <p className="text-sm text-white/70">
              {scheduledTotal === 0 ? "Nessun evento programmato." : `${plural(scheduledTotal, "evento programmato", "eventi programmati")} sulle domande.`} Domanda misteriosa e Palmino decide si
              attivano solo dalla regia live.
            </p>
            {[...eventCounts.entries()].length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {[...eventCounts.entries()].map(([k, n]) => {
                  const d = defs.find((x) => x.key === k);
                  return (
                    <li key={k} className="flex justify-between gap-2">
                      <span>🌴 {d?.title ?? k}</span>
                      <span className={d && n > d.maxPerSession ? "font-bold text-[#ff8098]" : "text-white/60"}>
                        {n}
                        {d ? ` / max ${d.maxPerSession}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {st.palminoPool && st.palminoPool.length > 0 && (
              <p className="mt-2 text-xs text-white/55">
                Pool &laquo;Palmino decide&raquo;: {st.palminoPool.map((k) => defs.find((d) => d.key === k)?.title ?? k).join(", ")}
              </p>
            )}
          </Panel>

          {season && (
            <Panel title="Stagione">
              <p className="text-sm">
                <strong>{season.name}</strong>
                <br />
                <span className="text-white/60">Classifica: {AGGREGATION_LABEL[season.aggregation]}</span>
              </p>
            </Panel>
          )}
        </aside>
      </div>

      {editInfo && (
        <SessionInfoModal
          open
          onClose={() => setEditInfo(false)}
          title="Modifica dati serata"
          initial={sessionInfoFrom(session)}
          submitLabel="Salva"
          allowTestToggle={session.status === "draft"}
          onSubmit={async (body) => {
            await send(`/api/admin/sessions/${session.id}`, "PATCH", body);
            setEditInfo(false);
            toast("ok", "Dati della serata salvati");
            refresh();
          }}
        />
      )}
      {editSettings && (
        <SessionSettingsModal
          settings={session.settings}
          global={global}
          defs={defs}
          frozen={session.status !== "draft"}
          onClose={() => setEditSettings(false)}
          onSubmit={async (settings) => {
            await send(`/api/admin/sessions/${session.id}`, "PATCH", { settings });
            setEditSettings(false);
            toast("ok", "Regole salvate");
            refresh();
          }}
        />
      )}
      {roundModal && (
        <RoundFormModal
          round={roundModal.round}
          defaults={{ correctPoints: eff.correctPoints, wrongPenalty: eff.wrongPenalty, durationSeconds: eff.durationSeconds }}
          onClose={() => setRoundModal(null)}
          onSubmit={async (body) => {
            if (roundModal.round) await send(`/api/admin/rounds/${roundModal.round.id}`, "PATCH", body);
            else await send(`/api/admin/sessions/${session.id}/rounds`, "POST", body);
            toast("ok", roundModal.round ? "Round aggiornato" : "Round creato");
            setRoundModal(null);
            refresh();
          }}
        />
      )}
      {picker && (
        <QuestionPickerModal
          round={picker}
          usedQuestionIds={usedIds}
          onClose={() => setPicker(null)}
          onAdded={(n) => {
            setPicker(null);
            toast("ok", n === 1 ? "Domanda aggiunta" : `${n} domande aggiunte`);
            refresh();
          }}
        />
      )}
      {randomFor && (
        <RandomQuestionsModal
          round={randomFor}
          onClose={() => setRandomFor(null)}
          onAdded={(res) => {
            setRandomFor(null);
            const s = res.summary;
            const repeated = s.repeats + s.planned;
            const base = res.added === 1 ? "1 domanda aggiunta" : `${res.added} domande aggiunte`;
            toast(
              repeated > 0 || s.missing > 0 ? "info" : "ok",
              repeated > 0 || s.missing > 0
                ? `${base}: ${s.fresh} mai giocate${repeated ? `, ${repeated} ripetute` : ""}${s.missing ? `, ${s.missing} mancanti (archivio esaurito)` : ""}`
                : `${base}, tutte mai giocate`,
            );
            refresh();
          }}
        />
      )}
      {voicePrep.modal}
      {dupOpen && (
        <DuplicateSessionModal
          source={session}
          onClose={() => setDupOpen(false)}
          onDone={(nid) => {
            setDupOpen(false);
            router.push(`/admin/sessions/${nid}`);
          }}
        />
      )}
      <QuestionPreviewModal question={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
