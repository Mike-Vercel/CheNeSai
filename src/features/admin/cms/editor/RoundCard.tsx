"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { Badge, Button, useConfirm } from "@/components/ui";
import { Character } from "@/features/game/components/brand";
import { eventRoundKind, isCategoryRound } from "@/lib/game-engine/types";
import { send, useRunner } from "../api";
import { MEDIA_ICON, MiniSelect, Stars } from "../common";
import { LETTERS, plural, PRESENTER_LABEL, ROUND_KIND, TYPE_LABEL } from "../format";
import type { EventDefinition, RoundDetail, SessionQuestionItem } from "../types";

interface Props {
  sessionId: string;
  round: RoundDetail;
  index: number;
  rounds: RoundDetail[];
  readOnly: boolean;
  defs: EventDefinition[];
  eventCounts: Map<string, number>;
  onMoveRound: (dir: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddQuestions: () => void;
  onAddRandom: () => void;
  onPreview: (q: SessionQuestionItem) => void;
  onChanged: () => void;
}

/** Sposta `id` di una posizione tra gli elementi dello stesso gruppo; restituisce il nuovo ordine completo. */
function moveInGroup(list: SessionQuestionItem[], id: string, dir: -1 | 1, same: (a: SessionQuestionItem, b: SessionQuestionItem) => boolean) {
  const i = list.findIndex((q) => q.id === id);
  if (i < 0) return null;
  let j = i + dir;
  while (j >= 0 && j < list.length && !same(list[i], list[j])) j += dir;
  if (j < 0 || j >= list.length) return null;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((q) => q.id);
}

function schedulableFor(defs: EventDefinition[], kind: RoundDetail["kind"]) {
  return defs.filter((d) => d.enabled && d.type !== "mystery_question" && d.type !== "palmino_decides" && d.allowedRoundKinds.includes(eventRoundKind(kind)));
}

export function RoundCard({ sessionId, round, index, rounds, readOnly, defs, eventCounts, onMoveRound, onEdit, onDelete, onAddQuestions, onAddRandom, onPreview, onChanged }: Props) {
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const kind = ROUND_KIND[round.kind];
  const isVote = isCategoryRound(round.kind);
  const isWheel = round.kind === "category_wheel";
  const questions = [...round.questions].sort((a, b) => a.position - b.position);
  const playable = questions.filter((q) => !q.isReserve);
  const reserves = questions.filter((q) => q.isReserve);
  const eventDefs = schedulableFor(defs, round.kind);
  const groupOf = (q: SessionQuestionItem) => (q.isReserve ? "reserve" : isVote ? (q.voteOptionId ?? "none") : "main");

  async function reorder(q: SessionQuestionItem, dir: -1 | 1) {
    const order = moveInGroup(questions, q.id, dir, (a, b) => groupOf(a) === groupOf(b));
    if (!order) return;
    const r = await run(`mv-${q.id}`, () => send(`/api/admin/rounds/${round.id}/questions`, "PUT", { order }));
    if (r) onChanged();
  }

  async function moveTo(q: SessionQuestionItem, targetId: string) {
    const target = rounds.find((r) => r.id === targetId);
    if (!target) return;
    const order = [...[...target.questions].sort((a, b) => a.position - b.position).map((x) => x.id), q.id];
    const r = await run(
      `to-${q.id}`,
      () => send(`/api/admin/rounds/${target.id}/questions`, "PUT", { order }),
      isCategoryRound(target.kind) ? `Spostata in "${target.title}": assegnale una categoria` : `Spostata in "${target.title}"`,
    );
    if (r) onChanged();
  }

  async function patch(q: SessionQuestionItem, body: { voteOptionId?: string | null; isReserve?: boolean }) {
    const r = await run(`p-${q.id}`, () => send(`/api/admin/session-questions/${q.id}`, "PATCH", body));
    if (r) onChanged();
  }

  async function remove(q: SessionQuestionItem) {
    const ok = await confirm({
      title: "Togliere la domanda dal round?",
      message: (
        <>
          <p className="font-bold">&laquo;{q.text}&raquo;</p>
          <p className="mt-2 text-sm text-white/60">La domanda resta nell&apos;archivio; viene rimosso anche l&apos;eventuale evento programmato.</p>
        </>
      ),
      confirmLabel: "Togli dal round",
      danger: true,
    });
    if (!ok) return;
    const r = await run(`rm-${q.id}`, () => send(`/api/admin/session-questions/${q.id}`, "DELETE"), "Domanda tolta dal round");
    if (r) onChanged();
  }

  async function setEvent(q: SessionQuestionItem, key: string) {
    if (!key) {
      if (!q.scheduledEvent) return;
      const ev = q.scheduledEvent;
      const r = await run(`ev-${q.id}`, () => send(`/api/admin/scheduled-events/${ev.id}`, "DELETE"), "Evento rimosso");
      if (r) onChanged();
      return;
    }
    const r = await run(
      `ev-${q.id}`,
      () => send(`/api/admin/sessions/${sessionId}/events`, "POST", { definitionKey: key, targetSessionQuestionId: q.id }),
      "Evento di Palmino programmato",
    );
    if (r) onChanged();
  }

  function renderQuestion(q: SessionQuestionItem, n: number, group: SessionQuestionItem[]) {
    const pos = group.indexOf(q);
    const correct = q.options.filter((o) => o.isCorrect);
    const ev = q.scheduledEvent;
    const evDef = ev ? defs.find((d) => d.key === ev.key) : undefined;
    const overLimit = ev && evDef ? (eventCounts.get(ev.key) ?? 0) > evDef.maxPerSession : false;
    const options = ev && !eventDefs.some((d) => d.key === ev.key) ? [...eventDefs, ...(evDef ? [evDef] : [])] : eventDefs;
    const problems = [
      !q.questionId && "Eliminata dall'archivio",
      q.questionId && !q.answerConfirmed && "Risposta da confermare",
      q.questionId && q.status !== "approved" && "Non approvata",
      isVote && !q.isReserve && !q.voteOptionId && "Senza categoria",
    ].filter(Boolean) as string[];
    return (
      <li key={q.id} className={clsx("rounded-xl border p-3", problems.length ? "border-flame/50 bg-flame/[0.06]" : "border-white/10 bg-white/[0.03]")}>
        <div className="flex gap-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-extrabold text-white/80">{n}</span>
          <div className="min-w-0 flex-1">
            <p className="break-words font-bold leading-snug">{q.text}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-white/60">
              <Badge color="gold">{q.category}</Badge>
              <Badge>{TYPE_LABEL[q.type]}</Badge>
              <Stars value={q.difficulty} />
              <span>{PRESENTER_LABEL[q.presenter]}</span>
              {q.mediaKind && <span title={`Media: ${q.mediaKind}`}>{MEDIA_ICON[q.mediaKind] ?? "📎"}</span>}
              {q.answerConfirmed && q.status === "approved" && <Badge color="green">✓ Approvata</Badge>}
              {problems.map((p) => (
                <Badge key={p} color="red">
                  ⚠ {p}
                </Badge>
              ))}
              {q.fromSnapshot && <Badge color="violet">Copia congelata</Badge>}
              {ev && (
                <Badge color="fuchsia">
                  🌴 {ev.title}
                  {ev.status !== "scheduled" ? ` · ${ev.status}` : ""}
                </Badge>
              )}
              {q.shownAt && <Badge color="blue">Giocata</Badge>}
            </div>
            <p className="mt-1.5 text-sm text-[#5dffab]">
              <span className="font-bold">Corretta{correct.length > 1 ? "e" : ""}:</span>{" "}
              {correct.length ? correct.map((o) => `${LETTERS[o.position]}) ${o.text}`).join(" · ") : "nessuna"}
            </p>
            {overLimit && evDef && (
              <p className="mt-1 text-xs font-bold text-[#ffe9a3]">
                ⚠ &laquo;{evDef.title}&raquo; è programmato {eventCounts.get(evDef.key)} volte: il limite per serata è {evDef.maxPerSession}.
              </p>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2.5">
          <Button size="sm" variant="ghost" onClick={() => onPreview(q)}>
            👁 Anteprima
          </Button>
          {q.questionId && (
            <Link href={`/admin/questions/${q.questionId}`} target="_blank" className="text-xs font-bold text-white/55 underline hover:text-gold">
              Apri in archivio
            </Link>
          )}
          {!readOnly && (
            <>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {isVote && !q.isReserve && (
                  <MiniSelect
                    aria-label="Categoria votabile"
                    className="w-40"
                    value={q.voteOptionId ?? ""}
                    disabled={busy !== null}
                    onChange={(e) => patch(q, { voteOptionId: e.target.value || null })}
                  >
                    <option value="">— Categoria —</option>
                    {round.voteOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </MiniSelect>
                )}
                {!q.isReserve && (
                  <MiniSelect
                    aria-label="Evento di Palmino programmato"
                    className="w-48"
                    value={ev?.key ?? ""}
                    disabled={busy !== null}
                    onChange={(e) => setEvent(q, e.target.value)}
                  >
                    <option value="">🌴 Nessun evento</option>
                    {options.map((d) => (
                      <option key={d.key} value={d.key}>
                        🌴 {d.title}
                      </option>
                    ))}
                  </MiniSelect>
                )}
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-white/75">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#ffd43b]"
                    checked={q.isReserve}
                    disabled={busy !== null}
                    onChange={(e) => patch(q, { isReserve: e.target.checked })}
                  />
                  Riserva
                </label>
                {rounds.length > 1 && (
                  <MiniSelect
                    aria-label="Sposta in un altro round"
                    className="w-40"
                    value=""
                    disabled={busy !== null}
                    onChange={(e) => e.target.value && moveTo(q, e.target.value)}
                  >
                    <option value="">Sposta in…</option>
                    {rounds
                      .filter((r) => r.id !== round.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.position + 1}. {r.title}
                        </option>
                      ))}
                  </MiniSelect>
                )}
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label="Sposta su" disabled={pos <= 0 || busy !== null} onClick={() => reorder(q, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Sposta giù" disabled={pos >= group.length - 1 || busy !== null} onClick={() => reorder(q, 1)}>
                    ↓
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Togli dal round" className="text-[#ff8098]" loading={busy === `rm-${q.id}`} onClick={() => remove(q)}>
                    ✕
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </li>
    );
  }

  const groups: { key: string; title: React.ReactNode; items: SessionQuestionItem[]; error?: string }[] = [];
  if (isVote) {
    for (const o of [...round.voteOptions].sort((a, b) => a.position - b.position)) {
      const items = playable.filter((q) => q.voteOptionId === o.id);
      groups.push({
        key: o.id,
        title: (
          <>
            {isWheel ? "🎡" : "🗳️"} {o.label} <span className="text-white/50">· {plural(items.length, "domanda", "domande")}</span>
            {round.winningOptionId === o.id && <Badge color="green">{isWheel ? "Estratta" : "Vincitrice"}</Badge>}
          </>
        ),
        items,
        error:
          items.length === 0
            ? isWheel
              ? `La categoria "${o.label}" non ha domande: la ruota potrebbe fermarsi su uno spicchio vuoto.`
              : `La categoria "${o.label}" non ha domande: non si può proporre al voto una categoria vuota.`
            : undefined,
      });
    }
    const orphan = playable.filter((q) => !q.voteOptionId || !round.voteOptions.some((o) => o.id === q.voteOptionId));
    if (orphan.length) groups.push({ key: "none", title: "Senza categoria", items: orphan, error: "Assegna una categoria a queste domande." });
  } else {
    groups.push({ key: "main", title: null, items: playable });
  }
  if (reserves.length) groups.push({ key: "reserve", title: "Riserve per la Domanda misteriosa", items: reserves });

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1d0c30] shadow-lg" aria-label={`Round ${index + 1}: ${round.title}`}>
      <header className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Character who={round.presenter} small glow={false} className="h-14 w-14 shrink-0 rounded-xl bg-white/5 object-contain p-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">Round {index + 1}</p>
            <h3 className="break-words font-display text-2xl leading-tight text-white">{round.title}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
              <Badge color="violet">
                {kind.icon} {kind.label}
              </Badge>
              <Badge>{PRESENTER_LABEL[round.presenter]}</Badge>
              {round.pointsMultiplier !== 1 && <Badge color="gold">Punti ×{round.pointsMultiplier}</Badge>}
              {round.noPenalty ? <Badge color="green">Senza penalità</Badge> : round.penaltyMultiplier !== 1 && <Badge color="red">Penalità ×{round.penaltyMultiplier}</Badge>}
              {round.durationSeconds && <Badge color="blue">{round.durationSeconds}s</Badge>}
              {round.speedBonusMax > 0 && <Badge color="blue">Bonus velocità {round.speedBonusMax}</Badge>}
              <Badge>
                {plural(playable.length, "domanda", "domande")}
                {reserves.length ? ` + ${plural(reserves.length, "riserva", "riserve")}` : ""}
              </Badge>
            </div>
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" aria-label="Sposta round su" disabled={index === 0} onClick={() => onMoveRound(-1)}>
              ↑
            </Button>
            <Button size="sm" variant="ghost" aria-label="Sposta round giù" disabled={index === rounds.length - 1} onClick={() => onMoveRound(1)}>
              ↓
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Modifica
            </Button>
            <Button size="sm" variant="ghost" className="text-[#ff8098]" onClick={onDelete}>
              Elimina
            </Button>
          </div>
        )}
      </header>
      <div className="space-y-4 p-4">
        {round.description && <p className="text-sm italic text-white/60">{round.description}</p>}
        {isVote && round.voteOptions.length < 2 && (
          <p className="rounded-xl border border-flame/50 bg-flame/15 px-3 py-2 text-sm font-bold text-[#ffc2cd]">
            ⚠ Servono almeno 2 categorie {isWheel ? "sulla ruota" : "votabili"}: modifica il round per aggiungerle.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.key} className="space-y-2">
            {g.title && <h4 className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-white/85">{g.title}</h4>}
            {g.error && <p className="rounded-xl border border-flame/50 bg-flame/15 px-3 py-2 text-sm font-bold text-[#ffc2cd]">⚠ {g.error}</p>}
            {g.items.length > 0 ? (
              <ol className="space-y-2">{g.items.map((q, i) => renderQuestion(q, i + 1, g.items))}</ol>
            ) : (
              !g.error && <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-white/50">Nessuna domanda in questo round.</p>
            )}
          </div>
        ))}
        {!readOnly && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="w-full" onClick={onAddQuestions}>
              + Aggiungi domande dall&apos;archivio
            </Button>
            <Button variant="outline" className="w-full" onClick={onAddRandom}>
              🎲 Aggiungi domande casuali
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

