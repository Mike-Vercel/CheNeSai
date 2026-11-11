"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { errorMessage, fieldErrors, send, useApi } from "../api";
import { Checkbox, InfoNote } from "../common";
import { fromLocalInput, toLocalInput } from "../format";
import type { Season } from "../types";
import { ADVANCE_MODE_LABELS, type AdvanceMode } from "@/lib/game-engine/autoplay";

export interface SessionInfoValues {
  title: string;
  description: string;
  scheduledAt: string; // datetime-local
  isTest: boolean;
  seasonId: string;
  /** scorrimento della serata (scelto alla creazione; poi nelle Regole della serata e in regia) */
  advanceMode: AdvanceMode;
}

export function emptySessionInfo(): SessionInfoValues {
  return { title: "", description: "", scheduledAt: "", isTest: false, seasonId: "", advanceMode: "manual" };
}

const ADVANCE_MODE_HINTS: Record<AdvanceMode, string> = {
  manual: "La regia preme ogni passo (domanda, risposte, soluzione, punti…).",
  auto: "La serata va da sola: ogni passo parte quando il presentatore ha finito di parlare. La regia avvia la serata e può intervenire quando vuole.",
};

/** Scelta "Scorrimento": manuale o automatico (creazione e Regole della serata). */
export function AdvanceModeField({
  value,
  onChange,
  error,
  published = false,
}: {
  value: AdvanceMode;
  onChange: (v: AdvanceMode) => void;
  error?: string;
  published?: boolean;
}) {
  return (
    <Field label="Scorrimento" error={error} hint={published ? "Vale dal prossimo passo se la regia non l'ha già cambiato in diretta." : "Si può cambiare anche dalla regia, a serata in corso."}>
      {(id) => (
        <div className="space-y-1">
          <Select id={id} className="sm:max-w-sm" value={value} onChange={(e) => onChange(e.target.value as AdvanceMode)}>
            <option value="manual">{ADVANCE_MODE_LABELS.manual} (come sempre)</option>
            <option value="auto">{ADVANCE_MODE_LABELS.auto} (va da sola)</option>
          </Select>
          <p className="text-xs text-white/55">{ADVANCE_MODE_HINTS[value]}</p>
        </div>
      )}
    </Field>
  );
}

export function sessionInfoFrom(s: { title: string; description: string | null; scheduledAt: string | null; isTest: boolean; seasonId: string | null }): SessionInfoValues {
  return { title: s.title, description: s.description ?? "", scheduledAt: toLocalInput(s.scheduledAt), isTest: s.isTest, seasonId: s.seasonId ?? "", advanceMode: "manual" };
}

/** Form condiviso tra "Crea serata" e "Modifica dati serata". */
export function SessionInfoModal({
  open,
  onClose,
  title,
  initial,
  submitLabel,
  allowTestToggle,
  showAdvanceMode = false,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initial: SessionInfoValues;
  submitLabel: string;
  allowTestToggle: boolean;
  /** creazione: scelta dello scorrimento (manuale/automatico) */
  showAdvanceMode?: boolean;
  onSubmit: (body: {
    title: string;
    description: string | null;
    scheduledAt: string | null;
    isTest?: boolean;
    seasonId: string | null;
    settings?: { advanceMode: AdvanceMode };
  }) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const seasons = useApi<{ seasons: Season[] }>(open ? "/api/admin/seasons" : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setGeneral(null);
    try {
      await onSubmit({
        title: v.title.trim(),
        description: v.description.trim() || null,
        scheduledAt: fromLocalInput(v.scheduledAt),
        ...(allowTestToggle ? { isTest: v.isTest } : {}),
        seasonId: v.seasonId || null,
        ...(showAdvanceMode ? { settings: { advanceMode: v.advanceMode } } : {}),
      });
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
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" type="submit" form="session-info-form" loading={saving}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="session-info-form" onSubmit={submit} className="space-y-3">
        <Field label="Titolo della serata" error={errors.title}>
          {(id) => (
            <Input id={id} required minLength={3} maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Es. CHE NE SAI?! del venerdì" />
          )}
        </Field>
        <Field label="Descrizione (facoltativa)" error={errors.description}>
          {(id) => <Textarea id={id} maxLength={1000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data e ora" error={errors.scheduledAt} hint="Ora locale del pub">
            {(id) => <Input id={id} type="datetime-local" value={v.scheduledAt} onChange={(e) => setV({ ...v, scheduledAt: e.target.value })} />}
          </Field>
          <Field label="Stagione" error={errors.seasonId}>
            {(id) => (
              <Select id={id} value={v.seasonId} onChange={(e) => setV({ ...v, seasonId: e.target.value })}>
                <option value="">Nessuna stagione</option>
                {(seasons.data?.seasons ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {showAdvanceMode && <AdvanceModeField value={v.advanceMode} onChange={(advanceMode) => setV({ ...v, advanceMode })} error={errors["settings.advanceMode"]} />}
        {allowTestToggle && (
          <Checkbox
            checked={v.isTest}
            onChange={(c) => setV({ ...v, isTest: c })}
            label="Prova generale (non entra nelle classifiche)"
            hint="Le serate di prova si possono azzerare e cancellare; non contano per classifiche mensili e stagionali."
          />
        )}
        {general && <InfoNote tone="danger">{general}</InfoNote>}
      </form>
    </Modal>
  );
}

export function DuplicateSessionModal({
  source,
  onClose,
  onDone,
}: {
  source: { id: string; title: string; isTest: boolean } | null;
  onClose: () => void;
  onDone: (newId: string) => void;
}) {
  const [title, setTitle] = useState(source ? `${source.title} (copia)`.slice(0, 120) : "");
  const [isTest, setIsTest] = useState(source?.isTest ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!source) return;
    setSaving(true);
    setError(null);
    try {
      const r = await send<{ id: string }>(`/api/admin/sessions/${source.id}/duplicate`, "POST", { title: title.trim(), isTest });
      onDone(r.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!source}
      onClose={onClose}
      title="Duplica serata"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" type="submit" form="dup-form" loading={saving}>
            Duplica
          </Button>
        </>
      }
    >
      <form id="dup-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-white/70">
          Vengono copiati round, domande, categorie votabili ed eventi programmati. La copia nasce in bozza, senza data e senza giocatori.
        </p>
        <Field label="Titolo della copia">
          {(id) => <Input id={id} required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Checkbox checked={isTest} onChange={setIsTest} label="Prova generale (non entra nelle classifiche)" />
        {error && <InfoNote tone="danger">{error}</InfoNote>}
      </form>
    </Modal>
  );
}
