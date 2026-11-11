import { getSql, iso, type Db } from "@/lib/database/db";
import type { Presenter, QuestionType } from "@/lib/game-engine/types";
import {
  importFileSchema,
  importQuestionSchema,
  questionInputSchema,
  type ImportQuestion,
  type QuestionInput,
} from "@/lib/validation/schemas";
import { audit, CmsError } from "../audit";
import type { Actor } from "../engine";

export interface QuestionRecord {
  id: string;
  type: QuestionType;
  text: string;
  category: string;
  difficulty: number;
  tags: string[];
  presenter: Presenter;
  options: { position: number; text: string; isCorrect: boolean }[];
  correctPoints: number | null;
  wrongPenalty: number | null;
  noAnswerPenalty: number | null;
  durationSeconds: number | null;
  partialScoring: boolean;
  mediaId: string | null;
  mediaKind: string | null;
  mediaLabel: string | null;
  audioStartMs: number;
  audioDurationMs: number | null;
  audioPlays: number;
  animation: string | null;
  notes: string | null;
  status: "draft" | "approved" | "archived";
  answerConfirmed: boolean;
  source: string;
  version: number;
  usedInSessions: number;
  /** Registro: ultima volta mostrata in una serata reale (null = mai giocata). */
  lastPlayedAt: string | null;
  timesPlayed: number;
  createdAt: string;
  updatedAt: string;
}

interface QuestionRow {
  id: string;
  type: QuestionType;
  text: string;
  category: string;
  difficulty: number;
  tags: string[];
  presenter: Presenter;
  correct_points: number | null;
  wrong_penalty: number | null;
  no_answer_penalty: number | null;
  duration_seconds: number | null;
  partial_scoring: boolean;
  media_id: string | null;
  media_kind: string | null;
  media_label: string | null;
  audio_start_ms: number;
  audio_duration_ms: number | null;
  audio_plays: number;
  animation: string | null;
  notes: string | null;
  status: "draft" | "approved" | "archived";
  answer_confirmed: boolean;
  source: string;
  version: number;
  used_in_sessions: number;
  last_played_at: Date | null;
  times_played: number;
  created_at: Date;
  updated_at: Date;
  options: { position: number; text: string; isCorrect: boolean }[];
}

const SELECT = (db: Db) => db`
  select q.id, q.type, q.text, q.category, q.difficulty, q.tags, q.presenter, q.correct_points, q.wrong_penalty,
         q.no_answer_penalty, q.duration_seconds, q.partial_scoring, q.media_id, m.kind::text as media_kind, m.label as media_label,
         q.audio_start_ms, q.audio_duration_ms, q.audio_plays, q.animation, q.notes, q.status, q.answer_confirmed, q.source,
         q.version, q.created_at, q.updated_at,
         (select count(distinct sq.session_id)::int from session_questions sq where sq.question_id = q.id) as used_in_sessions,
         (select max(p.played_at) from question_plays p where p.question_id = q.id) as last_played_at,
         (select count(*)::int from question_plays p where p.question_id = q.id) as times_played,
         coalesce((select json_agg(json_build_object('position', o.position, 'text', o.text, 'isCorrect', o.is_correct) order by o.position)
                   from question_options o where o.question_id = q.id), '[]'::json) as options
  from question_bank q left join media_assets m on m.id = q.media_id`;

