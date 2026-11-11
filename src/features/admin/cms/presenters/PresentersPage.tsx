"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Field, Input, Panel, Select, Textarea, Toggle, useConfirm, useToast } from "@/components/ui";
import type { TemplateRow } from "@/lib/server/cms/dialogue";
import { ALLOWED_PLACEHOLDERS, CHARACTER_ANIMATIONS, SHOW_EVENT_TYPES, type DirectorConfig, type ShowEventType } from "@/lib/show/types";
import { previewText } from "@/lib/show/preview";
import { errorMessage, send, useApi } from "../api";
import { Checkbox, ErrorBlock, LoadingBlock, PageHeader } from "../common";

type Who = "professore" | "regina" | "palmino";
const WHO: { value: Who; label: string; icon: string }[] = [
  { value: "professore", label: "Il Professore", icon: "🎓" },
  { value: "regina", label: "La Regina", icon: "👑" },
  { value: "palmino", label: "Palmino", icon: "🌴" },
];
const WHO_ICON: Record<Who, string> = { professore: "🎓", regina: "👑", palmino: "🌴" };

/** Nome leggibile degli eventi (quando parlano i presentatori). */
export const EVENT_LABEL: Record<ShowEventType, string> = {
  LEADER_CHANGED: "Nuovo primo in classifica",
  LEADER_TIE: "Pari merito al primo posto",
  LEADER_KEPT: "Primo da più domande di fila",
  OVERTAKE: "Sorpasso",
  COMEBACK: "Rimonta (+3 posizioni)",
  NEW_LAST: "Nuovo ultimo",
  FASTEST_CORRECT: "Risposta giusta più veloce",
  CORRECT_STREAK: "Serie di risposte giuste",
  WRONG_STREAK: "Serie di errori",
  ONLY_ONE_CORRECT: "Uno solo ha risposto giusto",
  ALL_WRONG: "Tutti sbagliano",
  ALL_CORRECT: "Tutti rispondono giusto",
  POINTS_MILESTONE: "Supera una soglia di punti",
  ROUND_WINNER: "Vincitore del round",
  PLAYERS_JOINED: "Lobby: saluto ai nuovi arrivati",
  FINAL_ROUND_START: "Inizio del round finale",
  TEAM_LEADER_CHANGED: "Squadre: nuova squadra in testa",
  TEAM_ROUND_WINNER: "Squadre: squadra vincitrice del round",
  RETORT_PROFESSORE: "Battibecco: rispondono al Professore",
  RETORT_REGINA: "Battibecco: rispondono alla Regina",
  RETORT_PALMINO: "Battibecco: rispondono a Palmino",
};

