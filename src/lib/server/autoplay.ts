import "server-only";
import type { Db, Tx } from "@/lib/database/db";
import { num } from "@/lib/database/db";
import { estimateSpeechMs, planAutoplay, AUTO_SWITCH_DELAY_MS, type AutoplayPlan } from "@/lib/game-engine/autoplay";
import type { GamePhase, PublicState, RoundKind } from "@/lib/game-engine/types";
import { speechFor, stripAudioTags, wheelStopLine, type SpokenLine } from "@/features/game/script";
import { questionMoment } from "@/features/game/moment";
import { questionIntroMs } from "@/features/game/question-intro";
import { autoplayEnabled, publicAuto, type StateRow } from "./public-state";
import { loadVoiceConfig, planClip, ttsConfigured } from "./tts";

/**
 * Scorrimento automatico lato server: dopo OGNI comando (nella stessa transazione) si calcola il
 * prossimo passo e lo si scrive in game_state (auto_next_at, auto_command, auto_version).
 * Nessun timer sul server: TV e regia chiamano /tick quando l'orario è passato (vedi autoTick in engine).
 */

/** mp3_44100_128: 128 kbit/s = 16 byte al millisecondo (come in read-time.ts). */
const MP3_BYTES_PER_MS = 16;
/** Tra una battuta e l'altra: richiesta della clip, avvio dell'audio e la pausa del TV (120 ms). */
const LINE_GAP_MS = 350;
/**
 * Battuta non ancora in archivio: il TV la chiede al volo (generazione su Vercel: alcuni secondi).
 * Stima di riserva: il TV segnala quando ha davvero finito di parlare (tv_presence), così il passo
 * non taglia il presentatore e, se le clip erano pronte prima, si anticipa senza silenzi.
 * Battute con nomi/punti (generate al momento) e battute fisse (domanda, risposte: di solito già pronte).
 */
const CLIP_WAIT_LIVE_MS = 6000;
const CLIP_WAIT_MS = 1500;
/** Media senza durata nota (audio intero o video): attesa prudente. */
const MEDIA_FALLBACK_MS = 30_000;
/** Pausa del TV tra una ripetizione e l'altra dell'estratto audio (DisplayApp). */
const AUDIO_REPEAT_GAP_MS = 1500;

/** Fasi in cui l'automatico aspetta la regia o non fa nulla: nessuna stima da calcolare. */
const NO_STEP_PHASES: readonly GamePhase[] = ["DRAFT", "READY", "LOBBY", "PAUSED", "FINISHED"];

type NextQuestionResolver = (tx: Tx, st: StateRow) => Promise<{ id: string } | { blocked: string } | null>;

/**
 * Quanto parla il TV per queste battute: durata vera della clip ElevenLabs se è in archivio
 * (dimensione dell'mp3), altrimenti una stima prudente dal testo (più l'attesa della generazione).
 */
export async function estimateLinesMs(tx: Tx, lines: SpokenLine[]): Promise<number> {
  const said = lines.filter((l) => stripAudioTags(l.text).trim().length > 0);
  if (said.length === 0) return 0;
  const sizes = new Map<string, number>();
  let keys: (string | null)[] = said.map(() => null);
  try {
    // in un savepoint: un errore dell'archivio voci non deve mai far fallire il comando
    await tx.savepoint(async (sp) => {
      const cfg = await loadVoiceConfig(sp);
      keys = said.map((l) => planClip(cfg, l)?.key ?? null);
      const wanted = keys.filter((k): k is string => k !== null);
      if (wanted.length === 0) return;
      const rows = await sp<{ cache_key: string; size: string | null }[]>`
        select c.cache_key, o.metadata->>'size' as size
        from tts_clips c join storage.objects o on o.bucket_id = 'tts' and o.name = c.storage_path
        where c.cache_key = any(${wanted}::text[])`;
      for (const r of rows) if (r.size && Number(r.size) > 0) sizes.set(r.cache_key, Number(r.size));
    });
  } catch {
    // archivio voci non disponibile: solo stime
  }
  let total = 0;
  let missing = false;
  let missingLive = false;
  said.forEach((l, i) => {
    const key = keys[i];
    const bytes = key ? sizes.get(key) : undefined;
    if (bytes) total += bytes / MP3_BYTES_PER_MS;
    else {
      total += estimateSpeechMs(l.text);
      if (key && ttsConfigured()) {
        missing = true;
        if (l.live) missingLive = true;
      }
    }
    total += LINE_GAP_MS;
  });
  // le clip mancanti si generano in parallelo appena le battute entrano in coda: l'attesa si paga una volta
  if (missing) total += missingLive ? CLIP_WAIT_LIVE_MS : CLIP_WAIT_MS;
  return Math.round(total);
}

interface RoundFacts {
  kind: RoundKind;
  position: number;
  winning_option_id: string | null;
  vote_closes_at: Date | null;
  wheel_spun_at: Date | null;
  wheel_ms: number | null;
}

