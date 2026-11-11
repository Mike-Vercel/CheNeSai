"use client";

import { useEffect, useState } from "react";
import type { PublicRound, PublicWheel } from "@/lib/game-engine/types";
import { buildSpinPlan, WHEEL_DURATION_MS, WHEEL_TURNS } from "@/lib/game-engine/wheel";
import { PALMINO_WHEEL_LEAD_MS, palminoSegmentId } from "@/lib/game-engine/palmino-wheel";
import { TvPalminoWheelScreen } from "@/features/display/TvPalminoWheel";
import { PhoneWheelView } from "@/features/players/PlayerScreens";
import { getSoundEngine } from "@/features/media/audio-engine";

const LABELS = ["Cinema", "Musica", "Sport", "Geografia", "Cucina", "Storia", "Scienza", "Arte"];
const ROUND: PublicRound = {
  id: "preview-palmino",
  index: 2,
  total: 3,
  title: "Secondo round",
  kind: "standard",
  presenter: "regina",
  description: null,
  pointsMultiplier: 1,
  penaltyMultiplier: 1,
  noPenalty: false,
};

/** Giro di prova generato nel browser (in diretta lo decide il server con MOSTRA DOMANDA). */
function makeWheel(n: number, winner: number | null, at: number, frozen: number | null): PublicWheel {
  const w = winner !== null && winner >= 0 && winner < n ? winner : Math.floor(Math.random() * n);
  const plan = buildSpinPlan(n, w, {
    turns: WHEEL_TURNS.min + Math.floor(Math.random() * (WHEEL_TURNS.max - WHEEL_TURNS.min + 1)),
    landing: 0.2 + Math.random() * 0.6,
    durationMs: WHEEL_DURATION_MS.min + Math.floor(Math.random() * (WHEEL_DURATION_MS.max - WHEEL_DURATION_MS.min + 1)),
  });
  return {
    roundId: ROUND.id,
    kind: "palmino",
    questionNumber: 7,
    segments: LABELS.slice(0, n).map((label, i) => ({ id: palminoSegmentId(i), position: i, label })),
    spin: {
      startedAt: new Date(at + PALMINO_WHEEL_LEAD_MS).toISOString(),
      durationMs: plan.durationMs,
      turns: plan.turns,
      landing: plan.landing,
      rotationDeg: plan.rotationDeg,
      winnerIndex: plan.winnerIndex,
      winnerOptionId: palminoSegmentId(plan.winnerIndex),
      frozenElapsedMs: frozen,
    },
  };
}

export function PalminoWheelPreview({
  segments,
  winner,
  lowPower,
  reducedMotion,
  audio,
  layout,
  at,
}: {
  segments: number;
  winner: number | null;
  lowPower: boolean;
  reducedMotion: boolean;
  audio: boolean;
  layout: "landscape" | "portrait" | "phone";
  /** fotogramma fisso: millisecondi dalla partenza del giro (negativi = prima del colpo) */
  at: number | null;
}) {
  const [wheel, setWheel] = useState<PublicWheel>(() => makeWheel(segments, winner, Date.now(), at === null ? null : at));
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (layout !== "phone") return;
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, [layout]);
  const spin = () => {
    if (audio) void getSoundEngine().unlock();
    setWheel(makeWheel(segments, winner, Date.now(), null));
  };
  if (layout === "phone") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-night p-4 text-white">
        <PhoneWheelView wheel={wheel} nowMs={nowMs} />
        <button type="button" onClick={spin} className="mt-4 rounded-xl bg-gold px-4 py-2 font-display text-ink">
          RIGIRA
        </button>
      </div>
    );
  }
  const portrait = layout === "portrait";
  return (
    <div className="relative">
      <div className={portrait ? "relative mx-auto aspect-[9/16] h-[100dvh] overflow-hidden bg-night [container-type:size]" : "relative aspect-video w-full overflow-hidden bg-night [container-type:size]"}>
        <TvPalminoWheelScreen key={wheel.spin?.startedAt} portrait={portrait} round={ROUND} wheel={wheel} live={audio} lowPower={lowPower} reducedMotion={reducedMotion} />
      </div>
      <button type="button" onClick={spin} className="absolute bottom-3 left-3 z-50 rounded-xl bg-gold px-4 py-2 font-display text-ink shadow-lg">
        RIGIRA
      </button>
    </div>
  );
}
