"use client";

import { useMemo, useState, useEffect } from "react";
import type { GamePhase, LeaderboardEntry, PublicQuestion, PublicRound, PublicState } from "@/lib/game-engine/types";
import { TvStage } from "@/features/display/TvStage";
import { PortraitStage } from "@/features/display/PortraitStage";
import { CharacterModeProvider } from "@/features/three/characters/character-mode";
import { IntroSkipCounter } from "@/features/players/IntroSkip";

/**
 * Anteprima delle schermate dello spettacolo con uno stato finto (nessun database):
 * cartello "DOMANDA N. X" (normale, ultima del round, ultima della serata), domanda, classifica del
 * round, classifica generale e podio. ?screen=…&layout=portrait|landscape&chars=2d|3d&t=secondi (podio).
 */
export type PreviewScreen = "intro" | "intro-round" | "intro-last" | "question" | "options" | "round-lb" | "general-lb" | "podium" | "skip";

const NAMES = ["Vodka", "Mike", "Lalla", "Gigi", "Tano", "Rosy", "Anna", "Bruno"];

function round(index: number, total: number): PublicRound {
  return { id: `r${index}`, index, total, title: index === total ? "Gran finale" : "Cultura generale", kind: "standard", presenter: "professore", description: null, pointsMultiplier: 1, penaltyMultiplier: 1, noPenalty: false };
}

function question(pos: number, tot: number, phase: GamePhase): PublicQuestion {
  const opts = phase !== "QUESTION_VISIBLE";
  return {
    id: "preview-q",
    number: 12,
    totalInRound: tot,
    positionInRound: pos,
    type: "single",
    text: "Qual è il fiume più lungo d'Italia?",
    category: "Geografia",
    difficulty: 2,
    presenter: "regina",
    media: null,
    options: opts
      ? [
          { position: 0, text: "Po" },
          { position: 1, text: "Tevere" },
          { position: 2, text: "Adige" },
          { position: 3, text: "Arno" },
        ]
      : null,
    rules: { correctPoints: 1000, wrongPenalty: 400, noAnswerPenalty: 0, bonusPoints: 0, durationSeconds: 20, partialScoring: false, speedBonusMax: 0, allowNegative: true, modifiers: [] },
    openedAt: null,
    closesAt: null,
    closedAt: null,
    correctPositions: null,
    distribution: null,
    answeredCount: opts ? 3 : null,
    animation: null,
  };
}

const board = (): LeaderboardEntry[] =>
  NAMES.map((nickname, i) => ({ participantId: `p${i}`, rank: i + 1, previousRank: i === 1 ? 3 : null, nickname, points: 9000 - i * 900, lastDelta: i % 2 ? 0 : 1000, correctCount: 3 }));

function baseState(phase: GamePhase, extra: Partial<PublicState>): PublicState {
  return {
    sessionId: "preview",
    code: "ABC123",
    title: "Anteprima",
    isTest: true,
    phase,
    version: 1,
    serverNow: new Date().toISOString(),
    phaseStartedAt: new Date().toISOString(),
    joinLocked: false,
    allowLateJoin: true,
    playerCount: NAMES.length,
    questionsPlayed: 11,
    totalQuestions: 15,
    intro: null,
    round: round(2, 3),
    question: null,
    event: null,
    vote: null,
    wheel: null,
    leaderboard: null,
    teams: null,
    teamLeaderboard: null,
    pausedFrom: null,
    recentPlayers: null,
    showLines: null,
    ...extra,
  };
}

export function SpettacoloPreview({ screen, portrait, chars3d, podiumAt }: { screen: PreviewScreen; portrait: boolean; chars3d: boolean; podiumAt: number }) {
  const [startedAt] = useState(() => Date.now() - podiumAt * 1000);
  const state = useMemo<PublicState>(() => {
    switch (screen) {
      case "intro":
        return baseState("QUESTION_VISIBLE", { question: question(2, 5, "QUESTION_VISIBLE") });
      case "intro-round":
        return baseState("QUESTION_VISIBLE", { question: question(5, 5, "QUESTION_VISIBLE") });
      case "intro-last":
        return baseState("QUESTION_VISIBLE", { round: round(3, 3), question: question(5, 5, "QUESTION_VISIBLE") });
      case "question":
        return baseState("QUESTION_VISIBLE", { question: question(2, 5, "QUESTION_VISIBLE") });
      case "options":
        return baseState("OPTIONS_VISIBLE", { question: question(2, 5, "OPTIONS_VISIBLE") });
      case "round-lb": {
        const q = { ...question(5, 5, "OPTIONS_VISIBLE"), correctPositions: [0], distribution: [5, 2, 1, 0] };
        return baseState("SCORE_REVEAL", {
          question: q,
          leaderboard: board(),
          roundLeaderboard: NAMES.map((nickname, i) => ({ participantId: `p${i}`, rank: i + 1, nickname, points: 4200 - i * 650, total: 9000 - ((i * 1300) % 7000) })),
        });
      }
      case "general-lb":
        return baseState("LEADERBOARD", {
          leaderboard: board(),
          roundLeaderboard: NAMES.map((nickname, i) => ({ participantId: `p${i}`, rank: i + 1, nickname, points: 3000 - i * 500, total: 9000 - i * 900 })),
        });
      case "skip":
        return baseState("INTRO", { introSkip: { votes: 2, needed: 4, names: ["Vodka", "Lalla"] } });
      case "podium":
        return baseState("FINISHED", { leaderboard: board(), phaseStartedAt: new Date(startedAt).toISOString() });
    }
  }, [screen, startedAt]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const Stage = portrait ? PortraitStage : TvStage;
  const props = {
    state,
    remainingMs: 12_000,
    mediaUrl: () => null,
    qrDataUrl: null,
    joinUrl: "",
    intro: <div className="h-full w-full bg-black" />,
    now: Date.now,
    live: false,
    questionIntro: screen.startsWith("intro"),
  };
  return (
    <CharacterModeProvider prefer3d={chars3d} lowPower={false}>
      <div className="fixed inset-0 grid place-items-center bg-black">
        <div className={portrait ? "relative h-full max-h-[100vh] w-full max-w-[56.25vh] overflow-hidden bg-night [container-type:size]" : "relative aspect-video w-full max-w-[177.78vh] overflow-hidden bg-night [container-type:size]"} style={portrait ? { aspectRatio: "9 / 16" } : undefined}>
          {screen === "skip" ? <div className="absolute inset-0 bg-[#170824]" /> : <Stage {...props} />}
          {screen === "skip" && <IntroSkipCounter skip={state.introSkip} portrait={portrait} />}
        </div>
      </div>
    </CharacterModeProvider>
  );
}
