import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { idSchema } from "../components/choice";
import { noAnswer, rightWrong } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { difficultySchema } from "./_m4";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 60 · CHI CAMBIA VERSIONE (manche 4) — due giri di dichiarazioni di personaggi inventati.
 * 1° giro (primi 22 s): ognuno dice la sua. Poi arriva una NUOVA PROVA e parte il 2° giro: le dichiarazioni
 * del 1° giro spariscono (memoria!) e tutti ripetono la loro versione. Uno solo l'ha cambiata per farla
 * tornare con la prova: va smascherato. Giusto 100. Con `publicViewAt` il 2° giro e la prova non partono
 * prima del tempo e il 1° giro non viene più mandato dopo.
 */

export const ROUND2_AT_MS = 22000;

const personSchema = z.object({
  id: idSchema,
  name: text(24),
  /** chi è, es. «coinquilino, gioca a calcio» */
  role: text(48),
  first: text(170),
  second: text(170),
});

export const cambiaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    caseTitle: text(70),
    /** la nuova prova che arriva tra i due giri */
    evidence: text(200),
    people: z.array(personSchema).min(3).max(4),
    solution: z.object({
      personId: idSchema,
      /** cosa è cambiato tra le due versioni */
      contradiction: text(240),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const ids = c.people.map((p) => p.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "id duplicati" });
    if (!ids.includes(c.solution.personId)) ctx.addIssue({ code: "custom", message: "soluzione inesistente" });
  });
export type CambiaContent = z.infer<typeof cambiaContent>;
export type CambiaInput = z.input<typeof cambiaContent>;

export const cambiaSubmission = z.object({ personId: idSchema });
export type CambiaSubmission = z.infer<typeof cambiaSubmission>;

export interface CambiaView extends BaseView {
  caseTitle: string;
  /** istante (ms dall'inizio) del 2° giro */
  round2At: number;
  people: { id: string; name: string; role: string }[];
  /** 1° giro, nello stesso ordine di `people` (null quando non va più mostrato) */
  first: (string | null)[];
  evidence: string | null;
  /** 2° giro (null prima del tempo) */
  second: (string | null)[];
}

export interface CambiaReveal {
  caseTitle: string;
  evidence: string;
  people: { id: string; name: string; role: string; first: string; second: string }[];
  personId: string;
  contradiction: string;
  explain: string;
}

/** fase: "tutto" = vista completa (la UI rispetta gli orari), "primo" / "secondo" = solo i dati di quel giro */
function view(c: CambiaContent, ctx: PhaseCtx, phase: "tutto" | "primo" | "secondo"): CambiaView {
  return {
    ...baseView(def, ctx),
    caseTitle: c.caseTitle,
    round2At: ROUND2_AT_MS,
    people: c.people.map((p) => ({ id: p.id, name: p.name, role: p.role })),
    first: c.people.map((p) => (phase === "secondo" ? null : p.first)),
    evidence: phase === "primo" ? null : c.evidence,
    second: c.people.map((p) => (phase === "primo" ? null : p.second)),
  };
}

const def: MechanicDef<CambiaContent, CambiaSubmission> = {
  code: "chi-cambia-versione",
  number: 60,
  manche: 4,
  title: "Chi cambia versione",
  input: "team",
  timerSec: 65,
  oneDeviceOk: true,
  needs: [],
  rule: "Memorizzate cosa dice ognuno: dopo 22 secondi arriva una nuova prova e tutti ripetono la loro versione. Chi l'ha cambiata?",
  contentSchema: cambiaContent,
  submissionSchema: cambiaSubmission,
  publicView: (c, ctx) => view(c, ctx, "tutto"),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.personId === content.solution.personId, { okLabel: "Voltagabbana smascherato", koLabel: "Quella versione non è cambiata" });
      }),
    };
  },
  reveal: (c): CambiaReveal => ({
    caseTitle: c.caseTitle,
    evidence: c.evidence,
    people: c.people.map((p) => ({ id: p.id, name: p.name, role: p.role, first: p.first, second: p.second })),
    personId: c.solution.personId,
    contradiction: c.solution.contradiction,
    explain: c.explain,
  }),
};

export const chiCambiaVersione: MechanicModule<CambiaContent, CambiaSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs < ROUND2_AT_MS ? "primo" : "secondo"),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({ personId: pickAnswer(rnd, c.solution.personId, c.people.map((p) => p.id), demoSkill(i)) }), { minMs: ROUND2_AT_MS + 4000, maxMs: 60000 }),
  },
};
