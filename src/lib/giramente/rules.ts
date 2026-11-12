/**
 * GIRAMENTE! – regole pure (nessun accesso al database), usate dal server (fonte di verità) e,
 * solo per la visualizzazione, dai client. Testate in tests/unit/giramente.test.ts.
 *
 * Qui: punteggi, normalizzazione delle risposte, tabellone (maschera della frase), geometria della
 * ruota, classifica con posizioni condivise, spareggio, stima della durata, pulizia dei nomi.
 */
import type { BoardCellData, DeviceMode, GameMode, JollyPower, PuzzleKind, Risk, Settings, Standing, WheelKind } from "./types";
import { NICKNAME_MAX, TEAM_NAME_MAX } from "./types";

// ---------------------------------------------------------------------------
// Ruota
// ---------------------------------------------------------------------------
/** Spicchi della ruota standard (manche 1 e 3), in senso orario a partire dalla freccia. */
export const STANDARD_WHEEL: WheelKind[] = ["intruso", "sequenza", "indizi", "prospettiva", "mistero", "jolly", "bonus", "colpo"];
/** Ruota del GIRO DECISIVO: quattro categorie ripetute due volte, niente Jolly/Bonus/Colpo. */
export const FINALE_WHEEL: WheelKind[] = ["intruso", "sequenza", "indizi", "prospettiva", "intruso", "sequenza", "indizi", "prospettiva"];

export const WHEEL_LABEL: Record<WheelKind, string> = {
  intruso: "INTRUSO",
  sequenza: "SEQUENZA",
  indizi: "INDIZI",
  prospettiva: "PROSPETTIVA",
  mistero: "MISTERO",
  jolly: "JOLLY",
  bonus: "BONUS",
  colpo: "COLPO DI SCENA",
};

export const WHEEL_DESCRIPTION: Record<WheelKind, string> = {
  intruso: "Trova l'elemento che non appartiene al gruppo.",
  sequenza: "Completa la sequenza logica.",
  indizi: "Arriva alla soluzione dagli indizi.",
  prospettiva: "Osserva bene: un enigma visivo.",
  mistero: "Una prova a sorpresa: la categoria si scopre solo ora.",
  jolly: "Entra la Jolly e ti offre un vantaggio.",
  bonus: "Se rispondi giusto, +100 punti in più.",
  colpo: "Una sfida lampo: meno tempo, +100 se indovini.",
};

export const PUZZLE_KIND_LABEL: Record<PuzzleKind, string> = { intruso: "Intruso", sequenza: "Sequenza", indizi: "Indizi", prospettiva: "Prospettiva" };

/** Tipo di enigma assegnato a uno spicchio (gli spicchi speciali assegnano comunque una prova compatibile). */
export function puzzleKindFor(sector: WheelKind, random: (n: number) => number): PuzzleKind {
  if (sector === "intruso" || sector === "sequenza" || sector === "indizi" || sector === "prospettiva") return sector;
  const kinds: PuzzleKind[] = ["intruso", "sequenza", "indizi", "prospettiva"];
  return kinds[random(kinds.length)];
}

const TAU = Math.PI * 2;
const normAngle = (a: number) => ((a % TAU) + TAU) % TAU;

/** Hash FNV-1a a 32 bit (deterministico, uguale su tutti i client). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Geometria della ruota (convenzione unica): rotazione θ in radianti, positiva in senso orario.
 * Lo spicchio i occupa l'arco [i·s, (i+1)·s] in senso orario dalla freccia (in alto) a ruota ferma.
 * Con la ruota ruotata di θ, sotto la freccia c'è l'angolo della ruota (−θ).
 */
export function segmentAtAngle(theta: number, n: number): number {
  const s = TAU / n;
  return Math.floor(normAngle(-theta) / s) % n;
}

/** Angolo di riposo con il centro (o un punto del) spicchio `index` sotto la freccia. */
export function restAngle(index: number, n: number, frac = 0.5): number {
  return normAngle(-((index + frac) * (TAU / n)));
}

