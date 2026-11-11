import { getSql, iso } from "@/lib/database/db";
import { CmsError } from "../audit";

/**
 * Statistiche: query di sola lettura eseguite on-demand dal pannello,
 * mai durante i comandi live (non rallentano il gioco).
 */
export async function dashboardStats() {
  const sql = getSql();
  const [totals] = await sql<
    {
      sessions_total: number;
      sessions_finished: number;
      sessions_upcoming: number;
      questions_approved: number;
      questions_draft: number;
      rounds: number;
      events_enabled: number;
      players_total: number;
      identities: number;
      answers_total: number;
      correct_pct: number | null;
    }[]
  >`
    select
      (select count(*)::int from game_sessions where not is_test) as sessions_total,
      (select count(*)::int from game_sessions where not is_test and status in ('finished','archived')) as sessions_finished,
      (select count(*)::int from game_sessions where status in ('draft','ready') and (scheduled_at is null or scheduled_at > now() - interval '1 day')) as sessions_upcoming,
      (select count(*)::int from question_bank where status = 'approved') as questions_approved,
      (select count(*)::int from question_bank where status = 'draft') as questions_draft,
      (select count(*)::int from game_rounds) as rounds,
      (select count(*)::int from special_event_definitions where enabled) as events_enabled,
      (select count(*)::int from participants p join game_sessions s on s.id = p.session_id where not s.is_test and not p.is_bot) as players_total,
      (select count(*)::int from player_identities) as identities,
      (select count(*)::int from answer_submissions a join game_sessions s on s.id = a.session_id where not s.is_test) as answers_total,
      (select round(100.0 * avg(case when a.is_correct then 1 else 0 end), 1)::float8 from answer_submissions a
         join game_sessions s on s.id = a.session_id where not s.is_test and a.is_correct is not null) as correct_pct`;
  const history = await sql<{ id: string; title: string; date: Date | null; players: number; winner: string | null; top: number | null }[]>`
    select s.id, s.title, coalesce(s.scheduled_at, s.started_at) as date,
      (select count(*)::int from participants p where p.session_id = s.id and not p.is_bot) as players,
      (select nickname from leaderboards l where l.session_id = s.id order by final_rank limit 1) as winner,
      (select points from leaderboards l where l.session_id = s.id order by final_rank limit 1) as top
    from game_sessions s where s.status in ('finished','archived') and not s.is_test
    order by coalesce(s.scheduled_at, s.started_at) desc nulls last limit 12`;
  return { totals, history: history.map((h) => ({ ...h, date: iso(h.date) })) };
}

