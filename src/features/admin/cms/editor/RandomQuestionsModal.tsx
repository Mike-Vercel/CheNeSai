"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { DIFFICULTY_MIX_LABEL, DIFFICULTY_MIXES, type DifficultyMix } from "@/lib/game-engine/compose";
import type { RandomAddResult } from "@/lib/server/cms/compose";
import { isCategoryRound } from "@/lib/game-engine/types";
import { errorMessage, send, useApi } from "../api";
import { Checkbox, InfoNote } from "../common";
import type { CategoryCount, RoundDetail } from "../types";

const MEDIA_ROUNDS = new Set(["music", "image", "video"]);

/**
 * "Aggiungi domande casuali" a un round: stesse regole della serata rapida
 * (prima le mai giocate, niente doppioni nella serata, categorie alternate).
 */
export function RandomQuestionsModal({ round, onClose, onAdded }: { round: RoundDetail; onClose: () => void; onAdded: (r: RandomAddResult) => void }) {
  const isVote = isCategoryRound(round.kind);
  const cats = useApi<{ categories: CategoryCount[] }>("/api/admin/questions/categories");
  const bankCats = (cats.data?.categories ?? []).filter((c) => c.approved > 0);
  const [count, setCount] = useState("5");
  const [mix, setMix] = useState<DifficultyMix>(round.kind === "final" ? "difficile" : "bilanciata");
  const [category, setCategory] = useState(isVote ? "__auto" : "");
  const [voteOptionId, setVoteOptionId] = useState(round.voteOptions[0]?.id ?? "");
  const [isReserve, setIsReserve] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(MEDIA_ROUNDS.has(round.kind));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Number.parseInt(count, 10);
  const validCount = Number.isFinite(n) && n >= 1 && n <= 30;
  // Nei round con voto/ruota la categoria dell'archivio si propone uguale allo spicchio scelto.
  const optionLabel = round.voteOptions.find((o) => o.id === voteOptionId)?.label ?? "";
  const matched = bankCats.find((c) => c.category.toLocaleLowerCase("it-IT") === optionLabel.toLocaleLowerCase("it-IT"))?.category ?? "";
  const effectiveCategory = category === "__auto" ? matched : category;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validCount) return;
    setSaving(true);
    setError(null);
    try {
      const r = await send<RandomAddResult>(`/api/admin/rounds/${round.id}/random-questions`, "POST", {
        count: n,
        mix,
        categories: effectiveCategory ? [effectiveCategory] : [],
        includeMedia,
        isReserve,
        voteOptionId: isVote && !isReserve ? voteOptionId || null : null,
      });
      onAdded(r);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="🎲 Domande casuali"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" type="submit" form="random-questions-form" loading={saving} disabled={!validCount || (isVote && !isReserve && !voteOptionId)}>
            Aggiungi
          </Button>
        </>
      }
    >
      <form id="random-questions-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-white/70">
          Round <strong>{round.title}</strong>: le domande arrivano dall&apos;archivio, prima quelle <strong>mai giocate</strong>, mai una già presente in questa
          serata.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quante domande" hint="Da 1 a 30">
            {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={30} required value={count} onChange={(e) => setCount(e.target.value)} />}
          </Field>
          <Field label="Difficoltà">
            {(id) => (
              <Select id={id} value={mix} onChange={(e) => setMix(e.target.value as DifficultyMix)}>
                {DIFFICULTY_MIXES.map((m) => (
                  <option key={m} value={m}>
                    {DIFFICULTY_MIX_LABEL[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {isVote && !isReserve && (
          <Field label={round.kind === "category_wheel" ? "Spicchio della ruota" : "Categoria votabile"}>
            {(id) => (
              <Select id={id} value={voteOptionId} onChange={(e) => setVoteOptionId(e.target.value)}>
                {round.voteOptions.length === 0 && <option value="">Aggiungi prima le categorie al round</option>}
                {round.voteOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Categoria dell'archivio" hint={category === "__auto" && !matched ? `Nessuna categoria uguale a «${optionLabel}»: si useranno tutte` : undefined}>
          {(id) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Tutte le categorie</option>
              {isVote && <option value="__auto">Uguale allo spicchio scelto{matched ? ` (${matched})` : ""}</option>}
              {bankCats.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} ({c.approved})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Checkbox checked={includeMedia} onChange={setIncludeMedia} label="Includi domande con audio, immagini o video" />
        <Checkbox checked={isReserve} onChange={setIsReserve} label="Aggiungile come riserve (Domanda misteriosa)" />
        {error && <InfoNote tone="danger">{error}</InfoNote>}
      </form>
    </Modal>
  );
}
