"use client";

/* eslint-disable @next/next/no-img-element -- QR generato al volo (data URL) */
import { clsx } from "clsx";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { formatPoints } from "@/lib/giramente/rules";
import { MAX_PLAYERS, MAX_TEAM_MEMBERS, MIN_PLAYERS, MIN_TEAM_MEMBERS, type GiramenteAction, type PrivateView, type PublicState } from "@/lib/giramente/types";
import { api } from "@/lib/realtime/api-client";

export const joinUrl = (code: string) => (typeof window === "undefined" ? `/giramente/entra/${code}` : `${window.location.origin}/giramente/entra/${code}`);

export function QrCode({ text, className }: { text: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: 480, color: { dark: "#080b0d", light: "#ffffff" } })
      .then((u) => alive && setSrc(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [text]);
  if (!src) return <div className={clsx("rounded-2xl bg-white/10", className)} />;
  return <img src={src} alt="QR per entrare nella partita" className={clsx("rounded-2xl bg-white p-1.5", className)} />;
}

/** Codice, QR e link d'invito (solo dispositivi personali). */
export function InvitePanel({ code, compact = false }: { code: string; compact?: boolean }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setUrl(joinUrl(code)), 0);
    return () => clearTimeout(t);
  }, [code]);
  const text = `Giochiamo a GIRAMENTE! Entra con il codice ${code}: ${url}`;
  return (
    <section className={clsx("gm-panel flex flex-col items-center gap-3 rounded-3xl p-4 text-center", compact && "sm:flex-row sm:text-left")} aria-label="Invita i giocatori">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-black uppercase tracking-widest text-white/70">Codice partita</p>
        <p className="gm-panel-green gm-display rounded-2xl px-5 py-1 text-5xl tracking-[0.12em]" aria-label={`Codice ${code.split("").join(" ")}`}>
          {code}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="gm-chip"
            onClick={() =>
              void navigator.clipboard?.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              })
            }
          >
            {copied ? "Link copiato ✓" : "Copia link"}
          </button>
          <a className="gm-chip" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      </div>
      {url && (
        <div className="flex flex-col items-center gap-1">
          <QrCode text={url} className={compact ? "h-32 w-32" : "h-40 w-40"} />
          <p className="text-xs font-bold text-white/70">Inquadra il QR e unisciti alla partita</p>
        </div>
      )}
    </section>
  );
}

/** Apre lo schermo TV (chiave chiesta al server, solo per chi gestisce) in una nuova finestra. */
export async function openScreen(roomId: string, live = false) {
  const w = window.open("", live ? "giramente-live" : "giramente-tv", live ? "popup,width=1280,height=720" : "");
  try {
    const { displayKey } = await api<{ displayKey: string }>(`/api/giramente/rooms/${roomId}/schermo`);
    const path = `/giramente/schermo/${encodeURIComponent(displayKey)}${live ? "?live=1" : ""}`;
    if (w) w.location.href = path;
    else window.location.assign(path);
  } catch {
    w?.close();
  }
}

