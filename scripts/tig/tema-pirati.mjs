#!/usr/bin/env node
/**
 * TAVOLI IN GUERRA! — passaggio al tema «EDIZIONE PIRATI» dei minigiochi.
 *
 * Sostituisce i colori scritti a mano della vecchia palette «war room» (lime #c6ff3d, rosso #ff3b4e, ambra #ffc24a,
 * ciano #6fe7ff, viola #b49cff, notte #0b0d12, ghiaccio #eef2f6, grigio #9aa4b2 e le loro varianti) con i TOKEN
 * del nuovo tema definiti in `src/features/tig/games/kit/tig-games.css` (`--tg-gold`, `--tg-red`, `--tg-teal`…).
 * Tocca solo i colori: niente logica, niente impaginazione.
 *
 *   node scripts/tig/tema-pirati.mjs            applica (ripetibile: la seconda volta non cambia niente)
 *   node scripts/tig/tema-pirati.mjs --dry      mostra cosa cambierebbe, senza scrivere
 *   node scripts/tig/tema-pirati.mjs --check    controlla soltanto: esce con 1 se resta la vecchia palette
 *   node scripts/tig/tema-pirati.mjs <percorsi> limita a file o cartelle
 *
 * Regole:
 *  - classi Tailwind `text-[#c6ff3d]/70` → `text-(--tg-gold)/70` (la variabile vale anche con l'opacità);
 *  - `rgba(198,255,61,0.4)` → `color-mix(in srgb, var(--tg-gold) 40%, transparent)` (con «_» dentro le classi);
 *  - colori nelle stringhe JS e negli attributi SVG → `var(--tg-…)` (funziona anche in fill/stroke/stop-color);
 *  - il ruolo conta: un rosso usato per il TESTO diventa `--tg-red-hi` (contrasto AA su fondo scuro), per i fondi
 *    resta il rosso bandiera `--tg-red`; il testo scuro su oro (`text-[#0b0d12]`) diventa l'inchiostro `--tg-ink`;
 *  - il bianco «freddo» dei testi e dei bordi (`text-white/70`, `border-white/12`, `bg-white/[0.04]`) diventa il
 *    crema del tema (`--tg-cream`); restano bianchi i fondi pieni (`bg-white`) e il testo bianco sui fondi rossi pieni;
 *  - vecchie variabili CSS (`var(--tg-lime)`, `var(--tg-ice)`…) → nuovi nomi.
 * I colori «di scena» (carta degli scontrini, documenti, oggetti) che non sono della vecchia palette restano.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_TARGETS = ["src/features/tig/games/mechanics", "src/features/tig/games/kit"];
const EXT = new Set([".tsx", ".ts", ".css"]);

/**
 * Vecchio colore → token per ruolo. Ruoli: `text` (colore del testo e delle icone), `line` (bordi, contorni,
 * sottolineature, tratti), `fill` (fondi, riempimenti, sfumature, ombre), `js` (stringhe JS e attributi SVG), `css`.
 */
const T = (all, over = {}) => ({ text: all, line: all, fill: all, js: all, css: all, ...over });
const HEX = {
  // lime → oro dei dobloni (accento principale)
  c6ff3d: T("gold"),
  "6f9a00": T("gold-deep"),
  "5f8f00": T("gold-deep"),
  dfff9a: T("gold-hi"),
  f3ffd6: T("gold-pale"),
  "2b3a12": T("gold-dark"),
  // rosso segnale → rosso bandiera (fondi) / rosso chiaro (testi e linee su fondo scuro)
  ff3b4e: T("red", { text: "red-hi", line: "red-hi", js: "red-hi" }),
  ff8c97: T("red-hi"),
  ff9aa4: T("red-hi"),
  c4122a: T("red"),
  "7a0a17": T("red-deep"),
  "2a0207": T("red-ink"),
  // ambra → turchese caraibico (accento freddo)
  ffc24a: T("teal", { text: "teal-hi", js: "teal-hi" }),
  ffd68a: T("teal-pale"),
  // ciano → azzurro laguna; viola → ametista
  "6fe7ff": T("sky"),
  bdf4ff: T("sky-pale"),
  b49cff: T("violet"),
  // ghiaccio → crema; grigio → grigio caldo
  eef2f6: T("cream"),
  "9aa4b2": T("mute"),
  // notte → notte di mare (fondi) / inchiostro (testo scuro su oro, tratti scuri)
  "0b0d12": T("night", { text: "ink", js: "ink", css: "ink" }),
  "0d1018": T("night"),
  "12161f": T("night-2"),
  "11161f": T("night-2"),
  "0f131b": T("night-2"),
  "10141c": T("night-2"),
  "141924": T("night-2"),
  "161b25": T("raised"),
  "1b212c": T("raised"),
  "1d2330": T("raised"),
  "1f2733": T("raised"),
  "1d2430": T("raised"),
  "1a202b": T("raised"),
  "2a3242": T("raised-2"),
  "273041": T("raised-2"),
  "232a36": T("raised-2"),
};

