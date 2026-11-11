"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PREFS } from "@/features/display/tv-prefs";
import { phaseLabelOf } from "@/lib/game-engine/transitions";
import type { PublicState } from "@/lib/game-engine/types";
import { api, ApiError } from "@/lib/realtime/api-client";
import { useAutoTick, type AutoTickResponse } from "@/lib/realtime/use-auto-tick";
import { useGameState } from "@/lib/realtime/use-game-state";
import type { RemotePrefs } from "@/lib/validation/tv-remote";
import { btnSoft, GameSettings, PlayersSettings, Section, Slider, Switch, useHostStatus, VoicesProgress } from "./HostSettings";
import { InviteButton, publicBase } from "./InviteButton";
import { RematchControls } from "./RematchControls";
import { useHostCommand } from "./use-host-command";
import { useVoicePrep } from "./use-voice-prep";
import { ExitButton } from "@/features/game/components/ExitButton";

interface RemoteStatus {
  prefs: RemotePrefs;
  rev: number;
  tv: { online: boolean; audioOn: boolean | null; seenAt: string } | null;
}

/** Stato del TV abbinato (presenza e audio) e preferenze audio scelte da qui, ogni 3 s. */
function useRemoteTv(sessionId: string) {
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<RemoteStatus>(`/api/gioca/games/${sessionId}/tv`)
        .then((r) => alive && setStatus(r))
        .catch(() => undefined);
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sessionId, nonce]);
  return { status, refresh: () => setNonce((n) => n + 1) };
}

// ---------------------------------------------------------------------------
// Collegamento del televisore
// ---------------------------------------------------------------------------
function PairForm({ sessionId, onPaired, compact }: { sessionId: string; onPaired: () => void; compact?: boolean }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [site, setSite] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSite(publicBase().replace(/^https?:\/\//, "")), 0);
    return () => clearTimeout(t);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/tv/pair/claim", { method: "POST", json: { code, sessionId } });
      setMsg({ ok: true, text: "Fatto! Il televisore sta caricando la partita…" });
      setCode("");
      onPaired();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Connessione assente, riprova" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {!compact && (
        <ol className="flex flex-col gap-2 text-[15px] font-bold text-white/85">
          <li>
            <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-gold font-display text-sm text-ink">1</span>
            Sul televisore apri il browser e vai su <span className="whitespace-nowrap font-display text-lg tracking-wide text-gold">{site}/tv</span>
          </li>
          <li>
            <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-gold font-display text-sm text-ink">2</span>
            Scrivi qui il codice di 4 cifre che compare sul TV
          </li>
        </ol>
      )}
      <div className="flex gap-2">
        <label htmlFor="tv-code" className="sr-only">
          Codice del televisore
        </label>
        <input
          id="tv-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          pattern="[0-9]{4}"
          autoComplete="one-time-code"
          enterKeyHint="go"
          placeholder="0000"
          className="h-16 min-w-0 flex-1 rounded-2xl border-[3px] border-gold/70 bg-white px-4 text-center font-display text-4xl tracking-[0.4em] text-ink placeholder:text-ink/25 focus:border-cyan focus:outline-none"
        />
        <button type="submit" disabled={busy || code.length !== 4} className="h-16 shrink-0 rounded-2xl bg-gold px-5 font-display text-2xl text-ink transition active:scale-95 disabled:opacity-40">
          {busy ? "…" : "COLLEGA"}
        </button>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={clsx("rounded-xl px-3 py-2 text-sm font-bold", msg.ok ? "bg-[#1f5c3d] text-[#9dffc9]" : "bg-flame/20 text-[#ffd0d9]")}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

/**
 * «Trasmetti» con la Presentation API: il browser apre la pagina del TV direttamente su un
 * dispositivo Cast. Funziona per un indirizzo qualsiasi solo con Chrome per computer (che disegna
 * la pagina e la trasmette); Chrome per Android trasmette solo app Cast registrate, quindi lì la
 * disponibilità risulta falsa e il pulsante resta nascosto. Si mostra SOLO se il browser dice che
 * c'è un dispositivo pronto per questo indirizzo.
 */
/** Presentation API (non ancora nei tipi DOM di TypeScript): solo quello che serve qui. */
interface PresentationAvailabilityLike {
  value: boolean;
  onchange: (() => void) | null;
}
interface PresentationRequestLike {
  getAvailability(): Promise<PresentationAvailabilityLike>;
  start(): Promise<unknown>;
}
type PresentationRequestCtor = new (urls: string[]) => PresentationRequestLike;
function presentationRequest(): PresentationRequestCtor | null {
  return (window as Window & { PresentationRequest?: PresentationRequestCtor }).PresentationRequest ?? null;
}

function CastButton({ sessionId, onStarted }: { sessionId: string; onStarted: () => void }) {
  const [available, setAvailable] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    const PR = presentationRequest();
    if (!PR) return;
    let alive = true;
    let avail: PresentationAvailabilityLike | null = null;
    try {
      new PR([new URL("/tv", window.location.origin).href])
        .getAvailability()
        .then((a) => {
          if (!alive) return;
          avail = a;
          setAvailable(a.value);
          a.onchange = () => alive && setAvailable(a.value);
        })
        .catch(() => undefined);
    } catch {
      /* non supportata */
    }
    return () => {
      alive = false;
      if (avail) avail.onchange = null;
    };
  }, []);
  if (!available) return null;
  async function cast() {
    setNote(null);
    try {
      const r = await api<{ path: string }>(`/api/gioca/games/${sessionId}/cast`, { method: "POST" });
      const PR = presentationRequest();
      if (!PR) return;
      const req = new PR([new URL(r.path, window.location.origin).href]);
      await req.start();
      onStarted();
    } catch (e) {
      if (e instanceof DOMException && (e.name === "AbortError" || e.name === "NotAllowedError")) return;
      setNote(e instanceof ApiError ? e.message : "Trasmissione non riuscita: usa il codice del TV.");
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={() => void cast()} className={clsx(btnSoft, "w-fit bg-[#087cff]/30")}>
        📡 Trasmetti al TV
      </button>
      {note && <p className="text-sm font-bold text-[#ffd0d9]">{note}</p>}
    </div>
  );
}

