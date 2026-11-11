/**
 * Importa nell'archivio le domande verificate dei file JSON (content/domande/verificate e
 * content/domande/nuove, solo quelle con "verified": true). Non duplica: salta i testi già presenti.
 *
 *   npx tsx scripts/domande/importa.ts               → database locale (.env.local)
 *   npx tsx scripts/domande/importa.ts --produzione  → database online (.env.production.local)
 *   … --prova                                         → conta soltanto, non scrive
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

export const QUESTION_DIRS: { dir: string; tag: string; onlyVerified: boolean }[] = [
  { dir: "content/domande/verificate", tag: "pilot", onlyVerified: false },
  { dir: "content/domande/nuove", tag: "banca", onlyVerified: true },
];

interface FileQuestion {
  type: "single" | "multiple";
  text: string;
  category: string;
  difficulty: number;
  presenter: string;
  answers: string[];
  correct: number[];
  tags?: string[];
  notes?: string;
  verified?: boolean;
}

type Sql = postgres.Sql;

export async function importVerifiedQuestions(db: Sql, opts: { dry?: boolean; skipTexts?: Iterable<string> } = {}): Promise<{ added: number; skipped: number }> {
  const known = new Set((await db<{ text: string }[]>`select text from question_bank`).map((r) => r.text));
  for (const t of opts.skipTexts ?? []) known.add(t);
  let added = 0;
  let skipped = 0;
  for (const { dir, tag, onlyVerified } of QUESTION_DIRS) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
      const data = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as { questions: FileQuestion[] };
      for (const q of data.questions) {
        if ((onlyVerified && q.verified !== true) || known.has(q.text)) {
          skipped++;
          continue;
        }
        known.add(q.text);
        if (opts.dry) {
          added++;
          continue;
        }
        await db.begin(async (tx) => {
          const [row] = await tx<{ id: string }[]>`
            insert into question_bank (type, text, category, difficulty, tags, presenter, notes, status, answer_confirmed, source)
            values (${q.type}, ${q.text}, ${q.category}, ${q.difficulty}, ${tx.array([...new Set([...(q.tags ?? []), tag, "verificata"])])},
                    ${q.presenter}::presenter, ${q.notes ?? null}, 'approved', true, 'import')
            returning id`;
          for (let i = 0; i < q.answers.length; i++) {
            await tx`insert into question_options (question_id, position, text, is_correct) values (${row.id}, ${i}, ${q.answers[i]}, ${q.correct.includes(i)})`;
          }
        });
        added++;
      }
    }
  }
  return { added, skipped };
}

function envFrom(file: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
  );
}

async function main() {
  const prod = process.argv.includes("--produzione");
  const dry = process.argv.includes("--prova");
  const file = prod ? ".env.production.local" : ".env.local";
  if (!existsSync(file)) throw new Error(`Manca ${file}`);
  const env = envFrom(file);
  const url = prod ? env.DATABASE_URL_SESSION || env.DATABASE_URL : env.DATABASE_URL;
  if (!url) throw new Error(`DATABASE_URL mancante in ${file}`);
  const db = postgres(url, { prepare: false, max: 1 });
  try {
    const r = await importVerifiedQuestions(db, { dry });
    const [{ n }] = await db<{ n: number }[]>`select count(*)::int as n from question_bank where status = 'approved'`;
    console.log(`${prod ? "Online" : "Locale"}: ${r.added} domande ${dry ? "da importare" : "importate"} (${r.skipped} già presenti o non verificate) · approvate in archivio: ${n}`);
  } finally {
    await db.end();
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/domande/importa.ts")) {
  main().catch((e) => {
    console.error("✖", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