/** Accelerazione breve, giro fluido, rallentamento lungo fino all'arresto. */
export function spinEase(k: number): number {
  const x = Math.min(1, Math.max(0, k));
  const out = 1 - Math.pow(1 - x, 4);
  const windup = Math.min(1, x / 0.1);
  return out * (0.35 + 0.65 * windup * windup);
}

export interface SpinPlan {
  /** angolo finale (assoluto, a partire da `from`) */
  to: number;
  turns: number;
  frac: number;
}

/**
 * Piano del giro deciso dal SERVER (spinId + spicchio): giri e punto d'arresto dentro lo spicchio
 * derivano dallo spinId, quindi tutti i client fermano la ruota nello stesso punto.
 */
export function planSpin(spinId: string, targetIndex: number, n: number, from = 0): SpinPlan {
  const h = hash32(spinId);
  const frac = 0.22 + 0.56 * ((h % 1000) / 1000);
  const turns = 5 + (h % 3);
  const target = restAngle(targetIndex, n, frac);
  let delta = target - normAngle(from);
  if (delta < 0) delta += TAU;
  return { to: from + turns * TAU + delta, turns, frac };
}

/** Angolo della ruota in un istante (chi arriva a metà giro lo ricostruisce dal tempo trascorso). */
export function spinAngleAt(spin: { spinId: string; targetIndex: number; startedAt: number; durationMs: number }, n: number, nowMs: number, from = 0): number {
  const plan = planSpin(spin.spinId, spin.targetIndex, n, from);
  const k = (nowMs - spin.startedAt) / spin.durationMs;
  if (k <= 0) return from;
  if (k >= 1) return plan.to;
  return from + (plan.to - from) * spinEase(k);
}

// ---------------------------------------------------------------------------
// Punteggi
// ---------------------------------------------------------------------------
export const RISK_POINTS: Record<number, Record<Risk, { win: number; lose: number }>> = {
  1: { verde: { win: 150, lose: 0 }, rosso: { win: 300, lose: 100 } },
  3: { verde: { win: 200, lose: 0 }, rosso: { win: 400, lose: 150 } },
};
export const BONUS_POINTS = 100;
export const LAMPO_POINTS = 100;
export const JOLLY_DUPLICATE_POINTS = 50;
export const FALSA_POINTS = 100;
export const FALSA_SOLUTION_POINTS = 100;
export const COLLEGAMENTO_POINTS = { clean: 250, withClue: 100 };
export const TABELLONE = { max: 250, min: 100, letterCost: 25, hintCost: 50, maxLetters: 4 };
export const FINALE_POINTS = [600, 400, 200];
/** Massimo teorico senza bonus: 300 + 400 + 400 + 500 + 600 */
export const MAX_THEORETICAL = 2200;

export interface ScoreLine {
  kind: "award" | "bonus" | "lampo" | "penalty" | "shield";
  label: string;
  delta: number;
}

/** Esito di una giocata alla ruota (manche 1 e 3). */
export function scoreWheelTurn(o: { roundNo: number; risk: Risk; correct: boolean; bonus: boolean; lampo: boolean; jolly: JollyPower | null }): { lines: ScoreLine[]; shieldUsed: boolean } {
  const t = RISK_POINTS[o.roundNo] ?? RISK_POINTS[1];
  const p = t[o.risk];
  const lines: ScoreLine[] = [];
  if (o.correct) {
    lines.push({ kind: "award", label: o.risk === "rosso" ? "Risposta giusta in ROSSO" : "Risposta giusta in VERDE", delta: p.win });
    if (o.bonus) lines.push({ kind: "bonus", label: "Bonus", delta: BONUS_POINTS });
    if (o.lampo) lines.push({ kind: "lampo", label: "Sfida lampo", delta: LAMPO_POINTS });
    return { lines, shieldUsed: false };
  }
  if (o.risk === "rosso" && p.lose > 0) {
    // lo SCUDO annulla solo la penalità (non rende giusta la risposta, non dà punti)
    if (o.jolly === "scudo") return { lines: [{ kind: "shield", label: "Penalità annullata dallo Scudo", delta: 0 }], shieldUsed: true };
    lines.push({ kind: "penalty", label: "Penalità del ROSSO", delta: -p.lose });
  }
  return { lines, shieldUsed: false };
}

