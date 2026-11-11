"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { errorMessage, fieldErrors } from "../api";
import { Checkbox, InfoNote } from "../common";
import { intOrNull } from "../format";
import type { EventDefinition, GlobalSettings, SessionSettings } from "../types";
import { AdvanceModeField } from "../sessions/SessionForms";
import type { AdvanceMode } from "@/lib/game-engine/autoplay";

type Tri = "" | "yes" | "no";
const triOf = (v: boolean | undefined): Tri => (v === undefined ? "" : v ? "yes" : "no");
const boolOf = (v: Tri): boolean | undefined => (v === "" ? undefined : v === "yes");
const str = (n: number | undefined) => (n === undefined ? "" : String(n));

/** Eventi che Palmino può estrarre con "Palmino decide". */
export function palminoCandidates(defs: EventDefinition[]) {
  return defs.filter((d) => d.enabled && d.type !== "palmino_decides" && d.type !== "mystery_question");
}

export function SessionSettingsModal({
  settings,
  global,
  defs,
  frozen,
  onClose,
  onSubmit,
}: {
  settings: SessionSettings;
  global: GlobalSettings | null;
  defs: EventDefinition[];
  /** Dopo la pubblicazione punteggi e tempi sono congelati. */
  frozen: boolean;
  onClose: () => void;
  onSubmit: (settings: SessionSettings) => Promise<void>;
}) {
  const [correctPoints, setCorrectPoints] = useState(str(settings.correctPoints));
  const [wrongPenalty, setWrongPenalty] = useState(str(settings.wrongPenalty));
  const [noAnswerPenalty, setNoAnswerPenalty] = useState(str(settings.noAnswerPenalty));
  const [durationSeconds, setDurationSeconds] = useState(str(settings.durationSeconds));
  const [allowNegative, setAllowNegative] = useState<Tri>(triOf(settings.allowNegative));
  const [joinLocked, setJoinLocked] = useState(settings.joinLocked ?? false);
  const [allowLateJoin, setAllowLateJoin] = useState(settings.allowLateJoin ?? true);
  const [nicknameMaxLength, setNicknameMaxLength] = useState(str(settings.nicknameMaxLength));
  const [autoEvents, setAutoEvents] = useState(settings.autoEvents ?? true);
  const [pool, setPool] = useState<string[]>(settings.palminoPool ?? []);
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>(settings.advanceMode ?? "manual");
  const [palminoWheel, setPalminoWheel] = useState(settings.palminoWheel ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const candidates = palminoCandidates(defs);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGeneral(null);
    const out: SessionSettings = {
      joinLocked,
      allowLateJoin,
      autoEvents,
      palminoPool: pool,
      advanceMode,
      palminoWheel,
    };
    const nick = intOrNull(nicknameMaxLength);
    if (nick !== null) out.nicknameMaxLength = nick;
    if (!frozen) {
      const pairs: [keyof SessionSettings, string][] = [
        ["correctPoints", correctPoints],
        ["wrongPenalty", wrongPenalty],
        ["noAnswerPenalty", noAnswerPenalty],
        ["durationSeconds", durationSeconds],
      ];
      for (const [k, v] of pairs) {
        const n = intOrNull(v);
        if (n !== null) (out as Record<string, unknown>)[k] = n;
      }
      const neg = boolOf(allowNegative);
      if (neg !== undefined) out.allowNegative = neg;
    }
    try {
      await onSubmit(out);
    } catch (err) {
      const fe = fieldErrors(err);
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(fe)) mapped[k.replace(/^settings\./, "")] = v;
      setErrors(mapped);
      setGeneral(Object.keys(mapped).length ? "Controlla i campi evidenziati" : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const g = global;
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Regole della serata"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" type="submit" form="settings-form" loading={saving}>
            Salva regole
          </Button>
        </>
      }
    >
      <form id="settings-form" onSubmit={submit} className="space-y-4">
        <fieldset className="space-y-3 rounded-xl border border-white/10 p-3">
          <legend className="px-1 font-display text-lg text-white/90">Punteggio e tempo</legend>
          {frozen ? (
            <InfoNote tone="warn">Serata pubblicata: punteggi e tempi sono congelati e non si possono più modificare.</InfoNote>
          ) : (
            <p className="text-xs text-white/55">Lascia vuoto per usare i valori predefiniti delle impostazioni globali (indicati nel campo).</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Punti risposta corretta" error={errors.correctPoints}>
              {(id) => (
                <Input id={id} type="number" min={0} max={100000} disabled={frozen} placeholder={g ? `Predefinito: ${g.scoring.correctPoints}` : ""} value={correctPoints} onChange={(e) => setCorrectPoints(e.target.value)} />
              )}
            </Field>
            <Field label="Penalità risposta errata" error={errors.wrongPenalty}>
              {(id) => (
                <Input id={id} type="number" min={0} max={100000} disabled={frozen} placeholder={g ? `Predefinito: ${g.scoring.wrongPenalty}` : ""} value={wrongPenalty} onChange={(e) => setWrongPenalty(e.target.value)} />
              )}
            </Field>
            <Field label="Penalità senza risposta" error={errors.noAnswerPenalty}>
              {(id) => (
                <Input id={id} type="number" min={0} max={100000} disabled={frozen} placeholder={g ? `Predefinito: ${g.scoring.noAnswerPenalty}` : ""} value={noAnswerPenalty} onChange={(e) => setNoAnswerPenalty(e.target.value)} />
              )}
            </Field>
            <Field label="Secondi per rispondere" error={errors.durationSeconds}>
              {(id) => (
                <Input id={id} type="number" min={3} max={120} disabled={frozen} placeholder={g ? `Predefinito: ${g.timing.defaultDurationSeconds}` : ""} value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} />
              )}
            </Field>
          </div>
          <Field label="Punteggio sotto zero" error={errors.allowNegative}>
            {(id) => (
              <Select id={id} className="sm:max-w-sm" disabled={frozen} value={allowNegative} onChange={(e) => setAllowNegative(e.target.value as Tri)}>
                <option value="">Predefinito globale ({g ? (g.scoring.allowNegative ? "consentito" : "non consentito") : "-"})</option>
                <option value="yes">Consentito</option>
                <option value="no">Non consentito (minimo 0)</option>
              </Select>
            )}
          </Field>
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-white/10 p-3">
          <legend className="px-1 font-display text-lg text-white/90">Conduzione</legend>
          <AdvanceModeField value={advanceMode} onChange={setAdvanceMode} error={errors.advanceMode} published={frozen} />
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-white/10 p-3">
          <legend className="px-1 font-display text-lg text-white/90">Ingresso giocatori</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox checked={joinLocked} onChange={setJoinLocked} label="Ingressi bloccati" hint="Nessun nuovo giocatore può entrare (si può cambiare anche dalla regia)." />
            <Checkbox checked={allowLateJoin} onChange={setAllowLateJoin} label="Ingresso a partita iniziata" hint="Chi arriva tardi può entrare dopo la sigla." />
          </div>
          <Field label="Lunghezza massima nickname" error={errors.nicknameMaxLength}>
            {(id) => (
              <Input
                id={id}
                className="sm:max-w-xs"
                type="number"
                min={4}
                max={24}
                placeholder={g ? `Predefinito: ${g.players.nicknameMaxLength}` : ""}
                value={nicknameMaxLength}
                onChange={(e) => setNicknameMaxLength(e.target.value)}
              />
            )}
          </Field>
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-white/10 p-3">
          <legend className="px-1 font-display text-lg text-white/90">Palmino</legend>
          <Checkbox
            checked={autoEvents}
            onChange={setAutoEvents}
            label="Eventi programmati automatici"
            hint="Gli eventi associati alle domande partono da soli quando la domanda arriva in onda."
          />
          <Checkbox
            checked={palminoWheel}
            onChange={setPalminoWheel}
            // le domande della ruota si riservano alla pubblicazione: dopo si può solo spegnerla
            disabled={frozen && !settings.palminoWheel}
            label="🎡 Ruota di Palmino"
            hint={
              frozen && !settings.palminoWheel
                ? "Si attiva prima della pubblicazione: le domande della ruota si scelgono quando la serata viene pubblicata."
                : "Dalla 5ª domanda, ogni tanto (al massimo una volta per round), Palmino gira una ruota che sceglie la categoria della domanda successiva. Si decide alla pubblicazione; spegnendola dopo, la ruota non compare."
            }
          />
          <div>
            <p className="text-sm font-bold text-white/80">Eventi che Palmino può estrarre con &laquo;Palmino decide&raquo;</p>
            <p className="mb-2 text-xs text-white/55">Nessuna selezione = elenco predefinito (punti doppi, nessuna penalità, lampo, super bonus, recupero impossibile).</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {candidates.map((d) => (
                <Checkbox
                  key={d.key}
                  checked={pool.includes(d.key)}
                  onChange={(c) => setPool((p) => (c ? [...p, d.key] : p.filter((k) => k !== d.key)))}
                  label={d.title}
                  hint={d.tagline}
                />
              ))}
            </div>
            {errors.palminoPool && <p className="text-xs font-bold text-[#ff8098]">{errors.palminoPool}</p>}
          </div>
        </fieldset>
        {general && <InfoNote tone="danger">{general}</InfoNote>}
      </form>
    </Modal>
  );
}
