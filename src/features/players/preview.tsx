"use client";

import type { PreviewQuestion } from "@/features/game/preview-types";
import { previewToPublicQuestion } from "@/features/display/preview";
import { PhoneHeader, PhoneQuestionView } from "./PlayerScreens";

/** Anteprima fedele dello smartphone (stesso componente usato in diretta). */
export function PhoneQuestionPreview({ question }: { question: PreviewQuestion }) {
  const pq = previewToPublicQuestion(question);
  const phase = question.stage === "question" ? "QUESTION_VISIBLE" : question.stage === "options" ? "OPTIONS_VISIBLE" : "ANSWER_REVEAL";
  const correct = question.options.filter((o) => o.isCorrect).map((o) => o.position);
  const selected = question.stage === "reveal" ? correct.slice(0, 1) : question.stage === "options" ? [] : [];
  return (
    <div className="mx-auto w-[300px] rounded-[42px] border-[10px] border-[#0b0b10] bg-black shadow-2xl">
      <div className="qz-stage relative h-[600px] overflow-y-auto rounded-[32px]">
        <PhoneHeader nickname="MikeG" points={12400} rank={3} total={42} status="live" />
        <div className="flex flex-col px-3 pb-4 pt-3">
          <PhoneQuestionView
            question={pq}
            phase={phase}
            selected={selected}
            submitStatus="idle"
            submitError={null}
            remainingMs={question.durationSeconds * 1000 * 0.6}
            mediaUrl={question.mediaKind === "image" ? (question.mediaUrl ?? null) : null}
            event={null}
            result={question.stage === "reveal" ? { isCorrect: true, partial: false, delta: 1000 } : null}
            onToggle={() => {}}
            onConfirm={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
