"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/features/giramente/GameApp";
import { getGiramenteVoice } from "@/features/giramente/audio";
import { PausedBanner } from "@/features/giramente/stage";
import { StudioBackdrop, useStudio } from "@/features/giramente/studio";
import { StudioPlayerHud, StudioTvHud } from "@/features/giramente/StudioHud";
import { Logo, RoundBadge, nameOf } from "@/features/giramente/ui";
import { STANDARD_WHEEL, FINALE_WHEEL } from "@/lib/giramente/rules";
import { DEFAULT_SETTINGS, ROUNDS, type Phase, type PrivateView, type PublicState, type WheelKind } from "@/lib/giramente/types";

/**
 * Anteprima dello STUDIO 3D con stati finti (nessun server): ogni fase della partita con l'HUD vero sopra la scena.
 *   ?phase=LOBBY|INTRO|ROUND_INTRO|CHOICE|SPIN|SPINNING|WHEEL_RESULT|QUESTION|TURN_RESULT|PLAY|REVEAL|ROUND_RESULTS|FINAL
 *   &device=pc|tel|tv  &sector=jolly|colpo|bonus|indizi…  &correct=0|1  &round=1..5  &stage=tabellone|collegamento
 *   &spinAt=ms (giro già avviato da ms)  &say=<id battuta> (sottotitolo di prova)  &q=high|low (qualità)
 * Il dispositivo e la sua impaginazione seguono la finestra (usa le misure 1920×1080, 1440×900, 390×844).
 */
export interface StudioPreviewProps {
  phase: Phase;
  device: "pc" | "tel" | "tv";
  sector: WheelKind;
  correct: boolean;
  round: number;
  stage: string | null;
  spinAt: number;
  say: string | null;
}

const NAMES = ["Luca", "Sara", "Marco", "Giulia"];
const ID = (i: number) => `00000000-0000-4000-8000-00000000000${i}`;

function mockState(p: StudioPreviewProps, t0: number): PublicState {
  const round = p.phase === "LOBBY" || p.phase === "INTRO" ? 0 : p.round;
  const info = ROUNDS.find((r) => r.no === round);
  const finale = round === 5;
  const kinds = finale ? FINALE_WHEEL : STANDARD_WHEEL;
  const sectorIndex = Math.max(0, kinds.indexOf(p.sector));
  const iso = (ms: number) => new Date(ms).toISOString();
  const scores = [1250, 900, 650, 300];
  const competitors = NAMES.map((name, i) => ({
    id: ID(i + 1),
    kind: "player" as const,
    name,
    seat: i,
    score: p.phase === "LOBBY" ? 0 : scores[i],
    jolly: i === 1 ? ("scudo" as const) : null,
    members: [],
    online: true,
    done: false,
  }));
  const turnPhases: Phase[] = ["CHOICE", "SPIN", "SPINNING", "WHEEL_RESULT", "QUESTION", "TURN_RESULT"];
  const hasTurn = turnPhases.includes(p.phase);
  const spinning = p.phase === "SPINNING";
  const sector = ["WHEEL_RESULT", "QUESTION", "TURN_RESULT"].includes(p.phase) ? p.sector : null;
  const stage = p.phase === "PLAY" || p.phase === "REVEAL" ? ((p.stage as PublicState["stage"]) ?? "tabellone") : round === 2 || round === 4 ? null : round ? "wheel" : null;
  const board = [
    [{ kind: "letter" as const, char: "L" }, { kind: "letter" as const, char: null }, { kind: "space" as const }, { kind: "letter" as const, char: "R" }, { kind: "letter" as const, char: null }, { kind: "letter" as const, char: "O" }, { kind: "letter" as const, char: null }, { kind: "letter" as const, char: "A" }],
    [{ kind: "letter" as const, char: "G" }, { kind: "letter" as const, char: null }, { kind: "letter" as const, char: "R" }, { kind: "letter" as const, char: "A" }, { kind: "punct" as const, char: "!" }],
  ];
  const solvedBoard = [
    "LA RUOTA".split("").map((c) => (c === " " ? { kind: "space" as const } : { kind: "letter" as const, char: c })),
    [..."GIRA".split("").map((c) => ({ kind: "letter" as const, char: c })), { kind: "punct" as const, char: "!" }],
  ];
  return {
    roomId: "anteprima",
    code: "GIR742",
    devices: "personal",
    mode: "individual",
    status: "open",
    phase: p.phase,
    version: 1,
    secretRev: 1,
    serverNow: iso(t0),
    settings: DEFAULT_SETTINGS,
    roundNo: round,
    roundName: info?.name ?? null,
    stage,
    tiebreakNo: 0,
    phaseTimer: { startedAt: iso(t0 - (spinning ? p.spinAt : 400)), deadlineAt: iso(t0 + 60_000), totalMs: 60_000 },
    pausedAt: null,
    hostOnline: true,
    displayOnline: true,
    competitors,
    participants: competitors.map((c, i) => ({ id: ID(i + 5), nickname: c.name, kind: "account" as const, competitorId: c.id, captain: false, online: true, isHost: i === 0 })),
    standings: competitors.map((c, i) => ({ competitorId: c.id, position: i + 1, score: c.score })),
    wheel: {
      finale,
      spin: spinning || sector ? { spinId: "anteprima-giro", targetIndex: sectorIndex, startedAt: iso(t0 - (spinning ? p.spinAt : 20_000)), durationMs: 7000 } : null,
      restIndex: sector ? sectorIndex : 2,
    },
    turn: hasTurn
      ? {
          competitorId: ID(1),
          playId: ID(9),
          no: 1,
          of: 4,
          risk: p.phase === "CHOICE" ? null : "rosso",
          sector,
          jolly: sector === "jolly" ? { offer: true, duplicate: false, chosen: null } : null,
          colpo: sector === "colpo" ? { offered: true, accepted: null } : null,
          bonus: sector === "bonus",
          lampo: false,
        }
      : null,
    question:
      p.phase === "QUESTION" || p.phase === "TURN_RESULT"
        ? {
            playId: ID(9),
            pool: "ruota",
            kind: "indizi",
            category: null,
            prompt: "Quale di questi film ha vinto l'Oscar come Miglior Film?",
            clues: [],
            visual: null,
            imageUrl: null,
            imageAlt: null,
            options: ["La La Land", "Oppenheimer", "Interstellar", "Joker"],
            clueLevel: 0,
            clueCount: 0,
            extraClue: null,
            pointsAtStake: 400,
            timer: { startedAt: iso(t0 - 4000), deadlineAt: iso(t0 + 26_000), totalMs: 30_000 },
          }
        : null,
    result:
      p.phase === "TURN_RESULT"
        ? { playId: ID(9), competitorId: ID(1), correct: p.correct, timeout: false, given: p.correct ? "Oppenheimer" : "Joker", solution: "Oppenheimer", explanation: null, lines: [{ label: p.correct ? "Risposta giusta (ROSSO)" : "Penalità ROSSO", delta: p.correct ? 400 : -150 }], delta: p.correct ? 400 : -150, shieldUsed: false }
        : null,
    stagePlay:
      p.phase === "PLAY"
        ? {
            stage: (stage ?? "tabellone") as NonNullable<PublicState["stage"]>,
            simultaneous: true,
            timer: { startedAt: iso(t0 - 5000), deadlineAt: iso(t0 + 55_000), totalMs: 60_000 },
            competitorId: null,
            turnNo: 1,
            turnOf: 1,
            common: stage === "tabellone" ? { tabellone: { category: "Modo di dire", rows: board } } : stage === "collegamento" ? { collegamento: { words: ["CHIAVE", "NOTA", "PENTAGRAMMA"] } } : null,
            competitors: competitors.map((c) => c.id),
          }
        : null,
    reveal: p.phase === "REVEAL" ? { stage: (stage ?? "tabellone") as NonNullable<PublicState["stage"]>, solutions: ["LA RUOTA GIRA!"], results: competitors.slice(0, 2).map((c) => ({ competitorId: c.id, items: [], points: 200 })), board: stage === "tabellone" ? { category: "Modo di dire", rows: solvedBoard } : null, tiebreakWinner: null } : null,
    winners: p.phase === "FINAL" ? [ID(1)] : [],
    event: null,
    estimate: { min: 20, max: 35 },
  };
}

