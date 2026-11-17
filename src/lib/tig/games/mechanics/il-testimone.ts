import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { fragmentsFor } from "../components/coop";
import { seededShuffle } from "../components/rng";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { difficultySchema, TELLTALE_ID } from "./_m4";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 50 · IL TESTIMONE (manche 4) — cooperazione. Un caso inventato con fatti pubblici e tre testimonianze
 * PRIVATE, divise tra i telefoni del tavolo (con un telefono solo arrivano tutte a lui; con più telefoni
 * ognuno ne ha una parte). Una sola testimonianza è vera: le altre due, di testimoni inventati e poco
 * affidabili, contraddicono un fatto pubblico. Il gruppo deve capire di quale testimone fidarsi e usarlo
 * per rispondere, oppure rischiare. Risposta giusta 80, testimone giusto +20. Nessun giocatore deve mai
 * mentire: legge solo ciò che il gioco gli mostra. Vale il primo invio del tavolo.
 */

export const TESTIMONE_PAYOFF = { risposta: 80, testimone: 20 } as const;
export const WITNESSES = 3;

const witnessSchema = z.object({
  id: idSchema,
  /** chi parla (personaggio inventato), es. «La portinaia» */
  source: text(40),
  text: text(200),
});

export const testimoneContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    caseTitle: text(70),
    question: text(110),
    facts: z.array(text(180)).min(2).max(3),
    options: optionsSchema(4, 4),
    witnesses: z.array(witnessSchema).length(WITNESSES),
    solution: z.object({
      optionId: idSchema,
      witnessId: idSchema,
      /** per ogni testimonianza: perché è vera o quale fatto contraddice */
      notes: z.record(z.string(), text(220)),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.options, [c.solution.optionId], ctx, ["options"]);
    const ids = c.witnesses.map((w) => w.id);
    if (new Set(ids).size !== WITNESSES) ctx.addIssue({ code: "custom", message: "id dei testimoni duplicati" });
    if (!ids.includes(c.solution.witnessId)) ctx.addIssue({ code: "custom", message: "testimone vero inesistente" });
    for (const id of ids) {
      if (TELLTALE_ID.test(id)) ctx.addIssue({ code: "custom", message: `id «${id}» rivela la soluzione` });
      if (!c.solution.notes[id]) ctx.addIssue({ code: "custom", message: `manca la nota di ${id}` });
    }
  });
export type TestimoneContent = z.infer<typeof testimoneContent>;
export type TestimoneInput = z.input<typeof testimoneContent>;

export const testimoneSubmission = z.object({ witnessId: idSchema, optionId: idSchema });
export type TestimoneSubmission = z.infer<typeof testimoneSubmission>;

export interface TestimoneView extends BaseView {
  caseTitle: string;
  question: string;
  facts: string[];
  options: Option[];
  /** chi ha testimoniato (il testo arriva solo ai telefoni) */
  sources: { id: string; source: string }[];
  payoff: typeof TESTIMONE_PAYOFF;
}

export interface TestimoneMemberView {
  /** testimonianze su questo telefono */
  mine: { id: string; source: string; text: string }[];
  /** telefoni attivi del tavolo */
  phones: number;
}

export interface TestimoneReveal {
  caseTitle: string;
  witnesses: { id: string; source: string; text: string; reliable: boolean; note: string }[];
  options: Option[];
  solutionId: string;
  explain: string;
}

function order(c: TestimoneContent, seed: string) {
  return seededShuffle(c.witnesses, `${seed}:testimoni`);
}

const def: MechanicDef<TestimoneContent, TestimoneSubmission> = {
  code: "il-testimone",
  number: 50,
  manche: 4,
  title: "Il testimone",
  input: "coop",
  timerSec: 65,
  oneDeviceOk: true,
  needs: [],
  rule: "Le testimonianze sono divise tra i vostri telefoni: una sola è vera. Fidatevi del testimone giusto e rispondete (80 + 20).",
  contentSchema: testimoneContent,
  submissionSchema: testimoneSubmission,
  publicView: (c, ctx): TestimoneView => ({
    ...baseView(def, ctx),
    caseTitle: c.caseTitle,
    question: c.question,
    facts: c.facts,
    options: publicOptions(c.options, `${ctx.seed}:opzioni`),
    sources: order(c, ctx.seed).map((w) => ({ id: w.id, source: w.source })),
    payoff: TESTIMONE_PAYOFF,
  }),
  memberView: (c, ctx): TestimoneMemberView => {
    const team = ctx.teams.find((t) => t.teamId === ctx.teamId);
    const phones = Math.max(1, team?.members.length ?? 1);
    const ws = order(c, ctx.seed);
    return { mine: fragmentsFor(ctx.memberIndex, phones, WITNESSES).map((i) => ({ id: ws[i].id, source: ws[i].source, text: ws[i].text })), phones };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const ans = s.payload.optionId === content.solution.optionId;
        const wit = s.payload.witnessId === content.solution.witnessId;
        const pts = (ans ? TESTIMONE_PAYOFF.risposta : 0) + (wit ? TESTIMONE_PAYOFF.testimone : 0);
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (ans && wit ? CHAOS.centro : 0),
          correct: ans && wit,
          accuracy: pts / 100,
          label: ans ? (wit ? "Testimone giusto, caso risolto" : "Risposta giusta, testimone sbagliato") : wit ? "Testimone giusto, risposta sbagliata" : "Testimone e risposta sbagliati",
        });
      }),
    };
  },
  reveal: (c): TestimoneReveal => ({
    caseTitle: c.caseTitle,
    witnesses: c.witnesses.map((w) => ({ id: w.id, source: w.source, text: w.text, reliable: w.id === c.solution.witnessId, note: c.solution.notes[w.id] ?? "" })),
    options: c.options,
    solutionId: c.solution.optionId,
    explain: c.explain,
  }),
};

export const ilTestimone: MechanicModule<TestimoneContent, TestimoneSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const wit = pickAnswer(rnd, c.solution.witnessId, c.witnesses.map((w) => w.id), demoSkill(i));
        return { witnessId: wit, optionId: wit === c.solution.witnessId ? c.solution.optionId : pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), 0.3) };
      }),
  },
};
