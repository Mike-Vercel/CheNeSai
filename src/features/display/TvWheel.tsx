"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PublicRound, PublicWheel, PublicWheelSpin } from "@/lib/game-engine/types";
import { spinElapsedMs, tickCount, wheelRotationAt } from "@/lib/game-engine/wheel";
import { Logo } from "@/features/game/components/brand";
import { WheelGraphic, wheelColor } from "@/features/game/components/wheel";
import { getSoundEngine } from "@/features/media/audio-engine";
import { getVoice } from "@/features/media/voice";
import { stripAudioTags, wheelStopLine } from "@/features/game/script";
import { TalkingCharacter, TvFrame } from "./TvScreens";

type Stage = "idle" | "ready" | "spinning" | "stopped";

function stageAt(spin: PublicWheelSpin | null, elapsedMs: number): Stage {
  if (!spin) return "idle";
  if (elapsedMs < 0) return "ready";
  return elapsedMs >= spin.durationMs ? "stopped" : "spinning";
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(REDUCED_QUERY).matches : false),
    () => false,
  );
}

/** Deflessione della linguetta del puntatore dopo ogni spicchio (ms, gradi). */
const FLAP_MS = 140;
const FLAP_DEG = -16;
/** Fra due "tic" almeno questo intervallo: a piena velocità gli spicchi passano più in fretta del suono. */
const TICK_MIN_GAP_MS = 38;

/**
 * Ruota impazzita sul TV.
 * La posizione è una funzione PURA dell'ora del server (spin.startedAt + piano del giro):
 * ogni TV, anche ricaricato a metà, disegna lo stesso fotogramma e si ferma sullo spicchio
 * deciso dal server.
 */
