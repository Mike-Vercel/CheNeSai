import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSql, type Db, type Sql, type Tx } from "@/lib/database/db";
import {
  composeQuestions,
  DIFFICULTY_MIXES,
  poolStats,
  splitQuestions,
  type ComposeCandidate,
  type ComposedPick,
  type ComposeRoundSpec,
  type ComposeSummary,
  type DifficultyMix,
  type PoolStats,
} from "@/lib/game-engine/compose";
import { isCategoryRound, type Presenter, type RoundKind, type SessionStatus } from "@/lib/game-engine/types";
import { roundInputSchema, type SessionSettings } from "@/lib/validation/schemas";
import { audit, CmsError } from "../audit";
import type { Actor } from "../engine";
import { insertRound, insertRoundQuestions, insertSession } from "./sessions";

/**
 * Serata rapida e "Aggiungi domande casuali": lato database.
 *
 * Le domande vengono dall'archivio (approvate, risposta confermata, mai le
 * demo o i test automatici). La freschezza si legge dal registro
 * `question_plays` (scritto da un trigger quando una domanda viene mostrata
 * in una serata reale) e dalle serate reali in programma che la contengono già.
 * La scelta vera e propria è in `@/lib/game-engine/compose` (pura, testata).
 */

/** Tag delle domande che non devono mai finire in una serata composta in automatico. */
export const EXCLUDED_TAGS = ["demo", "test-automatico"];

/** Attore usato quando la serata nasce senza un admin (futuro "Gioca ora"). */
export const SYSTEM_ACTOR: Actor = { userId: null, email: "sistema@serata-rapida", ip: null };

export interface CandidateFilters {
  categories?: string[];
  includeMedia?: boolean;
  /** Serata in costruzione: le sue domande non contano come "prenotate altrove". */
  sessionId?: string | null;
  /** Solo domande con questo tag (usato dai test per lavorare su un archivio isolato). */
  onlyTag?: string;
  /** Partite libere: account host, per mettere in fondo le domande che ha già visto. */
  hostUserId?: string | null;
}

export async function loadCandidates(db: Db, f: CandidateFilters = {}): Promise<ComposeCandidate[]> {
  const cats = (f.categories ?? []).filter(Boolean);
  const host = f.hostUserId ?? null;
  const rows = await db<{ id: string; category: string; difficulty: number; last_played_at: Date | null; planned: boolean; seen_by_host: boolean }[]>`
    select q.id, q.category, q.difficulty, lp.last_played_at,
      exists (
        -- le partite libere si giocano subito: non "prenotano" le domande come le serate della regia
        select 1 from session_questions sq join game_sessions s on s.id = sq.session_id
        -- (le candidate della Ruota di Palmino non contano: quasi sempre restano in riserva)
        where sq.question_id = q.id and sq.shown_at is null and not sq.wheel_candidate and not s.is_test and s.host_user_id is null
          and s.status in ('draft', 'ready', 'live') and s.id is distinct from ${f.sessionId ?? null}::uuid
      ) as planned,
      ${
        host
          ? db`(
        exists (select 1 from question_plays hp where hp.question_id = q.id and hp.host_user_id = ${host}::uuid)
        or exists (
          select 1 from session_questions hq join game_sessions hs on hs.id = hq.session_id
          where hq.question_id = q.id and hs.host_user_id = ${host}::uuid and hq.shown_at is not null
        ))`
          : db`false`
      } as seen_by_host
    from question_bank q
    left join lateral (select max(p.played_at) as last_played_at from question_plays p where p.question_id = q.id) lp on true
    where q.status = 'approved' and q.answer_confirmed
      and exists (select 1 from question_options o where o.question_id = q.id and o.is_correct)
      and ${f.onlyTag ? db`${f.onlyTag} = any(q.tags)` : db`not (q.tags && ${db.array(EXCLUDED_TAGS)}::text[])`}
      and ${cats.length ? db`q.category = any(${db.array(cats)}::text[])` : db`true`}
      and ${f.includeMedia ? db`true` : db`q.media_id is null`}`;
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    difficulty: r.difficulty,
    lastPlayedAt: r.last_played_at ? r.last_played_at.toISOString() : null,
    plannedElsewhere: r.planned,
    seenByHost: r.seen_by_host,
  }));
}

// ---------------------------------------------------------------------------
// Serata rapida
// ---------------------------------------------------------------------------
export const MAX_QUICK_ROUNDS = 10;
export const MAX_QUICK_QUESTIONS = 100;
export const MAX_PER_ROUND = 30;

