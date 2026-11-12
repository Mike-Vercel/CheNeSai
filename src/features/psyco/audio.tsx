"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { countdownMs, remainingMs } from "@/lib/psyco/logic";
import type { PsycoPublicState } from "@/lib/psyco/types";
import { getAudioPrefs, setAudioPrefs, subscribeAudioPrefs, type AudioPrefs } from "./audio-prefs";
import { cuesFor, getNarrator, startCues, timerWarning } from "./narrator";

/**
 * Audio di PSYCO: colonna sonora, voce narrante (narrator.ts) ed effetti, tutti col motore audio del
 * sito (Web Audio, sbloccato al primo tocco come nel quiz).
 *
 * Regola dei dispositivi (niente doppioni nella stessa stanza):
 *  - `voiced` = schermo TV/PC pubblico, dispositivo condiviso, oppure telefono di chi gestisce la
 *    partita quando NESSUNO schermo TV è collegato: qui suonano musica e voce;
 *  - gli altri telefoni personali: niente musica né voce (si possono accendere a mano dal pannello
 *    Audio), solo effetti brevi;
 *  - musica: in sala d'attesa, ruoli, scelta della regola e fine manche, in loop a volume basso;
 *    durante la manche giocata (e la verifica) scende quasi a zero per lasciar parlare; si abbassa
 *    da sola quando parla il narratore.
 */
const THEME = "/audio/psyco/tema.mp3";
const MUSIC_VOLUME = 0.4;
const MUSIC_VOLUME_PLAYING = 0.05;

