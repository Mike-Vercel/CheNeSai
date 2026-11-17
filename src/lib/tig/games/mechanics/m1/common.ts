import { z } from "zod";
import type { AcceptedSubmission, PhaseCtx, ScoreOutput } from "../../contract";
import { checkOptions, idSchema, type Option } from "../../components/choice";
import { noAnswer, rightWrong } from "../../components/scoring";
import { durationOf, firstPerTeam, scopeTeams } from "../../components/submissions";
import { demoPerTeam, demoSkill, pickAnswer } from "../../extras";

/**
 * Pezzi comuni alle meccaniche nuove della MANCHE 1 («CHI PARTE MALE...»): difficoltà della variante,
 * risposta a scelta singola con id stabile, punteggio giusto/sbagliato, invii finti.
 */

/** Difficoltà editoriale della variante: il motore la legge dal contenuto per distribuire facile/media/difficile. */
export const difficultySchema = z.enum(["facile", "media", "difficile"]).optional();

/** Invio di una scelta singola. */
export const optionSubmission = z.object({ optionId: idSchema });
export type OptionSubmission = z.infer<typeof optionSubmission>;

/** Soluzione di una scelta singola. */
export const optionSolution = z.object({ optionId: idSchema });

/** Controllo editoriale (superRefine): id e testi unici, soluzione tra le opzioni. */
export function checkSingle(options: readonly Option[], solutionId: string, ctx: z.RefinementCtx, path: (string | number)[] = ["options"]) {
  checkOptions(options, [solutionId], ctx, path);
}

/**
 * Punteggio standard «una risposta per tavolo»: 100 se giusta (+ bonus velocità max 20 se `speed`), 0 se
 * sbagliata, Energia Caos 1 + 1 per il centro. Vale il primo invio di ogni tavolo.
 */
export function scoreSingle(
  solutionId: string,
  ctx: PhaseCtx,
  submissions: readonly AcceptedSubmission<OptionSubmission>[],
  opts: { speed?: boolean; okLabel?: string; koLabel?: string } = {},
): ScoreOutput {
  const firsts = firstPerTeam(submissions, ctx);
  const windowMs = durationOf(ctx);
  return {
    outcomes: scopeTeams(ctx).map((t) => {
      const s = firsts.get(t.teamId);
      if (!s) return noAnswer(t.teamId);
      return rightWrong(t.teamId, s.payload.optionId === solutionId, { speed: opts.speed, elapsedMs: s.elapsedMs, windowMs, okLabel: opts.speed ? undefined : opts.okLabel, koLabel: opts.koLabel });
    }),
  };
}

/** Invii finti: tavolo forte, medio, poi a caso (con un tavolo che a volte non risponde). */
export function demoSingle(ctx: PhaseCtx, seed: string, solutionId: string, ids: readonly string[], opts: { minMs?: number; maxMs?: number } = {}): AcceptedSubmission<OptionSubmission>[] {
  return demoPerTeam(ctx, seed, (i, rnd) => (i >= 4 && rnd() < 0.15 ? null : { optionId: pickAnswer(rnd, solutionId, ids, demoSkill(i)) }), opts);
}
