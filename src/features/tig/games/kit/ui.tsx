"use client";

import "./tig-games.css";
import { clsx } from "clsx";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { TeamOutcome } from "@/lib/tig/games/contract";
import type { BaseView } from "@/lib/tig/games/extras";
import type { GameStage, PlayerGameProps, TvGameProps } from "../ui-contract";
import { Icon } from "./icons";
import { CompassRose, CrewFlag, Doubloon, WaxSeal } from "./ornaments";

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
      {/* intestazione: cartiglio di pergamena con il doblone del numero e il titolo della prova */}
      <header className="tg-parch flex items-center gap-3 px-3.5 py-3 sm:px-4">
        <Doubloon className="h-12 w-12 text-xl sm:h-14 sm:w-14 sm:text-2xl">{String(view.number).padStart(2, "0")}</Doubloon>
        <div className="min-w-0 flex-1">
          <h1 className="tg-title line-clamp-2 pt-0.5 text-[1.8rem] leading-[1.02] sm:text-[2.6rem]">{view.title}</h1>
          {/* con il timer acceso lo spazio è poco: due righe invece di troncare («Tavolo 3 · Tavolo contro t…») */}
          <p className="mt-0.5 line-clamp-2 break-words text-[11px] font-extrabold uppercase leading-snug tracking-[0.12em] text-(--tg-burnt-ink) sm:text-xs">
            Tavolo {p.myTeam.tableNo} · {INPUT_LABEL[view.input]}
          </p>
        </div>
        {!hideTimer && p.stage === "play" && (
          <div
            className={clsx(
              "tg-num grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 bg-(--tg-night-2) text-[1.7rem] shadow-[inset_0_2px_6px_rgba(0,0,0,.6),0_0_0_3px_rgba(201,162,74,.35)]",
              left <= 5 ? "tg-pulse border-(--tg-red) text-(--tg-red-hi)" : "border-(--tg-brass) text-(--tg-gold-hi)",
            )}
            aria-label={`${left} secondi`}
          >
            {left}
          </div>
        )}
      </header>

      <p className="px-1 text-[15px] font-semibold leading-snug text-(--tg-cream)/90 sm:text-base">{view.rule}</p>

      <StatusStrip stage={p.stage} submitted={p.submitted} canSubmit={p.canSubmit} personal={personal} />

      <main className="flex flex-1 flex-col gap-3">{children}</main>

      {footer && <footer className="sticky bottom-0 -mx-3 mt-1 bg-gradient-to-t from-(--tg-night) via-(--tg-night)/95 to-transparent px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-4 sm:-mx-6 sm:px-6">{footer}</footer>}
    </div>
  );
}

