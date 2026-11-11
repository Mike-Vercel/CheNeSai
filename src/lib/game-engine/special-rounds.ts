import { evaluateAnswer, type AnswerInput, type ScoreOutcome } from "./scoring";
import { BET_TIERS, type BetTier, type QuestionRules, type RoundSpecialSettings, type SpecialPlayerRef, type SpecialRules } from "./types";

/**
 * Manche speciali — funzioni PURE (nessun database), condivise da server, TV e telefono.
 *
 * SCOMMETTI TUTTO (round kind `bet`)
 * - Durante la domanda (prima di MOSTRA RISPOSTE) ogni giocatore sceglie una quota:
 *   0%, 25%, 50% o 100% ("all in") dei SUOI punti attuali.
 * - Puntata minima (impostazione del round, es. 500): ogni puntata diversa da 0% vale almeno
 *   questa cifra, così anche chi ha pochi punti, zero o in negativo può giocare.
 * - Le puntate si chiudono a MOSTRA RISPOSTE: la posta viene ricalcolata in quel momento sui
 *   punti del server; chi non ha scelto riceve la quota predefinita del round (consigliata: 0%).
 * - Punteggio: risposta esatta +posta; risposta errata, parziale o mancante −posta
 *   (rispettando "punteggio non negativo" se configurato).
 *   Niente bonus velocità né punti base: in questa manche conta solo il coraggio
 *   (la velocità resta comunque lo spareggio in classifica). Eventi speciali non ammessi.
 *
 * GRANDE RIBALTONE (round kind `comeback`)
 * - All'apertura di ogni domanda chi è nella metà bassa della classifica (pari merito inclusi,
 *   mai chi è a pari punti con il primo) riceve il BOOST: punti guadagnati × moltiplicatore.
 * - Facoltativo: il capolista (o i capolista a pari merito) paga gli errori × penalità.
 * - L'elenco è congelato con le regole della domanda a MOSTRA RISPOSTE.
 */

export const BET_TIER_LABEL: Record<BetTier, string> = { 0: "Non punto", 25: "25%", 50: "50%", 100: "ALL IN" };

export function isBetTier(n: unknown): n is BetTier {
  return typeof n === "number" && (BET_TIERS as readonly number[]).includes(n);
}

/** Posta di una quota: percentuale dei punti, mai sotto la puntata minima (0% = nessuna posta). */
export function computeStake(points: number, tier: BetTier, minStake: number): number {
  if (tier === 0) return 0;
  const share = points > 0 ? Math.round((points * tier) / 100) : 0;
  return Math.max(share, Math.max(0, Math.round(minStake)));
}

/** Le quattro poste possibili per i punti attuali (per il telefono). */
export function stakeOptions(points: number, minStake: number): { tier: BetTier; stake: number }[] {
  return BET_TIERS.map((tier) => ({ tier, stake: computeStake(points, tier, minStake) }));
}

export interface BetInput {
  tier: BetTier;
  stake: number;
  isDefault?: boolean;
}

/** Punti di una domanda "Scommetti tutto": solo la posta, in più o in meno. */
export function scoreBet(rules: QuestionRules, correct: number[], answer: AnswerInput | null, bet: BetInput | null): ScoreOutcome {
  const stake = Math.max(0, Math.round(bet?.stake ?? 0));
  const totalCorrect = correct.length;
  const ev = answer ? evaluateAnswer(answer.selectedPositions, correct) : null;
  const isCorrect = ev?.isCorrect ?? false;
  const delta = isCorrect ? stake : -stake;
  let reason: string;
  if (stake === 0) reason = !answer ? "Nessuna risposta (nessuna puntata)" : isCorrect ? "Risposta corretta (nessuna puntata)" : "Risposta errata (nessuna puntata)";
  else if (isCorrect) reason = `Scommessa vinta: +${stake}`;
  else reason = !answer ? `Nessuna risposta: scommessa persa (−${stake})` : `Scommessa persa: −${stake}`;
  return {
    kind: answer ? "answer" : "no_answer",
    delta,
    isCorrect,
    partial: false,
    reason,
    details: {
      base: delta,
      bonus: 0,
      speedBonus: 0,
      correctHits: ev?.correctHits ?? 0,
      wrongHits: ev?.wrongHits ?? 0,
      totalCorrect,
      rules,
    },
  };
}

// ---------------------------------------------------------------------------
// Grande ribaltone
// ---------------------------------------------------------------------------
export interface StandingInput {
  participantId: string;
  nickname: string;
  points: number;
}

/**
 * Chi riceve il BOOST (metà bassa della classifica) e chi è capolista.
 * - Meno di 2 giocatori o tutti a pari punti: nessuno.
 * - Metà bassa = gli ultimi floor(N/2) per punti; chi è a pari punti con l'ultimo della metà alta
 *   che rientra nella soglia viene incluso (stesso trattamento a parità di punti).
 * - Mai boost a chi è a pari punti con il primo.
 */
