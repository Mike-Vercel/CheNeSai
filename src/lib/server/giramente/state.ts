import "server-only";
import { iso, type Db } from "@/lib/database/db";
import {
  canRevealLetter,
  collegamentoPoints,
  computeStandings,
  estimateMinutes,
  finalePoints,
  maskBoard,
  STANDARD_WHEEL,
  FINALE_WHEEL,
  tabellonePoints,
  wheelStake,
} from "@/lib/giramente/rules";
import {
  DEFAULT_SETTINGS,
  roundInfo,
  settingsSchema,
  type DeviceMode,
  type GameMode,
  type GiramenteEvent,
  type JollyPower,
  type Phase,
  type PrivatePlay,
  type PrivateView,
  type PublicQuestion,
  type PublicReveal,
  type PublicStage,
  type PublicState,
  type PublicTimer,
  type PublicTurn,
  type PuzzleKind,
  type PuzzlePool,
  type Risk,
  type Settings,
  type Stage,
  type TurnResult,
  type WheelKind,
} from "@/lib/giramente/types";

/**
 * Costruzione dello stato di una partita GIRAMENTE!.
 *
 *  - `buildPublicStateFrom`: quello che vedono TUTTI (telefoni, TV, canale realtime). Nessuna
 *    soluzione prima del risultato; nelle prove contemporanee nessun esito prima della rivelazione;
 *    le prove a turno del dispositivo condiviso non compaiono affatto (solo «X sta giocando»).
 *  - `buildPrivateView`: le prove del PROPRIO concorrente (mai quelle degli altri), sempre senza soluzione.
 *
 * Dentro una transazione si passa SEMPRE la transazione (mai il pool).
 */

/** In linea se si è fatto sentire negli ultimi 40 s (i client interrogano ogni ~10 s). */
export const ONLINE_MS = 40_000;
const DISPLAY_ONLINE_MS = 30_000;

export interface RoomRow {
  id: string;
  code: string;
  display_key: string;
  devices: DeviceMode;
  mode: GameMode;
  owner_user_id: string;
  host_user_id: string | null;
  status: "open" | "closed";
  phase: Phase;
  version: number;
  secret_rev: number;
  settings: unknown;
  round_no: number;
  stage: Stage | null;
  tiebreak_no: number;
  tiebreak_ids: string[];
  turn_order: string[];
  turn_index: number;
  current_play_id: string | null;
  phase_started_at: Date | null;
  phase_deadline_at: Date | null;
  phase_total_ms: number | null;
  paused_at: Date | null;
  paused_ms: number;
  event: GiramenteEvent | null;
  result: TurnResult | null;
  reveal: PublicReveal | null;
  winners: string[];
  host_seen_at: Date;
  display_seen_at: Date | null;
  broadcast_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  last_activity_at: Date;
  db_now: Date;
}

export interface CompetitorRow {
  id: string;
  kind: "player" | "team";
  name: string;
  seat: number;
  score: number;
  jolly: JollyPower | null;
  active: boolean;
}

export interface ParticipantRow {
  id: string;
  kind: "account" | "local";
  user_id: string | null;
  owner_user_id: string | null;
  nickname: string;
  seat: number;
  status: "active" | "left" | "kicked";
  competitor_id: string | null;
  captain: boolean;
  last_seen_at: Date;
}

export interface PlayAids {
  /** OCCHIO FURBO usato su questa giocata */
  occhio?: boolean;
  /** indizi sbloccati (finale, spareggio) */
  clueLevel?: number;
  /** collegamento: quarto indizio mostrato */
  extra?: boolean;
  /** tabellone: lettere svelate con l'aiuto, indizio a pagamento, indizio gratis (Occhio Furbo) */
  letters?: string[];
  lastLetter?: string | null;
  hints?: number;
  freeHint?: boolean;
}

export interface PlayRow {
  id: string;
  room_id: string;
  round_no: number;
  stage: Stage;
  series: number;
  turn_no: number;
  competitor_id: string;
  puzzle_id: string | null;
  puzzle_kind: PuzzleKind | null;
  risk: Risk | null;
  sector: WheelKind | null;
  bonus: boolean;
  lampo: boolean;
  jolly_offer: boolean;
  jolly_duplicate: boolean;
  jolly_chosen: JollyPower | null;
  colpo_offered: boolean;
  colpo_accepted: boolean | null;
  status: "pending" | "open" | "answered" | "timeout";
  started_at: Date | null;
  deadline_at: Date | null;
  total_ms: number | null;
  answered_at: Date | null;
  request_id: string | null;
  answer: { choice?: number | null; falseIndex?: number | null; text?: string | null } | null;
  correct: boolean | null;
  points: number;
  applied: boolean;
  aids: PlayAids;
  board: { initial: string[] } | null;
  result: unknown;
}

