import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { getSql } from "@/lib/database/db";
import { fail } from "@/lib/http";
import { getMedia, signedMediaUrl, updateMedia } from "@/lib/server/cms/media";

type P = { id: string };

/** Dettaglio + URL firmato temporaneo per anteprima in regia. */
export const GET = adminRoute<P>("operator", async ({ params }) => {
  const sql = getSql();
  const m = await getMedia(sql, params.id);
  if (!m) return fail(404, "NOT_FOUND", "Media non trovato");
  return ok({ media: m, url: await signedMediaUrl(sql, params.id, 900) });
});

export const PATCH = adminRoute<P>("admin", async ({ req, admin, params }) =>
  ok({ media: await updateMedia(params.id, await req.json(), admin) }),
);
