import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { ART_H, ART_W, GLYPH_KINDS, scatterPath, type GlyphKind } from "../components/art";
import { proximityPoints } from "../components/estimate";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 11 · LA CIFRA IMPROBABILE (manche 1) — in TV per 7 secondi una nuvola di sagome; si stima quante sono
 * quelle di un tipo (in mezzo ci sono intrusi di forma diversa). Punti proporzionali alla vicinanza, tetto 100.
 * La vista contiene un unico tracciato SVG (bersagli e intrusi mescolati): il numero non è un campo leggibile.
 */

export const FLASH_MS = 7000;

const glyphEnum = z.enum(GLYPH_KINDS as [GlyphKind, ...GlyphKind[]]);

export const cifraContent = z
  .object({
    id: variantId,
    /** la domanda, es. «Quante candeline sulla torta del coinquilino?» */
    prompt: text(110),
    /** nome al plurale di ciò che si conta, es. «candeline» */
    unit: text(24),
    glyph: glyphEnum,
    decoyGlyph: glyphEnum,
    /** nome degli intrusi, es. «monete» (testo per l'accessibilità) */
    decoyUnit: text(24),
    decoys: z.number().int().min(8).max(40),
    solution: z.object({ count: z.number().int().min(25).max(220) }),
    explain: explainSchema,
  })
  .refine((c) => c.glyph !== c.decoyGlyph, "bersagli e intrusi devono avere forme diverse");
export type CifraContent = z.infer<typeof cifraContent>;
export type CifraInput = z.input<typeof cifraContent>;

export const cifraSubmission = z.object({ guess: z.number().int().min(0).max(9999) });
export type CifraSubmission = z.infer<typeof cifraSubmission>;

export interface CifraArt {
  width: number;
  height: number;
  /** un solo tracciato con tutte le sagome */
  d: string;
}

export interface CifraView extends BaseView {
  prompt: string;
  unit: string;
  glyph: GlyphKind;
  decoyGlyph: GlyphKind;
  decoyUnit: string;
  flashMs: number;
  /** la nuvola (assente dopo il lampo se il runtime usa `publicViewAt`) */
  art: CifraArt | null;
}

export interface CifraReveal {
  prompt: string;
  unit: string;
  total: number;
  art: CifraArt;
  explain: string;
}

function art(c: CifraContent): CifraArt {
  return {
    width: ART_W,
    height: ART_H,
    d: scatterPath({ count: c.solution.count, glyph: c.glyph, decoys: c.decoys, decoyGlyph: c.decoyGlyph, seed: c.id }),
  };
}

function view(c: CifraContent, ctx: PhaseCtx, withArt: boolean): CifraView {
  return {
    ...baseView(def, ctx),
    prompt: c.prompt,
    unit: c.unit,
    glyph: c.glyph,
    decoyGlyph: c.decoyGlyph,
    decoyUnit: c.decoyUnit,
    flashMs: FLASH_MS,
    art: withArt ? art(c) : null,
  };
}

const def: MechanicDef<CifraContent, CifraSubmission> = {
  code: "cifra-improbabile",
  number: 11,
  manche: 1,
  title: "La cifra improbabile",
  input: "team",
  timerSec: 35,
  oneDeviceOk: true,
  needs: ["image"],
  rule: "7 secondi per guardare, poi la stima: quanti erano? Più siete vicini, più punti. Contarli tutti è impossibile.",
  contentSchema: cifraContent,
  submissionSchema: cifraSubmission,
  publicView: (c, ctx) => view(c, ctx, true),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const truth = content.solution.count;
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const { points, accuracy, errorRatio } = proximityPoints(s.payload.guess, truth, 0.5);
        return outcome(t.teamId, {
          points,
          chaos: CHAOS.partecipa + (errorRatio <= 0.1 ? CHAOS.centro : 0),
          correct: s.payload.guess === truth,
          accuracy,
          label: `Stima ${s.payload.guess} · scarto ${Math.round(errorRatio * 100)}%`,
        });
      }),
    };
  },
  reveal: (c): CifraReveal => ({ prompt: c.prompt, unit: c.unit, total: c.solution.count, art: art(c), explain: c.explain }),
};

export const cifraImprobabile: MechanicModule<CifraContent, CifraSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs < FLASH_MS),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i) => ({ guess: Math.max(1, Math.round(c.solution.count * [1.06, 0.8, 1.45, 0.62, 1.2][i % 5])) })),
  },
};
