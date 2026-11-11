"use client";

import { clsx } from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { OpenTvButton } from "@/features/display/TvScreenControls";
import { fullscreenOn, hasMultipleScreens, loadScreens, saveScreenChoice, screenApiSupported, screenPermission, type ScreenInfo } from "@/features/display/screen-picker";
import { useTvPrefs } from "@/features/display/tv-prefs";
import type { PublicState } from "@/lib/game-engine/types";
import { api } from "@/lib/realtime/api-client";
import { useHostCommand } from "./use-host-command";
import { voicePrepLabel, type VoicePrep } from "./use-voice-prep";

/**
 * Impostazioni dell'host del gioco libero, a sezioni: le stesse nel foglio dell'icona a ingranaggio
 * del TV e nel pannello dell'host sull'altro schermo.
 */

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("border-t border-white/10 pt-4 first:border-t-0 first:pt-0", className)} aria-label={title}>
      <h3 className="mb-2.5 text-xs font-black uppercase tracking-[0.14em] text-white/55">{title}</h3>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-1 py-0.5">
      <span>
        <span className="block text-[15px] font-bold text-white">{label}</span>
        {hint && <span className="block text-xs font-semibold text-white/55">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-white/15 transition peer-checked:bg-gold peer-focus-visible:ring-2 peer-focus-visible:ring-white" />
        <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-checked:bg-ink" />
      </span>
    </label>
  );
}

