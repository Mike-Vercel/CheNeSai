import "server-only";
import { z } from "zod";
import type { Db } from "@/lib/database/db";
import type { MediaKind, Presenter, QuestionType } from "@/lib/game-engine/types";
import {
  categoryResultLine,
  palminoWheelResultLine,
  wheelResultLine,
  dedupeLines,
  eventDefinitionScriptLines,
  eventLines,
  genericScriptLines,
  GENERIC_QUESTION_NUMBERS,
  questionNumberLine,
  questionScriptLines,
  roundIntroLine,
  scriptQuestionFromCms,
  stripAudioTags,
  type SpokenLine,
} from "@/features/game/script";
import { roundSpecialSettings } from "@/lib/game-engine/special-rounds";
import { CmsError } from "./audit";
import { getSessionDetail } from "./cms/sessions";
import { palminoWheelLabels } from "./palmino-wheel";
import { listQuestions } from "./cms/questions";
import { appUsage, cachedKeys, ensureClip, loadVoiceConfig, planClip, planPart, TtsError, ttsConfigured, type PlannedClip, type TtsPriority, type TtsSource, type VoiceConfig } from "./tts";
import { splitByNames } from "@/features/game/name-segments";
import { isCuratedTemplate, levelAllowed, renderTemplate } from "@/lib/show/library";
import { loadDirectorConfig, loadTemplates } from "./show";

/**
 * Pre-generazione delle voci a piccoli lotti (adatta a Vercel: nessun processo lungo).
 * Il client chiede la stima, poi chiama "run" in ciclo finché non resta nulla.
 * Le battute sono costruite con le stesse funzioni pure usate dal TV.
 */
export const pregenScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("session"), sessionId: z.uuid() }),
  z.object({
    kind: z.literal("questions"),
    ids: z.array(z.uuid()).max(500).optional(),
    filter: z
      .object({
        q: z.string().max(200).optional(),
        category: z.string().max(60).optional(),
        type: z.enum(["single", "multiple"]).optional(),
        tag: z.string().max(60).optional(),
        difficulty: z.number().int().min(1).max(5).optional(),
      })
      .optional(),
  }),
  z.object({ kind: z.literal("generic") }),
]);
export type PregenScope = z.infer<typeof pregenScopeSchema>;

async function eventDefinitionLines(db: Db): Promise<SpokenLine[]> {
  const defs = await db<{ title: string; tagline: string }[]>`select title, tagline from special_event_definitions order by key`;
  return defs.flatMap((d) => eventDefinitionScriptLines(d));
}

/** Nome di prova per dividere le battute con i nomi: le parti fisse non dipendono dal nome. */
const SAMPLE_NAME = "Gigi";

/**
 * Libreria ufficiale (e battute aggiunte dal pannello), al livello di comicità scelto:
 * - battute senza nomi: frasi fisse, pre-generate una volta (modello di qualità, come il TV le chiede);
 * - battute con i nomi: le PARTI FISSE dei "nomi salvati" (il nome si aggiunge a parte, già in archivio).
 */
