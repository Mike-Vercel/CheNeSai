import "server-only";
import { after } from "next/server";
import { getSql } from "@/lib/database/db";
import type { GamePhase, PublicState } from "@/lib/game-engine/types";
import { podiumLines, speechFor } from "@/features/game/script";
import { standingsForShow } from "@/features/game/teams-view";
import { cachedKeys, ensureClip, loadVoiceConfig, planClip, ttsConfigured } from "./tts";
import { ensureOptionsClip } from "./read-time";
import { runScopeBatch } from "./tts-pregen";

/**
 * Pre-riscaldamento delle battute live: dopo il commit di una transizione si
 * costruiscono le battute del nuovo stato con lo stesso copione del TV e si
 * generano in background (after), così l'audio è pronto quando il TV lo chiede.
 * Non blocca né fa fallire mai il comando.
 */
const PREWARM_PHASES: ReadonlySet<GamePhase> = new Set(["SCORE_REVEAL", "LEADERBOARD", "FINISHED", "CATEGORY_RESULT", "ROUND_INTRO", "SPECIAL_EVENT"]);

export function schedulePrewarm(fromPhase: GamePhase, state: PublicState): void {
  try {
    // Appena compare la domanda si prepara la lettura delle risposte (ancora segrete per i client):
    // al "mostra risposte" la voce parte subito e il server ne conosce la durata esatta.
    if (state.phase === "QUESTION_VISIBLE" && fromPhase !== state.phase && state.question?.id && ttsConfigured() && !process.env.VITEST) {
      const sqId = state.question.id;
      after(async () => {
        try {
          await ensureOptionsClip(sqId);
        } catch (e) {
          console.warn("[quizzone] pre-riscaldamento lettura risposte non riuscito", e instanceof Error ? e.message : e);
        }
      });
      return;
    }
    if (!ttsConfigured() || process.env.VITEST || !PREWARM_PHASES.has(state.phase) || fromPhase === state.phase) return;
    // readOptions non incide sulle fasi pre-riscaldate
    // a fine serata anche tutte le battute del podio (le dice il TV durante la rivelazione)
    const lines = state.phase === "FINISHED" ? podiumLines(standingsForShow(state), state.sessionId) : speechFor(state, { phase: fromPhase }, { readOptions: true });
    if (lines.length === 0) return;
    after(async () => {
      try {
        const db = getSql();
        const cfg = await loadVoiceConfig(db);
        const plans = lines.map((l) => planClip(cfg, l)).filter((p) => p !== null);
        const cached = await cachedKeys(db, plans.map((p) => p.key));
        await Promise.allSettled(plans.filter((p) => !cached.has(p.key)).map((p) => ensureClip(db, p, p.live ? "live" : "pregen", cfg)));
      } catch (e) {
        console.warn("[quizzone] pre-riscaldamento voci non riuscito", e instanceof Error ? e.message : e);
      }
    });
  } catch {
    // fuori da una richiesta (script, test) o errore imprevisto: nessun pre-riscaldamento
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
