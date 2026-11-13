import { redirect } from "next/navigation";
import { GameShell } from "@/features/giramente/shell/GameShell";
import { toShellRoom } from "@/features/giramente/shell/shell-rooms";
import { getHostUser } from "@/lib/server/gioco-libero";
import { listMyRooms } from "@/lib/server/giramente/rooms";

export const metadata = { title: "Nuova partita" };

/**
 * Creazione della partita: SOLO con un account (chi crea gestisce la partita). È la shell del gioco aperta
 * direttamente sul pannello NUOVA PARTITA (senza intro, salvo `?intro=1`); «‹ INDIETRO» porta al menu.
 */
export default async function NuovaPartita({ searchParams }: { searchParams: Promise<{ modo?: string; avanzate?: string }> }) {
  const sp = await searchParams;
  const host = await getHostUser();
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/giramente/nuova${q ? `?${q}` : ""}`)}`);
  const rooms = await listMyRooms(host.userId).catch(() => []);
  const teams = sp.modo === "squadre";
  return (
    <GameShell
      username={host.profile?.username ?? null}
      loggedIn
      rooms={rooms.map(toShellRoom)}
      start="setup"
      setup={{ mode: teams ? "teams" : "individual", skipMode: teams, advanced: sp.avanzate === "1" }}
    />
  );
}
