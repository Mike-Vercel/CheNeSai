/**
 * Copia i contenuti dal database LOCALE a quello di PRODUZIONE (stesso schema, stesse migrazioni):
 * impostazioni, battute dei presentatori, domande (escluse demo e test automatici) con i loro media,
 * voci già generate (così non si ripagano su ElevenLabs) e le domande pilota verificate.
 * Non cancella nulla in produzione: inserisce solo ciò che manca ("on conflict do nothing").
 *
 * Lo lancia setup-production.mjs con queste variabili d'ambiente:
 *   LOCAL_DATABASE_URL, LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SECRET_KEY   (sorgente, dal .env.local)
 *   DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY          (destinazione: produzione)
 *   npx tsx --conditions=react-server scripts/deploy/copy-content.ts [--dry-run]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Variabile mancante: ${k}`);
  return v;
};

const src = postgres(need("LOCAL_DATABASE_URL"), { prepare: false, max: 1 });
const dst = postgres(need("DATABASE_URL"), { prepare: false, max: 1 });
const srcStorage = createClient(need("LOCAL_SUPABASE_URL"), need("LOCAL_SUPABASE_SECRET_KEY"), { auth: { persistSession: false } }).storage;
const dstStorage = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SECRET_KEY"), { auth: { persistSession: false } }).storage;

type Row = Record<string, unknown>;

/** Colonne inseribili (non generate) della tabella nella destinazione. */
async function insertableColumns(db: Sql, table: string): Promise<string[]> {
  const rows = await db<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
      and is_generated = 'NEVER' and coalesce(identity_generation, '') <> 'ALWAYS'
    order by ordinal_position`;
  return rows.map((r) => r.column_name);
}

/** Colonne che puntano a utenti (auth.users): in produzione gli utenti sono diversi → null. */
async function userColumns(db: Sql, table: string): Promise<Set<string>> {
  const rows = await db<{ attname: string }[]>`
    select a.attname from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = ${"public." + table}::regclass and c.contype = 'f' and c.confrelid = 'auth.users'::regclass`;
  return new Set(rows.map((r) => r.attname));
}

async function copyRows(table: string, rows: Row[], conflict = "do nothing"): Promise<number> {
  if (rows.length === 0) return 0;
  const cols = (await insertableColumns(dst, table)).filter((c) => c in rows[0]);
  const users = await userColumns(dst, table);
  const clean = rows.map((r) => Object.fromEntries(cols.map((c) => [c, users.has(c) ? null : r[c]])));
  if (DRY) return clean.length;
  let n = 0;
  for (let i = 0; i < clean.length; i += 200) {
    const batch = clean.slice(i, i + 200);
    const res = await dst.unsafe(
      `insert into public.${table} (${cols.map((c) => `"${c}"`).join(", ")})
       select ${cols.map((c) => `"${c}"`).join(", ")} from json_populate_recordset(null::public.${table}, ($1::text)::json)
       on conflict ${conflict} returning 1`,
      [JSON.stringify(batch)],
    );
    n += res.length;
  }
  return n;
}

async function copyObject(bucket: string, path: string): Promise<boolean> {
  const exists = await dstStorage.from(bucket).list(path.split("/").slice(0, -1).join("/"), { search: path.split("/").pop(), limit: 1 });
  if (exists.data?.some((o) => o.name === path.split("/").pop())) return false;
  const dl = await srcStorage.from(bucket).download(path);
  if (dl.error || !dl.data) throw new Error(`download ${bucket}/${path}: ${dl.error?.message}`);
  if (DRY) return true;
  const up = await dstStorage.from(bucket).upload(path, dl.data, { contentType: dl.data.type || undefined, upsert: false });
  if (up.error && !/exists/i.test(up.error.message)) throw new Error(`upload ${bucket}/${path}: ${up.error.message}`);
  return true;
}

async function main() {
  console.log(DRY ? "— PROVA (nessuna scrittura) —" : "— Copia dei contenuti in produzione —");

  // 1. impostazioni (voci, tempi, regia automatica…): quelle locali sono quelle provate
  const settings = await src<Row[]>`select * from application_settings`;
  console.log(`impostazioni: ${await copyRows("application_settings", settings, "(key) do update set value = excluded.value")}`);

  // 2. battute dei presentatori
  const lines = await src<Row[]>`select * from dialogue_templates`;
  console.log(`battute presentatori: ${await copyRows("dialogue_templates", lines)} nuove su ${lines.length}`);

  // 3. domande (no demo, no test automatici, no archiviate) + media collegati
  const questions = await src<Row[]>`
    select * from question_bank
    where status <> 'archived' and not ('demo' = any(tags)) and not ('test-automatico' = any(tags))`;
  const qIds = questions.map((q) => q.id as string);
  const mediaIds = [...new Set(questions.map((q) => q.media_id).filter(Boolean))] as string[];
  const media = mediaIds.length ? await src<Row[]>`select * from media_assets where id = any(${mediaIds}::uuid[])` : [];
  let files = 0;
  for (const m of media) if (await copyObject("media", m.storage_path as string)) files++;
  console.log(`media: ${await copyRows("media_assets", media)} nuovi (${files} file caricati)`);
  console.log(`domande: ${await copyRows("question_bank", questions)} nuove su ${questions.length}`);
  const options = qIds.length ? await src<Row[]>`select * from question_options where question_id = any(${qIds}::uuid[])` : [];
  console.log(`risposte: ${await copyRows("question_options", options)} nuove`);

  // 4. voci già generate (stesse voci e testi → stessa chiave di cache)
  const clips = await src<Row[]>`select * from tts_clips`;
  let clipFiles = 0;
  const okClips: Row[] = [];
  for (const c of clips) {
    try {
      if (await copyObject("tts", c.storage_path as string)) clipFiles++;
      okClips.push(c);
    } catch (e) {
      console.warn(`  voce saltata (${(e as Error).message})`);
    }
  }
  console.log(`voci: ${await copyRows("tts_clips", okClips)} nuove (${clipFiles} file caricati)`);

  // 5. domande pilota verificate (content/domande/verificate) che non ci sono ancora
  const dir = "content/domande/verificate";
  if (existsSync(dir)) {
    const known = new Set((await dst<{ text: string }[]>`select text from question_bank`).map((r) => r.text));
    for (const q of questions) known.add(q.text as string);
    let added = 0;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const data = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as {
        questions: { type: "single" | "multiple"; text: string; category: string; difficulty: number; presenter: string; answers: string[]; correct: number[]; tags?: string[]; notes?: string }[];
      };
      for (const q of data.questions) {
        if (known.has(q.text)) continue;
        known.add(q.text);
        if (DRY) {
          added++;
          continue;
        }
        await dst.begin(async (tx) => {
          const [row] = await tx<{ id: string }[]>`
            insert into question_bank (type, text, category, difficulty, tags, presenter, notes, status, answer_confirmed, source)
            values (${q.type}, ${q.text}, ${q.category}, ${q.difficulty}, ${tx.array([...(q.tags ?? []), "pilot", "verificata"])},
                    ${q.presenter}::presenter, ${q.notes ?? null}, 'approved', true, 'import')
            returning id`;
          for (let i = 0; i < q.answers.length; i++) {
            await tx`insert into question_options (question_id, position, text, is_correct) values (${row.id}, ${i}, ${q.answers[i]}, ${q.correct.includes(i)})`;
          }
        });
        added++;
      }
    }
    console.log(`domande pilota verificate: ${added} nuove`);
  }

  const [{ n }] = await dst<{ n: number }[]>`select count(*)::int as n from question_bank where status = 'approved'`;
  console.log(`✔ Domande approvate in produzione: ${n}`);
}

main()
  .catch((e) => {
    console.error("✖", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await src.end();
    await dst.end();
  });
