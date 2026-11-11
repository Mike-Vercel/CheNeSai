import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { z } from "zod";
import { createUploadUrl } from "@/lib/server/cms/media";

export const POST = adminRoute("admin", async ({ req }) => {
  const body = z.object({ mimeType: z.string().min(3).max(100), sizeBytes: z.number().int().positive() }).parse(await req.json());
  return ok(await createUploadUrl(body.mimeType, body.sizeBytes));
});
