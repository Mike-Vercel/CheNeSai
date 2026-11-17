/**
 * TAVOLI IN GUERRA! — SERATA DIMOSTRATIVA IN LOCALE (mai in produzione: si rifiuta se il database non è locale).
 *
 *   npm run tig:demo                 → 8 tavoli finti in lobby: dalla regia premi VIA
 *   npm run tig:demo -- 24           → 24 tavoli (oltre 12 le mascotte si ripetono)
 *   npm run tig:demo -- 12 --via     → parte subito
 *
 * - L'account della regia è TIG_DEMO_EMAIL / TIG_DEMO_PASSWORD in .env.local (creati e scritti lì la prima volta).
 * - Un account finto per tavolo entra dal QR, sceglie il nome della squadra (elenco fisso), la regia lo convalida.
 * - Resta acceso: durante ogni prova i tavoli finti rispondono da soli (gli invii di prova della meccanica), in un
 *   momento a caso della prova; le scadenze avanzano anche senza TV aperta. La regia la fai tu dal browser.
 *   Ctrl+C per fermare (la serata resta: la chiudi dalla regia).
 */
import { config } from "dotenv";
import { appendFileSync, readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const TEAM_NAMES = [
  "Le Volpi", "I Lupi", "Gli Orsi", "Spritz Brigade", "Brindisi Tattici", "I Senza Idea", "Birra e Bluff", "I Calcolatori",
  "Le Menti del Pub", "Squadra Corse", "Gli Imbattibili", "I Diplomatici", "La Vecchia Guardia", "Negroni Sbagliati",
  "Tavolo del Caos", "Le Zanzare", "I Filosofi del Bar", "Mai una Gioia", "Quelli di Passaggio", "La Rimonta",
  "I Ritardatari", "Gin Tonic Club", "Le Patatine", "Ultima Fila",
];
const NICKS = ["Ale", "Bea", "Carlo", "Dani", "Elia", "Fede", "Gio", "Ila", "Luca", "Marta", "Nico", "Olga", "Paolo", "Rita", "Sara", "Teo", "Ugo", "Vale", "Willy", "Zoe", "Anna", "Bruno", "Cate", "Dario"];

function isLocal(url: string | undefined): boolean {
  return !!url && /@(127\.0\.0\.1|localhost)[:/]/.test(url);
}

function demoCredentials(): { email: string; password: string } {
  let email = process.env.TIG_DEMO_EMAIL;
  let password = process.env.TIG_DEMO_PASSWORD;
  if (!email || !password) {
    email = "regia-demo@tavoli.local";
    password = `Demo-${randomBytes(9).toString("base64url")}`;
    const env = readFileSync(".env.local", "utf8");
    appendFileSync(".env.local", `${env.endsWith("\n") ? "" : "\n"}# TAVOLI IN GUERRA! — account della regia per la serata dimostrativa (solo database locale)\nTIG_DEMO_EMAIL=${email}\nTIG_DEMO_PASSWORD=${password}\n`);
    console.log("Account della regia demo creato e salvato in .env.local (TIG_DEMO_EMAIL / TIG_DEMO_PASSWORD).");
  }
  return { email, password };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** frazione stabile 0..1 da una stringa (ritmo delle risposte dei tavoli finti) */
const frac = (s: string) => parseInt(createHash("sha256").update(s).digest("hex").slice(0, 8), 16) / 0xffffffff;

async function main() {
  if (!isLocal(process.env.DATABASE_URL) || !/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
    console.error("Rifiutato: la serata dimostrativa si crea solo sul database LOCALE (npm run db:start).");
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const tables = Math.min(24, Math.max(2, Number(args.find((a) => /^\d+$/.test(a)) ?? 8)));
  const via = args.includes("--via");

  // moduli del server dopo aver letto .env.local
  const { createEvent, joinEvent } = await import("../../src/lib/server/tig/events");
  const { runAction, SYSTEM_ACTOR } = await import("../../src/lib/server/tig/engine");
  const { loadGame, phaseCtx, gameStage } = await import("../../src/lib/server/tig/state");
  const { MECHANIC_EXTRAS, mechanicByCode } = await import("../../src/lib/tig/games");
  const { getSql } = await import("../../src/lib/database/db");

  const sql = getSql();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const direct = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, onnotice: () => {} });

  async function ensureUser(email: string, password: string, username: string): Promise<string> {
    const c = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    let id = c.data.user?.id ?? null;
    if (!id) {
      const [u] = await direct<{ id: string }[]>`select id from auth.users where email = ${email.toLowerCase()}`;
      if (!u) throw new Error(c.error?.message ?? `utente ${email} non creato`);
      id = u.id;
      const upd = await admin.auth.admin.updateUserById(id, { password });
      if (upd.error) throw upd.error;
    }
    await direct`insert into host_profiles (user_id, username) values (${id}, ${username}) on conflict do nothing`;
    return id;
  }

  // ------------------------------------------------------------------ regia e tavoli finti
  const cred = demoCredentials();
  const orgId = await ensureUser(cred.email, cred.password, "regia_demo");
  const org = { userId: orgId, ip: null, username: "regia_demo" };
  const bots: { userId: string; nick: string; team: string }[] = [];
  for (let n = 1; n <= tables; n++) {
    const id = await ensureUser(`tavolo-demo-${String(n).padStart(2, "0")}@tavoli.local`, `Bot-${randomBytes(12).toString("base64url")}`, `tavolo_demo_${n}`);
    bots.push({ userId: id, nick: NICKS[n - 1], team: TEAM_NAMES[n - 1] });
  }

  const { eventId } = await createEvent(org, { venue: "Pub Dimostrazione", tables, durationMin: 115, accessMode: "qr", mascotUnique: tables <= 12 });
  await runAction(eventId, org, { action: "open_lobby" });
  const rows = await sql<{ table_no: number; qr_token: string }[]>`select table_no, qr_token from tig_tables where event_id = ${eventId} order by table_no`;
  for (const t of rows) {
    const b = bots[t.table_no - 1];
    const { teamId } = await joinEvent({ userId: b.userId, ip: null, username: null }, { token: t.qr_token, nickname: b.nick, teamName: b.team });
    await runAction(eventId, org, { action: "approve_team", teamId, approved: true });
    await runAction(eventId, org, { action: "assign_mascot", teamId, slot: ((t.table_no - 1) % 12) + 1 });
  }
  const [ev] = await sql<{ display_key: string }[]>`select display_key from tig_events where id = ${eventId}`;
  if (via) await runAction(eventId, org, { action: "start" });

  const site = process.env.TIG_DEMO_SITE ?? "http://localhost:3410";
  console.log(`\nSerata dimostrativa pronta: ${tables} tavoli${via ? ", già partita" : ", in lobby"}.`);
  console.log(`  Regia: ${site}/tavoli-in-guerra/regia/${eventId}   (entra con l'account della regia demo)`);
  console.log(`  TV:    ${site}/tavoli-in-guerra/tv/${ev.display_key}`);
  console.log("I tavoli finti rispondono da soli durante le prove. Ctrl+C per fermare.\n");

  // ------------------------------------------------------------------ i tavoli finti giocano
  const sent = new Set<string>();
  for (;;) {
    try {
      const [e] = await sql<{ state: string; status: string; current_game_id: string | null; phase_deadline_at: Date | null; now: Date }[]>`
        select state, status, current_game_id, phase_deadline_at, now() as now from tig_events where id = ${eventId}`;
      if (!e || e.status === "closed" || e.state === "COMPLETED" || e.state === "CANCELLED") {
        console.log("Serata conclusa: fine della dimostrazione.");
        break;
      }
      const now = e.now.getTime();
      // le scadenze avanzano anche senza TV aperta
      if (e.phase_deadline_at && now >= e.phase_deadline_at.getTime() && e.state !== "PAUSED") await runAction(eventId, SYSTEM_ACTOR, { action: "tick" }).catch(() => undefined);
      if (e.state === "GAME_ACTIVE" && e.current_game_id) {
        const g = await loadGame(sql, e.current_game_id);
        const def = g ? mechanicByCode(g.mechanic_code) : undefined;
        const extras = g ? MECHANIC_EXTRAS[g.mechanic_code] : undefined;
        if (g && def && extras && g.status === "active" && gameStage(g, now) === "play") {
          const ctx = phaseCtx(g);
          const total = Math.max(1, g.deadline_at.getTime() - g.starts_at.getTime());
          const demo = extras.demoSubmissions(g.content, ctx, g.seed);
          for (const s of demo) {
            const key = `${g.id}:${s.teamId}:${s.memberId}`;
            if (sent.has(key) || !ctx.participants.includes(s.teamId)) continue;
            // ogni tavolo risponde tra il 25% e l'80% del tempo
            const at = g.starts_at.getTime() + total * (0.25 + 0.55 * frac(key));
            if (now < at) continue;
            sent.add(key);
            const [m] = await sql<{ user_id: string }[]>`select user_id from tig_members where id = ${s.memberId}`;
            if (!m) continue;
            await runAction(eventId, { userId: m.user_id, ip: null }, { action: "submit", gameId: g.id, payload: s.payload, idempotencyKey: `demo-${key}`.slice(0, 80) }).catch((err: unknown) => {
              console.warn(`  tavolo finto: invio rifiutato (${g.mechanic_code}): ${err instanceof Error ? err.message : err}`);
            });
          }
        }
      }
    } catch (err) {
      console.warn("  (dimostrazione) errore temporaneo:", err instanceof Error ? err.message : err);
    }
    await sleep(1000);
  }
  await direct.end();
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
