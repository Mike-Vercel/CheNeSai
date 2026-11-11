"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Field, Input, Panel, Select, Textarea, useConfirm, useToast } from "@/components/ui";
import { PRESENTERS, type MediaKind, type Presenter, type QuestionType } from "@/lib/game-engine/types";
import { errorMessage, fieldErrors, send, useApi } from "../api";
import { Checkbox, ErrorBlock, InfoNote, LinkButton, LoadingBlock, MEDIA_ICON, PageHeader, PlayedBadge } from "../common";
import { ANSWER_COLORS, fmtDuration, fmtStamp, intOrNull, LETTERS, PRESENTER_LABEL, QUESTION_STATUS } from "../format";
import { MediaPickerModal } from "../media/MediaPickerModal";
import { QuestionPreviewModal, type PreviewBase } from "../QuestionPreviewModal";
import type { CategoryCount, MediaRecord, QuestionRecord } from "../types";

interface QForm {
  type: QuestionType;
  text: string;
  category: string;
  difficulty: number;
  tags: string;
  presenter: Presenter;
  options: { text: string; isCorrect: boolean }[];
  correctPoints: string;
  wrongPenalty: string;
  noAnswerPenalty: string;
  durationSeconds: string;
  partialScoring: boolean;
  mediaId: string | null;
  audioStartSec: string;
  audioDurationSec: string;
  audioPlays: number;
  animation: string;
  notes: string;
  status: "draft" | "approved" | "archived";
  answerConfirmed: boolean;
}

const s = (n: number | null) => (n === null ? "" : String(n));
const secOf = (ms: number | null) => (ms === null ? "" : String(Math.round(ms / 100) / 10));

function toForm(q: QuestionRecord | null): QForm {
  if (!q) {
    return {
      type: "single",
      text: "",
      category: "",
      difficulty: 2,
      tags: "",
      presenter: "professore",
      options: [0, 1, 2, 3].map((i) => ({ text: "", isCorrect: i === 0 })),
      correctPoints: "",
      wrongPenalty: "",
      noAnswerPenalty: "",
      durationSeconds: "",
      partialScoring: false,
      mediaId: null,
      audioStartSec: "0",
      audioDurationSec: "",
      audioPlays: 1,
      animation: "",
      notes: "",
      status: "draft",
      answerConfirmed: false,
    };
  }
  const opts = [...q.options].sort((a, b) => a.position - b.position).map((o) => ({ text: o.text, isCorrect: o.isCorrect }));
  while (opts.length < 4) opts.push({ text: "", isCorrect: false });
  return {
    type: q.type,
    text: q.text,
    category: q.category,
    difficulty: q.difficulty,
    tags: q.tags.join(", "),
    presenter: q.presenter,
    options: opts.slice(0, 4),
    correctPoints: s(q.correctPoints),
    wrongPenalty: s(q.wrongPenalty),
    noAnswerPenalty: s(q.noAnswerPenalty),
    durationSeconds: s(q.durationSeconds),
    partialScoring: q.partialScoring,
    mediaId: q.mediaId,
    audioStartSec: secOf(q.audioStartMs),
    audioDurationSec: secOf(q.audioDurationMs),
    audioPlays: q.audioPlays,
    animation: q.animation ?? "",
    notes: q.notes ?? "",
    status: q.status,
    answerConfirmed: q.answerConfirmed,
  };
}

export function QuestionEditor({ id }: { id: string | null }) {
  const req = useApi<{ question: QuestionRecord }>(id ? `/api/admin/questions/${id}` : null);
  if (id && req.error && !req.data) return <ErrorBlock message={req.error} onRetry={req.reload} />;
  if (id && !req.data) return <LoadingBlock label="Caricamento domanda…" />;
  const q = req.data?.question ?? null;
  return <QuestionForm key={q ? `${q.id}-${q.version}` : "new"} question={q} />;
}

