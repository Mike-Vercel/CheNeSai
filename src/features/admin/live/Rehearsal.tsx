"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/realtime/api-client";
import { Badge } from "@/components/ui";
import { LiveControl } from "./LiveControl";

interface SessionInfo {
  session: { id: string; code: string; displayKey: string; isTest: boolean; title: string; status: string };
}

/**
 * Prova generale: regia, schermo TV e tre smartphone simulati nella stessa
 * pagina (iframe sulla stessa origine; ogni telefono usa uno "slot" di prova
 * con un proprio cookie, consentito solo per le sessioni di prova).
 */
export function Rehearsal({ sessionId }: { sessionId: string }) {
  const [info, setInfo] = useState<SessionInfo["session"] | null>(null);
  const [phones, setPhones] = useState(3);
  useEffect(() => {
    void api<SessionInfo>(`/api/admin/sessions/${sessionId}`).then((r) => setInfo(r.session));
  }, [sessionId]);
  if (!info) return <p className="p-6 text-white/70">Caricamento…</p>;
  return (
    <div className="flex flex-col gap-3 p-3">
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet/50 bg-violet/10 px-4 py-3">
        <Link href={`/admin/sessions/${sessionId}`} className="rounded-lg bg-white/10 px-3 py-1 text-sm font-bold">
          ← Sessione
        </Link>
        <p className="flex-1 font-display text-xl text-[#c9a3ff]">Prova generale · {info.title}</p>
        {!info.isTest && <Badge color="red">Sessione reale: i telefoni simulati richiedono una sessione di prova</Badge>}
        <label className="text-sm font-bold">
          Telefoni{" "}
          <select value={phones} onChange={(e) => setPhones(Number(e.target.value))} className="rounded bg-black/40 px-2 py-1">
            {[1, 2, 3, 4].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </header>
      <div className="grid gap-3 2xl:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border-2 border-gold/50 bg-black">
            <iframe title="Schermo TV" src={`/display/${sessionId}?k=${info.displayKey}`} className="aspect-video w-full" allow="autoplay; fullscreen; screen-wake-lock" />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {Array.from({ length: phones }, (_, i) => (
              <div key={i} className="w-[260px] rounded-[34px] border-[8px] border-[#0b0b10] bg-black shadow-2xl">
                <iframe title={`Telefono ${i + 1}`} src={`/play/${info.code}${info.isTest ? `?slot=p${i + 1}` : ""}`} className="h-[520px] w-full rounded-[26px]" />
              </div>
            ))}
          </div>
        </div>
        <LiveControl sessionId={sessionId} embedded />
      </div>
    </div>
  );
}
