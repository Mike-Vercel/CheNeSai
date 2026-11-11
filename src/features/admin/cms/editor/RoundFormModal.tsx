"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea, Toggle } from "@/components/ui";
import { BET_TIERS, PRESENTERS, ROUND_KINDS, type BetTier, type Presenter, type RoundKind } from "@/lib/game-engine/types";
import { BET_TIER_LABEL } from "@/lib/game-engine/special-rounds";
import { errorMessage, fieldErrors } from "../api";
import { Checkbox, InfoNote } from "../common";
import { intOrNull, PRESENTER_LABEL, ROUND_KIND } from "../format";
import type { RoundDetail } from "../types";

interface RoundForm {
  title: string;
  kind: RoundKind;
  presenter: Presenter;
  description: string;
  pointsMultiplier: string;
  penaltyMultiplier: string;
  noPenalty: boolean;
  correctPoints: string;
  wrongPenalty: string;
  durationSeconds: string;
  speedBonusMax: string;
  voteDurationSeconds: string;
  voteTieBreak: "random" | "admin" | "first";
  voteLiveResults: boolean;
  voteOptions: string[];
  betMinStake: string;
  betDefaultTier: BetTier;
  comebackMultiplier: string;
  comebackLeaderPenalty: string;
}

function toForm(r: RoundDetail | null): RoundForm {
  if (!r) {
    return {
      title: "",
      kind: "standard",
      presenter: "professore",
      description: "",
      pointsMultiplier: "1",
      penaltyMultiplier: "1",
      noPenalty: false,
      correctPoints: "",
      wrongPenalty: "",
      durationSeconds: "",
      speedBonusMax: "500",
      voteDurationSeconds: "15",
      voteTieBreak: "random",
      voteLiveResults: true,
      voteOptions: ["", ""],
      betMinStake: "500",
      betDefaultTier: 0,
      comebackMultiplier: "2",
      comebackLeaderPenalty: "1",
    };
  }
  const opts = [...r.voteOptions].sort((a, b) => a.position - b.position).map((o) => o.label);
  return {
    title: r.title,
    kind: r.kind,
    presenter: r.presenter,
    description: r.description ?? "",
    pointsMultiplier: String(r.pointsMultiplier),
    penaltyMultiplier: String(r.penaltyMultiplier),
    noPenalty: r.noPenalty,
    correctPoints: r.correctPoints === null ? "" : String(r.correctPoints),
    wrongPenalty: r.wrongPenalty === null ? "" : String(r.wrongPenalty),
    durationSeconds: r.durationSeconds === null ? "" : String(r.durationSeconds),
    speedBonusMax: String(r.speedBonusMax),
    voteDurationSeconds: String(r.voteDurationSeconds),
    voteTieBreak: r.voteTieBreak,
    voteLiveResults: r.voteLiveResults,
    voteOptions: opts.length >= 2 ? opts : [...opts, "", ""].slice(0, 2),
    betMinStake: String(r.betMinStake),
    betDefaultTier: r.betDefaultTier,
    comebackMultiplier: String(r.comebackMultiplier),
    comebackLeaderPenalty: String(r.comebackLeaderPenalty),
  };
}

const TIE_LABEL = { random: "Sorteggio automatico", admin: "Decide la regia", first: "Vince la prima in elenco" } as const;

