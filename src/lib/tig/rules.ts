import { validateNickname } from "@/lib/game-engine/nickname";
import {
  DEFAULT_DURATION,
  MANCHE_TITLES,
  MASCOT_SLOTS,
  MAX_DURATION,
  MIN_DURATION,
  SEGMENT_KEYS,
  type EventState,
  type SegmentKey,
  type SegmentOverrides,
} from "./types";

/**
 * TAVOLI IN GUERRA! — REGOLE PURE (niente database, niente orologio di sistema): scaletta, macchina a
 * stati, economia dei punti con i limiti anti-valanga, classifiche e spareggi, Energia Caos, Bottone del
 * Caos, assegnazione delle mascotte. Il motore del server (src/lib/server/tig) le applica in transazione.
 */

// ---------------------------------------------------------------------------
// Economia dei punti (PDF §04, PIANO §3)
// ---------------------------------------------------------------------------
export const POINTS = {
  standard: 100,
  speedBonusMax: 20,
  clues: [100, 70, 40] as const,
  duel: [40, 50] as const,
  /** trasferimento/penalità massima per singola azione */
  transferMax: 40,
  /** punti massimi persi per azioni altrui in una manche */
  lossPerMancheMax: 80,
  /** attacchi massimi sullo stesso tavolo nella finestra */
  attacksPerWindow: 2,
  attackWindowMs: 10 * 60_000,
  caosWin: 50,
  betMaxPct: 0.25,
  betMaxAbs: 250,
  finalSafe: 100,
  finalRisky: 240,
  /** tetto dei punti proposti da una prova normale (100 + velocità 20) */
  gameMax: 120,
  /** TUTTO O NIENTE!: scelta rischiosa 240 o puntata vinta fino a 250 */
  finalGameMax: 250,
  /** penalità «propria» massima di una meccanica di rischio fuori dalla manche finale */
  ownPenaltyMax: 40,
} as const;

/** Saldo mai sotto zero: valore applicato davvero. */
export function applyFloor(balance: number, delta: number): { balance: number; applied: number } {
  const next = Math.max(0, balance + Math.round(delta));
  return { balance: next, applied: next - balance };
}

/** Puntata finale massima: min(25% del saldo, 250), mai negativa. */
export function betCap(balance: number): number {
  return Math.max(0, Math.min(Math.floor(Math.max(0, balance) * POINTS.betMaxPct), POINTS.betMaxAbs));
}

/**
 * Punti PROPOSTI da una meccanica per la squadra stessa → punti ammessi dal regolamento:
 *  - positivi: al massimo 120 (100 + bonus velocità 20), 250 in TUTTO O NIENTE!;
 *  - negativi (solo meccaniche di rischio dichiarate): al massimo -40, in TUTTO O NIENTE! al massimo la puntata
 *    consentita min(25% saldo, 250); il saldo resta comunque ≥ 0 (applyFloor).
 */
export function capOwnPoints(points: number, mancheNo: number, balanceAtStart: number): number {
  const p = Number.isFinite(points) ? Math.round(points) : 0;
  if (p >= 0) return Math.min(p, mancheNo === 5 ? POINTS.finalGameMax : POINTS.gameMax);
  const maxLoss = mancheNo === 5 ? betCap(balanceAtStart) : POINTS.ownPenaltyMax;
  return -Math.min(-p, maxLoss);
}

export interface TransferCheck {
  /** punti tolti davvero al bersaglio (0 = nulla) */
  amount: number;
  outcome: "applied" | "blocked" | "refused";
  why: string | null;
}

/**
 * Un'azione di una squadra contro un'altra (furto o penalità): applica nell'ordine
 *  1. max 2 attacchi sullo stesso tavolo in 10 minuti (oltre: respinto, non conta);
 *  2. scudo attivo del bersaglio (blocca tutto e si consuma);
 *  3. tetto 40 per azione, tetto 80 persi per azioni altrui nella manche, saldo mai negativo.
 */