/** Punti in palio prima della risposta (manche con la ruota). */
export function wheelStake(roundNo: number, risk: Risk | null, bonus: boolean, lampo: boolean): number {
  if (!risk) return 0;
  const t = RISK_POINTS[roundNo] ?? RISK_POINTS[1];
  return t[risk].win + (bonus ? BONUS_POINTS : 0) + (lampo ? LAMPO_POINTS : 0);
}

export function finalePoints(clueLevel: number): number {
  return FINALE_POINTS[Math.min(FINALE_POINTS.length, Math.max(1, clueLevel)) - 1];
}

export function tabellonePoints(lettersUsed: number, hintsUsed: number): number {
  return Math.max(TABELLONE.min, TABELLONE.max - lettersUsed * TABELLONE.letterCost - hintsUsed * TABELLONE.hintCost);
}

export function collegamentoPoints(extraUsed: boolean): number {
  return extraUsed ? COLLEGAMENTO_POINTS.withClue : COLLEGAMENTO_POINTS.clean;
}

/** Il punteggio non scende mai sotto zero: variazione realmente applicata. */
export function applyFloor(score: number, delta: number): { score: number; applied: number } {
  const next = Math.max(0, score + delta);
  return { score: next, applied: next - score };
}

// ---------------------------------------------------------------------------
// Classifica e spareggio
// ---------------------------------------------------------------------------
/** Posizioni condivise a parità (1, 1, 3…), ordinamento stabile per posto (nessun vantaggio arbitrario). */
export function computeStandings(list: { id: string; score: number; seat: number }[]): Standing[] {
  const sorted = [...list].sort((a, b) => b.score - a.score || a.seat - b.seat);
  return sorted.map((c) => ({ competitorId: c.id, score: c.score, position: 1 + sorted.filter((x) => x.score > c.score).length }));
}

/** Concorrenti a pari merito al primo posto (spareggio se più di uno). */
export function tiedLeaders(standings: Standing[]): string[] {
  const top = standings.filter((s) => s.position === 1);
  return top.length > 1 ? top.map((s) => s.competitorId) : [];
}

/**
 * Spareggio: vince chi fa più punti con l'enigma progressivo (stessi criteri: 600/400/200).
 * Ancora parità (o tutti a zero) → nuovo enigma. Dal terzo spareggio, a parità di punti (>0)
 * vince chi ha risposto giusto più in fretta (stesso enigma, stesso tempo per tutti).
 */
export function resolveTiebreak(results: { competitorId: string; points: number; elapsedMs: number | null }[], tiebreakNo: number): string | null {
  if (results.length === 0) return null;
  const best = Math.max(...results.map((r) => r.points));
  if (best <= 0) return null;
  const leaders = results.filter((r) => r.points === best);
  if (leaders.length === 1) return leaders[0].competitorId;
  if (tiebreakNo < 3) return null;
  const times = leaders.filter((r) => r.elapsedMs !== null).sort((a, b) => a.elapsedMs! - b.elapsedMs!);
  if (times.length >= 2 && times[0].elapsedMs! < times[1].elapsedMs!) return times[0].competitorId;
  if (times.length === 1) return times[0].competitorId;
  return null;
}

// ---------------------------------------------------------------------------
// Normalizzazione delle risposte
// ---------------------------------------------------------------------------
const ARTICLES = new Set(["il", "lo", "la", "i", "gli", "le", "l", "un", "uno", "una"]);

