// Tipi condivisi del CMS: solo `import type` dai moduli server (nessun codice server nel bundle client).
export type { SessionSummary, SessionDetail, RoundDetail, SessionQuestionItem, PublishIssue } from "@/lib/server/cms/sessions";
export type { QuestionRecord, ImportReport } from "@/lib/server/cms/questions";
export type { MediaRecord } from "@/lib/server/cms/media";
export type { GlobalSettings } from "@/lib/server/settings";
export type { SessionSettings, RoundInput, QuestionInput } from "@/lib/validation/schemas";

import type { RoundKind, SpecialEventType } from "@/lib/game-engine/types";

export interface EventParams {
  correctMultiplier?: number;
  wrongMultiplier?: number;
  bonusPoints?: number;
  durationSeconds?: number;
}

export interface EventDefinition {
  id: string;
  key: string;
  type: SpecialEventType;
  title: string;
  tagline: string;
  description: string;
  params: EventParams;
  animation: string;
  sound: string;
  maxPerSession: number;
  allowedRoundKinds: RoundKind[];
  enabled: boolean;
}

export interface Season {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  aggregation: "sum_points" | "placement_points";
  sessions: number;
}

export interface Standing {
  nickname: string;
  total: number;
  sessions: number;
  bestRank: number;
  wins: number;
  rank: number;
}

export interface LeaderboardResponse {
  title: string;
  from: string;
  to: string;
  mode: "sum_points" | "placement_points";
  sessions: number;
  standings: Standing[];
}

export interface AdminUser {
  userId: string;
  email: string;
  displayName: string;
  role: "operator" | "admin" | "super_admin";
  active: boolean;
  createdAt: string;
  sessions: string[];
}

export interface AuditEntry {
  id: number;
  actor_email: string | null;
  action: string;
  session_id: string | null;
  target_type: string | null;
  target_id: string | null;
  details: unknown;
  ip: string | null;
  created_at: string | null;
}

export interface DashboardStats {
  totals: {
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
  };
  history: { id: string; title: string; date: string | null; players: number; winner: string | null; top: number | null }[];
}

export interface SessionStatsData {
  session: { id: string; title: string };
  summary: { participants: number; answers: number; correct_pct: number | null; avg_response_ms: number | null; questions_played: number };
  questions: {
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
    correctRate: number;
  }[];
  hardest: { text: string; correctRate: number }[];
  easiest: { text: string; correctRate: number }[];
  rounds: { title: string; position: number; correct_pct: number | null; answers: number }[];
  final: { final_rank: number; nickname: string; points: number; correct_count: number }[];
  trend: { nickname: string; play_order: number; points_after: number }[];
  votes: { round: string; label: string; votes: number; winner: boolean; method: string | null }[];
  events: { title: string; type: string; source: string; status: string; announced_at: string | null; question: string | null; decided_from: unknown }[];
}

export interface CategoryCount {
  category: string;
  count: number;
  approved: number;
}
