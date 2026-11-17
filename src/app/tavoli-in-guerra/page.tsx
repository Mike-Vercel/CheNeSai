import type { Metadata } from "next";
import { TigShell } from "@/features/tig/shell/TigShell";
import { getHostUser } from "@/lib/server/gioco-libero";
import { listMyEvents } from "@/lib/server/tig/events";

export const metadata: Metadata = {
  title: { absolute: "TAVOLI IN GUERRA! · Il game show per pub" },
  description: "TAVOLI IN GUERRA! – il game show per pub che trasforma ogni tavolo in una squadra: cinque manche, sfide tra tavoli, bluff, Bottone del Caos e mascotte che evolvono. TV del locale, telefoni e PC.",
};

/** Aprire TAVOLI IN GUERRA! = entrare nell'arena: menu da videogioco (CREA SERATA, ENTRA, REGOLAMENTO, RIPRENDI). */
export default async function TigHome() {
  const host = await getHostUser().catch(() => null);
  const events = host ? await listMyEvents(host.userId).catch(() => []) : [];
  return <TigShell loggedIn={!!host} username={host?.profile?.username ?? null} events={events} start="menu" />;
}
