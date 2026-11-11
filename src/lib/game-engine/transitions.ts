import type { GameCommand, GamePhase } from "./types";

/**
 * Macchina a stati esplicita della serata.
 * La stessa tabella è usata dal backend (per rifiutare transizioni non valide)
 * e dalla regia (per abilitare i pulsanti e suggerire la prossima azione).
 */
const PHASE_COMMANDS: Record<GamePhase, readonly GameCommand[]> = {
  DRAFT: [],
  READY: ["OPEN_LOBBY"],
  LOBBY: ["START_INTRO", "START_ROUND", "PAUSE", "FINISH"],
  INTRO: ["SKIP_INTRO", "START_ROUND", "PAUSE", "FINISH"],
  ROUND_INTRO: ["SHOW_QUESTION", "START_VOTE", "SPIN_WHEEL", "ACTIVATE_EVENT", "SHOW_LEADERBOARD", "START_ROUND", "PAUSE", "FINISH"],
  CATEGORY_VOTING: ["CLOSE_VOTE", "PAUSE", "FINISH"],
  CATEGORY_RESULT: ["SHOW_QUESTION", "ACTIVATE_EVENT", "SHOW_LEADERBOARD", "PAUSE", "FINISH"],
  // la ruota gira e si ferma sulla categoria scelta dal server (il server rifiuta di andare avanti finché gira)
  WHEEL_SPIN: ["SHOW_QUESTION", "ACTIVATE_EVENT", "SHOW_LEADERBOARD", "PAUSE", "FINISH"],
  SPECIAL_EVENT: ["SHOW_QUESTION", "PAUSE", "FINISH"],
  QUESTION_VISIBLE: ["SHOW_OPTIONS", "ACTIVATE_EVENT", "PAUSE", "FINISH"],
  OPTIONS_VISIBLE: ["CLOSE_ANSWERS", "REVEAL", "PAUSE", "FINISH"],
  ANSWERS_LOCKED: ["REVEAL", "PAUSE", "FINISH"],
  ANSWER_REVEAL: ["SCORE", "PAUSE", "FINISH"],
  SCORE_REVEAL: ["SHOW_LEADERBOARD", "SHOW_QUESTION", "START_ROUND", "ACTIVATE_EVENT", "PAUSE", "FINISH"],
  LEADERBOARD: ["SHOW_QUESTION", "START_ROUND", "ACTIVATE_EVENT", "PAUSE", "FINISH"],
  PAUSED: ["RESUME", "FINISH"],
  FINISHED: [],
};

/** Comandi non legati a una fase (gestione giocatori, prova generale). */
const ANY_PHASE_COMMANDS: readonly GameCommand[] = ["SET_JOIN", "SET_AUTOPLAY", "KICK", "ADJUST_SCORE", "ASSIGN_TEAM", "BALANCE_TEAMS"];
const TEST_ONLY_COMMANDS: readonly GameCommand[] = ["RESET_TEST", "SIM_ADD_BOTS", "SIM_BOTS_ANSWER", "SIM_BOTS_VOTE", "SIM_BOTS_BET"];

/** Comandi che cambiano la fase (gli altri modificano solo dati collaterali). */
export const PHASE_CHANGING_COMMANDS: readonly GameCommand[] = [
  "OPEN_LOBBY",
  "START_INTRO",
  "START_ROUND",
  "START_VOTE",
  "CLOSE_VOTE",
  "SPIN_WHEEL",
  "SHOW_QUESTION",
  "SHOW_OPTIONS",
  "CLOSE_ANSWERS",
  "REVEAL",
  "SCORE",
  "SHOW_LEADERBOARD",
  "ACTIVATE_EVENT",
  "PAUSE",
  "RESUME",
  "FINISH",
];

/** Comandi che richiedono una conferma esplicita in regia. */
export const DESTRUCTIVE_COMMANDS: readonly GameCommand[] = ["FINISH", "KICK", "ADJUST_SCORE", "RESET_TEST"];

export function isCommandAllowed(phase: GamePhase, command: GameCommand, isTest: boolean): boolean {
  if (TEST_ONLY_COMMANDS.includes(command)) {
    if (!isTest) return false;
    if (command === "RESET_TEST") return phase !== "DRAFT";
    if (command === "SIM_ADD_BOTS") return phase !== "DRAFT" && phase !== "FINISHED";
    if (command === "SIM_BOTS_ANSWER") return phase === "OPTIONS_VISIBLE";
    if (command === "SIM_BOTS_VOTE") return phase === "CATEGORY_VOTING";
    if (command === "SIM_BOTS_BET") return phase === "QUESTION_VISIBLE";
  }
  if (ANY_PHASE_COMMANDS.includes(command)) {
    return phase !== "DRAFT" && phase !== "FINISHED";
  }
  return PHASE_COMMANDS[phase].includes(command);
}

export function allowedCommands(phase: GamePhase, isTest: boolean): GameCommand[] {
  const base = [...PHASE_COMMANDS[phase]];
  if (phase !== "DRAFT" && phase !== "FINISHED") base.push(...ANY_PHASE_COMMANDS);
  if (isTest) {
    for (const c of TEST_ONLY_COMMANDS) if (isCommandAllowed(phase, c, true)) base.push(c);
  }
  return base;
}

