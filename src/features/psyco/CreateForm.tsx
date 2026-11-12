"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDeviceKind } from "@/features/gioca/use-device";
import { checkNickname } from "@/lib/psyco/logic";
import { DEFAULT_SETTINGS, MIN_PLAYERS, type PsycoSettings, type RoomMode } from "@/lib/psyco/types";
import { api, ApiError } from "@/lib/realtime/api-client";
import { markIntroSeen } from "./intro/PsycoIntro";
import { ErrorNote } from "./panels";
import { SettingsForm } from "./SettingsForm";

/**
 * Come si gioca:
 *  - "screen"   SCHERMO + TELEFONI (consigliata da PC): questo PC diventa lo schermo pubblico (QR, timer,
 *               risultati, voce) e TUTTI, chi crea compreso, giocano dal proprio telefono con l'account;
 *  - "personal" ognuno il suo dispositivo (anche questo, se è un telefono o un PC dove giochi tu);
 *  - "shared"   un solo dispositivo che passa di mano (telefono, tablet o portatile): basta il tuo account.
 * Dal telefono restano le due scelte di sempre; dal PC la scelta predefinita è Schermo + telefoni.
 */
type Choice = "screen" | "personal" | "shared";

export function CreateForm({ initialMode, username, introPlayed = false }: { initialMode: RoomMode; username: string | null; introPlayed?: boolean }) {
  const router = useRouter();
  const device = useDeviceKind();
  const desktop = device === "desktop";
  const [picked, setPicked] = useState<Choice | null>(initialMode === "shared" ? "shared" : null);
  const choice: Choice = picked ?? (desktop ? "screen" : "personal");
  const mode: RoomMode = choice === "shared" ? "shared" : "personal";
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
          : { mode, settings, hostPlays, hostNickname: hostPlays ? hostNick : undefined, screen: choice === "screen" };
      const r = await api<{ roomId: string }>("/api/psyco/rooms", { method: "POST", json: body });
      // l'intro l'hanno appena vista qui: in sala d'attesa (o sullo schermo) non riparte
      if (introPlayed) markIntroSeen(r.roomId);
      if (choice === "screen") {
        // il PC diventa lo SCHERMO PUBBLICO: mai la stanza (dove arriverebbe il ruolo dell'host)
        const { displayKey } = await api<{ displayKey: string }>(`/api/psyco/rooms/${r.roomId}/schermo`);
        router.push(`/psyco/schermo/${encodeURIComponent(displayKey)}`);
        return;
      }
      router.push(mode === "shared" ? `/psyco/un-dispositivo/${r.roomId}` : `/psyco/stanza/${r.roomId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Non riesco a creare la partita");
      setBusy(false);
    }
  }

  const card = (v: Choice, title: string, desc: string, opts: { badge?: string; big?: boolean } = {}) => (
    <button
      key={v}
      type="button"
      role="radio"
      aria-checked={choice === v}
      onClick={() => setPicked(v)}
      className={clsx("relative rounded-3xl text-left transition", opts.big ? "p-6" : "p-5", choice === v ? "psy-paper" : "bg-white/6 ring-1 ring-white/15 hover:bg-white/10")}
    >
      {opts.badge && <span className="absolute right-4 top-4 rounded-full bg-blood px-3 py-1 text-xs font-black uppercase tracking-wider text-white">{opts.badge}</span>}
      <span className={clsx("psy-display block", opts.big ? "pr-28 text-3xl md:text-4xl" : "text-2xl", choice === v ? "text-[#8e0b12]" : "text-paper")}>{title}</span>
      <span className={clsx("mt-1 block font-bold", opts.big ? "text-base" : "text-sm", choice === v ? "text-[#4a3220]" : "text-paper/75")}>{desc}</span>
    </button>
  );

  return (
    <form onSubmit={(e) => void submit(e)} className="flex w-full flex-col gap-6">
      {desktop ? (
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Come giocate">
          {card(
            "screen",
            "SCHERMO + TELEFONI",
            "Questo PC diventa lo schermo per tutti: QR grande, giocatori, timer, risultati e la voce dell'Investigatore. Ognuno gioca dal suo telefono, tu compreso (entri con lo stesso account). Lo schermo non mostra mai ruoli né regole.",
            { badge: "Consigliata", big: true },
          )}
          <details className="group rounded-3xl" open={picked === "personal" || picked === "shared"}>
            <summary className="cursor-pointer list-none rounded-2xl px-2 py-2 text-sm font-extrabold text-paper/75 hover:text-paper [&::-webkit-details-marker]:hidden">
              <span className="inline-block transition group-open:rotate-90">▸</span> Altri modi di giocare
            </summary>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {card("personal", "GIOCO DA QUESTO PC", "Ognuno col suo dispositivo, e questo computer è il tuo: qui vedrai il tuo ruolo. Gli altri entrano col QR dal telefono.")}
              {card("shared", "UN SOLO DISPOSITIVO", "Giochiamo passandoci un tablet o un portatile: basta il tuo account, gli altri sono solo nickname. A turno: «tocca a te», gli altri non guardano.")}
            </div>
          </details>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Come giocate">
          {card("personal", "OGNUNO IL SUO TELEFONO", "QR e codice: ognuno entra col proprio account. Va bene anche con il PC o la TV come schermo per tutti.")}
          {card("shared", "UN SOLO DISPOSITIVO", "Un telefono, tablet o PC che passa di mano. Basta il tuo account: gli altri sono solo nickname.")}
        </div>
      )}

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
            {choice === "screen" ? "Gioco anch'io (dal mio telefono)" : "Gioco anch'io"}
          </label>
          {hostPlays ? (
            <label className="flex flex-col gap-1 font-bold">
              <span>Il tuo nickname in partita</span>
              <input className="psy-input" maxLength={20} value={hostNick} onChange={(e) => setHostNick(e.target.value)} aria-label="Il tuo nickname in partita" />
            </label>
          ) : (
            <p className="text-sm font-bold text-paper/70">
              {choice === "screen"
                ? "Presenterai senza giocare: comandi dallo schermo o dal telefono (apri «Riprendi» nella home di PSYCO con lo stesso account)."
                : "Gestirai la partita (per esempio dal PC collegato alla TV) senza giocare."}
            </p>
          )}
          {choice === "screen" && hostPlays && (
            <p className="text-sm font-bold text-lamp">
              Dopo «Crea la partita» inquadra il QR sullo schermo col tuo telefono: entri con questo stesso account e gestisci la partita da lì (avvio, timer, pausa, nuova manche, PSYCO a scelta).
            </p>
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
        {busy ? "PREPARO LA STANZA…" : choice === "screen" ? "▶ AVVIA E APRI LO SCHERMO" : "▶ AVVIA"}
      </button>
    </form>
  );
}
