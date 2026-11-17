"use client";

import "./tig-games.css";
import { clsx } from "clsx";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { TeamOutcome } from "@/lib/tig/games/contract";
import type { BaseView } from "@/lib/tig/games/extras";
import type { GameStage, PlayerGameProps, TvGameProps } from "../ui-contract";
import { Icon } from "./icons";

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/** Ora del server (via `now()`), aggiornata a intervalli: per countdown e fasi interne della prova. */
export function useClock(now: () => number, active = true, everyMs = 200): number {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setT(now()), everyMs);
    return () => window.clearInterval(id);
  }, [now, active, everyMs]);
  return active ? t : now();
}

/** Tempo trascorso nella prova (ms), ricavato dalla scadenza: si ferma con lei (pausa del server). */
export function elapsedOf(durationMs: number, deadlineAt: number, t: number): number {
  return Math.min(durationMs, Math.max(0, durationMs - (deadlineAt - t)));
}

export function secondsLeft(deadlineAt: number, t: number): number {
  return Math.max(0, Math.ceil((deadlineAt - t) / 1000));
}

// ---------------------------------------------------------------------------
// Invio
// ---------------------------------------------------------------------------

export function useSubmit<S>(submit: (payload: S) => Promise<{ ok: boolean; reason?: string }>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** questo telefono ha inviato (e il server ha accettato): solo allora al reveal si mostrano le «sue» scelte */
  const [sent, setSent] = useState(false);
  const send = useCallback(
    async (payload: S) => {
      if (pending) return;
      setPending(true);
      setError(null);
      try {
        const r = await submit(payload);
        if (!r.ok) setError(r.reason ?? "Invio non accettato");
        else setSent(true);
      } catch {
        setError("Connessione assente: riprova");
      } finally {
        setPending(false);
      }
    },
    [submit, pending],
  );
  return { send, pending, error, sent };
}

/** Il telefono può ancora interagire con le scelte (non inviato, prova aperta). */
export function canEdit(stage: GameStage, submitted: boolean): boolean {
  return stage === "play" && !submitted;
}

// ---------------------------------------------------------------------------
// Cornice del giocatore (telefono / PC)
// ---------------------------------------------------------------------------

const INPUT_LABEL: Record<BaseView["input"], string> = {
  team: "Decisione di squadra",
  vote: "Voto personale segreto",
  coop: "Cooperazione",
  duel: "Tavolo contro tavolo",
  pub: "Un voto per tavolo",
};

