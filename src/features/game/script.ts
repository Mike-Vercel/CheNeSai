import type { GamePhase, LeaderboardEntry, MediaKind, Presenter, PublicState, QuestionType, RoundKind } from "@/lib/game-engine/types";
import { PRESENTERS } from "@/lib/game-engine/types";
import { presenterLine, presenterLinePool, REVEAL_QUIPS, seededPick, stripAudioTags } from "./lines";

/**
 * Copione parlato dei presentatori: funzioni PURE condivise dal TV (speechFor)
 * e dal server (pre-generazione delle voci e pre-riscaldamento live).
 * Il server deve produrre ESATTAMENTE le stesse stringhe che il TV chiederà,
 * perché la cache audio è indicizzata sul testo (audio tag compresi).
 *
 * Regole per rendere riutilizzabile la cache fra serate diverse:
 * - "Domanda numero N" è una battuta a sé (l'annunciatore), separata dal testo;
 * - il testo di una domanda non dipende dalla sua posizione nella serata;
 * - le battute con nickname o punteggi sono "live" (generate al volo).
 *
 * Tono: varietà da pub, per famiglie. Gli audio tag tra parentesi quadre
 * ([excited], [laughs]…) sono interpretati da ElevenLabs v4 e tolti per lo
 * schermo e per la voce del browser (stripAudioTags).
 */

export { stripAudioTags };

export const TTS_ROLES = ["professore", "regina", "palmino", "annunciatore"] as const;
/** Voci per la sintesi: i tre presentatori più l'annunciatore fuori campo (non è un presentatore del DB). */
export type TtsRole = (typeof TTS_ROLES)[number];

export const TTS_ROLE_LABEL: Record<TtsRole, string> = {
  professore: "Il Professore",
  regina: "La Regina",
  palmino: "Palmino",
  annunciatore: "Annunciatore",
};

export interface SpokenLine {
  who: TtsRole;
  text: string;
  /** Battuta con dati della serata (nickname, punti): modello veloce, generata al volo. */
  live?: boolean;
}

/** Lunghezza massima di una battuta (stesso limite dell'API /api/tts). */
export const TTS_MAX_CHARS = 600;

/** Forma canonica del testo inviato alla sintesi (e usato nella chiave di cache). */
export function ttsText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, TTS_MAX_CHARS);
}

const LETTER = ["A", "B", "C", "D"];

/**
 * Testo dei contenuti (domande, risposte, titoli, nickname) reso leggibile alla sintesi.
 * Le parentesi quadre diventano tonde: un contenuto non può mai diventare un audio tag.
 */
