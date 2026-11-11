"use client";

import { clsx } from "clsx";
import { motion } from "motion/react";
import type { LeaderboardEntry, PublicTeamsInfo, TeamLeaderboardEntry } from "@/lib/game-engine/types";
import { Logo } from "@/features/game/components/brand";
import { formatPoints, signedPoints } from "@/features/game/lines";
import { TalkingCharacter, TvFrame } from "./TvScreens";

/**
 * Schermate TV della modalità SQUADRE. Le righe di squadra mostrano solo nome, colore,
 * numero di giocatori e punteggio di squadra: nessun risultato attribuito a un singolo giocatore.
 */

function Movement({ rank, previousRank }: { rank: number; previousRank: number | null }) {
  if (previousRank === null || previousRank === rank) return <span className="w-[5cqh] text-center text-[2.6cqh] text-white/40">•</span>;
  const up = previousRank > rank;
  return (
    <span className={clsx("w-[5cqh] text-center font-display text-[2.6cqh]", up ? "text-[#5dffab]" : "text-[#ff8098]")}>
      {up ? "▲" : "▼"}
      {Math.abs(previousRank - rank)}
    </span>
  );
}

function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={clsx("inline-block shrink-0 rounded-full border-[0.3cqh] border-white/80", className)} style={{ background: color }} />;
}

/** Elenco delle squadre (nella lobby): colore, nome e quanti giocatori ci sono. */
export function TvLobbyTeams({ teams }: { teams: PublicTeamsInfo }) {
  if (teams.list.length === 0) return null;
  return (
    <div className="absolute inset-x-[4cqw] bottom-[2.5cqh] z-10 flex flex-wrap justify-center gap-[1.2cqh]">
      {teams.list.map((t) => (
        <span key={t.id} className="flex items-center gap-[1cqh] rounded-full border-[0.35cqh] bg-night/85 px-[2cqh] py-[0.6cqh]" style={{ borderColor: t.color }}>
          <Swatch color={t.color} className="h-[2.4cqh] w-[2.4cqh]" />
          <span className="font-display text-[2.8cqh] text-white">{t.name}</span>
          <span className="text-[2.4cqh] font-extrabold text-white/70">{t.members}</span>
        </span>
      ))}
    </div>
  );
}

