import "server-only";
import { nicknameKey } from "@/lib/game-engine/nickname";
import { getSql, iso, type Db } from "@/lib/database/db";
import { checkMemberName, checkTeamName, computeRanks, isLobby, isTerminal, levelFor, runOfShow, teamColor } from "@/lib/tig/rules";
import { eventConfigSchema, MANCHE_TITLES, type JoinInput, type JoinPreview, type LobbyTable, type MyEvent, type TigPublicState, type TigView } from "@/lib/tig/types";
import { checkRateLimit } from "@/lib/server/players";
import type { TigUser } from "./auth";
import { runAction, SYSTEM_ACTOR } from "./engine";
import { TigError, tigFail } from "./errors";
import { broadcastTig } from "./realtime";
import { accuracyOf, buildLobbyTables, buildPlayerView, buildPublicState, buildRegiaView, loadEvent, parseConfig, thresholds, type EventRow, type MemberRow, type TableRow, type TeamRow } from "./state";
import { isJoinCode, newDisplayKey, newJoinCode, newPin, newTableToken, normalizeCode, verifyTableToken } from "./tokens";

/**
 * Serate di TAVOLI IN GUERRA!: creazione (wizard della regia), ingresso dei tavoli con QR o codice,
 * letture (giocatore, regia, TV), elenco «Riprendi», pulizia delle serate abbandonate, esportazione.
 */

export const CREATE_LIMITS = { perUser: { limit: 12, windowSeconds: 3600 }, perIp: { limit: 40, windowSeconds: 3600 } };
export const JOIN_LIMITS = { perUser: { limit: 60, windowSeconds: 600 }, perIp: { limit: 300, windowSeconds: 600 } };
const HEARTBEAT_MS = 15_000;
const UUID = /^[0-9a-f-]{36}$/i;
const DISPLAY_KEY = /^[A-Za-z0-9_-]{24,64}$/;
const MAX_TEAM_MEMBERS = 12;
/** serate senza regia né TV da tanto: chiuse (pigramente e dal cron) */
export const ABANDON_MINUTES = { lobby: 180, live: 30 };
export const STALE_HOURS = 14;

async function limit(bucket: string, l: { limit: number; windowSeconds: number }, message: string) {
  if (!(await checkRateLimit(getSql(), bucket, l.limit, l.windowSeconds))) throw new TigError("RATE_LIMITED", message);
}

// ---------------------------------------------------------------------------
// Creazione
// ---------------------------------------------------------------------------
export async function createEvent(user: TigUser, raw: unknown): Promise<{ eventId: string }> {
  const parsed = eventConfigSchema.safeParse(raw);
  if (!parsed.success) tigFail("VALIDATION", parsed.error.issues[0]?.message ?? "Impostazioni non valide", parsed.error.issues);
  const config = parsed.data;
  await limit(`tig-create:${user.userId}`, CREATE_LIMITS.perUser, "Hai creato troppe serate di fila: riprova più tardi");
  if (user.ip) await limit(`tig-create-ip:${user.ip}`, CREATE_LIMITS.perIp, "Troppe serate create da questa rete: riprova più tardi");
  await closeAbandonedEvents({ userId: user.userId }).catch(() => undefined);
  const sql = getSql();
  const segs = runOfShow(config.durationMin, config.segments);
  const plan = segs.filter((s) => s.mancheNo).map((s) => ({ mancheNo: s.mancheNo!, title: MANCHE_TITLES[s.mancheNo!], games: s.games ?? 0, minutes: s.minutes, played: 0 }));
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await sql.begin(async (tx) => {
        const [ev] = await tx<{ id: string }[]>`
          insert into tig_events (owner_user_id, venue, venue_key, display_key, access_mode, config, plan)
          values (${user.userId}, ${config.venue}, ${nicknameKey(config.venue).slice(0, 60) || "locale"}, ${newDisplayKey()}, ${config.accessMode}, ${tx.json(config as never)}, ${tx.json(plan as never)})
          returning id`;
        for (let n = 1; n <= config.tables; n++) {
          await tx`insert into tig_tables (event_id, table_no, qr_token, join_code, pin) values (${ev.id}, ${n}, ${newTableToken()}, ${newJoinCode()}, ${config.staffPin ? newPin() : null})`;
        }
        await tx`insert into tig_log (event_id, kind, audit, actor_user_id, data) values (${ev.id}, 'created', true, ${user.userId}, ${tx.json({ tables: config.tables, durationMin: config.durationMin, accessMode: config.accessMode } as never)})`;
        return { eventId: ev.id };
      });
    } catch (e) {
      // codice tavolo già usato da un'altra serata (raro): si rigenera
      if ((e as { code?: string }).code === "23505") continue;
      throw e;
    }
  }
  tigFail("BUSY", "Non riesco a generare i codici dei tavoli: riprova");
}