export function Slider({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className={clsx("flex items-center gap-3 px-1", disabled && "opacity-40")}>
      <span className="w-28 shrink-0 text-[15px] font-bold text-white">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[#ffd43b]"
        aria-valuetext={`${Math.round(value * 100)}%`}
      />
      <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums text-white/70">{Math.round(value * 100)}</span>
    </label>
  );
}

export const btn = "rounded-full px-4 py-2.5 text-[15px] font-black transition active:scale-[0.97] disabled:opacity-40";
export const btnSoft = clsx(btn, "bg-white/10 text-white hover:bg-white/20");
export const btnGold = clsx(btn, "bg-gold text-ink hover:bg-white");

// ---------------------------------------------------------------------------
// Schermo
// ---------------------------------------------------------------------------
/** Nel TV: schermo intero sì/no e "sposta il TV" su un altro schermo collegato. */
export function TvScreenSettings() {
  const [fs, setFs] = useState(false);
  const [screens, setScreens] = useState<ScreenInfo[] | null>(null);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const sync = () => setFs(!!document.fullscreenElement);
    const t = setTimeout(() => {
      sync();
      setSupported(screenApiSupported());
      void screenPermission().then(async (p) => {
        if (p === "granted" || hasMultipleScreens()) setScreens((await loadScreens())?.screens ?? null);
      });
    }, 0);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      clearTimeout(t);
      document.removeEventListener("fullscreenchange", sync);
    };
  }, []);
  async function toggleFs(v: boolean) {
    try {
      if (v) await document.documentElement.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* non consentito */
    }
  }
  return (
    <>
      <Switch checked={fs} onChange={(v) => void toggleFs(v)} label="Schermo intero" hint="Anche con F11" />
      {screens && screens.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <p className="px-1 text-sm font-bold text-white/70">Sposta il TV su</p>
          {screens.map((s) => (
            <button
              key={s.key}
              type="button"
              className="rounded-xl bg-white/8 px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/15"
              onClick={() => {
                saveScreenChoice(s.key);
                void fullscreenOn(s.key);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : supported ? (
        <button type="button" className={clsx(btnSoft, "w-fit text-sm")} onClick={() => void loadScreens().then((r) => setScreens(r?.screens ?? []))}>
          🖥 Collega un altro schermo
        </button>
      ) : (
        <p className="px-1 text-sm font-semibold text-white/60">Per usare il televisore: trascina questa finestra sul TV e premi F11.</p>
      )}
      {screens && screens.length <= 1 && <p className="px-1 text-sm font-semibold text-white/60">Un solo schermo collegato: collega il TV con HDMI in modalità «Estendi».</p>}
    </>
  );
}

/** Nel pannello dell'host: apri, riapri o sposta il TV sull'altro schermo. */
export function PanelScreenSettings({ sessionId, tvAudio }: { sessionId: string; tvAudio: boolean | null }) {
  return (
    <>
      <OpenTvButton url={`/gioca/tv/${sessionId}`} sessionId={sessionId} />
      {tvAudio === false && <p className="rounded-xl bg-flame/20 px-3 py-2 text-sm font-bold text-[#ffd0d9]">Audio del TV non attivo: clicca una volta sullo schermo del TV.</p>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
export function AudioSettings({ onTestVoices }: { onTestVoices?: () => void }) {
  const [p, set] = useTvPrefs();
  return (
    <>
      <Slider label="Volume" value={p.masterVolume} onChange={(v) => set({ masterVolume: v, muted: v === 0 ? p.muted : false })} />
      <Switch checked={p.theme} onChange={(v) => set({ theme: v })} label="Musica" hint="Sigla in lobby, classifiche e podio" />
      <Slider label="Volume musica" value={p.musicVolume} onChange={(v) => set({ musicVolume: v })} disabled={!p.theme} />
      <Slider label="Effetti" value={p.sfxVolume} onChange={(v) => set({ sfxVolume: v })} />
      <Switch checked={p.voice} onChange={(v) => set({ voice: v })} label="Voce dei presentatori" />
      <Switch checked={p.readOptions} onChange={(v) => set({ readOptions: v })} label="Legge anche le risposte" />
      <Switch checked={p.muted} onChange={(v) => set({ muted: v })} label="Tutto muto" />
      <Switch
        checked={p.browserVoice}
        onChange={(v) => set({ browserVoice: v })}
        label="Voce del browser di riserva"
        hint="Solo se la voce professionale è spenta sul sito; altrimenti le battute compaiono come sottotitoli"
      />
      {onTestVoices && (
        <button type="button" className={clsx(btnSoft, "w-fit text-sm")} onClick={onTestVoices}>
          🔊 Prova le voci
        </button>
      )}
    </>
  );
}

/** Opzioni del TV meno usate (PC lenti, animazioni). */
export function DisplaySettings() {
  const [p, set] = useTvPrefs();
  return (
    <>
      <Switch checked={p.rules} onChange={(v) => set({ rules: v })} label="Spiega le regole nell'intro" />
      <Switch checked={p.characters3d} onChange={(v) => set({ characters3d: v })} label="Personaggi 3D" hint="Spegni sui PC lenti (2D)" />
      <Switch checked={p.lowPower} onChange={(v) => set({ lowPower: v })} label="Prestazioni ridotte" />
      <Switch checked={p.reducedMotion} onChange={(v) => set({ reducedMotion: v })} label="Movimento ridotto" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Giocatori e scorrimento (GET /api/gioca/games/[id]/players, solo il proprietario)
// ---------------------------------------------------------------------------
export interface HostStatus {
  players: { id: string; nickname: string; points: number }[];
  autoplay: boolean;
}

export function useHostStatus(sessionId: string, state: PublicState | null): [HostStatus | null, () => void] {
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = state ? `${state.playerCount}:${state.phase}` : "";
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const t = setTimeout(() => {
      api<HostStatus>(`/api/gioca/games/${sessionId}/players`)
        .then((r) => alive && setStatus(r))
        .catch(() => undefined);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [sessionId, key, nonce]);
  return [status, () => setNonce((n) => n + 1)];
}

export function PlayersSettings({ sessionId, status, onChanged }: { sessionId: string; status: HostStatus | null; onChanged: () => void }) {
  const { run, busy, error } = useHostCommand(sessionId);
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!status) return <p className="px-1 text-sm font-semibold text-white/60">Caricamento…</p>;
  if (status.players.length === 0) return <p className="px-1 text-sm font-semibold text-white/60">Nessun giocatore ancora: inquadrate il QR.</p>;
  return (
    <>
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1" aria-label="Giocatori">
        {status.players.map((pl) => (
          <li key={pl.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/6 px-3 py-1.5">
            <span className="min-w-0 truncate text-[15px] font-bold">{pl.nickname}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-bold tabular-nums text-white/60">{pl.points} pt</span>
              {confirm === pl.id ? (
                <>
                  <button
                    type="button"
                    disabled={!!busy}
                    className="rounded-full bg-flame px-3 py-1 text-xs font-black text-white"
                    onClick={() => void run("kick", { participantId: pl.id }).then((ok) => ok && (setConfirm(null), onChanged()))}
                  >
                    Espelli
                  </button>
                  <button type="button" className="rounded-full px-2 py-1 text-xs font-bold text-white/70" onClick={() => setConfirm(null)}>
                    No
                  </button>
                </>
              ) : (
                <button type="button" aria-label={`Espelli ${pl.nickname}`} className="rounded-full px-2 py-1 text-xs font-bold text-white/55 hover:bg-white/10 hover:text-white" onClick={() => setConfirm(pl.id)}>
                  ✕
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm font-bold text-[#ffb3c1]">{error}</p>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Partita: pausa, avanti, termina, scorrimento
// ---------------------------------------------------------------------------
const NEXT_PHASES: readonly string[] = ["INTRO", "ROUND_INTRO", "CATEGORY_RESULT", "WHEEL_SPIN", "SPECIAL_EVENT", "QUESTION_VISIBLE", "ANSWERS_LOCKED", "ANSWER_REVEAL", "SCORE_REVEAL", "LEADERBOARD", "OPTIONS_VISIBLE", "CATEGORY_VOTING"];

export function GameSettings({ sessionId, state, status, onChanged }: { sessionId: string; state: PublicState | null; status: HostStatus | null; onChanged: () => void }) {
  const { run, busy, error } = useHostCommand(sessionId);
  const [confirmEnd, setConfirmEnd] = useState(false);
  if (!state) return null;
  const phase = state.phase;
  const playing = phase !== "READY" && phase !== "LOBBY" && phase !== "FINISHED";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {phase === "PAUSED" ? (
          <button type="button" className={btnGold} disabled={!!busy} onClick={() => void run("resume")}>
            ▶ Riprendi
          </button>
        ) : (
          playing && (
            <button type="button" className={btnSoft} disabled={!!busy} onClick={() => void run("pause")}>
              ❚❚ Pausa
            </button>
          )
        )}
        {NEXT_PHASES.includes(phase) && (
          <button type="button" className={btnSoft} disabled={!!busy} onClick={() => void run("next")} title="Salta al passo successivo (mai a tempo di risposta in corso)">
            ⏭ Avanti
          </button>
        )}
        {phase !== "FINISHED" && !confirmEnd && (
          <button type="button" className={clsx(btnSoft, "text-white/80")} disabled={!!busy} onClick={() => setConfirmEnd(true)}>
            Termina partita
          </button>
        )}
      </div>
      {confirmEnd && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-flame/20 px-3 py-2">
          <span className="text-sm font-bold">Chiudere la partita e mostrare il podio?</span>
          <button type="button" className="rounded-full bg-flame px-4 py-1.5 text-sm font-black text-white" disabled={!!busy} onClick={() => void run("finish").then(() => setConfirmEnd(false))}>
            Sì, termina
          </button>
          <button type="button" className="rounded-full px-3 py-1.5 text-sm font-bold text-white/80" onClick={() => setConfirmEnd(false)}>
            No
          </button>
        </div>
      )}
      {phase !== "FINISHED" && (
        <div className="flex items-center justify-between gap-3 px-1">
          <span>
            <span className="block text-[15px] font-bold">Scorrimento</span>
            <span className="block text-xs font-semibold text-white/55">{status?.autoplay === false ? "Manuale: vai avanti tu con «Avanti»" : "Automatico: la partita va avanti da sola"}</span>
          </span>
          <div role="radiogroup" aria-label="Scorrimento" className="flex shrink-0 rounded-full bg-white/10 p-1">
            {(
              [
                [true, "Auto"],
                [false, "Manuale"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={status?.autoplay === v}
                disabled={!status || !!busy}
                onClick={() => void run("auto", { autoplay: v }).then((ok) => ok && onChanged())}
                className={clsx("rounded-full px-3 py-1 text-sm font-black transition", status?.autoplay === v ? "bg-gold text-ink" : "text-white/75 hover:text-white")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-bold text-[#ffb3c1]">{error}</p>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Voci della serata
// ---------------------------------------------------------------------------
export function VoicesProgress({ prep, compact }: { prep: VoicePrep | null; compact?: boolean }) {
  const label = voicePrepLabel(prep);
  if (!prep || !label) return compact ? null : <p className="px-1 text-sm font-semibold text-white/60">Voce del browser (voce professionale non attiva).</p>;
  const pct = prep.total > 0 ? Math.round((prep.ready / prep.total) * 100) : 0;
  const done = prep.missing === 0;
  if (compact) {
    return (
      <span className={clsx("inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-xs font-bold backdrop-blur", done ? "text-[#7dffbc]" : "text-white/80")} role="status" aria-live="polite">
        {!done && <span className="h-1.5 w-12 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></span>}
        {label}
      </span>
    );
  }
  return (
    <div role="status" aria-live="polite" className="px-1">
      <div className="mb-1.5 flex items-center justify-between text-sm font-bold">
        <span className={done ? "text-[#7dffbc]" : "text-white"}>{label}</span>
        {!done && <span className="tabular-nums text-white/60">{pct}%</span>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {prep.status === "blocked" && <p className="mt-1.5 text-xs font-semibold text-[#ffc2cd]">Budget mensile delle voci esaurito: le battute mancanti useranno la voce del browser.</p>}
      {prep.status === "error" && <p className="mt-1.5 text-xs font-semibold text-[#ffc2cd]">Alcune voci non si preparano: quelle mancanti si genereranno durante il gioco.</p>}
    </div>
  );
}
