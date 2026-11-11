import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { z } from "zod";
import { confirmAnswer, duplicateQuestion, setQuestionStatus } from "@/lib/server/cms/questions";

/** Azioni rapide: duplica, conferma risposta (e approva), cambia stato. */
export const POST = adminRoute<{ id: string }>("admin", async ({ req, admin, params }) => {
  const { action } = z
    .object({ action: z.enum(["duplicate", "confirm", "confirm_approve", "approve", "draft", "archive"]) })
    .parse(await req.json());
  switch (action) {
    case "duplicate":
      return ok({ question: await duplicateQuestion(params.id, admin) }, { status: 201 });
    case "confirm":
      await confirmAnswer(params.id, false, admin);
      break;
    case "confirm_approve":
      await confirmAnswer(params.id, true, admin);
      break;
    case "approve":
      await setQuestionStatus(params.id, "approved", admin);
      break;
    case "draft":
      await setQuestionStatus(params.id, "draft", admin);
      break;
    case "archive":
      await setQuestionStatus(params.id, "archived", admin);
      break;
  }
  return ok({ ok: true });
});
