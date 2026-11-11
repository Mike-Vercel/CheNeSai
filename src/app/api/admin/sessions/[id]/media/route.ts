import { z } from "zod";
import { adminRoute } from "@/lib/admin-route";
import { getSql } from "@/lib/database/db";
import { fail, ok } from "@/lib/http";
import { audit } from "@/lib/server/audit";
import { broadcastMediaControl } from "@/lib/server/realtime";

/**
 * Controlli di riproduzione della manche musicale: la regia comanda il TV
 * (unico dispositivo che riproduce audio). Il media è sempre quello della
 * domanda corrente, deciso dal server.
 */
export const POST = adminRoute<{ id: string }>(
  "operator",
  async ({ req, admin, params }) => {
    const { action } = z.object({ action: z.enum(["play", "stop", "test-tone"]) }).parse(await req.json());
    const sql = getSql();
    const at = Date.now();
    if (action === "play") {
      const [m] = await sql<{ media_id: string; audio_start_ms: number; audio_duration_ms: number | null; audio_plays: number }[]>`
        select qs.media_id, qs.audio_start_ms, qs.audio_duration_ms, qs.audio_plays
        from game_state gs join question_snapshots qs on qs.session_question_id = gs.current_session_question_id
        where gs.session_id = ${params.id} and qs.media_kind in ('audio', 'video')`;
      if (!m) return fail(409, "NO_MEDIA", "La domanda corrente non ha un audio da riprodurre");
      await broadcastMediaControl(sql, params.id, { action: "play", mediaId: m.media_id, startMs: m.audio_start_ms, durationMs: m.audio_duration_ms, plays: 1, at });
    } else if (action === "stop") {
      await broadcastMediaControl(sql, params.id, { action: "stop", at });
    } else {
      await broadcastMediaControl(sql, params.id, { action: "test-tone", at });
    }
    await audit(sql, admin, `live.media_${action}`, { sessionId: params.id, type: "session", id: params.id });
    return ok({ ok: true });
  },
  { sessionParam: "id" },
);
