"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { MIN_PLAYERS, type PsycoAction, type PsycoPrivateView, type PsycoPublicState, type PsycoSettings } from "@/lib/psyco/types";
import { api, ApiError } from "@/lib/realtime/api-client";
import { getNarrator } from "./narrator";
import { SettingsForm } from "./SettingsForm";

type Run = (a: PsycoAction) => Promise<boolean>;

/** Avvio di partita/manche: impostazioni, eventuale scelta dello PSYCO, minimo 3 giocatori. */
export function StartPanel({ state, run, busy, label }: { state: PsycoPublicState; run: Run; busy: string | null; label: string }) {
  const [settings, setSettings] = useState<PsycoSettings | null>(state.settings);
  const [error, setError] = useState<string | null>(null);
  const [psycoId, setPsycoId] = useState<string>("");
  const enough = state.activeCount >= MIN_PLAYERS;
  const manual = (settings ?? state.settings).psycoPick === "manual";
  const first = state.phase === "LOBBY";
  async function start() {
    if (!enough) {
      getNarrator().say(["minimo-giocatori"]);
      return;
    }
    if (!settings) return;
    const pid = manual ? psycoId || undefined : undefined;
    if (first) {
      if (JSON.stringify(settings) !== JSON.stringify(state.settings)) {
        if (!(await run({ action: "update_settings", settings }))) return;
      }
      await run({ action: "start_game", psycoId: pid });
    } else {
      await run({ action: "next_round", settings, psycoId: pid });
    }
  }
  return (
    <section className="psy-panel flex w-full flex-col gap-5 rounded-3xl p-5">
      <SettingsForm
        initial={state.settings}
        compact
        onChange={(s, e) => {
          setSettings(s);
          setError(e);
        }}
      />
      {manual && (
        <label className="flex flex-col gap-1 font-bold">
          <span>PSYCO di questa manche</span>
          <select className="psy-input" value={psycoId} onChange={(e) => setPsycoId(e.target.value)} aria-label="PSYCO di questa manche">
            <option value="">— scegli —</option>
            {state.participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname} {p.psycoCount ? `(già ${p.psycoCount} ${p.psycoCount === 1 ? "volta" : "volte"})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" className="psy-btn w-full text-3xl" disabled={!!busy || !settings || !!error || (manual && !psycoId)} onClick={() => void start()}>
        {label}
      </button>
      {!enough && (
        <p role="status" className="text-center font-bold text-lamp">
          Servono almeno {MIN_PLAYERS} giocatori per cominciare (ora {state.activeCount}).
        </p>
      )}
    </section>
  );
}

/** Comandi di chi gestisce la partita durante la manche (mai dati segreti). */
export function HostBar({ state, run, busy }: { state: PsycoPublicState; view: PsycoPrivateView | null; run: Run; busy: string | null }) {
  const r = state.round;
  const p = state.phase;
  const btn = "psy-chip";
  const items: { label: string; action: PsycoAction; danger?: boolean }[] = [];
  if (p === "ROLE_REVEAL") items.push({ label: "Continua senza aspettare", action: { action: "close_vote" } });
  if (p === "DIFFICULTY_VOTE" || p === "RULE_VOTE" || p === "PROPOSAL_VOTE" || p === "GUESS_VOTE") items.push({ label: "Chiudi la votazione", action: { action: "close_vote" } });
  if (p === "RULE_PROPOSALS") {
    items.push({ label: "Chiudi le proposte", action: { action: "close_proposals" } });
    items.push({ label: "Usa le regole pronte", action: { action: "use_archive" } });
  }
  if (p === "RULE_CONFIRMED") items.push({ label: "Inizia anche se non tutti sono pronti", action: { action: "start_round" } });
  if (p === "PLAYING" && r?.timer.startedAt) items.push(r.timer.pausedAt ? { label: "▶ Riprendi", action: { action: "resume" } } : { label: "⏸ Pausa", action: { action: "pause" } });
  if (["ROLE_REVEAL", "DIFFICULTY_VOTE", "RULE_VOTE", "RULE_PROPOSALS", "PROPOSAL_VOTE", "RULE_CONFIRMED", "PLAYING", "GUESS_VOTE"].includes(p))
    items.push({ label: "Termina la manche", action: { action: "end_round" }, danger: true });
  if (items.length === 0) return null;
  return (
    <nav aria-label="Comandi di chi gestisce la partita" className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-paper/50">Gestione</span>
      {items.map((i) => (
        <button key={i.label} type="button" disabled={!!busy} className={clsx(btn, i.danger && "!text-[#ffb3b7]")} onClick={() => void run(i.action)}>
          {i.label}
        </button>
      ))}
    </nav>
  );
}

/** Schermo pubblico: aprirlo su questo PC (altra finestra/schermo) o collegare un televisore con /tv. */
export function ScreenPanel({ roomId }: { roomId: string }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function openHere() {
    setBusy(true);
    try {
      const { displayKey } = await api<{ displayKey: string }>(`/api/psyco/rooms/${roomId}/schermo`);
      const url = `/psyco/schermo/${encodeURIComponent(displayKey)}`;
      const w = window.open(url, `psyco-tv-${roomId}`, "popup,width=1280,height=720");
      if (!w) window.location.assign(url);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Non riesco ad aprire lo schermo");
    } finally {
      setBusy(false);
    }
  }
  async function pair(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/psyco/rooms/${roomId}/tv`, { method: "POST", json: { code } });
      setMsg("Televisore collegato ✓");
      setCode("");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Codice non valido");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="psy-panel w-full rounded-3xl p-4">
      <summary className="cursor-pointer font-extrabold text-paper">📺 Schermo per tutti (TV o PC)</summary>
      <div className="mt-4 flex flex-col gap-4">
        <p className="text-sm font-bold text-paper/75">Lo schermo mostra codice, QR, giocatori, timer e risultati. Non mostra mai la regola segreta né i voti: non è un giocatore e non serve un account.</p>
        <button type="button" className="psy-btn psy-btn-paper text-xl" disabled={busy} onClick={() => void openHere()}>
          Apri lo schermo su questo PC
        </button>
        <form onSubmit={(e) => void pair(e)} className="flex flex-col gap-2">
          <label htmlFor="psy-tv-code" className="text-sm font-bold text-paper/80">
            Oppure sul televisore apri <b>/tv</b> e scrivi qui il codice di 4 cifre:
          </label>
          <div className="flex gap-2">
            <input id="psy-tv-code" inputMode="numeric" maxLength={4} className="psy-input w-32 text-center text-2xl tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button type="submit" className="psy-btn text-xl" disabled={busy || code.length !== 4}>
              Collega
            </button>
          </div>
        </form>
        {msg && (
          <p role="status" className="text-sm font-bold text-lamp">
            {msg}
          </p>
        )}
      </div>
    </details>
  );
}
