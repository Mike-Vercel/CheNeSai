"use client";

import type { GamePhase } from "@/lib/game-engine/types";
import { Logo } from "@/features/game/components/brand";
import { standingsForShow } from "@/features/game/teams-view";
import { LandscapeScreen, type TvStageProps } from "./TvStage";
import { TvFrame, TvPodiumScreen } from "./TvScreens";
import { TrioHost } from "./TvTrio";
import {
  PortraitAnswerPointsScreen,
  PortraitLeaderboardScreen,
  PortraitLobbyScreen,
  PortraitMessageScreen,
  PortraitQuestionScreen,
  PortraitRoundIntroScreen,
  PortraitSpecialEventScreen,
} from "./PortraitScreens";

/**
 * Lo show in VERTICALE (telefono, 1080×1920): come TvStage ma con le schermate ricomposte in
 * colonna. I momenti rari che il gioco libero non usa (votazione della categoria, ruota, puntate,
 * squadre) restano le schermate 16:9 del TV, centrate in una fascia: si vedono comunque bene.
 */
export function PortraitStage(props: TvStageProps) {
  return (
    <TrioHost>
      <PortraitScreen {...props} />
    </TrioHost>
  );
}

/** Schermata 16:9 del TV dentro lo show verticale (fascia centrale con il logo sopra). */
function Letterbox(props: TvStageProps) {
  return (
    <TvFrame calm>
      <div className="absolute inset-x-0 top-[6cqh] flex justify-center">
        <Logo variant="full" size="lg" className="!h-[16cqh] w-auto" />
      </div>
      <div className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2 overflow-hidden border-y-[0.6cqw] border-gold/60 [container-type:size]">
        <LandscapeScreen {...props} />
      </div>
    </TvFrame>
  );
}

function PortraitScreen(props: TvStageProps) {
  const { state: view, remainingMs, mediaUrl, qrDataUrl, joinUrl, intro, now = Date.now, live = false, onCelebrate } = props;
  if (!view) return <PortraitMessageScreen title="Collegamento allo studio…" />;
  const vp: GamePhase = view.phase === "PAUSED" && view.pausedFrom ? view.pausedFrom : view.phase;
  if (view.teams) return vp === "INTRO" ? <>{intro}</> : <Letterbox {...props} />;
  if (vp === "DRAFT" || vp === "READY" || vp === "LOBBY") return <PortraitLobbyScreen state={view} qrDataUrl={qrDataUrl} joinUrl={joinUrl} />;
  if (vp === "INTRO") return <>{intro}</>;
  if (vp === "ROUND_INTRO" && view.round && view.round.kind !== "category_wheel" && view.round.kind !== "category_vote") {
    return <PortraitRoundIntroScreen round={view.round} showLines={view.showLines} />;
  }
  if (vp === "SPECIAL_EVENT" && view.event) return <PortraitSpecialEventScreen event={view.event} />;
  if (view.question && (vp === "QUESTION_VISIBLE" || vp === "OPTIONS_VISIBLE" || vp === "ANSWERS_LOCKED" || vp === "ANSWER_REVEAL") && view.question.rules.special?.kind !== "bet") {
    const m = view.question.media;
    const openedAt = vp === "OPTIONS_VISIBLE" ? view.question.openedAt : null;
    return (
      <PortraitQuestionScreen
        question={view.question}
        round={view.round}
        phase={view.phase === "PAUSED" ? "PAUSED" : vp}
        remainingMs={vp === "OPTIONS_VISIBLE" ? remainingMs : 0}
        startsInMs={openedAt && view.phase !== "PAUSED" ? Math.max(0, Date.parse(openedAt) - now()) : 0}
        event={view.event}
        mediaUrl={m && m.kind === "image" ? mediaUrl(m.id) : null}
        totalQuestions={view.totalQuestions}
      />
    );
  }
  if (vp === "SCORE_REVEAL" && !view.question?.bets?.locked) {
    const q = view.question;
    if (q && q.positionInRound < q.totalInRound) return <PortraitAnswerPointsScreen entries={view.leaderboard ?? []} who={q.presenter} questionId={q.id} showLines={view.showLines} />;
    return <PortraitLeaderboardScreen entries={view.leaderboard ?? []} title="CLASSIFICA DI FINE ROUND" showLines={view.showLines} />;
  }
  if (vp === "LEADERBOARD") return <PortraitLeaderboardScreen entries={view.leaderboard ?? []} title="CLASSIFICA" />;
  if (vp === "FINISHED") return <TvPodiumScreen portrait entries={standingsForShow(view)} startedAt={view.phaseStartedAt} seed={view.sessionId} now={now} live={live} onCelebrate={onCelebrate} />;
  // votazione, ruota, puntate: la schermata del TV in una fascia
  return <Letterbox {...props} />;
}
