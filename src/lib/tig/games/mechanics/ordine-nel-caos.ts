import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { idSchema, type Option } from "../components/choice";
import { correctPositions, isPermutation, reorderPoints } from "../components/reorder";
import { seededShuffle, shuffleNotIdentity } from "../components/rng";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 05 · ORDINE NEL CAOS (manche 1) — quattro momenti di una storia vanno messi nell'ordine CAUSALE
 * (ogni passo rende possibile il successivo). 20 punti per posizione giusta + 20 se la sequenza è perfetta.
 */

const ITEMS = 4;

export const ordineContent = z
  .object({
    id: variantId,
    /** titolo della storia, es. «Il weekend low cost» */
    prompt: text(80),
    items: z.array(z.object({ id: idSchema, text: text(110) })).length(ITEMS),
    solution: z.object({ order: z.array(idSchema).length(ITEMS) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const ids = c.items.map((i) => i.id);
    if (new Set(ids).size !== ITEMS) ctx.addIssue({ code: "custom", message: "id duplicati" });
    if (!isPermutation(c.solution.order, ids)) ctx.addIssue({ code: "custom", message: "la soluzione deve usare tutti gli elementi una volta" });
  });
export type OrdineContent = z.infer<typeof ordineContent>;
export type OrdineInput = z.input<typeof ordineContent>;

export const ordineSubmission = z.object({ order: z.array(idSchema).length(ITEMS) });
export type OrdineSubmission = z.infer<typeof ordineSubmission>;

export interface OrdineView extends BaseView {
  prompt: string;
  /** ordine di partenza mescolato (mai uguale alla soluzione) */
  items: Option[];
}

export interface OrdineReveal {
  prompt: string;
  /** nell'ordine giusto */
  items: Option[];
  explain: string;
}

/** Ordine di partenza: mescolato col seme e mai identico a quello giusto. */
function startOrder(c: OrdineContent, ctx: PhaseCtx): Option[] {
  const byId = new Map(c.items.map((i) => [i.id, i]));
  const right = c.solution.order.map((id) => byId.get(id)!);
  // mescola a partire dall'ordine giusto garantendo che sia diverso
  return shuffleNotIdentity(right, `${ctx.seed}:ordine`).map((i) => ({ id: i.id, text: i.text }));
}

const def: MechanicDef<OrdineContent, OrdineSubmission> = {
  code: "ordine-nel-caos",
  number: 5,
  manche: 1,
  title: "Ordine nel caos",
  input: "team",
  timerSec: 40,
  oneDeviceOk: true,
  needs: [],
  rule: "Quattro momenti, un solo ordine possibile: ogni passo causa il successivo. 20 punti a posizione, bonus se è perfetto.",
  contentSchema: ordineContent,
  submissionSchema: ordineSubmission,
  publicView: (c, ctx): OrdineView => ({ ...baseView(def, ctx), prompt: c.prompt, items: startOrder(c, ctx) }),
  score: ({ content, ctx, submissions }) => {
    const ids = content.items.map((i) => i.id);
    const firsts = firstPerTeam(submissions, ctx, (s) => isPermutation(s.payload.order, ids));
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const k = correctPositions(s.payload.order, content.solution.order);
        const perfect = k === ITEMS;
        return outcome(t.teamId, {
          points: reorderPoints(k, ITEMS),
          chaos: CHAOS.partecipa + (perfect ? CHAOS.centro : 0),
          correct: perfect,
          accuracy: k / ITEMS,
          label: perfect ? "Sequenza perfetta" : `${k} posizioni giuste su ${ITEMS}`,
        });
      }),
    };
  },
  reveal: (c): OrdineReveal => {
    const byId = new Map(c.items.map((i) => [i.id, i]));
    return { prompt: c.prompt, items: c.solution.order.map((id) => ({ id, text: byId.get(id)!.text })), explain: c.explain };
  },
};

export const ordineNelCaos: MechanicModule<OrdineContent, OrdineSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        if (rnd() < demoSkill(i)) return { order: c.solution.order.slice() };
        // due elementi scambiati, o tutto mescolato
        const o = c.solution.order.slice();
        if (rnd() < 0.6) [o[1], o[2]] = [o[2], o[1]];
        else return { order: seededShuffle(o, `${seed}:${i}`) };
        return { order: o };
      }),
  },
};
