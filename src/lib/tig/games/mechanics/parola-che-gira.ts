import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, tally } from "./_m3";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 40 · PAROLA CHE GIRA (manche 3) — un tema e 8 parole già MODERATE (lista chiusa: nessun testo libero arriva
 * mai alla TV). Ogni tavolo:
 *   1. PROPONE la sua parola scegliendola dalla lista: se nessun altro tavolo propone la stessa, +30;
 *   2. gioca il quiz a eliminazione: tre regole tolgono parole dalla lista una dopo l'altra; chi indica la
 *      parola che SOPRAVVIVE prende +70.
 * Il conteggio delle proposte compare in TV solo al reveal, come numeri accanto a parole della lista.
 */

export const WORDS = 8;
export const RULES = 3;
export const UNIQUE_POINTS = 30;
export const SURVIVOR_POINTS = 70;

const wordSchema = z.object({ id: idSchema, text: text(16) });

export const parolaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** il tema delle parole, es. «Cose che si mettono in valigia» */
    theme: text(80),
    words: z.array(wordSchema).length(WORDS),
    /** regole in ordine; `removes` = parole tolte da quella regola (fa parte della soluzione) */
    rules: z.array(z.object({ text: text(110), removes: z.array(idSchema).min(1) })).length(RULES),
    solution: z.object({ wordId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const ids = c.words.map((w) => w.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "id delle parole duplicati" });
    const texts = c.words.map((w) => w.text.toLowerCase());
    if (new Set(texts).size !== texts.length) ctx.addIssue({ code: "custom", message: "parole duplicate" });
    const removed = c.rules.flatMap((r) => r.removes);
    for (const r of removed) if (!ids.includes(r)) ctx.addIssue({ code: "custom", message: `parola «${r}» non in lista` });
    if (new Set(removed).size !== removed.length) ctx.addIssue({ code: "custom", message: "una parola è tolta da due regole" });
    const left = ids.filter((id) => !removed.includes(id));
    if (left.length !== 1 || left[0] !== c.solution.wordId) ctx.addIssue({ code: "custom", message: `deve sopravvivere solo «${c.solution.wordId}», restano: ${left.join(", ")}` });
  });
export type ParolaContent = z.infer<typeof parolaContent>;
export type ParolaInput = z.input<typeof parolaContent>;

export const parolaSubmission = z.object({ word: idSchema, survivor: idSchema });
export type ParolaSubmission = z.infer<typeof parolaSubmission>;

export interface ParolaView extends BaseView {
  theme: string;
  words: Option[];
  /** solo il testo delle regole */
  rules: string[];
}

export interface ParolaSummary {
  /** proposte per parola (un voto per tavolo) */
  proposals: Record<string, number>;
  /** parole proposte da un solo tavolo */
  unique: string[];
  /** tavoli che hanno trovato la sopravvissuta */
  survivorRight: number;
  tables: number;
}

export interface ParolaReveal {
  theme: string;
  words: Option[];
  rules: { text: string; removes: string[] }[];
  survivorId: string;
  explain: string;
  summary: ParolaSummary | null;
}

const def: MechanicDef<ParolaContent, ParolaSubmission> = {
  code: "parola-che-gira",
  number: 40,
  manche: 3,
  title: "Parola che gira",
  input: "pub",
  timerSec: 70,
  oneDeviceOk: true,
  needs: [],
  rule: "Proponete una parola della lista che nessun altro tavolo sceglie (+30), poi trovate quella che sopravvive alle tre regole (+70).",
  contentSchema: parolaContent,
  submissionSchema: parolaSubmission,
  publicView: (c, ctx): ParolaView => ({ ...baseView(def, ctx), theme: c.theme, words: c.words.map((w) => ({ id: w.id, text: w.text })), rules: c.rules.map((r) => r.text) }),
  score: ({ content, ctx, submissions }) => {
    const ids = content.words.map((w) => w.id);
    const firsts = firstPerTeam(submissions, ctx, (s) => ids.includes(s.payload.word) && ids.includes(s.payload.survivor));
    const proposals = tally(
      [...firsts.values()].map((s) => s.payload.word),
      ids,
    );
    const unique = ids.filter((id) => proposals[id] === 1);
    const solution = content.solution.wordId;
    const summary: ParolaSummary = { proposals, unique, survivorRight: [...firsts.values()].filter((s) => s.payload.survivor === solution).length, tables: firsts.size };
    const out: ScoreWithSummary<ParolaSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const solo = proposals[s.payload.word] === 1;
        const right = s.payload.survivor === solution;
        const points = (solo ? UNIQUE_POINTS : 0) + (right ? SURVIVOR_POINTS : 0);
        return outcome(t.teamId, {
          points,
          chaos: CHAOS.partecipa + (right ? CHAOS.centro : 0),
          correct: right,
          accuracy: points / (UNIQUE_POINTS + SURVIVOR_POINTS),
          label: right && solo ? "Parola unica e sopravvissuta giusta" : right ? "Sopravvissuta giusta" : solo ? "Parola unica, sopravvissuta sbagliata" : "Parola già scelta da altri",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): ParolaReveal => ({
    theme: c.theme,
    words: c.words,
    rules: c.rules.map((r) => ({ text: r.text, removes: r.removes })),
    survivorId: c.solution.wordId,
    explain: c.explain,
    summary: (out as ScoreWithSummary<ParolaSummary>).summary ?? null,
  }),
};

export const parolaCheGira: MechanicModule<ParolaContent, ParolaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const ids = c.words.map((w) => w.id);
        return { word: ids[(i * 3) % ids.length], survivor: pickAnswer(rnd, c.solution.wordId, ids, demoSkill(i)) };
      }),
  },
};
