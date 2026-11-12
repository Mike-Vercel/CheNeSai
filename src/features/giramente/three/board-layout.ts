import type { BoardCell } from "./types";

/**
 * IL TABELLONE SEGRETO — impaginazione PURA (testata, usabile anche dal server).
 *
 * Il tabellone riceve solo la FORMA della frase: caselle lettera (char null = coperta), spazi e
 * punteggiatura (sempre visibile). Qui le parole vanno a capo senza mai spezzarsi (salvo parole più
 * lunghe di una riga intera) e le righe vengono bilanciate: stesso numero di righe del "a capo" goloso,
 * ma larghezze il più simili possibile.
 */

export type BoardWord = BoardCell[];

/** Lettera (anche accentata) o cifra: va coperta. Tutto il resto che non è spazio è punteggiatura visibile. */
const LETTER = /[\p{L}\p{N}]/u;
const SPACE = /\s/u;

/** Maiuscola italiana ("è" → "È"). */
export function boardUpper(ch: string): string {
  return ch.toLocaleUpperCase("it-IT");
}

/** Lettera base senza accento, maiuscola ("È" → "E"): è la lettera che si "svela". */
export function letterBase(ch: string): string {
  return boardUpper(ch).normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Dalla frase alle caselle (una sola riga: l'a capo lo fa layoutBoard). Le lettere la cui lettera base è in
 * `revealed` sono scoperte (con il loro accento), le altre restano coperte (char null).
 * Solo per anteprime/test o per il SERVER: al client deve arrivare già mascherata.
 */
export function maskPhrase(phrase: string, revealed: Iterable<string>, justRevealed: Iterable<string> = []): BoardCell[][] {
  const shown = new Set([...revealed].map(letterBase));
  const fresh = new Set([...justRevealed].map(letterBase));
  const row: BoardCell[] = [];
  for (const raw of phrase.normalize("NFC").trim()) {
    if (SPACE.test(raw)) {
      if (row.length > 0 && row[row.length - 1].kind !== "space") row.push({ kind: "space" });
    } else if (LETTER.test(raw)) {
      const base = letterBase(raw);
      const visible = shown.has(base);
      row.push({ kind: "letter", char: visible ? boardUpper(raw) : null, ...(visible && fresh.has(base) ? { justRevealed: true } : {}) });
    } else {
      // apostrofo tipografico → dritto, il resto com'è
      row.push({ kind: "punct", char: raw === "’" || raw === "`" ? "'" : raw });
    }
  }
  return [row];
}

/** Parole (sequenze senza spazi); anche la fine di una riga data separa due parole. */
export function boardWords(rows: BoardCell[][]): BoardWord[] {
  const words: BoardWord[] = [];
  for (const row of rows) {
    let cur: BoardWord = [];
    for (const cell of row) {
      if (cell.kind === "space") {
        if (cur.length) words.push(cur);
        cur = [];
      } else cur.push(cell);
    }
    if (cur.length) words.push(cur);
  }
  return words;
}

/** "A capo" goloso con al massimo `maxCols` caselle per riga (spazio tra parole = 1 casella). */
function greedy(words: BoardWord[], maxCols: number): BoardWord[][] {
  const lines: BoardWord[][] = [];
  let line: BoardWord[] = [];
  let len = 0;
  for (const w of words) {
    const add = line.length ? len + 1 + w.length : w.length;
    if (line.length && add > maxCols) {
      lines.push(line);
      line = [w];
      len = w.length;
    } else {
      line.push(w);
      len = add;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Parole più lunghe di una riga: spezzate in pezzi da `maxCols` (caso raro). */
function splitLong(words: BoardWord[], maxCols: number): BoardWord[] {
  const out: BoardWord[] = [];
  for (const w of words) {
    if (w.length <= maxCols) out.push(w);
    else for (let i = 0; i < w.length; i += maxCols) out.push(w.slice(i, i + maxCols));
  }
  return out;
}

/**
 * Righe del tabellone: parole intere, al massimo `maxCols` caselle per riga, righe bilanciate.
 * Tra due parole sulla stessa riga c'è una casella { kind: "space" }.
 */
export function layoutBoard(rows: BoardCell[][], maxCols: number): BoardCell[][] {
  const cols = Math.max(1, Math.floor(maxCols));
  const words = splitLong(boardWords(rows), cols);
  if (words.length === 0) return [];
  const lines = greedy(words, cols);
  // bilanciamento: la larghezza più stretta che non aggiunge righe
  const longest = Math.max(...words.map((w) => w.length));
  let best = lines;
  for (let c = cols - 1; c >= longest; c--) {
    const l = greedy(words, c);
    if (l.length > lines.length) break;
    best = l;
  }
  return best.map((line) => {
    const row: BoardCell[] = [];
    line.forEach((w, i) => {
      if (i > 0) row.push({ kind: "space" });
      row.push(...w);
    });
    return row;
  });
}

/** Colonne massime consigliate per una larghezza in pixel (caselle leggibili su telefono, PC, TV). */
export function boardColumnsFor(widthPx: number): number {
  if (widthPx < 420) return 10;
  if (widthPx < 700) return 12;
  if (widthPx < 1100) return 14;
  return 16;
}
