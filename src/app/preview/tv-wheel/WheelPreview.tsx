"use client";

import { useState } from "react";
import type { PublicRound, PublicWheel } from "@/lib/game-engine/types";
import { buildSpinPlan, WHEEL_DURATION_MS, WHEEL_LEAD_MS, WHEEL_TURNS } from "@/lib/game-engine/wheel";
import { TvWheelScreen } from "@/features/display/TvWheel";
import { getSoundEngine } from "@/features/media/audio-engine";

const LABELS = ["Cinema", "Musica anni '80", "Sport", "Geografia", "Cucina italiana", "Storia", "Scienza e natura", "Televisione"];
const ROUND: PublicRound = {
  id: "preview-wheel",
  index: 3,
  total: 5,
  title: "Gira la ruota!",
  kind: "category_wheel",
  presenter: "palmino",
  description: null,
  pointsMultiplier: 1,
  penaltyMultiplier: 1,
  noPenalty: false,
};

/** Giro di prova generato nel browser (in diretta lo decide il server con il comando GIRA LA RUOTA). */
function makeWheel(n: number, winner: number | null, at: number): PublicWheel {
  const segments = LABELS.slice(0, n).map((label, i) => ({ id: `w${i}`, position: i, label }));
  const w = winner !== null && winner >= 0 && winner < n ? winner : Math.floor(Math.random() * n);
  const plan = buildSpinPlan(n, w, {
    turns: WHEEL_TURNS.min + Math.floor(Math.random() * (WHEEL_TURNS.max - WHEEL_TURNS.min + 1)),
    landing: 0.2 + Math.random() * 0.6,
    durationMs: WHEEL_DURATION_MS.min + Math.floor(Math.random() * (WHEEL_DURATION_MS.max - WHEEL_DURATION_MS.min + 1)),
  });
  return {
    roundId: ROUND.id,
    segments,
    spin: { startedAt: new Date(at + WHEEL_LEAD_MS).toISOString(), durationMs: plan.durationMs, turns: plan.turns, landing: plan.landing, rotationDeg: plan.rotationDeg, winnerIndex: plan.winnerIndex, winnerOptionId: `w${plan.winnerIndex}`, frozenElapsedMs: null },
  };
}

export function WheelPreview({ segments, winner, lowPower, reducedMotion, audio }: { segments: number; winner: number | null; lowPower: boolean; reducedMotion: boolean; audio: boolean }) {
  const [wheel, setWheel] = useState<PublicWheel>(() => ({ roundId: ROUND.id, segments: LABELS.slice(0, segments).map((label, i) => ({ id: `w${i}`, position: i, label })), spin: null }));
  const spin = () => {
    if (audio) void getSoundEngine().unlock();
    setWheel(makeWheel(segments, winner, Date.now()));
  };
  return (
    <div className="relative">
      <div className="relative aspect-video w-full overflow-hidden bg-night [container-type:size]">
        <TvWheelScreen key={wheel.spin?.startedAt ?? "idle"} round={ROUND} wheel={wheel} live={audio} lowPower={lowPower} reducedMotion={reducedMotion} />
      </div>
      <button type="button" onClick={spin} className="absolute bottom-3 right-3 z-50 rounded-xl bg-gold px-4 py-2 font-display text-ink shadow-lg">
        GIRA LA RUOTA
      </button>
    </div>
  );
}
