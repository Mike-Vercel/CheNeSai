import type { Db } from "@/lib/database/db";
import type { Actor } from "./engine";

export async function audit(
  db: Db,
  actor: Actor,
  action: string,
  target: { sessionId?: string | null; type?: string; id?: string | null; details?: Record<string, unknown> } = {},
): Promise<void> {
  await db`
    insert into admin_audit_logs (actor, actor_email, action, session_id, target_type, target_id, details, ip)
    values (${actor.userId}, ${actor.email}, ${action}, ${target.sessionId ?? null}, ${target.type ?? null}, ${target.id ?? null},
            ${db.json(JSON.parse(JSON.stringify(target.details ?? {})))}, ${actor.ip ?? null})`;
}

export class CmsError extends Error {
  readonly status: number;
  readonly details?: unknown;
  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "CmsError";
    this.status = status;
    this.details = details;
  }
}
