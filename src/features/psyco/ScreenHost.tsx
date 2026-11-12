"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import type { PsycoPublicState } from "@/lib/psyco/types";
import { api, ApiError } from "@/lib/realtime/api-client";
import { useLive } from "./InvestigatorCall";

/**
 * Comandi dell'host sullo SCHERMO PUBBLICO («Schermo + telefoni» da PC).
 *
 * Il PC è autenticato con l'account dell'host ma NON è un partecipante: legge solo lo stato pubblico
 * (come un televisore) e può dare soltanto comandi che non rivelano nulla: avvia, via, pausa,
 * ripresa, nuova manche. Tutto il resto (scelta manuale dello PSYCO, impostazioni, voti, chiusura
 * delle votazioni) si fa dal telefono dell'host. Nessuna risposta qui contiene ruoli o regole.
 */
export function useScreenHost(displayKey: string): boolean {
  const [host, setHost] = useState(false);
  useEffect(() => {
    let alive = true;
    api<{ host: boolean }>(`/api/psyco/schermo/${encodeURIComponent(displayKey)}/comandi`)
      .then((r) => alive && setHost(r.host))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [displayKey]);
  return host;
}

type Cmd = "start_game" | "start_round" | "pause" | "resume" | "next_round";

/** Il comando principale per la fase attuale (o null se in questa fase si comanda dal telefono). */
export function screenCommand(state: PsycoPublicState, started: boolean): { action: Cmd; label: string } | null {
  const r = state.round;
  if (state.status !== "open") return null;
  switch (state.phase) {
    case "LOBBY":
      return { action: "start_game", label: "▶ INIZIA LA PARTITA" };
    case "RULE_CONFIRMED":
      return { action: "start_round", label: "▶ VIA!" };
    case "PLAYING":
      if (!r?.timer.startedAt || !started) return null;
      return r.timer.pausedAt ? { action: "resume", label: "▶ RIPRENDI" } : { action: "pause", label: "⏸ PAUSA" };
    case "ROUND_END":
      return { action: "next_round", label: "▶ NUOVA MANCHE" };
    default:
      return null;
  }
}

export function ScreenHostControls({
  displayKey,
  state,
  now,
  onDone,
  big = false,
  className,
}: {
  displayKey: string;
  state: PsycoPublicState;
  now: () => number;
  onDone: () => void;
  big?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // dopo il conto alla rovescia (anche in pausa: per mostrare «RIPRENDI»)
  const live = useLive(state.round?.timer ? { ...state.round.timer, pausedAt: null } : null, now);
  const cmd = screenCommand(state, live);
  const manual = state.settings.psycoPick === "manual" && (state.phase === "LOBBY" || state.phase === "ROUND_END");
  const few = state.phase === "LOBBY" && state.activeCount < state.minPlayers;

  async function send(action: Cmd) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/psyco/schermo/${encodeURIComponent(displayKey)}/comandi`, { method: "POST", json: { action } });
      onDone();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Comando non riuscito: riprova");
    } finally {
      setBusy(false);
    }
  }

  if (!cmd) return null;
  return (
    <div className={clsx("flex flex-col items-center gap-[0.8vh]", className)} data-testid="psyco-screen-controls">
      {manual ? (
        <p className="psy-chip !text-[2vh]">Scegli lo PSYCO dal tuo telefono</p>
      ) : (
        <button
          type="button"
          className={clsx("psy-btn", big ? "psy-glow !px-[3vw] !py-[1.6vh] !text-[3.4vh]" : "!min-h-0 !px-[1.4vw] !py-[0.8vh] !text-[2.2vh]")}
          disabled={busy || few}
          onClick={() => void send(cmd.action)}
        >
          {cmd.label}
        </button>
      )}
      {few && big && <p className="text-[2vh] font-bold text-lamp">Servono almeno {state.minPlayers} giocatori</p>}
      {msg && (
        <p role="alert" className="rounded-xl bg-blood/25 px-3 py-1 text-[1.9vh] font-bold text-[#ffd8da]">
          {msg}
        </p>
      )}
    </div>
  );
}
