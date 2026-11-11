import "server-only";
import { after } from "next/server";
import { getSql, type Db } from "@/lib/database/db";
import type { GamePhase, Presenter, PublicState, QuestionType } from "@/lib/game-engine/types";
import { directedLines, podiumExtraLines, podiumLines, questionScriptLines, scriptQuestionFromCms, speechFor, wheelStopLine, type SpokenLine } from "@/features/game/script";
import { standingsForShow } from "@/features/game/teams-view";
import { cachedKeys, loadVoiceConfig, planClip, ttsConfigured } from "./tts";
import { ensureLineClip, prewarmNumberClips } from "./tts-names";
import { ensureOptionsClip } from "./read-time";
import { runScopeBatch } from "./tts-pregen";
import { isPublicSession } from "./public-session";

/**
 * Pre-riscaldamento delle battute live: dopo il commit di una transizione si
 * costruiscono le battute del nuovo stato con lo stesso copione del TV e si
 * generano in background (after), così l'audio è pronto quando il TV lo chiede.
 * Non blocca né fa fallire mai il comando.
 * Le battute live passano dai "nomi salvati" (tts-names): stesse parti e stessa clip finale
 * che chiederà il TV.
 */
const PREWARM_PHASES: ReadonlySet<GamePhase> = new Set(["SCORE_REVEAL", "LEADERBOARD", "FINISHED", "CATEGORY_RESULT", "WHEEL_SPIN", "ROUND_INTRO", "SPECIAL_EVENT", "ANSWER_REVEAL", "OPTIONS_VISIBLE"]);

export function schedulePrewarm(fromPhase: GamePhase, state: PublicState): void {
  try {
    // Appena compare la domanda si prepara la lettura delle risposte (ancora segrete per i client):
    // al "mostra risposte" la voce parte subito e il server ne conosce la durata esatta.
    if (state.phase === "QUESTION_VISIBLE" && fromPhase !== state.phase && state.question?.id && ttsConfigured() && !process.env.VITEST) {
      const sqId = state.question.id;
      const sessionId = state.sessionId;
      after(async () => {
        try {
          await ensureOptionsClip(sqId);
        } catch (e) {
          console.warn("[quizzone] pre-riscaldamento lettura risposte non riuscito", e instanceof Error ? e.message : e);
        }
        // rete di sicurezza: anche la domanda successiva (lettura, risposte, soluzione)
        await prewarmNextQuestion(sessionId).catch(() => undefined);
      });
      return;
    }
    if (!ttsConfigured() || process.env.VITEST || !PREWARM_PHASES.has(state.phase) || fromPhase === state.phase) return;
    // readOptions non incide sulle fasi pre-riscaldate
    // a fine serata anche tutte le battute del podio (le dice il TV durante la rivelazione)
    const lines =
      state.phase === "FINISHED"
        ? podiumLines(standingsForShow(state), state.sessionId, podiumExtraLines(state))
        : // risposte aperte: solo l'eventuale battuta sul tempo che scade (le risposte sono già pronte)
          state.phase === "OPTIONS_VISIBLE"
          ? directedLines(state)
          : speechFor(state, { phase: fromPhase }, { readOptions: true });
    // ruota: anche la battuta d'arrivo, che il TV dice quando la ruota si ferma
    const stop = state.phase === "WHEEL_SPIN" ? wheelStopLine(state) : null;
    if (stop) lines.push(stop);
    const sessionId = state.sessionId;
    // (Ruota di Palmino: la domanda scelta dal giro si prepara mentre la ruota gira)
    const nextToo = state.phase === "SCORE_REVEAL" || state.phase === "LEADERBOARD" || (state.phase === "WHEEL_SPIN" && state.wheel?.kind === "palmino");
    if (lines.length === 0 && !nextToo) return;
    after(async () => {
      try {
        await warmLines(getSql(), lines, sessionId);
        // dopo i punti: la domanda successiva, così compare e si legge senza attese
        if (nextToo) await prewarmNextQuestion(sessionId);
      } catch (e) {
        console.warn("[quizzone] pre-riscaldamento voci non riuscito", e instanceof Error ? e.message : e);
      }
    });
  } catch {
    // fuori da una richiesta (script, test) o errore imprevisto: nessun pre-riscaldamento
  }
}

/**
 * Domanda successiva della serata (la prima non ancora mostrata, in ordine di round e posizione):
 * le sue battute fisse si preparano in anticipo, così lettura e risposte partono subito.
 * Rete di sicurezza della preparazione dalla lobby (TV) e del "Prepara voci" della regia.
 */
