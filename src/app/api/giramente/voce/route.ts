import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { optionalGiramenteUser } from "@/lib/server/giramente/auth";
import { GiramenteError } from "@/lib/server/giramente/errors";
import { giramenteVoicesStatus, giramenteVoiceUrl } from "@/lib/server/giramente/voice";

export const maxDuration = 30;

/** Voci configurate? (nessun segreto: solo sì/no) */
export const GET = route(async () => ok({ voices: giramenteVoicesStatus() }));

const schema = z.object({
  roomId: z.uuid().optional(),
  key: z.string().regex(/^[A-Za-z0-9_-]{24,64}$/).optional(),
  line: z.string().regex(/^[a-z0-9-]{2,40}$/),
  competitorId: z.uuid().nullish(),
  points: z.number().int().min(0).max(100000).nullish(),
  roundNo: z.number().int().min(1).max(5).nullish(),
});

/**
 * Battuta di Don Patrizio o Zafira: { url } dell'mp3 (null se la voce non è configurata: sottotitolo).
 * Solo per i membri della partita o per lo schermo con la sua chiave.
 */
export const POST = route(async (req: Request) => {
  const body = await readJson(req, schema);
  const sql = getSql();
  let roomId: string | null = null;
  if (body.key) {
    const [r] = await sql<{ id: string }[]>`select id from giramente_rooms where display_key = ${body.key} and status = 'open'`;
    roomId = r?.id ?? null;
  } else if (body.roomId) {
    const user = await optionalGiramenteUser();
    if (user) {
      const [r] = await sql<{ id: string }[]>`
        select r.id from giramente_rooms r where r.id = ${body.roomId} and r.status = 'open'
          and (r.owner_user_id = ${user.userId} or exists (select 1 from giramente_participants p where p.room_id = r.id and p.user_id = ${user.userId} and p.status = 'active'))`;
      roomId = r?.id ?? null;
    }
  }
  if (!roomId) throw new GiramenteError("FORBIDDEN", "Voce riservata ai giocatori della partita");
  return ok(await giramenteVoiceUrl(roomId, { line: body.line, competitorId: body.competitorId, points: body.points, roundNo: body.roundNo }));
});
