import { z } from "zod";
import { clientIp } from "@/lib/auth/admin";
import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { GiocoError } from "@/lib/server/gioco-errors";
import { createHostProfile, getHostUser, isUsernameAvailable, requireHostUser } from "@/lib/server/gioco-libero";
import { checkRateLimit } from "@/lib/server/players";

/** GET ?u=nome → disponibilità dello username (controllo dal vivo nel modulo di registrazione). */
export const GET = route(async (req: Request) => {
  const u = new URL(req.url).searchParams.get("u") ?? "";
  const sql = getSql();
  if (!(await checkRateLimit(sql, `username-check:${(await clientIp()) ?? "unknown"}`, 120, 60))) {
    throw new GiocoError("RATE_LIMITED", "Troppi controlli: riprova tra qualche secondo");
  }
  const me = await getHostUser().catch(() => null);
  return ok(await isUsernameAvailable(sql, u, me?.userId ?? null));
});

const bodySchema = z.object({ username: z.string().max(40), displayName: z.string().max(60).nullable().optional() });

/** POST { username } → crea il profilo dell'account collegato (es. dopo il primo accesso con Google). */
export const POST = route(async (req: Request) => {
  const host = await requireHostUser(await clientIp());
  const body = await readJson(req, bodySchema);
  if (!(await checkRateLimit(getSql(), `username-set:${host.userId}`, 20, 600))) {
    throw new GiocoError("RATE_LIMITED", "Troppi tentativi: riprova tra qualche minuto");
  }
  const profile = await createHostProfile(getSql(), host.userId, body.username, body.displayName ?? null);
  return ok({ profile }, { status: 201 });
});
