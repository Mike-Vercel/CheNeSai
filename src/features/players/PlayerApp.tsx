"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BetTier, GamePhase, PublicState } from "@/lib/game-engine/types";
import { fmt } from "@/lib/game-engine/special-rounds";
import type { PlayerSelf } from "@/lib/server/players";
import { api, ApiError, uuid, withRetry } from "@/lib/realtime/api-client";
import { useGameState, useTicker } from "@/lib/realtime/use-game-state";
import { useAutoReload } from "@/lib/realtime/use-auto-reload";
import { Character, Logo } from "@/features/game/components/brand";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { EVENT_ICON, formatPoints, signedPoints } from "@/features/game/lines";
import { podiumPlan } from "@/features/game/script";
import {
  PhoneCard,
  PhoneHeader,
  PhoneMessage,
  PhoneQuestionView,
  PhoneShell,
  PhoneStandings,
  PhoneVoteView,
  type PhoneBetProps,
  type SubmitStatus,
} from "./PlayerScreens";

interface LocalAnswer {
  qid: string | null;
  selected: number[];
  status: SubmitStatus;
  error: string | null;
}

interface LocalBet {
  qid: string | null;
  selected: BetTier | null;
  status: SubmitStatus;
  error: string | null;
  confirmed: { tier: BetTier; stake: number } | null;
}

interface MeResponse {
  self: PlayerSelf;
  state: PublicState;
}

const REFRESH_SELF_PHASES: GamePhase[] = ["ANSWER_REVEAL", "SCORE_REVEAL", "LEADERBOARD", "FINISHED", "CATEGORY_RESULT", "LOBBY"];
const vibrate = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* non supportato */
  }
};