export function cleanSpeech(text: string): string {
  return text
    .replace(/\?!/g, "?")
    .replace(/×/g, " per ")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

/** "PUNTI DOPPI" → "Punti doppi" (le maiuscole verrebbero lette come sigle). */
function speakableTitle(title: string): string {
  const t = cleanSpeech(title);
  if (t !== t.toUpperCase()) return t;
  const lower = t.toLocaleLowerCase("it-IT");
  return lower.charAt(0).toLocaleUpperCase("it-IT") + lower.slice(1);
}

/** Apertura degli eventi scelti da Palmino in regia (usata anche dal motore). */
export const PALMINO_DECIDES_PREFIX = "Palmino ha deciso: ";

// ---------------------------------------------------------------------------
// Battute fisse (con varianti a rotazione)
// ---------------------------------------------------------------------------
export const WELCOME_LINE: SpokenLine = { who: "regina", text: "[excited] Benvenuti su Che ne sai! Mettetevi comodi: lo spettacolo sta per cominciare!" };

interface FixedPool {
  who: TtsRole;
  texts: readonly string[];
}

export const FIXED_POOLS = {
  lobby: {
    who: "regina",
    texts: [
      "[excited] La lobby è aperta! Inquadrate il codice QR e scegliete il vostro nickname. Mi raccomando: niente nomi imbarazzanti!",
      "La lobby è aperta! Inquadrate il codice QR e scegliete un nickname all'altezza della mia corona.",
    ],
  },
  voting: {
    who: "palmino",
    texts: [
      "[excited] Votate dal telefono la categoria che preferite! Avete pochi secondi!",
      "[giggles] Si vota, si vota! Scegliete la categoria dal telefono, presto presto!",
      "[shouts] Tutti al voto! Palmino conta i voti con le dita… e ne ha solo dieci!",
    ],
  },
  paused: {
    who: "regina",
    texts: [
      "Facciamo una piccola pausa. Restate con noi!",
      "[sighs] Pausa! Anche una regina deve ritoccarsi il trucco.",
      "[laughs] Piccola pausa: bevete, sgranchitevi, ma non scappate!",
    ],
  },
  resume: {
    who: "regina",
    texts: ["[excited] Si riparte!", "Eccoci di nuovo! Si riparte!", "[laughs] Pausa finita, cervelli accesi: si riparte!"],
  },
  // battute dopo i punti di ogni risposta (a metà round), una per presentatore
  scoreQuipProfessore: {
    who: "professore",
    texts: [
      "[laughs] Punti assegnati! Qualcuno sta salendo, qualcuno sta… meditando.",
      "[clears throat] Come diceva Socrate: so di non sapere. Alcuni di voi lo dimostrano benissimo!",
      "[excited] Ecco i punti! E chi ha sbagliato… consideri questa una lezione gratuita.",
      "Punteggi aggiornati. Prendete appunti: alla prossima interrogo a sorpresa!",
      "[sighs] Vedo facce felici… e facce che stanno ordinando un altro drink per dimenticare.",
      "[laughs] Chi ha risposto giusto: bravo! Chi no: c'è sempre il prossimo venerdì.",
    ],
  },
  scoreQuipRegina: {
    who: "regina",
    texts: [
      "[laughs] Punti assegnati! Chi ha sbagliato si inchini comunque alla sua regina.",
      "[sarcastic] Che spettacolo… alcuni di voi più che giocare stanno tirando a indovinare.",
      "[excited] I punti sono arrivati! Controllate il telefono e non piangete in pubblico.",
      "Chi sale, chi scende… proprio come i miei tacchi a spillo!",
      "[laughs] Splendidi! Beh, quasi tutti. Diciamo metà. Va bene: qualcuno.",
      "[sighs] Ho visto risposte che nemmeno il mio parrucchiere avrebbe dato!",
    ],
  },
  scoreQuipPalmino: {
    who: "palmino",
    texts: [
      "[giggles] Punti punti punti! Palmino ha contato tutto… credo!",
      "[shouts] Evviva! Chi ha sbagliato offre il giro! Scherzo… o forse no!",
      "[giggles] Cocco cocco! I punti sono caldi caldi, appena sfornati!",
      "[excited] Chi è indietro non molli: le palme si piegano, ma non si spezzano!",
      "[laughs] Qualcuno ha cliccato a caso… Palmino l'ha visto!",
      "[giggles] Che sfida! Palmino è così emozionato che ha perso una foglia!",
    ],
  },
  // nessuno ha preso punti nell'ultima risposta
  nobodyScored: {
    who: "palmino",
    texts: [
      "[laughs] Zero punti per tutti! Palmino è sconvolto: ma stasera avete studiato?",
      "[giggles] Nessuno l'ha presa! Palmino si toglie gli occhiali per lo stupore!",
    ],
  },
  finishedOpen: {
    who: "professore",
    texts: ["[clears throat] Signore e signori, ecco i campioni della serata!", "[excited] Signore e signori, è il momento più atteso: il podio!"],
  },
  finishedClose: {
    who: "professore",
    texts: [
      "Grazie a tutti e ci vediamo venerdì prossimo per una nuova sfida!",
      "[laughs] Grazie a tutti! Ripassate, studiate… e venerdì prossimo vi aspetto!",
    ],
  },
} as const satisfies Record<string, FixedPool>;

function fixedLine(pool: FixedPool, seed: string): SpokenLine {
  return { who: pool.who, text: seededPick(pool.texts, seed) };
}

/** Prova microfono dal pannello del TV. */
export const MIC_TEST_LINES: SpokenLine[] = [
  { who: "professore", text: "[clears throat] Prova microfono: uno, due, tre! Si sente la mia immensa cultura?" },
  { who: "regina", text: "[laughs] Mi sentite bene, laggiù in fondo?" },
  { who: "palmino", text: "[giggles] Eccomi qua! Prova prova, cocco cocco!" },
  { who: "annunciatore", text: "[shouts] Che ne sai!" },
];

const MULTIPLE_WARNING: Record<Presenter, string> = {
  professore: "[whispers] Attenzione, attenzione: le risposte giuste possono essere più di una! Non fatevi fregare.",
  regina: "[sarcastic] Occhio: qui le risposte giuste possono essere più di una!",
  palmino: "[giggles] Psst! Le risposte giuste possono essere più di una! Shhh, non ditelo a nessuno!",
};

/** Attacco leggero prima del testo della domanda (il testo resta identico e chiaro). */
const QUESTION_LEAD: Record<Presenter, string> = { professore: "[curious]", regina: "[curious]", palmino: "[excited]" };
const ROUND_LEAD: Record<Presenter, string> = { professore: "[clears throat]", regina: "[excited]", palmino: "[giggles]" };

/** Quante "Domanda numero N" si pre-generano di serie. */
export const GENERIC_QUESTION_NUMBERS = 60;

// ---------------------------------------------------------------------------
// Domande
// ---------------------------------------------------------------------------
export interface ScriptQuestion {
  /** Seme per le battute a rotazione (id della domanda nella serata). */
  id: string;
  type: QuestionType;
  text: string;
  presenter: Presenter;
  mediaKind: MediaKind | null;
  /** Ordinate per posizione. */
  options: { position: number; text: string }[];
  /** Ordinate. */
  correctPositions: number[];
}

/** Normalizza i dati di una domanda (stesso ordinamento dello stato pubblico). */
export function toScriptQuestion(q: {
  id: string;
  type: QuestionType;
  text: string;
  presenter: Presenter;
  mediaKind: MediaKind | null;
  options: { position: number; text: string }[];
  correctPositions: number[];
}): ScriptQuestion {
  return {
    id: q.id,
    type: q.type,
    text: q.text,
    presenter: q.presenter,
    mediaKind: q.mediaKind,
    options: [...q.options].map((o) => ({ position: o.position, text: o.text })).sort((a, b) => a.position - b.position),
    correctPositions: [...q.correctPositions].sort(),
  };
}

/** Domanda dal CMS/archivio (risposte con `isCorrect`) → stessa forma vista dal TV. */
export function scriptQuestionFromCms(q: {
  id: string;
  type: QuestionType;
  text: string;
  presenter: Presenter;
  mediaKind: string | null;
  options: { position: number; text: string; isCorrect: boolean }[];
}): ScriptQuestion {
  return toScriptQuestion({
    id: q.id,
    type: q.type,
    text: q.text,
    presenter: q.presenter,
    mediaKind: (q.mediaKind as MediaKind | null) ?? null,
    options: q.options,
    correctPositions: q.options.filter((o) => o.isCorrect).map((o) => o.position),
  });
}

export function questionNumberLine(n: number): SpokenLine {
  return { who: "annunciatore", text: `[excited] Domanda numero ${n}!` };
}

const ROMAN_LETTER: Record<string, string> = { M: "emme", D: "di", C: "ci", L: "elle", X: "ics", V: "vu", I: "i" };
const ROMAN_TOKEN = /\b(?=[MDCLXVI]{2,}\b)M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})\b/g;

