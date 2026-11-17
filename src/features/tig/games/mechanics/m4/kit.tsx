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

/**
 * Giro dei tavoli per la TV (duelli «a catena»): frecce dal tavolo che suggerisce a quello che riceve,
 * etichetta facoltativa per freccia (al reveal) e colore della freccia.
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
  const r = 150;
  const small = n > 10;
  const at = (i: number) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    return [200 + r * Math.cos(a), 200 + r * Math.sin(a)] as const;
  };
  return (
    <svg viewBox="0 0 400 400" className="h-full max-h-full w-full" role="img" aria-label={label}>
      <defs>
        <marker id="tg-m4-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="context-stroke" />
        </marker>
      </defs>
      {n > 1 &&
        seats.map((s, i) => {
          const [x1, y1] = at(i);
          const [x2, y2] = at((i + 1) % n);
          const a = arrow?.(s.teamId) ?? null;
          const col = a?.color ?? "rgba(238,242,246,0.4)";
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const len = Math.hypot(mx - 200, my - 200) || 1;
          const push = n === 2 ? (i === 0 ? -30 : 30) : small ? 26 : 40;
          const lx = n === 2 ? 200 : mx + ((mx - 200) / len) * push;
          const ly = n === 2 ? 200 + push : my + ((my - 200) / len) * push;
          const curve = n === 2 ? (i === 0 ? -60 : 60) : 0;
          const d = n === 2 ? `M${x1} ${y1 + 30} Q ${200 + curve} 200 ${x2} ${y2 - 30}` : `M${x1 + (x2 - x1) * 0.2} ${y1 + (y2 - y1) * 0.2} L${x1 + (x2 - x1) * 0.8} ${y1 + (y2 - y1) * 0.8}`;
          return (
            <g key={s.teamId}>
              <path d={n === 2 ? (i === 0 ? `M${x1 + 30} ${y1 + 20} Q ${200 - 70} 200 ${x2 + 30} ${y2 - 20}` : `M${x1 - 30} ${y1 - 20} Q ${200 + 70} 200 ${x2 - 30} ${y2 + 20}`) : d} fill="none" stroke={col} strokeWidth={small ? 4 : 5} strokeDasharray={a?.dashed ? "10 7" : undefined} markerEnd="url(#tg-m4-arrow)" />
              {a?.text && (
                <text x={n === 2 ? (i === 0 ? 112 : 288) : lx} y={n === 2 ? 204 : ly} fill={col} fontSize={small ? 10 : 14} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "var(--tg-display)" }}>
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
            <circle cx={x} cy={y} r={small ? 17 : 25} fill={colorOf(s.teamId) ?? "#eef2f6"} stroke="#0b0d12" strokeWidth={4} />
            <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={small ? 17 : 24} fontWeight={900} fill="#0b0d12" style={{ fontFamily: "var(--tg-display)" }}>
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
