"use client";

import { clsx } from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Button, Spinner } from "@/components/ui";
import type { SessionStatus } from "@/lib/game-engine/types";
import { STATUS_INFO, type BadgeColor } from "./format";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-sm font-bold text-white/60 hover:text-gold">
            <span aria-hidden>←</span> {back.label}
          </Link>
        )}
        <h1 className="break-words font-display text-3xl leading-tight tracking-wide text-gold md:text-4xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-white/65">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function LoadingBlock({ label = "Caricamento…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#1d0c30] p-10 text-white/70" role="status">
      <Spinner className="h-6 w-6 text-gold" />
      <span className="font-bold">{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-flame/60 bg-[#3d0914]/60 p-5 text-[#ffc2cd]" role="alert">
      <p className="font-bold">Impossibile caricare i dati</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={onRetry}>
          Riprova
        </Button>
      )}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: SessionStatus; className?: string }) {
  const s = STATUS_INFO[status];
  return (
    <Badge color={s.color} className={className}>
      {status === "live" && <span className="h-2 w-2 animate-pulse rounded-full bg-flame" aria-hidden />}
      {s.label}
    </Badge>
  );
}

export function TestBadge() {
  return <Badge color="fuchsia">Prova generale</Badge>;
}

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "gold",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "gold" | "cyan" | "lime" | "fuchsia" | "violet" | "flame";
}) {
  const toneCls = {
    gold: "text-gold",
    cyan: "text-cyan",
    lime: "text-[#5dffab]",
    fuchsia: "text-[#ff8cc8]",
    violet: "text-[#c9a3ff]",
    flame: "text-[#ff8098]",
  }[tone];
  const body = (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-white/55">{label}</p>
      <p className={clsx("mt-1 font-display text-3xl leading-none", toneCls)}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-white/55">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-white/10 bg-[#1d0c30] p-4 shadow-lg";
  return href ? (
    <Link href={href} className={clsx(cls, "transition hover:border-gold/50 hover:bg-[#241040]")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Link con l'aspetto di un Button (per navigazione). */
export function LinkButton({
  href,
  children,
  variant = "ghost",
  size = "md",
  newTab,
  className,
  download,
}: {
  href: string;
  children: ReactNode;
  variant?: "gold" | "primary" | "danger" | "success" | "ghost" | "outline" | "violet";
  size?: "sm" | "md" | "lg" | "xl";
  newTab?: boolean;
  className?: string;
  download?: boolean;
}) {
  const v = {
    gold: "bg-gradient-to-b from-[#ffe680] via-gold to-gold-deep text-ink border-[#b8770a] shadow-[0_4px_0_#9a5d00] hover:brightness-110",
    primary: "bg-gradient-to-b from-[#3d9bff] to-electric text-white border-[#0753b0] shadow-[0_4px_0_#05408a] hover:brightness-110",
    danger: "bg-gradient-to-b from-[#ff5a74] to-flame text-white border-[#a10f2a] shadow-[0_4px_0_#7e0b21] hover:brightness-110",
    success: "bg-gradient-to-b from-[#3cf095] to-lime text-ink border-[#008a44] shadow-[0_4px_0_#006b35] hover:brightness-110",
    violet: "bg-gradient-to-b from-[#a463ff] to-violet text-white border-[#5212b8] shadow-[0_4px_0_#420e96] hover:brightness-110",
    ghost: "bg-white/5 text-white border-white/10 hover:bg-white/10",
    outline: "bg-transparent text-gold border-gold/60 hover:bg-gold/10",
  }[variant];
  const s = { sm: "h-8 px-3 text-sm rounded-lg", md: "h-10 px-4 text-[15px] rounded-xl", lg: "h-14 px-6 text-lg rounded-2xl", xl: "min-h-20 px-6 text-2xl rounded-2xl" }[size];
  const cls = clsx("inline-flex select-none items-center justify-center gap-2 border-2 font-extrabold tracking-wide transition active:translate-y-[2px]", v, s, className);
  if (newTab || download) {
    return (
      <a href={href} className={cls} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined} download={download || undefined}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function Pill({ children, color = "gray", title }: { children: ReactNode; color?: BadgeColor; title?: string }) {
  return (
    <span title={title}>
      <Badge color={color}>{children}</Badge>
    </span>
  );
}

/** Pulsanti segmentati (filtri a schede). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex max-w-full flex-wrap gap-1 rounded-xl border border-white/10 bg-[#0f0519] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm font-bold transition",
            value === o.value ? "bg-gold text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  hint?: ReactNode;
}) {
  return (
    <label className={clsx("flex cursor-pointer items-start gap-2 text-sm", disabled && "cursor-not-allowed opacity-50")}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#ffd43b]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-bold text-white/90">{label}</span>
        {hint && <span className="block text-xs text-white/55">{hint}</span>}
      </span>
    </label>
  );
}

export function Pager({ offset, limit, total, onChange }: { offset: number; limit: number; total: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav className="mt-4 flex items-center justify-center gap-3" aria-label="Paginazione">
      <Button variant="ghost" size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
        ← Precedente
      </Button>
      <span className="text-sm font-bold text-white/70">
        Pagina {page} di {pages} · {total} risultati
      </span>
      <Button variant="ghost" size="sm" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
        Successiva →
      </Button>
    </nav>
  );
}

export function InfoNote({ children, tone = "info", className }: { children: ReactNode; tone?: "info" | "warn" | "danger" | "ok"; className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-xl border px-3 py-2 text-sm",
        tone === "info" && "border-cyan/30 bg-cyan/10 text-[#bff4ff]",
        tone === "warn" && "border-gold/40 bg-gold/10 text-[#ffe9a3]",
        tone === "danger" && "border-flame/50 bg-flame/15 text-[#ffc2cd]",
        tone === "ok" && "border-lime/40 bg-lime/10 text-[#bfffdc]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="whitespace-nowrap text-xs text-gold" aria-label={`Difficoltà ${value} su 5`} title={`Difficoltà ${value}/5`}>
      {"●".repeat(Math.max(0, Math.min(5, value)))}
      <span className="text-white/20">{"●".repeat(Math.max(0, 5 - value))}</span>
    </span>
  );
}

export const MEDIA_ICON: Record<string, string> = { image: "🖼️", audio: "🎵", video: "🎬" };

/** Select compatta per le righe dense (non usa Select di ui.tsx per evitare conflitti di classi). */
export function MiniSelect({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={clsx(
        "h-9 max-w-full rounded-lg border border-white/15 bg-[#0f0519] px-2 text-sm text-white focus:border-cyan focus:outline-none disabled:opacity-50",
        className,
      )}
    />
  );
}

/** Registro delle domande: "Mai giocata" oppure "Giocata il …" (solo serate reali, mai le prove). */
export function PlayedBadge({ lastPlayedAt, timesPlayed }: { lastPlayedAt: string | null; timesPlayed?: number }) {
  if (!lastPlayedAt) return <Pill color="green" title="Mai mostrata in una serata reale">Mai giocata</Pill>;
  const day = new Date(lastPlayedAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  return (
    <Pill color="blue" title="Ultima volta mostrata in una serata reale">
      Giocata il {day}
      {timesPlayed && timesPlayed > 1 ? ` · ${timesPlayed} volte` : ""}
    </Pill>
  );
}