export function PlayerApp({ code, slot }: { code: string; slot: string | null }) {
  useAutoReload();
  const [joined, setJoined] = useState<"unknown" | "no" | "yes">("unknown");
  const [kicked, setKicked] = useState(false);
  const [self, setSelf] = useState<PlayerSelf | null>(null);
  const q = slot ? `?slot=${slot}` : "";
  const refreshRef = useRef<() => Promise<unknown>>(async () => null);

  // Selezione e invio, legati alla domanda corrente (stato derivato, niente effetti)
  const [local, setLocal] = useState<LocalAnswer>({ qid: null, selected: [], status: "idle", error: null });
  const [voteSending, setVoteSending] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [localVote, setLocalVote] = useState<{ roundId: string; optionId: string } | null>(null);
  const [localBet, setLocalBet] = useState<LocalBet>({ qid: null, selected: null, status: "idle", error: null, confirmed: null });

  const fetchSnapshot = useCallback(async () => {
    try {
      const r = await api<MeResponse>(`/api/play/${code}/me${q}`);
      setSelf(r.self);
      setJoined("yes");
      return r.state;
    } catch (e) {
      if (e instanceof ApiError && e.code === "KICKED") setKicked(true);
      else if (e instanceof ApiError && (e.status === 401 || e.status === 404)) setJoined("no");
      throw e;
    }
  }, [code, q]);

  const onState = useCallback((s: PublicState, prev: PublicState | null) => {
    if (prev && s.phase !== prev.phase && REFRESH_SELF_PHASES.includes(s.phase)) {
      // jitter: evita che 200 telefoni interroghino il server nello stesso istante
      setTimeout(() => void refreshRef.current(), 150 + Math.random() * 900);
    }
    if (prev && s.phase !== prev.phase && s.phase === "OPTIONS_VISIBLE") {
      vibrate(40);
      // Scommetti tutto: la posta definitiva (ricalcolata alla chiusura delle puntate)
      if (s.question?.rules.special?.kind === "bet") setTimeout(() => void refreshRef.current(), 150 + Math.random() * 900);
    }
  }, []);

  const { state, status, now, refresh } = useGameState({ fetchSnapshot, safetyPollMs: 20000, enabled: joined !== "no" && !kicked, onState });
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const qid = state?.question?.id ?? null;
  const serverAnswer = self?.currentAnswer && self.currentAnswer.sessionQuestionId === qid ? self.currentAnswer : null;
  const mine: LocalAnswer = local.qid === qid ? local : { qid, selected: [], status: "idle", error: null };
  // la risposta confermata dal server ha sempre la precedenza (es. dopo un refresh della pagina)
  const selected = serverAnswer && mine.status !== "recorded" ? serverAnswer.positions : mine.selected;
  const submitStatus: SubmitStatus = serverAnswer ? "recorded" : mine.status;
  const submitError = mine.error;
  const patchLocal = (p: Partial<LocalAnswer>) => setLocal((l) => ({ ...(l.qid === qid ? l : { qid, selected: [], status: "idle" as SubmitStatus, error: null }), ...p }));

  // Puntata (Scommetti tutto), legata alla domanda corrente come la risposta
  const myBet: LocalBet = localBet.qid === qid ? localBet : { qid, selected: null, status: "idle", error: null, confirmed: null };
  const serverBet = self?.currentBet && self.currentBet.sessionQuestionId === qid ? self.currentBet : null;
  const patchBet = (p: Partial<LocalBet>) =>
    setLocalBet((b) => ({ ...(b.qid === qid ? b : { qid, selected: null, status: "idle" as SubmitStatus, error: null, confirmed: null }), ...p }));

  const placeBet = async () => {
    const qn = state?.question;
    const tier = myBet.selected;
    if (!qn || tier === null) return;
    const key = `qz.bet.${qn.id}`;
    let requestId: string;
    try {
      requestId = sessionStorage.getItem(key) ?? uuid();
      sessionStorage.setItem(key, requestId);
    } catch {
      requestId = uuid();
    }
    patchBet({ status: "sending", error: null });
    try {
      const r = await withRetry(() =>
        api<{ tier: BetTier; stake: number }>("/api/play/bet", { method: "POST", json: { code, sessionQuestionId: qn.id, tier, requestId, ...(slot ? { slot } : {}) } }),
      );
      patchBet({ status: "recorded", confirmed: { tier: r.tier, stake: r.stake } });
      vibrate([30, 40, 30]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ALREADY_BET") {
        const d = e.details as { tier?: BetTier; stake?: number } | undefined;
        patchBet({ status: "recorded", ...(d?.tier !== undefined && d.stake !== undefined ? { confirmed: { tier: d.tier, stake: d.stake } } : {}) });
        void refresh();
        return;
      }
      patchBet({ status: "error", error: e instanceof ApiError ? e.message : "Puntata non inviata, riprova" });
    }
  };

  // Battito di presenza (leggero)
  useEffect(() => {
    if (joined !== "yes") return;
    const id = setInterval(() => {
      void fetch(`/api/play/${code}/heartbeat${q}`, { method: "POST", cache: "no-store" }).then((r) => {
        if (r.status === 403) setKicked(true);
      });
    }, 30000);
    return () => clearInterval(id);
  }, [joined, code, q]);

  const timerActive = state?.phase === "OPTIONS_VISIBLE" || state?.phase === "CATEGORY_VOTING";
  useTicker(timerActive, 250);

  const toggle = (pos: number) => {
    if (!state?.question) return;
    if (submitStatus === "sending" || submitStatus === "recorded") return;
    vibrate(10);
    if (state.question.type === "single") {
      // risposta singola: un tocco e la risposta è data (niente conferma, conta la velocità)
      patchLocal({ selected: [pos] });
      void confirm([pos]);
    } else patchLocal({ selected: selected.includes(pos) ? selected.filter((x) => x !== pos) : [...selected, pos].sort() });
  };

  const confirm = async (chosen?: number[]) => {
    const qn = state?.question;
    const positions = chosen ?? selected;
    if (!qn || positions.length === 0) return;
    // stesso requestId per i tentativi della stessa domanda: richieste ripetute idempotenti
    const key = `qz.req.${qn.id}`;
    let requestId: string;
    try {
      requestId = sessionStorage.getItem(key) ?? uuid();
      sessionStorage.setItem(key, requestId);
    } catch {
      requestId = uuid();
    }
    patchLocal({ status: "sending", error: null });
    try {
      await withRetry(() =>
        api("/api/play/answer", { method: "POST", json: { code, sessionQuestionId: qn.id, positions, requestId, ...(slot ? { slot } : {}) } }),
      );
      patchLocal({ status: "recorded" });
      vibrate([30, 40, 30]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ALREADY_ANSWERED") {
        const pos = (e.details as { positions?: number[] } | undefined)?.positions;
        patchLocal({ status: "recorded", ...(pos ? { selected: pos } : {}) });
        return;
      }
      patchLocal({ status: "error", error: e instanceof ApiError ? e.message : "Invio non riuscito, riprova" });
    }
  };

  const vote = async (optionId: string) => {
    if (!state?.vote) return;
    setVoteSending(true);
    setVoteError(null);
    try {
      await withRetry(() => api("/api/play/vote", { method: "POST", json: { code, roundId: state.vote!.roundId, optionId, ...(slot ? { slot } : {}) } }));
      setLocalVote({ roundId: state.vote.roundId, optionId });
      vibrate([30, 40, 30]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ALREADY_ANSWERED") {
        const prev = (e.details as { optionId?: string } | undefined)?.optionId;
        if (prev) setLocalVote({ roundId: state.vote.roundId, optionId: prev });
      } else setVoteError(e instanceof ApiError ? e.message : "Voto non inviato");
    } finally {
      setVoteSending(false);
    }
  };

  // ------------------------------------------------------------------ render
  if (kicked) {
    return (
      <PhoneShell>
        <PhoneMessage who="regina" title="Sei stato escluso dalla partita">
          Per informazioni rivolgiti allo staff.
        </PhoneMessage>
      </PhoneShell>
    );
  }
  if (joined === "no") {
    return (
      <JoinScreen
        code={code}
        slot={slot}
        onJoined={() => {
          setJoined("yes");
          void refresh();
        }}
      />
    );
  }
  if (!state || !self) {
    return <LoadingSplash label="Collegamento allo studio…" />;
  }

  const vp: GamePhase = state.phase === "PAUSED" && state.pausedFrom ? state.pausedFrom : state.phase;
  // dopo una risposta a metà round: niente totali né posizione, solo i punti di quella risposta
  const hideTotals = vp === "SCORE_REVEAL" && !!state.question && state.question.positionInRound < state.question.totalInRound;
  const closesAt = vp === "CATEGORY_VOTING" ? state.vote?.closesAt : state.question?.closesAt;
  const remainingMs = closesAt && state.phase !== "PAUSED" ? Math.max(0, Date.parse(closesAt) - now()) : 0;
  const openedAt = vp === "OPTIONS_VISIBLE" ? state.question?.openedAt : null;
  const startsInMs = openedAt && state.phase !== "PAUSED" ? Math.max(0, Date.parse(openedAt) - now()) : 0;
  const myVote = localVote && localVote.roundId === state.vote?.roundId ? localVote.optionId : self.vote?.roundId === state.vote?.roundId ? (self.vote?.optionId ?? null) : null;
  const result =
    self.currentResult && self.currentResult.sessionQuestionId === state.question?.id
      ? { isCorrect: self.currentResult.isCorrect, partial: self.currentResult.partial, delta: vp === "SCORE_REVEAL" || vp === "LEADERBOARD" ? self.currentResult.delta : self.currentResult.delta }
      : null;

  let body: React.ReactNode;
  if (vp === "LOBBY" || vp === "READY") {
    body = <LobbyView self={self} state={state} />;
  } else if (vp === "INTRO") {
    body = (
      <PhoneMessage who="professore" title="Guarda il TV!">
        Sta per cominciare lo spettacolo. Tieni il telefono a portata di mano!
      </PhoneMessage>
    );
  } else if (vp === "ROUND_INTRO" && state.round) {
    body = (
      <PhoneMessage who={state.round.kind === "category_vote" ? "palmino" : state.round.presenter} title={state.round.title}>
        Round {state.round.index} di {state.round.total}
        {state.round.special?.kind === "bet" ? (
          <>
            <p className="mt-2 font-display text-2xl text-gold">🎰 SCOMMETTI TUTTO</p>
            <p className="mt-1 text-base">Prima delle risposte punta 0%, 25%, 50% o tutto dei tuoi punti. Giusta: vinci la posta. Sbagliata: la perdi!</p>
            {state.round.special.minStake > 0 && <p className="mt-1 text-sm text-white/70">Puntata minima {formatPoints(state.round.special.minStake)}: gioca anche chi ha pochi punti</p>}
          </>
        ) : state.round.special?.kind === "comeback" ? (
          <>
            <p className="mt-2 font-display text-2xl text-gold">🚀 GRANDE RIBALTONE</p>
            {state.round.special.boostMultiplier > 1 && (
              <p className="mt-1 text-base">Chi è nella metà bassa della classifica prende i punti ×{fmt(state.round.special.boostMultiplier)}!</p>
            )}
            {state.round.special.leaderPenaltyMultiplier > 1 && (
              <p className="mt-1 text-base">Chi è in testa, se sbaglia, perde ×{fmt(state.round.special.leaderPenaltyMultiplier)}.</p>
            )}
          </>
        ) : (
          <>
            {state.round.pointsMultiplier !== 1 && <p className="mt-2 font-display text-gold">Punti ×{state.round.pointsMultiplier}</p>}
            {state.round.noPenalty && <p className="mt-1 font-display text-cyan">Nessuna penalità!</p>}
          </>
        )}
      </PhoneMessage>
    );
  } else if ((vp === "CATEGORY_VOTING" || vp === "CATEGORY_RESULT") && state.vote) {
    body = <PhoneVoteView vote={state.vote} phase={state.phase} myOptionId={myVote} remainingMs={remainingMs} sending={voteSending} error={voteError} onVote={vote} />;
  } else if (vp === "SPECIAL_EVENT" && state.event) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Character who="palmino" small className="w-48 animate-float" />
        <p className="font-display text-5xl">{EVENT_ICON[state.event.type]}</p>
        <h1 className="qz-gold-text font-display text-4xl leading-tight">{state.event.title}</h1>
        <p className="text-lg font-bold">{state.event.tagline}</p>
      </div>
    );
  } else if (state.question && ["QUESTION_VISIBLE", "OPTIONS_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL"].includes(vp)) {
    const m = state.question.media;
    const sp = state.question.rules.special;
    const bet: PhoneBetProps | null =
      sp?.kind === "bet"
        ? {
            points: self.points,
            minStake: sp.minStake,
            defaultTier: sp.defaultTier,
            selected: myBet.selected,
            // la posta chiusa dal server ha la precedenza; prima vale la conferma appena ricevuta
            confirmed: serverBet
              ? { tier: serverBet.tier, stake: serverBet.stake, isDefault: serverBet.isDefault, locked: serverBet.locked }
              : myBet.confirmed
                ? { ...myBet.confirmed, isDefault: false, locked: false }
                : null,
            status: serverBet && !serverBet.isDefault ? "recorded" : myBet.status,
            error: myBet.error,
            onSelect: (tier) => {
              vibrate(10);
              patchBet({ selected: tier, error: null });
            },
            onConfirm: () => void placeBet(),
          }
        : null;
    body = (
      <PhoneQuestionView
        question={state.question}
        phase={state.phase}
        selected={selected}
        submitStatus={submitStatus}
        submitError={submitError}
        remainingMs={remainingMs}
        startsInMs={startsInMs}
        mediaUrl={m && m.kind === "image" ? `/api/play/${code}/media/${m.id}` : null}
        event={state.event}
        result={result}
        onToggle={toggle}
        onConfirm={() => void confirm()}
        bet={bet}
        me={self.participantId}
      />
    );
  } else if (vp === "SCORE_REVEAL" || vp === "LEADERBOARD") {
    body = (
      <>
        {vp === "SCORE_REVEAL" && result && (
          <PhoneCard className="mb-3 text-center">
            <p className="font-display text-2xl">{result.isCorrect ? "Risposta esatta!" : result.partial ? "Risposta parziale" : "Questa volta no…"}</p>
            {result.delta !== null && <p className="font-display text-4xl text-gold">{signedPoints(result.delta)}</p>}
          </PhoneCard>
        )}
        {vp === "SCORE_REVEAL" && state.question && state.question.positionInRound < state.question.totalInRound ? (
          // a metà round solo il + o il − di questa risposta (totale e classifica a fine round)
          <p className="text-center text-sm font-bold text-white/70">Totale e classifica a fine round</p>
        ) : (
          <PhoneStandings entries={state.leaderboard ?? []} me={self.participantId} myRank={self.rank} myPoints={self.points} lastDelta={self.lastDelta} title="La tua posizione" />
        )}
      </>
    );
  } else if (vp === "FINISHED") {
    body = <FinishedView self={self} state={state} now={now} />;
  } else {
    body = <PhoneMessage title="Guarda il TV!" />;
  }

  return (
    <PhoneShell header={<PhoneHeader nickname={self.nickname} points={hideTotals ? null : self.points} rank={vp === "FINISHED" || hideTotals ? null : self.rank} total={self.totalPlayers} status={status} />}>
      {body}
      {state.phase === "PAUSED" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/85 p-6 text-center backdrop-blur">
          <div>
            <p className="font-display text-5xl text-gold">PAUSA</p>
            <p className="mt-2 font-bold">Si riprende tra poco: resta collegato!</p>
          </div>
        </div>
      )}
    </PhoneShell>
  );
}