export function RoundFormModal({
  round,
  defaults,
  onClose,
  onSubmit,
}: {
  round: RoundDetail | null;
  defaults: { correctPoints?: number; wrongPenalty?: number; durationSeconds?: number };
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [f, setF] = useState<RoundForm>(() => toForm(round));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isVote = f.kind === "category_vote";
  const isBet = f.kind === "bet";
  const isComeback = f.kind === "comeback";
  const removedWithQuestions =
    round && round.kind === "category_vote"
      ? round.voteOptions.filter((o) => o.questions > 0 && (!isVote || o.position >= f.voteOptions.length))
      : [];

  function set<K extends keyof RoundForm>(k: K, v: RoundForm[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneral(null);
    const labels = f.voteOptions.map((l) => l.trim());
    if (isVote) {
      if (labels.length < 2 || labels.some((l) => l.length < 2)) {
        setErrors({ voteOptions: "Servono da 2 a 4 categorie, ognuna di almeno 2 caratteri" });
        return;
      }
      if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) {
        setErrors({ voteOptions: "Le categorie devono essere diverse tra loro" });
        return;
      }
    }
    const body = {
      title: f.title.trim(),
      kind: f.kind,
      presenter: f.presenter,
      description: f.description.trim() || null,
      pointsMultiplier: Number(f.pointsMultiplier || 1),
      penaltyMultiplier: Number(f.penaltyMultiplier || 1),
      noPenalty: f.noPenalty,
      correctPoints: intOrNull(f.correctPoints),
      wrongPenalty: intOrNull(f.wrongPenalty),
      durationSeconds: intOrNull(f.durationSeconds),
      speedBonusMax: intOrNull(f.speedBonusMax) ?? 0,
      voteDurationSeconds: intOrNull(f.voteDurationSeconds) ?? 15,
      voteTieBreak: f.voteTieBreak,
      voteLiveResults: f.voteLiveResults,
      voteOptions: isVote ? labels : [],
      betMinStake: intOrNull(f.betMinStake) ?? 0,
      betDefaultTier: f.betDefaultTier,
      comebackMultiplier: Number(f.comebackMultiplier || 1),
      comebackLeaderPenalty: Number(f.comebackLeaderPenalty || 1),
    };
    setSaving(true);
    try {
      await onSubmit(body);
    } catch (err) {
      const fe = fieldErrors(err);
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(fe)) mapped[k.startsWith("voteOptions") ? "voteOptions" : k] = v;
      setErrors(mapped);
      setGeneral(Object.keys(mapped).length ? "Controlla i campi evidenziati" : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={round ? `Modifica round "${round.title}"` : "Nuovo round"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" type="submit" form="round-form" loading={saving}>
            {round ? "Salva round" : "Crea round"}
          </Button>
        </>
      }
    >
      <form id="round-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <Field label="Titolo del round" error={errors.title}>
            {(id) => <Input id={id} required minLength={2} maxLength={80} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Es. Cultura generale" />}
          </Field>
          <Field label="Tipo di round" error={errors.kind} hint={ROUND_KIND[f.kind].hint}>
            {(id) => (
              <Select id={id} value={f.kind} onChange={(e) => set("kind", e.target.value as RoundKind)}>
                {ROUND_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ROUND_KIND[k].icon} {ROUND_KIND[k].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Presentatore" error={errors.presenter}>
            {(id) => (
              <Select id={id} value={f.presenter} onChange={(e) => set("presenter", e.target.value as Presenter)}>
                {PRESENTERS.map((p) => (
                  <option key={p} value={p}>
                    {PRESENTER_LABEL[p]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Descrizione mostrata all'inizio del round (facoltativa)" error={errors.description}>
          {(id) => <Textarea id={id} className="min-h-16" maxLength={500} value={f.description} onChange={(e) => set("description", e.target.value)} />}
        </Field>

        {isVote && (
          <fieldset className="space-y-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
            <legend className="px-1 font-display text-lg text-gold">Votazione della categoria</legend>
            <p className="text-sm text-white/70">
              Il pubblico vota una delle categorie; si giocano le domande assegnate a quella vincente. Ogni categoria deve avere almeno una domanda.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {f.voteOptions.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center font-display text-gold">{i + 1}</span>
                  <Input
                    aria-label={`Categoria ${i + 1}`}
                    value={label}
                    maxLength={40}
                    placeholder={["Es. Cinema", "Es. Sport", "Es. Musica anni 80", "Es. Geografia"][i]}
                    onChange={(e) => set("voteOptions", f.voteOptions.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {f.voteOptions.length > 2 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Rimuovi categoria ${i + 1}`}
                      onClick={() => set("voteOptions", f.voteOptions.filter((_, j) => j !== i))}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {errors.voteOptions && <p className="text-xs font-bold text-[#ff8098]">{errors.voteOptions}</p>}
            {f.voteOptions.length < 4 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => set("voteOptions", [...f.voteOptions, ""])}>
                + Aggiungi categoria
              </Button>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Durata voto (secondi)" error={errors.voteDurationSeconds}>
                {(id) => <Input id={id} type="number" min={5} max={120} value={f.voteDurationSeconds} onChange={(e) => set("voteDurationSeconds", e.target.value)} />}
              </Field>
              <Field label="In caso di pareggio" error={errors.voteTieBreak}>
                {(id) => (
                  <Select id={id} value={f.voteTieBreak} onChange={(e) => set("voteTieBreak", e.target.value as RoundForm["voteTieBreak"])}>
                    {(Object.keys(TIE_LABEL) as (keyof typeof TIE_LABEL)[]).map((k) => (
                      <option key={k} value={k}>
                        {TIE_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="flex items-end pb-2">
                <Toggle checked={f.voteLiveResults} onChange={(v) => set("voteLiveResults", v)} label="Voti visibili in diretta" />
              </div>
            </div>
          </fieldset>
        )}
        {isBet && (
          <fieldset className="space-y-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
            <legend className="px-1 font-display text-lg text-gold">🎰 Scommetti tutto</legend>
            <p className="text-sm text-white/70">
              A ogni domanda, prima di MOSTRA RISPOSTE, ogni giocatore punta dal telefono 0%, 25%, 50% o 100% (all in) dei suoi punti. Risposta esatta: +posta.
              Risposta sbagliata, parziale o mancante: −posta. Niente punti base, bonus velocità o eventi speciali: conta solo la puntata. Le puntate si chiudono
              quando mostri le risposte.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Puntata minima" error={errors.betMinStake} hint="Ogni puntata (tranne 0%) vale almeno questa cifra: anche chi ha 0 punti può giocare">
                {(id) => <Input id={id} type="number" min={0} max={100000} step={50} value={f.betMinStake} onChange={(e) => set("betMinStake", e.target.value)} />}
              </Field>
              <Field label="Se il giocatore non sceglie" error={errors.betDefaultTier} hint="Consigliato: non punta (0%)">
                {(id) => (
                  <Select id={id} value={String(f.betDefaultTier)} onChange={(e) => set("betDefaultTier", Number(e.target.value) as BetTier)}>
                    {BET_TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t === 0 ? "Non punta (0%)" : `Punta ${BET_TIER_LABEL[t]}${t === 100 ? " (100%)" : ""}`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </fieldset>
        )}
        {isComeback && (
          <fieldset className="space-y-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
            <legend className="px-1 font-display text-lg text-gold">🚀 Grande ribaltone</legend>
            <p className="text-sm text-white/70">
              All&apos;apertura di ogni domanda chi è nella metà bassa della classifica riceve il BOOST: i punti guadagnati vengono moltiplicati. Facoltativo: il
              capolista paga gli errori di più. L&apos;elenco dei giocatori col boost si decide quando mostri le risposte ed è visibile su TV e telefoni.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="BOOST per chi insegue" error={errors.comebackMultiplier} hint="Moltiplica i punti guadagnati (1 = spento)">
                {(id) => <Input id={id} type="number" min={1} max={10} step={0.5} value={f.comebackMultiplier} onChange={(e) => set("comebackMultiplier", e.target.value)} />}
              </Field>
              <Field label="Penalità del capolista" error={errors.comebackLeaderPenalty} hint="Moltiplica i punti persi da chi è primo (1 = spento)">
                {(id) => <Input id={id} type="number" min={1} max={10} step={0.5} value={f.comebackLeaderPenalty} onChange={(e) => set("comebackLeaderPenalty", e.target.value)} />}
              </Field>
            </div>
          </fieldset>
        )}
        {removedWithQuestions.length > 0 && (
          <InfoNote tone="warn">
            Le domande delle categorie rimosse ({removedWithQuestions.map((o) => o.label).join(", ")}) resteranno nel round senza categoria: dovrai riassegnarle.
          </InfoNote>
        )}

        <fieldset className="space-y-3 rounded-xl border border-white/10 p-3">
          <legend className="px-1 font-display text-lg text-white/90">Punteggio e tempi del round</legend>
          {isBet && <p className="text-xs text-gold/90">Nella manche Scommetti tutto punti, moltiplicatori e bonus velocità non contano: vale solo la posta. Resta valido il tempo per rispondere.</p>}
          <div className={isBet ? "hidden" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
            <Field label="Moltiplicatore punti" error={errors.pointsMultiplier} hint="1 = normale, 2 = doppio">
              {(id) => <Input id={id} type="number" min={0} max={20} step={0.5} value={f.pointsMultiplier} onChange={(e) => set("pointsMultiplier", e.target.value)} />}
            </Field>
            <Field label="Moltiplicatore penalità" error={errors.penaltyMultiplier}>
              {(id) => (
                <Input id={id} type="number" min={0} max={20} step={0.5} disabled={f.noPenalty} value={f.penaltyMultiplier} onChange={(e) => set("penaltyMultiplier", e.target.value)} />
              )}
            </Field>
            <Field label="Bonus velocità massimo" error={errors.speedBonusMax} hint="Punti extra a chi risponde subito (0 = no)">
              {(id) => <Input id={id} type="number" min={0} max={5000} step={50} value={f.speedBonusMax} onChange={(e) => set("speedBonusMax", e.target.value)} />}
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox checked={f.noPenalty} onChange={(v) => set("noPenalty", v)} label="Round senza penalità" />
            </div>
          </div>
          <p className="text-xs text-white/55">Valori del round (lascia vuoto per usare quelli della serata). Valgono se la singola domanda non ne ha di propri.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Punti risposta corretta" error={errors.correctPoints}>
              {(id) => (
                <Input id={id} type="number" min={0} max={100000} placeholder={`Serata: ${defaults.correctPoints ?? "-"}`} value={f.correctPoints} onChange={(e) => set("correctPoints", e.target.value)} />
              )}
            </Field>
            <Field label="Penalità risposta errata" error={errors.wrongPenalty}>
              {(id) => (
                <Input id={id} type="number" min={0} max={100000} placeholder={`Serata: ${defaults.wrongPenalty ?? "-"}`} value={f.wrongPenalty} onChange={(e) => set("wrongPenalty", e.target.value)} />
              )}
            </Field>
            <Field label="Secondi per rispondere" error={errors.durationSeconds}>
              {(id) => (
                <Input id={id} type="number" min={3} max={120} placeholder={`Serata: ${defaults.durationSeconds ?? "-"}`} value={f.durationSeconds} onChange={(e) => set("durationSeconds", e.target.value)} />
              )}
            </Field>
          </div>
        </fieldset>
        {general && <InfoNote tone="danger">{general}</InfoNote>}
      </form>
    </Modal>
  );
}
