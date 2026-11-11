/**
 * Scaletta a tempo della serata: stima, piano e confronto con il tempo reale.
 * Puro (niente React, Next.js o database): usato dall'editor della serata, dalla regia live e dai test.
 *
 * - Stima di un round: domande × (lettura + tempo per rispondere + soluzione/punti) + intro del round,
 *   eventuale votazione della categoria e classifica di fine round.
 * - Piano: minuti per round (quelli scelti dall'admin, altrimenti la stima), intervalli dopo i round,
 *   apertura e finale; somma confrontata con la durata prevista della serata.
 * - Live: dai tempi registrati (inizio serata, inizio round, ultima domanda conclusa) calcola
 *   ritardo/anticipo rispetto al piano e la fine prevista. Le pause contano: sono tempo vero della serata.
 */
import type { RoundKind } from "@/lib/game-engine/types";
import type { RunningOrder } from "@/lib/validation/schemas";

// ---------------------------------------------------------------------------
// Stima
// ---------------------------------------------------------------------------
export const ESTIMATE = {
  /** velocità di lettura della voce (come read-time.ts) */
  charsPerSecond: 13,
  /** avvio voce e pause tra domanda e risposte */
  readingPauseSeconds: 3,
  /** pausa per ogni risposta letta */
  perOptionSeconds: 0.35,
  /** soluzione, punti e battute dei presentatori dopo ogni domanda */
  revealSeconds: 20,
  /** domande con audio o video: ascolto/visione in più */
  mediaExtraSeconds: 10,
  /** presentazione del round sul TV */
  roundIntroSeconds: 30,
  /** classifica di fine round */
  leaderboardSeconds: 45,
  /** annuncio della categoria vinta dopo la votazione */
  voteResultSeconds: 15,
  /** tempo per rispondere se non è impostato da nessuna parte */
  defaultDurationSeconds: 15,
  /** durata prevista della serata se non indicata */
  targetMinutes: 120,
  /** apertura (intro e regole) e finale (podio e saluti) predefiniti */
  introMinutes: 5,
  outroMinutes: 5,
} as const;

export interface EstimateQuestion {
  isReserve: boolean;
  voteOptionId: string | null;
  text: string;
  options: { text: string }[];
  durationSeconds: number | null;
  mediaKind: string | null;
}

export interface EstimateRound {
  kind: RoundKind;
  durationSeconds: number | null;
  voteDurationSeconds: number;
  voteOptions: { id: string }[];
  questions: EstimateQuestion[];
}

/** Secondi stimati per una domanda: lettura + tempo per rispondere + soluzione e punti. */
export function estimateQuestionSeconds(q: EstimateQuestion, roundDuration: number | null, defaultDuration: number): number {
  const chars = q.text.length + q.options.reduce((a, o) => a + o.text.length, 0);
  const reading = chars / ESTIMATE.charsPerSecond + q.options.length * ESTIMATE.perOptionSeconds + ESTIMATE.readingPauseSeconds;
  const answer = q.durationSeconds ?? roundDuration ?? defaultDuration;
  const media = q.mediaKind === "audio" || q.mediaKind === "video" ? ESTIMATE.mediaExtraSeconds : 0;
  return reading + answer + ESTIMATE.revealSeconds + media;
}

export interface RoundEstimate {
  /** domande che si prevede di giocare (nel voto di categoria: media per categoria) */
  questions: number;
  seconds: number;
}

export function estimateRound(round: EstimateRound, defaultDuration: number = ESTIMATE.defaultDurationSeconds): RoundEstimate {
  const playable = round.questions.filter((q) => !q.isReserve);
  const cost = (qs: EstimateQuestion[]) => qs.reduce((a, q) => a + estimateQuestionSeconds(q, round.durationSeconds, defaultDuration), 0);
  let questions = playable.length;
  let seconds = ESTIMATE.roundIntroSeconds + ESTIMATE.leaderboardSeconds;
  if (round.kind === "category_vote" && round.voteOptions.length > 0) {
    seconds += round.voteDurationSeconds + ESTIMATE.voteResultSeconds;
    // si gioca solo la categoria vincente: si stima la media (il piano non cambia dopo il voto)
    const groups = round.voteOptions.map((o) => playable.filter((q) => q.voteOptionId === o.id));
    questions = Math.round(groups.reduce((a, g) => a + g.length, 0) / groups.length);
    seconds += groups.reduce((a, g) => a + cost(g), 0) / groups.length;
  } else {
    seconds += cost(playable);
  }
  return { questions, seconds: Math.round(seconds) };
}

