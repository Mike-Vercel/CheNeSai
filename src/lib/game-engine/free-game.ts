import { composeQuestions, freshnessOf, seededRandom, type ComposeCandidate, type ComposedPick, type ComposeSummary, type DifficultyMix } from "./compose";

/**
 * PARTITA LIBERA: cosa c'è SEMPRE in ogni partita (funzioni pure, nessun database).
 *
 *  - VOTAZIONE DELLE MATERIE: un round "category_vote" (i giocatori votano dal telefono fra 3
 *    materie, si gioca quella vincente).
 *      · 3 round o più: un round intermedio (mai il primo, mai la finale): il 2° con 3-4 round,
 *        il 3° con 5 round;
 *      · 2 round: il primo (l'altro è la finale);
 *      · 1 round: il round stesso diventa a votazione, ma solo le prime domande sono della materia
 *        votata (5, al massimo metà del round); le altre sono "comuni" (materie miste, giocate
 *        dopo quelle votate): lì può girare la Ruota di Palmino e lì va la canzone.
 *  - RUOTA DI PALMINO: almeno una (vedi palmino-wheel.ts, `atLeastOne`): mai nel round votato
 *    (salvo le domande comuni del round unico), mai sulla canzone.
 *  - CANZONE ("Ascolta"): una domanda con l'estratto audio, se l'archivio ne ha, in un round
 *    "normale" (non votato, non la finale se c'è altro), mai prima domanda del round né ultima
 *    della partita: prima quelle che questo host non ha mai sentito, poi la meno recente.
 */

/** Materie proposte nella votazione. */
export const FREE_VOTE_OPTIONS = 3;
/** Round unico: domande della materia votata (al massimo metà del round). */
export const FREE_SINGLE_ROUND_VOTED = 5;

export type FreeRoundKind = "standard" | "final" | "category_vote";

export interface FreeRoundShape {
  kind: FreeRoundKind;
  /** domande giocate nel round */
  count: number;
}

export interface FreeGamePlan {
  /** indice del round a votazione */
  voteRound: number;
  /** domande della materia votata (per ciascuna materia); le altre del round sono comuni */
  voted: number;
  /** domande comuni nel round votato (solo con un round unico) */
  common: number;
  /** canzone: round e posizione (nel round; nel round votato: fra le domande comuni) */
  music: { round: number; index: number };
}

/** Round a votazione: un round intermedio con 3+ round (mai il primo né la finale), altrimenti il primo. */
export function freeVoteRoundIndex(rounds: number): number {
  return rounds >= 3 ? Math.max(1, Math.floor((rounds - 1) / 2)) : 0;
}

/**
 * Dove stanno votazione e canzone. `shapes` = i round della partita (tipo e domande) come li fa la
 * serata rapida: ultimo = finale quando i round sono più di uno.
 */
export function planFreeGame(shapes: readonly FreeRoundShape[], seed: string): FreeGamePlan {
  const rand = seededRandom(`free-game|${seed}`);
  const n = shapes.length;
  const voteRound = freeVoteRoundIndex(n);
  const count = shapes[voteRound]?.count ?? 0;
  const voted = n === 1 ? Math.min(FREE_SINGLE_ROUND_VOTED, Math.floor(count / 2)) : count;
  const common = n === 1 ? count - voted : 0;
  // canzone: un round normale (non votato, non finale) a caso; altrimenti la finale; con un round
  // solo fra le domande comuni (mai l'ultima della partita)
  let music: FreeGamePlan["music"];
  if (n === 1) {
    music = { round: 0, index: Math.floor(rand() * Math.max(1, common - 1)) };
  } else {
    const normal = shapes.map((s, i) => ({ s, i })).filter(({ s, i }) => i !== voteRound && s.kind === "standard");
    const pool = normal.length > 0 ? normal : shapes.map((s, i) => ({ s, i })).filter(({ i }) => i !== voteRound);
    const pick = pool[Math.floor(rand() * pool.length)];
    const last = pick.i === n - 1;
    // posti: dalla 2ª domanda del round; nell'ultimo round mai l'ultima
    const slots = Math.max(1, pick.s.count - 1 - (last ? 1 : 0));
    music = { round: pick.i, index: Math.min(pick.s.count - 1, 1 + Math.floor(rand() * slots)) };
  }
  return { voteRound, voted, common, music };
}

// ---------------------------------------------------------------------------
// Materie della votazione
// ---------------------------------------------------------------------------
export interface VoteOptionPick {
  label: string;
  picks: ComposedPick[];
}

export interface PickVoteInput {
  candidates: readonly ComposeCandidate[];
  /** domande per materia */
  count: number;
  mix: DifficultyMix;
  seed: string;
  excludeIds?: Iterable<string>;
  options?: number;
}

