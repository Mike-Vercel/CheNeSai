import { z } from "zod";
import type { MechanicDef } from "../contract";
import { ICON_KINDS, LABEL_KINDS, type IconKind } from "../components/art";
import { idSchema } from "../components/choice";
import { seededShuffle } from "../components/rng";
import { noAnswer, rightWrong } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { difficultySchema, docKindSchema, TELLTALE_ID, type DocKind } from "./_m4";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 62 · LA FINTA PROVA (manche 4) — un dossier di tre elementi (scontrino, foto, messaggio…) su un caso
 * inventato. Uno è stato costruito per depistare: contiene un dettaglio che i FATTI ACCERTATI rendono
 * impossibile (locale chiuso, data che non esiste, totale che non torna…). Giusto 100. Il debrief mostra
 * il dettaglio che tradisce il falso e perché gli altri due reggono.
 */

const itemSchema = z
  .object({
    /** id neutro (non deve suggerire quale sia il falso) */
    id: idSchema,
    kind: docKindSchema,
    title: text(50),
    lines: z.array(text(110)).min(1).max(4),
    /** a cosa porterebbe credergli, es. «Ivo era al bar: ha un alibi» */
    suggests: text(100),
    /** disegno facoltativo (foto, biglietti…) */
    icon: z.enum(ICON_KINDS).optional(),
    iconLabel: z.string().max(18).optional(),
  })
  .refine((i) => !i.iconLabel || (i.icon && LABEL_KINDS.includes(i.icon)), { message: "questa icona non mostra testi" });

export const fintaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    caseTitle: text(70),
    /** la situazione in una frase */
    story: text(220),
    facts: z.array(text(160)).min(2).max(3),
    items: z.array(itemSchema).length(3),
    solution: z.object({
      itemId: idSchema,
      /** il dettaglio che tradisce il falso */
      tell: text(240),
      /** perché gli altri due reggono (id → motivo) */
      genuine: z.record(z.string(), text(180)),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const ids = c.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "id duplicati" });
    if (!ids.includes(c.solution.itemId)) ctx.addIssue({ code: "custom", message: "soluzione inesistente" });
    for (const id of ids) {
      if (TELLTALE_ID.test(id)) ctx.addIssue({ code: "custom", message: `id «${id}» rivela la soluzione` });
      if (id !== c.solution.itemId && !c.solution.genuine[id]) ctx.addIssue({ code: "custom", message: `manca il perché di ${id}` });
    }
  });
export type FintaContent = z.infer<typeof fintaContent>;
export type FintaInput = z.input<typeof fintaContent>;

export const fintaSubmission = z.object({ itemId: idSchema });
export type FintaSubmission = z.infer<typeof fintaSubmission>;

export interface DossierItem {
  id: string;
  kind: DocKind;
  title: string;
  lines: string[];
  suggests: string;
  icon?: IconKind;
  iconLabel?: string;
}

export interface FintaView extends BaseView {
  caseTitle: string;
  story: string;
  facts: string[];
  items: DossierItem[];
}

export interface FintaReveal {
  items: (DossierItem & { fake: boolean; note: string })[];
  explain: string;
}

function publicItem(i: FintaContent["items"][number]): DossierItem {
  return { id: i.id, kind: i.kind, title: i.title, lines: i.lines, suggests: i.suggests, ...(i.icon ? { icon: i.icon } : {}), ...(i.iconLabel ? { iconLabel: i.iconLabel } : {}) };
}

const def: MechanicDef<FintaContent, FintaSubmission> = {
  code: "la-finta-prova",
  number: 62,
  manche: 4,
  title: "La finta prova",
  input: "team",
  timerSec: 50,
  oneDeviceOk: true,
  needs: [],
  rule: "Tre prove nel dossier, una è costruita per depistare. Confrontatele con i fatti accertati e smascherate il falso.",
  contentSchema: fintaContent,
  submissionSchema: fintaSubmission,
  publicView: (c, ctx): FintaView => ({
    ...baseView(def, ctx),
    caseTitle: c.caseTitle,
    story: c.story,
    facts: c.facts,
    items: seededShuffle(c.items, `${ctx.seed}:dossier`).map(publicItem),
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.itemId === content.solution.itemId, { okLabel: "Falso smascherato", koLabel: "Era una prova vera" });
      }),
    };
  },
  reveal: (c): FintaReveal => ({
    items: c.items.map((i) => ({ ...publicItem(i), fake: i.id === c.solution.itemId, note: i.id === c.solution.itemId ? c.solution.tell : (c.solution.genuine[i.id] ?? "") })),
    explain: c.explain,
  }),
};

export const laFintaProva: MechanicModule<FintaContent, FintaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({ itemId: pickAnswer(rnd, c.solution.itemId, c.items.map((x) => x.id), demoSkill(i)) })),
  },
};
