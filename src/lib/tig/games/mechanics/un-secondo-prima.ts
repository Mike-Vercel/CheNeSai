import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { idSchema } from "../components/choice";
import { seededShuffle } from "../components/rng";
import { baseView, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { demoSingle, difficultySchema, optionSolution, optionSubmission, scoreSingle, type OptionSubmission } from "./m1/common";
import { colorSchema, shapeSchema } from "./m1/draw";

/**
 * 06 · UN SECONDO PRIMA (manche 1) — un breve «video» ORIGINALE (animazione a fotogrammi chiave disegnata in
 * codice: attori fatti di forme e icone che si muovono) parte sulla TV e si interrompe. Tre fotogrammi
 * candidati: quale viene un secondo dopo? Uno solo segue davvero quello che si è visto (spinta, traiettoria,
 * ritmo, catena che si ferma...). 100 se giusto.
 */

/** Conto alla rovescia prima del video (ms). */
export const LEAD_MS = 1200;

export const poseSchema = z.object({
  x: z.number().min(-200).max(400),
  y: z.number().min(-200).max(400),
  rot: z.number().min(-720).max(720).optional(),
  /** scala (uguale nei due assi, salvo `sy`) */
  s: z.number().min(0).max(6).optional(),
  /** scala verticale (liquidi che salgono, candele che si accorciano) */
  sy: z.number().min(0).max(6).optional(),
  o: z.number().min(0).max(1).optional(),
});
export type Pose = z.infer<typeof poseSchema>;

const actorSchema = z.object({
  id: idSchema,
  /** forme in coordinate locali: l'origine (0,0) è il perno di rotazione e scala */
  shapes: z.array(shapeSchema).min(1).max(40),
});
export type Actor = z.infer<typeof actorSchema>;

export const clipSchema = z.object({
  w: z.literal(160),
  h: z.literal(90),
  bg: colorSchema,
  /** scenografia ferma dietro gli attori */
  back: z.array(shapeSchema).max(60),
  actors: z.array(actorSchema).min(1).max(12),
  /** scenografia ferma davanti agli attori (bancone, bordo della vasca...) */
  front: z.array(shapeSchema).max(30).optional(),
  /** fotogrammi chiave: a ogni istante le pose degli attori indicati (in mezzo si interpola) */
  keys: z.array(z.object({ t: z.number().int().min(0).max(8000), set: z.record(z.string(), poseSchema) })).min(2).max(60),
  durationMs: z.number().int().min(2000).max(7000),
});
export type Clip = z.infer<typeof clipSchema>;

const frameOptionSchema = z.object({
  id: idSchema,
  /** didascalia breve del fotogramma */
  text: text(70),
  /** pose degli attori nel fotogramma (gli attori non indicati restano come nell'ultimo istante del video) */
  set: z.record(z.string(), poseSchema),
  /** forme in più (schizzi, crepe, schiuma...) */
  extra: z.array(shapeSchema).max(20).optional(),
});
export type FrameOption = z.infer<typeof frameOptionSchema>;

export const secondoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** titolo del video, es. «Il gatto e la tazza» */
    clipTitle: text(48),
    clip: clipSchema,
    /** alternativa testuale del video (cosa succede, fino al fermo immagine) */
    alt: text(400),
    prompt: text(110),
    options: z.array(frameOptionSchema).length(3),
    solution: optionSolution,
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const ids = c.clip.actors.map((a) => a.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "id degli attori duplicati" });
    const keys = c.clip.keys;
    if (keys[0]?.t !== 0) ctx.addIssue({ code: "custom", message: "il primo fotogramma chiave è a t=0" });
    for (const id of ids) if (!keys[0]?.set[id]) ctx.addIssue({ code: "custom", message: `posa iniziale mancante per ${id}` });
    keys.forEach((k, i) => {
      if (i > 0 && k.t <= keys[i - 1].t) ctx.addIssue({ code: "custom", message: "fotogrammi chiave in ordine di tempo" });
      for (const a of Object.keys(k.set)) if (!ids.includes(a)) ctx.addIssue({ code: "custom", message: `attore sconosciuto ${a}` });
    });
    if (keys[keys.length - 1]?.t !== c.clip.durationMs) ctx.addIssue({ code: "custom", message: "l'ultimo fotogramma chiave coincide con la fine del video" });
    const oids = c.options.map((o) => o.id);
    if (new Set(oids).size !== 3) ctx.addIssue({ code: "custom", message: "id delle opzioni duplicati" });
    if (new Set(c.options.map((o) => o.text.toLowerCase())).size !== 3) ctx.addIssue({ code: "custom", message: "didascalie duplicate" });
    if (!oids.includes(c.solution.optionId)) ctx.addIssue({ code: "custom", message: "soluzione inesistente" });
    for (const o of c.options) for (const a of Object.keys(o.set)) if (!ids.includes(a)) ctx.addIssue({ code: "custom", message: `opzione ${o.id}: attore sconosciuto ${a}` });
  });
