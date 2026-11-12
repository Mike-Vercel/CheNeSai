import { randomInt } from "node:crypto";
import type { Db, Tx } from "@/lib/database/db";
import { iso } from "@/lib/database/db";
import { bandOf } from "@/lib/game-engine/compose";
import {
  palminoSegmentId,
  palminoWheelEligible,
  pickWheelSegments,
  planPalminoWheels,
  PALMINO_WHEEL_LEAD_MS,
  type StoredPalminoWheel,
  type WheelPlanRound,
} from "@/lib/game-engine/palmino-wheel";
import { isCategoryRound, type PublicWheel, type RoundKind } from "@/lib/game-engine/types";
import { buildSpinPlan, WHEEL_DURATION_MS, WHEEL_LANDING, WHEEL_TURNS, type WheelSpinPlan } from "@/lib/game-engine/wheel";
import { audit } from "./audit";
import { loadCandidates, SYSTEM_ACTOR } from "./cms/compose";
import type { Actor } from "./engine";

/**
 * RUOTA DI PALMINO lato database.
 *
 * PIANO (alla pubblicazione, nella stessa transazione, a serata ancora in bozza): si scelgono le
 * domande "segnaposto" con il seme della serata (planPalminoWheels) e, per ognuna, da 6 a 8
 * categorie con UNA domanda candidata ciascuna (stesse regole del compositore: prima le mai viste
 * da questo host / mai giocate, la fascia di difficoltà del segnaposto). Le candidate entrano nel
 * round come RISERVE marcate `wheel_candidate`: la pubblicazione ne fa la copia congelata come per
 * tutte le domande, quindi dopo non serve mai inserire nulla in una serata pubblicata (il blocco
 * SESSION_FROZEN vieta INSERT e DELETE di domande e round, non gli UPDATE che usa già il motore).
 *
 * GIRO (comando MOSTRA DOMANDA quando la prossima è un segnaposto, sotto il lucchetto della
 * partita): il server estrae lo spicchio (casualità crittografica), salva il giro come la Ruota
 * impazzita (wheel_spun_at / wheel_spin del round) e SCAMBIA la candidata vincente con il
 * segnaposto (posizione e "riserva"): da lì il motore la mostra come una domanda qualunque, il
 * trigger registra la giocata in question_plays (anche per l'host) quando viene mostrata, e il
 * segnaposto torna una semplice riserva mai giocata. Idempotente: un round già girato non rigira.
 */

export interface PalminoPlanOptions {
  /** test: solo domande con questo tag (archivio isolato) */
  onlyTag?: string;
  /** partite libere: account host (prima le domande che non ha mai visto); predefinito: quello della serata */
  hostUserId?: string | null;
  /** seme del piano (predefinito: id della serata) */
  seed?: string;
  /** test: numeri di domanda in cui la ruota compare di sicuro */
  force?: number[];
  /** partite libere: almeno una ruota per partita (se c'è un posto ammesso) */
  atLeastOne?: boolean;
}

export interface PalminoPlanResult {
  slots: { roundId: string; number: number; segments: string[] }[];
}

