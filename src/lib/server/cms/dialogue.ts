import "server-only";
import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { validateTemplate } from "@/lib/show/director";
import { CHARACTER_ANIMATIONS, SHOW_EVENT_TYPES, type DialogueTemplate } from "@/lib/show/types";
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
});
export type TemplateInput = z.infer<typeof templateInputSchema>;

export interface TemplateRow extends DialogueTemplate {
  updatedAt: string;
  usedCount: number;
}

function check(t: Pick<TemplateInput, "event" | "text">) {
  const errors = validateTemplate(t);
  if (errors.length) throw new CmsError(`Battuta non valida: ${errors.join("; ")}`, 422);
}

export async function listTemplates(): Promise<TemplateRow[]> {
  const rows = await getSql()<
    { id: string; character: DialogueTemplate["character"]; event_type: DialogueTemplate["event"]; text: string; tone: string; intensity: number; priority: number; weight: string; cooldown_sec: number; animation: DialogueTemplate["animation"]; enabled: boolean; updated_at: Date; used: number }[]
  >`
    select t.*, (select count(*)::int from show_dialogue_log l where l.template_id = t.id) as used
    from dialogue_templates t order by t.event_type, t.character, t.id`;
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
    updatedAt: r.updated_at.toISOString(),
    usedCount: r.used,
  }));
}

export async function createTemplate(raw: unknown, actor: Actor): Promise<string> {
  const p = templateInputSchema.safeParse(raw);
  if (!p.success) throw new CmsError("Battuta non valida", 422, p.error.issues);
  const t = p.data;
  check(t);
  const sql = getSql();
  const base = `${t.character}-${t.event.toLowerCase().replace(/_/g, "-")}`;
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from dialogue_templates where id like ${base + "-%"}`;
  const id = `${base}-u${String(n + 1).padStart(2, "0")}-${Date.now().toString(36).slice(-4)}`;
  await sql.begin(async (tx) => {
    await tx`
      insert into dialogue_templates (id, character, event_type, text, tone, intensity, priority, weight, cooldown_sec, animation, enabled)
      values (${id}, ${t.character}, ${t.event}, ${t.text}, ${t.tone}, ${t.intensity}, ${t.priority}, ${t.weight}, ${t.cooldownSec}, ${t.animation}, ${t.enabled})`;
    await audit(tx, actor, "dialogue.create", { type: "dialogue_template", id });
  });
  return id;
}

export async function updateTemplate(id: string, raw: unknown, actor: Actor): Promise<void> {
  const p = templateInputSchema.partial().safeParse(raw);
  if (!p.success) throw new CmsError("Battuta non valida", 422, p.error.issues);
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [cur] = await tx<{ event_type: TemplateInput["event"]; text: string }[]>`select event_type, text from dialogue_templates where id = ${id} for update`;
    if (!cur) throw new CmsError("Battuta non trovata", 404);
    const d = p.data;
    check({ event: d.event ?? cur.event_type, text: d.text ?? cur.text });
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
