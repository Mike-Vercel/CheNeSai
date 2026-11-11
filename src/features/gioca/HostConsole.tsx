"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OpenTvButton, ScreenChoiceField } from "@/features/display/TvScreenControls";
import { PHASE_LABELS } from "@/lib/game-engine/transitions";
import type { PublicState } from "@/lib/game-engine/types";
import { api } from "@/lib/realtime/api-client";
import { useAutoTick, type AutoTickResponse } from "@/lib/realtime/use-auto-tick";
import { useGameState } from "@/lib/realtime/use-game-state";
import { HostControls } from "./HostControls";

/**
 * Pagina dell'host sul PC (schermo 1): codice e QR, giocatori collegati, "Apri TV" sullo schermo
 * scelto (schermo 2, il televisore) e i comandi minimi. Tiene viva la partita anche se il TV
 * si chiude (chiama /tick come la regia).
 */
export function HostConsole({ sessionId, displayKey, canCreateMore }: { sessionId: string; displayKey: string; canCreateMore: boolean }) {
  const k = encodeURIComponent(displayKey);
  const { state, now } = useGameState({
    fetchSnapshot: async () => (await api<{ state: PublicState }>(`/api/display/${sessionId}/state?k=${k}`)).state,
    safetyPollMs: 3000,
  });
  const [override, setOverride] = useState<PublicState | null>(null);
  const view = override && state && override.version > state.version ? override : (state ?? override);

  const tick = useCallback(() => api<AutoTickResponse>(`/api/display/${sessionId}/tick?k=${k}`, { method: "POST", timeoutMs: 20000 }), [sessionId, k]);
  // il TV guida lo scorrimento; questa pagina interviene poco dopo se il TV è chiuso
  useAutoTick({ auto: view?.auto, now, tick, extraDelayMs: 1500 });

  const [joinUrl, setJoinUrl] = useState("");
  useEffect(() => {
    if (!view?.code) return;
    const base = process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost") ? process.env.NEXT_PUBLIC_APP_URL : window.location.origin;
    const t = setTimeout(() => setJoinUrl(`${base}/play/${view.code}`), 0);
    return () => clearTimeout(t);
  }, [view?.code]);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 480, color: { dark: "#170824", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [joinUrl]);

  const tvUrl = `/gioca/tv/${sessionId}`;
  const progress = useMemo(() => (view && view.totalQuestions > 0 ? `${view.questionsPlayed}/${view.totalQuestions} domande` : null), [view]);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 pt-4 md:px-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section aria-labelledby="console-title" className="flex flex-col gap-6">
        <div>
          <h1 id="console-title" className="font-display text-4xl leading-tight md:text-5xl">
            {view ? PHASE_LABELS[view.phase] : "Collegamento…"}
          </h1>
          <p className="mt-1 text-lg font-bold text-white/80">
            {view?.title}
            {progress && view?.phase !== "LOBBY" ? ` · ${progress}` : ""}
          </p>
        </div>

        <div className="rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8 md:p-7">
          <h2 className="font-display text-2xl">1. Apri la TV</h2>
          <p className="mt-1 text-base font-bold text-white/85">Il quiz si apre a tutto schermo sul televisore. Lì compaiono il QR code e il codice per entrare.</p>
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <OpenTvButton url={tvUrl} sessionId={sessionId} />
            <Link href={tvUrl} className="rounded-lg px-3 py-1.5 text-sm font-bold text-white/80 underline underline-offset-4 hover:text-white">
              Usa questo schermo come TV
            </Link>
          </div>
          <ScreenChoiceField tone="public" className="mt-5" />
        </div>

        <div className="rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8 md:p-7">
          <h2 className="font-display text-2xl">2. Comandi</h2>
          <div className="mt-4">
            <HostControls sessionId={sessionId} state={view} canCreateMore={canCreateMore} onDone={setOverride} />
          </div>
        </div>
      </section>

      <aside aria-labelledby="join-title" className="flex flex-col gap-4 rounded-[28px] bg-coal-2 p-5 ring-1 ring-white/8 md:p-7">
        <h2 id="join-title" className="font-display text-2xl">
          Si entra così
        </h2>
        <div className="flex items-center gap-5">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code per entrare nella partita ${view?.code ?? ""}`} width={160} height={160} className="h-40 w-40 rounded-2xl bg-white p-2" />
          ) : (
            <div className="h-40 w-40 rounded-2xl bg-white/10" />
          )}
          <div>
            <p className="text-sm font-bold text-white/75">Codice</p>
            <p className="font-display text-5xl tracking-[0.12em] text-gold">{view?.code ?? "……"}</p>
            <p className="mt-1 break-all text-sm font-bold text-white/75">{joinUrl.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>
        <div>
          <p className="text-lg font-black">
            {view?.playerCount ?? 0} {view?.playerCount === 1 ? "giocatore collegato" : "giocatori collegati"}
          </p>
          {view?.recentPlayers && view.recentPlayers.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Ultimi entrati">
              {view.recentPlayers.map((n) => (
                <li key={n} className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
