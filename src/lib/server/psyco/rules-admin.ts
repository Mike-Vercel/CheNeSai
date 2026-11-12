import "server-only";
import { z } from "zod";
import { getSql, iso } from "@/lib/database/db";
import type { Difficulty } from "@/lib/psyco/types";
import { PsycoError } from "./errors";

/** Archivio delle regole PSYCO dal pannello admin: elenco, nuova regola, modifica, attiva/disattiva. */
export interface AdminRule {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  instructions: string | null;
  example: string | null;
  active: boolean;
  timesShown: number;
  timesChosen: number;
  updatedAt: string;
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const ruleInputSchema = z.object({
  title: text(2, 80),
  description: text(5, 400),
  difficulty: z.enum(["facile", "media", "difficile"]),
  instructions: z.string().trim().max(600).nullish(),
  example: z.string().trim().max(400).nullish(),
  active: z.boolean().optional(),
});
export const rulePatchSchema = ruleInputSchema.partial();

export async function listRules(): Promise<AdminRule[]> {
  const rows = await getSql()<{
    id: string;
    slug: string;
    title: string;
    description: string;
    difficulty: Difficulty;
    instructions: string | null;
    example: string | null;
    active: boolean;
    updated_at: Date;
    shown: number;
    chosen: number;
  }[]>`
    select r.*,
      (select count(*)::int from psyco_candidates c where c.rule_id = r.id) as shown,
      (select count(*)::int from psyco_rounds x where x.rule_id = r.id) as chosen
    from psyco_rules r
    order by case r.difficulty when 'facile' then 1 when 'media' then 2 else 3 end, r.title`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    difficulty: r.difficulty,
    instructions: r.instructions,
    example: r.example,
    active: r.active,
    timesShown: r.shown,
    timesChosen: r.chosen,
    updatedAt: iso(r.updated_at)!,
  }));
}

function slugify(s: string): string {
  const base = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base.length >= 3 ? base : "regola"}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createRule(raw: unknown): Promise<{ id: string }> {
  const r = ruleInputSchema.safeParse(raw);
  if (!r.success) throw new PsycoError("VALIDATION", r.error.issues[0]?.message ?? "Dati non validi", r.error.issues);
  const d = r.data;
  const [row] = await getSql()<{ id: string }[]>`
    insert into psyco_rules (slug, title, description, difficulty, instructions, example, active)
    values (${slugify(d.title)}, ${d.title}, ${d.description}, ${d.difficulty}, ${d.instructions || null}, ${d.example || null}, ${d.active ?? true})
    returning id`;
  return row;
}

export async function updateRule(id: string, raw: unknown): Promise<{ id: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new PsycoError("NOT_FOUND", "Regola non trovata");
  const r = rulePatchSchema.safeParse(raw);
  if (!r.success) throw new PsycoError("VALIDATION", r.error.issues[0]?.message ?? "Dati non validi", r.error.issues);
  const d = r.data;
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    update psyco_rules set
      title = coalesce(${d.title ?? null}, title),
      description = coalesce(${d.description ?? null}, description),
      difficulty = coalesce(${d.difficulty ?? null}, difficulty),
      instructions = ${d.instructions === undefined ? sql`instructions` : d.instructions || null},
      example = ${d.example === undefined ? sql`example` : d.example || null},
      active = coalesce(${d.active ?? null}, active),
      updated_at = now()
    where id = ${id}
    returning id`;
  if (!row) throw new PsycoError("NOT_FOUND", "Regola non trovata");
  return row;
}
