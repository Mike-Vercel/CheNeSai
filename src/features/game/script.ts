import type { GamePhase, LeaderboardEntry, MediaKind, Presenter, PublicBetHighlight, PublicState, QuestionType, RoundKind, RoundSpecialSettings } from "@/lib/game-engine/types";
import { PRESENTERS } from "@/lib/game-engine/types";
import { presenterLine, presenterLinePool, REVEAL_QUIPS, revealOutcome, seededPick, stripAudioTags, type RevealOutcome, type Rotation } from "./lines";
import { lineFitsMoment, NO_MOMENT, pickForMoment, questionMoment, type MomentContext } from "./moment";
import { roundStandingsForShow, standingsForShow } from "./teams-view";

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
  /**
   * Detta durante il cartello "DOMANDA N. X" (prima che compaia la domanda): il TV mostra la
   * domanda solo dopo queste battute (vedi DisplayApp e question-intro.ts).
   */
  beforeCard?: boolean;
  /** testo da mostrare nel fumetto (libreria ufficiale: quello scritto dall'utente); assente = testo senza tag */
  display?: string;
  /** battuta di contorno: se la voce non arriva in tempo si salta (mai sottotitolo muto) */
  optional?: boolean;
  /** righe della stessa scenetta: se una salta, saltano le successive */
  group?: string;
  /**
   * "La risposta giusta è…": finché il presentatore non l'ha finita il TV non evidenzia la
   * risposta giusta (poi la evidenzia mentre la dice). Vedi reveal-hold.ts.
   */
  revealTease?: boolean;
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
      "[laughs] Benvenuti a corte! Inquadrate il QR, scegliete un nome… e sperate che la Regina sia clemente.",
      "[excited] Entrate, entrate! Il codice è sullo schermo: chi arriva ultimo paga da bere. Scherzo… forse.",
      "[sarcastic] Avanti, sudditi! Inquadrate il QR: stasera scopriremo chi ha studiato e chi ha solo un bel sorriso.",
      "Tutti dentro! Codice QR, nickname e telefono carico: la Regina non aspetta nessuno.",
      "[giggles] Ah, che bello vedervi! Inquadrate il codice e preparatevi a fare figuracce in diretta.",
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
  // votazione a metà round (dopo le prime domande comuni): Palmino annuncia che adesso si sceglie
  votingMidRound: {
    who: "palmino",
    texts: [
      "[excited] E adesso decidete voi la materia delle prossime domande! Votate dal telefono!",
      "[giggles] Basta riscaldamento! Adesso la materia la scegliete voi: votate dal telefono, presto presto!",
      "[shouts] Momento del voto! Scegliete dal telefono la materia delle prossime domande!",
    ],
  },
  // partenza della Ruota impazzita (la battuta di arrivo dipende dalla categoria: wheelResultLine)
  wheelSpin: {
    who: "palmino",
    texts: [
      "[shouts] Gira, gira, gira la ruota! Dove si ferma, nessuno lo sa!",
      "[giggles] Via! Che la Ruota impazzita decida per voi… io intanto tifo per lo spicchio più difficile!",
      "[excited] Tenetevi forte: la ruota sta girando! Occhi sul TV!",
    ],
  },
  // Ruota di Palmino: arriva fra una domanda e l'altra e la spinge lui (dette prima della partenza: corte)
  palminoWheel: {
    who: "palmino",
    texts: [
      "[shouts] Fermi tutti! La prossima domanda la sceglie la mia ruota!",
      "[giggles] Ehi ehi! Tocca a Palmino: giro la ruota e vediamo cosa esce!",
      "[excited] Sorpresa! Ruota di Palmino: dove si ferma, si gioca!",
    ],
  },
  paused: {
    who: "regina",
    texts: [
      "Facciamo una piccola pausa. Restate con noi!",
      "[sighs] Pausa! Anche una regina deve ritoccarsi il trucco.",
      "[laughs] Piccola pausa: bevete, sgranchitevi, ma non scappate!",
      "[sarcastic] Pausa! Approfittatene per ripassare… anche se ormai è un po' tardi.",
      "[excited] Pausa! Ordinate qualcosa, tanto i punti non scappano. Le figuracce nemmeno.",
      "Ci fermiamo un attimo. Telefoni accesi e cervelli in carica, mi raccomando!",
    ],
  },
  resume: {
    who: "regina",
    texts: [
      "[excited] Si riparte!",
      "Eccoci di nuovo! Si riparte!",
      "[laughs] Pausa finita, cervelli accesi: si riparte!",
      "[shouts] Tutti ai posti! La Regina è tornata e la gara pure!",
      "[sarcastic] Bentornati! Spero che in pausa abbiate ripassato… ne avete bisogno.",
      "[excited] Ricominciamo! Telefoni in mano, si gioca!",
    ],
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
      "[laughs] Chi ha risposto giusto: bravo! Chi no: faccia finta di niente, nessuno ha visto.",
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
      "[shouts] Nessuno! Ma proprio nessuno! Mi cadono le foglie dalla vergogna!",
      "[laughs] Zero assoluto! Questa domanda vi ha battuti tutti quanti!",
      "[sighs] Nessuno ha fatto punti… Palmino va a piangere dietro al bancone.",
      "[giggles] Tabellone fermo! Nessuno l'ha indovinata: la domanda vince, voi zero!",
    ],
  },
  // Scommetti tutto: si apre la domanda, si punta dal telefono (prima delle risposte)
  betOpen: {
    who: "palmino",
    texts: [
      "[excited] Fate il vostro gioco! Puntate dal telefono prima che arrivino le risposte!",
      "[giggles] Quanto vi fidate di voi stessi? Puntate adesso: niente, un quarto, metà… o tutto!",
      "[shouts] Puntate, puntate! Chi ha coraggio va all in!",
    ],
  },
  // Grande ribaltone: chi insegue ha il boost su questa domanda
  comebackBoost: {
    who: "regina",
    texts: [
      "[excited] Chi è indietro ha il boost! È il momento della rimonta!",
      "[laughs] Ultimi della classifica, svegliatevi: su questa domanda i vostri punti valgono di più!",
      "Chi insegue ha il turbo: occhio, primi della classe!",
    ],
  },
  // ultima domanda del round (detta dall'annunciatore dopo "Domanda numero N")
  lastOfRoundCall: {
    who: "annunciatore",
    texts: [
      "[excited] Ultima domanda del round!",
      "[shouts] Attenzione: ultima domanda del round!",
      "[excited] Si chiude il round con questa domanda!",
      "[shouts] Ultima del round: chi sbaglia adesso ci pensa fino alla classifica!",
      "Ultima domanda del round. Concentrazione!",
    ],
  },
  // ultima domanda della serata: al posto di "Domanda numero N"
  lastOfGameCall: {
    who: "annunciatore",
    texts: [
      "[shouts] Ultima domanda della serata!",
      "[excited] Signore e signori: l'ultima domanda della serata!",
      "[shouts] Ci siamo! Questa è l'ultima domanda della serata!",
      "[whispers] Ultima domanda della serata. Da qui si decide tutto.",
    ],
  },
  // suspense prima dell'ultima domanda quando non ci sono (ancora) nomi da fare
  lastOfGameSuspense: {
    who: "regina",
    texts: [
      "[whispers] Ultima domanda. Tutto può ancora cambiare: respirate, concentratevi… e che vinca il migliore!",
      "[excited] Siamo all'ultima domanda! La classifica può ancora ribaltarsi: occhi aperti!",
      "[whispers] Ultimo giro. Chi è davanti trema, chi è dietro spera. Concentratevi.",
      "[sarcastic] Ultima occasione per rimediare alle figuracce di stasera. Non sprecatela!",
      "[excited] Tutto si decide adesso: una risposta e la classifica può cambiare faccia!",
      "[whispers] Silenzio… è l'ultima. Niente distrazioni, niente scuse.",
    ],
  },
  // prima della soluzione dell'ultima domanda della serata
  lastReveal: {
    who: "professore",
    texts: [
      "[whispers] Ultima soluzione della serata. Silenzio in sala…",
      "[whispers] Il momento della verità. Trattenete il respiro…",
      "[clears throat] Ecco l'ultima soluzione. Chi ha studiato può sorridere…",
      "[whispers] Ultima risposta giusta della serata. Pronti?",
      "[excited] Il verdetto finale sta per arrivare!",
    ],
  },
  // salto dell'intro votato da tutti i giocatori
  introSkipped: {
    who: "regina",
    texts: [
      "[laughs] Vedo che siete esperti: niente spiegazioni, si parte subito!",
      "[excited] Le regole le conoscete già? Benissimo: si parte subito!",
      "[sarcastic] Tutti esperti, eh? Vedremo tra poco quanto ne sapete davvero!",
      "[laughs] Niente regole, solo domande! Vi piace vivere pericolosamente.",
      "[excited] Intro saltata all'unanimità: dritti al sodo!",
    ],
  },
  // podio: Palmino annuncia il vincitore PRIMA che compaia (poi rullo di tamburi e il nome)
  podiumWinnerCall: {
    who: "palmino",
    texts: [
      "[shouts] E il vincitore di stasera èèèèè…",
      "[excited] E il vincitore di stasera è…",
      "[whispers] Silenzio in sala… e il vincitore di stasera è…",
      "[shouts] Fermi tutti! E il vincitore di stasera è…",
      "[giggles] Palmino non ce la fa più! E il vincitore di stasera è…",
    ],
  },
  finishedOpen: {
    who: "professore",
    texts: [
      "[clears throat] Signore e signori, ecco i campioni della serata!",
      "[excited] Signore e signori, è il momento più atteso: il podio!",
      "[clears throat] La gara è finita. Ora la classifica non mente: ecco il podio!",
      "[excited] Si chiude la serata! Tre gradini, tanta gloria: ecco il podio!",
      "[sarcastic] Dopo tante figuracce, finalmente qualcuno da premiare: ecco il podio!",
      "Silenzio in sala. È il momento dei campioni della serata!",
    ],
  },
  finishedClose: {
    who: "professore",
    texts: [
      "Grazie a tutti! Alla prossima sfida!",
      "[laughs] Grazie a tutti! Ripassate, studiate… e alla prossima vi aspetto!",
      "[clears throat] Grazie a tutti! La cultura vi aspetta… e anche noi, alla prossima partita!",
      "[laughs] Applausi per tutti, anche per chi ha sbagliato tutto! Alla prossima!",
      "[sarcastic] Bella partita! Qualcuno torni a casa e apra un libro. Alla prossima!",
      "Grazie per aver giocato con noi! Rivincita quando volete.",
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

/** Filtro delle battute per il momento (ultima domanda: niente "la prossima…"). */
const fitsFor = (m: MomentContext) => (text: string) => lineFitsMoment(text, m);

export function optionsQuip(presenter: Presenter, seed: string, m: MomentContext = NO_MOMENT, rot?: Rotation): SpokenLine {
  return { who: presenter, text: presenterLine("OPTIONS_VISIBLE", presenter, seed, fitsFor(m), rot) ?? "Il tempo scorre!" };
}

export function lockedQuip(presenter: Presenter, seed: string, m: MomentContext = NO_MOMENT, rot?: Rotation): SpokenLine {
  return { who: presenter, text: presenterLine("ANSWERS_LOCKED", presenter, seed, fitsFor(m), rot) ?? "Risposte bloccate!" };
}

/**
 * Soluzione in due battute: prima "La risposta giusta è…" (uguale per tutte le domande: una sola
 * clip salvata), poi la risposta. Il TV evidenzia la risposta giusta solo a fine della prima.
 */
export function revealLines(q: Pick<ScriptQuestion, "presenter" | "options" | "correctPositions">): SpokenLine[] {
  const parts = q.correctPositions.map((p) => `${LETTER[p]}, ${cleanSpeech(q.options.find((o) => o.position === p)?.text ?? "")}`);
  const many = q.correctPositions.length > 1;
  return [
    { who: q.presenter, text: many ? "[excited] Le risposte giuste sono…" : "[excited] La risposta giusta è…", revealTease: true },
    { who: q.presenter, text: `[excited] ${many ? parts.join(" e ") : parts[0]}!` },
  ];
}

/** Commento dopo la rivelazione: quasi tutti giusti, quasi tutti sbagliati, sala divisa. */
export function revealQuip(presenter: Presenter, seed: string, outcome: RevealOutcome, m: MomentContext = NO_MOMENT, rot?: Rotation): SpokenLine {
  const q = REVEAL_QUIPS[presenter];
  const pool =
    outcome === "none" ? q.none : outcome === "few" ? [...q.few, ...q.hard] : outcome === "all" ? [...q.all, ...q.easy] : outcome === "most" ? [...q.most, ...q.easy] : null;
  const text = pool ? pickForMoment(pool, seed, m, undefined, rot) : (presenterLine("ANSWER_REVEAL", presenter, seed, fitsFor(m), rot) ?? "");
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
  if (q.correctPositions.length > 0 && q.options.length > 0) out.push(...revealLines(q));
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
  special?: RoundSpecialSettings | null;
  /** round a votazione: domande comuni prima del voto (assente/null = voto subito) */
  voteAfter?: number | null;
}

/** "2", "1,5" (come si dice a voce) */
function spokenNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace(".", " virgola ");
}

/** Spiegazione delle regole di una manche speciale (detta nella presentazione del round). */
export function specialRulesSpeech(kind: RoundKind, special: RoundSpecialSettings | null | undefined): string {
  if (kind === "bet") {
    const min = special?.kind === "bet" ? special.minStake : 0;
    return (
      " [excited] Scommetti tutto! Prima delle risposte puntate dal telefono una parte dei vostri punti: niente, un quarto, metà o tutto." +
      " Se indovinate la posta è vostra, se sbagliate la perdete!" +
      (min > 0 ? ` Chi ha pochi punti può puntare comunque ${min}.` : "")
    );
  }
  if (kind === "comeback") {
    const boost = special?.kind === "comeback" ? special.boostMultiplier : 2;
    const penalty = special?.kind === "comeback" ? special.leaderPenaltyMultiplier : 1;
    return (
      " [excited] Grande ribaltone!" +
      (boost > 1 ? ` Chi è nella metà bassa della classifica prende i punti moltiplicati per ${spokenNumber(boost)}!` : "") +
      (penalty > 1 ? ` E chi è in testa, se sbaglia, perde ${spokenNumber(penalty)} volte tanto!` : "")
    );
  }
  return "";
}

/** Titoli che ripetono solo il numero del round ("Secondo round", "Round 2"): dopo "Round 2" non si dicono. */
const GENERIC_ROUND_TITLE = /^\s*((primo|secondo|terzo|quarto|quinto|sesto|settimo|ottavo|nono|decimo|ultimo)\s+round|round\s*\d+)\s*[.!]?\s*$/i;

/** "Round 2: Cultura pop" oppure solo "Round 2" se il titolo è generico. */
function roundCall(r: Pick<ScriptRound, "index" | "title">): string {
  const title = cleanSpeech(r.title ?? "");
  return !title || GENERIC_ROUND_TITLE.test(title) ? `Round ${r.index}` : `Round ${r.index}: ${title}`;
}

export function roundIntroLine(r: ScriptRound): SpokenLine {
  if (r.kind === "category_vote" && r.voteAfter) {
    return { who: "palmino", text: `[giggles] ${roundCall(r)}. Si parte con ${spokenNumber(r.voteAfter)} domande… poi la materia la scegliete voi!` };
  }
  if (r.kind === "category_vote") return { who: "palmino", text: `[giggles] ${roundCall(r)}. Adesso decidete voi… tanto vinco io!` };
  if (r.kind === "category_wheel") return { who: "palmino", text: `[excited] ${roundCall(r)}. Arriva la Ruota impazzita: la categoria la sceglie lei!` };
  const special = specialRulesSpeech(r.kind, r.special);
  const extra = special
    ? special
    : r.pointsMultiplier > 1
      ? ` [excited] Attenzione: i punti valgono ${r.pointsMultiplier} volte!`
      : r.noPenalty
        ? " In questo round non si perdono punti. Osate!"
        : "";
  return {
    who: r.presenter,
    text: `${ROUND_LEAD[r.presenter]} ${roundCall(r)}!${r.description ? " " + cleanSpeech(r.description) : ""}${extra}`,
  };
}

export function categoryResultLine(label: string): SpokenLine {
  return { who: "palmino", text: `[shouts] Avete scelto: ${cleanSpeech(label)}!` };
}

/** Battuta all'arrivo della ruota (la dice il TV quando la ruota si ferma). */
export function wheelResultLine(label: string): SpokenLine {
  return { who: "palmino", text: `[shouts] La ruota si è fermata su: ${cleanSpeech(label)}!` };
}

/** Ruota di Palmino: la categoria scelta, detta quando la ruota si ferma ("Tocca a… CINEMA!"). */
export function palminoWheelResultLine(label: string): SpokenLine {
  return { who: "palmino", text: `[shouts] Tocca a… ${cleanSpeech(label)}!` };
}

/** Ruota di Palmino: battuta d'arrivo di Palmino (prima che la spinga), uguale su ogni schermo. */
export function palminoWheelStartLine(seed: string): SpokenLine {
  return fixedLine(FIXED_POOLS.palminoWheel, seed);
}

/** Battuta di partenza del giro: stessa variante su ogni TV (dipende dal round). */
export function wheelSpinLine(roundId: string): SpokenLine {
  return fixedLine(FIXED_POOLS.wheelSpin, roundId);
}

/** Battuta di arrivo per lo stato corrente della ruota (null se non c'è un giro). */
export function wheelStopLine(s: Pick<PublicState, "wheel">): SpokenLine | null {
  const spin = s.wheel?.spin;
  const seg = spin ? s.wheel?.segments[spin.winnerIndex] : undefined;
  if (!seg) return null;
  return s.wheel?.kind === "palmino" ? palminoWheelResultLine(seg.label) : wheelResultLine(seg.label);
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
export function scoreQuipLine(presenter: Presenter, seed: string, m: MomentContext = NO_MOMENT, rot?: Rotation): SpokenLine {
  const pool = presenter === "regina" ? FIXED_POOLS.scoreQuipRegina : presenter === "palmino" ? FIXED_POOLS.scoreQuipPalmino : FIXED_POOLS.scoreQuipProfessore;
  return { who: pool.who, text: pickForMoment(pool.texts, seed, m, undefined, rot) };
}

/** "Anna", "Anna e Bruno", "Anna, Bruno e Carla" (nomi qualsiasi: giocatori o squadre). */
function joinPlain(list: readonly string[]): string {
  const n = list.map((x) => cleanSpeech(x));
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} e ${n[n.length - 1]}`;
}

/**
 * Suspense prima dell'ultima domanda della serata, con i nomi veri di chi si gioca la vittoria
 * (`contenders`: i primi della classifica, solo in quel momento). Senza nomi: battuta fissa.
 */
export function lastQuestionSuspenseLine(contenders: readonly { name: string; points: number }[] | null | undefined, seed: string): SpokenLine {
  const top = [...(contenders ?? [])].sort((a, b) => b.points - a.points);
  if (top.length < 2 || top[0].points <= 0) return fixedLine(FIXED_POOLS.lastOfGameSuspense, seed);
  const leaders = top.filter((c) => c.points === top[0].points);
  if (leaders.length > 1) {
    return { who: "regina", text: `[excited] Ultima domanda! ${joinPlain(leaders.map((c) => c.name))} sono appaiati in testa con ${top[0].points} punti: chi risponde giusto può vincere tutto!`, live: true };
  }
  const gap = top[0].points - top[1].points;
  return {
    who: "regina",
    text: `[excited] Ultima domanda! In testa c'è ${cleanSpeech(top[0].name)} con ${top[0].points} punti, ma ${cleanSpeech(top[1].name)} è a ${gap} punti di distanza: tutto può ancora cambiare!`,
    live: true,
  };
}