/** Piano delle ruote di una serata ancora in bozza (chiamato dalla pubblicazione). */
export async function planPalminoWheelsTx(tx: Tx, sessionId: string, opts: PalminoPlanOptions = {}, actor: Actor = SYSTEM_ACTOR): Promise<PalminoPlanResult> {
  const [s] = await tx<{ host_user_id: string | null; status: string }[]>`select host_user_id, status from game_sessions where id = ${sessionId}`;
  if (!s || s.status !== "draft") return { slots: [] };
  // già pianificata (es. ripubblicazione dopo un annullamento non ripulito): niente doppioni
  const [{ planned }] = await tx<{ planned: boolean }[]>`
    select exists (select 1 from game_rounds where session_id = ${sessionId} and palmino_wheel is not null) as planned`;
  if (planned) return { slots: [] };
  const rounds = await tx<{ id: string; kind: RoundKind }[]>`select id, kind from game_rounds where session_id = ${sessionId} order by position`;
  const qs = await tx<{ id: string; round_id: string; vote_option_id: string | null; difficulty: number | null; question_id: string | null; position: number; media: boolean }[]>`
    select sq.id, sq.round_id, sq.vote_option_id, qb.difficulty, sq.question_id, sq.position, qb.media_id is not null as media
    from session_questions sq left join question_bank qb on qb.id = sq.question_id
    where sq.session_id = ${sessionId} and not sq.is_reserve and not sq.wheel_candidate
    order by sq.position`;
  const planRounds: WheelPlanRound[] = rounds.map((r) => {
    const mine = qs.filter((q) => q.round_id === r.id);
    if (!isCategoryRound(r.kind)) return { id: r.id, kind: r.kind, questions: mine.map((q) => ({ sqId: q.id, media: q.media })) };
    // categorie: se ne gioca una sola, si conta la più corta (numerazione prudente)
    const per = new Map<string, number>();
    for (const q of mine) if (q.vote_option_id) per.set(q.vote_option_id, (per.get(q.vote_option_id) ?? 0) + 1);
    const voted = per.size > 0 ? Math.min(...per.values()) : 0;
    // domande comuni (round a votazione della partita libera di un round): si giocano dopo quelle
    // votate; fanno da segnaposto solo quelle che vengono dopo TUTTE le domande delle materie
    const lastVoted = Math.max(-1, ...mine.filter((q) => q.vote_option_id).map((q) => q.position));
    const common = mine.filter((q) => !q.vote_option_id);
    const before = common.filter((q) => q.position < lastVoted).length;
    const after = common.filter((q) => q.position > lastVoted);
    return {
      id: r.id,
      kind: r.kind,
      questions: [...Array.from({ length: voted + before }, () => ({ sqId: "" })), ...after.map((q) => ({ sqId: q.id, media: q.media, common: true }))],
      playedCount: voted + common.length,
    };
  });
  const seed = opts.seed ?? sessionId;
  const slots = planPalminoWheels(planRounds, seed, { force: opts.force, atLeastOne: opts.atLeastOne });
  if (slots.length === 0) return { slots: [] };

  const hostUserId = opts.hostUserId === undefined ? s.host_user_id : opts.hostUserId;
  const candidates = await loadCandidates(tx, { sessionId, onlyTag: opts.onlyTag, hostUserId });
  const inSession = await tx<{ question_id: string }[]>`select question_id from session_questions where session_id = ${sessionId} and question_id is not null`;
  const exclude = new Set(inSession.map((q) => q.question_id));
  const out: PalminoPlanResult = { slots: [] };
  // almeno una ruota: se gli spicchi mancano nel posto scelto si prova negli altri posti ammessi
  const fallback = opts.atLeastOne ? palminoWheelEligible(planRounds).filter((e) => !slots.some((x) => x.sqId === e.sqId)) : [];
  const queue = [...slots];
  while (queue.length > 0) {
    const slot = queue.shift()!;
    const q = qs.find((x) => x.id === slot.sqId);
    const segs = pickWheelSegments({ candidates, band: bandOf(q?.difficulty ?? 3), seed: `${seed}|${slot.number}`, excludeIds: exclude });
    if (segs.length === 0) {
      // archivio troppo piccolo: niente ruota qui (partita libera: si prova un altro posto)
      if (out.slots.length === 0 && queue.length === 0 && fallback.length > 0) queue.push(fallback.shift()!);
      continue;
    }
    const [{ pos }] = await tx<{ pos: number }[]>`select coalesce(max(position) + 1, 0)::int as pos from session_questions where round_id = ${slot.roundId}`;
    const [{ slot_position }] = await tx<{ slot_position: number }[]>`select position as slot_position from session_questions where id = ${slot.sqId}`;
    const segments: StoredPalminoWheel["segments"] = [];
    for (let i = 0; i < segs.length; i++) {
      const [row] = await tx<{ id: string }[]>`
        insert into session_questions (session_id, round_id, position, question_id, is_reserve, wheel_candidate)
        values (${sessionId}, ${slot.roundId}, ${pos + i}, ${segs[i].questionId}, true, true)
        returning id`;
      segments.push({ sqId: row.id, position: pos + i, label: segs[i].label });
      exclude.add(segs[i].questionId);
    }
    const plan: StoredPalminoWheel = { slotSqId: slot.sqId, slotPosition: slot_position, number: slot.number, segments };
    await tx`update game_rounds set palmino_wheel = ${tx.json(JSON.parse(JSON.stringify(plan)))} where id = ${slot.roundId}`;
    out.slots.push({ roundId: slot.roundId, number: slot.number, segments: segs.map((x) => x.label) });
  }
  if (out.slots.length > 0) {
    await audit(tx, actor, "session.palmino_wheel_plan", { sessionId, type: "session", id: sessionId, details: { seed, slots: out.slots } });
  }
  return out;
}