/** stessi colori scritti come rgb(a) */
const RGB = {
  "198,255,61": "c6ff3d",
  "255,59,78": "ff3b4e",
  "255,194,74": "ffc24a",
  "111,231,255": "6fe7ff",
  "180,156,255": "b49cff",
  "238,242,246": "eef2f6",
  "154,164,178": "9aa4b2",
  "11,13,18": "0b0d12",
  "22,27,37": "161b25",
};

const OLD_VARS = {
  "--tg-lime-deep": "--tg-gold-deep",
  "--tg-lime": "--tg-gold",
  "--tg-ice": "--tg-cream",
  "--tg-amber": "--tg-teal",
  "--tg-cyan": "--tg-sky",
  "--tg-steel": "--tg-raised",
};

/** prefisso di utility Tailwind → ruolo del colore */
function roleOf(prefix) {
  if (/^(text|placeholder|caret)$/.test(prefix)) return "text";
  if (/^(border(-[xytrblse])?|outline|ring|ring-offset|decoration|divide|stroke)$/.test(prefix)) return "line";
  return "fill"; // bg, from, via, to, fill, shadow, accent…
}

/** il punto `at` sta dentro un valore arbitrario di una classe Tailwind (`…-[ … ]`, senza spazi)? */
function inClassBracket(src, at) {
  for (let i = at - 1; i >= 0 && at - i < 400; i--) {
    const c = src[i];
    if (c === "[") return true;
    if (c === "]" || /[\s"'`{};]/.test(c)) return false;
  }
  return false;
}

const pct = (a) => `${Math.round(Number(a) * 1000) / 10}%`;

function convert(src, file) {
  const css = file.endsWith(".css");
  let n = 0;
  let out = src;

  // 1) classi Tailwind con il colore tra parentesi quadre: text-[#c6ff3d]/70 → text-(--tg-gold)/70
  out = out.replace(/(?<![\w#-])([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-\[#([0-9a-fA-F]{6})\](\/(?:\[[0-9.]+\]|\d+))?/g, (m, prefix, hex, op) => {
    const map = HEX[hex.toLowerCase()];
    if (!map) return m;
    n++;
    return `${prefix}-(--tg-${map[roleOf(prefix)]})${op ?? ""}`;
  });

  // 2) rgb/rgba della vecchia palette
  out = out.replace(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+)\s*)?\)/g, (m, r, g, b, a, at, whole) => {
    const hex = RGB[`${r},${g},${b}`];
    if (!hex) return m;
    const map = HEX[hex];
    const token = css ? map.css : map.fill;
    n++;
    if (a === undefined || Number(a) >= 1) return `var(--tg-${token})`;
    return inClassBracket(whole, at) ? `color-mix(in_srgb,var(--tg-${token})_${pct(a)},transparent)` : `color-mix(in srgb, var(--tg-${token}) ${pct(a)}, transparent)`;
  });

  // 3) esadecimali rimasti (stringhe JS, attributi SVG, CSS, valori arbitrari delle classi)
  out = out.replace(/#([0-9a-fA-F]{6})(?![0-9a-fA-F])/g, (m, hex, at, whole) => {
    const map = HEX[hex.toLowerCase()];
    if (!map) return m;
    n++;
    if (css) return `var(--tg-${map.css})`;
    return `var(--tg-${inClassBracket(whole, at) ? map.fill : map.js})`;
  });

  // 4) vecchie variabili CSS del kit
  for (const [from, to] of Object.entries(OLD_VARS)) {
    const re = new RegExp(`${from}(?![\\w-])`, "g");
    out = out.replace(re, () => {
      n++;
      return to;
    });
  }

  // 5) bianco freddo → crema (testi, bordi, veli); restano i fondi bianchi pieni e il testo bianco sui fondi rossi pieni
  if (!css) {
    out = out.replace(/(["'`])((?:(?!\1)[^\n])*)\1/g, (lit, q, body) => {
      if (!/-white\b/.test(body)) return lit;
      const onRed = /(?<![\w-])bg-\(--tg-red\)(?!\/)/.test(body);
      const next = body.replace(/(?<![\w-])(text|bg|border(?:-[xytrbl])?|divide|ring|outline|from|via|to)-white(\/(?:\[[0-9.]+\]|\d+))?(?![\w-])/g, (m, util, op) => {
        if (util === "bg" && !op) return m; // fondo bianco pieno (QR, carta)
        if (util === "text" && onRed) return m; // bianco su rosso pieno: contrasto più alto del crema
        n++;
        return `${util}-(--tg-cream)${op ?? ""}`;
      });
      return `${q}${next}${q}`;
    });
  }

  return { out, n };
}

