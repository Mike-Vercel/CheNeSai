"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/realtime/api-client";
import { teamColor } from "@/lib/tig/rules";
import type { JoinPreview } from "@/lib/tig/types";
import { CrewFlag, Logo, WaxSeal } from "../ui";
import { TigArena } from "../visuals";

/**
 * INGRESSO AL TAVOLO dal QR (`token`) o dal codice squadra.
 *  - primo telefono: «Sei il primo del TAVOLO N»: nome della squadra + il proprio nome → crea la squadra (capitano);
 *  - gli altri: «Entra nella squadra: [nome]» → stesso tavolo, stessa squadra;
 *  - già in un'altra squadra della serata, lobby chiusa, tavolo escluso: lo dice chiaramente.
 * Account obbligatorio (lo controlla la pagina); il server decide tutto in una transazione.
 */
export function JoinFlow({ token, username }: { token?: string; username: string | null }) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (q: { token?: string; code?: string }) => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams(q.token ? { token: q.token } : { code: q.code ?? "" });
      setPreview(await api<JoinPreview>(`/api/tig/join?${params}`));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Connessione assente");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => void load({ token }), 0);
    return () => clearTimeout(t);
  }, [token, load]);

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <TigArena phase="lobby" teams={[]} mancheNo={null} title={null} spotlight={null} hosts={[]} now={() => Date.now()} quality="2d" className="!fixed" />
      <main className="relative mx-auto flex min-h-full w-full max-w-md flex-col items-center gap-6 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <Link href="/tavoli-in-guerra" className="tig-chip absolute left-3 top-[calc(.6rem+env(safe-area-inset-top))]">
          ‹ Menu
        </Link>
        <Logo size="md" />
        {!token && !preview && (
          <form
            className="tg-parch tig-pop flex w-full flex-col gap-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void load({ code });
            }}
          >
            <p className="tig-label">Codice del tavolo</p>
            <h1 className="tig-title text-[2.7rem] text-[#1b1410]">Entra al tavolo</h1>
            <input
              className="tig-input text-center font-mono text-3xl tracking-[0.35em] uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC123"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              aria-label="Codice del tavolo (6 caratteri)"
              autoFocus
            />
            <button type="submit" className="tig-btn w-full" disabled={code.length !== 6 || loading}>
              {loading ? "Cerco…" : "AVANTI"}
            </button>
            <p className="text-center text-sm font-bold text-[#4a3420]">Il codice è sotto il QR del tuo tavolo o te lo dà lo staff.</p>
          </form>
        )}
        {loading && token && <p className="tig-panel rounded-2xl px-5 py-4 text-lg font-bold">Controllo il QR del tavolo…</p>}
        {err && (
          <div className="tg-parch tig-pop relative w-full p-5 pt-8 text-center" role="alert">
            <WaxSeal mark="x" className="absolute -top-6 left-1/2 h-12 w-12 -translate-x-1/2 drop-shadow-[0_3px_4px_rgba(0,0,0,.4)]" />
            <p className="text-lg font-extrabold text-[#7e1a14]">{err}</p>
            {!token && (
              <button type="button" className="tig-btn tig-btn-ghost mt-3 w-full" onClick={() => setErr(null)}>
                Riprova
              </button>
            )}
          </div>
        )}
        {preview && <JoinCard preview={preview} username={username} token={token} code={token ? undefined : code} onBack={token ? undefined : () => setPreview(null)} />}
      </main>
    </div>
  );
}