/**
 * Nelle domande SUI numeri romani la voce non deve "tradurli" (ElevenLabs legge MCMLXIX come
 * "millenovecentosessantanove", cioè la risposta!): si leggono lettera per lettera.
 * Altrove si lasciano com'erano (es. "XX secolo" → "ventesimo secolo").
 */
export function spellRomanNumerals(text: string): string {
  if (!/\broman[oiae]\b/i.test(text)) return text;
  return text.replace(ROMAN_TOKEN, (m) => (m ? m.split("").map((c) => ROMAN_LETTER[c]).join(", ") : m));
}

export function questionTextLine(q: Pick<ScriptQuestion, "text" | "presenter" | "mediaKind">): SpokenLine {
  const lead = QUESTION_LEAD[q.presenter];
  const text = spellRomanNumerals(cleanSpeech(q.text));
  return { who: q.presenter, text: q.mediaKind === "audio" ? `[excited] Ascoltate bene! ${text}` : `${lead} ${text}` };
}

export function multipleWarningLine(presenter: Presenter): SpokenLine {
  return { who: presenter, text: MULTIPLE_WARNING[presenter] };
}

/** Lettura delle risposte: pulita, senza tag. */
export function optionsLine(q: Pick<ScriptQuestion, "presenter" | "options">): SpokenLine {
  return { who: q.presenter, text: q.options.map((o) => `${LETTER[o.position]}: ${cleanSpeech(o.text)}.`).join(" ") };
}

