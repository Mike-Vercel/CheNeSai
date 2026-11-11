"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { PublicIntroSkip } from "@/lib/game-engine/types";
import { api, ApiError } from "@/lib/realtime/api-client";

/**
 * "SALTA INTRO" dal telefono di ogni giocatore (durante l'intro e le regole).
 * Si salta solo se votano TUTTI; un secondo tocco ritira il voto ("Annulla").
 */
export function IntroSkipButton({
  code,
  slot,
  skip,
  nickname,
  className,
  compact = false,
}: {
  code: string;
  slot: string | null;
  skip: PublicIntroSkip | null | undefined;
  nickname: string | null;
  className?: string;
  compact?: boolean;
}) {
  // stato locale (ottimista) finché lo stato pubblico non lo conferma
  const [local, setLocal] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fromServer = !!nickname && !!skip?.names.includes(nickname);
  const voted = local ?? fromServer;
  const votes = skip?.votes ?? 0;
  const needed = skip?.needed ?? 0;

  const send = async (want: boolean) => {
    setBusy(true);
    setError(null);
    setLocal(want);
    try {
      await api("/api/play/intro-skip", { method: "POST", json: { code, skip: want, ...(slot ? { slot } : {}) } });
    } catch (e) {
      setLocal(null);
      setError(e instanceof ApiError ? e.message : "Connessione assente, riprova");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={clsx("flex flex-col items-center gap-1.5", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void send(!voted)}
        className={clsx(
          "rounded-full font-display shadow-[0_5px_0_rgba(0,0,0,.35)] transition active:scale-[0.97] disabled:opacity-60",
          compact ? "px-5 py-2.5 text-lg" : "px-7 py-3.5 text-2xl",
          voted ? "bg-white/15 text-white" : "bg-gold text-ink",
        )}
        aria-pressed={voted}
      >
        {voted ? "✕ ANNULLA" : "⏭ SALTA INTRO"}
      </button>
      <p className={clsx("text-center font-bold text-white/85", compact ? "text-xs" : "text-sm")} aria-live="polite">
        {needed > 0 ? (
          voted ? (
            <>
              Hai votato! Saltano l&apos;intro: {votes}/{needed}. Si salta solo se votano tutti.
            </>
          ) : (
            <>
              Conoscete già le regole? Si salta solo se votano tutti ({votes}/{needed}).
            </>
          )
        ) : (
          "Conoscete già le regole? Si salta solo se votano tutti."
        )}
      </p>
      {error && (
        <p role="alert" className="text-center text-xs font-bold text-[#ffc2cd]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Contatore sul TV / show del telefono: "Saltano l'intro: 2/4" con i nomi di chi ha votato. */
export function IntroSkipCounter({ skip, portrait = false }: { skip: PublicIntroSkip | null | undefined; portrait?: boolean }) {
  if (!skip || skip.needed === 0 || skip.votes === 0) return null;
  return (
    <div
      className={clsx(
        "pointer-events-none absolute z-[44] rounded-2xl bg-black/70 text-white shadow-xl backdrop-blur",
        portrait ? "left-1/2 top-[11cqh] w-[86cqw] -translate-x-1/2 px-[3cqw] py-[1.6cqw] text-center" : "right-[2cqw] top-[3cqh] max-w-[34cqw] px-[1.6cqh] py-[1cqh]",
      )}
      data-testid="intro-skip-counter"
    >
      <p className={clsx("font-display text-gold", portrait ? "text-[4.6cqw]" : "text-[2.8cqh]")}>
        ⏭ Saltano l&apos;intro: {skip.votes}/{skip.needed}
      </p>
      <p className={clsx("truncate font-bold text-white/85", portrait ? "text-[3.2cqw]" : "text-[2cqh]")}>{skip.names.join(", ")}</p>
    </div>
  );
}
