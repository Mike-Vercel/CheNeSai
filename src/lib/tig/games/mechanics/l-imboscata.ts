import { z } from "zod";
import type { MechanicDef, PhaseCtx, TeamOutcome } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { ring } from "../components/pairing";
import { rngFrom } from "../components/rng";
import { CHAOS, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m5-shared";

/**
 * 73 · L'IMBOSCATA (manche 5) — giro dei tavoli deciso dal seme: ognuno tende un'imboscata al tavolo
 * successivo e la subisce dal precedente. Così nessun tavolo è bersaglio più di una volta (limite
 * anti-bersaglio ripetuto) e il runtime applica comunque scudi e anti-accanimento ai furti.
 *
 * Tutto in una prova (il motore non passa informazioni tra tavoli durante la prova):
 *  - l'AVVERSARIO sceglie il TIPO di trappola (una di tre domande) per il suo bersaglio;
 *  - il BERSAGLIO, senza sapere quale gli toccherà, decide QUANTO RISCHIARE (0, 20 o 40) e risponde a tutte
 *    e tre: conta solo la risposta alla trappola scelta dal suo avversario.
 * Difesa riuscita: +60 + rischio. Difesa fallita: il rischio passa all'avversario (furto ≤ 40, scudi e tetti del
 * runtime) e l'avversario prende +20 di imboscata riuscita. Senza avversario (un tavolo solo, o chi doveva
 * scegliere non ha inviato) la trappola la sorteggia la casa e il rischio perso va semplicemente perso.
 */

export const DEFENSE_POINTS = 60;
export const AMBUSH_BONUS = 20;
export const STAKES = [0, 20, 40] as const;

const trapSchema = z.object({
  id: idSchema,
  /** tipo di trappola, es. «Calcolo lampo» */
  name: text(24),
  /** cosa aspettarsi, mostrato a chi sceglie */
  blurb: text(90),
  prompt: text(180),
  options: optionsSchema(3, 3),
});

export const imboscataContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    title: text(60),
    traps: z.array(trapSchema).length(3),
    solution: z.object({ answers: z.record(z.string(), idSchema) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.traps.map((t) => t.id)).size !== c.traps.length) ctx.addIssue({ code: "custom", message: "id delle trappole duplicati" });
    c.traps.forEach((t, i) => {
      const sol = c.solution.answers[t.id];
      if (!sol) ctx.addIssue({ code: "custom", message: `manca la soluzione di ${t.id}` });
      else checkOptions(t.options, [sol], ctx, ["traps", i]);
    });
  });
export type ImboscataContent = z.infer<typeof imboscataContent>;
export type ImboscataInput = z.input<typeof imboscataContent>;

export const imboscataSubmission = z.object({
  /** trappola scelta per il proprio bersaglio */
  trap: idSchema,
  /** quanto rischia il tavolo sulla propria difesa */
  stake: z.union([z.literal(0), z.literal(20), z.literal(40)]),
  /** risposte a tutte e tre le trappole */
  answers: z.record(z.string(), idSchema),
});
export type ImboscataSubmission = z.infer<typeof imboscataSubmission>;

export interface ImboscataView extends BaseView {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  traps: { id: string; name: string; blurb: string; prompt: string; options: Option[] }[];
  /** giro: chi tende l'imboscata a chi */
  links: { teamId: string; tableNo: number; targetId: string | null; attackerId: string | null }[];
  stakes: readonly number[];
  defensePoints: number;
  ambushBonus: number;
}

export interface AmbushRecord {
  from: string | null;
  to: string;
  trapId: string;
  /** trappola scelta dalla casa (nessun avversario o avversario senza invio) */
  house: boolean;
  stake: number;
  held: boolean;
}

export interface ImboscataSummary {
  ambushes: AmbushRecord[];
}

export interface ImboscataReveal {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  traps: { id: string; name: string; prompt: string; options: Option[]; solutionId: string }[];
  explain: string;
  summary: ImboscataSummary | null;
}

function links(ctx: PhaseCtx): ImboscataView["links"] {
  const teams = scopeTeams(ctx);
  const r = ring(
    teams.map((t) => t.teamId),
    `${ctx.seed}:imboscata`,
  );
  return teams.map((t) => {
    const l = r.find((x) => x.teamId === t.teamId)!;
    return { teamId: t.teamId, tableNo: t.tableNo, targetId: l.tellsTo, attackerId: l.hearsFrom };
  });
}