// ---------------------------------------------------------------------------
// Ingresso: QR del tavolo o codice squadra
// ---------------------------------------------------------------------------
async function findTable(db: Db, input: { token?: string; code?: string }): Promise<TableRow | null> {
  if (input.token) {
    if (!verifyTableToken(input.token)) return null;
    const [t] = await db<TableRow[]>`select * from tig_tables where qr_token = ${input.token}`;
    return t ?? null;
  }
  const code = normalizeCode(input.code ?? "");
  if (!isJoinCode(code)) return null;
  const [t] = await db<TableRow[]>`select * from tig_tables where join_code = ${code}`;
  return t ?? null;
}

function joinRules(ev: EventRow) {
  const closed = ev.status === "closed" || isTerminal(ev.state);
  const open = ev.state === "LOBBY_OPEN" || (ev.late_join && !closed && ev.state !== "DRAFT");
  return { closed, open };
}

export async function previewJoin(user: TigUser, input: { token?: string; code?: string }): Promise<JoinPreview> {
  await limit(`tig-join:${user.userId}`, JOIN_LIMITS.perUser, "Troppi tentativi: aspetta qualche minuto");
  if (user.ip) await limit(`tig-join-ip:${user.ip}`, JOIN_LIMITS.perIp, "Troppi tentativi da questa rete: aspetta qualche minuto");
  const sql = getSql();
  const table = await findTable(sql, input);
  if (!table) tigFail("NOT_FOUND", input.token ? "QR non valido: chiedi allo staff il QR del tuo tavolo" : "Codice non valido: controlla le lettere");
  const ev = (await loadEvent(sql, table.event_id))!;
  const [[team], [mine]] = await Promise.all([
    sql<{ id: string; name: string; approved: boolean; status: string; members: number }[]>`
      select t.id, t.name, t.approved, t.status, (select count(*)::int from tig_members m where m.team_id = t.id and m.status = 'active') as members
      from tig_teams t where t.event_id = ${ev.id} and t.table_id = ${table.id}`,
    sql<{ team_id: string; status: string; table_no: number }[]>`
      select m.team_id, m.status, t.table_no from tig_members m join tig_teams t on t.id = m.team_id where m.event_id = ${ev.id} and m.user_id = ${user.userId}`,
  ]);
  const r = joinRules(ev);
  const inThisTeam = !!mine && !!team && mine.team_id === team.id && mine.status !== "kicked";
  let blocked: string | null = null;
  if (r.closed) blocked = "Questa serata è finita";
  else if (mine?.status === "kicked") blocked = "Lo staff ti ha tolto da questa serata";
  else if (mine && mine.status === "active" && (!team || mine.team_id !== team.id)) blocked = `Sei già nella squadra del tavolo ${mine.table_no}: un account gioca con un solo tavolo`;
  else if (team?.status === "kicked") blocked = "Questo tavolo è stato escluso dallo staff";
  else if (!inThisTeam && ev.state === "DRAFT") blocked = "La lobby non è ancora aperta: aspetta il via dello staff";
  else if (!inThisTeam && !r.open) blocked = "La lobby è chiusa: chiedi allo staff di autorizzare l'ingresso";
  return {
    eventId: ev.id,
    venue: ev.venue,
    state: ev.state,
    status: ev.status,
    tableNo: table.table_no,
    team: team && team.status === "active" ? { teamId: team.id, name: team.name, approved: team.approved, members: team.members } : null,
    mine: mine && mine.status === "active" ? { teamId: mine.team_id, tableNo: mine.table_no, sameTable: inThisTeam } : null,
    needsPin: !!table.pin && !inThisTeam,
    canCreate: !blocked && !team,
    canJoin: !blocked,
    blockedReason: blocked,
    suggestedNickname: user.username,
  };
}

