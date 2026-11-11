import "server-only";
import { headers } from "next/headers";
import { getSql } from "@/lib/database/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Actor } from "@/lib/server/engine";

export type AdminRole = "operator" | "admin" | "super_admin";
const RANK: Record<AdminRole, number> = { operator: 10, admin: 20, super_admin: 30 };

export interface AdminContext extends Actor {
  userId: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

export class AuthError extends Error {
  readonly status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Utente admin corrente (sessione Supabase Auth verificata col server Auth). */
export async function getAdmin(): Promise<AdminContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const sql = getSql();
  const [row] = await sql<{ email: string; display_name: string; role: AdminRole; active: boolean }[]>`
    select email, display_name, role, active from admin_users where user_id = ${data.user.id}`;
  if (!row || !row.active) return null;
  return {
    userId: data.user.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    ip: await clientIp(),
  };
}

/**
 * Autorizzazione applicata dal backend su ogni endpoint admin.
 * - minRole: ruolo minimo richiesto
 * - sessionId: per gli operatori, la sessione deve essere loro assegnata
 */
export async function requireAdmin(minRole: AdminRole, opts: { sessionId?: string } = {}): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) throw new AuthError(401, "Accesso amministratore richiesto");
  if (RANK[admin.role] < RANK[minRole]) throw new AuthError(403, "Permessi insufficienti per questa operazione");
  if (admin.role === "operator" && opts.sessionId) {
    const [row] = await getSql()`select 1 from session_operators where session_id = ${opts.sessionId} and user_id = ${admin.userId}`;
    if (!row) throw new AuthError(403, "Questa sessione non è assegnata al tuo account operatore");
  }
  return admin;
}

export function hasRole(role: AdminRole, min: AdminRole): boolean {
  return RANK[role] >= RANK[min];
}
