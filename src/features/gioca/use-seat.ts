"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { GamePhase, PublicState } from "@/lib/game-engine/types";
import type { PlayerSelf } from "@/lib/server/players";
import { api, ApiError, uuid, withRetry } from "@/lib/realtime/api-client";

/**
 * Il posto dell'host come GIOCATORE nello show sul telefono (modalità B).
 *
 * L'host entra come un normale giocatore (stesso cookie dei telefoni, nickname = il suo username,
 * modificabile) e risponde toccando le risposte direttamente sullo show: nessuna seconda app,
 * nessun cambio di schermata. Usa lo stato della partita già letto dallo show (niente secondo
 * canale in tempo reale): /api/play/[code]/me solo quando serve (entrata, domanda nuova, soluzione).
 */
export type SeatStatus = "idle" | "sending" | "recorded" | "error";

export interface Seat {
  joined: boolean;
  nickname: string | null;
  participantId: string | null;
  points: number | null;
  rank: number | null;
  selected: number[];
  status: SeatStatus;
  error: string | null;
  /** risultato della domanda corrente (dopo la soluzione) */
  result: { isCorrect: boolean; partial: boolean; delta: number | null } | null;
  toggle: (pos: number) => void;
  confirm: () => void;
  /** votazione delle materie: la materia votata (anche dopo un ricaricamento) e lo stato dell'invio */
  voteOptionId: string | null;
  voteStatus: SeatStatus;
  voteError: string | null;
  vote: (optionId: string) => void;
}

export const SeatContext = createContext<Seat | null>(null);
export function useSeatContext(): Seat | null {
  return useContext(SeatContext);
}

const REFRESH_PHASES: readonly GamePhase[] = ["LOBBY", "CATEGORY_VOTING", "QUESTION_VISIBLE", "ANSWER_REVEAL", "SCORE_REVEAL", "LEADERBOARD", "FINISHED"];

interface Local {
  qid: string | null;
  selected: number[];
  status: SeatStatus;
  error: string | null;
}

