"use client";

import { clsx } from "clsx";
import { useCallback, useState, type ReactNode } from "react";
import type { Option } from "@/lib/tig/games/components/choice";
import { Icon } from "../../kit/icons";
import { CompassRose, CrewFlag, Doubloon, WaxSeal } from "../../kit/ornaments";

/**
 * Pezzi grafici comuni alle schermate della MANCHE 4 «IL GRANDE INGANNO» (solo queste meccaniche li usano):
 * scheda dei sospettati, scala degli indizi a tempo (dobloni), bandiera del tavolo, giro dei tavoli per la TV,
 * acquisti sigillati (ceralacca) ricordati dal telefono, scelta a due carte.
 */

/**
 * Fondo «alla luce della lanterna» per ciò che è vero/confermato (bordo, fondo, testo): l'oro trasparente sul blu
 * del mare diventerebbe verde oliva, quindi si usa l'oro scuro (caldo) del tema con il testo oro chiaro.
 */
export const LIT = "border-(--tg-gold)/60 bg-(--tg-gold-dark)/80 text-(--tg-gold-pale)";

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
        state === "idle" && "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]",
        state === "picked" && "tg-picked border-(--tg-gold)",
        state === "crossed" && "border-(--tg-cream)/8 bg-(--tg-cream)/[0.02] opacity-55",
        state === "cleared" && "border-(--tg-cream)/8 bg-(--tg-cream)/[0.02] opacity-45",
        state === "right" && "border-(--tg-gold) bg-(--tg-gold) text-(--tg-ink)",
        state === "wrong" && "tg-stripes-red border-(--tg-red-hi)",
      )}
    >
      <button type="button" onClick={onPick} disabled={disabled || !onPick} aria-pressed={onPick ? state === "picked" : undefined} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
        <span className={clsx("tg-num grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg", state === "right" ? "bg-(--tg-night) text-(--tg-gold)" : state === "picked" ? "bg-(--tg-gold) text-(--tg-ink)" : "bg-(--tg-cream)/10 text-(--tg-cream)/80")} aria-hidden>
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx("tg-display block text-2xl leading-none", crossed && "line-through decoration-[3px]")}>{name}</span>
          {detail && <span className={clsx("mt-0.5 block text-sm font-semibold leading-snug", state === "right" ? "text-(--tg-ink)/80" : "text-(--tg-cream)/75")}>{detail}</span>}
          {note}
        </span>
        {state === "picked" && <Icon name="check" className="h-6 w-6 shrink-0 text-(--tg-gold)" />}
        {state === "right" && <Icon name="check" className="h-6 w-6 shrink-0" />}
        {state === "wrong" && <Icon name="x" className="h-6 w-6 shrink-0 text-(--tg-red-hi)" />}
        <span className="sr-only">{state === "picked" ? " · scelto" : state === "right" ? " · colpevole" : state === "wrong" ? " · scelta sbagliata" : crossed ? " · scagionato" : ""}</span>
      </button>
      {onCross && !disabled && (
        <button
          type="button"
          onClick={onCross}
          className={clsx("grid w-14 shrink-0 place-items-center border-l border-(--tg-cream)/10 text-[10px] font-extrabold uppercase tracking-wide", crossed ? "bg-(--tg-cream)/10 text-(--tg-cream)" : "text-(--tg-cream)/55")}
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

export function TvSuspect({
  option,
  index,
  state = "idle",
  badge,
  compact = false,
  className,
}: {
  option: Option;
  index: number;
  state?: "idle" | "right" | "cleared";
  badge?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const [name, detail] = splitProfile(option.text);
  return (
    <div
      className={clsx(
        "relative flex min-h-0 items-center rounded-[1cqw] border-[0.18cqw] transition-all duration-700",
        compact ? "gap-[0.7cqw] px-[0.9cqw] py-[0.35cqw]" : "gap-[0.9cqw] px-[1cqw] py-[0.7cqw]",
        state === "right" ? "tg-shine border-(--tg-gold) bg-(--tg-gold) text-(--tg-ink)" : state === "cleared" ? "border-(--tg-cream)/8 bg-(--tg-cream)/[0.03] opacity-40" : "border-(--tg-cream)/14 bg-(--tg-cream)/[0.05]",
        className,
      )}
    >
      <span className={clsx("tg-num grid shrink-0 place-items-center rounded-[0.6cqw]", compact ? "h-[2.2cqw] w-[2.2cqw] text-[1.3cqw]" : "h-[2.8cqw] w-[2.8cqw] text-[1.6cqw]", state === "right" ? "bg-(--tg-night) text-(--tg-gold)" : "bg-(--tg-cream)/10")}>{index + 1}</span>
      <span className="min-w-0 flex-1">
        <span className={clsx("tg-display block leading-none", compact ? "text-[1.7cqw]" : "text-[2.1cqw]", state === "cleared" && "line-through decoration-[0.25cqw]")}>{name}</span>
        {detail && (!compact || state === "right") && <span className={clsx("mt-[0.2cqw] block text-[1.1cqw] font-semibold leading-snug", state === "right" ? "text-(--tg-ink)/80" : "text-(--tg-cream)/70")}>{detail}</span>}
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
  dense = false,
  extra,
}: {
  clues: readonly (string | null)[];
  open: number;
  elapsed: number;
  schedule: readonly number[];
  worth: readonly number[];
  tv?: boolean;
  /** TV con 12 tavoli al reveal: righe più basse, così sotto c'è posto per il «perché» */
  dense?: boolean;
  /** riga aggiuntiva per indizio (es. al reveal: chi scagiona) */
  extra?: (i: number) => ReactNode;
}) {
  return (
    <ol className={clsx("flex flex-col", tv ? (dense ? "gap-[0.4cqw]" : "gap-[0.6cqw]") : "gap-2")}>
      {clues.map((c, i) => {
        const isOpen = i < open;
        const inSec = Math.max(0, Math.ceil((schedule[i] - elapsed) / 1000));
        return (
          <li
            key={i}
            className={clsx(
              "flex items-center border-2",
              tv ? clsx("gap-[1cqw] rounded-[1cqw] px-[0.9cqw]", dense ? "py-[0.3cqw]" : "py-[0.55cqw]") : "gap-3 rounded-2xl px-2.5 py-2",
              isOpen ? (i === open - 1 ? "tg-rise border-(--tg-gold)/70 bg-(--tg-gold-dark)/55" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]") : "border-dashed border-(--tg-cream)/12",
            )}
          >
            {/* il valore dell'indizio è un doblone: acceso quando l'indizio è arrivato, spento finché è sigillato */}
            <Doubloon
              label={`${worth[i]} punti`}
              className={clsx(tv ? (dense ? "h-[2.9cqw] w-[2.9cqw] text-[1.1cqw]" : "h-[3.4cqw] w-[3.4cqw] text-[1.25cqw]") : "h-11 w-11 text-[0.95rem]", !isOpen && "opacity-40 grayscale")}
            >
              {worth[i]}
            </Doubloon>
            <div className="min-w-0 flex-1">
              {isOpen && c ? (
                <p className={clsx("font-bold leading-snug", tv ? (dense ? "text-[1.45cqw]" : "text-[1.6cqw]") : "text-base sm:text-lg")}>{c}</p>
              ) : (
                <p className={clsx("flex items-center gap-2 font-bold text-(--tg-cream)/40", tv ? "text-[1.45cqw]" : "text-base")}>
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

/** Bandiera della ciurma col numero del tavolo (colore della squadra se noto), come nella striscia dei tavoli. */
export function TableTag({ no, color, tv = false, small = false, className }: { no: number | string; color?: string; tv?: boolean; small?: boolean; className?: string }) {
  return (
    <span className={clsx("inline-flex shrink-0", className)} role="img" aria-label={`Tavolo ${no}`}>
      <CrewFlag color={color ?? "var(--tg-cream)"} n={no} className={tv ? (small ? "h-[2.25cqw] w-[3cqw]" : "h-[2.7cqw] w-[3.6cqw]") : "h-9 w-12"} />
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
    const arrows = seats.map((s) => arrow?.(s.teamId) ?? null);
    // con le scritte (reveal) bandiere più piccole: la parola resta intera anche nella colonna stretta di «Doppio gioco»
    const labeled = arrows.some((a) => !!a?.text);
    return (
      <ol className={clsx("grid w-full grid-cols-2 content-center gap-x-[1.2cqw] gap-y-[0.45cqw]", !labeled && "justify-items-center")} aria-label={label}>
        {seats.map((s, i) => {
          const to = seats[(i + 1) % n];
          const a = arrows[i];
          return (
            <li key={s.teamId} className="flex min-w-0 items-center gap-[0.4cqw]">
              <TableTag tv small={labeled} no={s.tableNo} color={colorOf(s.teamId)} />
              <span className="tg-display text-[1.6cqw] leading-none" style={{ color: a?.color ?? "color-mix(in srgb, var(--tg-cream) 60%, transparent)" }} aria-label="dà a">
                →
              </span>
              <TableTag tv small={labeled} no={to.tableNo} color={colorOf(to.teamId)} />
              {a?.text && (
                <span className="tg-display min-w-0 truncate text-[1.2cqw]" style={{ color: a.color }}>
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
  const cr = small ? 20 : 24;
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
  /** scritta sulla freccia: alone scuro sotto le lettere, leggibile anche sopra le linee e la rosa dei venti */
  const halo = { stroke: "var(--tg-night)", strokeWidth: 5, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  const fs = small ? 15 : 20;
  // margini ai lati: le scritte delle frecce laterali non vengono tagliate
  return (
    <svg viewBox="-30 -10 460 420" className="h-full max-h-full w-full" role="img" aria-label={label}>
      {/* rosa dei venti d'ottone al centro del giro (decorazione) */}
      <g transform="translate(130 130) scale(0.35)" opacity={0.2}>
        <CompassRose className="text-(--tg-brass)" />
      </g>
      {n > 1 &&
        seats.map((s, i) => {
          const [x1, y1] = at(i);
          const [x2, y2] = at((i + 1) % n);
          const a = arrow?.(s.teamId) ?? null;
          const col = a?.color ?? "color-mix(in srgb, var(--tg-cream) 45%, transparent)";
          const sw = small ? 4 : 5;
          if (n === 2) {
            // due archi: a sinistra dall'alto in basso, a destra dal basso in alto
            const side = i === 0 ? 1 : -1;
            const cx = 200 + side * 120;
            const sy = y1 + (y2 > y1 ? cr + 10 : -(cr + 10));
            const ey = y2 + (y2 > y1 ? -(cr + 12) : cr + 12);
            return (
              <g key={s.teamId}>
                <path d={`M${x1} ${sy} Q ${cx} 200 ${x2} ${ey}`} fill="none" stroke={col} strokeWidth={sw} strokeDasharray={a?.dashed ? "10 7" : undefined} />
                <polygon points={head(x2, ey, x2 - cx, ey - 200)} fill={col} />
                {a?.text && (
                  <text x={200 + side * 75} y={200} fill={col} fontSize={fs} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "var(--tg-display)" }} {...halo}>
                    {a.text}
                  </text>
                )}
              </g>
            );
          }
          const dx = x2 - x1;
          const dy = y2 - y1;
          const d = Math.hypot(dx, dy) || 1;
          const sx = x1 + (dx / d) * (cr + 9);
          const sy = y1 + (dy / d) * (cr + 9);
          const ex = x2 - (dx / d) * (cr + 10);
          const ey = y2 - (dy / d) * (cr + 10);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const len = Math.hypot(mx - 200, my - 200) || 1;
          const push = small ? 30 : 36;
          return (
            <g key={s.teamId}>
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={col} strokeWidth={sw} strokeDasharray={a?.dashed ? "9 6" : undefined} />
              <polygon points={head(ex, ey, dx, dy)} fill={col} />
              {a?.text && (
                <text x={mx + ((mx - 200) / len) * push} y={my + ((my - 200) / len) * push} fill={col} fontSize={fs} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "var(--tg-display)" }} {...halo}>
                  {a.text}
                </text>
              )}
            </g>
          );
        })}
      {seats.map((s, i) => {
        const [x, y] = at(i);
        // gettone della ciurma: disco del colore del tavolo dentro un anello d'ottone
        return (
          <g key={`c-${s.teamId}`}>
            <circle cx={x} cy={y + 2} r={cr + 6} fill="rgba(0,0,0,.45)" />
            <circle cx={x} cy={y} r={cr + 5} fill="var(--tg-wood-dark)" stroke="var(--tg-brass)" strokeWidth={2.5} />
            <circle cx={x} cy={y} r={cr} fill={colorOf(s.teamId) ?? "var(--tg-cream)"} stroke="rgba(27,20,16,.6)" strokeWidth={1.5} />
            <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={small ? 18 : 23} fontWeight={900} fill="var(--tg-ink)" style={{ fontFamily: "var(--tg-display)", fontFeatureSettings: '"lnum" 1' }}>
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

/** Busta sigillata con la ceralacca e il prezzo in dobloni (acquisto con conferma in due tocchi). */
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
      <div className="tg-pop flex flex-col gap-1.5 rounded-2xl border-2 border-(--tg-teal) bg-(--tg-teal)/10 px-4 py-3">
        <p className="flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-(--tg-teal-hi)">
          <span>{title}</span>
          <span className="tg-num text-base">−{price}</span>
        </p>
        <div className="text-base font-bold leading-snug">{children}</div>
      </div>
    );
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-dashed border-(--tg-teal)/60 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--tg-teal)_7%,transparent)_0_10px,transparent_10px_20px)] px-3.5 py-3">
      <p className="flex items-center gap-2.5">
        <WaxSeal mark="anchor" className="h-9 w-9 shrink-0" />
        <span className="min-w-0 flex-1 text-base font-extrabold leading-tight">
          {title}
          <span className="block text-xs font-bold text-(--tg-cream)/65">sigillata</span>
        </span>
        <Doubloon label={`costa ${price} punti`} className="h-11 w-11 text-[1.05rem]">
          {price}
        </Doubloon>
      </p>
      {canBuy ? (
        confirm ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="h-12 rounded-xl border border-(--tg-cream)/15 text-sm font-extrabold uppercase">
              Annulla
            </button>
            <button type="button" onClick={onBuy} className="tg-display h-12 whitespace-nowrap rounded-xl bg-(--tg-teal) text-xl text-(--tg-ink)">
              Sì, compra
            </button>
          </div>
        ) : (
          // Grenze è largo: l'etichetta lunga sta su una riga a parte, piccola (niente parole spezzate nel pulsante)
          <button type="button" onClick={() => setConfirm(true)} className="flex min-h-14 flex-col items-center justify-center rounded-xl border-2 border-(--tg-teal) px-3 py-1.5 text-(--tg-teal-hi)">
            <span className="tg-display flex items-center gap-2 whitespace-nowrap text-xl">
              <Icon name="coins" className="h-5 w-5" /> Compra
            </span>
            <span className="mt-1 text-xs font-bold text-(--tg-cream)/80">costa {price} punti potenziali</span>
          </button>
        )
      ) : (
        <p className="text-sm font-semibold text-(--tg-cream)/70">{lockedNote ?? "Può comprarlo solo il capitano."}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scelta a due carte (fidarsi/da soli, sicura/rischiosa, condivido/inganno)
// ---------------------------------------------------------------------------

/**
 * Due grandi carte affiancate per una scelta secca. Il titolo in Grenze resta su una riga (corpo in base alla
 * lunghezza: «Ci fidiamo», «Condivido», «Rischiosa» stanno anche su un telefono stretto); la carta scelta riceve il
 * sigillo di ceralacca nell'angolo, fuori dal testo.
 */
export function PactToggle<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  label,
}: {
  options: { id: T; title: string; sub?: ReactNode; tone?: "gold" | "red" | "cream"; icon?: Parameters<typeof Icon>[0]["name"] }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  // stesso corpo per le due carte (deciso dal titolo più lungo): «Sicura» e «Rischiosa» si leggono alla pari
  const long = options.some((o) => o.title.length > 7);
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2.5">
      {options.map((o) => {
        const on = value === o.id;
        const accent = o.tone === "red" ? "var(--tg-red-hi)" : o.tone === "cream" ? "var(--tg-cream)" : "var(--tg-gold)";
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={clsx(
              "relative flex min-h-24 min-w-0 flex-col items-start justify-between gap-1.5 rounded-2xl border-2 p-3 text-left transition-transform active:scale-[0.98]",
              on ? "tg-picked shadow-[0_0_26px_-10px_rgba(242,177,52,.75)]" : "border-(--tg-cream)/14 bg-(--tg-cream)/[0.05]",
            )}
            style={on ? { borderColor: accent } : undefined}
          >
            <span className={clsx("tg-display whitespace-nowrap leading-none", long ? "text-[1.4rem] sm:text-[1.75rem]" : "text-[1.65rem] sm:text-3xl")} style={on ? { color: accent } : undefined}>
              {o.title}
            </span>
            {o.sub && (
              <span className="flex items-start gap-1.5 text-sm font-bold leading-snug text-(--tg-cream)/85">
                {o.icon && <Icon name={o.icon} className="mt-px h-4 w-4 shrink-0 opacity-75" />}
                <span className="min-w-0">{o.sub}</span>
              </span>
            )}
            {on && <WaxSeal mark="check" tone={o.tone === "red" ? "red" : "gold"} className="tg-pop absolute -right-2.5 -top-2.5 h-10 w-10 drop-shadow-[0_3px_4px_rgba(0,0,0,.6)]" />}
            <span className="sr-only">{on ? " · selezionato" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Elenchi di fatti e indizi
// ---------------------------------------------------------------------------

export function FactList({ facts, tv = false, title = "Fatti accertati" }: { facts: readonly string[]; tv?: boolean; title?: string }) {
  return (
    <div className={clsx("flex flex-col", tv ? "gap-[0.4cqw]" : "gap-1.5")}>
      <p className={clsx("font-extrabold uppercase text-(--tg-gold)", tv ? "text-[0.95cqw] tracking-[0.2em]" : "text-[11px] tracking-[0.18em]")}>{title}</p>
      <ul className={clsx("flex flex-col", tv ? "gap-[0.4cqw]" : "gap-1.5")}>
        {facts.map((f, i) => (
          <li key={i} className={clsx("flex font-bold leading-snug", tv ? "gap-[0.6cqw] text-[1.4cqw]" : "gap-2 text-base")}>
            <Icon name="check" className={clsx("shrink-0 text-(--tg-gold)", tv ? "mt-[0.15cqw] h-[1.5cqw] w-[1.5cqw]" : "mt-0.5 h-5 w-5")} /> {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClueList({ clues, tv = false, title = "Indizi gratuiti", extra }: { clues: readonly string[]; tv?: boolean; title?: string; extra?: (i: number) => ReactNode }) {
  return (
    <div className={clsx("flex flex-col", tv ? "gap-[0.5cqw]" : "gap-1.5")}>
      <p className={clsx("font-extrabold uppercase text-(--tg-gold)", tv ? "text-[0.95cqw] tracking-[0.2em]" : "text-[11px] tracking-[0.18em]")}>{title}</p>
      <ol className={clsx("flex flex-col", tv ? "gap-[0.5cqw]" : "gap-1.5")}>
        {clues.map((c, i) => (
          <li key={i} className={clsx("flex font-bold leading-snug", tv ? "gap-[0.7cqw] text-[1.45cqw]" : "gap-2 text-base")}>
            <span className={clsx("tg-num shrink-0 text-(--tg-gold)", tv ? "w-[1.6cqw]" : "w-5")}>{i + 1}</span>
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
