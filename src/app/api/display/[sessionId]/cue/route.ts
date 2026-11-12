import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { fail, ok, readJson, route } from "@/lib/http";
import { verifyDisplayKey } from "@/lib/server/display";
import { buildPublicState } from "@/lib/server/public-state";
import { broadcastState } from "@/lib/server/realtime";

export const maxDuration = 30;

const bodySchema = z.object({ questionId: z.string().uuid(), cue: z.enum(["question", "answer"]) });

/**
 * Il TV (chiave schermo) segnala un momento visto da tutti, così i telefoni dei giocatori lo mostrano
 * nello stesso istante:
 *  - "question": la domanda è comparsa sul TV (dopo il cartello "DOMANDA N. X");
 *  - "answer": la risposta giusta si è illuminata (dopo "La risposta giusta è…").
 * Idempotente: ripetere lo stesso segnale non cambia nulla e non rimanda lo stato.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  const sql = getSql();
  if (!(await verifyDisplayKey(sql, sessionId, new URL(req.url).searchParams.get("k")))) {
    return fail(403, "BAD_DISPLAY_KEY", "Chiave schermo non valida");
  }
  const { questionId, cue } = await readJson(req, bodySchema);
  const changed =
    cue === "question"
      ? await sql`
          insert into tv_presence (session_id, question_shown_id, seen_at)
          values (${sessionId}, ${questionId}, now())
          on conflict (session_id) do update set question_shown_id = excluded.question_shown_id, seen_at = now()
          where tv_presence.question_shown_id is distinct from excluded.question_shown_id
          returning 1`
      : await sql`
          insert into tv_presence (session_id, revealed_question_id, seen_at)
          values (${sessionId}, ${questionId}, now())
          on conflict (session_id) do update set revealed_question_id = excluded.revealed_question_id, seen_at = now()
          where tv_presence.revealed_question_id is distinct from excluded.revealed_question_id
          returning 1`;
  if (changed.length > 0) {
    const st = await buildPublicState(sql, sessionId);
    if (st) await broadcastState(sql, st).catch(() => undefined);
  }
  return ok({ ok: true });
});
