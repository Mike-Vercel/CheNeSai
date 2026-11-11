import { z } from "zod";
import { getSql, iso } from "@/lib/database/db";
import { aggregateStandings } from "@/lib/game-engine/ranking";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { audit, CmsError } from "../audit";
import type { Actor } from "../engine";
import { DEFAULT_SETTINGS, loadGlobalSettings, type GlobalSettings } from "../settings";

// ---------------------------------------------------------------------------
// Impostazioni globali (solo super admin)
// ---------------------------------------------------------------------------
export const globalSettingsSchema = z.object({
  scoring: z.object({
    correctPoints: z.number().int().min(0).max(100000),
    wrongPenalty: z.number().int().min(0).max(100000),
    noAnswerPenalty: z.number().int().min(0).max(100000),
    allowNegative: z.boolean(),
  }),
  timing: z.object({
    defaultDurationSeconds: z.number().int().min(3).max(120),
    answerGraceMs: z.number().int().min(0).max(2000),
    defaultVoteSeconds: z.number().int().min(5).max(120),
  }),
  players: z.object({ nicknameMaxLength: z.number().int().min(4).max(24), nicknameMinLength: z.number().int().min(1).max(4) }),
  leaderboard: z.object({
    monthlyAggregation: z.enum(["sum_points", "placement_points"]),
    placementPoints: z.array(z.number().int().min(0).max(1000)).min(1).max(30),
  }),
  events: z.object({ autoEventsEnabled: z.boolean() }),
});

export async function getSettings(): Promise<GlobalSettings> {
  return loadGlobalSettings(getSql());
}