export interface PuzzleRow {
  id: string;
  slug: string;
  pool: PuzzlePool;
  kind: PuzzleKind | null;
  category: string;
  difficulty: string;
  prompt: string;
  clues: string[];
  options: string[] | null;
  answer_index: number | null;
  solution: string;
  accepted: string[];
  extra_clue: string | null;
  false_index: number | null;
  visual: string | null;
  image_url: string | null;
  image_alt: string | null;
  explanation: string | null;
  time_limit_sec: number | null;
}

export interface SpinRow {
  id: string;
  play_id: string;
  target_index: number;
  sector: WheelKind;
  segments: string[];
  started_at: Date;
  duration_ms: number;
}

export function parseSettings(raw: unknown): Settings {
  const r = settingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : DEFAULT_SETTINGS;
}

export async function loadRoom(db: Db, roomId: string, forUpdate = false): Promise<RoomRow | null> {
  const [r] = forUpdate
    ? await db<RoomRow[]>`select r.*, now() as db_now from giramente_rooms r where r.id = ${roomId} for update`
    : await db<RoomRow[]>`select r.*, now() as db_now from giramente_rooms r where r.id = ${roomId}`;
  return r ?? null;
}

export async function loadCompetitors(db: Db, roomId: string): Promise<CompetitorRow[]> {
  return db<CompetitorRow[]>`select id, kind, name, seat, score, jolly, active from giramente_competitors where room_id = ${roomId} and active order by seat`;
}

export async function loadParticipants(db: Db, roomId: string): Promise<ParticipantRow[]> {
  return db<ParticipantRow[]>`
    select id, kind, user_id, owner_user_id, nickname, seat, status, competitor_id, captain, last_seen_at
    from giramente_participants where room_id = ${roomId} and status = 'active' order by seat`;
}

export async function loadPlay(db: Db, playId: string | null): Promise<PlayRow | null> {
  if (!playId) return null;
  const [p] = await db<PlayRow[]>`select * from giramente_plays where id = ${playId}`;
  return p ?? null;
}

/** Giocate della prova in corso (manche, prova, serie di spareggio). */
export async function loadStagePlays(db: Db, room: Pick<RoomRow, "id" | "round_no" | "stage" | "tiebreak_no">): Promise<PlayRow[]> {
  if (!room.stage) return [];
  return db<PlayRow[]>`
    select * from giramente_plays
    where room_id = ${room.id} and round_no = ${room.round_no} and stage = ${room.stage} and series = ${room.stage === "tiebreak" ? room.tiebreak_no : 0}
    order by turn_no, created_at`;
}

export async function loadPuzzles(db: Db, ids: (string | null)[]): Promise<Map<string, PuzzleRow>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map();
  const rows = await db<PuzzleRow[]>`select * from giramente_puzzles where id = any(${db.array(list)}::uuid[])`;
  return new Map(rows.map((r) => [r.id, r]));
}

export async function loadSpin(db: Db, playId: string | null): Promise<SpinRow | null> {
  if (!playId) return null;
  const [s] = await db<SpinRow[]>`select id, play_id, target_index, sector, segments, started_at, duration_ms from giramente_spins where play_id = ${playId}`;
  return s ?? null;
}

export function timerOf(start: Date | null, deadline: Date | null, total: number | null): PublicTimer {
  return { startedAt: iso(start), deadlineAt: iso(deadline), totalMs: total };
}

const isWheelStage = (s: Stage | null) => s === "wheel" || s === "finale";
export const wheelFor = (roundNo: number): WheelKind[] => (roundNo === 5 ? FINALE_WHEEL : STANDARD_WHEEL);

