import { z } from "zod";
import type { AcceptedSubmission, MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, seatMap, seatsOf } from "./_m4";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 55 · FIDUCIA CIECA (manche 4) — tutti i tavoli hanno lo stesso rompicapo «chi mente?» (personaggi
 * inventati, una o due bugie dichiarate). I tavoli formano un giro: la risposta di ogni tavolo diventa il
 * SUGGERIMENTO per il tavolo successivo. Ogni tavolo decide, senza vederlo, se accettare il suggerimento del
 * precedente (fiducia cieca) o risolvere da solo. Punti simmetrici, uguali per tutti i tavoli:
 *   da soli, giusta                      → +100
 *   fiducia, il suggerimento è giusto     → +70 a chi si fida, +30 a chi l'ha suggerito
 *   fiducia, il suggerimento è sbagliato  → 0 (nessuna penalità per nessuno)
 * Se chi suggerisce si è fidato a sua volta, passa avanti la risposta che ha ricevuto (catena); se il giro
 * è tutto di fiducia, nessuno ha risposto davvero e nessuno prende punti. Rompicapo verificato dallo schema:
 * con il numero di bugie dichiarato esiste un solo colpevole possibile.
 */

export const FIDUCIA_PAYOFF = { soli: 100, fiducia: 70, suggerito: 30 } as const;

const claimSchema = z.object({
  /** «is» = il colpevole è tra `who`; «isnt» = il colpevole non è tra `who` */
  kind: z.enum(["is", "isnt"]),
  who: z.array(idSchema).min(1).max(3),
});

const statementSchema = z.object({ by: idSchema, text: text(150), claim: claimSchema });
type Statement = z.infer<typeof statementSchema>;

/** Colpevoli compatibili con esattamente `liars` frasi false. */
export function consistentCulprits(people: readonly string[], statements: readonly Statement[], liars: number): string[] {
  return people.filter((c) => statements.filter((s) => s.claim.who.includes(c) !== (s.claim.kind === "is")).length === liars);
}

/** Chi mente, dato il colpevole. */
export function liarsFor(culprit: string, statements: readonly Statement[]): string[] {
  return statements.filter((s) => s.claim.who.includes(culprit) !== (s.claim.kind === "is")).map((s) => s.by);
}

export const fiduciaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    title: text(70),
    /** il fatto, es. «Qualcuno ha finito il gelato al pistacchio» */
    act: text(120),
    people: optionsSchema(4, 4),
    statements: z.array(statementSchema).length(4),
    liars: z.union([z.literal(1), z.literal(2)]),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.people, [c.solution.optionId], ctx, ["people"]);
    const ids = c.people.map((p) => p.id);
    if (new Set(c.statements.map((s) => s.by)).size !== c.statements.length) ctx.addIssue({ code: "custom", message: "ognuno parla una volta" });
    for (const s of c.statements) {
      if (!ids.includes(s.by)) ctx.addIssue({ code: "custom", message: `parla «${s.by}» che non esiste` });
      for (const w of s.claim.who) if (!ids.includes(w)) ctx.addIssue({ code: "custom", message: `frase su «${w}» che non esiste` });
    }
    const ok = consistentCulprits(ids, c.statements, c.liars);
    if (ok.length !== 1 || ok[0] !== c.solution.optionId) ctx.addIssue({ code: "custom", message: `colpevoli compatibili: ${JSON.stringify(ok)}` });
  });
export type FiduciaContent = z.infer<typeof fiduciaContent>;
export type FiduciaInput = z.input<typeof fiduciaContent>;

export const fiduciaSubmission = z
  .object({
    /** accettiamo al buio il suggerimento del tavolo precedente */
    trust: z.boolean(),
    /** risposta propria (obbligatoria se non ci si fida; diventa il suggerimento per il tavolo successivo) */
    answer: idSchema.optional(),
  })
  .refine((s) => s.trust || !!s.answer, { message: "senza fiducia serve una risposta" });
export type FiduciaSubmission = z.infer<typeof fiduciaSubmission>;

export interface FiduciaView extends BaseView {
  title: string;
  act: string;
  liars: number;
  people: Option[];
  statements: { by: string; text: string }[];
  /** giro: chi suggerisce a chi */
  seats: { teamId: string; tableNo: number; tellsTo: string | null; hearsFrom: string | null }[];
  payoff: typeof FIDUCIA_PAYOFF;
}

export interface FiduciaLink {
  teamId: string;
  trusted: boolean | null;
  /** risposta finale del tavolo (propria o arrivata dalla catena) */
  finalId: string | null;
  /** tavolo che ha davvero risolto (null = nessuno) */
  sourceId: string | null;
  correct: boolean | null;
}

export interface FiduciaSummary {
  links: FiduciaLink[];
}

export interface FiduciaReveal {
  title: string;
  act: string;
  people: Option[];
  statements: { by: string; text: string; lie: boolean }[];
  solutionId: string;
  explain: string;
  summary: FiduciaSummary | null;
}

