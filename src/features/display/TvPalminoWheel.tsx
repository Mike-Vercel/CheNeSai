"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import { useState } from "react";
import type { PublicRound, PublicWheel } from "@/lib/game-engine/types";
import { PALMINO_SWING_CONTACT_MS } from "@/lib/game-engine/palmino-wheel";
import { Character, CHARACTERS, Logo } from "@/features/game/components/brand";
import { WheelGraphic, wheelColor } from "@/features/game/components/wheel";
import { useHeldSpeech, useSpeaker } from "@/features/media/voice";
import { bleedStyle, CharacterStage, type StageBleed } from "@/features/three/characters/CharacterStage";
import { useCharacterMode } from "@/features/three/characters/character-mode";
import type { CharacterAnimation } from "@/features/three/characters/types";
import { TvFrame, useSpokenBubble } from "./TvScreens";
import { usePrefersReducedMotion, useWheelRotor, type WheelStage } from "./TvWheel";

/**
 * RUOTA DI PALMINO sul TV (16:9) e nello show verticale (telefono, 1080×1920).
 *
 * Fra una domanda e l'altra Palmino entra di corsa, si mette accanto alla ruota e la SPINGE: il
 * suo colpo (clip "spin" in 3D, salto animato in 2D) parte PALMINO_SWING_CONTACT_MS prima della
 * partenza decisa dal server, così la mano "trascina" il bordo proprio quando la ruota comincia a
 * girare (Palmino sta a destra della ruota: il colpo verso il basso la fa girare in senso orario).
 * La ruota usa lo stesso motore della Ruota impazzita (useWheelRotor: tic, frenata, fanfara e la
 * battuta "Tocca a… CATEGORIA!" quando si ferma); il risultato è lo stesso su ogni schermo.
 */

/** Spazio di disegno attorno a Palmino: braccio alzato nella carica e colpo verso la ruota. */
const PALMINO_BLEED: StageBleed = { left: 0.55, right: 0.25, top: 0.3 };

function palminoAnimation(stage: WheelStage, swung: boolean): CharacterAnimation {
  if (stage === "stopped") return "celebrate";
  if (swung && (stage === "swing" || stage === "spinning")) return "spin";
  return "point";
}

/** Palmino accanto alla ruota: modello 3D (con lip-sync) o illustrazione animata in 2D. */
function PalminoAtWheel({ animation, gestureKey, swing, className }: { animation: CharacterAnimation; gestureKey: string; swing: boolean; className?: string }) {
  const { mode, lowPower, fallback } = useCharacterMode();
  const talking = useSpeaker() === "palmino";
  const c = CHARACTERS.palmino;
  if (mode === "3d") {
    return (
      <div className={clsx("relative", className)} style={{ aspectRatio: `${c.w} / ${c.h}` }} data-testid="palmino-at-wheel" data-animation={animation}>
        <CharacterStage
          // appena girato verso la ruota (alla sua destra, a sinistra sullo schermo): girandolo di più
          // il braccio destro, quello che spinge, finirebbe dietro di lui
          cast={[{ who: "palmino", animation, gestureKey, rotationY: -0.12 }]}
          lowPower={lowPower}
          onFallback={fallback}
          style={bleedStyle(PALMINO_BLEED)}
          bleedTop={PALMINO_BLEED.top}
        />
      </div>
    );
  }
  return (
    <div className={clsx("relative", className, swing && "qz-palmino-swing")} style={{ transformOrigin: "50% 100%" }} data-testid="palmino-at-wheel" data-animation={animation}>
      <Character who="palmino" className={clsx("w-full", talking && !swing && "qz-talking")} />
    </div>
  );
}

/** Scia del colpo sul bordo destro della ruota (stesso sistema di coordinate della grafica). */
function Swoosh({ portrait }: { portrait: boolean }) {
  // bordo destro (landscape) o in basso a destra (verticale), nel verso del giro (orario)
  const d = portrait ? "M 108 22 A 110 110 0 0 1 40 103" : "M 92 -62 A 112 112 0 0 1 92 62";
  return (
    <svg viewBox="-112 -118 224 230" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <path d={d} pathLength={1} fill="none" stroke="#ffffff" strokeWidth={7} strokeLinecap="round" className="qz-swoosh" style={{ filter: "drop-shadow(0 0 6px rgba(255,214,90,.9))" }} />
      <path d={d} pathLength={1} fill="none" stroke="#ffd34d" strokeWidth={3} strokeLinecap="round" className="qz-swoosh" transform="scale(0.93)" />
    </svg>
  );
}