export function PlayerFrame({
  view,
  p,
  children,
  footer,
  hideTimer = false,
}: {
  view: BaseView;
  p: Pick<PlayerGameProps, "stage" | "deadlineAt" | "now" | "canSubmit" | "submitted" | "myTeam">;
  children: ReactNode;
  footer?: ReactNode;
  hideTimer?: boolean;
}) {
  const t = useClock(p.now, p.stage === "play");
  const left = secondsLeft(p.deadlineAt, t);
  const personal = view.input === "vote";
  return (
    <div className="tg-root tg-player mx-auto flex min-h-full w-full max-w-[760px] flex-col gap-3 px-3 pb-3 pt-3 sm:gap-4 sm:px-6 sm:pt-6">
      <header className="tg-glass flex items-center gap-3 rounded-2xl px-4 py-3">
        <span className="tg-num grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#c6ff3d] text-xl text-[#0b0d12]">{String(view.number).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <h1 className="tg-display line-clamp-2 text-[1.6rem] leading-[0.95] sm:text-4xl">{view.title}</h1>
          <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[#9aa4b2] sm:text-xs">
            Tavolo {p.myTeam.tableNo} · {INPUT_LABEL[view.input]}
          </p>
        </div>
        {!hideTimer && p.stage === "play" && (
          <div className={clsx("tg-num flex h-12 min-w-14 items-center justify-center rounded-xl border px-2 text-3xl", left <= 5 ? "tg-pulse border-[#ff3b4e] text-[#ff3b4e]" : "border-white/15 text-[#eef2f6]")} aria-label={`${left} secondi`}>
            {left}
          </div>
        )}
      </header>

      <p className="px-1 text-[15px] font-semibold leading-snug text-[#eef2f6]/85 sm:text-base">{view.rule}</p>

      <StatusStrip stage={p.stage} submitted={p.submitted} canSubmit={p.canSubmit} personal={personal} />

      <main className="flex flex-1 flex-col gap-3">{children}</main>

      {footer && <footer className="sticky bottom-0 -mx-3 mt-1 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/95 to-transparent px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-4 sm:-mx-6 sm:px-6">{footer}</footer>}
    </div>
  );
}

function StatusStrip({ stage, submitted, canSubmit, personal }: { stage: GameStage; submitted: boolean; canSubmit: boolean; personal: boolean }) {
  if (stage === "reveal") return null;
  if (submitted)
    return (
      <div role="status" className="tg-pop tg-stripes flex items-center gap-2 rounded-xl border border-[#c6ff3d]/60 bg-[#c6ff3d]/10 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-[#c6ff3d]">
        <Icon name="check" className="h-5 w-5" /> {personal ? "Voto inviato" : "Scelta inviata"} · in attesa degli altri tavoli
      </div>
    );
  if (stage === "locked")
    return (
      <div role="status" className="tg-stripes-red flex items-center gap-2 rounded-xl border border-[#ff3b4e]/60 bg-[#ff3b4e]/10 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-[#ff8c97]">
        <Icon name="lock" className="h-5 w-5" /> Tempo scaduto · risposte chiuse
      </div>
    );
  if (!canSubmit && !personal)
    return (
      <div role="note" className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-[#eef2f6]/90">
        <Icon name="crown" className="h-5 w-5 shrink-0 text-[#ffc24a]" /> Invia il capitano. Tu prepara la tua proposta e mostrala al tavolo.
      </div>
    );
  return null;
}

/** Pulsante d'invio con stati chiari (in invio, inviato, solo capitano, errore). */
export function SubmitBar({
  canSubmit,
  submitted,
  stage,
  ready,
  pending,
  error,
  onSubmit,
  label = "Invia",
  hint,
  kbd,
}: {
  canSubmit: boolean;
  submitted: boolean;
  stage: GameStage;
  ready: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: () => void;
  label?: string;
  hint?: string;
  /** tasto che invia dal PC (mostrato solo su schermi grandi) */
  kbd?: string;
}) {
  if (stage !== "play" || submitted) return null;
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="tg-shake rounded-lg bg-[#ff3b4e]/15 px-3 py-2 text-sm font-bold text-[#ff8c97]">
          {error}
        </p>
      )}
      {canSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!ready || pending}
          className={clsx(
            "tg-display flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-3xl transition-transform duration-150 active:scale-[0.98] sm:h-[4.5rem]",
            ready && !pending ? "bg-[#c6ff3d] text-[#0b0d12] shadow-[0_0_40px_-8px_rgba(198,255,61,0.7)]" : "cursor-not-allowed border border-white/10 bg-[#1b212c] text-white/40",
          )}
        >
          {pending ? "Invio…" : label}
          {!pending && <Icon name="arrow" className="h-7 w-7" />}
          {kbd && !pending && <kbd className="hidden rounded-md border border-current px-1.5 py-0.5 font-sans text-xs font-extrabold opacity-60 lg:inline">{kbd}</kbd>}
          <span className="sr-only">{ready ? "" : " (completa la scelta)"}</span>
        </button>
      ) : (
        <div className="tg-display flex h-16 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-[#12161f] text-xl text-white/55">
          <Icon name="crown" className="h-6 w-6 text-[#ffc24a]" /> Solo il capitano invia
        </div>
      )}
      {hint && <p className="text-center text-xs font-semibold text-[#9aa4b2]">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Opzioni
// ---------------------------------------------------------------------------

export type OptionState = "idle" | "picked" | "right" | "wrong" | "missed";

export function OptionButton({
  index,
  text,
  state,
  onClick,
  disabled,
  multi = false,
  big = false,
  children,
}: {
  index?: number;
  text: ReactNode;
  state: OptionState;
  onClick?: () => void;
  disabled?: boolean;
  multi?: boolean;
  big?: boolean;
  children?: ReactNode;
}) {
  const picked = state === "picked";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={onClick ? picked : undefined}
      className={clsx(
        "group relative flex w-full items-center gap-3 rounded-2xl border-2 px-3 text-left transition-[transform,background-color,border-color] duration-150 active:scale-[0.985]",
        big ? "min-h-[4.25rem] py-3" : "min-h-14 py-2.5",
        state === "idle" && "border-white/12 bg-white/[0.04] hover:border-white/35",
        picked && "tg-picked border-[#c6ff3d] text-white",
        state === "right" && "border-[#c6ff3d] bg-[#c6ff3d] text-[#0b0d12]",
        state === "wrong" && "tg-stripes-red border-[#ff3b4e] text-white",
        state === "missed" && "border-[#c6ff3d] border-dashed bg-[#c6ff3d]/10 text-white",
        disabled && state === "idle" && "opacity-60",
      )}
    >
      {index !== undefined && (
        <span
          className={clsx(
            "tg-num grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg",
            state === "right" ? "bg-[#0b0d12] text-[#c6ff3d]" : picked ? "bg-[#c6ff3d] text-[#0b0d12]" : "bg-white/10 text-white/80",
          )}
          aria-hidden
        >
          {index + 1}
        </span>
      )}
      <span className={clsx("min-w-0 flex-1 font-bold leading-snug", big ? "text-lg sm:text-xl" : "text-base sm:text-lg", state === "wrong" && "line-through decoration-2")}>{text}</span>
      {children}
      <span className="shrink-0" aria-hidden>
        {picked && <Icon name={multi ? "checkbox" : "check"} className="h-6 w-6 text-[#c6ff3d]" />}
        {state === "right" && <Icon name="check" className="h-6 w-6" />}
        {state === "wrong" && <Icon name="x" className="h-6 w-6 text-[#ff3b4e]" />}
        {state === "missed" && <Icon name="check" className="h-6 w-6 text-[#c6ff3d]" />}
        {state === "idle" && multi && <Icon name="box" className="h-6 w-6 text-white/40" />}
      </span>
      <span className="sr-only">
        {picked ? " · selezionata" : state === "right" ? " · risposta giusta" : state === "wrong" ? " · scelta sbagliata" : state === "missed" ? " · era giusta" : ""}
      </span>
    </button>
  );
}

