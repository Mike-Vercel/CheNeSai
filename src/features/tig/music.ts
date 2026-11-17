"use client";

import { useEffect, useRef } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { CATALOG } from "@/lib/tig/games";
import type { TigPublicState } from "@/lib/tig/types";
import { TIG_MUSIC_FILES } from "./music-files";

/**
 * TAVOLI IN GUERRA! — MUSICA DI SOTTOFONDO della TV (brani in `public/audio/tig/musica/<nome>.mp3`, prompt per Suno
 * in docs/tavoli-in-guerra/musica-suno.txt). Un brano per fase; se il brano non c'è si prova il successivo della
 * catena (es. il brano del minigioco → «prova»); se non c'è niente, silenzio. Passa dal bus musica del motore audio:
 * rispetta volume e muto e si abbassa da solo quando parla un presentatore.
 */

export interface MusicCue {
  /** catena di brani: vince il primo presente */
  names: string[];
  loop: boolean;
  volume: number;
}

/** Prove in cui un sottofondo ritmato aiuterebbe (o disturberebbe) il gioco: solo il loro brano, mai quello generico. */
const NO_GENERIC_BED = new Set(["tempo-fantasma", "rumore-di-fondo"]);
const NUMBER_OF = new Map(CATALOG.map((c) => [c.code, c.number]));

const BED = 0.55; // sottofondi: sotto la voce
const STING = 0.9; // stacchi brevi

export function gameTrack(code: string): string | null {
  const n = NUMBER_OF.get(code);
  return n ? `gioco-${String(n).padStart(2, "0")}-${code}` : null;
}

/** Brano per lo stato della serata (pura: testata). null = silenzio. */
export function musicFor(s: TigPublicState): MusicCue | null {
  const st = s.state === "PAUSED" ? s.pausedFrom : s.state;
  const g = s.game;
  switch (st) {
    case "DRAFT":
    case "LOBBY_OPEN":
    case "LOBBY_LOCKED":
      // in sala d'attesa mai il coro in loop: semmai la sigla strumentale
      return { names: ["lobby", "sigla-strumentale"], loop: true, volume: BED };
    case "INTRO":
      // l'apertura della serata è il momento della sigla col coro «TAVOLI IN GUERRA!»
      return { names: ["sigla", "apertura"], loop: false, volume: STING };
    case "ROUND_INTRO":
      return { names: [`manche-${s.manche?.no ?? 1}`], loop: false, volume: STING };
    case "GAME_ACTIVE": {
      if (!g) return null;
      if (g.kind === "caos") return g.stage === "rule" ? { names: ["allarme-caos"], loop: false, volume: STING } : { names: ["duello-caos", "prova"], loop: true, volume: BED };
      if (g.kind === "tiebreak") return { names: ["duello-caos", "prova"], loop: true, volume: BED };
      const own = gameTrack(g.code);
      const names = own ? [own] : [];
      if (!NO_GENERIC_BED.has(g.code)) names.push("prova");
      return { names, loop: true, volume: g.code === "rumore-di-fondo" ? 0.25 : BED };
    }
    case "GAME_RESULTS":
      return s.spotlight?.kind === "evolve" ? { names: ["evoluzione", "reveal"], loop: false, volume: STING } : { names: ["reveal"], loop: false, volume: STING };
    case "LEADERBOARD":
      return { names: ["classifica"], loop: true, volume: BED };
    case "BREAK":
      return { names: ["pausa", "lobby"], loop: true, volume: BED };
    case "FINAL":
      return { names: ["finale"], loop: true, volume: BED };
    case "AWARDS":
      return { names: ["premiazione", "sigla"], loop: true, volume: 0.75 };
    case "COMPLETED":
      return { names: ["saluti", "sigla-strumentale", "sigla"], loop: false, volume: 0.7 };
    default:
      return null;
  }
}

/** Primo brano presente della catena. */
export function availableTrack(cue: MusicCue | null, files: readonly string[] = TIG_MUSIC_FILES): string | null {
  if (!cue) return null;
  return cue.names.find((n) => files.includes(n)) ?? null;
}

const urlOf = (name: string) => `/audio/tig/musica/${encodeURIComponent(name)}.mp3`;

/** Collega la musica allo stato della serata (solo la TV). In pausa la musica scende molto, senza fermarsi. */
export function useTigMusic(state: TigPublicState | null, enabled: boolean) {
  const last = useRef<string>("");
  useEffect(() => {
    if (!enabled || !state || TIG_MUSIC_FILES.length === 0) return;
    const cue = musicFor(state);
    const track = availableTrack(cue);
    const paused = state.state === "PAUSED";
    // stessa fase = stesso brano: non si riparte da capo a ogni aggiornamento dello stato
    const key = `${track ?? "-"}|${state.state === "PAUSED" ? state.pausedFrom : state.state}|${state.game?.id ?? ""}|${state.game?.stage ?? ""}|${state.manche?.no ?? ""}|${paused ? "p" : ""}`;
    if (key === last.current) return;
    const prevTrack = last.current.split("|")[0];
    last.current = key;
    const engine = getSoundEngine();
    if (!track || !cue) {
      engine.stopTheme(900);
      return;
    }
    const restart = !cue.loop && prevTrack !== track ? 0 : undefined;
    engine.playTheme({ url: urlOf(track), loop: cue.loop, volume: paused ? cue.volume * 0.25 : cue.volume, fadeMs: 900, from: restart });
  }, [state, enabled]);
  useEffect(() => () => getSoundEngine().stopTheme(600), []);
}
