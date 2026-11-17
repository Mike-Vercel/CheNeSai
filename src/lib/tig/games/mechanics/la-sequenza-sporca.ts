import { z } from "zod";
import type { MechanicDef } from "../contract";
import { noAnswer, rightWrong } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m1/common";

/**
 * 09 · LA SEQUENZA SPORCA (manche 1) — una fila di 6–9 elementi (numeri, simboli, dadi, orari, lettere,
 * poligoni) segue una regola; UN solo elemento la viola. Si tocca l'intruso: 100 o niente.
 * La regola è scritta in forma strutturata nel contenuto (`pattern`) e lo schema VERIFICA che la fila la
 * rispetti ovunque tranne che nella posizione della soluzione: niente sequenze ambigue per sbaglio.
 */

export const SYMBOLS = ["freccia", "triangolo", "quadrato", "cerchio", "stella", "rombo", "cuore", "luna", "croce", "esagono"] as const;
export type SymbolKind = (typeof SYMBOLS)[number];

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const tokenSchema = z.discriminatedUnion("t", [
  /** numero */
  z.object({ t: z.literal("n"), n: z.number().int().min(-9999).max(99999) }),
  /** simbolo, con rotazione in gradi (multipli di 45) */
  z.object({ t: z.literal("s"), s: z.enum(SYMBOLS), r: z.number().int().min(0).max(315).multipleOf(45).default(0) }),
  /** faccia di un dado */
  z.object({ t: z.literal("d"), n: z.number().int().min(1).max(6) }),
  /** orario */
  z.object({ t: z.literal("h"), h: hhmm }),
  /** lettera maiuscola */
  z.object({ t: z.literal("l"), l: z.string().regex(/^[A-Z]$/) }),
  /** poligono regolare con n lati */
  z.object({ t: z.literal("p"), n: z.number().int().min(3).max(10) }),
]);
export type Token = z.infer<typeof tokenSchema>;

const baseRule = z.discriminatedUnion("k", [
  z.object({ k: z.literal("arit"), start: z.number().int(), step: z.number().int() }),
  z.object({ k: z.literal("geo"), start: z.number().int(), ratio: z.number().int().min(2).max(5) }),
  z.object({ k: z.literal("fib"), a: z.number().int(), b: z.number().int() }),
  z.object({ k: z.literal("quad"), start: z.number().int().min(0) }),
  z.object({ k: z.literal("ciclo"), seq: z.array(tokenSchema).min(2).max(4) }),
  z.object({ k: z.literal("giro"), s: z.enum(SYMBOLS), start: z.number().int().multipleOf(45), step: z.number().int().multipleOf(45) }),
  z.object({ k: z.literal("dado"), start: z.number().int().min(1).max(6), step: z.number().int().min(1).max(5) }),
  z.object({ k: z.literal("ore"), start: hhmm, step: z.number().int().min(1).max(240) }),
  z.object({ k: z.literal("lettere"), start: z.string().regex(/^[A-Z]$/), step: z.number().int().min(1).max(6) }),
  z.object({ k: z.literal("lati"), start: z.number().int().min(3).max(10), step: z.number().int().min(-2).max(2) }),
]);
export type BaseRule = z.infer<typeof baseRule>;

export const patternSchema = z.union([baseRule, z.object({ k: z.literal("alterna"), a: baseRule, b: baseRule })]);
export type Pattern = z.infer<typeof patternSchema>;

// ---------------------------------------------------------------------------
// Regole: elemento atteso in posizione i
// ---------------------------------------------------------------------------

const mod = (a: number, m: number) => ((a % m) + m) % m;

function toMin(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}
function fromMin(m: number): string {
  const x = mod(m, 1440);
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}

function baseAt(r: BaseRule, i: number): Token {
  switch (r.k) {
    case "arit":
      return { t: "n", n: r.start + i * r.step };
    case "geo":
      return { t: "n", n: r.start * r.ratio ** i };
    case "fib": {
      let a = r.a;
      let b = r.b;
      for (let j = 0; j < i; j++) [a, b] = [b, a + b];
      return { t: "n", n: a };
    }
    case "quad":
      return { t: "n", n: (r.start + i) ** 2 };
    case "ciclo":
      return r.seq[i % r.seq.length];
    case "giro":
      return { t: "s", s: r.s, r: mod(r.start + i * r.step, 360) };
    case "dado":
      return { t: "d", n: mod(r.start - 1 + i * r.step, 6) + 1 };
    case "ore":
      return { t: "h", h: fromMin(toMin(r.start) + i * r.step) };
    case "lettere":
      return { t: "l", l: String.fromCharCode(65 + mod(r.start.charCodeAt(0) - 65 + i * r.step, 26)) };
    case "lati":
      return { t: "p", n: r.start + i * r.step };
  }
}