/** Stato di un'opzione al reveal: giusta, scelta sbagliata, giusta non scelta. */
export function revealState(id: string, solution: readonly string[], mine: readonly string[]): OptionState {
  const right = solution.includes(id);
  const picked = mine.includes(id);
  if (right && picked) return "right";
  if (right) return mine.length ? "missed" : "right";
  if (picked) return "wrong";
  return "idle";
}

// ---------------------------------------------------------------------------
// Pannelli comuni
// ---------------------------------------------------------------------------

export function Panel({ children, className, tone }: { children: ReactNode; className?: string; tone?: "lime" | "red" }) {
  return <section className={clsx("tg-glass rounded-2xl p-4", tone === "lime" && "tg-glass-lime", tone === "red" && "tg-glass-red", className)}>{children}</section>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#9aa4b2]", className)}>{children}</p>;
}

/** Il telefono rimanda alla TV (contenuto mostrato solo sul grande schermo per qualche secondo). */
export function WatchTv({ untilMs, elapsed, what }: { untilMs: number; elapsed: number; what: string }) {
  const left = Math.max(0, Math.ceil((untilMs - elapsed) / 1000));
  return (
    <Panel tone="lime" className="tg-pop flex flex-col items-center gap-3 py-10 text-center">
      <Icon name="tv" className="h-16 w-16 text-[#c6ff3d]" />
      <p className="tg-display text-5xl">Guardate la TV</p>
      <p className="max-w-xs text-base font-semibold text-white/80">{what}</p>
      <p className="tg-num text-6xl text-[#c6ff3d]" aria-live="polite">
        {left}
      </p>
    </Panel>
  );
}

/** Esito del proprio tavolo dopo il reveal. */
export function MyOutcome({ outcome }: { outcome: TeamOutcome | null }) {
  if (!outcome) return null;
  const pos = outcome.points > 0;
  const neg = outcome.points < 0;
  return (
    <Panel tone={neg ? "red" : pos ? "lime" : undefined} className="tg-pop flex items-center gap-4">
      <div className={clsx("tg-num text-6xl leading-none", pos ? "text-[#c6ff3d]" : neg ? "text-[#ff3b4e]" : "text-white/70")}>
        {pos ? "+" : neg ? "−" : ""}
        {Math.abs(outcome.points)}
      </div>
      <div className="min-w-0">
        <Eyebrow>Il vostro esito</Eyebrow>
        <p className="text-lg font-extrabold leading-tight">{outcome.label || (pos ? "Punti presi" : "Nessun punto")}</p>
        {outcome.chaos > 0 && (
          <p className="mt-1 flex items-center gap-1 text-sm font-bold text-[#b49cff]">
            <Icon name="bolt" className="h-4 w-4" /> +{outcome.chaos} Energia Caos
          </p>
        )}
      </div>
    </Panel>
  );
}