export function optionsQuip(presenter: Presenter, seed: string): SpokenLine {
  return { who: presenter, text: presenterLine("OPTIONS_VISIBLE", presenter, seed) ?? "Il tempo scorre!" };
}

export function lockedQuip(presenter: Presenter, seed: string): SpokenLine {
  return { who: presenter, text: presenterLine("ANSWERS_LOCKED", presenter, seed) ?? "Risposte bloccate!" };
}

export function revealLine(q: Pick<ScriptQuestion, "presenter" | "options" | "correctPositions">): SpokenLine {
  const parts = q.correctPositions.map((p) => `${LETTER[p]}, ${cleanSpeech(q.options.find((o) => o.position === p)?.text ?? "")}`);
  return {
    who: q.presenter,
    text: q.correctPositions.length > 1 ? `[excited] Le risposte giuste sono: ${parts.join(" e ")}!` : `[excited] La risposta giusta è… ${parts[0]}!`,
  };
}

/** Commento dopo la rivelazione: quasi tutti giusti, quasi tutti sbagliati, sala divisa. */
export function revealQuip(presenter: Presenter, seed: string, pct: number): SpokenLine {
  const q = REVEAL_QUIPS[presenter];
  const text = pct >= 0.7 ? seededPick(q.easy, seed) : pct <= 0.25 ? seededPick(q.hard, seed) : (presenterLine("ANSWER_REVEAL", presenter, seed) ?? "");
  return { who: presenter, text };
}

/**
 * Battute specifiche di una domanda, indipendenti dalla posizione nella serata:
 * testo (con la variante audio), avviso risposte multiple, lettura delle risposte, rivelazione.
 */
