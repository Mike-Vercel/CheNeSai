#!/usr/bin/env node
/**
 * Libreria ufficiale delle battute: dal testo dell'utente (content/battute/LIBRERIA-UFFICIALE.md,
 * da NON riscrivere) al file dati importato nel database (content/show/libreria-ufficiale.json).
 *
 *   node scripts/build-libreria-ufficiale.mjs
 *
 * Il testo di ogni battuta resta PAROLA PER PAROLA (il test tests/unit/libreria-ufficiale.test.ts lo
 * verifica). Qui si aggiungono solo i dati per la regia: evento, livello di comicità, condizioni
 * (tags), animazione, scenette. Le regole sono scritte sotto, sezione per sezione.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "content", "battute", "LIBRERIA-UFFICIALE.md");
const OUT = join(root, "content", "show", "libreria-ufficiale.json");

const WHO = { professore: "professore", regina: "regina", palmino: "palmino" };
const SPEAKER = { Professore: "professore", Regina: "regina", Palmino: "palmino" };

/** Sezioni dei tre personaggi → evento (le battute con nomi: dal segnaposto). */
const SECTION_EVENT = {
  "Quando qualcuno sbaglia": "ANSWER_WRONG",
  "Quando sbagliano una domanda facilissima": "EASY_WRONG",
  "Quando qualcuno indovina": "ANSWER_CORRECT",
  "Quando il tempo sta scadendo": "TIME_RUNNING_OUT",
  "Quando il tempo scade": "TIME_RUNNING_OUT",
  "Durante la ruota": "WHEEL_SPIN",
  "Quando perde la pazienza": "LOSE_PATIENCE",
  "Quando diventa cattivissima": "ANSWER_WRONG",
  "Quando esce la classifica": "LEADERBOARD_QUIP",
  Tormentoni: "FILLER",
};
const SECTION_SLUG = {
  "Quando qualcuno sbaglia": "sbaglia",
  "Quando sbagliano una domanda facilissima": "facilissima",
  "Quando qualcuno indovina": "indovina",
  "Quando il tempo sta scadendo": "tempo",
  "Quando il tempo scade": "tempo",
  "Durante la ruota": "ruota",
  "Battute dinamiche con nomi": "nomi",
  "Quando perde la pazienza": "pazienza",
  "Quando diventa cattivissima": "cattivissima",
  "Quando esce la classifica": "classifica",
  Tormentoni: "tormentone",
};
/** Livello di partenza per sezione (poi le eccezioni battuta per battuta). */
const SECTION_LEVEL = {
  "Quando qualcuno sbaglia": "sarcastico",
  "Quando sbagliano una domanda facilissima": "sarcastico",
  "Quando qualcuno indovina": "leggero",
  "Quando il tempo sta scadendo": "leggero",
  "Quando il tempo scade": "leggero",
  "Durante la ruota": "leggero",
  "Battute dinamiche con nomi": "leggero",
  "Quando perde la pazienza": "sarcastico",
  "Quando diventa cattivissima": "irriverente",
  "Quando esce la classifica": "sarcastico",
  Tormentoni: "leggero",
};

/** Segnaposto → evento (battute dinamiche e annunci speciali). */
const PLACEHOLDER_EVENT = {
  nome_primo: "LEADER_CHANGED",
  nome_nuovo_primo: "LEADER_CHANGED",
  nome_primo_precedente: "LEADER_CHANGED",
  nome_ultimo: "NEW_LAST",
  nome_vincitore: "GAME_WINNER",
  nome_sorpasso: "OVERTAKE",
  nome_risposta_corretta: "ONLY_ONE_CORRECT",
  nome_risposta_errata: "ONLY_ONE_WRONG",
  nome_piu_veloce: "FASTEST_CORRECT",
  nome_rimonta: "COMEBACK",
  nome_giocatore: "PLAYER_NO_ANSWER",
};

