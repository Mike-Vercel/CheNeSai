import "server-only";
import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { validateTemplate } from "@/lib/show/director";
import { CHARACTER_ANIMATIONS, COMEDY_LEVELS, SHOW_EVENT_TYPES, type DialogueTemplate } from "@/lib/show/types";
import { audit, CmsError } from "../audit";
import type { Actor } from "../engine";

/**
 * Libreria delle battute dei presentatori (regia → "Presentatori").
 * Le battute sono DATI: testo con segnaposto ammessi per l'evento, mai codice eseguibile.
 */
export const templateInputSchema = z.object({
  character: z.enum(["professore", "regina", "palmino"]),
  event: z.enum(SHOW_EVENT_TYPES),
  text: z.string().trim().min(3).max(300),
  tone: z.string().trim().min(2).max(30).default("comico"),
  intensity: z.number().int().min(1).max(3).default(2),
  priority: z.number().int().min(0).max(100).default(50),
  weight: z.number().min(0.1).max(10).default(1),
  cooldownSec: z.number().int().min(0).max(7200).default(120),
  animation: z.enum(CHARACTER_ANIMATIONS).nullable().default("talk"),
  enabled: z.boolean().default(true),
  /** livello di comicità (la regia usa le battute fino al livello scelto) */
  level: z.enum(COMEDY_LEVELS).default("leggero"),
  /** condizioni e voce (es. "gruppo", "squadre", "timer30", "non_finale", "voce:whispers") */
  tags: z
    .array(z.string().trim().regex(/^[a-z0-9_]+(:[a-z0-9 _-]{1,30})?$/))
    .max(12)
    .default([]),
  /** scenetta: righe con la stessa chiave dette in ordine di passo (vuoto = battuta singola) */
  sceneKey: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,60}$/)
    .nullable()
    .default(null),
  sceneStep: z.number().int().min(1).max(12).nullable().default(null),
  /** variante femminile (battute con accordi di genere rivolte a un giocatore nominato) */
  textF: z.string().trim().min(3).max(300).nullable().default(null),
  /** variante neutra: genere non detto e squadre (senza, la battuta con variante femminile non si dice a chi non l'ha indicato) */
  textN: z.string().trim().min(3).max(300).nullable().default(null),
});
export type TemplateInput = z.infer<typeof templateInputSchema>;

export interface TemplateRow extends DialogueTemplate {
  updatedAt: string;
  usedCount: number;
}

function checkScene(t: { sceneKey?: string | null; sceneStep?: number | null }) {
  if (!!t.sceneKey !== (t.sceneStep != null)) throw new CmsError("Scenetta: indica sia il nome sia il passo (oppure nessuno dei due)", 422);
}

function check(t: Pick<TemplateInput, "event" | "text">) {
  const errors = validateTemplate(t);
  if (errors.length) throw new CmsError(`Battuta non valida: ${errors.join("; ")}`, 422);
}

export async function listTemplates(): Promise<TemplateRow[]> {
  const rows = await getSql()<
    {
      id: string;
      character: DialogueTemplate["character"];
      event_type: DialogueTemplate["event"];
      text: string;
      tone: string;
      intensity: number;
      priority: number;
      weight: string;
      cooldown_sec: number;
      animation: DialogueTemplate["animation"];
      enabled: boolean;
      level: NonNullable<DialogueTemplate["level"]>;
      origin: NonNullable<DialogueTemplate["origin"]>;
      tags: string[];
      scene_key: string | null;
      scene_step: number | null;
      text_f: string | null;
      text_n: string | null;
      updated_at: Date;
      used: number;
    }[]
  >`
    select t.*, (select count(*)::int from show_dialogue_log l where l.template_id = t.id) as used
    from dialogue_templates t order by t.event_type, coalesce(t.scene_key, ''), t.scene_step nulls first, t.character, t.id`;
  return rows.map((r) => ({
    id: r.id,
    character: r.character,
    event: r.event_type,
    text: r.text,
    tone: r.tone,
    intensity: r.intensity,
    priority: r.priority,
    weight: Number(r.weight),
    cooldownSec: r.cooldown_sec,
    animation: r.animation,
    enabled: r.enabled,
    level: r.level,
    origin: r.origin,
    tags: r.tags ?? [],
    sceneKey: r.scene_key,
    sceneStep: r.scene_step,
    textF: r.text_f,
    textN: r.text_n,
    updatedAt: r.updated_at.toISOString(),
    usedCount: r.used,
  }));
}

