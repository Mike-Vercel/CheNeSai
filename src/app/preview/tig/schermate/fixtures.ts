import type { ScoreOutput } from "@/lib/tig/games/contract";
import { runOfShow, teamColor } from "@/lib/tig/rules";
import { MANCHE_TAGLINES, MANCHE_TITLES, type JoinPreview, type LobbyTable, type PlayerView, type PublicTeam, type RegiaTable, type RegiaView, type TigPublicState } from "@/lib/tig/types";

/**
 * Stati FINTI per il banco di prova delle schermate di TAVERNA DEI PIRATI (TV, telefono, regia, ingresso):
 * niente database, niente server di gioco. Servono solo a guardare l'aspetto grafico.
 */

const NAMES = ["Le Volpi", "I Lupi", "Gli Orsi", "Le Sirene Stonate", "I Pescecani", "La Ciurma del Molo", "I Bucanieri del Martedì", "Gli Abbordatori", "I Mozzi Stanchi", "Le Polene", "I Corsari del Bancone", "Le Ancore Allegre"];

export function teams(n: number): PublicTeam[] {
  return Array.from({ length: n }, (_, i) => ({
    teamId: `t${i + 1}`,
    tableNo: i + 1,
    name: NAMES[i % NAMES.length],
    approved: true,
    color: teamColor(i + 1),
    mascotSlot: i + 1,
    mascotLevel: ((i % 3) + 1) as 1 | 2 | 3,
    score: 940 - i * 65,
    rank: i + 1,
    delta: i === 0 ? 100 : i === 2 ? -20 : i === 4 ? 60 : null,
    energy: 40 + i * 9,
    chaosProgress: ((i * 37) % 100) / 100,
    online: true,
    members: 2 + (i % 3),
    shield: i === 1,
    caosUsed: i === 3,
    wins: 3 - (i % 3),
  }));
}

const iso = (t: number) => new Date(t).toISOString();

export function baseState(now: number, n: number): TigPublicState {
  return {
    eventId: "anteprima",
    version: 1,
    secretRev: 0,
    serverNow: iso(now),
    status: "open",
    closeReason: null,
    state: "LOBBY_OPEN",
    pausedFrom: null,
    venue: "Taverna del Molo",
    accessMode: "qr",
    lateJoin: false,
    manche: null,
    timer: null,
    teams: teams(n),
    pendingTeams: 0,
    game: null,
    spotlight: null,
    caosWindow: false,
    hideScores: false,
    awards: null,
    event: null,
    plan: [1, 2, 3, 4, 5].map((m) => ({ mancheNo: m, title: MANCHE_TITLES[m], games: m === 5 ? 3 : 4, minutes: m === 5 ? 17 : 22, played: 0 })),
    breakEndsAt: null,
    chaosThresholds: { level2: 60, level3: 150 },
  };
}

const manche = (no: number, gameIndex = 0) => ({ no, title: MANCHE_TITLES[no], tagline: MANCHE_TAGLINES[no], gameIndex, gamesTotal: no === 5 ? 3 : 4 });
const timer = (now: number, leftMs: number, totalMs: number) => ({ startedAt: iso(now - (totalMs - leftMs)), deadlineAt: iso(now + leftMs), totalMs });

function game(now: number, over: Partial<NonNullable<TigPublicState["game"]>> = {}): NonNullable<TigPublicState["game"]> {
  return {
    id: "g1",
    code: "prevedi-la-maggioranza",
    title: "Prevedi la maggioranza",
    rule: "Ogni tavolo vota una volta e prevede cosa sceglierà la maggioranza del locale. Previsione giusta: 100 punti.",
    input: "pub",
    kind: "regular",
    mancheNo: 3,
    slotNo: 2,
    participants: ["t1", "t2", "t3", "t4", "t5", "t6"],
    startsAt: iso(now + 8000),
    deadlineAt: iso(now + 68000),
    timerMs: 60000,
    stage: "rule",
    view: null,
    submittedTeamIds: [],
    reveal: null,
    outcome: null,
    winnerTeamId: null,
    betEnabled: false,
    ...over,
  };
}

const duelOutcome: ScoreOutput = {
  outcomes: [
    { teamId: "t1", points: 50, chaos: 3, correct: true, accuracy: 1, label: "Duello vinto: 3 su 3" },
    { teamId: "t2", points: 0, chaos: 1, correct: false, accuracy: 0.66, label: "2 su 3, più lenti" },
  ],
};

