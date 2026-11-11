"use client";

import { clsx } from "clsx";
import { ScreenChoiceField } from "@/features/display/TvScreenControls";
import { useEffect, useState } from "react";
import { Badge, Button, Field, Input, Modal, Select } from "@/components/ui";
import { DIFFICULTY_MIX_LABEL, DIFFICULTY_MIXES, splitQuestions, type DifficultyMix } from "@/lib/game-engine/compose";
import type { QuickSessionResult } from "@/lib/server/cms/compose";
import { errorMessage, fieldErrors, send, useApi } from "../api";
import { Checkbox, InfoNote } from "../common";
import { fmtNum, fromLocalInput, plural } from "../format";
import type { CategoryCount } from "../types";
import { difficultyLabel } from "@/lib/game-engine/difficulty";

const FRESH_LABEL = { nuova: "mai giocata", giocata: "già giocata", prenotata: "in un'altra serata", vista: "già vista dall'host" } as const;

function todayTitle() {
  return `Serata rapida del ${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`;
}

function newSeed() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}

function int(v: string, min: number, max: number): number | null {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/**
 * Serata rapida: si scelgono solo quanti round, quante domande, difficoltà e
 * (se si vuole) le categorie; le domande le sceglie il server, prima le mai giocate.
 */
export function QuickSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: QuickSessionResult) => void }) {
  const [title, setTitle] = useState(todayTitle);
  const [scheduledAt, setScheduledAt] = useState("");
  const [rounds, setRounds] = useState("4");
  const [total, setTotal] = useState("20");
  const [mix, setMix] = useState<DifficultyMix>("bilanciata");
  const [finalRound, setFinalRound] = useState(true);
  const [reserves, setReserves] = useState("1");
  const [categories, setCategories] = useState<string[]>([]);
  const [includeMedia, setIncludeMedia] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const [seed, setSeed] = useState(newSeed);
  const [preview, setPreview] = useState<{ key: string; data: QuickSessionResult | null; error: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const cats = useApi<{ categories: CategoryCount[] }>("/api/admin/questions/categories");

  const nRounds = int(rounds, 1, 10);
  const nTotal = int(total, 1, 100);
  const nReserves = int(reserves, 0, 5) ?? 0;
  const valid = nRounds !== null && nTotal !== null && nTotal >= nRounds && Math.ceil(nTotal / nRounds) <= 30;
  const split = valid ? splitQuestions(nTotal!, nRounds!) : [];
  const options = valid
    ? { rounds: nRounds!, totalQuestions: nTotal!, mix, finalRound, reserves: nReserves, categories, includeMedia, isTest, seed }
    : null;
  const key = options ? JSON.stringify(options) : "";

  // Anteprima (nessuna scrittura): si aggiorna mezzo secondo dopo l'ultima modifica.
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const t = setTimeout(() => {
      send<QuickSessionResult>("/api/admin/sessions/quick", "POST", { ...JSON.parse(key), dryRun: true })
        .then((data) => alive && setPreview({ key, data, error: null }))
        .catch((e: unknown) => alive && setPreview({ key, data: null, error: errorMessage(e) }));
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [key]);

  const p = preview?.data ?? null;
  const stale = !preview || preview.key !== key;
  const missing = p?.summary.missing ?? 0;

  function toggleCategory(c: string) {
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!options) return;
    setSaving(true);
    setErrors({});
    setGeneral(null);
    try {
      const r = await send<QuickSessionResult>("/api/admin/sessions/quick", "POST", {
        ...options,
        title: title.trim(),
        scheduledAt: fromLocalInput(scheduledAt),
      });
      onCreated(r);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setGeneral(Object.keys(fe).length ? "Controlla i campi evidenziati" : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="⚡ Serata rapida"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" type="submit" form="quick-session-form" loading={saving} disabled={!valid || missing > 0}>
            Crea e apri editor
          </Button>
        </>
      }
    >
      <form id="quick-session-form" onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="space-y-3">
          <p className="text-sm text-white/70">
            Scegli quanti round e quante domande: le domande le pesca l&apos;archivio, <strong>prima quelle mai giocate</strong>. Dopo potrai ritoccare tutto
            nell&apos;editor e pubblicare come sempre.
          </p>
          <Field label="Titolo della serata" error={errors.title}>
            {(id) => <Input id={id} required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Round" error={errors.rounds} hint="Da 1 a 10">
              {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={10} required value={rounds} onChange={(e) => setRounds(e.target.value)} />}
            </Field>
            <Field label="Domande in tutto" error={errors.totalQuestions} hint="Da 1 a 100">
              {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={100} required value={total} onChange={(e) => setTotal(e.target.value)} />}
            </Field>
            <Field label="Riserve" error={errors.reserves} hint="Per la Domanda misteriosa">
              {(id) => <Input id={id} type="number" inputMode="numeric" min={0} max={5} value={reserves} onChange={(e) => setReserves(e.target.value)} />}
            </Field>
          </div>
          {valid ? (
            <p className="text-xs text-white/60">
              Ripartizione: {split.join(" + ")} domande{finalRound && split.length > 1 ? " (l'ultimo è la Finale)" : ""}.
            </p>
          ) : (
            <InfoNote tone="warn">Servono da 1 a 10 round, almeno una domanda per round e al massimo 30 domande per round.</InfoNote>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Difficoltà" error={errors.mix} hint={mix === "bilanciata" ? "Facile → media → difficile, a ciclo" : "Il round finale resta più difficile"}>
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
            <Field label="Data e ora (facoltativa)" error={errors.scheduledAt} hint="Ora locale del pub">
              {(id) => <Input id={id} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />}
            </Field>
          </div>
          <Checkbox
            checked={finalRound}
            onChange={setFinalRound}
            label="L'ultimo round è la Finale"
            hint="Punti doppi e domande più difficili (servono almeno 2 round)."
          />
          <Checkbox checked={includeMedia} onChange={setIncludeMedia} label="Includi domande con audio, immagini o video" hint="Solo se ce ne sono di approvate nell'archivio." />
          <Checkbox
            checked={isTest}
            onChange={setIsTest}
            label="Serata di prova"
            hint="Non entra nelle classifiche e non consuma le domande: restano «mai giocate» anche dopo averla giocata."
          />
          <ScreenChoiceField className="rounded-xl border border-white/10 bg-white/5 p-3" />
          <div>
            <p className="mb-1.5 text-sm font-bold text-white/90">
              Categorie <span className="font-normal text-white/55">({categories.length === 0 ? "tutte" : plural(categories.length, "scelta", "scelte")})</span>
            </p>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1" role="group" aria-label="Categorie">
              {(cats.data?.categories ?? [])
                .filter((c) => c.approved > 0)
                .map((c) => {
                  const on = categories.includes(c.category);
                  return (
                    <button
                      key={c.category}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCategory(c.category)}
                      className={clsx(
                        "rounded-full border px-2.5 py-1 text-xs font-bold transition",
                        on ? "border-gold bg-gold/20 text-gold" : "border-white/15 bg-white/5 text-white/75 hover:border-white/30",
                      )}
                    >
                      {c.category} <span className="font-normal text-white/50">{c.approved}</span>
                    </button>
                  );
                })}
            </div>
            {categories.length > 0 && (
              <button type="button" className="mt-1.5 text-xs font-bold text-white/55 underline hover:text-gold" onClick={() => setCategories([])}>
                Usa tutte le categorie
              </button>
            )}
          </div>
          {general && <InfoNote tone="danger">{general}</InfoNote>}
        </div>

        <aside className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-live="polite" aria-busy={stale}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-xl text-white">Anteprima</h3>
            <Button size="sm" variant="ghost" disabled={!valid} onClick={() => setSeed(newSeed())}>
              🎲 Rimescola
            </Button>
          </div>
          {!valid ? (
            <p className="text-sm text-white/60">Completa round e domande per vedere l&apos;anteprima.</p>
          ) : preview?.error && !stale ? (
            <InfoNote tone="danger">{preview.error}</InfoNote>
          ) : !p ? (
            <p className="text-sm text-white/60">Calcolo in corso…</p>
          ) : (
            <div className={clsx("space-y-3 transition", stale && "opacity-60")}>
              <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  ["Mai giocate", fmtNum(p.pool.fresh), "text-[#5dffab]"],
                  ["Già giocate", fmtNum(p.pool.played), "text-white"],
                  ["Utilizzabili", fmtNum(p.pool.usable), "text-white"],
                ].map(([k, v, c]) => (
                  <div key={k} className="rounded-lg bg-white/5 px-1 py-1.5">
                    <dt className="text-white/50">{k}</dt>
                    <dd className={clsx("mt-0.5 text-lg font-extrabold", c)}>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-white/55">
                Mai giocate per fascia: facili e medie {fmtNum(p.pool.byBand.facile.fresh)} · difficili {fmtNum(p.pool.byBand.media.fresh)} · difficilissime e impossibili{" "}
                {fmtNum(p.pool.byBand.difficile.fresh)}
                {p.pool.planned > 0 ? ` · ${fmtNum(p.pool.planned)} già in altre serate in programma` : ""}
              </p>
              {p.summary.missing > 0 ? null : p.warnings.length === 0 ? (
                <InfoNote tone="ok">
                  ✓ Tutte le {p.summary.picked} domande sono mai giocate
                  {p.reserves.requested > 0 ? ` (+ ${plural(p.reserves.picked, "riserva", "riserve")})` : ""}.
                </InfoNote>
              ) : null}
              {p.warnings.map((w) => (
                <InfoNote key={w} tone={p.summary.missing > 0 ? "danger" : "warn"}>
                  ⚠ {w}
                </InfoNote>
              ))}
              <ol className="space-y-2 text-sm">
                {p.rounds.map((r, i) => (
                  <li key={i} className="rounded-xl border border-white/10 px-3 py-2">
                    <p className="font-bold">
                      {i + 1}. {r.title} <span className="font-normal text-white/50">· {plural(r.questions.length, "domanda", "domande")}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.questions.map((q) => (
                        <span key={q.questionId} title={`${difficultyLabel(q.difficulty)} · ${FRESH_LABEL[q.freshness]}`}>
                          <Badge color={q.freshness === "nuova" ? "gold" : q.freshness === "giocata" ? "red" : "violet"}>
                            {q.category} · {q.difficulty}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-white/45">Etichette: categoria · difficoltà (1–5). In rosso le domande già giocate.</p>
            </div>
          )}
        </aside>
      </form>
    </Modal>
  );
}