function StatusStrip({ stage, submitted, canSubmit, personal }: { stage: GameStage; submitted: boolean; canSubmit: boolean; personal: boolean }) {
  if (stage === "reveal") return null;
  if (submitted)
    return (
      <div role="status" className="tg-pop tg-stripes flex items-center gap-2.5 rounded-xl border border-(--tg-gold)/70 bg-(--tg-gold)/10 px-3 py-2 text-sm font-extrabold uppercase tracking-wide text-(--tg-gold-hi)">
        <WaxSeal mark="check" tone="gold" className="h-8 w-8 shrink-0" /> {personal ? "Voto inviato" : "Scelta inviata"} · in attesa degli altri tavoli
      </div>
    );
  if (stage === "locked")
    return (
      <div role="status" className="tg-stripes-red flex items-center gap-2 rounded-xl border border-(--tg-red)/80 bg-(--tg-red)/12 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-(--tg-red-hi)">
        <Icon name="lock" className="h-5 w-5" /> Tempo scaduto · risposte chiuse
      </div>
    );
  if (!canSubmit && !personal)
    return (
      <div role="note" className="flex items-center gap-2 rounded-xl border border-(--tg-teal)/45 bg-(--tg-teal)/10 px-4 py-2.5 text-sm font-bold text-(--tg-cream)/95">
        <Icon name="crown" className="h-5 w-5 shrink-0 text-(--tg-teal-hi)" /> Invia il capitano. Tu prepara la tua proposta e mostrala al tavolo.
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
        <p role="alert" className="tg-shake rounded-lg border border-(--tg-red)/60 bg-(--tg-red)/15 px-3 py-2 text-sm font-bold text-(--tg-red-hi)">
          {error}
        </p>
      )}
      {canSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!ready || pending}
          className={clsx(
            "tg-display flex h-16 w-full items-center justify-center gap-3 rounded-2xl px-3 transition-transform duration-150 sm:h-[4.5rem]",
            // Grenze è più largo del vecchio carattere condensato: le etichette lunghe scendono di corpo sul telefono
            label.length > 18 ? "text-[1.3rem] sm:text-[1.7rem]" : label.length > 12 ? "text-[1.55rem] sm:text-[1.8rem]" : "text-[1.8rem]",
            ready && !pending ? "tg-btn-gold" : "tg-btn-wood cursor-not-allowed",
          )}
        >
          {pending ? "Invio…" : label}
          {!pending && <Icon name="arrow" className="h-7 w-7" />}
          {kbd && !pending && <kbd className="hidden rounded-md border border-current px-1.5 py-0.5 font-sans text-xs font-extrabold opacity-60 lg:inline">{kbd}</kbd>}
          <span className="sr-only">{ready ? "" : " (completa la scelta)"}</span>
        </button>
      ) : (
        <div className="tg-display flex h-16 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-(--tg-brass)/50 bg-(--tg-night-2)/90 text-xl text-(--tg-cream)/70">
          <Icon name="crown" className="h-6 w-6 text-(--tg-teal-hi)" /> Solo il capitano invia
        </div>
      )}
      {hint && <p className="text-center text-xs font-semibold text-(--tg-mute)">{hint}</p>}
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
        state === "idle" && "border-(--tg-cream)/14 bg-(--tg-cream)/[0.05] hover:border-(--tg-brass)/70",
        picked && "tg-picked border-(--tg-gold) text-(--tg-cream) shadow-[0_0_24px_-10px_rgba(242,177,52,.8)]",
        state === "right" && "border-(--tg-gold) bg-(--tg-gold) text-(--tg-ink)",
        state === "wrong" && "tg-stripes-red border-(--tg-red-hi) text-(--tg-cream)",
        state === "missed" && "border-(--tg-gold) border-dashed bg-(--tg-gold)/10 text-(--tg-cream)",
        disabled && state === "idle" && "opacity-60",
      )}
    >
      {index !== undefined && (
        <span
          className={clsx(
            "tg-num grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg",
            state === "right" ? "bg-(--tg-ink) text-(--tg-gold-hi)" : picked ? "tg-coin" : "border border-(--tg-brass)/45 bg-(--tg-night-2) text-(--tg-cream)/85",
          )}
          aria-hidden
        >
          {index + 1}
        </span>
      )}
      <span className={clsx("min-w-0 flex-1 font-bold leading-snug", big ? "text-lg sm:text-xl" : "text-base sm:text-lg", state === "wrong" && "line-through decoration-2")}>{text}</span>
      {children}
      <span className="shrink-0" aria-hidden>
        {picked && <Icon name={multi ? "checkbox" : "check"} className="h-6 w-6 text-(--tg-gold-hi)" />}
        {state === "right" && <Icon name="check" className="h-6 w-6" />}
        {state === "wrong" && <Icon name="x" className="h-6 w-6 text-(--tg-red-hi)" />}
        {state === "missed" && <Icon name="check" className="h-6 w-6 text-(--tg-gold-hi)" />}
        {state === "idle" && multi && <Icon name="box" className="h-6 w-6 text-(--tg-cream)/40" />}
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
  return <p className={clsx("text-[11px] font-extrabold uppercase tracking-[0.18em] text-(--tg-mute)", className)}>{children}</p>;
}