export function checkTransfer(i: { requested: number; recentAttacksOnTarget: number; targetShield: boolean; lostThisManche: number; targetBalance: number }): TransferCheck {
  const req = Math.abs(Math.round(i.requested));
  if (req === 0) return { amount: 0, outcome: "refused", why: "nessun punto in gioco" };
  if (i.recentAttacksOnTarget >= POINTS.attacksPerWindow) return { amount: 0, outcome: "refused", why: "tavolo già attaccato due volte negli ultimi 10 minuti" };
  if (i.targetShield) return { amount: 0, outcome: "blocked", why: "scudo" };
  const room = Math.max(0, POINTS.lossPerMancheMax - Math.max(0, i.lostThisManche));
  const amount = Math.max(0, Math.min(req, POINTS.transferMax, room, Math.max(0, i.targetBalance)));
  return { amount, outcome: "applied", why: amount < req ? "limite anti-valanga" : null };
}

// ---------------------------------------------------------------------------
// Classifica condivisa e spareggi (sfide vinte → precisione → spareggio di 45")
// ---------------------------------------------------------------------------
export interface StandingInput {
  teamId: string;
  score: number;
  wins: number;
  /** precisione media 0..1 (null = nessun dato) */
  accuracy: number | null;
  tableNo: number;
  /** posizione decisa dallo spareggio (1 = vincitore), null se non c'è stato */
  tiebreakRank?: number | null;
}

function cmpStanding(a: StandingInput, b: StandingInput): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.wins !== a.wins) return b.wins - a.wins;
  const aa = a.accuracy ?? -1;
  const ba = b.accuracy ?? -1;
  if (Math.abs(ba - aa) > 1e-9) return ba - aa;
  const at = a.tiebreakRank ?? Number.POSITIVE_INFINITY;
  const bt = b.tiebreakRank ?? Number.POSITIVE_INFINITY;
  if (at !== bt) return at - bt;
  return 0;
}

/** Posizioni con parità condivise (stesso punteggio, sfide vinte, precisione e spareggio = stessa posizione). */
export function computeRanks<T extends StandingInput>(teams: T[]): (T & { rank: number })[] {
  const sorted = [...teams].sort((a, b) => cmpStanding(a, b) || a.tableNo - b.tableNo);
  const out: (T & { rank: number })[] = [];
  sorted.forEach((t, i) => {
    const prev = out[i - 1];
    const rank = prev && cmpStanding(prev, t) === 0 ? prev.rank : i + 1;
    out.push({ ...t, rank });
  });
  return out;
}

/** Squadre a pari merito per il PRIMO posto dopo sfide vinte e precisione (serve lo spareggio di 45"). */
export function topTie(teams: StandingInput[]): string[] {
  const ranked = computeRanks(teams.map((t) => ({ ...t, tiebreakRank: null })));
  const first = ranked.filter((t) => t.rank === 1);
  return first.length > 1 ? first.map((t) => t.teamId) : [];
}

/** Ordine della premiazione: dall'ultimo al primo (a parità, tavolo più alto prima). */
export function awardsOrder(teams: StandingInput[]): string[] {
  return computeRanks(teams)
    .sort((a, b) => b.rank - a.rank || b.tableNo - a.tableNo)
    .map((t) => t.teamId);
}

// ---------------------------------------------------------------------------
// Energia Caos (separata dai punti, solo estetica) ed evoluzione delle mascotte
// ---------------------------------------------------------------------------
export const ENERGY = {
  onTime: 10,
  correct: 10,
  mechanicMax: 20,
  caosAccepted: 15,
  caosWin: 10,
  caosLose: 5,
  lastPlaceBoost: 15,
  tiebreak: 5,
} as const;

export interface ChaosThresholds {
  level2: number;
  level3: number;
}

export function levelFor(energy: number, t: ChaosThresholds): 1 | 2 | 3 {
  if (energy >= t.level3) return 3;
  if (energy >= t.level2) return 2;
  return 1;
}

/** 0..1 verso il prossimo livello (1 = leggendaria). */
export function chaosProgress(energy: number, t: ChaosThresholds): number {
  const lvl = levelFor(energy, t);
  if (lvl === 3) return 1;
  const from = lvl === 1 ? 0 : t.level2;
  const to = lvl === 1 ? t.level2 : t.level3;
  return Math.max(0, Math.min(1, (energy - from) / Math.max(1, to - from)));
}

export function nextThreshold(energy: number, t: ChaosThresholds): number | null {
  const lvl = levelFor(energy, t);
  return lvl === 1 ? t.level2 : lvl === 2 ? t.level3 : null;
}

