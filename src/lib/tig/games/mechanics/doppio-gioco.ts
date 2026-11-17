import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, seatMap, seatsOf } from "./_m4";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 57 · DOPPIO GIOCO (manche 4) — due prove con punteggi TRASPARENTI, uguali per tutti: la «sicura»
 * (facile: giusta +40, sbagliata 0) e la «rischiosa» (difficile: giusta +100, sbagliata −20).
 * I tavoli formano un giro: ognuno sceglie IN SEGRETO quale delle due prove vale per il tavolo successivo.
 * Chi riceve non sa quale gli è toccata, quindi risponde a entrambe; vale solo quella scelta per lui.
 * Chi sceglie: prova sicura → +10 (gioco pulito); prova rischiosa → +30 se l'avversario sbaglia (trappola
 * riuscita), 0 se la risolve. Se il tavolo precedente non sceglie, vale la sicura. Punti negativi solo per la
 * prova rischiosa sbagliata (rischio dichiarato prima); il motore tiene comunque il saldo ≥ 0.
 */

export const DOPPIO_PAYOFF = {
  sicura: { giusta: 40, sbagliata: 0 },
  rischiosa: { giusta: 100, sbagliata: -20 },
  scelta: { pulito: 10, trappola: 30 },
} as const;

export type ProvaKind = "sicura" | "rischiosa";

const provaSchema = z.object({
  prompt: text(320),
  options: optionsSchema(3, 4),
});

export const doppioContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    title: text(70),
    sicura: provaSchema,
    rischiosa: provaSchema,
    solution: z.object({
      sicura: idSchema,
      rischiosa: idSchema,
      whySicura: text(220),
      whyRischiosa: text(260),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.sicura.options, [c.solution.sicura], ctx, ["sicura"]);
    checkOptions(c.rischiosa.options, [c.solution.rischiosa], ctx, ["rischiosa"]);
  });
export type DoppioContent = z.infer<typeof doppioContent>;
export type DoppioInput = z.input<typeof doppioContent>;

export const doppioSubmission = z.object({
  /** prova che vale per il tavolo successivo */
  give: z.enum(["sicura", "rischiosa"]),
  sicura: idSchema,
  rischiosa: idSchema,
});
export type DoppioSubmission = z.infer<typeof doppioSubmission>;

export interface DoppioView extends BaseView {
  title: string;
  sicura: { prompt: string; options: Option[] };
  rischiosa: { prompt: string; options: Option[] };
  seats: { teamId: string; tableNo: number; tellsTo: string | null; hearsFrom: string | null }[];
  payoff: typeof DOPPIO_PAYOFF;
}

export interface DoppioLink {
  /** chi sceglie */
  from: string;
  /** chi riceve */
  to: string;
  give: ProvaKind;
  /** il ricevente ha risolto la prova che gli è toccata (null = non ha risposto) */
  ok: boolean | null;
}

export interface DoppioSummary {
  links: DoppioLink[];
}

export interface DoppioReveal {
  title: string;
  sicura: { prompt: string; options: Option[]; solutionId: string; why: string };
  rischiosa: { prompt: string; options: Option[]; solutionId: string; why: string };
  explain: string;
  summary: DoppioSummary | null;
}

const def: MechanicDef<DoppioContent, DoppioSubmission> = {
  code: "doppio-gioco",
  number: 57,
  manche: 4,
  title: "Doppio gioco",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Scegliete in segreto la prova che vale per il tavolo dopo: sicura (+40) o rischiosa (+100, sbagliata −20). Voi rispondete a entrambe.",
  contentSchema: doppioContent,
  submissionSchema: doppioSubmission,
  publicView: (c, ctx): DoppioView => ({
    ...baseView(def, ctx),
    title: c.title,
    sicura: { prompt: c.sicura.prompt, options: publicOptions(c.sicura.options, `${ctx.seed}:sicura`) },
    rischiosa: { prompt: c.rischiosa.prompt, options: publicOptions(c.rischiosa.options, `${ctx.seed}:rischiosa`) },
    seats: seatsOf(ctx).map((s) => ({ teamId: s.teamId, tableNo: s.tableNo, tellsTo: s.tellsTo, hearsFrom: s.hearsFrom })),
    payoff: DOPPIO_PAYOFF,
  }),
  score: ({ content, ctx, submissions }) => {
    const seats = seatsOf(ctx);
    const byId = seatMap(seats);
    const firsts = firstPerTeam(submissions, ctx);
    /** prova che vale per `teamId`: la sceglie il precedente; da solo (giro di uno) la sceglie lui */
    const counted = (teamId: string): ProvaKind => {
      const chooser = byId.get(teamId)?.hearsFrom ?? teamId;
      return firsts.get(chooser)?.payload.give ?? "sicura";
    };
    const solved = (teamId: string): boolean | null => {
      const s = firsts.get(teamId);
      if (!s) return null;
      const k = counted(teamId);
      return s.payload[k] === content.solution[k];
    };
    const links: DoppioLink[] = seats.filter((s) => s.tellsTo).map((s) => ({ from: s.teamId, to: s.tellsTo!, give: counted(s.tellsTo!), ok: solved(s.tellsTo!) }));
    const out: ScoreWithSummary<DoppioSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const seat = byId.get(t.teamId)!;
        const k = counted(t.teamId);
        const ok = !!solved(t.teamId);
        let pts = ok ? DOPPIO_PAYOFF[k].giusta : DOPPIO_PAYOFF[k].sbagliata;
        const parts = [`Prova ${k}: ${ok ? "esatta" : "sbagliata"}`];
        let trap = false;
        if (seat.tellsTo) {
          const r = solved(seat.tellsTo);
          if (r !== null) {
            if (s.payload.give === "sicura") {
              pts += DOPPIO_PAYOFF.scelta.pulito;
              parts.push("gioco pulito");
            } else if (!r) {
              pts += DOPPIO_PAYOFF.scelta.trappola;
              trap = true;
              parts.push("trappola riuscita");
            } else parts.push("trappola evitata");
          }
        }
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (ok ? CHAOS.centro : 0) + (k === "rischiosa" ? CHAOS.rischio : 0) + (trap ? CHAOS.sfida : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: parts.join(" · "),
        });
      }),
      summary: { links },
    };
    return out;
  },
  reveal: (c, out): DoppioReveal => ({
    title: c.title,
    sicura: { prompt: c.sicura.prompt, options: c.sicura.options, solutionId: c.solution.sicura, why: c.solution.whySicura },
    rischiosa: { prompt: c.rischiosa.prompt, options: c.rischiosa.options, solutionId: c.solution.rischiosa, why: c.solution.whyRischiosa },
    explain: c.explain,
    summary: (out as ScoreWithSummary<DoppioSummary>).summary ?? null,
  }),
};

export const doppioGioco: MechanicModule<DoppioContent, DoppioSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        give: i % 2 === 0 ? "rischiosa" : "sicura",
        sicura: pickAnswer(rnd, c.solution.sicura, c.sicura.options.map((o) => o.id), 0.9),
        rischiosa: pickAnswer(rnd, c.solution.rischiosa, c.rischiosa.options.map((o) => o.id), demoSkill(i) - 0.1),
      })),
  },
};
