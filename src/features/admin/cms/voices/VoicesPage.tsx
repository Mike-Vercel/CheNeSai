"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, EmptyState, Field, Input, Panel, useToast } from "@/components/ui";
import { TTS_ROLE_LABEL, TTS_ROLES, type TtsRole } from "@/features/game/script";
import type { VoicePanelData } from "@/lib/server/cms/voices";
import type { AccountVoice, AppUsage, NamesMode, RoleVoiceSettings, SubscriptionInfo, VoiceConfig } from "@/lib/server/tts";
import type { NamesArchiveStats } from "@/lib/server/tts-names";
import { errorMessage, qs, send, useApi } from "../api";
import { ErrorBlock, InfoNote, LoadingBlock, PageHeader, Segmented, StatTile } from "../common";
import { fmtDateTime, fmtNum } from "../format";
import { CHARS_PER_QUESTION_HINT, VoicePrepBox } from "./VoicePrep";

const ROLE_ICON: Record<TtsRole, string> = { professore: "🎓", regina: "👑", palmino: "🌴", annunciatore: "📣" };
const ROLE_HINT: Record<TtsRole, string> = {
  professore: "Conduce le domande dei suoi round, il punteggio e il finale.",
  regina: "Lobby, classifica, pause e domande dei suoi round.",
  palmino: "Voti di categoria, slogan degli eventi, domande dei suoi round. Più veloce e giocoso.",
  annunciatore: "Voce fuori campo: “Domanda numero…” e i titoli degli eventi. Molto espressivo.",
};

const SLIDERS: { key: keyof Pick<RoleVoiceSettings, "stability" | "similarity" | "style" | "speed">; label: string; min: number; max: number; step: number; hint: string }[] = [
  { key: "stability", label: "Stabilità", min: 0, max: 1, step: 0.05, hint: "bassa = più espressiva, alta = più uniforme" },
  { key: "similarity", label: "Somiglianza", min: 0, max: 1, step: 0.05, hint: "fedeltà al timbro originale" },
  { key: "style", label: "Stile", min: 0, max: 1, step: 0.05, hint: "enfasi e teatralità" },
  { key: "speed", label: "Velocità", min: 0.7, max: 1.2, step: 0.01, hint: "1 = normale" },
];

/** Eleven v4: stabilità bassa = più espressiva (segue meglio gli audio tag), alta = più uniforme. */
const STABILITY_PRESETS = [
  { value: 0, label: "Creativa", hint: "Molto espressiva, segue di più i tag (può essere imprevedibile)" },
  { value: 0.5, label: "Naturale", hint: "Equilibrata, vicina alla voce originale" },
  { value: 1, label: "Robusta", hint: "Molto stabile, segue meno i tag" },
];

interface UsageResponse {
  app: AppUsage;
  names?: NamesArchiveStats;
  subscription: SubscriptionInfo | null;
  subscriptionError: string | null;
}

interface SampleResult {
  url: string;
  chars: number;
  billedChars: number;
  cached: boolean;
}

