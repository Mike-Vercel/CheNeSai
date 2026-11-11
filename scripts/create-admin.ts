/**
 * Crea (o aggiorna) un amministratore.
 *   npm run admin:create -- <email> <password> "<Nome>" [super_admin|admin|operator]
 * Usa SUPABASE_SECRET_KEY e DATABASE_URL dall'ambiente (.env.local in locale).
 */
import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

async function main() {
  const [email, argPassword, name = "Amministratore", role = "super_admin"] = process.argv.slice(2);
  // la password può arrivare anche da ADMIN_PASSWORD (così non compare nella riga di comando)
  const password = argPassword && argPassword !== "-" ? argPassword : (process.env.ADMIN_PASSWORD ?? "");
  if (!email || !password) {
    console.error('Uso: npm run admin:create -- <email> <password> "<Nome>" [super_admin|admin|operator]');
    process.exit(1);
  }
  if (!["super_admin", "admin", "operator"].includes(role)) throw new Error("Ruolo non valido");
  if (password.length < 10) throw new Error("La password deve avere almeno 10 caratteri");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    let userId: string | null = null;
    const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.data.user) userId = created.data.user.id;
    else {
      const [existing] = await sql<{ id: string }[]>`select id from auth.users where email = ${email.toLowerCase()}`;
      if (!existing) throw new Error(created.error?.message ?? "Creazione utente non riuscita");
      userId = existing.id;
      const upd = await supabase.auth.admin.updateUserById(userId, { password });
      if (upd.error) throw upd.error;
    }
    await sql`
      insert into admin_users (user_id, email, display_name, role) values (${userId}, ${email.toLowerCase()}, ${name}, ${role})
      on conflict (user_id) do update set display_name = excluded.display_name, role = excluded.role, active = true`;
    await sql`
      insert into admin_audit_logs (actor, actor_email, action, target_type, target_id, details)
      values (null, 'cli', 'admin.create_cli', 'admin_user', ${userId}, ${sql.json({ email, role })})`;
    console.log(`✔ Amministratore pronto: ${email} (${role})`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
