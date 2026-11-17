import { z } from "zod";
import type { MechanicDef } from "../contract";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 19 · SCUDO RAPIDO (manche 2) — un micro-enigma con un codice di 3–4 cifre: chi lo apre attiva uno
 * SCUDO contro il prossimo attacco valido. Nessun punto: l'effetto è lo scudo (`correct: true`), che il
 * runtime applica — non cumulabile, scade a fine manche (PDF n. 19).
 */

export const scudoContent = z
  .object({
    id: variantId,
    /** l'enigma: situazione di vita adulta con regole che portano a un solo codice */
    prompt: text(300),
    solution: z.object({ code: z.string().regex(/^\d{3,4}$/) }),
    explain: explainSchema,
  });
export type ScudoContent = z.infer<typeof scudoContent>;
export type ScudoInput = z.input<typeof scudoContent>;

export const scudoSubmission = z.object({ digits: z.string().regex(/^\d{3,4}$/) });
export type ScudoSubmission = z.infer<typeof scudoSubmission>;

export interface ScudoView extends BaseView {
  prompt: string;
  /** quante cifre ha il codice */
  length: number;
}

export interface ScudoReveal {
  prompt: string;
  digits: string;
  explain: string;
}

const def: MechanicDef<ScudoContent, ScudoSubmission> = {
  code: "scudo-rapido",
  number: 19,
  manche: 2,
  title: "Scudo rapido",
  input: "team",
  timerSec: 45,
  oneDeviceOk: true,
  needs: [],
  rule: "Aprite il lucchetto con il codice giusto e il prossimo attacco contro di voi rimbalza. Lo scudo dura fino a fine manche.",
  contentSchema: scudoContent,
  submissionSchema: scudoSubmission,
  publicView: (c, ctx): ScudoView => ({ ...baseView(def, ctx), prompt: c.prompt, length: c.solution.code.length }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId, "Niente scudo");
        const ok = s.payload.digits === content.solution.code;
        return outcome(t.teamId, {
          points: 0,
          chaos: CHAOS.partecipa + (ok ? CHAOS.centro : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: ok ? "SCUDO ATTIVO" : "Codice sbagliato: niente scudo",
        });
      }),
    };
  },
  reveal: (c): ScudoReveal => ({ prompt: c.prompt, digits: c.solution.code, explain: c.explain }),
};

export const scudoRapido: MechanicModule<ScudoContent, ScudoSubmission> = {
  def,
  extras: {
    effect: { kind: "scudo", when: "correct", note: "Scudo al tavolo con correct=true: non cumulabile, scade a fine manche." },
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        if (rnd() < demoSkill(i)) return { digits: c.solution.code };
        const d = c.solution.code.split("");
        d[d.length - 1] = String((Number(d[d.length - 1]) + 1) % 10);
        return { digits: d.join("") };
      }),
  },
};
