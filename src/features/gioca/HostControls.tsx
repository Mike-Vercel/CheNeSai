"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useState } from "react";
import type { PublicState } from "@/lib/game-engine/types";
import { api, ApiError, uuid } from "@/lib/realtime/api-client";

type Action = "open" | "start" | "pause" | "resume" | "finish";

/**
 * Comandi minimi dell'host di una partita libera (niente regia completa):
 * APRI LOBBY → INIZIA PARTITA (poi va da sola) · Pausa/Riprendi · Termina · dopo il podio Nuova partita.
 */
export function HostControls({
  sessionId,
  state,
  canCreateMore,
  size = "lg",
  onDone,
}: {
  sessionId: string;
  state: PublicState | null;
  canCreateMore: boolean;
  size?: "lg" | "tv";
  onDone?: (s: PublicState) => void;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);

  async function run(action: Action) {
    setBusy(action);
    setError(null);
    try {
      const r = await api<{ state: PublicState }>(`/api/gioca/games/${sessionId}/command`, { method: "POST", json: { action, commandId: uuid() }, timeoutMs: 20000 });
      onDone?.(r.state);
      setConfirmFinish(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Comando non riuscito, riprova");
    } finally {
      setBusy(null);
    }
  }

  if (!state) return null;
  const phase = state.phase;
  const big = size === "tv" ? "px-8 py-4 text-3xl" : "px-8 py-4 text-2xl md:text-3xl";
  const small = size === "tv" ? "px-5 py-3 text-lg" : "px-5 py-3 text-base";
  const primary = clsx("qz-play rounded-full bg-gold font-display text-ink transition hover:bg-white disabled:opacity-40", big);
  const secondary = clsx("rounded-full bg-white/12 font-black text-white transition hover:bg-white/25 disabled:opacity-40", small);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {phase === "READY" && (
          <button type="button" className={primary} disabled={!!busy} onClick={() => void run("open")}>
            APRI LA LOBBY
          </button>
        )}
        {phase === "LOBBY" && (
          <button type="button" className={primary} disabled={!!busy || state.playerCount < 1} onClick={() => void run("start")} aria-describedby="host-start-hint">
            {busy === "start" ? "PARTE…" : "▶ INIZIA PARTITA"}
          </button>
        )}
        {phase === "PAUSED" && (
          <button type="button" className={primary} disabled={!!busy} onClick={() => void run("resume")}>
            RIPRENDI
          </button>
        )}
        {phase !== "READY" && phase !== "LOBBY" && phase !== "PAUSED" && phase !== "FINISHED" && (
          <button type="button" className={secondary} disabled={!!busy} onClick={() => void run("pause")}>
            ❚❚ Pausa
          </button>
        )}
        {phase !== "FINISHED" && phase !== "READY" && !confirmFinish && (
          <button type="button" className={clsx(secondary, "text-white/80")} disabled={!!busy} onClick={() => setConfirmFinish(true)}>
            Termina partita
          </button>
        )}
        {confirmFinish && (
          <span className="flex flex-wrap items-center gap-2 rounded-full bg-flame/25 py-1 pl-4 pr-1">
            <span className="font-bold">Chiudere la partita e mostrare il podio?</span>
            <button type="button" className="rounded-full bg-flame px-4 py-2 font-black text-white" disabled={!!busy} onClick={() => void run("finish")}>
              Sì, termina
            </button>
            <button type="button" className="rounded-full px-3 py-2 font-bold text-white/80" onClick={() => setConfirmFinish(false)}>
              No
            </button>
          </span>
        )}
        {phase === "FINISHED" && (
          <>
            {canCreateMore && (
              <Link href="/gioca" className={primary}>
                NUOVA PARTITA
              </Link>
            )}
            <Link href="/" className={secondary}>
              Torna alla home
            </Link>
          </>
        )}
      </div>
      {phase === "LOBBY" && (
        <p id="host-start-hint" className="text-sm font-bold text-white/80">
          {state.playerCount < 1 ? "Aspetta che entri almeno un giocatore dal telefono." : "Quando ci siete tutti: parte l'intro con le regole, poi la partita va avanti da sola."}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-[#ffb3c1]">
          {error}
        </p>
      )}
    </div>
  );
}
