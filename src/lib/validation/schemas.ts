import { z } from "zod";
import { COMMANDS, isCategoryRound, maxCategories, PRESENTERS, QUESTION_TYPES, ROUND_KINDS, SPECIAL_EVENT_TYPES } from "@/lib/game-engine/types";
import { MAX_TEAMS, TEAM_AGGREGATIONS, TEAM_MODES } from "@/lib/game-engine/teams";
import { ADVANCE_MODES } from "@/lib/game-engine/autoplay";

const uuid = z.uuid();

// ---------------------------------------------------------------------------
// Domande (editor e importazione JSON/CSV da assistenti esterni)
// ---------------------------------------------------------------------------
export const questionOptionSchema = z.object({
  text: z.string().trim().min(1, "Risposta vuota").max(120, "Max 120 caratteri"),
  isCorrect: z.boolean(),
});

const optionalPoints = z.number().int().min(0).max(100000).nullable().optional();

export const questionInputSchema = z
  .object({
    type: z.enum(QUESTION_TYPES).default("single"),
    text: z.string().trim().min(3, "Testo troppo corto").max(400, "Max 400 caratteri"),
    category: z.string().trim().min(2).max(60),
    difficulty: z.number().int().min(1).max(5).default(2),
    tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
    presenter: z.enum(PRESENTERS).default("professore"),
    options: z.array(questionOptionSchema).length(4, "Servono esattamente 4 risposte"),
    correctPoints: optionalPoints,
    wrongPenalty: optionalPoints,
    noAnswerPenalty: optionalPoints,
    durationSeconds: z.number().int().min(3).max(120).nullable().optional(),
    partialScoring: z.boolean().default(false),
    mediaId: uuid.nullable().optional(),
    audioStartMs: z.number().int().min(0).max(3_600_000).default(0),
    audioDurationMs: z.number().int().min(1000).max(600_000).nullable().optional(),
    audioPlays: z.number().int().min(1).max(3).default(1),
    animation: z.string().max(40).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    status: z.enum(["draft", "approved", "archived"]).default("draft"),
    answerConfirmed: z.boolean().default(false),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (q.type === "single" && correct !== 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Una domanda a risposta singola deve avere esattamente 1 risposta corretta" });
    }
    if (q.type === "multiple" && correct < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Una domanda a selezione multipla deve avere almeno 2 risposte corrette" });
    }
    const texts = q.options.map((o) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Le 4 risposte devono essere diverse tra loro" });
    }
    if (q.status === "approved" && !q.answerConfirmed) {
      ctx.addIssue({ code: "custom", path: ["answerConfirmed"], message: "Per approvare la domanda conferma la risposta corretta" });
    }
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

/**
 * Formato di importazione pensato per domande generate con ChatGPT o altri
 * assistenti. Le domande importate entrano SEMPRE come bozza con
 * risposta non confermata: l'admin deve confermarle una per una.
 */
export const importQuestionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES).default("single"),
    text: z.string().trim().min(3).max(400),
    category: z.string().trim().min(2).max(60),
    difficulty: z.number().int().min(1).max(5).default(2),
    tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
    presenter: z.enum(PRESENTERS).default("professore"),
    answers: z.array(z.string().trim().min(1).max(120)).length(4),
    correct: z.array(z.number().int().min(0).max(3)).min(1).max(4),
    durationSeconds: z.number().int().min(3).max(120).optional(),
    correctPoints: z.number().int().min(0).max(100000).optional(),
    wrongPenalty: z.number().int().min(0).max(100000).optional(),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((q, ctx) => {
    const uniq = new Set(q.correct);
    if (uniq.size !== q.correct.length) ctx.addIssue({ code: "custom", path: ["correct"], message: "Indici corretti duplicati" });
    if (q.type === "single" && uniq.size !== 1) ctx.addIssue({ code: "custom", path: ["correct"], message: "Risposta singola: un solo indice corretto" });
    if (q.type === "multiple" && uniq.size < 2) ctx.addIssue({ code: "custom", path: ["correct"], message: "Selezione multipla: almeno 2 indici corretti" });
    const texts = q.answers.map((a) => a.toLowerCase());
    if (new Set(texts).size !== 4) ctx.addIssue({ code: "custom", path: ["answers"], message: "Le risposte devono essere diverse" });
  });
export type ImportQuestion = z.infer<typeof importQuestionSchema>;

export const importFileSchema = z.object({
  format: z.literal("quizzone-questions").optional(),
  version: z.literal(1).optional(),
  questions: z.array(z.unknown()).min(1).max(1000),
});

// ---------------------------------------------------------------------------
// Sessioni e round
// ---------------------------------------------------------------------------
/**
 * Scaletta a tempo (solo pianificazione: non cambia nessuna regola di gioco).
 * Minuti previsti per round (per id round; se mancano vale la stima) e intervallo dopo il round.
 */
export const runningOrderSchema = z.object({
  targetMinutes: z.number().int().min(10).max(600).optional(),
  introMinutes: z.number().int().min(0).max(120).optional(),
  outroMinutes: z.number().int().min(0).max(120).optional(),
  rounds: z
    .record(
      uuid,
      z.object({
        minutes: z.number().int().min(1).max(240).optional(),
        breakAfterMinutes: z.number().int().min(0).max(120).optional(),
      }),
    )
    .refine((r) => Object.keys(r).length <= 100, "Troppi round nella scaletta")
    .optional(),
});
export type RunningOrder = z.infer<typeof runningOrderSchema>;

export const sessionSettingsSchema = z.object({
  correctPoints: z.number().int().min(0).max(100000).nullable().optional(),
  wrongPenalty: z.number().int().min(0).max(100000).nullable().optional(),
  noAnswerPenalty: z.number().int().min(0).max(100000).nullable().optional(),
  durationSeconds: z.number().int().min(3).max(120).nullable().optional(),
  allowNegative: z.boolean().nullable().optional(),
  joinLocked: z.boolean().nullable().optional(),
  allowLateJoin: z.boolean().nullable().optional(),
  nicknameMaxLength: z.number().int().min(4).max(24).nullable().optional(),
  autoEvents: z.boolean().nullable().optional(),
  palminoPool: z.array(z.string().min(2).max(40)).max(10).nullable().optional(),
  runningOrder: runningOrderSchema.nullable().optional(),
  /** scorrimento della serata: "manual" (predefinito, la regia preme ogni passo) o "auto" (va da sola) */
  advanceMode: z.enum(ADVANCE_MODES).nullable().optional(),
  /** giocatori massimi (partite libere; assente = nessun limite) */
  maxPlayers: z.number().int().min(2).max(500).nullable().optional(),
  /**
   * Ruota di Palmino: dalla 5ª domanda, ogni tanto, Palmino gira una ruota che sceglie la categoria
   * della domanda successiva. Il piano si decide alla pubblicazione (partite libere: sempre attiva).
   */
  palminoWheel: z.boolean().nullable().optional(),
  /** modalità squadre (assente = individuale) */
  teams: z
    .object({
      mode: z.enum(TEAM_MODES).default("individual"),
      selfSelect: z.boolean().default(false),
      aggregation: z.enum(TEAM_AGGREGATIONS).default("sum"),
    })
    .nullable()
    .optional(),
});
export type SessionSettingsInput = z.infer<typeof sessionSettingsSchema>;
/** Impostazioni salvate: le chiavi null vengono rimosse (= eredita dal globale). */
export type SessionSettings = { [K in keyof SessionSettingsInput]?: Exclude<SessionSettingsInput[K], null> };

export const sessionInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
  isTest: z.boolean().default(false),
  seasonId: uuid.nullable().optional(),
  settings: sessionSettingsSchema.default({}),
});

