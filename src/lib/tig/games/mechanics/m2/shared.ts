import { z } from "zod";
import type { AcceptedSubmission, PhaseCtx, TeamRef } from "../../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../../components/choice";
import { seededShuffle } from "../../components/rng";
import { scopeTeams } from "../../components/submissions";
import { optionsSchema, text } from "../_shared";

/**
 * Pezzi comuni alle meccaniche della MANCHE 2 «FREGALI TUTTI!» (solo questa manche li usa).
 * Puri e deterministici come le meccaniche.
 */

/** Difficoltà della variante: il registro del server la legge dal contenuto per distribuire facile → difficile. */
export const difficultySchema = z.enum(["facile", "media", "difficile"]);
export type M2Difficulty = z.infer<typeof difficultySchema>;

/** Saldi dei tavoli iniettati dal runtime al congelamento (vedi engine → createGame), facoltativi. */
export const balancesSchema = z.record(z.string(), z.number().min(0)).optional();

/** Domanda a scelta (la soluzione sta fuori, nel campo `solution` del contenuto). */
export const questionSchema = (min = 3, max = 4) => z.object({ prompt: text(220), options: optionsSchema(min, max) });
export type Question = { prompt: string; options: Option[] };

/** Controllo editoriale di una domanda e della sua soluzione (per i superRefine). */
export function checkQuestion(q: Question, solutionId: string, ctx: z.RefinementCtx, path: (string | number)[]) {
  checkOptions(q.options, [solutionId], ctx, path);
}

/** Domanda per la vista pubblica: solo testo e opzioni (mescolate col seme della prova). */
export function publicQuestion(q: Question, seed: string): Question {
  return { prompt: q.prompt, options: publicOptions(q.options, seed) };
}

export const optionIdSchema = idSchema;

/** Riferimento minimo a un tavolo per le viste (mai nomi: li mette la UI). */
export interface TableRef {
  teamId: string;
  tableNo: number;
}

export function tableRefs(ctx: PhaseCtx): TableRef[] {
  return scopeTeams(ctx).map((t) => ({ teamId: t.teamId, tableNo: t.tableNo }));
}

/**
 * Gruppi deterministici (seme della prova) di due tavoli. Con un numero dispari l'ultimo gruppo è
 * un terzetto (`odd: "trio"`) oppure un tavolo da solo (`odd: "solo"`). Con un tavolo solo: un gruppo da uno.
 */
export function groupsOf(teamIds: readonly string[], seed: string, odd: "trio" | "solo"): string[][] {
  const order = seededShuffle(teamIds.slice().sort(), `${seed}:coppie`);
  const out: string[][] = [];
  for (let i = 0; i + 1 < order.length; i += 2) out.push([order[i], order[i + 1]]);
  if (order.length % 2 === 1) {
    const last = order[order.length - 1];
    if (odd === "trio" && out.length) out[out.length - 1].push(last);
    else out.push([last]);
  }
  return out;
}

/** Giro dei tavoli (seme): ognuno «colpisce» il successivo. Con un tavolo solo non c'è nessun collegamento. */
export function ringOf(teamIds: readonly string[], seed: string): { from: string; to: string }[] {
  const order = seededShuffle(teamIds.slice().sort(), `${seed}:giro`);
  if (order.length < 2) return [];
  return order.map((from, i) => ({ from, to: order[(i + 1) % order.length] }));
}

/** Mediana (intera) di una lista di numeri; null se vuota. */
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Ordine deterministico degli invii per tempo del server, poi tavolo (per «il primo che…»). */
export function byTime<S>(a: AcceptedSubmission<S>, b: AcceptedSubmission<S>): number {
  return a.elapsedMs - b.elapsedMs || (a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0);
}

/** Numero di tavolo di un id (per etichette leggibili). */
export function tableNoOf(teams: readonly TeamRef[], teamId: string): number | null {
  return teams.find((t) => t.teamId === teamId)?.tableNo ?? null;
}

/** Bersaglio valido: esiste tra i partecipanti e non è il proprio tavolo; con due tavoli è obbligato. */
export function resolveTarget(teams: readonly TeamRef[], from: string, wanted: string | undefined | null): string | null {
  const others = teams.filter((t) => t.teamId !== from);
  if (others.length === 1) return others[0].teamId;
  return others.some((t) => t.teamId === wanted) ? wanted! : null;
}
