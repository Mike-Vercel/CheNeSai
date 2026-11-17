import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, publicOptions, type Option, idSchema } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerMember, scopeTeams } from "../components/submissions";
import { agreementShare } from "../components/vote";
import { baseView, demoPerMember, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 35 · SINCRONIZZATI (manche 3) — ogni giocatore sceglie IN SEGRETO una di quattro risposte plausibili:
 * vince l'accordo. Punti = quota del gruppo più numeroso sul totale dei membri ATTIVI (chi non vota è
 * disaccordo): 2 su 2 e 8 su 8 valgono uguale (100), 3 su 4 e 6 su 8 valgono uguale (75).
 * Sul telefono l'ordine delle opzioni cambia per ogni giocatore: «premiamo tutti la prima» non funziona.
 * Con un solo telefono non c'è accordo da misurare: 50 punti fissi (meccanica sconsigliata in quel caso).
 */

export const SOLO_POINTS = 50;

export const sincroContent = z
  .object({
    id: variantId,
    prompt: text(120),
    options: optionsSchema(4, 4),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [], ctx, ["options"]));
export type SincroContent = z.infer<typeof sincroContent>;
export type SincroInput = z.input<typeof sincroContent>;

export const sincroSubmission = z.object({ optionId: idSchema });
export type SincroSubmission = z.infer<typeof sincroSubmission>;

export interface SincroView extends BaseView {
  prompt: string;
  /** ordine per la TV */
  options: Option[];
}

export interface SincroMemberView {
  /** stesse opzioni in un ordine diverso per ogni giocatore */
  options: Option[];
}

export interface SincroSummary {
  teams: { teamId: string; share: number; top: string[]; voters: number; members: number }[];
}

export interface SincroReveal {
  prompt: string;
  options: Option[];
  explain: string;
  summary: SincroSummary | null;
}

const def: MechanicDef<SincroContent, SincroSubmission> = {
  code: "sincronizzati",
  number: 35,
  manche: 3,
  title: "Sincronizzati",
  input: "vote",
  timerSec: 35,
  oneDeviceOk: false,
  needs: [],
  rule: "Ognuno sceglie in segreto, senza parlare. Più siete d'accordo, più punti: conta la percentuale, non quanti siete.",
  contentSchema: sincroContent,
  submissionSchema: sincroSubmission,
  publicView: (c, ctx): SincroView => ({ ...baseView(def, ctx), prompt: c.prompt, options: c.options.map((o) => ({ id: o.id, text: o.text })) }),
  memberView: (c, ctx): SincroMemberView => ({ options: publicOptions(c.options, `${ctx.seed}:${ctx.memberId}`) }),
  score: ({ content, ctx, submissions }) => {
    const ids = content.options.map((o) => o.id);
    const byTeam = firstPerMember(
      submissions.filter((s) => ids.includes(s.payload.optionId)),
      ctx,
    );
    const summary: SincroSummary = { teams: [] };
    const outcomes = scopeTeams(ctx).map((t) => {
      const votes = [...(byTeam.get(t.teamId)?.values() ?? [])].map((s) => s.payload.optionId);
      if (!votes.length) return noAnswer(t.teamId, "Nessun voto");
      const r = agreementShare(votes, t.members.length);
      summary.teams.push({ teamId: t.teamId, share: r.share, top: r.top, voters: r.voters, members: r.members });
      if (r.members < 2) {
        return outcome(t.teamId, { points: SOLO_POINTS, chaos: CHAOS.partecipa, correct: null, accuracy: null, label: "Un solo telefono: 50 fissi" });
      }
      const pct = Math.round(r.share * 100);
      const full = r.share === 1;
      return outcome(t.teamId, {
        points: Math.round(POINTS.standard * r.share),
        chaos: CHAOS.partecipa + (full ? CHAOS.centro : 0),
        correct: full,
        accuracy: Math.round(r.share * 1000) / 1000,
        label: full ? "Accordo totale" : `Accordo ${pct}%`,
      });
    });
    const out: ScoreWithSummary<SincroSummary> = { outcomes, summary };
    return out;
  },
  reveal: (c, out): SincroReveal => ({ prompt: c.prompt, options: c.options, explain: c.explain, summary: (out as ScoreWithSummary<SincroSummary>).summary ?? null }),
};

export const sincronizzati: MechanicModule<SincroContent, SincroSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerMember(ctx, seed, (ti, mi, rnd) => {
        const ids = c.options.map((o) => o.id);
        // il primo tavolo va d'accordo, gli altri meno
        if (ti === 0) return { optionId: ids[0] };
        if (ti === 1) return { optionId: mi === 0 ? ids[2] : ids[1] };
        return { optionId: ids[Math.floor(rnd() * ids.length)] };
      }),
  },
};
