import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { POINTS, CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema, resolveTarget, tableRefs, type TableRef } from "./m2/shared";

/**
 * 22 · FURTO CON DESTREZZA (manche 2) — ogni tavolo sceglie una vittima e affronta un colpo in DUE indizi
 * concatenati (il secondo si risolve solo col risultato del primo). Entrambi giusti entro il timer: furto di 40
 * punti alla vittima (trasferimento: il runtime applica scudo, tetto 80 per manche e anti-accanimento).
 * Un solo colpo per tavolo a prova («una sola volta per round»). Nessun punto proprio: il bottino è il furto.
 * Nel duello del Caos (trasferimenti esclusi) vince chi completa il colpo, a pari merito il più rapido.
 */

export const STEAL = POINTS.transferMax;

const stepSchema = z.object({ clue: text(220), options: optionsSchema(4, 4) });

export const furtoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** il «colpo»: nome breve e situazione */
    caper: text(50),
    scene: text(200),
    steps: z.array(stepSchema).length(2),
    solution: z.object({ first: idSchema, second: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.steps[0].options, [c.solution.first], ctx, ["steps", 0]);
    checkOptions(c.steps[1].options, [c.solution.second], ctx, ["steps", 1]);
  });
export type FurtoContent = z.infer<typeof furtoContent>;
export type FurtoInput = z.input<typeof furtoContent>;

export const furtoSubmission = z.object({ targetId: z.string().min(1).max(64), first: idSchema, second: idSchema });
export type FurtoSubmission = z.infer<typeof furtoSubmission>;

export interface FurtoView extends BaseView {
  caper: string;
  scene: string;
  steps: { clue: string; options: Option[] }[];
  targets: TableRef[];
  steal: number;
}

export interface FurtoHeist {
  from: string;
  to: string;
  first: boolean;
  second: boolean;
}

export interface FurtoSummary {
  heists: FurtoHeist[];
}

export interface FurtoReveal {
  caper: string;
  scene: string;
  steps: { clue: string; options: Option[]; solutionId: string }[];
  explain: string;
  summary: FurtoSummary | null;
}

const def: MechanicDef<FurtoContent, FurtoSubmission> = {
  code: "furto-con-destrezza",
  number: 22,
  manche: 2,
  title: "Furto con destrezza",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Scegliete la vittima e risolvete i due indizi del colpo, uno dopo l'altro. Tutti e due giusti: rubate 40 punti.",
  contentSchema: furtoContent,
  submissionSchema: furtoSubmission,
  publicView: (c, ctx): FurtoView => ({
    ...baseView(def, ctx),
    caper: c.caper,
    scene: c.scene,
    steps: c.steps.map((s, i) => ({ clue: s.clue, options: publicOptions(s.options, `${ctx.seed}:indizio-${i}`) })),
    targets: tableRefs(ctx),
    steal: STEAL,
  }),
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const heists: FurtoHeist[] = [];
    const out: ScoreWithSummary<FurtoSummary> = {
      outcomes: teams.map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const a = s.payload.first === content.solution.first;
        const b = a && s.payload.second === content.solution.second;
        const to = resolveTarget(teams, t.teamId, s.payload.targetId);
        if (to) heists.push({ from: t.teamId, to, first: a, second: b });
        const victim = teams.find((x) => x.teamId === to);
        return outcome(t.teamId, {
          points: 0,
          chaos: CHAOS.partecipa + (to ? CHAOS.sfida : 0) + (b ? CHAOS.centro : 0),
          correct: b,
          accuracy: (a ? 0.5 : 0) + (b ? 0.5 : 0),
          label: b ? (victim ? `Colpo riuscito ai danni del tavolo ${victim.tableNo}` : "Colpo riuscito, ma senza vittima") : a ? "Mezzo colpo: secondo indizio sbagliato" : "Colpo fallito al primo indizio",
          transfers: b && to ? [{ toTeamId: to, points: STEAL, reason: "Furto con destrezza" }] : undefined,
        });
      }),
      summary: { heists: heists.sort((x, y) => (x.from < y.from ? -1 : 1)) },
    };
    return out;
  },
  reveal: (c, out): FurtoReveal => ({
    caper: c.caper,
    scene: c.scene,
    steps: [
      { clue: c.steps[0].clue, options: c.steps[0].options, solutionId: c.solution.first },
      { clue: c.steps[1].clue, options: c.steps[1].options, solutionId: c.solution.second },
    ],
    explain: c.explain,
    summary: (out as ScoreWithSummary<FurtoSummary>).summary ?? null,
  }),
};

export const furtoConDestrezza: MechanicModule<FurtoContent, FurtoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const teams = scopeTeams(ctx);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const others = teams.filter((_, j) => j !== i);
        if (!others.length) return null;
        return {
          targetId: others[Math.floor(rnd() * others.length)].teamId,
          first: pickAnswer(rnd, c.solution.first, c.steps[0].options.map((o) => o.id), demoSkill(i) + 0.1),
          second: pickAnswer(rnd, c.solution.second, c.steps[1].options.map((o) => o.id), demoSkill(i)),
        };
      });
    },
  },
};