export type SecondoContent = z.infer<typeof secondoContent>;
export type SecondoInput = z.input<typeof secondoContent>;

// ---------------------------------------------------------------------------
// Animazione: posa di ogni attore a un istante (interpolazione lineare tra i suoi fotogrammi chiave)
// ---------------------------------------------------------------------------

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function full(p: Pose): Required<Pose> {
  const s = p.s ?? 1;
  return { x: p.x, y: p.y, rot: p.rot ?? 0, s, sy: p.sy ?? s, o: p.o ?? 1 };
}

/** Posa di un attore all'istante `t` (ms dall'inizio del video, fuori intervallo si blocca agli estremi). */
export function poseAt(clip: Pick<Clip, "keys">, actorId: string, t: number): Required<Pose> {
  const ks = clip.keys.filter((k) => k.set[actorId]);
  if (!ks.length) return { x: 0, y: 0, rot: 0, s: 1, sy: 1, o: 0 };
  if (t <= ks[0].t) return full(ks[0].set[actorId]);
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i].t) {
      const a = full(ks[i - 1].set[actorId]);
      const b = full(ks[i].set[actorId]);
      const k = (t - ks[i - 1].t) / Math.max(1, ks[i].t - ks[i - 1].t);
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), rot: lerp(a.rot, b.rot, k), s: lerp(a.s, b.s, k), sy: lerp(a.sy, b.sy, k), o: lerp(a.o, b.o, k) };
    }
  }
  return full(ks[ks.length - 1].set[actorId]);
}

/** Pose di tutti gli attori all'istante `t`. */
export function posesAt(clip: Clip, t: number): Record<string, Required<Pose>> {
  return Object.fromEntries(clip.actors.map((a) => [a.id, poseAt(clip, a.id, t)]));
}

/** Pose del fotogramma di un'opzione (attori non indicati: come nel fermo immagine). */
export function posesOf(clip: Clip, o: Pick<FrameOption, "set">): Record<string, Required<Pose>> {
  const last = posesAt(clip, clip.durationMs);
  return Object.fromEntries(clip.actors.map((a) => [a.id, o.set[a.id] ? full(o.set[a.id]) : last[a.id]]));
}

// ---------------------------------------------------------------------------
// Meccanica
// ---------------------------------------------------------------------------

export interface SecondoView extends BaseView {
  clipTitle: string;
  clip: Clip;
  leadMs: number;
  /** istante (ms dall'inizio della prova) del fermo immagine */
  freezeMs: number;
  alt: string;
  prompt: string;
  /** fotogrammi candidati, mescolati col seme della prova */
  options: FrameOption[];
}

export interface SecondoReveal {
  clipTitle: string;
  clip: Clip;
  options: FrameOption[];
  solutionId: string;
  explain: string;
}

function view(c: SecondoContent, ctx: PhaseCtx): SecondoView {
  return {
    ...baseView(def, ctx),
    clipTitle: c.clipTitle,
    clip: c.clip,
    leadMs: LEAD_MS,
    freezeMs: LEAD_MS + c.clip.durationMs,
    alt: c.alt,
    prompt: c.prompt,
    options: seededShuffle(c.options, `${ctx.seed}:fotogrammi`),
  };
}

const def: MechanicDef<SecondoContent, OptionSubmission> = {
  code: "un-secondo-prima",
  number: 6,
  manche: 1,
  title: "Un secondo prima",
  input: "team",
  timerSec: 30,
  oneDeviceOk: true,
  needs: ["video"],
  rule: "Un breve video si ferma sul più bello. Tra tre fotogrammi, scegliete quello che viene un secondo dopo.",
  contentSchema: secondoContent,
  submissionSchema: optionSubmission,
  publicView: (c, ctx) => view(c, ctx),
  score: ({ content, ctx, submissions }) => scoreSingle(content.solution.optionId, ctx, submissions, { okLabel: "Previsione giusta", koLabel: "Il video andava altrove" }),
  reveal: (c): SecondoReveal => ({ clipTitle: c.clipTitle, clip: c.clip, options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const unSecondoPrima: MechanicModule<SecondoContent, OptionSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => demoSingle(ctx, seed, c.solution.optionId, c.options.map((o) => o.id), { minMs: LEAD_MS + c.clip.durationMs + 2000 }),
  },
};