/** Secondi → minuti interi per la scaletta (per eccesso: meglio un minuto di margine). */
export function toPlanMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

// ---------------------------------------------------------------------------
// Piano
// ---------------------------------------------------------------------------
export interface PlanRoundInput {
  id: string;
  title: string;
  estimateSeconds: number;
  questions: number;
}

export interface PlanRound {
  id: string;
  title: string;
  minutes: number;
  /** true = minuti scelti dall'admin; false = si usa la stima */
  manual: boolean;
  estimateMinutes: number;
  questions: number;
  /** intervallo dopo il round (mai dopo l'ultimo: lì c'è il finale) */
  breakAfterMinutes: number;
}

export interface ResolvedPlan {
  targetMinutes: number;
  introMinutes: number;
  outroMinutes: number;
  rounds: PlanRound[];
  breaksMinutes: number;
  totalMinutes: number;
  /** totale − durata prevista: > 0 la scaletta sfora, < 0 avanza margine */
  overMinutes: number;
}

export function resolvePlan(ro: RunningOrder | null | undefined, rounds: PlanRoundInput[]): ResolvedPlan {
  const cfg = ro ?? {};
  const planRounds: PlanRound[] = rounds.map((r, i) => {
    const o = cfg.rounds?.[r.id];
    const estimateMinutes = toPlanMinutes(r.estimateSeconds);
    return {
      id: r.id,
      title: r.title,
      minutes: o?.minutes ?? estimateMinutes,
      manual: o?.minutes !== undefined,
      estimateMinutes,
      questions: r.questions,
      breakAfterMinutes: i < rounds.length - 1 ? (o?.breakAfterMinutes ?? 0) : 0,
    };
  });
  const introMinutes = cfg.introMinutes ?? ESTIMATE.introMinutes;
  const outroMinutes = cfg.outroMinutes ?? ESTIMATE.outroMinutes;
  const targetMinutes = cfg.targetMinutes ?? ESTIMATE.targetMinutes;
  const breaksMinutes = planRounds.reduce((a, r) => a + r.breakAfterMinutes, 0);
  const totalMinutes = introMinutes + outroMinutes + breaksMinutes + planRounds.reduce((a, r) => a + r.minutes, 0);
  return { targetMinutes, introMinutes, outroMinutes, rounds: planRounds, breaksMinutes, totalMinutes, overMinutes: totalMinutes - targetMinutes };
}

/** Piano della serata direttamente dai round dell'editor (stima per ogni round + scelte dell'admin). */
export function planFromRounds(
  ro: RunningOrder | null | undefined,
  rounds: (EstimateRound & { id: string; title: string })[],
  defaultDuration: number = ESTIMATE.defaultDurationSeconds,
): ResolvedPlan {
  return resolvePlan(
    ro,
    rounds.map((r) => {
      const e = estimateRound(r, defaultDuration);
      return { id: r.id, title: r.title, estimateSeconds: e.seconds, questions: e.questions };
    }),
  );
}

export type PlanSegment =
  | { kind: "intro"; minutes: number; startMinute: number }
  | { kind: "round"; roundId: string; title: string; index: number; minutes: number; startMinute: number }
  | { kind: "break"; roundId: string; minutes: number; startMinute: number }
  | { kind: "outro"; minutes: number; startMinute: number };

/** Sequenza della serata con l'orario previsto di inizio (minuti dall'apertura). Intervalli a 0 omessi. */
export function planSegments(plan: ResolvedPlan): PlanSegment[] {
  const out: PlanSegment[] = [];
  let t = 0;
  out.push({ kind: "intro", minutes: plan.introMinutes, startMinute: t });
  t += plan.introMinutes;
  plan.rounds.forEach((r, index) => {
    out.push({ kind: "round", roundId: r.id, title: r.title, index, minutes: r.minutes, startMinute: t });
    t += r.minutes;
    if (r.breakAfterMinutes > 0) {
      out.push({ kind: "break", roundId: r.id, minutes: r.breakAfterMinutes, startMinute: t });
      t += r.breakAfterMinutes;
    }
  });
  out.push({ kind: "outro", minutes: plan.outroMinutes, startMinute: t });
  return out;
}

