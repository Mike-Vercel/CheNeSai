"use client";

import { clsx } from "clsx";
import { useRef, useState } from "react";
import { Badge, Button, EmptyState, Field, Input, Modal, Panel, Toggle, useToast } from "@/components/ui";
import type { MediaKind } from "@/lib/game-engine/types";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { errorMessage, qs, send, useApi } from "../api";
import { ErrorBlock, InfoNote, LoadingBlock, MEDIA_ICON, PageHeader, Segmented } from "../common";
import { fmtBytes, fmtDuration, fmtStamp, plural } from "../format";
import type { MediaRecord } from "../types";

/** Copia lato client di ALLOWED_MIME (src/lib/server/cms/media.ts): il server resta l'autorità. */
const ALLOWED: Record<string, MediaKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/aac": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/webm": "audio",
  "video/mp4": "video",
  "video/webm": "video",
};
const MAX_BYTES = 50 * 1024 * 1024;

interface FileMeta {
  width?: number;
  height?: number;
  durationMs?: number;
}

/** Legge dimensioni e durata nel browser prima della registrazione. */
function readFileMeta(file: File, kind: MediaKind): Promise<FileMeta> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (m: FileMeta) => {
      URL.revokeObjectURL(url);
      resolve(m);
    };
    const timer = setTimeout(() => done({}), 8000);
    if (kind === "image") {
      const img = new Image();
      img.onload = () => {
        clearTimeout(timer);
        done({ width: img.naturalWidth || undefined, height: img.naturalHeight || undefined });
      };
      img.onerror = () => {
        clearTimeout(timer);
        done({});
      };
      img.src = url;
      return;
    }
    const el = document.createElement(kind === "audio" ? "audio" : "video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      clearTimeout(timer);
      const ms = Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : undefined;
      const v = el as HTMLVideoElement;
      done({ durationMs: ms && ms > 0 ? ms : undefined, width: kind === "video" ? v.videoWidth || undefined : undefined, height: kind === "video" ? v.videoHeight || undefined : undefined });
    };
    el.onerror = () => {
      clearTimeout(timer);
      done({});
    };
    el.src = url;
  });
}

type Step = "idle" | "meta" | "url" | "upload" | "register";
const STEP_LABEL: Record<Step, string> = {
  idle: "",
  meta: "Lettura del file…",
  url: "Preparazione del caricamento…",
  upload: "Caricamento sullo storage…",
  register: "Registrazione nella libreria…",
};