/** Risposta finale di ogni tavolo seguendo la catena della fiducia. */
export function resolveChain(seats: ReturnType<typeof seatsOf>, firsts: Map<string, AcceptedSubmission<FiduciaSubmission>>): Map<string, { finalId: string | null; sourceId: string | null }> {
  const byId = seatMap(seats);
  const out = new Map<string, { finalId: string | null; sourceId: string | null }>();
  for (const s of seats) {
    const seen = new Set<string>();
    let cur: string | null = s.teamId;
    let res: { finalId: string | null; sourceId: string | null } = { finalId: null, sourceId: null };
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const sub = firsts.get(cur);
      if (!sub) break;
      const seat = byId.get(cur);
      if (!sub.payload.trust || !seat?.hearsFrom) {
        res = { finalId: sub.payload.answer ?? null, sourceId: sub.payload.answer ? cur : null };
        break;
      }
      cur = seat.hearsFrom;
    }
    out.set(s.teamId, res);
  }
  return out;
}

const def: MechanicDef<FiduciaContent, FiduciaSubmission> = {
  code: "fiducia-cieca",
  number: 55,
  manche: 4,
  title: "Fiducia cieca",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "La vostra risposta sarà il suggerimento per il tavolo dopo. Fidatevi al buio di chi vi precede (70) o risolvete da soli (100).",
  contentSchema: fiduciaContent,
  submissionSchema: fiduciaSubmission,
  publicView: (c, ctx): FiduciaView => {
    const seats = seatsOf(ctx);
    const name = new Map(c.people.map((p) => [p.id, p.text]));
    return {
      ...baseView(def, ctx),
      title: c.title,
      act: c.act,
      liars: c.liars,
      people: publicOptions(c.people, `${ctx.seed}:persone`),
      statements: c.statements.map((s) => ({ by: name.get(s.by) ?? s.by, text: s.text })),
      seats: seats.map((s) => ({ teamId: s.teamId, tableNo: s.tableNo, tellsTo: s.tellsTo, hearsFrom: s.hearsFrom })),
      payoff: FIDUCIA_PAYOFF,
    };
  },
  score: ({ content, ctx, submissions }) => {
    const seats = seatsOf(ctx);
    const byId = seatMap(seats);
    const firsts = firstPerTeam(submissions, ctx);
    const chain = resolveChain(seats, firsts);
    const truth = content.solution.optionId;
    const links: FiduciaLink[] = seats.map((s) => {
      const sub = firsts.get(s.teamId);
      const r = chain.get(s.teamId)!;
      return { teamId: s.teamId, trusted: sub ? sub.payload.trust && !!s.hearsFrom : null, finalId: sub ? r.finalId : null, sourceId: sub ? r.sourceId : null, correct: sub ? (r.finalId ? r.finalId === truth : false) : null };
    });
    const link = new Map(links.map((l) => [l.teamId, l]));
    const out: ScoreWithSummary<FiduciaSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const sub = firsts.get(t.teamId);
        // senza invio la catena si interrompe qui: nessuno riceve la nostra risposta
        if (!sub) return noAnswer(t.teamId);
        const seat = byId.get(t.teamId)!;
        // bonus da suggeritore: il tavolo dopo si è fidato e ha avuto la risposta giusta
        const next = seat.tellsTo ? link.get(seat.tellsTo) : undefined;
        const helped = !!next?.trusted && !!next.correct;
        const me = link.get(t.teamId)!;
        const ok = !!me.correct;
        let pts = 0;
        const parts: string[] = [];
        if (me.trusted) {
          if (ok) pts += FIDUCIA_PAYOFF.fiducia;
          parts.push(me.finalId === null ? "fiducia senza risposta" : ok ? "fiducia ripagata" : "fiducia tradita");
        } else {
          if (ok) pts += FIDUCIA_PAYOFF.soli;
          parts.push(ok ? "da soli: esatto" : "da soli: sbagliato");
        }
        if (helped) {
          pts += FIDUCIA_PAYOFF.suggerito;
          parts.push("suggerimento d'oro");
        }
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (ok ? CHAOS.centro : 0) + (me.trusted ? CHAOS.rischio : 0) + (helped ? CHAOS.sfida : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: parts.join(" · "),
        });
      }),
      summary: { links },
    };
    return out;
  },
  reveal: (c, out): FiduciaReveal => {
    const liars = new Set(liarsFor(c.solution.optionId, c.statements));
    const name = new Map(c.people.map((p) => [p.id, p.text]));
    return {
      title: c.title,
      act: c.act,
      people: c.people,
      statements: c.statements.map((s) => ({ by: name.get(s.by) ?? s.by, text: s.text, lie: liars.has(s.by) })),
      solutionId: c.solution.optionId,
      explain: c.explain,
      summary: (out as ScoreWithSummary<FiduciaSummary>).summary ?? null,
    };
  },
};

export const fiduciaCieca: MechanicModule<FiduciaContent, FiduciaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const trust = i % 3 === 1;
        const answer = pickAnswer(rnd, c.solution.optionId, c.people.map((p) => p.id), demoSkill(i));
        return trust ? { trust: true } : { trust: false, answer };
      }),
  },
};
