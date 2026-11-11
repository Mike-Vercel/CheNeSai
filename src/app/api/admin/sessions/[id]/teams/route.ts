import { adminRoute } from "@/lib/admin-route";
import { getSql } from "@/lib/database/db";
import { ok } from "@/lib/http";
import { createTeam, listTeams } from "@/lib/server/cms/teams";

type P = { id: string };

/** Squadre della serata (elenco per editor e regia). */
export const GET = adminRoute<P>("operator", async ({ params }) => ok({ teams: await listTeams(getSql(), params.id) }), { sessionParam: "id" });

export const POST = adminRoute<P>("admin", async ({ req, admin, params }) =>
  ok({ id: await createTeam(params.id, await req.json(), admin) }, { status: 201 }),
);