/** Vincitore del ROUND (punti fatti in questo round), detto con la classifica del round. */
export function roundWinnerLine(roundLb: readonly LbSpeech[], roundIndex: number | null): SpokenLine | null {
  const top = rankGroups([...roundLb])[0];
  if (!top || top[0].points <= 0) return null;
  const which = roundIndex ? `Il round ${roundIndex}` : "Questo round";
  if (top.length === 1) return { who: "professore", text: `[excited] ${which} lo vince ${cleanSpeech(top[0].nickname)}, con ${top[0].points} punti nel round! Applausi, prego.`, live: true };
  return { who: "professore", text: `[excited] ${which} finisce a pari merito: ${joinNames(top)}, con ${top[0].points} punti ciascuno! Applausi, prego.`, live: true };
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

/** Scommetti tutto: la vincita più grande della domanda (con il nome vero). */
export function betStarLine(wins: Pick<PublicBetHighlight, "nickname" | "tier" | "delta">[], presenter: Presenter): SpokenLine | null {
  const best = wins[0];
  if (!best || best.delta <= 0) return null;
  const name = cleanSpeech(best.nickname);
  return best.tier === 100
    ? { who: presenter, text: `[excited] ${name} ha puntato tutto e ha vinto ${best.delta} punti! Che fegato!`, live: true }
    : { who: presenter, text: `[excited] La vincita più grande è di ${name}: più ${best.delta} punti!`, live: true };
}

/** "Anna", "Anna e Bruno", "Anna, Bruno e Carla" */
function joinNames(list: readonly LbSpeech[]): string {
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
    return { who: "regina", text: `[laughs] Ecco la classifica generale! ${text.charAt(0).toUpperCase()}${text.slice(1)}. Gli altri… ci stanno lavorando!`, live: true };
  }
  const top = groups[0];
  if (top.length > 1) return { who: "regina", text: `[excited] Ecco la classifica generale! Al comando, a pari merito, ${joinNames(top)}!`, live: true };
  return { who: "regina", text: `[excited] Ecco la classifica generale! Al comando c'è ${cleanSpeech(top[0].nickname)}!`, live: true };
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
  /** "E il vincitore è…": luci basse, Palmino lo annuncia e poi il rullo lungo (null = nessun vincitore) */
  tensionAt: number | null;
  /** battuta di Palmino all'inizio della suspense (detta PRIMA che il vincitore compaia; null = nessun vincitore) */
  winnerCall: SpokenLine | null;
  winnerAt: number;
  /**
   * Libreria ufficiale: battuta sul vincitore della serata e scenetta finale, dette SOLO dopo la
   * rivelazione del nome (subito dopo il 2° posto), prima dei saluti.
   */
  after: SpokenLine[];
  closing: SpokenLine;
  closeAt: number;
}

