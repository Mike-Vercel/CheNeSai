/**
 * Backup logico del database applicativo (schema public) in JSON.
 *   npm run db:backup                 → backups/quizzone-<data>.json
 *   npm run db:backup -- --session <id> → solo una sessione
 *
 * È un complemento ai backup automatici di Supabase (piano Pro: giornalieri
 * + Point-in-Time Recovery). Per un dump SQL completo usare:
 *   npx supabase db dump --db-url "$DATABASE_URL" -f backup.sql --data-only
 * Ripristino: vedi docs/OPERATIONS.md.
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

const TABLES = [
  "admin_roles", "admin_users", "application_settings", "seasons", "media_assets", "question_bank", "question_options",
  "special_event_definitions", "game_sessions", "session_operators", "game_rounds", "category_vote_options",
  "session_questions", "question_snapshots", "player_identities", "participants", "answer_submissions",
  "answer_selected_options", "score_events", "score_totals", "game_state", "game_events", "special_events",
  "category_votes", "leaderboards", "admin_audit_logs", "security_events",
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const idx = process.argv.indexOf("--session");
  const sessionId = idx >= 0 ? process.argv[idx + 1] : null;
  const out: Record<string, unknown> = { format: "quizzone-backup", version: 1, createdAt: new Date().toISOString(), sessionId };
  try {
    for (const t of TABLES) {
      if (sessionId) {
        const cols = await sql<{ column_name: string }[]>`
          select column_name from information_schema.columns where table_schema = 'public' and table_name = ${t}`;
        const names = cols.map((c) => c.column_name);
        if (names.includes("session_id")) out[t] = await sql`select * from ${sql(t)} where session_id = ${sessionId}`;
        else if (t === "game_sessions") out[t] = await sql`select * from game_sessions where id = ${sessionId}`;
        continue;
      }
      // i token dei giocatori sono hash: non contengono segreti riutilizzabili
      out[t] = await sql`select * from ${sql(t)}`;
    }
    mkdirSync("backups", { recursive: true });
    const file = path.join("backups", `quizzone-${sessionId ? `sessione-${sessionId}-` : ""}${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`✔ Backup salvato in ${file}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("✖", e);
  process.exit(1);
});
