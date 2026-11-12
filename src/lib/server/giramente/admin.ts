import "server-only";
import { z } from "zod";
import { getSql, iso } from "@/lib/database/db";
import { boardLayout, matchAnswer, normalizeAnswer } from "@/lib/giramente/rules";
import { PUZZLE_POOLS, type PuzzlePool } from "@/lib/giramente/types";
import { GiramenteError } from "./errors";

/**
 * Archivio degli enigmi di GIRAMENTE! dal pannello admin: elenco, nuovo, modifica, pubblica/disattiva
 * (niente cancellazioni: le partite giocate li citano), partite e statistiche.
 * La pubblicazione è BLOCCATA se l'enigma è incompleto o incoerente (validatePuzzle).
 *
 * Immagini: campo «URL immagine» (https://… oppure un percorso del sito /…), con testo alternativo
 * obbligatorio. Le immagini si possono caricare nella sezione Media dell'admin e incollarne l'indirizzo.
 */
export interface AdminPuzzle {
  id: string;
  slug: string;
  pool: PuzzlePool;
  kind: string | null;
  category: string;
  difficulty: string;
  prompt: string;
  clues: string[];
  options: string[] | null;
  answerIndex: number | null;
  solution: string;
  accepted: string[];
  extraClue: string | null;
  falseIndex: number | null;
  visual: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  explanation: string | null;
  timeLimitSec: number | null;
  status: "draft" | "published" | "disabled";
  tags: string[];
  source: "seed" | "admin";
  timesPlayed: number;
  timesCorrect: number;
  updatedAt: string;
  problems: string[];
}

const str = (max: number) => z.string().trim().max(max);
export const puzzleInputSchema = z.object({
  pool: z.enum(PUZZLE_POOLS as [PuzzlePool, ...PuzzlePool[]]),
  kind: z.enum(["intruso", "sequenza", "indizi", "prospettiva"]).nullish(),
  category: str(40).min(2),
  difficulty: z.enum(["facile", "media", "difficile"]),
  prompt: str(400).default(""),
  clues: z.array(str(200)).max(4).default([]),
  options: z.array(str(60)).max(4).nullish(),
  answerIndex: z.number().int().min(0).max(3).nullish(),
  solution: str(120).min(1),
  accepted: z.array(str(120)).max(12).default([]),
  extraClue: str(200).nullish(),
  falseIndex: z.number().int().min(0).max(3).nullish(),
  visual: z.string().max(200).nullish(),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^(https:\/\/|\/)/, "L'immagine deve essere un indirizzo https:// o un percorso del sito")
    .nullish()
    .or(z.literal("")),
  imageAlt: str(200).nullish(),
  explanation: str(400).nullish(),
  timeLimitSec: z.number().int().min(8).max(180).nullish(),
  status: z.enum(["draft", "published", "disabled"]).default("draft"),
  tags: z.array(str(30)).max(10).default([]),
});
export type PuzzleInput = z.infer<typeof puzzleInputSchema>;