export function TvPalminoWheelScreen({
  wheel,
  round,
  now = Date.now,
  live = false,
  reducedMotion = false,
  lowPower = false,
  onCelebrate,
  portrait = false,
}: {
  wheel: PublicWheel;
  round: PublicRound | null;
  /** Ora del server (stimata dal client). */
  now?: () => number;
  /** true sullo schermo dello show: suoni e voce; false in regia (solo immagini). */
  live?: boolean;
  reducedMotion?: boolean;
  lowPower?: boolean;
  onCelebrate?: (intensity?: number) => void;
  /** show verticale (telefono) */
  portrait?: boolean;
}) {
  const prefersReduced = usePrefersReducedMotion();
  const reduced = reducedMotion || prefersReduced;
  const { stage, rotorRef, pointerRef } = useWheelRotor({ wheel, now, live, reduced, swingLeadMs: PALMINO_SWING_CONTACT_MS, onCelebrate });
  // il colpo si vede solo se lo schermo c'era quando Palmino l'ha dato (niente colpi dopo un ricaricamento)
  const [swung, setSwung] = useState(false);
  if (stage === "swing" && !swung) setSwung(true);
  const spin = wheel.spin;
  const labels = wheel.segments.map((s) => s.label);
  const winner = spin && stage === "stopped" ? wheel.segments[spin.winnerIndex] : null;
  const color = spin ? wheelColor(spin.winnerIndex) : null;
  const calm = lowPower || reduced;
  const animation = palminoAnimation(stage, swung);
  const swinging = swung && (stage === "swing" || stage === "spinning");
  // Palmino; e la battuta "Durante la ruota" anche se la dice un altro presentatore (con il suo nome)
  const said = useSpokenBubble((_, who, curated) => who === "palmino" || curated);
  const speaker = useHeldSpeech()?.who;
  const bubble = said && speaker && speaker !== "palmino" ? `${speaker === "regina" ? "Regina" : "Professore"}: ${said}` : said;
  const n = wheel.questionNumber;
  const status =
    stage === "ready" || stage === "idle" ? "Palmino prende la rincorsa…" : stage === "swing" ? "Via!" : stage === "spinning" ? "Gira… gira… gira!" : null;

  const wheelBox = (
    <>
      {!calm && (
        <div
          aria-hidden
          className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(255,214,90,.45),transparent_68%)] blur-[3cqh]"
          style={{ opacity: stage === "stopped" ? 1 : 0.55, transition: "opacity 600ms ease" }}
        />
      )}
      <WheelGraphic labels={labels} winnerIndex={winner && spin ? spin.winnerIndex : null} rotorRef={rotorRef} pointerRef={pointerRef} calm={calm} className="relative h-full w-full" />
      {swinging && !reduced && <Swoosh portrait={portrait} />}
    </>
  );

  const result = winner && color && (
    <motion.div
      initial={calm ? false : { scale: 0.3, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 170, damping: 11 }}
      className={clsx("flex flex-col gap-[1cqh]", portrait ? "items-center" : "items-start")}
      data-testid="palmino-wheel-result"
    >
      <span className={clsx("font-display text-white/90", portrait ? "text-[6cqw]" : "text-[4cqh]")}>Tocca a…</span>
      <span
        className={clsx(
          "max-w-full break-words rounded-[2.4cqh] border-[0.6cqh] border-white font-display leading-[1.05] shadow-[0_1.2cqh_0_rgba(0,0,0,.35)]",
          portrait ? "px-[5cqw] py-[2cqw] text-[10cqw]" : "max-w-[34cqw] px-[3cqh] py-[1.2cqh] text-[7.6cqh]",
        )}
        style={{ background: color.bg, color: color.text }}
      >
        {winner.label}
      </span>
      <span className={clsx("font-extrabold text-white/85", portrait ? "text-[4.2cqw]" : "text-[2.8cqh]")}>La prossima domanda è di questa categoria!</span>
    </motion.div>
  );

  const statusLine = status && (
    <motion.p
      key={status}
      initial={calm ? false : { opacity: 0, y: 8 }}
      animate={calm || stage !== "spinning" ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: [1, 1.06, 1] }}
      transition={stage === "spinning" ? { repeat: Infinity, duration: 0.7 } : { duration: 0.3 }}
      className={clsx("font-display text-gold [text-shadow:0_0.5vh_0_#6b1020]", portrait ? "text-[8cqw]" : "origin-left text-[4.8cqh]")}
    >
      {status}
    </motion.p>
  );
  // in 2D l'illustrazione ha le braccia spalancate: un po' più piccola, per non coprire la ruota
  const flat = useCharacterMode().mode !== "3d";

  const header = (
    <>
      <span
        className={clsx(
          "inline-flex items-center rounded-full border-gold/70 bg-black/55 font-display leading-none text-white shadow-lg",
          portrait ? "border-[0.6cqw] px-[3.4cqw] py-[1cqw] text-[4.6cqw]" : "border-[0.35cqh] px-[2cqh] py-[0.5cqh] text-[3cqh]",
        )}
      >
        🎡 La Ruota di Palmino
      </span>
      <h1 className={clsx("font-display leading-[1.02] text-white [text-shadow:0_0.7vh_0_#6b1020,0_0_4vh_rgba(255,20,147,.55)]", portrait ? "text-center text-[7.6cqw]" : "text-[6.4cqh]")}>
        {n ? `Domanda ${n}:` : "La prossima domanda:"} la categoria la sceglie la ruota!
      </h1>
      {!portrait && statusLine}
    </>
  );

  if (portrait) {
    return (
      <TvFrame calm={stage === "spinning" || calm}>
        <div className="absolute inset-x-[5cqw] top-[calc(4.5cqh+env(safe-area-inset-top))] z-20 flex flex-col items-center gap-[1.4cqh] text-center" data-testid="palmino-wheel">
          <Logo size="lg" className="!h-[7cqh]" />
          {header}
        </div>
        <div className="absolute left-[2cqw] top-[26cqh] z-10 aspect-square w-[80cqw]">{wheelBox}</div>
        {/* Palmino in basso a destra: la mano sul bordo della ruota */}
        <motion.div
          initial={calm ? false : { x: "70%", y: "10%", rotate: 10 }}
          animate={{ x: 0, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 110, damping: 11 }}
          className={clsx("absolute z-20", flat ? "left-[64cqw] top-[56cqh] w-[34cqw]" : "left-[63cqw] top-[53cqh] w-[37cqw]")}
        >
          <PalminoAtWheel animation={animation} gestureKey={spin?.startedAt ?? "x"} swing={swinging} className="w-full" />
        </motion.div>
        {/* in verticale niente fumetto: copriva la ruota (la battuta si sente comunque) */}
        <div className="absolute inset-x-[5cqw] top-[78cqh] z-30 flex justify-center text-center">{result ?? statusLine}</div>
      </TvFrame>
    );
  }

  return (
    <TvFrame calm={stage === "spinning" || calm}>
      <div className="absolute left-[4cqw] top-[3cqh] z-20 flex w-[27cqw] flex-col items-start gap-[1.6cqh]" data-testid="palmino-wheel">
        <Logo size="tv" className="!h-[13cqh]" />
        {round && <span className="font-display text-[2.6cqh] text-white/75">Round {round.index} di {round.total} · {round.title}</span>}
        {header}
        <div className="mt-[1cqh]">{result}</div>
      </div>

      {/* la ruota, grande, al centro */}
      <div className="absolute left-[31cqw] top-1/2 z-10 aspect-square h-[86cqh] -translate-y-1/2">{wheelBox}</div>

      {/* Palmino arriva di corsa da destra e si mette accanto alla ruota, la mano sul bordo */}
      <motion.div
        initial={calm ? false : { x: "75%", rotate: 12 }}
        animate={{ x: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 110, damping: 11 }}
        className={clsx("absolute bottom-0 z-20", flat ? "left-[72cqw] w-[24cqw]" : "left-[68.5cqw] w-[29cqw]")}
      >
        <PalminoAtWheel animation={animation} gestureKey={spin?.startedAt ?? "x"} swing={swinging} className="w-full" />
      </motion.div>
      {bubble && (
        <motion.p
          initial={calm ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-[2cqw] top-[4cqh] z-30 max-w-[27cqw] rounded-[2cqh] border-[0.4cqh] border-gold bg-white px-[1.8cqh] py-[1cqh] text-[2.8cqh] font-extrabold leading-tight text-ink shadow-xl"
        >
          {bubble}
        </motion.p>
      )}
    </TvFrame>
  );
}