function toRecord(r: QuestionRow): QuestionRecord {
  return {
    id: r.id,
    type: r.type,
    text: r.text,
    category: r.category,
    difficulty: r.difficulty,
    tags: r.tags,
    presenter: r.presenter,
    options: r.options,
    correctPoints: r.correct_points,
    wrongPenalty: r.wrong_penalty,
    noAnswerPenalty: r.no_answer_penalty,
    durationSeconds: r.duration_seconds,
    partialScoring: r.partial_scoring,
    mediaId: r.media_id,
    mediaKind: r.media_kind,
    mediaLabel: r.media_label,
    audioStartMs: r.audio_start_ms,
    audioDurationMs: r.audio_duration_ms,
    audioPlays: r.audio_plays,
    animation: r.animation,
    notes: r.notes,
    status: r.status,
    answerConfirmed: r.answer_confirmed,
    source: r.source,
    version: r.version,
    usedInSessions: r.used_in_sessions,
    lastPlayedAt: iso(r.last_played_at),
    timesPlayed: r.times_played,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

export interface QuestionFilters {
  search?: string;
  category?: string;
  status?: string;
  type?: string;
  tag?: string;
  difficulty?: number;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export async function listQuestions(f: QuestionFilters): Promise<{ items: QuestionRecord[]; total: number }> {
  const sql = getSql();
  const conds = [sql`true`];
  if (f.search) conds.push(sql`(q.text ilike ${"%" + f.search + "%"} or exists (select 1 from question_options o where o.question_id = q.id and o.text ilike ${"%" + f.search + "%"}))`);
  if (f.category) conds.push(sql`q.category = ${f.category}`);
  if (f.status) conds.push(sql`q.status = ${f.status}::question_status`);
  else if (!f.includeArchived) conds.push(sql`q.status <> 'archived'`);
  if (f.type) conds.push(sql`q.type = ${f.type}::question_type`);
  if (f.tag) conds.push(sql`${f.tag} = any(q.tags)`);
  if (f.difficulty) conds.push(sql`q.difficulty = ${f.difficulty}`);
  const where = conds.reduce((a, c) => sql`${a} and ${c}`);
  const limit = Math.min(f.limit ?? 50, 500);
  const rows = await sql<QuestionRow[]>`${SELECT(sql)} where ${where} order by q.updated_at desc limit ${limit} offset ${f.offset ?? 0}`;
  const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from question_bank q where ${where}`;
  return { items: rows.map(toRecord), total };
}

export async function getQuestion(db: Db, id: string): Promise<QuestionRecord | null> {
  const [r] = await db<QuestionRow[]>`${SELECT(db)} where q.id = ${id}`;
  return r ? toRecord(r) : null;
}

export async function listCategories(): Promise<{ category: string; count: number; approved: number }[]> {
  const sql = getSql();
  return sql<{ category: string; count: number; approved: number }[]>`
    select category, count(*)::int as count, count(*) filter (where status = 'approved')::int as approved
    from question_bank where status <> 'archived' group by category order by category`;
}

async function writeOptions(db: Db, questionId: string, options: QuestionInput["options"]) {
  await db`delete from question_options where question_id = ${questionId}`;
  for (let i = 0; i < options.length; i++) {
    await db`insert into question_options (question_id, position, text, is_correct)
             values (${questionId}, ${i}, ${options[i].text}, ${options[i].isCorrect})`;
  }
}

function parseQuestion(raw: unknown): QuestionInput {
  const parsed = questionInputSchema.safeParse(raw);
  if (!parsed.success) throw new CmsError("Domanda non valida", 422, parsed.error.issues);
  return parsed.data;
}

export async function createQuestion(raw: unknown, actor: Actor, source: "manual" | "duplicate" = "manual"): Promise<QuestionRecord> {
  const q = parseQuestion(raw);
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into question_bank (type, text, category, difficulty, tags, presenter, correct_points, wrong_penalty, no_answer_penalty,
        duration_seconds, partial_scoring, media_id, audio_start_ms, audio_duration_ms, audio_plays, animation, notes, status,
        answer_confirmed, source, created_by)
      values (${q.type}, ${q.text}, ${q.category}, ${q.difficulty}, ${tx.array(q.tags)}::text[], ${q.presenter},
        ${q.correctPoints ?? null}, ${q.wrongPenalty ?? null}, ${q.noAnswerPenalty ?? null}, ${q.durationSeconds ?? null},
        ${q.partialScoring}, ${q.mediaId ?? null}, ${q.audioStartMs}, ${q.audioDurationMs ?? null}, ${q.audioPlays},
        ${q.animation ?? null}, ${q.notes ?? null}, ${q.status}, ${q.answerConfirmed}, ${source}, ${actor.userId})
      returning id`;
    await writeOptions(tx, row.id, q.options);
    await audit(tx, actor, "question.create", { type: "question", id: row.id });
    return (await getQuestion(tx, row.id))!;
  });
}

export async function updateQuestion(id: string, raw: unknown, actor: Actor): Promise<QuestionRecord> {
  const q = parseQuestion(raw);
  const sql = getSql();
  return sql.begin(async (tx) => {
    const before = await getQuestion(tx, id);
    if (!before) throw new CmsError("Domanda non trovata", 404);
    await tx`
      update question_bank set type = ${q.type}, text = ${q.text}, category = ${q.category}, difficulty = ${q.difficulty},
        tags = ${tx.array(q.tags)}::text[], presenter = ${q.presenter}, correct_points = ${q.correctPoints ?? null},
        wrong_penalty = ${q.wrongPenalty ?? null}, no_answer_penalty = ${q.noAnswerPenalty ?? null},
        duration_seconds = ${q.durationSeconds ?? null}, partial_scoring = ${q.partialScoring}, media_id = ${q.mediaId ?? null},
        audio_start_ms = ${q.audioStartMs}, audio_duration_ms = ${q.audioDurationMs ?? null}, audio_plays = ${q.audioPlays},
        animation = ${q.animation ?? null}, notes = ${q.notes ?? null}, status = ${q.status},
        answer_confirmed = ${q.answerConfirmed}, version = version + 1
      where id = ${id}`;
    await writeOptions(tx, id, q.options);
    await audit(tx, actor, "question.update", { type: "question", id, details: { previousVersion: before.version } });
    return (await getQuestion(tx, id))!;
  });
}

export async function duplicateQuestion(id: string, actor: Actor): Promise<QuestionRecord> {
  const sql = getSql();
  const q = await getQuestion(sql, id);
  if (!q) throw new CmsError("Domanda non trovata", 404);
  return createQuestion(
    {
      ...q,
      text: q.text.length <= 390 ? `${q.text} (copia)` : q.text,
      options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      status: "draft",
      answerConfirmed: false,
    },
    actor,
    "duplicate",
  );
}

export async function setQuestionStatus(id: string, status: "draft" | "approved" | "archived", actor: Actor) {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const q = await getQuestion(tx, id);
    if (!q) throw new CmsError("Domanda non trovata", 404);
    if (status === "approved" && !q.answerConfirmed) throw new CmsError("Conferma prima la risposta corretta", 422);
    await tx`update question_bank set status = ${status} where id = ${id}`;
    await audit(tx, actor, `question.${status}`, { type: "question", id });
  });
}