/** Energia per una prova: invio puntuale + esito + energia proposta dalla meccanica (con tetto). */
export function energyForGame(o: { submitted: boolean; correct: boolean | null; mechanicChaos: number }): number {
  let e = 0;
  if (o.submitted) e += ENERGY.onTime;
  if (o.correct === true) e += ENERGY.correct;
  const m = Number.isFinite(o.mechanicChaos) ? Math.max(0, Math.round(o.mechanicChaos)) : 0;
  return e + Math.min(m, ENERGY.mechanicMax);
}

// ---------------------------------------------------------------------------
// Bottone del Caos: finestre e regole anti-accanimento
// ---------------------------------------------------------------------------
/** Manche in cui il Caos è consentito (mai nella prima: «nessun tavolo attacca gli altri»; mai nel finale). */
export const CAOS_MANCHES = [2, 3, 4] as const;
export const CAOS_DUEL_MS = 45_000;
export const CAOS_ALARM_MS = 7_000;

export function caosWindowOpen(s: { state: EventState; mancheNo: number; paused: boolean; lastGameKind: string | null; caosInProgress: boolean; hasNextStep: boolean }): boolean {
  if (s.paused || s.caosInProgress) return false;
  if (!(CAOS_MANCHES as readonly number[]).includes(s.mancheNo)) return false;
  if (s.state !== "GAME_RESULTS" && s.state !== "LEADERBOARD") return false;
  // subito dopo un duello del Caos no: niente catene
  if (s.lastGameKind && s.lastGameKind !== "regular") return false;
  return s.hasNextStep;
}

export function caosTargetCheck(i: { sourceTeamId: string; targetTeamId: string; targetActive: boolean; targetApproved: boolean; recentAttacksOnTarget: number }): string | null {
  if (i.sourceTeamId === i.targetTeamId) return "Non puoi sfidare il tuo tavolo";
  if (!i.targetActive || !i.targetApproved) return "Questo tavolo non è in gara";
  if (i.recentAttacksOnTarget >= POINTS.attacksPerWindow) return "Tavolo già sfidato due volte negli ultimi 10 minuti";
  return null;
}

/** Vincitore di un duello simmetrico: più punti; a parità chi ha risposto giusto prima; altrimenti nessuno. */
export function duelWinner(rows: { teamId: string; points: number; correct: boolean | null; elapsedMs: number | null }[]): string | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  if (sorted.length === 1) return sorted[0].points > 0 || sorted[0].correct ? sorted[0].teamId : null;
  if (sorted[0].points > sorted[1].points) return sorted[0].teamId;
  const correct = rows.filter((r) => r.correct === true && r.elapsedMs !== null).sort((a, b) => a.elapsedMs! - b.elapsedMs!);
  if (correct.length === 1) return correct[0].teamId;
  if (correct.length > 1 && correct[0].elapsedMs! < correct[1].elapsedMs!) return correct[0].teamId;
  return null;
}

// ---------------------------------------------------------------------------
// Mascotte: voto dei membri, assegnazione atomica e deterministica
// ---------------------------------------------------------------------------
export interface MascotVote {
  teamId: string;
  slot: number;
  /** ms del voto (per la parità) */
  at: number;
}

/** Preferenze di una squadra: slot ordinati per voti, poi per primo voto, poi per numero. */
export function teamPreferences(teamId: string, votes: MascotVote[]): number[] {
  const tally = new Map<number, { n: number; first: number }>();
  for (const v of votes) {
    if (v.teamId !== teamId) continue;
    const t = tally.get(v.slot) ?? { n: 0, first: v.at };
    t.n += 1;
    t.first = Math.min(t.first, v.at);
    tally.set(v.slot, t);
  }
  return [...tally.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first || a[0] - b[0]).map(([s]) => s);
}

/** Slot per UNA squadra (conferma del capitano o della regia): il più votato libero, altrimenti il primo libero. */
export function pickMascotSlot(teamId: string, votes: MascotVote[], taken: Set<number>, unique: boolean): number {
  const prefs = teamPreferences(teamId, votes);
  for (const s of prefs) if (!unique || !taken.has(s)) return s;
  for (let s = 1; s <= MASCOT_SLOTS; s++) if (!unique || !taken.has(s)) return s;
  return 1 + (prefs.length ? prefs[0] - 1 : 0);
}

