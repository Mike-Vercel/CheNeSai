import { adminRoute } from "@/lib/admin-route";
import { exportQuestions, exportQuestionsCsv } from "@/lib/server/cms/questions";

export const GET = adminRoute("admin", async ({ url }) => {
  const p = url.searchParams;
  const filters = { category: p.get("category") || undefined, status: p.get("status") || undefined, search: p.get("q") || undefined };
  const stamp = new Date().toISOString().slice(0, 10);
  if (p.get("format") === "csv") {
    return new Response(await exportQuestionsCsv(filters), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"quizzone-domande-" + stamp + ".csv\"",
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(JSON.stringify(await exportQuestions(filters), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"quizzone-domande-" + stamp + ".json\"",
      "Cache-Control": "no-store",
    },
  });
});