export async function libraryVoicePlans(db: Db, cfg: VoiceConfig): Promise<{ lines: SpokenLine[]; parts: PlannedClip[] }> {
  const config = await loadDirectorConfig(db);
  const templates = (await loadTemplates(db)).filter((t) => isCuratedTemplate(t) && levelAllowed(t.level, config.comedyLevel));
  const lines: SpokenLine[] = [];
  const parts: PlannedClip[] = [];
  // varianti per genere: testi diversi, quindi clip diverse (si preparano anche loro)
  const variants = templates.flatMap((t) => [t, ...[t.textF, t.textN].filter((x): x is string => !!x).map((text) => ({ ...t, text }))]);
  for (const t of variants) {
    const ph = [...t.text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
    if (ph.length === 0) {
      const r = renderTemplate(t, {});
      if (r) lines.push({ who: t.character, text: r.text, live: false });
      continue;
    }
    const r = renderTemplate(t, Object.fromEntries(ph.map((k) => [k, SAMPLE_NAME])));
    const segments = r ? splitByNames(r.text, [SAMPLE_NAME]) : null;
    const ctx = (list: { text: string }[]) => stripAudioTags(list.map((x) => x.text).join(" ")).slice(0, 200);
    (segments ?? []).forEach((seg, i, all) => {
      if (seg.kind !== "fixed") return;
      const plan = planPart(cfg, t.character, seg.text, "segment");
      if (!plan) return;
      // intonazione: come nei "nomi salvati", la parte sa cosa viene prima e dopo (non entra nella chiave)
      const previous = ctx(all.slice(0, i)).slice(-200);
      const next = ctx(all.slice(i + 1));
      plan.context = { ...(previous ? { previous } : {}), ...(next ? { next } : {}) };
      parts.push(plan);
    });
  }
  return { lines: dedupeLines(lines), parts };
}

/** Battute generiche: valgono per ogni serata. */
export async function genericLines(db: Db): Promise<SpokenLine[]> {
  return dedupeLines([...genericScriptLines(), ...(await eventDefinitionLines(db))]);
}

interface BankRow {
  id: string;
  type: QuestionType;
  text: string;
  presenter: Presenter;
  media_kind: MediaKind | null;
  options: { position: number; text: string; isCorrect: boolean }[];
}

function bankQuestionLines(rows: BankRow[]): SpokenLine[] {
  return rows.flatMap((r) => questionScriptLines(scriptQuestionFromCms({ id: r.id, type: r.type, text: r.text, presenter: r.presenter, mediaKind: r.media_kind, options: r.options })));
}

/** Tutte le battute di una serata: domande (anche di riserva), round, voti, eventi e frasi generiche. */
export async function sessionLines(db: Db, sessionId: string): Promise<SpokenLine[]> {
  const s = await getSessionDetail(db, sessionId);
  if (!s) throw new CmsError("Sessione non trovata", 404);
  const out: SpokenLine[] = [];
  const rounds = [...s.roundsDetail].sort((a, b) => a.position - b.position);
  let questionCount = 0;
  rounds.forEach((r, i) => {
    out.push(
      roundIntroLine({
        index: i + 1,
        title: r.title,
        kind: r.kind,
        presenter: r.presenter,
        description: r.description,
        pointsMultiplier: r.pointsMultiplier,
        noPenalty: r.noPenalty,
        special: roundSpecialSettings({
          kind: r.kind,
          bet_min_stake: r.betMinStake,
          bet_default_tier: r.betDefaultTier,
          comeback_multiplier: r.comebackMultiplier,
          comeback_leader_penalty: r.comebackLeaderPenalty,
        }),
      }),
    );
    if (r.kind === "category_vote") for (const o of r.voteOptions) out.push(categoryResultLine(o.label));
    if (r.kind === "category_wheel") for (const o of r.voteOptions) out.push(wheelResultLine(o.label));
    for (const q of r.questions) {
      if (!q.questionId && !q.fromSnapshot) continue;
      questionCount++;
      // segnaposto di una Ruota di Palmino ancora da girare: quasi mai si gioca (la sostituisce la ruota)
      if (r.palminoSlotSqId === q.id) continue;
      out.push(...questionScriptLines(scriptQuestionFromCms(q)));
    }
  });
  // Ruota di Palmino: "Tocca a… CATEGORIA!" per ogni spicchio (frasi brevi, uguali in ogni serata).
  // Le domande candidate NON si preparano tutte (ne esce una sola): la vincente si prepara durante il giro.
  for (const label of await palminoWheelLabels(db, sessionId)) out.push(palminoWheelResultLine(label));
  const scheduled = await db<{ title: string; tagline: string }[]>`select distinct title, tagline from special_events where session_id = ${sessionId}`;
  out.push(...scheduled.flatMap((e) => eventLines(e)));
  for (let n = GENERIC_QUESTION_NUMBERS + 1; n <= questionCount; n++) out.push(questionNumberLine(n));
  out.push(...(await genericLines(db)));
  return dedupeLines(out);
}

async function questionsLines(db: Db, scope: Extract<PregenScope, { kind: "questions" }>): Promise<SpokenLine[]> {
  let rows: BankRow[];
  if (scope.ids && scope.ids.length > 0) {
    rows = await db<BankRow[]>`
      select q.id, q.type, q.text, q.presenter, m.kind::text as media_kind,
        coalesce((select json_agg(json_build_object('position', o.position, 'text', o.text, 'isCorrect', o.is_correct) order by o.position)
                  from question_options o where o.question_id = q.id), '[]'::json) as options
      from question_bank q left join media_assets m on m.id = q.media_id
      where q.id = any(${scope.ids}::uuid[]) and q.status = 'approved'`;
  } else {
    const f = scope.filter ?? {};
    const { items } = await listQuestions({ search: f.q, category: f.category, type: f.type, tag: f.tag, difficulty: f.difficulty, status: "approved", limit: 500 });
    rows = items.map((q) => ({ id: q.id, type: q.type, text: q.text, presenter: q.presenter, media_kind: (q.mediaKind as MediaKind | null) ?? null, options: q.options }));
  }
  return dedupeLines(bankQuestionLines(rows));
}

export async function linesForScope(db: Db, scope: PregenScope): Promise<SpokenLine[]> {
  if (scope.kind === "session") return sessionLines(db, scope.sessionId);
  if (scope.kind === "questions") return questionsLines(db, scope);
  return genericLines(db);
}

// ---------------------------------------------------------------------------
// Stima e lotti
// ---------------------------------------------------------------------------
export interface PregenProgress {
  configured: boolean;
  /** Battute dell'ambito (senza duplicati). */
  total: number;
  ready: number;
  missing: number;
  /** Caratteri da generare per le battute mancanti. */
  missingChars: number;
  /** Battute senza voce assegnata (non generabili). */
  noVoice: number;
  budget: number;
  monthChars: number;
  remainingBudget: number;
}

async function plan(db: Db, scope: PregenScope) {
  const cfg = await loadVoiceConfig(db);
  const lines = await linesForScope(db, scope);
  const plans = new Map<string, PlannedClip>();
  /** origine in archivio delle clip che non sono frasi intere (parti fisse della libreria) */
  const sources = new Map<string, TtsSource>();
  let noVoice = 0;
  for (const l of lines) {
    const p = planClip(cfg, l);
    if (!p) noVoice++;
    else plans.set(p.key, p);
  }
  // battute della libreria ufficiale: valgono per ogni serata (ambiti "serata" e "generiche")
  if (scope.kind !== "questions") {
    try {
      const lib = await libraryVoicePlans(db, cfg);
      for (const l of lib.lines) {
        const p = planClip(cfg, l);
        if (p) plans.set(p.key, p);
      }
      for (const p of lib.parts) {
        plans.set(p.key, p);
        sources.set(p.key, "segment");
      }
    } catch (e) {
      console.warn("[quizzone] libreria delle battute non disponibile per la pre-generazione", e instanceof Error ? e.message : e);
    }
  }
  const cached = await cachedKeys(db, [...plans.keys()]);
  const missing = [...plans.values()].filter((p) => !cached.has(p.key));
  return { cfg, plans, missing, noVoice, sources };
}

async function progressOf(db: Db, total: number, missing: PlannedClip[], noVoice: number): Promise<PregenProgress> {
  const usage = await appUsage(db);
  return {
    configured: ttsConfigured(),
    total,
    ready: total - missing.length,
    missing: missing.length,
    missingChars: missing.reduce((a, p) => a + p.chars, 0),
    noVoice,
    budget: usage.budget,
    monthChars: usage.monthChars,
    remainingBudget: usage.remaining,
  };
}

/** Conta le battute mancanti e i caratteri da pagare (nessuna chiamata a ElevenLabs). */
export async function estimateScope(db: Db, scope: PregenScope): Promise<PregenProgress> {
  const { plans, missing, noVoice } = await plan(db, scope);
  return progressOf(db, plans.size, missing, noVoice);
}

export interface PregenBatchResult extends PregenProgress {
  generated: number;
  billedChars: number;
  errors: string[];
  /** Il budget mensile ha bloccato la generazione. */
  blocked: boolean;
}

/** Genera al massimo `batch` battute mancanti (richiamare finché missing = 0). */
export async function runScopeBatch(db: Db, scope: PregenScope, batch: number, opts: { priority?: TtsPriority } = {}): Promise<PregenBatchResult> {
  if (!ttsConfigured()) throw new TtsError("TTS_OFF", "Voce professionale non configurata (ELEVENLABS_API_KEY)");
  const { cfg, plans, missing, noVoice, sources } = await plan(db, scope);
  const todo = missing.slice(0, Math.max(1, Math.min(10, batch)));
  const results = await Promise.allSettled(todo.map((p) => ensureClip(db, p, sources.get(p.key) ?? "pregen", cfg, { priority: opts.priority })));
  let generated = 0;
  let billedChars = 0;
  const errors: string[] = [];
  let blocked = false;
  const done = new Set<string>();
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      generated++;
      billedChars += r.value.billedChars;
      done.add(todo[i].key);
    } else {
      const e = r.reason;
      if (e instanceof TtsError && e.code === "TTS_BUDGET") blocked = true;
      errors.push(e instanceof Error ? e.message : String(e));
    }
  });
  const stillMissing = missing.filter((p) => !done.has(p.key));
  return { ...(await progressOf(db, plans.size, stillMissing, noVoice)), generated, billedChars, errors: [...new Set(errors)], blocked };
}