export function TvWheelScreen({
  round,
  wheel,
  now = Date.now,
  live = false,
  reducedMotion = false,
  lowPower = false,
  onCelebrate,
}: {
  round: PublicRound;
  wheel: PublicWheel;
  /** Ora del server (stimata dal client). */
  now?: () => number;
  /** true sul TV: suoni e voce; false in regia (solo immagini). */
  live?: boolean;
  reducedMotion?: boolean;
  lowPower?: boolean;
  onCelebrate?: (intensity?: number) => void;
}) {
  const spin = wheel.spin;
  const labels = wheel.segments.map((s) => s.label);
  const n = labels.length;
  const prefersReduced = usePrefersReducedMotion();
  const reduced = reducedMotion || prefersReduced;
  const rotorRef = useRef<SVGGElement>(null);
  const pointerRef = useRef<SVGGElement>(null);
  const nowRef = useRef(now);
  const celebrateRef = useRef(onCelebrate);
  /** startedAt del giro di cui sono già partiti frenata, fanfara e voce (una volta sola). */
  const stopFiredRef = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>(() => stageAt(spin, spin ? spinElapsedMs(spin, now()) : 0));

  useEffect(() => {
    nowRef.current = now;
    celebrateRef.current = onCelebrate;
  }, [now, onCelebrate]);

  useEffect(() => {
    const rotor = rotorRef.current;
    const pointer = pointerRef.current;
    if (!rotor) return;
    if (!spin || n < 2) {
      rotor.setAttribute("transform", "rotate(0)");
      pointer?.removeAttribute("transform");
      return;
    }
    // ricaricato a giro finito: niente frenata né voce in ritardo
    if (stopFiredRef.current === null && spinElapsedMs(spin, nowRef.current()) > spin.durationMs + 1500) stopFiredRef.current = spin.startedAt;
    const eng = getSoundEngine();
    let raf = 0;
    let lastTick: number | null = null;
    let lastSoundAt = 0;
    let flapAt = -Infinity;
    const frame = () => {
      const elapsed = spinElapsedMs(spin, nowRef.current());
      const rot = wheelRotationAt(spin, elapsed);
      // movimento ridotto: la ruota resta ferma e "salta" al risultato (i tic si sentono lo stesso)
      const shown = reduced && elapsed < spin.durationMs ? 0 : rot;
      rotor.setAttribute("transform", `rotate(${shown.toFixed(3)})`);

      const tc = tickCount(rot, n);
      if (lastTick === null) lastTick = tc;
      else if (tc !== lastTick) {
        lastTick = tc;
        const t = performance.now();
        flapAt = t;
        if (live && t - lastSoundAt >= TICK_MIN_GAP_MS) {
          eng.play("wheelTick");
          lastSoundAt = t;
        }
      }
      if (pointer) {
        const since = performance.now() - flapAt;
        const a = !reduced && since < FLAP_MS ? FLAP_DEG * (1 - since / FLAP_MS) : 0;
        pointer.setAttribute("transform", `rotate(${a.toFixed(2)} 0 -106)`);
      }

      const st = stageAt(spin, elapsed);
      setStage((prev) => (prev === st ? prev : st));
      if (st === "stopped") {
        if (stopFiredRef.current !== spin.startedAt) {
          stopFiredRef.current = spin.startedAt;
          if (live) {
            eng.play("brake");
            setTimeout(() => eng.play("fanfare"), 280);
            const line = wheelStopLine({ wheel });
            if (line) void getVoice().say(line.who, line.text, { live: line.live });
            celebrateRef.current?.(0.8);
          }
        }
        pointer?.setAttribute("transform", "rotate(0 0 -106)");
        return; // ruota ferma: niente più fotogrammi
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spin, wheel, n, reduced, live]);

  const winner = spin && stage === "stopped" ? wheel.segments[spin.winnerIndex] : null;
  const winnerColor = spin ? wheelColor(spin.winnerIndex) : null;
  const stopLine = winner ? wheelStopLine({ wheel }) : null;
  const calm = lowPower || reduced;

  return (
    <TvFrame calm={stage === "spinning" || calm}>
      {/* logo e titolo del round */}
      <div className="absolute left-[4cqw] top-[3cqh] z-20">
        <Logo size="tv" className="!h-[15cqh]" />
      </div>
      <div className="absolute left-[4cqw] top-[21cqh] z-20 flex w-[38cqw] flex-col items-start gap-[1.6cqh]">
        <span className="inline-flex items-center rounded-full border-[0.35cqh] border-gold/70 bg-black/55 px-[2cqh] py-[0.5cqh] font-display text-[3cqh] leading-none text-white shadow-lg">
          Round {round.index} di {round.total} · Ruota impazzita
        </span>
        <h1 className="font-display text-[7cqh] leading-[1.02] text-white [text-shadow:0_0.7vh_0_#6b1020,0_0_4vh_rgba(255,20,147,.55)]">{round.title}</h1>
        {stage === "idle" && <p className="font-display text-[4.2cqh] text-gold">Tra poco si gira la ruota!</p>}
        {stage === "ready" && <p className="font-display text-[4.6cqh] text-gold">Pronti… si parte!</p>}
        {stage === "spinning" && (
          <motion.p
            animate={calm ? undefined : { scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 0.7 }}
            className="origin-left font-display text-[5.2cqh] text-gold [text-shadow:0_0.5vh_0_#6b1020]"
          >
            Gira… gira… gira!
          </motion.p>
        )}
        {winner && winnerColor && (
          <motion.div
            initial={calm ? false : { scale: 0.3, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 170, damping: 11 }}
            className="mt-[0.5cqh] flex flex-col items-start gap-[1cqh]"
          >
            <span className="font-display text-[3.6cqh] text-white/90">La ruota ha scelto:</span>
            <span
              className="max-w-[38cqw] rounded-[2.4cqh] border-[0.6cqh] border-white px-[3cqh] py-[1.2cqh] font-display text-[7.4cqh] leading-[1.05] shadow-[0_1.2cqh_0_rgba(0,0,0,.35)]"
              style={{ background: winnerColor.bg, color: winnerColor.text }}
            >
              {winner.label}
            </span>
          </motion.div>
        )}
      </div>

      {/* Palmino */}
      <motion.div
        initial={calm ? false : { y: "40%", rotate: -8 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 10 }}
        className="absolute bottom-0 left-[1cqw] z-10 w-[17cqw]"
      >
        <TalkingCharacter who="palmino" priority className="w-full" animation={stage === "stopped" ? "celebrate" : stage === "spinning" ? "surprised" : "point"} />
      </motion.div>
      {stopLine && (
        <motion.p
          initial={calm ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-[4cqh] left-[19cqw] z-20 max-w-[23cqw] rounded-[2cqh] border-[0.4cqh] border-gold bg-white px-[1.8cqh] py-[1cqh] text-[2.6cqh] font-extrabold leading-tight text-ink shadow-xl"
        >
          {stripAudioTags(stopLine.text)}
        </motion.p>
      )}

      {/* la ruota */}
      <div className="absolute right-[3cqw] top-1/2 z-10 aspect-square h-[92cqh] -translate-y-1/2">
        {!calm && (
          <div
            aria-hidden
            className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(255,214,90,.45),transparent_68%)] blur-[3cqh]"
            style={{ opacity: stage === "stopped" ? 1 : 0.55, transition: "opacity 600ms ease" }}
          />
        )}
        <WheelGraphic
          labels={labels}
          winnerIndex={stage === "stopped" && spin ? spin.winnerIndex : null}
          rotorRef={rotorRef}
          pointerRef={pointerRef}
          calm={calm}
          className="relative h-full w-full"
        />
      </div>
    </TvFrame>
  );
}
