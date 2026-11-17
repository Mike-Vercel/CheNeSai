import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, seatMap, seatsOf, type Seat } from "./_m4";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 56 · LA BUGIA PIÙ CREDIBILE (manche 4) — i tavoli formano un giro e ognuno ha un piccolo caso inventato
 * (tre casi per variante: due vicini non hanno mai lo stesso). La verità di ogni caso è fatta di 3 pezzi
 * (es. chi / dove / quando), ciascuno da scegliere tra 3 opzioni PREDEFINITE: niente testo libero.
 * Ogni tavolo, nello stesso minuto:
 *   1. ricostruisce la verità del PROPRIO caso dai fatti: 30 punti a pezzo giusto, 100 se tutti e tre;
 *   2. conosce la verità del caso del tavolo successivo e ne COMPONE una bugia credibile cambiando un solo
 *      pezzo: se il tavolo successivo sceglie proprio quel pezzo falso, la bugia è stata creduta (+40).
 * Il motore non fa vedere gli invii degli altri durante la prova, quindi la bugia non viene «mostrata»:
 * vince chi prevede l'errore più probabile dell'avversario (vedi note della manche).
 */

export const BUGIA_CASES = 3;
export const BUGIA_PARTS = 3;
export const BUGIA_PAYOFF = { pezzo: 30, tutto: 100, creduta: 40 } as const;

const partSchema = z.object({ id: idSchema, label: text(20), options: optionsSchema(3, 3) });

const caseSchema = z.object({
  id: idSchema,
  title: text(60),
  question: text(120),
  facts: z.array(text(170)).min(2).max(4),
  parts: z.array(partSchema).length(BUGIA_PARTS),
});
type BugiaCase = z.infer<typeof caseSchema>;

export const bugiaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    cases: z.array(caseSchema).length(BUGIA_CASES),
    solution: z.object({
      /** per caso: opzione vera di ogni pezzo (nell'ordine dei pezzi) e perché */
      cases: z.record(z.string(), z.object({ real: z.array(idSchema).length(BUGIA_PARTS), why: text(240) })),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.cases.map((k) => k.id)).size !== BUGIA_CASES) ctx.addIssue({ code: "custom", message: "id dei casi duplicati" });
    c.cases.forEach((k, i) => {
      const sol = c.solution.cases[k.id];
      if (!sol) {
        ctx.addIssue({ code: "custom", message: `manca la soluzione di ${k.id}`, path: ["cases", i] });
        return;
      }
      if (new Set(k.parts.map((p) => p.id)).size !== BUGIA_PARTS) ctx.addIssue({ code: "custom", message: "id dei pezzi duplicati", path: ["cases", i] });
      k.parts.forEach((p, j) => checkOptions(p.options, [sol.real[j]], ctx, ["cases", i, "parts", j]));
    });
  });
export type BugiaContent = z.infer<typeof bugiaContent>;
export type BugiaInput = z.input<typeof bugiaContent>;

export const bugiaSubmission = z.object({
  /** bugia per il caso del tavolo successivo: un'opzione per pezzo, esattamente un pezzo diverso dal vero */
  lie: z.array(idSchema).length(BUGIA_PARTS).optional(),
  /** ricostruzione del proprio caso */
  guess: z.array(idSchema).length(BUGIA_PARTS),
});
export type BugiaSubmission = z.infer<typeof bugiaSubmission>;

export interface PublicBugiaCase {
  id: string;
  title: string;
  question: string;
  facts: string[];
  parts: { id: string; label: string; options: Option[] }[];
}

export interface BugiaView extends BaseView {
  seats: { teamId: string; tableNo: number; tellsTo: string | null; hearsFrom: string | null }[];
  payoff: typeof BUGIA_PAYOFF;
}

export interface BugiaMemberView {
  myCase: PublicBugiaCase;
  /** caso del tavolo successivo con la sua verità (solo per questo tavolo) */
  tellsTo: { teamId: string; tableNo: number; case: PublicBugiaCase; real: string[] } | null;
  hearsFrom: { teamId: string; tableNo: number } | null;
}