function UsagePanel({ usage, onReload }: { usage: UsageResponse | null; onReload: () => void }) {
  if (!usage) return <LoadingBlock label="Consumi…" />;
  const sub = usage.subscription;
  const app = usage.app;
  const appPct = app.budget > 0 ? Math.min(100, Math.round((app.monthChars / app.budget) * 100)) : 100;
  return (
    <Panel
      title="Consumi"
      actions={
        <Button size="sm" variant="ghost" onClick={onReload}>
          Aggiorna
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Account ElevenLabs"
          value={sub ? `${fmtNum(sub.used)} / ${fmtNum(sub.limit)}` : "—"}
          hint={sub ? `caratteri del ciclo · rinnovo ${fmtDateTime(sub.resetAt)}` : (usage.subscriptionError ?? "")}
          tone="cyan"
        />
        <StatTile label="App questo mese" value={fmtNum(app.monthChars)} hint={`budget ${fmtNum(app.budget)} · restano ${fmtNum(app.remaining)}`} tone={appPct >= 90 ? "flame" : "gold"} />
        <StatTile
          label="Per fonte (mese)"
          value={fmtNum(app.bySource.pregen)}
          hint={`pre-generate · live ${fmtNum(app.bySource.live + app.bySource.segment + app.bySource.name)} · prove ${fmtNum(app.bySource.sample)}`}
          tone="violet"
        />
        <StatTile label="Battute in archivio" value={fmtNum(app.totalClips)} hint="ognuna pagata una volta sola" tone="lime" />
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10" aria-label={`Budget usato ${appPct}%`}>
        <div className={clsx("h-full rounded-full", appPct >= 90 ? "bg-flame" : "bg-gold")} style={{ width: `${appPct}%` }} />
      </div>
      <p className="mt-2 text-xs text-white/55">
        Oltre il budget mensile dell&apos;app non si genera più nulla: le battute già in archivio continuano a funzionare, le nuove usano la voce del browser.
      </p>
    </Panel>
  );
}

function RoleCard({
  role,
  settings,
  envFallback,
  knownName,
  sample,
  picking,
  dirty,
  tagModels,
  onChange,
  onPick,
}: {
  role: TtsRole;
  tagModels: VoicePanelData["tagModels"];
  settings: RoleVoiceSettings;
  envFallback: boolean;
  knownName: string | null;
  sample: VoicePanelData["samples"][TtsRole];
  picking: boolean;
  dirty: boolean;
  onChange: (s: RoleVoiceSettings) => void;
  onPick: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SampleResult | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function tryVoice() {
    setBusy(true);
    try {
      const r = await send<SampleResult>("/api/admin/tts/sample", "POST", { role });
      setLast(r);
      const a = audioRef.current ?? new Audio();
      audioRef.current = a;
      a.src = r.url;
      void a.play().catch(() => undefined);
      toast("ok", r.cached ? "Prova dalla cache: 0 caratteri" : `Prova generata: ${r.billedChars} caratteri`);
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={clsx("rounded-2xl border bg-[#1d0c30] p-4", picking ? "border-gold" : "border-white/10")} aria-label={TTS_ROLE_LABEL[role]}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-xl text-gold">
            <span aria-hidden>{ROLE_ICON[role]}</span> {TTS_ROLE_LABEL[role]}
          </h3>
          <p className="text-xs text-white/55">{ROLE_HINT[role]}</p>
        </div>
        <Button size="sm" variant={picking ? "gold" : "ghost"} onClick={onPick}>
          {picking ? "Scegli sotto ↓" : "Cambia voce"}
        </Button>
      </div>
      <p className="mt-2 truncate text-sm">
        <span className="font-bold">{settings.voiceName ?? knownName ?? (settings.voiceId ? "Voce assegnata" : "Nessuna voce")}</span>{" "}
        <span className="font-mono text-xs text-white/45">{settings.voiceId || "—"}</span>
        {envFallback && !settings.voiceName && <Badge className="ml-2">da .env</Badge>}
      </p>
      {tagModels.pregen && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label={`Stabilità ${TTS_ROLE_LABEL[role]}`}>
          <span className="font-bold text-white/80">Stabilità v4:</span>
          {STABILITY_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ ...settings, stability: p.value })}
              className={clsx(
                "rounded-lg px-2.5 py-1 font-bold transition",
                Math.abs(settings.stability - p.value) < 0.001 ? "bg-gold text-ink" : "bg-white/10 text-white/75 hover:bg-white/15",
              )}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {SLIDERS.filter((s) => !(tagModels.pregen && tagModels.live && (s.key === "style" || s.key === "speed"))).map((s) => (
          <label key={s.key} className="block text-xs">
            <span className="flex justify-between font-bold text-white/80">
              {s.label}
              {(tagModels.pregen || tagModels.live) && (s.key === "style" || s.key === "speed") && <span className="font-normal text-white/45"> (solo modelli v2/flash)</span>}
              <span className="font-mono text-gold">{settings[s.key].toFixed(2)}</span>
            </span>
            <input
              type="range"
              className="w-full accent-[#ffd43b]"
              min={s.min}
              max={s.max}
              step={s.step}
              value={settings[s.key]}
              onChange={(e) => onChange({ ...settings, [s.key]: Number(e.target.value) })}
              aria-label={`${s.label} ${TTS_ROLE_LABEL[role]}`}
            />
            <span className="text-white/40">{s.hint}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <Button size="sm" variant="violet" loading={busy} disabled={!settings.voiceId || dirty} onClick={tryVoice}>
          ▶ Prova
        </Button>
        <span className="text-xs text-white/60">
          “{sample.text}” · {sample.chars} caratteri{sample.cached || last ? " · in cache (gratis)" : ""}
        </span>
        {dirty && <span className="w-full text-xs text-[#ffe9a3]">Salva le modifiche per provare la voce con le nuove impostazioni.</span>}
        {last && <span className="w-full text-xs text-white/50">{last.cached ? "Ultima prova dalla cache: 0 caratteri." : `Ultima prova generata: ${last.billedChars} caratteri.`}</span>}
      </div>
    </section>
  );
}

/** Un solo lettore per le anteprime gratuite delle voci (fuori dal componente: mutabile). */
let previewAudio: HTMLAudioElement | null = null;

function stopPreview() {
  previewAudio?.pause();
}

function playPreview(url: string, onEnd: () => void) {
  previewAudio ??= new Audio();
  previewAudio.src = url;
  previewAudio.onended = onEnd;
  void previewAudio.play().catch(onEnd);
}

function VoiceList({ pickingRole, onUse }: { pickingRole: TtsRole | null; onUse: (v: AccountVoice) => void }) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const list = useApi<{ voices: AccountVoice[]; nextPageToken: string | null }>(`/api/admin/tts/voices${qs({ search: q })}`);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => stopPreview, []);

  function preview(v: AccountVoice) {
    if (!v.previewUrl) return;
    if (playing === v.voiceId) {
      stopPreview();
      setPlaying(null);
      return;
    }
    playPreview(v.previewUrl, () => setPlaying(null));
    setPlaying(v.voiceId);
  }

  return (
    <Panel title={pickingRole ? `Scegli la voce per ${TTS_ROLE_LABEL[pickingRole]}` : "Voci dell'account ElevenLabs"}>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search.trim());
        }}
      >
        <Input aria-label="Cerca voce" placeholder="Cerca per nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="ghost">
          Cerca
        </Button>
      </form>
      {!pickingRole && <p className="mb-2 text-xs text-white/55">Premi “Cambia voce” su un ruolo, poi “Usa” sulla voce scelta. L&apos;anteprima ▶ è gratuita.</p>}
      {list.error ? (
        <ErrorBlock message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingBlock label="Voci dell'account…" />
      ) : list.data.voices.length === 0 ? (
        <EmptyState title="Nessuna voce trovata" />
      ) : (
        <ul className="max-h-[32rem] divide-y divide-white/10 overflow-y-auto pr-1">
          {list.data.voices.map((v) => (
            <li key={v.voiceId} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{v.name}</p>
                <p className="truncate text-xs text-white/50">
                  {[v.category, ...Object.values(v.labels)].filter(Boolean).join(" · ")} <span className="font-mono">{v.voiceId}</span>
                </p>
              </div>
              {v.previewUrl && (
                <Button size="sm" variant="ghost" onClick={() => preview(v)} aria-label={`Anteprima ${v.name}`}>
                  {playing === v.voiceId ? "■" : "▶"}
                </Button>
              )}
              <Button size="sm" variant={pickingRole ? "gold" : "ghost"} disabled={!pickingRole} onClick={() => onUse(v)}>
                Usa{pickingRole ? ` per ${TTS_ROLE_LABEL[pickingRole]}` : ""}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const NAMES_MODE_OPTIONS: { value: NamesMode; label: string }[] = [
  { value: "spliced", label: "Nomi salvati (risparmio)" },
  { value: "whole", label: "Frase intera (più naturale)" },
];

/** Come si generano le battute live con i nickname dei giocatori. */
function NamesModePanel({ value, onChange, stats }: { value: NamesMode; onChange: (v: NamesMode) => void; stats: NamesArchiveStats | null }) {
  return (
    <Panel title="Nomi dei giocatori nelle battute">
      <Segmented label="Nomi dei giocatori nelle battute" value={value} onChange={onChange} options={NAMES_MODE_OPTIONS} />
      <p className="mt-2 text-xs text-white/55">
        {value === "spliced"
          ? "Ogni nome si genera una volta per voce e resta in archivio per tutte le serate; le parti fisse delle battute si pagano una volta sola. La frase si compone unendo le parti: costa molto meno, ma fra il nome e il resto può sentirsi un piccolo stacco."
          : "Ogni battuta con un nickname si genera intera: intonazione più naturale, ma si pagano tutti i caratteri ogni volta che la frase cambia."}
      </p>
      {stats && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-white/5 p-2">
            <dt className="text-white/55">Nomi in archivio</dt>
            <dd className="text-base font-bold text-white">{fmtNum(stats.names)}</dd>
            <dd className="text-white/45">{fmtNum(stats.nameClips)} clip (voci e punteggiatura)</dd>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <dt className="text-white/55">Caratteri risparmiati</dt>
            <dd className="text-base font-bold text-lime">{fmtNum(stats.monthSavedChars)}</dd>
            <dd className="text-white/45">questo mese · {fmtNum(stats.savedChars)} in tutto (stima)</dd>
          </div>
          <div className="col-span-2 text-white/45">
            {fmtNum(stats.spliced)} battute composte · {fmtNum(stats.segments)} parti fisse in archivio
          </div>
        </dl>
      )}
    </Panel>
  );
}

export function VoicesPage() {
  const toast = useToast();
  const data = useApi<VoicePanelData>("/api/admin/tts/config");
  const usage = useApi<UsageResponse>("/api/admin/tts/usage");
  const accountVoices = useApi<{ voices: AccountVoice[] }>("/api/admin/tts/voices");
  const [draft, setDraft] = useState<VoiceConfig | null>(null);
  const [picking, setPicking] = useState<TtsRole | null>(null);
  const [saving, setSaving] = useState(false);

  if (data.error && !data.data) return <ErrorBlock message={data.error} onRetry={data.reload} />;
  if (!data.data) return <LoadingBlock label="Caricamento voci…" />;
  const panel = data.data;
  const cfg = draft ?? panel.config;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(panel.config);

  function setRole(role: TtsRole, s: RoleVoiceSettings) {
    setDraft({ ...cfg, roles: { ...cfg.roles, [role]: s } });
  }

  async function save() {
    setSaving(true);
    try {
      const r = await send<VoicePanelData>("/api/admin/tts/config", "PUT", cfg);
      data.setData(r);
      setDraft(null);
      usage.reload();
      toast("ok", "Voci salvate");
    } catch (e) {
      toast("error", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Voci"
        subtitle={`Voci ElevenLabs dei presentatori · battute pre-generate con ${panel.models.pregen}, battute live con ${panel.models.live}`}
        actions={
          <>
            {dirty && (
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Annulla modifiche
              </Button>
            )}
            <Button variant="gold" loading={saving} disabled={!dirty} onClick={save}>
              Salva voci
            </Button>
          </>
        }
      />
      {!panel.configured && <InfoNote tone="warn">ELEVENLABS_API_KEY non è impostata sul server: il TV usa la voce gratuita del browser.</InfoNote>}
      {(panel.tagModels.pregen || panel.tagModels.live) && (
        <InfoNote>
          Con Eleven v4 le battute usano gli <strong>audio tag</strong> ([excited], [laughs], [shouts], [giggles]…) per l&apos;interpretazione: sul TV non si
          vedono mai. Il modello accetta solo <strong>stabilità</strong> e <strong>somiglianza</strong>: per una voce più teatrale scegli una stabilità bassa.
        </InfoNote>
      )}

      <UsagePanel usage={usage.data} onReload={usage.reload} />

      <div className="grid gap-4 lg:grid-cols-2">
        {TTS_ROLES.map((r) => (
          <RoleCard
            key={r}
            role={r}
            settings={cfg.roles[r]}
            envFallback={panel.envVoices[r] && cfg.roles[r].voiceId !== "" && !cfg.roles[r].voiceName}
            knownName={accountVoices.data?.voices.find((v) => v.voiceId === cfg.roles[r].voiceId)?.name ?? null}
            sample={panel.samples[r]}
            picking={picking === r}
            dirty={dirty}
            tagModels={panel.tagModels}
            onChange={(s) => setRole(r, s)}
            onPick={() => setPicking((p) => (p === r ? null : r))}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <VoiceList
          pickingRole={picking}
          onUse={(v) => {
            if (!picking) return;
            setRole(picking, { ...cfg.roles[picking], voiceId: v.voiceId, voiceName: v.name });
            toast("ok", `${v.name} → ${TTS_ROLE_LABEL[picking]} (ricorda di salvare)`);
            setPicking(null);
          }}
        />
        <div className="space-y-4">
          <Panel title="Budget mensile dell'app">
            <Field label="Caratteri al mese" hint="Oltre questa soglia non si genera più nulla (predefinito 50 000).">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={10000000}
                  step={1000}
                  value={cfg.monthlyBudgetChars}
                  onChange={(e) => setDraft({ ...cfg, monthlyBudgetChars: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                />
              )}
            </Field>
            <p className="mt-2 text-xs text-white/55">
              Una domanda costa circa {CHARS_PER_QUESTION_HINT} caratteri (testo, risposte e rivelazione), una sola volta. Le battute con i nickname si generano dal vivo
              con il modello veloce.
            </p>
          </Panel>
          <NamesModePanel value={cfg.namesMode} onChange={(namesMode) => setDraft({ ...cfg, namesMode })} stats={usage.data?.names ?? null} />
          <Panel title="Frasi generiche">
            <VoicePrepBox
              scope={{ kind: "generic" }}
              title="Frasi fisse"
              label="Frasi generiche"
              hint="Battute a rotazione, “Domanda numero 1…60”, pause, lobby, finale ed eventi: valgono per ogni serata."
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
