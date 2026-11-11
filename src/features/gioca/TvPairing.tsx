"use client";

import dynamic from "next/dynamic";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TvOverlayContext } from "@/features/display/DisplayApp";
import { setTvPrefs } from "@/features/display/tv-prefs";
import { Logo } from "@/features/game/components/brand";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import type { PublicState } from "@/lib/game-engine/types";
import { api, ApiError } from "@/lib/realtime/api-client";
import type { RemotePrefs } from "@/lib/validation/tv-remote";
import { publicBase } from "./InviteButton";

const DisplayApp = dynamic(() => import("@/features/display/DisplayApp").then((m) => m.DisplayApp), {
  ssr: false,
  loading: () => <LoadingSplash label="Collegamento allo studio…" />,
});

/** Partita abbinata a questo TV (resta dopo un ricaricamento della pagina). */
const STORE_KEY = "qz.tv.paired";
interface Paired {
  sessionId: string;
  displayKey: string;
}

function loadPaired(): Paired | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as Paired | null;
    return v && typeof v.sessionId === "string" && typeof v.displayKey === "string" ? v : null;
  } catch {
    return null;
  }
}
function savePaired(p: Paired | null) {
  try {
    if (p) localStorage.setItem(STORE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* archiviazione non disponibile: si resta abbinati finché la pagina è aperta */
  }
}

interface Created {
  pairingId: string;
  code: string;
  token: string;
  expiresAt: string;
}
type Poll = { status: "waiting"; code: string; expiresAt: string } | { status: "paired"; sessionId: string; displayKey: string } | { status: "expired" } | { status: "used" };

/**
 * /tv: il televisore mostra un codice di 4 cifre (e un QR) finché l'host non lo scrive sul telefono;
 * poi diventa lo schermo della partita. Funziona con qualsiasi browser: niente account, niente app.
 */
export function TvPairing({ direct, reset }: { direct: { pairingId: string; token: string } | null; reset: boolean }) {
  const [paired, setPaired] = useState<Paired | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (reset || direct) savePaired(null);
      setPaired(reset || direct ? null : loadPaired());
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, [reset, direct]);

  const onPaired = useCallback((p: Paired) => {
    savePaired(p);
    setPaired(p);
  }, []);
  const unpair = useCallback(() => {
    savePaired(null);
    setPaired(null);
  }, []);

  if (!ready) return <LoadingSplash label="Accendo il televisore…" />;
  if (paired) return <PairedTv key={paired.sessionId} paired={paired} onSwitch={onPaired} onUnpair={unpair} />;
  return <PairingCode direct={direct} onPaired={onPaired} />;
}

