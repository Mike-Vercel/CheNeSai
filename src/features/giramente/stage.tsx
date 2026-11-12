"use client";

import { clsx } from "clsx";
import type React from "react";
import { useRef, useState } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { useAnswerKeys } from "@/features/shared/keyboard";
import { FINALE_WHEEL, formatPoints, PUZZLE_KIND_LABEL, RISK_POINTS, STANDARD_WHEEL, WHEEL_DESCRIPTION, WHEEL_LABEL } from "@/lib/giramente/rules";
import { roundInfo, type GiramenteAction, type PrivatePlay, type PrivateView, type PublicState } from "@/lib/giramente/types";
import { useAudioPrefs, useSpeech } from "./audio";
import { BrainIcon, Leaderboard, nameOf, Options, RoundBadge, RoundTitle, Timer, VisualBlock, useQuality } from "./ui";
import { newRequestId } from "./use-giramente";
import { GiramenteWheel, JollyPortal, SecretBoard, WHEEL_SEGMENTS_FINALE, WHEEL_SEGMENTS_STANDARD, type WheelSegment } from "./visuals";

/**
 * Schermate delle fasi di GIRAMENTE!, uguali per telefono, PC e TV. `view` = null sullo schermo TV
 * (nessuna azione, nessuna prova privata). Le azioni passano SEMPRE dal server: qui solo l'interfaccia.
 */
export interface StageProps {
  state: PublicState;
  view: PrivateView | null;
  now: () => number;
  act: (a: GiramenteAction) => Promise<boolean>;
  busy: boolean;
  keyHints: boolean;
  /** schermo TV: niente pulsanti, testi grandi */
  tv?: boolean;
}

/** Spicchi nell'ordine del server (0 INTRUSO … 7 COLPO DI SCENA), identico alla ruota 3D. */
const segmentsFor = (state: PublicState): WheelSegment[] => {
  const kinds = state.wheel.finale ? FINALE_WHEEL : STANDARD_WHEEL;
  const base = state.wheel.finale ? WHEEL_SEGMENTS_FINALE : WHEEL_SEGMENTS_STANDARD;
  // controllo di sicurezza: se l'ordine grafico non coincidesse col server, vince il server
  return kinds.map((k, i) => (base[i]?.kind === k ? base[i] : { id: `${k}-${i}`, kind: k, label: WHEEL_LABEL[k], color: "#20262b" }));
};

export function WheelStage({ state, now, className }: { state: PublicState; now: () => number; className?: string }) {
  const prefs = useAudioPrefs();
  const quality = useQuality();
  const spin = state.wheel.spin ? { spinId: state.wheel.spin.spinId, targetIndex: state.wheel.spin.targetIndex, startedAt: Date.parse(state.wheel.spin.startedAt), durationMs: state.wheel.spin.durationMs } : null;
  return (
    <GiramenteWheel
      segments={segmentsFor(state)}
      spin={spin}
      restIndex={state.wheel.restIndex}
      now={now}
      quality={quality}
      highlight={state.phase !== "SPINNING" && !!state.turn?.sector}
      onTick={() => prefs.sfx && getSoundEngine().play("wheelTick")}
      className={className}
    />
  );
}

/** Pulsante «AVANTI» di chi gestisce la partita (salta intro, risultati, classifiche). */
export function SkipButton({ state, view, act, busy }: { state: PublicState; view: PrivateView | null; act: StageProps["act"]; busy: boolean }) {
  if (!view?.isHost || state.pausedAt) return null;
  if (!["INTRO", "ROUND_INTRO", "TURN_RESULT", "REVEAL", "ROUND_RESULTS"].includes(state.phase) && !(state.phase === "WHEEL_RESULT" && !state.turn?.jolly?.offer && !(state.turn?.colpo && state.turn.colpo.accepted === null))) return null;
  return (
    <button type="button" className="gm-btn gm-btn-ghost min-h-11 text-lg" disabled={busy} onClick={() => void act({ action: "skip" })}>
      AVANTI ›
    </button>
  );
}