export function Lobby({ state, view, act, busy, roomId, stacked = false }: { state: PublicState; view: PrivateView; act: (a: GiramenteAction) => Promise<boolean>; busy: boolean; roomId: string; /** una colonna sola (pannello laterale dello studio 3D) */ stacked?: boolean }) {
  const teams = state.mode === "teams";
  const personal = state.devices === "personal";
  const comps = state.competitors;
  const unassigned = state.participants.filter((p) => !p.competitorId);
  const ready = teams
    ? comps.filter((c) => c.members.length > 0).length >= 2 && comps.every((c) => c.members.length === 0 || c.members.length >= MIN_TEAM_MEMBERS) && unassigned.length === 0
    : comps.length >= MIN_PLAYERS;
  const reason = teams ? `Servono almeno 2 squadre con ${MIN_TEAM_MEMBERS}–${MAX_TEAM_MEMBERS} componenti` : `Servono almeno ${MIN_PLAYERS} giocatori (massimo ${MAX_PLAYERS})`;
  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="gm-display text-center text-4xl sm:text-5xl">SALA PARTITA</h1>
      <div className={clsx("grid gap-4", personal && !stacked && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]")}>
        {personal && <InvitePanel code={state.code} compact={stacked} />}
        <section className="gm-panel rounded-3xl p-4" aria-label={teams ? "Squadre" : "Giocatori"}>
          <h2 className="gm-display mb-2 text-2xl">
            {teams ? "Squadre" : "Giocatori"} ({comps.length}/{teams ? 4 : MAX_PLAYERS})
          </h2>
          {teams ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {comps.map((c) => (
                <li key={c.id} className={clsx("rounded-2xl border p-3", view.competitorId === c.id ? "border-[#39ff14] bg-[#0f3a14]/50" : "border-white/15 bg-black/40")}>
                  <p className="gm-display text-xl">👥 {c.name}</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm font-bold">
                    {c.members.map((m) => (
                      <li key={m.id} className="flex items-center gap-1.5">
                        <span className={clsx("h-2 w-2 rounded-full", m.online ? "bg-[#39ff14]" : "bg-white/30")} />
                        {m.nickname}
                        {m.captain && <span className="rounded-full bg-[#f5c542] px-1.5 text-[10px] font-black text-black">CAPITANO</span>}
                        {view.isHost && personal && !m.captain && (
                          <button type="button" className="ml-auto text-xs text-white/60 underline" onClick={() => void act({ action: "set_captain", participantId: m.id })}>
                            fai capitano
                          </button>
                        )}
                      </li>
                    ))}
                    {c.members.length === 0 && <li className="text-white/50">Nessuno ancora</li>}
                  </ul>
                  {personal && view.me && view.competitorId !== c.id && (
                    <button type="button" className="gm-chip mt-2" disabled={busy} onClick={() => void act({ action: "join_team", competitorId: c.id })}>
                      Entra in {c.name}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {comps.map((c) => {
                const p = state.participants.find((x) => x.competitorId === c.id);
                return (
                  <li key={c.id} className="flex items-center gap-2 rounded-full border border-white/12 bg-black/45 px-3 py-2 font-extrabold">
                    <span className={clsx("h-2.5 w-2.5 rounded-full", c.online ? "bg-[#39ff14]" : "bg-white/30")} />
                    <span className="flex-1 truncate">{c.name}</span>
                    {p?.isHost && <span className="rounded-full bg-[#f5c542] px-2 text-xs font-black text-black">👑 Host</span>}
                    {view.isHost && personal && p && !p.isHost && (
                      <button type="button" className="text-xs text-white/60 underline" onClick={() => void act({ action: "kick", participantId: p.id })}>
                        togli
                      </button>
                    )}
                  </li>
                );
              })}
              {personal &&
                Array.from({ length: Math.max(0, Math.min(2, MAX_PLAYERS - comps.length)) }, (_, i) => (
                  <li key={`w${i}`} className="flex items-center gap-2 rounded-full border border-dashed border-white/15 px-3 py-2 font-bold text-white/50">
                    <span className="h-2.5 w-2.5 rounded-full border border-white/40" /> In attesa…
                  </li>
                ))}
            </ul>
          )}
          {unassigned.length > 0 && <p className="mt-2 text-sm font-bold text-[#ff8a95]">Senza squadra: {unassigned.map((p) => p.nickname).join(", ")}</p>}
        </section>
      </div>
      <section className="gm-panel flex flex-wrap items-center justify-center gap-2 rounded-3xl p-3 text-sm font-bold">
        <span className="gm-chip">Difficoltà: {state.settings.difficulty}</span>
        <span className="gm-chip">Durata stimata: {state.estimate.min}–{state.estimate.max} minuti</span>
        <span className="gm-chip">5 manche</span>
        <span className="gm-chip">{personal ? "Un dispositivo a testa" : "Un solo dispositivo"}</span>
        <span className="gm-chip">Max teorico: {formatPoints(2200)} punti</span>
      </section>
      {view.isHost ? (
        <div className="flex flex-col items-center gap-2">
          <button type="button" className="gm-btn h-16 w-full max-w-md text-3xl" disabled={busy || !ready} onClick={() => void act({ action: "start_game" })}>
            ▶ AVVIA PARTITA
          </button>
          {!ready && <p className="text-sm font-bold text-white/70">{reason}</p>}
          {(
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="gm-chip" onClick={() => void openScreen(roomId)}>
                📺 Apri lo schermo TV
              </button>
              <button type="button" className="gm-chip" onClick={() => void openScreen(roomId, true)}>
                🔴 Vista per la LIVE (senza codice)
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-lg font-bold text-white/80">Aspetta che chi ha creato la partita la avvii…</p>
      )}
    </div>
  );
}
