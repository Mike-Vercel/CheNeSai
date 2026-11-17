import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema, sameSet } from "../components/choice";
import { noAnswer, rightWrong } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 54 · LA CONTRADDIZIONE (manche 4) — quattro messaggi dello stesso personaggio inventato: due non possono
 * essere veri insieme. Si seleziona la COPPIA incoerente (6 coppie possibili, una sola giusta).
 */

const MESSAGES = 4;

export const contraddizioneContent = z
  .object({
    id: variantId,
    /** chi scrive, es. «Dario, il coinquilino» (personaggio inventato) */
    character: text(40),
    /** dove scrive, es. «nel gruppo della casa» */
    context: text(100),
    messages: z.array(z.object({ id: idSchema, time: z.string().regex(/^\d{2}:\d{2}$/), text: text(170) })).length(MESSAGES),
    solution: z.object({ pair: z.tuple([idSchema, idSchema]) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const ids = c.messages.map((m) => m.id);
    if (new Set(ids).size !== MESSAGES) ctx.addIssue({ code: "custom", message: "id duplicati" });
    const [a, b] = c.solution.pair;
    if (a === b || !ids.includes(a) || !ids.includes(b)) ctx.addIssue({ code: "custom", message: "coppia non valida" });
  });
export type ContraddizioneContent = z.infer<typeof contraddizioneContent>;
export type ContraddizioneInput = z.input<typeof contraddizioneContent>;

export const contraddizioneSubmission = z.object({ pair: z.tuple([idSchema, idSchema]) });
export type ContraddizioneSubmission = z.infer<typeof contraddizioneSubmission>;

export interface ContraddizioneView extends BaseView {
  character: string;
  context: string;
  /** in ordine di orario, come in una chat */
  messages: { id: string; time: string; text: string }[];
}

export interface ContraddizioneReveal {
  character: string;
  messages: { id: string; time: string; text: string }[];
  pair: [string, string];
  explain: string;
}

const def: MechanicDef<ContraddizioneContent, ContraddizioneSubmission> = {
  code: "la-contraddizione",
  number: 54,
  manche: 4,
  title: "La contraddizione",
  input: "team",
  timerSec: 50,
  oneDeviceOk: true,
  needs: [],
  rule: "Quattro messaggi della stessa persona: due non possono essere veri insieme. Selezionate la coppia che non torna.",
  contentSchema: contraddizioneContent,
  submissionSchema: contraddizioneSubmission,
  publicView: (c, ctx): ContraddizioneView => ({
    ...baseView(def, ctx),
    character: c.character,
    context: c.context,
    messages: c.messages.map((m) => ({ id: m.id, time: m.time, text: m.text })),
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx, (s) => s.payload.pair[0] !== s.payload.pair[1]);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, sameSet(s.payload.pair, content.solution.pair), { okLabel: "Contraddizione trovata", koLabel: "Coppia sbagliata" });
      }),
    };
  },
  reveal: (c): ContraddizioneReveal => ({ character: c.character, messages: c.messages, pair: c.solution.pair, explain: c.explain }),
};

export const laContraddizione: MechanicModule<ContraddizioneContent, ContraddizioneSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        if (rnd() < demoSkill(i)) return { pair: [c.solution.pair[1], c.solution.pair[0]] as [string, string] };
        const ids = c.messages.map((m) => m.id);
        const other = ids.find((id) => !c.solution.pair.includes(id))!;
        return { pair: [c.solution.pair[0], other] as [string, string] };
      }),
  },
};