function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [artist, setArtist] = useState("");
  const [category, setCategory] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const kind = file ? ALLOWED[file.type] : undefined;

  function choose(f: File | null) {
    setError(null);
    setFile(null);
    if (!f) return;
    if (!ALLOWED[f.type]) {
      setError(`Formato non supportato (${f.type || "sconosciuto"}). Usa JPG, PNG, WEBP, GIF, MP3, M4A, AAC, OGG, WAV, MP4 o WEBM.`);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`File troppo grande (${fmtBytes(f.size)}): massimo 50 MB.`);
      return;
    }
    setFile(f);
    if (!label) setLabel(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 120));
  }

  function reset() {
    setFile(null);
    setLabel("");
    setArtist("");
    setCategory("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !kind) return;
    if (label.trim().length < 2) {
      setError("Dai un titolo al media (almeno 2 caratteri)");
      return;
    }
    setError(null);
    try {
      setStep("meta");
      const meta = await readFileMeta(file, kind);
      setStep("url");
      const up = await send<{ path: string; token: string; signedUrl: string }>("/api/admin/media/upload-url", "POST", { mimeType: file.type, sizeBytes: file.size });
      setStep("upload");
      const { error: upErr } = await getSupabaseBrowser().storage.from("media").uploadToSignedUrl(up.path, up.token, file, { contentType: file.type });
      if (upErr) throw new Error(`Caricamento non riuscito: ${upErr.message}`);
      setStep("register");
      await send("/api/admin/media", "POST", {
        path: up.path,
        meta: {
          label: label.trim(),
          artist: artist.trim() || null,
          category: category.trim() || null,
          width: meta.width ?? null,
          height: meta.height ?? null,
          durationMs: meta.durationMs ?? null,
        },
      });
      toast("ok", "Media caricato");
      reset();
      onUploaded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStep("idle");
    }
  }

  const busy = step !== "idle";
  return (
    <Panel title="Carica un file">
      <form onSubmit={upload} className="space-y-3">
        <label
          className={clsx(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-5 text-center transition",
            file ? "border-lime/60 bg-lime/5" : "border-white/20 hover:border-gold/60 hover:bg-white/5",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files[0] ?? null);
          }}
        >
          <span className="text-3xl" aria-hidden>
            {kind ? MEDIA_ICON[kind] : "📁"}
          </span>
          <span className="font-bold">{file ? `${file.name} · ${fmtBytes(file.size)}` : "Trascina qui un file o clicca per sceglierlo"}</span>
          <span className="text-xs text-white/55">Immagini, audio o video · max 50 MB</span>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={Object.keys(ALLOWED).join(",")}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            aria-label="Scegli file da caricare"
          />
        </label>
        {file && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Titolo (solo per la regia)">{(id) => <Input id={id} required maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />}</Field>
              <Field label="Artista / autore">{(id) => <Input id={id} maxLength={120} value={artist} onChange={(e) => setArtist(e.target.value)} />}</Field>
              <Field label="Categoria">{(id) => <Input id={id} maxLength={60} value={category} onChange={(e) => setCategory(e.target.value)} />}</Field>
            </div>
          </>
        )}
        {error && <InfoNote tone="danger">{error}</InfoNote>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="gold" disabled={!file} loading={busy}>
            Carica
          </Button>
          {file && !busy && (
            <Button type="button" variant="ghost" onClick={reset}>
              Annulla
            </Button>
          )}
          {busy && <span className="text-sm font-bold text-cyan">{STEP_LABEL[step]}</span>}
        </div>
      </form>
    </Panel>
  );
}

function MediaDetailModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const req = useApi<{ media: MediaRecord; url: string | null }>(`/api/admin/media/${id}`);
  const m = req.data?.media;
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={m ? m.label : "Media"}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Chiudi
        </Button>
      }
    >
      {req.error ? (
        <ErrorBlock message={req.error} onRetry={req.reload} />
      ) : !m ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="grid min-h-40 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/60">
              {!req.data?.url ? (
                <p className="p-6 text-sm text-white/60">Anteprima non disponibile</p>
              ) : m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL firmato temporaneo
                <img src={req.data.url} alt={m.label} className="max-h-80 w-full object-contain" />
              ) : m.kind === "audio" ? (
                <audio controls src={req.data.url} className="w-full p-4" />
              ) : (
                <video controls src={req.data.url} className="max-h-80 w-full" />
              )}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs text-white/65">
              <div>
                <dt className="text-white/45">Formato</dt>
                <dd className="font-bold">{m.mimeType}</dd>
              </div>
              <div>
                <dt className="text-white/45">Dimensione</dt>
                <dd className="font-bold">{fmtBytes(m.sizeBytes)}</dd>
              </div>
              {m.width && (
                <div>
                  <dt className="text-white/45">Risoluzione</dt>
                  <dd className="font-bold">
                    {m.width}×{m.height}
                  </dd>
                </div>
              )}
              {m.durationMs && (
                <div>
                  <dt className="text-white/45">Durata</dt>
                  <dd className="font-bold">{fmtDuration(m.durationMs)}</dd>
                </div>
              )}
              <div>
                <dt className="text-white/45">Usato da</dt>
                <dd className="font-bold">{plural(m.usedBy, "domanda", "domande")}</dd>
              </div>
              <div>
                <dt className="text-white/45">Caricato</dt>
                <dd className="font-bold">{fmtStamp(m.createdAt)}</dd>
              </div>
            </dl>
          </div>
          <MediaEditForm
            media={m}
            onSaved={() => {
              toast("ok", "Media aggiornato");
              req.reload();
              onSaved();
            }}
          />
        </div>
      )}
    </Modal>
  );
}

