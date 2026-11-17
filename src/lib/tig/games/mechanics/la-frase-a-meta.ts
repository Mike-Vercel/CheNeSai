import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { rngFrom } from "../components/rng";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, pairsOf, type Pair } from "./_m4";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 63 · LA FRASE A METÀ (manche 4) — i tavoli giocano a coppie (con un numero dispari, l'ultimo gioca contro
 * il «banco», che sceglie a caso dal seme e non prende punti). Una «regola della casa» inventata è spezzata:
 * un tavolo vede l'inizio, l'altro la fine. Entrambi, in segreto e nello stesso momento, scelgono:
 * CONDIVIDERE (il gioco consegna all'altro la vera metà) o INGANNARE (gli consegna una metà falsa).
 * Regole uguali per entrambi e visibili PRIMA della scelta:
 *   - se l'altro condivide, la frase intera è vostra: +70;
 *   - se l'altro inganna (o non risponde), vale la vostra ipotesi sulla metà mancante: giusta +40;
 *   - ingannare chi ha condiviso: +30 in più.
 * La metà mancante si deduce dalla coerenza (accordi, riferimenti, logica): mai cultura generale.
 */

export const FRASE_PAYOFF = { patto: 70, ipotesi: 40, inganno: 30 } as const;
export type Mossa = "condividi" | "inganna";

const sentenceSchema = z.object({
  id: idSchema,
  /** di che regola si tratta, es. «La regola del frigo» */
  topic: text(50),
  /** quattro inizi possibili e quattro finali possibili (uno solo vero per parte) */
  starts: optionsSchema(4, 4),
  ends: optionsSchema(4, 4),
});
type Sentence = z.infer<typeof sentenceSchema>;

export const fraseContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    sentences: z.array(sentenceSchema).length(2),
    solution: z.object({ sentences: z.record(z.string(), z.object({ start: idSchema, end: idSchema, why: text(240) })) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.sentences.map((s) => s.id)).size !== 2) ctx.addIssue({ code: "custom", message: "id delle frasi duplicati" });
    c.sentences.forEach((s, i) => {
      const sol = c.solution.sentences[s.id];
      if (!sol) {
        ctx.addIssue({ code: "custom", message: `manca la soluzione di ${s.id}`, path: ["sentences", i] });
        return;
      }
      checkOptions(s.starts, [sol.start], ctx, ["sentences", i, "starts"]);
      checkOptions(s.ends, [sol.end], ctx, ["sentences", i, "ends"]);
    });
  });
export type FraseContent = z.infer<typeof fraseContent>;
export type FraseInput = z.input<typeof fraseContent>;

export const fraseSubmission = z.object({
  move: z.enum(["condividi", "inganna"]),
  /** ipotesi sulla metà che non si vede */
  guess: idSchema,
});
export type FraseSubmission = z.infer<typeof fraseSubmission>;

export interface FraseView extends BaseView {
  pairs: { index: number; topic: string; a: { teamId: string; tableNo: number }; b: { teamId: string; tableNo: number } | null }[];
  payoff: typeof FRASE_PAYOFF;
}

export interface FraseMemberView {
  /** «inizio» = vedete l'inizio e cercate il finale; «fine» = il contrario */
  side: "inizio" | "fine";
  topic: string;
  /** la vostra metà (vera) */
  mine: string;
  /** candidati per la metà mancante */
  candidates: Option[];
  /** l'altro tavolo (null = il banco) */
  partner: { teamId: string; tableNo: number } | null;
}

export interface FrasePairResult {
  index: number;
  a: string;
  b: string | null;
  moveA: Mossa | null;
  moveB: Mossa | null;
}

export interface FraseSummary {
  pairs: FrasePairResult[];
}

export interface FraseReveal {
  sentences: { id: string; topic: string; start: string; end: string; why: string }[];
  /** frase usata da ogni coppia (indice nella lista sopra) */
  pairSentence: number[];
  explain: string;
  summary: FraseSummary | null;
}

function sentenceOf(c: FraseContent, pair: Pair): Sentence {
  return c.sentences[pair.index % c.sentences.length];
}

/** Mossa del banco (coppia con un tavolo solo): a caso ma fissata dal seme. */
export function bancoMove(ctx: PhaseCtx, index: number): Mossa {
  return rngFrom(`${ctx.seed}:banco:${index}`)() < 0.5 ? "condividi" : "inganna";
}

interface Where {
  pair: Pair;
  side: "inizio" | "fine";
  partner: string | null;
}

function whereIs(ctx: PhaseCtx): Map<string, Where> {
  const out = new Map<string, Where>();
  for (const p of pairsOf(ctx)) {
    out.set(p.a.teamId, { pair: p, side: "inizio", partner: p.b?.teamId ?? null });
    if (p.b) out.set(p.b.teamId, { pair: p, side: "fine", partner: p.a.teamId });
  }
  return out;
}