/** Il telefono rimanda alla TV (contenuto mostrato solo sul grande schermo per qualche secondo). */
export function WatchTv({ untilMs, elapsed, what }: { untilMs: number; elapsed: number; what: string }) {
  const left = Math.max(0, Math.ceil((untilMs - elapsed) / 1000));
  return (
    <Panel tone="lime" className="tg-pop flex flex-col items-center gap-3 py-10 text-center">
      <Icon name="tv" className="h-16 w-16 text-(--tg-gold)" />
      <p className="tg-title text-5xl">Guardate la TV</p>
      <p className="max-w-xs text-base font-semibold text-(--tg-cream)/85">{what}</p>
      <p className="tg-num text-6xl text-(--tg-gold-hi)" aria-live="polite">
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
      {pos ? (
        // il doblone resta tondo: con 3 cifre il numero scende di corpo
        <Doubloon className={clsx("h-[4.6rem] w-[4.6rem]", String(outcome.points).length >= 3 ? "text-[1.45rem]" : "text-[2rem]")}>+{outcome.points}</Doubloon>
      ) : (
        <div className={clsx("tg-num text-6xl leading-none", neg ? "text-(--tg-red-hi)" : "text-(--tg-cream)/70")}>
          {neg ? "−" : ""}
          {Math.abs(outcome.points)}
        </div>
      )}
      <div className="min-w-0">
        <Eyebrow>Il vostro esito</Eyebrow>
        <p className="text-lg font-extrabold leading-tight">{outcome.label || (pos ? "Punti presi" : "Nessun punto")}</p>
        {outcome.chaos > 0 && (
          <p className="mt-1 flex items-center gap-1 text-sm font-bold text-(--tg-teal-hi)">
            <Icon name="bolt" className="h-4 w-4" /> +{outcome.chaos} Energia Caos
          </p>
        )}
      </div>
    </Panel>
  );
}