// ---------------------------------------------------------------------------
// Live: tempo reale contro piano
// ---------------------------------------------------------------------------
export interface LiveRoundActual {
  id: string;
  /** START_ROUND (ms epoch), null = non ancora giocato */
  startedAt: number | null;
  /** fine delle domande del round (ultima domanda conclusa), null = round ancora in corso o non iniziato */
  playEndedAt: number | null;
}

export interface LiveTimingInput {
  /** inizio della serata (START_INTRO o primo round) */
  startedAt: number | null;
  finishedAt: number | null;
  scheduledAt: number | null;
  rounds: LiveRoundActual[];
}

export type LiveRoundStatus = "pending" | "running" | "after" | "done";

export interface LiveRoundTiming {
  id: string;
  title: string;
  status: LiveRoundStatus;
  plannedMs: number;
  /** durata reale delle domande (in corso: fin qui) */
  actualMs: number | null;
  /** effettivo − previsto (round concluso; in corso: solo se ha già superato il previsto) */
  deltaMs: number | null;
  breakPlannedMs: number;
  /** tempo dopo le domande (classifica/intervallo) fino al round successivo */
  breakActualMs: number | null;
}

export type LivePhase = "not_started" | "intro" | "round" | "after_round" | "outro" | "finished";

export interface LiveTiming {
  phase: LivePhase;
  /** tempo trascorso dall'inizio della serata */
  elapsedMs: number;
  /** > 0 in ritardo, < 0 in anticipo (rispetto al punto della scaletta in cui ci si trova) */
  delayMs: number;
  plannedEndAt: number | null;
  projectedEndAt: number | null;
  rounds: LiveRoundTiming[];
}

const MIN = 60_000;

