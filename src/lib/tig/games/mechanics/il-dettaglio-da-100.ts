import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { ICON_KINDS, sceneSchema, type Scene } from "../components/art";
import { publicOptions, type Option } from "../components/choice";
import { baseView, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { checkSingle, demoSingle, difficultySchema, optionSolution, optionSubmission, scoreSingle, type OptionSubmission } from "./m1/common";

/**
 * 10 · IL DETTAGLIO DA 100 (manche 1) — una scena piena di stimoli (oggetti, scritte, una striscia di testo
 * che scorre, coriandoli) resta in TV 6 secondi; poi sparisce e arriva UNA domanda molto specifica, a
 * quattro opzioni. 100 se giusta. Le domande sono di tipo controllato (`check`): lo schema verifica che la
 * risposta giusta si legga davvero nella scena e che le altre no, così la difficoltà resta confrontabile.
 */

export const SHOW_MS = 6000;

const checkSchema = z.discriminatedUnion("k", [
  /** «Cosa c'era scritto sul post-it?»: l'unico oggetto di quel tipo ha come testo la risposta giusta */
  z.object({ k: z.literal("etichetta"), kind: z.enum(ICON_KINDS) }),
  /** «Quante candele c'erano?»: la risposta giusta è il numero di oggetti di quel tipo */
  z.object({ k: z.literal("quanti"), kind: z.enum(ICON_KINDS) }),
  /** «Quale di questi oggetti NON c'era?»: opzione → tipo di oggetto; assente solo quello della risposta */
  z.object({ k: z.literal("assente"), kinds: z.record(z.string(), z.enum(ICON_KINDS)) }),
  /** «Cosa diceva la scritta che scorreva?»: la risposta giusta è nella striscia, le altre no */
  z.object({ k: z.literal("striscia") }),
]);

const norm = (s: string) => s.trim().toLowerCase();

export const dettaglioContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** nome della scena, es. «La festa di laurea» */
    sceneTitle: text(48),
    scene: sceneSchema,
    /** striscia di testo che scorre sulla scena (uno stimolo in più) */
    ticker: text(90).optional(),
    /** alternativa testuale completa della scena (lettori di schermo) */
    alt: text(700),
    prompt: text(110),
    options: optionsSchema(4, 4),
    check: checkSchema,
    solution: optionSolution,
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkSingle(c.options, c.solution.optionId, ctx);
    const right = c.options.find((o) => o.id === c.solution.optionId);
    if (!right) return;
    const wrong = c.options.filter((o) => o.id !== right.id);
    const items = c.scene.items;
    const fail = (message: string) => ctx.addIssue({ code: "custom", message, path: ["check"] });
    switch (c.check.k) {
      case "etichetta": {
        const kind = c.check.kind;
        const of = items.filter((i) => i.kind === kind);
        if (of.length !== 1) fail(`serve un solo oggetto «${kind}» nella scena`);
        else if (norm(of[0].label ?? "") !== norm(right.text)) fail(`il testo su «${kind}» non è la risposta giusta`);
        if (wrong.some((o) => norm(o.text) === norm(of[0]?.label ?? ""))) fail("una risposta sbagliata coincide col testo");
        break;
      }
      case "quanti": {
        const kind = c.check.kind;
        const n = items.filter((i) => i.kind === kind).length;
        if (String(n) !== right.text.trim()) fail(`nella scena ci sono ${n} «${kind}», non ${right.text}`);
        if (wrong.some((o) => !/^\d+$/.test(o.text.trim()) || Number(o.text) === n)) fail("le opzioni devono essere numeri diversi dal giusto");
        break;
      }
      case "assente": {
        const kinds = c.check.kinds;
        for (const o of c.options) {
          const k = kinds[o.id];
          if (!k) {
            fail(`manca il tipo di oggetto per l'opzione ${o.id}`);
            continue;
          }
          const present = items.some((i) => i.kind === k);
          if (o.id === right.id && present) fail(`«${k}» è nella scena ma è la risposta «non c'era»`);
          if (o.id !== right.id && !present) fail(`«${k}» non è nella scena: sarebbe un'altra risposta giusta`);
        }
        break;
      }
      case "striscia": {
        const t = norm(c.ticker ?? "");
        if (!t) fail("serve la striscia di testo");
        if (!t.includes(norm(right.text))) fail("la risposta giusta non è nella striscia");
        if (wrong.some((o) => t.includes(norm(o.text)))) fail("una risposta sbagliata è nella striscia");
        break;
      }
    }
  });
export type DettaglioContent = z.infer<typeof dettaglioContent>;
export type DettaglioInput = z.input<typeof dettaglioContent>;

export interface DettaglioView extends BaseView {
  sceneTitle: string;
  /** scena e striscia: presenti solo nei primi `showMs` se il runtime usa `publicViewAt` */
  scene: Scene | null;
  ticker: string | null;
  alt: string | null;
  showMs: number;
  prompt: string;
  options: Option[];
}

export interface DettaglioReveal {
  sceneTitle: string;
  scene: Scene;
  ticker: string | null;
  alt: string;
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
}

function view(c: DettaglioContent, ctx: PhaseCtx, withScene: boolean): DettaglioView {
  return {
    ...baseView(def, ctx),
    sceneTitle: c.sceneTitle,
    scene: withScene ? c.scene : null,
    ticker: withScene ? (c.ticker ?? null) : null,
    alt: withScene ? c.alt : null,
    showMs: SHOW_MS,
    prompt: c.prompt,
    options: publicOptions(c.options, `${ctx.seed}:dettaglio`),
  };
}

const def: MechanicDef<DettaglioContent, OptionSubmission> = {
  code: "il-dettaglio-da-100",
  number: 10,
  manche: 1,
  title: "Il dettaglio da 100",
  input: "team",
  timerSec: 25,
  oneDeviceOk: true,
  needs: ["image"],
  rule: "Una scena piena di cose resta in TV 6 secondi. Poi una sola domanda, precisissima: vale 100 o niente.",
  contentSchema: dettaglioContent,
  submissionSchema: optionSubmission,
  publicView: (c, ctx) => view(c, ctx, true),
  score: ({ content, ctx, submissions }) => scoreSingle(content.solution.optionId, ctx, submissions, { okLabel: "Dettaglio da 100", koLabel: "Dettaglio sfuggito" }),
  reveal: (c): DettaglioReveal => ({
    sceneTitle: c.sceneTitle,
    scene: c.scene,
    ticker: c.ticker ?? null,
    alt: c.alt,
    prompt: c.prompt,
    options: c.options,
    solutionId: c.solution.optionId,
    explain: c.explain,
  }),
};

export const ilDettaglioDa100: MechanicModule<DettaglioContent, OptionSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs < SHOW_MS),
    demoSubmissions: (c, ctx, seed) => demoSingle(ctx, seed, c.solution.optionId, c.options.map((o) => o.id), { minMs: SHOW_MS + 2000 }),
  },
};

export type DettaglioCheck = z.infer<typeof checkSchema>;
