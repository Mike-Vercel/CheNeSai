import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m5-shared";

/**
 * 67 · LA CASSA CHIUSA (manche 5) — una cassa con tre serrature a combinazione. Gli indizi sono CONCATENATI:
 * il secondo usa il codice del primo, il terzo quelli precedenti. Si inviano le tre combinazioni insieme.
 * Parziali per step: +30 per serratura aperta; bonus di completamento +30 se si aprono tutte (massimo 120).
 */

export const PER_LOCK = 30;
export const OPEN_BONUS = 30;

const lockSchema = z.object({
  id: idSchema,
  /** nome della serratura, es. «Il lucchetto rosso» */
  name: text(32),
  /** indizio (può citare i codici delle serrature precedenti) */
  clue: text(280),
  /** cifre della combinazione */
  digits: z.number().int().min(3).max(4),
});

export const cassaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    title: text(60),
    intro: text(240),
    locks: z.array(lockSchema).length(3),
    solution: z.object({
      /** serratura → combinazione */
      codes: z.record(z.string(), z.string().regex(/^\d{3,4}$/)),
      /** serratura → passaggio del ragionamento (per il reveal) */
      steps: z.record(z.string(), text(220)),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.locks.map((l) => l.id)).size !== c.locks.length) ctx.addIssue({ code: "custom", message: "id delle serrature duplicati" });
    c.locks.forEach((l, i) => {
      const sol = c.solution.codes[l.id];
      if (!sol) ctx.addIssue({ code: "custom", message: `manca la combinazione di ${l.id}`, path: ["locks", i] });
      else if (sol.length !== l.digits) ctx.addIssue({ code: "custom", message: `${l.id}: la combinazione non ha ${l.digits} cifre`, path: ["locks", i] });
      if (!c.solution.steps[l.id]) ctx.addIssue({ code: "custom", message: `manca il passaggio di ${l.id}`, path: ["locks", i] });
    });
  });
export type CassaContent = z.infer<typeof cassaContent>;
export type CassaInput = z.input<typeof cassaContent>;

export const cassaSubmission = z.object({ codes: z.record(z.string(), z.string().regex(/^\d{0,4}$/)) });
export type CassaSubmission = z.infer<typeof cassaSubmission>;

export interface CassaView extends BaseView {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  intro: string;
  locks: { id: string; n: number; name: string; clue: string; digits: number }[];
  perLock: number;
  openBonus: number;
}

export interface CassaReveal {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  locks: { id: string; n: number; name: string; clue: string; digits: number; combination: string; step: string }[];
  explain: string;
}

export function cassaPoints(opened: number): number {
  return opened * PER_LOCK + (opened === 3 ? OPEN_BONUS : 0);
}

const def: MechanicDef<CassaContent, CassaSubmission> = {
  code: "la-cassa-chiusa",
  number: 67,
  manche: 5,
  title: "La cassa chiusa",
  input: "team",
  timerSec: 75,
  oneDeviceOk: true,
  needs: [],
  rule: "Tre serrature, indizi a catena: ogni codice serve per il successivo. +30 per serratura aperta, +30 se aprite la cassa.",
  contentSchema: cassaContent,
  submissionSchema: cassaSubmission,
  publicView: (c, ctx): CassaView => ({
    ...baseView(def, ctx),
    heading: c.title,
    intro: c.intro,
    locks: c.locks.map((l, i) => ({ id: l.id, n: i + 1, name: l.name, clue: l.clue, digits: l.digits })),
    perLock: PER_LOCK,
    openBonus: OPEN_BONUS,
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const opened = content.locks.filter((l) => s.payload.codes[l.id] === content.solution.codes[l.id]).length;
        const all = opened === content.locks.length;
        return outcome(t.teamId, {
          points: cassaPoints(opened),
          chaos: CHAOS.partecipa + (all ? CHAOS.centro : 0),
          correct: all,
          accuracy: opened / content.locks.length,
          // spazio fisso prima dell'ultimo «3»: andando a capo, «su 3» resta unito
          label: all ? "Cassa aperta: 3 serrature su 3" : `${opened} serratur${opened === 1 ? "a" : "e"} su 3`,
        });
      }),
    };
  },
  reveal: (c): CassaReveal => ({
    heading: c.title,
    locks: c.locks.map((l, i) => ({ id: l.id, n: i + 1, name: l.name, clue: l.clue, digits: l.digits, combination: c.solution.codes[l.id], step: c.solution.steps[l.id] })),
    explain: c.explain,
  }),
};

export const laCassaChiusa: MechanicModule<CassaContent, CassaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        // i tavoli finti sbagliano «a catena»: una volta sbagliato un codice, i successivi saltano più spesso
        let broken = false;
        const codes: Record<string, string> = {};
        for (const l of c.locks) {
          const sol = c.solution.codes[l.id];
          const ok = !broken ? rnd() < demoSkill(i) + 0.05 : rnd() < 0.15;
          if (!ok) broken = true;
          codes[l.id] = ok ? sol : sol.slice(0, -1) + String((Number(sol[sol.length - 1]) + 3) % 10);
        }
        return { codes };
      }),
  },
};
