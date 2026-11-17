import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { ICON_KINDS, LABEL_KINDS, SCENE_BACKDROPS, sceneItemSchema, TONES, type SceneItem } from "../components/art";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { rightWrong, noAnswer } from "../components/scoring";
import { durationOf, firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m5-shared";

/**
 * 68 · SOLO UN DETTAGLIO (manche 5) — una CLIP originale, disegnata in codice (scena con oggetti animati a
 * fotogrammi: niente video esterni), passa UNA sola volta sulla TV, uguale per tutti i tavoli. Finita la clip
 * arriva la domanda su un dettaglio marginale (mai sull'azione principale). Giusta +100, +20 al massimo di
 * rapidità (contenuto identico per tutti), sbagliata 0.
 *
 * Con `publicViewAt` la clip parte verso i telefoni/TV solo durante la proiezione e la domanda solo dopo:
 * chi si collega tardi non può rivederla. L'alternativa testuale (`alt`) viaggia con la clip.
 */

/** conto alla rovescia prima del ciak */
export const COUNTDOWN_MS = 3000;

const trackKey = z.object({
  /** ms dall'inizio della clip */
  at: z.number().int().min(0).max(20000),
  /** posizione del centro in percentuale della tela 16:9 */
  x: z.number().min(-15).max(115),
  y: z.number().min(-15).max(115),
  /** scala (1 = 150 px su 1600) */
  s: z.number().min(0.3).max(3).optional(),
  /** rotazione in gradi */
  r: z.number().min(-360).max(360).optional(),
  /** opacità 0..1 */
  o: z.number().min(0).max(1).optional(),
});
export type TrackKey = z.infer<typeof trackKey>;

const actorSchema = z
  .object({
    kind: z.enum(ICON_KINDS),
    tone: z.enum(TONES).default("white"),
    label: z.string().max(18).optional(),
    /** fotogrammi chiave (tempi crescenti): l'oggetto esiste dal primo all'ultimo */
    track: z.array(trackKey).min(1).max(10),
  })
  .refine((a) => !a.label || LABEL_KINDS.includes(a.kind), { message: "questa icona non mostra testi" })
  .refine((a) => a.track.every((k, i) => i === 0 || k.at >= a.track[i - 1].at), { message: "fotogrammi non in ordine" });
export type ClipActor = z.infer<typeof actorSchema>;

const captionSchema = z.object({ from: z.number().int().min(0), to: z.number().int().min(0), text: text(70) });

export const clipSchema = z.object({
  backdrop: z.enum(SCENE_BACKDROPS),
  /** oggetti fermi sulla scena */
  props: z.array(sceneItemSchema).max(16),
  /** oggetti che si muovono, compaiono o spariscono */
  actors: z.array(actorSchema).min(2).max(12),
  /** sottotitoli dell'azione principale (la «storia» che distrae) */
  captions: z.array(captionSchema).max(5),
});
export type Clip = z.infer<typeof clipSchema>;

export const dettaglioContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    /** titolo della clip, es. «Il regionale delle 18:40» */
    title: text(50),
    clipMs: z.number().int().min(6000).max(16000),
    clip: clipSchema,
    /** alternativa testuale completa della clip (lettori di schermo) */
    alt: text(700),
    prompt: text(170),
    options: optionsSchema(4, 4),
    solution: z.object({
      optionId: idSchema,
      /** fermo immagine del reveal: istante e cerchio sul dettaglio (percentuali della tela) */
      focus: z.object({ at: z.number().int().min(0), x: z.number().min(0).max(100), y: z.number().min(0).max(100), r: z.number().min(3).max(30) }),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.options, [c.solution.optionId], ctx, ["options"]);
    if (c.solution.focus.at > c.clipMs) ctx.addIssue({ code: "custom", message: "il fermo immagine cade dopo la fine della clip" });
    c.clip.actors.forEach((a, i) => {
      if (a.track[a.track.length - 1].at > c.clipMs) ctx.addIssue({ code: "custom", message: `attore ${i}: fotogramma oltre la fine della clip` });
    });
    c.clip.captions.forEach((s, i) => {
      if (s.to <= s.from || s.to > c.clipMs) ctx.addIssue({ code: "custom", message: `sottotitolo ${i} fuori tempo` });
    });
  });
export type DettaglioContent = z.infer<typeof dettaglioContent>;
export type DettaglioInput = z.input<typeof dettaglioContent>;

export const dettaglioSubmission = z.object({ optionId: idSchema });
export type DettaglioSubmission = z.infer<typeof dettaglioSubmission>;