export interface BugiaLink {
  from: string;
  to: string;
  /** indice del pezzo falsificato (null = bugia non valida o non inviata) */
  part: number | null;
  /** testo dell'opzione falsa */
  fake: string | null;
  /** il ricevente ha scelto proprio quel pezzo falso (null = non ha risposto) */
  believed: boolean | null;
}

export interface BugiaSummary {
  links: BugiaLink[];
}

export interface BugiaReveal {
  cases: (PublicBugiaCase & { real: string[]; why: string })[];
  explain: string;
  summary: BugiaSummary | null;
}

function publicCase(k: BugiaCase, seed: string): PublicBugiaCase {
  return { id: k.id, title: k.title, question: k.question, facts: k.facts, parts: k.parts.map((p) => ({ id: p.id, label: p.label, options: publicOptions(p.options, `${seed}:${k.id}:${p.id}`) })) };
}

interface Layout {
  seats: Seat[];
  caseOf: Map<string, BugiaCase>;
}

function layout(c: BugiaContent, ctx: PhaseCtx): Layout {
  const seats = seatsOf(ctx, BUGIA_CASES);
  return { seats, caseOf: new Map(seats.map((s) => [s.teamId, c.cases[s.color]])) };
}

/** Pezzo falsificato da una bugia (esattamente uno diverso dal vero, opzioni valide), altrimenti null. */
export function lieTarget(k: BugiaCase, real: readonly string[], lie: readonly string[] | undefined): number | null {
  if (!lie || lie.length !== BUGIA_PARTS) return null;
  const diff: number[] = [];
  for (let i = 0; i < BUGIA_PARTS; i++) {
    if (!k.parts[i].options.some((o) => o.id === lie[i])) return null;
    if (lie[i] !== real[i]) diff.push(i);
  }
  return diff.length === 1 ? diff[0] : null;
}

