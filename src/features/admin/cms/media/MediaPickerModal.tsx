"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, EmptyState, Input, Modal } from "@/components/ui";
import type { MediaKind } from "@/lib/game-engine/types";
import { qs, useApi } from "../api";
import { ErrorBlock, LoadingBlock, MEDIA_ICON, Segmented } from "../common";
import { fmtDuration } from "../format";
import type { MediaRecord } from "../types";

export function MediaPickerModal({ onClose, onPick }: { onClose: () => void; onPick: (m: MediaRecord) => void }) {
  const [kind, setKind] = useState<"" | MediaKind>("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const list = useApi<{ media: MediaRecord[] }>(`/api/admin/media${qs({ kind, q })}`);
  const items = list.data?.media ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Scegli un media"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Annulla
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Tipo di media"
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
            className="flex min-w-0 flex-1 gap-2"
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
        </div>
        {list.error ? (
          <ErrorBlock message={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <LoadingBlock />
        ) : items.length === 0 ? (
          <EmptyState title="Nessun media">
            <Link href="/admin/media" target="_blank" className="font-bold text-gold underline">
              Carica un file nella libreria media
            </Link>
          </EmptyState>
        ) : (
          <ul className="grid max-h-[55dvh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {items.map((m) => {
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onPick(m)}
                    className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-gold/60 hover:bg-gold/5"
                  >
                    <span className="text-2xl" aria-hidden>
                      {MEDIA_ICON[m.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{m.label}</span>
                      <span className="block truncate text-xs text-white/55">
                        {[m.artist, m.category, m.durationMs ? fmtDuration(m.durationMs) : null, m.width ? `${m.width}×${m.height}` : null].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