/** Calcola il piano del prossimo passo per lo stato appena scritto (stessa transazione del comando). */
export async function computeAutoplayPlan(
  tx: Tx,
  st: StateRow,
  state: PublicState,
  resolveNext: NextQuestionResolver,
  minDelayMs = 0,
): Promise<AutoplayPlan> {
  const now = st.server_now.getTime();
  const base = {
    phase: st.phase,
    now,
    phaseStartedAt: st.phase_started_at.getTime(),
    introStartedAt: st.intro_started_at ? st.intro_started_at.getTime() : null,
    minDelayMs,
  };
  if (NO_STEP_PHASES.includes(st.phase)) {
    return planAutoplay({
      ...base,
      roundKind: null,
      voteDone: false,
      hasNextQuestion: false,
      hasNextRound: false,
      speechMs: 0,
      answersCloseAt: null,
      voteClosesAt: null,
      wheelStopsAt: null,
      wheelStopSpeechMs: 0,
      media: null,
      betRound: false,
    });
  }
  const [round] = st.current_round_id
    ? await tx<RoundFacts[]>`
        select kind, position, winning_option_id, vote_closes_at, wheel_spun_at, (wheel_spin->>'durationMs')::float8 as wheel_ms
        from game_rounds where id = ${st.current_round_id}`
    : [];
  const [{ more }] = await tx<{ more: boolean }[]>`
    select exists (
      select 1 from game_rounds
      where session_id = ${st.session_id} and started_at is null and position > ${round ? round.position : -1}
    ) as more`;
  const next = await resolveNext(tx, st);
  const hasNextQuestion = !!next && !("blocked" in next);

  let answersCloseAt: number | null = null;
  let media: { kind: "audio" | "video"; ms: number } | null = null;
  if (st.current_session_question_id && (st.phase === "OPTIONS_VISIBLE" || st.phase === "QUESTION_VISIBLE")) {
    const [q] = await tx<{ answers_close_at: Date | null; media_kind: string | null; audio_duration_ms: number | null; audio_plays: number | null; asset_ms: number | null }[]>`
      select sq.answers_close_at, qs.media_kind::text as media_kind, qs.audio_duration_ms, qs.audio_plays, m.duration_ms as asset_ms
      from session_questions sq
      join question_snapshots qs on qs.session_question_id = sq.id
      left join media_assets m on m.id = qs.media_id
      where sq.id = ${st.current_session_question_id}`;
    answersCloseAt = q?.answers_close_at ? q.answers_close_at.getTime() : null;
    if (q?.media_kind === "audio") {
      const plays = Math.max(1, q.audio_plays ?? 1);
      const one = q.audio_duration_ms ?? q.asset_ms ?? MEDIA_FALLBACK_MS;
      media = { kind: "audio", ms: one * plays + AUDIO_REPEAT_GAP_MS * (plays - 1) };
    } else if (q?.media_kind === "video") {
      media = { kind: "video", ms: q.asset_ms ?? MEDIA_FALLBACK_MS };
    }
  }

  // Stesso copione del TV: si stima ciò che dice entrando in questa fase (fase "precedente" fittizia:
  // il calcolo parte sempre dall'inizio della fase, così dopo un comando che non cambia fase il piano non slitta).
  // (risposte aperte: conta solo il timer, che comprende già la lettura delle risposte)
  const speechMs = st.phase === "OPTIONS_VISIBLE" ? 0 : await estimateLinesMs(tx, speechFor(state, { phase: "DRAFT" }, { readOptions: true }));
  const stop = st.phase === "WHEEL_SPIN" ? wheelStopLine(state) : null;
  const wheelStopSpeechMs = stop ? await estimateLinesMs(tx, [stop]) : 0;

  return planAutoplay({
    ...base,
    roundKind: round?.kind ?? null,
    voteDone: !!round?.winning_option_id,
    // voto a metà round: la prossima mossa è la votazione solo quando il motore la richiede
    voteDue: round?.kind === "category_vote" && !round.winning_option_id && !!next && "blocked" in next,
    hasNextQuestion,
    hasNextRound: more,
    speechMs,
    answersCloseAt,
    voteClosesAt: round?.vote_closes_at ? round.vote_closes_at.getTime() : null,
    wheelStopsAt: round?.wheel_spun_at ? round.wheel_spun_at.getTime() + (round.wheel_ms ?? 0) : null,
    wheelStopSpeechMs,
    media,
    betRound: st.phase === "QUESTION_VISIBLE" && state.question?.rules.special?.kind === "bet",
    questionIntroMs: st.phase === "QUESTION_VISIBLE" ? questionIntroMs(questionMoment(state)) : 0,
  });
}

/**
 * Aggiorna il piano dello scorrimento automatico in game_state e restituisce i dati pubblici
 * (orario del prossimo passo) da mettere nello stato trasmesso a TV e telefoni.
 * In manuale non costa nulla: si limita a ripulire un eventuale piano rimasto.
 */
export async function scheduleAutoplay(
  tx: Tx,
  st: StateRow,
  state: PublicState,
  resolveNext: NextQuestionResolver,
  opts: { justEnabled?: boolean } = {},
): Promise<PublicState["auto"]> {
  if (!autoplayEnabled(st)) {
    if (st.auto_next_at || st.auto_command || st.auto_waiting || st.auto_version !== null) {
      await tx`
        update game_state set auto_next_at = null, auto_command = null, auto_version = null, auto_waiting = null
        where session_id = ${st.session_id}`;
    }
    return null;
  }
  const plan = await computeAutoplayPlan(tx, st, state, resolveNext, opts.justEnabled ? AUTO_SWITCH_DELAY_MS : 0);
  const row = {
    auto_next_at: plan.kind === "step" ? new Date(plan.dueAt) : null,
    auto_command: plan.kind === "step" ? plan.command : null,
    auto_version: plan.kind === "step" ? num(st.version) : null,
    auto_waiting: plan.kind === "wait" ? plan.reason : null,
  };
  await tx`update game_state set ${tx(row)} where session_id = ${st.session_id}`;
  return publicAuto({ ...st, ...row });
}

/** Il passo automatico non è riuscito (es. parità da decidere): si ferma e si aspetta la regia. */
export async function markAutoWaiting(db: Db, sessionId: string, version: number, reason: string): Promise<void> {
  await db`
    update game_state set auto_next_at = null, auto_command = null, auto_version = null, auto_waiting = ${reason}
    where session_id = ${sessionId} and version = ${version}`;
}
