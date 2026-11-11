"use client";
/* eslint-disable @next/next/no-img-element -- media delle domande serviti tramite URL firmati temporanei */

import { clsx } from "clsx";
import { motion } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  GamePhase,
  LeaderboardEntry,
  Presenter,
  PublicBetHighlight,
  PublicBets,
  PublicEvent,
  PublicQuestion,
  PublicRound,
  PublicShowLine,
  PublicState,
  PublicVote,
} from "@/lib/game-engine/types";
import { AnswerBar, ANSWER_STYLES, LETTERS, type AnswerVisual } from "@/features/game/components/answers";
import { Character, CHARACTERS, Logo } from "@/features/game/components/brand";
import { SpeechBubble, TimerRing } from "@/features/game/components/effects";
import { getVoice, useHeldSpeech, useSpeaker } from "@/features/media/voice";
import { getSoundEngine } from "@/features/media/audio-engine";
import { podiumExtraLines, podiumPlan } from "@/features/game/script";
import { BET_TIER_LABEL, fmt } from "@/lib/game-engine/special-rounds";
import { bleedStyle, CharacterStage, type StageBleed } from "@/features/three/characters/CharacterStage";

/** Spazio di disegno attorno al personaggio del TV: braccia e gesti non vengono tagliati. */
const TV_BLEED: StageBleed = { left: 0.4, right: 0.25, top: 0.2 };
import { useCharacterMode } from "@/features/three/characters/character-mode";
import type { CharacterAnimation } from "@/features/three/characters/types";
import { EVENT_ICON, formatPoints, isQuestionQuip, ROUND_KIND_LABEL, signedPoints, stripAudioTags } from "@/features/game/lines";
import { presenterCue, type PresenterCue } from "./presenter-cue";
import { TrioSlot } from "./TvTrio";
import { TrophyMoment } from "./Trophy";
import { wrongPenaltyRange } from "@/lib/game-engine/scoring";

/**
 * Personaggio del TV: modello 3D animato (con lip-sync) quando il PC lo regge,
 * altrimenti l'illustrazione originale che "parla" a ritmo della voce.
 * Memorizzato (props tutte primitive): il conto alla rovescia (5 render al secondo) e i
 * sondaggi dello stato non rifanno il render della scena 3D.
 */
export const TalkingCharacter = memo(function TalkingCharacter(props: React.ComponentProps<typeof Character> & { animation?: CharacterAnimation }) {
  const { animation = "idle", ...imgProps } = props;
  const speaker = useSpeaker();
  const { mode, lowPower, fallback } = useCharacterMode();
  const talking = speaker === props.who;
  if (mode === "3d") {
    const c = CHARACTERS[props.who];
    const cls = (props.className ?? "").replace(/animate-float\S*/g, "");
    return (
      <div className={clsx("relative", cls)} style={{ aspectRatio: `${c.w} / ${c.h}` }}>
        <CharacterStage cast={[{ who: props.who, animation }]} lowPower={lowPower} onFallback={fallback} style={bleedStyle(TV_BLEED)} bleedTop={TV_BLEED.top} />
      </div>
    );
  }
  const cls = (imgProps.className ?? "").replace(/animate-float\S*/g, talking ? "" : "$&");
  return <Character {...imgProps} className={clsx(cls, talking && "qz-talking")} />;
});

/**
 * Fumetto: la battuta che il presentatore sta dicendo ADESSO (dall'inizio dell'audio a poco dopo la
 * fine), mai prima che parli né per le battute in coda. `accept` sceglie quali battute vanno nel
 * fumetto (es. sulla domanda solo i commenti, non il testo della domanda già sullo schermo).
 */
export function useSpokenBubble(accept: (text: string, who: Presenter) => boolean = () => true): string | null {
  const speech = useHeldSpeech();
  if (!speech) return null;
  // battute della libreria ufficiale (reazioni, tempo che scade…): sempre nel fumetto, con il testo scritto dall'utente
  if (speech.display === undefined && !accept(speech.text, speech.who)) return null;
  const t = speech.display ?? stripAudioTags(speech.text);
  return t.length > 0 ? t : null;
}

/** Testo del fumetto per una battuta del regista: quello scritto (libreria ufficiale) o il parlato senza tag. */
export const showLineBubble = (l: Pick<PublicShowLine, "text" | "display">) => l.display ?? stripAudioTags(l.text);

/** Chi è in scena durante i momenti del regista: chi dice la battuta, con la sua animazione. */
function useDirectedCue(host: Presenter, idle: CharacterAnimation, lines: readonly PublicShowLine[] | null | undefined): PresenterCue {
  return presenterCue(host, idle, lines, useHeldSpeech());
}

// ---------------------------------------------------------------------------
// Cornice dello studio (sfondo comune a tutte le schermate)
// ---------------------------------------------------------------------------
/**
 * Ovale colorato al 30% sfocato di `blur` px, disegnato con un gradiente radiale: il riquadro si
 * allarga di 2·blur per lato e le tappe seguono il profilo di una sfocatura gaussiana
 * (pieno fino a ~2σ dentro il bordo, metà sul bordo, quasi nullo a 2σ fuori).
 */
function spot(rgb: string, blur: number, box: { left?: string; right?: string; top?: string; bottom?: string; width: string; height: string }): React.CSSProperties {
  const pad = 2 * blur;
  const grow = (v: string | undefined) => (v === undefined ? undefined : `calc(${v} - ${pad}px)`);
  const c = (a: number) => `rgba(${rgb},${a})`;
  return {
    left: grow(box.left),
    right: grow(box.right),
    top: grow(box.top),
    bottom: grow(box.bottom),
    width: `calc(${box.width} + ${2 * pad}px)`,
    height: `calc(${box.height} + ${2 * pad}px)`,
    background: `radial-gradient(closest-side, ${c(0.3)} 0%, ${c(0.3)} 30%, ${c(0.27)} 45%, ${c(0.23)} 56%, ${c(0.17)} 66%, ${c(0.08)} 77%, ${c(0.03)} 88%, ${c(0)} 100%)`,
  };
}

