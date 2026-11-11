"use client";
/* eslint-disable @next/next/no-img-element -- media delle domande serviti tramite URL firmati temporanei */

import { clsx } from "clsx";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  GamePhase,
  LeaderboardEntry,
  PublicEvent,
  PublicQuestion,
  PublicRound,
  PublicState,
  PublicVote,
} from "@/lib/game-engine/types";
import { AnswerBar, ANSWER_STYLES, LETTERS, type AnswerVisual } from "@/features/game/components/answers";
import { Character, CHARACTERS, Logo } from "@/features/game/components/brand";
import { SpeechBubble, TimerRing } from "@/features/game/components/effects";
import { getVoice, useSpeaker } from "@/features/media/voice";
import { getSoundEngine } from "@/features/media/audio-engine";
import { podiumPlan, scoreQuipLine } from "@/features/game/script";
import { bleedStyle, CharacterStage, type StageBleed } from "@/features/three/characters/CharacterStage";

/** Spazio di disegno attorno al personaggio del TV: braccia e gesti non vengono tagliati. */
const TV_BLEED: StageBleed = { left: 0.4, right: 0.25, top: 0.2 };
import { useCharacterMode } from "@/features/three/characters/character-mode";
import type { CharacterAnimation } from "@/features/three/characters/types";
import { EVENT_ICON, formatPoints, presenterBubble, ROUND_KIND_LABEL, signedPoints, stripAudioTags } from "@/features/game/lines";

/**
 * Personaggio del TV: modello 3D animato (con lip-sync) quando il PC lo regge,
 * altrimenti l'illustrazione originale che "parla" a ritmo della voce.
 */
export function TalkingCharacter(props: React.ComponentProps<typeof Character> & { animation?: CharacterAnimation }) {
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
}

