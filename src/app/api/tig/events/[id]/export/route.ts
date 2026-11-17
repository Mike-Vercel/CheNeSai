import { route } from "@/lib/http";
import { requireTigUser } from "@/lib/server/tig/auth";
import { exportCsv } from "@/lib/server/tig/events";

/** Risultati in CSV (solo organizzatore): `?tipo=classifica` (predefinito) o `?tipo=registro` (ogni voce di punti). */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireTigUser();
  const kind = new URL(req.url).searchParams.get("tipo") === "registro" ? "registro" : "classifica";
  const { filename, body } = await exportCsv(user, id, kind);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
