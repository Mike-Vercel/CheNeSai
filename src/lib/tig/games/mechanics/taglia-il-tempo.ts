import { z } from "zod";
import type { AcceptedSubmission, MechanicDef } from "../contract";
import { idSchema, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS, speedBonus } from "../components/scoring";
import { durationOf, firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, variantId } from "./_shared";
import { byTime, checkQuestion, difficultySchema, publicQuestion, questionSchema, resolveTarget, tableRefs, type Question, type TableRef } from "./m2/shared";

/**
 * 18 · TAGLIA IL TEMPO (manche 2) — versione AUTOCONTENUTA in una sola prova (il motore non porta effetti da
 * una prova all'altra): prima una PROVA LAMPO, poi la SFIDA uguale per tutti. Chi risponde giusto al lampo
 * «taglia» 3 secondi al tavolo che ha scelto: per quel tavolo la sfida scade 3 secondi prima e il suo tempo
 * conta 3 secondi in più (bonus velocità). Effetto massimo UNA volta per tavolo: ognuno taglia al più un
 * tavolo (un invio) e subisce al più un taglio (vale il primo arrivato, gli altri vanno a vuoto).
 * Sfida giusta in tempo: 100 + bonus velocità (max 20) sul tempo tagliato; fuori tempo o sbagliata: 0.
 */

export const CUT_MS = 3000;

export const tagliaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** prova lampo: domanda velocissima a 3 opzioni */
    lampo: questionSchema(3, 3),
    /** la sfida (uguale per tutti) */
    sfida: questionSchema(4, 4),
    solution: z.object({ lampo: idSchema, sfida: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkQuestion(c.lampo, c.solution.lampo, ctx, ["lampo"]);
    checkQuestion(c.sfida, c.solution.sfida, ctx, ["sfida"]);
  });
export type TagliaContent = z.infer<typeof tagliaContent>;
export type TagliaInput = z.input<typeof tagliaContent>;

export const tagliaSubmission = z.object({ lampo: idSchema, targetId: z.string().min(1).max(64), sfida: idSchema });
export type TagliaSubmission = z.infer<typeof tagliaSubmission>;

export interface TagliaView extends BaseView {
  lampo: Question;
  sfida: Question;
  targets: TableRef[];
  cutMs: number;
}

export interface TagliaCut {
  from: string;
  to: string;
  /** il taglio ha avuto effetto (primo sul bersaglio); false = andato a vuoto */
  applied: boolean;
}

export interface TagliaSummary {
  cuts: TagliaCut[];
  /** tavoli che avrebbero risposto in tempo ma sono finiti fuori per il taglio */
  knockedOut: string[];
}

export interface TagliaReveal {
  lampo: Question & { solutionId: string };
  sfida: Question & { solutionId: string };
  explain: string;
  summary: TagliaSummary | null;
}

function cutsOf(c: TagliaContent, teams: ReturnType<typeof scopeTeams>, firsts: Map<string, AcceptedSubmission<TagliaSubmission>>): TagliaCut[] {
  const tries = [...firsts.values()].filter((s) => s.payload.lampo === c.solution.lampo).sort(byTime);
  const hit = new Set<string>();
  const out: TagliaCut[] = [];
  for (const s of tries) {
    const to = resolveTarget(teams, s.teamId, s.payload.targetId);
    if (!to) continue;
    out.push({ from: s.teamId, to, applied: !hit.has(to) });
    hit.add(to);
  }
  return out.sort((a, b) => (a.from < b.from ? -1 : 1));
}

const def: MechanicDef<TagliaContent, TagliaSubmission> = {
  code: "taglia-il-tempo",
  number: 18,
  manche: 2,
  title: "Taglia il tempo",
  input: "duel",
  timerSec: 50,
  oneDeviceOk: true,
  needs: [],
  rule: "Lampo giusto: tagliate 3 secondi alla sfida di un tavolo. Sfida in tempo: 100 + velocità. Chi è tagliato scade 3 s prima.",
  contentSchema: tagliaContent,
  submissionSchema: tagliaSubmission,
  publicView: (c, ctx): TagliaView => ({
    ...baseView(def, ctx),
    lampo: publicQuestion(c.lampo, `${ctx.seed}:lampo`),
    sfida: publicQuestion(c.sfida, `${ctx.seed}:sfida`),
    targets: tableRefs(ctx),
    cutMs: CUT_MS,
  }),
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const dur = durationOf(ctx) || def.timerSec * 1000;
    const cuts = cutsOf(content, teams, firsts);
    const cutOn = new Set(cuts.filter((c) => c.applied).map((c) => c.to));
    const knockedOut: string[] = [];
    const out: ScoreWithSummary<TagliaSummary> = {
      outcomes: teams.map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const cut = cutOn.has(t.teamId);
        const eff = s.elapsedMs + (cut ? CUT_MS : 0);
        const late = eff > dur;
        const right = s.payload.sfida === content.solution.sfida;
        const ok = right && !late;
        if (right && late) knockedOut.push(t.teamId);
        const bonus = ok ? speedBonus(eff, dur) : 0;
        const mine = cuts.find((c) => c.from === t.teamId);
        const lampoOk = s.payload.lampo === content.solution.lampo;
        const tail = mine?.applied ? " · taglio a segno" : mine ? " · taglio a vuoto" : lampoOk ? "" : " · lampo sbagliato";
        return outcome(t.teamId, {
          points: ok ? POINTS.standard + bonus : 0,
          chaos: CHAOS.partecipa + (mine?.applied ? CHAOS.sfida : 0) + (ok ? CHAOS.centro : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: (late && right ? "Tagliati: risposta fuori tempo" : ok ? (cut ? `Esatto anche tagliati · +${bonus}` : `Esatto · +${bonus} velocità`) : "Sfida sbagliata") + tail,
        });
      }),
      summary: { cuts, knockedOut },
    };
    return out;
  },
  reveal: (c, out): TagliaReveal => ({
    lampo: { ...c.lampo, solutionId: c.solution.lampo },
    sfida: { ...c.sfida, solutionId: c.solution.sfida },
    explain: c.explain,
    summary: (out as ScoreWithSummary<TagliaSummary>).summary ?? null,
  }),
};

export const tagliaIlTempo: MechanicModule<TagliaContent, TagliaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const teams = scopeTeams(ctx);
      const subs = demoPerTeam(ctx, seed, (i, rnd) => {
        const others = teams.filter((_, j) => j !== i);
        return {
          lampo: pickAnswer(rnd, c.solution.lampo, c.lampo.options.map((o: Option) => o.id), demoSkill(i) + 0.1),
          targetId: others.length ? others[Math.floor(rnd() * others.length)].teamId : teams[i].teamId,
          sfida: pickAnswer(rnd, c.solution.sfida, c.sfida.options.map((o: Option) => o.id), demoSkill(i)),
        };
      });
      // uno arriva all'ultimo secondo: se tagliato, va fuori tempo
      const dur = durationOf(ctx) || 50000;
      return subs.map((s, i) => (i === 1 ? { ...s, elapsedMs: dur - 1500 } : s));
    },
  },
};
