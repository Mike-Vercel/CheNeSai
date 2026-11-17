import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { publicOptions, type Option } from "../components/choice";
import { clueIndexAt, cluePoints } from "../components/clues";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { checkSingle, difficultySchema, optionSolution, optionSubmission, type OptionSubmission } from "./m1/common";
import { artSchema, rasterize, type Art } from "./m1/draw";

/**
 * 02 · PIXEL KILLER (manche 1) — una «foto» ORIGINALE (illustrazione a forme disegnata in codice) arriva a
 * quadrettoni: 16×9, poi 32×18 dopo 13 s, poi 64×36 dopo 26 s (indizi visivi progressivi). Quattro risposte.
 * Si blocca quando si vuole: giusta con i quadrettoni grossi 100, medi 70, fini 40 (orario del SERVER).
 * Le forme vere restano sul server fino al reveal: ai telefoni arrivano solo le griglie di colori già
 * calcolate, e con `publicViewAt` solo il livello aperto più il successivo (che così non arriva in ritardo
 * se il telefono non si è ancora aggiornato: il cambio di livello avviene esattamente all'orario).
 */

export const LEVEL_MS = [0, 13000, 26000] as const;
export const GRIDS: readonly [number, number][] = [
  [16, 9],
  [32, 18],
  [64, 36],
];

export const pixelContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** l'illustrazione (tela 160×90, solo forme: niente icone né testi che si leggerebbero) */
    art: artSchema,
    /** alternativa testuale di ogni livello (vaga quanto l'immagine a quel livello) */
    hints: z.array(text(200)).length(3),
    /** alternativa testuale dell'immagine nitida (reveal) */
    alt: text(240),
    options: optionsSchema(4, 4),
    solution: optionSolution,
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkSingle(c.options, c.solution.optionId, ctx);
    if (c.art.w !== 160 || c.art.h !== 90) ctx.addIssue({ code: "custom", message: "tela 160×90", path: ["art"] });
    c.art.shapes.forEach((s, i) => {
      if (s.k === "icon" || s.k === "text") ctx.addIssue({ code: "custom", message: "solo forme geometriche (icone e testi non si sgranano)", path: ["art", "shapes", i] });
    });
  });
export type PixelContent = z.infer<typeof pixelContent>;
export type PixelInput = z.input<typeof pixelContent>;

export interface PixelLevel {
  cols: number;
  rows: number;
  /** colori «rgb» a 3 cifre esadecimali, riga per riga */
  cells: string;
  hint: string;
}

export interface PixelView extends BaseView {
  /** orari di apertura dei livelli (ms dall'inizio) */
  schedule: number[];
  /** livelli: null = non ancora inviato */
  levels: (PixelLevel | null)[];
  options: Option[];
}

export interface PixelReveal {
  art: Art;
  alt: string;
  levels: PixelLevel[];
  options: Option[];
  solutionId: string;
  explain: string;
}

// La rasterizzazione costa qualche millisecondo: si ricorda (funzione pura del disegno).
const cache = new Map<string, string>();
function cellsOf(art: Art, cols: number, rows: number): string {
  const key = `${cols}x${rows}|${JSON.stringify(art)}`;
  let v = cache.get(key);
  if (v === undefined) {
    v = rasterize(art, cols, rows);
    if (cache.size > 300) cache.clear();
    cache.set(key, v);
  }
  return v;
}

export function levelOf(c: Pick<PixelContent, "art" | "hints">, i: number): PixelLevel {
  const [cols, rows] = GRIDS[i];
  return { cols, rows, cells: cellsOf(c.art, cols, rows), hint: c.hints[i] };
}

function view(c: PixelContent, ctx: PhaseCtx, upTo: number): PixelView {
  return {
    ...baseView(def, ctx),
    schedule: [...LEVEL_MS],
    levels: GRIDS.map((_, i) => (i <= upTo ? levelOf(c, i) : null)),
    options: publicOptions(c.options, `${ctx.seed}:pixel`),
  };
}

const def: MechanicDef<PixelContent, OptionSubmission> = {
  code: "pixel-killer",
  number: 2,
  manche: 1,
  title: "Pixel killer",
  input: "team",
  timerSec: 40,
  oneDeviceOk: true,
  needs: ["image"],
  rule: "La foto si schiarisce in tre passi. Bloccate quando la riconoscete: ai quadrettoni grossi vale 100, poi 70, poi 40.",
  contentSchema: pixelContent,
  submissionSchema: optionSubmission,
  publicView: (c, ctx) => view(c, ctx, GRIDS.length - 1),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const lvl = clueIndexAt(s.elapsedMs, LEVEL_MS);
        const ok = s.payload.optionId === content.solution.optionId;
        const pts = ok ? cluePoints(lvl) : 0;
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (ok && lvl === 0 ? CHAOS.centro : 0),
          correct: ok,
          accuracy: pts / 100,
          label: ok ? `Riconosciuta al livello ${lvl + 1}` : `Sbagliata al livello ${lvl + 1}`,
        });
      }),
    };
  },
  reveal: (c): PixelReveal => ({ art: c.art, alt: c.alt, levels: GRIDS.map((_, i) => levelOf(c, i)), options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const pixelKiller: MechanicModule<PixelContent, OptionSubmission> = {
  def,
  extras: {
    // livello aperto + il successivo (anticipo di un passo: vedi nota in testa)
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, Math.min(GRIDS.length - 1, clueIndexAt(elapsedMs, LEVEL_MS) + 1)),
    demoSubmissions: (c, ctx, seed) => {
      const subs = demoPerTeam(ctx, seed, (i, rnd) => ({ optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)) }));
      return subs.map((s, i) => ({ ...s, elapsedMs: [8000, 18000, 31000, 24000, 11000][i % 5] }));
    },
  },
};
