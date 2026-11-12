"use client";

import type { GamePhase } from "@/lib/game-engine/types";
import { Logo } from "@/features/game/components/brand";
import { roundAsEntries, standingsForShow } from "@/features/game/teams-view";
import { formatPoints, signedPoints } from "@/features/game/lines";
import { LandscapeScreen, type TvStageProps } from "./TvStage";
import { TvFrame, TvPodiumScreen } from "./TvScreens";
import { TrioHost } from "./TvTrio";
import { QuestionIntroScreen } from "./QuestionIntroScreen";
import { TvPalminoWheelScreen } from "./TvPalminoWheel";
import {
  PortraitAnswerPointsScreen,
  PortraitLeaderboardScreen,
  PortraitLobbyScreen,
  PortraitMessageScreen,
  PortraitQuestionScreen,
  PortraitRoundIntroScreen,
  PortraitSpecialEventScreen,
  PortraitVoteScreen,
} from "./PortraitScreens";

/**
 * Lo show in VERTICALE (telefono, 1080×1920): come TvStage ma con le schermate ricomposte in
 * colonna (anche la votazione delle materie, con le materie da toccare). I momenti rari che il gioco
 * libero non usa (Ruota impazzita, puntate, squadre) restano le schermate 16:9 del TV, centrate in
 * una fascia: si vedono comunque bene.
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
  // Ruota di Palmino: ricomposta in verticale (ruota grande, Palmino in basso a destra che la spinge)
  if (vp === "WHEEL_SPIN" && view.wheel?.kind === "palmino") {
    return <TvPalminoWheelScreen portrait wheel={view.wheel} round={view.round} now={now} live={live} reducedMotion={props.reducedMotion} lowPower={props.lowPower} onCelebrate={onCelebrate} />;
  }
  if (vp === "ROUND_INTRO" && view.round && view.round.kind !== "category_wheel") {
    return <PortraitRoundIntroScreen round={view.round} showLines={view.showLines} vote={view.vote} />;
  }
  // votazione delle materie: in verticale, con le materie da toccare per chi gioca da qui
  if ((vp === "CATEGORY_VOTING" || vp === "CATEGORY_RESULT") && view.vote) {
    return <PortraitVoteScreen vote={view.vote} round={view.round} phase={vp} remainingMs={vp === "CATEGORY_VOTING" && view.phase !== "PAUSED" ? remainingMs : 0} />;
  }
  if (vp === "SPECIAL_EVENT" && view.event) return <PortraitSpecialEventScreen event={view.event} />;
  if (view.question && vp === "QUESTION_VISIBLE" && props.questionIntro) return <QuestionIntroScreen portrait question={view.question} round={view.round} />;
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
        audioState={props.audioState}
      />
    );
  }
  if (vp === "SCORE_REVEAL" && !view.question?.bets?.locked) {
    const q = view.question;
    if (q && q.positionInRound < q.totalInRound) return <PortraitAnswerPointsScreen entries={view.leaderboard ?? []} who={q.presenter} questionId={q.id} showLines={view.showLines} />;
    // ultima domanda del round: la classifica DEL ROUND (punti fatti in questo round, totale in piccolo)
    if (view.roundLeaderboard) {
      const totals = new Map(view.roundLeaderboard.map((r) => [r.participantId, r.total]));
      return (
        <PortraitLeaderboardScreen
          entries={roundAsEntries(view.roundLeaderboard)}
          title={`CLASSIFICA DEL ROUND${view.round ? ` ${view.round.index}` : ""}`}
          showLines={view.showLines}
          value={(e) => (
            <span className="flex flex-col items-end leading-none">
              <span className="font-display text-[5cqw]">{e.points < 0 ? signedPoints(e.points) : formatPoints(e.points)}</span>
              {/* ultimo round: niente totali (subito dopo c'è il podio: il vincitore non si svela prima) */}
              {!(view.round && view.round.index >= view.round.total) && (
                <span className="mt-[0.6cqw] text-[3cqw] font-extrabold opacity-70">tot. {formatPoints(totals.get(e.participantId) ?? 0)}</span>
              )}
            </span>
          )}
        />
      );
    }
    return <PortraitLeaderboardScreen entries={view.leaderboard ?? []} title="CLASSIFICA DI FINE ROUND" showLines={view.showLines} />;
  }
  if (vp === "LEADERBOARD") {
    const rp = view.roundLeaderboard ? new Map(view.roundLeaderboard.map((r) => [r.participantId, r.points])) : null;
    return (
      <PortraitLeaderboardScreen
        entries={view.leaderboard ?? []}
        title="CLASSIFICA GENERALE"
        value={(e) => (
          <span className="flex flex-col items-end leading-none">
            <span className="font-display text-[5cqw]">{formatPoints(e.points)}</span>
            {rp && (rp.get(e.participantId) ?? 0) !== 0 && <span className="mt-[0.6cqw] text-[3cqw] font-extrabold opacity-75">{signedPoints(rp.get(e.participantId) ?? 0)} nel round</span>}
          </span>
        )}
      />
    );
  }
  if (vp === "FINISHED") return <TvPodiumScreen portrait entries={standingsForShow(view)} startedAt={view.phaseStartedAt} seed={view.sessionId} now={now} live={live} onCelebrate={onCelebrate} showLines={view.showLines} />;
  // votazione, ruota, puntate: la schermata del TV in una fascia
  return <Letterbox {...props} />;
}
