/**
 * Importa nella tabella dialogue_templates le battute di content/show/battute.json
 * che non ci sono ancora (le battute già presenti, anche se modificate dalla regia, non vengono toccate).
 *   npx tsx --conditions=react-server scripts/import-battute.ts
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { getSql } = await import("../src/lib/database/db");
  const { importLibrary, readLibraryFile } = await import("../src/lib/server/show");
  const lines = readLibraryFile();
  const sql = getSql();
  const added = await importLibrary(sql, lines);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from dialogue_templates`;
  console.log(`✔ battute valide nel file: ${lines.length} · nuove importate: ${added} · totale in archivio: ${n}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