export async function saveSettings(raw: unknown, actor: Actor): Promise<GlobalSettings> {
  const s = globalSettingsSchema.parse(raw);
  const sql = getSql();
  await sql.begin(async (tx) => {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof GlobalSettings)[]) {
      await tx`
        insert into application_settings (key, value, updated_by, updated_at) values (${key}, ${tx.json(s[key])}, ${actor.userId}, now())
        on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
    }
    await audit(tx, actor, "settings.update", { type: "settings", details: s });
  });
  return getSettings();
}

// ---------------------------------------------------------------------------
// Amministratori (solo super admin)
// ---------------------------------------------------------------------------
export const adminUserSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(2).max(80),
  role: z.enum(["operator", "admin", "super_admin"]),
  password: z.string().min(10, "Password di almeno 10 caratteri").max(128),
});

export async function listAdmins() {
  const sql = getSql();
  const rows = await sql<{ user_id: string; email: string; display_name: string; role: string; active: boolean; created_at: Date; sessions: string[] }[]>`
    select a.user_id, a.email, a.display_name, a.role, a.active, a.created_at,
      coalesce((select array_agg(o.session_id::text) from session_operators o where o.user_id = a.user_id), '{}') as sessions
    from admin_users a order by a.created_at`;
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    active: r.active,
    createdAt: iso(r.created_at)!,
    sessions: r.sessions,
  }));
}

export async function createAdmin(raw: unknown, actor: Actor) {
  const d = adminUserSchema.parse(raw);
  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({ email: d.email, password: d.password, email_confirm: true });
  if (error || !data.user) throw new CmsError(`Creazione utente non riuscita: ${error?.message ?? "errore"}`, 422);
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`insert into admin_users (user_id, email, display_name, role) values (${data.user.id}, ${d.email}, ${d.displayName}, ${d.role})`;
    await audit(tx, actor, "admin.create", { type: "admin_user", id: data.user.id, details: { email: d.email, role: d.role } });
  });
  return data.user.id;
}

export async function updateAdmin(userId: string, raw: unknown, actor: Actor) {
  const d = z
    .object({
      role: z.enum(["operator", "admin", "super_admin"]).optional(),
      active: z.boolean().optional(),
      displayName: z.string().trim().min(2).max(80).optional(),
      password: z.string().min(10).max(128).optional(),
      sessions: z.array(z.uuid()).max(200).optional(),
    })
    .parse(raw);
  if (userId === actor.userId && (d.active === false || (d.role && d.role !== "super_admin"))) {
    throw new CmsError("Non puoi disattivare o declassare il tuo stesso account", 409);
  }
  if (d.password) {
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, { password: d.password });
    if (error) throw new CmsError(`Aggiornamento password non riuscito: ${error.message}`, 422);
  }
  const sql = getSql();
  await sql.begin(async (tx) => {
    const rows = await tx`
      update admin_users set role = coalesce(${d.role ?? null}, role), active = coalesce(${d.active ?? null}::boolean, active),
        display_name = coalesce(${d.displayName ?? null}, display_name)
      where user_id = ${userId} returning user_id`;
    if (rows.length === 0) throw new CmsError("Amministratore non trovato", 404);
    if (d.sessions) {
      await tx`delete from session_operators where user_id = ${userId}`;
      for (const s of d.sessions) await tx`insert into session_operators (session_id, user_id) values (${s}, ${userId}) on conflict do nothing`;
    }
    const { password: _pw, ...safe } = d;
    await audit(tx, actor, "admin.update", { type: "admin_user", id: userId, details: { ...safe, passwordChanged: !!d.password } });
  });
}

// ---------------------------------------------------------------------------
// Stagioni e classifiche aggregate
// ---------------------------------------------------------------------------
export const seasonSchema = z.object({
  name: z.string().trim().min(2).max(80),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  aggregation: z.enum(["sum_points", "placement_points"]).default("sum_points"),
});

export async function listSeasons() {
  const sql = getSql();
  const rows = await sql<{ id: string; name: string; starts_on: Date; ends_on: Date; aggregation: string; sessions: number }[]>`
    select s.id, s.name, s.starts_on, s.ends_on, s.aggregation,
      (select count(*)::int from game_sessions g where g.season_id = s.id) as sessions
    from seasons s order by s.starts_on desc`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    startsOn: iso(r.starts_on)!.slice(0, 10),
    endsOn: iso(r.ends_on)!.slice(0, 10),
    aggregation: r.aggregation,
    sessions: r.sessions,
  }));
}

export async function saveSeason(id: string | null, raw: unknown, actor: Actor) {
  const d = seasonSchema.parse(raw);
  if (d.endsOn < d.startsOn) throw new CmsError("La data di fine precede quella di inizio", 422);
  const sql = getSql();
  return sql.begin(async (tx) => {
    let sid = id;
    if (id) {
      await tx`update seasons set name = ${d.name}, starts_on = ${d.startsOn}, ends_on = ${d.endsOn}, aggregation = ${d.aggregation} where id = ${id}`;
    } else {
      [{ id: sid }] = await tx<{ id: string }[]>`
        insert into seasons (name, starts_on, ends_on, aggregation) values (${d.name}, ${d.startsOn}, ${d.endsOn}, ${d.aggregation}) returning id`;
    }
    await audit(tx, actor, id ? "season.update" : "season.create", { type: "season", id: sid });
    return sid!;
  });
}

export async function deleteSeason(id: string, actor: Actor) {
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`delete from seasons where id = ${id}`;
    await audit(tx, actor, "season.delete", { type: "season", id });
  });
}

/**
 * Classifica aggregata (mese o stagione). Il giocatore è riconosciuto tramite
 * l'identità persistente (dispositivo o codice di recupero), NON il nickname;
 * chi non ha identità (es. bot o slot di prova) è conteggiato per serata.
 */
export async function aggregatedLeaderboard(period: { from: string; to: string; mode?: "sum_points" | "placement_points"; seasonId?: string }) {
  const sql = getSql();
  const settings = await loadGlobalSettings(sql);
  const rows = await sql<{ identity: string; nickname: string; points: number; final_rank: number; session_date: Date }[]>`
    select coalesce(l.identity_id::text, 'p:' || l.participant_id::text) as identity, l.nickname, l.points, l.final_rank, l.session_date
    from leaderboards l join game_sessions g on g.id = l.session_id
    where not l.is_test and ${seasonFilter(sql, period)}`;
  const mode = period.mode ?? settings.leaderboard.monthlyAggregation;
  const [{ sessions }] = await sql<{ sessions: number }[]>`
    select count(distinct l.session_id)::int as sessions from leaderboards l join game_sessions g on g.id = l.session_id
    where not l.is_test and ${seasonFilter(sql, period)}`;
  return {
    mode,
    sessions,
    standings: aggregateStandings(
      rows.map((r) => ({
        identityKey: r.identity,
        nickname: r.nickname,
        points: r.points,
        finalRank: r.final_rank,
        sessionDate: iso(r.session_date)!.slice(0, 10),
      })),
      mode,
      settings.leaderboard.placementPoints,
    ).map(({ identityKey: _k, ...rest }) => rest),
  };
}

/**
 * Stagione: le serate assegnate esplicitamente alla stagione, più quelle senza
 * stagione che cadono nelle sue date. Mese/periodo: solo l'intervallo di date.
 */
function seasonFilter(sql: ReturnType<typeof getSql>, p: { from: string; to: string; seasonId?: string }) {
  if (p.seasonId) {
    return sql`(g.season_id = ${p.seasonId} or (g.season_id is null and l.session_date between ${p.from}::date and ${p.to}::date))`;
  }
  return sql`l.session_date between ${p.from}::date and ${p.to}::date`;
}

export function monthRange(month: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new CmsError("Mese non valido (AAAA-MM)", 422);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

// ---------------------------------------------------------------------------
// Libreria eventi di Palmino
// ---------------------------------------------------------------------------
export async function listEventDefinitions() {
  const sql = getSql();
  return sql<
    {
      id: string;
      key: string;
      type: string;
      title: string;
      tagline: string;
      description: string;
      params: Record<string, number>;
      animation: string;
      sound: string;
      maxPerSession: number;
      allowedRoundKinds: string[];
      enabled: boolean;
    }[]
  >`
    select id, key, type::text, title, tagline, description, params, animation, sound, max_per_session as "maxPerSession",
      allowed_round_kinds::text[] as "allowedRoundKinds", enabled
    from special_event_definitions order by title`;
}

export async function updateEventDefinition(id: string, raw: unknown, actor: Actor) {
  const d = z
    .object({
      title: z.string().trim().min(2).max(40).optional(),
      tagline: z.string().trim().min(2).max(120).optional(),
      description: z.string().trim().max(500).optional(),
      params: z
        .object({
          correctMultiplier: z.number().min(0).max(20).optional(),
          wrongMultiplier: z.number().min(0).max(20).optional(),
          bonusPoints: z.number().int().min(0).max(100000).optional(),
          durationSeconds: z.number().int().min(3).max(60).optional(),
        })
        .optional(),
      maxPerSession: z.number().int().min(0).max(50).optional(),
      allowedRoundKinds: z.array(z.enum(["standard", "music", "image", "video", "category_vote", "bonus", "final"])).min(1).optional(),
      enabled: z.boolean().optional(),
    })
    .parse(raw);
  const sql = getSql();
  await sql.begin(async (tx) => {
    const rows = await tx`
      update special_event_definitions set
        title = coalesce(${d.title ?? null}, title), tagline = coalesce(${d.tagline ?? null}, tagline),
        description = coalesce(${d.description ?? null}, description),
        params = coalesce(${d.params ? tx.json(d.params) : null}::jsonb, params),
        max_per_session = coalesce(${d.maxPerSession ?? null}::smallint, max_per_session),
        allowed_round_kinds = coalesce(${d.allowedRoundKinds ? tx.array(d.allowedRoundKinds) : null}::round_kind[], allowed_round_kinds),
        enabled = coalesce(${d.enabled ?? null}::boolean, enabled)
      where id = ${id} returning id`;
    if (rows.length === 0) throw new CmsError("Evento non trovato", 404);
    await audit(tx, actor, "event_definition.update", { type: "special_event_definition", id, details: d as Record<string, unknown> });
  });
}

// ---------------------------------------------------------------------------
// Audit e anomalie
// ---------------------------------------------------------------------------
export async function listAudit(f: { sessionId?: string; limit?: number; before?: number }) {
  const sql = getSql();
  const rows = await sql<{ id: number; actor_email: string | null; action: string; session_id: string | null; target_type: string | null; target_id: string | null; details: unknown; ip: string | null; created_at: Date }[]>`
    select id, actor_email, action, session_id, target_type, target_id, details, ip, created_at
    from admin_audit_logs
    where (${f.sessionId ?? null}::uuid is null or session_id = ${f.sessionId ?? null}::uuid)
      and (${f.before ?? null}::bigint is null or id < ${f.before ?? null}::bigint)
    order by id desc limit ${Math.min(f.limit ?? 100, 500)}`;
  return rows.map((r) => ({ ...r, created_at: iso(r.created_at) }));
}

export async function listAnomalies(sessionId: string) {
  const sql = getSql();
  const rows = await sql<{ id: number; kind: string; nickname: string | null; details: unknown; ip: string | null; created_at: Date }[]>`
    select e.id, e.kind, p.nickname, e.details, e.ip, e.created_at
    from security_events e left join participants p on p.id = e.participant_id
    where e.session_id = ${sessionId} order by e.id desc limit 300`;
  return rows.map((r) => ({ ...r, created_at: iso(r.created_at) }));
}

/** Dettaglio risposte di un giocatore nella sessione (pannello Giocatori). */
export async function participantAnswers(participantId: string) {
  const sql = getSql();
  return sql`
    select sq.play_order, qs.text, a.selected_positions, qs.correct_positions, a.is_correct, a.response_ms, a.submitted_at,
      e.delta, e.reason
    from session_questions sq
    join question_snapshots qs on qs.session_question_id = sq.id
    left join answer_submissions a on a.session_question_id = sq.id and a.participant_id = ${participantId}
    left join score_events e on e.session_question_id = sq.id and e.participant_id = ${participantId} and e.kind in ('answer','no_answer')
    where sq.session_id = (select session_id from participants where id = ${participantId}) and sq.shown_at is not null
    order by sq.play_order`;
}