export const quickSessionSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
    seasonId: z.uuid().nullable().optional(),
    isTest: z.boolean().default(false),
    rounds: z.number().int().min(1).max(MAX_QUICK_ROUNDS).default(4),
    totalQuestions: z.number().int().min(1).max(MAX_QUICK_QUESTIONS).default(20),
    mix: z.enum(DIFFICULTY_MIXES).default("bilanciata"),
    categories: z.array(z.string().trim().min(2).max(60)).max(60).default([]),
    includeMedia: z.boolean().default(false),
    /** L'ultimo round diventa la Finale (punti doppi, domande più difficili). */
    finalRound: z.boolean().default(true),
    /** Riserve per la Domanda misteriosa (nel primo round). */
    reserves: z.number().int().min(0).max(5).default(1),
    seed: z.union([z.string().min(1).max(64), z.number().int()]).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.totalQuestions < v.rounds) ctx.addIssue({ code: "custom", path: ["totalQuestions"], message: "Serve almeno una domanda per round" });
    if (Math.ceil(v.totalQuestions / v.rounds) > MAX_PER_ROUND) {
      ctx.addIssue({ code: "custom", path: ["totalQuestions"], message: `Al massimo ${MAX_PER_ROUND} domande per round` });
    }
  });
export type QuickSessionOptions = z.output<typeof quickSessionSchema>;

const ORDINALS = ["Primo", "Secondo", "Terzo", "Quarto", "Quinto", "Sesto", "Settimo", "Ottavo", "Nono", "Decimo"];
const PRESENTER_CYCLE: Presenter[] = ["professore", "regina", "palmino"];

export interface QuickRoundPlan {
  title: string;
  kind: RoundKind;
  presenter: Presenter;
  pointsMultiplier: number;
  count: number;
  harder: boolean;
}

/** Struttura dei round della serata rapida (titoli, tipo, presentatore, quante domande). */
export function planQuickRounds(o: Pick<QuickSessionOptions, "rounds" | "totalQuestions" | "finalRound">): QuickRoundPlan[] {
  const counts = splitQuestions(o.totalQuestions, o.rounds);
  return counts.map((count, i) => {
    const isFinal = o.finalRound && o.rounds > 1 && i === o.rounds - 1;
    return isFinal
      ? { title: "Gran finale", kind: "final", presenter: "regina", pointsMultiplier: 2, count, harder: true }
      : { title: `${ORDINALS[i] ?? `Round ${i + 1}`} round`, kind: "standard", presenter: PRESENTER_CYCLE[i % PRESENTER_CYCLE.length], pointsMultiplier: 1, count, harder: false };
  });
}

function defaultTitle(): string {
  const d = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "Europe/Rome" }).format(new Date());
  return `Serata rapida del ${d}`;
}

export interface QuickPreviewRound {
  title: string;
  kind: RoundKind;
  questions: Pick<ComposedPick, "questionId" | "category" | "difficulty" | "freshness" | "lastPlayedAt">[];
}

export interface QuickSessionResult {
  sessionId: string | null;
  /** Conteggi dell'archivio utilizzabile con questi filtri. */
  pool: PoolStats;
  /** Esito della scelta delle domande dei round (riserve escluse). */
  summary: ComposeSummary;
  reserves: { requested: number; picked: number };
  rounds: QuickPreviewRound[];
  warnings: string[];
  seed: string;
}

function warningsFor(summary: ComposeSummary, pool: PoolStats): string[] {
  const w: string[] = [];
  if (summary.missing > 0) {
    w.push(`L'archivio non basta: servono ${summary.requested} domande, con questi filtri ce ne sono solo ${pool.usable}.`);
  }
  if (summary.repeats > 0) {
    w.push(
      `Domande mai giocate insufficienti (${pool.fresh} disponibili): ${summary.repeats === 1 ? "1 domanda è già stata giocata" : `${summary.repeats} domande sono già state giocate`} in passato (scelte tra le meno recenti).`,
    );
  }
  if (summary.planned > 0) {
    w.push(`${summary.planned === 1 ? "1 domanda è già inserita" : `${summary.planned} domande sono già inserite`} in un'altra serata in programma.`);
  }
  if (summary.seen > 0) {
    w.push(`${summary.seen === 1 ? "1 domanda è già uscita" : `${summary.seen} domande sono già uscite`} in una tua partita precedente (l'archivio nuovo per te non basta).`);
  }
  if (summary.offBand > 0) {
    w.push(`${summary.offBand === 1 ? "1 domanda ha" : `${summary.offBand} domande hanno`} una difficoltà diversa da quella prevista (mancano domande fresche di quella fascia).`);
  }
  return w;
}