/** Annunci speciali e battute speciali sulle mancate risposte (titoli del testo) → evento. */
const SPECIAL_EVENT = {
  "Primo classificato": "LEADER_CHANGED",
  "Ultimo classificato": "NEW_LAST",
  "Risposta esatta": "ONLY_ONE_CORRECT",
  "Risposta sbagliata": "ONLY_ONE_WRONG",
  Rimonta: "COMEBACK",
  "Vittoria finale": "GAME_WINNER",
  "Quando il primo classificato non risponde": "NO_ANSWER_LEADER",
  "Quando l'ultimo classificato non risponde": "NO_ANSWER_LAST",
  "Quando un giocatore non risponde per tre domande consecutive": "NO_ANSWER_STREAK",
  "Quando tanti concorrenti non rispondono": "MANY_NO_ANSWER",
};
const SPECIAL_SLUG = {
  "Primo classificato": "primo",
  "Ultimo classificato": "ultimo",
  "Risposta esatta": "esatta",
  "Risposta sbagliata": "errata",
  Rimonta: "rimonta",
  "Vittoria finale": "vittoria",
  "Quando il primo classificato non risponde": "silenzio-primo",
  "Quando l'ultimo classificato non risponde": "silenzio-ultimo",
  "Quando un giocatore non risponde per tre domande consecutive": "silenzio-tre",
  "Quando tanti concorrenti non rispondono": "silenzio-tanti",
};

/**
 * Scenette (battibecchi) → evento che le fa partire.
 * Riempitivi generici: FILLER (rari, solo nei momenti tranquilli); le altre seguono l'evento vero.
 */
const SCENE_EVENT = {
  1: "FILLER",
  2: "FILLER",
  3: "FILLER",
  4: "FILLER",
  5: "FILLER",
  6: "FILLER",
  7: "FILLER",
  8: "FILLER",
  9: "FILLER",
  // "questa domanda è di livello universitario": solo quando sbagliano una domanda difficile
  10: "ANSWER_WRONG",
  11: "LOSE_PATIENCE",
  12: "COMEBACK",
  13: "LOSE_PATIENCE",
  14: "FILLER",
  15: "LOSE_PATIENCE",
  16: "GAME_END",
};
const SCENE_LEVEL = { 2: "sarcastico", 3: "sarcastico", 4: "sarcastico", 6: "sarcastico", 7: "sarcastico", 8: "sarcastico", 10: "sarcastico", 11: "sarcastico", 13: "sarcastico", 15: "sarcastico" };
const SCENE_TAGS = { 10: ["difficile"] };
const SPECIAL_SCENE_EVENT = { 1: "PLAYER_NO_ANSWER", 2: "PLAYER_NO_ANSWER", 3: "TEAM_NO_ANSWER", 4: "PLAYER_NO_ANSWER" };

/**
 * Eccezioni battuta per battuta: chiave "<personaggio>:<sezione-slug>:<numero>".
 * level = livello di comicità; tags = condizioni (vedi src/lib/show/library.ts); anim = animazione.
 */