/**
 * Sceglie le materie da votare: quelle con abbastanza domande ancora fresche (mai viste da questo
 * host, mai giocate), poi a caso con il seme; per ognuna `count` domande con le regole del
 * compositore (freschezza, difficoltà del mix). Meno di 2 materie possibili → [] (niente voto).
 */
export function pickVoteCategories(input: PickVoteInput): VoteOptionPick[] {
  const want = input.options ?? FREE_VOTE_OPTIONS;
  const exclude = new Set(input.excludeIds ?? []);
  const rand = seededRandom(`free-vote|${input.seed}`);
  const byCat = new Map<string, ComposeCandidate[]>();
  for (const c of [...input.candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (exclude.has(c.id)) continue;
    const label = c.category.trim();
    if (label.length < 2 || label.length > 40) continue;
    const k = label.toLocaleLowerCase("it-IT");
    const list = byCat.get(k) ?? [];
    list.push({ ...c, category: label });
    byCat.set(k, list);
  }
  const ranked = [...byCat.values()]
    .filter((list) => list.length >= input.count)
    .map((list) => {
      const fresh = list.filter((c) => freshnessOf(c) === "nuova").length;
      const unseen = list.filter((c) => freshnessOf(c) !== "vista").length;
      return { list, key: [fresh >= input.count ? 0 : 1, unseen >= input.count ? 0 : 1, rand()] };
    })
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
  if (ranked.length < 2) return [];
  return ranked.slice(0, want).map(({ list }, i) => {
    const res = composeQuestions({ candidates: list, rounds: [{ count: input.count }], mix: input.mix, seed: `${input.seed}|voto|${i}` });
    return { label: list[0].category, picks: res.rounds[0] };
  });
}

/** Somma i riepiloghi della composizione (round + materie della votazione). */
export function mergeSummaries(a: ComposeSummary, b: ComposeSummary): ComposeSummary {
  return {
    requested: a.requested + b.requested,
    picked: a.picked + b.picked,
    missing: a.missing + b.missing,
    fresh: a.fresh + b.fresh,
    repeats: a.repeats + b.repeats,
    planned: a.planned + b.planned,
    seen: a.seen + b.seen,
    offBand: a.offBand + b.offBand,
  };
}

// ---------------------------------------------------------------------------
// Canzone
// ---------------------------------------------------------------------------
export interface MusicCandidate {
  id: string;
  category: string;
  difficulty: number;
  /** ultima volta che questo host l'ha vista (ISO); null = mai */
  hostSeenAt: string | null;
  /** ultima giocata in assoluto (ISO); null = mai */
  lastPlayedAt: string | null;
}

/**
 * La canzone della partita: prima quelle che questo host non ha mai sentito (fra queste la giocata
 * meno di recente in assoluto, poi a caso); se le ha sentite tutte, quella sentita meno di recente.
 */
export function pickMusicQuestion(candidates: readonly MusicCandidate[], seed: string, excludeIds: Iterable<string> = []): MusicCandidate | null {
  const exclude = new Set(excludeIds);
  const rand = seededRandom(`free-music|${seed}`);
  const ms = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);
  const list = [...candidates]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => ({ c, r: rand() }))
    .filter(({ c }) => !exclude.has(c.id));
  if (list.length === 0) return null;
  list.sort((a, b) => {
    const sa = a.c.hostSeenAt ? 1 : 0;
    const sb = b.c.hostSeenAt ? 1 : 0;
    return sa - sb || ms(a.c.hostSeenAt) - ms(b.c.hostSeenAt) || ms(a.c.lastPlayedAt) - ms(b.c.lastPlayedAt) || a.r - b.r;
  });
  return list[0].c;
}

const ORDINAL_SHORT = ["1°", "2°", "3°", "4°", "5°"];

/** Riga del wizard: cosa c'è sempre nella partita (votazione, ruota, canzone). */
export function freeGameHighlights(rounds: number, totalQuestions: number): string {
  const n = Math.max(1, rounds);
  const voteRound = freeVoteRoundIndex(n);
  const voted = n === 1 ? Math.min(FREE_SINGLE_ROUND_VOTED, Math.floor(totalQuestions / 2)) : 0;
  const vote =
    n === 1
      ? `🗳️ si vota la materia delle prime ${voted} domande`
      : `🗳️ nel ${ORDINAL_SHORT[voteRound] ?? `${voteRound + 1}°`} round votate voi la materia`;
  return `Sempre in partita: ${vote}, 🎡 la Ruota di Palmino e 🎧 una canzone da indovinare.`;
}
