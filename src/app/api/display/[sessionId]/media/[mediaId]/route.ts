import { NextResponse } from "next/server";
import { getSql } from "@/lib/database/db";
import { fail, route } from "@/lib/http";
import { verifyDisplayKey } from "@/lib/server/display";
import { signedMediaUrl } from "@/lib/server/cms/media";

/** Media per il TV (incluso l'audio), solo se appartengono alle domande della sessione. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ sessionId: string; mediaId: string }> }) => {
  const { sessionId, mediaId } = await ctx.params;
  const sql = getSql();
  if (!(await verifyDisplayKey(sql, sessionId, new URL(req.url).searchParams.get("k")))) {
    return fail(403, "BAD_DISPLAY_KEY", "Chiave schermo non valida");
  }
  if (!/^[0-9a-f-]{36}$/.test(mediaId)) return fail(404, "NOT_FOUND", "Media non trovato");
  const [m] = await sql`select 1 from question_snapshots where session_id = ${sessionId} and media_id = ${mediaId} limit 1`;
  if (!m) return fail(404, "NOT_FOUND", "Media non presente nella sessione");
  const url = await signedMediaUrl(sql, mediaId, 3600);
  if (!url) return fail(404, "NOT_FOUND", "Media non trovato");
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=1800" } });
});
