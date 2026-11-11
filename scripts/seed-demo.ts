/**
 * Dati DIMOSTRATIVI (mai usati in produzione automaticamente).
 *   npm run db:seed-demo                  → domande demo + serata demo di PROVA pubblicata
 *   npm run db:seed-demo -- --e2e out.json → sessione compatta per i test end-to-end
 * Tutte le domande hanno il tag "demo"; le serate sono marcate come prova
 * (is_test) e quindi escluse dalle classifiche reali.
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";

config({ path: ".env.local", quiet: true });

type Q = { text: string; category: string; answers: [string, string, string, string]; correct: number[]; presenter?: "professore" | "regina" | "palmino"; difficulty?: number; duration?: number };

const DEMO: Q[] = [
  { text: "Qual è la capitale dell'Albania?", category: "Geografia", answers: ["Tirana", "Durazzo", "Valona", "Scutari"], correct: [0] },
  { text: "Quale fiume attraversa Palermo… sotto terra?", category: "Sicilia", answers: ["Oreto", "Kemonia", "Simeto", "Belice"], correct: [1], presenter: "regina", difficulty: 4 },
  { text: "Quali di questi sono pianeti del Sistema Solare?", category: "Scienza", answers: ["Marte", "Plutone", "Venere", "Luna"], correct: [0, 2], difficulty: 3 },
  { text: "In che anno l'Italia ha vinto il suo quarto Mondiale di calcio?", category: "Sport", answers: ["1982", "1994", "2006", "2010"], correct: [2] },
  { text: "Chi ha scritto 'Il Gattopardo'?", category: "Letteratura", answers: ["Verga", "Pirandello", "Tomasi di Lampedusa", "Sciascia"], correct: [2], presenter: "regina" },
  { text: "Quanti sono i lati di un ettagono?", category: "Matematica", answers: ["6", "7", "8", "9"], correct: [1], duration: 10 },
  { text: "Qual è l'ingrediente che NON va nella caponata classica?", category: "Cucina", answers: ["Melanzane", "Sedano", "Patate", "Capperi"], correct: [2], presenter: "palmino" },
  { text: "Chi ha diretto 'Nuovo Cinema Paradiso'?", category: "Cinema", answers: ["Giuseppe Tornatore", "Roberto Benigni", "Paolo Sorrentino", "Gabriele Salvatores"], correct: [0] },
  { text: "Quale film ha vinto l'Oscar come miglior film straniero nel 1999?", category: "Cinema", answers: ["Mediterraneo", "La vita è bella", "La grande bellezza", "Il postino"], correct: [1], difficulty: 3 },
  { text: "Chi canta 'Nel blu dipinto di blu'?", category: "Musica", answers: ["Domenico Modugno", "Adriano Celentano", "Gianni Morandi", "Lucio Battisti"], correct: [0] },
  { text: "Quale band ha pubblicato l'album 'The Dark Side of the Moon'?", category: "Musica", answers: ["Queen", "Pink Floyd", "Led Zeppelin", "The Who"], correct: [1] },
  { text: "Qual è il vulcano attivo più alto d'Europa?", category: "Geografia", answers: ["Vesuvio", "Stromboli", "Etna", "Teide"], correct: [2], presenter: "regina" },
  { text: "Quale squadra ha vinto più Champions League?", category: "Sport", answers: ["Milan", "Real Madrid", "Bayern Monaco", "Liverpool"], correct: [1] },
  { text: "In che anno è caduto il Muro di Berlino?", category: "Storia", answers: ["1987", "1989", "1991", "1993"], correct: [1], presenter: "regina", difficulty: 2 },
  { text: "Quante zampe ha un ragno?", category: "Natura", answers: ["6", "8", "10", "12"], correct: [1], presenter: "palmino" },
  { text: "Quale di queste città NON è un capoluogo di provincia siciliano?", category: "Sicilia", answers: ["Enna", "Ragusa", "Cefalù", "Trapani"], correct: [2], difficulty: 3 },
];

async function main() {
  const e2eIndex = process.argv.indexOf("--e2e");
  const e2eOut = e2eIndex >= 0 ? process.argv[e2eIndex + 1] : null;
  const { getSql } = await import("../src/lib/database/db");
  const qs = await import("../src/lib/server/cms/questions");
  const ss = await import("../src/lib/server/cms/sessions");
  const actor = { userId: null, email: "seed@quizzone.local", ip: null };

  const ids: string[] = [];
  for (const q of e2eOut ? DEMO.slice(0, 3).concat(DEMO.slice(7, 11)) : DEMO) {
    const rec = await qs.createQuestion(
      {
        type: q.correct.length > 1 ? "multiple" : "single",
        text: q.text,
        category: q.category,
        difficulty: q.difficulty ?? 2,
        tags: ["demo"],
        presenter: q.presenter ?? "professore",
        options: q.answers.map((a, i) => ({ text: a, isCorrect: q.correct.includes(i) })),
        durationSeconds: q.duration ?? null,
        status: "approved",
        answerConfirmed: true,
        notes: "Domanda dimostrativa (seed)",
      },
      actor,
    );
    ids.push(rec.id);
  }
  const byText = new Map<string, string>();
  const all = e2eOut ? DEMO.slice(0, 3).concat(DEMO.slice(7, 11)) : DEMO;
  all.forEach((q, i) => byText.set(q.text, ids[i]));
  const id = (t: string) => byText.get(t)!;

  const sessionId = await ss.createSession(
    {
      title: e2eOut ? `E2E ${new Date().toISOString().slice(0, 16)}` : "DEMO – Serata di prova",
      description: "Sessione dimostrativa generata dallo script di seed",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      isTest: !e2eOut,
      settings: {},
    },
    actor,
  );
  const r1 = await ss.createRound(sessionId, { title: "Cultura generale", kind: "standard", presenter: "professore", description: "Si parte con domande per tutti i gusti!" }, actor);
  if (e2eOut) {
    await ss.addQuestionsToRound(r1, [id(DEMO[0].text), id(DEMO[2].text)], {}, actor);
  } else {
    await ss.addQuestionsToRound(r1, [DEMO[0], DEMO[3], DEMO[2], DEMO[5]].map((q) => id(q.text)), {}, actor);
    await ss.addQuestionsToRound(r1, [id(DEMO[14].text)], { isReserve: true }, actor);
  }
  const r2 = await ss.createRound(
    sessionId,
    { title: "Decidete voi!", kind: "category_vote", presenter: "palmino", voteOptions: ["CINEMA", "MUSICA"], voteDurationSeconds: 15, voteTieBreak: "random" },
    actor,
  );
  const detail = await ss.getSessionDetail(getSql(), sessionId);
  const opts = detail!.roundsDetail.find((r) => r.id === r2)!.voteOptions;
  await ss.addQuestionsToRound(r2, [id(DEMO[7].text), id(DEMO[8].text)], { voteOptionId: opts[0].id }, actor);
  await ss.addQuestionsToRound(r2, [id(DEMO[9].text), id(DEMO[10].text)], { voteOptionId: opts[1].id }, actor);
  if (!e2eOut) {
    const r3 = await ss.createRound(sessionId, { title: "Gran finale", kind: "final", presenter: "regina", pointsMultiplier: 2, description: "Punti doppi per tutto il round!" }, actor);
    await ss.addQuestionsToRound(r3, [DEMO[11], DEMO[13], DEMO[15]].map((q) => id(q.text)), {}, actor);
    const d2 = await ss.getSessionDetail(getSql(), sessionId);
    const target = d2!.roundsDetail[0].questions.find((q) => !q.isReserve && q.position === 1)!;
    await ss.scheduleEvent(sessionId, { definitionKey: "double-points", targetSessionQuestionId: target.id }, actor);
  }
  await ss.publishSession(sessionId, actor);
  const final = await ss.getSessionDetail(getSql(), sessionId);
  const out = { sessionId, code: final!.code, displayKey: final!.displayKey };
  if (e2eOut) writeFileSync(e2eOut, JSON.stringify(out, null, 2));
  console.log(`✔ Sessione ${e2eOut ? "E2E" : "DEMO"} pubblicata: codice ${out.code}`);
  console.log(`  TV:     /display/${out.sessionId}?k=${out.displayKey}`);
  console.log(`  Regia:  /admin/sessions/${out.sessionId}/live`);
  await getSql().end();
}

main().catch((e) => {
  console.error("✖", e);
  process.exit(1);
});
