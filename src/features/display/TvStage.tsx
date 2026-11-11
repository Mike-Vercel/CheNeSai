"use client";

import type { ReactNode } from "react";
import type { GamePhase, PublicState } from "@/lib/game-engine/types";
import {
  TvAnswerPointsScreen,
  TvBetResultsScreen,
  TvLeaderboardScreen,
  TvLobbyScreen,
  TvMessageScreen,
  TvPodiumScreen,
  TvQuestionScreen,
  TvRoundIntroScreen,
  TvSpecialEventScreen,
  TvVotingScreen,
} from "./TvScreens";
import { TvLobbyTeams, TvTeamLeaderboardScreen, TvWinningTeamBanner } from "./TvTeamScreens";
import { leadingTeams, standingsForShow, teamMode } from "@/features/game/teams-view";
import { TvWheelScreen } from "./TvWheel";
import { TrioHost } from "./TvTrio";

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

/**
 * Sceglie la schermata TV in base alla fase (usato dal TV e dall'anteprima in regia).
 * Tutte le schermate stanno dentro TrioHost: i tre presentatori 3D vivono in UN solo canvas che
 * passa da una schermata all'altra (vedi TvTrio.tsx) invece di ricrearsi a ogni cambio di fase.
 */
export function TvStage(props: TvStageProps) {
  return (
    <TrioHost>
      <StageScreen {...props} />
    </TrioHost>
  );
}

function StageScreen({ state: view, remainingMs, mediaUrl, qrDataUrl, joinUrl, audioState = "idle", intro, now, live = false, onCelebrate, reducedMotion = false, lowPower = false }: TvStageProps) {
  if (!view) return <TvMessageScreen title="Collegamento allo studio…" />;
  const vp: GamePhase = view.phase === "PAUSED" && view.pausedFrom ? view.pausedFrom : view.phase;
  const mode = teamMode(view);
  if (vp === "DRAFT" || vp === "READY" || vp === "LOBBY")
    return <TvLobbyScreen state={view} qrDataUrl={qrDataUrl} joinUrl={joinUrl} extra={view.teams ? <TvLobbyTeams teams={view.teams} /> : undefined} />;
  // modalità squadre: classifica a squadre ("both": squadre + giocatori)
  const teamBoard = (title: string) =>
    view.teams && mode !== "individual" ? (
      <TvTeamLeaderboardScreen
        teams={view.teamLeaderboard ?? []}
        players={mode === "both" ? (view.leaderboard ?? []) : null}
        title={title}
        showDelta
        aggregation={view.teams.aggregation}
      />
    ) : null;
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
    return <TvRoundIntroScreen round={view.round} vote={view.vote} showLines={vp === "ROUND_INTRO" ? view.showLines : null} />;
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
    // Scommetti tutto: grandi vincite e grandi perdite (la classifica arriva con MOSTRA CLASSIFICA)
    if (q?.bets?.locked) return <TvBetResultsScreen bets={q.bets} who={q.presenter} questionId={q.id} />;
    // chi dice una battuta del regista entra in scena con la sua animazione (vedi presenter-cue.ts)
    if (q && q.positionInRound < q.totalInRound) return <TvAnswerPointsScreen entries={view.leaderboard ?? []} who={q.presenter} questionId={q.id} showLines={view.showLines} />;
    return teamBoard("CLASSIFICA DI FINE ROUND") ?? <TvLeaderboardScreen entries={view.leaderboard ?? []} title="CLASSIFICA DI FINE ROUND" showDelta showLines={view.showLines} />;
  }
  if (vp === "LEADERBOARD") return teamBoard("CLASSIFICA") ?? <TvLeaderboardScreen entries={view.leaderboard ?? []} title="CLASSIFICA" showDelta />;
  if (vp === "FINISHED")
    return (
      <TvPodiumScreen
        // "teams": podio delle squadre; "both": podio individuale + squadra vincitrice
        entries={standingsForShow(view)}
        startedAt={view.phaseStartedAt}
        seed={view.sessionId}
        now={now}
        live={live}
        onCelebrate={onCelebrate}
        titles={mode === "teams" ? { pending: "LA CLASSIFICA DELLE SQUADRE", done: "LA SQUADRA CAMPIONE" } : undefined}
        banner={mode === "both" ? <TvWinningTeamBanner teams={leadingTeams(view)} /> : undefined}
      />
    );
  return <TvMessageScreen title="Guardate qui!" />;
}