export const roundInputSchema = z.object({
  title: z.string().trim().min(2).max(80),
  kind: z.enum(ROUND_KINDS).default("standard"),
  presenter: z.enum(PRESENTERS).default("professore"),
  description: z.string().trim().max(500).nullable().optional(),
  pointsMultiplier: z.number().min(0).max(20).default(1),
  penaltyMultiplier: z.number().min(0).max(20).default(1),
  noPenalty: z.boolean().default(false),
  correctPoints: optionalPoints,
  wrongPenalty: optionalPoints,
  durationSeconds: z.number().int().min(3).max(120).nullable().optional(),
  speedBonusMax: z.number().int().min(0).max(5000).default(500),
  voteDurationSeconds: z.number().int().min(5).max(120).default(15),
  voteTieBreak: z.enum(["random", "admin", "first"]).default("random"),
  voteLiveResults: z.boolean().default(true),
  voteOptions: z.array(z.string().trim().min(2).max(40)).max(8).default([]),
  // Scommetti tutto
  betMinStake: z.number().int().min(0).max(100000).default(500),
  betDefaultTier: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(100)]).default(0),
  // Grande ribaltone (1 = disattivato)
  comebackMultiplier: z.number().min(1).max(10).default(2),
  comebackLeaderPenalty: z.number().min(1).max(10).default(1),
}).superRefine((r, ctx) => {
  if (!isCategoryRound(r.kind)) return;
  const max = maxCategories(r.kind);
  if (r.voteOptions.length > max) {
    ctx.addIssue({ code: "custom", path: ["voteOptions"], message: `Al massimo ${max} categorie per questo tipo di round` });
  }
  const keys = r.voteOptions.map((l) => l.toLocaleLowerCase("it-IT"));
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: "custom", path: ["voteOptions"], message: "Le categorie devono essere diverse tra loro" });
  }
});
export type RoundInput = z.infer<typeof roundInputSchema>;

