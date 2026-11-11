import type { GamePhase, Presenter } from "@/lib/game-engine/types";

/**
 * Battute dei presentatori, con i loro caratteri:
 * - il Professore: pomposo, saccente, teatrale, falsamente modesto;
 * - la Regina: diva ironica che prende in giro i giocatori con affetto;
 * - Palmino: palma-scoiattolo iperattiva, caotica, ride e strilla.
 * Le parti tra parentesi quadre ([laughs], [shouts]…) sono "audio tag" di
 * ElevenLabs v4: guidano l'interpretazione e NON si mostrano mai a schermo
 * (vedi stripAudioTags). La scelta è deterministica (seed = id domanda + fase),
 * così un TV che ricarica la pagina mostra e dice la stessa frase.
 */
const LINES: Partial<Record<GamePhase, Record<Presenter, string[]>>> = {
  // Solo nel fumetto (non parlate)
  QUESTION_VISIBLE: {
    professore: ["Elementare, miei cari… o forse no!", "Questa la sa anche mia nonna… forse!", "Lo dico con modestia: io la so.", "La cultura non si improvvisa, leggete bene!"],
    regina: ["Concentrazione, gente!", "Una domanda da veri cervelloni!", "Vediamo chi merita la corona!", "Niente panico… o quasi."],
    palmino: ["Sorpresaaa!", "Palmino ha scelto per voi!", "Questa scotta come la sabbia d'agosto!", "Cocco-domanda in arrivo!"],
  },
  OPTIONS_VISIBLE: {
    professore: [
      "[clears throat] Tic tac, miei cari: il sapere non aspetta!",
      "Veloci, veloci! Anche Dante ci ha messo meno.",
      "[sarcastic] Non copiate dal vicino: potrebbe saperne meno di voi.",
      "Il tempo fugge, come diceva un mio illustre collega latino!",
    ],
    regina: [
      "[laughs] Scegliete con il cuore… e magari anche con la testa!",
      "Il tempo vola, io resto bellissima. Voi rispondete!",
      "[sarcastic] Prendetevela comoda… ah no, il tempo scorre!",
      "Fidatevi del vostro istinto. Il mio non sbaglia mai.",
    ],
    palmino: [
      "[giggles] Tic tac, tic tac! Palmino conta le noci di cocco!",
      "[shouts] Più veloci di un cocco che cade!",
      "[excited] Dai dai dai! Premete, premete!",
      "[giggles] Io la so! Ma non ve la dico!",
    ],
  },
  ANSWERS_LOCKED: {
    professore: ["Risposte bloccate! Come le mie lezioni: niente ripensamenti.", "[clears throat] Tempo scaduto, giù le mani dal telefono!", "Alea iacta est! Il dado è tratto, cari miei."],
    regina: ["Stop! Nessuno cambia più idea, nemmeno tu laggiù.", "[laughs] Le risposte sono chiuse. Che l'ansia abbia inizio!", "Fine dei giochi. Giù le mani!"],
    palmino: ["[shouts] Tutto bloccato! Rullo di tamburi…", "[giggles] Fermi tutti! Ho chiuso la porta e ho perso la chiave!", "[excited] Basta, basta! Adesso si soffre!"],
  },
  // Rivelazione con risposte divise (anche nel fumetto)
  ANSWER_REVEAL: {
    professore: ["[clears throat] Ecco la risposta giusta. Io, naturalmente, lo sapevo.", "Chi ci ha preso? Applausi! Chi no… ripassi.", "[sarcastic] Metà di voi ha studiato. L'altra metà ha fantasia."],
    regina: ["[laughs] Metà sala in festa, metà in lutto. Adoro!", "Brave e bravi… almeno alcuni di voi!", "Chi ha sbagliato si rifarà. Forse."],
    palmino: ["[giggles] Taaac! Ecco la soluzione!", "[shouts] Lo sapevo io! Cioè… quasi!", "[giggles] Mezzi giusti e mezzi no: un frullato di cervelli!"],
  },
};