export function useAudioPrefs(): AudioPrefs {
  const [p, setP] = useState<AudioPrefs>({ music: null, voice: true, sfx: true, volume: 0.9 });
  useEffect(() => {
    const t = setTimeout(() => setP(getAudioPrefs()), 0);
    const off = subscribeAudioPrefs(setP);
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);
  return p;
}

export function usePsycoAudio(state: PsycoPublicState | null, now: () => number, opts: { voiced: boolean }) {
  const prefs = useAudioPrefs();
  const narrate = opts.voiced; // la voce si spegne dal pannello (letto dal narratore)
  const music = prefs.music ?? opts.voiced;
  const sfx = prefs.sfx;
  const prev = useRef<PsycoPublicState | null>(null);
  const said = useRef(new Set<string>());
  const started = useRef<string | null>(null);
  const lastTick = useRef<number>(-1);

  // sblocco dell'audio al primo tocco (regola dei browser), volume, precaricamento della voce
  useEffect(() => {
    const engine = getSoundEngine();
    const unlock = () => void engine.unlock().then((ok) => ok && engine.preloadSfx());
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    if (narrate) getNarrator().preload();
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [narrate]);

  useEffect(() => {
    getSoundEngine().setSettings({ masterVolume: prefs.volume, sfxVolume: prefs.sfx ? 0.9 : 0 });
  }, [prefs.volume, prefs.sfx]);

  useEffect(
    () => () => {
      getNarrator().stop();
      getSoundEngine().stopTheme(600);
    },
    [],
  );

  // colonna sonora secondo la fase
  const phase = state?.phase ?? null;
  const closed = state?.status === "closed";
  useEffect(() => {
    const e = getSoundEngine();
    if (!music || !phase || closed) {
      e.stopTheme(1200);
      return;
    }
    const quiet = phase === "PLAYING" || phase === "GUESS_VOTE";
    const play = () => e.playTheme({ url: THEME, loop: true, volume: quiet ? MUSIC_VOLUME_PLAYING : MUSIC_VOLUME, fadeMs: quiet ? 2500 : 1500 });
    if (e.unlocked) play();
    // audio ancora bloccato: parte al primo tocco
    const onTouch = () => void e.unlock().then((ok) => ok && play());
    window.addEventListener("pointerdown", onTouch, { once: true });
    return () => window.removeEventListener("pointerdown", onTouch);
  }, [music, phase, closed]);

  // momenti del gioco: voce ed effetti
  useEffect(() => {
    if (!state) return;
    const p = prev.current;
    prev.current = state;
    if (p && p.version === state.version && p.roomId === state.roomId) return;
    if (narrate) getNarrator().say(cuesFor(p, state));
    if (!sfx || !p) return;
    const e = getSoundEngine();
    const phaseChanged = p.phase !== state.phase || p.round?.no !== state.round?.no;
    if (phaseChanged) {
      if (state.phase === "ROLE_REVEAL") e.play("whoosh");
      else if (state.phase === "RULE_CONFIRMED") e.play("reveal");
      else if (state.phase === "GUESS_VOTE") e.play("drumroll");
      else if (state.phase === "ROUND_END") {
        if (state.round?.outcome === "guessed") {
          e.play("victory");
          e.applause("big");
        } else if (state.round?.outcome === "time_up") e.play("brake");
        else e.play("voteResult");
      } else if (state.phase === "PLAYING" && p.phase === "GUESS_VOTE") e.play("wrong");
      else if (["DIFFICULTY_VOTE", "RULE_VOTE", "RULE_PROPOSALS", "PROPOSAL_VOTE"].includes(state.phase)) e.play("roundStart");
    } else if ((state.round?.vote?.voted.length ?? 0) > (p.round?.vote?.voted.length ?? 0)) {
      e.play("vote");
    } else if (state.activeCount > p.activeCount && state.phase === "LOBBY") {
      e.play("join");
    }
  }, [state, narrate, sfx]);

  // conto alla rovescia, via, avvisi del timer, tic-tac finale
  useEffect(() => {
    if (!state || state.phase !== "PLAYING" || !state.round?.timer.startedAt) return;
    const id = setInterval(() => {
      const s = prev.current;
      if (!s || s.phase !== "PLAYING" || !s.round?.timer.startedAt) return;
      const t = now();
      const cd = countdownMs(s.round.timer, t);
      const key = `${s.roomId}:${s.round.no}`;
      if (cd > 0) {
        const sec = Math.ceil(cd / 1000);
        if (sfx && sec !== lastTick.current && sec <= 3) getSoundEngine().play("countdownBeep");
        lastTick.current = sec;
        return;
      }
      if (started.current !== key) {
        started.current = key;
        // al via solo se è appena partito (non dopo un ricaricamento a metà manche)
        if (t - Date.parse(s.round.timer.startedAt) < 4000) {
          if (sfx) getSoundEngine().play("countdownGo");
          if (narrate) getNarrator().say(startCues(s));
        }
      }
      if (narrate) {
        const w = timerWarning(s, t, said.current);
        if (w) getNarrator().say([w]);
      }
      const left = remainingMs(s.round.timer, t);
      if (sfx && left !== null && !s.round.timer.pausedAt && left > 0 && left <= 10_000) {
        const sec = Math.ceil(left / 1000);
        if (sec !== lastTick.current) {
          lastTick.current = sec;
          getSoundEngine().play(sec <= 3 ? "tickFinal" : "tick");
        }
      }
    }, 200);
    return () => clearInterval(id);
  }, [state, now, narrate, sfx]);
}

/** Sottotitolo del narratore (anche quando il clip manca o l'audio è spento). */
export function Captions({ className, position = "top" }: { className?: string; position?: "top" | "bottom" }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => getNarrator().onCaption(setText), []);
  if (!text) return null;
  return (
    <div
      aria-live="polite"
      className={clsx(
        "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4",
        // sui telefoni in alto, sotto la barra: non copre mai i pulsanti
        position === "top" ? "top-[calc(4.75rem+env(safe-area-inset-top))] md:top-[calc(5.75rem+env(safe-area-inset-top))]" : "bottom-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <p className="psy-type psy-caption max-w-3xl rounded-xl px-4 py-2 text-center text-base text-paper md:text-xl">{text}</p>
    </div>
  );
}

/** Pannello Audio: tutto (muto), musica, voce, effetti, volume. */
export function AudioPanel({ voiced, className }: { voiced: boolean; className?: string }) {
  const prefs = useAudioPrefs();
  const [muted, setMuted] = useState(false);
  useEffect(() => getSoundEngine().subscribe((s) => setMuted(s.settings.muted)), []);
  const musicOn = prefs.music ?? voiced;
  const row = (label: string, on: boolean, toggle: () => void) => (
    <button type="button" role="switch" aria-checked={on} onClick={toggle} className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left font-bold hover:bg-white/8">
      <span>{label}</span>
      <span className={clsx("relative h-6 w-11 rounded-full transition", on ? "bg-blood" : "bg-white/20")}>
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[1.4rem]" : "left-0.5")} />
      </span>
    </button>
  );
  return (
    <details className={clsx("relative", className)}>
      <summary className="psy-chip cursor-pointer list-none [&::-webkit-details-marker]:hidden" aria-label="Audio">
        <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
        <span className="hidden sm:inline">Audio</span>
      </summary>
      <div className="psy-panel absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl p-2 text-paper">
        {row("Audio attivo", !muted, () => {
          const e = getSoundEngine();
          void e.unlock();
          e.setSettings({ muted: !muted });
          if (!muted) getNarrator().stop();
        })}
        {row("Musica", musicOn, () => setAudioPrefs({ music: !musicOn }))}
        {row("Voce narrante", prefs.voice, () => {
          setAudioPrefs({ voice: !prefs.voice });
          if (prefs.voice) getNarrator().stop();
        })}
        {row("Effetti sonori", prefs.sfx, () => setAudioPrefs({ sfx: !prefs.sfx }))}
        <label className="flex flex-col gap-1 px-3 py-2.5 font-bold">
          <span>Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => setAudioPrefs({ volume: Number(e.target.value) })} className="accent-[#e0161f]" />
        </label>
        {!voiced && <p className="px-3 pb-2 text-xs font-bold text-paper/60">Musica e voce suonano sullo schermo TV (o sul telefono di chi gestisce la partita): qui sono spente, ma puoi accenderle.</p>}
      </div>
    </details>
  );
}
