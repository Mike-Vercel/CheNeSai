import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { createQuestion, listQuestions } from "@/lib/server/cms/questions";

export const GET = adminRoute("admin", async ({ url }) => {
  const p = url.searchParams;
  return ok(
    await listQuestions({
      search: p.get("q") || undefined,
      category: p.get("category") || undefined,
      status: p.get("status") || undefined,
      type: p.get("type") || undefined,
      tag: p.get("tag") || undefined,
      difficulty: p.get("difficulty") ? Number(p.get("difficulty")) : undefined,
      includeArchived: p.get("archived") === "1",
      limit: p.get("limit") ? Number(p.get("limit")) : 50,
      offset: p.get("offset") ? Number(p.get("offset")) : 0,
    }),
  );
});

export const POST = adminRoute("admin", async ({ req, admin }) =>
  ok({ question: await createQuestion(await req.json(), admin) }, { status: 201 }),
);
