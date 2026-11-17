import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m5-shared";

/**
 * 78 · LA PENULTIMA MOSSA (manche 5) — ogni tavolo ha UNA difesa. Versione autocontenuta (il motore non porta
 * poteri da una prova all'altra): la prova ha due colpi, la PENULTIMA (subito) e l'ULTIMA (dai 20 secondi,
 * con `publicViewAt` la domanda non parte prima). Ogni colpo: giusta +60, sbagliata −30… a meno che lì ci sia
 * la difesa (sbagliata = 0). La difesa si gioca sulla penultima, senza sapere cosa sarà l'ultima, oppure si
 * conserva per l'ultima: la scelta è irrevocabile quando si apre l'ultima ed è mostrata a tutti al reveal.
 */

export const ROUND2_AT_MS = 20000;
export const RIGHT_POINTS = 60;
export const WRONG_POINTS = -30;

const roundSchema = z.object({ id: idSchema, prompt: text(190), options: optionsSchema(3, 4) });

export const penultimaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    title: text(60),
    rounds: z.array(roundSchema).length(2),
    solution: z.object({ answers: z.record(z.string(), idSchema) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (c.rounds[0].id === c.rounds[1].id) ctx.addIssue({ code: "custom", message: "id dei colpi uguali" });
    c.rounds.forEach((r, i) => {
      const sol = c.solution.answers[r.id];
      if (!sol) ctx.addIssue({ code: "custom", message: `manca la soluzione di ${r.id}` });
      else checkOptions(r.options, [sol], ctx, ["rounds", i]);
    });
  });
export type PenultimaContent = z.infer<typeof penultimaContent>;
export type PenultimaInput = z.input<typeof penultimaContent>;

export const penultimaSubmission = z.object({
  /** dove si gioca la difesa: «penultima» o «ultima» */
  shield: z.enum(["penultima", "ultima"]),
  answers: z.record(z.string(), idSchema),
});
export type PenultimaSubmission = z.infer<typeof penultimaSubmission>;
export type ShieldSpot = PenultimaSubmission["shield"];

export interface PenultimaView extends BaseView {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  round2AtMs: number;
  rounds: { id: string; spot: ShieldSpot; prompt: string | null; options: Option[] | null }[];
  rightPoints: number;
  wrongPoints: number;
}

export interface PenultimaSummary {
  shields: { teamId: string; shield: ShieldSpot; saved: boolean }[];
}

export interface PenultimaReveal {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  rounds: { id: string; spot: ShieldSpot; prompt: string; options: Option[]; solutionId: string }[];
  explain: string;
  summary: PenultimaSummary | null;
}

const SPOTS: ShieldSpot[] = ["penultima", "ultima"];

function view(c: PenultimaContent, ctx: PhaseCtx, elapsedMs: number | null): PenultimaView {
  return {
    ...baseView(def, ctx),
    heading: c.title,
    round2AtMs: ROUND2_AT_MS,
    rounds: c.rounds.map((r, i) => {
      const open = i === 0 || elapsedMs === null || elapsedMs >= ROUND2_AT_MS;
      return { id: r.id, spot: SPOTS[i], prompt: open ? r.prompt : null, options: open ? publicOptions(r.options, `${ctx.seed}:${r.id}`) : null };
    }),
    rightPoints: RIGHT_POINTS,
    wrongPoints: WRONG_POINTS,
  };
}

/** Punti di un colpo: giusto +60; sbagliato −30, oppure 0 se lì c'era la difesa. */
export function roundPoints(right: boolean, shielded: boolean): number {
  return right ? RIGHT_POINTS : shielded ? 0 : WRONG_POINTS;
}

const def: MechanicDef<PenultimaContent, PenultimaSubmission> = {
  code: "la-penultima-mossa",
  number: 78,
  manche: 5,
  title: "La penultima mossa",
  input: "team",
  timerSec: 45,
  oneDeviceOk: true,
  needs: [],
  rule: "Due colpi: giusta +60, sbagliata −30. Avete una difesa che annulla il −30: la giocate sulla penultima o la tenete per l'ultima?",
  contentSchema: penultimaContent,
  submissionSchema: penultimaSubmission,
  publicView: (c, ctx) => view(c, ctx, null),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const shields: PenultimaSummary["shields"] = [];
    const outcomes = scopeTeams(ctx).map((t) => {
      const s = firsts.get(t.teamId);
      if (!s) return noAnswer(t.teamId);
      const rights = content.rounds.map((r) => s.payload.answers[r.id] === content.solution.answers[r.id]);
      const pts = content.rounds.reduce((sum, _r, i) => sum + roundPoints(rights[i], s.payload.shield === SPOTS[i]), 0);
      const shieldIdx = SPOTS.indexOf(s.payload.shield);
      const saved = !rights[shieldIdx];
      shields.push({ teamId: t.teamId, shield: s.payload.shield, saved });
      const right = rights.filter(Boolean).length;
      return outcome(t.teamId, {
        points: pts,
        chaos: CHAOS.partecipa + (s.payload.shield === "ultima" ? CHAOS.rischio : 0) + (right === 2 ? CHAOS.centro : 0),
        correct: right === 2,
        accuracy: right / 2,
        label: `${right}/2 · difesa ${s.payload.shield === "ultima" ? "sull'ultima" : "sulla penultima"} ${saved ? "(vi ha salvato)" : "(non serviva)"}`,
      });
    });
    const out: ScoreWithSummary<PenultimaSummary> = { outcomes, summary: { shields } };
    return out;
  },
  reveal: (c, out): PenultimaReveal => ({
    heading: c.title,
    rounds: c.rounds.map((r, i) => ({ id: r.id, spot: SPOTS[i], prompt: r.prompt, options: r.options, solutionId: c.solution.answers[r.id] })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<PenultimaSummary>).summary ?? null,
  }),
};

export const laPenultimaMossa: MechanicModule<PenultimaContent, PenultimaSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(
        ctx,
        seed,
        (i, rnd) => ({
          shield: SPOTS[i % 2],
          answers: Object.fromEntries(c.rounds.map((r) => [r.id, pickAnswer(rnd, c.solution.answers[r.id], r.options.map((o) => o.id), demoSkill(i))])),
        }),
        { minMs: ROUND2_AT_MS + 5000 },
      ),
  },
};