export async function sessionStats(sessionId: string) {
  const sql = getSql();
  const [s] = await sql<{ id: string; title: string }[]>`select id, title from game_sessions where id = ${sessionId}`;
  if (!s) throw new CmsError("Sessione non trovata", 404);

  const [summary] = await sql<
    { participants: number; answers: number; correct_pct: number | null; avg_response_ms: number | null; questions_played: number }[]
  >`
    select
      (select count(*)::int from participants where session_id = ${sessionId} and not is_bot) as participants,
      (select count(*)::int from answer_submissions where session_id = ${sessionId}) as answers,
      (select round(100.0 * avg(case when is_correct then 1 else 0 end), 1)::float8 from answer_submissions
         where session_id = ${sessionId} and is_correct is not null) as correct_pct,
      (select round(avg(response_ms))::int from answer_submissions where session_id = ${sessionId}) as avg_response_ms,
      (select count(*)::int from session_questions where session_id = ${sessionId} and revealed_at is not null) as questions_played`;

  const questions = await sql<
    {
      id: string;
      play_order: number | null;
      text: string;
      category: string;
      round_title: string;
      answers: number;
      correct: number;
      eligible: number;
      avg_ms: number | null;
      distribution: number[];
      correct_positions: number[];
    }[]
  >`
    select sq.id, sq.play_order, qs.text, qs.category, r.title as round_title,
      (select count(*)::int from answer_submissions a where a.session_question_id = sq.id) as answers,
      (select count(*)::int from answer_submissions a where a.session_question_id = sq.id and a.is_correct) as correct,
      (select count(*)::int from score_events e where e.session_question_id = sq.id) as eligible,
      (select round(avg(response_ms))::int from answer_submissions a where a.session_question_id = sq.id) as avg_ms,
      array[
        (select count(*)::int from answer_selected_options o where o.session_question_id = sq.id and o.position = 0),
        (select count(*)::int from answer_selected_options o where o.session_question_id = sq.id and o.position = 1),
        (select count(*)::int from answer_selected_options o where o.session_question_id = sq.id and o.position = 2),
        (select count(*)::int from answer_selected_options o where o.session_question_id = sq.id and o.position = 3)
      ] as distribution,
      qs.correct_positions
    from session_questions sq
    join question_snapshots qs on qs.session_question_id = sq.id
    join game_rounds r on r.id = sq.round_id
    where sq.session_id = ${sessionId} and sq.revealed_at is not null
    order by sq.play_order`;

  const rounds = await sql<{ title: string; position: number; correct_pct: number | null; answers: number }[]>`
    select r.title, r.position,
      round(100.0 * avg(case when a.is_correct then 1 else 0 end), 1)::float8 as correct_pct, count(a.id)::int as answers
    from game_rounds r
    left join session_questions sq on sq.round_id = r.id
    left join answer_submissions a on a.session_question_id = sq.id
    where r.session_id = ${sessionId}
    group by r.id order by r.position`;

  const final = await sql<{ final_rank: number; nickname: string; points: number; correct_count: number }[]>`
    select final_rank, nickname, points, correct_count from leaderboards where session_id = ${sessionId} order by final_rank limit 50`;

  // Andamento classifica: punti cumulati dei primi 5 dopo ogni domanda.
  const top = final.slice(0, 5).map((f) => f.nickname);
  const trend = await sql<{ nickname: string; play_order: number; points_after: number }[]>`
    select p.nickname, sq.play_order, e.points_after
    from score_events e
    join participants p on p.id = e.participant_id
    join session_questions sq on sq.id = e.session_question_id
    where e.session_id = ${sessionId} and p.nickname = any(${sql.array(top.length ? top : ["-"])}::text[])
      and e.kind in ('answer','no_answer')
    order by sq.play_order`;

  const votes = await sql<{ round: string; label: string; votes: number; winner: boolean; method: string | null }[]>`
    select r.title as round, o.label, (select count(*)::int from category_votes v where v.option_id = o.id) as votes,
      r.winning_option_id = o.id as winner, r.vote_result->>'method' as method
    from category_vote_options o join game_rounds r on r.id = o.round_id
    where r.session_id = ${sessionId} and r.vote_closed_at is not null order by r.position, o.position`;

  const events = await sql<{ title: string; type: string; source: string; status: string; announced_at: Date | null; question: string | null; decided_from: unknown }[]>`
    select e.title, e.type::text, e.source, e.status, e.announced_at, qs.text as question, e.decided_from
    from special_events e left join question_snapshots qs on qs.session_question_id = e.target_session_question_id
    where e.session_id = ${sessionId} order by e.announced_at nulls last`;

  const rate = (q: { correct: number; answers: number }) => (q.answers > 0 ? q.correct / q.answers : 0);
  const answered = questions.filter((q) => q.answers > 0);
  return {
    session: s,
    summary,
    questions: questions.map((q) => ({ ...q, correctRate: rate(q) })),
    hardest: [...answered].sort((a, b) => rate(a) - rate(b)).slice(0, 5).map((q) => ({ text: q.text, correctRate: rate(q) })),
    easiest: [...answered].sort((a, b) => rate(b) - rate(a)).slice(0, 5).map((q) => ({ text: q.text, correctRate: rate(q) })),
    rounds,
    final,
    trend,
    votes,
    events: events.map((e) => ({ ...e, announced_at: iso(e.announced_at) })),
  };
}

/** Esportazione completa di una sessione (backup puntuale / archivio). */
export async function exportSessionBackup(sessionId: string) {
  const sql = getSql();
  const tables = {
    game_sessions: sql`select * from game_sessions where id = ${sessionId}`,
    game_rounds: sql`select * from game_rounds where session_id = ${sessionId}`,
    category_vote_options: sql`select o.* from category_vote_options o join game_rounds r on r.id = o.round_id where r.session_id = ${sessionId}`,
    session_questions: sql`select * from session_questions where session_id = ${sessionId}`,
    question_snapshots: sql`select * from question_snapshots where session_id = ${sessionId}`,
    participants: sql`select id, session_id, identity_id, nickname, status, is_bot, joined_at, kicked_at, kick_reason from participants where session_id = ${sessionId}`,
    answer_submissions: sql`select * from answer_submissions where session_id = ${sessionId}`,
    score_events: sql`select * from score_events where session_id = ${sessionId}`,
    score_totals: sql`select * from score_totals where session_id = ${sessionId}`,
    special_events: sql`select * from special_events where session_id = ${sessionId}`,
    category_votes: sql`select * from category_votes where session_id = ${sessionId}`,
    leaderboards: sql`select * from leaderboards where session_id = ${sessionId}`,
    game_events: sql`select * from game_events where session_id = ${sessionId} order by id`,
    game_state: sql`select * from game_state where session_id = ${sessionId}`,
  };
  const out: Record<string, unknown> = { format: "quizzone-session-backup", version: 1, exportedAt: new Date().toISOString() };
  for (const [k, q] of Object.entries(tables)) out[k] = await q;
  return out;
}