const def: MechanicDef<BugiaContent, BugiaSubmission> = {
  code: "la-bugia-piu-credibile",
  number: 56,
  manche: 4,
  title: "La bugia più credibile",
  input: "duel",
  timerSec: 65,
  oneDeviceOk: true,
  needs: [],
  rule: "Ricostruite la verità del vostro caso (30 a pezzo, 100 tutto). Per il tavolo dopo componete una bugia: se ci casca, +40.",
  contentSchema: bugiaContent,
  submissionSchema: bugiaSubmission,
  publicView: (c, ctx): BugiaView => ({
    ...baseView(def, ctx),
    seats: layout(c, ctx).seats.map((s) => ({ teamId: s.teamId, tableNo: s.tableNo, tellsTo: s.tellsTo, hearsFrom: s.hearsFrom })),
    payoff: BUGIA_PAYOFF,
  }),
  memberView: (c, ctx): BugiaMemberView => {
    const { seats, caseOf } = layout(c, ctx);
    const byId = seatMap(seats);
    const me = byId.get(ctx.teamId);
    const mine = caseOf.get(ctx.teamId) ?? c.cases[0];
    const next = me?.tellsTo ? byId.get(me.tellsTo) : undefined;
    const nextCase = next ? caseOf.get(next.teamId) : undefined;
    const prev = me?.hearsFrom ? byId.get(me.hearsFrom) : undefined;
    return {
      myCase: publicCase(mine, ctx.seed),
      tellsTo: next && nextCase ? { teamId: next.teamId, tableNo: next.tableNo, case: publicCase(nextCase, ctx.seed), real: c.solution.cases[nextCase.id].real } : null,
      hearsFrom: prev ? { teamId: prev.teamId, tableNo: prev.tableNo } : null,
    };
  },
  score: ({ content, ctx, submissions }) => {
    const { seats, caseOf } = layout(content, ctx);
    const byId = seatMap(seats);
    const firsts = firstPerTeam(submissions, ctx);
    const realOf = (teamId: string) => content.solution.cases[caseOf.get(teamId)!.id].real;
    const linkOf = (s: Seat): BugiaLink | null => {
      if (!s.tellsTo) return null;
      const sub = firsts.get(s.teamId);
      const k = caseOf.get(s.tellsTo)!;
      const part = sub ? lieTarget(k, realOf(s.tellsTo), sub.payload.lie) : null;
      const rec = firsts.get(s.tellsTo);
      const fakeId = part !== null ? sub!.payload.lie![part] : null;
      return {
        from: s.teamId,
        to: s.tellsTo,
        part,
        fake: fakeId ? (k.parts[part!].options.find((o) => o.id === fakeId)?.text ?? null) : null,
        believed: part === null || !rec ? null : rec.payload.guess[part] === fakeId,
      };
    };
    const links = seats.map(linkOf).filter((l): l is BugiaLink => !!l);
    const linkFrom = new Map(links.map((l) => [l.from, l]));
    const out: ScoreWithSummary<BugiaSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const sub = firsts.get(t.teamId);
        if (!sub) return noAnswer(t.teamId);
        const real = realOf(t.teamId);
        const right = real.filter((id, i) => sub.payload.guess[i] === id).length;
        let pts = right === BUGIA_PARTS ? BUGIA_PAYOFF.tutto : right * BUGIA_PAYOFF.pezzo;
        const parts = [right === BUGIA_PARTS ? "verità ricostruita" : `${right} pezzi su 3`];
        const mine = linkFrom.get(t.teamId);
        const believed = !!mine?.believed;
        if (believed) {
          pts += BUGIA_PAYOFF.creduta;
          parts.push("bugia creduta");
        } else if (mine && mine.part !== null && mine.believed === false) parts.push("bugia scartata");
        // il tavolo precedente ci ha ingannato?
        const prev = byId.get(t.teamId)?.hearsFrom;
        if (prev && linkFrom.get(prev)?.believed) parts.push("ci siamo cascati");
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (right === BUGIA_PARTS ? CHAOS.centro : 0) + (mine && mine.part !== null ? CHAOS.rischio : 0) + (believed ? CHAOS.sfida : 0),
          correct: right === BUGIA_PARTS,
          accuracy: Math.round((right / BUGIA_PARTS) * 1000) / 1000,
          label: parts.join(" · "),
        });
      }),
      summary: { links },
    };
    return out;
  },
  reveal: (c, out): BugiaReveal => ({
    cases: c.cases.map((k) => ({ ...publicCase(k, "reveal"), parts: k.parts.map((p) => ({ id: p.id, label: p.label, options: p.options })), real: c.solution.cases[k.id].real, why: c.solution.cases[k.id].why })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<BugiaSummary>).summary ?? null,
  }),
};

export const laBugiaPiuCredibile: MechanicModule<BugiaContent, BugiaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const { seats, caseOf } = layout(c, ctx);
      const byId = seatMap(seats);
      const teams = scopeTeams(ctx);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const me = byId.get(teams[i].teamId)!;
        const mine = caseOf.get(me.teamId)!;
        const real = c.solution.cases[mine.id].real;
        // ricostruzione: ogni pezzo giusto con probabilità pari all'abilità, altrimenti la prima opzione falsa
        const guess = mine.parts.map((p, j) => (rnd() < demoSkill(i) ? real[j] : p.options.find((o) => o.id !== real[j])!.id));
        let lie: string[] | undefined;
        if (me.tellsTo) {
          const k = caseOf.get(me.tellsTo)!;
          const r = c.solution.cases[k.id].real;
          const j = i % BUGIA_PARTS;
          lie = r.map((id, x) => (x === j ? k.parts[x].options.find((o) => o.id !== id)!.id : id));
        }
        return lie ? { lie, guess } : { guess };
      });
    },
  },
};
