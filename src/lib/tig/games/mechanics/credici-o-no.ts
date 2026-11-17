import { z } from "zod";
import type { MechanicDef, PhaseCtx, TeamRef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { ring, ringColors, type RingLink } from "../components/pairing";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 49 · CREDICI O NO (manche 4) — i tavoli formano un giro: ognuno CONOSCE la soluzione del caso del tavolo
 * successivo e gli manda un suggerimento (vero o bluff); intanto decide se FIDARSI del suggerimento che
 * riceve dal precedente (senza vederlo) o risolvere il proprio caso da solo con gli indizi pubblici.
 * Tutto è simultaneo e sigillato: il reveal mostra chi ha detto il vero e chi si è fidato.
 * Bugie solo sui casi inventati del gioco, mai sui giocatori. Tetto: 100 a tavolo.
 *
 * Per ogni coppia «chi suggerisce → chi riceve»:
 *   verità + fiducia  → ricevente +50, chi suggerisce +20 (alleanza)
 *   verità + sospetto → ricevente +50 se risolve da solo, chi suggerisce +10
 *   bluff  + fiducia  → chi suggerisce +40 (bluff riuscito), ricevente 0
 *   bluff  + sospetto → ricevente +40 (bluff smascherato) + 50 se risolve da solo
 */

export const PAYOFF = {
  alleanza: { receiver: 50, teller: 20 },
  onesti: { teller: 10 },
  bluffRiuscito: { teller: 40 },
  smascherato: { receiver: 40 },
  daSoli: { receiver: 50 },
} as const;
export const TEAM_CAP = 100;
export const CASES = 3;

const caseSchema = z.object({
  id: idSchema,
  title: text(50),
  question: text(140),
  /** indizi pubblici con cui il caso si risolve anche da soli (con un po' di ragionamento) */
  facts: z.array(text(150)).min(2).max(4),
  options: optionsSchema(4, 4),
});
export type BluffCase = z.infer<typeof caseSchema>;

export const crediciContent = z
  .object({
    id: variantId,
    cases: z.array(caseSchema).length(CASES),
    solution: z.object({ cases: z.record(z.string(), z.object({ optionId: idSchema, why: text(200) })) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.cases.map((k) => k.id)).size !== CASES) ctx.addIssue({ code: "custom", message: "id dei casi duplicati" });
    c.cases.forEach((k, i) => {
      const sol = c.solution.cases[k.id];
      if (!sol) ctx.addIssue({ code: "custom", message: `manca la soluzione del caso ${k.id}`, path: ["cases", i] });
      else checkOptions(k.options, [sol.optionId], ctx, ["cases", i]);
    });
  });
export type CrediciContent = z.infer<typeof crediciContent>;
export type CrediciInput = z.input<typeof crediciContent>;

export const crediciSubmission = z.object({
  /** opzione (del caso del tavolo che riceve) mandata come suggerimento: quella vera o un bluff */
  tip: idSchema,
  /** ci fidiamo del suggerimento che arriva, senza vederlo */
  trust: z.boolean(),
  /** risposta propria (conta solo se non ci si fida) */
  answer: idSchema.optional(),
});
export type CrediciSubmission = z.infer<typeof crediciSubmission>;

export interface PublicCase {
  id: string;
  title: string;
  question: string;
  facts: string[];
  options: Option[];
}

export interface CrediciView extends BaseView {
  links: { teamId: string; tableNo: number; tellsTo: string | null; hearsFrom: string | null }[];
  payoff: typeof PAYOFF;
  cap: number;
}

export interface CrediciMemberView {
  /** il caso da risolvere (o su cui fidarsi) */
  myCase: PublicCase;
  /** a chi si manda il suggerimento, con la soluzione VERA del suo caso (segreta, solo per questo tavolo) */
  tellsTo: { teamId: string; tableNo: number; case: PublicCase; truthId: string } | null;
  hearsFrom: { teamId: string; tableNo: number } | null;
}

export interface CrediciLinkResult {
  from: string;
  to: string;
  tipId: string | null;
  honest: boolean | null;
  trusted: boolean | null;
}

export interface CrediciSummary {
  links: CrediciLinkResult[];
}

export interface CrediciReveal {
  cases: (PublicCase & { solutionId: string; why: string })[];
  explain: string;
  summary: CrediciSummary | null;
}

interface Layout {
  teams: TeamRef[];
  links: RingLink[];
  caseOf: Map<string, BluffCase>;
}

function layout(c: CrediciContent, ctx: PhaseCtx): Layout {
  const teams = scopeTeams(ctx);
  const links = ring(
    teams.map((t) => t.teamId),
    ctx.seed,
  );
  const colors = ringColors(links.length, CASES);
  const caseOf = new Map(links.map((l) => [l.teamId, c.cases[colors[l.index]]]));
  return { teams, links, caseOf };
}

function publicCase(k: BluffCase, seed: string): PublicCase {
  return { id: k.id, title: k.title, question: k.question, facts: k.facts, options: publicOptions(k.options, `${seed}:${k.id}`) };
}

const def: MechanicDef<CrediciContent, CrediciSubmission> = {
  code: "credici-o-no",
  number: 49,
  manche: 4,
  title: "Credici o no",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Conoscete la soluzione del tavolo vicino: ditegli il vero o bluffate. Intanto decidete se fidarvi di chi suggerisce a voi.",
  contentSchema: crediciContent,
  submissionSchema: crediciSubmission,
  publicView: (c, ctx): CrediciView => {
    const { teams, links } = layout(c, ctx);
    const table = new Map(teams.map((t) => [t.teamId, t.tableNo]));
    return {
      ...baseView(def, ctx),
      links: links.map((l) => ({ teamId: l.teamId, tableNo: table.get(l.teamId)!, tellsTo: l.tellsTo, hearsFrom: l.hearsFrom })),
      payoff: PAYOFF,
      cap: TEAM_CAP,
    };
  },
  memberView: (c, ctx): CrediciMemberView => {
    const { teams, links, caseOf } = layout(c, ctx);
    const table = new Map(teams.map((t) => [t.teamId, t.tableNo]));
    const me = links.find((l) => l.teamId === ctx.teamId);
    const myCase = caseOf.get(ctx.teamId) ?? c.cases[0];
    const tellsTo =
      me?.tellsTo != null
        ? {
            teamId: me.tellsTo,
            tableNo: table.get(me.tellsTo) ?? 0,
            case: publicCase(caseOf.get(me.tellsTo)!, ctx.seed),
            truthId: c.solution.cases[caseOf.get(me.tellsTo)!.id].optionId,
          }
        : null;
    const hearsFrom = me?.hearsFrom != null ? { teamId: me.hearsFrom, tableNo: table.get(me.hearsFrom) ?? 0 } : null;
    return { myCase: publicCase(myCase, ctx.seed), tellsTo, hearsFrom };
  },
  score: ({ content, ctx, submissions }) => {
    const { teams, links, caseOf } = layout(content, ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const truth = (teamId: string) => content.solution.cases[caseOf.get(teamId)!.id].optionId;
    const linkOf = new Map(links.map((l) => [l.teamId, l]));
    const summary: CrediciSummary = {
      links: links
        .filter((l) => l.tellsTo)
        .map((l) => {
          const tell = firsts.get(l.teamId);
          const rec = firsts.get(l.tellsTo!);
          return {
            from: l.teamId,
            to: l.tellsTo!,
            tipId: tell?.payload.tip ?? null,
            honest: tell ? tell.payload.tip === truth(l.tellsTo!) : null,
            trusted: rec ? rec.payload.trust : null,
          };
        }),
    };
    const out: ScoreWithSummary<CrediciSummary> = {
      outcomes: teams.map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const link = linkOf.get(t.teamId)!;
        const parts: string[] = [];
        let rec = 0;
        let tel = 0;
        let finalCorrect = false;
        let bluffWon = false;
        let unmasked = false;
        // --- come RICEVENTE
        const h = link.hearsFrom ? firsts.get(link.hearsFrom) : undefined;
        if (!link.hearsFrom || !s.payload.trust) {
          finalCorrect = s.payload.answer === truth(t.teamId);
          if (finalCorrect) rec += PAYOFF.daSoli.receiver;
          if (link.hearsFrom && h && h.payload.tip !== truth(t.teamId)) {
            rec += PAYOFF.smascherato.receiver;
            unmasked = true;
            parts.push("bluff smascherato");
          }
          parts.push(finalCorrect ? "risolto da soli" : "da soli: sbagliato");
        } else if (h) {
          finalCorrect = h.payload.tip === truth(t.teamId);
          if (finalCorrect) {
            rec += PAYOFF.alleanza.receiver;
            parts.push("fiducia ripagata");
          } else parts.push("vi hanno fregato");
        } else parts.push("nessun suggerimento arrivato");
        // --- come SUGGERITORE
        if (link.tellsTo) {
          const r = firsts.get(link.tellsTo);
          const honest = s.payload.tip === truth(link.tellsTo);
          if (r) {
            if (r.payload.trust) {
              tel = honest ? PAYOFF.alleanza.teller : PAYOFF.bluffRiuscito.teller;
              bluffWon = !honest;
              parts.push(honest ? "alleanza" : "bluff riuscito");
            } else {
              tel = honest ? PAYOFF.onesti.teller : 0;
              parts.push(honest ? "sinceri ma non creduti" : "bluff scoperto");
            }
          }
        }
        return outcome(t.teamId, {
          points: Math.min(TEAM_CAP, rec + tel),
          chaos: CHAOS.partecipa + (link.tellsTo ? CHAOS.sfida : 0) + (bluffWon || unmasked ? CHAOS.centro : 0),
          correct: finalCorrect,
          accuracy: finalCorrect ? 1 : 0,
          label: parts.join(" · "),
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): CrediciReveal => ({
    cases: c.cases.map((k) => ({ ...publicCase(k, "reveal"), options: k.options, solutionId: c.solution.cases[k.id].optionId, why: c.solution.cases[k.id].why })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<CrediciSummary>).summary ?? null,
  }),
};

export const crediciONo: MechanicModule<CrediciContent, CrediciSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const { links, caseOf } = layout(c, ctx);
      const teams = scopeTeams(ctx);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const me = links.find((l) => l.teamId === teams[i].teamId)!;
        const mine = caseOf.get(me.teamId)!;
        const theirs = me.tellsTo ? caseOf.get(me.tellsTo)! : mine;
        const theirTruth = c.solution.cases[theirs.id].optionId;
        const honest = i % 2 === 0;
        const tip = honest ? theirTruth : theirs.options.find((o) => o.id !== theirTruth)!.id;
        const trust = i % 3 !== 1;
        return {
          tip,
          trust,
          answer: trust ? undefined : pickAnswer(rnd, c.solution.cases[mine.id].optionId, mine.options.map((o) => o.id), demoSkill(i)),
        };
      });
    },
  },
};
