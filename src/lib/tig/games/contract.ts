import type { z } from "zod";

/**
 * TAVOLI IN GUERRA! — CONTRATTO DELLE MECCANICHE (minigiochi).
 *
 * Una meccanica è un modulo PURO: niente database, niente rete, niente orologio di sistema.
 * Il runtime del server (src/lib/server/tig) la usa così:
 *   1. sceglie una variante di contenuto (`contentSchema` la valida) e la congela nella partita;
 *   2. durante la prova manda a TUTTI `publicView(...)` (MAI la soluzione) e a ogni membro `memberView(...)`;
 *   3. accetta gli invii validati da `submissionSchema` (uno valido per squadra o per membro, secondo `input`);
 *   4. a scadenza (o quando tutti hanno inviato) chiama `score(...)`: punti PROPOSTI per squadra, Energia Caos,
 *      esiti; il runtime applica poi i limiti globali (saldo ≥ 0, tetti anti-valanga, scudi) e scrive il ledger;
 *   5. mostra `reveal(...)` (soluzione + spiegazione in una schermata).
 * Le UI (telefono/PC e TV) sono componenti React registrati a parte (src/features/tig/games) con lo stesso `code`.
 */

export type MancheNo = 1 | 2 | 3 | 4 | 5;

/** Modalità d'ingresso (PDF §04): sempre UNA squadra come unità di punteggio. */
export type InputMode =
  | "team" //       decisione di squadra: tutti discutono, il CAPITANO (o chiunque, se un solo telefono) invia
  | "vote" //       voto individuale segreto: il risultato della squadra è una PERCENTUALE, mai una somma
  | "coop" //       collaborazione: frammenti distribuiti tra i telefoni presenti (difficoltà scalata)
  | "duel" //       due tavoli in parallelo, stesso contenuto e tempo
  | "pub"; //       sondaggio di tutto il locale: un voto per tavolo

export type MediaNeed = "image" | "audio" | "video";

export interface TeamRef {
  teamId: string;
  tableNo: number;
  /** telefoni/membri attivi in questa prova (per scalare la cooperazione e normalizzare i voti) */
  members: string[];
  captainId: string | null;
}

/** Contesto pubblico della prova (uguale per tutti). */
export interface PhaseCtx {
  gameInstanceId: string;
  /** ms epoch del server */
  startsAt: number;
  deadlineAt: number;
  teams: TeamRef[];
  /** squadre coinvolte quando la meccanica è un duello/attacco (altrimenti tutte) */
  participants: string[];
  /** seme deterministico (es. per mescolare opzioni in modo uguale per tutti) */
  seed: string;
}

export interface MemberCtx extends PhaseCtx {
  teamId: string;
  memberId: string;
  /** posizione del membro tra i membri attivi della squadra (0-based), per assegnare frammenti in coop */
  memberIndex: number;
}

/** Un invio accettato dal server (già validato e deduplicato con chiave di idempotenza). */
export interface AcceptedSubmission<S> {
  teamId: string;
  memberId: string;
  /** ms dall'inizio della prova (orologio del server) */
  elapsedMs: number;
  payload: S;
}

export interface ScoreInput<C, S> {
  content: C;
  ctx: PhaseCtx;
  submissions: AcceptedSubmission<S>[];
}

export interface TeamOutcome {
  teamId: string;
  /** punti proposti (possono essere negativi solo per meccaniche di rischio/furto dichiarate) */
  points: number;
  /** trasferimenti/penalità verso altre squadre (il runtime applica tetti e scudi) */
  transfers?: { toTeamId: string; points: number; reason: string }[];
  /** Energia Caos guadagnata (≥ 0), separata dai punti */
  chaos: number;
  correct: boolean | null;
  /** 0..1, per gli spareggi (precisione media) */
  accuracy: number | null;
  /** breve esito leggibile, es. "Scarto 0,4 s" (mai dati personali) */
  label: string;
}

export interface ScoreOutput {
  outcomes: TeamOutcome[];
}

export interface MechanicDef<C = unknown, S = unknown> {
  /** identificativo stabile, es. "memoria-lampo" */
  code: string;
  /** numero nel catalogo (1–80, PDF §06) */
  number: number;
  manche: MancheNo;
  title: string;
  input: InputMode;
  /** timer della prova in secondi (senza spiegazione/reveal) */
  timerSec: number;
  /** giocabile anche con un solo telefono al tavolo */
  oneDeviceOk: boolean;
  needs: MediaNeed[];
  /** testo breve della regola mostrato su TV e telefono (≤ 140 caratteri) */
  rule: string;
  contentSchema: z.ZodType<C>;
  submissionSchema: z.ZodType<S>;
  publicView(content: C, ctx: PhaseCtx): unknown;
  memberView?(content: C, ctx: MemberCtx): unknown;
  score(input: ScoreInput<C, S>): ScoreOutput;
  reveal(content: C, outcome: ScoreOutput): unknown;
}

/** Stato di una voce del catalogo 80: onestà prima di tutto. */
export type MechanicStatus = "implementata" | "da-implementare";

export interface CatalogEntry {
  number: number;
  code: string;
  manche: MancheNo;
  title: string;
  description: string;
  input: InputMode;
  timerSec: number;
  pointsRule: string;
  status: MechanicStatus;
}
