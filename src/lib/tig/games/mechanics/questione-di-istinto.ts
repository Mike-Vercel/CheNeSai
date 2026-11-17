import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { percentages } from "../components/vote";
import { baseView, demoPerTeam, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, tally } from "./_m3";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 43 · QUESTIONE DI ISTINTO (manche 3) — tre situazioni rapide, tre reazioni ciascuna. Ogni reazione appartiene a
 * uno di tre STILI annunciati in TV (es. Testa, Cuore, Pancia) ma senza dire quale: il tavolo deve riconoscerli.
 * Regola annunciata prima: tre risposte dello stesso stile = 100, due su tre = 50, tre stili diversi = 0.
 * Nessuna risposta giusta o sbagliata in sé: vince la coerenza. Un voto per tavolo.
 */

export const SITUATIONS = 3;
export const COHERENT_POINTS = POINTS.standard;
export const PARTIAL_POINTS = 50;

const styleSchema = z.object({ id: idSchema, name: text(16) });
const reactionSchema = z.object({ id: idSchema, text: text(90), style: idSchema });
const situationSchema = z.object({ id: idSchema, prompt: text(130), options: z.array(reactionSchema).length(3) });

export const istintoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    styles: z.array(styleSchema).length(3),
    situations: z.array(situationSchema).length(SITUATIONS),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const styles = c.styles.map((s) => s.id);
    if (new Set(styles).size !== 3) ctx.addIssue({ code: "custom", message: "stili duplicati" });
    if (new Set(c.situations.map((s) => s.id)).size !== SITUATIONS) ctx.addIssue({ code: "custom", message: "situazioni duplicate" });
    c.situations.forEach((s, i) => {
      const used = s.options.map((o) => o.style);
      // una reazione per stile: la coerenza è sempre possibile e mai ambigua
      if (new Set(used).size !== 3 || used.some((x) => !styles.includes(x))) ctx.addIssue({ code: "custom", message: `situazione ${s.id}: serve una reazione per stile`, path: ["situations", i] });
      if (new Set(s.options.map((o) => o.id)).size !== 3) ctx.addIssue({ code: "custom", message: `situazione ${s.id}: id ripetuti`, path: ["situations", i] });
    });
  });
export type IstintoContent = z.infer<typeof istintoContent>;
export type IstintoInput = z.input<typeof istintoContent>;

export const istintoSubmission = z.object({ picks: z.record(z.string(), idSchema) });
export type IstintoSubmission = z.infer<typeof istintoSubmission>;

export interface IstintoSituation {
  id: string;
  prompt: string;
  options: Option[];
}

export interface IstintoView extends BaseView {
  /** nomi degli stili (senza dire quale reazione appartiene a quale) */
  styles: { id: string; name: string }[];
  situations: IstintoSituation[];
}

export interface IstintoSummary {
  /** tavoli per reazione, situazione per situazione */
  perSituation: Record<string, Record<string, number>>;
  /** quante reazioni di ogni stile in tutto il locale */
  styleTotals: Record<string, number>;
  stylePercent: Record<string, number>;
  /** tavoli con 3 su 3 */
  coherent: number;
  tables: number;
  /** scelte di ogni tavolo (per rivederle sul telefono) */
  picks: Record<string, Record<string, string>>;
}

export interface IstintoReveal {
  styles: { id: string; name: string }[];
  situations: (IstintoSituation & { styleOf: Record<string, string> })[];
  explain: string;
  summary: IstintoSummary | null;
}

/** Stile più ricorrente nelle scelte e quante volte. */
export function coherence(c: IstintoContent, picks: Record<string, string>): { style: string | null; n: number } {
  const styles = c.situations.map((s) => s.options.find((o) => o.id === picks[s.id])?.style).filter((x): x is string => !!x);
  const counts = tally(
    styles,
    c.styles.map((s) => s.id),
  );
  let best: string | null = null;
  for (const s of c.styles) if ((counts[s.id] ?? 0) > (best ? counts[best] : 0)) best = s.id;
  return { style: best, n: best ? counts[best] : 0 };
}

const def: MechanicDef<IstintoContent, IstintoSubmission> = {
  code: "questione-di-istinto",
  number: 43,
  manche: 3,
  title: "Questione di istinto",
  input: "pub",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Tre situazioni, tre reazioni: ognuna ha uno stile nascosto. Stesso stile 3 volte su 3: 100. Due su tre: 50.",
  contentSchema: istintoContent,
  submissionSchema: istintoSubmission,
  publicView: (c, ctx): IstintoView => ({
    ...baseView(def, ctx),
    styles: c.styles.map((s) => ({ id: s.id, name: s.name })),
    situations: c.situations.map((s) => ({ id: s.id, prompt: s.prompt, options: publicOptions(s.options, `${ctx.seed}:${s.id}`) })),
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx, (s) => content.situations.some((x) => x.options.some((o) => o.id === s.payload.picks[x.id])));
    const perSituation: Record<string, Record<string, number>> = Object.fromEntries(
      content.situations.map((s) => [
        s.id,
        tally(
          [...firsts.values()].map((x) => x.payload.picks[s.id]).filter(Boolean),
          s.options.map((o) => o.id),
        ),
      ]),
    );
    const styleIds = content.styles.map((s) => s.id);
    const styleTotals = tally(
      content.situations.flatMap((s) => [...firsts.values()].map((x) => s.options.find((o) => o.id === x.payload.picks[s.id])?.style ?? "")),
      styleIds,
    );
    let coherent = 0;
    const picks: Record<string, Record<string, string>> = {};
    const out: ScoreWithSummary<IstintoSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        picks[t.teamId] = Object.fromEntries(content.situations.map((x) => [x.id, s.payload.picks[x.id]]).filter(([, v]) => !!v));
        const { style, n } = coherence(content, s.payload.picks);
        const name = content.styles.find((x) => x.id === style)?.name ?? "";
        if (n === SITUATIONS) coherent++;
        return outcome(t.teamId, {
          points: n === SITUATIONS ? COHERENT_POINTS : n === 2 ? PARTIAL_POINTS : 0,
          chaos: CHAOS.partecipa + (n === SITUATIONS ? CHAOS.centro : 0),
          correct: n === SITUATIONS,
          accuracy: Math.round((n / SITUATIONS) * 1000) / 1000,
          label: n === SITUATIONS ? `Coerenza totale: sempre «${name}»` : n === 2 ? `Due su tre «${name}»` : "Tre stili diversi",
        });
      }),
      summary: { perSituation, styleTotals, stylePercent: percentages(styleTotals, styleIds), coherent: 0, tables: firsts.size, picks },
    };
    out.summary!.coherent = coherent;
    return out;
  },
  reveal: (c, out): IstintoReveal => ({
    styles: c.styles,
    situations: c.situations.map((s) => ({ id: s.id, prompt: s.prompt, options: s.options.map((o) => ({ id: o.id, text: o.text })), styleOf: Object.fromEntries(s.options.map((o) => [o.id, o.style])) })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<IstintoSummary>).summary ?? null,
  }),
};

export const questioneDiIstinto: MechanicModule<IstintoContent, IstintoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        // il primo tavolo resta coerente, il secondo quasi, gli altri a caso
        const target = c.styles[i % 3].id;
        return {
          picks: Object.fromEntries(
            c.situations.map((s, k) => {
              const coherent = i === 0 || (i === 1 && k < 2);
              const o = coherent ? s.options.find((x) => x.style === target)! : s.options[Math.floor(rnd() * s.options.length)];
              return [s.id, o.id];
            }),
          ),
        };
      }),
  },
};
