import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerMember, scopeTeams } from "../components/submissions";
import { baseView, demoPerMember, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { captainOf, difficultySchema, round3, tally, teamOf, topIds } from "./_m3";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 36 · IL CAPITANO CI CONOSCE? (manche 3) — voto segreto dentro il tavolo: il CAPITANO prevede quale risposta
 * sceglierà la maggioranza dei compagni, i compagni votano in segreto (ognuno sul proprio telefono, con le
 * risposte in un ordine diverso). Il capitano non vota: deve conoscere il suo tavolo.
 *   - previsione = unica risposta più votata → 100
 *   - spareggio, definito in anticipo e scritto nella regola: se più risposte sono pari, la previsione vale
 *     se è una di quelle, ma 60 punti invece di 100
 *   - altrimenti 0. Un solo telefono: niente compagni da indovinare, 50 fissi se il capitano prevede.
 * Conta la scelta più votata (percentuale del tavolo), non quanti siete. In TV solo l'esito per tavolo.
 */

export const TIE_POINTS = 60;
export const SOLO_POINTS = 50;

export const capitanoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    prompt: text(130),
    options: optionsSchema(3, 4),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [], ctx, ["options"]));
export type CapitanoContent = z.infer<typeof capitanoContent>;
export type CapitanoInput = z.input<typeof capitanoContent>;

/** Il capitano manda `guess`, i compagni `optionId` (il campo dell'altro ruolo viene ignorato). */
export const capitanoSubmission = z
  .object({ optionId: idSchema.optional(), guess: idSchema.optional() })
  .refine((s) => !!s.optionId || !!s.guess, { message: "manca la scelta" });
export type CapitanoSubmission = z.infer<typeof capitanoSubmission>;

export interface CapitanoView extends BaseView {
  prompt: string;
  /** ordine dell'autore (per la TV) */
  options: Option[];
}

export interface CapitanoMemberView {
  role: "capitano" | "giocatore";
  /** stesse opzioni, in un ordine diverso per ogni telefono (niente «premiamo tutti la prima») */
  options: Option[];
  /** compagni che votano (esclude il capitano) */
  voters: number;
}

export interface CapitanoTeamResult {
  teamId: string;
  guess: string | null;
  /** risposte più votate dai compagni (più di una = parità) */
  top: string[];
  /** quota dei compagni che hanno scelto la previsione del capitano (0..1) */
  share: number;
  voters: number;
  members: number;
  points: number;
}

export interface CapitanoSummary {
  teams: CapitanoTeamResult[];
}

export interface CapitanoReveal {
  prompt: string;
  options: Option[];
  explain: string;
  summary: CapitanoSummary | null;
}

const def: MechanicDef<CapitanoContent, CapitanoSubmission> = {
  code: "il-capitano-ci-conosce",
  number: 36,
  manche: 3,
  title: "Il capitano ci conosce?",
  input: "vote",
  timerSec: 50,
  oneDeviceOk: false,
  needs: [],
  rule: "Il capitano prevede la risposta più votata dal suo tavolo, gli altri votano in segreto. Giusto: 100. Parità: 60 se è tra le pari.",
  contentSchema: capitanoContent,
  submissionSchema: capitanoSubmission,
  publicView: (c, ctx): CapitanoView => ({ ...baseView(def, ctx), prompt: c.prompt, options: c.options.map((o) => ({ id: o.id, text: o.text })) }),
  memberView: (c, ctx): CapitanoMemberView => {
    const team = teamOf(ctx);
    const cap = team ? captainOf(team) : null;
    const role = cap === ctx.memberId ? "capitano" : "giocatore";
    const options = role === "capitano" ? c.options.map((o) => ({ id: o.id, text: o.text })) : publicOptions(c.options, `${ctx.seed}:${ctx.memberId}`);
    return { role, options, voters: Math.max(0, (team?.members.length ?? 1) - 1) };
  },
  score: ({ content, ctx, submissions }) => {
    const ids = content.options.map((o) => o.id);
    const byTeam = firstPerMember(submissions, ctx);
    const summary: CapitanoSummary = { teams: [] };
    const outcomes = scopeTeams(ctx).map((t) => {
      const subs = byTeam.get(t.teamId) ?? new Map();
      const cap = captainOf(t);
      const capGuess = cap ? subs.get(cap)?.payload.guess : undefined;
      const guess = capGuess && ids.includes(capGuess) ? capGuess : null;
      const votes = [...subs.entries()].filter(([m, s]) => m !== cap && !!s.payload.optionId && ids.includes(s.payload.optionId)).map(([, s]) => s.payload.optionId as string);
      if (!guess && !votes.length) return noAnswer(t.teamId, "Nessun voto");
      const counts = tally(votes, ids);
      const top = topIds(counts, ids);
      const voters = votes.length;
      const share = guess && voters ? round3((counts[guess] ?? 0) / voters) : 0;
      const row: CapitanoTeamResult = { teamId: t.teamId, guess, top, share, voters, members: t.members.length, points: 0 };
      summary.teams.push(row);
      if (t.members.length < 2) {
        row.points = guess ? SOLO_POINTS : 0;
        return outcome(t.teamId, { points: row.points, chaos: guess ? CHAOS.partecipa : 0, correct: null, accuracy: null, label: guess ? "Un solo telefono: 50 fissi" : "Nessuna previsione" });
      }
      if (!guess) return outcome(t.teamId, { points: 0, chaos: CHAOS.partecipa, correct: false, accuracy: 0, label: "Il capitano non ha previsto" });
      if (!voters) return outcome(t.teamId, { points: 0, chaos: CHAOS.partecipa, correct: false, accuracy: 0, label: "Nessun voto dai compagni" });
      const exact = top.length === 1 && top[0] === guess;
      const tied = top.length > 1 && top.includes(guess);
      row.points = exact ? POINTS.standard : tied ? TIE_POINTS : 0;
      const pct = Math.round(share * 100);
      return outcome(t.teamId, {
        points: row.points,
        chaos: CHAOS.partecipa + (exact ? CHAOS.centro : 0),
        correct: exact,
        accuracy: share,
        label: exact ? `Vi conosce: ${pct}% con lui` : tied ? "Parità al tavolo: 60" : `Vi conosce poco: ${pct}% con lui`,
      });
    });
    const out: ScoreWithSummary<CapitanoSummary> = { outcomes, summary };
    return out;
  },
  reveal: (c, out): CapitanoReveal => ({ prompt: c.prompt, options: c.options, explain: c.explain, summary: (out as ScoreWithSummary<CapitanoSummary>).summary ?? null }),
};

export const ilCapitanoCiConosce: MechanicModule<CapitanoContent, CapitanoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const ids = c.options.map((o) => o.id);
      const teams = scopeTeams(ctx);
      return demoPerMember(ctx, seed, (ti, mi, rnd) => {
        const t = teams[ti];
        const isCap = captainOf(t) === t.members[mi];
        // primo tavolo: il capitano li conosce; secondo: parità possibile; gli altri a caso
        if (isCap) return { guess: ti === 0 ? ids[0] : ids[Math.floor(rnd() * ids.length)] };
        if (ti === 0) return { optionId: ids[0] };
        if (ti === 1) return { optionId: ids[mi % 2] };
        return { optionId: ids[Math.floor(rnd() * ids.length)] };
      });
    },
  },
};
