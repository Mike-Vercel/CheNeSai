import { z } from "zod";
import type { MechanicDef } from "../contract";
import { ICON_KINDS, TONES, type IconKind, type Tone } from "../components/art";
import { checkOptions, idSchema } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { bottomIds, difficultySchema, pubPoll } from "./_m3";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 41 · INDOVINA IL PREFERITO (manche 3) — quattro scenari di vita adulta (vacanze, lavoro, amici), illustrati con
 * icone disegnate in codice. Ogni tavolo dà UN voto al suo preferito e prevede il PREFERITO del pubblico (+70)
 * e lo SNOBBATO, cioè il meno votato (+30). Parità: valgono tutti gli scenari a pari merito.
 * Temi neutri, niente dati sensibili; in TV solo percentuali.
 */

export const FAVORITE_POINTS = 70;
export const LAST_POINTS = 30;

const scenarioSchema = z.object({
  id: idSchema,
  text: text(70),
  /** illustrazione (icona del kit, disegnata in SVG) */
  icon: z.enum(ICON_KINDS),
  tone: z.enum(TONES).default("white"),
});

export const preferitoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    prompt: text(120),
    scenarios: z.array(scenarioSchema).length(4),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.scenarios, [], ctx, ["scenarios"]));
export type PreferitoContent = z.infer<typeof preferitoContent>;
export type PreferitoInput = z.input<typeof preferitoContent>;

export const preferitoSubmission = z
  .object({ vote: idSchema, favorite: idSchema, last: idSchema })
  .refine((s) => s.favorite !== s.last, { message: "preferito e snobbato devono essere diversi" });
export type PreferitoSubmission = z.infer<typeof preferitoSubmission>;

export interface PreferitoScenario {
  id: string;
  text: string;
  icon: IconKind;
  tone: Tone;
}

export interface PreferitoView extends BaseView {
  prompt: string;
  scenarios: PreferitoScenario[];
}

export interface PreferitoSummary {
  counts: Record<string, number>;
  percent: Record<string, number>;
  /** più votati (parità = più scenari) */
  winners: string[];
  /** meno votati */
  losers: string[];
  tables: number;
  /** previsioni di ogni tavolo (per segnarle sul telefono) */
  guesses: Record<string, { favorite: string; last: string }>;
}

export interface PreferitoReveal {
  prompt: string;
  scenarios: PreferitoScenario[];
  explain: string;
  summary: PreferitoSummary | null;
}

const def: MechanicDef<PreferitoContent, PreferitoSubmission> = {
  code: "indovina-il-preferito",
  number: 41,
  manche: 3,
  title: "Indovina il preferito",
  input: "pub",
  timerSec: 55,
  oneDeviceOk: true,
  needs: [],
  rule: "Votate il vostro scenario preferito, poi prevedete il preferito del pubblico (+70) e quello meno votato (+30).",
  contentSchema: preferitoContent,
  submissionSchema: preferitoSubmission,
  publicView: (c, ctx): PreferitoView => ({ ...baseView(def, ctx), prompt: c.prompt, scenarios: c.scenarios.map((s) => ({ id: s.id, text: s.text, icon: s.icon, tone: s.tone })) }),
  score: ({ content, ctx, submissions }) => {
    const ids = content.scenarios.map((s) => s.id);
    const firsts = firstPerTeam(submissions, ctx, (s) => ids.includes(s.payload.vote) && ids.includes(s.payload.favorite) && ids.includes(s.payload.last));
    const poll = pubPoll(
      [...firsts.values()].map((s) => s.payload.vote),
      ids,
    );
    const losers = bottomIds(poll.counts, ids);
    const summary: PreferitoSummary = {
      ...poll,
      losers,
      guesses: Object.fromEntries([...firsts].map(([id, s]) => [id, { favorite: s.payload.favorite, last: s.payload.last }])),
    };
    const out: ScoreWithSummary<PreferitoSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const fav = poll.winners.includes(s.payload.favorite);
        const last = losers.includes(s.payload.last);
        const points = (fav ? FAVORITE_POINTS : 0) + (last ? LAST_POINTS : 0);
        return outcome(t.teamId, {
          points,
          chaos: CHAOS.partecipa + (fav && last ? CHAOS.centro : 0),
          correct: fav,
          accuracy: points / (FAVORITE_POINTS + LAST_POINTS),
          label: fav && last ? "Preferito e snobbato giusti" : fav ? "Preferito giusto" : last ? "Snobbato giusto" : "Il pubblico la pensa diversamente",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): PreferitoReveal => ({
    prompt: c.prompt,
    scenarios: c.scenarios.map((s) => ({ id: s.id, text: s.text, icon: s.icon, tone: s.tone })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<PreferitoSummary>).summary ?? null,
  }),
};

export const indovinaIlPreferito: MechanicModule<PreferitoContent, PreferitoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const ids = c.scenarios.map((s) => s.id);
        const fav = Math.floor(rnd() * ids.length);
        return { vote: ids[(i + 1) % ids.length], favorite: ids[fav], last: ids[(fav + 1 + Math.floor(rnd() * 3)) % ids.length] };
      }),
  },
};
