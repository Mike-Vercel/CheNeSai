import { getSql, iso, type Db, type Tx } from "@/lib/database/db";
import { MAX_TEAMS, MIN_TEAMS, TEAM_COLORS, teamsEnabled } from "@/lib/game-engine/teams";
import type { SessionStatus } from "@/lib/game-engine/types";
import { teamInputSchema, teamUpdateSchema, type SessionSettings } from "@/lib/validation/schemas";
import { audit, CmsError } from "../audit";
import { rebroadcast, type Actor } from "../engine";
import { teamSettingsOf } from "../settings";
import { rerankTeams } from "../teams";

/**
 * Squadre della serata (pannello admin): crea, rinomina, ricolora, riordina, elimina.
 * Si possono gestire anche a serata pubblicata o in onda (es. nella lobby), mai a serata conclusa.
 * Ogni modifica è registrata nel log di audit e ripubblicata a TV e telefoni.
 */

export interface TeamAdmin {
  id: string;
  name: string;
  color: string;
  position: number;
  members: number;
  createdAt: string;
}

export async function listTeams(db: Db, sessionId: string): Promise<TeamAdmin[]> {
  const rows = await db<{ id: string; name: string; color: string; position: number; members: number; created_at: Date }[]>`
    select t.id, t.name, t.color, t.position, t.created_at,
      (select count(*)::int from participants p where p.team_id = t.id and p.status = 'active') as members
    from teams t where t.session_id = ${sessionId} order by t.position, t.name`;
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position, members: r.members, createdAt: iso(r.created_at)! }));
}

async function lockSession(tx: Tx, sessionId: string) {
  const [s] = await tx<{ status: SessionStatus; settings: SessionSettings }[]>`
    select status, settings from game_sessions where id = ${sessionId} for update`;
  if (!s) throw new CmsError("Sessione non trovata", 404);
  if (s.status === "finished" || s.status === "archived") throw new CmsError("La serata è conclusa: le squadre non si modificano più", 409);
  return s;
}

function uniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === "23505";
}

/** Dopo il commit: TV e telefoni vedono subito le squadre aggiornate (solo serate pubblicate). */
async function publish(sessionId: string, status: SessionStatus) {
  if (status === "draft") return;
  try {
    await rebroadcast(sessionId);
  } catch (e) {
    console.warn("[quizzone] aggiornamento squadre non trasmesso", e instanceof Error ? e.message : e);
  }
}

export async function createTeam(sessionId: string, raw: unknown, actor: Actor): Promise<string> {
  const parsed = teamInputSchema.safeParse(raw);
  if (!parsed.success) throw new CmsError("Squadra non valida", 422, parsed.error.issues);
  const sql = getSql();
  let status: SessionStatus = "draft";
  const id = await sql
    .begin(async (tx) => {
      const s = await lockSession(tx, sessionId);
      status = s.status;
      const existing = await tx<{ color: string; position: number }[]>`select color, position from teams where session_id = ${sessionId}`;
      if (existing.length >= MAX_TEAMS) throw new CmsError(`Al massimo ${MAX_TEAMS} squadre per serata`, 409);
      const used = new Set(existing.map((t) => t.color.toLowerCase()));
      const color = parsed.data.color ?? TEAM_COLORS.find((c) => !used.has(c.toLowerCase())) ?? TEAM_COLORS[existing.length % TEAM_COLORS.length];
      const position = existing.length === 0 ? 0 : Math.max(...existing.map((t) => t.position)) + 1;
      const [row] = await tx<{ id: string }[]>`
        insert into teams (session_id, name, color, position) values (${sessionId}, ${parsed.data.name}, ${color}, ${Math.min(position, 99)})
        returning id`;
      await audit(tx, actor, "team.create", { sessionId, type: "team", id: row.id, details: { name: parsed.data.name, color } });
      return row.id;
    })
    .catch((e: unknown) => {
      if (uniqueViolation(e)) throw new CmsError("Esiste già una squadra con questo nome", 409);
      throw e;
    });
  await publish(sessionId, status);
  return id;
}

export async function updateTeam(sessionId: string, teamId: string, raw: unknown, actor: Actor): Promise<void> {
  const parsed = teamUpdateSchema.safeParse(raw);
  if (!parsed.success) throw new CmsError("Squadra non valida", 422, parsed.error.issues);
  const d = parsed.data;
  if (d.name === undefined && d.color === undefined && d.position === undefined) throw new CmsError("Nessuna modifica", 422);
  const sql = getSql();
  let status: SessionStatus = "draft";
  await sql
    .begin(async (tx) => {
      const s = await lockSession(tx, sessionId);
      status = s.status;
      const rows = await tx`
        update teams set
          name = coalesce(${d.name ?? null}, name),
          color = coalesce(${d.color ?? null}, color),
          position = coalesce(${d.position ?? null}::smallint, position),
          updated_at = now()
        where id = ${teamId} and session_id = ${sessionId} returning id`;
      if (rows.length === 0) throw new CmsError("Squadra non trovata", 404);
      await audit(tx, actor, "team.update", { sessionId, type: "team", id: teamId, details: d as Record<string, unknown> });
    })
    .catch((e: unknown) => {
      if (uniqueViolation(e)) throw new CmsError("Esiste già una squadra con questo nome", 409);
      throw e;
    });
  await publish(sessionId, status);
}

/** Elimina una squadra: i suoi giocatori restano in gioco, senza squadra. */
export async function deleteTeam(sessionId: string, teamId: string, actor: Actor): Promise<void> {
  const sql = getSql();
  let status: SessionStatus = "draft";
  await sql.begin(async (tx) => {
    const s = await lockSession(tx, sessionId);
    status = s.status;
    const [t] = await tx<{ name: string; members: number }[]>`
      select name, (select count(*)::int from participants p where p.team_id = teams.id) as members
      from teams where id = ${teamId} and session_id = ${sessionId}`;
    if (!t) throw new CmsError("Squadra non trovata", 404);
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from teams where session_id = ${sessionId}`;
    if (s.status !== "draft" && teamsEnabled(teamSettingsOf(s.settings).mode) && n <= MIN_TEAMS) {
      throw new CmsError(`La serata è a squadre: servono almeno ${MIN_TEAMS} squadre`, 409);
    }
    await tx`delete from teams where id = ${teamId}`;
    await rerankTeams(tx, sessionId);
    await audit(tx, actor, "team.delete", { sessionId, type: "team", id: teamId, details: { name: t.name, members: t.members } });
  });
  await publish(sessionId, status);
}

/** Copia le squadre (nome, colore, ordine) in una serata duplicata. */
export async function copyTeams(tx: Tx, fromSessionId: string, toSessionId: string): Promise<void> {
  await tx`
    insert into teams (session_id, name, color, position)
    select ${toSessionId}, name, color, position from teams where session_id = ${fromSessionId}`;
}