function QuestionForm({ question }: { question: QuestionRecord | null }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState<QForm>(() => toForm(question));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "stay" | "back">(null);
  const [answersTouched, setAnswersTouched] = useState(false);
  const [pickMedia, setPickMedia] = useState(false);
  const [preview, setPreview] = useState<PreviewBase | null>(null);
  const cats = useApi<{ categories: CategoryCount[] }>("/api/admin/questions/categories");
  const media = useApi<{ media: MediaRecord; url: string | null }>(f.mediaId ? `/api/admin/media/${f.mediaId}` : null);
  const mediaRec = f.mediaId && media.data?.media.id === f.mediaId ? media.data.media : null;
  const mediaUrl = f.mediaId && media.data?.media.id === f.mediaId ? media.data.url : null;
  const isNew = !question;

  function set<K extends keyof QForm>(k: K, v: QForm[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  /** Ogni modifica a risposte o tipo richiede una nuova conferma esplicita. */
  function setAnswers(options: QForm["options"], type: QuestionType = f.type) {
    setF((p) => ({ ...p, options, type, answerConfirmed: false, status: p.status === "approved" ? "draft" : p.status }));
    if (f.answerConfirmed) setAnswersTouched(true);
  }

  function toggleCorrect(i: number) {
    if (f.type === "single") setAnswers(f.options.map((o, j) => ({ ...o, isCorrect: j === i })));
    else setAnswers(f.options.map((o, j) => (j === i ? { ...o, isCorrect: !o.isCorrect } : o)));
  }

  function changeType(t: QuestionType) {
    let opts = f.options;
    if (t === "single") {
      const first = opts.findIndex((o) => o.isCorrect);
      opts = opts.map((o, j) => ({ ...o, isCorrect: j === (first < 0 ? 0 : first) }));
    }
    setAnswers(opts, t);
    if (t === "single") set("partialScoring", false);
  }

  function body() {
    const startMs = Math.round(Number(f.audioStartSec || 0) * 1000);
    const durMs = f.audioDurationSec.trim() ? Math.round(Number(f.audioDurationSec) * 1000) : null;
    return {
      type: f.type,
      text: f.text.trim(),
      category: f.category.trim(),
      difficulty: f.difficulty,
      tags: f.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      presenter: f.presenter,
      options: f.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
      correctPoints: intOrNull(f.correctPoints),
      wrongPenalty: intOrNull(f.wrongPenalty),
      noAnswerPenalty: intOrNull(f.noAnswerPenalty),
      durationSeconds: intOrNull(f.durationSeconds),
      partialScoring: f.type === "multiple" && f.partialScoring,
      mediaId: f.mediaId,
      audioStartMs: Number.isFinite(startMs) ? startMs : 0,
      audioDurationMs: durMs !== null && Number.isFinite(durMs) ? durMs : null,
      audioPlays: f.audioPlays,
      animation: f.animation.trim() || null,
      notes: f.notes.trim() || null,
      status: f.status,
      answerConfirmed: f.answerConfirmed,
    };
  }

  async function save(mode: "stay" | "back") {
    setSaving(mode);
    setErrors({});
    setGeneral(null);
    try {
      const r = question
        ? await send<{ question: QuestionRecord }>(`/api/admin/questions/${question.id}`, "PUT", body())
        : await send<{ question: QuestionRecord }>("/api/admin/questions", "POST", body());
      toast("ok", isNew ? "Domanda creata" : "Domanda salvata");
      if (mode === "back") router.push("/admin/questions");
      else if (isNew) router.replace(`/admin/questions/${r.question.id}`);
      else {
        setF(toForm(r.question));
        setAnswersTouched(false);
      }
    } catch (e) {
      const fe = fieldErrors(e);
      setErrors(fe);
      setGeneral(Object.keys(fe).length ? "Alcuni campi non sono validi: controlla i messaggi in rosso." : errorMessage(e));
      toast("error", Object.keys(fe).length ? "Domanda non valida" : errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  function openPreview() {
    setPreview({
      type: f.type,
      text: f.text.trim() || "Testo della domanda",
      category: f.category.trim() || "Categoria",
      difficulty: f.difficulty,
      presenter: f.presenter,
      options: f.options.map((o, i) => ({ position: i, text: o.text.trim() || `Risposta ${LETTERS[i]}`, isCorrect: o.isCorrect })),
      durationSeconds: intOrNull(f.durationSeconds) ?? 15,
      mediaKind: (mediaRec?.kind ?? null) as MediaKind | null,
      mediaUrl,
    });
  }

  async function remove() {
    if (!question) return;
    const ok = await confirm({
      title: "Eliminare la domanda?",
      message: "Le serate già giocate restano ricostruibili grazie alle copie congelate. Se è in una serata in preparazione, toglila prima da lì.",
      confirmLabel: "Elimina",
      danger: true,
    });
    if (!ok) return;
    try {
      await send(`/api/admin/questions/${question.id}`, "DELETE");
      toast("ok", "Domanda eliminata");
      router.push("/admin/questions");
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  const err = (k: string) => errors[k] ?? null;
  const optionsError = errors.options ?? Object.entries(errors).find(([k]) => k.startsWith("options."))?.[1] ?? null;
  const correctCount = f.options.filter((o) => o.isCorrect).length;
  const kind = (mediaRec?.kind ?? null) as MediaKind | null;
  const timed = kind === "audio" || kind === "video";
  const st = QUESTION_STATUS[f.status];

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/admin/questions", label: "Domande" }}
        title={isNew ? "Nuova domanda" : "Modifica domanda"}
        subtitle={
          question && (
            <span className="flex flex-wrap items-center gap-2">
              <Badge color={QUESTION_STATUS[question.status].color}>{QUESTION_STATUS[question.status].label}</Badge>
              <span>
                Versione {question.version} · aggiornata {fmtStamp(question.updatedAt)}
              </span>
              {question.source === "import" && <Badge color="violet">Importata</Badge>}
              <PlayedBadge lastPlayedAt={question.lastPlayedAt} timesPlayed={question.timesPlayed} />
            </span>
          )
        }
        actions={
          <>
            <Button variant="ghost" onClick={openPreview}>
              👁 Anteprima TV + smartphone
            </Button>
            {question && (
              <Button variant="ghost" className="text-[#ff8098]" onClick={remove}>
                Elimina
              </Button>
            )}
          </>
        }
      />

      {question && question.usedInSessions > 0 && (
        <InfoNote>
          Questa domanda è usata in {question.usedInSessions} serate. Le serate già pubblicate usano una copia congelata: le modifiche valgono solo per le serate
          ancora in preparazione.
        </InfoNote>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save("stay");
        }}
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="min-w-0 space-y-5">
          <Panel title="Domanda">
            <div className="space-y-3">
              <Field label="Testo della domanda" error={err("text")} hint={`${f.text.length}/400 caratteri`}>
                {(fid) => <Textarea id={fid} required maxLength={400} value={f.text} onChange={(e) => set("text", e.target.value)} placeholder="Es. Qual è la capitale dell'Australia?" />}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Categoria" error={err("category")} className="lg:col-span-2">
                  {(fid) => (
                    <>
                      <Input id={fid} required minLength={2} maxLength={60} list="qz-categories" value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Es. Geografia" />
                      <datalist id="qz-categories">
                        {(cats.data?.categories ?? []).map((c) => (
                          <option key={c.category} value={c.category} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="Difficoltà" error={err("difficulty")}>
                  {(fid) => (
                    <Select id={fid} value={f.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))}>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>
                          {d} · {["Facilissima", "Facile", "Media", "Difficile", "Difficilissima"][d - 1]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Presentatore" error={err("presenter")}>
                  {(fid) => (
                    <Select id={fid} value={f.presenter} onChange={(e) => set("presenter", e.target.value as Presenter)}>
                      {PRESENTERS.map((p) => (
                        <option key={p} value={p}>
                          {PRESENTER_LABEL[p]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <Field label="Tag" error={err("tags") ?? Object.entries(errors).find(([k]) => k.startsWith("tags."))?.[1] ?? null} hint="Separati da virgola, es. demo, anni 80, facile">
                {(fid) => <Input id={fid} value={f.tags} onChange={(e) => set("tags", e.target.value)} />}
              </Field>
            </div>
          </Panel>

          <Panel title="Risposte">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-white/80">Tipo:</span>
              <div role="radiogroup" aria-label="Tipo di domanda" className="flex gap-1 rounded-xl border border-white/10 bg-[#0f0519] p-1">
                {(["single", "multiple"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={f.type === t}
                    onClick={() => f.type !== t && changeType(t)}
                    className={clsx("rounded-lg px-3 py-1.5 text-sm font-bold", f.type === t ? "bg-gold text-ink" : "text-white/70 hover:bg-white/10")}
                  >
                    {t === "single" ? "Risposta singola" : "Selezione multipla"}
                  </button>
                ))}
              </div>
              <span className="text-xs text-white/55">{f.type === "single" ? "Esattamente 1 risposta corretta." : "Almeno 2 risposte corrette."}</span>
            </div>
            <fieldset className="space-y-2">
              <legend className="sr-only">Le quattro risposte</legend>
              {f.options.map((o, i) => (
                <div key={i} className={clsx("flex items-center gap-2 rounded-xl border-2 p-1.5 pr-3 transition", o.isCorrect ? "border-lime bg-lime/10" : "border-white/10")}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg font-display text-xl text-white" style={{ background: ANSWER_COLORS[i] }} aria-hidden>
                    {LETTERS[i]}
                  </span>
                  <Input
                    aria-label={`Risposta ${LETTERS[i]}`}
                    className="min-w-0 flex-1"
                    required
                    maxLength={120}
                    value={o.text}
                    onChange={(e) => setAnswers(f.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    aria-invalid={!!err(`options.${i}.text`)}
                  />
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-bold">
                    <input
                      type={f.type === "single" ? "radio" : "checkbox"}
                      name="correct"
                      className="h-5 w-5 accent-[#00d46a]"
                      checked={o.isCorrect}
                      onChange={() => toggleCorrect(i)}
                    />
                    <span className={o.isCorrect ? "text-[#5dffab]" : "text-white/60"}>Corretta</span>
                  </label>
                </div>
              ))}
            </fieldset>
            {optionsError && <p className="mt-2 text-sm font-bold text-[#ff8098]">{optionsError}</p>}
            {f.type === "multiple" && (
              <div className="mt-3">
                <Checkbox
                  checked={f.partialScoring}
                  onChange={(v) => set("partialScoring", v)}
                  label="Punteggio parziale"
                  hint="Chi seleziona solo una parte delle risposte giuste (senza errori) prende una quota dei punti."
                />
              </div>
            )}
          </Panel>

          <Panel title="Media (facoltativo)">
            {f.mediaId ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {kind ? MEDIA_ICON[kind] : "📎"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{mediaRec?.label ?? question?.mediaLabel ?? "Media selezionato"}</p>
                    {mediaRec && (
                      <p className="text-xs text-white/55">
                        {[mediaRec.artist, mediaRec.durationMs ? `durata ${fmtDuration(mediaRec.durationMs)}` : null].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPickMedia(true)}>
                    Cambia
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="text-[#ff8098]" onClick={() => set("mediaId", null)}>
                    Rimuovi
                  </Button>
                </div>
                {mediaUrl && kind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmato temporaneo
                  <img src={mediaUrl} alt={mediaRec?.label ?? ""} className="max-h-56 rounded-xl border border-white/10 object-contain" />
                )}
                {mediaUrl && kind === "audio" && <audio controls src={mediaUrl} className="w-full" />}
                {mediaUrl && kind === "video" && <video controls src={mediaUrl} className="max-h-64 w-full rounded-xl bg-black" />}
                {timed && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Inizio clip (secondi)" error={err("audioStartMs")} hint="Salvato in millisecondi">
                      {(fid) => <Input id={fid} type="number" min={0} step={0.1} value={f.audioStartSec} onChange={(e) => set("audioStartSec", e.target.value)} />}
                    </Field>
                    <Field label="Durata clip (secondi)" error={err("audioDurationMs")} hint="Vuoto = fino alla fine (min 1 s)">
                      {(fid) => <Input id={fid} type="number" min={1} step={0.1} value={f.audioDurationSec} onChange={(e) => set("audioDurationSec", e.target.value)} />}
                    </Field>
                    <Field label="Riproduzioni" error={err("audioPlays")}>
                      {(fid) => (
                        <Select id={fid} value={f.audioPlays} onChange={(e) => set("audioPlays", Number(e.target.value))}>
                          {[1, 2, 3].map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? "volta" : "volte"}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1 text-sm text-white/60">Nessun media. Per i round musicali, immagini o video scegli un file dalla libreria media.</p>
                <Button type="button" variant="ghost" onClick={() => setPickMedia(true)}>
                  Scegli dalla libreria
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="Punteggio e tempo (facoltativi)">
            <p className="mb-3 text-xs text-white/55">Lascia vuoto per ereditare i valori del round, della serata o le impostazioni globali.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Punti se corretta" error={err("correctPoints")}>
                {(fid) => <Input id={fid} type="number" min={0} max={100000} placeholder="Eredita" value={f.correctPoints} onChange={(e) => set("correctPoints", e.target.value)} />}
              </Field>
              <Field label="Penalità se errata" error={err("wrongPenalty")}>
                {(fid) => <Input id={fid} type="number" min={0} max={100000} placeholder="Eredita" value={f.wrongPenalty} onChange={(e) => set("wrongPenalty", e.target.value)} />}
              </Field>
              <Field label="Penalità senza risposta" error={err("noAnswerPenalty")}>
                {(fid) => <Input id={fid} type="number" min={0} max={100000} placeholder="Eredita" value={f.noAnswerPenalty} onChange={(e) => set("noAnswerPenalty", e.target.value)} />}
              </Field>
              <Field label="Secondi per rispondere" error={err("durationSeconds")}>
                {(fid) => <Input id={fid} type="number" min={3} max={120} placeholder="Eredita" value={f.durationSeconds} onChange={(e) => set("durationSeconds", e.target.value)} />}
              </Field>
            </div>
          </Panel>

          <Panel title="Note e animazione">
            <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
              <Field label="Animazione (facoltativa)" error={err("animation")} hint="Nome dell'effetto di entrata sullo schermo TV">
                {(fid) => <Input id={fid} maxLength={40} value={f.animation} onChange={(e) => set("animation", e.target.value)} />}
              </Field>
              <Field label="Note interne / fonte" error={err("notes")} hint="Mai mostrate ai giocatori: utile per indicare dove hai verificato la risposta.">
                {(fid) => <Textarea id={fid} className="min-h-20" maxLength={2000} value={f.notes} onChange={(e) => set("notes", e.target.value)} />}
              </Field>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Panel title="Verifica e stato">
            <div className="space-y-3">
              <div className={clsx("rounded-xl border-2 p-3", f.answerConfirmed ? "border-lime bg-lime/10" : "border-gold/60 bg-gold/10")}>
                <Checkbox
                  checked={f.answerConfirmed}
                  onChange={(v) => {
                    set("answerConfirmed", v);
                    if (!v && f.status === "approved") set("status", "draft");
                    if (v) setAnswersTouched(false);
                  }}
                  label="Confermo che la risposta corretta è verificata"
                  hint={`Corrett${correctCount > 1 ? "e" : "a"}: ${f.options.map((o, i) => (o.isCorrect ? LETTERS[i] : null)).filter(Boolean).join(", ") || "nessuna"}`}
                />
                {err("answerConfirmed") && <p className="mt-2 text-xs font-bold text-[#ff8098]">{err("answerConfirmed")}</p>}
              </div>
              {answersTouched && !f.answerConfirmed && <InfoNote tone="warn">Hai modificato le risposte: la conferma è stata tolta, verifica di nuovo.</InfoNote>}
              <Field label="Stato" error={err("status")} hint={f.answerConfirmed ? undefined : "Per approvare serve la conferma della risposta."}>
                {(fid) => (
                  <Select id={fid} value={f.status} onChange={(e) => set("status", e.target.value as QForm["status"])}>
                    <option value="draft">Bozza</option>
                    <option value="approved" disabled={!f.answerConfirmed}>
                      Approvata (utilizzabile nelle serate)
                    </option>
                    <option value="archived">Archiviata</option>
                  </Select>
                )}
              </Field>
              <p className="text-xs text-white/55">
                Stato attuale: <Badge color={st.color}>{st.label}</Badge>. Solo le domande approvate si possono inserire e pubblicare in una serata.
              </p>
              {general && <InfoNote tone="danger">{general}</InfoNote>}
              <div className="flex flex-col gap-2">
                <Button type="submit" variant="gold" size="lg" loading={saving === "stay"} disabled={saving !== null}>
                  {isNew ? "Crea domanda" : "Salva"}
                </Button>
                <Button type="button" variant="ghost" loading={saving === "back"} disabled={saving !== null} onClick={() => save("back")}>
                  Salva e torna all&apos;elenco
                </Button>
                <LinkButton href="/admin/questions" variant="ghost" size="sm">
                  Annulla
                </LinkButton>
              </div>
            </div>
          </Panel>
        </aside>
      </form>

      {pickMedia && (
        <MediaPickerModal
          onClose={() => setPickMedia(false)}
          onPick={(m) => {
            set("mediaId", m.id);
            setPickMedia(false);
          }}
        />
      )}
      <QuestionPreviewModal question={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