/**
 * Assegnazione di tutte le squadre ancora senza mascotte (al via): giro per giro, ogni slot conteso va alla
 * squadra che lo ha votato di più (parità: voto più vecchio, poi tavolo più basso). Deterministica.
 */
export function assignMascots(teams: { teamId: string; tableNo: number; slot: number | null }[], votes: MascotVote[], unique: boolean): Map<string, number> {
  const result = new Map<string, number>();
  const taken = new Set<number>();
  for (const t of teams) if (t.slot) {
    result.set(t.teamId, t.slot);
    taken.add(t.slot);
  }
  const pending = teams.filter((t) => !t.slot).sort((a, b) => a.tableNo - b.tableNo);
  if (!unique) {
    for (const t of pending) result.set(t.teamId, pickMascotSlot(t.teamId, votes, new Set(), false));
    return result;
  }
  const strength = (teamId: string, slot: number) => {
    const mine = votes.filter((v) => v.teamId === teamId && v.slot === slot);
    return { n: mine.length, first: mine.length ? Math.min(...mine.map((v) => v.at)) : Number.POSITIVE_INFINITY };
  };
  let left = [...pending];
  let guard = 0;
  while (left.length && guard++ < 100) {
    // ogni squadra rimasta punta al suo slot preferito ancora libero
    const wants = new Map<number, { teamId: string; tableNo: number }[]>();
    const noPref: typeof left = [];
    for (const t of left) {
      const pref = teamPreferences(t.teamId, votes).find((s) => !taken.has(s));
      if (pref === undefined) noPref.push(t);
      else wants.set(pref, [...(wants.get(pref) ?? []), t]);
    }
    if (!wants.size) {
      for (const t of noPref) {
        for (let s = 1; s <= MASCOT_SLOTS; s++) if (!taken.has(s)) {
          result.set(t.teamId, s);
          taken.add(s);
          break;
        }
      }
      break;
    }
    const assigned = new Set<string>();
    for (const [slot, list] of [...wants.entries()].sort((a, b) => a[0] - b[0])) {
      const winner = [...list].sort((a, b) => {
        const sa = strength(a.teamId, slot);
        const sb = strength(b.teamId, slot);
        return sb.n - sa.n || sa.first - sb.first || a.tableNo - b.tableNo;
      })[0];
      result.set(winner.teamId, slot);
      taken.add(slot);
      assigned.add(winner.teamId);
    }
    left = left.filter((t) => !assigned.has(t.teamId));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Nomi: filtro parole + lunghezza (la voce NON li pronuncia mai)
// ---------------------------------------------------------------------------
export type NameCheck = { ok: true; value: string; key: string } | { ok: false; message: string };

export function checkTeamName(raw: unknown): NameCheck {
  const v = validateNickname(String(raw ?? ""), { minLength: 2, maxLength: 24 });
  if (!v.ok) return { ok: false, message: v.message.replace("Il nickname", "Il nome della squadra").replace("Questo nickname", "Questo nome") };
  return { ok: true, value: v.display, key: v.key };
}

export function checkMemberName(raw: unknown): NameCheck {
  const v = validateNickname(String(raw ?? ""), { minLength: 2, maxLength: 24 });
  if (!v.ok) return { ok: false, message: v.message };
  return { ok: true, value: v.display, key: v.key };
}

/** 12 colori ben distinti (TV, scheda squadra); oltre il 12° tavolo si ripetono. */
export const TEAM_COLORS = ["#ff3b4e", "#ffb020", "#38d9ff", "#7cff4f", "#b46cff", "#ff6bd6", "#ffe44d", "#3d8bff", "#ff8a3d", "#2fffc1", "#c9f24d", "#f0f0f0"] as const;
export const teamColor = (tableNo: number) => TEAM_COLORS[(Math.max(1, tableNo) - 1) % TEAM_COLORS.length];

// ---------------------------------------------------------------------------
// Scaletta: 5 manche (4+4+4+4+3) + pausa + premiazione, durata 90–120 (PDF §02)
// ---------------------------------------------------------------------------
export interface Segment {
  key: SegmentKey;
  label: string;
  minutes: number;
  /** solo manche */
  mancheNo: number | null;
  games: number | null;
}

/** Ancore dei minuti per segmento a 90, 115 e 120 minuti (115 = scaletta del PDF). */
const ANCHORS: Record<number, Record<SegmentKey, number>> = {
  90: { lobby: 8, m1: 14, m2: 15, m3: 15, break: 5, m4: 15, m5: 14, awards: 4 },
  115: { lobby: 10, m1: 15, m2: 20, m3: 20, break: 10, m4: 20, m5: 15, awards: 5 },
  120: { lobby: 12, m1: 15, m2: 20, m3: 20, break: 10, m4: 20, m5: 15, awards: 8 },
};
const SEGMENT_LABEL: Record<SegmentKey, string> = {
  lobby: "Accoglienza, QR e squadre",
  m1: `01 · ${MANCHE_TITLES[1]}`,
  m2: `02 · ${MANCHE_TITLES[2]}`,
  m3: `03 · ${MANCHE_TITLES[3]}`,
  break: "Pausa",
  m4: `04 · ${MANCHE_TITLES[4]}`,
  m5: `05 · ${MANCHE_TITLES[5]}`,
  awards: "Premiazione",
};

/** Numero di prove per manche: 4+4+4+4+3; sotto i 103 minuti le manche centrali ne perdono una (PDF). */
export function gamesPerManche(durationMin: number): [number, number, number, number, number] {
  return durationMin < 103 ? [4, 3, 3, 3, 3] : [4, 4, 4, 4, 3];
}

export function runOfShow(durationMin: number = DEFAULT_DURATION, overrides: SegmentOverrides = {}): Segment[] {
  const d = Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(durationMin)));
  const [lo, hi] = d <= 115 ? [90, 115] : [115, 120];
  const f = hi === lo ? 0 : (d - lo) / (hi - lo);
  const mins: Record<SegmentKey, number> = { lobby: 0, m1: 0, m2: 0, m3: 0, break: 0, m4: 0, m5: 0, awards: 0 };
  for (const k of SEGMENT_KEYS) mins[k] = Math.round(ANCHORS[lo][k] + (ANCHORS[hi][k] - ANCHORS[lo][k]) * f);
  // gli arrotondamenti si sistemano sull'accoglienza: il totale è sempre la durata scelta
  const sum = SEGMENT_KEYS.reduce((s, k) => s + mins[k], 0);
  mins.lobby = Math.max(1, mins.lobby + (d - sum));
  const games = gamesPerManche(d);
  for (const k of SEGMENT_KEYS) if (typeof overrides[k] === "number") mins[k] = overrides[k]!;
  return SEGMENT_KEYS.map((key) => {
    const mancheNo = key.startsWith("m") ? Number(key.slice(1)) : null;
    return { key, label: SEGMENT_LABEL[key], minutes: mins[key], mancheNo, games: mancheNo ? games[mancheNo - 1] : null };
  });
}

