/**
 * PSYCO – logica pura (nessun accesso al database): validazioni, timer, rotazione, votazioni.
 * Usata dal server (fonte di verità) e, per la sola visualizzazione, dai client. Testata in tests/unit/psyco.test.ts.
 */
import { NICKNAME_MAX, RULE_TEXT_MAX, TIMER_MAX_MS, type PublicTimer } from "./types";

// ---------------------------------------------------------------------------
// Testi scritti dagli utenti
// ---------------------------------------------------------------------------
/** caratteri di controllo e invisibili (a capo compresi: nickname e regole stanno su una riga) */
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g;

function clean(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFC")
    .replace(INVISIBLE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type TextCheck = { ok: true; value: string } | { ok: false; message: string };

/** Nickname: 1–20 caratteri visibili, niente simboli di markup (si mostra sempre come testo). */
export function checkNickname(raw: unknown): TextCheck {
  const v = clean(raw).replace(/[<>]/g, "");
  if (!v) return { ok: false, message: "Scrivi un nickname" };
  if ([...v].length > NICKNAME_MAX) return { ok: false, message: `Il nickname può avere al massimo ${NICKNAME_MAX} caratteri` };
  return { ok: true, value: v };
}

/**
 * Regola scritta dai giocatori: obbligatoria, 8–280 caratteri, su una riga.
 * Protezione XSS: il testo è SEMPRE mostrato come testo (React lo esegue l'escape); qui si tolgono
 * comunque caratteri invisibili e di controllo che servirebbero solo a confondere.
 */
export function checkRuleText(raw: unknown): TextCheck {
  const v = clean(raw);
  if (!v) return { ok: false, message: "Scrivi la regola prima di inviarla" };
  if ([...v].length < 8) return { ok: false, message: "La regola è troppo corta: spiegala in una frase" };
  if ([...v].length > RULE_TEXT_MAX) return { ok: false, message: `La regola può avere al massimo ${RULE_TEXT_MAX} caratteri` };
  return { ok: true, value: v };
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------
export type TimerCheck = { ok: true; ms: number | null } | { ok: false; message: string };

/**
 * Minuti e secondi scelti liberamente (01:30, 04:25, 12:10…) oppure SENZA LIMITE.
 * minuti ≥ 0 (interi), secondi 0–59, durata > 0. Unico tetto: 24 ore (limite tecnico, la stanza
 * senza attività si chiude dopo 24 ore).
 */
export function timerFromParts(minutes: unknown, seconds: unknown, unlimited: boolean): TimerCheck {
  if (unlimited) return { ok: true, ms: null };
  const m = typeof minutes === "number" ? minutes : Number(String(minutes ?? "").trim() || "0");
  const s = typeof seconds === "number" ? seconds : Number(String(seconds ?? "").trim() || "0");
  if (!Number.isInteger(m) || m < 0) return { ok: false, message: "I minuti devono essere un numero intero da 0 in su" };
  if (!Number.isInteger(s) || s < 0 || s > 59) return { ok: false, message: "I secondi vanno da 0 a 59" };
  const ms = (m * 60 + s) * 1000;
  if (ms <= 0) return { ok: false, message: "Con il timer attivo la durata deve essere maggiore di zero" };
  if (ms > TIMER_MAX_MS) return { ok: false, message: "Durata massima 24 ore (le stanze inattive si chiudono dopo un giorno)" };
  return { ok: true, ms };
}

export function timerParts(ms: number | null): { minutes: number; seconds: number; unlimited: boolean } {
  if (ms === null) return { minutes: 0, seconds: 0, unlimited: true };
  const total = Math.round(ms / 1000);
  return { minutes: Math.floor(total / 60), seconds: total % 60, unlimited: false };
}

/** 90 000 → "01:30"; 3 725 000 → "1:02:05" */
export function formatClock(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "Senza limite";
  return formatClock(ms);
}

const t = (iso: string | null) => (iso ? Date.parse(iso) : null);

/** Tempo di gioco trascorso (escluse le pause e il conto alla rovescia), riferito all'ora del server. */
export function elapsedMs(timer: PublicTimer, nowMs: number): number {
  const start = t(timer.startedAt);
  if (start === null) return 0;
  const until = t(timer.pausedAt) ?? nowMs;
  return Math.max(0, until - start - timer.pausedMs);
}

/** Tempo che resta (null = senza limite). */
export function remainingMs(timer: PublicTimer, nowMs: number): number | null {
  if (timer.totalMs === null) return null;
  return Math.max(0, timer.totalMs - elapsedMs(timer, nowMs));
}

/** Millisecondi al via (conto alla rovescia prima della manche): > 0 = non ancora iniziata. */
export function countdownMs(timer: PublicTimer, nowMs: number): number {
  const start = t(timer.startedAt);
  return start === null ? 0 : Math.max(0, start - nowMs);
}

export function isExpired(timer: PublicTimer, nowMs: number): boolean {
  if (timer.totalMs === null || timer.pausedAt || !timer.startedAt) return false;
  return remainingMs(timer, nowMs) === 0;
}

// ---------------------------------------------------------------------------
// Rotazione dello PSYCO
// ---------------------------------------------------------------------------
export interface RotationCandidate {
  id: string;
  psycoCount: number;
  lastPsycoRound: number | null;
  seat: number;
}

/**
 * Rotazione equa: prima chi è stato PSYCO meno volte (con 5 giocatori tutti lo fanno una volta
 * prima di ricominciare), a parità chi lo è stato meno di recente (mai = prima di tutti), poi a caso.
 */
export function pickPsyco(candidates: RotationCandidate[], random: () => number = Math.random): string | null {
  if (candidates.length === 0) return null;
  const minCount = Math.min(...candidates.map((c) => c.psycoCount));
  let pool = candidates.filter((c) => c.psycoCount === minCount);
  const last = (c: RotationCandidate) => c.lastPsycoRound ?? -1;
  const oldest = Math.min(...pool.map(last));
  pool = pool.filter((c) => last(c) === oldest);
  return pool[Math.floor(random() * pool.length) % pool.length].id;
}

// ---------------------------------------------------------------------------
// Votazioni
// ---------------------------------------------------------------------------
/**
 * Sì/No a maggioranza degli aventi diritto (accettare la regola proposta, giudicare il tentativo):
 *  - decisione anticipata quando l'esito è già certo (più della metà degli aventi diritto);
 *  - a votazione completa (o chiusa dall'host): sì > no → "yes", no > sì → "no", pari → "tie".
 *  - null = si aspetta ancora.
 */
export function resolveYesNo(yes: number, no: number, eligible: number, complete: boolean): "yes" | "no" | "tie" | null {
  if (yes * 2 > eligible) return "yes";
  if (no * 2 > eligible) return "no";
  if (!complete) return null;
  if (yes > no) return "yes";
  if (no > yes) return "no";
  return "tie";
}

/**
 * Pluralità tra più opzioni (difficoltà, proposte): vince chi ha più voti. Decisione anticipata se
 * un'opzione ha già più della metà degli aventi diritto. A votazione completa con parità: `tie`
 * contiene le opzioni pari merito (spareggio o sorteggio, deciso da chi chiama).
 * Nessun voto a votazione chiusa: tutte le opzioni sono pari.
 */
export function resolvePlurality(
  tally: Record<string, number>,
  options: string[],
  eligible: number,
  complete: boolean,
): { winner: string } | { tie: string[] } | null {
  for (const o of options) if ((tally[o] ?? 0) * 2 > eligible) return { winner: o };
  if (!complete) return null;
  const best = Math.max(0, ...options.map((o) => tally[o] ?? 0));
  const top = options.filter((o) => (tally[o] ?? 0) === best);
  return top.length === 1 ? { winner: top[0] } : { tie: top };
}

export function drawOne<T>(items: T[], random: () => number = Math.random): T {
  return items[Math.floor(random() * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Codici stanza
// ---------------------------------------------------------------------------
/** 31 simboli senza ambiguità (niente 0/O, 1/I/L): 31^6 ≈ 887 milioni di codici, generati a caso. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export function normalizeRoomCode(raw: unknown): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

export function isRoomCode(code: string): boolean {
  return new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(code);
}
