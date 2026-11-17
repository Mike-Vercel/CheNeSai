import type { Metadata } from "next";
import { TigShell } from "@/features/tig/shell/TigShell";
import { getHostUser } from "@/lib/server/gioco-libero";
import { listMyEvents } from "@/lib/server/tig/events";

export const metadata: Metadata = {
  title: { absolute: "TAVERNA DEI PIRATI · Il game show per pub" },
  description: "TAVERNA DEI PIRATI – il game show per pub dove ogni tavolo è una ciurma: cinque manche, sfide tra tavoli, bluff, Bottone del Caos e mascotte che evolvono. TV del locale, telefoni e PC.",
};

/** Aprire TAVERNA DEI PIRATI = entrare nella taverna: menu da videogioco (CREA SERATA, ENTRA, REGOLAMENTO, RIPRENDI). */
export default async function TigHome() {
  const host = await getHostUser().catch(() => null);
  const events = host ? await listMyEvents(host.userId).catch(() => []) : [];
  return <TigShell loggedIn={!!host} username={host?.profile?.username ?? null} events={events} start="menu" />;
}
