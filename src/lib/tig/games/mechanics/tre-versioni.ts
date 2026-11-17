import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema } from "../components/choice";
import { seededShuffle } from "../components/rng";
import { noAnswer, rightWrong } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 51 · TRE VERSIONI (manche 4) — tre testimoni inventati raccontano la stessa serata; i FATTI NOTI sono
 * certi. Una sola versione li rispetta tutti: le altre ne violano almeno uno (spiegato al reveal).
 */

const versionSchema = z.object({ id: idSchema, who: text(30), text: text(260) });

export const treVersioniContent = z
  .object({
    id: variantId,
    /** l'evento, es. «Chi ha prenotato il tavolo sbagliato?» */
    event: text(80),
    facts: z.array(text(140)).min(3).max(4),
    versions: z.array(versionSchema).length(3),
    solution: z.object({
      versionId: idSchema,
      /** per ogni versione sbagliata: quale fatto viola e perché */
      why: z.record(z.string(), text(220)),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const ids = c.versions.map((v) => v.id);
    if (new Set(ids).size !== 3) ctx.addIssue({ code: "custom", message: "id duplicati" });
    if (!ids.includes(c.solution.versionId)) ctx.addIssue({ code: "custom", message: "soluzione inesistente" });
    for (const id of ids) if (id !== c.solution.versionId && !c.solution.why[id]) ctx.addIssue({ code: "custom", message: `manca il perché di ${id}` });
  });
export type TreVersioniContent = z.infer<typeof treVersioniContent>;
export type TreVersioniInput = z.input<typeof treVersioniContent>;

export const treVersioniSubmission = z.object({ versionId: idSchema });
export type TreVersioniSubmission = z.infer<typeof treVersioniSubmission>;

export interface TreVersioniView extends BaseView {
  event: string;
  facts: string[];
  versions: { id: string; who: string; text: string }[];
}

export interface TreVersioniReveal {
  event: string;
  facts: string[];
  versions: { id: string; who: string; text: string; ok: boolean; note: string | null }[];
  explain: string;
}

const def: MechanicDef<TreVersioniContent, TreVersioniSubmission> = {
  code: "tre-versioni",
  number: 51,
  manche: 4,
  title: "Tre versioni",
  input: "team",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Tre testimoni, tre racconti della stessa serata. I fatti noti sono certi: solo una versione li rispetta tutti.",
  contentSchema: treVersioniContent,
  submissionSchema: treVersioniSubmission,
  publicView: (c, ctx): TreVersioniView => ({
    ...baseView(def, ctx),
    event: c.event,
    facts: c.facts,
    versions: seededShuffle(c.versions, `${ctx.seed}:versioni`).map((v) => ({ id: v.id, who: v.who, text: v.text })),
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.versionId === content.solution.versionId, { okLabel: "Versione giusta", koLabel: "Versione sbagliata" });
      }),
    };
  },
  reveal: (c): TreVersioniReveal => ({
    event: c.event,
    facts: c.facts,
    versions: c.versions.map((v) => ({ ...v, ok: v.id === c.solution.versionId, note: c.solution.why[v.id] ?? null })),
    explain: c.explain,
  }),
};

export const treVersioni: MechanicModule<TreVersioniContent, TreVersioniSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({ versionId: pickAnswer(rnd, c.solution.versionId, c.versions.map((v) => v.id), demoSkill(i)) })),
  },
};