export const totalMinutes = (segs: Segment[]) => segs.reduce((s, x) => s + x.minutes, 0);
export const mancheSegment = (segs: Segment[], mancheNo: number) => segs.find((s) => s.mancheNo === mancheNo) ?? null;

// ---------------------------------------------------------------------------
// Tempi delle fasi (PDF «Regia»: intro manche 30–45 s, prova 40–75 s, reveal 15–30 s, transizione 15–30 s)
// ---------------------------------------------------------------------------
export const PHASE_MS = {
  intro: 40_000,
  roundIntro: 35_000,
  /** regola della prova a schermo prima del via */
  ruleLead: 8_000,
  reveal: 18_000,
  leaderboardMin: 12_000,
  leaderboardMax: 40_000,
  mancheEndLeaderboard: 20_000,
  final: 15_000,
  awardsMin: 60_000,
  /** tolleranza di rete sugli invii */
  grace: 1_500,
} as const;

/** Tempo che serve a una prova (regola + timer + reveal + classifica minima). */
export const gameNeedMs = (timerSec: number) => PHASE_MS.ruleLead + timerSec * 1000 + PHASE_MS.reveal + PHASE_MS.leaderboardMin;

/**
 * Durata della classifica dopo una prova: il tempo avanzato nella manche si distribuisce come «transizione»
 * (battute, discussione, ordini al bancone) tra il minimo e il massimo.
 */
