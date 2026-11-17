import { z } from "zod";
import type { MechanicDef, MemberCtx, PhaseCtx, TeamRef } from "../contract";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { difficultySchema, groupsOf, type TableRef } from "./m2/shared";

/**
 * 27 · IL PATTO DI 60 SECONDI (manche 2) — i tavoli sono accoppiati dal seme (con un numero dispari, un terzetto).
 * Il codice della cassaforte ha 6 cifre; ogni cifra è la risposta a un indizio. Ogni tavolo VEDE SOLO i suoi
 * indizi (metà del codice; un terzo nel terzetto) sul telefono: per aprire bisogna parlarsi tra tavoli.
 * Tutti i tavoli del patto inseriscono il codice intero:
 *   - tutti giusti → patto rispettato: +100 a ciascuno (bonus uguale per tutti);
 *   - solo qualcuno giusto → patto a metà: +40 a chi l'ha giusto;
 *   - nessuno → 0.
 * Gli indizi non entrano mai nella vista pubblica (né in TV): solo in quella del proprio tavolo.
 */

export const CODE_LEN = 6;
export const PATTO = { full: 100, half: 40 } as const;

export const pattoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** cosa si apre, es. «La cassaforte del bar» */
    theme: text(50),
    /** un indizio per cifra, nell'ordine del codice (ognuno ha per risposta una sola cifra) */
    clues: z.array(text(140)).length(CODE_LEN),
    solution: z.object({ code: z.string().regex(/^\d{6}$/) }),
    explain: explainSchema,
  });
export type PattoContent = z.infer<typeof pattoContent>;
export type PattoInput = z.input<typeof pattoContent>;

export const pattoSubmission = z.object({ digits: z.string().regex(/^\d{6}$/) });
export type PattoSubmission = z.infer<typeof pattoSubmission>;

export interface PattoView extends BaseView {
  theme: string;
  codeLength: number;
  /** i patti: gruppi di 2 (o 3) tavoli */
  pacts: TableRef[][];
  points: typeof PATTO;
}

export interface PattoMemberView {
  /** i tavoli con cui si è in patto (escluso il proprio) */
  partners: TableRef[];
  /** gli indizi di questo tavolo: posizione nel codice (0-based) e testo */
  clues: { pos: number; text: string }[];
}

export interface PattoGroupResult {
  teams: string[];
  correct: string[];
}

export interface PattoSummary {
  groups: PattoGroupResult[];
}

export interface PattoReveal {
  theme: string;
  clues: { pos: number; text: string; digit: string }[];
  codeDigits: string;
  explain: string;
  summary: PattoSummary | null;
}

function pactsOf(ctx: PhaseCtx): TeamRef[][] {
  const teams = scopeTeams(ctx);
  const byId = new Map(teams.map((t) => [t.teamId, t]));
  return groupsOf(
    teams.map((t) => t.teamId),
    ctx.seed,
    "trio",
  ).map((g) => g.map((id) => byId.get(id)!));
}

/** Posizioni del codice assegnate al k-esimo tavolo di un patto da n tavoli. */
export function positionsFor(k: number, n: number): number[] {
  const all = Array.from({ length: CODE_LEN }, (_, i) => i);
  if (n <= 1) return all;
  const per = Math.ceil(CODE_LEN / n);
  return all.slice(k * per, Math.min(CODE_LEN, (k + 1) * per));
}

const def: MechanicDef<PattoContent, PattoSubmission> = {
  code: "il-patto-di-60-secondi",
  number: 27,
  manche: 2,
  title: "Il patto di 60 secondi",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Ogni tavolo vede solo metà degli indizi del codice: parlate col tavolo del patto! Tutti giusti: +100 a testa.",
  contentSchema: pattoContent,
  submissionSchema: pattoSubmission,
  publicView: (c, ctx): PattoView => ({
    ...baseView(def, ctx),
    theme: c.theme,
    codeLength: CODE_LEN,
    pacts: pactsOf(ctx).map((g) => g.map((t) => ({ teamId: t.teamId, tableNo: t.tableNo }))),
    points: PATTO,
  }),
  memberView: (c, ctx: MemberCtx): PattoMemberView => {
    const group = pactsOf(ctx).find((g) => g.some((t) => t.teamId === ctx.teamId)) ?? [];
    const k = group.findIndex((t) => t.teamId === ctx.teamId);
    if (k < 0) return { partners: [], clues: [] };
    return {
      partners: group.filter((t) => t.teamId !== ctx.teamId).map((t) => ({ teamId: t.teamId, tableNo: t.tableNo })),
      clues: positionsFor(k, group.length).map((pos) => ({ pos, text: c.clues[pos] })),
    };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const right = (id: string) => firsts.get(id)?.payload.digits === content.solution.code;
    const groups: PattoGroupResult[] = pactsOf(ctx).map((g) => ({ teams: g.map((t) => t.teamId), correct: g.filter((t) => right(t.teamId)).map((t) => t.teamId) }));
    const out: ScoreWithSummary<PattoSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const g = groups.find((x) => x.teams.includes(t.teamId))!;
        const full = g.correct.length === g.teams.length;
        const ok = right(t.teamId);
        const digitsOk = s.payload.digits.split("").filter((d, i) => d === content.solution.code[i]).length;
        return outcome(t.teamId, {
          points: full ? PATTO.full : ok ? PATTO.half : 0,
          chaos: CHAOS.partecipa + (full && g.teams.length > 1 ? CHAOS.sfida : 0) + (ok ? CHAOS.centro : 0),
          correct: ok,
          accuracy: digitsOk / CODE_LEN,
          label: full ? (g.teams.length > 1 ? "Patto rispettato: cassaforte aperta" : "Cassaforte aperta") : ok ? "Patto a metà: il vostro codice era giusto" : `Codice sbagliato · ${digitsOk} cifre su ${CODE_LEN}`,
        });
      }),
      summary: { groups },
    };
    return out;
  },
  reveal: (c, out): PattoReveal => ({
    theme: c.theme,
    clues: c.clues.map((text, pos) => ({ pos, text, digit: c.solution.code[pos] })),
    codeDigits: c.solution.code,
    explain: c.explain,
    summary: (out as ScoreWithSummary<PattoSummary>).summary ?? null,
  }),
};

export const ilPattoDi60Secondi: MechanicModule<PattoContent, PattoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        if (rnd() < demoSkill(i) + 0.15) return { digits: c.solution.code };
        const k = Math.floor(rnd() * CODE_LEN);
        return { digits: c.solution.code.slice(0, k) + String((Number(c.solution.code[k]) + 1) % 10) + c.solution.code.slice(k + 1) };
      }),
  },
};
