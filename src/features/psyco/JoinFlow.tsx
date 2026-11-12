"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { normalizeRoomCode } from "@/lib/psyco/logic";
import { api, ApiError } from "@/lib/realtime/api-client";
import { ErrorNote } from "./panels";

interface Preview {
  room: { roomId: string; code: string; mode: "shared" | "personal"; phase: string; status: "open" | "closed"; activeCount: number; hostNickname: string | null; member: "active" | "left" | "kicked" | null; memberNickname: string | null };
  suggestedNickname: string | null;
}

/** /psyco/entra: si scrive il codice (chi ha il QR arriva direttamente su /psyco/entra/CODICE). */
export function CodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const c = normalizeRoomCode(code);
        if (c.length === 6) router.push(`/psyco/entra/${c}`);
      }}
    >
      <label htmlFor="psy-code" className="text-center font-extrabold">
        Codice della stanza
      </label>
      <input
        id="psy-code"
        autoCapitalize="characters"
        autoComplete="off"
        className="psy-input text-center text-4xl uppercase tracking-[0.3em]"
        maxLength={8}
        value={code}
        onChange={(e) => setCode(normalizeRoomCode(e.target.value).slice(0, 6))}
        placeholder="ABC234"
      />
      <button type="submit" className="psy-btn text-2xl" disabled={normalizeRoomCode(code).length !== 6}>
        ENTRA
      </button>
    </form>
  );
}

/** Ingresso con il proprio account (già verificato dalla pagina): nickname e via nella stanza. */
export function JoinRoom({ code }: { code: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [nick, setNick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api<Preview>(`/api/psyco/join?code=${encodeURIComponent(code)}`)
      .then((p) => {
        if (!alive) return;
        // già dentro (stesso account): si torna alla stanza, nessun secondo posto
        if (p.room.member === "active" && p.room.mode === "personal") {
          router.replace(`/psyco/stanza/${p.room.roomId}`);
          return;
        }
        setPreview(p);
        setNick(p.room.memberNickname ?? p.suggestedNickname ?? "");
      })
      .catch((e: unknown) => alive && setError(e instanceof ApiError ? e.message : "Connessione assente"));
    return () => {
      alive = false;
    };
  }, [code, router]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ roomId: string }>("/api/psyco/join", { method: "POST", json: { code, nickname: nick } });
      router.replace(`/psyco/stanza/${r.roomId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Non riesco a entrare");
      setBusy(false);
    }
  }

  if (error && !preview) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <ErrorNote error={error} />
        <CodeForm />
      </div>
    );
  }
  if (!preview) return <LoadingSplash game="psyco" label={`Cerco la stanza ${code}…`} className="fixed inset-0 z-50" />;
  const r = preview.room;
  if (r.status === "closed") return <p className="text-center text-xl font-extrabold">Questa partita è terminata.</p>;
  if (r.mode === "shared") return <p className="max-w-sm text-center text-xl font-extrabold">Questa partita si gioca su un solo dispositivo: non serve entrare dal telefono.</p>;
  if (r.member === "kicked") return <p className="text-center text-xl font-extrabold">Sei stato tolto da questa partita.</p>;
  return (
    <form onSubmit={(e) => void join(e)} className="psy-paper flex w-full max-w-sm flex-col gap-4 p-6 text-[#2a1a10]">
      <p className="psy-stamp self-start text-sm">stanza {r.code}</p>
      <p className="font-bold">
        {r.hostNickname ? `Partita di ${r.hostNickname}` : "Partita di PSYCO"} · {r.activeCount} {r.activeCount === 1 ? "giocatore" : "giocatori"}
        {r.phase !== "LOBBY" ? " · manche in corso (giocherai dalla prossima)" : ""}
      </p>
      <label htmlFor="psy-nick" className="psy-display text-2xl text-[#8e0b12]">
        Il tuo nickname
      </label>
      <input id="psy-nick" className="psy-input" maxLength={20} value={nick} onChange={(e) => setNick(e.target.value)} />
      <ErrorNote error={error} />
      <button type="submit" className="psy-btn text-2xl" disabled={busy || !nick.trim()}>
        {r.member === "left" ? "RIENTRA" : "ENTRA NELLA STANZA"}
      </button>
    </form>
  );
}
