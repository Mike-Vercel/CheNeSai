"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, EmptyState, Input, Select, useConfirm } from "@/components/ui";
import { qs, send, useApi, useRunner } from "../api";
import { ErrorBlock, LinkButton, LoadingBlock, MEDIA_ICON, PageHeader, Pager, PlayedBadge, Segmented, Stars } from "../common";
import { fmtStamp, LETTERS, PRESENTER_LABEL, QUESTION_STATUS, TYPE_LABEL, plural } from "../format";
import { QuestionPreviewModal, type PreviewBase } from "../QuestionPreviewModal";
import type { CategoryCount, QuestionRecord } from "../types";
import { usePregen } from "../voices/VoicePrep";
import { DIFFICULTY_LABEL, DIFFICULTY_LEVELS } from "@/lib/game-engine/difficulty";

const LIMIT = 25;
type StatusFilter = "" | "draft" | "approved" | "archived";

export function previewFromRecord(q: QuestionRecord, mediaUrl: string | null = null): PreviewBase {
  return {
    type: q.type,
    text: q.text,
    category: q.category,
    difficulty: q.difficulty,
    presenter: q.presenter,
    options: q.options,
    durationSeconds: q.durationSeconds ?? 15,
    mediaKind: (q.mediaKind as PreviewBase["mediaKind"]) ?? null,
    mediaUrl,
  };
}