async function composeQuick(db: Db, o: QuickSessionOptions, seed: string, onlyTag?: string, hostUserId?: string | null) {
  const plan = planQuickRounds(o);
  const candidates = await loadCandidates(db, { categories: o.categories, includeMedia: o.includeMedia, onlyTag, hostUserId });
  const specs: ComposeRoundSpec[] = plan.map((r) => ({ count: r.count, harder: r.harder }));
  // Le riserve si scelgono per ultime, come gruppo a parte: non tolgono domande fresche ai round.
  const main = composeQuestions({ candidates, rounds: specs, mix: o.mix, seed });
  const usedIds = main.rounds.flat().map((p) => p.questionId);
  const res = o.reserves > 0 ? composeQuestions({ candidates, rounds: [{ count: o.reserves }], mix: "bilanciata", seed: `${seed}:riserve`, excludeIds: usedIds }) : null;
  const reservePicks = (res?.rounds[0] ?? []).filter((p) => p.freshness !== "prenotata");
  const pool = poolStats(candidates);
  return { plan, main, reservePicks, pool };
}

function toResult(sessionId: string | null, seed: string, o: QuickSessionOptions, c: Awaited<ReturnType<typeof composeQuick>>): QuickSessionResult {
  return {
    sessionId,
    pool: c.pool,
    summary: c.main.summary,
    reserves: { requested: o.reserves, picked: c.reservePicks.length },
    rounds: c.plan.map((r, i) => ({
      title: r.title,
      kind: r.kind,
      questions: c.main.rounds[i].map((p) => ({ questionId: p.questionId, category: p.category, difficulty: p.difficulty, freshness: p.freshness, lastPlayedAt: p.lastPlayedAt })),
    })),
    warnings: warningsFor(c.main.summary, c.pool),
    seed,
  };
}

export function parseQuickOptions(raw: unknown): QuickSessionOptions {
  const p = quickSessionSchema.safeParse(raw);
  if (!p.success) throw new CmsError("Impostazioni della serata rapida non valide", 422, p.error.issues);
  return p.data;
}

/** Anteprima senza scrivere nulla: quante domande fresche ci sono e cosa verrebbe scelto. */
export async function previewQuickSession(raw: unknown, opts: { onlyTag?: string } = {}): Promise<QuickSessionResult> {
  const o = parseQuickOptions(raw);
  const seed = String(o.seed ?? randomUUID());
  return toResult(null, seed, o, await composeQuick(getSql(), o, seed, opts.onlyTag));
}

export interface ComposeCreateOptions {
  onlyTag?: string;
  /** Partita libera: account proprietario (evita le domande che ha già visto). */
  hostUserId?: string | null;
  /** Impostazioni iniziali della serata (es. scorrimento automatico). */
  settings?: SessionSettings;
}

/**
 * Crea in UNA transazione serata + round + domande scelte in automatico.
 * Usata dalla serata rapida della regia e dal gioco libero (actor = account host).
 * Le domande mancanti bloccano la creazione; le ripetute sono ammesse con avviso.
 */
export async function composeAndCreateSession(db: Sql, raw: unknown, actor: Actor | null, opts: ComposeCreateOptions = {}): Promise<QuickSessionResult> {
  return db.begin((tx) => composeAndCreateSessionTx(tx, raw, actor, opts));
}

/** Come composeAndCreateSession, dentro una transazione già aperta. */
export async function composeAndCreateSessionTx(tx: Tx, raw: unknown, actor: Actor | null, opts: ComposeCreateOptions = {}): Promise<QuickSessionResult> {
  const o = parseQuickOptions(raw);
  const act = actor ?? SYSTEM_ACTOR;
  const seed = String(o.seed ?? randomUUID());
  {
    // Due serate composte nello stesso istante non devono pescare le stesse domande.
    await tx`select pg_advisory_xact_lock(hashtext('qz.compose'))`;
    const c = await composeQuick(tx, o, seed, opts.onlyTag, opts.hostUserId);
    if (c.main.summary.missing > 0) {
      throw new CmsError(
        `L'archivio non basta: servono ${c.main.summary.requested} domande, con questi filtri ce ne sono solo ${c.pool.usable}. Riduci le domande o allarga le categorie.`,
        422,
        { summary: c.main.summary, pool: c.pool },
      );
    }
    const sessionId = await insertSession(
      tx,
      {
        title: o.title ?? defaultTitle(),
        description: o.description ?? null,
        scheduledAt: o.scheduledAt ?? null,
        isTest: o.isTest,
        seasonId: o.seasonId ?? null,
        settings: opts.settings ?? {},
      },
      act,
      { quick: true, public: !!opts.hostUserId },
      opts.hostUserId ?? null,
    );
    let firstRoundId: string | null = null;
    for (let i = 0; i < c.plan.length; i++) {
      const r = c.plan[i];
      const roundId = await insertRound(
        tx,
        sessionId,
        roundInputSchema.parse({ title: r.title, kind: r.kind, presenter: r.presenter, pointsMultiplier: r.pointsMultiplier }),
        act,
      );
      firstRoundId ??= roundId;
      await insertRoundQuestions(tx, roundId, c.main.rounds[i].map((p) => p.questionId), {}, act, { random: true });
    }
    if (firstRoundId && c.reservePicks.length > 0) {
      await insertRoundQuestions(tx, firstRoundId, c.reservePicks.map((p) => p.questionId), { isReserve: true }, act, { random: true });
    }
    const result = toResult(sessionId, seed, o, c);
    await audit(tx, act, "session.quick_create", {
      sessionId,
      type: "session",
      id: sessionId,
      details: {
        rounds: o.rounds,
        totalQuestions: o.totalQuestions,
        mix: o.mix,
        categories: o.categories,
        includeMedia: o.includeMedia,
        finalRound: o.finalRound,
        seed,
        summary: result.summary,
        reserves: result.reserves,
        hostUserId: opts.hostUserId ?? null,
      },
    });
    return result;
  }
}

