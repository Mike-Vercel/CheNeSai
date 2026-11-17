import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { checkQuestion, difficultySchema, publicQuestion, questionSchema, type Question } from "./m2/shared";

/**
 * 25 · SCEGLI IL TERRENO (manche 2) — due turni nella stessa prova, tre categorie di pari difficoltà:
 *   1° turno: si sceglie tra le categorie A e B (solo dal nome) e si risponde alla domanda di quella scelta;
 *   2° turno: si sceglie tra le due categorie RIMASTE — quella appena giocata è bloccata («mai la stessa due volte
 *   di fila») — e si risponde.
 * Ogni risposta giusta vale +50 (massimo +100): le categorie hanno punti equivalenti, conta scegliere bene il terreno.
 */

export const TERRENI = 3;
export const PER_TURNO = 50;

const terrenoSchema = questionSchema(4, 4).extend({ name: text(30) });
export type Terreno = Question & { name: string };

export const terrenoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** A e B al primo turno, C entra al secondo */
    terreni: z.array(terrenoSchema).length(TERRENI),
    solution: z.object({ terreni: z.array(idSchema).length(TERRENI) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    c.terreni.forEach((t, i) => checkQuestion(t, c.solution.terreni[i], ctx, ["terreni", i]));
    if (new Set(c.terreni.map((t) => t.name.toLowerCase())).size !== TERRENI) ctx.addIssue({ code: "custom", message: "nomi delle categorie duplicati", path: ["terreni"] });
  });
export type TerrenoContent = z.infer<typeof terrenoContent>;
export type TerrenoInput = z.input<typeof terrenoContent>;

export const terrenoSubmission = z.object({
  first: z.number().int().min(0).max(1),
  firstAnswer: idSchema,
  second: z.number().int().min(0).max(TERRENI - 1),
  secondAnswer: idSchema,
});
export type TerrenoSubmission = z.infer<typeof terrenoSubmission>;

export interface TerrenoView extends BaseView {
  terreni: Terreno[];
  perTurno: number;
}

export interface TerrenoSummary {
  /** quanti tavoli hanno scelto ogni categoria, per turno */
  picks: { first: number[]; second: number[] };
}

export interface TerrenoReveal {
  terreni: (Terreno & { solutionId: string })[];
  explain: string;
  summary: TerrenoSummary | null;
}

/** Categorie ammesse al secondo turno dopo aver giocato `first` al primo. */
export function secondOptions(first: number): number[] {
  return [0, 1, 2].filter((i) => i !== first);
}

const def: MechanicDef<TerrenoContent, TerrenoSubmission> = {
  code: "scegli-il-terreno",
  number: 25,
  manche: 2,
  title: "Scegli il terreno",
  input: "team",
  timerSec: 50,
  oneDeviceOk: true,
  needs: [],
  rule: "Due turni: scegliete la categoria e rispondete, +50 a risposta. Al secondo turno quella appena giocata è bloccata.",
  contentSchema: terrenoContent,
  submissionSchema: terrenoSubmission,
  publicView: (c, ctx): TerrenoView => ({
    ...baseView(def, ctx),
    terreni: c.terreni.map((t, i) => ({ name: t.name, ...publicQuestion(t, `${ctx.seed}:terreno-${i}`) })),
    perTurno: PER_TURNO,
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const picks = { first: [0, 0, 0], second: [0, 0, 0] };
    const out: ScoreWithSummary<TerrenoSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const { first, second } = s.payload;
        const legalSecond = secondOptions(first).includes(second);
        picks.first[first]++;
        if (legalSecond) picks.second[second]++;
        const ok1 = s.payload.firstAnswer === content.solution.terreni[first];
        const ok2 = legalSecond && s.payload.secondAnswer === content.solution.terreni[second];
        const n = (ok1 ? 1 : 0) + (ok2 ? 1 : 0);
        return outcome(t.teamId, {
          points: n * PER_TURNO,
          chaos: CHAOS.partecipa + (n === 2 ? CHAOS.centro : 0),
          correct: n === 2,
          accuracy: n / 2,
          label: `${content.terreni[first].name} ${ok1 ? "giusta" : "sbagliata"} · ${legalSecond ? `${content.terreni[second].name} ${ok2 ? "giusta" : "sbagliata"}` : "secondo turno non valido"}`,
        });
      }),
      summary: { picks },
    };
    return out;
  },
  reveal: (c, out): TerrenoReveal => ({
    terreni: c.terreni.map((t, i) => ({ ...t, solutionId: c.solution.terreni[i] })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<TerrenoSummary>).summary ?? null,
  }),
};

export const scegliIlTerreno: MechanicModule<TerrenoContent, TerrenoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const first = rnd() < 0.5 ? 0 : 1;
        const opts = secondOptions(first);
        const second = opts[Math.floor(rnd() * opts.length)];
        return {
          first,
          firstAnswer: pickAnswer(rnd, c.solution.terreni[first], c.terreni[first].options.map((o) => o.id), demoSkill(i) + 0.1),
          second,
          secondAnswer: pickAnswer(rnd, c.solution.terreni[second], c.terreni[second].options.map((o) => o.id), demoSkill(i)),
        };
      }),
  },
};