// ---------------------------------------------------------------------------
// Codice da scrivere sul telefono
// ---------------------------------------------------------------------------
function PairingCode({ direct, onPaired }: { direct: { pairingId: string; token: string } | null; onPaired: (p: Paired) => void }) {
  const [pairing, setPairing] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const directRef = useRef(direct);

  // nuovo codice (all'avvio, alla scadenza, dopo un errore)
  useEffect(() => {
    let alive = true;
    const d = directRef.current;
    if (d) {
      directRef.current = null;
      const t = setTimeout(() => setPairing({ pairingId: d.pairingId, token: d.token, code: "", expiresAt: new Date(Date.now() + 120_000).toISOString() }), 0);
      return () => clearTimeout(t);
    }
    api<Created>("/api/tv/pair", { method: "POST" })
      .then((p) => {
        if (!alive) return;
        setPairing(p);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : "Connessione assente");
        setTimeout(() => alive && setNonce((n) => n + 1), 8000);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  // il TV chiede ogni 2 s se il codice è stato scritto sul telefono
  useEffect(() => {
    if (!pairing) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await api<Poll>(`/api/tv/pair/${pairing.pairingId}?t=${encodeURIComponent(pairing.token)}`);
        if (!alive) return;
        if (r.status === "paired") onPaired({ sessionId: r.sessionId, displayKey: r.displayKey });
        else if (r.status === "expired" || r.status === "used") {
          setPairing(null);
          setNonce((n) => n + 1);
        }
      } catch (e) {
        if (alive && e instanceof ApiError && e.status === 404) {
          setPairing(null);
          setNonce((n) => n + 1);
        }
      }
    };
    const t = setInterval(() => void tick(), 2000);
    void tick();
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pairing, onPaired]);

  const code = pairing?.code ?? "";
  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(`${publicBase()}/gioca/collega/${code}`, { margin: 1, width: 420, color: { dark: "#170824", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  const site = typeof window !== "undefined" ? publicBase().replace(/^https?:\/\//, "") : "";
  return (
    <main className="qz-stage fixed inset-0 grid place-items-center overflow-hidden bg-night p-[4vmin] text-white">
      <div className="flex w-full max-w-[1400px] flex-col items-center gap-[3vh] text-center">
        <Logo variant="full" size="xl" priority className="!h-[22vh] w-auto" />
        {direct && !code ? (
          <p className="font-display text-[5vh] text-gold">Collegamento alla partita…</p>
        ) : (
          <>
            <p className="font-display text-[4.4vh] leading-tight text-white">Sul telefono: crea la partita, scegli «Sul televisore» e scrivi</p>
            <div className="flex items-center gap-[4vw]">
              <div aria-label={code ? `Codice ${code.split("").join(" ")}` : "Preparo il codice"} className="flex gap-[1.6vh]" role="status">
                {(code || "····").split("").map((c, i) => (
                  <span
                    key={i}
                    className="grid h-[20vh] w-[14vh] place-items-center rounded-[2.4vh] border-[0.7vh] border-gold bg-[#1d0c30] font-display text-[14vh] leading-none text-gold shadow-[0_0_6vh_rgba(255,212,59,.35)]"
                  >
                    {c}
                  </span>
                ))}
              </div>
              {qr && (
                <div className="hidden flex-col items-center gap-[1vh] md:flex">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR per collegare il telefono" className="h-[24vh] w-[24vh] rounded-[2vh] bg-white p-[1vh]" />
                  <span className="text-[2.2vh] font-bold text-white/70">oppure inquadra</span>
                </div>
              )}
            </div>
            <p className="text-[2.6vh] font-bold text-white/70">
              Il codice cambia da solo ogni 10 minuti · {site}/tv
            </p>
          </>
        )}
        {error && <p className="rounded-full bg-flame/25 px-6 py-2 text-[2.4vh] font-bold text-[#ffd0d9]">{error} – riprovo tra poco</p>}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// TV abbinato: lo schermo della partita, comandato dal telefono
// ---------------------------------------------------------------------------
function PairedTv({ paired, onSwitch, onUnpair }: { paired: Paired; onSwitch: (p: Paired) => void; onUnpair: () => void }) {
  const { sessionId, displayKey } = paired;
  // abbinamento ancora valido? (partita eliminata o chiave cambiata → di nuovo il codice)
  useEffect(() => {
    api(`/api/display/${sessionId}/state?k=${encodeURIComponent(displayKey)}`).catch((e: unknown) => {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) onUnpair();
    });
  }, [sessionId, displayKey, onUnpair]);
  return (
    <DisplayApp
      sessionId={sessionId}
      displayKey={displayKey}
      hostMode
      renderOverlay={(s, ctx) => <PairedOverlay paired={paired} state={s} ctx={ctx} onSwitch={onSwitch} onUnpair={onUnpair} />}
    />
  );
}

function PairedOverlay({ paired, state, ctx, onSwitch, onUnpair }: { paired: Paired; state: PublicState | null; ctx: TvOverlayContext; onSwitch: (p: Paired) => void; onUnpair: () => void }) {
  const { sessionId, displayKey } = paired;
  const k = encodeURIComponent(displayKey);
  const audioRef = useRef(ctx.audioOn);
  useEffect(() => {
    audioRef.current = ctx.audioOn;
  }, [ctx.audioOn]);

  // presenza (il telefono vede "TV collegato") e audio scelto dal telecomando
  useEffect(() => {
    let rev = -1;
    let alive = true;
    const beat = async () => {
      try {
        const r = await api<{ prefs: RemotePrefs; rev: number }>(`/api/display/${sessionId}/remote?k=${k}`, { method: "POST", json: { audioOn: audioRef.current } });
        if (alive && r.rev !== rev) {
          rev = r.rev;
          if (Object.keys(r.prefs).length > 0) setTvPrefs(r.prefs);
        }
      } catch {
        /* rete assente: si riprova al prossimo giro */
      }
    };
    void beat();
    const t = setInterval(() => void beat(), 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sessionId, k]);

  // rivincita: il TV passa da solo alla nuova partita (stesso codice e QR)
  const next = state?.rematch?.sessionId ?? null;
  useEffect(() => {
    if (!next) return;
    api<{ next: Paired | null }>(`/api/display/${sessionId}/follow?k=${k}`, { method: "POST" })
      .then((r) => r.next && onSwitch(r.next))
      .catch(() => undefined);
  }, [next, sessionId, k, onSwitch]);

  const btn = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!ctx.audioOn) btn.current?.focus();
  }, [ctx.audioOn]);

  if (!state) return null;
  const phase = state.phase;
  return (
    <>
      {/* audio e schermo intero richiedono un clic (o OK sul telecomando del TV) */}
      {!ctx.audioOn && (
        <button
          ref={btn}
          type="button"
          autoFocus
          onClick={() => {
            if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
            ctx.activateAudio();
          }}
          className="absolute left-1/2 top-[5cqh] z-[67] -translate-x-1/2 rounded-full bg-gold px-8 py-4 font-display text-[clamp(1.2rem,2.4cqw,2.4rem)] text-ink shadow-[0_6px_0_#9a5d00] outline-none ring-white transition focus:ring-8"
        >
          ▶ PREMI OK PER L&apos;AUDIO
        </button>
      )}
      {(phase === "LOBBY" || phase === "READY") && (
        <p className="absolute bottom-[2cqh] left-[3cqw] z-[66] rounded-full bg-black/55 px-[1.6cqh] py-[0.6cqh] text-[2.2cqh] font-bold text-white/80">📱 Comandi dal telefono dell&apos;host</p>
      )}
      {phase === "FINISHED" && !state.rematch && (
        <button
          type="button"
          onClick={onUnpair}
          className="absolute bottom-[2cqh] left-[3cqw] z-[66] rounded-full bg-black/60 px-[2cqh] py-[0.8cqh] text-[2.2cqh] font-bold text-white/85 outline-none ring-gold focus:ring-4"
        >
          Collega un&apos;altra partita
        </button>
      )}
    </>
  );
}