export interface DettaglioView extends BaseView {
  title: string;
  countdownMs: number;
  clipMs: number;
  /** la clip: solo durante la proiezione con `publicViewAt` */
  clip: Clip | null;
  alt: string | null;
  /** la domanda: solo dopo la clip con `publicViewAt` */
  prompt: string | null;
  options: Option[] | null;
}

export interface DettaglioReveal {
  title: string;
  clipMs: number;
  clip: Clip;
  alt: string;
  prompt: string;
  options: Option[];
  solutionId: string;
  focus: { at: number; x: number; y: number; r: number };
  explain: string;
}

// ---------------------------------------------------------------------------
// Animazione pura (usata dalla UI: stessa posa per lo stesso istante su ogni schermo)
// ---------------------------------------------------------------------------

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export interface ActorPose {
  x: number;
  y: number;
  s: number;
  r: number;
  o: number;
}

/** Posa di un attore all'istante `t` (ms dall'inizio della clip); null se in quel momento non è in scena. */
export function poseAt(actor: Pick<ClipActor, "track">, t: number): ActorPose | null {
  const k = actor.track;
  if (!k.length || t < k[0].at || t > k[k.length - 1].at) return null;
  let i = 0;
  while (i < k.length - 1 && t > k[i + 1].at) i++;
  const a = k[i];
  const b = k[Math.min(i + 1, k.length - 1)];
  const span = b.at - a.at;
  const f = span > 0 ? ease(Math.min(1, Math.max(0, (t - a.at) / span))) : 0;
  const mix = (p: number, q: number) => p + (q - p) * f;
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), s: mix(a.s ?? 1, b.s ?? a.s ?? 1), r: mix(a.r ?? 0, b.r ?? a.r ?? 0), o: mix(a.o ?? 1, b.o ?? a.o ?? 1) };
}

export function captionAt(clip: Pick<Clip, "captions">, t: number): string | null {
  return clip.captions.find((s) => t >= s.from && t < s.to)?.text ?? null;
}

/** Oggetti fermi in forma completa (con i valori predefiniti), per il disegno. */
export function propsOf(clip: Clip): SceneItem[] {
  return clip.props;
}

// ---------------------------------------------------------------------------

function view(c: DettaglioContent, ctx: PhaseCtx, elapsedMs: number | null): DettaglioView {
  const clipEnd = COUNTDOWN_MS + c.clipMs;
  const showClip = elapsedMs === null || elapsedMs < clipEnd;
  const showQuestion = elapsedMs === null || elapsedMs >= clipEnd;
  return {
    ...baseView(def, ctx),
    title: c.title,
    countdownMs: COUNTDOWN_MS,
    clipMs: c.clipMs,
    clip: showClip ? c.clip : null,
    alt: showClip ? c.alt : null,
    prompt: showQuestion ? c.prompt : null,
    options: showQuestion ? publicOptions(c.options, `${ctx.seed}:opzioni`) : null,
  };
}

const def: MechanicDef<DettaglioContent, DettaglioSubmission> = {
  code: "solo-un-dettaglio",
  number: 68,
  manche: 5,
  title: "Solo un dettaglio",
  input: "team",
  timerSec: 50,
  oneDeviceOk: true,
  needs: ["video"],
  rule: "Una clip passa in TV una volta sola, uguale per tutti. Poi una domanda su un dettaglio di contorno: giusta +100, più rapidità.",
  contentSchema: dettaglioContent,
  submissionSchema: dettaglioSubmission,
  publicView: (c, ctx) => view(c, ctx, null),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const qStart = COUNTDOWN_MS + content.clipMs;
    const windowMs = Math.max(1, (durationOf(ctx) || def.timerSec * 1000) - qStart);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.optionId === content.solution.optionId, { speed: true, elapsedMs: Math.max(0, s.elapsedMs - qStart), windowMs });
      }),
    };
  },
  reveal: (c): DettaglioReveal => ({
    title: c.title,
    clipMs: c.clipMs,
    clip: c.clip,
    alt: c.alt,
    prompt: c.prompt,
    options: c.options,
    solutionId: c.solution.optionId,
    focus: c.solution.focus,
    explain: c.explain,
  }),
};

export const soloUnDettaglio: MechanicModule<DettaglioContent, DettaglioSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({ optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)) }), {
        minMs: COUNTDOWN_MS + c.clipMs + 3000,
        maxMs: Math.max(COUNTDOWN_MS + c.clipMs + 4000, Math.round((durationOf(ctx) || 50000) * 0.85)),
      }),
  },
};