/**
 * Ingresso atomico: il PRIMO telefono crea la squadra del tavolo (UNIQUE(event_id, table_id): due scansioni
 * simultanee → una sola squadra, il secondo entra in quella); gli altri entrano nella squadra esistente.
 * Un account appartiene a UNA squadra per serata (UNIQUE(event_id, user_id)), anche da due browser.
 */
export async function joinEvent(user: TigUser, input: JoinInput): Promise<{ eventId: string; teamId: string; created: boolean; joinedExisting: boolean }> {
  await limit(`tig-join:${user.userId}`, JOIN_LIMITS.perUser, "Troppi tentativi: aspetta qualche minuto");
  if (user.ip) await limit(`tig-join-ip:${user.ip}`, JOIN_LIMITS.perIp, "Troppi tentativi da questa rete: aspetta qualche minuto");
  const nick = checkMemberName(input.nickname);
  if (!nick.ok) tigFail("VALIDATION", nick.message);
  const sql = getSql();
  const table0 = await findTable(sql, input);
  if (!table0) tigFail("NOT_FOUND", input.token ? "QR non valido" : "Codice non valido");
  try {
    return await sql.begin(async (tx) => {
      await tx`select set_config('lock_timeout', '4s', true), set_config('statement_timeout', '10s', true)`;
      const ev = (await loadEvent(tx, table0.event_id, true))!;
      const r = joinRules(ev);
      if (r.closed) tigFail("CLOSED", "Questa serata è finita");
      const [me] = await tx<MemberRow[]>`select * from tig_members where event_id = ${ev.id} and user_id = ${user.userId}`;
      if (me?.status === "kicked") tigFail("KICKED", "Lo staff ti ha tolto da questa serata");
      let [team] = await tx<TeamRow[]>`select * from tig_teams where event_id = ${ev.id} and table_id = ${table0.id}`;
      // riconnessione: già in questa squadra
      if (me?.status === "active" && team && me.team_id === team.id) return { eventId: ev.id, teamId: team.id, created: false, joinedExisting: true };
      if (me?.status === "active") {
        const [other] = await tx<{ table_no: number }[]>`select table_no from tig_teams where id = ${me.team_id}`;
        tigFail("ALREADY_IN_TEAM", `Sei già nella squadra del tavolo ${other?.table_no ?? "?"}: un account gioca con un solo tavolo`);
      }
      const returning = me?.status === "left" && team && me.team_id === team.id;
      if (!returning) {
        if (ev.state === "DRAFT") tigFail("LOBBY_LOCKED", "La lobby non è ancora aperta: aspetta il via dello staff");
        if (!r.open) tigFail("LOBBY_LOCKED", "La lobby è chiusa: chiedi allo staff di autorizzare l'ingresso");
        if (table0.pin) {
          if (!input.pin) tigFail("PIN_REQUIRED", "Serve il PIN del tavolo: chiedilo allo staff");
          if (!(await checkRateLimit(tx, `tig-pin:${user.userId}:${table0.id}`, 8, 600))) tigFail("RATE_LIMITED", "Troppi PIN sbagliati: chiedi aiuto allo staff");
          if (input.pin.trim() !== table0.pin) tigFail("PIN_WRONG", "PIN sbagliato: controlla con lo staff");
        }
      }
      if (team?.status === "kicked") tigFail("KICKED", "Questo tavolo è stato escluso dallo staff");
      let created = false;
      if (!team) {
        const name = checkTeamName(input.teamName ?? "");
        if (!name.ok) tigFail("VALIDATION", name.message);
        const [ins] = await tx<TeamRow[]>`
          insert into tig_teams (event_id, table_id, table_no, name, name_key, color)
          values (${ev.id}, ${table0.id}, ${table0.table_no}, ${name.value}, ${name.key}, ${teamColor(table0.table_no)})
          on conflict (event_id, table_id) do nothing
          returning *`;
        if (ins) {
          team = ins;
          created = true;
        } else {
          [team] = await tx<TeamRow[]>`select * from tig_teams where event_id = ${ev.id} and table_id = ${table0.id}`;
        }
      }
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from tig_members where team_id = ${team.id} and status = 'active'`;
      if (n >= MAX_TEAM_MEMBERS) tigFail("TEAM_FULL", `La squadra è al completo (massimo ${MAX_TEAM_MEMBERS} telefoni)`);
      let memberId: string;
      if (me) {
        await tx`update tig_members set team_id = ${team.id}, status = 'active', nickname = ${nick.value}, last_seen_at = now() where id = ${me.id}`;
        memberId = me.id;
      } else {
        const [m] = await tx<{ id: string }[]>`insert into tig_members (event_id, team_id, user_id, nickname) values (${ev.id}, ${team.id}, ${user.userId}, ${nick.value}) returning id`;
        memberId = m.id;
      }
      if (created || !team.captain_member_id) await tx`update tig_teams set captain_member_id = ${memberId} where id = ${team.id}`;
      await tx`insert into tig_log (event_id, kind, actor_user_id, data) values (${ev.id}, ${created ? "team_created" : "member_joined"}, ${user.userId}, ${tx.json({ tableNo: table0.table_no } as never)})`;
      const noteJson = { kind: created ? "team_created" : "member_joined", at: ev.db_now.toISOString(), data: { tableNo: table0.table_no } };
      await tx`update tig_events set version = version + 1, secret_rev = secret_rev + 1, updated_at = now(), last_activity_at = now(), event = ${tx.json(noteJson as never)} where id = ${ev.id}`;
      const fresh = (await loadEvent(tx, ev.id))!;
      await broadcastTig(tx, await buildPublicState(tx, fresh));
      return { eventId: ev.id, teamId: team.id, created, joinedExisting: !created };
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "23505") throw new TigError("ALREADY_IN_TEAM", "Sei già in una squadra di questa serata");
    if (code === "55P03" || code === "57014") throw new TigError("BUSY", "Troppe richieste nello stesso momento: riprova");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Letture
// ---------------------------------------------------------------------------
/** Scadenza passata senza che nessuno abbia agito: la serata avanza (idempotente). */
async function settle(ev: EventRow): Promise<boolean> {
  if (ev.status !== "open" || ev.state === "PAUSED" || isTerminal(ev.state) || isLobby(ev.state)) return false;
  if (!ev.phase_deadline_at || ev.db_now.getTime() < ev.phase_deadline_at.getTime()) return false;
  await runAction(ev.id, SYSTEM_ACTOR, { action: "tick" }).catch(() => undefined);
  return true;
}

export async function getEventView(user: TigUser, eventId: string, as: "player" | "regia"): Promise<TigView> {
  if (!UUID.test(eventId)) tigFail("NOT_FOUND", "Serata non trovata");
  const sql = getSql();
  let ev = await loadEvent(sql, eventId);
  if (!ev) tigFail("NOT_FOUND", "Serata non trovata");
  if (as === "regia") {
    if (ev.owner_user_id !== user.userId) tigFail("FORBIDDEN", "Solo l'organizzatore della serata può aprire la regia");
    if (await settle(ev)) ev = (await loadEvent(sql, eventId))!;
    if (ev.status === "open" && ev.db_now.getTime() - ev.host_seen_at.getTime() > HEARTBEAT_MS) await sql`update tig_events set host_seen_at = now() where id = ${eventId}`;
    const [state, view] = await Promise.all([buildPublicState(sql, ev), buildRegiaView(sql, ev)]);
    return { state, view };
  }
  const [member] = await sql<MemberRow[]>`select * from tig_members where event_id = ${eventId} and user_id = ${user.userId}`;
  if (!member) tigFail("NOT_MEMBER", "Non sei in una squadra di questa serata: scansiona il QR del tuo tavolo");
  if (member.status === "kicked") tigFail("KICKED", "Lo staff ti ha tolto da questa serata");
  if (member.status === "left") tigFail("NOT_MEMBER", "Sei uscito dalla serata: riscansiona il QR del tavolo per rientrare");
  await closeAbandonedEvents({ eventId }).catch(() => undefined);
  ev = (await loadEvent(sql, eventId))!;
  if (await settle(ev)) ev = (await loadEvent(sql, eventId))!;
  if (ev.status === "open" && ev.db_now.getTime() - member.last_seen_at.getTime() > HEARTBEAT_MS) {
    await sql`update tig_members set last_seen_at = now() where id = ${member.id}`;
    member.last_seen_at = ev.db_now;
  }
  const [state, view] = await Promise.all([buildPublicState(sql, ev), buildPlayerView(sql, ev, member)]);
  return { state, view };
}

/** Schermo TV: nessun account, chiave lunga e casuale. Con `live` niente QR né codici. */
export async function getDisplayState(displayKey: string, opts: { live?: boolean } = {}): Promise<{ state: TigPublicState; lobby: LobbyTable[] | null }> {
  if (!DISPLAY_KEY.test(displayKey)) tigFail("NOT_FOUND", "Schermo non valido");
  const sql = getSql();
  const [found] = await sql<{ id: string }[]>`select id from tig_events where display_key = ${displayKey}`;
  if (!found) tigFail("NOT_FOUND", "Schermo non valido");
  await closeAbandonedEvents({ eventId: found.id }).catch(() => undefined);
  let ev = (await loadEvent(sql, found.id))!;
  if (await settle(ev)) ev = (await loadEvent(sql, found.id))!;
  if (ev.status === "open" && (!ev.display_seen_at || ev.db_now.getTime() - ev.display_seen_at.getTime() > HEARTBEAT_MS)) {
    await sql`update tig_events set display_seen_at = now() where id = ${ev.id}`;
  }
  const state = await buildPublicState(sql, ev);
  const lobby = !opts.live && isLobby(ev.state) && ev.status === "open" ? await buildLobbyTables(sql, ev) : null;
  return { state, lobby };
}

export async function listMyEvents(userId: string, limitN = 6): Promise<MyEvent[]> {
  await closeAbandonedEvents({ userId }).catch(() => undefined);
  const rows = await getSql()<{ id: string; venue: string; state: MyEvent["state"]; owner_user_id: string; last_activity_at: Date; tables: number }[]>`
    select e.id, e.venue, e.state, e.owner_user_id, e.last_activity_at, (select count(*)::int from tig_tables t where t.event_id = e.id) as tables
    from tig_events e
    where e.status = 'open' and e.state not in ('COMPLETED', 'CANCELLED') and e.last_activity_at > now() - make_interval(hours => ${STALE_HOURS})
      and (e.owner_user_id = ${userId} or exists (select 1 from tig_members m where m.event_id = e.id and m.user_id = ${userId} and m.status = 'active'))
    order by e.last_activity_at desc limit ${limitN}`;
  return rows.map((r) => ({ eventId: r.id, venue: r.venue, state: r.state, role: r.owner_user_id === userId ? "organizer" : "player", tables: r.tables, updatedAt: iso(r.last_activity_at)! }));
}

/**
 * Chiude le serate senza regia né TV da troppo (lobby 3 ore, in gioco 30 minuti) e quelle ferme da 14 ore.
 * Pigra (letture, «Riprendi», creazione) e dal cron. Idempotente; avvisa tutti in tempo reale.
 */
export async function closeAbandonedEvents(f: { eventId?: string; userId?: string; limit?: number } = {}): Promise<number> {
  const sql = getSql();
  if (f.eventId && !UUID.test(f.eventId)) return 0;
  const rows = await sql<{ id: string }[]>`
    update tig_events set status = 'closed', closed_at = now(), close_reason = 'abandoned', version = version + 1,
      state = case when state in ('COMPLETED', 'CANCELLED') then state else 'CANCELLED' end
    where id in (
      select e.id from tig_events e
      where e.status = 'open' and e.state not in ('COMPLETED', 'CANCELLED')
        and (
          e.last_activity_at < now() - make_interval(hours => ${STALE_HOURS})
          or greatest(e.host_seen_at, coalesce(e.display_seen_at, e.host_seen_at)) < now() - make_interval(mins => case when e.state in ('DRAFT', 'LOBBY_OPEN', 'LOBBY_LOCKED') then ${ABANDON_MINUTES.lobby}::int else ${ABANDON_MINUTES.live}::int end)
        )
        ${f.eventId ? sql`and e.id = ${f.eventId}` : sql``}
        ${f.userId ? sql`and (e.owner_user_id = ${f.userId} or exists (select 1 from tig_members m where m.event_id = e.id and m.user_id = ${f.userId}))` : sql``}
      order by e.last_activity_at limit ${f.limit ?? 200}
    )
    returning id`;
  for (const r of rows) {
    try {
      await sql`insert into tig_log (event_id, kind, audit, reason) values (${r.id}, 'abandoned', true, 'Nessuna regia né TV collegata da troppo tempo')`;
      const ev = await loadEvent(sql, r.id);
      if (ev) await broadcastTig(sql, await buildPublicState(sql, ev));
    } catch (e) {
      console.warn("[tig] avviso di chiusura non inviato", r.id, e instanceof Error ? e.message : e);
    }
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Esportazione CSV (solo organizzatore)
// ---------------------------------------------------------------------------
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // niente formule eseguibili nei fogli di calcolo
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function exportCsv(user: TigUser, eventId: string, kind: "classifica" | "registro"): Promise<{ filename: string; body: string }> {
  if (!UUID.test(eventId)) tigFail("NOT_FOUND", "Serata non trovata");
  const sql = getSql();
  const ev = await loadEvent(sql, eventId);
  if (!ev) tigFail("NOT_FOUND", "Serata non trovata");
  if (ev.owner_user_id !== user.userId) tigFail("FORBIDDEN", "Solo l'organizzatore può esportare i risultati");
  const config = parseConfig(ev.config);
  const date = ev.db_now.toISOString().slice(0, 10);
  if (kind === "registro") {
    const rows = await sql<{ created_at: Date; table_no: number; name: string; manche_no: number; source: string; reason: string; requested: number; applied: number; balance_after: number; idempotency_key: string }[]>`
      select l.created_at, t.table_no, t.name, l.manche_no, l.source, l.reason, l.requested, l.applied, l.balance_after, l.idempotency_key
      from tig_score_ledger l join tig_teams t on t.id = l.team_id where l.event_id = ${eventId} order by l.id`;
    const lines = [["ora", "tavolo", "squadra", "manche", "fonte", "motivo", "richiesti", "applicati", "saldo", "chiave"].join(";")];
    for (const r of rows) lines.push([r.created_at.toISOString(), r.table_no, r.name, r.manche_no, r.source, r.reason, r.requested, r.applied, r.balance_after, r.idempotency_key].map(csvCell).join(";"));
    return { filename: `tavoli-in-guerra-registro-${date}.csv`, body: "﻿" + lines.join("\n") };
  }
  const teams = await sql<TeamRow[]>`select * from tig_teams where event_id = ${eventId} and status = 'active' and approved order by table_no`;
  const ranked = computeRanks(teams.map((t) => ({ teamId: t.id, score: t.score, wins: t.wins, accuracy: accuracyOf(t), tableNo: t.table_no, tiebreakRank: t.tiebreak_rank })));
  const byId = new Map(teams.map((t) => [t.id, t]));
  const lines = [["posizione", "tavolo", "squadra", "punti", "sfide_vinte", "precisione_%", "energia_caos", "livello_mascotte", "mascotte_slot"].join(";")];
  for (const r of ranked) {
    const t = byId.get(r.teamId)!;
    lines.push([r.rank, t.table_no, t.name, t.score, t.wins, r.accuracy === null ? "" : Math.round(r.accuracy * 100), t.energy, levelFor(t.energy, thresholds(config)), t.mascot_slot ?? ""].map(csvCell).join(";"));
  }
  return { filename: `tavoli-in-guerra-classifica-${date}.csv`, body: "﻿" + lines.join("\n") };
}
