"use client";

import { clsx } from "clsx";
import { useCallback, useState, type ReactNode } from "react";
import type { Option } from "@/lib/tig/games/components/choice";
import { Icon } from "../../kit/icons";

/**
 * Pezzi grafici comuni alle schermate della MANCHE 4 «IL GRANDE INGANNO» (solo queste meccaniche li usano):
 * scheda dei sospettati, scala degli indizi a tempo, cartellino del tavolo, giro dei tavoli per la TV,
 * acquisti sigillati ricordati dal telefono.
 */

/** «Nome · dettaglio» → [nome, dettaglio]. */
export function splitProfile(text: string): [string, string | null] {
  const i = text.indexOf(" · ");
  return i < 0 ? [text, null] : [text.slice(0, i), text.slice(i + 3)];
}

// ---------------------------------------------------------------------------
// Sospettati
// ---------------------------------------------------------------------------

export type SuspectState = "idle" | "picked" | "crossed" | "right" | "wrong" | "cleared";

export function SuspectButton({
  option,
  index,
  state,
  onPick,
  onCross,
  disabled,
  note,
}: {
  option: Option;
  index: number;
  state: SuspectState;
  onPick?: () => void;
  /** segna/toglie «scagionato» (solo appunti del telefono) */
  onCross?: () => void;
  disabled?: boolean;
  note?: ReactNode;
}) {
  const [name, detail] = splitProfile(option.text);
  const crossed = state === "crossed" || state === "cleared";
  return (
    <div
      className={clsx(
        "flex items-stretch overflow-hidden rounded-2xl border-2 transition-[border-color,background-color,opacity] duration-200",
        state === "idle" && "border-white/12 bg-white/[0.04]",
        state === "picked" && "tg-picked border-[#c6ff3d]",
        state === "crossed" && "border-white/8 bg-white/[0.02] opacity-55",
        state === "cleared" && "border-white/8 bg-white/[0.02] opacity-45",
        state === "right" && "border-[#c6ff3d] bg-[#c6ff3d] text-[#0b0d12]",
        state === "wrong" && "tg-stripes-red border-[#ff3b4e]",
      )}
    >
      <button type="button" onClick={onPick} disabled={disabled || !onPick} aria-pressed={onPick ? state === "picked" : undefined} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
        <span className={clsx("tg-num grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg", state === "right" ? "bg-[#0b0d12] text-[#c6ff3d]" : state === "picked" ? "bg-[#c6ff3d] text-[#0b0d12]" : "bg-white/10 text-white/80")} aria-hidden>
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx("tg-display block text-2xl leading-none", crossed && "line-through decoration-[3px]")}>{name}</span>
          {detail && <span className={clsx("mt-0.5 block text-sm font-semibold leading-snug", state === "right" ? "text-[#0b0d12]/80" : "text-white/75")}>{detail}</span>}
          {note}
        </span>
        {state === "picked" && <Icon name="check" className="h-6 w-6 shrink-0 text-[#c6ff3d]" />}
        {state === "right" && <Icon name="check" className="h-6 w-6 shrink-0" />}
        {state === "wrong" && <Icon name="x" className="h-6 w-6 shrink-0 text-[#ff3b4e]" />}
        <span className="sr-only">{state === "picked" ? " · scelto" : state === "right" ? " · colpevole" : state === "wrong" ? " · scelta sbagliata" : crossed ? " · scagionato" : ""}</span>
      </button>
      {onCross && !disabled && (
        <button
          type="button"
          onClick={onCross}
          className={clsx("grid w-14 shrink-0 place-items-center border-l border-white/10 text-[10px] font-extrabold uppercase tracking-wide", crossed ? "bg-white/10 text-white" : "text-white/55")}
          aria-label={crossed ? `Rimetti ${name} tra i sospettati` : `Segna ${name} come scagionato`}
          aria-pressed={crossed}
        >
          <Icon name="x" className="h-5 w-5" />
          <span aria-hidden>{crossed ? "torna" : "fuori"}</span>
        </button>
      )}
    </div>
  );
}