export function QuestionBank({ initial }: { initial: { status: string; category: string; q: string; tag: string } }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const [status, setStatus] = useState<StatusFilter>((["draft", "approved", "archived"].includes(initial.status) ? initial.status : "") as StatusFilter);
  const [search, setSearch] = useState(initial.q);
  const [q, setQ] = useState(initial.q);
  const [category, setCategory] = useState(initial.category);
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [tagInput, setTagInput] = useState(initial.tag);
  const [tag, setTag] = useState(initial.tag);
  const [offset, setOffset] = useState(0);
  const [preview, setPreview] = useState<PreviewBase | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const voicePrep = usePregen();

  /** Voci delle domande approvate: quelle selezionate oppure tutte quelle del filtro corrente. */
  function generateVoices() {
    if (selected.size > 0) {
      void voicePrep.prepare({ kind: "questions", ids: [...selected] }, plural(selected.size, "domanda selezionata", "domande selezionate"));
      return;
    }
    void voicePrep.prepare(
      {
        kind: "questions",
        filter: {
          q: q || undefined,
          category: category || undefined,
          type: (type || undefined) as "single" | "multiple" | undefined,
          tag: tag || undefined,
          difficulty: difficulty ? Number(difficulty) : undefined,
        },
      },
      "Domande approvate del filtro",
    );
  }

  const cats = useApi<{ categories: CategoryCount[] }>("/api/admin/questions/categories");
  const drafts = useApi<{ total: number }>("/api/admin/questions?status=draft&limit=1");
  const list = useApi<{ items: QuestionRecord[]; total: number }>(
    `/api/admin/questions${qs({ status, q, category, type, difficulty, tag, limit: LIMIT, offset })}`,
  );

  function reloadAll() {
    list.reload();
    drafts.reload();
    cats.reload();
  }

  async function action(item: QuestionRecord, act: "duplicate" | "confirm" | "confirm_approve" | "approve" | "draft" | "archive") {
    if (act === "confirm" || act === "confirm_approve") {
      const correct = item.options.filter((o) => o.isCorrect);
      const ok = await confirm({
        title: act === "confirm_approve" ? "Confermare e approvare?" : "Confermare la risposta?",
        message: (
          <div className="space-y-2">
            <p className="font-bold">{item.text}</p>
            <ul className="space-y-1 text-sm">
              {item.options.map((o) => (
                <li key={o.position} className={o.isCorrect ? "font-extrabold text-[#5dffab]" : "text-white/60"}>
                  {LETTERS[o.position]}) {o.text} {o.isCorrect && "✓"}
                </li>
              ))}
            </ul>
            <p className="text-sm text-white/70">
              Confermi di aver verificato che {correct.length > 1 ? "le risposte corrette sono" : "la risposta corretta è"}{" "}
              <strong>{correct.map((o) => LETTERS[o.position]).join(", ")}</strong>?
            </p>
          </div>
        ),
        confirmLabel: act === "confirm_approve" ? "Confermo e approvo" : "Confermo",
      });
      if (!ok) return;
    }
    if (act === "archive") {
      const ok = await confirm({ title: "Archiviare la domanda?", message: "Non comparirà più tra le domande disponibili. Le serate già pubblicate non cambiano.", confirmLabel: "Archivia" });
      if (!ok) return;
    }
    const labels = { duplicate: "Domanda duplicata", confirm: "Risposta confermata", confirm_approve: "Confermata e approvata", approve: "Domanda approvata", draft: "Riportata in bozza", archive: "Domanda archiviata" };
    const r = await run(`${act}-${item.id}`, () => send<{ question?: QuestionRecord }>(`/api/admin/questions/${item.id}/action`, "POST", { action: act }), labels[act]);
    if (r) {
      if (act === "duplicate" && r.question) router.push(`/admin/questions/${r.question.id}`);
      else reloadAll();
    }
  }

  async function remove(item: QuestionRecord) {
    const ok = await confirm({
      title: "Eliminare la domanda?",
      message: (
        <>
          <p className="font-bold">{item.text}</p>
          <p className="mt-2 text-sm text-white/60">
            Le serate già giocate restano ricostruibili grazie alle copie congelate. Se la domanda è in una serata in preparazione, toglila prima da lì.
          </p>
        </>
      ),
      confirmLabel: "Elimina",
      danger: true,
    });
    if (!ok) return;
    const r = await run(`del-${item.id}`, () => send(`/api/admin/questions/${item.id}`, "DELETE"), "Domanda eliminata");
    if (r) reloadAll();
  }

  const items = list.data?.items ?? [];
  const exportQs = qs({ status, category, q });
  const draftCount = drafts.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Domande"
        subtitle="Archivio delle domande di CHE NE SAI?!"
        actions={
          <>
            <LinkButton href="/admin/questions/new" variant="gold">
              + Nuova domanda
            </LinkButton>
            <LinkButton href="/admin/questions/import">📥 Importa</LinkButton>
            <LinkButton href={`/api/admin/questions/export${exportQs ? `${exportQs}&` : "?"}format=json`} download>
              ⬇ JSON
            </LinkButton>
            <LinkButton href={`/api/admin/questions/export${exportQs ? `${exportQs}&` : "?"}format=csv`} download>
              ⬇ CSV
            </LinkButton>
          </>
        }
      />

      {draftCount > 0 && status !== "draft" && (
        <button
          type="button"
          onClick={() => {
            setStatus("draft");
            setOffset(0);
          }}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-left text-sm font-bold text-[#ffe9a3] hover:bg-gold/15"
        >
          <span>
            ⚠ {draftCount} {draftCount === 1 ? "domanda in bozza attende" : "domande in bozza attendono"} la conferma della risposta corretta.
          </span>
          <span className="shrink-0 underline">Da confermare →</span>
        </button>
      )}

      <div className="space-y-3 rounded-2xl border border-white/10 bg-[#1d0c30] p-3">
        <Segmented
          label="Stato"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setOffset(0);
          }}
          options={[
            { value: "", label: "Attive" },
            { value: "draft", label: `Da confermare${draftCount ? ` (${draftCount})` : ""}` },
            { value: "approved", label: "Approvate" },
            { value: "archived", label: "Archiviate" },
          ]}
        />
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1.25fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setQ(search.trim());
            setTag(tagInput.trim());
          }}
        >
          <Input aria-label="Cerca" placeholder="Cerca nel testo o nelle risposte…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select
            aria-label="Categoria"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Tutte le categorie</option>
            {(cats.data?.categories ?? []).map((c) => (
              <option key={c.category} value={c.category}>
                {c.category} ({c.count})
              </option>
            ))}
          </Select>
          <Select
            aria-label="Tipo"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Ogni tipo</option>
            <option value="single">Singola</option>
            <option value="multiple">Multipla</option>
          </Select>
          <Select
            aria-label="Difficoltà"
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Ogni difficoltà</option>
            {DIFFICULTY_LEVELS.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </Select>
          <Input aria-label="Tag" placeholder="Tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
          <Button type="submit" variant="ghost">
            Filtra
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#140822] px-3 py-2 text-sm">
        <span className="font-bold text-white/80">🎙️ Voci ElevenLabs</span>
        <span className="text-white/55">
          {selected.size > 0 ? `${plural(selected.size, "domanda selezionata", "domande selezionate")} (solo approvate)` : "nessuna selezione: tutte le approvate del filtro corrente"}
        </span>
        <span className="flex-1" />
        {selected.size > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Deseleziona
          </Button>
        )}
        <Button size="sm" variant="violet" loading={voicePrep.running} onClick={generateVoices}>
          Genera voci
        </Button>
      </div>

      {list.error ? (
        <ErrorBlock message={list.error} onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="Nessuna domanda trovata">
          <Link href="/admin/questions/new" className="font-bold text-gold underline">
            Crea una domanda
          </Link>{" "}
          oppure{" "}
          <Link href="/admin/questions/import" className="font-bold text-gold underline">
            importale da JSON/CSV
          </Link>
          .
        </EmptyState>
      ) : (
        <ul className="space-y-2" aria-busy={list.loading}>
          {items.map((it) => {
            const st = QUESTION_STATUS[it.status];
            const correct = it.options.filter((o) => o.isCorrect);
            return (
              <li key={it.id} className="rounded-2xl border border-white/10 bg-[#1d0c30] p-3 md:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  {it.status === "approved" && (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-[#ffd43b]"
                      aria-label={`Seleziona per le voci: ${it.text}`}
                      checked={selected.has(it.id)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(it.id);
                          else next.delete(it.id);
                          return next;
                        })
                      }
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/questions/${it.id}`} className="block break-words font-bold leading-snug hover:text-gold">
                      {it.text}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-white/60">
                      <Badge color={st.color}>{st.label}</Badge>
                      {it.answerConfirmed ? <Badge color="green">✓ Risposta confermata</Badge> : <Badge color="red">Risposta da confermare</Badge>}
                      <Badge color="gold">{it.category}</Badge>
                      <Badge>{TYPE_LABEL[it.type]}</Badge>
                      <Stars value={it.difficulty} />
                      <span>{PRESENTER_LABEL[it.presenter]}</span>
                      {it.mediaKind && <span title={it.mediaLabel ?? ""}>{MEDIA_ICON[it.mediaKind]}</span>}
                      {it.tags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="rounded-full bg-white/5 px-2 py-0.5 hover:bg-white/15"
                          onClick={() => {
                            setTag(t);
                            setTagInput(t);
                            setOffset(0);
                          }}
                        >
                          #{t}
                        </button>
                      ))}
                      {it.source === "import" && <Badge color="violet">Importata</Badge>}
                      <PlayedBadge lastPlayedAt={it.lastPlayedAt} timesPlayed={it.timesPlayed} />
                      {it.usedInSessions > 0 && <span>In {plural(it.usedInSessions, "serata", "serate")}</span>}
                      <span className="text-white/40">agg. {fmtStamp(it.updatedAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-[#5dffab]">
                      <span className="font-bold">Corrett{correct.length > 1 ? "e" : "a"}:</span> {correct.map((o) => `${LETTERS[o.position]}) ${o.text}`).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 lg:max-w-[22rem] lg:justify-end">
                    {!it.answerConfirmed && it.status !== "archived" && (
                      <Button size="sm" variant="success" loading={busy === `confirm_approve-${it.id}`} onClick={() => action(it, "confirm_approve")}>
                        ✓ Conferma e approva
                      </Button>
                    )}
                    {it.answerConfirmed && it.status === "draft" && (
                      <Button size="sm" variant="success" loading={busy === `approve-${it.id}`} onClick={() => action(it, "approve")}>
                        Approva
                      </Button>
                    )}
                    <LinkButton href={`/admin/questions/${it.id}`} size="sm" variant="ghost">
                      Modifica
                    </LinkButton>
                    <Button size="sm" variant="ghost" onClick={() => setPreview(previewFromRecord(it))}>
                      👁
                      <span className="sr-only">Anteprima</span>
                    </Button>
                    <Button size="sm" variant="ghost" loading={busy === `duplicate-${it.id}`} onClick={() => action(it, "duplicate")}>
                      Duplica
                    </Button>
                    {it.status === "approved" && (
                      <Button size="sm" variant="ghost" loading={busy === `draft-${it.id}`} onClick={() => action(it, "draft")}>
                        In bozza
                      </Button>
                    )}
                    {it.status !== "archived" ? (
                      <Button size="sm" variant="ghost" loading={busy === `archive-${it.id}`} onClick={() => action(it, "archive")}>
                        Archivia
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" loading={busy === `draft-${it.id}`} onClick={() => action(it, "draft")}>
                        Ripristina
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-[#ff8098]" loading={busy === `del-${it.id}`} onClick={() => remove(it)}>
                      Elimina
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager offset={offset} limit={LIMIT} total={list.data?.total ?? 0} onChange={setOffset} />
      <QuestionPreviewModal question={preview} onClose={() => setPreview(null)} />
      {voicePrep.modal}
    </div>
  );
}