/** Annullamento della pubblicazione (serata tornata in bozza): via candidate e piani. */
export async function clearPalminoWheelsTx(tx: Tx, sessionId: string): Promise<void> {
  await tx`delete from session_questions where session_id = ${sessionId} and wheel_candidate`;
  await tx`update game_rounds set palmino_wheel = null where session_id = ${sessionId} and palmino_wheel is not null`;
}

export interface PalminoSpin {
  roundId: string;
  winnerIndex: number;
  label: string;
  winnerSqId: string;
  plan: WheelSpinPlan;
  segments: string[];
}

/**
 * Se `nextSqId` è il segnaposto della ruota del round (non ancora girata) gira la ruota e scambia
 * le domande. Da chiamare SOLO dentro il comando (lucchetto della partita già preso).
 * null = nessuna ruota qui (o candidate non più valide: si gioca la domanda prevista).
 */
export async function spinPalminoWheelTx(tx: Tx, roundId: string, nextSqId: string): Promise<PalminoSpin | null> {
  const [r] = await tx<{ palmino_wheel: StoredPalminoWheel | null; wheel_spun_at: Date | null }[]>`
    select palmino_wheel, wheel_spun_at from game_rounds where id = ${roundId}`;
  const stored = r?.palmino_wheel;
  if (!stored || r.wheel_spun_at || stored.winnerSqId || stored.slotSqId !== nextSqId) return null;
  const ids = stored.segments.map((x) => x.sqId);
  const rows = await tx<{ id: string; position: number; ok: boolean }[]>`
    select id, position, (is_reserve and shown_at is null and options_opened_at is null) as ok
    from session_questions where id = any(${tx.array(ids)}::uuid[]) and round_id = ${roundId}`;
  const valid = stored.segments.filter((x) => rows.some((row) => row.id === x.sqId && row.ok));
  if (valid.length < 2) return null;
  const [slot] = await tx<{ position: number; ok: boolean }[]>`
    select position, (not is_reserve and shown_at is null and options_opened_at is null) as ok from session_questions where id = ${stored.slotSqId}`;
  if (!slot?.ok) return null;

  // estrazione con casualità crittografica: decide il server, gli schermi disegnano soltanto
  const winnerIndex = randomInt(0, valid.length);
  const plan = buildSpinPlan(valid.length, winnerIndex, {
    turns: randomInt(WHEEL_TURNS.min, WHEEL_TURNS.max + 1),
    landing: WHEEL_LANDING.min + (randomInt(0, 1001) / 1000) * (WHEEL_LANDING.max - WHEEL_LANDING.min),
    durationMs: randomInt(WHEEL_DURATION_MS.min, WHEEL_DURATION_MS.max + 1),
  });
  const winner = valid[winnerIndex];
  const winnerPos = rows.find((row) => row.id === winner.sqId)!.position;
  // scambio: la vincente prende posto e ruolo del segnaposto (vincolo di posizione differito alla fine)
  await tx`update session_questions set is_reserve = false, position = ${slot.position} where id = ${winner.sqId}`;
  await tx`update session_questions set is_reserve = true, position = ${winnerPos} where id = ${stored.slotSqId}`;
  // eventi programmati (o appena annunciati) sul segnaposto: valgono per la domanda che lo sostituisce
  await tx`
    update special_events set target_session_question_id = ${winner.sqId}
    where target_session_question_id = ${stored.slotSqId} and status in ('scheduled', 'announced')`;
  const next: StoredPalminoWheel = {
    ...stored,
    segments: valid.map((x) => ({ ...x, position: x.sqId === winner.sqId ? winnerPos : (rows.find((row) => row.id === x.sqId)?.position ?? x.position) })),
    winnerSqId: winner.sqId,
  };
  const spin = { ...plan, winnerOptionId: palminoSegmentId(winnerIndex), optionIds: valid.map((_, i) => palminoSegmentId(i)) };
  await tx`
    update game_rounds set wheel_spun_at = clock_timestamp() + make_interval(secs => ${PALMINO_WHEEL_LEAD_MS / 1000}::float8),
      wheel_spin = ${tx.json(spin)}, palmino_wheel = ${tx.json(JSON.parse(JSON.stringify(next)))}
    where id = ${roundId}`;
  return { roundId, winnerIndex, label: winner.label, winnerSqId: winner.sqId, plan, segments: valid.map((x) => x.label) };
}

