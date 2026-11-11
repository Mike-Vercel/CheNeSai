"use client";

import { useCallback, useState } from "react";
import type { PublicState } from "@/lib/game-engine/types";
import { api, ApiError, uuid } from "@/lib/realtime/api-client";

export type HostAction = "open" | "start" | "pause" | "resume" | "finish" | "next" | "kick" | "auto";

/** Comandi dell'host sulla sua partita libera (POST /api/gioca/games/[id]/command, solo il proprietario). */
export function useHostCommand(sessionId: string, onDone?: (s: PublicState) => void) {
  const [busy, setBusy] = useState<HostAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (action: HostAction, extra: { participantId?: string; autoplay?: boolean } = {}): Promise<boolean> => {
      setBusy(action);
      setError(null);
      try {
        const r = await api<{ state: PublicState }>(`/api/gioca/games/${sessionId}/command`, { method: "POST", json: { action, commandId: uuid(), ...extra }, timeoutMs: 20000 });
        onDone?.(r.state);
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Comando non riuscito, riprova");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [sessionId, onDone],
  );
  return { run, busy, error, clearError: () => setError(null) };
}
