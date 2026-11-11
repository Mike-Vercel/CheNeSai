import type { MediaKind, Presenter, QuestionType } from "@/lib/game-engine/types";

/** Dati minimi per mostrare l'anteprima di una domanda (CMS e regia). */
export interface PreviewQuestion {
  type: QuestionType;
  text: string;
  category: string;
  difficulty: number;
  presenter: Presenter;
  options: { position: number; text: string; isCorrect: boolean }[];
  durationSeconds: number;
  /** URL già firmato/accessibile per l'anteprima (facoltativo). */
  mediaUrl?: string | null;
  mediaKind?: MediaKind | null;
  roundTitle?: string;
  /** "question" = solo domanda, "options" = risposte aperte, "reveal" = soluzione. */
  stage: "question" | "options" | "reveal";
}
