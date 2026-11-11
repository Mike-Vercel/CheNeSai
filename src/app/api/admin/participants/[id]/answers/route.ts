import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { participantAnswers } from "@/lib/server/cms/admin";

export const GET = adminRoute<{ id: string }>("operator", async ({ params }) => ok({ answers: await participantAnswers(params.id) }));