export function useSeat(code: string | null, state: PublicState | null, slot: string | null = null) {
  const [self, setSelf] = useState<PlayerSelf | null>(null);
  const [joined, setJoined] = useState<"unknown" | "no" | "yes">("unknown");
  const [local, setLocal] = useState<Local>({ qid: null, selected: [], status: "idle", error: null });
  const [voteLocal, setVoteLocal] = useState<{ roundId: string; optionId: string | null; status: SeatStatus; error: string | null } | null>(null);
  const busy = useRef(false);
  /** richiesta arrivata mentre un'altra era in corso (es. subito dopo l'ingresso): si rifà alla fine */
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (!code) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        try {
          const r = await api<{ self: PlayerSelf }>(`/api/play/${code}/me${slot ? `?slot=${slot}` : ""}`);
          setSelf(r.self);
          setJoined("yes");
        } catch (e) {
          if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) {
            setJoined("no");
            setSelf(null);
          }
        }
      } while (again.current);
    } finally {
      busy.current = false;
    }
  }, [code, slot]);

  // all'avvio, a ogni domanda nuova e nei momenti in cui cambiano punti e classifica
  const phase = state?.phase ?? null;
  const qid = state?.question?.id ?? null;
  const sid = state?.sessionId ?? null;
  useEffect(() => {
    if (!code) return;
    if (phase && joined !== "unknown" && !REFRESH_PHASES.includes(phase)) return;
    const t = setTimeout(() => void refresh(), 200);
    return () => clearTimeout(t);
  }, [code, phase, qid, sid, joined, refresh]);

  // presenza (come i telefoni dei giocatori)
  useEffect(() => {
    if (joined !== "yes" || !code) return;
    const t = setInterval(() => void fetch(`/api/play/${code}/heartbeat${slot ? `?slot=${slot}` : ""}`, { method: "POST", cache: "no-store" }).catch(() => undefined), 30000);
    return () => clearInterval(t);
  }, [joined, code, slot]);

  const join = useCallback(
    async (nickname: string, gender: "m" | "f" | "n" | null = null): Promise<string | null> => {
      if (!code) return "Partita non pronta";
      try {
        const r = await api<{ recoveryCode: string | null }>("/api/play/join", { method: "POST", json: { code, nickname, recoveryCode: "", ...(gender ? { gender } : {}) } });
        if (r.recoveryCode) {
          try {
            localStorage.setItem("qz.recovery", r.recoveryCode);
          } catch {
            /* ignora */
          }
        }
        await refresh();
        return null;
      } catch (e) {
        return e instanceof ApiError ? e.message : "Connessione assente, riprova";
      }
    },
    [code, refresh],
  );

  const serverAnswer = self?.currentAnswer && self.currentAnswer.sessionQuestionId === qid ? self.currentAnswer : null;
  const mine: Local = local.qid === qid ? local : { qid, selected: [], status: "idle", error: null };
  const selected = serverAnswer && mine.status !== "recorded" ? serverAnswer.positions : mine.selected;
  const status: SeatStatus = serverAnswer ? "recorded" : mine.status;
  const patch = (p: Partial<Local>) => setLocal((l) => ({ ...(l.qid === qid ? l : { qid, selected: [], status: "idle" as SeatStatus, error: null }), ...p }));

  const send = async (positions: number[]) => {
    const q = state?.question;
    if (!code || !q || positions.length === 0) return;
    const key = `qz.req.${q.id}`;
    let requestId: string;
    try {
      requestId = sessionStorage.getItem(key) ?? uuid();
      sessionStorage.setItem(key, requestId);
    } catch {
      requestId = uuid();
    }
    patch({ status: "sending", error: null, selected: positions });
    try {
      await withRetry(() => api("/api/play/answer", { method: "POST", json: { code, sessionQuestionId: q.id, positions, requestId, ...(slot ? { slot } : {}) } }));
      patch({ status: "recorded" });
      try {
        navigator.vibrate?.([30, 40, 30]);
      } catch {
        /* non supportato */
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "ALREADY_ANSWERED") {
        const pos = (e.details as { positions?: number[] } | undefined)?.positions;
        patch({ status: "recorded", ...(pos ? { selected: pos } : {}) });
        return;
      }
      patch({ status: "error", error: e instanceof ApiError ? e.message : "Invio non riuscito, riprova" });
    }
  };

  // votazione delle materie (round a votazione): un voto per round, come il telefono dei giocatori
  const voteRoundId = state?.vote?.roundId ?? null;
  const myVoteLocal = voteLocal && voteLocal.roundId === voteRoundId ? voteLocal : null;
  const voteOptionId = myVoteLocal?.optionId ?? (self?.vote && self.vote.roundId === voteRoundId ? self.vote.optionId : null);
  const voteStatus: SeatStatus = myVoteLocal?.status ?? (voteOptionId ? "recorded" : "idle");
  const castVote = async (optionId: string) => {
    const roundId = voteRoundId;
    if (!code || !roundId || voteStatus === "sending" || voteStatus === "recorded") return;
    setVoteLocal({ roundId, optionId, status: "sending", error: null });
    try {
      await withRetry(() => api("/api/play/vote", { method: "POST", json: { code, roundId, optionId, ...(slot ? { slot } : {}) } }));
      setVoteLocal({ roundId, optionId, status: "recorded", error: null });
      try {
        navigator.vibrate?.([30, 40, 30]);
      } catch {
        /* non supportato */
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "ALREADY_ANSWERED") {
        const prev = (e.details as { optionId?: string } | undefined)?.optionId ?? optionId;
        setVoteLocal({ roundId, optionId: prev, status: "recorded", error: null });
        return;
      }
      setVoteLocal({ roundId, optionId: null, status: "error", error: e instanceof ApiError ? e.message : "Voto non inviato, riprova" });
    }
  };

  const seat: Seat | null =
    joined === "yes" && self
      ? {
          joined: true,
          nickname: self.nickname,
          participantId: self.participantId,
          points: self.points,
          rank: self.rank,
          selected,
          status,
          error: mine.error,
          result:
            self.currentResult && self.currentResult.sessionQuestionId === qid
              ? { isCorrect: self.currentResult.isCorrect, partial: self.currentResult.partial, delta: self.currentResult.delta }
              : null,
          toggle: (pos: number) => {
            const q = state?.question;
            if (!q || status === "sending" || status === "recorded") return;
            if (q.type === "single") void send([pos]);
            else patch({ selected: selected.includes(pos) ? selected.filter((x) => x !== pos) : [...selected, pos].sort() });
          },
          confirm: () => void send(selected),
          voteOptionId,
          voteStatus,
          voteError: myVoteLocal?.error ?? null,
          vote: (optionId: string) => void castVote(optionId),
        }
      : null;

  return { seat, joined, join };
}