export function leaderboardMs(i: { mancheBudgetMs: number; mancheElapsedMs: number; gamesLeft: number; avgGameNeedMs: number; endOfManche: boolean }): number {
  if (i.endOfManche) return PHASE_MS.mancheEndLeaderboard;
  const slack = i.mancheBudgetMs - i.mancheElapsedMs - i.gamesLeft * i.avgGameNeedMs;
  const per = i.gamesLeft > 0 ? slack / (i.gamesLeft + 1) : 0;
  return Math.round(Math.max(PHASE_MS.leaderboardMin, Math.min(PHASE_MS.leaderboardMax, PHASE_MS.leaderboardMin + per)));
}

/** Il tempo rimasto nella manche basta per un'altra prova? (tolleranza 90 s: niente prove troncate) */
export function fitsInManche(i: { mancheBudgetMs: number; mancheElapsedMs: number; timerSec: number }): boolean {
  return i.mancheElapsedMs + gameNeedMs(i.timerSec) <= i.mancheBudgetMs + 90_000;
}

// ---------------------------------------------------------------------------
// Macchina a stati: transizioni consentite (ogni altra è un errore)
// ---------------------------------------------------------------------------
export const TRANSITIONS: Record<EventState, EventState[]> = {
  DRAFT: ["LOBBY_OPEN", "CANCELLED"],
  LOBBY_OPEN: ["LOBBY_LOCKED", "INTRO", "CANCELLED"],
  LOBBY_LOCKED: ["LOBBY_OPEN", "INTRO", "CANCELLED"],
  INTRO: ["ROUND_INTRO", "PAUSED", "CANCELLED"],
  ROUND_INTRO: ["GAME_ACTIVE", "LEADERBOARD", "BREAK", "PAUSED", "CANCELLED", "FINAL"],
  GAME_ACTIVE: ["GAME_RESULTS", "PAUSED", "CANCELLED", "GAME_ACTIVE"],
  GAME_RESULTS: ["LEADERBOARD", "GAME_ACTIVE", "FINAL", "PAUSED", "CANCELLED"],
  LEADERBOARD: ["GAME_ACTIVE", "ROUND_INTRO", "BREAK", "FINAL", "PAUSED", "CANCELLED"],
  BREAK: ["ROUND_INTRO", "PAUSED", "CANCELLED"],
  FINAL: ["GAME_ACTIVE", "AWARDS", "PAUSED", "CANCELLED"],
  AWARDS: ["COMPLETED", "PAUSED", "CANCELLED"],
  COMPLETED: [],
  PAUSED: ["INTRO", "ROUND_INTRO", "GAME_ACTIVE", "GAME_RESULTS", "LEADERBOARD", "BREAK", "FINAL", "AWARDS", "CANCELLED"],
  CANCELLED: [],
};

export function canTransition(from: EventState, to: EventState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const PAUSABLE: EventState[] = ["INTRO", "ROUND_INTRO", "GAME_ACTIVE", "GAME_RESULTS", "LEADERBOARD", "BREAK", "FINAL", "AWARDS"];
export const isTerminal = (s: EventState) => s === "COMPLETED" || s === "CANCELLED";
export const isLobby = (s: EventState) => s === "DRAFT" || s === "LOBBY_OPEN" || s === "LOBBY_LOCKED";
export const isLive = (s: EventState) => !isLobby(s) && !isTerminal(s);

/** Dopo quale manche c'è la pausa (PDF: tra la 3 e la 4). */
export const BREAK_AFTER_MANCHE = 3;

/** Etichette leggibili degli stati (regia, TV). */
export const STATE_LABEL: Record<EventState, string> = {
  DRAFT: "Bozza",
  LOBBY_OPEN: "Lobby aperta",
  LOBBY_LOCKED: "Lobby bloccata",
  INTRO: "Apertura",
  ROUND_INTRO: "Presentazione della manche",
  GAME_ACTIVE: "Prova in corso",
  GAME_RESULTS: "Risultati della prova",
  LEADERBOARD: "Classifica",
  BREAK: "Pausa",
  FINAL: "Finale",
  AWARDS: "Premiazione",
  COMPLETED: "Conclusa",
  PAUSED: "In pausa",
  CANCELLED: "Annullata",
};