export function Explain({ text, title = "Perché" }: { text: string; title?: string }) {
  return (
    <Panel className="tg-rise">
      <Eyebrow className="mb-1 text-[#c6ff3d]">{title}</Eyebrow>
      <p className="text-base font-semibold leading-relaxed text-white/90">{text}</p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// TV
// ---------------------------------------------------------------------------

/**
 * Cornice TV: si adatta al contenitore (unità `cqw`: 1cqw = 1% della larghezza), trasparente sopra l'arena 3D.
 * Titolo in alto a sinistra, timer in alto a destra, contenuto al centro, tavoli in basso.
 */
export function TvFrame({
  view,
  p,
  children,
  hideTimer = false,
  subtitle,
}: {
  view: BaseView;
  p: Pick<TvGameProps, "stage" | "deadlineAt" | "now" | "teams" | "outcome">;
  children: ReactNode;
  hideTimer?: boolean;
  subtitle?: ReactNode;
}) {
  return (
    <div className="tg-root @container absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 flex flex-col gap-[1.2cqw] p-[2.2cqw]">
        <div className="flex items-start gap-[1.4cqw]">
          <div className="tg-glass tg-rise flex items-center gap-[1.2cqw] rounded-[1.4cqw] py-[0.9cqw] pl-[0.9cqw] pr-[1.8cqw]">
            <span className="tg-num grid h-[4.6cqw] w-[4.6cqw] place-items-center rounded-[0.9cqw] bg-[#c6ff3d] text-[2.6cqw] text-[#0b0d12]">{String(view.number).padStart(2, "0")}</span>
            <div>
              <p className="tg-display text-[3.4cqw]">{view.title}</p>
              <p className="mt-[0.3cqw] max-w-[52cqw] text-[1.15cqw] font-bold leading-snug text-white/80">{subtitle ?? view.rule}</p>
            </div>
          </div>
          <div className="flex-1" />
          {!hideTimer && <TvTimer p={p} durationMs={view.durationMs} />}
          {p.stage === "locked" && (
            <div className="tg-glass tg-glass-red tg-pop flex items-center gap-[0.6cqw] rounded-[1.2cqw] px-[1.4cqw] py-[1cqw]">
              <Icon name="lock" className="h-[2.2cqw] w-[2.2cqw] text-[#ff3b4e]" />
              <span className="tg-display text-[2.2cqw]">Risposte chiuse</span>
            </div>
          )}
        </div>
        <div className="tg-tv-body relative min-h-0 flex-1">{children}</div>
        <TeamStrip teams={p.teams} outcome={p.stage === "reveal" ? p.outcome : null} />
      </div>
    </div>
  );
}

function TvTimer({ p, durationMs }: { p: Pick<TvGameProps, "stage" | "deadlineAt" | "now">; durationMs: number }) {
  const t = useClock(p.now, p.stage === "play");
  if (p.stage !== "play") return null;
  const left = secondsLeft(p.deadlineAt, t);
  const frac = Math.max(0, Math.min(1, (p.deadlineAt - t) / Math.max(1, durationMs)));
  const r = 42;
  const c = 2 * Math.PI * r;
  const low = left <= 5;
  return (
    <div className="tg-glass relative grid h-[8.5cqw] w-[8.5cqw] place-items-center rounded-full" aria-label={`${left} secondi`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={7} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={low ? "#ff3b4e" : "#c6ff3d"} strokeWidth={7} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset 200ms linear" }} />
      </svg>
      <span className={clsx("tg-num text-[3.6cqw]", low && "tg-pulse text-[#ff3b4e]")}>{left}</span>
    </div>
  );
}

/** Tavoli in basso: chi ha inviato (spunta + scritta), e al reveal i punti. */
export function TeamStrip({ teams, outcome }: { teams: TvGameProps["teams"]; outcome: TvGameProps["outcome"] }) {
  const byId = new Map((outcome?.outcomes ?? []).map((o) => [o.teamId, o]));
  return (
    <div className="flex flex-wrap justify-center gap-[0.7cqw]">
      {teams.map((t, i) => {
        const o = byId.get(t.teamId);
        return (
          <div
            key={t.teamId}
            className={clsx("tg-glass tg-rise flex min-w-[9cqw] items-center gap-[0.7cqw] rounded-[0.9cqw] py-[0.5cqw] pl-[0.5cqw] pr-[1cqw]", t.submitted && !o && "tg-glass-lime")}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="tg-num grid h-[2.8cqw] w-[2.8cqw] place-items-center rounded-[0.6cqw] text-[1.6cqw] text-[#0b0d12]" style={{ background: t.color }}>
              {t.tableNo}
            </span>
            <div className="min-w-0">
              <p className="max-w-[11cqw] truncate text-[1.05cqw] font-extrabold leading-tight">{t.name}</p>
              {o ? (
                <p className={clsx("tg-num text-[1.5cqw] leading-none", o.points > 0 ? "text-[#c6ff3d]" : o.points < 0 ? "text-[#ff3b4e]" : "text-white/55")}>
                  {o.points > 0 ? "+" : o.points < 0 ? "−" : ""}
                  {Math.abs(o.points)}
                </p>
              ) : (
                <p className={clsx("flex items-center gap-[0.3cqw] text-[0.85cqw] font-extrabold uppercase tracking-wide", t.submitted ? "text-[#c6ff3d]" : "text-white/45")}>
                  <Icon name={t.submitted ? "check" : "dots"} className="h-[1cqw] w-[1cqw]" />
                  {t.submitted ? "Inviato" : "Sta decidendo"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Grande pannello centrale della TV. */
export function TvPanel({ children, className, tone }: { children: ReactNode; className?: string; tone?: "lime" | "red" }) {
  return <div className={clsx("tg-glass min-h-0 overflow-hidden rounded-[1.6cqw] p-[1.8cqw]", tone === "lime" && "tg-glass-lime", tone === "red" && "tg-glass-red", className)}>{children}</div>;
}

/** Spiegazione al reveal sulla TV. */
export function TvExplain({ text, className }: { text: string; className?: string }) {
  return (
    <TvPanel className={clsx("tg-rise", className)}>
      <p className="mb-[0.4cqw] text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">Perché</p>
      <p className="text-[1.55cqw] font-semibold leading-snug text-white/90">{text}</p>
    </TvPanel>
  );
}

/** Opzione grande per la TV (mai evidenziata prima del reveal). */
export function TvOption({ index, text, state = "idle", note, size = "md" }: { index: number; text: ReactNode; state?: "idle" | "right" | "dim"; note?: ReactNode; size?: "sm" | "md" }) {
  const sm = size === "sm";
  return (
    <div
      className={clsx(
        "relative flex items-center rounded-[1.1cqw] border-[0.18cqw] transition-all duration-500",
        sm ? "gap-[0.7cqw] px-[0.8cqw] py-[0.45cqw]" : "gap-[1cqw] px-[1.1cqw] py-[0.9cqw]",
        state === "right" ? "tg-shine border-[#c6ff3d] bg-[#c6ff3d] text-[#0b0d12]" : state === "dim" ? "border-white/8 bg-white/[0.03] opacity-45" : "border-white/14 bg-white/[0.05]",
      )}
    >
      <span className={clsx("tg-num grid shrink-0 place-items-center rounded-[0.6cqw]", sm ? "h-[2.2cqw] w-[2.2cqw] text-[1.3cqw]" : "h-[3cqw] w-[3cqw] text-[1.7cqw]", state === "right" ? "bg-[#0b0d12] text-[#c6ff3d]" : "bg-white/10")}>{index + 1}</span>
      <span className={clsx("min-w-0 flex-1 font-extrabold leading-tight", sm ? "text-[1.35cqw]" : "text-[1.75cqw]")}>{text}</span>
      {state === "right" && <Icon name="check" className={clsx("shrink-0", sm ? "h-[1.8cqw] w-[1.8cqw]" : "h-[2.4cqw] w-[2.4cqw]")} />}
      {note}
    </div>
  );
}