/**
 * Commenti dopo la rivelazione, divisi per esito (le frasi devono dire il VERO):
 * - all: hanno risposto giusto letteralmente tutti i giocatori;
 * - most: quasi tutti giusti (almeno il 70%, ma non tutti);
 * - easy: domanda facile, frasi neutre (valgono per "tutti" e per "quasi tutti");
 * - few: pochissimi giusti (25% o meno, ma ALMENO UNO);
 * - hard: domanda difficile, frasi neutre (valgono per "pochi" e per "nessuno");
 * - none: nessuno ha risposto giusto (almeno una risposta data).
 */
export interface RevealQuipPools {
  all: string[];
  most: string[];
  easy: string[];
  few: string[];
  hard: string[];
  none: string[];
}

export const REVEAL_QUIPS: Record<Presenter, RevealQuipPools> = {
  professore: {
    all: ["[excited] Tutti giusti! Si vede che vi ho insegnato bene."],
    most: ["[excited] Bravissimi! Quasi tutti! Si vede che vi ho insegnato bene."],
    easy: ["Troppo facile per voi! La prossima la scelgo più cattiva.", "[clears throat] Un trionfo del sapere. Merito mio, ovviamente."],
    few: ["[sighs] Pochissimi ci sono riusciti. Una tragedia… greca!"],
    hard: ["[sarcastic] Questa vi ha fregato! E io che vi credevo colti.", "[sighs] Che strage. Domani tutti in biblioteca!"],
    none: ["[sighs] Nessuno. Neanche uno di voi! Una tragedia… greca!", "[sarcastic] Zero risposte giuste. Socrate si sta rigirando nella tomba."],
  },
  regina: {
    all: ["[laughs] Tutti giusti? Mi fate quasi commuovere!", "[excited] Bravi tutti! Stasera siete quasi alla mia altezza."],
    most: ["[laughs] Quasi tutti giusti! Quasi. Chi ha sbagliato lo sa."],
    easy: ["Troppo facile per voi, eh? Allora alziamo il livello!"],
    few: ["[laughs] Pochissimi! Gli altri? Rimandati a settembre!"],
    hard: ["[laughs] Ragazzi, che figuraccia!"],
    none: ["[sarcastic] Questa vi ha fregato tutti. Che spettacolo!", "[laughs] Nessuno! Ma proprio nessuno! Mi tocca rifarmi il trucco dallo shock."],
  },
  palmino: {
    all: ["[shouts] Bravissimi tuttiii! Festa sulla spiaggia!", "[excited] Tutti giusti! Pioggia di noci di cocco!"],
    most: ["[excited] Quasi tutti giusti! Palmino batte le foglie!"],
    easy: ["[giggles] Troppo facile! Palmino è un po' deluso."],
    few: ["[shouts] Pochissimi ci sono riusciti! Disastro tropicale!"],
    hard: ["[giggles] Ahahah! Questa vi ha fregato!", "[giggles] Oops! Vi è caduto il cocco in testa?"],
    none: ["[shouts] Nessuno! Neanche uno! Zero su tutta la linea!", "[giggles] Zero giusti! Palmino è caduto dalla palma per lo stupore!"],
  },
};

/** Esito della rivelazione per il commento (null = nessun commento: nessuno in gioco). */
export type RevealOutcome = "all" | "most" | "split" | "few" | "none";

/**
 * `right` risposte giuste su `answered` risposte date, con `players` giocatori in gioco.
 * "all" solo se hanno risposto giusto TUTTI i giocatori; "few" solo con almeno un giusto.
 */
export function revealOutcome(right: number, answered: number, players: number): RevealOutcome | null {
  // nessuna risposta data: "nessuno" solo se c'era qualcuno in gioco
  if (answered <= 0) return players > 0 ? "none" : null;
  if (right <= 0) return "none";
  if (right >= answered && right >= Math.max(1, players)) return "all";
  const pct = right / answered;
  if (pct >= 0.7) return "most";
  if (pct <= 0.25) return "few";
  return "split";
}

