import type { Db } from "@/lib/database/db";
import { num } from "@/lib/database/db";
import { resolveQuestionRules, type AppliedEvent } from "@/lib/game-engine/scoring";
import { applySpecialRules, roundSpecialSettings, type StandingInput } from "@/lib/game-engine/special-rounds";
import type { QuestionRules, QuestionType, SpecialEventParams, SpecialEventType } from "@/lib/game-engine/types";

interface RulesRow {
  type: QuestionType;
  correct_points: number;
  wrong_penalty: number;
  no_answer_penalty: number;
  duration_seconds: number;
  partial_scoring: boolean;
  round_title: string;
  points_multiplier: string;
  penalty_multiplier: string;
  no_penalty: boolean;
  speed_bonus_max: number;
  kind: string;
  bet_min_stake: number;
  bet_default_tier: number;
  comeback_multiplier: string;
  comeback_leader_penalty: string;
  session_id: string;
  frozen: QuestionRules | null;
}

/**
 * Regole effettive di una domanda della sessione. Se le risposte sono già
 * state aperte, restituisce le regole congelate in quel momento (quelle
 * annunciate e usate per il punteggio); altrimenti calcola l'anteprima.
 * Nelle manche speciali aggiunge le regole della manche (puntate, BOOST del ribaltone).
 */
export async function rulesForQuestion(db: Db, sessionQuestionId: string, allowNegative: boolean): Promise<QuestionRules | null> {
  const [row] = await db<RulesRow[]>`
    select qs.type, qs.correct_points, qs.wrong_penalty, qs.no_answer_penalty, qs.duration_seconds, qs.partial_scoring,
           r.title as round_title, r.points_multiplier, r.penalty_multiplier, r.no_penalty, r.speed_bonus_max,
           r.kind::text as kind, r.bet_min_stake, r.bet_default_tier, r.comeback_multiplier, r.comeback_leader_penalty,
           sq.session_id, sq.rules as frozen
    from session_questions sq
    join question_snapshots qs on qs.session_question_id = sq.id
    join game_rounds r on r.id = sq.round_id
    where sq.id = ${sessionQuestionId}`;
  if (!row) return null;
  if (row.frozen) return row.frozen;
  const events = await db<{ type: SpecialEventType; title: string; params: SpecialEventParams }[]>`
    select type, title, params from special_events
    where target_session_question_id = ${sessionQuestionId} and status in ('announced', 'applied')
    order by created_at`;
  const applied: AppliedEvent[] = events.map((e) => ({ type: e.type, title: e.title, params: e.params }));
  const base = resolveQuestionRules(
    {
      type: row.type,
      correctPoints: row.correct_points,
      wrongPenalty: row.wrong_penalty,
      noAnswerPenalty: row.no_answer_penalty,
      durationSeconds: row.duration_seconds,
      partialScoring: row.partial_scoring,
    },
    {
      title: row.round_title,
      pointsMultiplier: num(row.points_multiplier),
      penaltyMultiplier: num(row.penalty_multiplier),
      noPenalty: row.no_penalty,
      speedBonusMax: row.speed_bonus_max,
    },
    applied,
    allowNegative,
  );
  const special = roundSpecialSettings(row);
  // Grande ribaltone: chi insegue si decide sulla classifica all'apertura della domanda.
  const standings =
    special?.kind === "comeback"
      ? await db<StandingInput[]>`
          select p.id as "participantId", p.nickname, t.points
          from participants p join score_totals t on t.participant_id = p.id
          where p.session_id = ${row.session_id} and p.status = 'active'`
      : [];
  return applySpecialRules(base, special, standings);
}
