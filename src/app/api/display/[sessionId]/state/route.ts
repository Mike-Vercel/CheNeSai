import { getSql } from "@/lib/database/db";
import { fail, ok, route } from "@/lib/http";
import { verifyDisplayKey } from "@/lib/server/display";
import { buildPublicState } from "@/lib/server/public-state";
import { watchdogTick } from "@/lib/server/engine";
import { directLobbyGreeting } from "@/lib/server/show";
import { prewarmLines } from "@/lib/server/tts-prewarm";

/** Al massimo un controllo dei saluti ogni 2 s per serata (più TV o schede aperte non moltiplicano le query). */
const LOBBY_CHECK_MS = 2000;
const lastLobbyCheck = new Map<string, number>();
function lobbyCheckDue(sessionId: string): boolean {
  const now = Date.now();
  if (now - (lastLobbyCheck.get(sessionId) ?? 0) < LOBBY_CHECK_MS) return false;
  lastLobbyCheck.set(sessionId, now);
  if (lastLobbyCheck.size > 500) lastLobbyCheck.clear();
  return true;
}

export const GET = route(async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  const sql = getSql();
  if (!(await verifyDisplayKey(sql, sessionId, new URL(req.url).searchParams.get("k")))) {
    return fail(403, "BAD_DISPLAY_KEY", "Chiave schermo non valida");
  }
  let state = await buildPublicState(sql, sessionId);
  if (!state) return fail(409, "NOT_READY", "Sessione non pubblicata");
  // Lobby: il polling del TV è anche l'occasione per salutare i nuovi arrivati (vedi directLobbyGreeting).
  if (state.phase === "LOBBY" && lobbyCheckDue(sessionId)) {
    try {
      const line = await directLobbyGreeting(sql, sessionId);
      if (line) {
        prewarmLines([{ who: line.who, text: line.text, live: true }], sessionId);
        state = (await buildPublicState(sql, sessionId)) ?? state;
      }
    } catch (e) {
      console.warn("[quizzone] saluto della lobby non riuscito", e instanceof Error ? e.message : e);
    }
  }
  // passo automatico rimasto indietro (tick perso o appeso): lo si esegue in background
  watchdogTick(state);
  // Precaricamento: media delle prossime domande non ancora mostrate (solo TV).
  const nextMedia = await sql<{ id: string; kind: string }[]>`
    select qs.media_id as id, qs.media_kind::text as kind
    from session_questions sq join question_snapshots qs on qs.session_question_id = sq.id
    join game_rounds r on r.id = sq.round_id
    where sq.session_id = ${sessionId} and sq.shown_at is null and qs.media_id is not null
    order by r.position, sq.position limit 3`;
  return ok({ state, nextMedia });
});
