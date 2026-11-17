import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { optionalTigUser } from "@/lib/server/tig/auth";
import { TigError } from "@/lib/server/tig/errors";
import { loadVoiceCatalog, tigVoicesStatus, tigVoiceUrl } from "@/lib/server/tig/voice";

export const maxDuration = 30;

/** Catalogo delle battute (non segreto: serve ai sottotitoli) e quali personaggi hanno una voce configurata. */
export const GET = route(async () => ok({ files: await loadVoiceCatalog(), voices: await tigVoicesStatus() }));

const n = (max: number) => z.number().int().min(0).max(max).nullish();
const schema = z.object({
  eventId: z.uuid().optional(),
  key: z.string().regex(/^[A-Za-z0-9_-]{24,64}$/).optional(),
  characterId: z.string().regex(/^[a-z0-9-]{2,40}$/),
  lineId: z.string().regex(/^[A-Za-z0-9_-]{2,80}$/),
  // solo numeri: il server compone il testo («il tavolo 3», nome curato della mascotte), mai testo libero
  vars: z
    .object({ tavoloA: n(60), tavoloB: n(60), mascotA: n(12), mascotB: n(12), punti: n(100000), manche: n(5), secondi: n(600), posizione: n(60), minigioco: z.string().max(60).nullish() })
    .default({}),
});

/** Sintesi di una battuta (solo per la TV con la sua chiave o per chi è nella serata). url null = solo sottotitolo. */
export const POST = route(async (req: Request) => {
  const body = await readJson(req, schema);
  const sql = getSql();
  let eventId: string | null = null;
  if (body.key) {
    const [r] = await sql<{ id: string }[]>`select id from tig_events where display_key = ${body.key} and status = 'open'`;
    eventId = r?.id ?? null;
  } else if (body.eventId) {
    const user = await optionalTigUser();
    if (user) {
      const [r] = await sql<{ id: string }[]>`
        select e.id from tig_events e where e.id = ${body.eventId} and e.status = 'open'
          and (e.owner_user_id = ${user.userId} or exists (select 1 from tig_members m where m.event_id = e.id and m.user_id = ${user.userId} and m.status = 'active'))`;
      eventId = r?.id ?? null;
    }
  }
  if (!eventId) throw new TigError("FORBIDDEN", "Voce riservata alla serata");
  // il titolo del minigioco lo prende il server dal registro (qui arriva solo il codice)
  const { mechanicOf } = await import("@/lib/server/tig/registry");
  const minigioco = body.vars.minigioco ? (mechanicOf(body.vars.minigioco)?.title ?? null) : null;
  return ok(await tigVoiceUrl(eventId, body.characterId, body.lineId, { ...body.vars, minigioco }));
});