const REST_AT = 4;
const REST_PER_NAME = 0.9;
/** oltre questi nomi la voce riassume ("e tutti gli altri"), lo schermo li mostra comunque */
const REST_MAX_SPOKEN = 20;
/** suspense del vincitore: "E il vincitore di stasera è…" (~2,2 s), poi il rullo fino alla rivelazione */
const PODIUM_TENSION = 5.4;
/** il rullo per il vincitore parte dopo l'annuncio di Palmino */
const PODIUM_DRUM_AFTER = 2.2;

export function podiumPlan(lb: LbSpeech[], seed: string, extra: readonly SpokenLine[] = []): PodiumPlan {
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
    // il nome lo grida Palmino nell'istante in cui compare (l'annuncio "E il vincitore è…" lo ha già fatto prima)
    steps.push({
      rank: 1,
      entries: winners,
      drumAt: tensionAt + PODIUM_DRUM_AFTER,
      at: winnerAt,
      line:
        winners.length === 1
          ? { who: "palmino", text: `[shouts] ${cleanSpeech(winners[0].nickname)}! Complimentoni!`, live: true }
          : { who: "palmino", text: `[shouts] A pari merito: ${joinNames(winners)}! Complimentoni a tutti!`, live: true },
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
    winnerCall: winners ? fixedLine(FIXED_POOLS.podiumWinnerCall, seed) : null,
    winnerAt,
    // senza vincitore rivelato niente battuta sul vincitore
    after: winners ? [...extra] : [],
    closing: fixedLine(FIXED_POOLS.finishedClose, seed),
    closeAt: winnerAt + 9,
  };
}

/** Battute del podio decise dal server (libreria ufficiale), dallo stato della fase FINISHED. */
export function podiumExtraLines(s: Pick<PublicState, "showLines">): SpokenLine[] {
  return directedLines({ showLines: (s.showLines ?? []).filter((l) => l.event === "GAME_WINNER" || l.event === "GAME_END") });
}

/** Prima posizione davvero rivelata (per tenere coperto il podio finché non tocca a lui). */
export const PODIUM_FIRST_AT = REST_AT;

/** Tutte le battute del podio, nell'ordine in cui vengono dette (per il pre-riscaldamento delle voci). */
export function podiumLines(lb: LbSpeech[], seed: string, extra: readonly SpokenLine[] = []): SpokenLine[] {
  const plan = podiumPlan(lb, seed, extra);
  return [plan.opening, ...(plan.rest.line ? [plan.rest.line] : []), ...(plan.winnerCall ? [plan.winnerCall] : []), ...plan.steps.map((st) => st.line), ...plan.after, plan.closing];
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
    for (const pool of Object.values(REVEAL_QUIPS[p])) for (const text of pool) out.push({ who: p, text });
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
  return (s.showLines ?? []).map((l) => {
    const out: SpokenLine = { who: l.who, text: l.text, live: l.live ?? true };
    if (l.display !== undefined) out.display = l.display;
    if (l.optional) out.optional = true;
    if (l.group) out.group = l.group;
    return out;
  });
}

/** Eventi della libreria detti in un momento preciso (non nel copione della fase). */
const TIMED_EVENTS: ReadonlySet<string> = new Set(["TIME_RUNNING_OUT"]);

/** Battute del regista che fanno parte del copione della fase (escluse quelle che il TV dice a tempo). */
function phaseDirectedLines(s: Pick<PublicState, "showLines">): SpokenLine[] {
  return directedLines({ showLines: (s.showLines ?? []).filter((l) => !TIMED_EVENTS.has(l.event)) });
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
  const moment = questionMoment(s);
  // battute che tornano a ogni domanda: a rotazione nella serata (niente ripetizioni ravvicinate)
  const rot: Rotation | undefined = pq?.number ? { key: s.sessionId, n: pq.number } : undefined;
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
      // intro saltata a votazione: prima una battuta, poi il round
      if (s.introSkipped) out.push(fixedLine(FIXED_POOLS.introSkipped, s.sessionId));
      if (s.round) out.push(roundIntroLine(s.round));
      // inizio della finale: il regista nomina primo e secondo (battuta live, nomi veri)
      out.push(...directedLines(s));
      break;
    case "CATEGORY_VOTING":
      // a metà round (dopo le prime domande) l'annuncio del voto; a inizio round l'invito a votare
      out.push(fixedLine(s.round?.voteAfter ? FIXED_POOLS.votingMidRound : FIXED_POOLS.voting, s.round?.id ?? s.sessionId));
      break;
    case "CATEGORY_RESULT": {
      const w = s.vote?.options.find((o) => o.id === s.vote?.winnerOptionId);
      if (w) out.push(categoryResultLine(w.label));
      break;
    }
    case "WHEEL_SPIN":
      // Ruota di Palmino: arriva lui e la spinge (variante per numero di domanda: uguale su ogni schermo)
      if (s.wheel?.kind === "palmino") {
        out.push(palminoWheelStartLine(`${s.sessionId}|${s.wheel.questionNumber ?? s.questionsPlayed}`));
        // libreria ufficiale: "Durante la ruota" (il TV la salta se non finisce prima del risultato)
        out.push(...phaseDirectedLines(s));
      } else out.push(wheelSpinLine(s.round?.id ?? s.sessionId));
      break;
    case "SPECIAL_EVENT":
      if (s.event) out.push(...eventLines(s.event));
      break;
    case "QUESTION_VISIBLE":
      if (q && pq) {
        // cartello "DOMANDA N. X": annuncio (e suspense sull'ultima), poi la domanda compare e si legge
        if (moment.lastOfGame) {
          out.push({ ...fixedLine(FIXED_POOLS.lastOfGameCall, q.id), beforeCard: true });
          out.push({ ...lastQuestionSuspenseLine(s.contenders, q.id), beforeCard: true });
        } else {
          if (pq.number) out.push({ ...questionNumberLine(pq.number), beforeCard: true });
          if (moment.lastOfRound) out.push({ ...fixedLine(FIXED_POOLS.lastOfRoundCall, q.id), beforeCard: true });
        }
        out.push(questionTextLine(q));
        if (q.type === "multiple") out.push(multipleWarningLine(presenter));
        // manche speciali: invito a puntare / annuncio del boost (frasi fisse, pre-generate)
        const special = pq.rules.special;
        if (special?.kind === "bet") out.push(fixedLine(FIXED_POOLS.betOpen, q.id));
        if (special?.kind === "comeback" && special.boosted.length > 0) out.push(fixedLine(FIXED_POOLS.comebackBoost, q.id));
      }
      break;
    case "OPTIONS_VISIBLE":
      if (q && pq?.options) {
        if (opts.readOptions) out.push(optionsLine(q));
        out.push(optionsQuip(presenter, q.id, moment, rot));
      }
      break;
    case "ANSWERS_LOCKED":
      out.push(lockedQuip(presenter, q?.id ?? "x", moment, rot));
      break;
    case "ANSWER_REVEAL":
      if (q && pq?.correctPositions && pq.options) {
        // ultima soluzione della serata: un attimo di silenzio teatrale prima
        if (moment.lastOfGame) out.push(fixedLine(FIXED_POOLS.lastReveal, q.id));
        out.push(...revealLines(q));
        const total = pq.distribution?.reduce((a, b) => a + b, 0) ?? 0;
        const right = pq.distribution && q.correctPositions.length === 1 ? pq.distribution[q.correctPositions[0]] : null;
        const outcome = right !== null ? revealOutcome(right, total, s.playerCount) : null;
        // libreria ufficiale: la reazione scelta dal server sull'esito vero (stesso spazio della battuta di sempre)
        const reaction = phaseDirectedLines(s);
        if (reaction.length > 0) out.push(...reaction);
        else if (outcome) out.push(revealQuip(presenter, q.id, outcome, moment, rot));
      }
      break;
    case "SCORE_REVEAL": {
      // battute del regista automatico: eventi reali della classifica con i nomi veri
      const directed = directedLines(s);
      if (directed.length > 0) {
        out.push(...directed);
        // a metà round, se il regista ha detto una sola cosa, ci sta anche una battuta
        if (directed.length === 1 && pq && pq.positionInRound < pq.totalInRound) out.push(scoreQuipLine(presenter, pq.id, moment, rot));
        break;
      }
      // senza eventi rilevanti: a fine round chi ha vinto il ROUND; prima, il colpo migliore e una battuta
      if (!pq || pq.positionInRound >= pq.totalInRound) {
        const b = pq?.bets?.wins ? betStarLine(pq.bets.wins, presenter) : null;
        if (b) out.push(b);
        // classifica del round (a squadre, "teams": la squadra); senza, chi è in testa
        const round = roundStandingsForShow(s);
        const l = round ? roundWinnerLine(round, s.round?.index ?? null) : scoreLeaderLine(standingsForShow(s));
        if (l) out.push(l);
      } else {
        // Scommetti tutto: il colpo migliore è la vincita più grande (con la quota puntata)
        out.push((pq.bets?.wins ? betStarLine(pq.bets.wins, presenter) : null) ?? answerStarLine(s.leaderboard ?? [], presenter, pq.id));
        out.push(scoreQuipLine(presenter, pq.id, moment, rot));
      }
      break;
    }
    case "LEADERBOARD": {
      const l = leaderboardLine(standingsForShow(s));
      if (l) out.push(l);
      // a volte Palmino commenta la classifica (libreria ufficiale)
      out.push(...phaseDirectedLines(s));
      break;
    }
    case "PAUSED":
      out.push(fixedLine(FIXED_POOLS.paused, s.phaseStartedAt));
      break;
    case "FINISHED":
      // solo l'apertura: il resto lo scandisce la rivelazione del podio (podiumPlan), con la suspense
      out.push(podiumPlan(standingsForShow(s), s.sessionId).opening);
      break;
  }
  return out.filter((l) => l.text.trim().length > 0);
}

