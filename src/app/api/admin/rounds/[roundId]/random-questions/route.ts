import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { addRandomQuestionsToRound } from "@/lib/server/cms/compose";

export const maxDuration = 30;

/** "Aggiungi domande casuali": stesse priorità della serata rapida (prima le mai giocate). */
export const POST = adminRoute<{ roundId: string }>("admin", async ({ req, admin, params }) =>
  ok(await addRandomQuestionsToRound(params.roundId, await req.json().catch(() => ({})), admin), { status: 201 }),
);
