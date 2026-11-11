"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isTvScreenMessage, tvChannelName, type TvScreenMessage } from "@/features/display/screen-picker";
import { PHASE_LABELS } from "@/lib/game-engine/transitions";
import type { PublicState } from "@/lib/game-engine/types";
import { api } from "@/lib/realtime/api-client";
import { useAutoTick, type AutoTickResponse } from "@/lib/realtime/use-auto-tick";
import { useGameState } from "@/lib/realtime/use-game-state";
import { AudioSettings, btnSoft, DisplaySettings, GameSettings, PanelScreenSettings, PlayersSettings, Section, useHostStatus, VoicesProgress } from "./HostSettings";
import { RematchControls } from "./RematchControls";
import { useHostCommand } from "./use-host-command";
import { useVoicePrep } from "./use-voice-prep";

/** Il TV risponde al ping ogni pochi secondi: oltre questo tempo lo si considera chiuso. */
const TV_ALIVE_MS = 9000;

/** TV aperto in un'altra finestra di questo PC? (BroadcastChannel della finestra del TV) */
function useTvWindow(sessionId: string): { alive: boolean; audio: boolean | null } {
  const [last, setLast] = useState<{ at: number; audio: boolean | null }>({ at: 0, audio: null });
  const [now, setNow] = useState(0);
  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    try {
      ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(tvChannelName(sessionId)) : null;
    } catch {
      ch = null;
    }
    if (!ch) return;
    ch.onmessage = (e) => {
      if (isTvScreenMessage(e.data) && e.data.type === "pong") setLast({ at: Date.now(), audio: e.data.audio ?? null });
    };
    const ping = () => {
      ch?.postMessage({ type: "ping" } satisfies TvScreenMessage);
      setNow(Date.now());
    };
    ping();
    const t = setInterval(ping, 3000);
    return () => {
      clearInterval(t);
      ch?.close();
    };
  }, [sessionId]);
  const alive = last.at > 0 && now - last.at < TV_ALIVE_MS;
  return { alive, audio: alive ? last.audio : null };
}

/**
 * Pannello dell'host (schermo del PC, quando il TV è sull'altro schermo): tutto a portata di mano
 * senza la regia completa. QR e codice, giocatori (espelli), INIZIA PARTITA, pausa/avanti/termina,
 * scorrimento, rivincita, audio del TV, voci della serata e schermo del TV.
 * Tiene viva la partita anche se il TV si chiude (chiama /tick, con calma se il TV è aperto).
 */
