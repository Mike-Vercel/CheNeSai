import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { seededShuffle } from "../components/rng";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema } from "./_m3";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 38 · PUB CONTRO TAVOLO (manche 3) — un tavolo estratto col seme della prova (verificabile, mai scelto a mano)
 * sfida tutto il locale. TUTTI giocano lo stesso quiz lampo di 5 domande di vita quotidiana, nello stesso tempo:
 * 20 punti a risposta giusta (massimo 100) per ogni tavolo. Lo sfidante prende +40 se fa PIÙ della media dei
 * rivali che hanno risposto (senza rivali: almeno 3 su 5). Non è penalizzato a priori: se perde prende comunque
 * i suoi punti; se il pub resiste, i rivali guadagnano solo Energia Caos (niente punti tolti a nessuno).
 */

export const QUESTIONS = 5;
export const PER_RIGHT = 20;
export const CHAMPION_BONUS = 40;
/** soglia dello sfidante quando nessun rival risponde */
export const SOLO_BAR = 3;

const questionSchema = z.object({ id: idSchema, prompt: text(160), options: optionsSchema(3, 4) });

export const pubContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** tema del quiz, es. «Il conto del pub» */
    theme: text(60),
    questions: z.array(questionSchema).length(QUESTIONS),
    solution: z.object({
      answers: z.record(z.string(), idSchema),
      /** perché, domanda per domanda (mostrato al reveal) */
      notes: z.record(z.string(), text(150)),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.questions.map((q) => q.id)).size !== QUESTIONS) ctx.addIssue({ code: "custom", message: "id delle domande duplicati" });
    c.questions.forEach((q, i) => {
      const a = c.solution.answers[q.id];
      if (!a) ctx.addIssue({ code: "custom", message: `manca la risposta di ${q.id}`, path: ["questions", i] });
      checkOptions(q.options, a ? [a] : [], ctx, ["questions", i]);
      if (!c.solution.notes[q.id]) ctx.addIssue({ code: "custom", message: `manca la nota di ${q.id}`, path: ["questions", i] });
    });
  });
export type PubContent = z.infer<typeof pubContent>;
export type PubInput = z.input<typeof pubContent>;

export const pubSubmission = z.object({ picks: z.record(z.string(), idSchema) });
export type PubSubmission = z.infer<typeof pubSubmission>;

export interface PubQuestion {
  id: string;
  prompt: string;
  options: Option[];
}

export interface PubView extends BaseView {
  theme: string;
  questions: PubQuestion[];
  /** tavolo sfidante (estratto col seme della prova) */
  champion: { teamId: string; tableNo: number } | null;
}

export interface PubSummary {
  championTeamId: string | null;
  championRight: number | null;
  /** media delle risposte giuste dei rivali che hanno risposto (null se nessuno) */
  rivalsAvg: number | null;
  rivals: number;
  /** lo sfidante ha superato la media */
  beaten: boolean;
  /** tavoli che hanno risposto giusto, per domanda */
  perQuestion: Record<string, number>;
  /** risposte giuste per tavolo (0–5) */
  scores: Record<string, number>;
  tables: number;
}

export interface PubReveal {
  theme: string;
  questions: (PubQuestion & { solutionId: string; note: string })[];
  explain: string;
  summary: PubSummary | null;
}

/** Sfidante della prova: estratto col seme (stesso risultato su server, TV e telefoni). */
export function championOf(ctx: PhaseCtx): { teamId: string; tableNo: number } | null {
  const teams = scopeTeams(ctx);
  if (!teams.length) return null;
  const id = seededShuffle(
    teams.map((t) => t.teamId).sort(),
    `${ctx.seed}:sfidante`,
  )[0];
  const t = teams.find((x) => x.teamId === id)!;
  return { teamId: t.teamId, tableNo: t.tableNo };
}

function rightCount(c: PubContent, picks: Record<string, string>): number {
  return c.questions.filter((q) => picks[q.id] === c.solution.answers[q.id]).length;
}

const def: MechanicDef<PubContent, PubSubmission> = {
  code: "pub-contro-tavolo",
  number: 38,
  manche: 3,
  title: "Pub contro tavolo",
  input: "team",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Tutti rispondono a 5 domande lampo: 20 punti l'una. Il tavolo sfidante prende +40 se batte la media del pub.",
  contentSchema: pubContent,
  submissionSchema: pubSubmission,
  publicView: (c, ctx): PubView => ({
    ...baseView(def, ctx),
    theme: c.theme,
    questions: c.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: publicOptions(q.options, `${ctx.seed}:${q.id}`) })),
    champion: championOf(ctx),
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const champ = championOf(ctx);
    const scores: Record<string, number> = {};
    for (const [id, s] of firsts) scores[id] = rightCount(content, s.payload.picks);
    const rivalIds = [...firsts.keys()].filter((id) => id !== champ?.teamId);
    const rivalsAvg = rivalIds.length ? rivalIds.reduce((x, id) => x + scores[id], 0) / rivalIds.length : null;
    const champRight = champ && firsts.has(champ.teamId) ? scores[champ.teamId] : null;
    const beaten = champRight !== null && (rivalsAvg === null ? champRight >= SOLO_BAR : champRight > rivalsAvg);
    const perQuestion: Record<string, number> = Object.fromEntries(content.questions.map((q) => [q.id, [...firsts.values()].filter((s) => s.payload.picks[q.id] === content.solution.answers[q.id]).length]));
    const avgText = rivalsAvg === null ? "" : (Math.round(rivalsAvg * 10) / 10).toLocaleString("it-IT");
    const summary: PubSummary = { championTeamId: champ?.teamId ?? null, championRight: champRight, rivalsAvg: rivalsAvg === null ? null : Math.round(rivalsAvg * 100) / 100, rivals: rivalIds.length, beaten, perQuestion, scores, tables: firsts.size };
    const out: ScoreWithSummary<PubSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const n = scores[t.teamId];
        const isChamp = t.teamId === champ?.teamId;
        const base = n * PER_RIGHT;
        if (isChamp) {
          return outcome(t.teamId, {
            points: base + (beaten ? CHAMPION_BONUS : 0),
            chaos: CHAOS.partecipa + (beaten ? CHAOS.sfida : 0),
            correct: n === QUESTIONS,
            accuracy: n / QUESTIONS,
            label: `Sfidante: ${n}/${QUESTIONS} · ${beaten ? `batte il pub${avgText ? ` (media ${avgText})` : ""} +40` : "il pub resiste"}`,
          });
        }
        return outcome(t.teamId, {
          points: base,
          chaos: CHAOS.partecipa + (!beaten ? CHAOS.sfida : 0) + (n === QUESTIONS ? CHAOS.centro : 0),
          correct: n === QUESTIONS,
          accuracy: n / QUESTIONS,
          label: `${n}/${QUESTIONS} giuste · ${beaten ? "lo sfidante vince" : "il pub resiste"}`,
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): PubReveal => ({
    theme: c.theme,
    questions: c.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options, solutionId: c.solution.answers[q.id], note: c.solution.notes[q.id] })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<PubSummary>).summary ?? null,
  }),
};

export const pubControTavolo: MechanicModule<PubContent, PubSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        picks: Object.fromEntries(
          c.questions.map((q) => [
            q.id,
            pickAnswer(
              rnd,
              c.solution.answers[q.id],
              q.options.map((o) => o.id),
              demoSkill(i),
            ),
          ]),
        ),
      })),
  },
};
