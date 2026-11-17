import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ArenaPhase, ArenaSpotlight, ArenaTeam, HostId } from "@/features/tig/arena-contract";
import { FULL_WINDOW, fitDistance, lensShift, normalizeSafeArea, projectToCanvas, smoothDamp, type FrameWindow, type Vec3 } from "@/features/tig/three/arena/camera-math";
import { AWARDS_REVEAL_MS, awardsRevealAt, awardsRevealed, directArena, mascotActionFor, spotlightLive, type ShotKind, type ShotSpec } from "@/features/tig/three/arena/director";
import { BACK_ROW, MAX_TEAMS, MIN_HALF_WIDTH, ONE_ROW_MAX, POD, STAGE, U_BACK, U_FRONT, columnHeight, hostMarks, minPodGap, podLayout, podScale, podSpacing, scoreScale, uDepth } from "@/features/tig/three/arena/layout";
import { GAME_NAME, isGameName, ledLeaderboardCols } from "@/features/tig/three/arena/led-texture";
import { PerfGovernor, classifyGpu, initialLevel, profileAt, renderDpr } from "@/features/tig/three/arena/perf";
import { displayCase } from "@/features/tig/three/palette";
import { RankAnimator, deltaFlash, formatScore, rankOrder, scoreDigits, tableOrder } from "@/features/tig/three/arena/rank-anim";
import { shotSubject } from "@/features/tig/three/arena/shots";
import { BUMBARINO, HOST_IDS, HOST_MODELS, hostModelFiles, hostModelUrl } from "@/features/tig/three/characters/host-models";
import { ACTION_LENGTH, EVOLVE_BURST_S, actionIsLively, mascotPose, shownLevel } from "@/features/tig/three/mascot/mascot-motion";
import { MASCOT_SLOT_COUNT, listMascots, mascotHasLevelModel, mascotInfo, mascotLabel, mascotModelUrl } from "@/features/tig/mascots/registry";

const team = (i: number, score: number, over: Partial<ArenaTeam> = {}): ArenaTeam => ({
  teamId: `t${i}`,
  tableNo: i,
  name: `Squadra ${i}`,
  color: "#ff8a1f",
  mascotSlot: ((i - 1) % 12) + 1,
  mascotLevel: 1,
  score,
  rank: 1,
  chaosProgress: 0.3,
  online: true,
  ...over,
});

