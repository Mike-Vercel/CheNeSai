"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { PublicTeamsInfo, TeamLeaderboardEntry } from "@/lib/game-engine/types";
import { api, ApiError, withRetry } from "@/lib/realtime/api-client";
import { formatPoints, signedPoints } from "@/features/game/lines";
import { PhoneCard } from "./PlayerScreens";

/** Squadra del giocatore (nome e colore), accanto al nickname. */
export function PhoneTeamBadge({ team, className }: { team: { name: string; color: string }; className?: string }) {
  return (
    <span className={clsx("inline-flex max-w-full items-center gap-1.5 rounded-full border-2 bg-black/50 px-2.5 py-0.5 text-sm font-extrabold", className)} style={{ borderColor: team.color }}>
      <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border border-white/80" style={{ background: team.color }} />
      <span className="truncate">{team.name}</span>
    </span>
  );
}

/**
 * Scelta della squadra dal telefono (solo se la regia lo consente): il server verifica tutto
 * (modalità, fase, squadra della serata). Nella lobby si può cambiare idea.
 */
export function PhoneTeamPicker({
  code,
  slot,
  teams,
  current,
  locked,
  onChosen,
}: {
  code: string;
  slot: string | null;
  teams: PublicTeamsInfo;
  current: string | null;
  /** a partita iniziata chi ha già una squadra non può più cambiarla */
  locked: boolean;
  onChosen: () => void;
}) {
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (teams.list.length === 0) return null;

  async function choose(teamId: string) {
    if (sending || teamId === current || locked) return;
    setSending(teamId);
    setError(null);
    try {
      await withRetry(() => api("/api/play/team", { method: "POST", json: { code, teamId, ...(slot ? { slot } : {}) } }));
      onChosen();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Scelta non inviata, riprova");
    } finally {
      setSending(null);
    }
  }

  return (
    <PhoneCard className="w-full text-left">
      <p className="font-display text-xl text-gold">{current ? "La tua squadra" : "Scegli la tua squadra"}</p>
      {!current && <p className="text-sm text-white/70">Giochi per te e per la tua squadra: i tuoi punti contano per entrambi.</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {teams.list.map((t) => {
          const mine = t.id === current;
          return (
            <button
              key={t.id}
              type="button"
              disabled={!!sending || (locked && !mine)}
              onClick={() => void choose(t.id)}
              aria-pressed={mine}
              className={clsx(
                "flex min-h-14 items-center gap-2 rounded-2xl border-[3px] px-3 py-2 text-left font-extrabold transition active:scale-[0.98] disabled:opacity-60",
                mine ? "bg-white/15 shadow-[0_0_18px_rgba(255,255,255,.25)]" : "bg-black/40",
              )}
              style={{ borderColor: t.color }}
            >
              <span aria-hidden className="h-5 w-5 shrink-0 rounded-full border-2 border-white/80" style={{ background: t.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{t.name}</span>
                <span className="block text-xs font-bold text-white/60">{sending === t.id ? "Un attimo…" : `${t.members} ${t.members === 1 ? "giocatore" : "giocatori"}`}</span>
              </span>
              {mine && <span className="text-lg">✓</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 rounded-xl bg-flame/25 px-3 py-2 text-sm font-bold text-[#ffd1da]">{error}</p>}
    </PhoneCard>
  );
}

/** Classifica a squadre sul telefono, con la propria squadra evidenziata. */
export function PhoneTeamStandings({ teams, myTeamId, title = "Classifica squadre" }: { teams: TeamLeaderboardEntry[]; myTeamId: string | null; title?: string }) {
  const mine = teams.find((t) => t.teamId === myTeamId) ?? null;
  return (
    <div className="flex flex-col gap-2">
      <PhoneCard className="text-center">
        <p className="font-display text-xl text-gold">{title}</p>
        {mine ? (
          <>
            <p className="font-display text-5xl leading-none text-white">{mine.rank}°</p>
            <p className="mt-1 font-display text-xl" style={{ color: mine.color }}>
              {mine.name}
            </p>
            <p className="font-display text-lg">{formatPoints(mine.points)} punti di squadra</p>
            {mine.lastDelta !== 0 && (
              <p className={clsx("font-display", mine.lastDelta > 0 ? "text-[#5dffab]" : "text-[#ff8098]")}>{signedPoints(mine.lastDelta)} nell&apos;ultima domanda</p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm font-bold text-white/70">Non fai parte di una squadra</p>
        )}
      </PhoneCard>
      <ol className="flex flex-col gap-1.5">
        {teams.map((t) => (
          <li
            key={t.teamId}
            className={clsx("flex items-center gap-3 rounded-xl border-2 px-3 py-2", t.teamId === myTeamId ? "bg-white/15" : "bg-black/40")}
            style={{ borderColor: t.color }}
          >
            <span className="w-7 text-center font-display text-gold">{t.rank}</span>
            <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/80" style={{ background: t.color }} />
            <span className="min-w-0 flex-1 truncate font-extrabold">{t.name}</span>
            <span className="font-display">{formatPoints(t.points)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