export function questionScriptLines(q: ScriptQuestion): SpokenLine[] {
  const out: SpokenLine[] = [questionTextLine(q)];
  if (q.type === "multiple") out.push(multipleWarningLine(q.presenter));
  if (q.options.length > 0) out.push(optionsLine(q));
  if (q.correctPositions.length > 0 && q.options.length > 0) out.push(revealLine(q));
  return out.filter((l) => l.text.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Round, voto, eventi
// ---------------------------------------------------------------------------
export interface ScriptRound {
  index: number;
  title: string;
  kind: RoundKind;
  presenter: Presenter;
  description: string | null;
  pointsMultiplier: number;
  noPenalty: boolean;
}

export function roundIntroLine(r: ScriptRound): SpokenLine {
  if (r.kind === "category_vote") return { who: "palmino", text: `[giggles] Round ${r.index}: ${cleanSpeech(r.title)}. Adesso decidete voi… tanto vinco io!` };
  const extra =
    r.pointsMultiplier > 1 ? ` [excited] Attenzione: i punti valgono ${r.pointsMultiplier} volte!` : r.noPenalty ? " In questo round non si perdono punti. Osate!" : "";
  return {
    who: r.presenter,
    text: `${ROUND_LEAD[r.presenter]} Round ${r.index}: ${cleanSpeech(r.title)}!${r.description ? " " + cleanSpeech(r.description) : ""}${extra}`,
  };
}

export function categoryResultLine(label: string): SpokenLine {
  return { who: "palmino", text: `[shouts] Avete scelto: ${cleanSpeech(label)}!` };
}

/** Evento speciale: l'annunciatore grida il titolo, Palmino dice lo slogan. */
export function eventLines(e: { title: string; tagline: string }): SpokenLine[] {
  const title = speakableTitle(e.title);
  const tagline = cleanSpeech(e.tagline);
  const out: SpokenLine[] = [];
  if (title.replace(/[!.\s]/g, "")) out.push({ who: "annunciatore", text: `[shouts] ${title}!!!` });
  if (tagline.replace(/[!.\s]/g, "")) out.push({ who: "palmino", text: `[giggles] ${tagline}` });
  return out;
}

// ---------------------------------------------------------------------------
// Battute live (nickname e punteggi)
// ---------------------------------------------------------------------------
type LbSpeech = Pick<LeaderboardEntry, "nickname" | "rank" | "points">;

/** Battuta dopo i punti di una risposta (a metà round): stessa scelta su TV, fumetto e voce. */
export function scoreQuipLine(presenter: Presenter, seed: string): SpokenLine {
  const pool = presenter === "regina" ? FIXED_POOLS.scoreQuipRegina : presenter === "palmino" ? FIXED_POOLS.scoreQuipPalmino : FIXED_POOLS.scoreQuipProfessore;
  return fixedLine(pool, seed);
}

/** Chi ha preso più punti in QUESTA risposta (i pari merito insieme); nessuno → battuta di Palmino. */
export function answerStarLine(lb: Pick<LeaderboardEntry, "nickname" | "lastDelta">[], presenter: Presenter, seed: string): SpokenLine {
  const best = Math.max(0, ...lb.map((e) => e.lastDelta));
  if (best <= 0) return fixedLine(FIXED_POOLS.nobodyScored, seed);
  const top = lb.filter((e) => e.lastDelta === best).map((e) => cleanSpeech(e.nickname));
  const names = top.length === 1 ? top[0] : `${top.slice(0, -1).join(", ")} e ${top[top.length - 1]}`;
  return top.length === 1
    ? { who: presenter, text: `[excited] Il colpo migliore è di ${names}: più ${best} punti!`, live: true }
    : { who: presenter, text: `[excited] Colpo migliore a pari merito per ${names}: più ${best} punti!`, live: true };
}

/** "Anna", "Anna e Bruno", "Anna, Bruno e Carla" */
function joinNames(list: LbSpeech[]): string {
  const n = list.map((e) => cleanSpeech(e.nickname));
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} e ${n[n.length - 1]}`;
}

/** Gruppi di pari merito, nell'ordine della classifica. */
function rankGroups(lb: LbSpeech[]): LbSpeech[][] {
  const out: LbSpeech[][] = [];
  for (const e of lb) {
    const last = out[out.length - 1];
    if (last && last[0].rank === e.rank) last.push(e);
    else out.push([e]);
  }
  return out;
}

const ORDINAL: Record<number, [string, string]> = { 1: ["primo", "primi"], 2: ["secondo", "secondi"], 3: ["terzo", "terzi"] };

export function scoreLeaderLine(lb: LbSpeech[]): SpokenLine | null {
  const top = rankGroups(lb)[0];
  if (!top) return null;
  if (top.length === 1) return { who: "professore", text: `[excited] In testa c'è ${cleanSpeech(top[0].nickname)}, con ${top[0].points} punti! Applausi, prego.`, live: true };
  return { who: "professore", text: `[excited] In testa, a pari merito, ci sono ${joinNames(top)}, con ${top[0].points} punti! Applausi, prego.`, live: true };
}

export function leaderboardLine(lb: LbSpeech[]): SpokenLine | null {
  const groups = rankGroups(lb);
  if (groups.length === 0) return null;
  if (lb.length >= 3) {
    // posizioni del podio (1–3), con i pari merito detti insieme
    const parts = groups
      .filter((g) => g[0].rank <= 3)
      .map((g) => {
        const [one, many] = ORDINAL[g[0].rank];
        return g.length === 1 ? `${one} ${cleanSpeech(g[0].nickname)}` : `${many} a pari merito ${joinNames(g)}`;
      });
    const text = parts.join(", ");
    return { who: "regina", text: `[laughs] Ecco la classifica! ${text.charAt(0).toUpperCase()}${text.slice(1)}. Gli altri… ci stanno lavorando!`, live: true };
  }
  const top = groups[0];
  if (top.length > 1) return { who: "regina", text: `[excited] Ecco la classifica! Al comando, a pari merito, ${joinNames(top)}!`, live: true };
  return { who: "regina", text: `[excited] Ecco la classifica! Al comando c'è ${cleanSpeech(top[0].nickname)}!`, live: true };
}

/**
 * Classifica finale con suspense, uguale su TV e telefoni (secondi dall'inizio della fase FINISHED):
 * apertura → tutti gli altri letti dal fondo fino al 4° posto → rullo → 3° posto →
 * luci basse e "E il vincitore è…" → vincitore e, insieme, il 2° posto → saluti.
 * I pari merito vengono rivelati insieme.
 */
export interface PodiumStep {
  rank: number;
  entries: LbSpeech[];
  /** rullo di tamburi (null = nessun rullo: il 2° arriva insieme al vincitore) */
  drumAt: number | null;
  /** rivelazione */
  at: number;
  line: SpokenLine;
}
export interface PodiumRest {
  /** dal 4° posto in giù, nell'ordine in cui vengono letti (dal fondo) */
  entries: LbSpeech[];
  /** inizio della lettura e secondi per nome (per far comparire i nomi mentre vengono detti) */
  at: number;
  perName: number;
  line: SpokenLine | null;
}
export interface PodiumPlan {
  opening: SpokenLine;
  rest: PodiumRest;
  steps: PodiumStep[];
  /** "E il vincitore è…": luci basse e rullo lungo (null = nessun vincitore) */
  tensionAt: number | null;
  winnerAt: number;
  closing: SpokenLine;
  closeAt: number;
}

const REST_AT = 4;
const REST_PER_NAME = 0.9;
/** oltre questi nomi la voce riassume ("e tutti gli altri"), lo schermo li mostra comunque */
const REST_MAX_SPOKEN = 20;
const PODIUM_TENSION = 5;

export function podiumPlan(lb: LbSpeech[], seed: string): PodiumPlan {
  const groups = rankGroups(lb);
  const podium = groups.filter((g) => g[0].rank <= 3);
  // tutti gli altri, dal fondo al 4° posto
  const restEntries = [...lb.filter((e) => e.rank > 3)].reverse();
  let restLine: SpokenLine | null = null;
  if (restEntries.length > 0) {
    const spoken = restEntries.slice(-REST_MAX_SPOKEN);
    const skipped = restEntries.length - spoken.length;
    const names = spoken.map((e) => cleanSpeech(e.nickname));
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")}… e ${names[names.length - 1]}`;
    restLine = {
      who: "regina",
      text: `[excited] Partiamo dal fondo della classifica! ${skipped > 0 ? "Dopo tutti gli altri… " : ""}${list}!`,
      live: true,
    };
  }
  const spokenCount = Math.min(restEntries.length, REST_MAX_SPOKEN);
  const restEnd = restEntries.length > 0 ? REST_AT + 2 + spokenCount * REST_PER_NAME : REST_AT;

  const steps: PodiumStep[] = [];
  let t = restEnd + 2;
  const third = podium.find((g) => g[0].rank === 3);
  if (third) {
    steps.push({
      rank: 3,
      entries: third,
      drumAt: t - 1.6,
      at: t,
      line:
        third.length === 1
          ? { who: "regina", text: `Al terzo posto… [excited] ${cleanSpeech(third[0].nickname)}!`, live: true }
          : { who: "regina", text: `Al terzo posto, a pari merito… [excited] ${joinNames(third)}!`, live: true },
    });
    t += 6;
  }
  const winners = podium.find((g) => g[0].rank === 1);
  let tensionAt: number | null = null;
  let winnerAt = t;
  if (winners) {
    tensionAt = t - 1;
    winnerAt = tensionAt + PODIUM_TENSION;
    steps.push({
      rank: 1,
      entries: winners,
      drumAt: tensionAt,
      at: winnerAt,
      line:
        winners.length === 1
          ? { who: "palmino", text: `[shouts] E il vincitore di stasera è… ${cleanSpeech(winners[0].nickname)}! [giggles] Complimentoni!`, live: true }
          : { who: "palmino", text: `[shouts] E i vincitori di stasera, a pari merito, sono… ${joinNames(winners)}! [giggles] Complimentoni a tutti!`, live: true },
    });
  }
  // il 2° posto compare in automatico insieme al vincitore (la voce lo dice subito dopo)
  const second = podium.find((g) => g[0].rank === 2);
  if (second) {
    steps.push({
      rank: 2,
      entries: second,
      drumAt: null,
      at: winnerAt,
      line:
        second.length === 1
          ? { who: "regina", text: `E al secondo posto… ${cleanSpeech(second[0].nickname)}! Applausi!`, live: true }
          : { who: "regina", text: `E al secondo posto, a pari merito… ${joinNames(second)}! Applausi!`, live: true },
    });
  }
  return {
    opening: fixedLine(FIXED_POOLS.finishedOpen, seed),
    rest: { entries: restEntries, at: REST_AT, perName: REST_PER_NAME, line: restLine },
    steps,
    tensionAt,
    winnerAt,
    closing: fixedLine(FIXED_POOLS.finishedClose, seed),
    closeAt: winnerAt + 9,
  };
}

/** Prima posizione davvero rivelata (per tenere coperto il podio finché non tocca a lui). */
export const PODIUM_FIRST_AT = REST_AT;

/** Tutte le battute del podio, nell'ordine in cui vengono dette (per il pre-riscaldamento delle voci). */
export function podiumLines(lb: LbSpeech[], seed: string): SpokenLine[] {
  const plan = podiumPlan(lb, seed);
  return [plan.opening, ...(plan.rest.line ? [plan.rest.line] : []), ...plan.steps.map((st) => st.line), plan.closing];
}

// ---------------------------------------------------------------------------
// Insieme finito delle battute generiche
// ---------------------------------------------------------------------------
const POOL_PHASES: GamePhase[] = ["OPTIONS_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL"];

/**
 * Tutte le battute che non dipendono da domande, round o nickname: si pagano
 * una volta sola e valgono per ogni serata.
 */
export function genericScriptLines(maxQuestionNumber = GENERIC_QUESTION_NUMBERS): SpokenLine[] {
  const out: SpokenLine[] = [WELCOME_LINE, ...MIC_TEST_LINES];
  for (const pool of Object.values(FIXED_POOLS)) for (const text of pool.texts) out.push({ who: pool.who, text });
  for (let n = 1; n <= maxQuestionNumber; n++) out.push(questionNumberLine(n));
  for (const p of PRESENTERS) {
    out.push(multipleWarningLine(p));
    for (const phase of POOL_PHASES) for (const text of presenterLinePool(phase, p)) out.push({ who: p, text });
    for (const text of [...REVEAL_QUIPS[p].easy, ...REVEAL_QUIPS[p].hard]) out.push({ who: p, text });
  }
  return dedupeLines(out);
}

/** Battute degli eventi di una definizione: anche nella variante "Palmino decide". */
export function eventDefinitionScriptLines(def: { title: string; tagline: string }): SpokenLine[] {
  return [...eventLines(def), ...eventLines({ title: def.title, tagline: PALMINO_DECIDES_PREFIX + def.tagline })];
}

export function lineId(l: Pick<SpokenLine, "who" | "text" | "live">): string {
  return `${l.who}|${l.live ? "live" : "pregen"}|${ttsText(l.text)}`;
}

export function dedupeLines(lines: SpokenLine[]): SpokenLine[] {
  const seen = new Set<string>();
  const out: SpokenLine[] = [];
  for (const l of lines) {
    if (!l.text.trim()) continue;
    const id = lineId(l);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(l);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Copione per transizione di stato (TV) — usato anche dal server per il pre-riscaldamento
// ---------------------------------------------------------------------------
/** Battute del regista automatico per il momento corrente (sempre live: contengono nomi veri). */
export function directedLines(s: Pick<PublicState, "showLines">): SpokenLine[] {
  return (s.showLines ?? []).map((l) => ({ who: l.who, text: l.text, live: true }));
}

/**
 * Saluti della lobby da dire ADESSO: solo quelli comparsi rispetto allo stato precedente
 * (riconosciuti dall'id del registro). Dopo un ricaricamento del TV (`prev` null) non si ripete
 * niente; fuori dalla lobby (anche in pausa) non si saluta nessuno.
 */
export function lobbyGreetingLines(s: Pick<PublicState, "phase" | "showLines">, prev: Pick<PublicState, "phase" | "showLines"> | null): SpokenLine[] {
  if (!prev || s.phase !== "LOBBY") return [];
  const seen = new Set((prev.showLines ?? []).map((l) => l.id ?? `${l.who}|${l.text}`));
  return (s.showLines ?? [])
    .filter((l) => l.event === "PLAYERS_JOINED" && !seen.has(l.id ?? `${l.who}|${l.text}`))
    .map((l) => ({ who: l.who, text: l.text, live: true }));
}

/**
 * Copione parlato per una transizione di stato (solo TV).
 * Deterministico: un TV che ricarica non cambia le battute (le varianti
 * dipendono da id stabili e dall'orario di inizio fase, uguale per tutti).
 * Dipende da `prev` solo per la fase precedente.
 */
export function speechFor(s: PublicState, prev: Pick<PublicState, "phase">, opts: { readOptions: boolean }): SpokenLine[] {
  const out: SpokenLine[] = [];
  const pq = s.question;
  const presenter: Presenter = pq?.presenter ?? s.round?.presenter ?? "professore";
  if (s.phase === prev.phase) return out;
  // ripresa dopo la pausa: nessuna rilettura di domanda/risposte
  if (prev.phase === "PAUSED" && s.phase !== "FINISHED") return [fixedLine(FIXED_POOLS.resume, s.phaseStartedAt)];
  const q = pq
    ? toScriptQuestion({
        id: pq.id,
        type: pq.type,
        text: pq.text,
        presenter: pq.presenter,
        mediaKind: pq.media?.kind ?? null,
        options: pq.options ?? [],
        correctPositions: pq.correctPositions ?? [],
      })
    : null;

  switch (s.phase) {
    case "LOBBY":
      if (prev.phase === "READY") out.push(fixedLine(FIXED_POOLS.lobby, s.sessionId));
      break;
    case "ROUND_INTRO":
      if (s.round) out.push(roundIntroLine(s.round));
      // inizio della finale: il regista nomina primo e secondo (battuta live, nomi veri)
      out.push(...directedLines(s));
      break;
    case "CATEGORY_VOTING":
      out.push(fixedLine(FIXED_POOLS.voting, s.round?.id ?? s.sessionId));
      break;
    case "CATEGORY_RESULT": {
      const w = s.vote?.options.find((o) => o.id === s.vote?.winnerOptionId);
      if (w) out.push(categoryResultLine(w.label));
      break;
    }
    case "SPECIAL_EVENT":
      if (s.event) out.push(...eventLines(s.event));
      break;
    case "QUESTION_VISIBLE":
      if (q && pq) {
        if (pq.number) out.push(questionNumberLine(pq.number));
        out.push(questionTextLine(q));
        if (q.type === "multiple") out.push(multipleWarningLine(presenter));
      }
      break;
    case "OPTIONS_VISIBLE":
      if (q && pq?.options) {
        if (opts.readOptions) out.push(optionsLine(q));
        out.push(optionsQuip(presenter, q.id));
      }
      break;
    case "ANSWERS_LOCKED":
      out.push(lockedQuip(presenter, q?.id ?? "x"));
      break;
    case "ANSWER_REVEAL":
      if (q && pq?.correctPositions && pq.options) {
        out.push(revealLine(q));
        const total = pq.distribution?.reduce((a, b) => a + b, 0) ?? 0;
        const right = pq.distribution && q.correctPositions.length === 1 ? pq.distribution[q.correctPositions[0]] : null;
        if (total > 0 && right !== null) out.push(revealQuip(presenter, q.id, right / total));
      }
      break;
    case "SCORE_REVEAL": {
      // battute del regista automatico: eventi reali della classifica con i nomi veri
      const directed = directedLines(s);
      if (directed.length > 0) {
        out.push(...directed);
        // a metà round, se il regista ha detto una sola cosa, ci sta anche una battuta
        if (directed.length === 1 && pq && pq.positionInRound < pq.totalInRound) out.push(scoreQuipLine(presenter, pq.id));
        break;
      }
      // senza eventi rilevanti: chi è in testa a fine round; prima, il colpo migliore e una battuta
      if (!pq || pq.positionInRound >= pq.totalInRound) {
        const l = scoreLeaderLine(s.leaderboard ?? []);
        if (l) out.push(l);
      } else {
        out.push(answerStarLine(s.leaderboard ?? [], presenter, pq.id));
        out.push(scoreQuipLine(presenter, pq.id));
      }
      break;
    }
    case "LEADERBOARD": {
      const l = leaderboardLine(s.leaderboard ?? []);
      if (l) out.push(l);
      break;
    }
    case "PAUSED":
      out.push(fixedLine(FIXED_POOLS.paused, s.phaseStartedAt));
      break;
    case "FINISHED":
      // solo l'apertura: il resto lo scandisce la rivelazione del podio (podiumPlan), con la suspense
      out.push(podiumPlan(s.leaderboard ?? [], s.sessionId).opening);
      break;
  }
  return out.filter((l) => l.text.trim().length > 0);
}