function DirectorPanel() {
  const { data, error, reload, setData } = useApi<{ config: DirectorConfig }>("/api/admin/show/config");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return <LoadingBlock label="Regia automatica…" />;
  const c = data.config;
  const save = async (patch: Partial<DirectorConfig>) => {
    setBusy(true);
    try {
      const r = await send<{ config: DirectorConfig }>("/api/admin/show/config", "PUT", patch);
      setData(r);
      toast("ok", "Regia aggiornata");
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const allEvents = c.events.length === 0;
  const isOn = (e: ShowEventType) => allEvents || c.events.includes(e);
  const toggleEvent = (e: ShowEventType, on: boolean) => {
    const cur = allEvents ? [...SHOW_EVENT_TYPES] : [...c.events];
    const next = on ? [...new Set([...cur, e])] : cur.filter((x) => x !== e);
    void save({ events: next.length === SHOW_EVENT_TYPES.length ? [] : next });
  };
  return (
    <Panel title="Regia automatica">
      <div className="flex flex-col gap-4">
        <Toggle checked={c.enabled} disabled={busy} onChange={(v) => void save({ enabled: v })} label={c.enabled ? "Commenti automatici ATTIVI" : "Commenti automatici spenti"} />
        <p className="text-sm text-white/65">
          Dopo i punti di ogni risposta il server confronta la classifica di prima e di dopo, trova cosa è successo davvero (nuovo primo, sorpassi, serie, il più
          veloce…) e i presentatori lo commentano con i nomi veri. Niente eventi interessanti = nessun commento in più.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Battute per momento" hint="0 = nessuna, al massimo 3 (consigliato 2: un piccolo dialogo)">
            {(id) => (
              <Select id={id} value={c.maxLines} disabled={busy} onChange={(e) => void save({ maxLines: Number(e.target.value) })}>
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Battibecchi" hint="Quanto spesso un altro presentatore risponde (o prende in giro) chi ha appena parlato">
            {(id) => (
              <Select id={id} value={c.banterPercent} disabled={busy} onChange={(e) => void save({ banterPercent: Number(e.target.value) })}>
                {[
                  [0, "Mai"],
                  [25, "Ogni tanto (25%)"],
                  [50, "Spesso (50%)"],
                  [75, "Quasi sempre (75%)"],
                  [100, "Sempre"],
                ].map(([n, label]) => (
                  <option key={n} value={n}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Menzioni per concorrente in un round" hint="Così non nominano sempre la stessa persona">
            {(id) => (
              <Select id={id} value={c.maxMentionsPerPlayerPerRound} disabled={busy} onChange={(e) => void save({ maxMentionsPerPlayerPerRound: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-white/80">Quando possono intervenire</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SHOW_EVENT_TYPES.map((e) => (
              <Checkbox key={e} checked={isOn(e)} disabled={busy} onChange={(v) => toggleEvent(e, v)} label={EVENT_LABEL[e]} />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

interface Draft {
  character: Who;
  event: ShowEventType;
  text: string;
  weight: number;
  cooldownSec: number;
  animation: (typeof CHARACTER_ANIMATIONS)[number] | null;
  enabled: boolean;
}

function TemplateEditor({ initial, onSave, onCancel, busy, testName }: { initial: Draft; onSave: (d: Draft) => void; onCancel: () => void; busy: boolean; testName: string }) {
  const [d, setD] = useState<Draft>(initial);
  const allowed = ALLOWED_PLACEHOLDERS[d.event];
  const unknown = [...d.text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((p) => !allowed.includes(p));
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold/40 bg-black/30 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Personaggio">
          {(id) => (
            <Select id={id} value={d.character} onChange={(e) => setD({ ...d, character: e.target.value as Who })}>
              {WHO.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.icon} {w.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Evento">
          {(id) => (
            <Select id={id} value={d.event} onChange={(e) => setD({ ...d, event: e.target.value as ShowEventType })}>
              {SHOW_EVENT_TYPES.map((e) => (
                <option key={e} value={e}>
                  {EVENT_LABEL[e]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Animazione">
          {(id) => (
            <Select id={id} value={d.animation ?? ""} onChange={(e) => setD({ ...d, animation: (e.target.value || null) as Draft["animation"] })}>
              <option value="">—</option>
              {CHARACTER_ANIMATIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field
        label="Testo"
        hint={
          <>
            Segnaposto ammessi: {allowed.length ? allowed.map((p) => `{${p}}`).join(" ") : "nessuno"} · tag voce facoltativi: [excited] [laughs] [giggles] [shouts]
            [sarcastic] [sighs]
          </>
        }
        error={unknown.length ? `Segnaposto non ammessi per questo evento: ${unknown.map((u) => `{${u}}`).join(" ")}` : null}
      >
        {(id) => <Textarea id={id} rows={2} maxLength={300} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} />}
      </Field>
      <p className="text-sm text-white/60">
        Anteprima: <span className="text-white">{previewText(d.event, d.text, testName)}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Peso" hint="più alto = scelta più spesso">
          {(id) => <Input id={id} type="number" min={0.1} max={10} step={0.5} value={d.weight} onChange={(e) => setD({ ...d, weight: Number(e.target.value) })} />}
        </Field>
        <Field label="Pausa prima di riusarla (s)">
          {(id) => <Input id={id} type="number" min={0} max={7200} step={30} value={d.cooldownSec} onChange={(e) => setD({ ...d, cooldownSec: Number(e.target.value) })} />}
        </Field>
        <div className="flex items-end">
          <Toggle checked={d.enabled} onChange={(v) => setD({ ...d, enabled: v })} label={d.enabled ? "Attiva" : "Disattivata"} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Annulla
        </Button>
        <Button size="sm" loading={busy} disabled={unknown.length > 0 || d.text.trim().length < 3} onClick={() => onSave(d)}>
          Salva
        </Button>
      </div>
    </div>
  );
}

function LibraryPanel() {
  const { data, error, reload } = useApi<{ templates: TemplateRow[] }>("/api/admin/show/templates");
  const toast = useToast();
  const confirm = useConfirm();
  const [who, setWho] = useState<Who | "">("");
  const [event, setEvent] = useState<ShowEventType | "">("");
  const [q, setQ] = useState("");
  const [testName, setTestName] = useState("Mario");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      (data?.templates ?? []).filter(
        (t) => (!who || t.character === who) && (!event || t.event === event) && (!q || t.text.toLowerCase().includes(q.toLowerCase())),
      ),
    [data, who, event, q],
  );
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return <LoadingBlock label="Battute…" />;

  const act = async (key: string, fn: () => Promise<unknown>, okText: string) => {
    setBusy(key);
    try {
      await fn();
      toast("ok", okText);
      reload();
      return true;
    } catch (e) {
      toast("error", errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const play = async (t: { character: Who; event: ShowEventType; text: string }) => {
    setBusy("play");
    try {
      const r = await send<{ url: string }>("/api/admin/show/preview", "POST", { character: t.character, event: t.event, text: t.text, name: testName });
      await new Audio(r.url).play();
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const counts = WHO.map((w) => `${w.icon} ${data.templates.filter((t) => t.character === w.value && t.enabled).length}`).join(" · ");
  return (
    <Panel
      title={`Libreria battute (${data.templates.length})`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" loading={busy === "import"} onClick={() => void act("import", () => send("/api/admin/show/import", "POST"), "Libreria iniziale controllata")}>
            Reimporta mancanti
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            + Nuova battuta
          </Button>
        </div>
      }
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Select value={who} onChange={(e) => setWho(e.target.value as Who | "")} aria-label="Filtra personaggio">
          <option value="">Tutti i personaggi</option>
          {WHO.map((w) => (
            <option key={w.value} value={w.value}>
              {w.icon} {w.label}
            </option>
          ))}
        </Select>
        <Select value={event} onChange={(e) => setEvent(e.target.value as ShowEventType | "")} aria-label="Filtra evento">
          <option value="">Tutti gli eventi</option>
          {SHOW_EVENT_TYPES.map((e) => (
            <option key={e} value={e}>
              {EVENT_LABEL[e]}
            </option>
          ))}
        </Select>
        <Input placeholder="Cerca nel testo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca nel testo" />
        <Input placeholder="Nome di prova" value={testName} maxLength={24} onChange={(e) => setTestName(e.target.value || "Mario")} aria-label="Nome di prova per l'anteprima" />
      </div>
      <p className="mb-3 text-xs text-white/55">
        Attive per personaggio: {counts} · Il nome di prova serve per ascoltare come suona una battuta (▶ usa la voce vera e consuma pochi caratteri, poi resta in cache).
      </p>

      {editing === "new" && (
        <div className="mb-3">
          <TemplateEditor
            initial={{ character: who || "regina", event: event || "LEADER_CHANGED", text: "", weight: 1, cooldownSec: 240, animation: "talk", enabled: true }}
            busy={busy === "new"}
            testName={testName}
            onCancel={() => setEditing(null)}
            onSave={(d) => void act("new", () => send("/api/admin/show/templates", "POST", d), "Battuta aggiunta").then((ok) => ok && setEditing(null))}
          />
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((t) =>
          editing === t.id ? (
            <li key={t.id}>
              <TemplateEditor
                initial={{ character: t.character, event: t.event, text: t.text, weight: t.weight, cooldownSec: t.cooldownSec, animation: t.animation, enabled: t.enabled }}
                busy={busy === t.id}
                testName={testName}
                onCancel={() => setEditing(null)}
                onSave={(d) => void act(t.id, () => send(`/api/admin/show/templates/${encodeURIComponent(t.id)}`, "PATCH", d), "Battuta salvata").then((ok) => ok && setEditing(null))}
              />
            </li>
          ) : (
            <li key={t.id} className={`flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center ${t.enabled ? "" : "opacity-50"}`}>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span title={t.character}>{WHO_ICON[t.character]}</span>
                  <Badge color="violet">{EVENT_LABEL[t.event]}</Badge>
                  {t.weight > 1 && <Badge color="gold">peso {t.weight}</Badge>}
                  {t.usedCount > 0 && <Badge color="gray">detta {t.usedCount}×</Badge>}
                  {!t.enabled && <Badge color="red">disattivata</Badge>}
                </div>
                <p className="text-sm text-white/90">{t.text}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" disabled={busy === "play"} onClick={() => void play(t)} aria-label="Ascolta">
                  ▶
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(t.id)}>
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === `t-${t.id}`}
                  onClick={() => void act(`t-${t.id}`, () => send(`/api/admin/show/templates/${encodeURIComponent(t.id)}`, "PATCH", { enabled: !t.enabled }), t.enabled ? "Battuta disattivata" : "Battuta attivata")}
                >
                  {t.enabled ? "Disattiva" : "Attiva"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!(await confirm({ title: "Eliminare la battuta?", message: t.text, confirmLabel: "Elimina", danger: true }))) return;
                    void act(`d-${t.id}`, () => send(`/api/admin/show/templates/${encodeURIComponent(t.id)}`, "DELETE"), "Battuta eliminata");
                  }}
                >
                  🗑
                </Button>
              </div>
            </li>
          ),
        )}
        {rows.length === 0 && <li className="text-sm text-white/60">Nessuna battuta con questi filtri.</li>}
      </ul>
    </Panel>
  );
}

export function PresentersPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Presentatori" subtitle="Commenti automatici con i nomi veri dei concorrenti: quando intervengono, quanto spesso e con quali battute." />
      <DirectorPanel />
      <LibraryPanel />
    </div>
  );
}