const OVERRIDES = {
  // ---- Professore ----
  "professore:sbaglia:4": { tags: ["quattro"] },
  "professore:indovina:22": { level: "sarcastico" },
  "professore:indovina:25": { level: "sarcastico" },
  "professore:indovina:26": { level: "sarcastico" },
  "professore:indovina:29": { level: "sarcastico", tags: ["facile"] },
  "professore:indovina:30": { level: "sarcastico" },
  "professore:tempo:32": { tags: ["timer30"] },
  "professore:tempo:36": { tags: ["quattro"] },
  "professore:ruota:37": { level: "sarcastico" },
  "professore:ruota:39": { level: "sarcastico" },
  "professore:ruota:40": { level: "sarcastico" },
  "professore:nomi:42": { level: "sarcastico" },
  "professore:nomi:47": { level: "sarcastico" },
  "professore:tormentone:59": { level: "sarcastico" },
  "professore:tormentone:61": { level: "sarcastico" },
  "professore:tormentone:62": { level: "sarcastico" },
  // ---- Regina ----
  "regina:sbaglia:12": { level: "leggero" },
  "regina:sbaglia:14": { tags: ["tutti"] },
  "regina:sbaglia:16": { level: "leggero" },
  "regina:sbaglia:18": { level: "leggero" },
  "regina:indovina:24": { level: "sarcastico" },
  "regina:ruota:35": { level: "sarcastico" },
  "regina:ruota:37": { level: "sarcastico" },
  "regina:ruota:39": { level: "sarcastico" },
  "regina:tempo:29": { tags: ["countdown"] },
  "regina:nomi:41": { level: "sarcastico" },
  "regina:nomi:45": { level: "sarcastico" },
  "regina:cattivissima:54": { tags: ["squadre"] },
  "regina:tormentone:57": { level: "sarcastico" },
  "regina:tormentone:58": { level: "sarcastico" },
  // ---- Palmino ----
  "palmino:sbaglia:3": { level: "leggero" },
  "palmino:sbaglia:4": { level: "leggero" },
  "palmino:sbaglia:11": { level: "leggero" },
  "palmino:sbaglia:14": { level: "irriverente" },
  "palmino:sbaglia:15": { level: "irriverente" },
  "palmino:sbaglia:20": { tags: ["quattro"] },
  "palmino:indovina:31": { level: "sarcastico" },
  "palmino:indovina:35": { level: "sarcastico" },
  "palmino:tempo:37": { tags: ["countdown"] },
  "palmino:tempo:39": { level: "sarcastico" },
  "palmino:ruota:46": { level: "sarcastico" },
  "palmino:ruota:48": { level: "sarcastico" },
  "palmino:ruota:49": { level: "sarcastico" },
  "palmino:ruota:52": { level: "sarcastico" },
  "palmino:nomi:54": { level: "sarcastico" },
  "palmino:nomi:60": { level: "sarcastico" },
  "palmino:nomi:61": { tags: ["non_finale"] },
  "palmino:nomi:62": { level: "sarcastico" },
  "palmino:classifica:65": { level: "leggero" },
  "palmino:classifica:66": { tags: ["squadre"] },
  "palmino:classifica:67": { level: "leggero", tags: ["rimonta"] },
  "palmino:tormentone:71": { level: "sarcastico" },
  "palmino:tormentone:75": { level: "sarcastico" },
  // ---- annunci speciali ----
  "professore:ultimo:1": { tags: ["non_finale"] },
  "regina:ultimo:1": { tags: ["non_finale"] },
  "palmino:ultimo:1": { level: "sarcastico" },
  "palmino:errata:1": { level: "sarcastico" },
  "palmino:rimonta:1": { level: "sarcastico" },
  // ---- mancate risposte ----
  "regina:silenzio:8": { level: "sarcastico" },
  "regina:silenzio:10": { level: "sarcastico" },
  "professore:silenzio-tanti:1": { level: "sarcastico" },
};

/** Animazione predefinita per evento (gesti esistenti: celebrate, point, surprised, wave, talk, idle). */
const EVENT_ANIM = {
  ANSWER_WRONG: "point",
  EASY_WRONG: "surprised",
  ANSWER_CORRECT: "celebrate",
  LOSE_PATIENCE: "surprised",
  TIME_RUNNING_OUT: "point",
  WHEEL_SPIN: "celebrate",
  LEADER_CHANGED: "celebrate",
  NEW_LAST: "point",
  GAME_WINNER: "celebrate",
  OVERTAKE: "surprised",
  COMEBACK: "surprised",
  ONLY_ONE_CORRECT: "celebrate",
  ONLY_ONE_WRONG: "point",
  FASTEST_CORRECT: "celebrate",
  PLAYER_NO_ANSWER: "point",
  NO_ANSWER_LEADER: "point",
  NO_ANSWER_LAST: "point",
  NO_ANSWER_STREAK: "surprised",
  MANY_NO_ANSWER: "surprised",
  TEAM_NO_ANSWER: "point",
  FILLER: "talk",
  LEADERBOARD_QUIP: "point",
  GAME_END: "celebrate",
};

/** Animazioni e voce di alcune righe delle scenette (indicazioni di scena del testo). */
const SCENE_LINE = {
  "scenetta-07:4": { anim: "surprised" },
  "scenetta-08:4": { anim: "celebrate", tags: ["voce:laughs"] },
  "scenetta-09:4": { anim: "wave" },
  "scenetta-11:1": { tags: ["voce:sighs"] },
  "scenetta-13:1": { anim: "surprised", tags: ["voce:whispers"] },
  // "(La Regina sviene teatralmente.)"
  "scenetta-13:3": { anim: "surprised" },
  "scenetta-15:1": { tags: ["voce:sighs"] },
  // "(Il Professore esce dalla scena.)"
  "scenetta-15:3": { anim: "wave" },
  "scenetta-16:1": { anim: "celebrate" },
  "scenetta-16:3": { anim: "surprised" },
  "scenetta-16:4": { tags: ["voce:laughs"] },
};

