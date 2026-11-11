import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { csvToImportPayload, importQuestions } from "@/lib/server/cms/questions";

/**
 * Importazione da JSON (formato "quizzone-questions") o CSV.
 * ?dry=1 valida senza salvare. Le domande importate restano bozze con
 * risposta da confermare.
 */
export const POST = adminRoute("admin", async ({ req, admin, url }) => {
  const dry = url.searchParams.get("dry") === "1";
  const type = req.headers.get("content-type") ?? "";
  const payload = type.includes("text/csv") || type.includes("text/plain") ? csvToImportPayload(await req.text()) : await req.json();
  return ok(await importQuestions(payload, admin, dry));
});
