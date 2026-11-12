/**
 * Preparazione dell'e2e "sempre votazione, ruota e canzone" (lanciato con tsx --conditions=react-server):
 *   sempre-setup.ts prepare <out.json>  → account host di prova, archivio isolato (tag) con una
 *       canzone vera (estratto audio già nell'archivio locale), partita libera VERA da 10 domande in
 *       1 round creata come da /gioca (createPublicGame), show sui telefoni (verticale), lobby aperta.
 *   sempre-setup.ts start <in.json>     → parte il round (senza intro): da lì guida il TV (automatico).
 *   sempre-setup.ts song <in.json>      → in manuale, gioca fino alla canzone e la mostra; poi di nuovo
 *       automatico: il TV legge, fa sentire l'estratto e solo dopo apre le risposte.
 *   sempre-setup.ts cleanup <in.json>   → elimina account, partite e domande di prova.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

interface Saved {
  sessionId: string;
  code: string;
  displayKey: string;
  tag: string;
  userId: string;
  musicSqId: string;
  mediaId: string;
}

async function main() {
  const [mode, file] = process.argv.slice(2);
  const { getSql } = await import("@/lib/database/db");
  const sql = getSql();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const actor = { userId: null, email: "e2e@quizzone.local", ip: "127.0.0.1" };
  try {
    if (mode === "cleanup") {
      const s = JSON.parse(readFileSync(file, "utf8")) as Saved;
      await sql`delete from question_plays where host_user_id = ${s.userId}`;
      await sql.begin(async (tx) => {
        await tx`select set_config('qz.allow_reset', 'on', true)`;
        await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
        await tx`delete from game_sessions where host_user_id = ${s.userId}`;
      });
      await sql`delete from question_bank where ${s.tag} = any(tags)`;
      await admin.auth.admin.deleteUser(s.userId);
      return;
    }
    const { executeCommand } = await import("@/lib/server/engine");
    const run = (sessionId: string, command: Parameters<typeof executeCommand>[2]["command"], args: Record<string, unknown> = {}) =>
      executeCommand(sessionId, actor, { command, commandId: randomUUID(), args });

    if (mode === "start") {
      const s = JSON.parse(readFileSync(file, "utf8")) as Saved;
      await run(s.sessionId, "START_ROUND");
      console.log("✔ round iniziato: guida il TV");
      return;
    }

    if (mode === "song") {
      const s = JSON.parse(readFileSync(file, "utf8")) as Saved;
      const { loadStateRow } = await import("@/lib/server/public-state");
      const { resolveNextQuestion } = await import("@/lib/server/engine");
      await run(s.sessionId, "SET_AUTOPLAY", { autoplay: false });
      for (let guard = 0; guard < 60; guard++) {
        const st = (await loadStateRow(sql, s.sessionId))!;
        if (st.phase === "QUESTION_VISIBLE") await run(s.sessionId, "SHOW_OPTIONS");
        else if (st.phase === "OPTIONS_VISIBLE" || st.phase === "ANSWERS_LOCKED") await run(s.sessionId, "REVEAL", { force: true });
        else if (st.phase === "ANSWER_REVEAL") await run(s.sessionId, "SCORE");
        else {
          const next = await sql.begin((tx) => resolveNextQuestion(tx, st));
          if (next && !("blocked" in next) && next.id === s.musicSqId) {
            await run(s.sessionId, "SHOW_QUESTION", { force: true });
            const after = (await loadStateRow(sql, s.sessionId))!;
            if (after.phase === "QUESTION_VISIBLE") break;
            continue; // ruota di Palmino proprio prima della canzone: un altro giro
          }
          await run(s.sessionId, "SHOW_QUESTION", { force: true });
        }
      }
      await run(s.sessionId, "SET_AUTOPLAY", { autoplay: true });
      console.log("✔ canzone in scena: il TV la fa sentire e poi apre le risposte");
      return;
    }

    // ------------------------------------------------------------------ prepare
    const { createQuestion, confirmAnswer } = await import("@/lib/server/cms/questions");
    const { createHostProfile, createPublicGame, loadHostUser } = await import("@/lib/server/gioco-libero");
    const tag = `e2e-sempre-${randomUUID().slice(0, 8)}`;
    const cats = ["Cinema", "Storia", "Sport", "Geografia", "Scienza"];
    const make = async (i: number, extra: Record<string, unknown> = {}) => {
      const q = await createQuestion(
        {
          type: "single",
          text: `${cats[i % cats.length]}: domanda di prova numero ${i + 1}?`,
          category: cats[i % cats.length],
          difficulty: (i % 5) + 1,
          tags: ["test-automatico", tag],
          presenter: "professore",
          options: ["Prima", "Seconda", "Terza", "Quarta"].map((t, k) => ({ text: t, isCorrect: k === 0 })),
          status: "draft",
          answerConfirmed: false,
          ...extra,
        },
        actor,
      );
      await confirmAnswer(q.id, true, actor);
      return q.id;
    };
    for (let i = 0; i < 40; i++) await make(i);
    // la canzone: un estratto vero già caricato nell'archivio locale (le canzoni di REFERENCE/GIOCHI/CHE_NE_SAI/CANZONI)
    const [m] = await sql<{ id: string; text: string; options: { text: string; is_correct: boolean }[] }[]>`
      select m.id, q.text,
        (select json_agg(json_build_object('text', o.text, 'is_correct', o.is_correct) order by o.position) from question_options o where o.question_id = q.id) as options
      from media_assets m join question_bank q on q.media_id = m.id
      where m.kind = 'audio' and not m.archived and q.status = 'approved' order by m.created_at, q.created_at limit 1`;
    if (!m) throw new Error("Nessuna domanda con estratto audio nell'archivio locale");
    const song = await createQuestion(
      {
        type: "single",
        text: m.text,
        category: "Musica",
        difficulty: 2,
        tags: ["test-automatico", tag],
        presenter: "regina",
        options: m.options.map((o) => ({ text: o.text, isCorrect: o.is_correct })),
        status: "draft",
        answerConfirmed: false,
        mediaId: m.id,
      },
      actor,
    );
    await confirmAnswer(song.id, true, actor);

    const email = `${tag}@test.chenesai.local`;
    const u = await admin.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
    if (u.error || !u.data.user) throw u.error ?? new Error("utente non creato");
    await createHostProfile(sql, u.data.user.id, `sempre_${randomUUID().slice(0, 6)}`);
    const host = await loadHostUser(sql, u.data.user.id, email);
    const g = await createPublicGame(host, { totalQuestions: 10, rounds: 1, mix: "bilanciata" }, { onlyTag: tag });
    // show sui telefoni dei giocatori (verticale), il TV resta il TV
    await sql`update game_sessions set display_mode = 'phone' where id = ${g.sessionId}`;
    const [sq] = await sql<{ id: string }[]>`select id from session_questions where session_id = ${g.sessionId} and question_id = ${song.id} and not is_reserve`;
    const out: Saved = { sessionId: g.sessionId, code: g.code, displayKey: g.displayKey, tag, userId: host.userId, musicSqId: sq.id, mediaId: m.id };
    writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`✔ partita libera ${g.code} pronta (lobby aperta, 1 round a votazione, canzone e ruota)`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
