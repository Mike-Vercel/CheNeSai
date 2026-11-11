"use client";

/* eslint-disable @next/next/no-img-element -- immagini statiche già precaricate in lobby (stessi URL di preloadIntroAssets) */

import { useEffect, useEffectEvent, useRef } from "react";
import { motion } from "motion/react";
import { BRAND_LAYERS, CHARACTERS, INTRO_FONT_FACE_CSS } from "./assets";
import { IntroOverlay, OVERLAY_CSS } from "./IntroOverlay";
import type { IntroTimelineState } from "./use-intro-timeline";
import { T, WALK, reached, wheelAngle, type Speaker } from "./timeline";
import type { RulesScoring } from "./rules";

export const FALLBACK_CSS = `
@keyframes qz-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes qz-chase{to{background-position:28px 0}}
@keyframes qz-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.2%)}}
@keyframes qz-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes qz-blink{0%,100%{opacity:.35}50%{opacity:1}}
.qz-fb-rays{position:absolute;left:50%;top:30%;width:240vmax;height:240vmax;transform:translate(-50%,-50%);
  background:repeating-conic-gradient(from 0deg,rgba(255,20,147,.55) 0deg 9deg,rgba(131,43,255,.35) 9deg 18deg);
  animation:qz-spin 60s linear infinite;
  -webkit-mask:radial-gradient(circle,#000 0%,rgba(0,0,0,.6) 25%,transparent 55%);mask:radial-gradient(circle,#000 0%,rgba(0,0,0,.6) 25%,transparent 55%);}
.qz-fb-bulbs{position:absolute;left:6%;right:6%;height:1.6cqh;border-radius:99px;
  background:radial-gradient(circle,#fff3c4 0 35%,rgba(255,212,59,.25) 36% 60%,transparent 62%) 0 0/28px 100% repeat-x;
  animation:qz-chase .6s linear infinite;filter:drop-shadow(0 0 6px #ffd43b);}
@keyframes qz-crowd{0%,100%{transform:translateY(0)}50%{transform:translateY(-14%)}}
.qz-fb-crowd{position:absolute;left:0;right:0;bottom:0;height:22%;display:flex;align-items:flex-end;gap:.25cqw;filter:drop-shadow(0 -.4cqh .8cqh rgba(255,20,147,.35));pointer-events:none}
.qz-fb-crowd i{flex:1;height:var(--h);background:radial-gradient(circle at 50% 22%,#2a1240 0 17%,transparent 18%),radial-gradient(ellipse at 50% 100%,#2a1240 0 55%,transparent 56%);}
.qz-fb-crowd.c1 i{animation:qz-crowd .32s ease-in-out infinite}
.qz-fb-crowd.c2 i{animation:qz-crowd .24s ease-in-out infinite}
.qz-fb-crowd i:nth-child(2n){animation-delay:-.11s}.qz-fb-crowd i:nth-child(3n){animation-delay:-.2s}
.qz-fb-char{position:absolute;bottom:0;filter:drop-shadow(0 0 2.2cqh rgba(255,255,255,.18)) drop-shadow(0 1.5cqh 2cqh rgba(0,0,0,.5));}
.qz-fb-idle{animation:qz-bob 3.2s ease-in-out infinite;}
.qz-fb-emblem{position:absolute;aspect-ratio:1600/1491;}
.qz-fb-emblem img{position:absolute;pointer-events:none;user-select:none;}
.qz-fb-glow{position:absolute;inset:-25%;background:radial-gradient(circle,rgba(255,200,110,.75) 0%,rgba(255,40,160,.35) 35%,rgba(131,43,255,.1) 60%,transparent 72%);}
.qz-fb-pulse{animation:qz-pulse .45s ease-in-out infinite;}
.qz-fb-pointer{position:absolute;left:48.25%;top:8.4%;width:3.2%;aspect-ratio:1/2.6;transform:translateX(-50%);
  background:linear-gradient(90deg,#b8740c,#ffe28a 45%,#d99a1a);clip-path:polygon(50% 100%,0 30%,10% 8%,50% 0,90% 8%,100% 30%);
  filter:drop-shadow(0 .4cqh .6cqh rgba(0,0,0,.6));}
.qz-fb-wedge{position:absolute;left:48.25%;top:53.66%;width:71.8%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;
  background:conic-gradient(from -22.5deg,rgba(255,236,150,.22) 0deg 45deg,transparent 45deg);animation:qz-blink .33s ease-in-out infinite;mix-blend-mode:screen;}
`;

// geometria dell'emblema (percentuali sul riquadro 1600×1491)
const WHEEL_LEFT = (772 / 1600) * 100;
const WHEEL_TOP = (800 / 1491) * 100;
const WEDGE_W = ((2 * 646 * 0.868 * 1.024) / 1600) * 100;
const RIM_W = ((2 * 646 * 1.00385) / 1600) * 100;