/** cosa resta della vecchia palette (per il controllo) */
function leftovers(src, file) {
  const found = [];
  const lines = src.split("\n");
  const hexRe = new RegExp(`#(${Object.keys(HEX).join("|")})(?![0-9a-fA-F])`, "gi");
  const rgbRe = new RegExp(`rgba?\\(\\s*(${Object.keys(RGB).map((k) => k.split(",").join("\\s*,\\s*")).join("|")})\\s*[,)]`, "g");
  const varRe = new RegExp(`(${Object.keys(OLD_VARS).join("|")})(?![\\w-])`, "g");
  lines.forEach((line, i) => {
    for (const re of [hexRe, rgbRe, varRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) found.push(`${file}:${i + 1}: ${m[0]}`);
    }
    if (!file.endsWith(".css")) {
      const w = /(?<![\w-])(text|border|divide|ring|outline)-white(\/(?:\[[0-9.]+\]|\d+))?(?![\w-])|(?<![\w-])bg-white\/(?:\[[0-9.]+\]|\d+)/g;
      let m;
      while ((m = w.exec(line))) {
        if (m[1] === "text" && !m[2] && /bg-\(--tg-red\)(?!\/)/.test(line)) continue; // eccezione voluta
        found.push(`${file}:${i + 1}: ${m[0]}`);
      }
    }
  });
  return found;
}

function walk(p, acc) {
  const st = statSync(p);
  if (st.isDirectory()) for (const f of readdirSync(p)) walk(path.join(p, f), acc);
  else if (EXT.has(path.extname(p)) && !p.endsWith(".d.ts")) acc.push(p);
  return acc;
}

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const check = args.includes("--check");
const targets = args.filter((a) => !a.startsWith("--"));
const files = (targets.length ? targets : DEFAULT_TARGETS).flatMap((t) => walk(path.resolve(ROOT, t), []));

let changedFiles = 0;
let total = 0;
const left = [];
for (const abs of files) {
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  const src = readFileSync(abs, "utf8");
  if (!check) {
    const { out, n } = convert(src, rel);
    if (n && out !== src) {
      changedFiles++;
      total += n;
      if (!dry) writeFileSync(abs, out);
      console.log(`${dry ? "cambierebbe" : "aggiornato"} ${rel} (${n})`);
    }
    left.push(...leftovers(out, rel));
  } else {
    left.push(...leftovers(src, rel));
  }
}

if (!check) console.log(`\n${files.length} file esaminati · ${changedFiles} ${dry ? "da cambiare" : "aggiornati"} · ${total} sostituzioni`);
if (left.length) {
  console.log(`\nResta la vecchia palette in ${left.length} punti:`);
  for (const l of left) console.log(`  ${l}`);
  if (check) process.exit(1);
} else {
  console.log("Controllo: nessun colore della vecchia palette nei file esaminati.");
}