/** Spiegazione al reveal: un foglio di pergamena con l'inchiostro scuro. */
export function Explain({ text, title = "Perché" }: { text: string; title?: string }) {
  return (
    <section className="tg-parch tg-rise p-4">
      <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-(--tg-burnt-ink)">{title}</p>
      <p className="text-base font-semibold leading-relaxed">{text}</p>
    </section>
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
          {/* cartiglio di pergamena: doblone col numero, titolo, regola */}
          <div className="tg-parch tg-rise flex items-center gap-[1.2cqw] py-[0.8cqw] pl-[0.9cqw] pr-[2cqw]">
            <Doubloon className="h-[4.8cqw] w-[4.8cqw] text-[2.3cqw]">{String(view.number).padStart(2, "0")}</Doubloon>
            <div>
              <p className="tg-title text-[3.6cqw] leading-[1.02]">{view.title}</p>
              <p className="tg-ink-2 mt-[0.2cqw] max-w-[52cqw] text-[1.15cqw] font-bold leading-snug">{subtitle ?? view.rule}</p>
            </div>
          </div>
          <div className="flex-1" />
          {!hideTimer && <TvTimer p={p} durationMs={view.durationMs} />}
          {p.stage === "locked" && (
            <div className="tg-glass tg-glass-red tg-pop flex items-center gap-[0.6cqw] rounded-[1.2cqw] px-[1.4cqw] py-[1cqw]">
              <Icon name="lock" className="h-[2.2cqw] w-[2.2cqw] text-(--tg-red-hi)" />
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

/** Cronometro della TV: una bussola d'ottone, l'arco d'oro che si consuma (rosso negli ultimi 5 secondi). */
function TvTimer({ p, durationMs }: { p: Pick<TvGameProps, "stage" | "deadlineAt" | "now">; durationMs: number }) {
  const t = useClock(p.now, p.stage === "play");
  if (p.stage !== "play") return null;
  const left = secondsLeft(p.deadlineAt, t);
  const frac = Math.max(0, Math.min(1, (p.deadlineAt - t) / Math.max(1, durationMs)));
  const r = 40;
  const c = 2 * Math.PI * r;
  const low = left <= 5;
  return (
    <div className="relative grid h-[9cqw] w-[9cqw] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_40%,#123241,#07131a_70%)] shadow-[0_0_0_0.35cqw_#5a3a22,0_0_0_0.5cqw_#c9a24a,0_1cqw_2.4cqw_-0.6cqw_rgba(0,0,0,.9)]" aria-label={`${left} secondi`}>
      <CompassRose className="absolute inset-[4%] text-(--tg-brass) opacity-35" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(246,234,210,0.12)" strokeWidth={7} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={low ? "var(--tg-red)" : "var(--tg-gold)"} strokeWidth={7} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset 200ms linear" }} />
      </svg>
      <span className={clsx("tg-num relative text-[3.6cqw] drop-shadow-[0_0.2cqw_0.3cqw_rgba(0,0,0,.9)]", low ? "tg-pulse text-(--tg-red-hi)" : "text-(--tg-gold-hi)")}>{left}</span>
    </div>
  );
}

/** Tavoli in basso: bandiera della ciurma, chi ha inviato (spunta + scritta), e al reveal i punti. */
export function TeamStrip({ teams, outcome }: { teams: TvGameProps["teams"]; outcome: TvGameProps["outcome"] }) {
  const byId = new Map((outcome?.outcomes ?? []).map((o) => [o.teamId, o]));
  return (
    <div className="flex flex-wrap justify-center gap-[0.7cqw]">
      {teams.map((t, i) => {
        const o = byId.get(t.teamId);
        return (
          <div
            key={t.teamId}
            className={clsx("tg-glass tg-rise flex min-w-[9cqw] items-center gap-[0.5cqw] rounded-[0.9cqw] py-[0.4cqw] pl-[0.4cqw] pr-[1cqw]", t.submitted && !o && "tg-glass-lime")}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <CrewFlag color={t.color} n={t.tableNo} className="h-[3cqw] w-[4cqw] shrink-0" />
            <div className="min-w-0">
              <p className="max-w-[11cqw] truncate text-[1.05cqw] font-extrabold leading-tight">{t.name}</p>
              {o ? (
                <p className={clsx("tg-num text-[1.5cqw] leading-none", o.points > 0 ? "text-(--tg-gold-hi)" : o.points < 0 ? "text-(--tg-red-hi)" : "text-(--tg-cream)/55")}>
                  {o.points > 0 ? "+" : o.points < 0 ? "−" : ""}
                  {Math.abs(o.points)}
                </p>
              ) : (
                <p className={clsx("flex items-center gap-[0.3cqw] text-[0.85cqw] font-extrabold uppercase tracking-wide", t.submitted ? "text-(--tg-gold-hi)" : "text-(--tg-cream)/55")}>
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

/** Spiegazione al reveal sulla TV: foglio di pergamena. */
export function TvExplain({ text, className }: { text: string; className?: string }) {
  return (
    <div className={clsx("tg-parch tg-rise min-h-0 overflow-hidden p-[1.6cqw]", className)}>
      <p className="mb-[0.4cqw] text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-burnt-ink)">Perché</p>
      <p className="text-[1.55cqw] font-semibold leading-snug">{text}</p>
    </div>
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
        state === "right" ? "tg-shine border-(--tg-gold-hi) bg-(--tg-gold) text-(--tg-ink) shadow-[0_0_2.4cqw_-0.6cqw_rgba(242,177,52,.85)]" : state === "dim" ? "border-(--tg-cream)/8 bg-(--tg-cream)/[0.03] opacity-45" : "border-(--tg-cream)/14 bg-(--tg-night-2)/70",
      )}
    >
      <span className={clsx("tg-num grid shrink-0 place-items-center rounded-full", sm ? "h-[2.2cqw] w-[2.2cqw] text-[1.3cqw]" : "h-[3cqw] w-[3cqw] text-[1.7cqw]", state === "right" ? "bg-(--tg-ink) text-(--tg-gold-hi)" : "border-[0.12cqw] border-(--tg-brass)/55 bg-(--tg-night)")}>{index + 1}</span>
      {/* parole lunghe: vanno a capo dentro il riquadro (mai sotto la spunta) */}
      <span lang="it" className={clsx("min-w-0 flex-1 font-extrabold leading-tight break-words hyphens-auto", sm ? "text-[1.35cqw]" : "text-[1.75cqw]")}>{text}</span>
      {state === "right" && <Icon name="check" className={clsx("shrink-0", sm ? "h-[1.8cqw] w-[1.8cqw]" : "h-[2.4cqw] w-[2.4cqw]")} />}
      {note}
    </div>
  );
}
