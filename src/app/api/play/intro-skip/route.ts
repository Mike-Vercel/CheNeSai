import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { authenticatePlayer } from "@/lib/server/players";
import { readPlayerToken } from "@/lib/server/player-cookies";
import { voteIntroSkip } from "@/lib/server/intro-skip";

const bodySchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/),
  skip: z.boolean(),
  slot: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
});

/** "Salta intro" dal telefono: voto (skip = true) o ritiro del voto. Si salta solo se votano tutti. */
export const POST = route(async (req: Request) => {
  const body = await readJson(req, bodySchema);
  const auth = await authenticatePlayer(getSql(), body.code, await readPlayerToken(body.code, body.slot));
  return ok(await voteIntroSkip(auth, body.skip));
});
