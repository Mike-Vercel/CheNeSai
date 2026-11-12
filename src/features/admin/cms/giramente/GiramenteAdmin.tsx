"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { errorMessage, get, send } from "../api";
import { ErrorBlock, LoadingBlock, PageHeader, Segmented } from "../common";

type Pool = "ruota" | "falsa_pista" | "collegamento" | "finale" | "tabellone";
type Status = "draft" | "published" | "disabled";
interface Puzzle {
  id: string;
  slug: string;
  pool: Pool;
  kind: string | null;
  category: string;
  difficulty: string;
  prompt: string;
  clues: string[];
  options: string[] | null;
  answerIndex: number | null;
  solution: string;
  accepted: string[];
  extraClue: string | null;
  falseIndex: number | null;
  visual: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  explanation: string | null;
  timeLimitSec: number | null;
  status: Status;
  tags: string[];
  source: string;
  timesPlayed: number;
  timesCorrect: number;
  problems: string[];
}
interface Stats {
  games: { total: number; open: number; finished: number; last7days: number; personal: number; shared: number; teams: number };
  puzzles: { pool: string; published: number; draft: number; disabled: number }[];
  plays: number;
  averageWinnerScore: number | null;
  hardest: { slug: string; pool: string; prompt: string; played: number; correctRate: number }[];
  recent: { code: string; devices: string; mode: string; phase: string; competitors: number; winner: string | null; createdAt: string }[];
}

const POOL_LABEL: Record<Pool, string> = { ruota: "Ruota (manche 1 e 3)", falsa_pista: "Falsa Pista", collegamento: "Collegamento", finale: "Giro Decisivo / spareggio", tabellone: "Tabellone Segreto" };
const STATUS_LABEL: Record<Status, string> = { draft: "bozza", published: "pubblicato", disabled: "disattivato" };

type Draft = Omit<Puzzle, "id" | "slug" | "source" | "timesPlayed" | "timesCorrect" | "problems"> & { id?: string; acceptedText: string; tagsText: string };
const emptyDraft = (pool: Pool): Draft => ({
  pool,
  kind: pool === "ruota" || pool === "finale" ? "indizi" : null,
  category: pool === "tabellone" ? "Proverbi" : "logica",
  difficulty: "facile",
  prompt: "",
  clues: pool === "falsa_pista" ? ["", "", "", ""] : pool === "collegamento" || pool === "finale" ? ["", "", ""] : [],
  options: pool === "ruota" ? ["", "", "", ""] : null,
  answerIndex: pool === "ruota" ? 0 : null,
  solution: "",
  accepted: [],
  extraClue: "",
  falseIndex: pool === "falsa_pista" ? 0 : null,
  visual: "",
  imageUrl: "",
  imageAlt: "",
  explanation: "",
  timeLimitSec: null,
  status: "draft",
  tags: [],
  acceptedText: "",
  tagsText: "",
});

/**
 * GIRAMENTE! nel pannello admin: enigmi (crea, modifica, soluzioni e varianti, indizi, immagini,
 * pubblica/disattiva con validazione) e partite/statistiche.
 */
