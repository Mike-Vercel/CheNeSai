import { z } from "zod";
import type { MechanicDef, PhaseCtx, TeamRef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { duelWinner, type DuelSide } from "../components/pairing";
import { rngFrom } from "../components/rng";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { balancesSchema, difficultySchema, type TableRef } from "./m2/shared";

/**
 * 21 · CACCIA ALLA CAPOLISTA (manche 2) — la capolista (saldo più alto al via della prova, iniettato dal
 * runtime in `balances`) difende; ogni altro tavolo sceglie se darle la CACCIA o PASSARE. Tutti risolvono lo
 * STESSO enigma nello stesso tempo (duello simultaneo).
 *   - caccia: batti la capolista (giusta e più rapida, o giusta quando lei sbaglia) → +40; giusta ma battuta → +10;
 *   - passo: risposta giusta → +20;
 *   - capolista: giusta → +20, più +10 per ogni cacciatore respinto; tetto +40 (simmetrico al cacciatore).
 * Nessuna sottrazione: alla capolista non si toglie nulla (niente «bullismo competitivo»).
 * Pari merito in vetta: sono tutte capoliste, il cacciatore deve batterle tutte. Senza saldi (o tutti pari)
 * la capolista la estrae il seme della prova, e la vista lo dice.
 */

export const CACCIA = { win: 40, beaten: 10, pass: 20, leaderBase: 20, leaderPerHunter: 10, leaderCap: 40 } as const;

export const cacciaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** enigma breve a risposta univoca (conta anche la velocità) */
    prompt: text(220),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
    balances: balancesSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type CacciaContent = z.infer<typeof cacciaContent>;
export type CacciaInput = z.input<typeof cacciaContent>;

export const cacciaSubmission = z.object({ mode: z.enum(["caccia", "passo"]), optionId: idSchema });
export type CacciaSubmission = z.infer<typeof cacciaSubmission>;

export interface CacciaView extends BaseView {
  prompt: string;
  options: Option[];
  /** la capolista (o le capoliste a pari merito) */
  leaders: TableRef[];
  /** true se la capolista è stata estratta (saldi assenti o tutti pari) */
  drawn: boolean;
  others: TableRef[];
  points: typeof CACCIA;
}

export interface CacciaHunt {
  teamId: string;
  /** il cacciatore ha battuto tutte le capoliste */
  won: boolean;
  correct: boolean | null;
}

export interface CacciaSummary {
  leaders: string[];
  hunts: CacciaHunt[];
  passed: string[];
}

export interface CacciaReveal {
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
  summary: CacciaSummary | null;
}

/** Capoliste della prova: saldo massimo; senza saldi utili (o tutti pari) una sola estratta col seme. */
export function leadersOf(c: Pick<CacciaContent, "balances">, ctx: PhaseCtx): { leaders: TeamRef[]; drawn: boolean } {
  const teams = scopeTeams(ctx);
  if (!teams.length) return { leaders: [], drawn: false };
  const b = c.balances;
  if (b && teams.some((t) => typeof b[t.teamId] === "number")) {
    const score = (t: TeamRef) => b[t.teamId] ?? 0;
    const max = Math.max(...teams.map(score));
    const top = teams.filter((t) => score(t) === max);
    if (top.length < teams.length || teams.length === 1) return { leaders: top, drawn: false };
  }
  const pick = teams[Math.floor(rngFrom(`${ctx.seed}:capolista`)() * teams.length)];
  return { leaders: [pick], drawn: true };
}

const def: MechanicDef<CacciaContent, CacciaSubmission> = {
  code: "caccia-alla-capolista",
  number: 21,
  manche: 2,
  title: "Caccia alla capolista",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Date la caccia alla capolista o passate. Stesso enigma: batterla vale +40, passare +20. Lei difende: +10 a cacciatore respinto.",
  contentSchema: cacciaContent,
  submissionSchema: cacciaSubmission,
  publicView: (c, ctx): CacciaView => {
    const { leaders, drawn } = leadersOf(c, ctx);
    const ids = new Set(leaders.map((t) => t.teamId));
    return {
      ...baseView(def, ctx),
      prompt: c.prompt,
      options: publicOptions(c.options, `${ctx.seed}:opzioni`),
      leaders: leaders.map((t) => ({ teamId: t.teamId, tableNo: t.tableNo })),
      drawn,
      others: scopeTeams(ctx)
        .filter((t) => !ids.has(t.teamId))
        .map((t) => ({ teamId: t.teamId, tableNo: t.tableNo })),
      points: CACCIA,
    };
  },
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const { leaders } = leadersOf(content, ctx);
    const leaderIds = new Set(leaders.map((t) => t.teamId));
    const side = (t: TeamRef): DuelSide | null => {
      const s = firsts.get(t.teamId);
      return s ? { teamId: t.teamId, tableNo: t.tableNo, correct: s.payload.optionId === content.solution.optionId, elapsedMs: s.elapsedMs } : null;
    };
    const hunts: CacciaHunt[] = [];
    const passed: string[] = [];
    /** cacciatori respinti da ciascuna capolista */
    const repelled = new Map<string, number>();
    for (const t of teams) {
      if (leaderIds.has(t.teamId)) continue;
      const s = firsts.get(t.teamId);
      if (!s) continue;
      if (s.payload.mode === "passo") {
        passed.push(t.teamId);
        continue;
      }
      const me = side(t)!;
      let won = true;
      for (const l of leaders) {
        const w = duelWinner(me, side(l));
        if (w !== t.teamId) won = false;
        if (w === l.teamId) repelled.set(l.teamId, (repelled.get(l.teamId) ?? 0) + 1);
      }
      hunts.push({ teamId: t.teamId, won, correct: me.correct });
    }
    const out: ScoreWithSummary<CacciaSummary> = {
      outcomes: teams.map((t) => {
        const s = firsts.get(t.teamId);
        const ok = s ? s.payload.optionId === content.solution.optionId : false;
        if (leaderIds.has(t.teamId)) {
          if (!s) return noAnswer(t.teamId, "Capolista senza risposta");
          const rep = repelled.get(t.teamId) ?? 0;
          const faced = hunts.length;
          return outcome(t.teamId, {
            points: Math.min(CACCIA.leaderCap, (ok ? CACCIA.leaderBase : 0) + rep * CACCIA.leaderPerHunter),
            chaos: CHAOS.partecipa + (faced ? CHAOS.sfida : 0) + (faced && rep === faced ? CHAOS.centro : 0),
            correct: ok,
            accuracy: ok ? 1 : 0,
            label: faced ? `Capolista: ${rep} cacciator${rep === 1 ? "e" : "i"} respint${rep === 1 ? "o" : "i"} su ${faced}` : ok ? "Capolista: nessuna caccia, esatto" : "Capolista: nessuna caccia",
          });
        }
        if (!s) return noAnswer(t.teamId);
        if (s.payload.mode === "passo") {
          return outcome(t.teamId, { points: ok ? CACCIA.pass : 0, chaos: CHAOS.partecipa + (ok ? CHAOS.centro : 0), correct: ok, accuracy: ok ? 1 : 0, label: ok ? "Passo · esatto" : "Passo · sbagliato" });
        }
        const h = hunts.find((x) => x.teamId === t.teamId)!;
        return outcome(t.teamId, {
          points: h.won ? CACCIA.win : ok ? CACCIA.beaten : 0,
          chaos: CHAOS.partecipa + CHAOS.sfida + (h.won ? CHAOS.centro : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: h.won ? "Caccia riuscita" : ok ? "Esatto, ma la capolista è stata più rapida" : "Caccia fallita",
        });
      }),
      summary: { leaders: leaders.map((t) => t.teamId), hunts, passed },
    };
    return out;
  },
  reveal: (c, out): CacciaReveal => ({
    prompt: c.prompt,
    options: c.options,
    solutionId: c.solution.optionId,
    explain: c.explain,
    summary: (out as ScoreWithSummary<CacciaSummary>).summary ?? null,
  }),
};

export const cacciaAllaCapolista: MechanicModule<CacciaContent, CacciaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        mode: i % 3 === 2 ? "passo" : "caccia",
        optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)),
      })),
  },
};