export function HostConsole({ sessionId, displayKey, canCreateMore }: { sessionId: string; displayKey: string; canCreateMore: boolean }) {
  const router = useRouter();
  const k = encodeURIComponent(displayKey);
  const { state, now } = useGameState({
    fetchSnapshot: async () => (await api<{ state: PublicState }>(`/api/display/${sessionId}/state?k=${k}`)).state,
    safetyPollMs: 3000,
  });
  const [override, setOverride] = useState<PublicState | null>(null);
  const view = override && state && override.sessionId === state.sessionId && override.version > state.version ? override : (state ?? override);
  const tv = useTvWindow(sessionId);

  const tick = useCallback(() => api<AutoTickResponse>(`/api/display/${sessionId}/tick?k=${k}`, { method: "POST", timeoutMs: 20000 }), [sessionId, k]);
  // il TV guida lo scorrimento (e aspetta la fine delle battute): questo pannello interviene solo
  // molto dopo se il TV è aperto, subito se il TV è chiuso
  useAutoTick({ auto: view?.auto, now, tick, extraDelayMs: tv.alive ? 20000 : 1500 });

  const prep = useVoicePrep({ sessionId, displayKey, active: !!view && view.phase !== "FINISHED" });
  const [status, refreshStatus] = useHostStatus(sessionId, view);
  const start = useHostCommand(sessionId, setOverride);

  // rivincita: il pannello passa alla nuova partita (il TV fa lo stesso da solo)
  const goTo = useCallback((id: string) => router.replace(`/gioca/partita/${id}`), [router]);
  const next = view?.rematch?.sessionId ?? null;
  useEffect(() => {
    if (next) goTo(next);
  }, [next, goTo]);

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

  const progress = useMemo(() => (view && view.totalQuestions > 0 && view.phase !== "LOBBY" && view.phase !== "READY" ? `${view.questionsPlayed}/${view.totalQuestions} domande` : null), [view]);
  const phase = view?.phase;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-2 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/gioca#le-tue-partite" className="text-sm font-bold text-white/70 hover:text-white">
            ← Le tue partite
          </Link>
          <h1 className="mt-1 font-display text-4xl leading-tight md:text-5xl">{view ? PHASE_LABELS[view.phase] : "Collegamento…"}</h1>
          <p className="mt-0.5 text-base font-bold text-white/75">
            {view?.title}
            {progress ? ` · ${progress}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={clsx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold", tv.alive ? "bg-[#1f5c3d] text-[#9dffc9]" : "bg-white/10 text-white/70")}>
            <span className={clsx("h-2 w-2 rounded-full", tv.alive ? "bg-[#5dffab]" : "bg-white/40")} aria-hidden />
            {tv.alive ? "TV collegato" : "TV non aperto"}
          </span>
          <PanelScreenSettings sessionId={sessionId} tvAudio={tv.audio} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {/* azione principale del momento */}
          <section aria-label="Partita" className="rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8 md:p-7">
            {phase === "LOBBY" && view && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className="qz-play w-fit rounded-full bg-gold px-10 py-4 font-display text-3xl text-ink transition hover:bg-white disabled:opacity-40"
                  disabled={!!start.busy || view.playerCount < 1}
                  onClick={() => void start.run("start")}
                >
                  {start.busy ? "PARTE…" : "▶ INIZIA PARTITA"}
                </button>
                <p className="text-base font-bold text-white/80">
                  {view.playerCount < 1 ? "Aspetta che entri almeno un giocatore dal telefono." : "Si parte con l'intro e le regole, poi la partita va avanti da sola."}
                </p>
                {start.error && (
                  <p role="alert" className="text-sm font-bold text-[#ffb3c1]">
                    {start.error}
                  </p>
                )}
              </div>
            )}
            {phase === "FINISHED" && (
              <div className="flex flex-col gap-4">
                <RematchControls sessionId={sessionId} onStarted={goTo} />
                <div className="flex flex-wrap gap-2">
                  {canCreateMore && (
                    <Link href="/gioca" className={btnSoft}>
                      Nuova partita
                    </Link>
                  )}
                  <Link href="/" className={btnSoft}>
                    Torna alla home
                  </Link>
                </div>
              </div>
            )}
            {phase && phase !== "FINISHED" && (
              <div className={clsx("flex flex-col gap-3", phase === "LOBBY" && "mt-5 border-t border-white/10 pt-5")}>
                <GameSettings sessionId={sessionId} state={view} status={status} onChanged={refreshStatus} />
              </div>
            )}
          </section>

          <section aria-label="Giocatori" className="rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8 md:p-7">
            <h2 className="mb-3 font-display text-2xl">
              {view?.playerCount ?? 0} {view?.playerCount === 1 ? "giocatore" : "giocatori"}
            </h2>
            <PlayersSettings sessionId={sessionId} status={status} onChanged={refreshStatus} />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="join-title" className="rounded-[28px] bg-coal-2 p-5 ring-1 ring-white/8 md:p-7">
            <h2 id="join-title" className="font-display text-2xl">
              Si entra così
            </h2>
            <div className="mt-3 flex items-center gap-5">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`QR code per entrare nella partita ${view?.code ?? ""}`} width={150} height={150} className="h-[150px] w-[150px] rounded-2xl bg-white p-2" />
              ) : (
                <div className="h-[150px] w-[150px] rounded-2xl bg-white/10" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-white/70">Codice</p>
                <p className="font-display text-5xl tracking-[0.12em] text-gold">{view?.code ?? "……"}</p>
                <p className="mt-1 break-all text-sm font-bold text-white/70">{joinUrl.replace(/^https?:\/\//, "")}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8 md:p-7">
            <div className="flex flex-col gap-4">
              <Section title="Voci della serata">
                <VoicesProgress prep={prep} />
              </Section>
              <Section title="Audio del TV">
                <AudioSettings />
              </Section>
              <details className="group border-t border-white/10 pt-4">
                <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.14em] text-white/55 hover:text-white">Grafica del TV ▾</summary>
                <div className="mt-3 flex flex-col gap-2.5">
                  <DisplaySettings />
                </div>
              </details>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
