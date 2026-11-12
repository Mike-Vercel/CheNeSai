"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { errorMessage, get, send } from "../api";
import { ErrorBlock, LoadingBlock, PageHeader, Segmented } from "../common";

type Difficulty = "facile" | "media" | "difficile";
interface Rule {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  instructions: string | null;
  example: string | null;
  hints: [string | null, string | null, string | null];
  active: boolean;
  timesShown: number;
  timesChosen: number;
}
type Draft = { id?: string; title: string; description: string; difficulty: Difficulty; instructions: string; example: string; hints: [string, string, string]; active: boolean };
const EMPTY: Draft = { title: "", description: "", difficulty: "facile", instructions: "", example: "", hints: ["", "", ""], active: true };
const HINT_HELP = [
  "Livello 1 – vago ma utile (es. «Non conta cosa dicono… conta come cominciano.»)",
  "Livello 2 – più preciso",
  "Livello 3 – quasi rivelatore, ma senza dire la regola",
];
const LABEL: Record<Difficulty, string> = { facile: "Facile", media: "Media", difficile: "Difficile" };

/**
 * Archivio delle regole di PSYCO (modalità automatica): attiva/disattiva, modifica, aggiungi.
 * Le regole scritte dai giocatori in partita NON finiscono qui.
 */
export function PsycoRules() {
  const toast = useToast();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"tutte" | Difficulty>("tutte");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    get<{ rules: Rule[] }>("/api/admin/psyco/rules")
      .then((r) => {
        setRules(r.rules);
        setError(null);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);
  useEffect(() => load(), [load]);

  const shown = useMemo(() => (rules ?? []).filter((r) => filter === "tutte" || r.difficulty === filter), [rules, filter]);
  const counts = useMemo(() => {
    const c = { facile: 0, media: 0, difficile: 0, inactive: 0 };
    for (const r of rules ?? []) {
      if (r.active) c[r.difficulty]++;
      else c.inactive++;
    }
    return c;
  }, [rules]);

  async function toggle(r: Rule) {
    try {
      await send(`/api/admin/psyco/rules/${r.id}`, "PATCH", { active: !r.active });
      load();
    } catch (e) {
      toast("error", errorMessage(e));
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const body = {
        title: draft.title,
        description: draft.description,
        difficulty: draft.difficulty,
        instructions: draft.instructions || null,
        example: draft.example || null,
        hints: draft.hints.map((h) => h.trim() || null),
        active: draft.active,
      };
      if (draft.id) await send(`/api/admin/psyco/rules/${draft.id}`, "PATCH", body);
      else await send("/api/admin/psyco/rules", "POST", body);
      toast("ok", "Regola salvata");
      setDraft(null);
      load();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!rules) return <LoadingBlock />;
  return (
    <div>
      <PageHeader
        title="PSYCO · Regole"
        subtitle={`Attive: ${counts.facile} facili, ${counts.media} medie, ${counts.difficile} difficili · disattivate: ${counts.inactive}. Il gioco non ripropone la stessa regola nella stessa stanza finché ce ne sono altre.`}
        actions={
          <Button variant="gold" onClick={() => setDraft({ ...EMPTY })}>
            + Nuova regola
          </Button>
        }
      />
      <div className="mb-4">
        <Segmented
          label="Difficoltà"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "tutte", label: "Tutte" },
            { value: "facile", label: "Facili" },
            { value: "media", label: "Medie" },
            { value: "difficile", label: "Difficili" },
          ]}
        />
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((r) => (
          <li key={r.id} className={clsx("flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-start md:justify-between", !r.active && "opacity-50")}>
            <div className="min-w-0">
              <p className="font-extrabold text-white">
                {r.title} <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold">{LABEL[r.difficulty]}</span>
                {!r.active && <span className="ml-2 rounded-full bg-flame/30 px-2 py-0.5 text-xs font-bold">disattivata</span>}
              </p>
              <p className="mt-1 text-sm text-white/85">{r.description}</p>
              {r.example && <p className="mt-1 text-xs italic text-white/60">Esempio: {r.example}</p>}
              <p className="mt-1 text-xs text-white/50">
                Proposta {r.timesShown} volte · scelta {r.timesChosen} · indizi dell&apos;Investigatore: {r.hints.filter(Boolean).length}/3
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft({
                    id: r.id,
                    title: r.title,
                    description: r.description,
                    difficulty: r.difficulty,
                    instructions: r.instructions ?? "",
                    example: r.example ?? "",
                    hints: [r.hints[0] ?? "", r.hints[1] ?? "", r.hints[2] ?? ""],
                    active: r.active,
                  })
                }
              >
                Modifica
              </Button>
              <Button size="sm" variant={r.active ? "danger" : "success"} onClick={() => void toggle(r)}>
                {r.active ? "Disattiva" : "Attiva"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Modifica regola" : "Nuova regola"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annulla
            </Button>
            <Button variant="gold" loading={saving} disabled={!draft || draft.title.trim().length < 2 || draft.description.trim().length < 5} onClick={() => void save()}>
              Salva
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-bold">
              Titolo
              <Input value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Regola (quello che leggono i giocatori)
              <Textarea value={draft.description} maxLength={400} rows={3} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Difficoltà
              <Select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Difficulty })}>
                <option value="facile">Facile</option>
                <option value="media">Media</option>
                <option value="difficile">Difficile</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Istruzioni (facoltative)
              <Textarea value={draft.instructions} maxLength={600} rows={2} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              Esempio (facoltativo)
              <Textarea value={draft.example} maxLength={400} rows={2} onChange={(e) => setDraft({ ...draft, example: e.target.value })} />
            </label>
            <fieldset className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
              <legend className="px-1 text-sm font-extrabold">📞 Indizi dell&apos;Investigatore (segreti: li legge solo lo PSYCO che chiama)</legend>
              {draft.hints.map((h, i) => (
                <label key={i} className="flex flex-col gap-1 text-xs font-bold text-white/80">
                  {HINT_HELP[i]}
                  <Textarea
                    value={h}
                    maxLength={300}
                    rows={2}
                    onChange={(e) => setDraft({ ...draft, hints: draft.hints.map((x, j) => (j === i ? e.target.value : x)) as Draft["hints"] })}
                  />
                </label>
              ))}
              <p className="text-xs text-white/50">Vuoti = l&apos;Investigatore usa un indizio generico.</p>
            </fieldset>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Attiva
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
