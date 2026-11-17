import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { idSchema } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, variantId } from "./_shared";
import { checkQuestion, difficultySchema, publicQuestion, questionSchema, ringOf, type Question, type TableRef } from "./m2/shared";

/**
 * 20 · CONTRATTACCO (manche 2) — versione AUTOCONTENUTA: attacco e rivincita nella stessa prova. I tavoli formano
 * un giro (seme): ognuno ATTACCA il successivo e viene attaccato dal precedente, quindi ogni tavolo è bersagliato
 * esattamente una volta (niente accanimento).
 *   - COLPO: domanda uguale per tutti; giusta → furto di 20 al proprio bersaglio (trasferimento: scudo e tetti dal runtime);
 *   - RIVINCITA del bersagliato, scelta di rischio: SICURA (domanda facile, +20) o PIENA (domanda difficile, +40).
 * La rivincita è un bonus proprio, mai un altro attacco: nessuna catena. Massimo +40.
 */

export const COLPO = 20;
export const RIVINCITA = { sicura: 20, piena: 40 } as const;
export type Rivincita = keyof typeof RIVINCITA;

export const contrattaccoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    colpo: questionSchema(4, 4),
    sicura: questionSchema(3, 3),
    piena: questionSchema(4, 4),
    solution: z.object({ colpo: idSchema, sicura: idSchema, piena: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkQuestion(c.colpo, c.solution.colpo, ctx, ["colpo"]);
    checkQuestion(c.sicura, c.solution.sicura, ctx, ["sicura"]);
    checkQuestion(c.piena, c.solution.piena, ctx, ["piena"]);
  });
export type ContrattaccoContent = z.infer<typeof contrattaccoContent>;
export type ContrattaccoInput = z.input<typeof contrattaccoContent>;

export const contrattaccoSubmission = z.object({ colpo: idSchema, rivincita: z.enum(["sicura", "piena"]), risposta: idSchema });
export type ContrattaccoSubmission = z.infer<typeof contrattaccoSubmission>;

export interface ContrattaccoView extends BaseView {
  colpo: Question;
  sicura: Question;
  piena: Question;
  /** giro: chi attacca chi */
  ring: { from: TableRef; to: TableRef }[];
  steal: number;
  bonus: typeof RIVINCITA;
}

export interface ContrattaccoLink {
  from: string;
  to: string;
  /** colpo a segno (giusto) */
  hit: boolean;
  /** rivincita del bersagliato: scelta ed esito */
  revenge: Rivincita | null;
  revengeOk: boolean;
}

export interface ContrattaccoSummary {
  links: ContrattaccoLink[];
}

export interface ContrattaccoReveal {
  colpo: Question & { solutionId: string };
  sicura: Question & { solutionId: string };
  piena: Question & { solutionId: string };
  explain: string;
  summary: ContrattaccoSummary | null;
}

function ringRefs(ctx: PhaseCtx): { from: TableRef; to: TableRef }[] {
  const teams = scopeTeams(ctx);
  const ref = (id: string) => {
    const t = teams.find((x) => x.teamId === id)!;
    return { teamId: t.teamId, tableNo: t.tableNo };
  };
  return ringOf(
    teams.map((t) => t.teamId),
    ctx.seed,
  ).map((l) => ({ from: ref(l.from), to: ref(l.to) }));
}

const def: MechanicDef<ContrattaccoContent, ContrattaccoSubmission> = {
  code: "contrattacco",
  number: 20,
  manche: 2,
  title: "Contrattacco",
  input: "duel",
  timerSec: 50,
  oneDeviceOk: true,
  needs: [],
  rule: "Colpo giusto: rubate 20 al tavolo che attaccate. Chi viene attaccato ha la rivincita: sicura +20 o piena +40.",
  contentSchema: contrattaccoContent,
  submissionSchema: contrattaccoSubmission,
  publicView: (c, ctx): ContrattaccoView => ({
    ...baseView(def, ctx),
    colpo: publicQuestion(c.colpo, `${ctx.seed}:colpo`),
    sicura: publicQuestion(c.sicura, `${ctx.seed}:sicura`),
    piena: publicQuestion(c.piena, `${ctx.seed}:piena`),
    ring: ringRefs(ctx),
    steal: COLPO,
    bonus: RIVINCITA,
  }),
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const ring = ringOf(
      teams.map((t) => t.teamId),
      ctx.seed,
    );
    const revengeOf = (id: string) => {
      const s = firsts.get(id);
      if (!s) return { revenge: null, ok: false };
      const sol = s.payload.rivincita === "piena" ? content.solution.piena : content.solution.sicura;
      return { revenge: s.payload.rivincita, ok: s.payload.risposta === sol };
    };
    const links: ContrattaccoLink[] = ring.map((l) => {
      const s = firsts.get(l.from);
      const r = revengeOf(l.to);
      return { from: l.from, to: l.to, hit: !!s && s.payload.colpo === content.solution.colpo, revenge: r.revenge, revengeOk: r.ok };
    });
    const out: ScoreWithSummary<ContrattaccoSummary> = {
      outcomes: teams.map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const attack = links.find((l) => l.from === t.teamId);
        const hit = s.payload.colpo === content.solution.colpo;
        const r = revengeOf(t.teamId);
        const bonus = r.ok ? RIVINCITA[s.payload.rivincita] : 0;
        const victim = attack ? teams.find((x) => x.teamId === attack.to) : null;
        const colpoLabel = !attack ? "Nessun bersaglio" : hit ? `Colpo a segno sul tavolo ${victim?.tableNo}` : "Colpo a vuoto";
        return outcome(t.teamId, {
          points: bonus,
          chaos: CHAOS.partecipa + (attack && hit ? CHAOS.sfida : 0) + (s.payload.rivincita === "piena" ? CHAOS.rischio : 0) + (r.ok ? CHAOS.centro : 0),
          correct: r.ok,
          accuracy: ((hit ? 1 : 0) + (r.ok ? 1 : 0)) / 2,
          label: `${colpoLabel} · rivincita ${s.payload.rivincita} ${r.ok ? `+${bonus}` : "fallita"}`,
          transfers: attack && hit ? [{ toTeamId: attack.to, points: COLPO, reason: "Contrattacco: colpo" }] : undefined,
        });
      }),
      summary: { links },
    };
    return out;
  },
  reveal: (c, out): ContrattaccoReveal => ({
    colpo: { ...c.colpo, solutionId: c.solution.colpo },
    sicura: { ...c.sicura, solutionId: c.solution.sicura },
    piena: { ...c.piena, solutionId: c.solution.piena },
    explain: c.explain,
    summary: (out as ScoreWithSummary<ContrattaccoSummary>).summary ?? null,
  }),
};

export const contrattacco: MechanicModule<ContrattaccoContent, ContrattaccoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const rivincita: Rivincita = i % 2 === 0 ? "piena" : "sicura";
        const q = rivincita === "piena" ? c.piena : c.sicura;
        const sol = rivincita === "piena" ? c.solution.piena : c.solution.sicura;
        return {
          colpo: pickAnswer(rnd, c.solution.colpo, c.colpo.options.map((o) => o.id), demoSkill(i)),
          rivincita,
          risposta: pickAnswer(rnd, sol, q.options.map((o) => o.id), demoSkill(i) + (rivincita === "sicura" ? 0.2 : 0)),
        };
      }),
  },
};