/** Schermate della TV. */
export function tvScreen(s: string, now: number, n: number): { state: TigPublicState; lobby: LobbyTable[] | null; live: boolean } {
  const st = baseState(now, n);
  const lobby: LobbyTable[] = st.teams.map((t, i) => ({ tableNo: t.tableNo, token: `token-${t.tableNo}`, code: `K7Q${String(10 + i).padStart(3, "0")}`, teamName: i < n - 2 ? t.name : null, members: i < n - 1 ? 2 : 0, approved: i < n - 3 }));
  switch (s) {
    case "lobby":
      return { state: st, lobby, live: false };
    case "lobby-live":
      return { state: st, lobby: null, live: true };
    case "intro":
      return { state: { ...st, state: "INTRO", timer: timer(now, 38000, 60000) }, lobby: null, live: false };
    case "manche":
      return { state: { ...st, state: "ROUND_INTRO", manche: manche(2), timer: timer(now, 9000, 15000) }, lobby: null, live: false };
    case "regola":
      return { state: { ...st, state: "GAME_ACTIVE", manche: manche(3, 2), game: game(now) }, lobby: null, live: false };
    case "regola-puntata":
      return { state: { ...st, state: "GAME_ACTIVE", manche: manche(5, 3), game: game(now, { title: "L'ultima decisione", rule: "Ultimo enigma della serata: puntate fino al 25% del saldo prima di rispondere.", betEnabled: true, mancheNo: 5, slotNo: 3 }) }, lobby: null, live: false };
    // il duello usa un codice senza schermata di minigioco: qui conta solo l'involucro dell'app
    case "caos":
      return { state: { ...st, state: "GAME_ACTIVE", manche: manche(2, 1), spotlight: { kind: "chaos", teamIds: ["t1", "t2"], eventId: "e1" }, game: game(now, { code: "anteprima-duello", kind: "caos", title: "Duello del Caos", participants: ["t1", "t2"], mancheNo: 2 }) }, lobby: null, live: false };
    case "duello":
      return { state: { ...st, state: "GAME_RESULTS", manche: manche(2, 1), game: game(now, { code: "anteprima-duello", kind: "caos", title: "Duello del Caos", participants: ["t1", "t2"], stage: "reveal", winnerTeamId: "t1", outcome: duelOutcome, mancheNo: 2 }) }, lobby: null, live: false };
    case "evoluzione":
      return { state: { ...st, state: "GAME_RESULTS", manche: manche(2, 2), spotlight: { kind: "evolve", teamIds: ["t3"], eventId: "e2", level: 2 }, game: game(now, { stage: "reveal" }) }, lobby: null, live: false };
    case "classifica":
      return { state: { ...st, state: "LEADERBOARD", manche: manche(2, 2), caosWindow: true }, lobby: null, live: false };
    case "classifica-buia":
      return { state: { ...st, state: "LEADERBOARD", manche: manche(5, 1), hideScores: true, teams: st.teams.map((t) => ({ ...t, score: null, rank: null })) }, lobby: null, live: false };
    case "pausa":
      return { state: { ...st, state: "PAUSED", pausedFrom: "LEADERBOARD", manche: manche(2, 2) }, lobby: null, live: false };
    case "break":
      return { state: { ...st, state: "BREAK", manche: manche(3, 4), breakEndsAt: iso(now + 4 * 60000 + 32000) }, lobby: null, live: false };
    case "finale":
      return { state: { ...st, state: "FINAL" }, lobby: null, live: false };
    case "premiazione":
      return { state: { ...st, state: "COMPLETED", awards: { order: [...st.teams].reverse().map((t) => t.teamId) }, timer: { startedAt: iso(now - 120000), deadlineAt: null, totalMs: null } }, lobby: null, live: false };
    case "chiusa":
      return { state: { ...st, state: "LEADERBOARD", status: "closed", closeReason: "staff" }, lobby: null, live: false };
    default:
      return { state: st, lobby, live: false };
  }
}

