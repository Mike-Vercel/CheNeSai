import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { duelWinner, type DuelSide } from "../components/pairing";
import { CHAOS, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 17 · SCEGLI IL BERSAGLIO (manche 2) — ogni tavolo sceglie un rivale e risolve lo STESSO enigma.
 * Ogni coppia sfidante–bersaglio è un duello: vince chi ha risposto giusto, a pari merito il più rapido
 * (tempo del server). Duello vinto +40, perso 0: nessuna sottrazione. Ogni coppia conta una volta
 * (se A sfida B e B sfida A è un duello solo). Tetto: +80 a tavolo per prova.
 * Con due soli tavoli (duello voluto dalla regia) è un classico testa a testa.
 */

export const MAX_DUEL_POINTS = 80;

export const bersaglioContent = z
  .object({
    id: variantId,
    /** l'enigma (breve, a risposta univoca) */
    prompt: text(220),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type BersaglioContent = z.infer<typeof bersaglioContent>;
export type BersaglioInput = z.input<typeof bersaglioContent>;

export const bersaglioSubmission = z.object({ targetId: z.string().min(1).max(64), optionId: idSchema });
export type BersaglioSubmission = z.infer<typeof bersaglioSubmission>;

export interface BersaglioView extends BaseView {
  prompt: string;
  options: Option[];
  /** tavoli sfidabili (tutti i partecipanti; la UI toglie il proprio) */
  targets: { teamId: string; tableNo: number }[];
}

export interface DuelRecord {
  a: string;
  b: string;
  winner: string | null;
}

export interface BersaglioSummary {
  /** chi ha sfidato chi */
  challenges: { from: string; to: string }[];
  duels: DuelRecord[];
}

export interface BersaglioReveal {
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
  summary: BersaglioSummary | null;
}

const def: MechanicDef<BersaglioContent, BersaglioSubmission> = {
  code: "scegli-il-bersaglio",
  number: 17,
  manche: 2,
  title: "Scegli il bersaglio",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Scegliete un tavolo da sfidare e risolvete l'enigma. Ogni duello vinto +40, chi perde non perde nulla.",
  contentSchema: bersaglioContent,
  submissionSchema: bersaglioSubmission,
  publicView: (c, ctx): BersaglioView => ({
    ...baseView(def, ctx),
    prompt: c.prompt,
    options: publicOptions(c.options, `${ctx.seed}:opzioni`),
    targets: scopeTeams(ctx).map((t) => ({ teamId: t.teamId, tableNo: t.tableNo })),
  }),
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const ids = new Set(teams.map((t) => t.teamId));
    const firsts = firstPerTeam(submissions, ctx);
    const side = (teamId: string): DuelSide | null => {
      const s = firsts.get(teamId);
      const t = teams.find((x) => x.teamId === teamId)!;
      return s ? { teamId, tableNo: t.tableNo, correct: s.payload.optionId === content.solution.optionId, elapsedMs: s.elapsedMs } : null;
    };
    // sfide valide (bersaglio esistente e diverso da sé); con 2 tavoli il rivale è obbligato
    const challenges: { from: string; to: string }[] = [];
    for (const t of teams) {
      const s = firsts.get(t.teamId);
      if (!s) continue;
      let to = s.payload.targetId;
      if (teams.length === 2) to = teams.find((x) => x.teamId !== t.teamId)!.teamId;
      if (to !== t.teamId && ids.has(to)) challenges.push({ from: t.teamId, to });
    }
    // coppie non ordinate, ciascuna una volta
    const seen = new Set<string>();
    const duels: DuelRecord[] = [];
    for (const ch of challenges) {
      const [a, b] = [ch.from, ch.to].sort();
      const key = `${a}|${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      duels.push({ a, b, winner: duelWinner(side(a), side(b)) });
    }
    const summary: BersaglioSummary = { challenges, duels };
    const out: ScoreWithSummary<BersaglioSummary> = {
      outcomes: teams.map((t) => {
        const mine = duels.filter((d) => d.a === t.teamId || d.b === t.teamId);
        const won = mine.filter((d) => d.winner === t.teamId).length;
        const s = side(t.teamId);
        return outcome(t.teamId, {
          points: Math.min(MAX_DUEL_POINTS, won * POINTS.duelWin),
          chaos: (s ? CHAOS.partecipa : 0) + (mine.length ? CHAOS.sfida : 0) + (mine.length && won === mine.length ? CHAOS.centro : 0),
          correct: s ? s.correct : null,
          accuracy: s ? (s.correct ? 1 : 0) : 0,
          label: mine.length ? `${won} duell${won === 1 ? "o" : "i"} vint${won === 1 ? "o" : "i"} su ${mine.length}` : s ? "Nessun duello" : "Nessuna risposta",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): BersaglioReveal => ({
    prompt: c.prompt,
    options: c.options,
    solutionId: c.solution.optionId,
    explain: c.explain,
    summary: (out as ScoreWithSummary<BersaglioSummary>).summary ?? null,
  }),
};

export const scegliIlBersaglio: MechanicModule<BersaglioContent, BersaglioSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const teams = scopeTeams(ctx);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const others = teams.filter((_, j) => j !== i);
        if (!others.length) return null;
        return {
          targetId: others[Math.floor(rnd() * others.length)].teamId,
          optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)),
        };
      });
    },
  },
};
