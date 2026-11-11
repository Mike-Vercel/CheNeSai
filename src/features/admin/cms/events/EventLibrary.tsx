"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { Badge, Button, EmptyState, Field, Input, Panel, Textarea, Toggle, useToast } from "@/components/ui";
import { Character } from "@/features/game/components/brand";
import { ROUND_KINDS, type RoundKind, type SpecialEventType } from "@/lib/game-engine/types";
import { errorMessage, fieldErrors, send, useApi } from "../api";
import { Checkbox, ErrorBlock, InfoNote, LoadingBlock, PageHeader } from "../common";
import { ROUND_KIND } from "../format";
import type { EventDefinition, EventParams } from "../types";

/** Effetto reale di ogni tipo sul punteggio (vedi src/lib/game-engine/scoring.ts). */
const RULE: Record<SpecialEventType, { effect: string; live?: boolean; defaults: EventParams }> = {
  double_points: { effect: "Moltiplica i punti della risposta corretta (predefinito ×2). Le penalità restano invariate.", defaults: { correctMultiplier: 2 } },
  no_penalty: { effect: "Azzera la penalità per risposta errata e per mancata risposta su quella domanda.", defaults: {} },
  lightning: {
    effect: "Riduce il tempo per rispondere al valore indicato (predefinito 6 s, mai più del tempo originale). Si può aggiungere un moltiplicatore punti.",
    defaults: { durationSeconds: 6 },
  },
  super_bonus: { effect: "Aggiunge punti bonus fissi a chi risponde correttamente (predefinito +500).", defaults: { bonusPoints: 500 } },
  mystery_question: {
    effect: "Gioca subito una domanda di riserva del round (segnata come \"Riserva\" nell'editor della serata), con i moltiplicatori indicati.",
    live: true,
    defaults: {},
  },
  impossible_comeback: { effect: "Domanda ad altissimo valore per chi è indietro: moltiplica i punti della risposta corretta (predefinito ×3).", defaults: { correctMultiplier: 3 } },
  palmino_decides: {
    effect: "Palmino estrae a sorte uno degli eventi ammessi per la serata (pool scelto nelle regole della serata) e lo applica alla domanda.",
    live: true,
    defaults: {},
  },
  finalissima: { effect: "Domanda decisiva: punti corretti ×5 e penalità per errore ×2 (predefiniti).", defaults: { correctMultiplier: 5, wrongMultiplier: 2 } },
};

const PARAMS: { key: keyof EventParams; label: string; step: number; min: number; max: number; hint: string }[] = [
  { key: "correctMultiplier", label: "Moltiplicatore punti", step: 0.5, min: 0, max: 20, hint: "Sui punti della risposta corretta" },
  { key: "wrongMultiplier", label: "Moltiplicatore penalità", step: 0.5, min: 0, max: 20, hint: "Sulla penalità per errore" },
  { key: "bonusPoints", label: "Punti bonus", step: 50, min: 0, max: 100000, hint: "Aggiunti a chi risponde giusto" },
  { key: "durationSeconds", label: "Secondi per rispondere", step: 1, min: 3, max: 60, hint: "Tempo ridotto (mai oltre l'originale)" },
];

