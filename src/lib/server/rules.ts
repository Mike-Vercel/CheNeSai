import type { Db } from "@/lib/database/db";
import { num } from "@/lib/database/db";
import { resolveQuestionRules, type AppliedEvent } from "@/lib/game-engine/scoring";
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
  frozen: QuestionRules | null;
}

/**
 * Regole effettive di una domanda della sessione. Se le risposte sono già
 * state aperte, restituisce le regole congelate in quel momento (quelle
 * annunciate e usate per il punteggio); altrimenti calcola l'anteprima.
 */
export async function rulesForQuestion(db: Db, sessionQuestionId: string, allowNegative: boolean): Promise<QuestionRules | null> {
  const [row] = await db<RulesRow[]>`
    select qs.type, qs.correct_points, qs.wrong_penalty, qs.no_answer_penalty, qs.duration_seconds, qs.partial_scoring,
           r.title as round_title, r.points_multiplier, r.penalty_multiplier, r.no_penalty, r.speed_bonus_max,
           sq.rules as frozen
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
  return resolveQuestionRules(
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
}