/** Vista del giocatore (tavolo 1, capitano). */
export function playerView(st: TigPublicState, over: Partial<PlayerView> = {}): PlayerView {
  const t = st.teams[0];
  return {
    role: "player",
    me: { memberId: "m1", nickname: "Anna", teamId: t.teamId, isCaptain: true },
    team: {
      teamId: t.teamId,
      tableNo: t.tableNo,
      name: t.name,
      approved: true,
      color: t.color,
      score: t.score ?? 0,
      rank: t.rank,
      energy: 72,
      level: 2,
      nextThreshold: 150,
      chaosProgress: 0.45,
      mascotSlot: 3,
      mascotConfirmed: true,
      members: [
        { memberId: "m1", nickname: "Anna", online: true, isCaptain: true, isMe: true },
        { memberId: "m2", nickname: "Dario", online: true, isCaptain: false, isMe: false },
        { memberId: "m3", nickname: "Giò", online: false, isCaptain: false, isMe: false },
      ],
      shieldActive: false,
      caosUsed: false,
      wins: 2,
    },
    mascot: { open: false, myVote: 3, tally: { "3": 2, "8": 1 }, taken: [5, 9], canConfirm: true, unique: true },
    game: null,
    caos: {
      available: true,
      windowOpen: true,
      reason: null,
      targets: st.teams.slice(1, 5).map((x, i) => ({ teamId: x.teamId, tableNo: x.tableNo, name: x.name, allowed: i !== 2, why: i === 2 ? "Già sfidato in questa manche" : null })),
    },
    shield: { canActivate: true, active: false, reason: null },
    ...over,
  };
}

/** Schermate del telefono. */
export function phoneScreen(s: string, now: number, n: number): { state: TigPublicState; view: PlayerView } {
  const base = tvScreen("lobby", now, n).state;
  switch (s) {
    case "p-lobby": {
      const v = playerView(base);
      return { state: base, view: { ...v, team: { ...v.team, approved: false, mascotConfirmed: false }, mascot: { ...v.mascot, open: true } } };
    }
    case "p-manche": {
      const st = tvScreen("manche", now, n).state;
      return { state: st, view: playerView(st) };
    }
    case "p-regola": {
      const st = tvScreen("regola", now, n).state;
      return { state: st, view: playerView(st, { game: { id: "g1", memberView: null, participant: true, canSubmit: true, submitted: false, outcome: null, bet: { allowed: false, cap: 0, amount: null } } }) };
    }
    case "p-puntata": {
      const st = tvScreen("regola-puntata", now, n).state;
      return { state: st, view: playerView(st, { game: { id: "g1", memberView: null, participant: true, canSubmit: true, submitted: false, outcome: null, bet: { allowed: true, cap: 235, amount: null } } }) };
    }
    case "p-caos": {
      const st = tvScreen("caos", now, n).state;
      return { state: st, view: playerView(st, { game: { id: "g1", memberView: null, participant: true, canSubmit: true, submitted: false, outcome: null, bet: { allowed: false, cap: 0, amount: null } } }) };
    }
    case "p-caos-spettatore": {
      const st = tvScreen("caos", now, n).state;
      const v = playerView(st, { game: { id: "g1", memberView: null, participant: false, canSubmit: false, submitted: false, outcome: null, bet: { allowed: false, cap: 0, amount: null } } });
      return { state: { ...st, game: { ...st.game!, participants: ["t2", "t3"] } }, view: v };
    }
    case "p-duello": {
      const st = tvScreen("duello", now, n).state;
      return { state: st, view: playerView(st, { game: { id: "g1", memberView: null, participant: true, canSubmit: false, submitted: true, outcome: duelOutcome.outcomes[0], bet: { allowed: false, cap: 0, amount: null } } }) };
    }
    case "p-classifica": {
      const st = tvScreen("classifica", now, n).state;
      return { state: st, view: playerView(st) };
    }
    case "p-break": {
      const st = tvScreen("break", now, n).state;
      return { state: st, view: playerView(st) };
    }
    case "p-pausa": {
      const st = tvScreen("pausa", now, n).state;
      return { state: st, view: playerView(st) };
    }
    case "p-premiazione": {
      const st = tvScreen("premiazione", now, n).state;
      return { state: st, view: playerView(st) };
    }
    case "p-chiusa": {
      const st = tvScreen("chiusa", now, n).state;
      return { state: st, view: playerView(st) };
    }
    default:
      return { state: base, view: playerView(base) };
  }
}

