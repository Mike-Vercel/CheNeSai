import { adminRoute } from "@/lib/admin-route";
import { exportSessionBackup } from "@/lib/server/cms/stats";
import { audit } from "@/lib/server/audit";
import { getSql } from "@/lib/database/db";

/** Esportazione completa della sessione in JSON (backup / archivio). */
export const GET = adminRoute<{ id: string }>("admin", async ({ admin, params }) => {
  const data = await exportSessionBackup(params.id);
  await audit(getSql(), admin, "session.backup", { sessionId: params.id, type: "session", id: params.id });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"quizzone-sessione-" + params.id + ".json\"",
      "Cache-Control": "no-store",
    },
  });
});
