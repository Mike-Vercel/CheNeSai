#!/usr/bin/env node
/**
 * CHE NE SAI?! – messa online completa (Supabase + Vercel), in un comando:
 *
 *   node scripts/deploy/setup-production.mjs
 *
 * Prerequisiti (già fatti su questo PC): `npx supabase login`, `npx vercel login`, progetto Vercel
 * collegato (.vercel/project.json). Lo script è RIPRENDIBILE: se si interrompe, rilancialo.
 *
 * Cosa fa:
 *  1. crea (o ritrova) il progetto Supabase "che-ne-sai" nella tua organizzazione, in Europa (Francoforte),
 *     con una password del database generata a caso e salvata solo in .env.production.local (escluso da git);
 *  2. applica tutte le migrazioni (struttura del database, regole di sicurezza, Realtime, Storage);
 *  3. copia i contenuti dal Supabase locale (domande, battute, impostazioni, voci già generate, brani);
 *  4. crea il tuo account admin (email e password le scrivi tu qui, non finiscono in nessun file);
 *  5. imposta le variabili d'ambiente su Vercel (chiavi lette da .env.local e da Supabase);
 *  6. pubblica in produzione e controlla che il sito risponda.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const PROJECT_NAME = "che-ne-sai";
const REGION = "eu-central-1";
const STATE_FILE = ".env.production.local";

// ------------------------------------------------------------------ utilità
const c = { b: (s) => `\x1b[1m${s}\x1b[0m`, g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
const step = (n, t) => console.log(`\n${c.b(`[${n}/6]`)} ${t}`);
const fail = (msg) => {
  console.error(`\n${c.r("✖")} ${msg}\n`);
  process.exit(1);
};

/** Esegue un comando; `input` va sullo stdin (usato per i valori segreti, mai nella riga di comando). */
function sh(command, { input, inherit = false, allowFail = false, env } = {}) {
  const r = spawnSync(command, {
    shell: true,
    encoding: "utf8",
    input,
    env: { ...process.env, ...env },
    stdio: inherit ? ["pipe", "inherit", "inherit"] : ["pipe", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0 && !allowFail) {
    fail(`Comando non riuscito: ${command.replace(/--(password|db-password) \S+/g, "--$1 ****")}\n${(r.stderr || r.stdout || "").slice(-1500)}`);
  }
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

function parseJson(text, what) {
  const start = text.search(/[[{]/);
  try {
    return JSON.parse(text.slice(start));
  } catch {
    fail(`Risposta non valida da ${what}:\n${text.slice(0, 800)}`);
  }
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

function saveState(state) {
  const body = Object.entries(state)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(STATE_FILE, `# CHE NE SAI?! – produzione (NON condividere, escluso da git)\n${body}\n`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ main
async function main() {
  if (!existsSync("package.json") || !existsSync("supabase/migrations")) fail("Lancia lo script dalla cartella del progetto QUIZZONE.");
  if (!existsSync(".vercel/project.json")) fail("Progetto Vercel non collegato: esegui `npx vercel link --scope mg-production --project che-ne-sai`.");
  const local = readEnvFile(".env.local");
  for (const k of ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "ELEVENLABS_API_KEY"]) {
    if (!local[k]) fail(`Manca ${k} in .env.local`);
  }
  const state = readEnvFile(STATE_FILE);
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log(c.b("\nCHE NE SAI?! – messa online"));
  const who = sh("npx --yes vercel@latest whoami", { allowFail: true });
  if (!who.ok) fail("Vercel: accesso non attivo. Esegui `npx vercel login`.");
  console.log(`Vercel: ${who.out.split("\n").pop()}`);

  // ---------------------------------------------------------------- 0. GitHub
  console.log("Aggiorno GitHub (se si apre la finestra di accesso di GitHub, accedi tu)…");
  const push = sh("git push origin HEAD:main", { inherit: true, allowFail: true });
  if (!push.ok) console.log(c.y("  GitHub non aggiornato (accesso mancante): proseguo, potrai rifare `git push origin HEAD:main`."));

  // ---------------------------------------------------------------- 1. progetto Supabase
  step(1, "Progetto Supabase");
  const list = parseJson(sh("npx supabase projects list -o json").out, "supabase projects list");
  const projects = Array.isArray(list) ? list : (list.projects ?? []);
  let project = projects.find((p) => p.name === PROJECT_NAME);
  if (!project) {
    const orgsRaw = parseJson(sh("npx supabase orgs list -o json").out, "supabase orgs list");
    const orgs = Array.isArray(orgsRaw) ? orgsRaw : (orgsRaw.organizations ?? []);
    const org = orgs.find((o) => /mike/i.test(o.name)) ?? orgs[0];
    if (!org) fail("Nessuna organizzazione Supabase trovata.");
    state.SUPABASE_DB_PASSWORD = randomBytes(20).toString("hex");
    saveState(state);
    console.log(`Creo "${PROJECT_NAME}" nell'organizzazione "${org.name}" (${REGION}, piano gratuito)…`);
    const created = parseJson(
      sh(`npx supabase projects create ${PROJECT_NAME} --org-id ${org.id} --region ${REGION} --db-password ${state.SUPABASE_DB_PASSWORD} -o json`).out,
      "supabase projects create",
    );
    project = { ref: created.ref ?? created.id, name: PROJECT_NAME };
  } else {
    console.log(`Trovato il progetto esistente "${PROJECT_NAME}" (${project.ref ?? project.id}).`);
  }
  state.SUPABASE_PROJECT_REF = project.ref ?? project.id;
  if (!state.SUPABASE_DB_PASSWORD) {
    state.SUPABASE_DB_PASSWORD = (await rl.question("Password del database del progetto esistente (Supabase → Project Settings → Database): ")).trim();
    if (!state.SUPABASE_DB_PASSWORD) fail("Password del database necessaria.");
  }
  saveState(state);

  process.stdout.write("Attendo che il progetto sia pronto");
  for (let i = 0; i < 90; i++) {
    const l = parseJson(sh("npx supabase projects list -o json").out, "supabase projects list");
    const p = (Array.isArray(l) ? l : (l.projects ?? [])).find((x) => (x.ref ?? x.id) === state.SUPABASE_PROJECT_REF);
    if (p?.status === "ACTIVE_HEALTHY") break;
    if (i === 89) fail("Il progetto non è diventato attivo entro 15 minuti: riprova tra poco (lo script riparte da qui).");
    process.stdout.write(".");
    await sleep(10000);
  }
  console.log(c.g(" pronto"));

  // ---------------------------------------------------------------- 2. migrazioni
  step(2, "Struttura del database (migrazioni)");
  sh(`npx supabase link --project-ref ${state.SUPABASE_PROJECT_REF} --password ${state.SUPABASE_DB_PASSWORD}`);
  sh(`npx supabase db push --linked --password ${state.SUPABASE_DB_PASSWORD} --include-all --yes`, { inherit: true });

  const keysRaw = parseJson(sh(`npx supabase projects api-keys --project-ref ${state.SUPABASE_PROJECT_REF} --reveal -o json`).out, "api-keys");
  const keys = Array.isArray(keysRaw) ? keysRaw : (keysRaw.keys ?? []);
  const pick = (types, names) => keys.find((k) => types.includes(k.type)) ?? keys.find((k) => names.includes(k.name));
  const publishable = pick(["publishable"], ["anon"]);
  const secret = pick(["secret"], ["service_role"]);
  if (!publishable?.api_key || !secret?.api_key) fail("Chiavi API del progetto non trovate.");
  state.NEXT_PUBLIC_SUPABASE_URL = `https://${state.SUPABASE_PROJECT_REF}.supabase.co`;
  state.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishable.api_key;
  state.SUPABASE_SECRET_KEY = secret.api_key;

  // pooler: porta 6543 (transazioni) per Vercel, 5432 (sessione) per gli script
  let poolerHost = null;
  if (existsSync("supabase/.temp/pooler-url")) {
    const m = readFileSync("supabase/.temp/pooler-url", "utf8").match(/@([^:/]+)/);
    poolerHost = m?.[1] ?? null;
  }
  const pw = state.SUPABASE_DB_PASSWORD;
  const ref = state.SUPABASE_PROJECT_REF;
  state.DATABASE_URL = poolerHost
    ? `postgresql://postgres.${ref}:${pw}@${poolerHost}:6543/postgres`
    : `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`;
  state.DATABASE_URL_SESSION = poolerHost
    ? `postgresql://postgres.${ref}:${pw}@${poolerHost}:5432/postgres`
    : `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`;
  saveState(state);
  console.log(c.g("✔ struttura applicata, chiavi e connessioni salvate in .env.production.local"));

  const prodEnv = {
    DATABASE_URL: state.DATABASE_URL_SESSION,
    NEXT_PUBLIC_SUPABASE_URL: state.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: state.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: state.SUPABASE_SECRET_KEY,
  };

  // ---------------------------------------------------------------- 3. contenuti
  step(3, "Contenuti: domande, battute, impostazioni, voci, brani");
  sh("npx tsx --conditions=react-server scripts/deploy/copy-content.ts", {
    inherit: true,
    env: { ...prodEnv, LOCAL_DATABASE_URL: local.DATABASE_URL, LOCAL_SUPABASE_URL: local.NEXT_PUBLIC_SUPABASE_URL, LOCAL_SUPABASE_SECRET_KEY: local.SUPABASE_SECRET_KEY },
  });

  // ---------------------------------------------------------------- 4. admin
  step(4, "Account admin della regia");
  if (state.ADMIN_EMAIL) {
    console.log(`Admin già creato: ${state.ADMIN_EMAIL}`);
  } else {
    const email = (await rl.question("Email per entrare nella regia: ")).trim();
    const password = (await rl.question("Password (almeno 10 caratteri; non viene salvata in nessun file): ")).trim();
    if (!email.includes("@") || password.length < 10) fail("Email o password non valide (password: almeno 10 caratteri). Rilancia lo script.");
    sh(`npx tsx scripts/create-admin.ts ${email} - "Regia" super_admin`, { inherit: true, env: { ...prodEnv, ADMIN_PASSWORD: password } });
    state.ADMIN_EMAIL = email;
    saveState(state);
  }

  // ---------------------------------------------------------------- 5. variabili su Vercel
  step(5, "Variabili d'ambiente su Vercel (produzione)");
  const vars = [
    ["NEXT_PUBLIC_SUPABASE_URL", state.NEXT_PUBLIC_SUPABASE_URL, false],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", state.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, false],
    ["SUPABASE_SECRET_KEY", state.SUPABASE_SECRET_KEY, true],
    ["DATABASE_URL", state.DATABASE_URL, true],
    ["DATABASE_POOL_MAX", "3", false],
    ["ELEVENLABS_API_KEY", local.ELEVENLABS_API_KEY, true],
  ];
  for (const k of Object.keys(local)) {
    if (k.startsWith("ELEVENLABS_VOICE_") || k.startsWith("NEXT_PUBLIC_QZ_")) vars.push([k, local[k], false]);
  }
  for (const [name, value, sensitive] of vars) {
    if (!value) continue;
    sh(`npx --yes vercel@latest env add ${name} production --force --yes${sensitive ? " --sensitive" : ""}`, { input: value });
    console.log(`  ✔ ${name}`);
  }

  // ---------------------------------------------------------------- 6. pubblicazione
  step(6, "Pubblicazione su Vercel");
  const dep = sh("npx --yes vercel@latest deploy --prod --yes");
  const urls = `${dep.out}\n${dep.err}`.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi) ?? [];
  const url = urls[urls.length - 1];
  if (!url) fail(`Pubblicazione completata ma URL non trovato:\n${dep.out.slice(-800)}`);
  let health = "non verificato";
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(`${url}/api/health`);
      const j = await r.json();
      health = j.status === "ok" ? c.g("database raggiungibile ✔") : c.y(JSON.stringify(j));
      if (j.status === "ok") break;
    } catch {
      /* il deploy può impiegare qualche secondo a rispondere */
    }
    await sleep(5000);
  }
  rl.close();

  console.log(`\n${c.g("✔ CHE NE SAI?! è online")}`);
  console.log(`  Sito:   ${url}`);
  console.log(`  Regia:  ${url}/admin   (accesso: ${state.ADMIN_EMAIL})`);
  console.log(`  Stato:  ${health}`);
  console.log(`\nDati del progetto salvati in ${STATE_FILE} (non condividerlo).`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
