"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { estimateMinutes } from "@/lib/giramente/rules";
import { DEFAULT_SETTINGS, MAX_PLAYERS, MAX_TEAM_MEMBERS, MAX_TEAMS, type Difficulty, type Settings } from "@/lib/giramente/types";
import { api, ApiError } from "@/lib/realtime/api-client";
import { introPlayedHere, markRoomWelcomed } from "./intro/flags";

/**
 * NUOVA PARTITA: modalità (individuale / a squadre), dispositivi (uno a testa / uno solo), difficoltà,
 * durata stimata realistica, 5 manche, nomi. Crea la partita sul server e porta nella sala.
 */
const DIFFS: { id: Difficulty; label: string }[] = [
  { id: "facile", label: "Facile" },
  { id: "media", label: "Media" },
  { id: "difficile", label: "Difficile" },
];

export function CreateFlow({ username, initialMode = "individual", initialAdvanced = false }: { username: string | null; initialMode?: "individual" | "teams"; initialAdvanced?: boolean }) {
  const [mode, setMode] = useState<"individual" | "teams">(initialMode);
  const [devices, setDevices] = useState<"personal" | "shared">("personal");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hostNickname, setHostNickname] = useState(username ?? "");
  const [players, setPlayers] = useState<string[]>(["", "", ""]);
  const [teams, setTeams] = useState<{ name: string; members: string[] }[]>([
    { name: "Squadra Verde", members: ["", ""] },
    { name: "Squadra Rossa", members: ["", ""] },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(initialAdvanced);

  const count = mode === "teams" ? teams.filter((t) => t.name.trim()).length : devices === "shared" ? players.filter((p) => p.trim()).length : 4;
  const est = estimateMinutes(Math.max(2, count), devices, mode, settings);
  const diffIndex = DIFFS.findIndex((d) => d.id === settings.difficulty);
  const setDiff = (delta: number) => setSettings((s) => ({ ...s, difficulty: DIFFS[(diffIndex + delta + DIFFS.length) % DIFFS.length].id }));

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ roomId: string; devices: "personal" | "shared" }>("/api/giramente/rooms", {
        method: "POST",
        json: {
          devices,
          mode,
          settings,
          hostNickname: devices === "personal" ? hostNickname : undefined,
          players: mode === "individual" && devices === "shared" ? players : undefined,
          teams: mode === "teams" ? teams.map((t) => ({ name: t.name, members: devices === "shared" ? t.members : undefined })) : undefined,
        },
      });
      // l'intro di questa pagina ha già dato il benvenuto: la sala d'attesa non lo ripete
      if (introPlayedHere()) markRoomWelcomed(r.roomId);
      window.location.assign(r.devices === "shared" ? `/giramente/un-dispositivo/${r.roomId}` : `/giramente/stanza/${r.roomId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Non riesco a creare la partita: riprova");
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5">
      <h1 className="gm-display text-center text-4xl sm:text-5xl">MODALITÀ DI GIOCO</h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {(
          [
            { id: "individual", icon: "👤", title: "INDIVIDUALE", sub: `Da 2 a ${MAX_PLAYERS} giocatori` },
            { id: "teams", icon: "👥", title: "A SQUADRE", sub: `Da 2 a ${MAX_TEAMS} squadre` },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={clsx("gm-panel relative flex flex-col items-center gap-1 rounded-3xl px-2 py-5 transition", m.id === "individual" ? "gm-panel-green" : "gm-panel-red", mode !== m.id && "opacity-60 saturate-50")}
          >
            {mode === m.id && <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-[#39ff14] text-sm font-black text-black">✓</span>}
            <span aria-hidden className="text-4xl">{m.icon}</span>
            <span className="gm-display text-2xl sm:text-3xl">{m.title}</span>
            <span className="text-sm font-bold text-white/85">{m.sub}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { id: "personal", title: "📱📱 Un telefono a testa", sub: "Ognuno entra col proprio account (codice o QR)" },
            { id: "shared", title: "📱 Un solo telefono", sub: "Il tuo account, gli altri si aggiungono col nome" },
          ] as const
        ).map((d) => (
          <button key={d.id} type="button" aria-pressed={devices === d.id} onClick={() => setDevices(d.id)} className={clsx("gm-panel rounded-2xl p-3 text-left transition", devices === d.id ? "gm-panel-green" : "opacity-70")}>
            <span className="block font-black">{d.title}</span>
            <span className="text-xs font-bold text-white/75">{d.sub}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stepper label="Difficoltà" value={DIFFS[diffIndex].label} onPrev={() => setDiff(-1)} onNext={() => setDiff(1)} />
        <div className="gm-panel flex flex-col items-center rounded-2xl px-2 py-2 text-center">
          <span className="text-xs font-black uppercase tracking-wide text-white/70">Durata stimata</span>
          <span className="gm-display text-xl sm:text-2xl" aria-live="polite">
            {est.min}–{est.max} min
          </span>
        </div>
        <div className="gm-panel flex flex-col items-center rounded-2xl px-2 py-2 text-center">
          <span className="text-xs font-black uppercase tracking-wide text-white/70">Manche</span>
          <span className="gm-display text-xl sm:text-2xl">5 manche</span>
        </div>
      </div>
      <p className="-mt-2 text-center text-xs font-bold text-white/60">
        La durata cresce con i concorrenti{devices === "shared" ? " e con un solo telefono le prove si fanno a turno" : ""}.
      </p>

      {/* nomi */}
      <section className="gm-panel flex flex-col gap-3 rounded-3xl p-4">
        {devices === "personal" && (
          <label className="flex flex-col gap-1 font-bold">
            Il tuo nome in partita
            <input className="gm-input" value={hostNickname} onChange={(e) => setHostNickname(e.target.value)} maxLength={20} placeholder="Es. Sara" />
          </label>
        )}
        {mode === "individual" && devices === "shared" && (
          <>
            <p className="font-black">Giocatori (2–{MAX_PLAYERS})</p>
            {players.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input className="gm-input" value={p} maxLength={20} placeholder={`Giocatore ${i + 1}`} aria-label={`Giocatore ${i + 1}`} onChange={(e) => setPlayers((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                {players.length > 2 && (
                  <button type="button" className="gm-chip" aria-label="Togli" onClick={() => setPlayers((l) => l.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {players.length < MAX_PLAYERS && (
              <button type="button" className="gm-chip self-start" onClick={() => setPlayers((l) => [...l, ""])}>
                + Aggiungi giocatore
              </button>
            )}
          </>
        )}
        {mode === "teams" && (
          <>
            <p className="font-black">Squadre (2–{MAX_TEAMS}){devices === "shared" ? `, 2–${MAX_TEAM_MEMBERS} componenti ciascuna: il primo è il capitano` : ": i giocatori sceglieranno la squadra entrando"}</p>
            {teams.map((t, i) => (
              <div key={i} className="rounded-2xl border border-white/12 bg-black/35 p-3">
                <div className="flex gap-2">
                  <input className="gm-input" value={t.name} maxLength={20} aria-label={`Nome squadra ${i + 1}`} onChange={(e) => setTeams((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  {teams.length > 2 && (
                    <button type="button" className="gm-chip" aria-label="Togli squadra" onClick={() => setTeams((l) => l.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  )}
                </div>
                {devices === "shared" && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {t.members.map((m, k) => (
                      <input
                        key={k}
                        className="gm-input min-h-11 text-base"
                        value={m}
                        maxLength={20}
                        placeholder={k === 0 ? "Capitano" : `Componente ${k + 1}`}
                        aria-label={`Squadra ${i + 1}, componente ${k + 1}`}
                        onChange={(e) => setTeams((l) => l.map((x, j) => (j === i ? { ...x, members: x.members.map((y, h) => (h === k ? e.target.value : y)) } : x)))}
                      />
                    ))}
                    {t.members.length < MAX_TEAM_MEMBERS && (
                      <button type="button" className="gm-chip self-center" onClick={() => setTeams((l) => l.map((x, j) => (j === i ? { ...x, members: [...x.members, ""] } : x)))}>
                        + Componente
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {teams.length < MAX_TEAMS && (
              <button type="button" className="gm-chip self-start" onClick={() => setTeams((l) => [...l, { name: `Squadra ${l.length + 1}`, members: ["", ""] }])}>
                + Aggiungi squadra
              </button>
            )}
          </>
        )}
      </section>

      <details className="gm-panel rounded-3xl p-4" open={advanced} onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer font-black">⚙ Impostazioni (tempi e introduzioni)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField label="Secondi per rispondere (manche 1 e 3)" value={settings.answerSec} min={15} max={90} onChange={(v) => setSettings((s) => ({ ...s, answerSec: v }))} />
          <NumberField label="Sfida lampo (Colpo di scena)" value={settings.lampoSec} min={8} max={30} onChange={(v) => setSettings((s) => ({ ...s, lampoSec: v }))} />
          <NumberField label="La Falsa Pista (due enigmi)" value={settings.falsaSec} min={45} max={240} onChange={(v) => setSettings((s) => ({ ...s, falsaSec: v }))} />
          <NumberField label="Il Collegamento" value={settings.collegamentoSec} min={20} max={120} onChange={(v) => setSettings((s) => ({ ...s, collegamentoSec: v }))} />
          <NumberField label="Il Tabellone Segreto" value={settings.tabelloneSec} min={30} max={120} onChange={(v) => setSettings((s) => ({ ...s, tabelloneSec: v }))} />
          <NumberField label="Il Giro Decisivo" value={settings.finaleSec} min={20} max={120} onChange={(v) => setSettings((s) => ({ ...s, finaleSec: v }))} />
          <label className="flex items-center gap-2 font-bold sm:col-span-2">
            <input type="checkbox" checked={settings.quickIntros} onChange={(e) => setSettings((s) => ({ ...s, quickIntros: e.target.checked }))} className="h-5 w-5 accent-[#39ff14]" />
            Introduzioni brevi (partita più veloce)
          </label>
        </div>
      </details>

      {error && (
        <p role="alert" className="gm-panel gm-panel-red rounded-2xl px-4 py-3 text-center font-bold">
          {error}
        </p>
      )}
      <button type="button" className="gm-btn h-16 text-3xl" disabled={busy} onClick={() => void create()}>
        ▶ INIZIA PARTITA
      </button>
    </div>
  );
}

function Stepper({ label, value, onPrev, onNext }: { label: string; value: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="gm-panel flex flex-col items-center rounded-2xl px-1 py-2 text-center">
      <span className="text-xs font-black uppercase tracking-wide text-white/70">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onPrev} aria-label={`${label}: precedente`} className="grid h-8 w-8 place-items-center rounded-full text-xl text-[#39ff14] hover:bg-white/10">
          ‹
        </button>
        <span className="gm-display min-w-[4.5rem] text-xl sm:text-2xl">{value}</span>
        <button type="button" onClick={onNext} aria-label={`${label}: successiva`} className="grid h-8 w-8 place-items-center rounded-full text-xl text-[#39ff14] hover:bg-white/10">
          ›
        </button>
      </div>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm font-bold">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input type="number" className="gm-input min-h-10 w-20 text-center text-base" value={value} min={min} max={max} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />
        <span className="text-white/60">s</span>
      </span>
    </label>
  );
}
