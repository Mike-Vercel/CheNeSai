"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/realtime/api-client";
import type { RegiaView, TigView } from "@/lib/tig/types";
import { Logo, QrCode } from "../ui";

/**
 * FOGLIO DEI QR da stampare (solo organizzatore): una scheda per tavolo con QR, numero e codice squadra.
 * Il QR porta a /tavoli-in-guerra/t/<token firmato>: nessun dato personale. Il PIN (se attivo) NON si stampa:
 * lo dice lo staff al tavolo.
 */
export function QrSheet({ eventId }: { eventId: string }) {
  const [data, setData] = useState<{ venue: string; view: RegiaView } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<TigView>(`/api/tig/events/${eventId}?as=regia`)
      .then((r) => r.view?.role === "organizer" && setData({ venue: r.state.venue, view: r.view }))
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Connessione assente"));
  }, [eventId]);
  if (err) return <p className="p-8 text-center text-xl font-bold">{err}</p>;
  if (!data) return <p className="p-8 text-center text-xl font-bold">Preparo i QR…</p>;
  const origin = window.location.origin;
  const qrMode = data.view.config.accessMode === "qr";
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="tig-no-print mb-5 flex flex-wrap items-center gap-3">
        <a href={`/tavoli-in-guerra/regia/${eventId}`} className="tig-chip">
          ‹ Regia
        </a>
        <p className="min-w-0 flex-1 font-bold text-white/70">{qrMode ? "Stampa e metti ogni scheda sul suo tavolo." : "Modalità codice: consegna a ogni gruppo il suo codice."}</p>
        <button type="button" className="tig-btn" onClick={() => window.print()}>
          🖨️ STAMPA
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {data.view.tables.map((t) => (
          <article key={t.tableId} className="tig-panel tig-print-card flex flex-col items-center gap-2 rounded-3xl p-4 text-center">
            <Logo size="sm" className="[&_.tig-logo]:!text-lg" />
            <p className="tig-display text-5xl">TAVOLO {t.tableNo}</p>
            {qrMode && <QrCode text={`${origin}/tavoli-in-guerra/t/${t.token}`} className="w-full max-w-[13rem]" label={`QR del tavolo ${t.tableNo}`} />}
            <p className="text-sm font-bold text-white/70">{qrMode ? "Inquadra il QR: il primo crea la squadra, gli altri entrano." : "Vai su"}</p>
            <p className="text-xs font-bold text-white/60">
              {origin.replace(/^https?:\/\//, "")}/tavoli-in-guerra/entra · codice <span className="font-mono text-base font-black tracking-[0.25em] text-white">{t.code}</span>
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">{data.venue} · gioco per maggiorenni</p>
          </article>
        ))}
      </div>
    </main>
  );
}
