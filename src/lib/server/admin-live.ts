import { getSql, iso } from "@/lib/database/db";
import { allowedCommands, suggestNextCommand } from "@/lib/game-engine/transitions";
import type { GameCommand, PublicState, QuestionType, SpecialEventType } from "@/lib/game-engine/types";
import { buildPublicState, loadStateRow, visualPhase } from "./public-state";
import { resolveNextQuestion } from "./engine";
import { getSessionDetail, type RoundDetail } from "./cms/sessions";

export interface AdminLiveState {
  public: PublicState;
  allowed: GameCommand[];
  suggested: GameCommand | null;
  current: {
    sessionQuestionId: string;
    text: string;
    type: QuestionType;
    options: { position: number; text: string; isCorrect: boolean }[];
    answered: number;
    eligible: number;
    distribution: number[];
    timerExpired: boolean;
    mediaKind: string | null;
  } | null;
  next: { sessionQuestionId: string; text: string; roundTitle: string; scheduledEvent: string | null; mediaKind: string | null } | null;
  rounds: RoundDetail[];
  counts: { players: number; online: number; bots: number; kicked: number; answered: number; voted: number };
  warnings: string[];
  events: { key: string; type: SpecialEventType; title: string; tagline: string; used: number; max: number }[];
  reserves: { id: string; text: string }[];
  participants: {
    id: string;
    nickname: string;
    points: number;
    rank: number | null;
    online: boolean;
    status: string;
    isBot: boolean;
    answeredCurrent: boolean;
    lastSeenAt: string;
    anomalies: number;
  }[];
  displayKey: string;
  code: string;
  isTest: boolean;
}