export async function prewarmNextQuestion(sessionId: string): Promise<void> {
  const db = getSql();
  const [q] = await db<{ id: string; type: QuestionType; text: string; presenter: Presenter; media_kind: string | null; options: { position: number; text: string }[]; correct: number[] }[]>`
    select qs.session_question_id as id, qs.type, qs.text, qs.presenter, qs.media_kind::text as media_kind, qs.options, qs.correct_positions as correct
    from session_questions sq
    join question_snapshots qs on qs.session_question_id = sq.id
    join game_rounds r on r.id = sq.round_id
    where sq.session_id = ${sessionId} and sq.shown_at is null and not sq.is_reserve
      -- segnaposto di una Ruota di Palmino ancora da girare: la ruota lo sostituirà (si prepara la vincente durante il giro)
      and not (r.palmino_wheel->>'slotSqId' = sq.id::text and r.wheel_spun_at is null)
    order by r.position, sq.position limit 1`;
  if (!q) return;
  const lines = questionScriptLines(
    scriptQuestionFromCms({
      id: q.id,
      type: q.type,
      text: q.text,
      presenter: q.presenter,
      mediaKind: q.media_kind,
      options: q.options.map((o) => ({ position: o.position, text: o.text, isCorrect: q.correct.includes(o.position) })),
    }),
  );
  await warmLines(db, lines, sessionId);
}

/** Genera le battute che mancano in archivio (le live con i nomi salvati della serata). */
async function warmLines(db: Db, lines: SpokenLine[], sessionId: string | null) {
  const cfg = await loadVoiceConfig(db);
  const todo = lines.map((l) => ({ l, p: planClip(cfg, l) })).filter((x) => x.p !== null);
  const cached = await cachedKeys(db, todo.map((x) => x.p!.key));
  // partite libere: sempre "nomi salvati" (stessa clip finale che chiederà il TV)
  const namesMode = sessionId && (await isPublicSession(sessionId, db)) ? "spliced" : undefined;
  await Promise.allSettled(todo.filter((x) => !cached.has(x.p!.key)).map((x) => ensureLineClip(db, cfg, x.l, { sessionId, namesMode })));
}

/**
 * Pre-riscalda battute live nate fuori da un comando di regia (es. saluti della lobby):
 * stesse chiavi di cache che chiederà il TV (who, testo, live).
 */
export function prewarmLines(lines: SpokenLine[], sessionId: string | null = null): void {
  try {
    if (!ttsConfigured() || process.env.VITEST || lines.length === 0) return;
    after(async () => {
      try {
        await warmLines(getSql(), lines, sessionId);
      } catch (e) {
        console.warn("[quizzone] pre-riscaldamento voci non riuscito", e instanceof Error ? e.message : e);
      }
    });
  } catch {
    // fuori da una richiesta: nessun pre-riscaldamento
  }
}

/**
 * "Prepara voci" automatico: alla pubblicazione e all'apertura della lobby si generano in
 * background tutte le battute della serata (domande, risposte, soluzioni, round, battute fisse),
 * così durante il gioco ogni voce parte subito. Il budget mensile resta il limite: se è
 * esaurito ci si ferma e il TV usa la voce del browser per quello che manca.
 * Una sola preparazione alla volta per serata; mai bloccante per la regia.
 */
const preparing = new Set<string>();
const PREP_MAX_MS = 10 * 60 * 1000;

export function scheduleSessionPrep(sessionId: string): void {
  try {
    if (!ttsConfigured() || process.env.VITEST || preparing.has(sessionId)) return;
    preparing.add(sessionId);
    after(async () => {
      const t0 = Date.now();
      let generated = 0;
      let billed = 0;
      try {
        const db = getSql();
        // numeri piccoli dei "nomi salvati" (una volta per sempre: dopo è solo un controllo in archivio)
        const namesMode = (await isPublicSession(sessionId, db)) ? "spliced" : undefined;
        await prewarmNumberClips(db, await loadVoiceConfig(db), { namesMode }).catch(() => undefined);
        let stuck = 0;
        while (Date.now() - t0 < PREP_MAX_MS) {
          const r = await runScopeBatch(db, { kind: "session", sessionId }, 4);
          generated += r.generated;
          billed += r.billedChars;
          if (r.blocked || r.missing === 0) break;
          stuck = r.generated === 0 ? stuck + 1 : 0;
          if (stuck >= 3) break; // errori ripetuti (rete, servizio): si riproverà alla prossima occasione
        }
        console.info(`[quizzone] voci della serata pronte: ${generated} nuove, ${billed} caratteri`);
      } catch (e) {
        console.warn("[quizzone] preparazione voci non riuscita", e instanceof Error ? e.message : e);
      } finally {
        preparing.delete(sessionId);
      }
    });
  } catch {
    preparing.delete(sessionId);
  }
}
