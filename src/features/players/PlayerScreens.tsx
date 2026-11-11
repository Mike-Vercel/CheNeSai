"use client";
/* eslint-disable @next/next/no-img-element -- media delle domande serviti tramite URL firmati temporanei */

import { clsx } from "clsx";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { GamePhase, LeaderboardEntry, PublicEvent, PublicQuestion, PublicVote, PublicWheel } from "@/lib/game-engine/types";
import { spinElapsedMs } from "@/lib/game-engine/wheel";
import { WheelGraphic, wheelColor } from "@/features/game/components/wheel";
import { AnswerButton, ANSWER_STYLES, LETTERS, type AnswerVisual } from "@/features/game/components/answers";
import { Character, Logo } from "@/features/game/components/brand";
import { TimerBar } from "@/features/game/components/effects";
import { EVENT_ICON, formatPoints, signedPoints } from "@/features/game/lines";

export function PhoneShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <div className="qz-stage qz-safe relative flex min-h-dvh flex-col">
      <div aria-hidden className="qz-rays pointer-events-none absolute inset-0 opacity-40" />
      {header}
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-6 pt-3">{children}</main>
    </div>
  );
}

export function PhoneHeader({
  nickname,
  points,
  rank,
  total,
  status,
  team = null,
}: {
  nickname: string;
  points: number | null;
  rank: number | null;
  total: number;
  status: "live" | "connecting" | "reconnecting" | "offline";
  /** squadra del giocatore (modalità squadre) */
  team?: { name: string; color: string } | null;
}) {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-md items-center gap-2 px-4 pt-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border-2 border-gold/70 bg-black/50 px-3 py-1.5">
        <span
          className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", status === "live" ? "bg-lime" : status === "offline" ? "bg-flame" : "animate-pulse bg-gold")}
          title={status === "live" ? "Connesso" : "Riconnessione…"}
        />
        <span className="truncate font-extrabold">{nickname}</span>
        {team && (
          <span className="flex min-w-0 shrink items-center gap-1 text-xs font-extrabold text-white/80" title={`Squadra ${team.name}`}>
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/80" style={{ background: team.color }} />
            <span className="truncate">{team.name}</span>
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-full border-2 border-gold/70 bg-black/50 px-3 py-1.5 font-display">
        <span className="text-gold">🏆</span>
        <span>{points === null ? "…" : formatPoints(points)}</span>
        {rank && (
          <span className="ml-1 text-sm text-white/70">
            {rank}°/{total}
          </span>
        )}
      </div>
    </header>
  );
}

export function PhoneCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-3xl border-[3px] border-gold/80 bg-[#1d0c30]/90 p-5 shadow-2xl", className)}>{children}</div>;
}

export function PhoneMessage({ who = "professore", title, children }: { who?: "professore" | "regina" | "palmino"; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Character who={who} small className="w-44 animate-float" />
      <h1 className="font-display text-3xl leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,.4)]">{title}</h1>
      {children && <div className="text-lg font-bold text-white/85">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Domanda + risposte
// ---------------------------------------------------------------------------
export type SubmitStatus = "idle" | "sending" | "recorded" | "error";

export interface PhoneQuestionProps {
  question: PublicQuestion;
  phase: GamePhase;
  selected: number[];
  submitStatus: SubmitStatus;
  submitError: string | null;
  remainingMs: number;
  /** Millisecondi prima che parta il tempo (il presentatore sta leggendo le risposte). */
  startsInMs?: number;
  mediaUrl: string | null;
  event: PublicEvent | null;
  result: { isCorrect: boolean; partial: boolean; delta: number | null } | null;
  onToggle: (position: number) => void;
  onConfirm: () => void;
}

export function PhoneQuestionView({ question: q, phase, selected, submitStatus, submitError, remainingMs, startsInMs = 0, mediaUrl, event, result, onToggle, onConfirm }: PhoneQuestionProps) {
  // mentre il presentatore legge le risposte il tempo è fermo e non si può ancora rispondere
  const listening = phase === "OPTIONS_VISIBLE" && startsInMs > 0;
  const open = phase === "OPTIONS_VISIBLE" && remainingMs > 0 && !listening;
  const locked = submitStatus === "recorded" || submitStatus === "sending";
  const revealed = !!q.correctPositions;
  const multiple = q.type === "multiple";
  const visual = (pos: number): AnswerVisual => {
    if (revealed) {
      if (q.correctPositions!.includes(pos)) return selected.includes(pos) ? "correct" : "missed";
      return selected.includes(pos) ? "wrong" : "dimmed";
    }
    if (selected.includes(pos)) return locked ? "locked" : "selected";
    if (!open || locked) return selected.length ? "dimmed" : "idle";
    return "idle";
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border-2 border-[#b8770a] bg-gradient-to-b from-[#fff2a8] to-gold px-3 py-0.5 font-display text-sm text-ink">Domanda {q.number}</span>
        <span className="rounded-full bg-black/45 px-3 py-0.5 text-sm font-extrabold">{q.category}</span>
        {event && (
          <span className="rounded-full bg-fuchsia px-3 py-0.5 text-sm font-extrabold">
            {EVENT_ICON[event.type]} {event.title}
          </span>
        )}
      </div>

      <motion.div key={q.id} initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="qz-question-card rounded-3xl px-4 py-4 text-center">
        <p className={clsx("font-display leading-tight", q.text.length > 110 ? "text-[19px]" : q.text.length > 60 ? "text-[22px]" : "text-[26px]")}>{q.text}</p>
        {multiple && <p className="mt-1 text-sm font-extrabold text-violet">Selezione multipla: scegli TUTTE le risposte giuste</p>}
      </motion.div>

      {mediaUrl && q.media?.kind === "image" && <img src={mediaUrl} alt="Immagine della domanda" className="max-h-56 w-full rounded-2xl border-[3px] border-gold object-contain bg-black" />}
      {q.media?.kind === "audio" && !q.options && <p className="text-center font-extrabold text-white/85">🎵 Ascolta il brano dall&apos;impianto del pub!</p>}
      {q.media?.kind === "video" && !q.options && <p className="text-center font-extrabold text-white/85">🎬 Guarda il video sul TV!</p>}

      {!q.options && (
        <div className="mt-2 flex flex-col items-center gap-2 text-center">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-3 w-3 animate-bounce rounded-full" style={{ background: ANSWER_STYLES[i].ring, animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
          <p className="font-extrabold text-white/80">Le risposte arrivano tra un attimo…</p>
          <p className="text-sm text-white/60">
            Vale {formatPoints(q.rules.correctPoints + q.rules.bonusPoints)} punti · errore {q.rules.wrongPenalty ? `−${formatPoints(q.rules.wrongPenalty)}` : "senza penalità"} · {q.rules.durationSeconds}s
          </p>
          {q.rules.speedBonusMax > 0 && <p className="text-sm font-extrabold text-gold">⚡ Più sei veloce, più punti: fino a +{formatPoints(q.rules.speedBonusMax)}</p>}
        </div>
      )}

      {q.options && (
        <>
          {phase === "OPTIONS_VISIBLE" && !revealed && <TimerBar remainingMs={Math.min(remainingMs, q.rules.durationSeconds * 1000)} totalMs={q.rules.durationSeconds * 1000} />}
          <div className="flex flex-col gap-2.5">
            {q.options.map((o) => (
              <AnswerButton
                key={o.position}
                position={o.position}
                text={o.text}
                multiple={multiple}
                visual={visual(o.position)}
                disabled={!open || locked || revealed}
                onPress={() => onToggle(o.position)}
              />
            ))}
          </div>

          {!revealed && (
            <div className="mt-1 flex flex-col items-center gap-2">
              {submitStatus === "recorded" ? (
                <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="w-full rounded-2xl border-[3px] border-lime bg-[#0b3a22] px-4 py-3 text-center font-display text-2xl text-[#bfffdc]">
                  RISPOSTA REGISTRATA!
                  <span className="block text-sm font-sans font-bold text-white/80">Aspetta la soluzione sul TV</span>
                </motion.div>
              ) : listening ? (
                <p className="w-full rounded-2xl border-[3px] border-cyan/70 bg-black/50 px-4 py-3 text-center font-display text-xl text-white">
                  🎧 Ascolta le risposte…
                  <span className="block text-sm font-sans font-bold text-white/75">Il tempo parte appena finisce di leggerle</span>
                </p>
              ) : open && !multiple ? (
                <p className="w-full rounded-2xl bg-black/40 px-4 py-3 text-center font-display text-xl text-white">
                  {submitStatus === "sending" ? "INVIO…" : submitStatus === "error" ? "Tocca di nuovo la risposta" : "👆 Tocca la risposta: vale subito!"}
                </p>
              ) : open ? (
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={selected.length === 0 || submitStatus === "sending"}
                  className="h-16 w-full rounded-2xl border-[3px] border-[#b8770a] bg-gradient-to-b from-[#ffe680] to-gold-deep font-display text-2xl text-ink shadow-[0_5px_0_#9a5d00] transition active:translate-y-[3px] active:shadow-none disabled:opacity-40"
                >
                  {submitStatus === "sending" ? "INVIO…" : selected.length === 0 ? (multiple ? "SELEZIONA LE RISPOSTE" : "SCEGLI UNA RISPOSTA") : "CONFERMA"}
                </button>
              ) : (
                <p className="rounded-2xl bg-black/50 px-4 py-3 text-center font-display text-xl text-white">
                  {phase === "PAUSED" ? "Gioco in pausa" : "Tempo scaduto!"}
                </p>
              )}
              {submitError && <p className="text-center text-sm font-bold text-[#ffc2cd]">{submitError}</p>}
            </div>
          )}

          {revealed && (
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-1">
              <ResultBanner result={result} hasAnswer={selected.length > 0} correct={q.correctPositions!} />
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

function ResultBanner({ result, hasAnswer, correct }: { result: PhoneQuestionProps["result"]; hasAnswer: boolean; correct: number[] }) {
  const ok = result?.isCorrect;
  const partial = result?.partial;
  const tone = ok ? "border-lime bg-[#0b3a22] text-[#bfffdc]" : partial ? "border-gold bg-[#3a2b05] text-[#ffeaa0]" : hasAnswer ? "border-flame bg-[#3d0914] text-[#ffc2cd]" : "border-white/30 bg-black/50 text-white";
  return (
    <div className={clsx("rounded-2xl border-[3px] px-4 py-3 text-center", tone)}>
      <p className="font-display text-3xl">{ok ? "ESATTO! 🎉" : partial ? "QUASI!" : hasAnswer ? "SBAGLIATO!" : "NESSUNA RISPOSTA"}</p>
      <p className="text-sm font-bold">Risposta giusta: {correct.map((c) => LETTERS[c]).join(" + ")}</p>
      {result?.delta !== null && result?.delta !== undefined ? (
        <p className="mt-1 font-display text-2xl">{signedPoints(result.delta)} punti</p>
      ) : (
        <p className="mt-1 text-sm font-bold opacity-80">I punti arrivano tra un attimo…</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Votazione
// ---------------------------------------------------------------------------
export function PhoneVoteView({ vote, phase, myOptionId, remainingMs, sending, error, onVote }: { vote: PublicVote; phase: GamePhase; myOptionId: string | null; remainingMs: number; sending: boolean; error: string | null; onVote: (optionId: string) => void }) {
  const open = phase === "CATEGORY_VOTING" && remainingMs > 0 && !myOptionId;
  const closed = phase === "CATEGORY_RESULT";
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center gap-3">
        <Character who="palmino" small className="w-24" />
        <div>
          <p className="font-display text-2xl leading-tight">{closed ? "Avete deciso!" : "ADESSO DECIDETE VOI!"}</p>
          <p className="font-bold text-white/80">{closed ? "Ecco la categoria scelta" : "Vota la categoria del prossimo round"}</p>
        </div>
      </div>
      {phase === "CATEGORY_VOTING" && vote.closesAt && <TimerBar remainingMs={remainingMs} totalMs={vote.openedAt ? Date.parse(vote.closesAt) - Date.parse(vote.openedAt) : 15000} />}
      <div className="flex flex-col gap-2.5">
        {vote.options.map((o) => {
          const mine = myOptionId === o.id;
          const winner = closed && vote.winnerOptionId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={!open || sending}
              onClick={() => onVote(o.id)}
              className={clsx(
                "flex min-h-16 items-center gap-3 rounded-2xl border-4 px-3 text-left transition active:translate-y-[3px]",
                mine || winner ? "border-white" : "border-gold/80",
                (closed && !winner) || (myOptionId && !mine) ? "opacity-45" : "",
                winner && "animate-pulse-glow",
              )}
              style={{ background: ANSWER_STYLES[o.position].bg }}
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border-[3px] border-gold bg-gradient-to-b from-[#fff3a6] to-gold-deep font-display text-2xl text-ink">{LETTERS[o.position]}</span>
              <span className="flex-1 font-display text-2xl text-white">{o.label}</span>
              {o.votes !== null && <span className="font-display text-lg">{o.votes}</span>}
              {mine && <span className="font-display">✓</span>}
            </button>
          );
        })}
      </div>
      {myOptionId && !closed && <p className="text-center font-display text-xl text-[#bfffdc]">VOTO REGISTRATO!</p>}
      {!myOptionId && phase === "CATEGORY_VOTING" && remainingMs <= 0 && <p className="text-center font-bold text-white/80">Votazione chiusa</p>}
      {error && <p className="text-center text-sm font-bold text-[#ffc2cd]">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ruota impazzita: sul telefono niente animazione sincronizzata, solo l'attesa e il risultato
// ---------------------------------------------------------------------------
export function PhoneWheelView({ wheel, nowMs }: { wheel: PublicWheel; nowMs: number }) {
  const spin = wheel.spin;
  if (!spin) return null;
  const stopped = spinElapsedMs(spin, nowMs) >= spin.durationMs;
  const winner = wheel.segments[spin.winnerIndex];
  const color = wheelColor(spin.winnerIndex);
  const labels = wheel.segments.map((s) => s.label);
  if (!stopped) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="w-56 animate-spin motion-reduce:animate-none" style={{ animationDuration: "1.1s" }}>
          <WheelGraphic labels={labels} calm showLabels={false} className="h-full w-full" />
        </div>
        <h1 className="font-display text-3xl leading-tight text-white [text-shadow:0_3px_0_rgba(0,0,0,.4)]">La ruota gira…</h1>
        <p className="font-display text-2xl text-gold">Guarda il TV!</p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Character who="palmino" small className="w-36 animate-float" />
      <p className="font-display text-2xl text-white">La ruota ha scelto:</p>
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 12 }}
        className="max-w-full break-words rounded-3xl border-4 border-white px-6 py-4 font-display text-4xl leading-tight shadow-2xl"
        style={{ background: color.bg, color: color.text }}
      >
        {winner?.label}
      </motion.div>
      <p className="font-bold text-white/80">Le prossime domande sono di questa categoria. Preparati!</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Classifica / finale
// ---------------------------------------------------------------------------
export function PhoneStandings({ entries, me, myRank, myPoints, lastDelta, title }: { entries: LeaderboardEntry[]; me: string; myRank: number | null; myPoints: number; lastDelta: number; title: string }) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <PhoneCard className="text-center">
        <p className="font-display text-xl text-gold">{title}</p>
        <p className="font-display text-6xl leading-none text-white">{myRank ? `${myRank}°` : "–"}</p>
        <p className="font-display text-2xl">{formatPoints(myPoints)} punti</p>
        {lastDelta !== 0 && (
          <p className={clsx("font-display text-xl", lastDelta > 0 ? "text-[#5dffab]" : "text-[#ff8098]")}>{signedPoints(lastDelta)} nell&apos;ultima domanda</p>
        )}
      </PhoneCard>
      <ol className="flex flex-col gap-1.5">
        {entries.slice(0, 10).map((e) => (
          <li key={e.participantId} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2", e.participantId === me ? "border-2 border-gold bg-gold/20" : "bg-black/40")}>
            <span className="w-7 text-center font-display text-gold">{e.rank}</span>
            <span className="min-w-0 flex-1 truncate font-extrabold">{e.nickname}</span>
            <span className="font-display">{formatPoints(e.points)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PhoneLogoTop() {
  return (
    <div className="flex justify-center pt-1">
      <Logo size="sm" />
    </div>
  );
}
