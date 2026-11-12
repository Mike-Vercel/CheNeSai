"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { normalizeRoomCode } from "@/lib/giramente/rules";
import { api, ApiError } from "@/lib/realtime/api-client";

interface Preview {
  roomId: string;
  code: string;
  devices: "shared" | "personal";
  mode: "individual" | "teams";
  phase: string;
  status: "open" | "closed";
  activeCount: number;
  hostNickname: string | null;
  teams: { id: string; name: string; members: number }[];
  member: "active" | "left" | "kicked" | null;
  memberNickname: string | null;
}

/** Ingresso con il codice: anteprima della partita, nome, squadra (se a squadre), poi la sala. */
export function JoinRoom({ code: initial }: { code?: string }) {
  const [code, setCode] = useState(initial ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [nickname, setNickname] = useState("");
  const [team, setTeam] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async (c: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ room: Preview; suggestedNickname: string | null }>(`/api/giramente/join?code=${encodeURIComponent(c)}`);
      if (r.room.member === "active") {
        window.location.assign(`/giramente/stanza/${r.room.roomId}`);
        return;
      }
      setPreview(r.room);
      setNickname((n) => n || r.room.memberNickname || r.suggestedNickname || "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Codice non valido");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!initial) return;
    const t = setTimeout(() => void check(initial), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo all'apertura dal link/QR
  }, [initial]);

  const join = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ roomId: string }>("/api/giramente/join", { method: "POST", json: { code: preview.code, nickname, teamId: team } });
      window.location.assign(`/giramente/stanza/${r.roomId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Non riesco a entrare: riprova");
      setBusy(false);
    }
  };

  return (
    <div className="gm-panel flex w-full flex-col gap-4 rounded-3xl p-5">
      {!preview ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void check(code);
          }}
        >
          <label className="flex flex-col gap-1 font-bold" htmlFor="gm-code">
            Codice partita
          </label>
          <input
            id="gm-code"
            className="gm-input text-center font-mono text-3xl uppercase tracking-[0.3em]"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(normalizeRoomCode(e.target.value).slice(0, 6))}
            placeholder="GIR742"
            autoComplete="off"
            autoCapitalize="characters"
          />
          <button type="submit" className="gm-btn" disabled={busy || code.length < 6}>
            CONTINUA
          </button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <p className="text-center font-bold">
            Partita <span className="font-mono tracking-widest text-[#39ff14]">{preview.code}</span>
            {preview.hostNickname ? ` di ${preview.hostNickname}` : ""} · {preview.activeCount} in sala
          </p>
          {preview.devices === "shared" && <p className="text-center font-bold text-[#ff8a95]">Questa partita si gioca su un solo telefono: non serve entrare.</p>}
          {preview.status === "closed" && <p className="text-center font-bold text-[#ff8a95]">Questa partita è terminata.</p>}
          <label className="flex flex-col gap-1 font-bold">
            Il tuo nome in partita
            <input className="gm-input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="Es. Luca" autoFocus />
          </label>
          {preview.mode === "teams" && preview.teams.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-bold">Scegli la squadra</legend>
              <div className="grid grid-cols-2 gap-2">
                {preview.teams.map((t) => (
                  <button key={t.id} type="button" aria-pressed={team === t.id} onClick={() => setTeam(t.id)} className={clsx("gm-panel rounded-2xl p-3 text-left", team === t.id && "gm-panel-green")}>
                    <span className="block font-black">👥 {t.name}</span>
                    <span className="text-xs font-bold text-white/70">{t.members} componenti</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <button type="submit" className="gm-btn" disabled={busy || !nickname.trim() || preview.devices === "shared" || preview.status === "closed"}>
            ▶ ENTRA IN PARTITA
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-center font-bold text-[#ff8a95]">
          {error}
        </p>
      )}
      <p className="text-center text-xs font-bold text-white/60">Ognuno entra con il proprio account: lo stesso account vale dal telefono e dal PC.</p>
    </div>
  );
}