function TeamRows({ teams, showDelta, big }: { teams: TeamLeaderboardEntry[]; showDelta: boolean; big: boolean }) {
  return (
    <ol className="flex flex-col gap-[0.9cqh]">
      {teams.map((t, i) => (
        <motion.li
          key={t.teamId}
          layout
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 140, damping: 18 }}
          className={clsx(
            "flex items-center gap-[1.8cqh] rounded-[1.8cqh] border-[0.45cqh] bg-black/55 px-[2cqh]",
            big ? "py-[0.9cqh]" : "py-[0.45cqh]",
            t.rank === 1 && "bg-gradient-to-r from-gold-deep/80 to-black/50",
          )}
          style={{ borderColor: t.color }}
        >
          <span className={clsx("w-[6cqh] text-center font-display text-gold", big ? "text-[4.4cqh]" : "text-[3.4cqh]")}>{t.rank}</span>
          <Movement rank={t.rank} previousRank={t.previousRank} />
          <Swatch color={t.color} className={big ? "h-[4cqh] w-[4cqh]" : "h-[3cqh] w-[3cqh]"} />
          <span className={clsx("min-w-0 flex-1 truncate font-display text-white", big ? "text-[4.2cqh]" : "text-[3.2cqh]")}>
            {t.name}
            <span className={clsx("ml-[1.2cqh] font-sans font-extrabold text-white/60", big ? "text-[2.4cqh]" : "text-[2cqh]")}>
              {t.members === 1 ? "1 giocatore" : `${t.members} giocatori`}
            </span>
          </span>
          {showDelta && t.lastDelta !== 0 && (
            <span className={clsx("font-display", big ? "text-[3.2cqh]" : "text-[2.6cqh]", t.lastDelta > 0 ? "text-[#5dffab]" : "text-[#ff8098]")}>{signedPoints(t.lastDelta)}</span>
          )}
          <span className={clsx("text-right font-display text-white", big ? "w-[20cqh] text-[4.4cqh]" : "w-[15cqh] text-[3.4cqh]")}>{formatPoints(t.points)}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/**
 * Classifica di fine round / classifica in modalità squadre.
 * - "teams": solo le squadre (grandi);
 * - "both": squadre a sinistra, migliori giocatori a destra.
 */
export function TvTeamLeaderboardScreen({
  teams,
  players,
  title,
  showDelta,
  aggregation,
}: {
  teams: TeamLeaderboardEntry[];
  /** null = solo squadre (modalità "teams") */
  players: LeaderboardEntry[] | null;
  title: string;
  showDelta: boolean;
  aggregation: "sum" | "average";
}) {
  const both = players !== null;
  return (
    <TvFrame>
      <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2">
        <Logo size="tv" />
      </div>
      {!both && (
        <div className="absolute bottom-0 right-[1cqw] w-[24cqw]">
          <TalkingCharacter who="professore" className="w-full" animation="point" />
        </div>
      )}
      <div className={clsx("absolute top-[15.5cqh]", both ? "left-[4cqw] w-[50cqw]" : "left-[5cqw] right-[28cqw]")}>
        <h1 className="font-display text-[5.2cqh] text-gold [text-shadow:0_0.5vh_0_#6b1020]">{title}</h1>
        <p className="mb-[1.2cqh] text-[2.4cqh] font-extrabold uppercase tracking-wide text-white/70">
          Squadre · {aggregation === "average" ? "media dei punti" : "somma dei punti"}
        </p>
        <TeamRows teams={teams.slice(0, 8)} showDelta={showDelta} big={!both} />
        {teams.length === 0 && <p className="text-[3cqh] font-extrabold text-white/70">Le squadre appariranno appena hanno giocatori.</p>}
      </div>
      {both && (
        <div className="absolute right-[4cqw] top-[15.5cqh] w-[36cqw]">
          <h2 className="font-display text-[4cqh] text-white [text-shadow:0_0.5vh_0_#6b1020]">GIOCATORI</h2>
          <p className="mb-[1.2cqh] text-[2.4cqh] font-extrabold uppercase tracking-wide text-white/70">Classifica individuale</p>
          <ol className="flex flex-col gap-[0.6cqh]">
            {players.slice(0, 8).map((e, i) => (
              <motion.li
                key={e.participantId}
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.05, type: "spring", stiffness: 140, damping: 18 }}
                className={clsx("flex items-center gap-[1.4cqh] rounded-[1.4cqh] border-[0.3cqh] px-[1.6cqh] py-[0.3cqh]", i === 0 ? "border-gold bg-violet/70" : "border-white/20 bg-black/45")}
              >
                <span className="w-[4.5cqh] text-center font-display text-[2.8cqh] text-gold">{e.rank}</span>
                <Movement rank={e.rank} previousRank={e.previousRank} />
                <span className="min-w-0 flex-1 truncate font-display text-[2.8cqh] text-white">{e.nickname}</span>
                <span className="font-display text-[2.8cqh] text-white">{formatPoints(e.points)}</span>
              </motion.li>
            ))}
          </ol>
        </div>
      )}
    </TvFrame>
  );
}

/** Squadra (o squadre a pari merito) vincitrice, mostrata sopra il podio individuale in modalità "both". */
export function TvWinningTeamBanner({ teams }: { teams: TeamLeaderboardEntry[] }) {
  if (teams.length === 0) return null;
  return (
    <motion.div
      initial={{ y: -30, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 14 }}
      className="absolute left-1/2 top-[22cqh] z-30 flex -translate-x-1/2 items-center gap-[1.6cqh] whitespace-nowrap rounded-full border-[0.5cqh] border-gold bg-night/90 px-[3cqh] py-[1cqh] shadow-[0_0_40px_rgba(255,212,59,.45)]"
    >
      <span className="text-[4cqh]">🏆</span>
      <span className="font-display text-[3cqh] uppercase text-white/80">{teams.length > 1 ? "Squadre vincitrici a pari merito" : "Squadra vincitrice"}</span>
      {teams.map((t) => (
        <span key={t.teamId} className="flex items-center gap-[1cqh] font-display text-[4cqh] text-gold">
          <Swatch color={t.color} className="h-[3cqh] w-[3cqh]" />
          {t.name}
        </span>
      ))}
      <span className="font-display text-[3cqh] text-white/80">{formatPoints(teams[0].points)} pt</span>
    </motion.div>
  );
}
