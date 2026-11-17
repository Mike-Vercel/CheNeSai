import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { ICON_KINDS } from "../components/art";
import { publicOptions, type Option } from "../components/choice";
import { baseView, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { checkSingle, demoSingle, difficultySchema, optionSolution, optionSubmission, scoreSingle, type OptionSubmission } from "./m1/common";
import { artSchema, iconsOf } from "./m1/draw";

/**
 * 13 · FEED IN 5 SECONDI (manche 1) — sulla TV scorrono cinque post INVENTATI (account, luogo, ora, like,
 * didascalia, foto disegnata in codice): 1,2 secondi l'uno dopo un via di 1,5 secondi. Il feed sparisce e
 * arriva UNA domanda su un particolare. 100 se giusta: conta la correttezza, non la velocità di lettura
 * (testi brevi, particolari grandi). La domanda è di tipo controllato (`check`) e verificata dallo schema.
 */

export const FEED_START_MS = 1500;
export const POST_MS = 1200;
export const POSTS = 5;
export const FEED_END_MS = FEED_START_MS + POSTS * POST_MS;

export const postSchema = z.object({
  /** account inventato, es. «@marta.in.cucina» */
  author: z.string().regex(/^@[a-z0-9._]{3,22}$/, "account: @ + minuscole, cifre, punto o trattino basso"),
  place: text(28),
  /** quanto tempo fa, es. «2 h», «ieri» */
  ago: text(10),
  likes: z.number().int().min(0).max(999999),
  caption: text(80),
  art: artSchema,
  /** alternativa testuale della foto */
  alt: text(200),
});
export type Post = z.infer<typeof postSchema>;

const FIELDS = ["author", "place", "likes", "ago"] as const;
const checkSchema = z.discriminatedUnion("k", [
  /** «Chi aveva pubblicato il quarto post?»: campo del post n. `post` (0–4) */
  z.object({ k: z.literal("post"), post: z.number().int().min(0).max(POSTS - 1), field: z.enum(FIELDS) }),
  /** «Quanti like aveva la foto del gatto?»: l'unico post con quell'oggetto nella foto → il suo campo */
  z.object({ k: z.literal("di"), kind: z.enum(ICON_KINDS), field: z.enum(FIELDS) }),
]);
export type FeedCheck = z.infer<typeof checkSchema>;

/** Like scritti all'italiana (1.204), uguali su server e client. */
export function likesText(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fieldText(p: Post, f: (typeof FIELDS)[number]): string {
  return f === "likes" ? likesText(p.likes) : p[f];
}

/** Post a cui si riferisce la domanda e risposta attesa (o un errore editoriale). */
export function checkTarget(posts: readonly Post[], check: FeedCheck): { post: number; answer: string } | { error: string } {
  if (check.k === "post") {
    const p = posts[check.post];
    return p ? { post: check.post, answer: fieldText(p, check.field) } : { error: "post inesistente" };
  }
  const hits = posts.map((p, i) => (iconsOf(p.art, check.kind).length ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) return { error: `l'oggetto «${check.kind}» deve stare in un solo post (ora in ${hits.length})` };
  return { post: hits[0], answer: fieldText(posts[hits[0]], check.field) };
}

const norm = (s: string) => s.trim().toLowerCase();

export const feedContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    posts: z.array(postSchema).length(POSTS),
    prompt: text(110),
    options: optionsSchema(4, 4),
    check: checkSchema,
    solution: optionSolution,
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkSingle(c.options, c.solution.optionId, ctx);
    const authors = c.posts.map((p) => p.author);
    if (new Set(authors).size !== POSTS) ctx.addIssue({ code: "custom", message: "account duplicati nel feed" });
    const t = checkTarget(c.posts, c.check);
    if ("error" in t) {
      ctx.addIssue({ code: "custom", message: t.error, path: ["check"] });
      return;
    }
    const right = c.options.find((o) => o.id === c.solution.optionId);
    if (right && norm(right.text) !== norm(t.answer)) ctx.addIssue({ code: "custom", message: `la risposta giusta dovrebbe essere «${t.answer}»`, path: ["solution"] });
    if (c.options.some((o) => o.id !== c.solution.optionId && norm(o.text) === norm(t.answer))) ctx.addIssue({ code: "custom", message: "una risposta sbagliata coincide con quella giusta" });
  });
export type FeedContent = z.infer<typeof feedContent>;
export type FeedInput = z.input<typeof feedContent>;

export interface FeedView extends BaseView {
  /** i post: presenti solo finché il feed scorre se il runtime usa `publicViewAt` */
  posts: Post[] | null;
  startMs: number;
  postMs: number;
  endMs: number;
  prompt: string;
  options: Option[];
}

export interface FeedReveal {
  posts: Post[];
  /** indice del post su cui verteva la domanda */
  post: number;
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
}

function view(c: FeedContent, ctx: PhaseCtx, withPosts: boolean): FeedView {
  return {
    ...baseView(def, ctx),
    posts: withPosts ? c.posts : null,
    startMs: FEED_START_MS,
    postMs: POST_MS,
    endMs: FEED_END_MS,
    prompt: c.prompt,
    options: publicOptions(c.options, `${ctx.seed}:feed`),
  };
}

const def: MechanicDef<FeedContent, OptionSubmission> = {
  code: "feed-in-5-secondi",
  number: 13,
  manche: 1,
  title: "Feed in 5 secondi",
  input: "team",
  timerSec: 30,
  oneDeviceOk: true,
  needs: ["image"],
  rule: "Cinque post scorrono in TV, poi spariscono. Una domanda su un particolare: conta solo azzeccarla.",
  contentSchema: feedContent,
  submissionSchema: optionSubmission,
  publicView: (c, ctx) => view(c, ctx, true),
  score: ({ content, ctx, submissions }) => scoreSingle(content.solution.optionId, ctx, submissions, { okLabel: "Occhio da social", koLabel: "Scrollato troppo in fretta" }),
  reveal: (c): FeedReveal => {
    const t = checkTarget(c.posts, c.check);
    return { posts: c.posts, post: "post" in t ? t.post : 0, prompt: c.prompt, options: c.options, solutionId: c.solution.optionId, explain: c.explain };
  },
};

export const feedIn5Secondi: MechanicModule<FeedContent, OptionSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs < FEED_END_MS),
    demoSubmissions: (c, ctx, seed) => demoSingle(ctx, seed, c.solution.optionId, c.options.map((o) => o.id), { minMs: FEED_END_MS + 3000 }),
  },
};