export function assignComeback(players: StandingInput[]): { boosted: SpecialPlayerRef[]; leaders: SpecialPlayerRef[] } {
  if (players.length < 2) return { boosted: [], leaders: [] };
  const sorted = [...players].sort((a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname, "it"));
  const top = sorted[0].points;
  if (sorted.every((p) => p.points === top)) return { boosted: [], leaders: [] };
  const bottomCount = Math.floor(sorted.length / 2);
  const threshold = sorted[sorted.length - bottomCount].points;
  const ref = (p: StandingInput): SpecialPlayerRef => ({ participantId: p.participantId, nickname: p.nickname });
  return {
    boosted: sorted.filter((p) => p.points <= threshold && p.points < top).map(ref),
    leaders: sorted.filter((p) => p.points === top).map(ref),
  };
}

export type ComebackRole = "boosted" | "leader" | null;

export function comebackRole(special: SpecialRules | null | undefined, participantId: string): ComebackRole {
  if (!special || special.kind !== "comeback") return null;
  if (special.boosted.some((p) => p.participantId === participantId)) return "boosted";
  if (special.leaders.some((p) => p.participantId === participantId)) return "leader";
  return null;
}

/** Applica BOOST (punti guadagnati × moltiplicatore) o penalità del capolista (punti persi × penalità). */
export function applyComeback(outcome: ScoreOutcome, role: ComebackRole, special: Extract<SpecialRules, { kind: "comeback" }>): ScoreOutcome {
  if (role === "boosted" && outcome.delta > 0 && special.boostMultiplier > 1) {
    return { ...outcome, delta: Math.round(outcome.delta * special.boostMultiplier), reason: `${outcome.reason} · BOOST ×${fmt(special.boostMultiplier)}` };
  }
  if (role === "leader" && outcome.delta < 0 && special.leaderPenaltyMultiplier > 1) {
    return {
      ...outcome,
      delta: Math.round(outcome.delta * special.leaderPenaltyMultiplier),
      reason: `${outcome.reason} · penalità capolista ×${fmt(special.leaderPenaltyMultiplier)}`,
    };
  }
  return outcome;
}

// ---------------------------------------------------------------------------
// Regole della domanda
// ---------------------------------------------------------------------------
/**
 * Aggiunge le regole della manche speciale a quelle già risolte (round + eventi).
 * Per il ribaltone serve la classifica al momento dell'apertura della domanda.
 */
export function applySpecialRules(rules: QuestionRules, settings: RoundSpecialSettings | null, standings: StandingInput[] = []): QuestionRules {
  if (!settings) return rules;
  if (settings.kind === "bet") {
    return {
      ...rules,
      speedBonusMax: 0,
      bonusPoints: 0,
      partialScoring: false,
      modifiers: [...rules.modifiers, "Scommetti tutto"],
      special: { kind: "bet", minStake: settings.minStake, defaultTier: settings.defaultTier },
    };
  }
  const { boosted, leaders } = assignComeback(standings);
  const boostOn = settings.boostMultiplier > 1;
  const penaltyOn = settings.leaderPenaltyMultiplier > 1;
  const modifiers = [...rules.modifiers];
  if (boostOn) modifiers.push(`Grande ribaltone: BOOST ×${fmt(settings.boostMultiplier)} a chi insegue`);
  if (penaltyOn) modifiers.push(`Capolista: penalità ×${fmt(settings.leaderPenaltyMultiplier)}`);
  return {
    ...rules,
    modifiers,
    special: {
      kind: "comeback",
      boostMultiplier: settings.boostMultiplier,
      leaderPenaltyMultiplier: settings.leaderPenaltyMultiplier,
      boosted: boostOn ? boosted : [],
      leaders: penaltyOn ? leaders : [],
    },
  };
}

/** Impostazioni speciali di un round dalle colonne del database. */
export function roundSpecialSettings(r: {
  kind: string;
  bet_min_stake?: number | null;
  bet_default_tier?: number | null;
  comeback_multiplier?: string | number | null;
  comeback_leader_penalty?: string | number | null;
}): RoundSpecialSettings | null {
  if (r.kind === "bet") {
    const tier = Number(r.bet_default_tier ?? 0);
    return { kind: "bet", minStake: Number(r.bet_min_stake ?? 0), defaultTier: isBetTier(tier) ? tier : 0 };
  }
  if (r.kind === "comeback") {
    return { kind: "comeback", boostMultiplier: Number(r.comeback_multiplier ?? 2), leaderPenaltyMultiplier: Number(r.comeback_leader_penalty ?? 1) };
  }
  return null;
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}