export async function getAdminLiveState(sessionId: string): Promise<AdminLiveState | null> {
  const sql = getSql();
  const st = await loadStateRow(sql, sessionId);
  if (!st) return null;
  const pub = await buildPublicState(sql, sessionId, st);
  const detail = await getSessionDetail(sql, sessionId);
  if (!pub || !detail) return null;
  const vp = visualPhase(st);

  // ---- domanda corrente (con soluzione: solo per la regia) ----
  let current: AdminLiveState["current"] = null;
  if (st.current_session_question_id) {
    const [q] = await sql<
      {
        id: string;
        text: string;
        type: QuestionType;
        options: { position: number; text: string }[];
        correct_positions: number[];
        media_kind: string | null;
        expired: boolean;
        options_opened_at: Date | null;
        answers_close_at: Date | null;
      }[]
    >`
      select sq.id, qs.text, qs.type, qs.options, qs.correct_positions, qs.media_kind::text as media_kind,
             coalesce(sq.answers_close_at <= clock_timestamp(), false) as expired, sq.options_opened_at, sq.answers_close_at
      from session_questions sq join question_snapshots qs on qs.session_question_id = sq.id
      where sq.id = ${st.current_session_question_id}`;
    if (q) {
      const dist = await sql<{ position: number; c: number }[]>`
        select position, count(*)::int as c from answer_selected_options where session_question_id = ${q.id} group by position`;
      const distribution = [0, 0, 0, 0];
      for (const d of dist) distribution[d.position] = d.c;
      const [{ answered }] = await sql<{ answered: number }[]>`
        select count(*)::int as answered from answer_submissions where session_question_id = ${q.id}`;
      const [{ eligible }] = await sql<{ eligible: number }[]>`
        select count(*)::int as eligible from participants where session_id = ${sessionId} and status = 'active'`;
      current = {
        sessionQuestionId: q.id,
        text: q.text,
        type: q.type,
        options: [...q.options]
          .sort((a, b) => a.position - b.position)
          .map((o) => ({ ...o, isCorrect: q.correct_positions.includes(o.position) })),
        answered,
        eligible,
        distribution,
        timerExpired: q.expired,
        mediaKind: q.media_kind,
      };
    }
  }

  // ---- prossima domanda ----
  let next: AdminLiveState["next"] = null;
  const n = await sql.begin((tx) => resolveNextQuestion(tx, st));
  const nextId =
    n && !("blocked" in n) && (n.id !== st.current_session_question_id || vp === "SPECIAL_EVENT" || vp === "ROUND_INTRO" || vp === "LEADERBOARD")
      ? n.id
      : null;
  let hasNextQuestion = !!(n && !("blocked" in n));
  if (vp === "QUESTION_VISIBLE" || vp === "OPTIONS_VISIBLE" || vp === "ANSWERS_LOCKED") hasNextQuestion = true;
  if (nextId) {
    for (const r of detail.roundsDetail) {
      const q = r.questions.find((x) => x.id === nextId);
      if (q) next = { sessionQuestionId: q.id, text: q.text, roundTitle: r.title, scheduledEvent: q.scheduledEvent?.title ?? null, mediaKind: q.mediaKind };
    }
  }
  const currentRound = detail.roundsDetail.find((r) => r.id === st.current_round_id) ?? null;
  const hasNextRound = detail.roundsDetail.some(
    (r) => !r.startedAt && (!currentRound || r.position > currentRound.position),
  );

  // ---- conteggi e giocatori ----
  const participants = await sql<
    {
      id: string;
      nickname: string;
      points: number | null;
      rank: number | null;
      online: boolean;
      status: string;
      is_bot: boolean;
      answered_current: boolean;
      last_seen_at: Date;
      anomalies: number;
    }[]
  >`
    select p.id, p.nickname, t.points, t.rank, p.last_seen_at > now() - interval '60 seconds' as online, p.status, p.is_bot,
      exists (select 1 from answer_submissions a where a.participant_id = p.id and a.session_question_id = ${st.current_session_question_id}) as answered_current,
      p.last_seen_at,
      (select count(*)::int from security_events e where e.participant_id = p.id) as anomalies
    from participants p left join score_totals t on t.participant_id = p.id
    where p.session_id = ${sessionId}
    order by p.status, t.rank nulls last, p.joined_at`;
  let voted = 0;
  if (st.current_round_id) {
    const [v] = await sql<{ c: number }[]>`select count(*)::int as c from category_votes where round_id = ${st.current_round_id}`;
    voted = v.c;
  }
  const active = participants.filter((p) => p.status === "active");
  const counts = {
    players: active.length,
    online: active.filter((p) => p.online && !p.is_bot).length + active.filter((p) => p.is_bot).length,
    bots: active.filter((p) => p.is_bot).length,
    kicked: participants.length - active.length,
    answered: current?.answered ?? 0,
    voted,
  };

  // ---- eventi disponibili ----
  const events = await sql<{ key: string; type: SpecialEventType; title: string; tagline: string; max: number; used: number }[]>`
    select d.key, d.type, d.title, d.tagline, d.max_per_session as max,
      case when d.type = 'palmino_decides'
        then (select count(*)::int from special_events e where e.session_id = ${sessionId} and e.source = 'palmino_decides')
        else (select count(*)::int from special_events e where e.session_id = ${sessionId} and e.definition_id = d.id
              and e.status <> 'cancelled' and e.source <> 'scheduled') end as used
    from special_event_definitions d where d.enabled order by d.title`;
  const reserves = await sql<{ id: string; text: string }[]>`
    select sq.id, qs.text from session_questions sq join question_snapshots qs on qs.session_question_id = sq.id
    where sq.session_id = ${sessionId} and sq.is_reserve and sq.shown_at is null order by sq.position`;

  // ---- avvisi per la regia ----
  const warnings: string[] = [];
  if (st.phase === "LOBBY" && counts.players === 0) warnings.push("Nessun giocatore collegato: mostra il QR sul TV");
  if (current?.timerExpired && vp === "OPTIONS_VISIBLE") warnings.push("Tempo scaduto: le risposte sono già bloccate dal server");
  const offline = active.filter((p) => !p.online && !p.is_bot).length;
  if (offline > 0 && st.phase !== "LOBBY") warnings.push(`${offline} giocatori non si fanno sentire da oltre 60 secondi`);
  if (next?.mediaKind === "audio") warnings.push("La prossima domanda ha un audio: verifica che l'audio del TV sia attivo");
  if (vp === "CATEGORY_VOTING" && counts.players > 0 && voted === 0) warnings.push("Ancora nessun voto ricevuto");
  if (pub.joinLocked) warnings.push("Ingressi bloccati");
  const anomalies = participants.reduce((a, p) => a + p.anomalies, 0);
  if (anomalies > 0) warnings.push(`${anomalies} anomalie registrate (risposte tardive o doppie): vedi Giocatori`);

  const voteDone = !!currentRound?.winningOptionId;
  const suggested = suggestNextCommand({
    phase: st.phase,
    roundKind: currentRound?.kind ?? null,
    voteDone,
    hasNextQuestion,
    hasNextRound,
    timerExpired: current?.timerExpired ?? false,
  });

  return {
    public: pub,
    allowed: allowedCommands(st.phase, st.is_test),
    suggested,
    current,
    next,
    rounds: detail.roundsDetail,
    counts,
    warnings,
    events,
    reserves,
    participants: participants.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      points: p.points ?? 0,
      rank: p.rank,
      online: p.online || p.is_bot,
      status: p.status,
      isBot: p.is_bot,
      answeredCurrent: p.answered_current,
      lastSeenAt: iso(p.last_seen_at)!,
      anomalies: p.anomalies,
    })),
    displayKey: detail.displayKey,
    code: detail.code,
    isTest: detail.isTest,
  };
}