/** Prova generale azzerata: le domande scambiate tornano al loro posto (il giro lo azzera il chiamante). */
export async function resetPalminoWheelsTx(tx: Tx, sessionId: string): Promise<void> {
  const rounds = await tx<{ id: string; palmino_wheel: StoredPalminoWheel }[]>`
    select id, palmino_wheel from game_rounds where session_id = ${sessionId} and palmino_wheel ? 'winnerSqId'`;
  for (const r of rounds) {
    const p = r.palmino_wheel;
    const win = p.segments.find((x) => x.sqId === p.winnerSqId);
    if (p.winnerSqId && win) {
      await tx`update session_questions set is_reserve = true, position = ${win.position} where id = ${p.winnerSqId}`;
      await tx`update session_questions set is_reserve = false, position = ${p.slotPosition} where id = ${p.slotSqId}`;
      await tx`
        update special_events set target_session_question_id = ${p.slotSqId}
        where target_session_question_id = ${p.winnerSqId} and source = 'scheduled'`;
    }
    const { winnerSqId: _w, ...rest } = p;
    void _w;
    await tx`update game_rounds set palmino_wheel = ${tx.json(JSON.parse(JSON.stringify(rest)))} where id = ${r.id}`;
  }
}

/** La prossima domanda è il segnaposto di una ruota ancora da girare? (per la regia) */
export async function palminoWheelPending(db: Db, roundId: string | null, sqId: string | null): Promise<boolean> {
  if (!roundId || !sqId) return false;
  const [r] = await db<{ pending: boolean }[]>`
    select (palmino_wheel->>'slotSqId' = ${sqId} and wheel_spun_at is null) as pending from game_rounds where id = ${roundId}`;
  return !!r?.pending;
}

interface StoredSpin {
  turns: number;
  landing: number;
  rotationDeg: number;
  durationMs: number;
  winnerIndex: number;
  winnerOptionId: string;
}

/** Ruota di Palmino del round per lo stato pubblico (solo dopo il giro: mai le candidate). */
export async function loadPublicPalminoWheel(db: Db, roundId: string, pausedAt: Date | null, questionNumber: number): Promise<PublicWheel | null> {
  const [r] = await db<{ palmino_wheel: StoredPalminoWheel | null; wheel_spun_at: Date | null; wheel_spin: StoredSpin | null; frozen_ms: number | null }[]>`
    select palmino_wheel, wheel_spun_at, wheel_spin,
      case when ${pausedAt}::timestamptz is not null and wheel_spun_at is not null
        then greatest(0, floor(extract(epoch from (${pausedAt}::timestamptz - wheel_spun_at)) * 1000))::int end as frozen_ms
    from game_rounds where id = ${roundId}`;
  const p = r?.wheel_spin;
  if (!r?.palmino_wheel?.winnerSqId || !r.wheel_spun_at || !p) return null;
  return {
    roundId,
    kind: "palmino",
    questionNumber,
    segments: r.palmino_wheel.segments.map((x, i) => ({ id: palminoSegmentId(i), position: i, label: x.label })),
    spin: {
      startedAt: iso(r.wheel_spun_at)!,
      durationMs: p.durationMs,
      turns: p.turns,
      landing: p.landing,
      rotationDeg: p.rotationDeg,
      winnerIndex: p.winnerIndex,
      winnerOptionId: p.winnerOptionId,
      frozenElapsedMs: r.frozen_ms === null ? null : Math.min(r.frozen_ms, p.durationMs),
    },
  };
}

/** Etichette degli spicchi delle ruote pianificate (per preparare le voci "Tocca a… X!"). */
export async function palminoWheelLabels(db: Db, sessionId: string): Promise<string[]> {
  const rows = await db<{ palmino_wheel: StoredPalminoWheel }[]>`
    select palmino_wheel from game_rounds where session_id = ${sessionId} and palmino_wheel is not null`;
  return [...new Set(rows.flatMap((r) => r.palmino_wheel.segments.map((x) => x.label)))];
}
