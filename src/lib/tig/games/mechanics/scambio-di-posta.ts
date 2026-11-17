import { z } from "zod";
import type { MechanicDef, PhaseCtx, TeamRef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { duelWinner, type DuelSide } from "../components/pairing";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema, groupsOf, median, type TableRef } from "./m2/shared";

/**
 * 30 · SCAMBIO DI POSTA (manche 2) — i tavoli sono accoppiati (seme della prova, coppie visibili a tutti: ci si può
 * accordare a voce). Ognuno propone in segreto una posta (0–40) e risponde alla STESSA domanda.
 *   - la posta giocata è la PIÙ BASSA delle due proposte: nessuno rischia più di quanto ha accettato (consenso);
 *   - risposta giusta: +50 a chi la dà;
 *   - duello della coppia (giusto batte sbagliato, tra giusti il più rapido): chi vince prende la posta all'altro
 *     (trasferimento ≤ 40; scudo e tetti li applica il runtime). Pareggio o posta 0: nessuno scambio.
 * Tavolo dispari: gioca contro il BANCO, che paga la posta (punti propri) se è giusto entro il tempo mediano del
 * locale; il banco non incassa mai.
 */

export const STAKES = [0, 10, 20, 30, 40] as const;
export const POSTA_BASE = 50;

export const postaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    prompt: text(220),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type PostaContent = z.infer<typeof postaContent>;
export type PostaInput = z.input<typeof postaContent>;

export const postaSubmission = z.object({
  stake: z.number().int().refine((v) => (STAKES as readonly number[]).includes(v), "posta non ammessa"),
  optionId: idSchema,
});
export type PostaSubmission = z.infer<typeof postaSubmission>;

export interface PostaView extends BaseView {
  prompt: string;
  options: Option[];
  /** coppie (un gruppo da uno = contro il banco) */
  pairs: TableRef[][];
  stakes: readonly number[];
  base: number;
}

export interface PostaDuel {
  a: string;
  /** null = il banco */
  b: string | null;
  stakeA: number | null;
  stakeB: number | null;
  /** posta giocata (la più bassa) */
  stake: number;
  winner: string | null;
}

export interface PostaSummary {
  duels: PostaDuel[];
  /** tempo mediano delle risposte giuste (per il banco), ms */
  medianMs: number | null;
}

export interface PostaReveal {
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
  summary: PostaSummary | null;
}

function pairsOf(ctx: PhaseCtx): TeamRef[][] {
  const teams = scopeTeams(ctx);
  const byId = new Map(teams.map((t) => [t.teamId, t]));
  return groupsOf(
    teams.map((t) => t.teamId),
    ctx.seed,
    "solo",
  ).map((g) => g.map((id) => byId.get(id)!).sort((x, y) => x.tableNo - y.tableNo));
}

const def: MechanicDef<PostaContent, PostaSubmission> = {
  code: "scambio-di-posta",
  number: 30,
  manche: 2,
  title: "Scambio di posta",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Accordatevi col tavolo abbinato: si gioca la posta più bassa delle due (max 40). Giusta +50; chi vince il duello prende la posta.",
  contentSchema: postaContent,
  submissionSchema: postaSubmission,
  publicView: (c, ctx): PostaView => ({
    ...baseView(def, ctx),
    prompt: c.prompt,
    options: publicOptions(c.options, `${ctx.seed}:opzioni`),
    pairs: pairsOf(ctx).map((g) => g.map((t) => ({ teamId: t.teamId, tableNo: t.tableNo }))),
    stakes: STAKES,
    base: POSTA_BASE,
  }),
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const ok = (id: string) => firsts.get(id)?.payload.optionId === content.solution.optionId;
    const side = (t: TeamRef): DuelSide | null => {
      const s = firsts.get(t.teamId);
      return s ? { teamId: t.teamId, tableNo: t.tableNo, correct: ok(t.teamId), elapsedMs: s.elapsedMs } : null;
    };
    const medianMs = median(teams.filter((t) => ok(t.teamId)).map((t) => firsts.get(t.teamId)!.elapsedMs));
    const duels: PostaDuel[] = [];
    /** punti propri in più (banco) e trasferimenti proposti */
    const bonus = new Map<string, number>();
    const steals = new Map<string, { toTeamId: string; points: number; reason: string }>();
    for (const g of pairsOf(ctx)) {
      const [a, b] = g;
      const sa = firsts.get(a.teamId)?.payload.stake ?? null;
      if (!b) {
        const s = firsts.get(a.teamId);
        const beat = !!s && ok(a.teamId) && medianMs !== null && s.elapsedMs <= medianMs;
        const stake = sa ?? 0;
        if (beat && stake > 0) bonus.set(a.teamId, stake);
        duels.push({ a: a.teamId, b: null, stakeA: sa, stakeB: null, stake, winner: beat ? a.teamId : null });
        continue;
      }
      const sb = firsts.get(b.teamId)?.payload.stake ?? null;
      const stake = sa === null || sb === null ? 0 : Math.min(sa, sb);
      const winner = duelWinner(side(a), side(b));
      if (winner && stake > 0) {
        const loser = winner === a.teamId ? b.teamId : a.teamId;
        steals.set(winner, { toTeamId: loser, points: stake, reason: "Scambio di posta" });
      }
      duels.push({ a: a.teamId, b: b.teamId, stakeA: sa, stakeB: sb, stake, winner });
    }
    const out: ScoreWithSummary<PostaSummary> = {
      outcomes: teams.map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const right = ok(t.teamId);
        const d = duels.find((x) => x.a === t.teamId || x.b === t.teamId)!;
        const steal = steals.get(t.teamId);
        const extra = bonus.get(t.teamId) ?? 0;
        const rival = d.b === null ? null : teams.find((x) => x.teamId === (d.a === t.teamId ? d.b : d.a));
        const won = d.winner === t.teamId;
        const lost = d.winner !== null && !won;
        const label = d.b === null ? (won ? `Banco battuto: +${d.stake} di posta` : "Il banco non paga") : d.stake === 0 ? (right ? "Esatto · nessuna posta" : "Sbagliato · nessuna posta") : won ? `Posta ${d.stake} vinta col tavolo ${rival?.tableNo}` : lost ? `Posta ${d.stake} persa col tavolo ${rival?.tableNo}` : `Posta ${d.stake}: pareggio`;
        return outcome(t.teamId, {
          points: (right ? POSTA_BASE : 0) + extra,
          chaos: CHAOS.partecipa + (d.stake > 0 ? CHAOS.rischio : 0) + (right ? CHAOS.centro : 0),
          correct: right,
          accuracy: right ? 1 : 0,
          label,
          transfers: steal ? [steal] : undefined,
        });
      }),
      summary: { duels, medianMs },
    };
    return out;
  },
  reveal: (c, out): PostaReveal => ({
    prompt: c.prompt,
    options: c.options,
    solutionId: c.solution.optionId,
    explain: c.explain,
    summary: (out as ScoreWithSummary<PostaSummary>).summary ?? null,
  }),
};

export const scambioDiPosta: MechanicModule<PostaContent, PostaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        stake: STAKES[1 + Math.floor(rnd() * 4)],
        optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)),
      })),
  },
};