/** Conferma esplicita della risposta corretta (obbligatoria dopo un import). */
export async function confirmAnswer(id: string, approve: boolean, actor: Actor) {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const rows = await tx`
      update question_bank set answer_confirmed = true, status = case when ${approve}::boolean then 'approved'::question_status else status end
      where id = ${id} returning id`;
    if (rows.length === 0) throw new CmsError("Domanda non trovata", 404);
    await audit(tx, actor, "question.confirm_answer", { type: "question", id, details: { approve } });
  });
}

export async function deleteQuestion(id: string, actor: Actor) {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const [{ used }] = await tx<{ used: number }[]>`
      select count(*)::int as used from session_questions sq join game_sessions s on s.id = sq.session_id
      where sq.question_id = ${id} and s.status = 'draft'`;
    if (used > 0) throw new CmsError("La domanda è inserita in una sessione in preparazione: rimuovila prima da lì", 409);
    // Le partite passate restano ricostruibili grazie agli snapshot.
    await tx`delete from question_bank where id = ${id}`;
    await audit(tx, actor, "question.delete", { type: "question", id });
  });
}

// ---------------------------------------------------------------------------
// Importazione / esportazione
// ---------------------------------------------------------------------------
export interface ImportReport {
  imported: number;
  /** Domande valide trovate nel file. */
  valid: number;
  /** Domande totali nel file. */
  total: number;
  ids: string[];
  errors: { index: number; text: string | null; issues: string[] }[];
}

export function importItemToInput(item: ImportQuestion): QuestionInput {
  return {
    type: item.type,
    text: item.text,
    category: item.category,
    difficulty: item.difficulty,
    tags: item.tags,
    presenter: item.presenter,
    options: item.answers.map((t, i) => ({ text: t, isCorrect: item.correct.includes(i) })),
    correctPoints: item.correctPoints ?? null,
    wrongPenalty: item.wrongPenalty ?? null,
    noAnswerPenalty: null,
    durationSeconds: item.durationSeconds ?? null,
    partialScoring: false,
    mediaId: null,
    audioStartMs: 0,
    audioDurationMs: null,
    audioPlays: 1,
    animation: null,
    notes: item.notes ?? null,
    // Sempre bozza con risposta da confermare.
    status: "draft",
    answerConfirmed: false,
  };
}

export function validateImport(payload: unknown): { valid: QuestionInput[]; errors: ImportReport["errors"] } {
  const file = importFileSchema.safeParse(Array.isArray(payload) ? { questions: payload } : payload);
  if (!file.success) throw new CmsError("File di importazione non valido: serve { \"questions\": [...] }", 422, file.error.issues);
  const valid: QuestionInput[] = [];
  const errors: ImportReport["errors"] = [];
  file.data.questions.forEach((raw, index) => {
    const r = importQuestionSchema.safeParse(raw);
    if (!r.success) {
      const text = typeof raw === "object" && raw && "text" in raw ? String((raw as { text: unknown }).text) : null;
      errors.push({ index, text, issues: r.error.issues.map((i) => `${i.path.join(".") || "domanda"}: ${i.message}`) });
    } else {
      valid.push(importItemToInput(r.data));
    }
  });
  return { valid, errors };
}