function mockView(): PrivateView {
  return { me: { participantId: ID(5), nickname: NAMES[0], kind: "account" }, isHost: true, isOwner: true, competitorId: ID(1), captain: false, canAct: true, plays: [] };
}

export function StudioPreview(p: StudioPreviewProps) {
  const [t0] = useState(() => Date.now());
  const state = useMemo(() => mockState(p, t0), [p, t0]);
  const view = useMemo(() => mockView(), [p]);
  const studio = useStudio();
  const now = useMemo(() => () => Date.now(), []);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const on = () => setWide(window.innerWidth / Math.max(1, window.innerHeight) >= 1.2 && window.innerWidth >= 900);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  useEffect(() => {
    if (!p.say) return;
    const t = setTimeout(() => getGiramenteVoice().say([{ cue: { line: p.say! }, caption: p.say === "zafira-offerta" ? "Eccomi! Scegli un potere: Occhio Furbo o Scudo?" : "Benvenuti a GIRAMENTE! La ruota gira, la mente decide!" }], true), 600);
    return () => clearTimeout(t);
  }, [p.say]);

  if (!studio.on) return <p className="p-10 text-2xl font-bold">Studio 3D non disponibile qui (qualità {studio.quality}): aggiungi ?q=high o ?q=low.</p>;
  if (p.device === "tv") {
    return (
      <div className="relative flex h-dvh flex-col overflow-hidden">
        <StudioBackdrop state={state} now={now} quality={studio.quality} onFail={studio.fail} />
        <header className="relative z-10 flex items-center gap-4 bg-gradient-to-b from-[#080b0d]/90 to-transparent px-6 pb-3 pt-4">
          <Logo size="sm" />
          {state.roundNo > 0 && state.phase !== "FINAL" && <RoundBadge roundNo={state.roundNo} />}
          {state.roundName && state.phase !== "LOBBY" && state.phase !== "FINAL" && <p className="gm-display text-3xl">{state.roundName}</p>}
          {state.turn && !["ROUND_RESULTS", "FINAL", "REVEAL", "ROUND_INTRO"].includes(state.phase) && (
            <p className="gm-panel gm-panel-green gm-display ml-auto rounded-2xl px-4 py-1 text-3xl">TOCCA A {nameOf(state, state.turn.competitorId).toUpperCase()}</p>
          )}
        </header>
        <PausedBanner state={state} />
        <StudioTvHud state={state} now={now} live={false} />
      </div>
    );
  }
  return (
    <Shell state={state} view={view} roomId="anteprima" act={async () => false} studio={wide ? "fixed" : "scroll"}>
      <StudioBackdrop state={state} now={now} quality={studio.quality} onFail={studio.fail} />
      <StudioPlayerHud state={state} view={view} now={now} act={async () => false} busy={false} keyHints={p.device === "pc"} roomId="anteprima" wide={wide} error={null} clearError={() => undefined} />
    </Shell>
  );
}
