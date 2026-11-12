"use client";
/* eslint-disable @next/next/no-img-element -- QR e media delle domande serviti come data URL / URL firmati */

import { clsx } from "clsx";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { GamePhase, LeaderboardEntry, Presenter, PublicEvent, PublicQuestion, PublicRound, PublicShowLine, PublicState, PublicVote } from "@/lib/game-engine/types";
import { AnswerButton, ANSWER_STYLES, LETTERS, type AnswerVisual } from "@/features/game/components/answers";
import { CHARACTERS, Logo } from "@/features/game/components/brand";
import { SpeechBubble, TimerRing } from "@/features/game/components/effects";
import { EVENT_ICON, formatPoints, isQuestionQuip, signedPoints } from "@/features/game/lines";
import { useSeatContext } from "@/features/gioca/use-seat";
import { fmt } from "@/lib/game-engine/special-rounds";
import { presenterCue } from "./presenter-cue";
import { Equalizer, Pill, questionRoundLabel, roundIntroTagline, showLineBubble, TvFrame, useSpokenBubble } from "./TvScreens";
import { TrioSlot } from "./TvTrio";
import { useRevealHeld } from "./reveal-hold";
import { useHeldSpeech } from "@/features/media/voice";

/**
 * Lo show sul TELEFONO in verticale (1080×1920, modalità B del gioco libero): le stesse schermate
 * del TV ricomposte in colonna. Le misure sono in unità del contenitore (cqw = 1% della larghezza,
 * cqh = 1% dell'altezza) così lo show scala da 360 px a 1080 px di larghezza; i presentatori sono
 * sempre i tre del TV (un solo canvas 3D, TrioSlot) e le risposte sono pulsanti veri quando l'host
 * gioca anche lui (SeatContext).
 */

function PortraitHeader({ right }: { right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-[2cqw]">
      <Logo size="md" className="!h-[6.4cqh] w-auto" />
      {right && <div className="flex min-w-0 flex-wrap justify-end gap-[1.5cqw]">{right}</div>}
    </div>
  );
}

const smallPill = "!px-[2.6cqw] !py-[0.8cqw] !text-[3.6cqw] !border-[0.6cqw]";

