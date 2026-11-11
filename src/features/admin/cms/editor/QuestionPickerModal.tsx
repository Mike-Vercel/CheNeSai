"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, EmptyState, Field, Input, Modal, Select } from "@/components/ui";
import { isCategoryRound } from "@/lib/game-engine/types";
import { errorMessage, qs, send, useApi } from "../api";
import { Checkbox, ErrorBlock, InfoNote, LoadingBlock, MEDIA_ICON, Pager, PlayedBadge, Stars } from "../common";
import { correctLetters, PRESENTER_LABEL, ROUND_KIND, TYPE_LABEL, plural } from "../format";
import type { CategoryCount, QuestionRecord, RoundDetail } from "../types";

const LIMIT = 15;

export function QuestionPickerModal({
  round,
  usedQuestionIds,
  onClose,
  onAdded,
}: {
  round: RoundDetail;
  usedQuestionIds: Set<string>;
  onClose: () => void;
  onAdded: (count: number) => void;
}) {
  const isVote = isCategoryRound(round.kind);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Map<string, QuestionRecord>>(new Map());
  const [voteOptionId, setVoteOptionId] = useState(round.voteOptions[0]?.id ?? "");
  const [isReserve, setIsReserve] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cats = useApi<{ categories: CategoryCount[] }>("/api/admin/questions/categories");
  const list = useApi<{ items: QuestionRecord[]; total: number }>(
    `/api/admin/questions${qs({ status: "approved", q, category, type, difficulty, limit: LIMIT, offset })}`,
  );

  function toggle(item: QuestionRecord) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }

  async function add() {
    if (selected.size === 0) return;
    if (isVote && !isReserve && !voteOptionId) {
      setError("Scegli la categoria a cui assegnare le domande");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await send(`/api/admin/rounds/${round.id}/questions`, "POST", {
        questionIds: [...selected.keys()],
        voteOptionId: isVote && voteOptionId ? voteOptionId : null,
        isReserve,
      });
      onAdded(selected.size);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const items = list.data?.items ?? [];
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Aggiungi domande · ${round.title}`}
      footer={
        <>
          <span className="mr-auto self-center text-sm font-bold text-white/70">{selected.size} selezionate</span>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" disabled={selected.size === 0} loading={saving} onClick={add}>
            Aggiungi {selected.size > 0 ? selected.size : ""} al round
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-white/65">
          Sono elencate solo le domande <strong className="text-white">approvate</strong> (risposta corretta confermata). Mancano domande?{" "}
          <Link href="/admin/questions/new" target="_blank" className="font-bold text-gold underline">
            Creane una nuova
          </Link>{" "}
          o{" "}
          <Link href="/admin/questions?status=draft" target="_blank" className="font-bold text-gold underline">
            conferma le bozze
          </Link>
          .
        </p>

        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1.25fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setQ(search.trim());
          }}
        >
          <Input aria-label="Cerca testo" placeholder="Cerca nel testo o nelle risposte…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                {c.category} ({c.approved})
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
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                Difficoltà {d}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="ghost">
            Cerca
          </Button>
        </form>

        {list.error ? (
          <ErrorBlock message={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <LoadingBlock />
        ) : items.length === 0 ? (
          <EmptyState title="Nessuna domanda approvata trovata" />
        ) : (
          <ul className="max-h-[45dvh] space-y-1.5 overflow-y-auto pr-1" aria-busy={list.loading}>
            {items.map((it) => {
              const checked = selected.has(it.id);
              const used = usedQuestionIds.has(it.id);
              const mismatch =
                (round.kind === "music" && it.mediaKind !== "audio") ||
                (round.kind === "image" && it.mediaKind !== "image") ||
                (round.kind === "video" && it.mediaKind !== "video");
              return (
                <li key={it.id}>
                  <label
                    className={clsx(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-2.5 transition",
                      checked ? "border-gold bg-gold/10" : "border-white/10 bg-white/[0.03] hover:border-white/25",
                    )}
                  >
                    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#ffd43b]" checked={checked} onChange={() => toggle(it)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold leading-snug">{it.text}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-white/60">
                        <Badge color="gold">{it.category}</Badge>
                        <Badge>{TYPE_LABEL[it.type]}</Badge>
                        <Stars value={it.difficulty} />
                        <span>{PRESENTER_LABEL[it.presenter]}</span>
                        {it.mediaKind && <span title={it.mediaLabel ?? ""}>{MEDIA_ICON[it.mediaKind]}</span>}
                        <span className="text-[#5dffab]">Corretta: {correctLetters(it.options)}</span>
                        <PlayedBadge lastPlayedAt={it.lastPlayedAt} timesPlayed={it.timesPlayed} />
                        {used && <Badge color="blue">Già in questa serata</Badge>}
                        {mismatch && <Badge color="red">Senza media {ROUND_KIND[round.kind].label.toLowerCase()}</Badge>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <Pager offset={offset} limit={LIMIT} total={list.data?.total ?? 0} onChange={setOffset} />

        <div className="grid gap-3 rounded-xl border border-white/10 bg-[#0f0519] p-3 sm:grid-cols-2">
          {isVote && (
            <Field
              label={round.kind === "category_wheel" ? "Spicchio della ruota" : "Categoria votabile"}
              hint={round.kind === "category_wheel" ? "Le domande verranno giocate se la ruota si ferma su questa categoria" : "Le domande verranno giocate se vince questa categoria"}
            >
              {(id) => (
                <Select id={id} value={voteOptionId} disabled={isReserve} onChange={(e) => setVoteOptionId(e.target.value)}>
                  {round.voteOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label} ({plural(o.questions, "domanda", "domande")})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <div className="flex items-end">
            <Checkbox
              checked={isReserve}
              onChange={setIsReserve}
              label="Aggiungi come riserva"
              hint="Le riserve non si giocano normalmente: servono alla Domanda misteriosa di Palmino."
            />
          </div>
        </div>
        {error && <InfoNote tone="danger">{error}</InfoNote>}
      </div>
    </Modal>
  );
}