export function GiramenteAdmin() {
  const toast = useToast();
  const [tab, setTab] = useState<"enigmi" | "partite">("enigmi");
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pool, setPool] = useState<Pool | "tutti">("tutti");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    get<{ puzzles: Puzzle[] }>("/api/admin/giramente/puzzles")
      .then((r) => {
        setPuzzles(r.puzzles);
        setError(null);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
    get<Stats>("/api/admin/giramente/stats")
      .then(setStats)
      .catch(() => undefined);
  }, []);
  useEffect(() => load(), [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (puzzles ?? []).filter((p) => (pool === "tutti" || p.pool === pool) && (!t || `${p.slug} ${p.prompt} ${p.solution} ${p.clues.join(" ")}`.toLowerCase().includes(t)));
  }, [puzzles, pool, q]);

  async function setStatus(p: Puzzle, status: Status) {
    try {
      await send(`/api/admin/giramente/puzzles/${p.id}`, "PATCH", { status });
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
        pool: draft.pool,
        kind: draft.kind || null,
        category: draft.category,
        difficulty: draft.difficulty,
        prompt: draft.prompt,
        clues: draft.clues,
        options: draft.options,
        answerIndex: draft.answerIndex,
        solution: draft.pool === "ruota" && draft.options && draft.answerIndex !== null ? draft.options[draft.answerIndex] : draft.solution,
        accepted: draft.acceptedText.split("\n").map((s) => s.trim()).filter(Boolean),
        extraClue: draft.extraClue || null,
        falseIndex: draft.falseIndex,
        visual: draft.visual || null,
        imageUrl: draft.imageUrl || null,
        imageAlt: draft.imageAlt || null,
        explanation: draft.explanation || null,
        timeLimitSec: draft.timeLimitSec,
        status: draft.status,
        tags: draft.tagsText.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (draft.id) await send(`/api/admin/giramente/puzzles/${draft.id}`, "PATCH", body);
      else await send("/api/admin/giramente/puzzles", "POST", body);
      toast("ok", "Enigma salvato");
      setDraft(null);
      load();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!puzzles) return <LoadingBlock />;
  const published = puzzles.filter((p) => p.status === "published").length;
  return (
    <div>
      <PageHeader
        title="GIRAMENTE! · Enigmi"
        subtitle={`${published} enigmi pubblicati su ${puzzles.length}. Niente ripetizioni nella stessa partita; gli enigmi incompleti non si possono pubblicare.`}
        actions={
          <Button variant="gold" onClick={() => setDraft(emptyDraft(pool === "tutti" ? "ruota" : pool))}>
            + Nuovo enigma
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented label="Sezione" value={tab} onChange={setTab} options={[{ value: "enigmi", label: "Enigmi" }, { value: "partite", label: "Partite e statistiche" }]} />
      </div>
      {tab === "partite" ? (
        <StatsView stats={stats} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented
              label="Archivio"
              value={pool}
              onChange={setPool}
              options={[{ value: "tutti", label: "Tutti" }, ...(Object.keys(POOL_LABEL) as Pool[]).map((p) => ({ value: p, label: POOL_LABEL[p] }))]}
            />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca…" className="max-w-xs" aria-label="Cerca" />
          </div>
          <ul className="flex flex-col gap-2">
            {shown.map((p) => (
              <li key={p.id} className={clsx("flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-start md:justify-between", p.status !== "published" && "opacity-70")}>
                <div className="min-w-0">
                  <p className="font-extrabold text-white">
                    {p.pool === "tabellone" ? p.solution : p.prompt || p.clues.join(" · ")}
                    <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold">{POOL_LABEL[p.pool]}</span>
                    {p.kind && <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold">{p.kind}</span>}
                    <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold">{p.difficulty}</span>
                    <span className={clsx("ml-1 rounded-full px-2 py-0.5 text-xs font-bold", p.status === "published" ? "bg-emerald-500/30" : "bg-flame/30")}>{STATUS_LABEL[p.status]}</span>
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    Soluzione: <b>{p.solution}</b>
                    {p.accepted.length > 0 && <span className="text-white/60"> · varianti: {p.accepted.join(", ")}</span>}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {p.slug} · giocato {p.timesPlayed} volte{p.timesPlayed ? ` · giusto ${Math.round((p.timesCorrect / p.timesPlayed) * 100)}%` : ""}
                  </p>
                  {p.problems.length > 0 && <p className="mt-1 text-xs font-bold text-amber-300">Da completare: {p.problems.join("; ")}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDraft({ ...p, extraClue: p.extraClue ?? "", visual: p.visual ?? "", imageUrl: p.imageUrl ?? "", imageAlt: p.imageAlt ?? "", explanation: p.explanation ?? "", acceptedText: p.accepted.join("\n"), tagsText: p.tags.join(", ") })}>
                    Modifica
                  </Button>
                  {p.status === "published" ? (
                    <Button size="sm" variant="danger" onClick={() => void setStatus(p, "disabled")}>
                      Disattiva
                    </Button>
                  ) : (
                    <Button size="sm" variant="success" disabled={p.problems.length > 0} onClick={() => void setStatus(p, "published")}>
                      Pubblica
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Modifica enigma" : "Nuovo enigma"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annulla
            </Button>
            <Button variant="gold" loading={saving} onClick={() => void save()}>
              Salva
            </Button>
          </>
        }
      >
        {draft && <PuzzleForm draft={draft} setDraft={setDraft} />}
      </Modal>
    </div>
  );
}

function PuzzleForm({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const lbl = "flex flex-col gap-1 text-sm font-bold";
  const clueCount = draft.pool === "falsa_pista" ? 4 : draft.pool === "collegamento" || draft.pool === "finale" ? 3 : draft.kind === "indizi" ? 3 : 0;
  const clues = Array.from({ length: clueCount }, (_, i) => draft.clues[i] ?? "");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={lbl}>
          Archivio
          <Select value={draft.pool} disabled={!!draft.id} onChange={(e) => setDraft({ ...emptyDraft(e.target.value as Pool), status: draft.status })}>
            {(Object.keys(POOL_LABEL) as Pool[]).map((p) => (
              <option key={p} value={p}>
                {POOL_LABEL[p]}
              </option>
            ))}
          </Select>
        </label>
        {(draft.pool === "ruota" || draft.pool === "finale") && (
          <label className={lbl}>
            Tipo
            <Select value={draft.kind ?? ""} onChange={(e) => set({ kind: e.target.value })}>
              <option value="intruso">Intruso</option>
              <option value="sequenza">Sequenza</option>
              <option value="indizi">Indizi</option>
              <option value="prospettiva">Prospettiva</option>
            </Select>
          </label>
        )}
        <label className={lbl}>
          Difficoltà
          <Select value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
            <option value="facile">Facile</option>
            <option value="media">Media</option>
            <option value="difficile">Difficile</option>
          </Select>
        </label>
      </div>
      <label className={lbl}>
        {draft.pool === "tabellone" ? "Categoria (mostrata sopra il tabellone)" : "Categoria (logica, osservazione, cultura, sequenze, indovinelli, collegamenti, pop)"}
        <Input value={draft.category} maxLength={40} onChange={(e) => set({ category: e.target.value })} />
      </label>
      {draft.pool !== "tabellone" && draft.pool !== "collegamento" && draft.pool !== "falsa_pista" && (
        <label className={lbl}>
          Domanda
          <Textarea value={draft.prompt} rows={2} maxLength={400} onChange={(e) => set({ prompt: e.target.value })} />
        </label>
      )}
      {clueCount > 0 && (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
          <legend className="px-1 text-sm font-extrabold">{draft.pool === "collegamento" ? "Le 3 parole" : draft.pool === "finale" ? "3 indizi progressivi (600 → 400 → 200 punti)" : draft.pool === "falsa_pista" ? "4 indizi (uno è la falsa pista)" : "Indizi"}</legend>
          {clues.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              {draft.pool === "falsa_pista" && <input type="radio" name="false" checked={draft.falseIndex === i} onChange={() => set({ falseIndex: i })} aria-label={`Falsa pista: indizio ${i + 1}`} />}
              <Input value={c} maxLength={200} onChange={(e) => set({ clues: clues.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Indizio ${i + 1}`} />
            </div>
          ))}
          {draft.pool === "falsa_pista" && <p className="text-xs text-white/60">Il pallino indica la falsa pista.</p>}
        </fieldset>
      )}
      {draft.pool === "ruota" && (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
          <legend className="px-1 text-sm font-extrabold">4 opzioni (il pallino indica quella giusta)</legend>
          {(draft.options ?? ["", "", "", ""]).map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="answer" checked={draft.answerIndex === i} onChange={() => set({ answerIndex: i })} aria-label={`Opzione giusta ${i + 1}`} />
              <Input value={o} maxLength={60} onChange={(e) => set({ options: (draft.options ?? ["", "", "", ""]).map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Opzione ${"ABCD"[i]}`} />
            </div>
          ))}
        </fieldset>
      )}
      {draft.pool !== "ruota" && (
        <label className={lbl}>
          {draft.pool === "tabellone" ? "Frase nascosta (MAIUSCOLO)" : "Soluzione"}
          <Input value={draft.solution} maxLength={120} onChange={(e) => set({ solution: draft.pool === "tabellone" ? e.target.value.toUpperCase() : e.target.value })} />
        </label>
      )}
      {draft.pool !== "ruota" && (
        <label className={lbl}>
          Varianti accettate (una per riga: singolare/plurale, con articolo, sinonimi esatti — mai risposte diverse)
          <Textarea value={draft.acceptedText} rows={2} onChange={(e) => set({ acceptedText: e.target.value })} />
        </label>
      )}
      {(draft.pool === "ruota" || draft.pool === "collegamento" || draft.pool === "tabellone") && (
        <label className={lbl}>
          {draft.pool === "ruota" ? "Indizio extra (Occhio Furbo della Jolly)" : draft.pool === "collegamento" ? "Quarto indizio" : "Indizio del tabellone"}
          <Input value={draft.extraClue ?? ""} maxLength={200} onChange={(e) => set({ extraClue: e.target.value })} />
        </label>
      )}
      {(draft.pool === "ruota" || draft.pool === "finale") && (
        <>
          <label className={lbl}>
            Disegno a caratteri (facoltativo, max 6 righe × 16: ● ○ ■ □ ▲ △ ★ ☆ → ↑ …)
            <Textarea value={draft.visual ?? ""} rows={3} className="font-mono" onChange={(e) => set({ visual: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              URL immagine (facoltativa: https://… o /percorso; caricabile in Media)
              <Input value={draft.imageUrl ?? ""} onChange={(e) => set({ imageUrl: e.target.value })} />
            </label>
            <label className={lbl}>
              Testo alternativo dell&apos;immagine
              <Input value={draft.imageAlt ?? ""} maxLength={200} onChange={(e) => set({ imageAlt: e.target.value })} />
            </label>
          </div>
        </>
      )}
      <label className={lbl}>
        Spiegazione (mostrata dopo la risposta)
        <Textarea value={draft.explanation ?? ""} rows={2} maxLength={400} onChange={(e) => set({ explanation: e.target.value })} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>
          Tempo massimo (s, vuoto = impostazioni della partita)
          <Input type="number" value={draft.timeLimitSec ?? ""} onChange={(e) => set({ timeLimitSec: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className={lbl}>
          Tag (separati da virgola)
          <Input value={draft.tagsText} onChange={(e) => set({ tagsText: e.target.value })} />
        </label>
      </div>
      <label className={lbl}>
        Stato
        <Select value={draft.status} onChange={(e) => set({ status: e.target.value as Status })}>
          <option value="draft">Bozza</option>
          <option value="published">Pubblicato (solo se completo)</option>
          <option value="disabled">Disattivato</option>
        </Select>
      </label>
    </div>
  );
}

function StatsView({ stats }: { stats: Stats | null }) {
  if (!stats) return <LoadingBlock />;
  const tile = (label: string, value: string | number) => (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-bold uppercase text-white/60">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile("Partite create", stats.games.total)}
        {tile("Finite", stats.games.finished)}
        {tile("In corso", stats.games.open)}
        {tile("Ultimi 7 giorni", stats.games.last7days)}
        {tile("Un telefono a testa", stats.games.personal)}
        {tile("Un solo telefono", stats.games.shared)}
        {tile("A squadre", stats.games.teams)}
        {tile("Enigmi giocati", stats.plays)}
      </div>
      <section>
        <h2 className="mb-2 text-lg font-black">Archivio</h2>
        <ul className="grid gap-2 md:grid-cols-5">
          {stats.puzzles.map((p) => (
            <li key={p.pool} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <b>{POOL_LABEL[p.pool as Pool] ?? p.pool}</b>
              <br />
              {p.published} pubblicati · {p.draft} bozze · {p.disabled} disattivati
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-black">Enigmi più difficili (almeno 3 partite)</h2>
        {stats.hardest.length === 0 ? (
          <p className="text-sm text-white/60">Ancora pochi dati.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {stats.hardest.map((h) => (
              <li key={h.slug}>
                {h.correctRate}% giuste su {h.played} · <span className="text-white/70">{h.prompt}</span> <span className="text-white/40">({h.slug})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-lg font-black">Ultime partite</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {stats.recent.map((r) => (
            <li key={r.code + r.createdAt} className="rounded-lg bg-white/5 px-3 py-2">
              <span className="font-mono">{r.code}</span> · {r.devices === "shared" ? "un solo telefono" : "telefoni personali"} · {r.mode === "teams" ? "squadre" : "individuale"} · {r.competitors} concorrenti · {r.phase === "FINAL" ? `vince ${r.winner ?? "—"}` : r.phase} ·{" "}
              {new Date(r.createdAt).toLocaleString("it-IT")}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