// ---------------------------------------------------------------------------
// "Aggiungi domande casuali" a un round esistente
// ---------------------------------------------------------------------------
export const randomQuestionsSchema = z.object({
  count: z.number().int().min(1).max(MAX_PER_ROUND),
  categories: z.array(z.string().trim().min(2).max(60)).max(60).default([]),
  mix: z.enum(DIFFICULTY_MIXES).default("bilanciata"),
  includeMedia: z.boolean().default(false),
  voteOptionId: z.uuid().nullable().optional(),
  isReserve: z.boolean().default(false),
  seed: z.union([z.string().min(1).max(64), z.number().int()]).optional(),
});

export interface RandomAddResult {
  added: number;
  summary: ComposeSummary;
  pool: PoolStats;
  warnings: string[];
}

export async function addRandomQuestionsToRound(roundId: string, raw: unknown, actor: Actor, opts: { onlyTag?: string } = {}): Promise<RandomAddResult> {
  const p = randomQuestionsSchema.safeParse(raw);
  if (!p.success) throw new CmsError("Richiesta non valida", 422, p.error.issues);
  const o = p.data;
  const sql = getSql();
  return sql.begin(async (tx: Tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('qz.compose'))`;
    const [r] = await tx<{ session_id: string; kind: RoundKind; status: SessionStatus }[]>`
      select r.session_id, r.kind, s.status from game_rounds r join game_sessions s on s.id = r.session_id where r.id = ${roundId}`;
    if (!r) throw new CmsError("Round non trovato", 404);
    if (r.status !== "draft") throw new CmsError("La sessione è pubblicata: per modificarla annulla prima la pubblicazione", 409);
    if (isCategoryRound(r.kind) && !o.voteOptionId && !o.isReserve) {
      throw new CmsError("In questo round scegli la categoria (spicchio o voto) a cui assegnare le domande", 422);
    }
    // Domande già nella serata: escluse. Categorie già usate: per distribuire meglio.
    const inSession = await tx<{ question_id: string; category: string; round_id: string; position: number }[]>`
      select sq.question_id, q.category, sq.round_id, sq.position
      from session_questions sq join question_bank q on q.id = sq.question_id
      where sq.session_id = ${r.session_id}`;
    const sessionCategoryCounts: Record<string, number> = {};
    for (const q of inSession) sessionCategoryCounts[q.category] = (sessionCategoryCounts[q.category] ?? 0) + 1;
    const last = inSession.filter((q) => q.round_id === roundId).sort((a, b) => b.position - a.position)[0];

    const candidates = await loadCandidates(tx, { categories: o.categories, includeMedia: o.includeMedia, sessionId: r.session_id, onlyTag: opts.onlyTag });
    const excludeIds = inSession.map((q) => q.question_id);
    const res = composeQuestions({
      candidates,
      rounds: [{ count: o.count, harder: r.kind === "final", previousCategory: last?.category ?? null }],
      mix: o.mix as DifficultyMix,
      seed: String(o.seed ?? randomUUID()),
      excludeIds,
      sessionCategoryCounts,
    });
    const pool = poolStats(candidates, excludeIds);
    const ids = res.rounds[0].map((x) => x.questionId);
    if (ids.length === 0) throw new CmsError("Nessuna domanda disponibile con questi filtri", 422, { summary: res.summary, pool });
    await insertRoundQuestions(tx, roundId, ids, { voteOptionId: o.voteOptionId ?? null, isReserve: o.isReserve }, actor, {
      random: true,
      mix: o.mix,
      categories: o.categories,
      summary: res.summary,
    });
    return { added: ids.length, summary: res.summary, pool, warnings: warningsFor(res.summary, pool) };
  });
}