/** Toglie gli audio tag ([laughs], [shouts]…) dal testo da mostrare o da far leggere al browser. */
export function stripAudioTags(text: string): string {
  return text
    .replace(/\[[^\][]{1,40}\]/g, " ")
    .replace(/\s+([!?.,…])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tutte le battute delle pool (per la pre-generazione delle voci). */
export function presenterLinePool(phase: GamePhase, presenter: Presenter): readonly string[] {
  return LINES[phase]?.[presenter] ?? [];
}

/**
 * Rotazione nella serata: per le battute che tornano a ogni domanda (tempo che scorre, risposte
 * chiuse, commenti) si scorre la lista con il numero della domanda, partendo da un punto che
 * dipende dalla serata. Così nessuna variante si ripete finché non sono state dette tutte, e ogni
 * serata comincia da una variante diversa. Pura: TV, server e stime ottengono la stessa scelta.
 */
export interface Rotation {
  /** chiave della serata (id della sessione) */
  key: string;
  /** numero della domanda nella serata */
  n: number;
}

export function rotatingPick<T>(list: readonly T[], rot: Rotation, salt = ""): T {
  let h = 0;
  for (const ch of `${rot.key}|${salt}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return list[(Math.abs(h) + Math.max(0, Math.floor(rot.n))) % list.length];
}

/** Scelta deterministica in una lista. */
export function seededPick<T>(list: readonly T[], seed: string): T {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length];
}

/**
 * Battuta con gli audio tag (per la voce). Per lo schermo usare presenterBubble.
 * `fits`: filtro sul momento (es. ultima domanda: niente "la prossima…", vedi moment.ts);
 * se nessuna battuta passa il filtro si usa la scelta normale.
 */
export function presenterLine(phase: GamePhase, presenter: Presenter, seed: string, fits?: (text: string) => boolean, rot?: Rotation): string | null {
  const list = LINES[phase]?.[presenter];
  if (!list || list.length === 0) return null;
  const ok = fits ? list.filter(fits) : list;
  const pool = ok.length > 0 ? ok : list;
  return rot ? rotatingPick(pool, rot, `${phase}|${presenter}`) : seededPick(pool, seed + phase);
}

/** Battuta per il fumetto a schermo: mai audio tag. */
export function presenterBubble(phase: GamePhase, presenter: Presenter, seed: string, fits?: (text: string) => boolean): string | null {
  const l = presenterLine(phase, presenter, seed, fits);
  return l === null ? null : stripAudioTags(l);
}

export const ROUND_KIND_LABEL: Record<string, string> = {
  standard: "Manche classica",
  music: "Indovina la canzone",
  image: "Immagini misteriose",
  video: "Manche video",
  category_vote: "Scegliete la categoria",
  category_wheel: "Ruota impazzita",
  bonus: "Manche bonus",
  final: "Gran finale",
  bet: "Scommetti tutto",
  comeback: "Grande ribaltone",
};

export const EVENT_ICON: Record<string, string> = {
  double_points: "×2",
  no_penalty: "🛡️",
  lightning: "⚡",
  super_bonus: "⭐",
  mystery_question: "❓",
  impossible_comeback: "🚀",
  palmino_decides: "🌴",
  finalissima: "👑",
};

export function formatPoints(n: number): string {
  return new Intl.NumberFormat("it-IT", { useGrouping: "always" }).format(n);
}

export function signedPoints(n: number): string {
  return (n > 0 ? "+" : n < 0 ? "−" : "") + formatPoints(Math.abs(n));
}

const normalize = (t: string) => stripAudioTags(t).toLocaleLowerCase("it-IT");
let quipSet: Set<string> | null = null;

/**
 * La battuta detta è un commento "da fumetto" della domanda (tempo che scorre, risposte chiuse,
 * commento alla soluzione)? Il fumetto mostra SOLO queste, e solo mentre vengono dette: mai il
 * testo della domanda o la lettura delle risposte (già sullo schermo).
 */
export function isQuestionQuip(text: string): boolean {
  if (!quipSet) {
    quipSet = new Set<string>();
    for (const phase of ["OPTIONS_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL"] as const) {
      for (const byPresenter of Object.values(LINES[phase] ?? {})) for (const t of byPresenter) quipSet.add(normalize(t));
    }
    for (const pools of Object.values(REVEAL_QUIPS)) for (const pool of Object.values(pools)) for (const t of pool) quipSet.add(normalize(t));
  }
  return quipSet.has(normalize(text));
}