// ---------------------------------------------------------------------------
// Cornice dello studio (sfondo comune a tutte le schermate)
// ---------------------------------------------------------------------------
export function TvFrame({ children, calm = false }: { children: ReactNode; calm?: boolean }) {
  return (
    <div className="qz-stage relative h-full w-full overflow-hidden">
      <div aria-hidden className={clsx("qz-rays absolute -inset-[30%] opacity-70", !calm && "animate-spin-slow")} />
      {/* spotlight colorati */}
      <div aria-hidden className="absolute -left-[10cqw] -top-[20cqh] h-[70cqh] w-[40cqw] rounded-full bg-electric/30 blur-[90px]" />
      <div aria-hidden className="absolute -right-[10cqw] -top-[20cqh] h-[70cqh] w-[40cqw] rounded-full bg-fuchsia/30 blur-[90px]" />
      <div aria-hidden className="absolute bottom-[-30cqh] left-[20cqw] h-[60cqh] w-[60cqw] rounded-full bg-violet/30 blur-[100px]" />
      {/* arco di lampadine */}
      <div aria-hidden className="absolute inset-x-[4cqw] top-[1.5cqh] h-[2.2cqh] qz-bulbs animate-marquee opacity-90" style={{ backgroundSize: "3.2cqh 2.2cqh" }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[24cqh] bg-gradient-to-t from-black/70 to-transparent" />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}

function Pill({ children, tone = "gold", className }: { children: ReactNode; tone?: "gold" | "fuchsia" | "cyan" | "violet" | "dark"; className?: string }) {
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
}

export function TvQuestionScreen({ question: q, round, phase, remainingMs, event, mediaUrl, questionsPlayed, totalQuestions, audioState = "idle" }: TvQuestionProps) {
  const revealed = !!q.correctPositions;
  const optionsVisible = !!q.options;
  const hasImage = q.media?.kind === "image" && mediaUrl;
  const hasVideo = q.media?.kind === "video" && mediaUrl;
  const isMusic = q.media?.kind === "audio";
  const visualMedia = hasImage || hasVideo;
  const totalMs = q.rules.durationSeconds * 1000;
  const showTimer = optionsVisible && !revealed;
  // Fumetto: stessa battuta della voce, senza audio tag
  const line = presenterBubble(phase, q.presenter, q.id);
  const totalAnswers = q.distribution?.reduce((a, b) => a + b, 0) ?? 0;

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
          key={q.presenter}
          initial={{ x: "-30%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          className="absolute bottom-0 left-[1cqw] z-10 w-[31cqw]"
        >
          <TalkingCharacter who={q.presenter} priority className="w-full animate-float" animation={revealed ? "celebrate" : optionsVisible ? "point" : "idle"} />
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
        <div className="absolute bottom-0 left-[1cqw] z-20 w-[13cqw]">
          <TalkingCharacter who={q.presenter} small className="w-full" />
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
          {!optionsVisible && !isMusic && (
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

        {/* regole annunciate (eventi, moltiplicatori) */}
        {!optionsVisible && (q.rules.modifiers.length > 0 || q.rules.correctPoints !== 1000) && (
          <div className="mt-[2cqh] flex flex-wrap gap-[1.2cqh]">
            <Pill tone="dark">Vale {formatPoints(q.rules.correctPoints + q.rules.bonusPoints)} punti</Pill>
            {q.rules.wrongPenalty === 0 ? <Pill tone="dark">Nessuna penalità</Pill> : <Pill tone="dark">Errore −{formatPoints(q.rules.wrongPenalty)}</Pill>}
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
      <BottomTicker left={round ? `${round.title} · Round ${round.index}/${round.total}` : ""} right={q.answeredCount !== null && !revealed ? `${q.answeredCount} risposte ricevute` : `Domande giocate: ${questionsPlayed}`} />
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
export function TvLobbyScreen({ state, qrDataUrl, joinUrl }: { state: PublicState; qrDataUrl: string | null; joinUrl: string }) {
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
        <div className="absolute inset-x-[4cqw] bottom-[2.5cqh] flex flex-wrap justify-center gap-[1cqh]">
          {state.recentPlayers.slice(0, 16).map((n, i) => (
            <motion.span
              key={n}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-full border-[0.3cqh] border-gold/70 bg-violet/80 px-[1.8cqh] py-[0.5cqh] text-[2.4cqh] font-extrabold text-white"
            >
              {n}
            </motion.span>
          ))}
        </div>
      )}
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Presentazione round
// ---------------------------------------------------------------------------
export function TvRoundIntroScreen({ round, vote }: { round: PublicRound; vote: PublicVote | null }) {
  const presenter = round.kind === "category_vote" ? "palmino" : round.presenter;
  const c = CHARACTERS[presenter];
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2">
        <Logo size="tv" />
      </div>
      <motion.div
        initial={{ x: "-40%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 90, damping: 14 }}
        className="absolute bottom-0 left-[3cqw] w-[34cqw]"
      >
        <TalkingCharacter who={presenter} priority className="w-full" animation="intro" />
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
        <div className="flex flex-wrap gap-[1.2cqh]">
          {round.pointsMultiplier !== 1 && <Pill tone="fuchsia">Punti ×{round.pointsMultiplier}</Pill>}
          {round.noPenalty && <Pill tone="cyan">Nessuna penalità</Pill>}
          {round.penaltyMultiplier > 1 && !round.noPenalty && <Pill tone="violet">Penalità ×{round.penaltyMultiplier}</Pill>}
        </div>
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
      <motion.div initial={{ y: "40%", rotate: -8 }} animate={{ y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 120, damping: 9 }} className="absolute bottom-0 left-[2cqw] w-[24cqw]">
        <TalkingCharacter who="palmino" priority className="w-full" animation={closed ? "celebrate" : "point"} />
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
        className="absolute bottom-0 left-1/2 w-[27cqw] -translate-x-1/2"
      >
        <TalkingCharacter who="palmino" priority className="w-full" animation="celebrate" />
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
export function TvAnswerPointsScreen({ entries, who, questionId }: { entries: LeaderboardEntry[]; who: "professore" | "regina" | "palmino"; questionId: string }) {
  const rows = [...entries].sort((a, b) => b.lastDelta - a.lastDelta || a.nickname.localeCompare(b.nickname, "it")).slice(0, 10);
  // la stessa battuta che dice la voce
  const quip = stripAudioTags(scoreQuipLine(who, questionId).text);
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2">
        <Logo size="tv" />
      </div>
      <div className="absolute bottom-0 right-[1cqw] w-[24cqw]">
        <TalkingCharacter who={who} className="w-full" animation="point" />
        <SpeechBubble tail="right" className="absolute right-[6cqw] top-[-14cqh] w-[30cqw] text-[2.8cqh] leading-tight">
          {quip}
        </SpeechBubble>
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

export function TvLeaderboardScreen({ entries, title, showDelta }: { entries: LeaderboardEntry[]; title: string; showDelta: boolean }) {
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2">
        <Logo size="tv" />
      </div>
      <div className="absolute bottom-0 right-[1cqw] w-[24cqw]">
        <TalkingCharacter who="professore" className="w-full" animation="point" />
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
              <Movement e={e} />
              <span className={clsx("min-w-0 flex-1 truncate font-display text-[3.4cqh]", i === 0 ? "text-ink" : "text-white")}>{e.nickname}</span>
              {showDelta && e.lastDelta !== 0 && (
                <span className={clsx("font-display text-[3cqh]", e.lastDelta > 0 ? (i === 0 ? "text-[#04582c]" : "text-[#5dffab]") : "text-[#ff8098]")}>
                  {signedPoints(e.lastDelta)}
                </span>
              )}
              <span className={clsx("w-[18cqh] text-right font-display text-[3.6cqh]", i === 0 ? "text-ink" : "text-white")}>{formatPoints(e.points)}</span>
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
}: {
  entries: LeaderboardEntry[];
  /** inizio della fase FINISHED (ora del server) */
  startedAt: string;
  seed: string;
  now?: () => number;
  /** true sul TV: suoni e voci; false in regia (solo immagini) */
  live?: boolean;
  onCelebrate?: () => void;
}) {
  const plan = useMemo(() => podiumPlan(entries, seed), [entries, seed]);
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
      if (t > plan.closeAt + 1.5) f.add("close");
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
    for (const st of plan.steps) {
      if (st.drumAt !== null && t >= st.drumAt)
        once(`d${st.rank}`, () => {
          eng.play("drumroll");
          if (st.rank === 1) {
            // attesa lunga per il vincitore
            setTimeout(() => eng.play("drumroll"), 1550);
            setTimeout(() => eng.play("drumroll"), 3100);
          }
        });
      if (t >= st.at)
        once(`r${st.rank}`, () => {
          // il 2° arriva insieme al vincitore: niente suoni in più, solo la voce dopo quella del vincitore
          if (st.drumAt !== null) {
            eng.play(st.rank === 1 ? "victory" : "reveal");
            eng.play(st.rank === 1 ? "cheer" : "applause");
          }
          void voice.say(st.line.who, st.line.text, { live: st.line.live });
          if (st.rank === 1) onCelebrate?.();
        });
    }
    if (t >= plan.closeAt) once("close", () => void voice.say(plan.closing.who, plan.closing.text));
  }, [t, live, plan, onCelebrate]);

  const tension = plan.tensionAt !== null && t >= plan.tensionAt && t < plan.winnerAt;
  const winnerShown = t >= plan.winnerAt && plan.tensionAt !== null;
  const stepOf = (rank: number) => plan.steps.find((s) => s.rank === rank);
  const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const HEIGHT: Record<number, string> = { 1: "36cqh", 2: "26cqh", 3: "20cqh" };
  const BG: Record<number, string> = {
    1: "linear-gradient(180deg,#fff2a8,#ffb800)",
    2: "linear-gradient(180deg,#f2f2f2,#a9b4c2)",
    3: "linear-gradient(180deg,#ffc58a,#c9772b)",
  };
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[2cqh] z-20 -translate-x-1/2 text-center">
        <Logo size="tv" />
        <p className="mt-[1cqh] font-display text-[6cqh] text-white [text-shadow:0_0.5vh_0_#6b1020]">{winnerShown ? "I CAMPIONI DELLA SERATA" : "LA CLASSIFICA FINALE"}</p>
      </div>
      <div className="absolute bottom-0 left-0 w-[22cqw]">
        <TalkingCharacter who="professore" className="w-full" animation={winnerShown ? "celebrate" : "idle"} />
      </div>
      <div className="absolute bottom-0 right-0 w-[23cqw]">
        <TalkingCharacter who="regina" className="w-full" animation={winnerShown ? "celebrate" : "idle"} />
      </div>
      <div className="absolute bottom-[1cqh] left-[24cqw] w-[10cqw]">
        <TalkingCharacter who="palmino" className="w-full animate-float" animation={winnerShown ? "celebrate" : tension ? "surprised" : "idle"} />
      </div>

      {/* tutti gli altri, dal fondo al 4° posto: compaiono mentre la voce li legge */}
      {plan.rest.entries.length > 0 && t >= plan.rest.at && t < (plan.steps[0]?.drumAt ?? plan.winnerAt) && (
        <div className="absolute left-1/2 top-[22cqh] z-20 w-[44cqw] -translate-x-1/2">
          <div className={clsx("grid gap-[0.6cqh]", plan.rest.entries.length > 8 ? "grid-cols-2" : "grid-cols-1")}>
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
      {tension && (
        <motion.p
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1, 1.06, 1], opacity: 1 }}
          transition={{ scale: { repeat: Infinity, duration: 0.9 }, opacity: { duration: 0.4 } }}
          className="absolute left-1/2 top-[26cqh] z-20 -translate-x-1/2 whitespace-nowrap font-display text-[9cqh] text-gold [text-shadow:0_0_4cqh_rgba(255,200,40,.7)]"
        >
          E IL VINCITORE È…
        </motion.p>
      )}

      <div className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 items-end gap-[2cqh]">
        {[2, 1, 3].map((rank) => {
          const st = stepOf(rank);
          if (!st) return <div key={rank} className="w-[17cqw]" />;
          const shown = t >= st.at;
          return (
            <div key={rank} className="flex w-[17cqw] flex-col items-center">
              {shown ? (
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 160, damping: 12 }}
                  className="flex w-full flex-col items-center"
                >
                  <span className="text-[7cqh]">{MEDAL[rank]}</span>
                  {st.entries.map((e) => (
                    <span key={e.nickname} className="max-w-full truncate font-display text-[4.4cqh] leading-tight text-white [text-shadow:0_4px_0_rgba(0,0,0,.5)]">
                      {e.nickname}
                    </span>
                  ))}
                  <span className="font-display text-[3.4cqh] text-gold">
                    {formatPoints(st.entries[0].points)} pt{st.entries.length > 1 ? " · pari merito" : ""}
                  </span>
                </motion.div>
              ) : (
                <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ repeat: Infinity, duration: 1.4 }} className="font-display text-[9cqh] text-white/70">
                  ?
                </motion.span>
              )}
              <motion.div
                className="mt-[1cqh] flex w-full items-start justify-center rounded-t-[2cqh] border-[0.5cqh] border-b-0 border-gold pt-[1.5cqh] font-display text-[9cqh] text-ink"
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