function MirrorHint({ sessionId }: { sessionId: string }) {
  return (
    <details className="group rounded-2xl bg-white/5 px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-black text-white/75">Il TV non ha un browser? ▾</summary>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-white/70">
        Ultima spiaggia: duplica lo schermo del telefono sul TV (Android: tendina rapida → <b>Smart View</b> o <b>Trasmetti schermo</b>; iPhone: Centro di
        controllo → <b>Duplica schermo</b> con AirPlay), poi apri lo{" "}
        <Link href={`/gioca/tv/${sessionId}`} className="text-gold underline">
          schermo TV
        </Link>{" "}
        e gira il telefono in orizzontale. I comandi restano nell&apos;ingranaggio.
      </p>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Audio del televisore, comandato da qui
// ---------------------------------------------------------------------------
function RemoteAudio({ sessionId, prefs, onSaved }: { sessionId: string; prefs: RemotePrefs; onSaved: () => void }) {
  const [local, setLocal] = useState<RemotePrefs>({});
  const p = { ...DEFAULT_PREFS, ...prefs, ...local };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<RemotePrefs>({});
  const send = useCallback(
    (patch: RemotePrefs, delay = 0) => {
      setLocal((l) => ({ ...l, ...patch }));
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const body = pending.current;
        pending.current = {};
        void api(`/api/gioca/games/${sessionId}/tv`, { method: "PUT", json: body })
          .then(() => onSaved())
          .catch(() => undefined);
      }, delay);
    },
    [sessionId, onSaved],
  );
  return (
    <>
      <Slider label="Volume" value={p.masterVolume} onChange={(v) => send({ masterVolume: v, ...(v > 0 ? { muted: false } : {}) }, 350)} />
      <Switch checked={p.muted} onChange={(v) => send({ muted: v })} label="Tutto muto" />
      <Switch checked={p.voice} onChange={(v) => send({ voice: v })} label="Voce dei presentatori" />
      <Switch checked={p.theme} onChange={(v) => send({ theme: v })} label="Musica" hint="Sigla in lobby, classifiche e podio" />
      <Slider label="Volume musica" value={p.musicVolume} onChange={(v) => send({ musicVolume: v }, 350)} disabled={!p.theme} />
      <Switch checked={p.readOptions} onChange={(v) => send({ readOptions: v })} label="Legge anche le risposte" />
      <Switch checked={p.rules} onChange={(v) => send({ rules: v })} label="Spiega le regole nell'intro" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Telecomando
// ---------------------------------------------------------------------------
/**
 * Modalità A (partita creata dal telefono, show sul televisore): il telefono è il telecomando.
 * Prima collega il TV (codice di 4 cifre, «Trasmetti» dove funziona, duplicazione come ultima
 * spiaggia), poi: INIZIA PARTITA, pausa/avanti/termina, scorrimento, giocatori, audio del TV,
 * invita amici e rivincita. Tiene viva la partita se il TV si spegne (passi automatici).
 */
export function PhoneRemote({ sessionId, displayKey, canCreateMore, host }: { sessionId: string; displayKey: string; canCreateMore: boolean; host: string | null }) {
  const router = useRouter();
  const k = encodeURIComponent(displayKey);
  const { state, now } = useGameState({
    fetchSnapshot: async () => (await api<{ state: PublicState }>(`/api/display/${sessionId}/state?k=${k}`)).state,
    safetyPollMs: 3000,
  });
  const [override, setOverride] = useState<PublicState | null>(null);
  const view = override && state && override.sessionId === state.sessionId && override.version > state.version ? override : (state ?? override);
  const { status: remote, refresh: refreshRemote } = useRemoteTv(sessionId);
  const tvOnline = !!remote?.tv?.online;
  const [pairOpen, setPairOpen] = useState(false);

  const tick = useCallback(() => api<AutoTickResponse>(`/api/display/${sessionId}/tick?k=${k}`, { method: "POST", timeoutMs: 20000 }), [sessionId, k]);
  // il TV guida lo scorrimento (aspetta la fine delle battute): il telefono interviene solo se il TV tace
  useAutoTick({ auto: view?.auto, now, tick, extraDelayMs: tvOnline ? 20000 : 1500 });

  const prep = useVoicePrep({ sessionId, displayKey, active: !!view && view.phase !== "FINISHED" });
  const [status, refreshStatus] = useHostStatus(sessionId, view);
  const start = useHostCommand(sessionId, setOverride);

  const goTo = useCallback((id: string) => router.replace(`/gioca/telecomando/${id}`), [router]);
  const next = view?.rematch?.sessionId ?? null;
  useEffect(() => {
    if (next) goTo(next);
  }, [next, goTo]);

  const phase = view?.phase;
  const lobby = phase === "LOBBY" || phase === "READY";
  const progress = view && view.totalQuestions > 0 && !lobby ? `${view.questionsPlayed}/${view.totalQuestions} domande` : null;
  const showPair = !tvOnline || pairOpen;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-16 pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/gioca" className="text-sm font-bold text-white/65 hover:text-white">
            ← Nuova partita
          </Link>
          <h1 className="mt-0.5 font-display text-4xl leading-none">{view ? phaseLabelOf(view) : "Collegamento…"}</h1>
          <p className="mt-1 text-sm font-bold text-white/70">
            Codice <span className="font-display tracking-[0.14em] text-gold">{view?.code ?? "……"}</span>
            {progress ? ` · ${progress}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
        <ExitButton size="sm" />
        <span
          role="status"
          className={clsx("inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-sm font-bold", tvOnline ? "bg-[#1f5c3d] text-[#9dffc9]" : "bg-white/10 text-white/70")}
        >
          <span className={clsx("h-2 w-2 rounded-full", tvOnline ? "bg-[#5dffab]" : "bg-white/40")} aria-hidden />
          {tvOnline ? "TV collegato" : "TV non collegato"}
        </span>
        </div>
      </div>

      {showPair ? (
        <section aria-label="Collega il televisore" className="flex flex-col gap-3 rounded-[28px] bg-coal-1 p-5 ring-1 ring-[#7fc3ff]/30">
          <h2 className="font-display text-2xl">{tvOnline ? "Collega un altro televisore" : "Collega il televisore"}</h2>
          <PairForm
            sessionId={sessionId}
            onPaired={() => {
              refreshRemote();
              setPairOpen(false);
            }}
          />
          <CastButton sessionId={sessionId} onStarted={refreshRemote} />
          <MirrorHint sessionId={sessionId} />
        </section>
      ) : (
        remote?.tv?.audioOn === false && (
          <p role="status" className="rounded-2xl bg-flame/20 px-4 py-3 text-sm font-bold text-[#ffd0d9]">
            Audio del TV non attivo: premi OK sul telecomando del televisore (o clicca lo schermo).
          </p>
        )
      )}

      {/* azione principale del momento */}
      <section aria-label="Partita" className="flex flex-col gap-3 rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8">
        {phase === "LOBBY" && view && (
          <>
            <button
              type="button"
              className="qz-play h-16 w-full rounded-full bg-gold font-display text-3xl text-ink transition active:scale-[0.98] disabled:opacity-40"
              disabled={!!start.busy || view.playerCount < 1}
              onClick={() => void start.run("start")}
            >
              {start.busy ? "PARTE…" : "▶ INIZIA PARTITA"}
            </button>
            <p className="text-center text-sm font-bold text-white/75">
              {view.playerCount < 1 ? "Aspetta che entri almeno un giocatore." : `${view.playerCount} ${view.playerCount === 1 ? "giocatore pronto" : "giocatori pronti"}: si parte con l'intro e le regole.`}
            </p>
            {start.error && (
              <p role="alert" className="text-sm font-bold text-[#ffb3c1]">
                {start.error}
              </p>
            )}
          </>
        )}
        {phase === "FINISHED" && (
          <>
            <RematchControls sessionId={sessionId} onStarted={goTo} />
            <div className="flex flex-wrap gap-2">
              {canCreateMore && (
                <Link href="/gioca" className={btnSoft}>
                  Nuova partita
                </Link>
              )}
              <Link href="/" className={btnSoft}>
                Torna alla home
              </Link>
            </div>
          </>
        )}
        {phase && phase !== "FINISHED" && (
          <div className={clsx("flex flex-col gap-3", phase === "LOBBY" && "border-t border-white/10 pt-3")}>
            <GameSettings sessionId={sessionId} state={view} status={status} onChanged={refreshStatus} />
          </div>
        )}
      </section>

      {view && phase !== "FINISHED" && (
        <section aria-label="Invita" className="rounded-[28px] bg-coal-2 p-5 ring-1 ring-white/8">
          <InviteButton code={view.code} host={host} />
          {/* l'host può giocare anche lui: il telefono-giocatore si apre in un'altra scheda (il telecomando resta qui) */}
          <a href={`/play/${view.code}`} target="_blank" rel="noopener" className="mt-3 block text-center text-sm font-bold text-white/75 underline underline-offset-4">
            🎮 Giochi anche tu? Apri il gioco in un&apos;altra scheda
          </a>
        </section>
      )}

      <section aria-label="Giocatori" className="rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8">
        <h2 className="mb-3 font-display text-2xl">
          {view?.playerCount ?? 0} {view?.playerCount === 1 ? "giocatore" : "giocatori"}
        </h2>
        <PlayersSettings sessionId={sessionId} status={status} onChanged={refreshStatus} />
      </section>

      <section className="flex flex-col gap-4 rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8">
        <Section title="Audio del TV">
          <RemoteAudio sessionId={sessionId} prefs={remote?.prefs ?? {}} onSaved={refreshRemote} />
        </Section>
        <Section title="Voci della serata">
          <VoicesProgress prep={prep} />
        </Section>
        {tvOnline && !pairOpen && (
          <button type="button" className={clsx(btnSoft, "w-fit text-sm")} onClick={() => setPairOpen(true)}>
            📺 Collega un altro televisore
          </button>
        )}
      </section>
    </div>
  );
}
