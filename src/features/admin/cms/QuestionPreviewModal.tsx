"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { TvQuestionPreview } from "@/features/display/preview";
import type { PreviewQuestion } from "@/features/game/preview-types";
import { PhoneQuestionPreview } from "@/features/players/preview";
import { Segmented } from "./common";

export type PreviewBase = Omit<PreviewQuestion, "stage">;
type Stage = PreviewQuestion["stage"];

const STAGES: { value: Stage; label: string }[] = [
  { value: "question", label: "1 · Domanda" },
  { value: "options", label: "2 · Risposte" },
  { value: "reveal", label: "3 · Soluzione" },
];

/** Anteprima affiancata schermo TV + smartphone, con le tre fasi della domanda. */
export function QuestionPreview({ question }: { question: PreviewBase }) {
  const [stage, setStage] = useState<Stage>("options");
  const q: PreviewQuestion = { ...question, stage };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="Fase da mostrare" value={stage} onChange={setStage} options={STAGES} />
        <p className="text-xs text-white/50">I colori A/B/C/D indicano solo la posizione, non la soluzione.</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <figure className="min-w-0">
          <figcaption className="mb-1 text-xs font-bold uppercase tracking-wider text-white/50">Schermo TV</figcaption>
          <TvQuestionPreview question={q} />
        </figure>
        <figure className="min-w-0">
          <figcaption className="mb-1 text-center text-xs font-bold uppercase tracking-wider text-white/50">Smartphone giocatore</figcaption>
          <PhoneQuestionPreview question={q} />
        </figure>
      </div>
    </div>
  );
}

export function QuestionPreviewModal({ question, onClose }: { question: PreviewBase | null; onClose: () => void }) {
  return (
    <Modal
      open={!!question}
      onClose={onClose}
      title="Anteprima domanda"
      wide
      footer={
        <Button variant="ghost" onClick={onClose}>
          Chiudi
        </Button>
      }
    >
      {question && <QuestionPreview question={question} />}
    </Modal>
  );
}