// ---------------------------------------------------------------------------
// Introduzioni
// ---------------------------------------------------------------------------
export function IntroScreen({ state, tv }: { state: PublicState; tv?: boolean }) {
  return (
    <section className="gm-pop flex w-full flex-col items-center gap-6 text-center">
      <p className="gm-display text-2xl text-[#39ff14]">Ecco i concorrenti!</p>
      <ul className={clsx("grid w-full gap-3", tv ? "grid-cols-4" : "grid-cols-2")}>
        {state.competitors.map((c, i) => (
          <li key={c.id} className="gm-panel gm-pop rounded-2xl p-3" style={{ animationDelay: `${i * 120}ms` }}>
            <p className="gm-display truncate text-2xl">{c.name}</p>
            {c.kind === "team" && <p className="truncate text-sm font-bold text-white/70">{c.members.map((m) => m.nickname).join(" · ")}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RoundIntroScreen({ state, tv }: { state: PublicState; tv?: boolean }) {
  const info = roundInfo(state.roundNo);
  const tie = state.stage === "tiebreak";
  return (
    <section className="gm-pop flex w-full flex-col items-center gap-5 text-center">
      {!tie && <RoundBadge roundNo={state.roundNo} />}
      <h2 className={clsx("gm-display leading-none", tv ? "text-8xl" : "text-5xl sm:text-6xl")}>{tie ? "SPAREGGIO!" : info?.name}</h2>
      <ul className="gm-panel flex w-full max-w-2xl flex-col gap-2 rounded-3xl p-4 text-left">
        {(tie
          ? [
              `Parità al primo posto tra ${state.stagePlay?.competitors.length ? "" : ""}${state.competitors
                .filter((c) => state.standings.find((s) => s.competitorId === c.id)?.position === 1)
                .map((c) => c.name)
                .join(", ")}.`,
              "Un enigma a indizi: 600, 400 o 200 punti. Vince chi ne fa di più.",
              "Ancora parità? Nuovo enigma.",
            ]
          : (info?.rules ?? [])
        ).map((r) => (
          <li key={r} className={clsx("flex gap-2 font-bold", tv ? "text-2xl" : "text-base sm:text-lg")}>
            <span aria-hidden className="text-[#39ff14]">▸</span>
            {r}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Verde / Rosso
// ---------------------------------------------------------------------------
export function ChoicePanel({ state, view, act, busy, keyHints, tv }: StageProps) {
  const can = !!view?.canAct && state.phase === "CHOICE" && !state.pausedAt;
  const t = RISK_POINTS[state.roundNo] ?? RISK_POINTS[1];
  const choose = (choice: "verde" | "rosso") => void act({ action: "choose_risk", choice });
  useAnswerKeys({ enabled: can && !busy, count: 2, onPick: (i) => choose(i === 0 ? "verde" : "rosso") });
  const who = nameOf(state, state.turn?.competitorId);
  return (
    <section className="flex w-full flex-col items-center gap-4">
      <RoundTitle name={state.roundName ?? ""} subtitle={can ? "Scegli quanto rischiare per il tuo turno!" : `${who} sceglie quanto rischiare…`} />
      <div className="grid w-full grid-cols-2 gap-3 sm:gap-5">
        {(["verde", "rosso"] as const).map((k, i) => (
          <button
            key={k}
            type="button"
            disabled={!can || busy}
            onClick={() => choose(k)}
            className={clsx("gm-panel flex flex-col items-center gap-1 rounded-3xl px-2 py-4 text-center transition enabled:hover:scale-[1.02] enabled:active:scale-[.98] sm:py-6", k === "verde" ? "gm-panel-green" : "gm-panel-red", !can && "opacity-90")}
          >
            <span aria-hidden className="text-3xl sm:text-4xl">{k === "verde" ? "🛡️" : "🔥"}</span>
            <span className={clsx("gm-display leading-none", tv ? "text-6xl" : "text-4xl sm:text-5xl")}>{k.toUpperCase()}</span>
            <span className="text-sm font-bold text-white/85 sm:text-base">{k === "verde" ? "Giocata sicura" : "Giocata rischiosa"}</span>
            <span className={clsx("gm-display mt-1 rounded-xl px-3 py-1 text-2xl sm:text-3xl", k === "verde" ? "bg-[#0f5a17] text-[#b6ff9e]" : "bg-[#700a16] text-[#ffc2c8]")}>+{t[k].win} punti</span>
            <span className="text-xs font-bold text-white/80 sm:text-sm">Se sbagli: {t[k].lose ? `−${t[k].lose}` : "0"} punti</span>
            {keyHints && can && <kbd className="mt-1 rounded border border-white/30 px-1.5 text-xs font-black text-white/60">{i + 1}</kbd>}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// GIRA!
// ---------------------------------------------------------------------------
export function SpinButton({ state, view, act, busy, keyHints }: StageProps) {
  const can = !!view?.canAct && state.phase === "SPIN" && !state.pausedAt;
  const req = useRef<string | null>(null);
  const spin = () => {
    // doppio clic: stesso id di richiesta, e il server restituisce comunque lo stesso giro
    req.current ??= newRequestId();
    void act({ action: "spin", requestId: req.current });
  };
  useAnswerKeys({ enabled: can && !busy, count: 1, onPick: spin, onConfirm: spin });
  if (!can) return <p className="gm-display text-center text-2xl text-white/80">{state.phase === "SPIN" ? `${nameOf(state, state.turn?.competitorId)} sta per girare…` : "La ruota gira…"}</p>;
  return (
    <button type="button" className="gm-btn gm-pulse h-20 w-full max-w-sm text-4xl" disabled={busy} onClick={spin}>
      ▶ GIRA!{keyHints && <kbd className="ml-2 rounded border border-white/40 px-1.5 text-sm">Invio</kbd>}
    </button>
  );
}

export function RiskChip({ state }: { state: PublicState }) {
  const r = state.turn?.risk;
  if (!r) return null;
  return <span className={clsx("gm-chip font-black", r === "rosso" ? "border-[#ff253a] text-[#ff8a95]" : "border-[#39ff14] text-[#b6ff9e]")}>{r === "rosso" ? "🔥 ROSSO" : "🛡️ VERDE"}</span>;
}

// ---------------------------------------------------------------------------
// Esito della ruota (Jolly, Colpo di scena, Bonus…)
// ---------------------------------------------------------------------------
export function SectorPanel({ state, view, act, busy, keyHints, tv }: StageProps) {
  const t = state.turn;
  const quality = useQuality();
  const speech = useSpeech();
  const can = !!view?.canAct && !state.pausedAt;
  const offer = !!t?.jolly?.offer && !t.jolly.chosen;
  const colpo = !!t?.colpo && t.colpo.accepted === null;
  useAnswerKeys({
    enabled: can && !busy && (offer || colpo),
    count: 2,
    onPick: (i) => void act(offer ? { action: "choose_jolly", power: i === 0 ? "occhio" : "scudo" } : { action: "colpo", accept: i === 0 }),
  });
  if (!t?.sector) return null;
  const jolly = t.sector === "jolly";
  return (
    <section className="gm-pop flex w-full flex-col items-center gap-4 text-center">
      {jolly && <JollyPortal play quality={quality} speaking={speech.who === "zafira"} className={clsx("mx-auto", tv ? "h-64" : "h-52")} />}
      <div className={clsx("gm-panel relative w-full max-w-xl overflow-hidden rounded-[2rem] px-5 py-5", jolly || t.sector === "colpo" ? "gm-panel-red" : "gm-panel-green")}>
        <p className="gm-display absolute left-1/2 top-0 -translate-x-1/2 rounded-b-xl bg-[#080b0d] px-4 py-0.5 text-sm text-white/80">ESITO DELLA RUOTA</p>
        <h2 className={clsx("gm-display mt-4 leading-none", tv ? "text-7xl" : "text-5xl")}>{WHEEL_LABEL[t.sector]}</h2>
        <p className="mt-2 text-lg font-bold italic text-white/90">{WHEEL_DESCRIPTION[t.sector]}</p>
        {t.jolly?.duplicate && <p className="gm-display mt-3 text-3xl text-[#f5c542]">Hai già un potere: +50 punti!</p>}
        {t.jolly?.chosen && <p className="gm-display mt-3 text-3xl text-[#39ff14]">{t.jolly.chosen === "occhio" ? "OCCHIO FURBO" : "SCUDO"} conquistato!</p>}
      </div>
      {offer &&
        (can ? (
          <div className="grid w-full max-w-xl grid-cols-2 gap-3">
            <button type="button" className="gm-panel gm-panel-green rounded-3xl p-4 text-left" disabled={busy} onClick={() => void act({ action: "choose_jolly", power: "occhio" })}>
              <span className="gm-display block text-2xl">👁 OCCHIO FURBO</span>
              <span className="text-sm font-bold text-white/85">Un indizio extra gratis, quando ti serve.</span>
              {keyHints && <kbd className="ml-1 rounded border border-white/30 px-1.5 text-xs">1</kbd>}
            </button>
            <button type="button" className="gm-panel gm-panel-red rounded-3xl p-4 text-left" disabled={busy} onClick={() => void act({ action: "choose_jolly", power: "scudo" })}>
              <span className="gm-display block text-2xl">🛡 SCUDO</span>
              <span className="text-sm font-bold text-white/85">Annulla una penalità del ROSSO.</span>
              {keyHints && <kbd className="ml-1 rounded border border-white/30 px-1.5 text-xs">2</kbd>}
            </button>
          </div>
        ) : (
          <p className="text-lg font-bold text-white/80">{nameOf(state, t.competitorId)} sceglie il potere della Jolly…</p>
        ))}
      {colpo &&
        (can ? (
          <div className="grid w-full max-w-xl grid-cols-2 gap-3">
            <button type="button" className="gm-btn" disabled={busy} onClick={() => void act({ action: "colpo", accept: true })}>
              ⚡ ACCETTO {keyHints && <kbd className="text-sm">1</kbd>}
            </button>
            <button type="button" className="gm-btn gm-btn-ghost" disabled={busy} onClick={() => void act({ action: "colpo", accept: false })}>
              NO, GRAZIE {keyHints && <kbd className="text-sm">2</kbd>}
            </button>
          </div>
        ) : (
          <p className="text-lg font-bold text-white/80">{nameOf(state, t.competitorId)} accetta la sfida lampo?</p>
        ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Domanda alla ruota e Giro Decisivo
// ---------------------------------------------------------------------------
export function QuestionPanel({ state, view, now, act, busy, keyHints, tv }: StageProps) {
  const q = state.question;
  const [picked, setPicked] = useState<{ playId: string; i: number } | null>(null);
  const [text, setText] = useState("");
  const req = useRef<{ playId: string; id: string } | null>(null);
  if (!q) return null;
  const result = state.phase === "TURN_RESULT" ? state.result : null;
  const can = !!view?.canAct && state.phase === "QUESTION" && !state.pausedAt && !result;
  const me = state.competitors.find((c) => c.id === state.turn?.competitorId);
  const requestId = () => {
    if (req.current?.playId !== q.playId) req.current = { playId: q.playId, id: newRequestId() };
    return req.current.id;
  };
  const answerChoice = (i: number) => {
    setPicked({ playId: q.playId, i });
    void act({ action: "answer", playId: q.playId, requestId: requestId(), choice: i });
  };
  const sector = state.turn?.sector;
  const options = q.options;
  const reveal = result && options ? { correct: options.indexOf(result.solution), given: result.given ? options.indexOf(result.given) : null } : null;
  return (
    <section className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {sector && <span className="gm-chip border-[#ff253a]/70 font-black">{WHEEL_LABEL[sector]}</span>}
        {q.kind && sector !== q.kind && <span className="gm-chip">{PUZZLE_KIND_LABEL[q.kind]}</span>}
        <RiskChip state={state} />
        <span className="gm-chip text-[#f5c542]">In palio: {formatPoints(q.pointsAtStake)}</span>
        <span className="ml-auto">{!result && <Timer timer={q.timer} now={now} pausedAt={state.pausedAt} size={tv ? "lg" : "md"} />}</span>
      </div>
      <div className="gm-panel gm-panel-green rounded-3xl p-4 sm:p-5">
        {q.clueCount > 0 && <h2 className={clsx("mb-3 text-center font-black leading-tight", tv ? "text-4xl" : "text-2xl sm:text-3xl")}>{q.prompt}</h2>}
        {q.clueCount > 0 ? (
          <FinaleClues state={state} />
        ) : (
          <>
            {q.clues.length > 0 && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {q.clues.map((c, i) => (
                  <li key={i} className={clsx("rounded-xl bg-black/45 px-3 py-2 font-bold", tv ? "text-2xl" : "text-base sm:text-lg")}>
                    <span className="mr-2 text-[#39ff14]">{i + 1}.</span>
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {q.visual && <VisualBlock visual={q.visual} className="mb-3" />}
        {/* eslint-disable-next-line @next/next/no-img-element -- immagini degli enigmi caricate dall'admin */}
        {q.imageUrl && <img src={q.imageUrl} alt={q.imageAlt ?? ""} className="mx-auto mb-3 max-h-56 rounded-2xl object-contain" />}
        {q.clueCount === 0 && <h2 className={clsx("text-center font-black leading-tight", tv ? "text-4xl" : "text-2xl sm:text-3xl")}>{q.prompt}</h2>}
        {q.extraClue && (
          <p className="gm-pop mt-3 rounded-2xl border border-[#ff253a]/60 bg-[#3a0610]/70 px-3 py-2 text-center font-bold">
            <span className="mr-1 font-black text-[#ff8a95]">👁 Occhio Furbo:</span>
            {q.extraClue}
          </p>
        )}
      </div>
      {options ? (
        <Options options={options} enabled={can && !busy} onPick={answerChoice} picked={picked?.playId === q.playId ? picked.i : null} reveal={reveal} keyHints={keyHints} />
      ) : can ? (
        <form
          className="flex w-full flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void act({ action: "answer", playId: q.playId, requestId: requestId(), text });
          }}
        >
          <input className="gm-input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi la tua risposta…" aria-label="La tua risposta" maxLength={120} autoComplete="off" autoFocus />
          <button type="submit" className="gm-btn" disabled={busy || !text.trim()}>
            ➤ CONFERMA
          </button>
        </form>
      ) : null}
      {can && (
        <div className="flex flex-wrap justify-center gap-2">
          {q.clueCount > 0 && q.clueLevel < q.clueCount && (
            <button type="button" className="gm-btn gm-btn-ghost min-h-12" disabled={busy} onClick={() => void act({ action: "next_clue", playId: q.playId })}>
              🔓 Sblocca il {q.clueLevel + 1}° indizio ({formatPoints([600, 400, 200][q.clueLevel])} punti)
            </button>
          )}
          {me?.jolly === "occhio" && !q.extraClue && q.clueCount === 0 && (
            <button type="button" className="gm-btn gm-btn-red min-h-12 text-lg" disabled={busy} onClick={() => void act({ action: "use_occhio", playId: q.playId })}>
              👁 USA OCCHIO FURBO
            </button>
          )}
        </div>
      )}
      {!can && !result && state.phase === "QUESTION" && <p className="text-center font-bold text-white/75">Risponde {state.mode === "teams" ? "il capitano di " : ""}{me?.name}…</p>}
      {result && <ResultCard state={state} tv={tv} />}
    </section>
  );
}

function FinaleClues({ state }: { state: PublicState }) {
  const q = state.question!;
  return (
    <div className="mb-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="gm-panel gm-panel-gold mx-auto grid h-28 w-28 place-items-center rounded-full text-center">
        <span>
          <span className="block text-[10px] font-black uppercase tracking-widest text-white/70">Punti in palio</span>
          <span className="gm-display block text-4xl text-[#f5c542]">{q.pointsAtStake}</span>
        </span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {[0, 1, 2].slice(0, q.clueCount).map((i) => {
          const c = q.clues[i];
          return (
            <li key={i} className={clsx("flex items-center gap-2 rounded-xl px-3 py-2 font-bold", c ? "bg-[#0f3a14]/80" : "border border-white/15 bg-black/40 text-white/60")}>
              <span className="gm-display grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/60 text-lg">{i + 1}</span>
              {c ?? `🔒 Indizio ${i + 1} (${[600, 400, 200][i]} punti)`}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ResultCard({ state, tv }: { state: PublicState; tv?: boolean }) {
  const r = state.result;
  if (!r) return null;
  return (
    <div className={clsx("gm-panel gm-pop rounded-3xl p-4 text-center", r.correct ? "gm-panel-green" : "gm-panel-red")} role="status">
      <p className={clsx("gm-display leading-none", tv ? "text-6xl" : "text-4xl")}>{r.correct ? "GIUSTO!" : r.timeout ? "TEMPO SCADUTO" : "SBAGLIATO"}</p>
      <p className="mt-2 text-lg font-bold">
        Soluzione: <span className="text-[#39ff14]">{r.solution}</span>
      </p>
      {r.explanation && <p className="mt-1 text-sm font-semibold text-white/80">{r.explanation}</p>}
      <ul className="mt-2 flex flex-wrap justify-center gap-2">
        {r.lines.map((l, i) => (
          <li key={i} className={clsx("gm-chip", l.delta > 0 ? "text-[#b6ff9e]" : l.delta < 0 ? "text-[#ff8a95]" : "text-white")}>
            {l.label} {l.delta !== 0 && <b>{l.delta > 0 ? `+${l.delta}` : l.delta}</b>}
          </li>
        ))}
      </ul>
      {r.shieldUsed && <p className="mt-2 font-black text-[#ff8a95]">🛡 Lo Scudo della Jolly ha cancellato la penalità!</p>}
      <p className={clsx("gm-display mt-2", tv ? "text-5xl" : "text-3xl", r.delta > 0 ? "text-[#39ff14]" : r.delta < 0 ? "text-[#ff253a]" : "text-white")}>{r.delta > 0 ? `+${r.delta}` : r.delta} punti</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prove contemporanee / a turno
// ---------------------------------------------------------------------------
const STAGE_TITLE: Record<string, string> = { falsa: "LA FALSA PISTA", collegamento: "IL COLLEGAMENTO", tabellone: "IL TABELLONE SEGRETO", tiebreak: "SPAREGGIO" };

export function PlayPanel(props: StageProps) {
  const { state, view, now, tv } = props;
  const sp = state.stagePlay;
  if (!sp) return null;
  const mine = view?.plays ?? [];
  const canAct = !!view?.canAct;
  const allDone = mine.length > 0 && mine.every((p) => p.status !== "open");
  return (
    <section className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <RoundTitle name={STAGE_TITLE[sp.stage] ?? ""} subtitle={sp.simultaneous ? "Tutti insieme, ognuno sul suo dispositivo" : `Tocca a ${nameOf(state, sp.competitorId)}`} />
        <span className="ml-auto">
          <Timer timer={sp.timer} now={now} pausedAt={state.pausedAt} size={tv ? "lg" : "md"} />
        </span>
      </div>
      {mine.length > 0 && !allDone ? (
        <div className="flex flex-col gap-4">
          {mine.map((p) => (
            <PrivatePlayForm key={p.playId} play={p} {...props} canAct={canAct} />
          ))}
        </div>
      ) : (
        <SpectatorPlay state={state} tv={tv} done={allDone} />
      )}
    </section>
  );
}

function SpectatorPlay({ state, tv, done }: { state: PublicState; tv?: boolean; done: boolean }) {
  const sp = state.stagePlay!;
  const c = sp.common;
  return (
    <div className="flex flex-col gap-3">
      {done && <p className="gm-panel gm-panel-green rounded-2xl p-3 text-center text-lg font-black">✓ Risposte registrate. Le scopriamo quando hanno finito tutti!</p>}
      {c?.falsa && (
        <div className="grid gap-3 sm:grid-cols-2">
          {c.falsa.map((f, i) => (
            <div key={i} className="gm-panel rounded-2xl p-3">
              <p className="gm-display mb-1 text-xl text-[#39ff14]">Enigma {i + 1}</p>
              <ol className="flex flex-col gap-1">
                {f.clues.map((cl, j) => (
                  <li key={j} className={clsx("font-bold", tv ? "text-2xl" : "text-base")}>
                    <span className="gm-letter mr-2 inline-grid h-7 w-7 text-base">{"ABCD"[j]}</span>
                    {cl}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      {c?.collegamento && (
        <div className="flex flex-wrap justify-center gap-3">
          {c.collegamento.words.map((w) => (
            <span key={w} className={clsx("gm-panel gm-panel-green gm-display rounded-2xl px-5 py-3", tv ? "text-6xl" : "text-3xl")}>
              {w}
            </span>
          ))}
        </div>
      )}
      {c?.tabellone && <SecretBoard category={c.tabellone.category} rows={c.tabellone.rows} quality="2d" />}
      {c?.tiebreak && (
        <div className="gm-panel rounded-2xl p-4 text-center">
          {c.tiebreak.visual && <VisualBlock visual={c.tiebreak.visual} className="mb-2" />}
          <p className={clsx("font-black", tv ? "text-4xl" : "text-2xl")}>{c.tiebreak.prompt}</p>
          <p className="mt-2 font-bold text-[#b6ff9e]">1° indizio: {c.tiebreak.firstClue}</p>
        </div>
      )}
      {!sp.simultaneous && <p className="gm-panel rounded-2xl p-4 text-center text-xl font-black">{nameOf(state, sp.competitorId)} sta giocando… niente suggerimenti!</p>}
      <ul className="flex flex-wrap justify-center gap-2">
        {sp.competitors.map((id) => {
          const comp = state.competitors.find((x) => x.id === id);
          return (
            <li key={id} className={clsx("gm-chip", comp?.done ? "border-[#39ff14] text-[#b6ff9e]" : "text-white/70")}>
              {comp?.done ? "✓" : "…"} {comp?.name}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PrivatePlayForm({ play, act, busy, canAct, keyHints, state, view }: StageProps & { play: PrivatePlay; canAct: boolean }) {
  const [falseIndex, setFalseIndex] = useState<number | null>(null);
  const [text, setText] = useState("");
  const req = useRef(newRequestId());
  const open = play.status === "open" && !state.pausedAt;
  const can = canAct && open;
  const holderId = view?.competitorId ?? state.stagePlay?.competitorId ?? null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can) return;
    if (play.stage === "falsa" && falseIndex === null) return;
    if (!text.trim() && play.stage !== "falsa") return;
    void act({ action: "answer", playId: play.playId, requestId: req.current, falseIndex: falseIndex ?? undefined, text });
  };
  useAnswerKeys({ enabled: can && play.stage === "falsa" && !busy, count: 4, onPick: setFalseIndex });
  if (play.status !== "open") {
    return <p className="gm-panel gm-panel-green rounded-2xl p-3 text-center font-black">✓ Risposta registrata{play.status === "timeout" ? " (tempo scaduto)" : ""}</p>;
  }
  return (
    <form onSubmit={submit} className="gm-panel gm-panel-green flex flex-col gap-3 rounded-3xl p-4">
      {play.stage === "falsa" && (
        <>
          <p className="gm-display text-xl text-[#39ff14]">Enigma {play.turnNo} · trova la FALSA PISTA</p>
          <div className="grid gap-2">
            {play.clues.map((c, i) => (
              <button key={i} type="button" className="gm-option" aria-pressed={falseIndex === i} disabled={!can} onClick={() => setFalseIndex(i)}>
                <span className="gm-letter">{"ABCD"[i]}</span>
                <span className="flex-1">{c}</span>
                {keyHints && can && <kbd className="rounded border border-white/30 px-1.5 text-xs text-white/60">{i + 1}</kbd>}
              </button>
            ))}
          </div>
          <label className="font-bold" htmlFor={`sol-${play.playId}`}>
            Qual è la soluzione comune?
          </label>
        </>
      )}
      {play.stage === "collegamento" && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {play.words.map((w) => (
              <span key={w} className="gm-display rounded-2xl border-2 border-[#39ff14] bg-black/60 px-4 py-2 text-2xl sm:text-3xl">
                {w}
              </span>
            ))}
          </div>
          {play.extraClue && <p className="rounded-2xl bg-[#3a0610]/70 px-3 py-2 text-center font-bold">4° indizio: {play.extraClue}</p>}
          <p className="text-center font-bold text-[#f5c542]">In palio: {play.pointsAtStake} punti</p>
        </>
      )}
      {play.stage === "tabellone" && play.board && (
        <>
          <SecretBoard category={play.board.category} rows={play.board.rows} quality="2d" />
          {play.board.hint && <p className="rounded-2xl bg-[#3a0610]/70 px-3 py-2 text-center font-bold">Indizio: {play.board.hint}</p>}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="gm-chip text-[#f5c542]">In palio: {play.pointsAtStake}</span>
            <button type="button" className="gm-btn gm-btn-ghost min-h-11 text-base" disabled={!can || busy || !play.board.canReveal} onClick={() => void act({ action: "reveal_letter", playId: play.playId })}>
              🔤 SVELA LETTERA (−25)
            </button>
            <button type="button" className="gm-btn gm-btn-ghost min-h-11 text-base" disabled={!can || busy || !!play.board.hint} onClick={() => void act({ action: "board_hint", playId: play.playId })}>
              💡 INDIZIO (−50)
            </button>
          </div>
        </>
      )}
      {play.stage === "tiebreak" && (
        <>
          {play.visual && <VisualBlock visual={play.visual} />}
          <p className="text-center text-2xl font-black">{play.prompt}</p>
          <ol className="flex flex-col gap-1">
            {play.clues.map((c, i) => (
              <li key={i} className="rounded-xl bg-[#0f3a14]/80 px-3 py-2 font-bold">
                {i + 1}. {c}
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-center gap-2">
            <span className="gm-chip text-[#f5c542]">In palio: {play.pointsAtStake}</span>
            {play.clueLevel < play.clueCount && (
              <button type="button" className="gm-btn gm-btn-ghost min-h-11 text-base" disabled={!can || busy} onClick={() => void act({ action: "next_clue", playId: play.playId })}>
                🔓 Altro indizio
              </button>
            )}
          </div>
        </>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`sol-${play.playId}`}
          className="gm-input flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={play.stage === "tabellone" ? "Scrivi la frase completa…" : play.stage === "collegamento" ? "Il concetto comune…" : "Scrivi la tua risposta…"}
          aria-label="Risposta"
          maxLength={120}
          autoComplete="off"
          disabled={!can}
        />
        <button type="submit" className="gm-btn" disabled={!can || busy || (!text.trim() && play.stage !== "falsa") || (play.stage === "falsa" && falseIndex === null)}>
          {play.stage === "tabellone" ? "RISOLVI" : "CONFERMA"}
        </button>
      </div>
      {play.stage === "collegamento" && !play.extraClue && (
        <button type="button" className="gm-btn gm-btn-ghost min-h-11 self-center text-base" disabled={!can || busy} onClick={() => void act({ action: "next_clue", playId: play.playId })}>
          🔎 Chiedi il 4° indizio (vale 100 invece di 250)
        </button>
      )}
      {(play.stage === "collegamento" || play.stage === "tabellone") && <OcchioButton state={state} play={play} act={act} busy={busy} can={can} holderId={holderId} />}
      {!canAct && <p className="text-center text-sm font-bold text-white/70">Conferma il capitano della squadra: suggeritegli la risposta!</p>}
    </form>
  );
}

/** Occhio Furbo nelle prove della manche 4 (quarto indizio o indizio del tabellone gratis). */
function OcchioButton({ state, play, act, busy, can, holderId }: { state: PublicState; play: PrivatePlay; act: StageProps["act"]; busy: boolean; can: boolean; holderId: string | null }) {
  const holder = state.competitors.find((c) => c.id === holderId && c.jolly === "occhio");
  const already = play.stage === "collegamento" ? !!play.extraClue : !!play.board?.hint;
  if (!holder || already || !can) return null;
  return (
    <button type="button" className="gm-btn gm-btn-red min-h-11 self-center text-base" disabled={busy} onClick={() => void act({ action: "use_occhio", playId: play.playId })}>
      👁 USA OCCHIO FURBO ({play.stage === "collegamento" ? "4° indizio gratis" : "indizio gratis"})
    </button>
  );
}

// ---------------------------------------------------------------------------
// Passaggio del telefono (un solo dispositivo)
// ---------------------------------------------------------------------------
export function TurnReady({ state, view, act, busy }: StageProps) {
  const sp = state.stagePlay;
  const name = nameOf(state, sp?.competitorId);
  const team = state.mode === "teams";
  return (
    <section className="gm-pop flex w-full flex-col items-center gap-5 py-6 text-center">
      <p className="gm-display text-2xl text-white/80">{STAGE_TITLE[sp?.stage ?? ""]} · {sp?.turnNo} di {sp?.turnOf}</p>
      <p className="gm-display text-6xl leading-none text-[#39ff14] sm:text-7xl">TOCCA A {name.toUpperCase()}</p>
      <p className="max-w-md text-lg font-bold text-white/85">Passa il telefono {team ? "alla squadra" : `a ${name}`}. Gli altri non guardano: l&apos;enigma è solo per {team ? "voi" : "te"}.</p>
      {view?.isOwner && (
        <button type="button" className="gm-btn h-16 text-2xl" disabled={busy || !!state.pausedAt} onClick={() => void act({ action: "start_turn" })}>
          {team ? `SIAMO ${name.toUpperCase()}` : `SONO ${name.toUpperCase()}`} — INIZIA
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rivelazione, classifica, vincitore
// ---------------------------------------------------------------------------
export function RevealPanel({ state, tv }: { state: PublicState; tv?: boolean }) {
  const r = state.reveal;
  if (!r) return null;
  return (
    <section className="flex w-full flex-col gap-3">
      <RoundTitle name={STAGE_TITLE[r.stage] ?? "RISULTATI"} subtitle="Ecco com'è andata" />
      {r.board && <SecretBoard category={r.board.category} rows={r.board.rows} solved quality="2d" />}
      {r.solutions.length > 0 && r.stage !== "tabellone" && (
        <p className="gm-panel gm-panel-green rounded-2xl p-3 text-center text-xl font-black">
          {r.stage === "falsa" ? "Soluzioni: " : "Soluzione: "}
          <span className="text-[#39ff14]">{r.solutions.join(" · ")}</span>
        </p>
      )}
      {r.tiebreakWinner !== null && r.stage === "tiebreak" && <p className="gm-display text-center text-4xl text-[#f5c542]">Vince lo spareggio: {nameOf(state, r.tiebreakWinner)}!</p>}
      {r.stage === "tiebreak" && !r.tiebreakWinner && <p className="gm-display text-center text-3xl text-[#ff8a95]">Ancora parità: nuovo enigma!</p>}
      <ul className={clsx("grid gap-2", tv ? "grid-cols-2" : "sm:grid-cols-2")}>
        {r.results.map((res) => (
          <li key={res.competitorId} className="gm-panel rounded-2xl p-3">
            <p className="flex items-center justify-between gap-2">
              <span className="gm-display truncate text-2xl">{nameOf(state, res.competitorId)}</span>
              <span className={clsx("gm-display text-2xl", res.points > 0 ? "text-[#39ff14]" : "text-white/70")}>+{res.points}</span>
            </p>
            <ul className="mt-1 flex flex-col gap-1 text-sm font-bold">
              {res.items.map((it) => (
                <li key={it.playId} className={clsx("rounded-lg px-2 py-1", it.correct ? "bg-[#0f3a14]/70" : "bg-[#3a0610]/60")}>
                  {it.correct ? "✓" : "✗"} {it.given ?? "nessuna risposta"}
                  {!state.stagePlay?.simultaneous && state.devices === "shared" && <span className="block text-white/75">Soluzione: {it.solution}</span>}
                  {it.detail && <span className="block text-white/65">{it.detail}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RoundResultsPanel({ state, view, tv }: { state: PublicState; view: PrivateView | null; tv?: boolean }) {
  return (
    <section className="flex w-full flex-col items-center gap-3">
      <RoundBadge roundNo={state.roundNo} />
      <p className="gm-display text-3xl">Fine manche: {state.roundName}</p>
      <Leaderboard state={state} highlight={view?.competitorId} className="w-full max-w-2xl" compact={!tv && state.competitors.length > 6} />
    </section>
  );
}

export function FinalPanel({ state, view, tv, onNew }: { state: PublicState; view: PrivateView | null; tv?: boolean; onNew?: () => void }) {
  const winners = state.competitors.filter((c) => state.winners.includes(c.id));
  return (
    <section className="flex w-full flex-col items-center gap-4 text-center">
      <div className="gm-pop relative">
        <span aria-hidden className={clsx("block", tv ? "text-9xl" : "text-7xl")}>🏆</span>
      </div>
      <p className={clsx("gm-display leading-none text-[#f5c542] drop-shadow-[0_0_24px_rgba(245,197,66,.6)]", tv ? "text-9xl" : "text-6xl sm:text-7xl")}>VINCITORE!</p>
      {winners.map((w) => (
        <div key={w.id} className="gm-panel gm-panel-gold gm-pop rounded-3xl px-6 py-3">
          <p className="gm-display text-4xl">👑 {w.name}</p>
          <p className="gm-display text-3xl text-[#f5c542]">{formatPoints(w.score)} punti</p>
        </div>
      ))}
      {winners.length > 1 && <p className="font-bold text-white/80">Vittoria condivisa!</p>}
      <Leaderboard state={state} highlight={view?.competitorId} className="w-full max-w-2xl" compact={state.competitors.length > 6} />
      {onNew && view?.isHost && (
        <button type="button" className="gm-btn gm-btn-gold" onClick={onNew}>
          ▶ NUOVA PARTITA
        </button>
      )}
    </section>
  );
}

export function PausedBanner({ state }: { state: PublicState }) {
  if (!state.pausedAt) return null;
  return (
    <div role="status" className="gm-panel gm-panel-red gm-glow-red fixed left-1/2 top-[calc(5rem+env(safe-area-inset-top))] z-40 -translate-x-1/2 rounded-full px-6 py-2">
      <span className="gm-display text-2xl">⏸ PAUSA</span>
    </div>
  );
}

export { BrainIcon };