/** minuscole, senza accenti, apostrofi e punteggiatura come spazi, spazi compattati */
export function normalizeAnswer(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘`´']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Toglie un articolo iniziale («il libro» → «libro», «l'acqua» → «acqua»). */
export function stripLeadingArticle(norm: string): string {
  const parts = norm.split(" ");
  if (parts.length > 1 && ARTICLES.has(parts[0])) return parts.slice(1).join(" ");
  return norm;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Risposta scritta giusta? Confronto con la soluzione e le varianti ammesse, dopo la normalizzazione
 * (maiuscole, accenti, apostrofi, spazi, articolo iniziale). Piccoli errori di battitura tollerati
 * SOLO su parole lunghe senza cifre (1 lettera da 8 caratteri, 2 da 15): mai su numeri o parole
 * brevi, dove un errore cambierebbe il significato.
 */
export function matchAnswer(given: unknown, solution: string, accepted: string[] = [], opts: { articles?: boolean; typos?: boolean } = {}): boolean {
  const articles = opts.articles ?? true;
  const typos = opts.typos ?? true;
  const g = normalizeAnswer(given);
  if (!g) return false;
  const gs = articles ? stripLeadingArticle(g) : g;
  const cands = new Set<string>();
  for (const c of [solution, ...accepted]) {
    const n = normalizeAnswer(c);
    if (!n) continue;
    cands.add(n);
    if (articles) cands.add(stripLeadingArticle(n));
    // spazi facoltativi («arcobaleno» = «arco baleno» no, ma «new york» = «newyork» sì)
    cands.add(n.replace(/ /g, ""));
  }
  if (cands.has(g) || cands.has(gs) || cands.has(g.replace(/ /g, ""))) return true;
  if (!typos || /\d/.test(gs)) return false;
  for (const c of cands) {
    if (/\d/.test(c) || c.length < 8) continue;
    const max = c.length >= 15 ? 2 : 1;
    if (Math.abs(c.length - gs.length) > max) continue;
    if (levenshtein(gs, c) <= max) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tabellone segreto: la frase non lascia MAI il server; ai client vanno solo le lettere scoperte
// ---------------------------------------------------------------------------
export const BOARD_ROW_MAX = 12;

/** Lettera "base" (senza accento): svelando la E si scoprono anche È ed É. */
export function letterKey(ch: string): string {
  return ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}
const isLetter = (ch: string) => /\p{L}/u.test(ch);

/** Parole della frase divise in righe (al massimo BOARD_ROW_MAX caselle per riga, senza spezzare le parole). */
export function boardLayout(phrase: string): string[][] {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const rows: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const w of words) {
    const wl = [...w].length;
    if (cur.length && len + 1 + wl > BOARD_ROW_MAX) {
      rows.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(w);
    len += (cur.length > 1 ? 1 : 0) + wl;
  }
  if (cur.length) rows.push(cur);
  return rows;
}

/** Caselle del tabellone con le sole lettere scoperte (le altre: char null). */
export function maskBoard(phrase: string, revealed: Iterable<string>, justRevealed: Iterable<string> = []): BoardCellData[][] {
  const rev = new Set([...revealed].map(letterKey));
  const just = new Set([...justRevealed].map(letterKey));
  return boardLayout(phrase).map((words) => {
    const row: BoardCellData[] = [];
    words.forEach((w, i) => {
      if (i > 0) row.push({ kind: "space" });
      for (const ch of [...w]) {
        if (!isLetter(ch)) row.push({ kind: "punct", char: ch });
        else {
          const k = letterKey(ch);
          row.push(rev.has(k) ? (just.has(k) ? { kind: "letter", char: ch, justRevealed: true } : { kind: "letter", char: ch }) : { kind: "letter", char: null });
        }
      }
    });
    return row;
  });
}

/** Lettere (base) presenti nella frase, con quante caselle occupano. */
export function letterCounts(phrase: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const ch of [...phrase]) if (isLetter(ch)) m.set(letterKey(ch), (m.get(letterKey(ch)) ?? 0) + 1);
  return m;
}

/**
 * Lettere mostrate all'inizio: circa un quarto delle caselle (mai più del 35%), almeno una lettera,
 * scelte a caso (dal server) tra quelle della frase.
 */
export function initialLetters(phrase: string, random: (n: number) => number): string[] {
  const counts = letterCounts(phrase);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const keys = [...counts.keys()];
  // mescolamento con il generatore del server
  for (let i = keys.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const out: string[] = [];
  let shown = 0;
  for (const k of keys) {
    const c = counts.get(k)!;
    if (out.length > 0 && shown + c > total * 0.35) continue;
    if (shown + c > total * 0.5) continue;
    out.push(k);
    shown += c;
    if (shown >= total * 0.25) break;
  }
  if (out.length === 0 && keys.length > 0) out.push(keys[0]);
  return out;
}

/** Lettere ancora coperte. */
export function hiddenLetters(phrase: string, revealed: Iterable<string>): string[] {
  const rev = new Set([...revealed].map(letterKey));
  return [...letterCounts(phrase).keys()].filter((k) => !rev.has(k));
}

/** Si può ancora svelare una lettera? (massimo 4, e restano almeno 3 lettere diverse coperte) */
export function canRevealLetter(phrase: string, revealed: Iterable<string>, lettersUsed: number): boolean {
  return lettersUsed < TABELLONE.maxLetters && hiddenLetters(phrase, revealed).length > 2;
}

export function matchPhrase(given: unknown, phrase: string, accepted: string[] = []): boolean {
  return matchAnswer(given, phrase, accepted, { articles: false, typos: true });
}

// ---------------------------------------------------------------------------
// Nomi
// ---------------------------------------------------------------------------
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g;

export type NameCheck = { ok: true; value: string } | { ok: false; message: string };

function cleanName(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFC")
    .replace(INVISIBLE, " ")
    .replace(/[<>{}\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nickname: 1–20 caratteri visibili, niente markup (si mostra sempre come testo). */
export function checkNickname(raw: unknown): NameCheck {
  const v = cleanName(raw);
  if (!v) return { ok: false, message: "Scrivi un nome" };
  if ([...v].length > NICKNAME_MAX) return { ok: false, message: `Il nome può avere al massimo ${NICKNAME_MAX} caratteri` };
  return { ok: true, value: v };
}

export function checkTeamName(raw: unknown): NameCheck {
  const v = cleanName(raw);
  if (!v) return { ok: false, message: "Scrivi il nome della squadra" };
  if ([...v].length > TEAM_NAME_MAX) return { ok: false, message: `Il nome della squadra può avere al massimo ${TEAM_NAME_MAX} caratteri` };
  return { ok: true, value: v };
}

export function normalizeRoomCode(raw: string): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
export const isRoomCode = (c: string) => /^[A-Z2-9]{6}$/.test(c);

// ---------------------------------------------------------------------------
// Durata stimata (mostrata in configurazione)
// ---------------------------------------------------------------------------
/**
 * Stima realistica (minuti): cresce con i concorrenti; con un solo dispositivo le prove a turno
 * (Falsa Pista, Collegamento, Tabellone) si giocano una persona alla volta.
 */
export function estimateMinutes(n: number, devices: DeviceMode, _mode: GameMode, s: Pick<Settings, "answerSec" | "falsaSec" | "collegamentoSec" | "tabelloneSec" | "finaleSec" | "quickIntros">): { min: number; max: number } {
  const c = Math.max(2, n);
  const intro = s.quickIntros ? 8 : 18;
  const wheelTurn = 8 + 7 + 4 + s.answerSec * 0.6 + 8; // scelta, giro, esito, risposta, risultato
  const finaleTurn = 7 + 4 + s.finaleSec * 0.6 + 8;
  const results = 15;
  let sec = 40 + 5 * (intro + results) + 2 * c * wheelTurn + c * finaleTurn;
  if (devices === "personal") sec += s.falsaSec * 0.85 + 15 + s.collegamentoSec * 0.8 + 12 + s.tabelloneSec * 0.8 + 15;
  else sec += c * (s.falsaSec * 0.75 + 10) + c * (s.collegamentoSec * 0.7 + 10) + c * (s.tabelloneSec * 0.7 + 10) + 3 * 12;
  const mid = sec / 60;
  return { min: Math.max(10, Math.round(mid * 0.85)), max: Math.round(mid * 1.2) };
}

// ---------------------------------------------------------------------------
// Testi
// ---------------------------------------------------------------------------
export function formatPoints(n: number): string {
  // sempre il punto delle migliaia (2.050), come nel mockup
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatClock(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Millisecondi rimasti di un timer (riferiti all'ora del server). */
export function remaining(timer: { deadlineAt: string | null }, nowMs: number): number | null {
  if (!timer.deadlineAt) return null;
  return Math.max(0, Date.parse(timer.deadlineAt) - nowMs);
}