const def: MechanicDef<ImboscataContent, ImboscataSubmission> = {
  code: "l-imboscata",
  number: 73,
  manche: 5,
  title: "L'imboscata",
  input: "duel",
  timerSec: 70,
  oneDeviceOk: true,
  needs: [],
  rule: "Scegliete la trappola per il vostro bersaglio e quanto rischiate in difesa. Rispondete a tutte e tre: una è la vostra.",
  contentSchema: imboscataContent,
  submissionSchema: imboscataSubmission,
  publicView: (c, ctx): ImboscataView => ({
    ...baseView(def, ctx),
    heading: c.title,
    traps: c.traps.map((t) => ({ id: t.id, name: t.name, blurb: t.blurb, prompt: t.prompt, options: publicOptions(t.options, `${ctx.seed}:${t.id}`) })),
    links: links(ctx),
    stakes: STAKES,
    defensePoints: DEFENSE_POINTS,
    ambushBonus: AMBUSH_BONUS,
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const trapIds = content.traps.map((t) => t.id);
    const l = links(ctx);
    const ambushes: AmbushRecord[] = [];
    const acc = new Map<string, { points: number; chaos: number; transfers: NonNullable<TeamOutcome["transfers"]>; held: boolean | null; ambushed: boolean; stake: number; lostToHouse: number }>();
    for (const t of l) acc.set(t.teamId, { points: 0, chaos: 0, transfers: [], held: null, ambushed: false, stake: 0, lostToHouse: 0 });

    for (const t of l) {
      const me = firsts.get(t.teamId);
      const attacker = t.attackerId ? firsts.get(t.attackerId) : undefined;
      const pickedTrap = attacker && trapIds.includes(attacker.payload.trap) ? attacker.payload.trap : null;
      const trapId = pickedTrap ?? trapIds[Math.floor(rngFrom(`${ctx.seed}:casa:${t.teamId}`)() * trapIds.length)];
      const stake = me ? me.payload.stake : 0;
      const held = !!me && me.payload.answers[trapId] === content.solution.answers[trapId];
      ambushes.push({ from: pickedTrap ? t.attackerId : null, to: t.teamId, trapId, house: !pickedTrap, stake, held });
      const mine = acc.get(t.teamId)!;
      mine.stake = stake;
      if (me) mine.held = held;
      if (held) mine.points += DEFENSE_POINTS + stake;
      else if (pickedTrap && t.attackerId) {
        const a = acc.get(t.attackerId)!;
        a.points += AMBUSH_BONUS;
        a.ambushed = true;
        if (stake > 0) a.transfers.push({ toTeamId: t.teamId, points: stake, reason: "Imboscata riuscita" });
      } else if (stake > 0) {
        mine.points -= stake;
        mine.lostToHouse = stake;
      }
    }

    const out: ScoreWithSummary<ImboscataSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const a = acc.get(t.teamId)!;
        const s = firsts.get(t.teamId);
        if (!s) return outcome(t.teamId, { points: 0, chaos: 0, correct: null, accuracy: 0, label: "Nessuna risposta" });
        const parts = [a.held ? `Difesa riuscita (+${DEFENSE_POINTS + a.stake})` : a.stake ? `Difesa caduta (rischio ${a.stake} perso)` : "Difesa caduta (rischio zero)"];
        if (a.ambushed) parts.push(`imboscata riuscita (+${AMBUSH_BONUS}${a.transfers.length ? ` e ${a.transfers[0].points} rubati` : ""})`);
        return outcome(t.teamId, {
          points: a.points,
          chaos: CHAOS.partecipa + (a.stake > 0 ? CHAOS.rischio : 0) + (a.held ? CHAOS.centro : 0) + (a.ambushed ? CHAOS.sfida : 0),
          correct: a.held,
          accuracy: a.held ? 1 : 0,
          label: parts.join(" · "),
          transfers: a.transfers,
        });
      }),
      summary: { ambushes },
    };
    return out;
  },
  reveal: (c, out): ImboscataReveal => ({
    heading: c.title,
    traps: c.traps.map((t) => ({ id: t.id, name: t.name, prompt: t.prompt, options: t.options, solutionId: c.solution.answers[t.id] })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<ImboscataSummary>).summary ?? null,
  }),
};

export const lImboscata: MechanicModule<ImboscataContent, ImboscataSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        trap: c.traps[Math.floor(rnd() * c.traps.length)].id,
        stake: STAKES[(i + 2) % STAKES.length],
        answers: Object.fromEntries(c.traps.map((t) => [t.id, pickAnswer(rnd, c.solution.answers[t.id], t.options.map((o) => o.id), demoSkill(i))])),
      })),
  },
};
