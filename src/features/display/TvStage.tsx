"use client";

import type { ReactNode } from "react";
import type { GamePhase, PublicState } from "@/lib/game-engine/types";
import {
  TvAnswerPointsScreen,
  TvLeaderboardScreen,
  TvLobbyScreen,
  TvMessageScreen,
  TvPodiumScreen,
  TvQuestionScreen,
  TvRoundIntroScreen,
  TvSpecialEventScreen,
  TvVotingScreen,
} from "./TvScreens";
import { TvWheelScreen } from "./TvWheel";

export interface TvStageProps {
  state: PublicState | null;
  remainingMs: number;
  mediaUrl: (mediaId: string) => string | null;
  qrDataUrl: string | null;
  joinUrl: string;
  audioState?: "idle" | "playing" | "done" | "error";
  /** Contenuto per la fase INTRO (scena 3D sul TV, segnaposto in regia). */
  intro: ReactNode;
  /** Ora del server (per la rivelazione del podio sincronizzata). */
  now?: () => number;
  /** true sul TV: suoni e voci del podio (in regia solo immagini). */
  live?: boolean;
  /** Coriandoli (vincitore del podio, arrivo della ruota). */
  onCelebrate?: (intensity?: number) => void;
  /** Preferenze del TV: movimento ridotto e PC lento (la ruota rinuncia ad animazioni e bagliori). */
  reducedMotion?: boolean;
  lowPower?: boolean;
}

/** Sceglie la schermata TV in base alla fase (usato dal TV e dall'anteprima in regia). */
export function TvStage({ state: view, remainingMs, mediaUrl, qrDataUrl, joinUrl, audioState = "idle", intro, now, live = false, onCelebrate, reducedMotion = false, lowPower = false }: TvStageProps) {
  if (!view) return <TvMessageScreen title="Collegamento allo studio…" />;
  const vp: GamePhase = view.phase === "PAUSED" && view.pausedFrom ? view.pausedFrom : view.phase;
  if (vp === "DRAFT" || vp === "READY" || vp === "LOBBY") return <TvLobbyScreen state={view} qrDataUrl={qrDataUrl} joinUrl={joinUrl} />;
  if (vp === "INTRO") return <>{intro}</>;
  // Ruota impazzita: presentazione del round con la ruota ferma, poi il giro deciso dal server
  if ((vp === "ROUND_INTRO" || vp === "WHEEL_SPIN") && view.round?.kind === "category_wheel" && view.wheel) {
    return <TvWheelScreen round={view.round} wheel={view.wheel} now={now} live={live} reducedMotion={reducedMotion} lowPower={lowPower} onCelebrate={onCelebrate} />;
  }
  if ((vp === "ROUND_INTRO" || vp === "CATEGORY_VOTING" || vp === "CATEGORY_RESULT") && view.round) {
    if (vp !== "ROUND_INTRO" && view.vote) {
      const total = view.vote.closesAt && view.vote.openedAt ? Date.parse(view.vote.closesAt) - Date.parse(view.vote.openedAt) : 15000;
      return <TvVotingScreen vote={view.vote} remainingMs={remainingMs} totalMs={total} phase={vp} />;
    }
    return <TvRoundIntroScreen round={view.round} vote={view.vote} />;
  }
  if (vp === "SPECIAL_EVENT" && view.event) return <TvSpecialEventScreen event={view.event} />;
  if (view.question && (vp === "QUESTION_VISIBLE" || vp === "OPTIONS_VISIBLE" || vp === "ANSWERS_LOCKED" || vp === "ANSWER_REVEAL")) {
    const m = view.question.media;
    return (
      <TvQuestionScreen
        question={view.question}
        round={view.round}
        phase={vp}
        remainingMs={vp === "OPTIONS_VISIBLE" ? remainingMs : 0}
        event={view.event}
        mediaUrl={m && m.kind !== "audio" ? mediaUrl(m.id) : null}
        questionsPlayed={view.questionsPlayed}
        totalQuestions={view.totalQuestions}
        audioState={audioState}
      />
    );
  }
  if (vp === "SCORE_REVEAL") {
    // a metà round solo i punti di questa risposta; all'ultima domanda del round la classifica totale
    const q = view.question;
    if (q && q.positionInRound < q.totalInRound) return <TvAnswerPointsScreen entries={view.leaderboard ?? []} who={q.presenter} questionId={q.id} />;
    return <TvLeaderboardScreen entries={view.leaderboard ?? []} title="CLASSIFICA DI FINE ROUND" showDelta />;
  }
  if (vp === "LEADERBOARD") return <TvLeaderboardScreen entries={view.leaderboard ?? []} title="CLASSIFICA" showDelta />;
  if (vp === "FINISHED")
    return <TvPodiumScreen entries={view.leaderboard ?? []} startedAt={view.phaseStartedAt} seed={view.sessionId} now={now} live={live} onCelebrate={onCelebrate} />;
  return <TvMessageScreen title="Guardate qui!" />;
}