/** Ruota che gira guidata dal tempo del server (stessa funzione della scena 3D). */
function SpinningWheel({ startedAtMs, now }: { startedAtMs: number; now: () => number }) {
  const ref = useRef<HTMLImageElement>(null);
  const readNow = useEffectEvent(() => now());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = (readNow() - startedAtMs) / 1000;
      const el = ref.current;
      if (el) el.style.transform = `translate(-50%,-50%) rotate(${wheelAngle(t)}rad)`;
      // a ruota ferma basta aggiornare di rado
      raf = t > T.wheelStop + 1 ? 0 : requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startedAtMs]);
  return (
    <img
      ref={ref}
      src={BRAND_LAYERS.wheel}
      alt=""
      style={{ left: `${WHEEL_LEFT}%`, top: `${WHEEL_TOP}%`, width: `${WEDGE_W}%`, transform: "translate(-50%,-50%)" }}
      draggable={false}
    />
  );
}

/**
 * Intro 2D (DOM/CSS) con lo STESSO storyboard della scena 3D: si usa se WebGL non
 * è disponibile, se il contesto si perde o se la scena 3D va in errore.
 */
export function IntroFallback2D({
  state,
  reducedMotion = false,
  startedAtMs,
  now,
  scoring,
  portrait = false,
}: {
  state: IntroTimelineState;
  reducedMotion?: boolean;
  startedAtMs: number;
  now: () => number;
  scoring?: RulesScoring;
  portrait?: boolean;
}) {
  const { phase } = state;
  const shown = reached(phase, "wheel");
  const back = reached(phase, "logoBack");
  const stopped = phase === "stop";
  const title = reached(phase, "title");
  const announcer = phase === "title";
  const chars = reached(phase, "entrance");
  // ritardi dell'ingresso solo se lo si vede "dal vivo" (una TV che ricarica dopo li salta)
  const live = phase === "entrance";
  const dReg = live ? WALK.reginaFrom - WALK.profFrom : 0;
  const dPalm = live ? T.palminoDrop - T.entrance : 0;
  const speaker: Speaker | null = state.speaker;
  // "zoom" su chi parla: si ingrandisce e si sposta verso il centro, gli altri si attenuano
  const ZOOM: Record<Speaker, { x?: string; y: string; scale: number }> = {
    professore: { x: "14%", y: "-3%", scale: 1.2 },
    regina: { x: "-14%", y: "-3%", scale: 1.2 },
    palmino: { y: "-6%", scale: 1.22 },
  };
  // lo stacco su chi parla vale solo per le regole; nella presentazione restano tutti in campo
  const zooming = state.rule !== null;
  // Palmino è centrato con translateX(-50%) nello style: a lui non si anima mai "x"
  const emph = (id: Speaker) => {
    const { x, ...rest } = emphAll(id);
    return id === "palmino" ? rest : { x, ...rest };
  };
  const emphAll = (id: Speaker): { x?: string; y: string; scale: number; filter: string } =>
    reducedMotion || !zooming
      ? { scale: 1, y: "0%", x: "0%", filter: speaker === null || speaker === id ? "brightness(1)" : "brightness(0.85)" }
      : speaker === id
        ? { ...ZOOM[id], filter: "brightness(1.05)" }
        : speaker === null
          ? { scale: 1, x: "0%", y: "0%", filter: "brightness(1)" }
          : { scale: 0.94, x: "0%", y: "0%", filter: "brightness(0.72)" };

  return (
    <div className="qz-intro absolute inset-0 overflow-hidden bg-[#0b0314]">
      <style>{INTRO_FONT_FACE_CSS + OVERLAY_CSS + FALLBACK_CSS}</style>

      {/* fondale: si accende quando l'emblema va in fondo */}
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: back ? 1 : 0.25 }} transition={{ duration: 1.2 }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, #7a1a8f 0%, #3a0a5c 38%, #170824 75%)" }} />
        {!reducedMotion && <div className="qz-fb-rays" />}
        <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: "linear-gradient(180deg, transparent, rgba(8,124,255,0.25) 40%, #12041f 100%)" }} />
        <div className="qz-fb-bulbs top-[2%]" />
        <div className="qz-fb-bulbs bottom-[2%]" />
      </motion.div>

      {/* emblema: grande al centro (ruota che gira), poi piccolo in alto */}
      <motion.div
        className="qz-fb-emblem left-1/2"
        initial={false}
        animate={
          !shown
            ? { opacity: 0, scale: 0.2, height: "78%", top: "11%", x: "-50%" }
            : back
              ? { opacity: 1, scale: 1, height: "34%", top: "3%", x: "-50%" }
              : { opacity: 1, scale: 1, height: "78%", top: "11%", x: "-50%" }
        }
        transition={reducedMotion ? { duration: 0.4 } : { type: "spring", stiffness: 90, damping: 15 }}
      >
        <div className={`absolute inset-0 ${announcer && !reducedMotion ? "qz-fb-pulse" : ""}`}>
          <div className="qz-fb-glow" />
          <SpinningWheel startedAtMs={startedAtMs} now={now} />
          {stopped && !reducedMotion && <div className="qz-fb-wedge" />}
          <img src={BRAND_LAYERS.rimBulbs} alt="" style={{ left: `${WHEEL_LEFT}%`, top: `${WHEEL_TOP}%`, width: `${RIM_W}%`, transform: "translate(-50%,-50%)" }} draggable={false} />
          {/* puntatore dorato in cima alla cornice */}
          <div className="qz-fb-pointer" />
          {/* scritta + lampadina + pulsante: entrano di colpo sul titolo */}
          <motion.div
            className="absolute inset-0"
            style={{ transformOrigin: `${WHEEL_LEFT}% ${WHEEL_TOP}%` }}
            initial={false}
            animate={title ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.1, rotate: 20 }}
            transition={reducedMotion ? { duration: 0.3 } : { type: "spring", stiffness: 380, damping: 11 }}
          >
            <img src={BRAND_LAYERS.front} alt="CHE NE SAI?!" className="inset-0 h-full w-full" draggable={false} />
          </motion.div>
        </div>
      </motion.div>

      {/* i tre personaggi entrano insieme */}
      <motion.div
        className={portrait ? "qz-fb-char left-[-5%] h-[36%]" : "qz-fb-char left-[1%] h-[60%]"}
        initial={false}
        animate={chars ? { opacity: 1, ...emph("professore") } : { x: "-130%", opacity: 1 }}
        style={{ transformOrigin: "50% 100%", ...(portrait ? { bottom: "21%" } : {}) }}
        transition={reducedMotion ? { duration: 0.4 } : { type: "spring", stiffness: 60, damping: 14 }}
      >
        <img src={CHARACTERS.professore.src} alt="Il Professore" className={`h-full w-auto ${reducedMotion ? "" : "qz-fb-idle"}`} draggable={false} />
      </motion.div>
      <motion.div
        className={portrait ? "qz-fb-char right-[-5%] h-[33%]" : "qz-fb-char right-[0%] h-[56%]"}
        initial={false}
        animate={chars ? { opacity: 1, ...emph("regina") } : { x: "130%", opacity: 1 }}
        style={{ transformOrigin: "50% 100%", ...(portrait ? { bottom: "23%" } : {}) }}
        transition={reducedMotion ? { duration: 0.4 } : { type: "spring", stiffness: 60, damping: 14, delay: dReg }}
      >
        <img src={CHARACTERS.regina.src} alt="La Regina" className={`h-full w-auto ${reducedMotion ? "" : "qz-fb-idle"}`} draggable={false} />
      </motion.div>
      <motion.div
        className={portrait ? "qz-fb-char left-1/2 h-[22%]" : "qz-fb-char left-1/2 h-[42%]"}
        style={{ translateX: "-50%", transformOrigin: "50% 100%", ...(portrait ? { bottom: "17%" } : {}) }}
        initial={false}
        animate={chars ? { rotate: 0, opacity: 1, ...emph("palmino") } : { y: "-260%", rotate: -360, opacity: 1 }}
        transition={reducedMotion ? { duration: 0.4 } : { type: "spring", stiffness: 140, damping: 11, delay: dPalm }}
      >
        <img src={CHARACTERS.palmino.src} alt="Palmino" className="h-full w-auto" draggable={false} />
      </motion.div>

      {/* pubblico ad arena: fascia curva di sagome (più alta ai lati), rimbalza quando applaude */}
      {back && (
        <div className={`qz-fb-crowd ${reducedMotion ? "" : state.crowd === 2 ? "c2" : state.crowd === 1 ? "c1" : ""}`}>
          {Array.from({ length: 34 }, (_, i) => {
            const u = Math.abs(i / 33 - 0.5) * 2; // 0 al centro, 1 ai lati
            // al centro le sagome si abbassano (non coprono Palmino), ai lati risalgono come gradinate
            const h = 22 + 78 * Math.pow(u, 1.6) + ((i * 37) % 11);
            return <i key={i} style={{ ["--h" as string]: `${Math.min(100, h)}%` }} />;
          })}
        </div>
      )}

      <IntroOverlay state={state} reducedMotion={reducedMotion} scoring={scoring} portrait={portrait} />
    </div>
  );
}
