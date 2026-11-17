import { z } from "zod";
import type { AcceptedSubmission, MechanicDef, TeamRef } from "../contract";
import { idSchema } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, variantId } from "./_shared";
import { checkQuestion, difficultySchema, publicQuestion, questionSchema, resolveTarget, tableRefs, type Question, type TableRef } from "./m2/shared";

/**
 * 29 · BOTTONE DEL CAOS (manche 2) — il duello identico di 45 secondi del Caos: una RAFFICA di tre domande lampo
 * uguali per entrambi. Vince chi ne azzecca di più; a pari numero il più rapido (tempo del server); pari
 * millisecondo o zero giuste per entrambi: nessun vincitore. Chi vince prende +50, chi perde 0: nessun malus.
 *
 * Coerenza col motore: il POTERE «Bottone del Caos» (uso unico per serata, finestre consentite, ALLARME CAOS) lo
 * gestisce il motore (engine → pressCaos), che sceglie come contenuto una meccanica «duel» giocabile con un
 * telefono, la fa giocare ai due tavoli in 45 s e dà +50 al vincitore da sé. Questa meccanica è fatta per quel
 * ruolo: con due tavoli il bersaglio è obbligato e i punti proposti (50/0) indicano lo stesso vincitore.
 * Pescata come prova normale della manche, ogni tavolo «preme il bottone» contro un rivale: ogni coppia è un duello
 * (contata una volta), +50 a duello vinto, tetto +100.
 */

export const CAOS_PRIZE = POINTS.chaosButton;
export const CAOS_CAP = 100;
export const RAFFICA = 3;

export const caosContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    raffica: z.array(questionSchema(3, 3)).length(RAFFICA),
    solution: z.object({ raffica: z.array(idSchema).length(RAFFICA) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => c.raffica.forEach((q, i) => checkQuestion(q, c.solution.raffica[i], ctx, ["raffica", i])));
export type CaosContent = z.infer<typeof caosContent>;
export type CaosInput = z.input<typeof caosContent>;

export const caosSubmission = z.object({ targetId: z.string().min(1).max(64), raffica: z.array(idSchema).length(RAFFICA) });
export type CaosSubmission = z.infer<typeof caosSubmission>;

export interface CaosView extends BaseView {
  raffica: Question[];
  targets: TableRef[];
  prize: number;
}

export interface CaosDuel {
  a: string;
  b: string;
  winner: string | null;
}

export interface CaosSummary {
  /** chi ha premuto il bottone contro chi */
  presses: { from: string; to: string }[];
  duels: CaosDuel[];
  /** risposte giuste per tavolo (0–3) */
  hits: Record<string, number>;
}

export interface CaosReveal {
  raffica: (Question & { solutionId: string })[];
  explain: string;
  summary: CaosSummary | null;
}

function hitsOf(c: CaosContent, s: AcceptedSubmission<CaosSubmission> | undefined): number {
  return s ? c.solution.raffica.filter((sol, i) => s.payload.raffica[i] === sol).length : 0;
}

/** Duello: più risposte giuste; a parità il più rapido; altrimenti nessuno. Senza giuste nessuno vince. */
export function caosWinner(a: { id: string; hits: number; ms: number } | null, b: { id: string; hits: number; ms: number } | null): string | null {
  const ha = a?.hits ?? 0;
  const hb = b?.hits ?? 0;
  if (ha === 0 && hb === 0) return null;
  if (ha !== hb) return ha > hb ? a!.id : b!.id;
  if (a!.ms === b!.ms) return null;
  return a!.ms < b!.ms ? a!.id : b!.id;
}

const def: MechanicDef<CaosContent, CaosSubmission> = {
  code: "bottone-del-caos",
  number: 29,
  manche: 2,
  title: "Bottone del Caos",
  input: "duel",
  timerSec: 45,
  oneDeviceOk: true,
  needs: [],
  rule: "Premete il bottone contro un tavolo: raffica di tre domande uguali per tutti. Più giuste (o più rapidi) vince +50. Nessun malus.",
  contentSchema: caosContent,
  submissionSchema: caosSubmission,
  publicView: (c, ctx): CaosView => ({
    ...baseView(def, ctx),
    raffica: c.raffica.map((q, i) => publicQuestion(q, `${ctx.seed}:raffica-${i}`)),
    targets: tableRefs(ctx),
    prize: CAOS_PRIZE,
  }),
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const side = (t: TeamRef) => {
      const s = firsts.get(t.teamId);
      return s ? { id: t.teamId, hits: hitsOf(content, s), ms: s.elapsedMs } : null;
    };
    const presses: { from: string; to: string }[] = [];
    for (const t of teams) {
      const s = firsts.get(t.teamId);
      if (!s) continue;
      const to = resolveTarget(teams, t.teamId, s.payload.targetId);
      if (to) presses.push({ from: t.teamId, to });
    }
    const seen = new Set<string>();
    const duels: CaosDuel[] = [];
    for (const p of presses) {
      const [a, b] = [p.from, p.to].sort();
      if (seen.has(`${a}|${b}`)) continue;
      seen.add(`${a}|${b}`);
      const ta = teams.find((x) => x.teamId === a)!;
      const tb = teams.find((x) => x.teamId === b)!;
      duels.push({ a, b, winner: caosWinner(side(ta), side(tb)) });
    }
    const hits: Record<string, number> = {};
    for (const t of teams) if (firsts.has(t.teamId)) hits[t.teamId] = hitsOf(content, firsts.get(t.teamId));
    const out: ScoreWithSummary<CaosSummary> = {
      outcomes: teams.map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const h = hits[t.teamId];
        const mine = duels.filter((d) => d.a === t.teamId || d.b === t.teamId);
        const won = mine.filter((d) => d.winner === t.teamId).length;
        return outcome(t.teamId, {
          points: Math.min(CAOS_CAP, won * CAOS_PRIZE),
          chaos: CHAOS.partecipa + (mine.length ? CHAOS.sfida : 0) + (h === RAFFICA ? CHAOS.centro : 0),
          correct: h === RAFFICA,
          accuracy: h / RAFFICA,
          label: `${h} su ${RAFFICA} · ${mine.length ? `${won} duell${won === 1 ? "o" : "i"} vint${won === 1 ? "o" : "i"} su ${mine.length}` : "nessun duello"}`,
        });
      }),
      summary: { presses, duels, hits },
    };
    return out;
  },
  reveal: (c, out): CaosReveal => ({
    raffica: c.raffica.map((q, i) => ({ ...q, solutionId: c.solution.raffica[i] })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<CaosSummary>).summary ?? null,
  }),
};

export const bottoneDelCaos: MechanicModule<CaosContent, CaosSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const teams = scopeTeams(ctx);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const others = teams.filter((_, j) => j !== i);
        return {
          targetId: others.length ? others[Math.floor(rnd() * others.length)].teamId : teams[i].teamId,
          raffica: c.raffica.map((q, k) => pickAnswer(rnd, c.solution.raffica[k], q.options.map((o) => o.id), demoSkill(i) + 0.15)),
        };
      });
    },
  },
};