export function computeLiveTiming(plan: ResolvedPlan, input: LiveTimingInput, now: number): LiveTiming {
  const actualById = new Map(input.rounds.map((r) => [r.id, r]));
  const totalMs = plan.totalMinutes * MIN;

  const pendingRow = (r: PlanRound): LiveRoundTiming => ({
    id: r.id,
    title: r.title,
    status: "pending",
    plannedMs: r.minutes * MIN,
    actualMs: null,
    deltaMs: null,
    breakPlannedMs: r.breakAfterMinutes * MIN,
    breakActualMs: null,
  });

  if (input.startedAt === null) {
    return {
      phase: "not_started",
      elapsedMs: 0,
      delayMs: 0,
      plannedEndAt: input.scheduledAt !== null ? input.scheduledAt + totalMs : null,
      projectedEndAt: input.scheduledAt !== null ? Math.max(input.scheduledAt, now) + totalMs : null,
      rounds: plan.rounds.map(pendingRow),
    };
  }

  const start = input.startedAt;
  const end = input.finishedAt ?? Math.max(now, start);
  const elapsedMs = end - start;

  // round giocati in ordine cronologico (la regia può avviarli anche fuori ordine)
  const started = plan.rounds
    .map((r) => ({ plan: r, actual: actualById.get(r.id) }))
    .filter((x): x is { plan: PlanRound; actual: LiveRoundActual & { startedAt: number } } => x.actual?.startedAt != null)
    .sort((a, b) => a.actual.startedAt - b.actual.startedAt);
  const unstarted = plan.rounds.filter((r) => !started.some((s) => s.plan.id === r.id));

  const rows = new Map<string, LiveRoundTiming>();
  let plannedProgress = 0;
  let phase: LivePhase;
  let remaining = 0;

  const introPlanned = plan.introMinutes * MIN;
  if (started.length === 0) {
    phase = input.finishedAt !== null ? "finished" : "intro";
    plannedProgress += Math.min(elapsedMs, introPlanned);
    remaining += Math.max(0, introPlanned - elapsedMs);
  } else {
    plannedProgress += introPlanned;
    phase = "round";
  }

  started.forEach((s, i) => {
    const next = started[i + 1]?.actual.startedAt ?? input.finishedAt ?? null;
    const isLast = i === started.length - 1;
    const plannedMs = s.plan.minutes * MIN;
    // dopo l'ultimo round giocato, se non ne restano altri (o la serata è finita), c'è il finale (non l'intervallo)
    const afterIsOutro = isLast && (unstarted.length === 0 || input.finishedAt !== null);
    const afterPlanned = afterIsOutro ? plan.outroMinutes * MIN : s.plan.breakAfterMinutes * MIN;
    const playEnd = s.actual.playEndedAt ?? (next !== null ? next : null);

    if (playEnd === null) {
      // domande in corso
      const actual = Math.max(0, end - s.actual.startedAt);
      plannedProgress += Math.min(actual, plannedMs);
      remaining += Math.max(0, plannedMs - actual) + afterPlanned;
      phase = "round";
      rows.set(s.plan.id, {
        id: s.plan.id,
        title: s.plan.title,
        status: "running",
        plannedMs,
        actualMs: actual,
        deltaMs: actual > plannedMs ? actual - plannedMs : null,
        breakPlannedMs: s.plan.breakAfterMinutes * MIN,
        breakActualMs: null,
      });
      return;
    }

    const actual = Math.max(0, playEnd - s.actual.startedAt);
    plannedProgress += plannedMs;
    const afterEnd = next ?? end;
    const afterActual = Math.max(0, afterEnd - playEnd);
    if (next === null) {
      // dopo le domande, in attesa del round successivo (classifica/intervallo) o del finale
      plannedProgress += Math.min(afterActual, afterPlanned);
      remaining += Math.max(0, afterPlanned - afterActual);
      phase = afterIsOutro ? "outro" : "after_round";
    } else {
      plannedProgress += afterPlanned;
    }
    rows.set(s.plan.id, {
      id: s.plan.id,
      title: s.plan.title,
      status: next === null ? "after" : "done",
      plannedMs,
      actualMs: actual,
      deltaMs: actual - plannedMs,
      breakPlannedMs: s.plan.breakAfterMinutes * MIN,
      breakActualMs: afterIsOutro ? null : afterActual,
    });
  });

  // ancora da giocare: round con i loro intervalli e, se non è già in corso, il finale
  // (resolvePlan non mette mai l'intervallo dopo l'ultimo round)
  for (const r of unstarted) remaining += (r.minutes + r.breakAfterMinutes) * MIN;
  if (unstarted.length > 0) remaining += plan.outroMinutes * MIN;

  let delayMs = elapsedMs - plannedProgress;
  if (input.finishedAt !== null) {
    // a serata conclusa conta il confronto con la durata prevista
    phase = "finished";
    remaining = 0;
    delayMs = elapsedMs - totalMs;
  }

  return {
    phase,
    elapsedMs,
    delayMs,
    plannedEndAt: start + totalMs,
    projectedEndAt: input.finishedAt ?? end + remaining,
    rounds: plan.rounds.map((r) => rows.get(r.id) ?? pendingRow(r)),
  };
}

// ---------------------------------------------------------------------------
// Formattazione (testi della regia)
// ---------------------------------------------------------------------------
/** 125 → "2 h 05", 45 → "45 min" */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (Math.abs(m) < 60) return `${m} min`;
  const sign = m < 0 ? "−" : "";
  const a = Math.abs(m);
  return `${sign}${Math.floor(a / 60)} h ${String(a % 60).padStart(2, "0")}`;
}

/** Durata in ms → "12:34" (o "1:02:03" oltre l'ora) */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** "In ritardo di 7 min" / "In anticipo di 3 min" / "In orario" (entro un minuto). */
export function delayLabel(delayMs: number): { text: string; tone: "ok" | "late" | "early" } {
  const min = Math.round(Math.abs(delayMs) / MIN);
  if (min < 1) return { text: "In orario", tone: "ok" };
  return delayMs > 0 ? { text: `In ritardo di ${formatMinutes(min)}`, tone: "late" } : { text: `In anticipo di ${formatMinutes(min)}`, tone: "early" };
}