const SHOUTED = (t) => {
  const letters = t.replace(/\{[a-z_]+\}/g, "").match(/\p{L}/gu) ?? [];
  const up = letters.filter((c) => c !== c.toLowerCase());
  return letters.length > 0 && up.length / letters.length >= 0.6;
};
const PLURAL = /\b(avete|vi|voi|vostr[aoie]|siete|state|ditemi|preoccupatevi|ragazzi|signori|amori miei|sudditi|segnatevi|incrociate|sbagliare tutti|non esagerate)\b/i;

function level(base, text, over) {
  if (over?.level) return over.level;
  if (/minchia/i.test(text)) return "irriverente";
  return base;
}

function placeholdersOf(text) {
  return [...text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
}

const pad = (n) => String(n).padStart(2, "0");

function main() {
  const md = readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
  const lines = md.split("\n");
  const out = [];
  let part = "main"; // main | noanswer
  let character = null;
  let section = null;
  let special = null; // titolo dell'annuncio speciale
  let scene = null; // { n, key, step, special }
  let mode = null; // characters | scenes | specials | noanswer-char | noanswer-specials | noanswer-scenes

  const push = (row) => {
    if (out.some((r) => r.id === row.id)) throw new Error(`id doppio: ${row.id}`);
    out.push(row);
  };

  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith("# NUOVE BATTUTE")) {
      part = "noanswer";
      mode = null;
      continue;
    }
    let m;
    if ((m = /^## (\d+)\. (.+)$/.exec(l))) {
      const n = Number(m[1]);
      character = n === 1 ? "professore" : n === 2 ? "regina" : n === 3 ? "palmino" : null;
      mode = n <= 3 ? "characters" : n === 4 ? "scenes" : n === 5 ? "specials" : null;
      section = null;
      special = null;
      scene = null;
      continue;
    }
    if (part === "noanswer" && (m = /^## (IL PROFESSORE|LA REGINA|PALMINO)\b/.exec(l))) {
      character = m[1] === "IL PROFESSORE" ? "professore" : m[1] === "LA REGINA" ? "regina" : "palmino";
      mode = "noanswer-char";
      continue;
    }
    if (part === "noanswer" && l.startsWith("## BATTUTE SPECIALI")) {
      mode = "noanswer-specials";
      special = null;
      continue;
    }
    if (part === "noanswer" && l.startsWith("## SCENETTE SPECIALI")) {
      mode = "noanswer-scenes";
      scene = null;
      continue;
    }
    if (l.startsWith("## ")) {
      mode = null;
      continue;
    }
    if ((m = /^### (.+)$/.exec(l))) {
      section = m[1].trim();
      continue;
    }

    if (mode === "characters" && (m = /^(\d+)\. "(.+)"$/.exec(l))) {
      const n = Number(m[1]);
      const text = m[2];
      const slug = SECTION_SLUG[section];
      if (!slug) throw new Error(`sezione sconosciuta: ${section}`);
      const ph = placeholdersOf(text);
      const event = section === "Battute dinamiche con nomi" ? PLACEHOLDER_EVENT[ph[0]] : SECTION_EVENT[section];
      if (!event) throw new Error(`evento sconosciuto per: ${text}`);
      const over = OVERRIDES[`${character}:${slug}:${n}`];
      push(row({ id: `uff-${character}-${slug}-${pad(n)}`, character, event, text, level: level(SECTION_LEVEL[section], text, over), over, source: `${WHO[character]} ${section} n. ${n}` }));
      continue;
    }

    if (mode === "specials" || mode === "noanswer-specials") {
      if (/^[A-Z][^:"]+$/.test(l) && !l.includes('"')) {
        special = l;
        continue;
      }
      if ((m = /^(Professore|Regina|Palmino): "(.+)"$/.exec(l))) {
        const who = SPEAKER[m[1]];
        const text = m[2];
        const event = SPECIAL_EVENT[special];
        const slug = SPECIAL_SLUG[special];
        if (!event || !slug) throw new Error(`annuncio speciale sconosciuto: ${special}`);
        const over = OVERRIDES[`${who}:${slug}:1`];
        const base = mode === "noanswer-specials" ? "sarcastico" : event === "ONLY_ONE_WRONG" ? "sarcastico" : "leggero";
        push(row({ id: `uff-${who}-${slug}`, character: who, event, text, level: level(base, text, over), over, source: `${special} (${m[1]})` }));
      }
      continue;
    }

    if (mode === "noanswer-char" && (m = /^(\d+)\. "(.+)"$/.exec(l))) {
      const n = Number(m[1]);
      const text = m[2];
      const over = OVERRIDES[`${character}:silenzio:${n}`];
      const base = character === "regina" ? "leggero" : "sarcastico";
      push(row({ id: `uff-${character}-silenzio-${pad(n)}`, character, event: "PLAYER_NO_ANSWER", text, level: level(base, text, over), over, source: `mancata risposta ${character} n. ${n}` }));
      continue;
    }

    if (mode === "scenes" || mode === "noanswer-scenes") {
      if ((m = /^Scenetta (\d+) — (.+)$/.exec(l))) {
        const n = Number(m[1]);
        const isSpecial = mode === "noanswer-scenes";
        scene = { n, key: isSpecial ? `silenzio-${pad(n)}` : `scenetta-${pad(n)}`, step: 0, special: isSpecial, title: m[2] };
        continue;
      }
      if (/^\(.+\)$/.test(l)) continue; // indicazione di scena: diventa l'animazione della riga prima
      if (scene && (m = /^(Professore|Regina|Palmino): "(.+)"$/.exec(l))) {
        scene.step++;
        const who = SPEAKER[m[1]];
        const text = m[2];
        const event = scene.special ? SPECIAL_SCENE_EVENT[scene.n] : SCENE_EVENT[scene.n];
        const extra = SCENE_LINE[`${scene.key}:${scene.step}`] ?? {};
        const base = scene.special ? "leggero" : (SCENE_LEVEL[scene.n] ?? "leggero");
        const tags = [...(scene.special ? [] : (SCENE_TAGS[scene.n] ?? [])), ...(extra.tags ?? [])];
        push(
          row({
            id: `uff-${scene.key}-${scene.step}`,
            character: who,
            event,
            text,
            level: base,
            over: { tags, anim: extra.anim },
            scene: { key: `uff-${scene.key}`, step: scene.step },
            source: `${scene.special ? "Scenetta speciale" : "Scenetta"} ${scene.n} — ${scene.title}`,
          }),
        );
      }
    }
  }

  // le scenette hanno un livello unico (il più alto fra le righe)
  const order = ["leggero", "sarcastico", "irriverente"];
  const byScene = new Map();
  for (const r of out) if (r.scene) byScene.set(r.scene.key, [...(byScene.get(r.scene.key) ?? []), r]);
  for (const rows of byScene.values()) {
    const top = rows.map((r) => order.indexOf(r.level)).reduce((a, b) => Math.max(a, b), 0);
    for (const r of rows) r.level = order[top];
  }

  const file = {
    format: "che-ne-sai-battute",
    version: 1,
    origin: "ufficiale",
    source: "content/battute/LIBRERIA-UFFICIALE.md",
    note: "Generato da scripts/build-libreria-ufficiale.mjs: il testo delle battute è quello dell'utente, parola per parola.",
    lines: out,
  };
  writeFileSync(OUT, JSON.stringify(file, null, 2) + "\n", "utf8");
  const scenes = byScene.size;
  console.log(`${out.length} righe (${scenes} scenette) → ${OUT}`);
}

function row({ id, character, event, text, level, over, scene, source }) {
  const tags = new Set(over?.tags ?? []);
  if (PLURAL.test(text)) tags.add("gruppo");
  const anim = over?.anim ?? (SHOUTED(text) && (event === "ANSWER_WRONG" || event === "FILLER") ? "surprised" : EVENT_ANIM[event] ?? "talk");
  return {
    id,
    character,
    event,
    text,
    level,
    tags: [...tags],
    ...(scene ? { scene } : {}),
    tone: "ufficiale",
    intensity: level === "irriverente" ? 3 : level === "sarcastico" ? 2 : 1,
    priority: 60,
    weight: 2,
    // niente ripetizioni nella stessa serata
    cooldownSec: 7200,
    animation: anim,
    source,
  };
}

main();
