import { NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { fail, route } from "@/lib/http";
import { signedMediaUrl } from "@/lib/server/cms/media";
import { authorizeLiveViewer, liveTokenParam } from "@/lib/server/live-view";
import { QUESTION_PHASES, visualPhase } from "@/lib/server/public-state";
import type { GamePhase } from "@/lib/game-engine/types";

/** Immagini, video e canzoni della domanda per la VISTA LIVE: solo mentre la domanda è in scena. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ sessionId: string; mediaId: string }> }) => {
  const { sessionId, mediaId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(mediaId)) return fail(404, "NOT_FOUND", "Media non trovato");
  const sql = getSql();
  const viewer = await authorizeLiveViewer(sql, sessionId, liveTokenParam(req));
  const [row] = await sql<{ phase: GamePhase; paused_from_phase: GamePhase | null; kind: string; display_mode: string }[]>`
    select gs.phase, gs.paused_from_phase, qs.media_kind::text as kind, s.display_mode
    from game_sessions s
    join game_state gs on gs.session_id = s.id
    join question_snapshots qs on qs.session_question_id = gs.current_session_question_id
    where s.id = ${sessionId} and qs.media_id = ${mediaId}`;
  // la canzone: dai dispositivi dei giocatori solo con lo show online (in salotto suona dal TV); l'host sempre
  if (!row || !QUESTION_PHASES.includes(visualPhase(row)) || (row.kind === "audio" && row.display_mode !== "phone" && viewer.kind !== "host" && !(viewer.kind === "token" && viewer.who === "h"))) {
    return fail(404, "NOT_AVAILABLE", "Contenuto non disponibile");
  }
  const url = await signedMediaUrl(sql, mediaId, 600);
  if (!url) return fail(404, "NOT_FOUND", "Media non trovato");
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=300" } });
});
