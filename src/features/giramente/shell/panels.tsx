"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { MAX_PLAYERS, MAX_TEAMS } from "@/lib/giramente/types";
import { api, ApiError } from "@/lib/realtime/api-client";
import { savePrefs, useAudioPrefs, type AudioPrefs } from "../audio";
import { loadQualityPref, saveQualityPref, type QualityPref } from "../three/quality";
import { Logo } from "../ui";
import { KeyHints, MenuList, PanelFrame, uiSound, type MenuItem } from "./menu-ui";
import { roomHref, type ShellRoom } from "./shell-rooms";

const roomInfo = (r: ShellRoom) => `${r.devices === "shared" ? "un solo telefono" : `${r.players} concorrenti`} · ${r.roundNo > 0 ? `manche ${r.roundNo}` : r.phase === "LOBBY" ? "in sala d'attesa" : "in corso"}`;

// ---------------------------------------------------------------------------
// Menu principale
// ---------------------------------------------------------------------------
export function MainMenu({ rooms, onSelect, onActive, loggedIn }: { rooms: ShellRoom[]; onSelect: (id: string) => void; onActive?: (id: string) => void; loggedIn: boolean }) {
  const items: MenuItem[] = [
    ...(rooms.length ? [{ id: "riprendi", label: "RIPRENDI", sub: rooms.length === 1 ? `Torna alla partita ${rooms[0].code}: ${roomInfo(rooms[0])}` : `${rooms.length} partite aperte`, badge: rooms.length === 1 ? rooms[0].code : undefined }] : []),
    { id: "nuova", label: "NUOVA PARTITA", sub: loggedIn ? "Individuale o a squadre, uno o più telefoni" : "Serve un account: accedi e si parte" },
    { id: "entra", label: "ENTRA CON UN CODICE", sub: "Un amico ha creato la partita? Inserisci il codice", tone: "red" },
    { id: "modalita", label: "MODALITÀ DI GIOCO", sub: "Come si gioca: da soli, a squadre, col televisore" },
    { id: "impostazioni", label: "IMPOSTAZIONI", sub: "Musica, voci, effetti e grafica" },
    { id: "regolamento", label: "REGOLAMENTO", sub: "Le 5 manche, la ruota, i Jolly di Zafira" },
  ];
  return (
    <section aria-label="Menu di GIRAMENTE!" className="gm-pop flex w-full flex-col gap-[clamp(0.75rem,2.6vh,1.75rem)]">
      <div className="flex flex-col items-start gap-1 px-5">
        <Logo size="lg" tagline className="!items-start [&_.gm-logo]:text-[clamp(3rem,min(6.2vw,11vh),5.5rem)]" />
      </div>
      <MenuList label="Menu principale" items={items} onSelect={onSelect} onActive={onActive} />
      <div className="px-5">
        <KeyHints items={[["↑↓", "scegli"], ["Invio", "conferma"]]} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Modalità di gioco
// ---------------------------------------------------------------------------
const MODES = [
  { icon: "👤", title: "Individuale", text: `Ognuno per sé, da 2 a ${MAX_PLAYERS} giocatori. Vince chi fa più punti dopo 5 manche.` },
  { icon: "👥", title: "A squadre", text: `Da 2 a ${MAX_TEAMS} squadre: si discute insieme, il capitano conferma la risposta.` },
  { icon: "📱📱", title: "Un telefono a testa", text: "Ognuno entra col proprio account con il codice o il QR della sala d'attesa." },
  { icon: "📱", title: "Un solo telefono", text: "Basta il tuo account: gli altri si aggiungono col nome e il telefono passa di mano." },
  { icon: "📺", title: "Schermo TV", text: "Apri lo schermo sul televisore o sul PC: ruota, Don Patrizio e classifica per tutti." },
];

export function ModesPanel({ onBack, onPlay }: { onBack: () => void; onPlay: (mode: "individual" | "teams") => void }) {
  return (
    <PanelFrame
      kicker="Come si gioca"
      title="MODALITÀ DI GIOCO"
      onBack={onBack}
      footer={
        <div className="flex w-full flex-wrap gap-2">
          <button type="button" className="gm-btn h-12 min-h-0 flex-1 px-4 text-lg" onClick={() => (uiSound("ok"), onPlay("individual"))}>
            ▶ INDIVIDUALE
          </button>
          <button type="button" className="gm-btn gm-btn-red h-12 min-h-0 flex-1 px-4 text-lg" onClick={() => (uiSound("ok"), onPlay("teams"))}>
            ▶ A SQUADRE
          </button>
        </div>
      }
    >
      <ul className="flex flex-col gap-2">
        {MODES.map((m) => (
          <li key={m.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5">
            <span aria-hidden className="w-10 shrink-0 text-center text-2xl">
              {m.icon}
            </span>
            <span>
              <span className="gm-display block text-xl leading-none">{m.title}</span>
              <span className="text-sm font-bold text-white/75">{m.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </PanelFrame>
  );
}

// ---------------------------------------------------------------------------
// Impostazioni
// ---------------------------------------------------------------------------
const QUALITIES: { id: QualityPref; label: string; sub: string }[] = [
  { id: "auto", label: "Automatica", sub: "Decide il dispositivo" },
  { id: "high", label: "Alta", sub: "Studio 3D completo" },
  { id: "low", label: "Leggera", sub: "3D più leggero" },
  { id: "2d", label: "2D", sub: "Niente 3D" },
];

export function SettingsPanel({ onBack, onQuality, onReplayIntro }: { onBack: () => void; onQuality: (q: QualityPref) => void; onReplayIntro: () => void }) {
  const prefs = useAudioPrefs();
  const [quality, setQuality] = useState<QualityPref>(loadQualityPref);
  const toggle = (k: keyof AudioPrefs) => {
    uiSound("move");
    savePrefs({ ...prefs, [k]: !prefs[k] });
  };
  return (
    <PanelFrame kicker="GIRAMENTE!" title="IMPOSTAZIONI" onBack={onBack}>
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-white/60">Audio</legend>
          {(
            [
              ["music", "🎵 Musica", "La sigla nel menu e in partita"],
              ["voice", "🎙 Voci", "Don Patrizio e Zafira"],
              ["sfx", "🔔 Effetti", "Ruota, risposte, applausi"],
            ] as const
          ).map(([k, label, sub]) => (
            <button key={k} type="button" role="switch" aria-checked={prefs[k]} onClick={() => toggle(k)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-left transition hover:border-[#39ff14]/60">
              <span className="min-w-0 flex-1">
                <span className="gm-display block text-xl leading-none">{label}</span>
                <span className="text-xs font-bold text-white/65">{sub}</span>
              </span>
              <span aria-hidden className={clsx("relative h-7 w-12 shrink-0 rounded-full border transition", prefs[k] ? "border-[#39ff14] bg-[#1f8f2a]" : "border-white/30 bg-white/10")}>
                <span className={clsx("absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all", prefs[k] ? "left-[calc(100%-1.5rem)]" : "left-0.5")} />
              </span>
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/60">Grafica</legend>
          <div role="radiogroup" aria-label="Qualità grafica" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                type="button"
                role="radio"
                aria-checked={quality === q.id}
                onClick={() => {
                  uiSound("ok");
                  setQuality(q.id);
                  saveQualityPref(q.id);
                  onQuality(q.id);
                }}
                className={clsx("flex flex-col items-center rounded-2xl border px-2 py-2 text-center transition", quality === q.id ? "border-[#39ff14] bg-[#1f8f2a]/45 shadow-[0_0_18px_rgba(57,255,20,.35)]" : "border-white/12 bg-black/30 hover:border-white/40")}
              >
                <span className="gm-display text-lg leading-none">{q.label}</span>
                <span className="text-[11px] font-bold text-white/65">{q.sub}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <button type="button" className="gm-btn gm-btn-ghost self-start" onClick={() => (uiSound("ok"), onReplayIntro())}>
          ▶ Rivedi l&apos;intro
        </button>
      </div>
    </PanelFrame>
  );
}

// ---------------------------------------------------------------------------
// Riprendi (e chiudi) le partite aperte
// ---------------------------------------------------------------------------
export function ResumePanel({ rooms, onBack, onClosed }: { rooms: ShellRoom[]; onBack: () => void; onClosed: (roomId: string) => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = async (r: ShellRoom) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/giramente/rooms/${r.roomId}/action`, { method: "POST", json: { action: "close_room" } });
      uiSound("back");
      onClosed(r.roomId);
      setConfirm(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Non riesco a chiudere la partita: riprova");
    } finally {
      setBusy(false);
    }
  };
  return (
    <PanelFrame kicker="Partite aperte" title="RIPRENDI" onBack={onBack}>
      {rooms.length === 0 ? (
        <p className="font-bold text-white/75">Nessuna partita aperta.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rooms.map((r) => (
            <li key={r.roomId} className="rounded-2xl border border-white/12 bg-black/35 p-3">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xl font-black tracking-[0.25em]">{r.code}</span>
                  <span className="text-sm font-bold text-white/70">{roomInfo(r)}</span>
                </span>
                <a href={roomHref(r)} className="gm-btn h-11 min-h-0 px-5 text-lg" onClick={() => uiSound("ok")}>
                  ENTRA
                </a>
              </div>
              {r.isHost &&
                (confirm === r.roomId ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#ff8a95]">Chiudere la partita per tutti?</span>
                    <button type="button" className="gm-btn gm-btn-red h-9 min-h-0 px-4 text-base" disabled={busy} onClick={() => void close(r)}>
                      SÌ, CHIUDI
                    </button>
                    <button type="button" className="gm-chip" onClick={() => setConfirm(null)}>
                      No
                    </button>
                  </div>
                ) : (
                  <button type="button" className="mt-2 text-sm font-bold text-[#ff8a95] underline-offset-2 hover:underline" onClick={() => setConfirm(r.roomId)}>
                    Chiudi questa partita
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 font-bold text-[#ff8a95]">
          {error}
        </p>
      )}
    </PanelFrame>
  );
}
