import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { ICON_KINDS } from "../components/art";
import { idSchema } from "../components/choice";
import { seededShuffle } from "../components/rng";
import { noAnswer, rightWrong } from "../components/scoring";
import { durationOf, firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m1/common";
import { artSchema, iconsOf, type Art } from "./m1/draw";

/**
 * 08 · NON È QUELLO CHE SEMBRA (manche 1) — tre immagini disegnate in codice si assomigliano; sullo schermo
 * c'è una descrizione esatta e una sola immagine la rispetta in tutto. Si tocca l'immagine: 100 se giusta,
 * più un bonus di rapidità limitato (max 20, contenuto identico per tutti).
 * La descrizione è scritta per esteso, ma il contenuto ne porta anche la versione strutturata (`conditions`):
 * lo schema verifica che SOLO l'immagine della soluzione le rispetti tutte.
 */

const kind = z.enum(ICON_KINDS);
export const conditionSchema = z.discriminatedUnion("c", [
  /** un oggetto di quel tipo ha quel testo */
  z.object({ c: z.literal("testo"), kind, label: z.string().min(1).max(18) }),
  /** l'oggetto `a` sta a sinistra dell'oggetto `b` (tipi unici nell'immagine) */
  z.object({ c: z.literal("sinistra"), a: kind, b: kind }),
  /** l'oggetto `a` sta più in alto dell'oggetto `b` (tipi unici nell'immagine) */
  z.object({ c: z.literal("sopra"), a: kind, b: kind }),
  /** esattamente `n` oggetti di quel tipo */
  z.object({ c: z.literal("quanti"), kind, n: z.number().int().min(0).max(9) }),
  /** l'oggetto (unico) è specchiato (`flip` vero) o no */
  z.object({ c: z.literal("verso"), kind, flip: z.boolean() }),
  /** nessun oggetto di quel tipo */
  z.object({ c: z.literal("senza"), kind }),
]);
export type Condition = z.infer<typeof conditionSchema>;

/** L'immagine rispetta la condizione? `null` se la condizione non è valutabile (tipo non unico). */
export function holds(art: Art, cond: Condition): boolean | null {
  const one = (k: string) => {
    const xs = iconsOf(art, k);
    return xs.length === 1 ? xs[0] : null;
  };
  switch (cond.c) {
    case "testo":
      return iconsOf(art, cond.kind).some((i) => (i.label ?? "").trim().toLowerCase() === cond.label.trim().toLowerCase());
    case "sinistra": {
      const a = one(cond.a);
      const b = one(cond.b);
      return a && b ? a.x < b.x - 2 : null;
    }
    case "sopra": {
      const a = one(cond.a);
      const b = one(cond.b);
      return a && b ? a.y < b.y - 2 : null;
    }
    case "quanti":
      return iconsOf(art, cond.kind).length === cond.n;
    case "verso": {
      const a = one(cond.kind);
      return a ? !!a.flip === cond.flip : null;
    }
    case "senza":
      return iconsOf(art, cond.kind).length === 0;
  }
}

const imageSchema = z.object({ id: idSchema, art: artSchema });

export const nonEContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** nome della scena, es. «La mensola del soggiorno» */
    scene: text(48),
    /** la descrizione esatta mostrata a tutti */
    description: text(200),
    /** le stesse frasi una per una (per il reveal: cosa non torna in ogni immagine) */
    parts: z.array(text(80)).min(2).max(4),
    conditions: z.array(conditionSchema).min(2).max(4),
    images: z.array(imageSchema).length(3),
    /** alternativa testuale di ogni immagine (stesso ordine di `images`) */
    alts: z.array(text(300)).length(3),
    solution: z.object({ imageId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (c.parts.length !== c.conditions.length) ctx.addIssue({ code: "custom", message: "una frase per condizione" });
    const ids = c.images.map((i) => i.id);
    if (new Set(ids).size !== 3) ctx.addIssue({ code: "custom", message: "id delle immagini duplicati" });
    if (!ids.includes(c.solution.imageId)) ctx.addIssue({ code: "custom", message: "immagine della soluzione inesistente" });
    for (const img of c.images) {
      const res = c.conditions.map((k) => holds(img.art, k));
      if (res.some((r) => r === null)) ctx.addIssue({ code: "custom", message: `${img.id}: condizione non valutabile (tipo non unico)`, path: ["images"] });
      const all = res.every((r) => r === true);
      if (img.id === c.solution.imageId && !all) ctx.addIssue({ code: "custom", message: `${img.id}: la soluzione non rispetta la descrizione (${res.join(",")})` });
      if (img.id !== c.solution.imageId && all) ctx.addIssue({ code: "custom", message: `${img.id}: anche questa rispetta la descrizione` });
    }
  });
export type NonEContent = z.infer<typeof nonEContent>;
export type NonEInput = z.input<typeof nonEContent>;

export const nonESubmission = z.object({ imageId: idSchema });
export type NonESubmission = z.infer<typeof nonESubmission>;

export interface NonEView extends BaseView {
  scene: string;
  description: string;
  /** in ordine mescolato col seme della prova (uguale per tutti i tavoli) */
  images: { id: string; art: Art; alt: string }[];
}

export interface NonEReveal {
  scene: string;
  description: string;
  parts: string[];
  images: { id: string; art: Art; alt: string; /** indici delle frasi NON rispettate */ broken: number[] }[];
  imageId: string;
  explain: string;
}

function shuffled(c: NonEContent, ctx: PhaseCtx) {
  return seededShuffle(
    c.images.map((img, i) => ({ id: img.id, art: img.art, alt: c.alts[i] })),
    `${ctx.seed}:immagini`,
  );
}

const def: MechanicDef<NonEContent, NonESubmission> = {
  code: "non-e-quello-che-sembra",
  number: 8,
  manche: 1,
  title: "Non è quello che sembra",
  input: "team",
  timerSec: 25,
  oneDeviceOk: true,
  needs: ["image"],
  rule: "Tre immagini quasi uguali, una descrizione esatta: solo una la rispetta in tutto. Toccatela, prima è meglio.",
  contentSchema: nonEContent,
  submissionSchema: nonESubmission,
  publicView: (c, ctx): NonEView => ({ ...baseView(def, ctx), scene: c.scene, description: c.description, images: shuffled(c, ctx) }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const windowMs = durationOf(ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.imageId === content.solution.imageId, { speed: true, elapsedMs: s.elapsedMs, windowMs, koLabel: "Sembrava quella giusta" });
      }),
    };
  },
  reveal: (c): NonEReveal => ({
    scene: c.scene,
    description: c.description,
    parts: c.parts,
    images: c.images.map((img, i) => ({ id: img.id, art: img.art, alt: c.alts[i], broken: c.conditions.flatMap((k, j) => (holds(img.art, k) ? [] : [j])) })),
    imageId: c.solution.imageId,
    explain: c.explain,
  }),
};

export const nonEQuelloCheSembra: MechanicModule<NonEContent, NonESubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({ imageId: pickAnswer(rnd, c.solution.imageId, c.images.map((x) => x.id), demoSkill(i)) }), { minMs: 4000, maxMs: 20000 }),
  },
};
