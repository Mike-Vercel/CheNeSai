/**
 * Preparazione dell'e2e della Ruota di Palmino (lanciato con tsx --conditions=react-server):
 *   palmino-wheel-setup.ts prepare <out.json>  → serata di prova con la ruota forzata sulla 5ª
 *       domanda (archivio isolato con tag), lobby aperta, primo round giocato fino ai punti
 *       della 4ª domanda (SCORE_REVEAL). Lo show sui telefoni dei giocatori è in verticale.
 *   palmino-wheel-setup.ts cleanup <in.json>   → elimina serata e domande di prova.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const [mode, file] = process.argv.slice(2);
  const { getSql } = await import("@/lib/database/db");
  const sql = getSql();
  try {
    if (mode === "cleanup") {
      const s = JSON.parse(readFileSync(file, "utf8")) as { sessionId: string; tag: string };
      await sql.begin(async (tx) => {
        await tx`select set_config('qz.allow_reset', 'on', true)`;
        await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
        await tx`delete from game_sessions where id = ${s.sessionId}`;
      });
      await sql`delete from question_bank where ${s.tag} = any(tags)`;
      return;
    }
    const { createQuestion, confirmAnswer } = await import("@/lib/server/cms/questions");
    const { addQuestionsToRound, createRound, createSession, publishSession } = await import("@/lib/server/cms/sessions");
    const { executeCommand } = await import("@/lib/server/engine");
    const actor = { userId: null, email: "e2e@quizzone.local", ip: "127.0.0.1" };
    const tag = `e2e-ruota-${randomUUID().slice(0, 8)}`;
    const cats = ["Cinema", "Musica", "Sport", "Storia", "Geografia", "Scienza", "Arte", "Cucina"];
    const ids: string[] = [];
    for (let i = 0; i < 24; i++) {
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
        },
        actor,
      );
      await confirmAnswer(q.id, true, actor);
      ids.push(q.id);
    }
    const sessionId = await createSession({ title: `E2E Ruota di Palmino ${tag.slice(-8)}`, isTest: true, settings: { palminoWheel: true, advanceMode: "manual" } }, actor);
    const roundId = await createRound(sessionId, { title: "Ruota di prova", kind: "standard", speedBonusMax: 0 }, actor);
    await addQuestionsToRound(roundId, ids.slice(0, 6), {}, actor);
    await publishSession(sessionId, actor, { palminoWheel: { onlyTag: tag, force: [5] } });
    // show sui telefoni dei giocatori (verticale), il TV resta il TV
    await sql`update game_sessions set display_mode = 'phone' where id = ${sessionId}`;
    const run = (command: Parameters<typeof executeCommand>[2]["command"], args: Record<string, unknown> = {}) =>
      executeCommand(sessionId, actor, { command, commandId: randomUUID(), args });
    await run("OPEN_LOBBY");
    await run("START_ROUND");
    for (let i = 0; i < 4; i++) {
      await run("SHOW_QUESTION");
      await run("SHOW_OPTIONS");
      await run("REVEAL", { force: true });
      await run("SCORE");
    }
    const [s] = await sql<{ code: string; display_key: string }[]>`select code, display_key from game_sessions where id = ${sessionId}`;
    writeFileSync(file, JSON.stringify({ sessionId, code: s.code, displayKey: s.display_key, tag }, null, 2));
    console.log(`✔ Ruota di Palmino: serata ${s.code} pronta ai punti della 4ª domanda`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
