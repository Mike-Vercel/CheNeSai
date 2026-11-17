import { z } from "zod";
import type { MechanicDef } from "../contract";
import { ICON_KINDS, LABEL_KINDS, type IconKind } from "../components/art";
import { idSchema } from "../components/choice";
import { seededShuffle } from "../components/rng";
import { noAnswer, rightWrong } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { difficultySchema, docKindSchema, norm, type DocKind } from "./_m4";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 52 · ARCHIVIO MANOMESSO (manche 4) — un fascicolo grafico di 3–4 documenti inventati (prenotazione, SMS,
 * scontrino, verbale…). Gli stessi fatti (orario, targa, indirizzo…) compaiono in più documenti: UN campo è
 * stato ritoccato e contraddice gli altri. Si tocca il campo manomesso. Giusto 100.
 * Validazione automatica (regola della maggioranza): in esattamente un gruppo di campi dello stesso fatto c'è
 * un valore diverso, che compare una volta sola contro almeno due concordi; è quello della soluzione.
 */

export const FIELD_ID = /^[a-f][1-6]$/;

const fieldSchema = z.object({
  /** id neutro «lettera del documento + numero» (es. b3): non deve dire nulla */
  id: z.string().regex(FIELD_ID),
  label: text(24),
  text: text(40),
  /** chiave del fatto (campi con la stessa chiave raccontano la stessa cosa); mai nella vista pubblica */
  fact: idSchema.optional(),
  /** forma canonica per il confronto (es. «14/06» e «Sabato 14 giugno» sono la stessa data) */
  norm: z.string().max(40).optional(),
});

const docSchema = z
  .object({
    id: idSchema,
    kind: docKindSchema,
    title: text(44),
    fields: z.array(fieldSchema).min(2).max(5),
    icon: z.enum(ICON_KINDS).optional(),
    iconLabel: z.string().max(18).optional(),
  })
  .refine((d) => !d.iconLabel || (d.icon && LABEL_KINDS.includes(d.icon)), { message: "questa icona non mostra testi" });

type Doc = z.infer<typeof docSchema>;

/** Campi manomessi secondo la regola della maggioranza (in un caso valido: esattamente uno). */
export function tamperedFields(docs: readonly Doc[]): { tampered: string[]; witnesses: string[] } {
  const groups = new Map<string, { id: string; v: string }[]>();
  for (const d of docs)
    for (const f of d.fields) {
      if (!f.fact) continue;
      const g = groups.get(f.fact) ?? [];
      g.push({ id: f.id, v: norm(f.norm ?? f.text) });
      groups.set(f.fact, g);
    }
  const tampered: string[] = [];
  const witnesses: string[] = [];
  for (const g of groups.values()) {
    const counts = new Map<string, number>();
    for (const x of g) counts.set(x.v, (counts.get(x.v) ?? 0) + 1);
    if (counts.size < 2) continue;
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    // valido solo se: due valori, uno con almeno 2 voti e l'altro con 1
    if (counts.size === 2 && sorted[0][1] >= 2 && sorted[1][1] === 1) {
      tampered.push(g.find((x) => x.v === sorted[1][0])!.id);
      witnesses.push(...g.filter((x) => x.v === sorted[0][0]).map((x) => x.id));
    } else tampered.push(...g.map((x) => x.id));
  }
  return { tampered, witnesses };
}

export const archivioContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    caseTitle: text(70),
    story: text(200),
    docs: z.array(docSchema).min(3).max(4),
    solution: z.object({ fieldId: z.string().regex(FIELD_ID) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const ids = c.docs.flatMap((d) => d.fields.map((f) => f.id));
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "id dei campi duplicati" });
    if (new Set(c.docs.map((d) => d.id)).size !== c.docs.length) ctx.addIssue({ code: "custom", message: "id dei documenti duplicati" });
    const { tampered } = tamperedFields(c.docs);
    if (tampered.length !== 1 || tampered[0] !== c.solution.fieldId) ctx.addIssue({ code: "custom", message: `la maggioranza indica ${JSON.stringify(tampered)} invece di ${c.solution.fieldId}` });
  });
export type ArchivioContent = z.infer<typeof archivioContent>;
export type ArchivioInput = z.input<typeof archivioContent>;

export const archivioSubmission = z.object({ fieldId: z.string().regex(FIELD_ID) });
export type ArchivioSubmission = z.infer<typeof archivioSubmission>;

export interface ArchivioDoc {
  id: string;
  kind: DocKind;
  title: string;
  fields: { id: string; label: string; text: string }[];
  icon?: IconKind;
  iconLabel?: string;
}

export interface ArchivioView extends BaseView {
  caseTitle: string;
  story: string;
  docs: ArchivioDoc[];
}

export interface ArchivioReveal {
  docs: ArchivioDoc[];
  fieldId: string;
  /** campi che smentiscono quello manomesso */
  witnesses: string[];
  explain: string;
}

function publicDoc(d: Doc): ArchivioDoc {
  return {
    id: d.id,
    kind: d.kind,
    title: d.title,
    fields: d.fields.map((f) => ({ id: f.id, label: f.label, text: f.text })),
    ...(d.icon ? { icon: d.icon } : {}),
    ...(d.iconLabel ? { iconLabel: d.iconLabel } : {}),
  };
}

const def: MechanicDef<ArchivioContent, ArchivioSubmission> = {
  code: "archivio-manomesso",
  number: 52,
  manche: 4,
  title: "Archivio manomesso",
  input: "team",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Nel fascicolo qualcuno ha ritoccato un dettaglio. Confrontate i documenti e toccate il campo che non torna.",
  contentSchema: archivioContent,
  submissionSchema: archivioSubmission,
  publicView: (c, ctx): ArchivioView => ({
    ...baseView(def, ctx),
    caseTitle: c.caseTitle,
    story: c.story,
    docs: seededShuffle(c.docs, `${ctx.seed}:fascicolo`).map(publicDoc),
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.fieldId === content.solution.fieldId, { okLabel: "Ritocco trovato", koLabel: "Quel campo era giusto" });
      }),
    };
  },
  reveal: (c): ArchivioReveal => ({ docs: c.docs.map(publicDoc), fieldId: c.solution.fieldId, witnesses: tamperedFields(c.docs).witnesses, explain: c.explain }),
};

export const archivioManomesso: MechanicModule<ArchivioContent, ArchivioSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        fieldId: pickAnswer(
          rnd,
          c.solution.fieldId,
          c.docs.flatMap((d) => d.fields.map((f) => f.id)),
          demoSkill(i),
        ),
      })),
  },
};
