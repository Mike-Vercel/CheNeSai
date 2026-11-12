"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import type { TvOverlayContext } from "@/features/display/DisplayApp";
import { formatPoints } from "@/features/game/lines";
import type { GamePhase } from "@/lib/game-engine/types";
import { inviteMessage, whatsappUrl } from "./invite";
import { useJoinUrl } from "./InviteButton";
import { useSeatContext } from "./use-seat";

/**
 * Pezzi dello show interattivo dal PC (partita online, show orizzontale): comandi sovrapposti allo
 * show, piccoli e sempre negli stessi angoli, che non coprono mai domanda, risposte o timer.
 * Le misure dei contenitori sono in unità dello show (cqw/cqh), i pulsanti in px (mouse e tastiera).
 */

/** Angolo in alto a destra (durante la partita): punti, audio, LIVE, menu. */
export function TopRightCluster({ children }: { children: ReactNode }) {
  return <div className="absolute right-[1.5cqw] top-[1.8cqh] z-[66] flex items-center gap-2">{children}</div>;
}

/** Fascia in basso della lobby: a sinistra chi gioca, a destra invito, LIVE e menu. */
export function LobbyDock({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <>
      <div className="absolute bottom-[3cqh] left-[4cqw] z-[66] flex w-[50cqw] flex-col gap-2 rounded-[22px] bg-night/90 p-3 shadow-[0_-10px_40px_rgba(0,0,0,.45)] backdrop-blur-sm">{left}</div>
      <div className="absolute bottom-[3cqh] right-[4cqw] z-[66] flex w-[34cqw] min-w-[300px] flex-col gap-2 rounded-[22px] bg-night/90 p-3 shadow-[0_-10px_40px_rgba(0,0,0,.45)] backdrop-blur-sm">{right}</div>
    </>
  );
}

/** I miei punti e la mia posizione (chi gioca dallo show). Mai al podio: la classifica finale si scopre con lo show. */
export function ScoreHud({ phase }: { phase: GamePhase }) {
  const seat = useSeatContext();
  if (!seat || phase === "FINISHED") return null;
  return (
    <div data-testid="score-hud" className="flex h-11 items-center gap-2 rounded-full border-2 border-gold/70 bg-black/60 px-4 font-display text-lg text-white backdrop-blur">
      <span className="max-w-[16ch] truncate font-sans text-sm font-extrabold">{seat.nickname}</span>
      <span aria-hidden className="text-gold">🏆</span>
      <span>{seat.points === null ? "…" : formatPoints(seat.points)}</span>
      {seat.rank && <span className="text-sm text-white/70">{seat.rank}°</span>}
    </div>
  );
}

/** Pulsante rotondo dei comandi (icona + etichetta per i lettori di schermo). */
export function RoundButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={clsx("grid h-11 w-11 place-items-center rounded-full bg-black/60 text-xl text-white outline-none backdrop-blur transition hover:bg-black/80 focus-visible:ring-4 focus-visible:ring-cyan", className)}
    >
      {children}
    </button>
  );
}

/** Audio: i browser lo attivano solo dopo un clic. */
export function AudioChip({ ctx }: { ctx: TvOverlayContext }) {
  if (ctx.audioOn) return null;
  return (
    <button
      type="button"
      onClick={() => ctx.activateAudio()}
      className="absolute left-1/2 top-[2cqh] z-[67] -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-6 py-2.5 font-display text-xl text-ink shadow-[0_5px_0_#9a5d00] outline-none focus-visible:ring-4 focus-visible:ring-cyan"
    >
      🔊 CLICCA PER L&apos;AUDIO
    </button>
  );
}

/** Link per invitare, da copiare (PC): codice, indirizzo, Copia e WhatsApp. Solo nella finestra di chi gioca, mai nella vista LIVE. */
export function CopyInvite({ code, host, online = true, label = true }: { code: string; host?: string | null; online?: boolean; /** riga «Invita · codice» (nel menu c'è già il titolo) */ label?: boolean }) {
  const joinUrl = useJoinUrl(code);
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied("ok");
    } catch {
      setCopied("error");
    }
    setTimeout(() => setCopied(null), 2200);
  }
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">
          Invita · codice <span className="tracking-[0.16em] text-gold">{code}</span>
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label="Link per entrare nella partita"
          value={joinUrl.replace(/^https?:\/\//, "")}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/20 bg-black/40 px-3 text-sm font-bold text-white"
        />
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!joinUrl}
          className="h-10 shrink-0 rounded-xl bg-white px-3 text-sm font-black text-ink outline-none focus-visible:ring-4 focus-visible:ring-cyan disabled:opacity-50"
        >
          {copied === "ok" ? "✓ Copiato" : copied === "error" ? "Non riuscito" : "Copia link"}
        </button>
        <a
          href={joinUrl ? whatsappUrl(inviteMessage({ code, joinUrl, host, online })) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-10 shrink-0 place-items-center rounded-xl bg-[#25d366] px-3 text-sm font-black text-ink outline-none focus-visible:ring-4 focus-visible:ring-cyan"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}
