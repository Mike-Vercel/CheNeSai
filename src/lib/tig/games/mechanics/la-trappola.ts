import { z } from "zod";
import type { AcceptedSubmission, MechanicDef } from "../contract";
import { idSchema } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { byTime, checkQuestion, difficultySchema, publicQuestion, questionSchema, resolveTarget, tableRefs, type Question, type TableRef } from "./m2/shared";

/**
 * 26 · LA TRAPPOLA (manche 2) — tre trappole di logica (mini enigmi a 3 opzioni), uguali per tutti. Ogni tavolo:
 *   1. ARMA una delle tre trappole contro un tavolo a scelta (quella che secondo lui il bersaglio sbaglierà);
 *   2. DISINNESCA tutte e tre rispondendo (non sa quale gli hanno armato contro).
 * Se il bersaglio ha sbagliato (o non ha risposto) proprio la trappola armata, scatta: −30 al bersaglio (penalità,
 * nessuno la incassa; scudo e tetti li applica il runtime). Protezione anti-focus: su ogni tavolo vale UNA sola
 * trappola, la prima armata; le altre scattano a vuoto. Ogni trappola disinnescata vale +20 (massimo +60).
 */

export const TRAP_PENALTY = 30;
export const DEFUSE_POINTS = 20;
export const TRAPS = 3;

const trapSchema = questionSchema(3, 3).extend({ name: text(28) });
export type Trap = Question & { name: string };

export const trappolaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    traps: z.array(trapSchema).length(TRAPS),
    solution: z.object({ traps: z.array(idSchema).length(TRAPS) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    c.traps.forEach((t, i) => checkQuestion(t, c.solution.traps[i], ctx, ["traps", i]));
  });
export type TrappolaContent = z.infer<typeof trappolaContent>;
export type TrappolaInput = z.input<typeof trappolaContent>;

export const trappolaSubmission = z.object({
  targetId: z.string().min(1).max(64),
  trap: z.number().int().min(0).max(TRAPS - 1),
  defuse: z.array(idSchema).length(TRAPS),
});
export type TrappolaSubmission = z.infer<typeof trappolaSubmission>;

export interface TrappolaView extends BaseView {
  traps: Trap[];
  targets: TableRef[];
  penalty: number;
  defusePoints: number;
}

export interface TrappolaPlacement {
  from: string;
  to: string;
  trap: number;
  /** prima trappola sul bersaglio (le altre vanno a vuoto) */
  armed: boolean;
  /** solo per quella armata: è scattata? */
  sprung: boolean;
}

export interface TrappolaSummary {
  placements: TrappolaPlacement[];
}

export interface TrappolaReveal {
  traps: (Trap & { solutionId: string })[];
  explain: string;
  summary: TrappolaSummary | null;
}

function placementsOf(c: TrappolaContent, teams: ReturnType<typeof scopeTeams>, firsts: Map<string, AcceptedSubmission<TrappolaSubmission>>): TrappolaPlacement[] {
  const armedOn = new Set<string>();
  const out: TrappolaPlacement[] = [];
  for (const s of [...firsts.values()].sort(byTime)) {
    const to = resolveTarget(teams, s.teamId, s.payload.targetId);
    if (!to) continue;
    const armed = !armedOn.has(to);
    armedOn.add(to);
    const victim = firsts.get(to);
    const defused = !!victim && victim.payload.defuse[s.payload.trap] === c.solution.traps[s.payload.trap];
    out.push({ from: s.teamId, to, trap: s.payload.trap, armed, sprung: armed && !defused });
  }
  return out.sort((a, b) => (a.from < b.from ? -1 : 1));
}

const def: MechanicDef<TrappolaContent, TrappolaSubmission> = {
  code: "la-trappola",
  number: 26,
  manche: 2,
  title: "La trappola",
  input: "duel",
  timerSec: 50,
  oneDeviceOk: true,
  needs: [],
  rule: "Armate una trappola contro un tavolo e disinnescate tutte e tre: +20 l'una. Se il bersaglio sbaglia quella armata: −30.",
  contentSchema: trappolaContent,
  submissionSchema: trappolaSubmission,
  publicView: (c, ctx): TrappolaView => ({
    ...baseView(def, ctx),
    traps: c.traps.map((t, i) => ({ name: t.name, ...publicQuestion(t, `${ctx.seed}:trappola-${i}`) })),
    targets: tableRefs(ctx),
    penalty: TRAP_PENALTY,
    defusePoints: DEFUSE_POINTS,
  }),
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const placements = placementsOf(content, teams, firsts);
    const out: ScoreWithSummary<TrappolaSummary> = {
      outcomes: teams.map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const ok = content.solution.traps.filter((sol, i) => s.payload.defuse[i] === sol).length;
        const mine = placements.find((p) => p.from === t.teamId);
        const victim = mine ? teams.find((x) => x.teamId === mine.to) : null;
        const tail = !mine ? "" : !mine.armed ? " · trappola a vuoto" : mine.sprung ? ` · trappola scattata sul tavolo ${victim?.tableNo}` : " · trappola disinnescata";
        return outcome(t.teamId, {
          points: ok * DEFUSE_POINTS,
          chaos: CHAOS.partecipa + (mine?.sprung ? CHAOS.sfida : 0) + (ok === TRAPS ? CHAOS.centro : 0),
          correct: ok === TRAPS,
          accuracy: ok / TRAPS,
          label: `${ok} su ${TRAPS} disinnescate${tail}`,
          transfers: mine?.sprung ? [{ toTeamId: mine.to, points: -TRAP_PENALTY, reason: "La trappola" }] : undefined,
        });
      }),
      summary: { placements },
    };
    return out;
  },
  reveal: (c, out): TrappolaReveal => ({
    traps: c.traps.map((t, i) => ({ ...t, solutionId: c.solution.traps[i] })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<TrappolaSummary>).summary ?? null,
  }),
};

export const laTrappola: MechanicModule<TrappolaContent, TrappolaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const teams = scopeTeams(ctx);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const others = teams.filter((_, j) => j !== i);
        return {
          targetId: others.length ? others[Math.floor(rnd() * others.length)].teamId : teams[i].teamId,
          trap: Math.floor(rnd() * TRAPS),
          defuse: c.traps.map((t, k) => pickAnswer(rnd, c.solution.traps[k], t.options.map((o) => o.id), demoSkill(i) + 0.1)),
        };
      });
    },
  },
};
