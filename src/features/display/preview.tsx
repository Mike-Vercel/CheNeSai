"use client";

import type { PublicQuestion } from "@/lib/game-engine/types";
import type { PreviewQuestion } from "@/features/game/preview-types";
import { TvQuestionScreen } from "./TvScreens";

export function previewToPublicQuestion(q: PreviewQuestion): PublicQuestion {
  const correct = q.options.filter((o) => o.isCorrect).map((o) => o.position);
  return {
    id: "preview",
    number: 1,
    totalInRound: 1,
    positionInRound: 1,
    type: q.type,
    text: q.text || "Testo della domanda",
    category: q.category || "Categoria",
    difficulty: q.difficulty,
    presenter: q.presenter,
    media: q.mediaKind ? { id: "preview", kind: q.mediaKind, audioStartMs: 0, audioDurationMs: null, audioPlays: 1 } : null,
    options: q.stage === "question" ? null : q.options.map((o) => ({ position: o.position, text: o.text || "…" })),
    rules: {
      correctPoints: 1000,
      wrongPenalty: 400,
      noAnswerPenalty: 0,
      bonusPoints: 0,
      durationSeconds: q.durationSeconds,
      partialScoring: false,
      speedBonusMax: 0,
      allowNegative: true,
      modifiers: [],
    },
    openedAt: null,
    closesAt: null,
    closedAt: null,
    correctPositions: q.stage === "reveal" ? correct : null,
    distribution: q.stage === "reveal" ? [12, 5, 3, 2] : null,
    answeredCount: q.stage === "options" ? 17 : null,
    animation: null,
  };
}

/** Anteprima fedele dello schermo TV (stesso componente usato in diretta), in un riquadro 16:9. */
export function TvQuestionPreview({ question }: { question: PreviewQuestion }) {
  const pq = previewToPublicQuestion(question);
  const phase = question.stage === "question" ? "QUESTION_VISIBLE" : question.stage === "options" ? "OPTIONS_VISIBLE" : "ANSWER_REVEAL";
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border-2 border-white/15 bg-night [container-type:size]">
      <TvQuestionScreen
        question={pq}
        round={question.roundTitle ? { id: "r", index: 1, total: 1, title: question.roundTitle, kind: "standard", presenter: question.presenter, description: null, pointsMultiplier: 1, penaltyMultiplier: 1, noPenalty: false } : null}
        phase={phase}
        remainingMs={question.durationSeconds * 1000 * 0.6}
        event={null}
        mediaUrl={question.mediaKind === "audio" ? null : (question.mediaUrl ?? null)}
        questionsPlayed={0}
        totalQuestions={10}
      />
    </div>
  );
}