export async function createTemplate(raw: unknown, actor: Actor): Promise<string> {
  const p = templateInputSchema.safeParse(raw);
  if (!p.success) throw new CmsError("Battuta non valida", 422, p.error.issues);
  const t = p.data;
  check(t);
  if (t.textF) check({ event: t.event, text: t.textF });
  if (t.textN) check({ event: t.event, text: t.textN });
  checkScene(t);
  const sql = getSql();
  const base = `${t.character}-${t.event.toLowerCase().replace(/_/g, "-")}`;
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from dialogue_templates where id like ${base + "-%"}`;
  const id = `${base}-u${String(n + 1).padStart(2, "0")}-${Date.now().toString(36).slice(-4)}`;
  await sql.begin(async (tx) => {
    await tx`
      insert into dialogue_templates (id, character, event_type, text, tone, intensity, priority, weight, cooldown_sec, animation, enabled,
                                      level, origin, tags, scene_key, scene_step, text_f, text_n)
      values (${id}, ${t.character}, ${t.event}, ${t.text}, ${t.tone}, ${t.intensity}, ${t.priority}, ${t.weight}, ${t.cooldownSec}, ${t.animation}, ${t.enabled},
              ${t.level}, 'admin', ${tx.array(t.tags)}::text[], ${t.sceneKey}, ${t.sceneStep}, ${t.textF}, ${t.textN})`;
    await audit(tx, actor, "dialogue.create", { type: "dialogue_template", id });
  });
  return id;
}

export async function updateTemplate(id: string, raw: unknown, actor: Actor): Promise<void> {
  // parziale: niente valori predefiniti (un campo assente resta com'è)
  const p = templateInputSchema
    .partial()
    .extend({ level: z.enum(COMEDY_LEVELS).optional(), tags: templateInputSchema.shape.tags.removeDefault().optional(), sceneKey: templateInputSchema.shape.sceneKey.removeDefault().optional(), sceneStep: templateInputSchema.shape.sceneStep.removeDefault().optional(),
      textF: templateInputSchema.shape.textF.removeDefault().optional(),
      textN: templateInputSchema.shape.textN.removeDefault().optional(),
    })
    .safeParse(raw);
  if (!p.success) throw new CmsError("Battuta non valida", 422, p.error.issues);
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [cur] = await tx<{ event_type: TemplateInput["event"]; text: string; scene_key: string | null; scene_step: number | null }[]>`
      select event_type, text, scene_key, scene_step from dialogue_templates where id = ${id} for update`;
    if (!cur) throw new CmsError("Battuta non trovata", 404);
    const d = p.data;
    check({ event: d.event ?? cur.event_type, text: d.text ?? cur.text });
    if (d.textF) check({ event: d.event ?? cur.event_type, text: d.textF });
    if (d.textN) check({ event: d.event ?? cur.event_type, text: d.textN });
    checkScene({ sceneKey: d.sceneKey === undefined ? cur.scene_key : d.sceneKey, sceneStep: d.sceneStep === undefined ? cur.scene_step : d.sceneStep });
    await tx`
      update dialogue_templates set
        character = coalesce(${d.character ?? null}, character),
        event_type = coalesce(${d.event ?? null}, event_type),
        text = coalesce(${d.text ?? null}, text),
        tone = coalesce(${d.tone ?? null}, tone),
        intensity = coalesce(${d.intensity ?? null}::smallint, intensity),
        priority = coalesce(${d.priority ?? null}::smallint, priority),
        weight = coalesce(${d.weight ?? null}::numeric, weight),
        cooldown_sec = coalesce(${d.cooldownSec ?? null}::int, cooldown_sec),
        animation = ${d.animation === undefined ? tx`animation` : d.animation},
        enabled = coalesce(${d.enabled ?? null}::boolean, enabled),
        level = coalesce(${d.level ?? null}, level),
        tags = ${d.tags === undefined ? tx`tags` : tx`${tx.array(d.tags)}::text[]`},
        scene_key = ${d.sceneKey === undefined ? tx`scene_key` : d.sceneKey},
        scene_step = ${d.sceneStep === undefined ? tx`scene_step` : d.sceneStep},
        text_f = ${d.textF === undefined ? tx`text_f` : d.textF},
        text_n = ${d.textN === undefined ? tx`text_n` : d.textN},
        updated_at = now()
      where id = ${id}`;
    await audit(tx, actor, "dialogue.update", { type: "dialogue_template", id, details: { fields: Object.keys(d) } });
  });
}

export async function deleteTemplate(id: string, actor: Actor): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const r = await tx`delete from dialogue_templates where id = ${id} returning id`;
    if (r.length === 0) throw new CmsError("Battuta non trovata", 404);
    await audit(tx, actor, "dialogue.delete", { type: "dialogue_template", id });
  });
}

/** Ultime battute dette in una serata (diagnostica della regia). */
export async function recentShowLines(sessionId: string, limit = 20) {
  const rows = await getSql()<{ character: string; event_type: string; text: string; created_at: Date }[]>`
    select character, event_type, text, created_at from show_dialogue_log where session_id = ${sessionId}
    order by created_at desc limit ${limit}`;
  return rows.map((r) => ({ who: r.character, event: r.event_type, text: r.text, at: r.created_at.toISOString() }));
}