/** Enigma pubblico di una giocata alla ruota (o del finale): MAI soluzione, opzione giusta o varianti. */
export function publicQuestion(play: PlayRow, puzzle: PuzzleRow): PublicQuestion {
  const finale = puzzle.pool === "finale";
  const level = Math.min(3, Math.max(1, play.aids.clueLevel ?? 1));
  return {
    playId: play.id,
    pool: puzzle.pool,
    kind: puzzle.kind,
    category: puzzle.category,
    prompt: puzzle.prompt,
    clues: finale ? puzzle.clues.slice(0, level) : puzzle.clues,
    visual: puzzle.visual,
    imageUrl: puzzle.image_url,
    imageAlt: puzzle.image_alt,
    options: finale ? null : puzzle.options,
    clueLevel: finale ? level : 0,
    clueCount: finale ? puzzle.clues.length : 0,
    extraClue: play.aids.occhio && puzzle.extra_clue ? puzzle.extra_clue : null,
    pointsAtStake: finale ? finalePoints(level) : wheelStake(play.round_no, play.risk, play.bonus, play.lampo),
    timer: timerOf(play.started_at, play.deadline_at, play.total_ms),
  };
}

/** La prova privata di un concorrente (Falsa Pista, Collegamento, Tabellone, Spareggio): senza soluzione. */
export function privatePlay(play: PlayRow, puzzle: PuzzleRow | undefined): PrivatePlay {
  const base: PrivatePlay = {
    playId: play.id,
    stage: play.stage,
    pool: puzzle?.pool ?? "ruota",
    turnNo: play.turn_no,
    status: play.status === "pending" ? "open" : play.status,
    prompt: null,
    clues: [],
    words: [],
    visual: null,
    clueLevel: 0,
    clueCount: 0,
    extraClue: null,
    extraUsed: false,
    board: null,
    pointsAtStake: 0,
    given: play.answer ? { falseIndex: play.answer.falseIndex ?? null, text: play.answer.text ?? null } : null,
    timer: timerOf(play.started_at, play.deadline_at, play.total_ms),
  };
  if (!puzzle) return base;
  const a = play.aids ?? {};
  switch (play.stage) {
    case "falsa":
      return { ...base, prompt: puzzle.prompt, clues: puzzle.clues, pointsAtStake: 200 };
    case "collegamento":
      return {
        ...base,
        prompt: puzzle.prompt,
        words: puzzle.clues,
        extraClue: a.extra ? puzzle.extra_clue : null,
        extraUsed: !!a.extra && !a.occhio,
        pointsAtStake: collegamentoPoints(!!a.extra && !a.occhio),
      };
    case "tabellone": {
      const revealed = [...(play.board?.initial ?? []), ...(a.letters ?? [])];
      return {
        ...base,
        prompt: "Indovina la frase nascosta",
        board: {
          category: puzzle.category,
          rows: maskBoard(puzzle.solution, revealed, a.lastLetter ? [a.lastLetter] : []),
          hint: a.hints || a.freeHint ? puzzle.extra_clue : null,
          lettersUsed: a.letters?.length ?? 0,
          hintsUsed: a.hints ?? 0,
          canReveal: canRevealLetter(puzzle.solution, revealed, a.letters?.length ?? 0),
        },
        pointsAtStake: tabellonePoints(a.letters?.length ?? 0, a.hints ?? 0),
      };
    }
    case "tiebreak": {
      const level = Math.min(3, Math.max(1, a.clueLevel ?? 1));
      return { ...base, prompt: puzzle.prompt, visual: puzzle.visual, clues: puzzle.clues.slice(0, level), clueLevel: level, clueCount: puzzle.clues.length, pointsAtStake: finalePoints(level) };
    }
    default:
      return base;
  }
}