// ---------------------------------------------------------------------------
// Comandi live
// ---------------------------------------------------------------------------
export const commandSchema = z.object({
  command: z.enum(COMMANDS),
  commandId: uuid,
  expectedVersion: z.number().int().nonnegative().optional(),
  args: z
    .object({
      roundId: uuid.optional(),
      force: z.boolean().optional(),
      adminChoice: uuid.optional(),
      definitionKey: z.string().min(2).max(40).optional(),
      reserveQuestionId: uuid.optional(),
      participantId: uuid.optional(),
      reason: z.string().trim().max(200).optional(),
      delta: z.number().int().min(-100000).max(100000).optional(),
      joinLocked: z.boolean().optional(),
      allowLateJoin: z.boolean().optional(),
      /** SET_AUTOPLAY: true = scorrimento automatico, false = manuale */
      autoplay: z.boolean().optional(),
      count: z.number().int().min(1).max(200).optional(),
      /** squadra di destinazione (null = nessuna squadra) */
      teamId: uuid.nullable().optional(),
      onlyUnassigned: z.boolean().optional(),
    })
    .default({}),
});
export type CommandInput = z.infer<typeof commandSchema>;

// ---------------------------------------------------------------------------
// Squadre
// ---------------------------------------------------------------------------
const teamColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colore non valido");
export const teamInputSchema = z.object({
  name: z.string().trim().min(2, "Nome troppo corto").max(24, "Max 24 caratteri").refine((v) => !/[<>{}]/.test(v), "Caratteri non ammessi"),
  // senza colore: il primo libero della tavolozza (scelto dal server)
  color: teamColor.optional(),
});
export const teamUpdateSchema = z.object({
  name: teamInputSchema.shape.name.optional(),
  color: teamColor.optional(),
  position: z.number().int().min(0).max(MAX_TEAMS - 1).optional(),
});

export const specialEventScheduleSchema = z.object({
  definitionKey: z.string().min(2).max(40),
  targetSessionQuestionId: uuid,
  params: z
    .object({
      correctMultiplier: z.number().min(0).max(20).optional(),
      wrongMultiplier: z.number().min(0).max(20).optional(),
      bonusPoints: z.number().int().min(0).max(100000).optional(),
      durationSeconds: z.number().int().min(3).max(60).optional(),
    })
    .optional(),
});

export const specialEventTypeSchema = z.enum(SPECIAL_EVENT_TYPES);

// ---------------------------------------------------------------------------
// Giocatori
// ---------------------------------------------------------------------------
export const joinSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/),
  nickname: z.string().max(80),
  recoveryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{6,14}$/)
    .optional()
    .or(z.literal("")),
  slot: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
  /** genere (facoltativo): m, f, n = "preferisco non dirlo"; assente = non scelto (si tiene quello di prima) */
  gender: z.enum(["m", "f", "n"]).optional(),
});

export const answerSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/),
  sessionQuestionId: uuid,
  positions: z.array(z.number().int().min(0).max(3)).min(1).max(4),
  requestId: uuid,
  slot: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
});

export const teamChoiceSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/),
  teamId: uuid,
  slot: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
});

export const betSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/),
  sessionQuestionId: uuid,
  tier: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(100)]),
  requestId: uuid,
  slot: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
});

export const voteSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/),
  roundId: uuid,
  optionId: uuid,
  slot: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
});
