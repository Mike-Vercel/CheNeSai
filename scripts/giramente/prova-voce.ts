/**
 * GIRAMENTE!: prova della voce dinamica (una battuta con un nome) contro ElevenLabs.
 * Uso: npx tsx --conditions=react-server scripts/giramente/prova-voce.ts [id battuta, es. zafira-nome]
 * Serve una partita esistente nel database (usa l'ultima creata) e le variabili ELEVENLABS_* in .env.local.
 * Stampa solo l'esito (mai chiavi): sottotitolo e se l'mp3 è stato prodotto.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { getSql } = await import("@/lib/database/db");
  const { giramenteVoiceUrl, giramenteVoicesStatus } = await import("@/lib/server/giramente/voice");
  const sql = getSql();
  const [c] = await sql<{ room_id: string; id: string }[]>`select room_id, id from giramente_competitors order by created_at desc limit 1`;
  if (!c) throw new Error("Nessuna partita nel database: creane una");
  console.log("voci configurate:", giramenteVoicesStatus());
  const r = await giramenteVoiceUrl(c.room_id, { line: process.argv[2] || "turno-giocatore", competitorId: c.id });
  console.log("sottotitolo:", r.caption);
  console.log("mp3:", r.url ? "prodotto (URL firmato)" : "nessuno (solo sottotitolo)");
  await sql.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