describe("pianta dell'arena: torri a U per 2–24 squadre (due file oltre 14)", () => {
  it("una torre per squadra, da sinistra a destra, simmetriche", () => {
    for (let n = 0; n <= MAX_TEAMS; n++) {
      const l = podLayout(n);
      expect(l.pods).toHaveLength(n);
      for (let i = 1; i < n; i++) expect(l.pods[i].x).toBeGreaterThan(l.pods[i - 1].x);
      for (let i = 0; i < n; i++) expect(l.pods[i].x).toBeCloseTo(-l.pods[n - 1 - i].x, 6);
      // una fila: specchio esatto; due file: specchio esatto per n dispari, con n pari l'insieme resta centrato
      if (l.rows === 1 || n % 2 === 1) for (let i = 0; i < n; i++) expect(l.pods[i].z).toBeCloseTo(l.pods[n - 1 - i].z, 6);
    }
    expect(podLayout(30).pods).toHaveLength(MAX_TEAMS);
  });

  it("le torri non si toccano mai (tutte le coppie, anche tra le due file) e non entrano nel palco", () => {
    for (let n = 2; n <= MAX_TEAMS; n++) {
      const l = podLayout(n);
      const base = POD.baseRadius * l.scale;
      expect(minPodGap(l)).toBeGreaterThan(2 * base * 0.98);
      // gradino basso del palco: raggio STAGE.radius + 0.56
      for (const p of l.pods) expect(Math.hypot(p.x, p.z)).toBeGreaterThan(STAGE.radius + 0.56 + base);
    }
  });

  it("una fila fino a 14 (passo costante), poi due file a zig-zag sulla pedana; torri mai rimpicciolite", () => {
    for (let n = 2; n <= MAX_TEAMS; n++) {
      const l = podLayout(n);
      expect(l.halfWidth).toBeGreaterThanOrEqual(MIN_HALF_WIDTH);
      expect(l.scale).toBe(1);
      expect(podScale(n)).toBe(1);
      if (n <= ONE_ROW_MAX) {
        expect(l.rows).toBe(1);
        const dx = l.pods[1].x - l.pods[0].x;
        for (let i = 2; i < n; i++) expect(l.pods[i].x - l.pods[i - 1].x).toBeCloseTo(dx, 6);
        for (const p of l.pods) expect(p).toMatchObject({ y: 0, row: 0 });
      } else {
        expect(l.rows).toBe(2);
        for (const p of l.pods) {
          // tavolo 1 dietro (sulla pedana), 2 davanti, 3 dietro…
          expect(p.row).toBe(p.index % 2 === 0 ? 1 : 0);
          expect(p.y).toBe(p.row === 1 ? BACK_ROW.riser : 0);
        }
        // al massimo 12 torri per fila, passo dentro la fila costante e mai sotto 1,75 m
        const back = l.pods.filter((p) => p.row === 1);
        const front = l.pods.filter((p) => p.row === 0);
        expect(back.length).toBeLessThanOrEqual(12);
        expect(front.length).toBeLessThanOrEqual(12);
        for (const row of [back, front]) for (let i = 1; i < row.length; i++) expect(row[i].x - row[i - 1].x).toBeCloseTo(podSpacing(n), 6);
        expect(podSpacing(n)).toBeGreaterThanOrEqual(1.75 - 1e-9);
        // la fila davanti sta davanti a quella dietro (al centro)
        const mid = (row: typeof back) => row.reduce((a, p) => (Math.abs(p.x) < Math.abs(a.x) ? p : a));
        expect(mid(front).z).toBeGreaterThan(mid(back).z + 1.5);
      }
    }
  });

  it("la U: fondo dietro il palco, punte ai lati un po' avanti; le torri guardano il pubblico", () => {
    const l = podLayout(12);
    expect(uDepth(0, l.halfWidth)).toBeCloseTo(U_BACK);
    expect(uDepth(l.halfWidth, l.halfWidth)).toBeCloseTo(U_FRONT);
    for (const p of l.pods) {
      // la faccia (+Z locale ruotata di yaw) punta verso la camera (z crescente)
      expect(Math.cos(p.yaw)).toBeGreaterThan(0);
    }
    expect(podLayout(1).pods[0]).toMatchObject({ x: 0 });
  });

  it("colonna: monotona, tra minima e massima; fondo scala mai sotto 300", () => {
    const s = scoreScale(0);
    expect(s).toBe(300);
    expect(scoreScale(2000)).toBeGreaterThan(2000);
    let prev = -1;
    for (let v = 0; v <= 2500; v += 50) {
      const h = columnHeight(v, scoreScale(2000));
      expect(h).toBeGreaterThanOrEqual(POD.minHeight);
      expect(h).toBeLessThanOrEqual(POD.maxHeight);
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
  });

  it("presentatori sul piano alto del palco (normale e premiazione, ai lati del podio)", () => {
    const apothem = STAGE.radius * Math.cos(Math.PI / 6);
    for (let n = 0; n <= 4; n++) {
      for (const aside of [false, true]) {
        const m = hostMarks(n, aside);
        expect(m).toHaveLength(n);
        for (const k of m) expect(Math.max(Math.abs(k.x), Math.abs(k.z))).toBeLessThan(apothem + 0.01);
      }
    }
    for (const k of hostMarks(2, true)) expect(Math.abs(k.x)).toBeGreaterThan(1.6);
  });
});

describe("camera: inquadratura dentro la finestra libera dall'HUD", () => {
  it("safeArea: rettangolo, margini o non valida", () => {
    expect(normalizeSafeArea(undefined)).toEqual(FULL_WINDOW);
    expect(normalizeSafeArea({ left: 0, top: 0, right: 1, bottom: 0.44 })).toEqual({ x0: 0, y0: 0, x1: 1, y1: 0.44 });
    expect(normalizeSafeArea({ left: 0, top: 0, right: 0, bottom: 0.4 })).toEqual({ x0: 0, y0: 0, x1: 1, y1: 0.6 });
    expect(normalizeSafeArea({ left: 0.3, top: 0, right: 0, bottom: 0 })).toEqual({ x0: 0.3, y0: 0, x1: 1, y1: 1 });
    expect(normalizeSafeArea({ left: 0.5, top: 0.5, right: 0.52, bottom: 0.51 })).toEqual(FULL_WINDOW);
  });

  it("lens shift: il centro ottico finisce al centro della finestra", () => {
    expect(lensShift(FULL_WINDOW)).toEqual({ x: 0, y: 0 });
    const s = lensShift({ x0: 0, y0: 0, x1: 1, y1: 0.5 });
    expect(s.x).toBeCloseTo(0);
    expect(s.y).toBeCloseTo(0.5);
  });

  const inside = (points: readonly Vec3[], center: Vec3, yaw: number, pitch: number, fov: number, aspect: number, win: FrameWindow) => {
    const d = fitDistance(points, center, yaw, pitch, fov, aspect, win);
    for (const p of points) {
      const c = projectToCanvas(p, center, yaw, pitch, d, fov, aspect, win);
      expect(c.depth).toBeGreaterThan(0);
      expect(c.x).toBeGreaterThanOrEqual(win.x0 - 1e-6);
      expect(c.x).toBeLessThanOrEqual(win.x1 + 1e-6);
      expect(c.y).toBeGreaterThanOrEqual(win.y0 - 1e-6);
      expect(c.y).toBeLessThanOrEqual(win.y1 + 1e-6);
    }
  };

  it("ogni punto del soggetto sta nella finestra (TV, PC con HUD a destra, telefono, finestra bassa)", () => {
    const pts: Vec3[] = [
      [-8, 0, 1],
      [8, 0, 1],
      [0, 0, -6],
      [0, 9.5, 5],
      [-4.8, 9.5, 2.3],
      [4.8, 6, 2.3],
      [0, 3.5, -5.6],
    ];
    const cases: { aspect: number; win: FrameWindow }[] = [
      { aspect: 16 / 9, win: FULL_WINDOW },
      { aspect: 1440 / 900, win: { x0: 0, y0: 0, x1: 0.64, y1: 1 } },
      { aspect: 390 / 844, win: { x0: 0, y0: 0, x1: 1, y1: 0.44 } },
      { aspect: 1568 / 675, win: { x0: 0, y0: 0.1, x1: 1, y1: 0.8 } },
    ];
    for (const c of cases) for (const yaw of [-30, 0, 18]) for (const pitch of [6, 14, 30]) inside(pts, [0, 3, -1], yaw, pitch, 38, c.aspect, c.win);
  });

  it("le inquadrature della regia contengono il loro soggetto, per 2, 6, 12 e 20 squadre", () => {
    const kinds: ShotKind[] = ["establish", "wide", "arena", "stage", "led", "pods", "pod", "podium"];
    for (const n of [2, 6, 12, 20]) {
      const layout = podLayout(n);
      const ids = Array.from({ length: n }, (_, i) => `t${i + 1}`);
      for (const kind of kinds) {
        for (const compact of [false, true]) {
          const spec: ShotSpec = { kind, teamIds: kind === "pod" ? [ids[0]] : kind === "pods" ? [ids[0], ids[n - 1]] : [], yaw: 0, pitch: 12, fov: 38, orbit: null, ease: 1, shake: 0, withLed: kind === "pods" || kind === "podium" };
          const subj = shotSubject(spec, { layout, podTop: () => 0.3 + POD.maxHeight, teamIndex: (id) => ids.indexOf(id), hostCount: 2, compact });
          expect(subj.points.length).toBeGreaterThan(3);
          inside(subj.points, subj.center, spec.yaw + subj.yawBias, spec.pitch + subj.pitchBias, spec.fov, compact ? 390 / 371 : 16 / 9, FULL_WINDOW);
        }
      }
    }
  });

  it("smoothDamp arriva al bersaglio senza superarlo", () => {
    const vel = { v: 0 };
    let x = 0;
    let max = 0;
    for (let i = 0; i < 240; i++) {
      x = smoothDamp(x, 10, vel, 0.5, 1 / 60);
      max = Math.max(max, x);
    }
    expect(x).toBeCloseTo(10, 2);
    expect(max).toBeLessThanOrEqual(10);
    expect(smoothDamp(3, 7, { v: 0 }, 0, 0.016)).toBe(7);
  });
});

describe("punteggi e classifica animati", () => {
  it("ordine di classifica e dei tavoli", () => {
    const ts = [team(3, 100, { rank: 2 }), team(1, 300, { rank: 1 }), team(2, 100, { rank: 2 })];
    expect(rankOrder(ts).map((t) => t.tableNo)).toEqual([1, 2, 3]);
    expect(tableOrder(ts).map((t) => t.tableNo)).toEqual([1, 2, 3]);
  });

  it("il punteggio mostrato conta fino al vero, le righe scivolano al loro posto, i cambi accendono il lampo", () => {
    const a = new RankAnimator();
    let teams = [team(1, 100, { rank: 2 }), team(2, 200, { rank: 1 })];
    a.step(teams, 1 / 60, true);
    expect(a.get("t1")?.score).toBe(100);
    expect(a.get("t2")?.row).toBe(0);
    teams = [team(1, 400, { rank: 1 }), team(2, 200, { rank: 2 })];
    let busy = true;
    let prevScore = 100;
    for (let i = 0; i < 60 * 4; i++) {
      busy = a.step(teams, 1 / 60);
      const s = a.get("t1")!.score;
      expect(s).toBeGreaterThanOrEqual(prevScore - 1e-9);
      expect(s).toBeLessThanOrEqual(400);
      prevScore = s;
    }
    expect(a.get("t1")!.score).toBeCloseTo(400, 0);
    expect(a.get("t1")!.row).toBeCloseTo(0, 2);
    expect(a.get("t2")!.row).toBeCloseTo(1, 2);
    expect(a.get("t1")!.delta).toBe(300);
    expect(busy).toBe(false);
    // squadra uscita: dimenticata
    a.step([team(2, 200)], 1 / 60);
    expect(a.get("t1")).toBeUndefined();
  });

  it("cifre, formato italiano e lampo «+40»", () => {
    expect(scoreDigits(1240)).toEqual([1, 2, 4, 0]);
    expect(scoreDigits(-5)).toEqual([0]);
    expect(scoreDigits(1234567)).toEqual([9, 9, 9, 9, 9]);
    expect(formatScore(1234.4)).toBe((1234).toLocaleString("it-IT"));
    expect(deltaFlash(-1)).toBe(0);
    expect(deltaFlash(0.5)).toBe(1);
    expect(deltaFlash(3)).toBe(0);
  });
});

describe("regia per fase", () => {
  const phases: ArenaPhase[] = ["lobby", "intro", "manche-intro", "game", "reveal", "leaderboard", "chaos", "duel", "evolve", "break", "final", "awards"];
  const spot = (kind: ArenaSpotlight["kind"], ids = ["t1", "t2"]): ArenaSpotlight => ({ kind, teamIds: ids, eventId: `${kind}-1` });

  it("ogni fase ha inquadratura, atmosfera, contenuto del LED e gesto dei presentatori", () => {
    for (const phase of phases) {
      for (const t of [0, 3000, 12000]) {
        const d = directArena({ phase, elapsedMs: t, spotlight: phase === "duel" || phase === "chaos" ? spot(phase) : phase === "evolve" ? spot("evolve", ["t1"]) : null, spotAgeMs: t, speaking: false, hostCount: 2 });
        expect(d.shot.fov).toBeGreaterThan(20);
        expect(d.mood).toBeTruthy();
        expect(d.led).toBeTruthy();
      }
    }
    expect(directArena({ phase: "chaos", elapsedMs: 0, spotlight: spot("chaos"), spotAgeMs: 0, speaking: false, hostCount: 1 }).led).toBe("alarm");
    expect(directArena({ phase: "duel", elapsedMs: 5000, spotlight: spot("duel"), spotAgeMs: 5000, speaking: false, hostCount: 1 }).shot.kind).toBe("pods");
    expect(directArena({ phase: "game", elapsedMs: 1000, spotlight: null, spotAgeMs: 0, speaking: true, hostCount: 1 }).hostAction).toBe("talk");
  });

  it("premiazione dal basso verso l'alto: 3°, 2°, 1°", () => {
    expect(awardsRevealed(0)).toBe(0);
    expect(awardsRevealed(AWARDS_REVEAL_MS[0])).toBe(1);
    expect(awardsRevealed(AWARDS_REVEAL_MS[1] + 1)).toBe(2);
    expect(awardsRevealed(60_000)).toBe(3);
    const t1 = { teamId: "t1", rank: 1, online: true };
    expect(mascotActionFor({ team: t1, phase: "awards", elapsedMs: AWARDS_REVEAL_MS[1] + 10, spotlight: null, spotAgeMs: 0, delta: 0, deltaAge: 99, podiumRank: 1 })).toBe("idle");
    expect(mascotActionFor({ team: t1, phase: "awards", elapsedMs: AWARDS_REVEAL_MS[2] + 10, spotlight: null, spotAgeMs: 0, delta: 0, deltaAge: 99, podiumRank: 1 })).toBe("win");
  });

  it("premiazione con molti tavoli: prima quelli fuori dal podio, poi il podio, stesso calendario per arena e HUD", () => {
    for (const n of [2, 3, 8, 20]) {
      const times = Array.from({ length: n }, (_, i) => awardsRevealAt(n - i, n)); // dall'ultimo al primo
      for (let i = 1; i < n; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
      // quando l'HUD svela il 3°, il 2° e il 1°, il podio dell'arena li ha appena svelati (e non prima)
      for (const pos of [3, 2, 1].filter((p) => p <= n)) {
        const at = awardsRevealAt(pos, n);
        expect(awardsRevealed(at, n)).toBe(4 - pos);
        expect(awardsRevealed(at - 1, n)).toBe(3 - pos);
      }
    }
    const t1 = { teamId: "t1", rank: 1, online: true };
    // con 12 tavoli il vincitore non si vede al tempo del podio "breve"
    expect(mascotActionFor({ team: t1, phase: "awards", elapsedMs: AWARDS_REVEAL_MS[2] + 10, spotlight: null, spotAgeMs: 0, delta: 0, deltaAge: 99, podiumRank: 1, teamCount: 12 })).toBe("idle");
    expect(directArena({ phase: "awards", elapsedMs: 2000, spotlight: null, spotAgeMs: 0, speaking: false, hostCount: 2, teamCount: 12 }).shot.kind).toBe("led");
  });

  it("spotlight: dura un attimo nelle fasi normali, tutta la fase in quelle dedicate", () => {
    expect(spotlightLive("game", spot("attack"), 1000)).toBe(true);
    expect(spotlightLive("game", spot("attack"), 10_000)).toBe(false);
    expect(spotlightLive("duel", spot("duel"), 60_000)).toBe(true);
    expect(spotlightLive("game", { kind: "attack", teamIds: [], eventId: "x" }, 10)).toBe(false);
  });

  it("azioni delle mascotte: attacco, colpo, scudo, evoluzione; mai tristi a lungo; offline ferme", () => {
    const a = { teamId: "t1", rank: 3, online: true };
    const b = { teamId: "t2", rank: 1, online: true };
    const s = spot("attack");
    const act = (team: typeof a, age: number) => mascotActionFor({ team, phase: "game", elapsedMs: 5000, spotlight: s, spotAgeMs: age, delta: 0, deltaAge: 99 });
    expect(act(a, 300)).toBe("attack");
    expect(act(b, 600)).toBe("idle");
    expect(act(b, 1500)).toBe("hit");
    expect(act(b, 3300)).toBe("sad");
    expect(act(b, 4400)).toBe("idle");
    expect(mascotActionFor({ team: { ...a, online: false }, phase: "game", elapsedMs: 0, spotlight: s, spotAgeMs: 300, delta: 0, deltaAge: 99 })).toBe("idle");
    expect(mascotActionFor({ team: a, phase: "evolve", elapsedMs: 0, spotlight: spot("evolve", ["t1"]), spotAgeMs: 500, delta: 0, deltaAge: 99 })).toBe("evolve");
    expect(mascotActionFor({ team: a, phase: "reveal", elapsedMs: 0, spotlight: null, spotAgeMs: 0, delta: 40, deltaAge: 0.5 })).toBe("cheer");
    expect(mascotActionFor({ team: a, phase: "reveal", elapsedMs: 0, spotlight: null, spotAgeMs: 0, delta: -20, deltaAge: 3 })).toBe("idle");
  });
});

describe("mascotte: movimenti procedurali e livelli", () => {
  it("ogni azione torna a riposo (niente mascotte storte o fuori dal tavolo)", () => {
    for (const action of ["idle", "cheer", "sad", "attack", "hit", "evolve", "win"] as const) {
      for (let t = 0; t < 6; t += 0.05) {
        const p = mascotPose(action, t, t, 2);
        expect(Math.abs(p.x)).toBeLessThan(0.2);
        expect(Math.abs(p.z)).toBeLessThan(0.5);
        expect(p.y).toBeGreaterThan(-0.2);
        expect(p.y).toBeLessThan(0.7);
        expect(Math.abs(p.tiltX)).toBeLessThan(0.7);
        expect(p.scale).toBeGreaterThan(0.8);
      }
    }
    const end = mascotPose("hit", ACTION_LENGTH.hit! + 0.5, 0, 1);
    expect(end.hurt).toBe(0);
    expect(Math.abs(end.z)).toBeLessThan(0.01);
    expect(actionIsLively("idle", 1)).toBe(false);
    expect(actionIsLively("hit", 5)).toBe(false);
    expect(actionIsLively("cheer", 50)).toBe(true);
  });

  it("evoluzione: lampo al cambio di livello, prima il vecchio poi il nuovo", () => {
    expect(mascotPose("evolve", EVOLVE_BURST_S, 0, 2).flash).toBeGreaterThan(0.9);
    expect(shownLevel("evolve", 0.5, 3, 2)).toBe(2);
    expect(shownLevel("evolve", EVOLVE_BURST_S + 0.1, 3, 2)).toBe(3);
    expect(shownLevel("idle", 0, 3, 2)).toBe(3);
    // il livello 3 levita più in alto del 1
    const amp = (lvl: 1 | 3) => Math.max(...Array.from({ length: 200 }, (_, i) => mascotPose("idle", 0, i * 0.05, lvl).y));
    expect(amp(3)).toBeGreaterThan(amp(1));
  });

  it("registro: 12 slot vuoti dichiarati (niente nomi inventati), segnaposto finché non arrivano i GLB", () => {
    expect(MASCOT_SLOT_COUNT).toBe(12);
    const all = listMascots();
    expect(all).toHaveLength(12);
    for (const m of all) {
      expect(m.name).toBeNull();
      expect(m.sex).toBeNull();
      expect(m.voiceEnv).toBeNull();
      expect(m.placeholder).toBe(true);
      expect(mascotModelUrl(m.slot, 3)).toBeNull();
      expect(mascotHasLevelModel(m.slot, 1)).toBe(false);
    }
    expect(mascotInfo(null)).toBeNull();
    expect(mascotInfo(13)).toBeNull();
    expect(mascotLabel(4)).toBe("Mascotte 4");
  });
});

describe("personaggi: HostId → modello", () => {
  it("ogni presentatore ha un file (alta e -low) che esiste davvero in public/", () => {
    const pub = path.resolve(import.meta.dirname, "../../public");
    const ids: HostId[] = ["professore", "regina", "palmino", "investigatore", "don-patrizio", "zafira", "nek", "ciccio", "franca", "piroletto", "minu", "chicca", "bumbaru", "mordicchio", "mammusss", "rumpo"];
    expect([...HOST_IDS].sort()).toEqual([...ids].sort());
    for (const who of HOST_IDS) {
      for (const q of ["high", "low"] as const) {
        for (const url of hostModelFiles(who, q)) expect(existsSync(path.join(pub, url)), url).toBe(true);
      }
      expect(HOST_MODELS[who].height).toBeGreaterThan(1.2);
      expect(HOST_MODELS[who].height).toBeLessThan(2.1);
    }
    expect(hostModelUrl("nek", "low")).toBe("/models/tig/nek-low.glb");
    expect(hostModelFiles("bumbaru", "high")).toContain(BUMBARINO.url);
    expect(HOST_MODELS.mammusss.snake).toBe(true);
    expect(HOST_MODELS.mordicchio.offsetX).toBeCloseTo(0.12);
    expect(HOST_MODELS.franca.noBrows).toBe(true);
  });
});

describe("profilo di resa (perf.ts): gradini, scheda video, regolatore", () => {
  it("classe della scheda video dal nome del renderer", () => {
    expect(classifyGpu("ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("integrated");
    expect(classifyGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("dedicated");
    expect(classifyGpu("ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("integrated");
    expect(classifyGpu("ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("dedicated");
    expect(classifyGpu("Adreno (TM) 650")).toBe("mobile");
    expect(classifyGpu("Apple GPU")).toBe("mobile");
    expect(classifyGpu("Apple M2")).toBe("dedicated");
    expect(classifyGpu("")).toBe("unknown");
    expect(classifyGpu(null)).toBe("unknown");
  });

  it("gradino di partenza: integrata 3, dedicata 4, telefono e low 2", () => {
    expect(initialLevel("high", "integrated")).toBe(2);
    expect(initialLevel("high", "unknown")).toBe(3);
    expect(initialLevel("high", "dedicated")).toBe(4);
    expect(initialLevel("high", "mobile")).toBe(2);
    expect(initialLevel("low", "integrated")).toBe(2);
    expect(initialLevel("low", "dedicated")).toBe(3);
  });

  it("scendendo di gradino i pixel non aumentano mai e gli effetti si tolgono a poco a poco", () => {
    for (let l = 1; l <= 4; l++) {
      const hi = profileAt(l);
      const lo = profileAt(l - 1);
      expect(lo.maxDpr).toBeLessThanOrEqual(hi.maxDpr);
      expect(lo.maxPixels).toBeLessThanOrEqual(hi.maxPixels);
      expect(lo.reflect).toBeLessThanOrEqual(hi.reflect);
      expect(lo.fixtures).toBeLessThanOrEqual(hi.fixtures);
      expect(lo.idleFps).toBeLessThanOrEqual(hi.idleFps);
    }
    // dal gradino 2 in su: 60 fps anche a riposo, bagliore e antialiasing sempre presenti dal gradino 1
    for (let l = 2; l <= 4; l++) expect(profileAt(l).idleFps).toBe(60);
    for (let l = 1; l <= 4; l++) {
      expect(profileAt(l).bloom).toBeGreaterThan(0);
      expect(profileAt(l).msaa > 0 || profileAt(l).postAA !== "none").toBe(true);
    }
    expect(profileAt(9).level).toBe(4);
    expect(profileAt(-3).level).toBe(0);
  });

  it("densità di pixel: tetto del gradino, del dispositivo e dei pixel totali", () => {
    // TV 1080p (dpr 1) al gradino 3: piena risoluzione
    expect(renderDpr(profileAt(3), 1, 1920, 1080)).toBe(1);
    // portatile ad alta densità: limitato dal numero di pixel
    const d = renderDpr(profileAt(3), 2, 1536, 864);
    expect(1536 * 864 * d * d).toBeLessThanOrEqual(profileAt(3).maxPixels * 1.01);
    // telefono (dpr 3): 1,5 al massimo
    expect(renderDpr(profileAt(2), 3, 390, 844)).toBe(1.5);
    // TV 4K a dpr 1 al gradino 3: sotto i 2,4 milioni di pixel
    const k = renderDpr(profileAt(3), 1, 3840, 2160);
    expect(3840 * 2160 * k * k).toBeLessThanOrEqual(profileAt(3).maxPixels * 1.01);
  });

  it("regolatore: scende se lento per 2,5 s (mai sotto il pavimento), risale quando torna veloce (mai sopra la partenza)", () => {
    const g = new PerfGovernor(3, 1);
    // lento ma non a piena velocità: non conta
    for (let i = 0; i < 20; i++) expect(g.update(30, 0.5, false)).toBe(false);
    expect(g.level).toBe(3);
    let changed = false;
    for (let i = 0; i < 6 && !changed; i++) changed = g.update(30, 0.5, true);
    expect(changed).toBe(true);
    expect(g.level).toBe(2);
    // pausa dopo il cambio, poi ancora lento: 1, e non scende sotto il pavimento
    for (let i = 0; i < 60; i++) g.update(40, 0.5, true);
    expect(g.level).toBe(1);
    // torna veloce: risale fino alla partenza e non oltre
    for (let i = 0; i < 200; i++) g.update(12, 0.5, true);
    expect(g.level).toBe(3);
    // né lento né veloce: resta
    for (let i = 0; i < 40; i++) g.update(17, 0.5, true);
    expect(g.level).toBe(3);
  });
});

describe("vela: nome del gioco", () => {
  it("il logo è TAVERNA DEI PIRATI e un titolo uguale (nuovo o vecchio nome) non si ripete sotto", () => {
    expect(GAME_NAME).toBe("Taverna dei Pirati");
    for (const t of ["TAVERNA DEI PIRATI", "Taverna dei Pirati", "la taverna dei pirati!", "TAVOLI IN GUERRA!", "Tavoli in guerra"]) expect(isGameName(t)).toBe(true);
    for (const t of ["MANCHE 1", "PAUSA", "TAVERNA", "", null, undefined]) expect(isGameName(t)).toBe(false);
  });
});

describe("titoli in gotico: mai tutto maiuscolo", () => {
  it("i titoli tutti in maiuscolo diventano maiuscole/minuscole, le parole brevi restano minuscole", () => {
    expect(displayCase("TAVERNA DEI PIRATI")).toBe("Taverna dei Pirati");
    expect(displayCase("ALLARME CAOS!")).toBe("Allarme Caos!");
    expect(displayCase("TUTTO O NIENTE!")).toBe("Tutto o Niente!");
    expect(displayCase("CHI PARTE MALE...")).toBe("Chi Parte Male...");
    expect(displayCase("OGNI TAVOLO È UNA CIURMA")).toBe("Ogni Tavolo è una Ciurma");
    expect(displayCase("«IL GRANDE INGANNO»")).toBe("«Il Grande Inganno»");
    // chi ha già scelto le minuscole decide lui
    expect(displayCase("Memoria lampo")).toBe("Memoria lampo");
    expect(displayCase("")).toBe("");
  });
});

describe("LED: classifica fino a 24 squadre", () => {
  it("1 colonna fino a 6, 2 fino a 16, 3 colonne da 8 righe fino a 24", () => {
    expect(ledLeaderboardCols(4)).toBe(1);
    expect(ledLeaderboardCols(6)).toBe(1);
    expect(ledLeaderboardCols(12)).toBe(2);
    expect(ledLeaderboardCols(16)).toBe(2);
    expect(ledLeaderboardCols(17)).toBe(3);
    expect(Math.ceil(24 / ledLeaderboardCols(24))).toBe(8);
  });
});