function EventCard({ def, onSaved }: { def: EventDefinition; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(def.title);
  const [tagline, setTagline] = useState(def.tagline);
  const [description, setDescription] = useState(def.description);
  const [params, setParams] = useState<Record<keyof EventParams, string>>({
    correctMultiplier: def.params.correctMultiplier?.toString() ?? "",
    wrongMultiplier: def.params.wrongMultiplier?.toString() ?? "",
    bonusPoints: def.params.bonusPoints?.toString() ?? "",
    durationSeconds: def.params.durationSeconds?.toString() ?? "",
  });
  const [maxPerSession, setMaxPerSession] = useState(String(def.maxPerSession));
  const [kinds, setKinds] = useState<RoundKind[]>(def.allowedRoundKinds);
  const [enabled, setEnabled] = useState(def.enabled);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const rule = RULE[def.type];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (kinds.length === 0) {
      setError("Seleziona almeno un tipo di round");
      return;
    }
    setSaving(true);
    setErrors({});
    setError(null);
    const p: EventParams = {};
    for (const { key } of PARAMS) {
      const v = params[key].trim();
      if (v !== "") p[key] = Number(v);
    }
    try {
      await send(`/api/admin/event-definitions/${def.id}`, "PATCH", {
        title: title.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        params: p,
        maxPerSession: Number(maxPerSession),
        allowedRoundKinds: kinds,
        enabled,
      });
      toast("ok", `Evento "${title.trim()}" salvato`);
      onSaved();
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setError(Object.keys(fe).length ? "Controlla i campi evidenziati" : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className={clsx("rounded-2xl border bg-[#1d0c30] p-4 shadow-lg", enabled ? "border-white/10" : "border-white/5 opacity-75")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight text-gold">{def.title}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{def.key}</Badge>
            {rule.live ? <Badge color="fuchsia">Solo dalla regia live</Badge> : <Badge color="blue">Programmabile sulle domande</Badge>}
            {!enabled && <Badge color="red">Disattivato</Badge>}
          </div>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} label={enabled ? "Attivo" : "Spento"} />
      </div>
      <InfoNote className="mt-3">
        <strong>Effetto reale:</strong> {rule.effect}
      </InfoNote>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Titolo sullo schermo" error={errors.title}>
          {(id) => <Input id={id} required minLength={2} maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Frase di lancio" error={errors.tagline}>
          {(id) => <Input id={id} required minLength={2} maxLength={120} value={tagline} onChange={(e) => setTagline(e.target.value)} />}
        </Field>
      </div>
      <Field label="Descrizione (per la regia)" error={errors.description} className="mt-3">
        {(id) => <Textarea id={id} className="min-h-14" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <fieldset className="mt-3">
        <legend className="mb-1 text-sm font-bold text-white/80">Parametri (vuoto = valore predefinito)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PARAMS.map((p) => (
            <Field key={p.key} label={p.label} hint={p.hint} error={errors[`params.${p.key}`]}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  placeholder={rule.defaults[p.key] !== undefined ? `Predef. ${rule.defaults[p.key]}` : "—"}
                  value={params[p.key]}
                  onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
        <Field label="Massimo per serata" error={errors.maxPerSession} hint="0 = mai">
          {(id) => <Input id={id} type="number" min={0} max={50} value={maxPerSession} onChange={(e) => setMaxPerSession(e.target.value)} />}
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-bold text-white/80">Round in cui è ammesso</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {/* Scommetti tutto: la posta la decidono i giocatori, gli eventi non sono ammessi */}
            {ROUND_KINDS.filter((k) => k !== "bet").map((k) => (
              <Checkbox
                key={k}
                checked={kinds.includes(k)}
                onChange={(c) => setKinds((prev) => (c ? [...prev, k] : prev.filter((x) => x !== k)))}
                label={`${ROUND_KIND[k].icon} ${ROUND_KIND[k].label}`}
              />
            ))}
          </div>
        </fieldset>
      </div>
      {error && (
        <InfoNote tone="danger" className="mt-3">
          {error}
        </InfoNote>
      )}
      <div className="mt-4 flex justify-end">
        <Button type="submit" variant="gold" loading={saving}>
          Salva evento
        </Button>
      </div>
    </form>
  );
}

export function EventLibrary() {
  const req = useApi<{ definitions: EventDefinition[] }>("/api/admin/event-definitions");
  const defs = req.data?.definitions ?? [];
  return (
    <div className="space-y-5">
      <PageHeader title="Eventi di Palmino" subtitle="La libreria delle sorprese che Palmino porta in scena" />
      <Panel>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Character who="palmino" small className="w-28 shrink-0 sm:w-32" />
          <div className="space-y-2 text-sm text-white/75">
            <p>
              Gli eventi cambiano le regole di <strong className="text-white">una singola domanda</strong> e vengono annunciati sullo schermo prima che si aprano le
              risposte, così i giocatori sanno sempre cosa si gioca.
            </p>
            <p>
              Si possono <strong className="text-white">programmare</strong> su una domanda nell&apos;editor della serata, oppure lanciare a mano dalla regia live.
              <em> Domanda misteriosa</em> e <em>Palmino decide</em> si attivano solo dalla regia live.
            </p>
            <p>Modifiche a titolo e parametri valgono per le prossime programmazioni: gli eventi già programmati conservano i parametri del momento.</p>
          </div>
        </div>
      </Panel>
      {req.error ? (
        <ErrorBlock message={req.error} onRetry={req.reload} />
      ) : !req.data ? (
        <LoadingBlock />
      ) : defs.length === 0 ? (
        <EmptyState title="Nessun evento definito" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {defs.map((d) => (
            <EventCard key={`${d.id}-${d.title}-${d.enabled}-${JSON.stringify(d.params)}`} def={d} onSaved={req.reload} />
          ))}
        </div>
      )}
    </div>
  );
}
