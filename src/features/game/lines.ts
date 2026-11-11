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

/** Commenti dopo la rivelazione: quasi tutti giusti / quasi tutti sbagliati. */
export const REVEAL_QUIPS: Record<Presenter, { easy: string[]; hard: string[] }> = {
  professore: {
    easy: ["[excited] Bravissimi! Quasi tutti! Si vede che vi ho insegnato bene.", "Troppo facile per voi! La prossima la scelgo più cattiva.", "[clears throat] Un trionfo del sapere. Merito mio, ovviamente."],
    hard: ["[sighs] Pochissimi ci sono riusciti. Una tragedia… greca!", "[sarcastic] Questa vi ha fregato! E io che vi credevo colti.", "[sighs] Che strage. Domani tutti in biblioteca!"],
  },
  regina: {
    easy: ["[laughs] Tutti giusti? Mi fate quasi commuovere!", "Troppo facile per voi, eh? Allora alziamo il livello!", "[excited] Bravi tutti! Stasera siete quasi alla mia altezza."],
    hard: ["[laughs] Ragazzi, che figuraccia!", "[sarcastic] Questa vi ha fregato tutti. Che spettacolo!", "[laughs] Pochissimi! Gli altri? Rimandati a settembre!"],
  },
  palmino: {
    easy: ["[shouts] Bravissimi tuttiii! Festa sulla spiaggia!", "[giggles] Troppo facile! Palmino è un po' deluso.", "[excited] Tutti giusti! Pioggia di noci di cocco!"],
    hard: ["[giggles] Ahahah! Questa vi ha fregato!", "[shouts] Pochissimi ci sono riusciti! Disastro tropicale!", "[giggles] Oops! Vi è caduto il cocco in testa?"],
  },
};

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

/** Scelta deterministica in una lista. */
export function seededPick<T>(list: readonly T[], seed: string): T {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length];
}

/** Battuta con gli audio tag (per la voce). Per lo schermo usare presenterBubble. */
export function presenterLine(phase: GamePhase, presenter: Presenter, seed: string): string | null {
  const list = LINES[phase]?.[presenter];
  if (!list || list.length === 0) return null;
  return seededPick(list, seed + phase);
}

/** Battuta per il fumetto a schermo: mai audio tag. */
export function presenterBubble(phase: GamePhase, presenter: Presenter, seed: string): string | null {
  const l = presenterLine(phase, presenter, seed);
  return l === null ? null : stripAudioTags(l);
}

export const ROUND_KIND_LABEL: Record<string, string> = {
  standard: "Manche classica",
  music: "Indovina la canzone",
  image: "Immagini misteriose",
  video: "Manche video",
  category_vote: "Scegliete la categoria",
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