const def: MechanicDef<FraseContent, FraseSubmission> = {
  code: "la-frase-a-meta",
  number: 63,
  manche: 4,
  title: "La frase a metà",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Voi avete metà frase, l'altro tavolo l'altra metà. Condividete o ingannate? Se condivide +70; se inganna vale la vostra ipotesi.",
  contentSchema: fraseContent,
  submissionSchema: fraseSubmission,
  publicView: (c, ctx): FraseView => ({
    ...baseView(def, ctx),
    pairs: pairsOf(ctx).map((p) => ({ index: p.index, topic: sentenceOf(c, p).topic, a: p.a, b: p.b })),
    payoff: FRASE_PAYOFF,
  }),
  memberView: (c, ctx): FraseMemberView => {
    const w = whereIs(ctx).get(ctx.teamId);
    const pair = w?.pair ?? pairsOf(ctx)[0];
    const s = sentenceOf(c, pair);
    const sol = c.solution.sentences[s.id];
    const side = w?.side ?? "inizio";
    const partner = w?.partner ? (side === "inizio" ? pair.b : pair.a) : null;
    return {
      side,
      topic: s.topic,
      mine: side === "inizio" ? s.starts.find((o) => o.id === sol.start)!.text : s.ends.find((o) => o.id === sol.end)!.text,
      candidates: publicOptions(side === "inizio" ? s.ends : s.starts, `${ctx.seed}:${s.id}:${side}`),
      partner,
    };
  },
  score: ({ content, ctx, submissions }) => {
    const where = whereIs(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const moveOf = (teamId: string | null, pair: Pair): Mossa | null => (teamId ? (firsts.get(teamId)?.payload.move ?? null) : bancoMove(ctx, pair.index));
    const summary: FraseSummary = {
      pairs: pairsOf(ctx).map((p) => ({ index: p.index, a: p.a.teamId, b: p.b?.teamId ?? null, moveA: moveOf(p.a.teamId, p), moveB: moveOf(p.b?.teamId ?? null, p) })),
    };
    const out: ScoreWithSummary<FraseSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const w = where.get(t.teamId)!;
        const sent = sentenceOf(content, w.pair);
        const sol = content.solution.sentences[sent.id];
        const partnerMove = moveOf(w.partner, w.pair);
        const guessOk = s.payload.guess === (w.side === "inizio" ? sol.end : sol.start);
        const shared = partnerMove === "condividi";
        let pts = shared ? FRASE_PAYOFF.patto : guessOk ? FRASE_PAYOFF.ipotesi : 0;
        const parts = [shared ? (s.payload.move === "condividi" ? "patto rispettato" : "vi hanno passato la frase") : partnerMove === "inganna" ? `ingannati · ipotesi ${guessOk ? "giusta" : "sbagliata"}` : `ipotesi ${guessOk ? "giusta" : "sbagliata"}`];
        const tricked = s.payload.move === "inganna" && shared;
        if (tricked) {
          pts += FRASE_PAYOFF.inganno;
          parts.push("inganno riuscito");
        }
        const full = shared || guessOk;
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (full ? CHAOS.centro : 0) + (s.payload.move === "inganna" ? CHAOS.rischio : 0) + (tricked ? CHAOS.sfida : 0),
          correct: full,
          accuracy: full ? 1 : 0,
          label: parts.join(" · "),
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): FraseReveal => ({
    sentences: c.sentences.map((s) => {
      const sol = c.solution.sentences[s.id];
      return { id: s.id, topic: s.topic, start: s.starts.find((o) => o.id === sol.start)!.text, end: s.ends.find((o) => o.id === sol.end)!.text, why: sol.why };
    }),
    pairSentence: ((out as ScoreWithSummary<FraseSummary>).summary?.pairs ?? []).map((p) => p.index % c.sentences.length),
    explain: c.explain,
    summary: (out as ScoreWithSummary<FraseSummary>).summary ?? null,
  }),
};

export const laFraseAMeta: MechanicModule<FraseContent, FraseSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const where = whereIs(ctx);
      const teams = scopeTeams(ctx);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const w = where.get(teams[i].teamId)!;
        const s = sentenceOf(c, w.pair);
        const sol = c.solution.sentences[s.id];
        const cands = (w.side === "inizio" ? s.ends : s.starts).map((o) => o.id);
        return { move: i % 3 === 2 ? "inganna" : "condividi", guess: pickAnswer(rnd, w.side === "inizio" ? sol.end : sol.start, cands, demoSkill(i) + 0.05) };
      });
    },
  },
};
