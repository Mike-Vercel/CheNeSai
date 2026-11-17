import type { ComponentType } from "react";
import type { ScoreOutput, TeamOutcome, TeamRef } from "@/lib/tig/games/contract";

/**
 * TAVOLI IN GUERRA! — CONTRATTO DELLE SCHERMATE DEI MINIGIOCHI.
 *
 * Il ramo dei minigiochi registra, per ogni `code` di meccanica, due componenti:
 *  - `Player`: telefono o PC del giocatore (pulsanti grandi, mouse/tastiera, niente superfluo);
 *  - `Tv`: la parte di HUD sopra l'arena 3D sulla TV (contenuto grande, leggibile a distanza; MAI soluzioni prima del reveal).
 * Il ramo core li monta, passa le viste arrivate dal server e invia le scelte con `submit` (il server valida e deduplica).
 * Registro: `src/features/tig/games/index.ts` → `export const MECHANIC_UIS: Record<string, MechanicUi>`.
 */

export type GameStage = "play" | "locked" | "reveal";

export interface PlayerGameProps<V = unknown, M = unknown, S = unknown, R = unknown> {
  /** `publicView` della meccanica (uguale per tutti) */
  view: V;
  /** `memberView` per questo membro (frammenti, indizi privati) o null */
  memberView: M | null;
  stage: GameStage;
  deadlineAt: number;
  now: () => number;
  /** può inviare la scelta definitiva della squadra (capitano, o unico telefono) */
  canSubmit: boolean;
  /** questo telefono ha già inviato (o la squadra, per input "team") */
  submitted: boolean;
  /** invio: il server risponde con accettato/rifiutato; chiave di idempotenza gestita dal core */
  submit: (payload: S) => Promise<{ ok: boolean; reason?: string }>;
  myTeam: TeamRef;
  /** dopo il reveal */
  reveal: R | null;
  myOutcome: TeamOutcome | null;
}

export interface TvGameProps<V = unknown, R = unknown> {
  view: V;
  stage: GameStage;
  deadlineAt: number;
  now: () => number;
  teams: { teamId: string; tableNo: number; name: string; color: string; submitted: boolean }[];
  reveal: R | null;
  outcome: ScoreOutput | null;
}

export interface MechanicUi {
  Player: ComponentType<PlayerGameProps>;
  Tv: ComponentType<TvGameProps>;
}