/** Problemi che impediscono la pubblicazione (vuoto = enigma completo e coerente). */
export function validatePuzzle(p: PuzzleInput): string[] {
  const out: string[] = [];
  const clues = p.clues.filter((c) => c.trim());
  if (p.imageUrl && !p.imageAlt?.trim()) out.push("Manca il testo alternativo dell'immagine");
  switch (p.pool) {
    case "ruota": {
      if (!p.kind) out.push("Scegli il tipo (intruso, sequenza, indizi, prospettiva)");
      if (!p.prompt.trim()) out.push("Manca la domanda");
      const opts = (p.options ?? []).map((o) => o.trim());
      if (opts.length !== 4 || opts.some((o) => !o)) out.push("Servono 4 opzioni");
      if (new Set(opts.map(normalizeAnswer)).size !== opts.length) out.push("Le opzioni devono essere diverse tra loro");
      if (p.answerIndex === null || p.answerIndex === undefined) out.push("Indica l'opzione giusta");
      else if (opts[p.answerIndex] && normalizeAnswer(opts[p.answerIndex]) !== normalizeAnswer(p.solution)) out.push("La soluzione deve essere il testo dell'opzione giusta");
      if (!p.extraClue?.trim()) out.push("Manca l'indizio extra (Occhio Furbo)");
      else if (opts[p.answerIndex ?? -1] && normalizeAnswer(p.extraClue).includes(normalizeAnswer(opts[p.answerIndex!]))) out.push("L'indizio extra non deve contenere la risposta");
      if (p.kind === "indizi" && clues.length < 2) out.push("Gli enigmi a indizi hanno almeno 2 indizi");
      break;
    }
    case "falsa_pista":
      if (clues.length !== 4) out.push("Servono 4 indizi");
      if (p.falseIndex === null || p.falseIndex === undefined) out.push("Indica quale indizio è la falsa pista");
      break;
    case "collegamento":
      if (clues.length !== 3) out.push("Servono 3 parole");
      if (!p.extraClue?.trim()) out.push("Manca il quarto indizio");
      break;
    case "finale":
      if (!p.kind) out.push("Scegli la categoria (intruso, sequenza, indizi, prospettiva)");
      if (!p.prompt.trim()) out.push("Manca la domanda");
      if (clues.length !== 3) out.push("Servono 3 indizi progressivi (dal più difficile al più facile)");
      break;
    case "tabellone": {
      const phrase = p.solution.trim();
      if (!/^[A-ZÀÈÉÌÒÙ' ,!?]{6,40}$/.test(phrase)) out.push("La frase va in MAIUSCOLO, 6–40 caratteri, solo lettere, spazi, apostrofi, virgole, ! e ?");
      if (phrase.split(" ").some((w) => [...w].length > 12)) out.push("Ogni parola al massimo 12 lettere");
      if (boardLayout(phrase).length > 4) out.push("La frase occupa più di 4 righe del tabellone");
      if (!p.extraClue?.trim()) out.push("Manca l'indizio");
      break;
    }
  }
  if (p.pool !== "ruota" && p.pool !== "tabellone" && !matchAnswer(p.solution, p.solution, p.accepted)) out.push("La soluzione non è valida");
  if (p.visual && p.visual.split("\n").some((l) => [...l].length > 16)) out.push("Il disegno ha righe troppo lunghe per il telefono (max 16 caratteri)");
  return out;
}

interface Row {
  id: string;
  slug: string;
  pool: PuzzlePool;
  kind: string | null;
  category: string;
  difficulty: string;
  prompt: string;
  clues: string[];
  options: string[] | null;
  answer_index: number | null;
  solution: string;
  accepted: string[];
  extra_clue: string | null;
  false_index: number | null;
  visual: string | null;
  image_url: string | null;
  image_alt: string | null;
  explanation: string | null;
  time_limit_sec: number | null;
  status: "draft" | "published" | "disabled";
  tags: string[];
  source: "seed" | "admin";
  times_played: number;
  times_correct: number;
  updated_at: Date;
}

function toInput(r: Row): PuzzleInput {
  return {
    pool: r.pool,
    kind: r.kind as PuzzleInput["kind"],
    category: r.category,
    difficulty: r.difficulty as PuzzleInput["difficulty"],
    prompt: r.prompt,
    clues: r.clues,
    options: r.options,
    answerIndex: r.answer_index,
    solution: r.solution,
    accepted: r.accepted,
    extraClue: r.extra_clue,
    falseIndex: r.false_index,
    visual: r.visual,
    imageUrl: r.image_url,
    imageAlt: r.image_alt,
    explanation: r.explanation,
    timeLimitSec: r.time_limit_sec,
    status: r.status,
    tags: r.tags,
  };
}

function toAdmin(r: Row): AdminPuzzle {
  return {
    id: r.id,
    slug: r.slug,
    pool: r.pool,
    kind: r.kind,
    category: r.category,
    difficulty: r.difficulty,
    prompt: r.prompt,
    clues: r.clues,
    options: r.options,
    answerIndex: r.answer_index,
    solution: r.solution,
    accepted: r.accepted,
    extraClue: r.extra_clue,
    falseIndex: r.false_index,
    visual: r.visual,
    imageUrl: r.image_url,
    imageAlt: r.image_alt,
    explanation: r.explanation,
    timeLimitSec: r.time_limit_sec,
    status: r.status,
    tags: r.tags,
    source: r.source,
    timesPlayed: r.times_played,
    timesCorrect: r.times_correct,
    updatedAt: iso(r.updated_at)!,
    problems: validatePuzzle(toInput(r)),
  };
}

export async function listPuzzles(): Promise<AdminPuzzle[]> {
  const rows = await getSql()<Row[]>`select * from giramente_puzzles order by pool, kind nulls first, difficulty, slug`;
  return rows.map(toAdmin);
}

function parse(raw: unknown, partial: boolean): PuzzleInput | Partial<PuzzleInput> {
  const r = (partial ? puzzleInputSchema.partial() : puzzleInputSchema).safeParse(raw);
  if (!r.success) throw new GiramenteError("VALIDATION", r.error.issues[0]?.message ?? "Dati non validi", r.error.issues);
  return r.data;
}

async function save(id: string | null, input: PuzzleInput): Promise<AdminPuzzle> {
  if (input.status === "published") {
    const problems = validatePuzzle(input);
    if (problems.length) throw new GiramenteError("VALIDATION", `Non si può pubblicare: ${problems.join("; ")}`, problems);
  }
  const sql = getSql();
  const vals = {
    pool: input.pool,
    kind: input.kind ?? null,
    category: input.category,
    difficulty: input.difficulty,
    prompt: input.prompt,
    clues: sql.json(input.clues.filter((c) => c.trim()) as never),
    options: input.options ? sql.json(input.options as never) : null,
    answer_index: input.answerIndex ?? null,
    solution: input.pool === "tabellone" ? input.solution.trim().toUpperCase() : input.solution,
    accepted: sql.json(input.accepted.filter((a) => a.trim()) as never),
    extra_clue: input.extraClue || null,
    false_index: input.falseIndex ?? null,
    visual: input.visual || null,
    image_url: input.imageUrl || null,
    image_alt: input.imageAlt || null,
    explanation: input.explanation || null,
    time_limit_sec: input.timeLimitSec ?? null,
    status: input.status,
    tags: sql.array(input.tags),
  };
  if (id) {
    const [r] = await sql<Row[]>`update giramente_puzzles set ${sql(vals as never)}, updated_at = now() where id = ${id} returning *`;
    if (!r) throw new GiramenteError("NOT_FOUND", "Enigma non trovato");
    return toAdmin(r);
  }
  const slug = `${input.pool.replace("_", "-")}-${Date.now().toString(36)}`;
  const [r] = await sql<Row[]>`insert into giramente_puzzles ${sql({ ...vals, slug, source: "admin" } as never)} returning *`;
  return toAdmin(r);
}

export async function createPuzzle(raw: unknown): Promise<AdminPuzzle> {
  return save(null, parse(raw, false) as PuzzleInput);
}

export async function updatePuzzle(id: string, raw: unknown): Promise<AdminPuzzle> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new GiramenteError("NOT_FOUND", "Enigma non trovato");
  const [cur] = await getSql()<Row[]>`select * from giramente_puzzles where id = ${id}`;
  if (!cur) throw new GiramenteError("NOT_FOUND", "Enigma non trovato");
  const parsed = parse(raw, true) as Record<string, unknown>;
  // solo i campi inviati davvero (i valori predefiniti dello schema non cancellano quelli salvati)
  const sent = raw && typeof raw === "object" ? new Set(Object.keys(raw)) : new Set<string>();
  const patch = Object.fromEntries(Object.entries(parsed).filter(([k]) => sent.has(k)));
  return save(id, { ...toInput(cur), ...patch } as PuzzleInput);
}

export interface GiramenteStats {
  games: { total: number; open: number; finished: number; last7days: number; personal: number; shared: number; teams: number };
  puzzles: { pool: string; published: number; draft: number; disabled: number }[];
  plays: number;
  averageWinnerScore: number | null;
  hardest: { slug: string; pool: string; prompt: string; played: number; correctRate: number }[];
  recent: { code: string; devices: string; mode: string; phase: string; competitors: number; winner: string | null; createdAt: string }[];
}

export async function giramenteStats(): Promise<GiramenteStats> {
  const sql = getSql();
  const [[g], puzzles, [p], [w], hardest, recent] = await Promise.all([
    sql<{ total: number; open: number; finished: number; last7days: number; personal: number; shared: number; teams: number }[]>`
      select count(*)::int as total,
        count(*) filter (where status = 'open' and phase <> 'FINAL')::int as open,
        count(*) filter (where phase = 'FINAL')::int as finished,
        count(*) filter (where created_at > now() - interval '7 days')::int as last7days,
        count(*) filter (where devices = 'personal')::int as personal,
        count(*) filter (where devices = 'shared')::int as shared,
        count(*) filter (where mode = 'teams')::int as teams
      from giramente_rooms`,
    sql<{ pool: string; published: number; draft: number; disabled: number }[]>`
      select pool, count(*) filter (where status = 'published')::int as published, count(*) filter (where status = 'draft')::int as draft,
        count(*) filter (where status = 'disabled')::int as disabled
      from giramente_puzzles group by pool order by pool`,
    sql<{ n: number }[]>`select count(*)::int as n from giramente_plays where status in ('answered', 'timeout')`,
    sql<{ avg: number | null }[]>`
      select avg(c.score)::int as avg from giramente_rooms r join giramente_competitors c on c.id = any(r.winners) where r.phase = 'FINAL'`,
    sql<{ slug: string; pool: string; prompt: string; played: number; rate: number }[]>`
      select slug, pool, coalesce(nullif(prompt, ''), solution) as prompt, times_played as played, (times_correct::float / nullif(times_played, 0)) as rate
      from giramente_puzzles where times_played >= 3 and pool <> 'tabellone' order by rate asc nulls last limit 10`,
    sql<{ code: string; devices: string; mode: string; phase: string; competitors: number; winner: string | null; created_at: Date }[]>`
      select r.code, r.devices, r.mode, r.phase, r.created_at,
        (select count(*)::int from giramente_competitors c where c.room_id = r.id and c.active) as competitors,
        (select string_agg(c.name, ', ') from giramente_competitors c where c.id = any(r.winners)) as winner
      from giramente_rooms r order by r.created_at desc limit 15`,
  ]);
  return {
    games: g,
    puzzles,
    plays: p.n,
    averageWinnerScore: w.avg,
    hardest: hardest.map((h) => ({ slug: h.slug, pool: h.pool, prompt: h.prompt, played: h.played, correctRate: Math.round((h.rate ?? 0) * 100) })),
    recent: recent.map((r) => ({ code: r.code, devices: r.devices, mode: r.mode, phase: r.phase, competitors: r.competitors, winner: r.winner, createdAt: iso(r.created_at)! })),
  };
}