/** Scheda d'ingresso a un tavolo (esportata anche per il banco di prova /preview/tig/schermate). */
export function JoinCard({ preview, username, token, code, onBack }: { preview: JoinPreview; username: string | null; token?: string; code?: string; onBack?: () => void }) {
  const [nickname, setNickname] = useState(preview.suggestedNickname ?? username ?? "");
  const [teamName, setTeamName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const go = () => window.location.assign(`/tavoli-in-guerra/gioca/${preview.eventId}`);
  const creating = !preview.team;

  if (preview.mine?.sameTable) {
    return (
      <section className="tg-parch tig-pop flex w-full flex-col items-center gap-3 p-5 text-center">
        <p className="tig-label">{preview.venue}</p>
        <h1 className="tig-title text-[2.6rem] text-[#1b1410]">Sei già al tavolo {preview.tableNo}</h1>
        {preview.team && <p className="text-lg font-bold text-[#2b1d12]">Squadra «{preview.team.name}»</p>}
        <button type="button" className="tig-btn tig-btn-red w-full" onClick={go}>
          GIOCA
        </button>
      </section>
    );
  }
  if (preview.blockedReason) {
    return (
      <section className="tg-parch tig-pop flex w-full flex-col items-center gap-3 p-5 text-center" role="alert">
        <p className="tig-label">{preview.venue} · tavolo {preview.tableNo}</p>
        <p className="text-xl font-extrabold text-[#1b1410]">{preview.blockedReason}</p>
        {preview.mine && (
          <a className="tig-btn w-full" href={`/tavoli-in-guerra/gioca/${preview.eventId}`}>
            Vai alla tua squadra (tavolo {preview.mine.tableNo})
          </a>
        )}
        {onBack && (
          <button type="button" className="tig-btn tig-btn-ghost w-full" onClick={onBack}>
            Un altro codice
          </button>
        )}
      </section>
    );
  }
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ eventId: string; created: boolean; joinedExisting: boolean }>("/api/tig/join", {
        method: "POST",
        json: { ...(token ? { token } : { code }), nickname, ...(creating ? { teamName } : {}), ...(preview.needsPin ? { pin } : {}) },
      });
      if (creating && !r.created) {
        setInfo("Un amico ha creato la squadra un attimo prima: sei entrato nella sua!");
        setTimeout(go, 1600);
        return;
      }
      go();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Connessione assente");
      setBusy(false);
    }
  };
  return (
    <form
      className="tg-parch tig-pop flex w-full flex-col gap-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-col items-center text-center">
        <CrewFlag color={teamColor(preview.tableNo)} n={preview.tableNo} className="mb-1 h-12 w-16 drop-shadow-[0_3px_3px_rgba(0,0,0,.3)]" />
        <p className="tig-label">
          {preview.venue} · tavolo {preview.tableNo}
        </p>
        {creating ? (
          <>
            <h1 className="tig-title mt-1 text-[2.6rem] text-[#1b1410]">Sei il primo del tavolo {preview.tableNo}!</h1>
            <p className="mt-1 font-bold text-[#4a3420]">Scegli il nome della squadra: sarai il capitano (lo staff lo convalida).</p>
          </>
        ) : (
          <>
            <h1 className="tig-title mt-1 text-[clamp(2.3rem,10vw,3rem)] text-[#1b1410]">Entra nella squadra</h1>
            <p className="tig-display mt-1 text-[1.9rem] font-black normal-case text-[#7a4e10]">«{preview.team!.name}»</p>
            <p className="text-sm font-bold text-[#4a3420]">
              {preview.team!.members} {preview.team!.members === 1 ? "telefono" : "telefoni"} già dentro{preview.team!.approved ? "" : " · in attesa di convalida"}
            </p>
          </>
        )}
      </div>
      {creating && (
        <label className="flex flex-col gap-1.5">
          <span className="tig-label">Nome della squadra</span>
          <input className="tig-input" value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={24} placeholder="Es. I Ritardatari" autoComplete="off" autoFocus />
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="tig-label">Il tuo nome al tavolo</span>
        <input className="tig-input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} placeholder="Come ti chiamano gli amici" autoComplete="nickname" autoFocus={!creating} />
      </label>
      {preview.needsPin && (
        <label className="flex flex-col gap-1.5">
          <span className="tig-label">PIN del tavolo (te lo dice lo staff)</span>
          <input className="tig-input text-center font-mono text-3xl tracking-[0.5em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="••••" autoComplete="one-time-code" />
        </label>
      )}
      {err && <p className="rounded-xl border border-[#c8312b]/60 bg-[#c8312b]/12 px-3 py-2 text-sm font-bold text-[#7e1a14]">{err}</p>}
      {info && <p className="rounded-xl border border-[#0b6e66]/50 bg-[#1fb5a8]/15 px-3 py-2 text-sm font-bold text-[#0a4c46]">{info}</p>}
      <button type="submit" className={clsx("tig-btn w-full text-2xl", creating && "tig-btn-red")} disabled={busy || nickname.trim().length < 2 || (creating && teamName.trim().length < 2) || (preview.needsPin && pin.length !== 4)}>
        {busy ? "Un attimo…" : creating ? "CREA LA SQUADRA" : "ENTRA"}
      </button>
      {onBack && (
        <button type="button" className="text-sm font-bold text-[#4a3420] underline" onClick={onBack}>
          Un altro codice
        </button>
      )}
    </form>
  );
}