export async function importQuestions(payload: unknown, actor: Actor, dryRun: boolean): Promise<ImportReport> {
  const { valid, errors } = validateImport(payload);
  if (dryRun) return { imported: 0, valid: valid.length, total: valid.length + errors.length, ids: [], errors };
  const sql = getSql();
  return sql.begin(async (tx) => {
    const ids: string[] = [];
    for (const q of valid) {
      const [row] = await tx<{ id: string }[]>`
        insert into question_bank (type, text, category, difficulty, tags, presenter, correct_points, wrong_penalty,
          duration_seconds, notes, status, answer_confirmed, source, created_by)
        values (${q.type}, ${q.text}, ${q.category}, ${q.difficulty}, ${tx.array(q.tags)}::text[], ${q.presenter},
          ${q.correctPoints ?? null}, ${q.wrongPenalty ?? null}, ${q.durationSeconds ?? null}, ${q.notes ?? null},
          'draft', false, 'import', ${actor.userId})
        returning id`;
      await writeOptions(tx, row.id, q.options);
      ids.push(row.id);
    }
    await audit(tx, actor, "question.import", { type: "question", details: { imported: ids.length, rejected: errors.length } });
    return { imported: ids.length, valid: valid.length, total: valid.length + errors.length, ids, errors };
  });
}

/** Esporta nel formato di importazione (round-trip garantito). */
export async function exportQuestions(filters: QuestionFilters) {
  const { items } = await listQuestions({ ...filters, limit: 500 });
  return {
    format: "quizzone-questions" as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    questions: items.map((q) => ({
      type: q.type,
      text: q.text,
      category: q.category,
      difficulty: q.difficulty,
      tags: q.tags,
      presenter: q.presenter,
      answers: q.options.map((o) => o.text),
      correct: q.options.filter((o) => o.isCorrect).map((o) => o.position),
      ...(q.durationSeconds ? { durationSeconds: q.durationSeconds } : {}),
      ...(q.correctPoints !== null ? { correctPoints: q.correctPoints } : {}),
      ...(q.wrongPenalty !== null ? { wrongPenalty: q.wrongPenalty } : {}),
      ...(q.notes ? { notes: q.notes } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// CSV: tipo;testo;categoria;difficolta;presentatore;A;B;C;D;corrette;durata;tag
// ---------------------------------------------------------------------------
export const CSV_HEADER = ["tipo", "testo", "categoria", "difficolta", "presentatore", "A", "B", "C", "D", "corrette", "durata", "tag"];

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export function csvToImportPayload(text: string): { questions: unknown[] } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { questions: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes("testo") || header.includes("text");
  const body = hasHeader ? rows.slice(1) : rows;
  const idx = (name: string, fallback: number) => {
    const i = header.indexOf(name.toLowerCase());
    return hasHeader && i >= 0 ? i : fallback;
  };
  const letters = ["A", "B", "C", "D"];
  return {
    questions: body.map((r) => {
      const get = (n: string, f: number) => (r[idx(n, f)] ?? "").trim();
      const correctRaw = get("corrette", 9).toUpperCase();
      const correct = correctRaw
        .split(/[;,| ]+/)
        .filter(Boolean)
        .map((c) => (letters.includes(c) ? letters.indexOf(c) : Number(c) - 1));
      const type = get("tipo", 0).toLowerCase();
      const duration = Number(get("durata", 10));
      const tags = get("tag", 11);
      return {
        type: type === "multipla" || type === "multiple" ? "multiple" : "single",
        text: get("testo", 1),
        category: get("categoria", 2),
        difficulty: Number(get("difficolta", 3)) || 2,
        presenter: (get("presentatore", 4).toLowerCase() || "professore") as Presenter,
        answers: [get("A", 5), get("B", 6), get("C", 7), get("D", 8)],
        correct,
        ...(duration > 0 ? { durationSeconds: duration } : {}),
        tags: tags ? tags.split(/[|,]/).map((t) => t.trim()).filter(Boolean) : [],
      };
    }),
  };
}

export async function exportQuestionsCsv(filters: QuestionFilters): Promise<string> {
  const data = await exportQuestions(filters);
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_HEADER.join(";")];
  for (const q of data.questions) {
    lines.push(
      [
        q.type === "multiple" ? "multipla" : "singola",
        q.text,
        q.category,
        q.difficulty,
        q.presenter,
        ...q.answers,
        q.correct.map((c) => "ABCD"[c]).join("|"),
        q.durationSeconds ?? "",
        q.tags.join("|"),
      ]
        .map(esc)
        .join(";"),
    );
  }
  return "﻿" + lines.join("\r\n");
}