/** Elemento che la regola prevede in posizione `i`. */
export function expectedAt(p: Pattern, i: number): Token {
  if (p.k === "alterna") return i % 2 === 0 ? baseAt(p.a, i / 2) : baseAt(p.b, (i - 1) / 2);
  return baseAt(p, i);
}

/** Chiave canonica di un elemento (per confrontarli). */
export function tokenKey(t: Token): string {
  switch (t.t) {
    case "n":
      return `n:${t.n}`;
    case "s":
      return `s:${t.s}:${mod(t.r ?? 0, 360)}`;
    case "d":
      return `d:${t.n}`;
    case "h":
      return `h:${t.h}`;
    case "l":
      return `l:${t.l}`;
    case "p":
      return `p:${t.n}`;
  }
}

/** Posizioni che violano la regola (in una variante ben scritta: esattamente una). */
export function violations(p: Pattern, items: readonly Token[]): number[] {
  return items.flatMap((t, i) => (tokenKey(t) === tokenKey(expectedAt(p, i)) ? [] : [i]));
}

// ---------------------------------------------------------------------------
// Meccanica
// ---------------------------------------------------------------------------

export const sequenzaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** la regola detta a parole (solo al reveal), es. «Si aggiunge 4 ogni volta» */
    law: text(140),
    pattern: patternSchema,
    items: z.array(tokenSchema).min(6).max(9),
    solution: z.object({ index: z.number().int().min(0).max(8) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const bad = violations(c.pattern, c.items);
    if (bad.length !== 1 || bad[0] !== c.solution.index) ctx.addIssue({ code: "custom", message: `la fila viola la regola in [${bad.join(", ")}], atteso solo ${c.solution.index}` });
    const intr = c.items[c.solution.index];
    const exp = expectedAt(c.pattern, c.solution.index);
    if (intr && intr.t !== exp.t) ctx.addIssue({ code: "custom", message: "l'intruso deve essere dello stesso tipo dell'elemento atteso (plausibile)" });
  });
export type SequenzaContent = z.infer<typeof sequenzaContent>;
export type SequenzaInput = z.input<typeof sequenzaContent>;

export const sequenzaSubmission = z.object({ index: z.number().int().min(0).max(8) });
export type SequenzaSubmission = z.infer<typeof sequenzaSubmission>;

export interface SequenzaView extends BaseView {
  items: Token[];
}

export interface SequenzaReveal {
  items: Token[];
  index: number;
  /** l'elemento che avrebbe rispettato la regola */
  expected: Token;
  law: string;
  explain: string;
}

const def: MechanicDef<SequenzaContent, SequenzaSubmission> = {
  code: "la-sequenza-sporca",
  number: 9,
  manche: 1,
  title: "La sequenza sporca",
  input: "team",
  timerSec: 30,
  oneDeviceOk: true,
  needs: ["image"],
  rule: "La fila segue una regola, ma un elemento la viola. Toccate l'intruso: giusto 100, sbagliato niente.",
  contentSchema: sequenzaContent,
  submissionSchema: sequenzaSubmission,
  publicView: (c, ctx): SequenzaView => ({ ...baseView(def, ctx), items: c.items }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.index === content.solution.index, { okLabel: "Intruso smascherato", koLabel: "Era un elemento in regola" });
      }),
    };
  },
  reveal: (c): SequenzaReveal => ({ items: c.items, index: c.solution.index, expected: expectedAt(c.pattern, c.solution.index), law: c.law, explain: c.explain }),
};

export const laSequenzaSporca: MechanicModule<SequenzaContent, SequenzaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        if (rnd() < demoSkill(i)) return { index: c.solution.index };
        const others = c.items.map((_, j) => j).filter((j) => j !== c.solution.index);
        return { index: others[Math.floor(rnd() * others.length)] };
      }),
  },
};