// ---------------------------------------------------------------------------
function LobbyView({ self, state }: { self: PlayerSelf; state: PublicState }) {
  const [recovery] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem("qz.recovery");
    } catch {
      return null;
    }
  });
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Logo variant="full" size="lg" priority className="!h-auto w-full max-w-sm animate-float" />
      <PhoneCard className="w-full">
        <p className="text-sm font-bold uppercase tracking-wide text-white/70">Sei dentro come</p>
        <p className="font-display text-4xl text-gold">{self.nickname}</p>
        <p className="mt-2 font-bold">{state.phase === "READY" ? "La lobby non è ancora aperta" : "Aspetta il via dalla regia…"}</p>
        <p className="mt-1 text-white/70">{state.playerCount} giocatori collegati</p>
      </PhoneCard>
      {recovery && (
        <p className="text-xs text-white/60">
          Il tuo codice giocatore per le classifiche mensili: <span className="font-display tracking-wider text-gold">{recovery}</span>
        </p>
      )}
    </div>
  );
}

function FinishedView({ self, state, now }: { self: PlayerSelf; state: PublicState; now: () => number }) {
  const podium = (state.leaderboard ?? []).slice(0, 3);
  // la posizione si scopre insieme al TV (stessa scaletta del podio, ora del server)
  const revealAt = Date.parse(state.phaseStartedAt) + (podiumPlan(state.leaderboard ?? [], state.sessionId).winnerAt + 0.5) * 1000;
  const [, setTick] = useState(0);
  const waiting = now() < revealAt;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(id);
  }, [waiting]);
  if (waiting) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="animate-bounce text-7xl">🥁</p>
        <p className="font-display text-3xl text-gold">Classifica finale…</p>
        <p className="text-lg font-bold text-white/85">Guarda il TV: stanno per svelare il podio!</p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-3">
      <PhoneCard className="text-center">
        <p className="font-display text-2xl text-gold">Partita finita!</p>
        <p className="font-display text-6xl leading-none">{self.rank ? `${self.rank}°` : "–"}</p>
        <p className="font-display text-2xl">{formatPoints(self.points)} punti</p>
        {self.rank === 1 && (
          <p className="mt-1 font-display text-xl">
            {(state.leaderboard ?? []).filter((e) => e.rank === 1).length > 1 ? "🏆 CAMPIONE A PARI MERITO! 🏆" : "🏆 CAMPIONE DELLA SERATA! 🏆"}
          </p>
        )}
      </PhoneCard>
      <div className="grid grid-cols-3 items-end gap-2 text-center">
        {[podium[1], podium[0], podium[2]].map((e, i) => (
          <div key={i} className="flex flex-col items-center">
            {e && (
              <>
                <span className="text-2xl">{({ 1: "🥇", 2: "🥈", 3: "🥉" } as Record<number, string>)[e.rank] ?? "🏅"}</span>
                <span className="w-full truncate font-extrabold">{e.nickname}</span>
                <div className={`w-full rounded-t-xl border-2 border-gold bg-gold/30 font-display ${({ 1: "h-24", 2: "h-16", 3: "h-12" } as Record<number, string>)[e.rank] ?? "h-12"}`}>{e.rank}</div>
              </>
            )}
          </div>
        ))}
      </div>
      <p className="text-center font-bold text-white/85">Grazie per aver giocato! Ci vediamo venerdì prossimo.</p>
      <Link href="/classifica" className="text-center font-bold text-gold underline">
        Classifica del mese
      </Link>
      {self.history.length > 0 && <HistoryList self={self} />}
    </div>
  );
}

