import { z } from "zod";
import { adminRoute } from "@/lib/admin-route";
import { getSql } from "@/lib/database/db";
import { ok, readJson } from "@/lib/http";
import { loadDirectorConfig, saveDirectorConfig } from "@/lib/server/show";
import { SHOW_EVENT_TYPES } from "@/lib/show/types";

const schema = z.object({
  enabled: z.boolean().optional(),
  maxLines: z.number().int().min(0).max(3).optional(),
  maxMentionsPerPlayerPerRound: z.number().int().min(1).max(20).optional(),
  events: z.array(z.enum(SHOW_EVENT_TYPES)).optional(),
  banterPercent: z.number().int().min(0).max(100).optional(),
});

/** Regia automatica dei presentatori: lettura (anche operatori, per la diretta) e modifica (admin). */
export const GET = adminRoute("operator", async () => ok({ config: await loadDirectorConfig(getSql()) }));
export const PUT = adminRoute("operator", async ({ req }) => ok({ config: await saveDirectorConfig(getSql(), await readJson(req, schema)) }));