// ---------------------------------------------------------------------------
// Lobby (parte alta: i comandi dell'host e l'invito stanno sotto, nello show)
// ---------------------------------------------------------------------------
export function PortraitLobbyScreen({ state, qrDataUrl, joinUrl }: { state: PublicState; qrDataUrl: string | null; joinUrl: string }) {
  const names = state.recentPlayers ?? [];
  const extra = state.playerCount - Math.min(12, names.length);
  return (
    <TvFrame>
      <div className="absolute inset-x-[5cqw] top-[calc(5cqh+env(safe-area-inset-top))] flex flex-col items-center gap-[2cqh]">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 90, damping: 14 }}>
          <Logo variant="full" size="lg" priority className="!h-[15cqh] w-auto animate-float" />
        </motion.div>
        <div className="flex w-full items-center gap-[4cqw] rounded-[5cqw] border-[0.8cqw] border-gold bg-night/80 p-[3cqw]">
          <div className="shrink-0 rounded-[3cqw] bg-white p-[1.5cqw] shadow-[0_0_30px_rgba(255,212,59,.5)]">
            {qrDataUrl ? <img src={qrDataUrl} alt={`QR code per entrare: ${joinUrl}`} className="h-[34cqw] w-[34cqw]" /> : <div className="h-[34cqw] w-[34cqw] animate-pulse bg-ink/10" />}
          </div>
          <div className="flex min-w-0 flex-col gap-[1.2cqw]">
            <p className="font-display text-[6cqw] leading-none text-white">Inquadra e gioca!</p>
            <p className="text-[3.4cqw] font-extrabold uppercase tracking-wide text-white/70">codice partita</p>
            <p className="font-display text-[10cqw] leading-none tracking-[0.12em] text-gold">{state.code}</p>
            <p className="font-display text-[5cqw] leading-none text-white">
              {state.playerCount} <span className="text-[3.6cqw] font-sans font-extrabold uppercase text-white/75">{state.playerCount === 1 ? "giocatore" : "giocatori"}</span>
            </p>
          </div>
        </div>
        {names.length > 0 && (
          <div className="flex max-h-[11cqh] flex-wrap justify-center gap-[1.6cqw] overflow-hidden">
            {names.slice(0, 12).map((n, i) => (
              <motion.span
                key={n}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="max-w-[40cqw] truncate rounded-full border-[0.5cqw] border-gold/70 bg-violet/80 px-[3cqw] py-[0.8cqw] text-[3.8cqw] font-extrabold text-white"
              >
                {n}
              </motion.span>
            ))}
            {extra > 0 && <span className="rounded-full bg-black/55 px-[3cqw] py-[0.8cqw] text-[3.8cqw] font-extrabold text-white/90">+{extra}</span>}
          </div>
        )}
      </div>
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Presentazione del round
// ---------------------------------------------------------------------------
export function PortraitRoundIntroScreen({ round, showLines, vote = null }: { round: PublicRound; showLines?: readonly PublicShowLine[] | null; vote?: PublicVote | null }) {
  const presenter = round.kind === "category_vote" ? "palmino" : round.presenter;
  const c = CHARACTERS[presenter];
  return (
    <TvFrame>
      <div className="absolute inset-x-[5cqw] top-[calc(5cqh+env(safe-area-inset-top))] flex flex-col items-center gap-[2cqh] text-center">
        <Logo size="md" className="!h-[8cqh] w-auto" />
        <Pill tone="dark" className={smallPill}>
          Round {round.index} di {round.total}
        </Pill>
        <motion.h1
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 12, delay: 0.2 }}
          className="font-display text-[13cqw] leading-[1] text-white [text-shadow:0_0.6cqh_0_#6b1020,0_0_3cqh_rgba(255,20,147,.6)]"
        >
          {round.title}
        </motion.h1>
        <p className="font-display text-[6cqw]" style={{ color: c.accent === "#087cff" ? "#7fc3ff" : c.accent }}>
          {roundIntroTagline(round)}
        </p>
        {round.description && <p className="text-[4.4cqw] font-extrabold text-white/90">{round.description}</p>}
        {vote && vote.options.length > 0 && !round.voteAfter && (
          <div className="flex flex-wrap justify-center gap-[2cqw]">
            {vote.options.map((o) => (
              <span key={o.id} className="rounded-[3cqw] border-[0.6cqw] border-gold px-[3.5cqw] py-[1.2cqw] font-display text-[5.4cqw] text-white" style={{ background: ANSWER_STYLES[o.position].bg }}>
                {LETTERS[o.position]} · {o.label}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-[1.6cqw]">
          {round.pointsMultiplier !== 1 && (
            <Pill tone="fuchsia" className={smallPill}>
              Punti ×{fmt(round.pointsMultiplier)}
            </Pill>
          )}
          {round.noPenalty && (
            <Pill tone="cyan" className={smallPill}>
              Nessuna penalità
            </Pill>
          )}
        </div>
      </div>
      <motion.div
        initial={{ y: "30%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 90, damping: 14 }}
        className="absolute bottom-0 left-1/2 w-[96cqw] -translate-x-1/2"
      >
        <TrioSlot host={presenter} animation="intro" lines={showLines} className="w-full" />
      </motion.div>
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Domanda, risposte (anche da toccare), soluzione
// ---------------------------------------------------------------------------
function questionSize(text: string): string {
  if (text.length <= 60) return "text-[7.2cqw]";
  if (text.length <= 110) return "text-[6.2cqw]";
  if (text.length <= 170) return "text-[5.4cqw]";
  return "text-[4.8cqw]";
}

export function PortraitQuestionScreen({
  question: q,
  round,
  phase,
  remainingMs,
  startsInMs,
  event,
  mediaUrl,
  totalQuestions,
  audioState = "idle",
}: {
  question: PublicQuestion;
  round: PublicRound | null;
  phase: GamePhase;
  remainingMs: number;
  /** mentre il presentatore legge le risposte il tempo non è ancora partito */
  startsInMs: number;
  event: PublicEvent | null;
  mediaUrl: string | null;
  totalQuestions: number;
  /** canzone della domanda: estratto in arrivo, in riproduzione, finito */
  audioState?: "idle" | "playing" | "done" | "error";
}) {
  const seat = useSeatContext();
  const isMusic = q.media?.kind === "audio";
  const held = useRevealHeld(q.id);
  const revealed = !!q.correctPositions && !held;
  const optionsVisible = !!q.options;
  const totalMs = q.rules.durationSeconds * 1000;
  const listening = phase === "OPTIONS_VISIBLE" && startsInMs > 0;
  const open = phase === "OPTIONS_VISIBLE" && remainingMs > 0 && !listening;
  const hasImage = q.media?.kind === "image" && mediaUrl;
  // fumetto solo mentre il presentatore dice un commento (mai prima, mai il testo della domanda)
  const line = useSpokenBubble((text, _who, curated) => curated || isQuestionQuip(text));
  const mine = seat?.selected ?? [];
  const locked = seat?.status === "recorded" || seat?.status === "sending";
  const multiple = q.type === "multiple";

  const visual = (pos: number): AnswerVisual => {
    if (revealed) {
      if (q.correctPositions!.includes(pos)) return mine.includes(pos) ? "correct" : seat ? "missed" : "correct";
      return mine.includes(pos) ? "wrong" : "dimmed";
    }
    if (mine.includes(pos)) return locked ? "locked" : "selected";
    if (seat && (!open || locked)) return mine.length ? "dimmed" : "idle";
    return "idle";
  };

  return (
    <TvFrame calm={optionsVisible}>
      <div className="absolute inset-0 flex flex-col gap-[1.4cqh] overflow-y-auto overscroll-contain px-[4cqw] pb-[calc(9cqh+env(safe-area-inset-bottom))] pt-[calc(5.5cqh+env(safe-area-inset-top))]">
        <PortraitHeader
          right={
            <>
              <Pill className={smallPill}>
                {q.number}/{Math.max(totalQuestions, q.number)}
              </Pill>
              <Pill tone="dark" className={clsx(smallPill, "max-w-[44cqw] truncate")}>
                {q.category}
              </Pill>
            </>
          }
        />
        {(event || multiple || isMusic || (round && questionRoundLabel(round.kind))) && (
          <div className="flex flex-wrap justify-center gap-[1.5cqw]">
            {isMusic && (
              <Pill tone="fuchsia" className={smallPill}>
                🎧 Ascolta la canzone
              </Pill>
            )}
            {multiple && (
              <Pill tone="cyan" className={smallPill}>
                Più risposte giuste
              </Pill>
            )}
            {round && questionRoundLabel(round.kind) && (
              <Pill tone="violet" className={smallPill}>
                {questionRoundLabel(round.kind)}
              </Pill>
            )}
            {event && (
              <Pill tone="fuchsia" className={clsx(smallPill, "animate-pulse-glow")}>
                {EVENT_ICON[event.type]} {event.title}
              </Pill>
            )}
          </div>
        )}

        {/* presentatori (o immagine della domanda) con il tempo accanto. I presentatori stanno DIETRO
            al cartello della domanda: la parte bassa (gambe) è coperta dal cartello, niente taglio netto */}
        <div className={clsx("relative flex shrink-0 justify-center", !hasImage && (optionsVisible ? "z-0 -mb-[4cqh]" : "z-0 -mb-[6cqh]"))}>
          {hasImage ? (
            <img src={mediaUrl} alt="Immagine della domanda" className="max-h-[22cqh] max-w-full rounded-[3cqw] border-[0.8cqw] border-gold bg-black object-contain" />
          ) : (
            <motion.div layout className={optionsVisible ? "w-[46cqw]" : "w-[74cqw]"} transition={{ type: "spring", stiffness: 140, damping: 20 }}>
              <TrioSlot host={q.presenter} className="w-full" animation={revealed ? "celebrate" : optionsVisible ? "point" : "idle"} />
            </motion.div>
          )}
          {line && !optionsVisible && (
            <SpeechBubble tail="none" className="absolute left-0 top-0 max-w-[48cqw] !rounded-[3cqw] !border-[0.8cqw] !px-[3cqw] !py-[2cqw] text-[3.8cqw] leading-tight">
              {line}
            </SpeechBubble>
          )}
          {optionsVisible && !revealed && (
            <div className="absolute right-0 top-0">
              <TimerRing remainingMs={Math.min(remainingMs, totalMs)} totalMs={totalMs} size="24cqw" />
            </div>
          )}
          {revealed && (
            <div className="absolute right-0 top-0 grid h-[20cqw] w-[20cqw] place-items-center rounded-full border-[0.8cqw] border-gold bg-night text-center font-display text-[8cqw] text-gold">✓</div>
          )}
        </div>

        <motion.div
          key={q.id}
          initial={{ y: -20, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 18 }}
          className="qz-question-card relative z-10 shrink-0 rounded-[4cqw] px-[4.5cqw] py-[3.5cqw] text-center"
        >
          <p className={clsx("font-display leading-[1.12]", questionSize(q.text))}>{q.text}</p>
          {!optionsVisible && isMusic && (
            <div className="mt-[2cqw] flex items-center justify-center gap-[3cqw] font-display text-[5.2cqw] text-violet">
              <Equalizer active={audioState === "playing"} className="h-[7cqw] gap-[1cqw]" barClassName="w-[1.6cqw]" />
              {audioState === "playing" ? "Ascoltate bene…" : audioState === "done" ? "Ora indovinate!" : audioState === "error" ? "Audio non partito, leggi e indovina!" : "Sta per partire la canzone…"}
            </div>
          )}
          {!optionsVisible && !isMusic && <p className="mt-[1.5cqw] text-[3.6cqw] font-extrabold text-ink/60">Le risposte stanno per arrivare…</p>}
        </motion.div>

        {optionsVisible && (
          <div className="flex flex-col gap-[2cqw]">
            {q.options!.map((o) => (
              <AnswerButton
                key={o.position}
                position={o.position}
                text={o.text}
                multiple={multiple && !!seat}
                visual={visual(o.position)}
                disabled={!seat || !open || locked || revealed}
                onPress={() => seat?.toggle(o.position)}
              />
            ))}
          </div>
        )}

        {/* l'host gioca: stato della sua risposta */}
        {seat && optionsVisible && !revealed && (
          <div className="flex flex-col items-center gap-[1.5cqw]">
            {seat.status === "recorded" ? (
              <p className="w-full rounded-[3cqw] border-[0.6cqw] border-lime bg-[#0b3a22] px-[3cqw] py-[2cqw] text-center font-display text-[5cqw] text-[#bfffdc]">RISPOSTA REGISTRATA!</p>
            ) : listening ? (
              <p className="text-center font-display text-[4.6cqw] text-white">🎧 Ascolta le risposte…</p>
            ) : open && multiple ? (
              <button
                type="button"
                onClick={seat.confirm}
                disabled={mine.length === 0 || seat.status === "sending"}
                className="h-14 w-full rounded-2xl border-[3px] border-[#b8770a] bg-gradient-to-b from-[#ffe680] to-gold-deep font-display text-2xl text-ink shadow-[0_5px_0_#9a5d00] disabled:opacity-40"
              >
                {seat.status === "sending" ? "INVIO…" : mine.length === 0 ? "SELEZIONA LE RISPOSTE" : "CONFERMA"}
              </button>
            ) : open ? (
              <p className="text-center font-display text-[4.6cqw] text-white">{seat.status === "sending" ? "INVIO…" : "👆 Tocca la risposta: vale subito!"}</p>
            ) : (
              <p className="text-center font-display text-[4.6cqw] text-white/85">{phase === "PAUSED" ? "Gioco in pausa" : "Tempo scaduto!"}</p>
            )}
            {seat.error && <p className="text-center text-sm font-bold text-[#ffc2cd]">{seat.error}</p>}
          </div>
        )}
        {seat && revealed && seat.result && (
          <p
            className={clsx(
              "rounded-[3cqw] px-[3cqw] py-[2cqw] text-center font-display text-[5cqw]",
              seat.result.isCorrect ? "bg-[#0b3a22] text-[#bfffdc]" : seat.result.partial ? "bg-[#3a300b] text-gold" : "bg-[#3d0914] text-[#ffc2cd]",
            )}
          >
            {seat.result.isCorrect ? "Esatta!" : seat.result.partial ? "Quasi!" : "Sbagliata…"}
            {seat.result.delta !== null && ` ${signedPoints(seat.result.delta)}`}
          </p>
        )}

        <p className="mt-auto text-center text-[3.4cqw] font-extrabold text-white/70">
          {q.answeredCount !== null && !revealed ? `${q.answeredCount} risposte ricevute` : round ? `${round.title} · Round ${round.index}/${round.total}` : ""}
        </p>
      </div>
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Votazione delle materie (anche da toccare: chi guarda lo show sul telefono vota da qui)
// ---------------------------------------------------------------------------
export function PortraitVoteScreen({ vote, round, phase, remainingMs }: { vote: PublicVote; round: PublicRound | null; phase: GamePhase; remainingMs: number }) {
  const seat = useSeatContext();
  const closed = phase === "CATEGORY_RESULT";
  const totalMs = vote.closesAt && vote.openedAt ? Date.parse(vote.closesAt) - Date.parse(vote.openedAt) : 15000;
  const mine = seat?.voteOptionId ?? null;
  const open = phase === "CATEGORY_VOTING" && remainingMs > 0 && !mine && seat?.voteStatus !== "sending";
  const winner = vote.options.find((o) => o.id === vote.winnerOptionId) ?? null;
  const max = Math.max(1, ...vote.options.map((o) => o.votes ?? 0));
  return (
    <TvFrame calm>
      <div className="absolute inset-0 flex flex-col gap-[1.6cqh] px-[4cqw] pb-[2cqh] pt-[calc(5.5cqh+env(safe-area-inset-top))]">
        <PortraitHeader
          right={
            round ? (
              <Pill tone="dark" className={smallPill}>
                Round {round.index} di {round.total}
              </Pill>
            ) : undefined
          }
        />
        <div className="relative flex shrink-0 items-end justify-center">
          <motion.div initial={{ y: "20%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 110, damping: 12 }} className="w-[58cqw]">
            <TrioSlot host="palmino" className="w-full" animation={closed ? "celebrate" : "point"} />
          </motion.div>
          <SpeechBubble tail="none" className="absolute left-0 top-[1cqh] max-w-[46cqw] !rounded-[3cqw] !border-[0.8cqw] !px-[3cqw] !py-[2cqw] text-[4.4cqw] leading-tight">
            {closed ? "Avete deciso!" : "ADESSO DECIDETE VOI!"}
          </SpeechBubble>
          {!closed && (
            <div className="absolute right-0 top-0">
              <TimerRing remainingMs={Math.min(remainingMs, totalMs)} totalMs={totalMs} size="24cqw" />
            </div>
          )}
        </div>
        <h1 className="text-center font-display text-[7.4cqw] leading-tight text-white [text-shadow:0_0.4cqh_0_#6b1020]">
          {closed ? "La materia scelta è…" : "Votate la materia!"}
        </h1>
        <div className="flex flex-col gap-[2.2cqw]">
          {vote.options.map((o) => {
            const isMine = mine === o.id;
            const isWinner = closed && o.id === vote.winnerOptionId;
            const pct = vote.totalVotes ? Math.round(((o.votes ?? 0) / vote.totalVotes) * 100) : 0;
            return (
              <button
                key={o.id}
                type="button"
                disabled={!seat || !open}
                onClick={() => seat?.vote(o.id)}
                aria-pressed={isMine}
                className={clsx(
                  "relative flex min-h-[9cqh] items-center gap-[3cqw] overflow-hidden rounded-[4cqw] border-[0.9cqw] px-[3cqw] text-left transition active:translate-y-[3px] disabled:cursor-default",
                  isMine || isWinner ? "border-white" : "border-gold/80",
                  ((closed && !isWinner) || (mine && !isMine)) && "opacity-45",
                  isWinner && "scale-[1.03] animate-pulse-glow",
                )}
                style={{ background: "rgba(0,0,0,.45)" }}
              >
                {o.votes !== null ? (
                  <motion.span
                    className="absolute inset-y-0 left-0"
                    style={{ background: ANSWER_STYLES[o.position].bg }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(10, ((o.votes ?? 0) / max) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 18 }}
                  />
                ) : (
                  <span className="absolute inset-0" style={{ background: ANSWER_STYLES[o.position].bg }} />
                )}
                <span className="relative grid h-[13cqw] w-[13cqw] shrink-0 place-items-center rounded-full border-[0.7cqw] border-gold bg-gradient-to-b from-[#fff3a6] to-gold-deep font-display text-[7cqw] text-ink">
                  {LETTERS[o.position]}
                </span>
                <span className="relative flex-1 font-display text-[7cqw] leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,.4)]">{o.label}</span>
                {o.votes !== null && (
                  <span className="relative text-right font-display text-[6cqw] leading-none text-white">
                    {o.votes}
                    <span className="block text-[3.4cqw]">{pct}%</span>
                  </span>
                )}
                {isMine && <span className="relative font-display text-[7cqw] text-white">✓</span>}
              </button>
            );
          })}
        </div>
        {closed && winner ? (
          <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.4 }} className="text-center font-display text-[11cqw] leading-none text-gold [text-shadow:0_0.5cqh_0_#6b1020]">
            {winner.label}!
          </motion.p>
        ) : seat ? (
          <p className={clsx("text-center font-display text-[5cqw]", mine ? "text-[#bfffdc]" : "text-white")}>
            {mine ? "VOTO REGISTRATO!" : seat.voteStatus === "sending" ? "INVIO…" : remainingMs > 0 ? "👆 Tocca la materia che vuoi giocare!" : "Votazione chiusa"}
          </p>
        ) : (
          <p className="text-center font-display text-[5cqw] text-white">Votate dal telefono!</p>
        )}
        {seat?.voteError && <p className="text-center text-sm font-bold text-[#ffc2cd]">{seat.voteError}</p>}
        {closed && vote.tieBreak && <p className="text-center text-[3.4cqw] font-extrabold text-white/80">Parità! Spareggio: {vote.tieBreak.method === "random" ? "estrazione a sorte" : vote.tieBreak.method === "admin" ? "decide la regia" : "ordine di presentazione"}</p>}
        {!vote.liveResults && !closed && <p className="text-center text-[3.4cqw] font-extrabold text-white/80">I voti restano segreti fino alla chiusura!</p>}
      </div>
    </TvFrame>
  );
}

// ---------------------------------------------------------------------------
// Punti e classifiche
// ---------------------------------------------------------------------------
function PortraitBoard({
  title,
  rows,
  who,
  bubble,
  lines,
  value,
  rank,
  footer,
}: {
  title: string;
  rows: LeaderboardEntry[];
  who: Presenter;
  bubble: string | null;
  lines?: readonly PublicShowLine[] | null;
  value: (e: LeaderboardEntry) => ReactNode;
  rank?: boolean;
  footer?: string;
}) {
  const seat = useSeatContext();
  return (
    <TvFrame>
      <div className="absolute inset-x-[4cqw] top-[calc(5.5cqh+env(safe-area-inset-top))] flex flex-col gap-[1.4cqh]">
        <PortraitHeader />
        <h1 className="text-center font-display text-[7.4cqw] leading-tight text-gold [text-shadow:0_0.4cqh_0_#6b1020]">{title}</h1>
        <ol className="flex flex-col gap-[1.4cqw]">
          {rows.map((e, i) => {
            const me = seat?.participantId === e.participantId;
            return (
              <motion.li
                key={e.participantId}
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 150, damping: 18 }}
                className={clsx(
                  "flex items-center gap-[2.4cqw] rounded-[3cqw] border-[0.6cqw] px-[3cqw] py-[1.2cqw]",
                  me ? "border-cyan bg-[#063a46]/90" : rank && i === 0 ? "border-gold bg-gradient-to-r from-gold-deep/90 to-gold/60 text-ink" : "border-white/20 bg-black/50",
                )}
              >
                {rank && <span className={clsx("w-[7cqw] text-center font-display text-[5cqw]", i === 0 && !me ? "text-ink" : "text-gold")}>{e.rank}</span>}
                <span className={clsx("min-w-0 flex-1 leading-tight [overflow-wrap:anywhere] font-display text-[5cqw]", rank && i === 0 && !me ? "text-ink" : "text-white")}>
                  {e.nickname}
                  {me && <span className="ml-[1.5cqw] text-[3.4cqw] text-cyan">(tu)</span>}
                </span>
                {value(e)}
              </motion.li>
            );
          })}
        </ol>
        {rows.length === 0 && <p className="text-center text-[4cqw] font-extrabold text-white/70">La classifica apparirà dopo la prima domanda.</p>}
        {footer && <p className="text-center font-display text-[3.8cqw] text-white/75">{footer}</p>}
      </div>
      <div className="absolute bottom-0 left-1/2 w-[64cqw] -translate-x-1/2">
        {bubble && (
          <SpeechBubble tail="none" className="absolute bottom-full left-1/2 mb-[1cqh] w-[80cqw] -translate-x-1/2 !rounded-[3cqw] !border-[0.8cqw] !px-[3cqw] !py-[2cqw] text-center text-[3.8cqw] leading-tight">
            {bubble}
          </SpeechBubble>
        )}
        <TrioSlot host={who} animation="point" lines={lines} className="w-full" />
      </div>
    </TvFrame>
  );
}

export function PortraitAnswerPointsScreen({ entries, who, showLines }: { entries: LeaderboardEntry[]; who: Presenter; questionId?: string; showLines?: readonly PublicShowLine[] | null }) {
  const rows = [...entries].sort((a, b) => b.lastDelta - a.lastDelta || a.nickname.localeCompare(b.nickname, "it")).slice(0, 7);
  // fumetto solo mentre la voce dice la battuta (regista o battuta di rito)
  const quip = useSpokenBubble();
  return (
    <PortraitBoard
      title="PUNTI DI QUESTA RISPOSTA"
      rows={rows}
      who={who}
      bubble={quip}
      lines={showLines}
      footer="La classifica completa a fine round!"
      value={(e) => (
        <span className={clsx("font-display text-[5cqw]", e.lastDelta > 0 ? "text-[#5dffab]" : e.lastDelta < 0 ? "text-[#ff8098]" : "text-white/60")}>{e.lastDelta === 0 ? "0" : signedPoints(e.lastDelta)}</span>
      )}
    />
  );
}

export function PortraitLeaderboardScreen({
  entries,
  title,
  showLines,
  value,
}: {
  entries: LeaderboardEntry[];
  title: string;
  showLines?: readonly PublicShowLine[] | null;
  /** valore a destra di ogni riga (default: punti totali) */
  value?: (e: LeaderboardEntry) => ReactNode;
}) {
  const cue = presenterCue("professore", "point", showLines, useHeldSpeech());
  return (
    <PortraitBoard
      title={title}
      rows={entries.slice(0, 7)}
      who="professore"
      bubble={cue.line ? showLineBubble(cue.line) : null}
      lines={showLines}
      rank
      value={value ?? ((e) => <span className="font-display text-[5cqw]">{formatPoints(e.points)}</span>)}
    />
  );
}

// ---------------------------------------------------------------------------
// Evento di Palmino e messaggi
// ---------------------------------------------------------------------------
export function PortraitSpecialEventScreen({ event }: { event: PublicEvent }) {
  return (
    <TvFrame>
      <div aria-hidden className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_55%,rgba(255,20,147,.55),transparent_60%)]" />
      <div className="absolute inset-x-[5cqw] top-[calc(6cqh+env(safe-area-inset-top))] flex flex-col items-center gap-[2cqh] text-center">
        <span className="font-display text-[22cqw] leading-none">{EVENT_ICON[event.type]}</span>
        <h1 className="qz-gold-text font-display text-[14cqw] leading-none">{event.title}</h1>
        <p className="rounded-[4cqw] bg-black/55 px-[4cqw] py-[2cqw] font-display text-[5.4cqw] text-white">{event.tagline}</p>
      </div>
      <div className="absolute bottom-0 left-1/2 w-[90cqw] -translate-x-1/2">
        <TrioSlot host="palmino" className="w-full" animation="celebrate" />
      </div>
    </TvFrame>
  );
}

export function PortraitMessageScreen({ title, who = "professore" }: { title: string; who?: Presenter }) {
  return (
    <TvFrame>
      <div className="absolute inset-x-[6cqw] top-[calc(7cqh+env(safe-area-inset-top))] flex flex-col items-center gap-[4cqh] text-center">
        <Logo variant="full" size="lg" className="!h-[18cqh] w-auto" />
        <p className="font-display text-[9cqw] leading-tight text-white">{title}</p>
      </div>
      <div className="absolute bottom-0 left-1/2 w-[92cqw] -translate-x-1/2">
        <TrioSlot host={who} className="w-full" animation="wave" />
      </div>
    </TvFrame>
  );
}
