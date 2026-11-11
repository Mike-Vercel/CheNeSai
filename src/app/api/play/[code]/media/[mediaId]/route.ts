import { NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { fail, route } from "@/lib/http";
import { signedMediaUrl } from "@/lib/server/cms/media";
import { QUESTION_PHASES, visualPhase } from "@/lib/server/public-state";
import type { GamePhase } from "@/lib/game-engine/types";

/**
 * Immagini/video per gli smartphone: disponibili SOLO quando la domanda che
 * li contiene è visibile. L'audio si serve ai telefoni solo con lo show sul
 * telefono (altrimenti si sente dall'impianto del pub).
 */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ code: string; mediaId: string }> }) => {
  const { code, mediaId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(mediaId)) return fail(404, "NOT_FOUND", "Media non trovato");
  const sql = getSql();
  const [row] = await sql<{ phase: GamePhase; paused_from_phase: GamePhase | null; kind: string; display_mode: string }[]>`
    select gs.phase, gs.paused_from_phase, qs.media_kind::text as kind, s.display_mode
    from game_sessions s
    join game_state gs on gs.session_id = s.id
    join question_snapshots qs on qs.session_question_id = gs.current_session_question_id
    where s.code = ${code.toUpperCase()} and qs.media_id = ${mediaId}`;
  // l'audio delle domande si sente dal TV; con lo show sul telefono, da ogni telefono
  if (!row || !QUESTION_PHASES.includes(visualPhase(row)) || (row.kind === "audio" && row.display_mode !== "phone")) {
    return fail(404, "NOT_AVAILABLE", "Contenuto non disponibile");
  }
  const url = await signedMediaUrl(sql, mediaId, 600);
  if (!url) return fail(404, "NOT_FOUND", "Media non trovato");
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=300" } });
});