/** Appunti del telefono: sospettati segnati come scagionati (solo locale, mai inviati). */
export function useCrossed() {
  const [crossed, setCrossed] = useState<string[]>([]);
  const toggle = useCallback((id: string) => setCrossed((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])), []);
  return { crossed, toggle };
}

export function TvSuspect({ option, index, state = "idle", badge, compact = false }: { option: Option; index: number; state?: "idle" | "right" | "cleared"; badge?: ReactNode; compact?: boolean }) {
  const [name, detail] = splitProfile(option.text);
  return (
    <div
      className={clsx(
        "relative flex min-h-0 items-center rounded-[1cqw] border-[0.18cqw] transition-all duration-700",
        compact ? "gap-[0.7cqw] px-[0.9cqw] py-[0.35cqw]" : "gap-[0.9cqw] px-[1cqw] py-[0.7cqw]",
        state === "right" ? "tg-shine border-[#c6ff3d] bg-[#c6ff3d] text-[#0b0d12]" : state === "cleared" ? "border-white/8 bg-white/[0.03] opacity-40" : "border-white/14 bg-white/[0.05]",
      )}
    >
      <span className={clsx("tg-num grid shrink-0 place-items-center rounded-[0.6cqw]", compact ? "h-[2.2cqw] w-[2.2cqw] text-[1.3cqw]" : "h-[2.8cqw] w-[2.8cqw] text-[1.6cqw]", state === "right" ? "bg-[#0b0d12] text-[#c6ff3d]" : "bg-white/10")}>{index + 1}</span>
      <span className="min-w-0 flex-1">
        <span className={clsx("tg-display block leading-none", compact ? "text-[1.7cqw]" : "text-[2.1cqw]", state === "cleared" && "line-through decoration-[0.25cqw]")}>{name}</span>
        {detail && (!compact || state === "right") && <span className={clsx("mt-[0.2cqw] block text-[1.1cqw] font-semibold leading-snug", state === "right" ? "text-[#0b0d12]/80" : "text-white/70")}>{detail}</span>}
      </span>
      {badge}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scala degli indizi a tempo
// ---------------------------------------------------------------------------

/** Indizi aperti all'istante (linea del tempo + quelli già arrivati nella vista). */
export function openCount(schedule: readonly number[], clues: readonly (string | null)[], elapsed: number, all: boolean): number {
  if (all) return clues.length;
  let n = 0;
  schedule.forEach((at, i) => {
    if (elapsed >= at && clues[i] !== null) n = i + 1;
  });
  return n;
}

export function Ladder({
  clues,
  open,
  elapsed,
  schedule,
  worth,
  tv = false,
  extra,
}: {
  clues: readonly (string | null)[];
  open: number;
  elapsed: number;
  schedule: readonly number[];
  worth: readonly number[];
  tv?: boolean;
  /** riga aggiuntiva per indizio (es. al reveal: chi scagiona) */
  extra?: (i: number) => ReactNode;
}) {
  return (
    <ol className={clsx("flex flex-col", tv ? "gap-[0.6cqw]" : "gap-2")}>
      {clues.map((c, i) => {
        const isOpen = i < open;
        const inSec = Math.max(0, Math.ceil((schedule[i] - elapsed) / 1000));
        return (
          <li
            key={i}
            className={clsx(
              "flex items-start border-2",
              tv ? "gap-[0.9cqw] rounded-[1cqw] px-[1cqw] py-[0.7cqw]" : "gap-3 rounded-2xl px-3 py-2.5",
              isOpen ? (i === open - 1 ? "tg-rise border-[#c6ff3d]/70 bg-[#c6ff3d]/[0.07]" : "border-white/12 bg-white/[0.04]") : "border-dashed border-white/12",
            )}
          >
            <span className={clsx("tg-num shrink-0 text-center", tv ? "w-[4.4cqw] text-[1.7cqw] leading-none" : "w-12 text-xl leading-none", isOpen ? "text-[#c6ff3d]" : "text-white/35")}>
              {worth[i]}
              <span className={clsx("block font-extrabold uppercase tracking-wide", tv ? "text-[0.7cqw]" : "text-[10px]")}>punti</span>
            </span>
            <div className="min-w-0 flex-1">
              {isOpen && c ? (
                <p className={clsx("font-bold leading-snug", tv ? "text-[1.6cqw]" : "text-base sm:text-lg")}>{c}</p>
              ) : (
                <p className={clsx("flex items-center gap-2 font-bold text-white/40", tv ? "text-[1.45cqw]" : "text-base")}>
                  <Icon name="lock" className={tv ? "h-[1.5cqw] w-[1.5cqw]" : "h-5 w-5"} /> Indizio {i + 1} tra {inSec} s
                </p>
              )}
              {extra?.(i)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Tavoli
// ---------------------------------------------------------------------------

/** Cartellino col numero del tavolo (colore della squadra se noto). */
export function TableTag({ no, color, tv = false, className }: { no: number | string; color?: string; tv?: boolean; className?: string }) {
  return (
    <span
      className={clsx("tg-num inline-grid shrink-0 place-items-center text-[#0b0d12]", tv ? "h-[2.6cqw] min-w-[2.6cqw] rounded-[0.5cqw] px-[0.3cqw] text-[1.5cqw]" : "h-7 min-w-7 rounded-md px-1 text-base", className)}
      style={{ background: color ?? "#eef2f6" }}
    >
      {no}
    </span>
  );
}

/** Oltre questo numero di tavoli il giro diventa un elenco «tavolo → tavolo» (leggibile da 5 metri). */
export const RING_MAX = 8;

/**
 * Giro dei tavoli per la TV (duelli «a catena»): frecce dal tavolo che suggerisce a quello che riceve,
 * etichetta facoltativa per freccia (al reveal) e colore della freccia. Con più di 8 tavoli le etichette
 * sul cerchio diventerebbero illeggibili: si passa a un elenco a due colonne con le stesse informazioni.
 */
export function RingTv({
  seats,
  colorOf,
  arrow,
  label = "Giro dei tavoli",
}: {
  seats: readonly { teamId: string; tableNo: number }[];
  colorOf: (teamId: string) => string | undefined;
  arrow?: (fromTeamId: string) => { color: string; text: string; dashed?: boolean } | null;
  label?: string;
}) {
  const n = seats.length;
  if (n > RING_MAX) {
    return (
      <ol className="grid w-full grid-cols-2 content-center gap-x-[1.2cqw] gap-y-[0.55cqw]" aria-label={label}>
        {seats.map((s, i) => {
          const to = seats[(i + 1) % n];
          const a = arrow?.(s.teamId) ?? null;
          return (
            <li key={s.teamId} className="flex items-center gap-[0.5cqw]">
              <TableTag tv no={s.tableNo} color={colorOf(s.teamId)} />
              <span className="tg-display text-[1.6cqw] leading-none" style={{ color: a?.color ?? "rgba(238,242,246,0.55)" }} aria-label="dà a">
                →
              </span>
              <TableTag tv no={to.tableNo} color={colorOf(to.teamId)} />
              {a?.text && (
                <span className="tg-display truncate text-[1.35cqw]" style={{ color: a.color }}>
                  {a.text}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    );
  }
  const r = 150;
  const small = n > 6;
  const cr = small ? 21 : 25;
  const at = (i: number) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    return [200 + r * Math.cos(a), 200 + r * Math.sin(a)] as const;
  };
  /** punta di freccia in (x, y) con direzione (dx, dy) */
  const head = (x: number, y: number, dx: number, dy: number) => {
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    const L = small ? 10 : 13;
    const W = small ? 6 : 8;
    return `${x},${y} ${x - ux * L - uy * W},${y - uy * L + ux * W} ${x - ux * L + uy * W},${y - uy * L - ux * W}`;
  };
  return (
    <svg viewBox="0 0 400 400" className="h-full max-h-full w-full" role="img" aria-label={label}>
      {n > 1 &&
        seats.map((s, i) => {
          const [x1, y1] = at(i);
          const [x2, y2] = at((i + 1) % n);
          const a = arrow?.(s.teamId) ?? null;
          const col = a?.color ?? "rgba(238,242,246,0.45)";
          const sw = small ? 4 : 5;
          if (n === 2) {
            // due archi: a sinistra dall'alto in basso, a destra dal basso in alto
            const side = i === 0 ? 1 : -1;
            const cx = 200 + side * 120;
            const sy = y1 + (y2 > y1 ? cr + 6 : -(cr + 6));
            const ey = y2 + (y2 > y1 ? -(cr + 8) : cr + 8);
            return (
              <g key={s.teamId}>
                <path d={`M${x1} ${sy} Q ${cx} 200 ${x2} ${ey}`} fill="none" stroke={col} strokeWidth={sw} strokeDasharray={a?.dashed ? "10 7" : undefined} />
                <polygon points={head(x2, ey, x2 - cx, ey - 200)} fill={col} />
                {a?.text && (
                  <text x={200 + side * 75} y={200} fill={col} fontSize={18} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "var(--tg-display)" }}>
                    {a.text}
                  </text>
                )}
              </g>
            );
          }
          const dx = x2 - x1;
          const dy = y2 - y1;
          const d = Math.hypot(dx, dy) || 1;
          const sx = x1 + (dx / d) * (cr + 5);
          const sy = y1 + (dy / d) * (cr + 5);
          const ex = x2 - (dx / d) * (cr + 6);
          const ey = y2 - (dy / d) * (cr + 6);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const len = Math.hypot(mx - 200, my - 200) || 1;
          const push = small ? 30 : 36;
          return (
            <g key={s.teamId}>
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={col} strokeWidth={sw} strokeDasharray={a?.dashed ? "9 6" : undefined} />
              <polygon points={head(ex, ey, dx, dy)} fill={col} />
              {a?.text && (
                <text x={mx + ((mx - 200) / len) * push} y={my + ((my - 200) / len) * push} fill={col} fontSize={small ? 14 : 17} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "var(--tg-display)" }}>
                  {a.text}
                </text>
              )}
            </g>
          );
        })}
      {seats.map((s, i) => {
        const [x, y] = at(i);
        return (
          <g key={`c-${s.teamId}`}>
            <circle cx={x} cy={y} r={cr} fill={colorOf(s.teamId) ?? "#eef2f6"} stroke="#0b0d12" strokeWidth={4} />
            <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={small ? 18 : 24} fontWeight={900} fill="#0b0d12" style={{ fontFamily: "var(--tg-display)" }}>
              {s.tableNo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Acquisti sigillati: il telefono che compra ricorda l'acquisto (anche se la pagina si ricarica)
// ---------------------------------------------------------------------------

function readStore(key: string): string[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Elenco di acquisti (id) di questo telefono per questa prova. Si può solo aggiungere: un acquisto non si annulla. */
export function usePurchases(key: string | null) {
  const [items, setItems] = useState<string[]>(() => (key && typeof window !== "undefined" ? readStore(key) : []));
  const buy = useCallback(
    (id: string) => {
      setItems((l) => {
        if (l.includes(id)) return l;
        const next = [...l, id];
        if (key) {
          try {
            window.sessionStorage.setItem(key, JSON.stringify(next));
          } catch {
            /* memoria del browser non disponibile: l'acquisto resta valido finché la pagina è aperta */
          }
        }
        return next;
      });
    },
    [key],
  );
  return { items, buy };
}

/** Busta sigillata (acquisto con conferma in due tocchi). */
export function SealedOffer({
  title,
  price,
  bought,
  canBuy,
  onBuy,
  children,
  lockedNote,
}: {
  title: string;
  price: number;
  bought: boolean;
  canBuy: boolean;
  onBuy: () => void;
  children: ReactNode;
  lockedNote?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  if (bought)
    return (
      <div className="tg-pop flex flex-col gap-1.5 rounded-2xl border-2 border-[#ffc24a] bg-[#ffc24a]/10 px-4 py-3">
        <p className="flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ffc24a]">
          <span>{title}</span>
          <span className="tg-num text-base">−{price}</span>
        </p>
        <div className="text-base font-bold leading-snug">{children}</div>
      </div>
    );
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-[#ffc24a]/60 bg-[repeating-linear-gradient(135deg,rgba(255,194,74,0.07)_0_10px,transparent_10px_20px)] px-4 py-3">
      <p className="flex items-center gap-2">
        <Icon name="lock" className="h-5 w-5 shrink-0 text-[#ffc24a]" />
        <span className="min-w-0 flex-1 text-base font-extrabold leading-tight">{title}</span>
        <span className="tg-num shrink-0 text-2xl text-[#ffc24a]">−{price}</span>
      </p>
      {canBuy ? (
        confirm ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="h-12 rounded-xl border border-white/15 text-sm font-extrabold uppercase">
              Annulla
            </button>
            <button type="button" onClick={onBuy} className="tg-display h-12 rounded-xl bg-[#ffc24a] text-xl text-[#0b0d12]">
              Sì, compra
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="tg-display flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#ffc24a] text-xl text-[#ffc24a]">
            <Icon name="coins" className="h-5 w-5" /> Compra per {price} punti potenziali
          </button>
        )
      ) : (
        <p className="text-sm font-semibold text-white/70">{lockedNote ?? "Può comprarlo solo il capitano."}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elenchi di fatti e indizi
// ---------------------------------------------------------------------------

export function FactList({ facts, tv = false, title = "Fatti accertati" }: { facts: readonly string[]; tv?: boolean; title?: string }) {
  return (
    <div className={clsx("flex flex-col", tv ? "gap-[0.4cqw]" : "gap-1.5")}>
      <p className={clsx("font-extrabold uppercase text-[#c6ff3d]", tv ? "text-[0.95cqw] tracking-[0.2em]" : "text-[11px] tracking-[0.18em]")}>{title}</p>
      <ul className={clsx("flex flex-col", tv ? "gap-[0.4cqw]" : "gap-1.5")}>
        {facts.map((f, i) => (
          <li key={i} className={clsx("flex font-bold leading-snug", tv ? "gap-[0.6cqw] text-[1.4cqw]" : "gap-2 text-base")}>
            <Icon name="check" className={clsx("shrink-0 text-[#c6ff3d]", tv ? "mt-[0.15cqw] h-[1.5cqw] w-[1.5cqw]" : "mt-0.5 h-5 w-5")} /> {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClueList({ clues, tv = false, title = "Indizi gratuiti", extra }: { clues: readonly string[]; tv?: boolean; title?: string; extra?: (i: number) => ReactNode }) {
  return (
    <div className={clsx("flex flex-col", tv ? "gap-[0.5cqw]" : "gap-1.5")}>
      <p className={clsx("font-extrabold uppercase text-[#c6ff3d]", tv ? "text-[0.95cqw] tracking-[0.2em]" : "text-[11px] tracking-[0.18em]")}>{title}</p>
      <ol className={clsx("flex flex-col", tv ? "gap-[0.5cqw]" : "gap-1.5")}>
        {clues.map((c, i) => (
          <li key={i} className={clsx("flex font-bold leading-snug", tv ? "gap-[0.7cqw] text-[1.45cqw]" : "gap-2 text-base")}>
            <span className={clsx("tg-num shrink-0 text-[#c6ff3d]", tv ? "w-[1.6cqw]" : "w-5")}>{i + 1}</span>
            <span className="min-w-0">
              {c}
              {extra?.(i)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