/**
 * Tutte le battute che lo show può dire nello stato corrente (copione della fase, battute del
 * regista, podio, arrivo della ruota) più le battute fisse generiche. Serve al server per dare le
 * voci ai telefoni dei giocatori (show sul telefono) SOLO per le battute di quella partita:
 * un giocatore non può far sintetizzare un testo qualsiasi.
 */
export function sessionLinesFor(s: PublicState): SpokenLine[] {
  const out: SpokenLine[] = [];
  for (const phase of ["DRAFT", "READY", "PAUSED"] as const) {
    for (const readOptions of [true, false]) out.push(...speechFor(s, { phase }, { readOptions }));
  }
  out.push(...directedLines(s));
  const vp = s.phase === "PAUSED" && s.pausedFrom ? s.pausedFrom : s.phase;
  if (vp === "FINISHED") out.push(...podiumLines(standingsForShow(s), s.sessionId, podiumExtraLines(s)));
  const stop = wheelStopLine(s);
  if (stop) out.push(stop);
  return dedupeLines([...genericScriptLines(), ...out]);
}

/** La battuta (chi + testo) è fra quelle consentite? Restituisce quella del copione (con il suo `live`). */
export function findScriptLine(lines: readonly SpokenLine[], who: string, text: string): SpokenLine | null {
  const t = ttsText(text);
  return lines.find((l) => l.who === who && ttsText(l.text) === t) ?? null;
}