function MediaEditForm({ media, onSaved }: { media: MediaRecord; onSaved: () => void }) {
  const [label, setLabel] = useState(media.label);
  const [artist, setArtist] = useState(media.artist ?? "");
  const [category, setCategory] = useState(media.category ?? "");
  const [archived, setArchived] = useState(media.archived);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await send(`/api/admin/media/${media.id}`, "PATCH", {
        label: label.trim(),
        artist: artist.trim() || null,
        category: category.trim() || null,
        archived,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Titolo (solo per la regia)">{(id) => <Input id={id} required minLength={2} maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Artista / autore">{(id) => <Input id={id} maxLength={120} value={artist} onChange={(e) => setArtist(e.target.value)} />}</Field>
        <Field label="Categoria">{(id) => <Input id={id} maxLength={60} value={category} onChange={(e) => setCategory(e.target.value)} />}</Field>
      </div>
      <Toggle checked={archived} onChange={setArchived} label="Archiviato (nascosto dalla libreria)" />
      {error && <InfoNote tone="danger">{error}</InfoNote>}
      <Button type="submit" variant="gold" loading={saving}>
        Salva modifiche
      </Button>
    </form>
  );
}

export function MediaLibrary() {
  const [kind, setKind] = useState<"" | MediaKind>("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const list = useApi<{ media: MediaRecord[] }>(`/api/admin/media${qs({ kind, q, archived: archived ? "1" : undefined })}`);
  const items = list.data?.media ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Media" subtitle="Immagini, brani e video usati nelle domande" />
      <InfoNote>Il nome del file non viene mai mostrato ai giocatori: lo storage usa un nome anonimo.</InfoNote>

      <UploadPanel onUploaded={list.reload} />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Tipo"
          value={kind}
          onChange={setKind}
          options={[
            { value: "", label: "Tutti" },
            { value: "image", label: "🖼️ Immagini" },
            { value: "audio", label: "🎵 Audio" },
            { value: "video", label: "🎬 Video" },
          ]}
        />
        <form
          className="flex min-w-0 flex-1 gap-2 sm:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search.trim());
          }}
        >
          <Input aria-label="Cerca media" placeholder="Cerca per titolo o artista…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="ghost">
            Cerca
          </Button>
        </form>
        <Toggle checked={archived} onChange={setArchived} label="Mostra archiviati" />
      </div>

      {list.error ? (
        <ErrorBlock message={list.error} onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="Nessun media">Carica il primo file con il pannello qui sopra.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy={list.loading}>
          {items.map((m) => {
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setOpen(m.id)}
                  className={clsx(
                    "flex h-full w-full flex-col gap-2 rounded-2xl border bg-[#1d0c30] p-4 text-left transition hover:border-gold/60",
                    "border-white/10",
                    m.archived && "opacity-60",
                  )}
                >
                  <span className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-2xl" aria-hidden>
                      {MEDIA_ICON[m.kind]}
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words font-bold leading-snug">{m.label}</span>
                      <span className="block truncate text-xs text-white/55">{[m.artist, m.category].filter(Boolean).join(" · ") || "—"}</span>
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5 text-xs">
                    <Badge>{fmtBytes(m.sizeBytes)}</Badge>
                    {m.durationMs && <Badge color="blue">{fmtDuration(m.durationMs)}</Badge>}
                    {m.width && (
                      <Badge color="blue">
                        {m.width}×{m.height}
                      </Badge>
                    )}
                    {m.usedBy > 0 && <Badge color="gold">{plural(m.usedBy, "domanda", "domande")}</Badge>}
                    {m.archived && <Badge color="violet">Archiviato</Badge>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && <MediaDetailModal id={open} onClose={() => setOpen(null)} onSaved={list.reload} />}
    </div>
  );
}