/** Vista della regia. */
export function regiaScreen(s: string, now: number, n: number): { state: TigPublicState; view: RegiaView } {
  const draft = s === "r-bozza";
  const st0 = s === "r-gioco" ? tvScreen("regola", now, n).state : s === "r-pausa" ? tvScreen("pausa", now, n).state : s === "r-premiazione" ? { ...tvScreen("premiazione", now, n).state, state: "AWARDS" as const } : tvScreen("lobby", now, n).state;
  const st: TigPublicState = draft ? { ...st0, state: "DRAFT", teams: [] } : st0;
  const tables: RegiaTable[] = Array.from({ length: n }, (_, i) => ({
    tableId: `tb${i + 1}`,
    tableNo: i + 1,
    token: `token-${i + 1}`,
    code: `K7Q${String(10 + i).padStart(3, "0")}`,
    pin: null,
    team:
      draft || i >= n - 1
        ? null
        : {
            teamId: `t${i + 1}`,
            name: NAMES[i % NAMES.length],
            approved: s === "r-lobby" ? i < 2 : true,
            status: "active" as const,
            captainMemberId: `m${i}a`,
            mascotSlot: i + 1,
            score: st.teams[i]?.score ?? 0,
            energy: 40 + i * 9,
            level: (i % 3) + 1,
            online: 2,
            members: [
              { memberId: `m${i}a`, nickname: ["Anna", "Bruno", "Carla", "Dario", "Elsa", "Furio"][i % 6], online: true, isCaptain: true, status: "active", lastSeenAt: new Date(now).toISOString() },
              { memberId: `m${i}b`, nickname: ["Giò", "Ivo", "Lia", "Max", "Nora", "Otto"][i % 6], online: i % 2 === 0, isCaptain: false, status: "active", lastSeenAt: new Date(now - 60000).toISOString() },
            ],
          },
  }));
  const view: RegiaView = {
    role: "organizer",
    config: { venue: st.venue, tables: n, durationMin: 115, accessMode: "qr", mascotUnique: true, staffPin: false, chaosLevel2: 60, chaosLevel3: 150, hideScoresInFinal: false, segments: {} },
    displayKey: "anteprima",
    tables,
    log: [
      { id: 3, kind: "skip", audit: true, reason: "Regola già spiegata a voce", fromState: "GAME_ACTIVE", toState: "GAME_RESULTS", at: new Date(now - 30000).toISOString(), data: null },
      { id: 2, kind: "start", audit: false, reason: null, fromState: "LOBBY_LOCKED", toState: "INTRO", at: new Date(now - 600000).toISOString(), data: null },
      { id: 1, kind: "open_lobby", audit: false, reason: null, fromState: "DRAFT", toState: "LOBBY_OPEN", at: new Date(now - 1200000).toISOString(), data: null },
    ],
    games: draft
      ? []
      : [
          { id: "g0", mancheNo: 3, slotNo: 1, kind: "regular", code: "sincronizzati", title: "Sincronizzati", status: "scored", submissions: 6, expected: 6 },
          { id: "g1", mancheNo: 3, slotNo: 2, kind: "regular", code: "prevedi-la-maggioranza", title: "Prevedi la maggioranza", status: "active", submissions: 3, expected: 6 },
          { id: "gc", mancheNo: 2, slotNo: 4, kind: "caos", code: "bottone-del-caos", title: "Duello del Caos", status: "scored", submissions: 2, expected: 2 },
        ],
    segments: runOfShow(115).map((x) => ({ key: x.key, label: x.label, minutes: x.minutes, games: x.games })),
    displayOnline: s !== "r-bozza",
    canRollback: s === "r-gioco",
    canSkip: true,
    catalog: { implemented: 80, total: 80, available: 80 },
  };
  return { state: st, view };
}

/** Anteprime d'ingresso al tavolo. */
export function joinPreview(s: string): JoinPreview {
  const base: JoinPreview = { eventId: "anteprima", venue: "Taverna del Molo", state: "LOBBY_OPEN", status: "open", tableNo: 4, team: null, mine: null, needsPin: false, canCreate: true, canJoin: true, blockedReason: null, suggestedNickname: "Anna" };
  if (s === "j-entra") return { ...base, team: { teamId: "t4", name: "Le Sirene Stonate", approved: false, members: 2 }, suggestedNickname: "Dario" };
  if (s === "j-pin") return { ...base, needsPin: true };
  if (s === "j-bloccato") return { ...base, canCreate: false, canJoin: false, blockedReason: "La lobby è chiusa: chiedi allo staff di riaprire gli ingressi.", mine: { teamId: "t2", tableNo: 2, sameTable: false } };
  return base;
}