export async function buildPublicStateFrom(db: Db, room: RoomRow): Promise<PublicState> {
  const nowMs = room.db_now.getTime();
  const settings = parseSettings(room.settings);
  const [competitors, participants] = await Promise.all([loadCompetitors(db, room.id), loadParticipants(db, room.id)]);
  const playing = room.phase !== "LOBBY";
  const online = (p: ParticipantRow) => p.kind === "local" || nowMs - p.last_seen_at.getTime() < ONLINE_MS;

  // ---------------- turno alla ruota (manche 1, 3, 5)
  let turn: PublicTurn | null = null;
  let question: PublicQuestion | null = null;
  let spin: PublicState["wheel"]["spin"] = null;
  let restIndex: number | null = null;
  const current = isWheelStage(room.stage) ? await loadPlay(db, room.current_play_id) : null;
  if (current && ["CHOICE", "SPIN", "SPINNING", "WHEEL_RESULT", "QUESTION", "TURN_RESULT"].includes(room.phase)) {
    const s = await loadSpin(db, current.id);
    if (s) {
      spin = { spinId: s.id, targetIndex: s.target_index, startedAt: s.started_at.toISOString(), durationMs: s.duration_ms };
      if (room.phase !== "SPINNING") restIndex = s.target_index;
    }
    turn = {
      competitorId: current.competitor_id,
      playId: current.id,
      no: room.turn_index + 1,
      of: room.turn_order.length,
      risk: current.risk,
      // lo spicchio si scopre quando la ruota si ferma (chi guarda la ruota lo vede comunque arrivare)
      sector: room.phase === "SPINNING" ? null : current.sector,
      jolly: current.sector === "jolly" && room.phase !== "SPINNING" ? { offer: current.jolly_offer, duplicate: current.jolly_duplicate, chosen: current.jolly_chosen } : null,
      colpo: current.colpo_offered ? { offered: true, accepted: current.colpo_accepted } : null,
      bonus: current.bonus,
      lampo: current.lampo,
    };
    if ((room.phase === "QUESTION" || room.phase === "TURN_RESULT") && current.puzzle_id) {
      const pz = (await loadPuzzles(db, [current.puzzle_id])).get(current.puzzle_id);
      if (pz) question = publicQuestion(current, pz);
    }
  }

  // ---------------- prove contemporanee / a turno (manche 2, 4, spareggio)
  let stagePlay: PublicStage | null = null;
  const doneIds = new Set<string>();
  if (!isWheelStage(room.stage) && room.stage && ["TURN_READY", "PLAY"].includes(room.phase)) {
    const plays = await loadStagePlays(db, room);
    const byComp = new Map<string, PlayRow[]>();
    for (const p of plays) byComp.set(p.competitor_id, [...(byComp.get(p.competitor_id) ?? []), p]);
    for (const [cid, list] of byComp) if (list.length && list.every((p) => p.status === "answered" || p.status === "timeout")) doneIds.add(cid);
    const simultaneous = room.devices === "personal";
    const inStage = room.stage === "tiebreak" ? room.tiebreak_ids : competitors.map((c) => c.id);
    let common: PublicStage["common"] = null;
    if (simultaneous) {
      const first = byComp.get(inStage[0] ?? "") ?? plays;
      const pz = await loadPuzzles(db, first.map((p) => p.puzzle_id));
      const ordered = [...first].sort((a, b) => a.turn_no - b.turn_no);
      if (room.stage === "falsa") common = { falsa: ordered.map((p) => ({ clues: pz.get(p.puzzle_id ?? "")?.clues ?? [] })) };
      if (room.stage === "collegamento" && ordered[0]) common = { collegamento: { words: pz.get(ordered[0].puzzle_id ?? "")?.clues ?? [] } };
      if (room.stage === "tabellone" && ordered[0]) {
        const p = pz.get(ordered[0].puzzle_id ?? "");
        if (p) common = { tabellone: { category: p.category, rows: maskBoard(p.solution, ordered[0].board?.initial ?? []) } };
      }
      if (room.stage === "tiebreak" && ordered[0]) {
        const p = pz.get(ordered[0].puzzle_id ?? "");
        if (p) common = { tiebreak: { prompt: p.prompt, visual: p.visual, firstClue: p.clues[0] ?? "" } };
      }
    }
    const turnPlay = simultaneous ? plays[0] : plays.find((p) => p.competitor_id === room.turn_order[room.turn_index]);
    stagePlay = {
      stage: room.stage,
      simultaneous,
      timer: room.phase === "PLAY" && turnPlay ? timerOf(turnPlay.started_at, turnPlay.deadline_at, turnPlay.total_ms) : { startedAt: null, deadlineAt: null, totalMs: null },
      competitorId: simultaneous ? null : (room.turn_order[room.turn_index] ?? null),
      turnNo: simultaneous ? 0 : room.turn_index + 1,
      turnOf: simultaneous ? 0 : room.turn_order.length,
      common,
      competitors: inStage,
    };
    if (!simultaneous) for (let i = 0; i < room.turn_index; i++) doneIds.add(room.turn_order[i]);
  }

  const info = roundInfo(room.round_no);
  const est = estimateMinutes(room.mode === "teams" ? Math.max(2, competitors.length) : Math.max(2, competitors.length), room.devices, room.mode, settings);
  return {
    roomId: room.id,
    code: room.code,
    devices: room.devices,
    mode: room.mode,
    status: room.status,
    phase: room.phase,
    version: Number(room.version),
    secretRev: room.secret_rev,
    serverNow: room.db_now.toISOString(),
    settings,
    roundNo: room.round_no,
    roundName: room.stage === "tiebreak" ? "SPAREGGIO" : (info?.name ?? null),
    stage: playing ? room.stage : null,
    tiebreakNo: room.tiebreak_no,
    phaseTimer: timerOf(room.phase_started_at, room.phase_deadline_at, room.phase_total_ms),
    pausedAt: iso(room.paused_at),
    hostOnline: nowMs - room.host_seen_at.getTime() < ONLINE_MS,
    displayOnline: !!room.display_seen_at && nowMs - room.display_seen_at.getTime() < DISPLAY_ONLINE_MS,
    competitors: competitors.map((c) => {
      const members = participants.filter((p) => p.competitor_id === c.id);
      return {
        id: c.id,
        kind: c.kind,
        name: c.name,
        seat: c.seat,
        score: c.score,
        jolly: c.jolly,
        members: members.map((m) => ({ id: m.id, nickname: m.nickname, captain: m.captain, online: online(m) })),
        online: room.devices === "shared" || members.some(online),
        done: doneIds.has(c.id),
      };
    }),
    participants: participants.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      kind: p.kind,
      competitorId: p.competitor_id,
      captain: p.captain,
      online: online(p),
      isHost: room.devices === "personal" && !!p.user_id && p.user_id === room.host_user_id,
    })),
    standings: computeStandings(competitors),
    wheel: { finale: room.round_no === 5, spin, restIndex },
    turn,
    question,
    result: room.phase === "TURN_RESULT" ? room.result : null,
    stagePlay,
    reveal: room.phase === "REVEAL" ? room.reveal : null,
    winners: room.winners ?? [],
    event: room.event,
    estimate: est,
  };
}