/** Fasi in cui un giocatore può entrare senza "ingresso tardivo". */
export const EARLY_JOIN_PHASES: readonly GamePhase[] = ["LOBBY", "INTRO"];

/** Fasi "attive" che si possono mettere in pausa. */
export function canPause(phase: GamePhase): boolean {
  return PHASE_COMMANDS[phase].includes("PAUSE");
}

export interface NextActionContext {
  phase: GamePhase;
  roundKind: string | null;
  /** Categoria del round già decisa (voto chiuso o ruota girata). */
  voteDone: boolean;
  hasNextQuestion: boolean;
  hasNextRound: boolean;
  timerExpired: boolean;
}

/** Suggerimento per la regia: qual è il passo naturale successivo. */
export function suggestNextCommand(ctx: NextActionContext): GameCommand | null {
  switch (ctx.phase) {
    case "READY":
      return "OPEN_LOBBY";
    case "LOBBY":
      return "START_INTRO";
    case "INTRO":
      return "START_ROUND";
    case "ROUND_INTRO":
      if (ctx.roundKind === "category_vote" && !ctx.voteDone) return "START_VOTE";
      if (ctx.roundKind === "category_wheel" && !ctx.voteDone) return "SPIN_WHEEL";
      return ctx.hasNextQuestion ? "SHOW_QUESTION" : ctx.hasNextRound ? "START_ROUND" : "FINISH";
    case "CATEGORY_VOTING":
      return "CLOSE_VOTE";
    case "CATEGORY_RESULT":
    case "WHEEL_SPIN":
    case "SPECIAL_EVENT":
      return "SHOW_QUESTION";
    case "QUESTION_VISIBLE":
      return "SHOW_OPTIONS";
    case "OPTIONS_VISIBLE":
      return ctx.timerExpired ? "REVEAL" : "CLOSE_ANSWERS";
    case "ANSWERS_LOCKED":
      return "REVEAL";
    case "ANSWER_REVEAL":
      return "SCORE";
    case "SCORE_REVEAL":
      // la classifica si mostra solo a fine round: a metà round si passa alla domanda successiva
      return ctx.hasNextQuestion ? "SHOW_QUESTION" : "SHOW_LEADERBOARD";
    case "LEADERBOARD":
      if (ctx.hasNextQuestion) return "SHOW_QUESTION";
      return ctx.hasNextRound ? "START_ROUND" : "FINISH";
    case "PAUSED":
      return "RESUME";
    default:
      return null;
  }
}

export const COMMAND_LABELS: Record<GameCommand, string> = {
  OPEN_LOBBY: "APRI LOBBY",
  START_INTRO: "AVVIA INTRO",
  SKIP_INTRO: "SALTA INTRO",
  START_ROUND: "INIZIA ROUND",
  START_VOTE: "AVVIA VOTAZIONE",
  CLOSE_VOTE: "CHIUDI VOTAZIONE",
  SPIN_WHEEL: "GIRA LA RUOTA",
  SHOW_QUESTION: "MOSTRA DOMANDA",
  SHOW_OPTIONS: "MOSTRA RISPOSTE",
  CLOSE_ANSWERS: "CHIUDI RISPOSTE",
  REVEAL: "RIVELA SOLUZIONE",
  SCORE: "ASSEGNA PUNTEGGI",
  SHOW_LEADERBOARD: "MOSTRA CLASSIFICA",
  ACTIVATE_EVENT: "ATTIVA EVENTO",
  PAUSE: "PAUSA",
  RESUME: "RIPRENDI",
  FINISH: "TERMINA PARTITA",
  SET_JOIN: "INGRESSI",
  SET_AUTOPLAY: "SCORRIMENTO",
  KICK: "ESPELLI",
  ADJUST_SCORE: "RETTIFICA PUNTI",
  ASSIGN_TEAM: "SPOSTA IN SQUADRA",
  BALANCE_TEAMS: "BILANCIA SQUADRE",
  RESET_TEST: "RESET SIMULAZIONE",
  SIM_ADD_BOTS: "AGGIUNGI BOT",
  SIM_BOTS_ANSWER: "BOT: RISPONDI",
  SIM_BOTS_VOTE: "BOT: VOTA",
  SIM_BOTS_BET: "BOT: PUNTA",
};

export const PHASE_LABELS: Record<GamePhase, string> = {
  DRAFT: "Bozza",
  READY: "Pronta",
  LOBBY: "Lobby aperta",
  INTRO: "Introduzione",
  ROUND_INTRO: "Presentazione round",
  QUESTION_VISIBLE: "Domanda visibile",
  OPTIONS_VISIBLE: "Risposte aperte",
  ANSWERS_LOCKED: "Risposte chiuse",
  ANSWER_REVEAL: "Soluzione rivelata",
  SCORE_REVEAL: "Punteggi assegnati",
  LEADERBOARD: "Classifica",
  CATEGORY_VOTING: "Votazione in corso",
  CATEGORY_RESULT: "Categoria scelta",
  WHEEL_SPIN: "Ruota impazzita",
  SPECIAL_EVENT: "Evento di Palmino",
  PAUSED: "In pausa",
  FINISHED: "Terminata",
};
