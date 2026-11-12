import type { Viewport } from "next";
import Link from "next/link";
import { LiveStream } from "@/features/display/LiveStream";
import { getSql } from "@/lib/database/db";
import { streamAudioFromParam } from "@/lib/game-engine/stream-view";
import { authorizeLiveViewer } from "@/lib/server/live-view";
import { PlayerError } from "@/lib/server/players";

export const metadata = { title: { absolute: "CHE NE SAI?! · LIVE" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#000000" };

/**
 * VISTA PER LA LIVE di una partita (finestra o Sorgente browser di OBS / TikTok LIVE Studio).
 * Si apre dalla propria partita (giocatore: cookie del giocatore; host: account) oppure con il
 * gettone `t` copiato da lì (Sorgente browser, senza cookie). `?audio=0`: show muto.
 * L'indirizzo non contiene mai il codice della partita.
 */
export default async function LivePage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ t?: string | string[]; audio?: string | string[] }> }) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" && sp.t.length <= 120 ? sp.t : null;
  try {
    await authorizeLiveViewer(getSql(), sessionId, token);
  } catch (e) {
    const message = e instanceof PlayerError ? e.message : "Vista non disponibile";
    return (
      <main className="grid min-h-dvh place-items-center bg-black p-8 text-center text-white">
        <div className="flex max-w-lg flex-col items-center gap-4">
          <p className="font-display text-3xl text-gold">Vista per la LIVE</p>
          <p className="text-lg font-bold text-white/85">{message}</p>
          <p className="text-sm font-bold text-white/60">Apri la partita su questo browser (o accedi con il tuo account se sei l&apos;host), poi premi «Vista per la LIVE».</p>
          <Link href={`/accedi?next=${encodeURIComponent(`/gioca/live/${sessionId}`)}`} className="rounded-full bg-gold px-6 py-2.5 font-display text-xl text-ink">
            ACCEDI
          </Link>
        </div>
      </main>
    );
  }
  return <LiveStream sessionId={sessionId} token={token} audio={streamAudioFromParam(sp.audio)} />;
}