export function TvFrame({ children, calm = false }: { children: ReactNode; calm?: boolean }) {
  return (
    <div className="qz-stage relative h-full w-full overflow-hidden">
      {/* spotlight colorati: sfumature radiali che imitano un ovale sfocato (blur 90–100 px) senza
          filtri, che costavano a ogni nuovo disegno dello sfondo */}
      <div aria-hidden className="absolute" style={spot("8,124,255", 90, { left: "-10cqw", top: "-20cqh", width: "40cqw", height: "70cqh" })} />
      <div aria-hidden className="absolute" style={spot("255,20,147", 90, { right: "-10cqw", top: "-20cqh", width: "40cqw", height: "70cqh" })} />
      <div aria-hidden className="absolute" style={spot("131,43,255", 100, { left: "20cqw", bottom: "-30cqh", width: "60cqw", height: "60cqh" })} />
      {/* raggi SOPRA le luci: così le luci (ferme) restano nello sfondo e la GPU, mentre i raggi
          girano, non deve ricomporre a ogni frame anche tre grandi livelli semitrasparenti */}
      <div aria-hidden className={clsx("qz-rays absolute -inset-[30%] opacity-70", !calm && "animate-spin-slow")} />
      {/* arco di lampadine */}
      <div aria-hidden className="absolute inset-x-[4cqw] top-[1.5cqh] h-[2.2cqh] qz-bulbs animate-marquee opacity-90" style={{ backgroundSize: "3.2cqh 2.2cqh" }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[24cqh] bg-gradient-to-t from-black/70 to-transparent" />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}

export function Pill({ children, tone = "gold", className }: { children: ReactNode; tone?: "gold" | "fuchsia" | "cyan" | "violet" | "dark"; className?: string }) {
  const tones = {
    gold: "bg-gradient-to-b from-[#fff2a8] to-gold text-ink border-[#b8770a]",
    fuchsia: "bg-gradient-to-b from-[#ff5fb3] to-fuchsia text-white border-[#a10d5e]",
    cyan: "bg-gradient-to-b from-[#7ff0ff] to-cyan text-ink border-[#008aa3]",
    violet: "bg-gradient-to-b from-[#b07dff] to-violet text-white border-[#4b10a8]",
    dark: "bg-black/55 text-white border-gold/70",
  } as const;
  return (
    <span className={clsx("inline-flex items-center gap-[0.8cqh] rounded-full border-[0.35cqh] px-[2cqh] py-[0.5cqh] font-display text-[3cqh] leading-none shadow-lg", tones[tone], className)}>
      {children}
    </span>
  );
}

export function questionTextSize(text: string): string {
  if (text.length <= 60) return "text-[6cqh]";
  if (text.length <= 110) return "text-[4.8cqh]";
  if (text.length <= 170) return "text-[3.9cqh]";
  return "text-[3.3cqh]";
}

// ---------------------------------------------------------------------------
// Schermata domanda (usata anche nell'anteprima del CMS)
// ---------------------------------------------------------------------------
export interface TvQuestionProps {
  question: PublicQuestion;
  round: PublicRound | null;
  phase: GamePhase;
  remainingMs: number;
  event: PublicEvent | null;
  mediaUrl: string | null;
  questionsPlayed: number;
  totalQuestions: number;
  audioState?: "idle" | "playing" | "done" | "error";
  /** battute del regista della fase (soluzione: reazione con la sua animazione) */
  showLines?: readonly PublicShowLine[] | null;
}

export function TvQuestionScreen({ question: q, round, remainingMs, event, mediaUrl, questionsPlayed, totalQuestions, audioState = "idle", showLines }: TvQuestionProps) {
  const revealed = !!q.correctPositions;
  const optionsVisible = !!q.options;
  const hasImage = q.media?.kind === "image" && mediaUrl;
  const hasVideo = q.media?.kind === "video" && mediaUrl;
  const isMusic = q.media?.kind === "audio";
  const visualMedia = hasImage || hasVideo;
  const totalMs = q.rules.durationSeconds * 1000;
  const showTimer = optionsVisible && !revealed;
  // Fumetto: solo mentre il presentatore dice un commento (mai prima, mai il testo della domanda)
  const line = useSpokenBubble((text) => isQuestionQuip(text));
  const totalAnswers = q.distribution?.reduce((a, b) => a + b, 0) ?? 0;
  const special = q.rules.special ?? null;
  const isBet = special?.kind === "bet";

  const visualFor = (pos: number): AnswerVisual => {
    if (!revealed) return "idle";
    return q.correctPositions!.includes(pos) ? "correct" : "dimmed";
  };

  return (
    <TvFrame calm={optionsVisible}>
      {/* logo */}
      <div className="absolute left-1/2 top-[1.5cqh] z-20 -translate-x-1/2">
        <Logo size="tv" className="!h-[16cqh]" />
      </div>

      {/* presentatore (non copre mai testo, risposte o timer) */}
      {!visualMedia && (
        <motion.div
          initial={{ x: "-30%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          className="absolute bottom-0 left-[0.5cqw] z-10 w-[32.5cqw]"
        >
          <TrioSlot host={q.presenter} className="w-full" animation={revealed ? "celebrate" : optionsVisible ? "point" : "idle"} lines={showLines} />
          {line && (
            <SpeechBubble className="absolute left-[3cqw] top-[-6cqh] max-w-[26cqw] text-[3cqh] leading-tight">{line}</SpeechBubble>
          )}
        </motion.div>
      )}

      {/* media visivo */}
      {visualMedia && (
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute left-[3cqw] top-[19cqh] z-10 flex h-[66cqh] w-[38cqw] items-center justify-center overflow-hidden rounded-[3cqh] border-[0.6cqh] border-gold bg-black shadow-2xl"
        >
          {hasImage && <img src={mediaUrl} alt="Immagine della domanda" className="h-full w-full object-contain" />}
          {hasVideo && <video src={mediaUrl} className="h-full w-full object-contain" autoPlay playsInline controls={false} />}
        </motion.div>
      )}
      {visualMedia && (
        <div className="absolute bottom-0 left-0 z-20 w-[17cqw]">
          <TrioSlot host={q.presenter} className="w-full" animation={revealed ? "celebrate" : "idle"} />
        </div>
      )}

      {/* colonna domanda */}
      <div className={clsx("absolute z-20 flex flex-col", visualMedia ? "left-[44cqw] right-[3cqw] top-[19cqh]" : "left-[34cqw] right-[3cqw] top-[19cqh]")}>
        <div className="mb-[1.6cqh] flex flex-wrap items-center gap-[1.2cqh] pr-[22cqh]">
          <Pill>
            Domanda {q.number} di {Math.max(totalQuestions, q.number)}
          </Pill>
          <Pill tone="dark">{q.category}</Pill>
          {q.type === "multiple" && <Pill tone="cyan">Più risposte corrette</Pill>}
          {round && round.kind !== "standard" && <Pill tone="violet">{ROUND_KIND_LABEL[round.kind]}</Pill>}
          {event && (
            <Pill tone="fuchsia" className="animate-pulse-glow">
              {EVENT_ICON[event.type]} {event.title}
            </Pill>
          )}
        </div>

        <motion.div
          key={q.id}
          initial={{ y: -30, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 18 }}
          className="qz-question-card relative rounded-[3.2cqh] px-[4cqh] py-[3.2cqh] pr-[22cqh]"
        >
          <p className={clsx("font-display leading-[1.12]", questionTextSize(q.text))}>{q.text}</p>
          {isMusic && !optionsVisible && (
            <div className="mt-[1.6cqh] flex items-center gap-[2cqh] text-[3cqh] font-extrabold text-violet">
              <Equalizer active={audioState === "playing"} />
              {audioState === "playing" ? "Ascoltate bene…" : audioState === "error" ? "Audio dalla regia" : "In ascolto"}
            </div>
          )}
          {!optionsVisible && !isMusic && !isBet && (
            <p className="mt-[1.6cqh] text-[2.6cqh] font-extrabold text-ink/60">Le risposte stanno per arrivare…</p>
          )}
        </motion.div>

        {showTimer || (optionsVisible && !revealed) ? (
          <div className="absolute right-[-1cqh] top-[3cqh]">
            {/* durante la lettura delle risposte il tempo resta pieno (parte a lettura finita) */}
            <TimerRing remainingMs={Math.min(remainingMs, totalMs)} totalMs={totalMs} size="21cqh" />
          </div>
        ) : (
          <div className="absolute right-[1cqh] top-[5cqh] grid h-[17cqh] w-[17cqh] place-items-center rounded-full border-[0.5cqh] border-gold bg-night text-center">
            <span className="font-display text-[3.4cqh] leading-none text-gold">
              {revealed ? "✓" : q.rules.durationSeconds}
              <span className="block text-[1.8cqh] text-white/80">{revealed ? "soluzione" : "secondi"}</span>
            </span>
          </div>
        )}

        {/* manche speciali: puntate (Scommetti tutto) e BOOST (Grande ribaltone) */}
        {isBet && !optionsVisible && <TvBetOpenPanel placed={q.bets?.placed ?? 0} />}
        {isBet && optionsVisible && q.bets?.distribution && <TvBetDistribution bets={q.bets} compact />}
        {special?.kind === "comeback" && !revealed && (
          <TvComebackStrip boost={special.boostMultiplier} boosted={special.boosted.map((b) => b.nickname)} penalty={special.leaderPenaltyMultiplier} leaders={special.leaders.map((l) => l.nickname)} compact={optionsVisible} />
        )}

        {/* regole annunciate (eventi, moltiplicatori) */}
        {!optionsVisible && !special && (q.rules.modifiers.length > 0 || q.rules.correctPoints !== 1000) && (
          <div className="mt-[2cqh] flex flex-wrap gap-[1.2cqh]">
            <Pill tone="dark">Vale {formatPoints(q.rules.correctPoints + q.rules.bonusPoints)} punti</Pill>
            {q.rules.wrongPenalty === 0 ? <Pill tone="dark">Nessuna penalità</Pill> : <Pill tone="dark">Errore da −{formatPoints(wrongPenaltyRange(q.rules.wrongPenalty).min)} a −{formatPoints(wrongPenaltyRange(q.rules.wrongPenalty).max)}</Pill>}
          </div>
        )}

        {optionsVisible && (
          <div className={clsx("mt-[2.4cqh] grid gap-[1.6cqh]", visualMedia ? "grid-cols-1" : "grid-cols-1")}>
            {q.options!.map((o, i) => (
              <AnswerBar
                key={o.position}
                position={o.position}
                text={o.text}
                visual={visualFor(o.position)}
                delayIndex={i}
                trailing={
                  revealed && q.distribution ? (
                    <span className="shrink-0 rounded-full bg-black/35 px-[1.6cqh] py-[0.4cqh] font-display text-[2.8cqh] text-white">
                      {totalAnswers > 0 ? Math.round((q.distribution[o.position] / totalAnswers) * 100) : 0}%
                    </span>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* barra inferiore */}
      <BottomTicker
        left={round ? `${round.title} · Round ${round.index}/${round.total}` : ""}
        right={
          isBet && !optionsVisible
            ? `${q.bets?.placed ?? 0} puntate ricevute`
            : q.answeredCount !== null && !revealed
              ? `${q.answeredCount} risposte ricevute`
              : `Domande giocate: ${questionsPlayed}`
        }
      />
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Manche speciali
// ---------------------------------------------------------------------------
const BET_PILL: Record<number, string> = {
  0: "border-white/40 bg-black/55 text-white",
  25: "border-cyan bg-[#063a46] text-white",
  50: "border-violet bg-[#2a0f5c] text-white",
  100: "border-[#ff4fa3] bg-[#7a0b45] text-[#ffd1e8]",
};

/** Scommetti tutto, prima delle risposte: si punta dal telefono. */
function TvBetOpenPanel({ placed }: { placed: number }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 14 }}
      className="mt-[2.4cqh] flex items-center gap-[3cqh] rounded-[3cqh] border-[0.5cqh] border-[#ff4fa3] bg-gradient-to-r from-[#3d0623]/95 to-[#1d0c30]/95 px-[3cqh] py-[2cqh] shadow-[0_0_5cqh_rgba(255,79,163,.45)]"
    >
      <span className="text-[9cqh] leading-none">🎰</span>
      <div className="flex-1">
        <p className="font-display text-[5.4cqh] leading-none text-gold">FATE IL VOSTRO GIOCO!</p>
        <p className="mt-[1cqh] text-[2.8cqh] font-extrabold text-white/90">
          Puntate dal telefono: niente, 25%, 50% o ALL IN. Giusta = vincete la posta, sbagliata = la perdete!
        </p>
      </div>
      <div className="grid h-[15cqh] w-[15cqh] shrink-0 place-items-center rounded-full border-[0.5cqh] border-gold bg-night text-center">
        <span className="font-display text-[5cqh] leading-none text-gold">
          {placed}
          <span className="block text-[1.8cqh] text-white/80">puntate</span>
        </span>
      </div>
    </motion.div>
  );
}

/** Quanti hanno puntato cosa e la posta totale in gioco (dopo la chiusura delle puntate). */
export function TvBetDistribution({ bets, compact = false }: { bets: PublicBets; compact?: boolean }) {
  if (!bets.distribution) return null;
  return (
    <div className={clsx("flex flex-wrap items-center gap-[1.2cqh]", compact ? "mt-[1.6cqh]" : "mt-[2cqh]")}>
      {bets.distribution.map((d) => (
        <span key={d.tier} className={clsx("inline-flex items-center gap-[1cqh] rounded-full border-[0.35cqh] px-[1.8cqh] py-[0.4cqh] font-display shadow-lg", BET_PILL[d.tier], compact ? "text-[2.4cqh]" : "text-[3cqh]")}>
          {d.tier === 0 ? "Non punto" : BET_TIER_LABEL[d.tier]}
          <span className="text-gold">{d.count}</span>
        </span>
      ))}
      {bets.totalStake !== null && (
        <span className={clsx("rounded-full border-[0.35cqh] border-gold bg-gradient-to-b from-[#fff2a8] to-gold px-[1.8cqh] py-[0.4cqh] font-display text-ink shadow-lg", compact ? "text-[2.4cqh]" : "text-[3cqh]")}>
          In gioco {formatPoints(bets.totalStake)}
        </span>
      )}
    </div>
  );
}

/** Grande ribaltone: chi ha il BOOST su questa domanda (e la penalità del capolista). */
function TvComebackStrip({ boost, boosted, penalty, leaders, compact }: { boost: number; boosted: string[]; penalty: number; leaders: string[]; compact: boolean }) {
  const shown = boosted.slice(0, compact ? 6 : 12);
  const more = boosted.length - shown.length;
  if (boosted.length === 0 && leaders.length === 0) {
    return (
      <div className="mt-[2cqh] flex flex-wrap gap-[1.2cqh]">
        <Pill tone="violet">🚀 Grande ribaltone: tutti a pari punti, nessun BOOST</Pill>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={clsx("flex flex-wrap items-center gap-[1cqh] rounded-[2.4cqh] border-[0.4cqh] border-lime/80 bg-[#0b3a22]/85", compact ? "mt-[1.6cqh] px-[1.6cqh] py-[0.8cqh]" : "mt-[2.4cqh] px-[2.4cqh] py-[1.6cqh]")}
    >
      {boosted.length > 0 && (
        <span className={clsx("font-display text-[#bfffdc]", compact ? "text-[2.8cqh]" : "text-[4cqh]")}>🚀 BOOST ×{fmt(boost)}</span>
      )}
      {shown.map((n) => (
        <span key={n} className={clsx("rounded-full border-[0.3cqh] border-lime/70 bg-black/40 px-[1.4cqh] py-[0.3cqh] font-extrabold text-white", compact ? "text-[2.2cqh]" : "text-[2.8cqh]")}>
          {n}
        </span>
      ))}
      {more > 0 && <span className={clsx("font-extrabold text-white/80", compact ? "text-[2.2cqh]" : "text-[2.8cqh]")}>+{more}</span>}
      {leaders.length > 0 && penalty > 1 && (
        <span className={clsx("ml-auto rounded-full border-[0.3cqh] border-gold bg-[#3a2b05] px-[1.4cqh] py-[0.3cqh] font-display text-gold", compact ? "text-[2.2cqh]" : "text-[2.8cqh]")}>
          👑 {leaders.slice(0, 2).join(", ")}: errori ×{fmt(penalty)}
        </span>
      )}
    </motion.div>
  );
}

function BetRow({ e, i, win }: { e: PublicBetHighlight; i: number; win: boolean }) {
  return (
    <motion.div
      initial={{ x: win ? -40 : 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 150, damping: 18 }}
      className={clsx(
        "flex items-center gap-[1.4cqh] rounded-[1.6cqh] border-[0.3cqh] px-[1.8cqh] py-[0.5cqh]",
        win ? "border-[#5dffab]/70 bg-[#0b3a22]/85" : "border-[#ff8098]/60 bg-[#3d0914]/80",
      )}
    >
      <span className="min-w-0 flex-1 truncate font-display text-[3cqh] text-white">{e.nickname}</span>
      <span className={clsx("rounded-full border-[0.3cqh] px-[1.2cqh] font-display text-[2cqh]", BET_PILL[e.tier])}>{e.tier === 0 ? "—" : BET_TIER_LABEL[e.tier]}</span>
      <span className={clsx("w-[14cqh] text-right font-display text-[3.2cqh]", win ? "text-[#5dffab]" : "text-[#ff8098]")}>{signedPoints(e.delta)}</span>
    </motion.div>
  );
}

/** Scommetti tutto dopo i punti: grandi vincite e grandi perdite della domanda. */
export function TvBetResultsScreen({ bets, who }: { bets: PublicBets; who: "professore" | "regina" | "palmino"; questionId?: string }) {
  const wins = bets.wins ?? [];
  const losses = bets.losses ?? [];
  // fumetto solo mentre la battuta viene detta
  const quip = useSpokenBubble();
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2">
        <Logo size="tv" />
      </div>
      <div className="absolute bottom-0 right-[0.5cqw] w-[34cqw]">
        <TrioSlot host={who} className="w-full" animation={wins.length > 0 ? "celebrate" : "surprised"} />
        {quip && (
          <SpeechBubble tail="right" className="absolute right-[6cqw] top-[-14cqh] w-[28cqw] text-[2.8cqh] leading-tight">
            {quip}
          </SpeechBubble>
        )}
      </div>
      <div className="absolute left-[5cqw] right-[37cqw] top-[20cqh]">
        <h1 className="font-display text-[5cqh] text-gold [text-shadow:0_0.5vh_0_#6b1020]">🎰 SCOMMETTI TUTTO: COM&apos;È ANDATA</h1>
        <TvBetDistribution bets={bets} />
        <div className="mt-[2.4cqh] grid grid-cols-2 gap-[2.4cqh]">
          <div className="flex flex-col gap-[0.8cqh]">
            <p className="font-display text-[3.4cqh] text-[#5dffab]">💰 GRANDI VINCITE</p>
            {wins.map((e, i) => (
              <BetRow key={e.participantId} e={e} i={i} win />
            ))}
            {wins.length === 0 && <p className="text-[2.6cqh] font-extrabold text-white/70">Nessuno ha vinto la posta!</p>}
          </div>
          <div className="flex flex-col gap-[0.8cqh]">
            <p className="font-display text-[3.4cqh] text-[#ff8098]">💥 CHE BATOSTA</p>
            {losses.map((e, i) => (
              <BetRow key={e.participantId} e={e} i={i} win={false} />
            ))}
            {losses.length === 0 && <p className="text-[2.6cqh] font-extrabold text-white/70">Nessuna perdita: tutti prudenti… o tutti bravi!</p>}
          </div>
        </div>
      </div>
    </TvFrame>
  );
}

function Equalizer({ active }: { active: boolean }) {
  return (
    <span className="flex h-[4cqh] items-end gap-[0.5cqh]" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[0.9cqh] rounded-full bg-gradient-to-t from-violet to-fuchsia"
          style={{
            height: active ? undefined : "30%",
            animation: active ? `qz-eq 0.${5 + i}s ease-in-out ${i * 0.07}s infinite alternate` : undefined,
          }}
        />
      ))}
      <style>{`@keyframes qz-eq{0%{height:20%}100%{height:100%}}`}</style>
    </span>
  );
}

export function BottomTicker({ left, right }: { left: string; right: string }) {
  return (
    <div className="absolute inset-x-[3cqw] bottom-[2cqh] z-30 flex items-center justify-between gap-[2cqh] text-[2.4cqh] font-extrabold text-white/85">
      {left ? <span className="truncate rounded-full bg-black/45 px-[1.6cqh] py-[0.4cqh]">{left}</span> : <span />}
      {right ? <span className="truncate rounded-full bg-black/45 px-[1.6cqh] py-[0.4cqh]">{right}</span> : <span />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lobby con QR code
// ---------------------------------------------------------------------------
/** Nomi mostrati in lobby (una o due righe), gli altri come "+N altri". */
const LOBBY_NAMES = 16;

export function TvLobbyScreen({ state, qrDataUrl, joinUrl, extra }: { state: PublicState; qrDataUrl: string | null; joinUrl: string; extra?: ReactNode }) {
  const ready = state.phase === "READY";
  return (
    <TvFrame>
      {/* logo ufficiale con i tre personaggi */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 90, damping: 14 }}
        className="absolute left-[3cqw] top-[7cqh] flex w-[56cqw] justify-center"
      >
        <Logo variant="full" size="tvxl" priority className="!h-[78cqh] animate-float" />
      </motion.div>

      <div className="absolute right-[4cqw] top-[7cqh] flex w-[34cqw] flex-col items-center gap-[2cqh]">
        <div className="flex w-full items-center justify-center gap-[2cqh] rounded-[3cqh] border-[0.5cqh] border-gold bg-night/80 px-[3cqh] py-[1.4cqh]">
          <span className="font-display text-[8cqh] leading-none text-gold">{state.playerCount}</span>
          <span className="text-[2.8cqh] font-extrabold uppercase leading-tight text-white/85">
            giocatori
            <br />
            collegati
          </span>
        </div>
        {ready ? (
          <div className="qz-panel mt-[6cqh] rounded-[3cqh] px-[4cqh] py-[4cqh] text-center">
            <p className="font-display text-[6cqh] leading-tight text-gold">Tra poco si comincia!</p>
            <p className="mt-[1.4cqh] text-[3cqh] font-extrabold text-white/85">Prendete posto, ordinate da bere e preparate lo smartphone</p>
          </div>
        ) : (
          <>
            <div className="rounded-[3cqh] border-[0.8cqh] border-gold bg-white p-[1.6cqh] shadow-[0_0_60px_rgba(255,212,59,.6)]">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR code per entrare: ${joinUrl}`} className="h-[42cqh] w-[42cqh]" />
              ) : (
                <div className="h-[42cqh] w-[42cqh] animate-pulse bg-ink/10" />
              )}
            </div>
            <p className="font-display text-[4.6cqh] leading-none text-white [text-shadow:0_4px_0_rgba(0,0,0,.4)]">Inquadra e gioca!</p>
            <p className="max-w-full truncate rounded-full bg-black/55 px-[2.4cqh] py-[0.8cqh] text-[2.4cqh] font-extrabold text-white">
              {joinUrl.replace(/^https?:\/\//, "")}
            </p>
            <p className="text-[2.6cqh] font-extrabold text-white/85">
              codice partita <span className="font-display text-[4cqh] tracking-[0.2em] text-gold">{state.code}</span>
            </p>
          </>
        )}
        {state.joinLocked && !ready && <Pill tone="fuchsia">Ingressi chiusi</Pill>}
      </div>

      {state.recentPlayers && state.recentPlayers.length > 0 && (
        <div className={clsx("absolute inset-x-[4cqw] flex flex-wrap justify-center gap-[1cqh]", extra ? "bottom-[9cqh]" : "bottom-[2.5cqh]")}>
          {state.recentPlayers.slice(0, LOBBY_NAMES).map((n, i) => (
            <motion.span
              key={n}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="max-w-[18cqw] truncate rounded-full border-[0.3cqh] border-gold/70 bg-violet/80 px-[1.8cqh] py-[0.5cqh] text-[2.4cqh] font-extrabold text-white"
            >
              {n}
            </motion.span>
          ))}
          {/* tanti giocatori: gli ultimi entrati per nome, gli altri contati */}
          {state.playerCount > Math.min(LOBBY_NAMES, state.recentPlayers.length) && (
            <span className="rounded-full border-[0.3cqh] border-white/40 bg-black/55 px-[1.8cqh] py-[0.5cqh] text-[2.4cqh] font-extrabold text-white/90">
              +{state.playerCount - Math.min(LOBBY_NAMES, state.recentPlayers.length)} {state.playerCount - Math.min(LOBBY_NAMES, state.recentPlayers.length) === 1 ? "altro" : "altri"}
            </span>
          )}
        </div>
      )}
      {extra}
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Presentazione round
// ---------------------------------------------------------------------------
export function TvRoundIntroScreen({ round, vote, showLines }: { round: PublicRound; vote: PublicVote | null; showLines?: readonly PublicShowLine[] | null }) {
  const presenter = round.kind === "category_vote" ? "palmino" : round.presenter;
  const c = CHARACTERS[presenter];
  // inizio della finale: chi nomina primo e secondo passa davanti mentre lo dice (vedi TrioSlot)
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2">
        <Logo size="tv" />
      </div>
      <motion.div
        initial={{ x: "-40%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 90, damping: 14 }}
        className="absolute bottom-0 left-[1cqw] w-[37cqw]"
      >
        <TrioSlot host={presenter} animation="intro" lines={showLines} className="w-full" />
      </motion.div>
      <div className="absolute left-[40cqw] right-[4cqw] top-[22cqh] flex flex-col items-start gap-[2.4cqh]">
        <Pill tone="dark">
          Round {round.index} di {round.total}
        </Pill>
        <motion.h1
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 12, delay: 0.2 }}
          className="font-display text-[10cqh] leading-[1] text-white [text-shadow:0_0.8vh_0_#6b1020,0_0_4vh_rgba(255,20,147,.6)]"
        >
          {round.title}
        </motion.h1>
        <p className="font-display text-[4.4cqh]" style={{ color: c.accent === "#087cff" ? "#7fc3ff" : c.accent }}>
          {round.kind === "category_vote" ? "ADESSO DECIDETE VOI!" : ROUND_KIND_LABEL[round.kind]}
        </p>
        {round.description && <p className="max-w-[50cqw] text-[3.2cqh] font-extrabold text-white/90">{round.description}</p>}
        {round.special?.kind === "bet" ? (
          <div className="flex flex-col gap-[1.2cqh]">
            <p className="max-w-[52cqw] text-[3.2cqh] font-extrabold text-white/90">
              🎰 Prima delle risposte puntate dal telefono 0%, 25%, 50% o tutto dei vostri punti. Giusta: la posta è vostra. Sbagliata: la perdete!
            </p>
            <div className="flex flex-wrap gap-[1.2cqh]">
              <Pill tone="fuchsia">ALL IN = 100% dei punti</Pill>
              {round.special.minStake > 0 && <Pill tone="cyan">Puntata minima {formatPoints(round.special.minStake)}</Pill>}
            </div>
          </div>
        ) : round.special?.kind === "comeback" ? (
          <div className="flex flex-col gap-[1.2cqh]">
            <p className="max-w-[52cqw] text-[3.2cqh] font-extrabold text-white/90">🚀 A ogni domanda chi insegue in classifica riceve il BOOST: è il momento della rimonta!</p>
            <div className="flex flex-wrap gap-[1.2cqh]">
              {round.special.boostMultiplier > 1 && <Pill tone="fuchsia">BOOST ×{fmt(round.special.boostMultiplier)} alla metà bassa</Pill>}
              {round.special.leaderPenaltyMultiplier > 1 && <Pill tone="violet">Capolista: errori ×{fmt(round.special.leaderPenaltyMultiplier)}</Pill>}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-[1.2cqh]">
            {round.pointsMultiplier !== 1 && <Pill tone="fuchsia">Punti ×{round.pointsMultiplier}</Pill>}
            {round.noPenalty && <Pill tone="cyan">Nessuna penalità</Pill>}
            {round.penaltyMultiplier > 1 && !round.noPenalty && <Pill tone="violet">Penalità ×{round.penaltyMultiplier}</Pill>}
          </div>
        )}
        {vote && (
          <div className="mt-[1cqh] grid grid-cols-2 gap-[1.6cqh]">
            {vote.options.map((o) => (
              <span key={o.id} className="rounded-[2cqh] border-[0.4cqh] border-gold px-[3cqh] py-[1.2cqh] font-display text-[4cqh] text-white" style={{ background: ANSWER_STYLES[o.position].bg }}>
                {LETTERS[o.position]} · {o.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Votazione categoria
// ---------------------------------------------------------------------------
export function TvVotingScreen({ vote, remainingMs, totalMs, phase }: { vote: PublicVote; remainingMs: number; totalMs: number; phase: GamePhase }) {
  const closed = phase === "CATEGORY_RESULT";
  const max = Math.max(1, ...vote.options.map((o) => o.votes ?? 0));
  const winner = vote.options.find((o) => o.id === vote.winnerOptionId);
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2">
        <Logo size="tv" />
      </div>
      <motion.div initial={{ y: "40%", rotate: -8 }} animate={{ y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 120, damping: 9 }} className="absolute bottom-0 left-[0.5cqw] w-[28cqw]">
        <TrioSlot host="palmino" className="w-full" animation={closed ? "celebrate" : "point"} />
        <SpeechBubble className="absolute left-[4cqw] top-[-8cqh] text-[3.4cqh]">{closed ? "Avete deciso!" : "ADESSO DECIDETE VOI!"}</SpeechBubble>
      </motion.div>
      <div className="absolute left-[30cqw] right-[4cqw] top-[19cqh]">
        <div className="mb-[2cqh] flex items-center justify-between">
          <h1 className="font-display text-[6cqh] text-white">{closed ? "La categoria scelta è…" : "Votate la categoria!"}</h1>
          {!closed && <TimerRing remainingMs={remainingMs} totalMs={totalMs} size="16cqh" />}
        </div>
        <div className="flex flex-col gap-[1.8cqh]">
          {vote.options.map((o) => {
            const pct = vote.totalVotes ? Math.round(((o.votes ?? 0) / vote.totalVotes) * 100) : 0;
            const isWinner = closed && o.id === vote.winnerOptionId;
            return (
              <div
                key={o.id}
                className={clsx(
                  "relative overflow-hidden rounded-full border-[0.5cqh] transition-all duration-700",
                  isWinner ? "scale-[1.04] border-white animate-pulse-glow" : "border-gold/80",
                  closed && !isWinner && "opacity-40",
                )}
                style={{ background: "rgba(0,0,0,.45)" }}
              >
                {o.votes !== null && (
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    style={{ background: ANSWER_STYLES[o.position].bg }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(8, ((o.votes ?? 0) / max) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 18 }}
                  />
                )}
                {o.votes === null && <div className="absolute inset-0" style={{ background: ANSWER_STYLES[o.position].bg }} />}
                <div className="relative flex items-center gap-[2cqh] px-[2cqh] py-[1.4cqh]">
                  <span className="grid h-[8cqh] w-[8cqh] place-items-center rounded-full border-[0.4cqh] border-gold bg-gradient-to-b from-[#fff3a6] to-gold-deep font-display text-[4.6cqh] text-ink">
                    {LETTERS[o.position]}
                  </span>
                  <span className="flex-1 font-display text-[5cqh] text-white [text-shadow:0_3px_0_rgba(0,0,0,.4)]">{o.label}</span>
                  {o.votes !== null && (
                    <span className="font-display text-[4.4cqh] text-white">
                      {o.votes} <span className="text-[2.6cqh]">voti · {pct}%</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!vote.liveResults && !closed && <p className="mt-[2cqh] text-[2.8cqh] font-extrabold text-white/80">I risultati restano segreti fino alla chiusura!</p>}
        {closed && winner && (
          <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.4 }} className="mt-[3cqh] text-center font-display text-[8cqh] text-gold [text-shadow:0_0.6vh_0_#6b1020]">
            {winner.label}!
          </motion.p>
        )}
        {closed && vote.tieBreak && (
          <p className="text-center text-[2.6cqh] font-extrabold text-white/80">
            Parità! Spareggio: {vote.tieBreak.method === "random" ? "estrazione casuale" : vote.tieBreak.method === "admin" ? "voto decisivo della regia" : "ordine di presentazione"}
          </p>
        )}
      </div>
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Evento speciale di Palmino
// ---------------------------------------------------------------------------
export function TvSpecialEventScreen({ event }: { event: PublicEvent }) {
  return (
    <TvFrame>
      <div aria-hidden className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_55%,rgba(255,20,147,.55),transparent_60%)]" />
      <motion.div
        initial={{ scale: 0.2, rotate: -25, y: "40%" }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 8 }}
        className="absolute bottom-0 left-1/2 w-[38cqw] -translate-x-1/2"
      >
        <TrioSlot host="palmino" className="w-full" animation="celebrate" />
      </motion.div>
      <div className="absolute inset-x-0 top-[5cqh] flex flex-col items-center gap-[1.6cqh] text-center">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.3 }} className="font-display text-[12cqh] leading-none">
          {EVENT_ICON[event.type]}
        </motion.span>
        <motion.h1
          initial={{ scale: 3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.5 }}
          className="qz-gold-text font-display text-[13cqh] leading-none"
        >
          {event.title}
        </motion.h1>
        <motion.p initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9 }} className="rounded-full bg-black/55 px-[4cqh] py-[1cqh] font-display text-[4.4cqh] text-white">
          {event.tagline}
        </motion.p>
      </div>
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Punteggi e classifica
// ---------------------------------------------------------------------------
function Movement({ e }: { e: LeaderboardEntry }) {
  if (e.previousRank === null || e.previousRank === e.rank) return <span className="w-[5cqh] text-center text-[2.6cqh] text-white/40">•</span>;
  const up = e.previousRank > e.rank;
  return (
    <span className={clsx("w-[5cqh] text-center font-display text-[2.6cqh]", up ? "text-[#5dffab]" : "text-[#ff8098]")}>
      {up ? "▲" : "▼"}
      {Math.abs(e.previousRank - e.rank)}
    </span>
  );
}

/** Punti presi in QUESTA risposta (niente classifica totale): i migliori in alto. */
export function TvAnswerPointsScreen({
  entries,
  who,
  showLines,
}: {
  entries: LeaderboardEntry[];
  who: Presenter;
  questionId?: string;
  showLines?: readonly PublicShowLine[] | null;
}) {
  const rows = [...entries].sort((a, b) => b.lastDelta - a.lastDelta || a.nickname.localeCompare(b.nickname, "it")).slice(0, 10);
  // la battuta nel fumetto solo mentre la voce la dice (regista o battuta di rito)
  const quip = useSpokenBubble();
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2">
        <Logo size="tv" />
      </div>
      <div className="absolute bottom-0 right-[0.5cqw] w-[36cqw]">
        <TrioSlot host={who} animation="point" lines={showLines} className="w-full" />
        {quip && (
          <SpeechBubble tail="right" className="absolute right-[6cqw] top-[-14cqh] w-[30cqw] text-[2.8cqh] leading-tight">
            {quip}
          </SpeechBubble>
        )}
      </div>
      <div className="absolute left-[8cqw] right-[38cqw] top-[14cqh]">
        <h1 className="mb-[1.4cqh] font-display text-[5cqh] text-gold [text-shadow:0_0.5vh_0_#6b1020]">PUNTI DI QUESTA RISPOSTA</h1>
        <div className="flex flex-col gap-[0.6cqh]">
          {rows.map((e, i) => (
            <motion.div
              key={e.participantId}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 150, damping: 18 }}
              className={clsx(
                "flex items-center gap-[1.6cqh] rounded-[1.6cqh] border-[0.3cqh] px-[2cqh] py-[0.25cqh]",
                e.lastDelta > 0 ? "border-[#5dffab]/70 bg-[#0b3a22]/85" : e.lastDelta < 0 ? "border-[#ff8098]/60 bg-[#3d0914]/80" : "border-white/20 bg-black/45",
              )}
            >
              <span className="min-w-0 flex-1 truncate font-display text-[3cqh] text-white">{e.nickname}</span>
              <span className={clsx("font-display text-[3.2cqh]", e.lastDelta > 0 ? "text-[#5dffab]" : e.lastDelta < 0 ? "text-[#ff8098]" : "text-white/60")}>
                {e.lastDelta === 0 ? "0" : signedPoints(e.lastDelta)}
              </span>
            </motion.div>
          ))}
        </div>
        <p className="mt-[1.2cqh] font-display text-[2.4cqh] text-white/75">La classifica completa a fine round!</p>
      </div>
    </TvFrame>
  );
}

/** Punti di una classifica del round: con il segno solo se negativi (0 resta 0). */
function roundPointsLabel(n: number): string {
  return n < 0 ? signedPoints(n) : formatPoints(n);
}

export function TvLeaderboardScreen({
  entries,
  title,
  showDelta,
  showLines,
  round = null,
  roundPoints = null,
}: {
  entries: LeaderboardEntry[];
  title: string;
  showDelta: boolean;
  showLines?: readonly PublicShowLine[] | null;
  /** classifica del ROUND: `entries` hanno i punti del round; il totale della serata in piccolo */
  round?: { totals: Map<string, number> } | null;
  /** classifica generale: punti fatti nel round (al posto della variazione dell'ultima domanda) */
  roundPoints?: Map<string, number> | null;
}) {
  const cue = useDirectedCue("professore", "point", showLines);
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2">
        <Logo size="tv" />
      </div>
      <div className="absolute bottom-0 right-[0.5cqw] w-[27cqw]">
        <TrioSlot host="professore" animation="point" lines={showLines} className="w-full" />
        {/* fumetto stretto sopra il personaggio, a destra della classifica (non la copre) */}
        {cue.line && (
          <SpeechBubble tail="right" className="absolute bottom-full right-[1cqw] mb-[1cqh] w-[22cqw] !px-[1.6cqh] !py-[1.2cqh] text-[2.4cqh] leading-tight">
            {showLineBubble(cue.line)}
          </SpeechBubble>
        )}
      </div>
      <div className="absolute left-[5cqw] right-[28cqw] top-[15.5cqh]">
        <h1 className="mb-[1.4cqh] font-display text-[5.4cqh] text-gold [text-shadow:0_0.5vh_0_#6b1020]">{title}</h1>
        <ol className="flex flex-col gap-[0.8cqh]">
          {entries.slice(0, 10).map((e, i) => (
            <motion.li
              key={e.participantId}
              layout
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 140, damping: 18 }}
              className={clsx(
                "flex items-center gap-[2cqh] rounded-[1.8cqh] border-[0.35cqh] px-[2cqh] py-[0.45cqh]",
                i === 0 ? "border-gold bg-gradient-to-r from-gold-deep/90 to-gold/60 text-ink" : i < 3 ? "border-gold/70 bg-violet/70" : "border-white/20 bg-black/45",
              )}
            >
              <span className={clsx("w-[6cqh] text-center font-display text-[3.6cqh]", i === 0 ? "text-ink" : "text-gold")}>{e.rank}</span>
              {!round && <Movement e={e} />}
              <span className={clsx("min-w-0 flex-1 truncate font-display text-[3.4cqh]", i === 0 ? "text-ink" : "text-white")}>{e.nickname}</span>
              {round && (
                <span className={clsx("font-display text-[2.4cqh]", i === 0 ? "text-ink/70" : "text-white/60")}>tot. {formatPoints(round.totals.get(e.participantId) ?? 0)}</span>
              )}
              {!round && roundPoints && (roundPoints.get(e.participantId) ?? 0) !== 0 && (
                <span className={clsx("font-display text-[2.6cqh]", (roundPoints.get(e.participantId) ?? 0) > 0 ? (i === 0 ? "text-[#04582c]" : "text-[#5dffab]") : "text-[#ff8098]")}>
                  {signedPoints(roundPoints.get(e.participantId) ?? 0)} nel round
                </span>
              )}
              {!round && !roundPoints && showDelta && e.lastDelta !== 0 && (
                <span className={clsx("font-display text-[3cqh]", e.lastDelta > 0 ? (i === 0 ? "text-[#04582c]" : "text-[#5dffab]") : "text-[#ff8098]")}>
                  {signedPoints(e.lastDelta)}
                </span>
              )}
              <span className={clsx("w-[18cqh] text-right font-display text-[3.6cqh]", i === 0 ? "text-ink" : "text-white")}>{round ? roundPointsLabel(e.points) : formatPoints(e.points)}</span>
            </motion.li>
          ))}
        </ol>
        {entries.length === 0 && <p className="text-[3cqh] font-extrabold text-white/70">La classifica apparirà dopo la prima domanda.</p>}
      </div>
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Finale con podio
// ---------------------------------------------------------------------------
export function TvPodiumScreen({
  entries,
  startedAt,
  seed,
  now = Date.now,
  live = false,
  onCelebrate,
  titles = { pending: "LA CLASSIFICA FINALE", done: "I CAMPIONI DELLA SERATA" },
  banner,
  portrait = false,
  showLines = null,
}: {
  /** telefono in verticale (1080x1920): titolo e presentatori in alto, podio largo in basso */
  portrait?: boolean;
  /** battute del regista della fase FINISHED (vincitore della serata, scenetta finale) */
  showLines?: readonly PublicShowLine[] | null;
  entries: LeaderboardEntry[];
  /** titoli prima e dopo la rivelazione del vincitore (es. squadre) */
  titles?: { pending: string; done: string };
  /** mostrato dopo la rivelazione del vincitore (es. squadra vincitrice) */
  banner?: ReactNode;
  /** inizio della fase FINISHED (ora del server) */
  startedAt: string;
  seed: string;
  now?: () => number;
  /** true sul TV: suoni e voci; false in regia (solo immagini) */
  live?: boolean;
  onCelebrate?: () => void;
}) {
  // libreria ufficiale: battuta sul vincitore e scenetta finale, SOLO dopo la rivelazione del nome
  const extra = useMemo(() => podiumExtraLines({ showLines: showLines ? [...showLines] : null }), [showLines]);
  const plan = useMemo(() => podiumPlan(entries, seed, extra), [entries, seed, extra]);
  const start = Date.parse(startedAt);
  const [t, setT] = useState(() => (now() - start) / 1000);
  useEffect(() => {
    const id = setInterval(() => setT((now() - start) / 1000), 100);
    return () => clearInterval(id);
  }, [now, start]);

  // Suoni e voci della rivelazione, una volta sola; dopo un ricaricamento non si ripetono quelli già passati.
  const fired = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!live) return;
    if (fired.current === null) {
      const f = new Set<string>();
      for (const st of plan.steps) {
        if (st.drumAt !== null && t > st.drumAt + 1.5) f.add(`d${st.rank}`);
        if (t > st.at + 1.5) f.add(`r${st.rank}`);
      }
      if (t > plan.rest.at + 1.5) f.add("rest");
      if (plan.tensionAt !== null && t > plan.tensionAt + 1.5) f.add("call");
      if (t > plan.closeAt + 1.5) f.add("close");
      if (t > plan.winnerAt + 1.5) f.add("after");
      fired.current = f;
    }
    const f = fired.current;
    const once = (k: string, fn: () => void) => {
      if (!f.has(k)) {
        f.add(k);
        fn();
      }
    };
    const eng = getSoundEngine();
    const voice = getVoice();
    // tutti gli altri, letti dal fondo
    const restLine = plan.rest.line;
    if (restLine && t >= plan.rest.at) once("rest", () => void voice.say(restLine.who, restLine.text, { live: restLine.live }));
    // "E il vincitore di stasera è…": Palmino lo dice PRIMA che il vincitore compaia; se la sua clip
    // arrivasse tardi (vincitore già sullo schermo) non si dice più
    const call = plan.winnerCall;
    const winnerAt = plan.winnerAt;
    if (call && plan.tensionAt !== null && t >= plan.tensionAt) {
      once("call", () => {
        // a rivelazione imminente la coda si libera (es. un nome del fondo classifica ancora in lettura)
        voice.stop();
        void voice.say(call.who, call.text, { live: call.live, skipIf: () => (now() - start) / 1000 >= winnerAt - 0.6 });
      });
    }
    for (const st of plan.steps) {
      if (st.drumAt !== null && t >= st.drumAt)
        once(`d${st.rank}`, () => {
          eng.play("drumroll");
          // attesa lunga per il vincitore: il rullo continua fino alla rivelazione
          if (st.rank === 1) setTimeout(() => eng.play("drumroll"), 1550);
        });
      if (t >= st.at)
        once(`r${st.rank}`, () => {
          // il 2° arriva insieme al vincitore: niente suoni in più, solo la voce dopo quella del vincitore
          if (st.drumAt !== null) {
            eng.play(st.rank === 1 ? "victory" : "reveal");
            eng.applause(st.rank === 1 ? "big" : "medium");
          }
          // il nome del vincitore subito, sopra a qualunque coda rimasta
          if (st.rank === 1) voice.stop();
          void voice.say(st.line.who, st.line.text, { live: st.line.live });
          if (st.rank === 1) onCelebrate?.();
        });
    }
    // dopo il nome del vincitore (e il 2° posto, già in coda): battuta sul vincitore e scenetta finale
    if (plan.after.length > 0 && t >= plan.winnerAt + 0.2)
      once("after", () => {
        for (const l of plan.after) void voice.say(l.who, l.text, { live: l.live, display: l.display, optional: l.optional, group: l.group });
      });
    if (t >= plan.closeAt) once("close", () => void voice.say(plan.closing.who, plan.closing.text));
  }, [t, live, plan, onCelebrate, now, start]);

  const tension = plan.tensionAt !== null && t >= plan.tensionAt && t < plan.winnerAt;
  const winnerShown = t >= plan.winnerAt && plan.tensionAt !== null;
  const stepOf = (rank: number) => plan.steps.find((s) => s.rank === rank);
  const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const HEIGHT: Record<number, string> = portrait ? { 1: "24cqh", 2: "17cqh", 3: "12cqh" } : { 1: "36cqh", 2: "26cqh", 3: "20cqh" };
  const BG: Record<number, string> = {
    1: "linear-gradient(180deg,#fff2a8,#ffb800)",
    2: "linear-gradient(180deg,#f2f2f2,#a9b4c2)",
    3: "linear-gradient(180deg,#ffc58a,#c9772b)",
  };
  return (
    <TvFrame>
      <div className={clsx("absolute left-1/2 z-20 -translate-x-1/2 text-center", portrait ? "top-[1.5cqh] w-[94cqw]" : "top-[2cqh]")}>
        <Logo size="tv" className={portrait ? "mx-auto !h-[8cqh]" : undefined} />
        <p className={clsx("mt-[1cqh] font-display text-white [text-shadow:0_0.5vh_0_#6b1020]", portrait ? "text-[7.4cqw] leading-tight" : "text-[6cqh]")}>{winnerShown ? titles.done : titles.pending}</p>
      </div>
      {portrait ? (
        // in verticale i tre presentatori insieme (un solo canvas 3D) DIETRO a un bancone: mai tagliati a metà
        <>
          <div className="absolute left-1/2 top-[17cqh] z-[5] w-[78cqw] -translate-x-1/2">
            <TrioSlot host="professore" className="w-full" animation={winnerShown ? "celebrate" : tension ? "surprised" : "idle"} />
          </div>
          <StageCounter className="top-[41cqh] z-[6] h-[4.6cqh]" />
          <TrophyMoment
            won={winnerShown}
            className="left-[58cqw] top-[19cqh] z-[7] h-[22cqh] w-[36cqw]"
            table={{ left: 68, bottom: 0, width: 26, height: 24 }}
            raised={{ left: 39, bottom: 66 }}
            cupClassName="w-[9cqw]"
          />
        </>
      ) : (
        <>
          {/* Professore e Regina dietro al bancone (figura sopra il piano, niente tagli a metà) */}
          <div className="absolute bottom-[5cqh] left-[0.5cqw] z-[12] w-[18cqw]">
            <TalkingCharacter who="professore" className="w-full" animation={winnerShown ? "celebrate" : "idle"} />
          </div>
          <div className="absolute bottom-[5cqh] right-[0.5cqw] z-[12] w-[19cqw]">
            <TalkingCharacter who="regina" className="w-full" animation={winnerShown ? "celebrate" : "idle"} />
          </div>
          {/* Palmino in piedi sul bancone, accanto al tavolino con la coppa: la alza quando arriva il vincitore */}
          <div className="absolute bottom-[12cqh] left-[18.8cqw] z-[13] h-[30cqh] w-[13cqw]">
            <div className="absolute bottom-0 left-0 w-[9cqw]">
              <TalkingCharacter who="palmino" className="w-full" animation={winnerShown ? "celebrate" : tension ? "surprised" : "idle"} />
            </div>
            <TrophyMoment won={winnerShown} className="inset-0" table={{ left: 73, bottom: 0, width: 25, height: 17 }} raised={{ left: 35, bottom: 68 }} cupClassName="w-[3.6cqw]" />
          </div>
          <StageCounter className="bottom-0 z-[14] h-[12.5cqh]" />
        </>
      )}

      {winnerShown && banner}

      {/* tutti gli altri, dal fondo al 4° posto: compaiono mentre la voce li legge */}
      {plan.rest.entries.length > 0 && t >= plan.rest.at && t < (plan.steps.find((st) => st.rank === 3)?.drumAt ?? plan.tensionAt ?? plan.winnerAt) && (
        <div
          className={clsx(
            "absolute left-1/2 z-20 -translate-x-1/2 overflow-hidden",
            portrait ? "top-[30cqh] max-h-[48cqh] w-[92cqw]" : clsx("top-[22cqh] max-h-[60cqh]", plan.rest.entries.length > 24 ? "w-[56cqw]" : "w-[44cqw]"),
          )}
        >
          {/* tanti giocatori (fino a 37 oltre il podio): tre colonne, così l'elenco non esce dallo schermo */}
          <div className={clsx("grid gap-[0.6cqh]", portrait ? (plan.rest.entries.length > 10 ? "grid-cols-2" : "grid-cols-1") : plan.rest.entries.length > 24 ? "grid-cols-3" : plan.rest.entries.length > 8 ? "grid-cols-2" : "grid-cols-1")}>
            {[...plan.rest.entries].reverse().map((e) => {
              const order = plan.rest.entries.indexOf(e);
              const shown = t >= plan.rest.at + 1.5 + Math.min(order, 19) * plan.rest.perName;
              return (
                <motion.div
                  key={e.nickname}
                  initial={false}
                  animate={{ opacity: shown ? 1 : 0, x: shown ? 0 : -30 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-center gap-[1.4cqh] rounded-[1.4cqh] border-[0.3cqh] border-white/25 bg-black/55 px-[1.6cqh] py-[0.2cqh]"
                >
                  <span className="w-[5cqh] text-center font-display text-[2.8cqh] text-gold">{e.rank}°</span>
                  <span className="min-w-0 flex-1 truncate font-display text-[2.8cqh] text-white">{e.nickname}</span>
                  <span className="font-display text-[2.4cqh] text-white/75">{formatPoints(e.points)}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* luci basse e attesa per il vincitore */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-10"
        initial={false}
        animate={{ opacity: tension ? 1 : 0 }}
        transition={{ duration: 0.8 }}
        style={{ background: "radial-gradient(circle at 50% 70%, rgba(255,214,90,.18) 0, rgba(5,0,12,.82) 38%, rgba(5,0,12,.92) 100%)" }}
      />
      {/* occhio di bue che cerca il vincitore nel buio */}
      {tension && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[11]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, backgroundPosition: ["20% 80%", "80% 75%", "35% 70%", "65% 80%", "50% 78%"] }}
          transition={{ opacity: { duration: 0.5 }, backgroundPosition: { duration: 3.2, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" } }}
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,236,160,.32) 0, rgba(255,236,160,.12) 9%, transparent 18%)", backgroundSize: "200% 200%", mixBlendMode: "screen" }}
        />
      )}
      {tension && (
        <motion.p
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1, 1.06, 1], opacity: 1 }}
          transition={{ scale: { repeat: Infinity, duration: 0.9 }, opacity: { duration: 0.4 } }}
          className={clsx(
            "absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap font-display text-gold [text-shadow:0_0_4cqh_rgba(255,200,40,.7)]",
            portrait ? "top-[40cqh] text-[10cqw]" : "top-[26cqh] text-[9cqh]",
          )}
        >
          E IL VINCITORE È…
        </motion.p>
      )}

      {/* in orizzontale il podio sta un po' a destra: a sinistra c'è Palmino con la coppa */}
      <div className={clsx("absolute bottom-0 z-20 flex -translate-x-1/2 items-end", portrait ? "left-1/2 gap-[2cqw]" : "left-[56.5%] gap-[2cqh]")}>
        {[2, 1, 3].map((rank) => {
          const st = stepOf(rank);
          const col = portrait ? "w-[30cqw]" : "w-[15cqw]";
          if (!st) return <div key={rank} className={col} />;
          const shown = t >= st.at;
          return (
            <div key={rank} className={clsx("flex flex-col items-center", col)}>
              {shown ? (
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 160, damping: 12 }}
                  className="flex w-full flex-col items-center"
                >
                  <span className={portrait ? "text-[10cqw]" : "text-[7cqh]"}>{MEDAL[rank]}</span>
                  {st.entries.map((e) => (
                    <span key={e.nickname} className={clsx("max-w-full truncate font-display leading-tight text-white [text-shadow:0_4px_0_rgba(0,0,0,.5)]", portrait ? "text-[6.4cqw]" : "text-[4.4cqh]")}>
                      {e.nickname}
                    </span>
                  ))}
                  <span className={clsx("font-display text-gold", portrait ? "text-[4.4cqw]" : "text-[3.4cqh]")}>
                    {formatPoints(st.entries[0].points)} pt{st.entries.length > 1 ? " · pari merito" : ""}
                  </span>
                </motion.div>
              ) : (
                <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ repeat: Infinity, duration: 1.4 }} className={clsx("font-display text-white/70", portrait ? "text-[14cqw]" : "text-[9cqh]")}>
                  ?
                </motion.span>
              )}
              <motion.div
                className={clsx("mt-[1cqh] flex w-full items-start justify-center rounded-t-[2cqh] border-[0.5cqh] border-b-0 border-gold pt-[1.5cqh] font-display text-ink", portrait ? "text-[14cqw]" : "text-[9cqh]")}
                initial={false}
                animate={{ height: shown ? HEIGHT[rank] : "6cqh", opacity: shown ? 1 : 0.55 }}
                transition={{ type: "spring", stiffness: 70, damping: 14 }}
                style={{ background: BG[rank] }}
              >
                {shown ? rank : ""}
              </motion.div>
            </div>
          );
        })}
      </div>
    </TvFrame>
  );
}

/** Bancone dello studio: i presentatori ci stanno dietro (mai tagliati a metà dal bordo). */
function StageCounter({ className }: { className: string }) {
  return (
    <div className={clsx("pointer-events-none absolute inset-x-0", className)} aria-hidden>
      <div className="absolute inset-x-0 top-0 h-[22%] min-h-[4px] bg-gradient-to-b from-[#ffe680] to-[#c98a10] shadow-[0_0.4cqh_0.8cqh_rgba(0,0,0,.45)]" />
      <div className="absolute inset-x-0 bottom-0 top-[22%] bg-gradient-to-b from-[#5a1a3c] via-[#3a0d28] to-[#1d0616]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pausa e attesa
// ---------------------------------------------------------------------------
export function TvPauseOverlay() {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-night/80 backdrop-blur-md">
      <div className="flex flex-col items-center gap-[2cqh]">
        <TalkingCharacter who="regina" className="w-[26cqw]" animation="wave" />
        <p className="font-display text-[9cqh] text-gold">PAUSA</p>
        <p className="text-[3.4cqh] font-extrabold text-white/90">Torniamo tra pochissimo: approfittatene per un altro giro!</p>
      </div>
    </div>
  );
}

export function TvMessageScreen({ title, subtitle, who = "professore" }: { title: string; subtitle?: string; who?: "professore" | "regina" | "palmino" }) {
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[5cqh] -translate-x-1/2">
        <Logo size="tvxl" />
      </div>
      <div className="absolute bottom-0 left-[4cqw] w-[28cqw]">
        <TalkingCharacter who={who} className="w-full animate-float" animation="wave" />
      </div>
      <div className="absolute left-[36cqw] right-[6cqw] top-[42cqh]">
        <p className="font-display text-[7cqh] leading-tight text-white">{title}</p>
        {subtitle && <p className="mt-[2cqh] text-[3.4cqh] font-extrabold text-white/85">{subtitle}</p>}
      </div>
    </TvFrame>
  );
}
