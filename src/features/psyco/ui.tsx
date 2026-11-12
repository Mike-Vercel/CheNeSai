"use client";

import { clsx } from "clsx";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { countdownMs, elapsedMs, formatClock, formatDuration, remainingMs } from "@/lib/psyco/logic";
import { DIFFICULTY_LABEL, type PsycoPublicState, type PublicParticipant, type PublicTimer, type RoundOutcome, type SecretRule } from "@/lib/psyco/types";
import { useTick } from "./use-psyco";

// ---------------------------------------------------------------------------
// Marchio
// ---------------------------------------------------------------------------
export function PsycoLogo({ size = "md", className, tagline = false }: { size?: "sm" | "md" | "lg" | "xl" | "tv"; className?: string; tagline?: boolean }) {
  const cls = { sm: "text-4xl", md: "text-6xl", lg: "text-7xl md:text-8xl", xl: "text-8xl md:text-[9rem]", tv: "text-[13vh]" }[size];
  return (
    <div className={clsx("inline-flex flex-col items-center", className)}>
      <span className={clsx("psy-title select-none", cls)} aria-label="PSYCO">
        PSYCO
      </span>
      <svg aria-hidden viewBox="0 0 300 18" className="-mt-1 w-[88%]" preserveAspectRatio="none">
        <path d="M2 12 C 60 4, 120 16, 170 8 S 260 2, 298 9" stroke="#e0161f" strokeWidth="5" fill="none" strokeLinecap="round" />
      </svg>
      {tagline && <span className="psy-type mt-2 text-center text-base text-paper/90 md:text-lg">Tutti conoscono la regola. <span className="text-blood">Tranne te.</span></span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Giocatori (nessun massimo: oltre una soglia la lista si compatta e scorre)
// ---------------------------------------------------------------------------
const COMPACT_OVER = 24;

export function PlayerList({
  players,
  state,
  highlight,
  maxVisible,
  className,
  onKick,
  marks,
}: {
  players: PublicParticipant[];
  state?: PsycoPublicState | null;
  highlight?: string | null;
  /** solo per lo schermo TV: oltre questo numero si mostra «+N» */
  maxVisible?: number;
  className?: string;
  onKick?: (p: PublicParticipant) => void;
  /** segni per giocatore: ✓ (ha votato, ha visto…) */
  marks?: Set<string>;
}) {
  const compact = players.length > COMPACT_OVER;
  const shown = maxVisible && players.length > maxVisible ? players.slice(-maxVisible) : players;
  const hidden = players.length - shown.length;
  return (
    <div className={clsx(compact && !maxVisible && "psy-scroll max-h-[46vh] pr-1", className)}>
      <ul className={clsx("flex flex-wrap gap-2", compact && "gap-1.5")} aria-label={`${players.length} giocatori`}>
        {shown.map((p) => {
          const isPsyco = state?.round?.psycoId === p.id && state.phase !== "LOBBY";
          const marked = marks?.has(p.id);
          return (
            <li
              key={p.id}
              className={clsx(
                "flex items-center gap-1.5 rounded-full font-extrabold [content-visibility:auto]",
                compact ? "px-2.5 py-1 text-sm" : "px-3.5 py-1.5 text-base",
                p.id === highlight ? "bg-paper text-[#2a1a10]" : "bg-white/8 text-paper ring-1 ring-white/12",
                isPsyco && "ring-2 ring-blood",
                !p.online && "opacity-55",
              )}
            >
              {marked && <span aria-label="fatto" className="text-[#5fe08a]">✓</span>}
              {p.isHost && <span title="Gestisce la partita" aria-label="gestisce la partita">★</span>}
              <span className="max-w-[10rem] truncate">{p.nickname}</span>
              {isPsyco && <span className="rounded-full bg-blood px-1.5 text-[10px] uppercase tracking-wide text-white">psyco</span>}
              {!p.online && <span className="text-[10px] font-bold uppercase">offline</span>}
              {state && state.phase !== "LOBBY" && !p.inRound && <span className="text-[10px] font-bold uppercase text-lamp">prossima</span>}
              {onKick && !p.isHost && (
                <button type="button" onClick={() => onKick(p)} aria-label={`Togli ${p.nickname}`} className="-mr-1 ml-0.5 grid h-6 w-6 place-items-center rounded-full bg-black/30 text-xs hover:bg-blood">
                  ✕
                </button>
              )}
            </li>
          );
        })}
        {hidden > 0 && <li className="rounded-full bg-blood/30 px-3 py-1 text-sm font-black text-paper">+{hidden} altri</li>}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timer (riferimento: ora del server)
// ---------------------------------------------------------------------------
export function useRoundClock(timer: PublicTimer | null | undefined, now: () => number, active: boolean) {
  "use no memo"; // React Compiler: il risultato dipende dall'ora, non va memorizzato
  const tick = useTick(active, 200);
  if (!timer) return { countdown: 0, remaining: null as number | null, elapsed: 0 };
  // `tick` entra nel calcolo: a ogni giro si rilegge l'ora del server stimata
  const t = tick >= 0 ? now() : 0;
  return { countdown: countdownMs(timer, t), remaining: remainingMs(timer, t), elapsed: elapsedMs(timer, t) };
}

export function BigTimer({ timer, now, size = "md", className }: { timer: PublicTimer; now: () => number; size?: "md" | "lg" | "tv"; className?: string }) {
  const { remaining, elapsed, countdown } = useRoundClock(timer, now, true);
  const unlimited = timer.totalMs === null;
  const urgent = !unlimited && remaining !== null && remaining <= 10_000 && countdown === 0;
  const warn = !unlimited && remaining !== null && remaining <= 60_000 && countdown === 0;
  const pct = unlimited || remaining === null ? 1 : remaining / timer.totalMs!;
  const cls = { md: "text-7xl", lg: "text-8xl md:text-9xl", tv: "text-[22vh]" }[size];
  return (
    <div className={clsx("flex flex-col items-center", className)} role="timer" aria-live="off">
      <span className={clsx("psy-clock", cls, urgent ? "text-blood psy-flicker" : warn ? "text-lamp" : "text-paper")}>
        {unlimited ? formatClock(elapsed) : formatClock(remaining ?? 0)}
      </span>
      <div className="mt-3 h-2 w-[min(80vw,28rem)] overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div className={clsx("h-full rounded-full transition-[width] duration-300", urgent ? "bg-blood" : "bg-gradient-to-r from-blood to-lamp")} style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} />
      </div>
      <span className="psy-type mt-2 text-sm text-paper/70 md:text-base">
        {timer.pausedAt ? "IN PAUSA" : unlimited ? "senza limite di tempo · tempo trascorso" : `su ${formatDuration(timer.totalMs)}`}
      </span>
    </div>
  );
}

/** «3… 2… 1…» prima della manche (il tempo non scorre durante la preparazione). */
export function CountdownOverlay({ timer, now }: { timer: PublicTimer; now: () => number }) {
  const { countdown } = useRoundClock(timer, now, true);
  if (countdown <= 0) return null;
  const n = Math.ceil(countdown / 1000);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-noir/85 backdrop-blur-sm" role="status" aria-live="assertive">
      <span key={n} className="psy-count psy-title text-[38vmin] leading-none">
        {n > 3 ? 3 : n}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte e biglietti
// ---------------------------------------------------------------------------
export function RuleCard({ rule, label = "LA REGOLA SEGRETA", className, big = false }: { rule: Pick<SecretRule, "title" | "text" | "difficulty"> & Partial<SecretRule>; label?: string; className?: string; big?: boolean }) {
  return (
    <article className={clsx("psy-paper psy-rise relative px-5 pb-6 pt-5 md:px-7", className)}>
      <span className="psy-pin left-4 top-3" aria-hidden />
      <span className="psy-pin right-4 top-3" aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <span className="psy-stamp text-xs md:text-sm">{label}</span>
        {rule.difficulty && <span className="psy-type text-xs uppercase tracking-widest text-[#6b4a2a] md:text-sm">{DIFFICULTY_LABEL[rule.difficulty]}</span>}
      </div>
      {rule.title && <h3 className={clsx("psy-display mt-3 text-[#8e0b12]", big ? "text-4xl md:text-5xl" : "text-3xl")}>{rule.title}</h3>}
      <p className={clsx("psy-type mt-2 leading-snug", big ? "text-2xl md:text-3xl" : "text-xl md:text-2xl")}>{rule.text}</p>
      {rule.instructions && <p className="mt-3 text-sm font-bold text-[#4a3220] md:text-base">{rule.instructions}</p>}
      {rule.example && <p className="psy-type mt-2 text-sm italic text-[#5b3d22] md:text-base">Esempio: {rule.example}</p>}
    </article>
  );
}

export function RoleFace({ role, psycoName, compact = false }: { role: "psyco" | "knower"; psycoName?: string | null; compact?: boolean }) {
  if (role === "psyco") {
    return (
      <div className={clsx("flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_30%,#5a0a10,#120809_70%)] p-6 text-center", compact && "gap-2 p-4")}>
        <Silhouette className={clsx(compact ? "h-20" : "h-32 md:h-40")} />
        <p className={clsx("psy-title", compact ? "text-[clamp(2.2rem,10vw,3rem)]" : "text-[clamp(2.6rem,13vw,4.5rem)]")}>SEI LO PSYCO!</p>
        <p className="psy-type text-lg text-paper md:text-xl">Gli altri conoscono una regola segreta. Scoprila prima che finisca il tempo!</p>
      </div>
    );
  }
  return (
    <div className={clsx("psy-paper flex h-full flex-col items-center justify-center gap-3 p-6 text-center !shadow-none", compact && "gap-2 p-4")}>
      <span className="psy-stamp text-base">regola segreta</span>
      <p className={clsx("psy-display leading-[0.95] text-[#8e0b12]", compact ? "text-[clamp(1.8rem,8vw,2.25rem)]" : "text-[clamp(2.2rem,10.5vw,3.75rem)]")}>CONOSCERAI LA REGOLA!</p>
      <p className="psy-type text-lg md:text-xl">Insieme agli altri dovrai scegliere una regola e rispettarla durante la manche.</p>
      {psycoName && (
        <p className="mt-1 text-base font-extrabold text-[#4a3220]">
          Lo PSYCO è <span className="text-[#8e0b12]">{psycoName}</span>
        </p>
      )}
    </div>
  );
}

/** Carta coperta che si gira (dorso con la lente, fronte con il ruolo). */
export function RoleFlipCard({ open, role, psycoName, className }: { open: boolean; role: "psyco" | "knower" | null; psycoName?: string | null; className?: string }) {
  return (
    <div className={clsx("psy-flip aspect-[3/4] w-[min(86vw,22rem)]", className)} data-open={open && !!role}>
      <div className="psy-flip-inner">
        <div className="psy-flip-face grid place-items-center bg-[radial-gradient(circle_at_50%_35%,#2b1d1e,#0e0a0a_75%)] ring-2 ring-blood/50">
          <div className="flex flex-col items-center gap-4">
            <Lens className="h-36 w-36" />
            <span className="psy-type text-lg text-paper/80">ruolo segreto</span>
          </div>
        </div>
        <div className="psy-flip-face psy-flip-back ring-2 ring-blood/60">{role && <RoleFace role={role} psycoName={psycoName} />}</div>
      </div>
    </div>
  );
}

export function Silhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <path d="M30 40 Q60 28 90 40 L96 47 Q60 41 24 47 Z M42 40 Q44 18 60 17 Q76 18 78 40 Z" fill="#0b0909" />
      <circle cx="60" cy="58" r="17" fill="#0b0909" />
      <path d="M22 118 Q24 80 60 76 Q96 80 98 118 Z" fill="#0b0909" />
    </svg>
  );
}

export function Lens({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <radialGradient id="psy-lens" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ff4d55" />
          <stop offset="70%" stopColor="#a00c14" />
          <stop offset="100%" stopColor="#4b0509" />
        </radialGradient>
      </defs>
      <line x1="80" y1="80" x2="110" y2="110" stroke="#2b2120" strokeWidth="14" strokeLinecap="round" />
      <line x1="80" y1="80" x2="110" y2="110" stroke="#5a4636" strokeWidth="8" strokeLinecap="round" />
      <circle cx="52" cy="52" r="40" fill="url(#psy-lens)" stroke="#c99a4a" strokeWidth="7" />
      <g transform="translate(52 56) scale(0.42) translate(-60 -60)">
        <Silhouette />
      </g>
      <path d="M30 34 Q40 22 56 20" stroke="rgba(255,255,255,.55)" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Avanzamento di una votazione / attesa
// ---------------------------------------------------------------------------
export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="w-full max-w-md" role="status" aria-label={`${label}: ${done} su ${total}`}>
      <div className="flex items-baseline justify-between text-sm font-extrabold text-paper/80">
        <span>{label}</span>
        <span className="psy-clock text-xl text-paper">
          {done}/{total}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-blood-deep to-blood transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

export const OUTCOME_TEXT: Record<RoundOutcome, { title: string; sub: (psyco: string) => string }> = {
  guessed: { title: "VINCE LO PSYCO!", sub: (p) => `${p} ha scoperto la regola.` },
  time_up: { title: "VINCE IL GRUPPO!", sub: (p) => `Tempo scaduto: la regola resta un mistero per ${p}.` },
  ended: { title: "MANCHE CONCLUSA", sub: () => "La manche è stata chiusa da chi gestisce la partita." },
  psyco_left: { title: "MANCHE INTERROTTA", sub: (p) => `${p} ha lasciato la partita.` },
};

/** Esito della manche + regola svelata (identico per tutti: è pubblico a manche finita). */
export function RoundResult({ state, big = false }: { state: PsycoPublicState; big?: boolean }) {
  const r = state.round;
  if (!r) return null;
  const o = r.outcome ?? "ended";
  const t = OUTCOME_TEXT[o];
  return (
    <section className="flex w-full flex-col items-center gap-5 text-center" aria-live="polite">
      <p className="psy-type text-lg text-paper/70">Manche {r.no}</p>
      <h2 className={clsx("psy-title psy-stamp-in", big ? "text-[11vh]" : "text-6xl md:text-7xl")}>{t.title}</h2>
      <p className={clsx("font-extrabold text-paper/90", big ? "text-[3.4vh]" : "text-lg md:text-xl")}>{t.sub(r.psycoNickname)}</p>
      <div className="flex flex-wrap justify-center gap-2 text-sm font-bold text-paper/75">
        {r.elapsedMs !== null && <span className="psy-chip">⏱ {formatClock(r.elapsedMs)}</span>}
        <span className="psy-chip">Tentativi: {r.attempts}</span>
        {r.difficulty && <span className="psy-chip">{DIFFICULTY_LABEL[r.difficulty]}</span>}
        <span className="psy-chip">{r.ruleMode === "auto" ? "Regola dall'archivio" : "Regola inventata"}</span>
      </div>
      {r.revealedRule && (
        <RuleCard
          big={big}
          className={clsx("w-full text-left", big ? "max-w-[70vw]" : "max-w-xl")}
          label="ecco qual era la regola"
          rule={{ title: r.revealedRule.title, text: r.revealedRule.text, difficulty: r.difficulty }}
        />
      )}
    </section>
  );
}

export function History({ state }: { state: PsycoPublicState }) {
  if (state.history.length === 0) return null;
  return (
    <details className="psy-panel w-full max-w-xl rounded-2xl p-4 text-left">
      <summary className="cursor-pointer font-extrabold text-paper">Manche giocate ({state.history.length})</summary>
      <ol className="mt-3 flex flex-col gap-1.5 text-sm">
        {state.history.map((h) => (
          <li key={h.no} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
            <span className="font-extrabold">
              #{h.no} · PSYCO: {h.psycoNickname}
            </span>
            <span className="text-paper/75">
              {h.outcome ? OUTCOME_TEXT[h.outcome].title.toLowerCase() : "—"}
              {h.elapsedMs !== null ? ` · ${formatClock(h.elapsedMs)}` : ""} · {h.attempts} tent.
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Invito: QR, codice, link, WhatsApp
// ---------------------------------------------------------------------------
export function joinUrl(code: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "");
  return `${base}/psyco/entra/${code}`;
}

export function QrCode({ text, className, dark = "#0b0909" }: { text: string; className?: string; dark?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 480, color: { dark, light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [text, dark]);
  if (!src) return <div className={clsx("animate-pulse rounded-2xl bg-white/10", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR code per entrare nella partita" className={clsx("rounded-2xl bg-white p-2", className)} />;
}

export function InvitePanel({ code, compact = false }: { code: string; compact?: boolean }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setUrl(joinUrl(code)), 0);
    return () => clearTimeout(t);
  }, [code]);
  const text = `Giochiamo a PSYCO su CHE NE SAI?! Entra con il codice ${code}: ${url}`;
  return (
    <section className={clsx("psy-panel flex flex-col items-center gap-4 rounded-3xl p-5 text-center", compact ? "md:flex-row md:text-left" : "")} aria-label="Invita i giocatori">
      {url && <QrCode text={url} className={clsx(compact ? "h-36 w-36" : "h-48 w-48")} />}
      <div className="flex flex-col items-center gap-3 md:items-start">
        <p className="psy-type text-sm uppercase tracking-widest text-paper/70">Codice stanza</p>
        <p className="psy-clock text-5xl text-paper" aria-label={`Codice ${code.split("").join(" ")}`}>
          {code}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="psy-chip"
            onClick={() => {
              void navigator.clipboard?.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              });
            }}
          >
            {copied ? "Link copiato ✓" : "Copia link"}
          </button>
          <a className="psy-chip" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button type="button" className="psy-chip" onClick={() => void navigator.share({ title: "PSYCO", text, url }).catch(() => undefined)}>
              Condividi
            </button>
          )}
        </div>
        <p className="max-w-xs text-xs font-bold text-paper/60">Ognuno entra con il proprio account: chi non è registrato si iscrive in un minuto e torna qui da solo.</p>
      </div>
    </section>
  );
}

export function LinkBadge({ status }: { status: "connecting" | "live" | "reconnecting" | "offline" }) {
  if (status === "live" || status === "connecting") return null;
  return (
    <div role="status" className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 -translate-x-1/2 rounded-full bg-blood px-4 py-1.5 text-sm font-black text-white shadow-lg">
      {status === "offline" ? "Sei offline: ti ricolleghi appena torna la rete" : "Ricollegamento…"}
    </div>
  );
}

/** Messaggio a tempo per un avvenimento pubblico (es. tentativo sbagliato): compare per qualche secondo. */
export function EventFlash({ state, kind, children, className }: { state: PsycoPublicState; kind: string; children: React.ReactNode; className?: string }) {
  const at = state.event?.kind === kind ? state.event.at : null;
  const serverNow = useRef(state.serverNow);
  useEffect(() => {
    serverNow.current = state.serverNow;
  });
  const [visibleFor, setVisibleFor] = useState<string | null>(null);
  useEffect(() => {
    // solo se l'avvenimento è recente (non dopo un ricaricamento a distanza di minuti)
    if (!at || Date.parse(serverNow.current) - Date.parse(at) > 6000) return;
    const show = setTimeout(() => setVisibleFor(at), 0);
    const hide = setTimeout(() => setVisibleFor(null), 6000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [at]);
  if (!at || visibleFor !== at) return null;
  return (
    <p className={clsx("psy-stamp psy-stamp-in !text-blood", className)} role="status">
      {children}
    </p>
  );
}
