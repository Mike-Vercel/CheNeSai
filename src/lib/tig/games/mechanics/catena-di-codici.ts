import { z } from "zod";
import type { MechanicDef } from "../contract";
import { fragmentsFor, matchingPositions } from "../components/coop";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 42 · CATENA DI CODICI (manche 3) — un codice di 6 cifre; ogni cifra è la soluzione di un mini-indizio.
 * Gli indizi si dividono a turno tra i telefoni ATTIVI del tavolo (con un telefono solo arrivano tutti a
 * lui): bisogna parlarsi e rimettere le cifre in ordine. Codice esatto 100; altrimenti 15 per cifra al
 * posto giusto (massimo 75). I punti dipendono solo dal codice inviato, mai da quanti siete.
 */

export const CODE_LENGTH = 6;
export const PARTIAL_PER_DIGIT = 15;
export const PARTIAL_MAX = 75;

export const catenaContent = z
  .object({
    id: variantId,
    /** cosa apre il codice, es. «La cassetta delle chiavi del B&B» */
    title: text(60),
    /** un indizio per posizione: ognuno porta a UNA cifra */
    clues: z.array(text(140)).length(CODE_LENGTH),
    solution: z.object({
      code: z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`)),
      /** perché ogni cifra (mostrato al reveal) */
      steps: z.array(text(120)).length(CODE_LENGTH),
    }),
    explain: explainSchema,
  });
export type CatenaContent = z.infer<typeof catenaContent>;
export type CatenaInput = z.input<typeof catenaContent>;

export const catenaSubmission = z.object({ digits: z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`)) });
export type CatenaSubmission = z.infer<typeof catenaSubmission>;

export interface CatenaView extends BaseView {
  /** cosa apre il codice (il titolo della meccanica resta `title`) */
  lockName: string;
  length: number;
}

export interface CatenaMemberView {
  /** frammenti di questo telefono: posizione (0-based) e indizio */
  fragments: { pos: number; clue: string }[];
  /** telefoni attivi del tavolo (per la UI: «siete in 3, avete 2 indizi a testa») */
  phones: number;
}

export interface CatenaReveal {
  lockName: string;
  digits: string;
  clues: string[];
  steps: string[];
  explain: string;
}

export function catenaPoints(submitted: string, solution: string): { points: number; matching: number } {
  const matching = matchingPositions(submitted, solution);
  if (matching === solution.length) return { points: POINTS.standard, matching };
  return { points: Math.min(PARTIAL_MAX, matching * PARTIAL_PER_DIGIT), matching };
}

const def: MechanicDef<CatenaContent, CatenaSubmission> = {
  code: "catena-di-codici",
  number: 42,
  manche: 3,
  title: "Catena di codici",
  input: "coop",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Ognuno ha sul telefono alcuni indizi: ogni indizio è una cifra. Mettete insieme il codice di 6 cifre. Esatto: 100.",
  contentSchema: catenaContent,
  submissionSchema: catenaSubmission,
  publicView: (c, ctx): CatenaView => ({ ...baseView(def, ctx), lockName: c.title, length: CODE_LENGTH }),
  memberView: (c, ctx): CatenaMemberView => {
    const team = ctx.teams.find((t) => t.teamId === ctx.teamId);
    const phones = Math.max(1, team?.members.length ?? 1);
    return { fragments: fragmentsFor(ctx.memberIndex, phones, CODE_LENGTH).map((pos) => ({ pos, clue: c.clues[pos] })), phones };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const { points, matching } = catenaPoints(s.payload.digits, content.solution.code);
        const full = matching === CODE_LENGTH;
        return outcome(t.teamId, {
          points,
          chaos: CHAOS.partecipa + (full ? CHAOS.centro : 0),
          correct: full,
          accuracy: matching / CODE_LENGTH,
          label: full ? "Codice esatto" : `${matching} cifre al posto giusto`,
        });
      }),
    };
  },
  reveal: (c): CatenaReveal => ({ lockName: c.title, digits: c.solution.code, clues: c.clues, steps: c.solution.steps, explain: c.explain }),
};

export const catenaDiCodici: MechanicModule<CatenaContent, CatenaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        if (rnd() < demoSkill(i)) return { digits: c.solution.code };
        const d = c.solution.code.split("");
        [d[1], d[4]] = [d[4], d[1]];
        return { digits: d.join("") };
      }),
  },
};
