import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { z } from "zod";
import { listMedia, registerMedia } from "@/lib/server/cms/media";
import type { MediaKind } from "@/lib/game-engine/types";

export const GET = adminRoute("admin", async ({ url }) => {
  const p = url.searchParams;
  const kind = p.get("kind");
  return ok({
    media: await listMedia({
      kind: kind === "image" || kind === "audio" || kind === "video" ? (kind as MediaKind) : undefined,
      search: p.get("q") || undefined,
      category: p.get("category") || undefined,
      includeArchived: p.get("archived") === "1",
    }),
  });
});

/** Registra un file già caricato con l'URL firmato. */
export const POST = adminRoute("admin", async ({ req, admin }) => {
  const body = z.object({ path: z.string().min(5).max(200), meta: z.unknown() }).parse(await req.json());
  return ok({ media: await registerMedia(body.path, body.meta, admin) }, { status: 201 });
});
