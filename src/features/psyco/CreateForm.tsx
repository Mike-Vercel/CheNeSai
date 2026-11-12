"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkNickname } from "@/lib/psyco/logic";
import { DEFAULT_SETTINGS, MIN_PLAYERS, type PsycoSettings, type RoomMode } from "@/lib/psyco/types";
import { api, ApiError } from "@/lib/realtime/api-client";
import { ErrorNote } from "./panels";
import { SettingsForm } from "./SettingsForm";

/** Creazione della partita: dispositivi personali (QR/codice) oppure un solo dispositivo (nickname di tutti). */
export function CreateForm({ initialMode, username }: { initialMode: RoomMode; username: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<RoomMode>(initialMode);
  const [settings, setSettings] = useState<PsycoSettings | null>(DEFAULT_SETTINGS);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>([username ?? "", "", ""]);
  const [hostNick, setHostNick] = useState(username ?? "");
  const [hostPlays, setHostPlays] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = names.map((n) => n.trim()).filter(Boolean);
  const dupes = new Set(filled.map((n) => n.toLowerCase())).size !== filled.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "shared"
          ? { mode, settings, nicknames: filled }
          : { mode, settings, hostPlays, hostNickname: hostPlays ? hostNick : undefined };
      const r = await api<{ roomId: string }>("/api/psyco/rooms", { method: "POST", json: body });
      router.push(mode === "shared" ? `/psyco/un-dispositivo/${r.roomId}` : `/psyco/stanza/${r.roomId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Non riesco a creare la partita");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex w-full flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Come giocate">
        {(
          [
            ["personal", "OGNUNO IL SUO TELEFONO", "QR e codice: ognuno entra col proprio account. Va bene anche con il PC o la TV come schermo per tutti."],
            ["shared", "UN SOLO DISPOSITIVO", "Un telefono, tablet o PC che passa di mano. Basta il tuo account: gli altri sono solo nickname."],
          ] as const
        ).map(([v, t, d]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={mode === v}
            onClick={() => setMode(v)}
            className={clsx("rounded-3xl p-5 text-left transition", mode === v ? "psy-paper" : "bg-white/6 ring-1 ring-white/15 hover:bg-white/10")}
          >
            <span className={clsx("psy-display block text-2xl", mode === v ? "text-[#8e0b12]" : "text-paper")}>{t}</span>
            <span className={clsx("mt-1 block text-sm font-bold", mode === v ? "text-[#4a3220]" : "text-paper/75")}>{d}</span>
          </button>
        ))}
      </div>

      {mode === "shared" ? (
        <section className="psy-panel flex flex-col gap-3 rounded-3xl p-5" aria-labelledby="nick-title">
          <h2 id="nick-title" className="psy-display text-2xl">
            Chi gioca? (tu compreso)
          </h2>
          <p className="text-sm font-bold text-paper/70">Almeno {MIN_PLAYERS} nomi, nessun massimo. Si possono aggiungere o togliere anche tra una manche e l&apos;altra.</p>
          <ol className="flex flex-col gap-2">
            {names.map((n, i) => {
              const c = n.trim() ? checkNickname(n) : null;
              return (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-6 text-right font-black text-paper/50">{i + 1}</span>
                  <input
                    className="psy-input"
                    aria-label={`Nickname ${i + 1}`}
                    maxLength={20}
                    placeholder={i === 0 ? "Il tuo nome" : "Nome"}
                    value={n}
                    onChange={(e) => setNames((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {names.length > 1 && (
                    <button type="button" className="psy-chip" aria-label={`Togli ${n || `nickname ${i + 1}`}`} onClick={() => setNames((list) => list.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  )}
                  {c && !c.ok && <span className="text-xs font-bold text-[#ffb3b7]">{c.message}</span>}
                </li>
              );
            })}
          </ol>
          <button type="button" className="psy-chip self-start" onClick={() => setNames((l) => [...l, ""])}>
            + Aggiungi giocatore
          </button>
          {dupes && <p className="text-sm font-bold text-[#ffb3b7]">Ognuno deve avere un nome diverso.</p>}
        </section>
      ) : (
        <section className="psy-panel flex flex-col gap-3 rounded-3xl p-5">
          <label className="flex cursor-pointer items-center gap-3 font-extrabold">
            <input type="checkbox" className="h-6 w-6 accent-[#e0161f]" checked={hostPlays} onChange={(e) => setHostPlays(e.target.checked)} />
            Gioco anch&apos;io
          </label>
          {hostPlays ? (
            <label className="flex flex-col gap-1 font-bold">
              <span>Il tuo nickname in partita</span>
              <input className="psy-input" maxLength={20} value={hostNick} onChange={(e) => setHostNick(e.target.value)} aria-label="Il tuo nickname in partita" />
            </label>
          ) : (
            <p className="text-sm font-bold text-paper/70">Gestirai la partita (per esempio dal PC collegato alla TV) senza giocare.</p>
          )}
        </section>
      )}

      <section className="psy-panel rounded-3xl p-5">
        <SettingsForm
          initial={DEFAULT_SETTINGS}
          onChange={(s, err) => {
            setSettings(s);
            setSettingsError(err);
          }}
        />
      </section>

      <ErrorNote error={error} />
      <button
        type="submit"
        className="psy-btn psy-glow w-full py-5 text-3xl"
        disabled={busy || !settings || !!settingsError || (mode === "shared" && (dupes || filled.some((n) => !checkNickname(n).ok))) || (mode === "personal" && hostPlays && !checkNickname(hostNick).ok)}
      >
        {busy ? "CREO LA STANZA…" : "CREA LA PARTITA"}
      </button>
    </form>
  );
}
