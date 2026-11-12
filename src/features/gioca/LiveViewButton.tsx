"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { api } from "@/lib/realtime/api-client";
import { LIVE_STEPS, liveViewPath, openLiveWindow } from "@/features/shared/live-window";

/**
 * «Vista per la LIVE» (PC): apre in una finestra a parte lo show pulito in 16:9 da catturare con OBS o
 * TikTok LIVE Studio, con le istruzioni brevi. Si continua a giocare da questa finestra: nella
 * diretta non si vedono mai codice, QR, link né la risposta scelta prima della soluzione.
 * `placement`: il pannello si apre sotto (comandi in alto) o sopra (comandi in basso).
 */
export function LiveViewButton({ sessionId, placement = "down", className }: { sessionId: string; placement?: "up" | "down"; className?: string }) {
  const [open, setOpen] = useState(false);
  const [audio, setAudio] = useState(true);
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);

  async function copyBrowserSource() {
    try {
      const r = await api<{ path: string }>(`/api/live/${sessionId}/link`);
      const url = new URL(r.path + (audio ? "" : "&audio=0"), window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("error");
    }
    setTimeout(() => setCopied(null), 2600);
  }

  return (
    <div className={clsx("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="qz-live-panel"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-[#ff2d55] px-4 font-display text-lg text-white shadow-[0_4px_0_#9c0f2c] outline-none transition hover:brightness-110 focus-visible:ring-4 focus-visible:ring-cyan"
      >
        <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> Vista per la LIVE
      </button>
      {open && (
        <div
          id="qz-live-panel"
          role="region"
          aria-label="Vista per la LIVE"
          className={clsx(
            "absolute right-0 z-[80] w-[min(420px,86vw)] rounded-2xl border-2 border-[#ff2d55]/70 bg-[#1a0b2c] p-4 text-left text-white shadow-[0_20px_60px_rgba(0,0,0,.6)]",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          <p className="font-display text-xl">Vista per la LIVE</p>
          <p className="mt-0.5 text-sm font-bold text-white/70">Lo show pulito in 16:9 per OBS o TikTok LIVE Studio.</p>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm font-semibold text-white/85">
            {LIVE_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={!audio} onChange={(e) => setAudio(!e.target.checked)} className="h-4 w-4 accent-[#ffd43b]" />
            Senza audio (l&apos;audio lo prendi da un&apos;altra sorgente)
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openLiveWindow(liveViewPath(sessionId, { audio }))}
              className="rounded-full bg-gold px-4 py-2 font-display text-lg text-ink outline-none focus-visible:ring-4 focus-visible:ring-cyan"
            >
              APRI LA VISTA LIVE
            </button>
            <button type="button" onClick={() => void copyBrowserSource()} className="rounded-full bg-white/12 px-4 py-2 text-sm font-black outline-none hover:bg-white/20 focus-visible:ring-4 focus-visible:ring-cyan">
              {copied === "ok" ? "✓ Indirizzo copiato" : copied === "error" ? "Copia non riuscita" : "🔗 Copia indirizzo per Sorgente browser"}
            </button>
          </div>
          <p className="mt-2 text-xs font-bold text-white/55">L&apos;indirizzo per la Sorgente browser apre solo la vista (non fa giocare): non condividerlo in diretta.</p>
        </div>
      )}
    </div>
  );
}