function HistoryList({ self }: { self: PlayerSelf }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {self.history.map((h) => (
        <li key={h.sessionQuestionId} className="rounded-xl bg-black/40 px-3 py-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-display text-gold">{h.number}</span>
            <span className="flex-1 font-bold">{h.text}</span>
            <span className={h.isCorrect ? "text-[#5dffab]" : "text-[#ff8098]"}>{h.isCorrect ? "✓" : "✗"}</span>
          </div>
          <p className="mt-0.5 text-white/70">
            Tu: {h.myPositions ? h.myPositions.map((p) => "ABCD"[p]).join("+") : "—"} · Giusta: {h.correctPositions.map((p) => "ABCD"[p]).join("+")}
            {h.delta !== null && ` · ${signedPoints(h.delta)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Ingresso: solo nickname (nessun account)
// ---------------------------------------------------------------------------
function JoinScreen({ code, slot, onJoined }: { code: string; slot: string | null; onJoined: () => void }) {
  const [nickname, setNickname] = useState("");
  const [recovery, setRecovery] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<PublicState | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

  useEffect(() => {
    api<{ state: PublicState }>(`/api/game/${code}/state`)
      .then((r) => setInfo(r.state))
      .catch((e: unknown) => setError(e instanceof ApiError && e.status === 404 ? "Partita non trovata: controlla il codice sul TV" : null));
  }, [code]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ recoveryCode: string | null; rejoined: boolean }>("/api/play/join", {
        method: "POST",
        json: { code, nickname, recoveryCode: showRecovery ? recovery : "", ...(slot ? { slot } : {}) },
      });
      vibrate([40, 30, 40]);
      if (r.recoveryCode) {
        try {
          localStorage.setItem("qz.recovery", r.recoveryCode);
        } catch {
          /* ignora */
        }
        setNewCode(r.recoveryCode);
      } else onJoined();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connessione assente, riprova");
    } finally {
      setLoading(false);
    }
  }

  if (newCode) {
    return (
      <PhoneShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Character who="regina" small className="w-40" />
          <h1 className="font-display text-3xl">Benvenuto a CHE NE SAI?!</h1>
          <PhoneCard className="w-full">
            <p className="text-sm font-bold text-white/80">Il tuo codice giocatore (facoltativo)</p>
            <p className="my-2 font-display text-3xl tracking-widest text-gold">{newCode}</p>
            <p className="text-sm text-white/70">Serve solo se cambi telefono e vuoi mantenere i punti delle classifiche mensili. Fai uno screenshot!</p>
          </PhoneCard>
          <button onClick={onJoined} className="h-16 w-full rounded-2xl border-[3px] border-[#b8770a] bg-gradient-to-b from-[#ffe680] to-gold-deep font-display text-2xl text-ink shadow-[0_5px_0_#9a5d00]">
            ANDIAMO!
          </button>
        </div>
      </PhoneShell>
    );
  }

  const closed = info && (info.phase === "FINISHED");
  return (
    <PhoneShell>
      <form onSubmit={submit} className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Logo variant="full" size="lg" priority className="!h-auto w-full max-w-sm" />
        {closed ? (
          <PhoneCard className="w-full">
            <p className="font-display text-2xl">Questa partita è terminata</p>
            <p className="mt-1 font-bold text-white/80">Ci vediamo venerdì prossimo!</p>
          </PhoneCard>
        ) : (
          <PhoneCard className="flex w-full flex-col gap-3 text-left">
            <label htmlFor="nick" className="font-display text-xl text-gold">
              Scegli il tuo nickname
            </label>
            <input
              id="nick"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={24}
              autoComplete="nickname"
              autoCapitalize="words"
              enterKeyHint="go"
              required
              placeholder="Es. Mike il Grande"
              className="h-14 w-full rounded-2xl border-[3px] border-gold/70 bg-white px-4 text-[20px] font-extrabold text-ink placeholder:text-ink/40 focus:border-cyan focus:outline-none"
            />
            {showRecovery ? (
              <input
                value={recovery}
                onChange={(e) => setRecovery(e.target.value.toUpperCase())}
                placeholder="QZ-XXXX-XXXX"
                autoCapitalize="characters"
                className="h-12 w-full rounded-2xl border-2 border-white/30 bg-black/40 px-4 text-[17px] font-bold tracking-widest text-white"
              />
            ) : (
              <button type="button" onClick={() => setShowRecovery(true)} className="self-start text-sm font-bold text-white/70 underline">
                Hai un codice giocatore? (telefono nuovo)
              </button>
            )}
            {error && <p className="rounded-xl bg-flame/25 px-3 py-2 text-sm font-bold text-[#ffd1da]">{error}</p>}
            <button
              type="submit"
              disabled={loading || nickname.trim().length < 2}
              className="h-16 w-full rounded-2xl border-[3px] border-[#b8770a] bg-gradient-to-b from-[#ffe680] to-gold-deep font-display text-2xl text-ink shadow-[0_5px_0_#9a5d00] transition active:translate-y-[3px] active:shadow-none disabled:opacity-50"
            >
              {loading ? "UN ATTIMO…" : "ENTRA E GIOCA!"}
            </button>
            <p className="text-center text-xs text-white/60">Nessuna registrazione: basta il nickname. Codice partita {code}</p>
          </PhoneCard>
        )}
      </form>
    </PhoneShell>
  );
}