export async function buildPublicState(db: Db, roomId: string): Promise<PublicState | null> {
  const room = await loadRoom(db, roomId);
  return room ? buildPublicStateFrom(db, room) : null;
}

/** Chi può agire per un concorrente: il giocatore, il capitano della squadra o il proprietario del dispositivo condiviso. */
export function actsFor(room: Pick<RoomRow, "devices" | "mode" | "owner_user_id">, userId: string, participant: ParticipantRow | null, competitorId: string): boolean {
  if (room.devices === "shared") return room.owner_user_id === userId;
  if (!participant || participant.competitor_id !== competitorId) return false;
  return room.mode === "individual" || participant.captain;
}

export async function buildPrivateView(db: Db, room: RoomRow, participant: ParticipantRow | null, flags: { userId: string; isHost: boolean; isOwner: boolean }): Promise<PrivateView> {
  const competitorId = room.devices === "shared" ? null : (participant?.competitor_id ?? null);
  const view: PrivateView = {
    me: participant ? { participantId: participant.id, nickname: participant.nickname, kind: participant.kind } : null,
    isHost: flags.isHost,
    isOwner: flags.isOwner,
    competitorId,
    captain: !!participant?.captain,
    canAct: false,
    plays: [],
  };
  if (room.status !== "open") return view;
  // turno alla ruota
  if (isWheelStage(room.stage) && room.current_play_id && ["CHOICE", "SPIN", "WHEEL_RESULT", "QUESTION"].includes(room.phase)) {
    const turnComp = room.turn_order[room.turn_index];
    view.canAct = !!turnComp && actsFor(room, flags.userId, participant, turnComp);
  }
  // prove private (le proprie, o quelle di chi ha il telefono condiviso in mano)
  if (room.phase === "PLAY" && room.stage && !isWheelStage(room.stage)) {
    const plays = await loadStagePlays(db, room);
    const target = room.devices === "shared" ? (flags.isOwner ? room.turn_order[room.turn_index] : null) : competitorId;
    const mine = plays.filter((p) => p.competitor_id === target);
    const puzzles = await loadPuzzles(db, mine.map((p) => p.puzzle_id));
    view.plays = mine.map((p) => privatePlay(p, puzzles.get(p.puzzle_id ?? "")));
    view.canAct = !!target && actsFor(room, flags.userId, participant, target);
  }
  return view;
}
